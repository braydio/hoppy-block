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

    if (enemy) runtime.enemies.push(enemy)
    return enemy
  }

  function spawnObstacle() {
    const minGap = 280
    const widthOptions = [30, 40, 50]
    const chosenWidth = widthOptions[Math.floor(Math.random() * widthOptions.length)] ?? 40

    const obstacle = {
      x: runtime.width + Math.random() * 50,
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
    const diff = getDifficultySettings(ui)
    const uniformity = diff.uniformity ?? 0.5
    const beatsSinceEnemy = runtime.beatIndex - runtime.lastEnemySpawnBeat
    const beatsSinceObstacle = runtime.beatIndex - runtime.lastObstacleSpawnBeat

    const intensity = Math.max(0, Math.min(1, energy.intensity))
    const spawnNoise = (Math.random() - 0.5) * (1 - uniformity) * 0.35
    const spawnChance = ((isSubBeat
      ? 0.1 + intensity * 0.25
      : 0.2 + intensity * 0.35) + spawnNoise) * diff.spawnRate

    const formationChance = !isSubBeat && intensity > 0.35
      ? (0.15 - uniformity * 0.08) * diff.spawnRate
      : 0

    const minBeatGapBase = isSubBeat ? 0.5 : 1
    const minBeatGap = minBeatGapBase + uniformity * 0.25 - (1 - uniformity) * 0.1

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
        runtime.lastEnemySpawnBeat = runtime.beatIndex + (isSubBeat ? 0.5 : 0)
      }
    }

    const obstacleNoise = (Math.random() - 0.5) * (1 - uniformity) * 0.25
    const obstacleChance = (0.12 + intensity * 0.28 + energy.highs * 0.18 + obstacleNoise) * diff.spawnRate
    const minObstacleGap = 1 + uniformity * 0.25
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
