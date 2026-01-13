/**
 * Main game loop: orchestrates audio sync, input handling, physics updates, rendering,
 * and spawn timing for the rhythm runner.
 */
import { clamp, lerp } from './systems/physicsSystem'
import { createSpawnSystem, applyDifficultySettings } from './systems/spawnSystem'
import { isOnBeat, registerBeatAction } from './systems/beatSystem'
import {
  ensureReplayRecorder,
  setupReplayRecorder,
  stopReplayRecorder,
} from './systems/replaySystem'
import { createAudioEngine } from './systems/audioEngine'
import { triggerSquishBounce, applyBlastStrikes, applySlideStrike, addScore, registerAirKill } from './systems/combatSystem'
import {
  DEFAULT_TRACK,
  DASH_WINDOW_MS,
  DASH_DURATION,
  DASH_THRUST,
  PLAYER_ANCHOR_X,
  DASH_COST,
  SLIDE_DURATION,
  SLIDE_DISTANCE,
  SLIDE_CROUCH_DURATION,
  SLIDE_DASH_DURATION,
  SLIDE_GLIDE_DURATION,
  SLIDE_FLIP_DURATION,
  PHASE_DURATION,
  PHASE_COST,
  PHASE_COOLDOWN,
  DOUBLE_JUMP_COST,
  INTENSE_SLAM_HEIGHT,
  CHARGE_DRAIN_RATE,
  CHARGE_REGEN_GROUND,
  CHARGE_REGEN_AIR,
  PHASE_STATES,
} from './core/constants'
import { keyLabel, matchesKey } from './core/keybinds'
import { getPalette } from './render/colors'
import { drawHUD } from './render/drawHUD'
import { drawWorld } from './render/drawWorld'
import {
  drawAudioVisualizer,
  drawDash,
  drawFlash,
  drawHatBursts,
  drawObstacles,
  drawPhaseOverlay,
  drawPowerTint,
  drawScorePops,
  drawShockwaves,
  drawSonicBursts,
} from './render/drawEffects'
import { drawPlayer } from './render/drawPlayer'
import { drawEnemies } from './render/drawEnemies'
import type { GameState } from './core/gameState'
import type { GroundSegment } from './core/types'

