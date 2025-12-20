import { DIFFICULTY_PRESETS, PLAYER_ANCHOR_X } from '../core/constants'
import type { Enemy } from '../core/types'
import type { GameRuntime, UiState } from '../core/gameState'

type AudioEnergy = {
  bass: number
  mids: number
  highs: number
  intensity: number
  loudnessDelta?: number
  drive?: number
  driveDelta?: number
  audioTime?: number
  trackDuration?: number
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
  let spawnAccumulator = 0
  let lastAudioTime = 0
  let lastEnemyAudioSpawnTime = -Infinity
  const estimateBeatsToImpact = (beatMs: number) => {
    const playerX = runtime.player?.x ?? PLAYER_ANCHOR_X
    const spawnX = runtime.width + 60 // roughly where enemies are telegraphed
    const distance = Math.max(0, spawnX - playerX)
    const enemySpeed = Math.max(120, runtime.scrollSpeed * 0.95)
    const slamBuffer = 0.18 // small allowance for jump + slam windup
    const beatSeconds = beatMs / 1000
    return Math.max(1, Math.round((distance / enemySpeed + slamBuffer) / beatSeconds))
  }

  const computeSpawnX = (beatsToImpact: number, beatMs: number) => {
    const playerX = runtime.player?.x ?? PLAYER_ANCHOR_X
    const enemySpeed = Math.max(120, runtime.scrollSpeed * 0.95)
    const beatSeconds = beatMs / 1000
    const desiredDistance = enemySpeed * beatSeconds * beatsToImpact
    const baseline = runtime.width + 40
    return Math.max(baseline, playerX + desiredDistance)
  }

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

  function spawnEnemy(type: Enemy['type'], spawnX?: number) {
    let enemy: Enemy | null = null
    if (type === 'gomba') {
      enemy = {
        type: 'gomba',
        band: 'bass',
        x: spawnX ?? runtime.width + 40,
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
        x: spawnX ?? runtime.width + 40,
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
        x: spawnX ?? runtime.width + 40,
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

  function spawnTelegraphedEnemy(type: Enemy['type'], spawnX: number) {
    const e = spawnEnemy(type, spawnX)
    if (e) e.telegraph = 0.5
  }

  function spawnFormation(kind: 'triple-line' | 'aerial' | 'stagger', spawnX: number) {
    const spacing = 90
    if (kind === 'triple-line') {
      const types: Enemy['type'][] = ['gomba', 'spiker', 'gomba']
      types.forEach((t, i) => {
        const e = spawnEnemy(t, spawnX + i * spacing)
      })
    } else if (kind === 'aerial') {
      ;['floater', 'floater'].forEach((t, i) => {
        const e = spawnEnemy(t as Enemy['type'], spawnX + i * (spacing + 30))
        if (e) {
          e.y -= 30 * i + 20
        }
      })
    } else if (kind === 'stagger') {
      const types: Enemy['type'][] = ['gomba', 'spiker', 'floater']
      types.forEach((t, i) => {
        const e = spawnEnemy(t, spawnX + i * (spacing + 20))
      })
    }
  }

  function spawnPattern(spawnX: number, intensity: number) {
    const patterns: Array<() => void> = [
      () => spawnFormation('triple-line', spawnX),
      () => spawnFormation('stagger', spawnX),
      () => {
        const base = spawnEnemy('gomba', spawnX)
        if (base) {
          spawnEnemy('gomba', base.x + 68)
          spawnEnemy('spiker', base.x + 136)
        }
      },
      () => {
        const base = spawnEnemy('floater', spawnX)
        if (base) {
          base.y -= 20
          const second = spawnEnemy('floater', base.x + 70)
          if (second) second.y -= 40
          spawnEnemy('gomba', base.x + 140)
        }
      },
    ]
    const choice = intensity > 0.6
      ? patterns[Math.floor(Math.random() * (patterns.length - 1)) + 1]
      : patterns[Math.floor(Math.random() * patterns.length)]
    choice?.()
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
    const spawnRate = diff.spawnRate ?? 1
    const beatMs = 60000 / ui.bpm.value
    const beatsToImpact = estimateBeatsToImpact(beatMs)
    const spawnX = computeSpawnX(beatsToImpact, beatMs)
    // Spawn far enough ahead that a perfect slam lines up with the beat.
    const projectedImpactBeat = runtime.beatIndex + beatsToImpact
    const beatsSinceEnemy = runtime.beatIndex - runtime.lastEnemySpawnBeat
    const beatsSinceObstacle = runtime.beatIndex - runtime.lastObstacleSpawnBeat
    const forceSpawnGap = Math.max(0.8, (diff.uniformity ? 2.2 - diff.uniformity * 0.6 : 2) - spawnRate * 0.5)

    const intensity = Math.max(0, Math.min(1, energy.intensity))
    const drive = Math.max(0, Math.min(1, energy.drive ?? intensity))
    const dynamics = Math.max(0, Math.min(1.2, Math.abs(energy.loudnessDelta ?? 0) * 3))
    const spawnNoise = (Math.random() - 0.5) * (1 - uniformity) * 0.5
    const spawnChance = ((isSubBeat
      ? 0.32 + intensity * 0.48
      : 0.58 + intensity * 0.55) + spawnNoise) * (1 + dynamics * 0.8) * spawnRate * pattern.bias

    const formationChance = !isSubBeat && intensity > 0.35
      ? (0.32 - uniformity * 0.08) * (1 + dynamics * 0.7) * spawnRate * (0.95 + pattern.bias * 0.35)
      : 0

    const minBeatGapBase = isSubBeat ? 0.24 : 0.52
    const minBeatGapRaw = minBeatGapBase + uniformity * 0.16 - (1 - uniformity) * 0.06
    const minBeatGap = minBeatGapRaw / Math.max(0.55, 0.65 + spawnRate * 0.35)

    const beaconBand = energy.highs > energy.bass && energy.highs > energy.mids
      ? 'high'
      : energy.mids > energy.bass
        ? 'mid'
        : 'bass'

    // Beat-locked spawn scheduling: distribute activity evenly across the track,
    // but only spawn on beats (not sub-beats) to keep cadence musical.
    const audioTime = energy.audioTime ?? lastAudioTime
    const duration = energy.trackDuration ?? 0
    const wrapped = audioTime + 0.05 < lastAudioTime
    lastAudioTime = audioTime
    if (wrapped) {
      spawnAccumulator = 0
      lastEnemyAudioSpawnTime = -Infinity
    }

    const progress = duration > 0 && Number.isFinite(duration)
      ? Math.max(0, Math.min(1, audioTime / duration))
      : 0

    let didSpawn = false
    let spawnsThisTick = 0
    if (!isSubBeat) {
      const basePerBeat = 0.35 + progress * 0.55
      const driveMult = 0.6 + drive * 1.1 + dynamics * 0.25 + Math.max(0, (energy.driveDelta ?? 0) * 1.4)
      const targetPerBeat = basePerBeat * spawnRate * (0.92 + pattern.bias * 0.18) * Math.max(0.35, Math.min(2.1, driveMult))

      spawnAccumulator = Math.min(6, spawnAccumulator + targetPerBeat)

      const maxGapBeats = Math.max(1, Math.round(2.6 - spawnRate * 0.8))
      if (beatsSinceEnemy >= maxGapBeats) spawnAccumulator = Math.max(spawnAccumulator, 1)

      if (spawnAccumulator >= 1) {
        if (Math.random() < 0.55) spawnPattern(spawnX, intensity)
        else {
          const type = pickEnemyByEnergy(energy) ?? 'gomba'
          spawnEnemy(type, spawnX)
        }
        spawnAccumulator -= 1
        lastEnemyAudioSpawnTime = audioTime
        runtime.lastEnemySpawnBeat = runtime.beatIndex
        didSpawn = true
        spawnsThisTick += 1
      }
    }

    const spawnedEnemyThisTick = spawnsThisTick > 0 || didSpawn

    if (!spawnedEnemyThisTick && !isSubBeat && Math.random() < formationChance && beatsSinceEnemy >= minBeatGap + 0.2) {
      if (Math.random() < 0.55) {
        spawnPattern(spawnX, intensity)
      } else {
        const form = intensity > 0.6 ? 'stagger' : 'triple-line'
        spawnFormation(form, spawnX)
      }
      runtime.lastEnemySpawnBeat = runtime.beatIndex
      spawnsThisTick += 1
    } else if (!spawnedEnemyThisTick && beatsSinceEnemy >= minBeatGap && Math.random() < spawnChance) {
      const type = pickEnemyByEnergy(energy)
      if (type) {
        if (!isSubBeat && intensity > 0.6 && Math.random() < 0.25) {
          spawnTelegraphedEnemy(type, spawnX)
        } else {
          spawnEnemy(type, spawnX)
        }
        runtime.spawnBeacons.push({
          x: runtime.width + 60,
          y: runtime.groundY - 24,
          alpha: 0.8,
          band: beaconBand,
        })
        runtime.lastEnemySpawnBeat = runtime.beatIndex
        spawnsThisTick += 1
      }
    } else if (!spawnedEnemyThisTick && !isSubBeat && beatsSinceEnemy >= forceSpawnGap) {
      // Guarantee a spawn if RNG ran cold for too long.
      spawnPattern(spawnX, intensity)
      runtime.lastEnemySpawnBeat = runtime.beatIndex
      spawnsThisTick += 1
    }

    const obstacleNoise = (Math.random() - 0.5) * (1 - uniformity) * 0.25
    const obstacleChance = (0.2 + intensity * 0.36 + energy.highs * 0.22 + obstacleNoise) * spawnRate
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
