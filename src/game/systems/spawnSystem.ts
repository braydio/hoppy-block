import { DIFFICULTY_PRESETS } from '../core/constants'
import type { Enemy } from '../core/types'
import type { GameRuntime, UiState } from '../core/gameState'

type AudioEnergy = {
  bass: number
  mids: number
  highs: number
  intensity: number
}

export function getDifficultySettings(ui: UiState) {
  return DIFFICULTY_PRESETS[ui.difficulty.value as keyof typeof DIFFICULTY_PRESETS] || DIFFICULTY_PRESETS.medium
}

export function applyDifficultySettings(runtime: GameRuntime, ui: UiState) {
  const settings = getDifficultySettings(ui)
  runtime.baseScrollSpeed = 380 * settings.speedMult
  runtime.scrollSpeed = runtime.baseScrollSpeed * ui.speed.value
}

export function createSpawnSystem(runtime: GameRuntime, ui: UiState) {
  const patternCounts: Record<string, number> = {}
  let patternTotal = 0

  function trackPattern(energy: AudioEnergy) {
    const bands = [energy.bass, energy.mids, energy.highs]
    const dominantIdx = bands.indexOf(Math.max(...bands))
    const dominant = dominantIdx === 0 ? 'b' : dominantIdx === 1 ? 'm' : 'h'
    const encode = (v: number) => (v > 0.55 ? 'H' : v > 0.32 ? 'M' : 'L')
    const signature = `${dominant}-${encode(energy.bass)}${encode(energy.mids)}${encode(energy.highs)}`
    patternCounts[signature] = (patternCounts[signature] || 0) + 1
    patternTotal += 1

    const top = Object.entries(patternCounts)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 3)
    const topSignatures = top.map(t => t[0])
    const share = Math.min(1, (patternCounts[signature] || 0) / Math.max(1, patternTotal))
    const isTop = topSignatures.includes(signature)
    const bias = isTop ? 1.15 + share * 0.6 : 0.85

    return { signature, bias: Math.min(1.8, Math.max(0.75, bias)) }
  }

  function spawnEnemy(type: Enemy['type']) {
    let enemy: Enemy | null = null
    if (type === 'gomba') {
      enemy = {
        type: 'gomba',
        band: 'bass',
        x: runtime.width + 40,
        y: runtime.groundY - 28,
        width: 32,
        height: 28,
        alive: true,
        squished: false,
        squishTimer: 0,
        pancakeHeight: 6,
        currentHeight: 28,
        bob: 0,
        squash: 1,
        confident: true,
      }
    } else if (type === 'spiker') {
      enemy = {
        type: 'spiker',
        band: 'mid',
        x: runtime.width + 40,
        y: runtime.groundY - 34,
        width: 26,
        height: 34,
        alive: true,
        squished: false,
        squishTimer: 0,
        pancakeHeight: 10,
        currentHeight: 34,
        bob: 0,
        squash: 1,
        confident: true,
        spikes: true,
        concerned: false,
      }
    } else if (type === 'floater') {
      enemy = {
        type: 'floater',
        band: 'high',
        x: runtime.width + 40,
        y: runtime.groundY - 120,
        width: 28,
        height: 28,
        alive: true,
        squished: false,
        bob: 0,
        phase: Math.random() * Math.PI * 2,
        rage: 0,
      }
    }

    if (enemy) {
      runtime.enemies.push(enemy)
      runtime.spawnBeacons.push({
        x: enemy.x + enemy.width / 2,
        y: enemy.y + enemy.height + 8,
        alpha: 1,
        band: enemy.band,
      })
    }
    return enemy
  }

  function spawnObstacle(options?: { nearStart?: boolean }) {
    const minGap = 200
    const widthOptions = [30, 40, 50]
    const chosenWidth = widthOptions[Math.floor(Math.random() * widthOptions.length)] ?? 40

    const offset = options?.nearStart ? Math.random() * 30 : Math.random() * 70
    const obstacle = {
      x: runtime.width + offset,
      y: runtime.groundY - 40,
      width: chosenWidth,
      height: 40,
      passed: false,
    }

    const tooClose = runtime.obstacles.some(o => obstacle.x - (o.x + o.width) < minGap)
    if (!tooClose) {
      runtime.obstacles.push(obstacle)
    }
  }

  function spawnTelegraphedEnemy(type: Enemy['type']) {
    const e = spawnEnemy(type)
    if (e) e.telegraph = 0.5
  }

  function spawnFormation(kind: 'triple-line' | 'aerial' | 'stagger') {
    const spacing = 90
    if (kind === 'triple-line') {
      const types: Enemy['type'][] = ['gomba', 'spiker', 'gomba']
      types.forEach((t, i) => {
        const e = spawnEnemy(t)
        if (e) e.x += i * spacing
      })
    } else if (kind === 'aerial') {
      ;['floater', 'floater'].forEach((t, i) => {
        const e = spawnEnemy(t as Enemy['type'])
        if (e) {
          e.x += i * (spacing + 30)
          e.y -= 30 * i + 20
        }
      })
    } else if (kind === 'stagger') {
      const types: Enemy['type'][] = ['gomba', 'spiker', 'floater']
      types.forEach((t, i) => {
        const e = spawnEnemy(t)
        if (e) e.x += i * (spacing + 20)
      })
    }
  }

  function pulseEnemiesOnBeat(strength = 1) {
    for (const e of runtime.enemies) {
      if (!e.alive || e.squished) continue
      e.squishImpulse = (e.squishImpulse || 0) + 0.35 * strength
      e.beatBob = (e.beatBob || 0) + 8 * strength
      if (e.band === 'high') {
        e.phase = 0
      }
    }
  }

  function pickEnemyByEnergy(energy: AudioEnergy) {
    const weights = [
      { type: 'gomba' as const, weight: 0.35 + Math.max(0, energy.bass - 0.25) * 2.6 },
      { type: 'spiker' as const, weight: 0.35 + Math.max(0, energy.mids - 0.25) * 2.2 },
      { type: 'floater' as const, weight: 0.25 + Math.max(0, energy.highs - 0.2) * 2.4 },
    ]

    const total = weights.reduce((sum, w) => sum + w.weight, 0)
    if (total < 0.45) return null

    let roll = Math.random() * total
    for (const w of weights) {
      roll -= w.weight
      if (roll <= 0) return w.type
    }
    return 'gomba'
  }

  function spawnBeatDrivenEntities(isSubBeat: boolean, energy: AudioEnergy) {
    const pattern = trackPattern(energy)
    const diff = getDifficultySettings(ui)
    const uniformity = diff.uniformity ?? 0.5
    const beatsSinceEnemy = runtime.beatIndex - runtime.lastEnemySpawnBeat
    const beatsSinceObstacle = runtime.beatIndex - runtime.lastObstacleSpawnBeat

    const intensity = Math.max(0, Math.min(1, energy.intensity))
    const spawnNoise = (Math.random() - 0.5) * (1 - uniformity) * 0.35
    const spawnChance = ((isSubBeat
      ? 0.18 + intensity * 0.36
      : 0.34 + intensity * 0.45) + spawnNoise) * diff.spawnRate * pattern.bias

    const formationChance = !isSubBeat && intensity > 0.35
      ? (0.22 - uniformity * 0.06) * diff.spawnRate * (0.95 + pattern.bias * 0.3)
      : 0

    const minBeatGapBase = isSubBeat ? 0.3 : 0.7
    const minBeatGap = minBeatGapBase + uniformity * 0.18 - (1 - uniformity) * 0.06

    const beaconBand = energy.highs > energy.bass && energy.highs > energy.mids
      ? 'high'
      : energy.mids > energy.bass
        ? 'mid'
        : 'bass'

    if (!isSubBeat && Math.random() < formationChance && beatsSinceEnemy >= minBeatGap + 0.4) {
      const form = intensity > 0.6 ? 'stagger' : 'triple-line'
      spawnFormation(form)
      runtime.lastEnemySpawnBeat = runtime.beatIndex + 1
    } else if (beatsSinceEnemy >= minBeatGap && Math.random() < spawnChance) {
      const type = pickEnemyByEnergy(energy)
      if (type) {
        if (!isSubBeat && intensity > 0.6 && Math.random() < 0.25) {
          spawnTelegraphedEnemy(type)
        } else {
          spawnEnemy(type)
        }
        runtime.spawnBeacons.push({
          x: runtime.width + 60,
          y: runtime.groundY - 24,
          alpha: 0.8,
          band: beaconBand,
        })
        runtime.lastEnemySpawnBeat = runtime.beatIndex + (isSubBeat ? 0.5 : 0)
      }
    }

    const obstacleNoise = (Math.random() - 0.5) * (1 - uniformity) * 0.25
    const obstacleChance = (0.2 + intensity * 0.36 + energy.highs * 0.22 + obstacleNoise) * diff.spawnRate
    const minObstacleGap = 0.65 + uniformity * 0.22
    if (!isSubBeat && beatsSinceObstacle >= minObstacleGap && Math.random() < obstacleChance) {
      spawnObstacle()
      runtime.lastObstacleSpawnBeat = runtime.beatIndex
    }
  }

  return {
    spawnEnemy,
    spawnObstacle,
    spawnFormation,
    spawnBeatDrivenEntities,
    pulseEnemiesOnBeat,
  }
}
