import { clamp, lerp } from './systems/physicsSystem'
import { createSpawnSystem, applyDifficultySettings, getDifficultySettings } from './systems/spawnSystem'
import { isOnBeat, registerBeatAction } from './systems/beatSystem'
import {
  captureInstantReplay,
  setupReplayRecorder,
  stopReplayRecorder,
} from './systems/replaySystem'
import { createAudioEngine } from './systems/audioEngine'
import { triggerSquishBounce, applyBlastStrikes, applySlideStrike, addScore } from './systems/combatSystem'
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
  PARRY_COST,
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
  drawScorePops,
  drawShockwaves,
  drawSonicBursts,
} from './render/drawEffects'
import { drawPlayer } from './render/drawPlayer'
import { drawEnemies } from './render/drawEnemies'
import type { GameState } from './core/gameState'

export function createGameLoop(canvas: HTMLCanvasElement, state: GameState) {
  const { ui, keybinds, runtime } = state
  const audioEngine = createAudioEngine()
  const spawns = createSpawnSystem(runtime, ui)
  const { addBase, addBonus } = addScore(ui, runtime)

  function addCharge(amount: number) {
    ui.charge.value = clamp(ui.charge.value + amount, 0, 100)
  }
  function consumeCharge(amount: number) {
    ui.charge.value = clamp(ui.charge.value - amount, 0, 100)
  }

  function resetGame() {
    ui.score.value = 0
    ui.baseScore.value = 0
    ui.bonusScore.value = 0
    ui.speed.value = 1
    ui.gameOver.value = false
    ui.started.value = false
    ui.charge.value = 50
    runtime.deathByEnemy = false

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
    runtime.replayBuffer = []
    runtime.slideActive = false
    runtime.slideTimer = 0
    runtime.slideJumped = false
    runtime.slideElapsed = 0
    runtime.slideTargetX = 0
    runtime.flashTimer = 0
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
      if (!ui.started.value || ui.gameOver.value) return
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

    if (ui.gameOver.value) {
      resetGame()
      return
    }

    maybeGrantBeatJumpCharge()

    if (runtime.player.onGround) {
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

  function handleParry() {
    startAudio()
    if (ui.gameOver.value) return
    if (!ui.started.value && !ui.gameOver.value) {
      beginRun()
    }

    const onBeat = isOnBeat(runtime, ui, audioEngine.started, 70)
    if (!onBeat && ui.charge.value < PARRY_COST) return

    if (onBeat) {
      addCharge(8)
    } else {
      consumeCharge(PARRY_COST)
    }

    runtime.invulnTimer = Math.max(runtime.invulnTimer, 0.9)
    registerBeatAction(runtime, onBeat)

    const radius = 140
    runtime.enemies = runtime.enemies.map(e => {
      const cx = e.x + e.width / 2
      const cy = e.y + e.height / 2
      const dx = cx - (runtime.player.x + runtime.player.width / 2)
      const dy = cy - (runtime.player.y + runtime.player.height / 2)
      const dist = Math.hypot(dx, dy)
      if (dist < radius && e.alive && !e.squished) {
        addBonus(120)
        return { ...e, squished: true, alive: false, squishTimer: 0.12, currentHeight: e.height }
      }
      return e
    })

    runtime.sonicBursts.push({
      x: runtime.player.x + runtime.player.width / 2,
      y: runtime.player.y + runtime.player.height / 2,
      r: radius / 2,
      alpha: 1,
    })
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
    setTimeout(() => {
      ui.started.value = true
    }, 320)
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

  function update(dtRaw: number) {
    const dt = dtRaw
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
    const intensity = audioEngine.intensity
    runtime.cameraShake = lerp(
      runtime.cameraShake,
      ui.started.value && !ui.gameOver.value
        ? (ui.beatPulse.value ? audioEngine.bass * 2 : 0) + intensity * 0.6
        : 0,
      0.16
    )

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

    if (runtime.beatStreak > 0 && performance.now() - runtime.lastBeatActionTime > 4000) {
      runtime.beatStreak = 0
      runtime.scoreMultiplier = 1
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
          })
        }
      }
    }

    const baseGain = runtime.scrollSpeed * 0.02 * dt * (0.6 + intensity) * (runtime.slowActive ? 1.1 : 1)
    if (ui.started.value && !ui.gameOver.value) {
      addBase(baseGain)
    }
    const speedFactor = 1 + ui.score.value / 8000
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

    const lockSlideOnGround = runtime.slideActive && runtime.slideElapsed < (SLIDE_CROUCH_DURATION + SLIDE_DASH_DURATION)
    if (!lockSlideOnGround) {
      runtime.player.vy += (runtime.isSlamming ? effectiveGravity * 2.5 : effectiveGravity) * dtRaw * timeScale
      runtime.player.y += runtime.player.vy * dtRaw * timeScale
    } else {
      runtime.player.vy = 0
      runtime.player.y = runtime.groundY - runtime.player.height
    }

    runtime.scrollSpeed = runtime.baseScrollSpeed * ui.speed.value * timeScale

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
          } else {
            ui.gameOver.value = true
            runtime.deathByEnemy = true
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
            ui.gameOver.value = true
            runtime.deathByEnemy = true
            runtime.deathSlowTimer = 0.9
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

    for (const s of runtime.shockwaves) {
      s.w = (s.w || 0) + 2000 * dt * (s.intense ? 1.2 : 1)
      s.alpha -= (s.intense ? 2 : 1.8) * dt
    }
    runtime.shockwaves = runtime.shockwaves.filter(s => s.alpha > 0 && s.w < runtime.width * 2)

    for (const s of runtime.sonicBursts) {
      s.r += 1800 * dt
      s.alpha -= 2.2 * dt
    }
    runtime.sonicBursts = runtime.sonicBursts.filter(s => s.alpha > 0)

    runtime.spawnBeacons = runtime.spawnBeacons
      .map(b => ({ ...b, alpha: b.alpha - dt * 1.4 }))
      .filter(b => b.alpha > 0)

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
      try {
        captureInstantReplay(runtime, ui)
      } catch (err) {
        console.warn('replay capture failed', err)
        ui.snapshotMessageTimer.value = 0
      } finally {
        runtime.requestReplayCapture = false
      }
    }

    if (!runtime.player.onGround) {
      const jumpHeight = runtime.jumpStartY - runtime.jumpApexY || 1
      const progress = Math.min(1, (runtime.jumpStartY - runtime.player.y) / (jumpHeight * 2))
      runtime.rotation = progress * Math.PI * 3

      if (runtime.hangActive) {
        runtime.player.vy = Math.max(runtime.player.vy - 180 * dtRaw, -90)
      }
    }

    if (runtime.player.y + runtime.player.height >= runtime.groundY) {
      const landingSlam = runtime.isSlamming
      const slamDepth = landingSlam ? runtime.groundY - (runtime.slamOriginY ?? runtime.groundY) : 0
      const intenseSlam = landingSlam && slamDepth > INTENSE_SLAM_HEIGHT
      const slamPower = intenseSlam ? 1.4 : 1

      runtime.player.y = runtime.groundY - runtime.player.height
      runtime.player.vy = 0
      runtime.player.onGround = true
      runtime.airJumps = 1
      if (!(runtime.comboGraceTimer && runtime.comboGraceTimer > 0)) {
        runtime.airComboMultiplier = 1
        runtime.airComboStreak = 0
      }

      if (landingSlam) {
        runtime.shockwaves.push({
          x: runtime.player.x + runtime.player.width / 2,
          y: runtime.groundY,
          w: 90 * slamPower,
          h: 12 + (intenseSlam ? 6 : 0),
          alpha: 0.5,
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
              ui.gameOver.value = true
              runtime.deathByEnemy = true
              runtime.deathSlowTimer = 0.9
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
    }
  }

  function draw() {
    if (!runtime.ctx) return
    const ctx = runtime.ctx
    ctx.clearRect(0, 0, runtime.width, runtime.height)

    const pulse = 20 + audioEngine.bass * 80
    const palette = getPalette(runtime, ui, pulse, audioEngine.intensity)

    ctx.save()
    if (runtime.cameraShake > 0.05) {
      ctx.translate(
        (Math.random() - 0.5) * runtime.cameraShake,
        (Math.random() - 0.5) * runtime.cameraShake
      )
    }

    drawWorld(ctx, runtime, ui, palette)
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
    drawFlash(ctx, runtime)

    ctx.restore()

    drawHUD(ctx, runtime, ui, keybinds, {
      bpm: audioEngine.bpm,
      intensity: audioEngine.intensity,
    })
  }

  function loop(timestamp: number) {
    if (!runtime.lastTimestamp) runtime.lastTimestamp = timestamp
    const dt = (timestamp - runtime.lastTimestamp) / 1000
    runtime.lastTimestamp = timestamp

    update(dt)
    draw()

    runtime.animationId = requestAnimationFrame(loop)
  }

  function handleClick() {
    handleJump()
  }

  const handleTouch = (e: TouchEvent) => {
    e.preventDefault()
    handleJump()
  }

  function handleKeydown(e: KeyboardEvent) {
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
    if (matchesKey('parry', e.code, keybinds)) {
      e.preventDefault()
      handleParry()
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
    if (matchesKey('antigrav', e.code, keybinds)) runtime.hangActive = false
    if (matchesKey('slowmo', e.code, keybinds)) runtime.slowActive = false
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
    handleParry,
    handleAudioUpload,
    loadDefaultAudio,
    setDifficulty,
    setKeybind,
    keyLabel,
    resetGame,
    startAudio,
  }
}