export function createGameLoop(canvas: HTMLCanvasElement, state: GameState) {
  const { ui, keybinds, runtime } = state
  const audioEngine = createAudioEngine()
  const spawns = createSpawnSystem(runtime, ui)
  const { addBase, addBonus } = addScore(ui, runtime)
  let lastCelebrationStreak = 0
  let baseGravity = runtime.gravity
  let baseJumpVelocity = runtime.jumpVelocity
  const celebrationPools = {
    three: [
      'TRICKY!',
      'RADICAL!',
      'SWEET STYLE!',
      'BONUS BOOST!',
      'SPIN THAT!',
      'HYPE POP!',
      'HERO MOVE!',
      'SLICK RUN!',
      'SPEED DEMO!',
      'AIR ROYAL!',
    ],
    four: [
      'SUPER TRICKY!',
      'STYLE MONSTER!',
      'TURBO CHARGE!',
      'LORD OF LIFT!',
      'WICKED FLOW!',
      'BOOST BARON!',
      'ROYAL SPIN!',
      'MEGA MOVE!',
      'GLORY RIDE!',
      'THRONE TAKE!',
    ],
    five: [
      'ULTRA TRICKY!',
      'CROWN GRAB!',
      'FEUDAL FLIP!',
      'THRUSTER FLEX!',
      'MAJESTIC!',
      'WARLORD RUN!',
      'NOBLE BOOST!',
      'SOVEREIGN!',
      'SKY KNIGHT!',
      'HEIR APPARENT!',
    ],
    sixPlus: [
      'HYPER TRICKY!',
      'IMPERIAL!',
      'GALACTIC ROYALTY!',
      'SPACE LORD!',
      'THRONE OF AIR!',
      'COSMIC CLAP!',
      'CROWNED!',
      'CELESTIAL!',
      'FEUDAL FINALE!',
      'OUTRAGEOUS!',
      'GODLIKE!',
      'ABSURDITY!',
    ],
  } as const
  const subtitlePool = [
    'Baron of boost!',
    'Feudal thrusters engaged!',
    'Royal airspace claimed!',
    'Knighted in neon!',
    'Castle‑grade combo!',
    'Star‑court swagger!',
    'Cathedral‑core carve!',
    'Orbital chivalry!',
    'Lance of lightning!',
    'Crown‑line critical!',
    'Banner‑wave velocity!',
    'Squire to spire!',
  ] as const
  const leadInLookaheadSeconds = 10

  /**
   * Reset cached air-movement defaults to the current runtime baselines.
   */
  function refreshAirDefaults() {
    baseGravity = runtime.gravity
    baseJumpVelocity = runtime.jumpVelocity
  }

  /**
   * Identify the highest-energy contiguous beat window in the level map so we can
   * telegraph the upcoming intensity spike.
   */
  function deriveIntensityWindow() {
    const map = audioEngine.levelMap
    if (!map) {
      runtime.intensityWindow = null
      return null
    }
    const { beatIntensities, beatDuration } = map
    const threshold = 0.68
    let runStart = -1
    let runSum = 0
    let runCount = 0
    let best: { start: number; end: number; avg: number } | null = null

    const commitRun = (endIdx: number) => {
      if (runStart < 0) return
      const avg = runSum / Math.max(1, runCount)
      if (!best || avg > best.avg || (avg === best.avg && endIdx - runStart > (best.end - best.start))) {
        best = { start: runStart, end: endIdx, avg }
      }
    }

    for (let i = 0; i < beatIntensities.length; i += 1) {
      const intensity = beatIntensities[i] ?? 0
      if (intensity >= threshold) {
        if (runStart < 0) {
          runStart = i
          runSum = 0
          runCount = 0
        }
        runSum += intensity
        runCount += 1
      } else if (runStart >= 0) {
        commitRun(i)
        runStart = -1
      }
    }
    commitRun(beatIntensities.length)

    if (best) {
      runtime.intensityWindow = {
        start: best.start * beatDuration,
        end: best.end * beatDuration,
      }
      return runtime.intensityWindow
    }
    runtime.intensityWindow = null
    return null
  }

  /**
   * Tighten airtime so jumps land closer to a quarter-beat while approaching a peak.
   *
   * @param beatMs - Duration of a single beat in milliseconds.
   */
  function applyLeadInAirtime(beatMs: number) {
    const targetDuration = clamp((beatMs / 4) / 1000, 0.08, 0.35)
    const baseHeight = (Math.abs(baseJumpVelocity) * Math.abs(baseJumpVelocity)) / (2 * baseGravity)
    const targetHeight = Math.max(40, baseHeight * 0.45)
    const jumpMagnitude = (4 * targetHeight) / targetDuration
    const gravityTarget = (8 * targetHeight) / (targetDuration * targetDuration)
    const clampedGravity = clamp(gravityTarget, baseGravity * 1.8, baseGravity * 12)
    const clampedJump = clamp(jumpMagnitude, Math.abs(baseJumpVelocity) * 0.4, Math.abs(baseJumpVelocity) * 2.4)

    runtime.gravity = clampedGravity
    runtime.jumpVelocity = -clampedJump
    runtime.airControlTightened = true
  }

  /**
   * Restore standard gravity and jump values after the intense window ends.
   */
  function restoreAirControl() {
    runtime.gravity = baseGravity
    runtime.jumpVelocity = baseJumpVelocity
    runtime.airControlTightened = false
  }

  function triggerCelebration(streak: number) {
    if (ui.gameOver.value) return
    let pool = celebrationPools.three
    let tier = 3
    if (streak >= 6) pool = celebrationPools.sixPlus
    else if (streak >= 5) pool = celebrationPools.five
    else if (streak >= 4) pool = celebrationPools.four
    if (streak >= 6) tier = 6
    else if (streak >= 5) tier = 5
    else if (streak >= 4) tier = 4
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? 'TRICKY!'
    ui.celebrationMessage.value = pick
    ui.celebrationSubtitle.value = subtitlePool[Math.floor(Math.random() * subtitlePool.length)] ?? 'Feudal thrusters engaged!'
    ui.celebrationTier.value = tier
    ui.celebrationVisible.value = true
    ui.celebrationTimer.value = 2.8
    ui.snapshotMessageTimer.value = 2.2
    runtime.flashTimer = Math.max(runtime.flashTimer, 0.08)
    runtime.flashColor = '56, 189, 248'
  }

  function addCharge(amount: number) {
    ui.charge.value = clamp(ui.charge.value + amount, 0, 100)
  }
  function consumeCharge(amount: number) {
    ui.charge.value = clamp(ui.charge.value - amount, 0, 100)
  }

  /**
   * Reset ground coverage to a continuous platform across the viewport.
   */
  function resetGroundSegments() {
    runtime.groundSegments = [{ start: 0, end: runtime.width }]
  }

  /**
   * Return the ground segment that currently supports the player, if any.
   *
   * @param x Player x position.
   * @param width Player width.
   * @returns Overlapping ground span or null when above a gap.
   */
  function getSupportingGroundSegment(x: number, width: number): GroundSegment | null {
    return runtime.groundSegments.find(seg => x + width > seg.start && x < seg.end) ?? null
  }

  /**
   * Recompute ground spans for the active intensity window, keeping quarter-beat spaced pads.
   *
   * @param windowState Active intensity window state.
   */
  function rebuildGroundSegments(windowState: typeof runtime.intensityWindow) {
    const beatSeconds = 60 / Math.max(1, ui.bpm.value)
    const quarterBeatSeconds = beatSeconds / 4
    const spacing = Math.max(48, runtime.scrollSpeed * quarterBeatSeconds)

    if (!windowState || windowState.phase !== 'active') {
      resetGroundSegments()
      return
    }

    const widthScale = 1.18 - windowState.progress * 0.78
    const segmentWidth = Math.max(28, spacing * widthScale)
    const segments: GroundSegment[] = []
    const startOffset = -segmentWidth * 0.35

    for (let x = startOffset; x < runtime.width + spacing; x += spacing) {
      const segStart = Math.max(0, x)
      const segEnd = Math.min(runtime.width, x + segmentWidth)
      if (segEnd - segStart > 6) segments.push({ start: segStart, end: segEnd })
    }

    runtime.groundSegments = segments
  }

  /**
   * Restore default runtime and UI values for a fresh session.
   */
  function resetGame() {
    ui.score.value = 0
    ui.baseScore.value = 0
    ui.bonusScore.value = 0
    ui.speed.value = 1
    ui.gameOver.value = false
    ui.started.value = false
    ui.charge.value = 50
    ui.paused.value = false
    runtime.deathByEnemy = false
    runtime.powerTint = { r: 0, g: 0, b: 0, alpha: 0 }

    runtime.phaseActive = false
    runtime.phaseTimer = 0
    runtime.groundY = runtime.height - 60
    runtime.gravity = 2600
    runtime.jumpVelocity = -1050
    runtime.baseScrollSpeed = 440
    runtime.scrollSpeed = runtime.baseScrollSpeed
    applyDifficultySettings(runtime, ui)
    runtime.lastTimestamp = null
    audioEngine.resetEnergy()

    runtime.player = {
      x: PLAYER_ANCHOR_X,
      y: runtime.groundY - 50,
      width: 40,
      height: 40,
      vy: 0,
      onGround: true,
    }

    runtime.obstacles = []
    runtime.rotation = 0
    runtime.isSlamming = false
    runtime.jumpStartY = runtime.player.y
    runtime.jumpApexY = runtime.player.y
    runtime.jumpStyle = 'flip'
    runtime.nextJumpStyle = 'flip'
    runtime.enemies = []
    runtime.shockwaves = []
    runtime.scorePops = []
    runtime.sonicBursts = []
    runtime.playerFragments = []
    runtime.dashActive = false
    runtime.dashTimer = 0
    runtime.dashVelocity = 0
    ui.dashReady.value = false
    ui.phaseReady.value = false
    ui.phaseCooldown.value = 0
    runtime.phaseModeIndex = 0
    runtime.phaseMode = PHASE_STATES[runtime.phaseModeIndex] ?? PHASE_STATES[0]
    runtime.invulnTimer = 0
    runtime.graceUsed = false
    runtime.airJumps = 1
    runtime.beatStreak = 0
    runtime.scoreMultiplier = 1
    runtime.airComboMultiplier = 1
    runtime.airComboStreak = 0
    runtime.airKillCombo = 0
    runtime.lastBeatActionTime = 0
    runtime.slamOriginY = null
    runtime.dashGhosts = []
    runtime.deathSlowTimer = 0
    ui.snapshotMessageTimer.value = 0
    ui.replayVisible.value = false
    if (ui.replayVideoUrl.value) {
      URL.revokeObjectURL(ui.replayVideoUrl.value)
      ui.replayVideoUrl.value = null
    }
    ui.celebrationVisible.value = false
    ui.celebrationTimer.value = 0
    ui.celebrationMessage.value = ''
    ui.celebrationTier.value = 0
    ui.celebrationSubtitle.value = ''
    ui.spawnLog.value = []
    runtime.replayBuffer = []
    runtime.slideActive = false
    runtime.slideTimer = 0
    runtime.slideJumped = false
    runtime.slideElapsed = 0
    runtime.slideTargetX = 0
    runtime.flashTimer = 0
    runtime.flashColor = undefined
    runtime.intensityLeadInActive = false
    runtime.intensityPeakActive = false
    runtime.airControlTightened = false
    refreshAirDefaults()
    ui.introCollapsing.value = false
    ui.started.value = false
    ui.canSaveScore.value = false
    ui.savedCurrentRun.value = false
    ui.savingHighScore.value = false
    ui.placeholderIndex.value = null
    ui.lastSavedIndex.value = null
    runtime.wasGameOver = false
    runtime.hangActive = false
    runtime.slowActive = false
    runtime.hatBursts = []
    runtime.spawnBeacons = []
    runtime.requestReplayCapture = false
    runtime.cameraShake = 0
    runtime.lastEnemySpawnBeat = -1
    runtime.lastObstacleSpawnBeat = -1
    runtime.comboGraceTimer = 0
    runtime.spawnEvents = []
    runtime.spawnHistory = []
    runtime.spawnDebugTicks = []
    runtime.intensityWindow = null
    resetGroundSegments()
    // Give players something to react to immediately.
    spawns.spawnObstacle({ nearStart: true })
    spawns.spawnEnemy('gomba')
  }

  async function startAudio() {
    await audioEngine.start()
    runtime.lastBeatTime = performance.now()
    runtime.lastSubBeatTime = runtime.lastBeatTime
    runtime.beatIndex = 0
  }

  function startObstacleSpawner() {
    if (runtime.obstacleSpawnIntervalId) clearInterval(runtime.obstacleSpawnIntervalId)
    runtime.obstacleSpawnIntervalId = window.setInterval(() => {
      if (!ui.started.value || ui.gameOver.value || ui.paused.value) return
      const hasNearRight = runtime.obstacles.some(o => runtime.width - o.x < 220)
      if (!hasNearRight) spawns.spawnObstacle()
    }, 1200)
  }

  async function handleAudioUpload(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    await audioEngine.configure(url, () => file.arrayBuffer())
    runtime.audio = audioEngine.audio
    runtime.analyser = audioEngine.analyser
    runtime.freqData = audioEngine.freqData
    runtime.timeData = audioEngine.timeData
    ui.bpm.value = audioEngine.bpm
    deriveIntensityWindow()
  }

  async function loadDefaultAudio() {
    try {
      await audioEngine.configure(DEFAULT_TRACK, async () => {
        const res = await fetch(DEFAULT_TRACK)
        if (!res.ok) throw new Error('failed fetch default track')
        return res.arrayBuffer()
      })
      runtime.audio = audioEngine.audio
      runtime.analyser = audioEngine.analyser
      runtime.freqData = audioEngine.freqData
      runtime.timeData = audioEngine.timeData
      ui.bpm.value = audioEngine.bpm
      deriveIntensityWindow()
    } catch (err) {
      console.warn('Default track unavailable, waiting for user upload.', err)
    }
  }

  function maybeGrantBeatJumpCharge() {
    if (!audioEngine.started) return
    const beatMs = 60000 / audioEngine.bpm
    const now = performance.now()
    const distToCurrent = Math.abs(now - runtime.lastBeatTime)
    const distToNext = Math.abs((runtime.lastBeatTime + beatMs) - now)
    const dist = Math.min(distToCurrent, distToNext)
    if (dist < 80) {
      addCharge(4)
    }
  }

  function handleJump() {
    startAudio()
    if (!ui.started.value && !ui.gameOver.value) {
      beginRun()
    }

    if (ui.gameOver.value) return

    maybeGrantBeatJumpCharge()

    if (runtime.player.onGround) {
      runtime.jumpStyle = runtime.nextJumpStyle
      runtime.nextJumpStyle = runtime.jumpStyle === 'flip' ? 'twirl' : 'flip'
      runtime.player.vy = runtime.jumpVelocity
      runtime.player.onGround = false
      runtime.isSlamming = false
      runtime.rotation = 0
      runtime.jumpStartY = runtime.player.y
      runtime.jumpApexY = runtime.player.y
      runtime.airJumps = 1
      registerBeatAction(runtime, isOnBeat(runtime, ui, audioEngine.started))
    } else if (runtime.airJumps > 0 && ui.charge.value >= DOUBLE_JUMP_COST) {
      consumeCharge(DOUBLE_JUMP_COST)
      runtime.player.vy = runtime.jumpVelocity * 0.85
      runtime.isSlamming = false
      runtime.rotation = 0
      runtime.airJumps -= 1
      runtime.sonicBursts.push({
        x: runtime.player.x + runtime.player.width / 2,
        y: runtime.player.y + runtime.player.height / 2,
        r: 0,
        alpha: 0.8,
      })
      registerBeatAction(runtime, isOnBeat(runtime, ui, audioEngine.started, 90))
    }
  }

  function handleSlam() {
    startAudio()
    if (!ui.started.value && !ui.gameOver.value) {
      beginRun()
    }
    if (runtime.player.onGround && !ui.gameOver.value) {
      startSlide()
    } else if (!runtime.player.onGround && !runtime.isSlamming && !ui.gameOver.value) {
      runtime.isSlamming = true
      runtime.slamOriginY = runtime.player.y
      runtime.player.vy = 2000
    }
  }

  function handlePhase() {
    startAudio()
    if (ui.gameOver.value) return
    if (!ui.started.value && !ui.gameOver.value) {
      beginRun()
    }
    if (ui.charge.value < PHASE_COST || runtime.phaseActive || ui.phaseCooldown.value > 0) return

    runtime.phaseActive = true
    runtime.phaseTimer = PHASE_DURATION
    consumeCharge(PHASE_COST)
    runtime.phaseMode = PHASE_STATES[runtime.phaseModeIndex] ?? PHASE_STATES[0]
    runtime.phaseModeIndex = (runtime.phaseModeIndex + 1) % PHASE_STATES.length

    audioEngine.setSlapMix(0.9)
    audioEngine.playSfx('phase', 0.9)

    runtime.sonicBursts.push({
      x: runtime.player.x + runtime.player.width / 2,
      y: runtime.player.y + runtime.player.height / 2,
      r: 0,
      alpha: 1,
    })
  }

  function handleBlast() {
    startAudio()
    if (ui.gameOver.value) return
    if (!ui.started.value && !ui.gameOver.value) {
      beginRun()
    }

    const beatMs = 60000 / audioEngine.bpm
    const now = performance.now()
    const beatDist = runtime.lastBeatTime
      ? Math.min(Math.abs(now - runtime.lastBeatTime), Math.abs(runtime.lastBeatTime + beatMs - now))
      : Infinity

    const onTime = beatDist < DASH_WINDOW_MS

    if (onTime && ui.charge.value >= DASH_COST && !runtime.dashActive) {
      consumeCharge(DASH_COST)
      runtime.dashActive = true
      runtime.dashTimer = DASH_DURATION
      runtime.dashVelocity = DASH_THRUST
      runtime.isSlamming = false
      registerBeatAction(runtime, true)
      audioEngine.playSfx('blast', 0.85)

      runtime.sonicBursts.push({
        x: runtime.player.x + runtime.player.width / 2,
        y: runtime.player.y + runtime.player.height / 2,
        r: 0,
        alpha: 0.7,
      })
    } else if (ui.charge.value > 0) {
      consumeCharge(4)
      registerBeatAction(runtime, false)
    }
  }


  function applyBlast() {
    applyBlastStrikes(runtime, addBonus, addCharge, audioEngine.playSfx)
  }

  function applySlide() {
    applySlideStrike(runtime, addBonus, audioEngine.playSfx)
  }

  function beginRun() {
    if (ui.started.value || ui.gameOver.value) return
    ui.introCollapsing.value = true
    ui.started.value = true
    setTimeout(() => {
      ui.introCollapsing.value = false
    }, 360)
  }

  function startSlide() {
    if (runtime.slideActive || ui.gameOver.value) return
    runtime.slideActive = true
    runtime.slideTimer = SLIDE_DURATION
    runtime.slideElapsed = 0
    runtime.slideStartX = runtime.player.x
    runtime.slideTargetX = runtime.player.x + SLIDE_DISTANCE
    runtime.slideJumped = false
    runtime.player.vy = 0
    runtime.isSlamming = false
    runtime.slamOriginY = null
    runtime.player.onGround = true
    applySlide()
    runtime.flashTimer = 0.14
  }

  function setDifficulty(level: string) {
    ui.difficulty.value = level
    applyDifficultySettings(runtime, ui)
  }

  /**
   * Advance one simulation tick and apply beat-synced game logic.
   *
   * @param dtRaw Delta time in seconds since the previous frame.
   */
  function update(dtRaw: number) {
    const dt = dtRaw
    ensureReplayRecorder(runtime)
    audioEngine.setDebugTimelineEnabled(ui.debugAudioSpawnView.value)
    const beatMs = 60000 / audioEngine.bpm
    const now = performance.now()
    const prevGameOver = runtime.wasGameOver
    runtime.wasGameOver = ui.gameOver.value
    const beatDist = runtime.lastBeatTime
      ? Math.min(Math.abs(now - runtime.lastBeatTime), Math.abs(runtime.lastBeatTime + beatMs - now))
      : Infinity

    ui.dashReady.value = !ui.gameOver.value && !runtime.dashActive && ui.charge.value >= DASH_COST && beatDist < DASH_WINDOW_MS
    ui.phaseReady.value = !ui.gameOver.value && !runtime.phaseActive && ui.charge.value >= PHASE_COST && ui.phaseCooldown.value <= 0

    if (runtime.dashActive) {
      runtime.dashTimer -= dtRaw
      if (runtime.dashTimer <= 0) {
        runtime.dashActive = false
        runtime.dashVelocity = 0
      } else {
        runtime.player.x += runtime.dashVelocity * dtRaw
        runtime.dashVelocity = lerp(runtime.dashVelocity, 0, dtRaw * 8)
        const maxLead = PLAYER_ANCHOR_X + 180
        runtime.player.x = clamp(runtime.player.x, 40, maxLead)
        applyBlast()
        runtime.dashGhosts.push({
          x: runtime.player.x,
          y: runtime.player.y,
          w: runtime.player.width,
          h: runtime.player.height,
          alpha: 0.45,
        })
        runtime.dashGhosts = runtime.dashGhosts.slice(-10)
      }
    } else if (!runtime.slideActive) {
      runtime.player.x = lerp(runtime.player.x, PLAYER_ANCHOR_X, dtRaw * 3.2)
    }

    if (ui.snapshotMessageTimer.value > 0) {
      ui.snapshotMessageTimer.value = Math.max(0, ui.snapshotMessageTimer.value - dtRaw)
    }

    if (runtime.slideActive) {
      runtime.slideTimer -= dtRaw
      runtime.slideElapsed += dtRaw
      const crouchEnd = SLIDE_CROUCH_DURATION
      const dashEnd = SLIDE_CROUCH_DURATION + SLIDE_DASH_DURATION
      const glideEnd = dashEnd + SLIDE_GLIDE_DURATION
      const flipEnd = glideEnd + SLIDE_FLIP_DURATION

      if (runtime.slideElapsed < crouchEnd) {
        runtime.player.x = runtime.slideStartX
        runtime.player.y = runtime.groundY - runtime.player.height
        runtime.player.vy = 0
        runtime.rotation = -0.25
      } else if (runtime.slideElapsed < dashEnd) {
        const t = clamp((runtime.slideElapsed - crouchEnd) / SLIDE_DASH_DURATION, 0, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        runtime.player.x = lerp(runtime.slideStartX, runtime.slideTargetX, eased)
        runtime.player.y = runtime.groundY - runtime.player.height
        runtime.player.vy = 0
        runtime.rotation = 0.05
        applySlide()
      } else if (runtime.slideElapsed < glideEnd) {
        const t = clamp((runtime.slideElapsed - dashEnd) / SLIDE_GLIDE_DURATION, 0, 1)
        const eased = 1 - Math.pow(t, 2)
        runtime.player.x = lerp(runtime.slideTargetX, runtime.slideTargetX - 18, 1 - eased)
        runtime.player.y = runtime.groundY - runtime.player.height
        runtime.rotation = -0.05
      } else if (runtime.slideElapsed < flipEnd) {
        const t = clamp((runtime.slideElapsed - glideEnd) / SLIDE_FLIP_DURATION, 0, 1)
        const backX = lerp(runtime.slideTargetX, runtime.slideStartX, t)
        const lift = Math.sin(t * Math.PI) * (runtime.player.height * 0.85)
        runtime.player.x = backX
        runtime.player.y = runtime.groundY - runtime.player.height - lift
        if (!runtime.slideJumped) {
          runtime.player.vy = runtime.jumpVelocity * 0.28
          runtime.slideJumped = true
        }
        runtime.rotation = -t * Math.PI * 2.4
      } else {
        runtime.slideActive = false
        runtime.slideJumped = false
        runtime.player.x = runtime.slideStartX
        runtime.player.y = runtime.groundY - runtime.player.height
        runtime.player.vy = 0
        runtime.player.onGround = true
        runtime.rotation = 0
      }
    }

    if (runtime.phaseActive) {
      runtime.phaseTimer -= dtRaw
      if (runtime.phaseTimer <= 0) {
        runtime.phaseActive = false
        ui.phaseCooldown.value = PHASE_COOLDOWN
        audioEngine.setSlapMix(0)
      } else {
        const wobble = (Math.sin(now * 0.002) + 1) * 0.35
        audioEngine.setSlapMix(0.6 + wobble * 0.4)
      }
    }
    if (ui.phaseCooldown.value > 0 && !runtime.phaseActive) {
      ui.phaseCooldown.value = Math.max(0, ui.phaseCooldown.value - dtRaw)
    }
    if (runtime.invulnTimer > 0) {
      runtime.invulnTimer = Math.max(0, runtime.invulnTimer - dtRaw)
    }
    runtime.comboGraceTimer = Math.max(0, (runtime.comboGraceTimer || 0) - dtRaw)

    runtime.hangActive = runtime.hangActive && ui.charge.value > 0
    runtime.slowActive = runtime.slowActive && ui.charge.value > 0
    if (runtime.hangActive && runtime.slowActive) {
      runtime.slowActive = false
    }

    audioEngine.applyPlaybackRate(runtime.slowActive ? 0.5 : 1)
    if (!runtime.phaseActive) audioEngine.setSlapMix(0)

    if (audioEngine.audio) {
      if (runtime.hangActive) {
        const phase = (performance.now() % beatMs) / beatMs
        const tremolo = 0.85 + Math.sin(phase * Math.PI * 2) * 0.15
        audioEngine.audio.volume = tremolo
      } else {
        audioEngine.audio.volume = 1
      }
    }

    const beatPhase = (now - runtime.lastBeatTime) / beatMs
    const beatPulseStrength = Math.sin(Math.min(beatPhase, 1) * Math.PI)

    audioEngine.updateEnergy()
    runtime.intensityWindow = audioEngine.updateIntensityWindow(audioEngine.audio?.currentTime ?? 0)
    const intensity = audioEngine.intensity
    runtime.cameraShake = lerp(
      runtime.cameraShake,
      ui.started.value && !ui.gameOver.value
        ? (ui.beatPulse.value ? audioEngine.bass * 2 : 0) + intensity * 0.6
        : 0,
      0.16
    )

    const intensityWindow = runtime.intensityWindow
    const audioTime = audioEngine.audio?.currentTime ?? null
    let inLeadIn = false
    let inPeak = false
    if (intensityWindow && audioTime !== null && !ui.gameOver.value) {
      const leadInStart = Math.max(0, intensityWindow.start - leadInLookaheadSeconds)
      inLeadIn = audioTime >= leadInStart && audioTime < intensityWindow.start
      inPeak = audioTime >= intensityWindow.start && audioTime <= intensityWindow.end
    }
    const shouldTightenAir = inLeadIn || inPeak
    if (shouldTightenAir && !runtime.airControlTightened) {
      applyLeadInAirtime(beatMs)
    } else if (!shouldTightenAir && runtime.airControlTightened) {
      restoreAirControl()
    }
    runtime.intensityLeadInActive = inLeadIn
    runtime.intensityPeakActive = inPeak

    if (ui.started.value && !ui.gameOver.value && ui.beatPulse.value && audioEngine.highs > 0.6) {
      const count = 2 + Math.floor(audioEngine.highs * 3)
      for (let i = 0; i < count; i++) {
        runtime.hatBursts.push({
          x: Math.random() * runtime.width,
          y: runtime.groundY - 100 - Math.random() * 120,
          r: 4 + Math.random() * 8,
          alpha: 0.9,
          vy: -40 - Math.random() * 30,
        })
      }
    }

    if (runtime.beatStreak > 0 && performance.now() - runtime.lastBeatActionTime > 2000) {
      runtime.beatStreak = 0
      runtime.scoreMultiplier = 1
    }

    if (!ui.started.value) {
      lastCelebrationStreak = 0
    } else {
      if (runtime.beatStreak === 0 && lastCelebrationStreak >= 3) {
        triggerCelebration(lastCelebrationStreak)
      }
      lastCelebrationStreak = runtime.beatStreak
    }

    if (ui.celebrationTimer.value > 0) {
      ui.celebrationTimer.value = Math.max(0, ui.celebrationTimer.value - dtRaw)
      if (ui.celebrationTimer.value <= 0) ui.celebrationVisible.value = false
    }

    if (runtime.hangActive || runtime.slowActive) {
      ui.charge.value -= CHARGE_DRAIN_RATE * dtRaw
    } else if (runtime.player.onGround) {
      ui.charge.value += CHARGE_REGEN_GROUND * dtRaw
    } else {
      ui.charge.value += CHARGE_REGEN_AIR * dtRaw
    }

    ui.charge.value = clamp(ui.charge.value, 0, 100)
    if (ui.charge.value <= 0) {
      runtime.hangActive = false
      runtime.slowActive = false
    }

    updatePowerTint(dtRaw)

    for (const e of runtime.enemies) {
    e.squishImpulse = (e.squishImpulse || 0) * 0.86
    e.beatBob = (e.beatBob || 0) * 0.82
    const squashImpulse = e.squishImpulse || 0
      const beatBob = e.beatBob || 0
      e.dancePhase = (e.dancePhase || Math.random() * Math.PI * 2) + dt * 2.4

      const bandEnergy = e.band === 'bass' ? audioEngine.bass : e.band === 'mid' ? audioEngine.mids : audioEngine.highs
      const groove = Math.sin(e.dancePhase) * 0.08
      const grooveBob = Math.cos(e.dancePhase) * 8 * bandEnergy
      const beatLift = beatPulseStrength * (bandEnergy * (e.band === 'bass' ? 14 : 10))
      const targetSquash = 1 + groove + bandEnergy * 0.2 + squashImpulse
      const targetBob = -(grooveBob + beatBob + beatLift)

      e.squash = lerp(e.squash || 1, targetSquash, 0.22)
      e.bob = lerp(e.bob || 0, targetBob, 0.2)

      if (e.type === 'floater') {
        e.rage = clamp(
          (e.rage || 0) + intensity * 0.6 * dt - 0.15 * dt,
          0,
          1
        )
        if (e.rage > 0.6) {
          const dir = runtime.player.x - e.x
          e.x += Math.sign(dir) * 40 * dt * (0.5 + e.rage)
        }
      }
    }

    if (audioEngine.started) {
      const subBeatMs = beatMs / 2

      while (now - runtime.lastBeatTime >= beatMs) {
        runtime.lastBeatTime += beatMs
        runtime.beatIndex += 1
        ui.beatPulse.value = true

        setTimeout(() => {
          ui.beatPulse.value = false
        }, 90)

        if (ui.started.value && !ui.gameOver.value) {
          spawns.pulseEnemiesOnBeat(1 + intensity * 0.6)
          spawns.spawnBeatDrivenEntities(false, {
            bass: audioEngine.bass,
            mids: audioEngine.mids,
            highs: audioEngine.highs,
            intensity,
            loudnessDelta: audioEngine.loudnessDelta,
            drive: audioEngine.drive,
            driveDelta: audioEngine.driveDelta,
            audioTime: audioEngine.audio?.currentTime ?? 0,
            trackDuration: audioEngine.audio?.duration ?? 0,
          })
        }
      }

      while (now - runtime.lastSubBeatTime >= subBeatMs) {
        runtime.lastSubBeatTime += subBeatMs
        if (ui.started.value && !ui.gameOver.value) {
          spawns.pulseEnemiesOnBeat(0.45 + intensity * 0.3)
          spawns.spawnBeatDrivenEntities(true, {
            bass: audioEngine.bass,
            mids: audioEngine.mids,
            highs: audioEngine.highs,
            intensity,
            loudnessDelta: audioEngine.loudnessDelta,
            drive: audioEngine.drive,
            driveDelta: audioEngine.driveDelta,
            audioTime: audioEngine.audio?.currentTime ?? 0,
            trackDuration: audioEngine.audio?.duration ?? 0,
          })
        }
      }
    }

    const baseGain = runtime.scrollSpeed * 0.02 * dt * (0.6 + intensity) * (runtime.slowActive ? 1.1 : 1)
    if (ui.started.value && !ui.gameOver.value) {
      addBase(baseGain)
    }
    const maxSpeed = 1.5
    const trackDuration = audioEngine.audio?.duration ?? 0
    const trackProgress = trackDuration > 0
      ? Math.max(0, Math.min(1, (audioEngine.audio?.currentTime ?? 0) / trackDuration))
      : 1
    const speedCap = 1 + (maxSpeed - 1) * trackProgress
    const speedFactor = Math.min(speedCap, 1 + ui.score.value / 16000)
    ui.speed.value = speedFactor
    runtime.scrollSpeed = runtime.baseScrollSpeed * speedFactor
    if (!audioEngine.started && ui.started.value && !ui.gameOver.value) {
      startAudio()
    }

    if (runtime.deathSlowTimer > 0) {
      runtime.deathSlowTimer = Math.max(0, runtime.deathSlowTimer - dtRaw)
    }

    const deathScale = runtime.deathSlowTimer > 0 ? 0.35 : 1
    const timeScale = (runtime.slowActive ? 0.45 : 1) * deathScale

    const effectiveGravity = runtime.hangActive ? runtime.gravity * 0.035 : runtime.gravity

    runtime.scrollSpeed = runtime.baseScrollSpeed * ui.speed.value * timeScale
    rebuildGroundSegments(runtime.intensityWindow)
    const supportingGround = getSupportingGroundSegment(runtime.player.x, runtime.player.width)

    const lockSlideOnGround = supportingGround && runtime.slideActive && runtime.slideElapsed < (SLIDE_CROUCH_DURATION + SLIDE_DASH_DURATION)
    if (!lockSlideOnGround) {
      runtime.player.vy += (runtime.isSlamming ? effectiveGravity * 2.5 : effectiveGravity) * dtRaw * timeScale
      runtime.player.y += runtime.player.vy * dtRaw * timeScale
    } else {
      runtime.player.vy = 0
      runtime.player.y = runtime.groundY - runtime.player.height
    }

    if (runtime.player.y < runtime.jumpApexY) {
      runtime.jumpApexY = runtime.player.y
    }

    for (const e of runtime.enemies) {
      if (e.telegraph && e.telegraph > 0) {
        e.telegraph -= dt
        continue
      }
      e.x -= runtime.scrollSpeed * 0.95 * dt
    }
    runtime.enemies = runtime.enemies.filter(e => {
      if (e.squished) return (e.squishTimer || 0) > -0.2
      return e.x + e.width > 0 && e.alive
    })

    for (const e of runtime.enemies) {
      if (e.squished) {
        e.squishTimer = (e.squishTimer || 0) - dt
        e.currentHeight = Math.max(
          e.pancakeHeight ?? 0,
          (e.currentHeight ?? 0) - 220 * dt
        )
      }
    }

    const pad = 6
    const playerHitbox = {
      x: runtime.player.x + pad,
      y: runtime.player.y + pad,
      w: runtime.player.width - pad * 2,
      h: runtime.player.height - pad * 2,
    }

    for (const e of runtime.enemies) {
      if (runtime.phaseActive && runtime.phaseMode === e.type) continue
      const ePad = 4
      const ex = e.x + ePad
      const ey = e.y + ePad
      const ew = e.width - ePad * 2
      const eh = e.height - ePad * 2
      if (
        playerHitbox.x < ex + ew &&
        playerHitbox.x + playerHitbox.w > ex &&
        playerHitbox.y < ey + eh &&
        playerHitbox.y + playerHitbox.h > ey
      ) {
        if (e.type === 'spiker' && e.spikes === false && e.alive && !e.squished) {
          e.squished = true
          e.alive = false
          e.squishTimer = 0.18
          e.currentHeight = e.height
          addBonus(280)
          addCharge(10)
          audioEngine.playSfx('enemyPop', 0.7)
          triggerSquishBounce(runtime, 1.05, audioEngine.playSfx)

          runtime.sonicBursts.push({
            x: e.x + e.width / 2,
            y: e.y + e.height / 2,
            r: 0,
            alpha: 0.8,
          })

        runtime.scorePops.push({
          x: e.x + e.width / 2,
          y: e.y,
          value: 280,
          alpha: 1,
          vy: -80,
        })
        registerAirKill(runtime)
      } else if (e.type === 'gomba' && runtime.isSlamming && e.alive && !e.squished) {
        e.squished = true
        e.alive = false
        e.squishTimer = 0.18
        e.currentHeight = e.height
        addBonus(250)
        addCharge(12)
        audioEngine.playSfx('enemyPop', 0.7)
        triggerSquishBounce(runtime, 1, audioEngine.playSfx)

          runtime.sonicBursts.push({
            x: e.x + e.width / 2,
            y: e.y + e.height / 2,
            r: 0,
            alpha: 0.8,
          })

        runtime.scorePops.push({
          x: e.x + e.width / 2,
          y: e.y,
          value: 250,
          alpha: 1,
          vy: -80,
        })
        registerAirKill(runtime)
      } else if (e.type === 'floater' && runtime.isSlamming && e.alive) {
        const enraged = (e.rage ?? 0) > 0.85
        if (!enraged || runtime.slowActive || runtime.hangActive) {
          e.alive = false
          addBonus(enraged ? 500 : 400)
          addCharge(enraged ? 30 : 20)
          audioEngine.playSfx('enemyPop', enraged ? 1 : 0.8)
          triggerSquishBounce(runtime, 1.1, audioEngine.playSfx)

          runtime.sonicBursts.push({
            x: e.x + e.width / 2,
            y: e.y + e.height / 2,
            r: 0,
            alpha: 0.9,
          })
          registerAirKill(runtime)
        } else {
            if (!ui.invincible.value) {
              ui.gameOver.value = true
              runtime.deathByEnemy = true
            }
          }
        } else if (e.alive && !e.squished) {
          if (!runtime.graceUsed) {
            runtime.graceUsed = true
            runtime.invulnTimer = 1.5
            consumeCharge(12)
            runtime.sonicBursts.push({
              x: runtime.player.x + runtime.player.width / 2,
              y: runtime.player.y + runtime.player.height / 2,
              r: 0,
              alpha: 0.8,
            })
          } else if (runtime.invulnTimer <= 0) {
            if (!ui.invincible.value) {
              ui.gameOver.value = true
              runtime.deathByEnemy = true
              runtime.deathSlowTimer = 0.9
            }
          }
        }
      }
    }

    if (runtime.deathByEnemy && runtime.playerFragments.length === 0) {
      const cx = runtime.player.x + runtime.player.width / 2
      const cy = runtime.player.y + runtime.player.height / 2
      const size = runtime.player.width / 2

      runtime.playerFragments.push(
        { x: cx, y: cy, vx: -220, vy: -260, size, alpha: 1 },
        { x: cx, y: cy, vx: 220,  vy: -260, size, alpha: 1 },
        { x: cx, y: cy, vx: -220, vy: 260,  size, alpha: 1 },
        { x: cx, y: cy, vx: 220,  vy: 260,  size, alpha: 1 },
      )
    }

    for (let i = runtime.shockwaves.length - 1; i >= 0; i--) {
      const s = runtime.shockwaves[i]
      s.w = (s.w || 0) + 1400 * dt * (s.intense ? 1.1 : 0.9)
      s.alpha -= (s.intense ? 1.6 : 1.4) * dt
      if (s.alpha <= 0 || s.w >= runtime.width * 2) runtime.shockwaves.splice(i, 1)
    }

    for (let i = runtime.sonicBursts.length - 1; i >= 0; i--) {
      const s = runtime.sonicBursts[i]
      s.r += 1800 * dt
      s.alpha -= 2.2 * dt
      if (s.alpha <= 0) runtime.sonicBursts.splice(i, 1)
    }

    for (let i = runtime.spawnBeacons.length - 1; i >= 0; i--) {
      const b = runtime.spawnBeacons[i]
      if (!b) continue
      b.alpha -= dt * 1.4
      if (b.alpha <= 0) runtime.spawnBeacons.splice(i, 1)
    }

    for (const p of runtime.scorePops) {
      p.y += p.vy * dt
      p.alpha -= 1.4 * dt
    }
    runtime.scorePops = runtime.scorePops.filter(p => p.alpha > 0)

    for (const f of runtime.playerFragments) {
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.vy += 1800 * dt
      f.alpha -= 1.2 * dt
    }
    runtime.playerFragments = runtime.playerFragments.filter(f => f.alpha > 0)

    if (runtime.requestReplayCapture) {
      runtime.requestReplayCapture = false
    }

    if (!runtime.player.onGround) {
      const jumpHeight = runtime.jumpStartY - runtime.jumpApexY || 1
      const progress = Math.min(1, (runtime.jumpStartY - runtime.player.y) / (jumpHeight * 2))
      if (runtime.jumpStyle === 'twirl') {
        const twirlSpin = progress * Math.PI * 2
        const sway = Math.sin(progress * Math.PI) * 0.35
        runtime.rotation = twirlSpin + sway
      } else {
        runtime.rotation = progress * Math.PI * 3
      }

      if (runtime.hangActive) {
        runtime.player.vy = Math.max(runtime.player.vy - 180 * dtRaw, -90)
      }
    }

    if (supportingGround && runtime.player.y + runtime.player.height >= runtime.groundY) {
      const landingSlam = runtime.isSlamming
      const slamDepth = landingSlam ? runtime.groundY - (runtime.slamOriginY ?? runtime.groundY) : 0
      const intenseSlam = landingSlam && slamDepth > INTENSE_SLAM_HEIGHT
      const slamPower = intenseSlam ? 1.4 : 1

      runtime.player.y = runtime.groundY - runtime.player.height
      runtime.player.vy = 0
      runtime.player.onGround = true
      runtime.airKillCombo = 0
      runtime.airJumps = 1
      if (!(runtime.comboGraceTimer && runtime.comboGraceTimer > 0)) {
        runtime.airComboMultiplier = 1
        runtime.airComboStreak = 0
      }

      if (landingSlam) {
        runtime.shockwaves.push({
          x: runtime.player.x + runtime.player.width / 2,
          y: runtime.groundY,
          w: 80 * slamPower,
          h: 10 + (intenseSlam ? 4 : 0),
          alpha: intenseSlam ? 0.45 : 0.32,
          intense: intenseSlam,
        })
        audioEngine.playSfx('slam', intenseSlam ? 1 : 0.8)

        if (intenseSlam) {
          runtime.flashTimer = Math.max(runtime.flashTimer, 0.12)
          runtime.cameraShake = Math.max(runtime.cameraShake, 12)
          runtime.sonicBursts.push({
            x: runtime.player.x + runtime.player.width / 2,
            y: runtime.player.y + runtime.player.height / 2,
            r: 0,
            alpha: 0.9,
          })

          const slamCenter = runtime.player.x + runtime.player.width / 2
          const knockRange = 240
          for (const e of runtime.enemies) {
            if (e.type !== 'spiker' || !e.alive || e.squished || e.spikes === false) continue
            const ex = e.x + e.width / 2
            if (Math.abs(ex - slamCenter) <= knockRange) {
              e.spikes = false
              e.confident = false
              e.concerned = true
              runtime.hatBursts.push({
                x: ex,
                y: e.y,
                r: 10,
                alpha: 1,
                vy: -80,
              })
            }
          }
        }
      }

      runtime.isSlamming = false
      runtime.slamOriginY = null
      runtime.rotation = 0
    } else if (!supportingGround) {
      runtime.player.onGround = false
    }

    for (const o of runtime.obstacles) {
      o.x -= runtime.scrollSpeed * dt
    }

    runtime.obstacles = runtime.obstacles.filter(o => o.x + o.width > 0 && !o._destroy)

    runtime.hatBursts = runtime.hatBursts
      .map(p => ({
        ...p,
        y: p.y + p.vy * dt,
        r: p.r * 0.985,
        alpha: p.alpha - dt * 0.9,
      }))
      .filter(p => p.alpha > 0.05)

    for (const o of runtime.obstacles) {
      const ox = o.x + pad
      const oy = o.y + pad
      const ow = o.width - pad * 2
      const oh = o.height - pad * 2

      if (runtime.phaseActive && runtime.phaseMode === 'terrain') {
        const overlaps = playerHitbox.x < ox + ow &&
          playerHitbox.x + playerHitbox.w > ox &&
          playerHitbox.y < oy + oh &&
          playerHitbox.y + playerHitbox.h > oy
        if (overlaps) o._destroy = true
        continue
      }
      if (
        playerHitbox.x < ox + ow &&
        playerHitbox.x + playerHitbox.w > ox &&
        playerHitbox.y < oy + oh &&
        playerHitbox.y + playerHitbox.h > oy
      ) {
        const overlapTop = runtime.player.y + runtime.player.height - o.y
        const overlapBottom = o.y + o.height - runtime.player.y
        const overlapLeft = runtime.player.x + runtime.player.width - o.x
        const overlapRight = o.x + o.width - runtime.player.x

        const minOverlapY = Math.min(overlapTop, overlapBottom)
        const minOverlapX = Math.min(overlapLeft, overlapRight)

        if (minOverlapY < minOverlapX && runtime.player.vy >= 0 && runtime.player.y < o.y) {
          if (runtime.isSlamming) {
            runtime.player.vy = runtime.jumpVelocity * 1.3
            addCharge(16)
            runtime.shockwaves.push({
              x: runtime.player.x + runtime.player.width / 2,
              y: o.y,
              w: 100,
              h: 14,
              alpha: 0.7,
              intense: true,
            })
            runtime.comboGraceTimer = 0.8
          } else {
            runtime.player.vy = runtime.jumpVelocity * 0.9
          }
          runtime.player.y = o.y - runtime.player.height
          runtime.player.onGround = false
        } else if (minOverlapY < minOverlapX && runtime.player.vy < 0 && runtime.player.y > o.y) {
          runtime.player.vy = 200
          consumeCharge(8 * dtRaw)
        } else {
          if (runtime.dashActive) {
            o._destroy = true
            addBonus(150)
            addCharge(10)
            runtime.sonicBursts.push({
              x: o.x + o.width / 2,
              y: o.y + o.height / 2,
              r: 0,
              alpha: 0.8,
            })
          } else if (runtime.phaseActive) {
            o._destroy = true
          } else {
            if (!runtime.graceUsed) {
              runtime.graceUsed = true
              runtime.invulnTimer = 1.5
              consumeCharge(10)
              runtime.sonicBursts.push({
                x: runtime.player.x + runtime.player.width / 2,
                y: runtime.player.y + runtime.player.height / 2,
                r: 0,
                alpha: 0.7,
              })
            } else if (runtime.invulnTimer <= 0) {
              if (!ui.invincible.value) {
                ui.gameOver.value = true
                runtime.deathByEnemy = true
                runtime.deathSlowTimer = 0.9
              }
            }
          }
        }
      }
    }

    runtime.obstacles = runtime.obstacles.filter(o => !o._destroy)

    if (!prevGameOver && ui.gameOver.value) {
      audioEngine.playSfx('death', 1)
      ui.canSaveScore.value = true
      ui.savedCurrentRun.value = false
      ui.celebrationVisible.value = false
      ui.celebrationTimer.value = 0
      ui.snapshotMessageTimer.value = 0
    }
  }

  function draw() {
    if (!runtime.ctx) return
    const ctx = runtime.ctx
    ctx.clearRect(0, 0, runtime.width, runtime.height)

    const pulse = 20 + audioEngine.bass * 80
    const palette = getPalette(runtime, ui, pulse, audioEngine.intensity, runtime.intensityWindow)

    ctx.save()
    if (runtime.cameraShake > 0.05) {
      ctx.translate(
        (Math.random() - 0.5) * runtime.cameraShake,
        (Math.random() - 0.5) * runtime.cameraShake
      )
    }

    drawWorld(ctx, runtime, ui, palette, runtime.intensityWindow)
    drawHatBursts(ctx, runtime, palette)
    drawDash(ctx, runtime)
    drawAudioVisualizer(ctx, runtime, palette)
    drawPlayer(ctx, runtime, ui, palette)
    drawShockwaves(ctx, runtime, palette)
    drawSonicBursts(ctx, runtime)
    drawScorePops(ctx, runtime)
    drawObstacles(ctx, runtime, palette)
    drawEnemies(ctx, runtime, palette)
    drawPhaseOverlay(ctx, runtime, palette, ui)
    drawPowerTint(ctx, runtime)
    drawFlash(ctx, runtime)

    ctx.restore()

    drawHUD(ctx, runtime, ui, keybinds, {
      bpm: audioEngine.bpm,
      intensity: audioEngine.intensity,
    })
  }

  function loop(timestamp: number) {
    if (!runtime.lastTimestamp) runtime.lastTimestamp = timestamp
    const frameDt = (timestamp - runtime.lastTimestamp) / 1000
    const dt = Math.min(frameDt, 0.05)
    runtime.lastTimestamp = timestamp

    if (!ui.paused.value) update(dt)
    draw()

    runtime.animationId = requestAnimationFrame(loop)
  }

  function handleClick() {
    if (!ui.paused.value) handleJump()
  }

  const handleTouch = (e: TouchEvent) => {
    e.preventDefault()
    if (!ui.paused.value) handleJump()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (ui.gameOver.value && matchesKey('restart', e.code, keybinds)) {
      e.preventDefault()
      resetGame()
      return
    }
    if (matchesKey('pause', e.code, keybinds)) {
      e.preventDefault()
      togglePause()
      return
    }
    if (ui.paused.value) return
    if (matchesKey('jump', e.code, keybinds)) {
      e.preventDefault()
      handleJump()
    }
    if (matchesKey('slam', e.code, keybinds)) {
      e.preventDefault()
      handleSlam()
    }
    if (matchesKey('blast', e.code, keybinds)) {
      e.preventDefault()
      handleBlast()
    }
    if (matchesKey('phase', e.code, keybinds)) {
      e.preventDefault()
      handlePhase()
    }
    if (matchesKey('antigrav', e.code, keybinds)) {
      e.preventDefault()
      if (!runtime.hangActive) audioEngine.playSfx('antigravOn', 0.7)
      runtime.hangActive = true
    }
    if (matchesKey('slowmo', e.code, keybinds)) {
      e.preventDefault()
      if (!runtime.slowActive) audioEngine.playSfx('slowmoOn', 0.7)
      runtime.slowActive = true
    }
  }

  function handleKeyup(e: KeyboardEvent) {
    if (ui.paused.value) return
    if (matchesKey('antigrav', e.code, keybinds)) runtime.hangActive = false
    if (matchesKey('slowmo', e.code, keybinds)) runtime.slowActive = false
  }

  function updatePowerTint(dtRaw: number) {
    const active: Array<{ r: number; g: number; b: number }> = []
    if (runtime.phaseActive) active.push({ r: 168, g: 85, b: 247 })
    if (runtime.dashActive) active.push({ r: 251, g: 113, b: 133 })
    if (runtime.slowActive) active.push({ r: 56, g: 189, b: 248 })
    if (runtime.hangActive) active.push({ r: 250, g: 204, b: 21 })

    const target = { r: 0, g: 0, b: 0, alpha: 0 }
    if (active.length > 0) {
      for (const c of active) {
        target.r += c.r
        target.g += c.g
        target.b += c.b
      }
      target.r /= active.length
      target.g /= active.length
      target.b /= active.length
      target.alpha = Math.min(0.18, 0.08 + 0.03 * (active.length - 1))
    }

    const t = Math.min(1, dtRaw * 6)
    runtime.powerTint.r = lerp(runtime.powerTint.r, target.r, t)
    runtime.powerTint.g = lerp(runtime.powerTint.g, target.g, t)
    runtime.powerTint.b = lerp(runtime.powerTint.b, target.b, t)
    runtime.powerTint.alpha = lerp(runtime.powerTint.alpha, target.alpha, t)
  }

  function togglePause() {
    if (ui.gameOver.value) return
    ui.paused.value = !ui.paused.value
    if (ui.paused.value) {
      audioEngine.pause()
    } else {
      audioEngine.resume()
    }
  }

  function setPaused(paused: boolean) {
    if (ui.gameOver.value) return
    ui.paused.value = paused
    if (ui.paused.value) {
      audioEngine.pause()
    } else {
      audioEngine.resume()
    }
  }

  function seekToTime(seconds: number) {
    if (!audioEngine.audio) return
    const audio = audioEngine.audio
    const duration = audio.duration || 0
    const clamped = Math.max(0, Math.min(duration, seconds))
    audio.currentTime = clamped

    const beatMs = 60000 / Math.max(1, ui.bpm.value)
    const beatSeconds = beatMs / 1000
    runtime.beatIndex = Math.floor(clamped / beatSeconds)
    const now = performance.now()
    const beatOffset = (clamped % beatSeconds) * 1000
    runtime.lastBeatTime = now - beatOffset
    runtime.lastSubBeatTime = now - (beatOffset % (beatMs / 2))
    runtime.lastEnemySpawnBeat = runtime.beatIndex - 1
    runtime.lastObstacleSpawnBeat = runtime.beatIndex - 1

    runtime.enemies = []
    runtime.obstacles = []
    runtime.spawnBeacons = []
    runtime.scorePops = []
    runtime.sonicBursts = []
    runtime.shockwaves = []
    runtime.spawnEvents = []
    runtime.spawnHistory = []
    runtime.spawnDebugTicks = []
    ui.spawnLog.value = []

    spawns.reset()
  }

  function setKeybind(action: string, event: KeyboardEvent) {
    event.preventDefault()
    event.stopPropagation()
    keybinds[action] = [event.code]
    state.editingKey.value = null
  }

  function boot() {
    const rect = canvas.parentElement?.getBoundingClientRect()
    runtime.width = Math.min(960, (rect?.width ?? 960) - 16)
    runtime.height = 400
    canvas.width = runtime.width
    canvas.height = runtime.height
    runtime.ctx = canvas.getContext('2d')

    setupReplayRecorder(canvas, runtime)

    resetGame()
    loadDefaultAudio()
    startObstacleSpawner()
    runtime.animationId = requestAnimationFrame(loop)

    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('keyup', handleKeyup)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('touchstart', handleTouch, { passive: false })
  }

  function destroy() {
    if (runtime.animationId) cancelAnimationFrame(runtime.animationId)
    if (runtime.beatIntervalId) clearInterval(runtime.beatIntervalId)
    if (runtime.obstacleSpawnIntervalId) clearInterval(runtime.obstacleSpawnIntervalId)
    if (runtime.replayStopTimeout) clearTimeout(runtime.replayStopTimeout)
    stopReplayRecorder(runtime)
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('keyup', handleKeyup)
    canvas.removeEventListener('click', handleClick)
    canvas.removeEventListener('touchstart', handleTouch)
  }

  return {
    boot,
    destroy,
    handleJump,
    handleSlam,
    handleBlast,
    handlePhase,
    handleAudioUpload,
    loadDefaultAudio,
    setDifficulty,
    setKeybind,
    keyLabel,
    resetGame,
    startAudio,
    togglePause,
    setPaused,
    seekToTime,
    getLevelMapData: () => ({
      map: audioEngine.levelMap,
      currentTime: audioEngine.audio?.currentTime ?? 0,
      intensityWindows: audioEngine.intensityWindows,
      activeIntensityWindow: runtime.intensityWindow,
      spawnEvents: runtime.spawnEvents,
    }),
    getSpawnDebugData: () => ({
      timeline: audioEngine.audioTimeline,
      spawnHistory: runtime.spawnHistory,
      spawnTicks: runtime.spawnDebugTicks,
      currentTime: audioEngine.audio?.currentTime ?? 0,
    }),
  }
}
