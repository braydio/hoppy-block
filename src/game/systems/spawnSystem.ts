import { DIFFICULTY_PRESETS, PLAYER_ANCHOR_X, LANE_OFFSETS } from '../core/constants'
import type { Enemy } from '../core/types'
import type { GameRuntime, UiState, SpawnLogEntry } from '../core/gameState'
import type { SpawnAttribution, SpawnCause } from '../../debug/spawnCauses'

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
  return (
    DIFFICULTY_PRESETS[ui.difficulty.value as keyof typeof DIFFICULTY_PRESETS] ||
    DIFFICULTY_PRESETS.medium
  )
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
  const maxSpawnLogEntries = 8
  const maxSpawnEvents = 240
  const maxSpawnHistory = 300
  const maxSpawnDebugTicks = 300
  let currentSpawnAttribution: SpawnAttribution | null = null
  let currentSpawnTime: number | null = null
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
    const topSignatures = top.map((t) => t[0])
    const share = Math.min(1, (patternCounts[signature] || 0) / Math.max(1, patternTotal))
    const isTop = topSignatures.includes(signature)
    const bias = isTop ? 1.15 + share * 0.6 : 0.85

    return { signature, bias: Math.min(1.8, Math.max(0.75, bias)) }
  }

  function spawnEnemy(type: Enemy['type'], spawnX?: number) {
    const laneIndex =
      runtime.groundMode === 'segmented-y'
        ? type === 'floater'
          ? Math.min(2, LANE_OFFSETS.length - 1)
          : type === 'spiker'
            ? Math.min(1, LANE_OFFSETS.length - 1)
            : 0
        : 0
    const laneY = runtime.groundY + (LANE_OFFSETS[laneIndex] ?? 0)
    let enemy: Enemy | null = null
    if (type === 'gomba') {
      enemy = {
        type: 'gomba',
        band: 'bass',
        x: spawnX ?? runtime.width + 40,
        y: laneY - 28,
        width: 32,
        height: 28,
        laneIndex,
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
        y: laneY - 34,
        width: 26,
        height: 34,
        laneIndex,
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
        y: laneY - 120,
        width: 28,
        height: 28,
        laneIndex,
        alive: true,
        squished: false,
        bob: 0,
        phase: Math.random() * Math.PI * 2,
        rage: 0,
      }
    }

    if (enemy) {
      if (currentSpawnAttribution) {
        enemy.spawnAttribution = currentSpawnAttribution
        enemy.spawnTime = currentSpawnTime ?? performance.now()
      }
      runtime.enemies.push(enemy)
      runtime.spawnBeacons.push({
        x: enemy.x + enemy.width / 2,
        y: enemy.y + enemy.height + 8,
        alpha: 1,
        band: enemy.band,
      })
      if (enemy.spawnAttribution && enemy.spawnTime != null) {
        runtime.spawnHistory.push({
          attribution: enemy.spawnAttribution,
          x: enemy.x,
          y: enemy.y,
          time: enemy.spawnTime,
          enemyType: enemy.type,
        })
        if (runtime.spawnHistory.length > maxSpawnHistory) {
          runtime.spawnHistory.splice(0, runtime.spawnHistory.length - maxSpawnHistory)
        }
      }
    }
    return enemy ? 1 : 0
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

    const tooClose = runtime.obstacles.some((o) => obstacle.x - (o.x + o.width) < minGap)
    if (!tooClose) {
      runtime.obstacles.push(obstacle)
      return 1
    }
    return 0
  }

  function spawnToken(spawnX?: number) {
    if (runtime.groundMode !== 'segmented-y') return 0
    const dangerousLaneIndices = LANE_OFFSETS.map((_offset, index) => index).slice(1)
    if (dangerousLaneIndices.length === 0) return 0
    const laneIndex =
      dangerousLaneIndices[Math.floor(Math.random() * dangerousLaneIndices.length)] ?? 0
    const laneY = runtime.groundY + (LANE_OFFSETS[laneIndex] ?? 0)
    const token = {
      x: spawnX ?? runtime.width + 40,
      y: laneY - 50,
      r: 7,
      value: 1,
      laneIndex,
    }
    runtime.tokens.push(token)
    return 1
  }

  function spawnTelegraphedEnemy(type: Enemy['type'], spawnX: number) {
    const before = runtime.enemies.length
    const count = spawnEnemy(type, spawnX)
    const e = runtime.enemies[before]
    if (count && e) e.telegraph = 0.5
    return count
  }

  function spawnFormation(kind: 'triple-line' | 'aerial' | 'stagger', spawnX: number) {
    const spacing = 90
    let count = 0
    if (kind === 'triple-line') {
      const types: Enemy['type'][] = ['gomba', 'spiker', 'gomba']
      types.forEach((t, i) => {
        count += spawnEnemy(t, spawnX + i * spacing)
      })
    } else if (kind === 'aerial') {
      ;['floater', 'floater'].forEach((t, i) => {
        const before = runtime.enemies.length
        count += spawnEnemy(t as Enemy['type'], spawnX + i * (spacing + 30))
        const e = runtime.enemies[before]
        if (e) e.y -= 30 * i + 20
      })
    } else if (kind === 'stagger') {
      const types: Enemy['type'][] = ['gomba', 'spiker', 'floater']
      types.forEach((t, i) => {
        count += spawnEnemy(t, spawnX + i * (spacing + 20))
      })
    }
    return count
  }

  function spawnPattern(spawnX: number, intensity: number, maxCount: number) {
    const patterns: Array<{ count: number; run: () => number }> = [
      { count: 3, run: () => spawnFormation('triple-line', spawnX) },
      { count: 3, run: () => spawnFormation('stagger', spawnX) },
      {
        count: 3,
        run: () => {
          let count = 0
          count += spawnEnemy('gomba', spawnX)
          if (count > 0) {
            count += spawnEnemy('gomba', spawnX + 68)
            count += spawnEnemy('spiker', spawnX + 136)
          }
          return count
        },
      },
      {
        count: 3,
        run: () => {
          let count = 0
          const before = runtime.enemies.length
          count += spawnEnemy('floater', spawnX)
          const base = runtime.enemies[before]
          if (base) {
            base.y -= 20
            const secondIdx = runtime.enemies.length
            count += spawnEnemy('floater', base.x + 70)
            const second = runtime.enemies[secondIdx]
            if (second) second.y -= 40
            count += spawnEnemy('gomba', base.x + 140)
          }
          return count
        },
      },
    ]
    const allowed = patterns.filter((p) => p.count <= maxCount)
    if (allowed.length === 0) return 0
    const pool = intensity > 0.6 ? allowed.slice(1) : allowed
    const choice = pool[Math.floor(Math.random() * pool.length)] ?? allowed[0]
    return choice?.run() ?? 0
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
    const debugEnabled = ui.debugAudioSpawnView.value
    const dominantBand =
      energy.highs > energy.bass && energy.highs > energy.mids
        ? 'high'
        : energy.mids > energy.bass
          ? 'mid'
          : 'bass'
    const pattern = trackPattern(energy)
    const diff = getDifficultySettings(ui)
    const uniformity = diff.uniformity ?? 0.5
    const spawnRate = diff.spawnRate ?? 1
    const beatMs = 60000 / ui.bpm.value
    const beatsToImpact = estimateBeatsToImpact(beatMs)
    const spawnX = computeSpawnX(beatsToImpact, beatMs)
    // Spawn far enough ahead that a perfect slam lines up with the beat.
    const beatsSinceEnemy = runtime.beatIndex - runtime.lastEnemySpawnBeat
    const beatsSinceObstacle = runtime.beatIndex - runtime.lastObstacleSpawnBeat
    const forceSpawnGap = Math.max(
      1,
      (diff.uniformity ? 2.6 - diff.uniformity * 0.6 : 2.2) - spawnRate * 0.4,
    )

    const intensity = Math.max(0, Math.min(1, energy.intensity))
    const drive = Math.max(0, Math.min(1, energy.drive ?? intensity))
    const dynamics = Math.max(0, Math.min(1.2, Math.abs(energy.loudnessDelta ?? 0) * 3))
    const spawnNoise = (Math.random() - 0.5) * (1 - uniformity) * 0.5
    const spawnChance =
      ((isSubBeat ? 0.25 + intensity * 0.35 : 0.48 + intensity * 0.4) + spawnNoise) *
      (1 + dynamics * 0.7) *
      spawnRate *
      pattern.bias

    const formationChance =
      !isSubBeat && intensity > 0.35
        ? (0.24 - uniformity * 0.06) *
          (1 + dynamics * 0.6) *
          spawnRate *
          (0.9 + pattern.bias * 0.25)
        : 0

    const minBeatGapBase = isSubBeat ? 0.24 : 0.52
    const minBeatGapRaw = minBeatGapBase + uniformity * 0.16 - (1 - uniformity) * 0.06
    const minBeatGap = minBeatGapRaw / Math.max(0.55, 0.65 + spawnRate * 0.35)

    const beaconBand = dominantBand

    function buildSpawnAttribution(): SpawnAttribution {
      const bandValue =
        dominantBand === 'bass' ? energy.bass : dominantBand === 'mid' ? energy.mids : energy.highs
      const causes: SpawnCause[] = [
        { kind: 'beat', beat: runtime.beatIndex },
        { kind: 'band', band: dominantBand, value: bandValue },
        { kind: 'intensity', value: intensity },
        { kind: 'drive', value: drive },
        { kind: 'dynamics', delta: dynamics },
        { kind: 'patternBias', signature: pattern.signature, bias: pattern.bias },
      ]

      return {
        beat: runtime.beatIndex,
        isSubBeat,
        dominantBand,
        causes,
      }
    }

    // Beat-locked spawn scheduling: distribute activity evenly across the track,
    // but only spawn on beats (not sub-beats) to keep cadence musical.
    const audioTime = energy.audioTime ?? lastAudioTime
    const duration = energy.trackDuration ?? 0
    const wrapped = audioTime + 0.05 < lastAudioTime
    lastAudioTime = audioTime
    if (wrapped) {
      spawnAccumulator = 0
    }

    const progress =
      duration > 0 && Number.isFinite(duration) ? Math.max(0, Math.min(1, audioTime / duration)) : 0

    const capStart = diff.spawnCapStart ?? 1
    const capMax = diff.spawnCapMax ?? 3
    const capRampSeconds = diff.spawnCapRampSeconds ?? 110
    const elapsedSeconds = Math.max(0, audioTime)
    const timeRamp = capRampSeconds > 0 ? Math.min(1, elapsedSeconds / capRampSeconds) : 1
    const comboRamp = Math.min(1, Math.max(0, runtime.beatStreak) / 12)
    const ramp = Math.min(1, timeRamp + comboRamp * 0.35)
    const spawnCap = capStart + (capMax - capStart) * ramp

    if (debugEnabled) {
      currentSpawnAttribution = buildSpawnAttribution()
      currentSpawnTime = energy.audioTime ?? performance.now()
    } else {
      currentSpawnAttribution = null
      currentSpawnTime = null
    }

    let didSpawn = false
    let spawnsThisTick = 0
    let enemySpawnsThisTick = 0
    let targetPerBeat = 0
    const remainingCap = () => Math.floor(spawnCap - spawnsThisTick + 1e-6)
    if (!isSubBeat) {
      const basePerBeat = 0.25 + progress * 0.35
      const driveMult =
        0.6 + drive * 1.1 + dynamics * 0.25 + Math.max(0, (energy.driveDelta ?? 0) * 1.4)
      targetPerBeat =
        basePerBeat *
        spawnRate *
        (0.9 + pattern.bias * 0.12) *
        Math.max(0.35, Math.min(1.8, driveMult))

      spawnAccumulator = Math.min(4.5, spawnAccumulator + targetPerBeat)
      spawnAccumulator = Math.min(spawnAccumulator, Math.max(1, spawnCap))

      const maxGapBeats = Math.max(1, Math.round(3.2 - spawnRate * 0.7))
      if (beatsSinceEnemy >= maxGapBeats) spawnAccumulator = Math.max(spawnAccumulator, 1)

      if (spawnAccumulator >= 1 && remainingCap() > 0) {
        let count = 0
        if (Math.random() < 0.55 && remainingCap() > 1) {
          count = spawnPattern(spawnX, intensity, remainingCap())
        } else {
          const type = pickEnemyByEnergy(energy) ?? 'gomba'
          count = spawnEnemy(type, spawnX)
        }
        if (count > 0) {
          spawnAccumulator -= 1
          runtime.lastEnemySpawnBeat = runtime.beatIndex
          didSpawn = true
          spawnsThisTick += count
          enemySpawnsThisTick += count
        }
      }
    }

    const spawnedEnemyThisTick = spawnsThisTick > 0 || didSpawn

    if (
      !spawnedEnemyThisTick &&
      !isSubBeat &&
      Math.random() < formationChance &&
      beatsSinceEnemy >= minBeatGap + 0.2 &&
      remainingCap() > 0
    ) {
      const remaining = remainingCap()
      let count = 0
      if (Math.random() < 0.55) {
        count = spawnPattern(spawnX, intensity, remaining)
      } else {
        const form = intensity > 0.6 ? 'stagger' : 'triple-line'
        count = remaining >= 2 ? spawnFormation(form, spawnX) : 0
      }
      if (count > 0) {
        runtime.lastEnemySpawnBeat = runtime.beatIndex
        spawnsThisTick += count
        enemySpawnsThisTick += count
      }
    } else if (
      !spawnedEnemyThisTick &&
      beatsSinceEnemy >= minBeatGap &&
      Math.random() < spawnChance
    ) {
      const remaining = remainingCap()
      const type = pickEnemyByEnergy(energy)
      if (type && remaining > 0) {
        const count =
          !isSubBeat && intensity > 0.6 && Math.random() < 0.25
            ? spawnTelegraphedEnemy(type, spawnX)
            : spawnEnemy(type, spawnX)
        if (count > 0) {
          runtime.spawnBeacons.push({
            x: runtime.width + 60,
            y: runtime.groundY - 24,
            alpha: 0.8,
            band: beaconBand,
          })
          runtime.lastEnemySpawnBeat = runtime.beatIndex
          spawnsThisTick += count
          enemySpawnsThisTick += count
        }
      }
    } else if (
      !spawnedEnemyThisTick &&
      !isSubBeat &&
      beatsSinceEnemy >= forceSpawnGap &&
      remainingCap() > 0
    ) {
      // Guarantee a spawn if RNG ran cold for too long.
      const count = spawnPattern(spawnX, intensity, remainingCap())
      if (count > 0) {
        runtime.lastEnemySpawnBeat = runtime.beatIndex
        spawnsThisTick += count
        enemySpawnsThisTick += count
      }
    }

    const obstacleNoise = (Math.random() - 0.5) * (1 - uniformity) * 0.25
    const obstacleChance =
      (0.2 + intensity * 0.36 + energy.highs * 0.22 + obstacleNoise) * spawnRate
    const minObstacleGap = 0.65 + uniformity * 0.22
    if (
      !isSubBeat &&
      beatsSinceObstacle >= minObstacleGap &&
      Math.random() < obstacleChance &&
      remainingCap() > 0
    ) {
      spawnsThisTick += spawnObstacle()
      runtime.lastObstacleSpawnBeat = runtime.beatIndex
    }

    if (!isSubBeat && runtime.groundMode === 'segmented-y') {
      const tokenChance = Math.min(0.12, 0.03 + intensity * 0.06 + drive * 0.03)
      if (Math.random() < tokenChance && runtime.tokens.length < 4) {
        spawnToken(spawnX + 20)
      }
    }

    if (debugEnabled && enemySpawnsThisTick > 0) {
      runtime.spawnEvents.push({
        beat: runtime.beatIndex,
        isSubBeat,
        count: enemySpawnsThisTick,
        time: audioTime,
      })
      if (runtime.spawnEvents.length > maxSpawnEvents) {
        runtime.spawnEvents.splice(0, runtime.spawnEvents.length - maxSpawnEvents)
      }
    }

    if (debugEnabled && !isSubBeat) {
      runtime.spawnDebugTicks.push({
        beat: runtime.beatIndex,
        time: audioTime,
        targetPerBeat,
        spawns: enemySpawnsThisTick,
      })
      if (runtime.spawnDebugTicks.length > maxSpawnDebugTicks) {
        runtime.spawnDebugTicks.splice(0, runtime.spawnDebugTicks.length - maxSpawnDebugTicks)
      }
    }

    if (debugEnabled) {
      const spawnLogEntry: SpawnLogEntry = {
        beat: runtime.beatIndex,
        isSubBeat,
        intensity,
        drive,
        dynamics,
        patternBias: pattern.bias,
        spawnChance,
        formationChance,
        spawnAccumulator,
        targetPerBeat,
        obstacleChance,
        beatsSinceEnemy,
        spawns: spawnsThisTick,
        didSpawn,
        timestamp: audioTime,
      }
      const log = ui.spawnLog.value
      log.push(spawnLogEntry)
      if (log.length > maxSpawnLogEntries) {
        log.splice(0, log.length - maxSpawnLogEntries)
      }
    }

    currentSpawnAttribution = null
    currentSpawnTime = null
  }

  return {
    spawnEnemy,
    spawnObstacle,
    spawnFormation,
    spawnToken,
    spawnBeatDrivenEntities,
    pulseEnemiesOnBeat,
    reset() {
      for (const key of Object.keys(patternCounts)) delete patternCounts[key]
      patternTotal = 0
      spawnAccumulator = 0
      lastAudioTime = 0
    },
  }
}
