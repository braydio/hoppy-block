
<template>
  <div class="game-shell">
    <div class="hud">
      <div class="hud-item">
        <span class="label">Score</span>
        <span class="value">{{ Math.floor(score) }}</span>
      </div>
      <div class="hud-item">
        <span class="label">Speed</span>
        <span class="value">{{ speed.toFixed(1) }}x</span>
      </div>
      <div class="hud-item">
        <span class="label">Hoppy Block</span>
        <span class="value">{{ bpm }} BPM</span>
      </div>
      <div class="hud-audio">
        <label class="audio-label">
          <span>Track</span>
          <input
            type="file"
            accept="audio/*"
            @change="handleAudioUpload"
          />
        </label>
      </div>
    </div>

    <div
      class="game-frame"
      :class="{ 'game-frame--beat': beatPulse }"
    >
      <canvas ref="canvas" class="game-canvas"></canvas>

      <div v-if="gameOver" class="overlay">
        <div class="overlay-card">
          <h2>Game Over</h2>
          <p>Your score: {{ Math.floor(score) }}</p>
          <p class="help">
            Press <kbd>Space</kbd> or click to restart.
          </p>
        </div>
      </div>

      <div v-if="!started && !gameOver" class="overlay">
        <div class="overlay-card">
          <h2>Hoppy Block</h2>

          <p><kbd>Space</kbd> — Jump</p>
          <p><kbd>Shift</kbd> — Slam</p>
          <p><kbd>↑</kbd> — Hang Time</p>
          <p><kbd>↓</kbd> — Slow Motion</p>

          <p class="help" style="margin-top: 0.6rem;">
            Stay on beat to charge powers.
            Slam enemies for bonus energy.
            Floaters grow stronger with the music.
          </p>
        </div>
      </div>


    </div>

    <p class="controls">
    Controls:
    <kbd>Space</kbd> Jump ·
    <kbd>Shift</kbd> Slam ·
    <kbd>↑</kbd> Hang ·
    <kbd>↓</kbd> Slow
    </p>
  </div>
</template>


<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvas = ref(null)

const score = ref(0)
const speed = ref(1)
const gameOver = ref(false)
const started = ref(false)
const beatPulse = ref(false)
const bpm = ref(120)
const charge = ref(0) // 0–100 power meter

let ctx = null
let width = 900
let height = 400

// Game objects & state
let player
let obstacles
let gravity
let jumpVelocity
let groundY
let baseScrollSpeed
let scrollSpeed
let lastTimestamp
let animationId
let beatIntervalId
let audio = null
let audioStarted = false
let detectedBpm = 120
let lastBeatTime = 0
let audioCtx = null
let analyser = null
let freqData = null
let timeData = null
let bassEnergy = 0
let midEnergy = 0
let highEnergy = 0
let lastBassSpawn = 0
let lastMidSpawn = 0
let lastHighSpawn = 0
let obstacleSpawnIntervalId
let rotation = 0
let isSlamming = false
let jumpStartY = 0
let jumpApexY = 0
let enemies = []
let shockwaves = []
let scorePops = []
let sonicBursts = []
let deathByEnemy = false
let playerFragments = []

// global song energy (0–1)
let songIntensity = 0

// power state
let hangActive = false
let slowActive = false

let hangHeld = false
let slowHeld = false

// small helpers
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v
}
function lerp(a, b, t) {
  return a + (b - a) * t
}

function addCharge(amount) {
  charge.value = clamp(charge.value + amount, 0, 100)
}
function consumeCharge(amount) {
  charge.value = clamp(charge.value - amount, 0, 100)
}

function resetGame() {
  score.value = 0
  speed.value = 1
  gameOver.value = false
  started.value = false
  charge.value = 50
  deathByEnemy = false

  groundY = height - 60
  gravity = 2600
  jumpVelocity = -1050
  baseScrollSpeed = 380
  scrollSpeed = baseScrollSpeed
  lastTimestamp = null
  songIntensity = 0

  player = {
    x: 150,
    y: groundY - 50,
    width: 40,
    height: 40,
    vy: 0,
    onGround: true,
  }

  obstacles = []
  rotation = 0
  isSlamming = false
  jumpStartY = player.y
  jumpApexY = player.y
  enemies = []
  shockwaves = []
  scorePops = []
  sonicBursts = []
  playerFragments = []
}

async function handleAudioUpload(e) {
  const file = e.target.files[0]
  if (!file) return

  const url = URL.createObjectURL(file)
  audio = new Audio(url)
  audio.crossOrigin = 'anonymous'

  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const src = audioCtx.createMediaElementSource(audio)

  analyser = audioCtx.createAnalyser()
  analyser.fftSize = 2048

  freqData = new Uint8Array(analyser.frequencyBinCount)
  timeData = new Uint8Array(analyser.fftSize)

  src.connect(analyser)


  const midFilter = audioCtx.createBiquadFilter()
  midFilter.type = 'bandpass'
  midFilter.frequency.value = 1200
  midFilter.Q.value = 1.1

  const drive = audioCtx.createWaveShaper()
  drive.curve = makeDistortion(0)
  drive.oversample = '4x'

  // DRY / WET MIX
  const dryGain = audioCtx.createGain()
  const wetGain = audioCtx.createGain()
  dryGain.gain.value = 1.0
  wetGain.gain.value = 0.0

  // FINAL OUTPUT COMPRESSOR
  const compressor = audioCtx.createDynamicsCompressor()
  compressor.threshold.value = -20
  compressor.knee.value = 16
  compressor.ratio.value = 2.8
  compressor.attack.value = 0.005
  compressor.release.value = 0.18

  // 🔥 CLEAN ROUTING (IMPORTANT)
  src.disconnect()

  // DRY = FULL SPECTRUM
  src.connect(dryGain)

  // WET = MID ONLY → DISTORTED
  src.connect(midFilter)
  midFilter.connect(drive)
  drive.connect(wetGain)

  // MIX + CONTROL
  dryGain.connect(compressor)
  wetGain.connect(compressor)

  compressor.connect(analyser)
  analyser.connect(audioCtx.destination)

  // store refs
  audio._dryGain = dryGain
  audio._wetGain = wetGain
  audio._drive = drive
  audio._compressor = compressor

  analyser.connect(audioCtx.destination)

  // Decode buffer for more robust BPM detection
  const arrayBuffer = await file.arrayBuffer()
  const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer)

  detectedBpm = detectBPMFromBuffer(decodedBuffer)
  bpm.value = detectedBpm
  console.log('✅ Decoded BPM:', detectedBpm)

  audioStarted = false
}

function makeDistortion(k = 80) {
  const n = 44100
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = (1 + k) * x / (1 + k * Math.abs(x))
  }
  return curve
}

function detectBPMFromBuffer(buffer) {
  const channelData = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate

  const peaks = []
  const threshold = 0.9
  let lastPeak = 0

  for (let i = 0; i < channelData.length; i++) {
    if (channelData[i] > threshold && i - lastPeak > sampleRate * 0.25) {
      peaks.push(i)
      lastPeak = i
    }
  }

  const intervals = []
  for (let i = 1; i < peaks.length; i++) {
    intervals.push((peaks[i] - peaks[i - 1]) / sampleRate)
  }

  const tempos = intervals.map(i => 60 / i)
  const grouped = {}

  for (const t of tempos) {
    const rounded = Math.round(t)
    grouped[rounded] = (grouped[rounded] || 0) + 1
  }

  const strongest = Object.entries(grouped).sort((a, b) => b[1] - a[1])[0]
  return strongest ? Number(strongest[0]) : 120
}

function spawnEnemy(type) {
  let enemy

  if (type === 'goomba') {
    enemy = {
      type: 'goomba',
      band: 'bass',            // tied to kick
      x: width + 40,
      y: groundY - 28,
      width: 32,
      height: 28,
      alive: true,
      squished: false,
      squishTimer: 0,
      pancakeHeight: 6,
      currentHeight: 28,
      bob: 0,
      squash: 1,
    }
  }

  if (type === 'spiker') {
    enemy = {
      type: 'spiker',
      band: 'mid',             // tied to synth
      x: width + 40,
      y: groundY - 34,
      width: 26,
      height: 34,
      alive: true,
      squished: false,
      squishTimer: 0,
      pancakeHeight: 10,
      currentHeight: 34,
      bob: 0,
      squash: 1,
    }
  }

  if (type === 'floater') {
    enemy = {
      type: 'floater',
      band: 'high',            // tied to hats / sparkle
      x: width + 40,
      y: groundY - 120,
      width: 28,
      height: 28,
      alive: true,
      squished: false,
      bob: 0,
      phase: Math.random() * Math.PI * 2,
      rage: 0,                 // 0–1 emotional state
    }
  }

  if (enemy) enemies.push(enemy)
}

function spawnObstacle() {
  const minGap = 280
  const widthOptions = [30, 40, 50]
  const chosenWidth = widthOptions[Math.floor(Math.random() * widthOptions.length)]

  const obstacle = {
    x: width + Math.random() * 50,
    y: groundY - 40,
    width: chosenWidth,
    height: 40,
    passed: false,
  }

  const tooClose = obstacles.some(o => obstacle.x - (o.x + o.width) < minGap)
  if (!tooClose) {
    obstacles.push(obstacle)
  }
}

function drawHUD() {
  const pad = 14

  // === Charge Bar ===
  const barWidth = 180
  const barHeight = 10
  const fill = (charge.value / 100) * barWidth

  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.fillStyle = '#020617'
  ctx.fillRect(pad, pad, barWidth, barHeight)

  ctx.fillStyle = '#22c55e'
  ctx.fillRect(pad, pad, fill, barHeight)

  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 1.5
  ctx.strokeRect(pad, pad, barWidth, barHeight)

  ctx.font = '12px system-ui'
  ctx.fillStyle = '#e5e7eb'
  ctx.fillText(`CHARGE`, pad, pad - 4)
  ctx.restore()

  // === Power Status Icons ===
  ctx.save()
  ctx.font = '14px system-ui'
  ctx.textAlign = 'left'
  ctx.fillStyle = hangActive ? '#facc15' : '#64748b'
  ctx.fillText('⬆ HANG', pad, pad + 28)

  ctx.fillStyle = slowActive ? '#38bdf8' : '#64748b'
  ctx.fillText('⬇ SLOW', pad + 80, pad + 28)
  ctx.restore()

  // === BPM + Intensity ===
  ctx.save()
  ctx.font = '13px system-ui'
  ctx.textAlign = 'right'

  const bpmX = width - pad
  ctx.fillStyle = '#fde68a'
  ctx.fillText(`BPM ${bpm.value}`, bpmX, pad + 10)

  const intensityBarWidth = 120
  const iFill = songIntensity * intensityBarWidth

  ctx.fillStyle = '#020617'
  ctx.fillRect(width - intensityBarWidth - pad, pad + 18, intensityBarWidth, 8)

  ctx.fillStyle = '#a855f7'
  ctx.fillRect(width - intensityBarWidth - pad, pad + 18, iFill, 8)

  ctx.strokeStyle = '#f472b6'
  ctx.strokeRect(width - intensityBarWidth - pad, pad + 18, intensityBarWidth, 8)

  ctx.fillStyle = '#e5e7eb'
  ctx.fillText('INTENSITY', bpmX, pad + 40)

  ctx.restore()
}
async function startAudio() {
  if (!audio || audioStarted) return

  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume()
  }

  audio.playbackRate = 1.0
  await audio.play()
  audioStarted = true
  lastBeatTime = performance.now()
}

function startObstacleSpawner() {
  if (obstacleSpawnIntervalId) clearInterval(obstacleSpawnIntervalId)
  obstacleSpawnIntervalId = setInterval(() => {
    if (!started.value || gameOver.value) return
    const hasNearRight = obstacles.some(o => width - o.x < 260)
    if (!hasNearRight) spawnObstacle()
  }, 1600)
}

// Simple "near beat" detector for jump charge
function maybeGrantBeatJumpCharge() {
  if (!audioStarted) return
  const beatMs = 60000 / bpm.value
  const now = performance.now()
  const distToCurrent = Math.abs(now - lastBeatTime)
  const distToNext = Math.abs((lastBeatTime + beatMs) - now)
  const dist = Math.min(distToCurrent, distToNext)
  if (dist < 80) {
    addCharge(4)
  }
}

function handleJump() {
  startAudio()
  if (!started.value && !gameOver.value) {
    started.value = true
  }

  if (gameOver.value) {
    resetGame()
    return
  }

  maybeGrantBeatJumpCharge()

  if (player.onGround) {
    player.vy = jumpVelocity
    player.onGround = false
    isSlamming = false
    rotation = 0
    jumpStartY = player.y
    jumpApexY = player.y
  }
}

function handleSlam() {
  startAudio()
  if (!player.onGround && !isSlamming && !gameOver.value) {
    isSlamming = true
    player.vy = 2000 // aggressive downward force
  }
}

function update(dtRaw) {
  // Determine power intents before time scaling
  const dt = dtRaw

  hangActive = hangHeld && charge.value > 0
  slowActive = slowHeld && charge.value > 0

  // prevent both at the same time
  if (hangActive && slowActive) {
    slowActive = false
  }



  // Update audio playback rate for slow-mo
  if (audio) {
    audio.playbackRate = slowActive ? 0.5 : 1.0
  }


  if (audio && audio._drive && audio._dryGain && audio._wetGain) {
    if (hangActive) {
      const amt = 6 + (charge.value / 100) * 10   // softer distortion
      audio._drive.curve = makeDistortion(amt)

      audio._wetGain.gain.value = 0.35   // much lower wet level
      audio._dryGain.gain.value = 0.9    // small clean dip for contrast
    } else {
      audio._drive.curve = makeDistortion(0)

      audio._wetGain.gain.value = 0.0
      audio._dryGain.gain.value = 1.0
    }
  }



  if (audio && hangActive) {
    const beat = 60000 / bpm.value
    const phase = (performance.now() % beat) / beat
    const tremolo = 0.85 + Math.sin(phase * Math.PI * 2) * 0.15
    audio.volume = tremolo
  } else if (audio) {
    audio.volume = 1
  }

  const beatPhase = (performance.now() - lastBeatTime) / (60000 / bpm.value)
  const beatPulseStrength = Math.sin(Math.min(beatPhase, 1) * Math.PI)

  // REAL AUDIO BEAT SYNC & ENERGY
  if (analyser && audioStarted) {
    analyser.getByteFrequencyData(freqData)

    let bass = 0
    let mids = 0
    let highs = 0

    for (let i = 0; i < 30; i++) bass += freqData[i]        // kick / bass
    for (let i = 40; i < 120; i++) mids += freqData[i]      // synth / leads
    for (let i = 140; i < 220; i++) highs += freqData[i]    // hats / sparkle

    bassEnergy = bass / 30 / 255
    midEnergy = mids / 80 / 255
    highEnergy = highs / 80 / 255

    const rawEnergy = bassEnergy * 0.5 + midEnergy * 0.3 + highEnergy * 0.2
    songIntensity = lerp(songIntensity, rawEnergy, 0.04)
  }

  // === CHARGE SYSTEM ===

  if (hangActive || slowActive) {
    charge.value -= 30 * dtRaw
  } else if (player.onGround) {
    charge.value += 35 * dtRaw
  }

  charge.value = clamp(charge.value, 0, 100)

  if (charge.value <= 0) {
    hangActive = false
    slowActive = false
  }

  // Enemy dance & rage
  for (const e of enemies) {
    if (e.band === 'bass') {
      e.squash = 1 + beatPulseStrength * bassEnergy * 0.6
      e.bob = -beatPulseStrength * 10 * bassEnergy
    }

    if (e.band === 'mid') {
      e.squash = 1 + beatPulseStrength * midEnergy * 0.35
      e.bob = -beatPulseStrength * 6 * midEnergy
    }

    if (e.band === 'high') {
      e.phase += dt * 8
      e.bob = Math.sin(e.phase) * 10 * highEnergy
    }

    if (e.type === 'floater') {
      e.rage = clamp(
        e.rage + songIntensity * 0.6 * dt - 0.15 * dt,
        0,
        1
      )
      // Optional: make enraged floaters drift toward player a bit
      if (e.rage > 0.6) {
        const dir = player.x - e.x
        e.x += Math.sign(dir) * 40 * dt * (0.5 + e.rage)
      }
    }
  }

  // Beat-timed spawns
  if (audioStarted) {
    const beatMs = 60000 / bpm.value
    const now = performance.now()

    if (now - lastBeatTime >= beatMs) {
      lastBeatTime += beatMs
      beatPulse.value = true

      setTimeout(() => {
        beatPulse.value = false
      }, 90)

      if (started.value && !gameOver.value) {
        // Use *current* energies at beat time
        if (bassEnergy > 0.55 && now - lastBassSpawn > 260) {
          spawnEnemy('goomba')
          lastBassSpawn = now
        }

        if (midEnergy > 0.45 && now - lastMidSpawn > 300) {
          spawnEnemy('spiker')
          lastMidSpawn = now
        }

        if (highEnergy > 0.5 && now - lastHighSpawn > 280) {
          spawnEnemy('floater')
          lastHighSpawn = now
        }

        if (highEnergy > 0.65) {
          spawnObstacle()
        }
      }
    }
  }


  // Score + speed ramp (bonus during slow-mo)
  const scoreMult = slowActive ? 1.8 : 1
  score.value += dt * 0.001 * 100 * scoreMult
  const speedFactor = 1 + score.value / 5000
  speed.value = speedFactor
  scrollSpeed = baseScrollSpeed * speedFactor

  const timeScale = slowActive ? 0.45 : 1

  const effectiveGravity = hangActive ? gravity * 0.035 : gravity


  player.vy += (isSlamming ? effectiveGravity * 2.5 : effectiveGravity) * dtRaw * timeScale
  player.y += player.vy * dtRaw * timeScale

  scrollSpeed = baseScrollSpeed * speed.value * timeScale

  if (player.y < jumpApexY) {
    jumpApexY = player.y
  }

  // Move enemies
  for (const e of enemies) {
    e.x -= scrollSpeed * 0.95 * dt
  }

  enemies = enemies.filter(e => {
    if (e.squished) return e.squishTimer > -0.2
    return e.x + e.width > 0 && e.alive
  })

  for (const e of enemies) {
    if (e.squished) {
      e.squishTimer -= dt
      e.currentHeight = Math.max(
        e.pancakeHeight ?? 0,
        (e.currentHeight ?? 0) - 220 * dt
      )
    }
  }

  // Enemy collisions
  for (const e of enemies) {
    if (
      player.x < e.x + e.width &&
      player.x + player.width > e.x &&
      player.y < e.y + e.height &&
      player.y + player.height > e.y
    ) {
      if (e.type === 'goomba' && isSlamming && e.alive && !e.squished) {
        // slam kill
        e.squished = true
        e.alive = false
        e.squishTimer = 0.18
        e.currentHeight = e.height
        score.value += 250
        addCharge(12)

        sonicBursts.push({
          x: e.x + e.width / 2,
          y: e.y + e.height / 2,
          r: 0,
          alpha: 0.8,
        })

        scorePops.push({
          x: e.x + e.width / 2,
          y: e.y,
          value: 250,
          alpha: 1,
          vy: -80,
        })
      } else if (e.type === 'floater' && isSlamming && e.alive) {
        // calm vs enraged floater
        const enraged = (e.rage ?? 0) > 0.85
        if (!enraged || slowActive || hangActive) {
          e.alive = false
          score.value += enraged ? 500 : 400
          addCharge(enraged ? 30 : 20)

          sonicBursts.push({
            x: e.x + e.width / 2,
            y: e.y + e.height / 2,
            r: 0,
            alpha: 0.9,
          })
        } else {
          gameOver.value = true
          deathByEnemy = true
        }
      } else if (e.alive && !e.squished) {
        // spiker or bad contact → death
        gameOver.value = true
        deathByEnemy = true
      }
    }
  }

  // Player shatter on death (one-time)
  if (deathByEnemy && playerFragments.length === 0) {
    const cx = player.x + player.width / 2
    const cy = player.y + player.height / 2
    const size = player.width / 2

    playerFragments.push(
      { x: cx, y: cy, vx: -220, vy: -260, size, alpha: 1 },
      { x: cx, y: cy, vx: 220,  vy: -260, size, alpha: 1 },
      { x: cx, y: cy, vx: -220, vy: 260,  size, alpha: 1 },
      { x: cx, y: cy, vx: 220,  vy: 260,  size, alpha: 1 },
    )
  }

  // Expand shockwaves
  for (const s of shockwaves) {
    s.r += 1200 * dt
    s.alpha -= 1.8 * dt
  }
  shockwaves = shockwaves.filter(s => s.alpha > 0)

  // Animate sonic bursts
  for (const s of sonicBursts) {
    s.r += 1800 * dt
    s.alpha -= 2.2 * dt
  }
  sonicBursts = sonicBursts.filter(s => s.alpha > 0)

  // Animate floating score pops
  for (const p of scorePops) {
    p.y += p.vy * dt
    p.alpha -= 1.4 * dt
  }
  scorePops = scorePops.filter(p => p.alpha > 0)

  // Animate player fragments
  for (const f of playerFragments) {
    f.x += f.vx * dt
    f.y += f.vy * dt
    f.vy += 1800 * dt
    f.alpha -= 1.2 * dt
  }
  playerFragments = playerFragments.filter(f => f.alpha > 0)

  // Flip rotation: 1.5 rotations over full jump arc
  if (!player.onGround) {
    const jumpHeight = jumpStartY - jumpApexY || 1
    const progress = Math.min(1, (jumpStartY - player.y) / (jumpHeight * 2))
    rotation = progress * Math.PI * 3

    // ✅ HANG MODE

    if (hangActive) {
      // strong float clamp + gentle upward bias
      player.vy = Math.max(player.vy - 180 * dtRaw, -90)
    }

  }


  // Ground & slam shockwave
  if (player.y + player.height >= groundY) {
    player.y = groundY - player.height
    player.vy = 0
    player.onGround = true

    if (isSlamming) {
      shockwaves.push({
        x: player.x + player.width / 2,
        y: groundY,
        r: 0,
        alpha: 0.6,
      })
    }

    isSlamming = false
    rotation = 0
  }

  // Move obstacles
  for (const o of obstacles) {
    o.x -= scrollSpeed * dt
  }

  // Remove off-screen obstacles
  obstacles = obstacles.filter(o => o.x + o.width > 0)

  // Directional block collision
  for (const o of obstacles) {
    if (
      player.x < o.x + o.width &&
      player.x + player.width > o.x &&
      player.y < o.y + o.height &&
      player.y + player.height > o.y
    ) {
      const overlapTop = player.y + player.height - o.y
      const overlapBottom = o.y + o.height - player.y
      const overlapLeft = player.x + player.width - o.x
      const overlapRight = o.x + o.width - player.x

      const minOverlapY = Math.min(overlapTop, overlapBottom)
      const minOverlapX = Math.min(overlapLeft, overlapRight)

      if (minOverlapY < minOverlapX && player.vy >= 0 && player.y < o.y) {
        // Top-contact: bounce or super-bounce if slamming
        if (isSlamming) {
          player.vy = jumpVelocity * 1.3
          addCharge(16)
          shockwaves.push({
            x: player.x + player.width / 2,
            y: o.y,
            r: 0,
            alpha: 0.7,
          })
        } else {
          player.vy = jumpVelocity * 0.9
        }
        player.y = o.y - player.height
        player.onGround = false
      } else if (minOverlapY < minOverlapX && player.vy < 0 && player.y > o.y) {
        // Hit from below: small penalty tap
        player.vy = 200
        consumeCharge(8 * dtRaw)
      } else {
        // Side impact = lethal
        gameOver.value = true
        deathByEnemy = true
      }
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, width, height)

  const pulse = 20 + bassEnergy * 80
  ctx.fillStyle = `rgb(${2 + pulse}, 6, 23)`
  ctx.fillRect(0, 0, width, height)

  // Parallax stripes
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#0f172a'
  const stripeHeight = 32
  for (let y = 0; y < height; y += stripeHeight) {
    ctx.fillRect(0, y, width, stripeHeight - 8)
  }
  ctx.restore()

  // Ground
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, groundY, width, height - groundY)

  // Beat line
  ctx.save()
  ctx.globalAlpha = beatPulse.value ? 0.7 : 0.25
  ctx.strokeStyle = '#22d3ee'
  ctx.lineWidth = 3
  ctx.setLineDash(beatPulse.value ? [8, 6] : [2, 10])
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.lineTo(width, groundY)
  ctx.stroke()
  ctx.restore()

  // AUDIO VISUALIZER
  if (analyser && audioStarted) {
    analyser.getByteFrequencyData(freqData)
    analyser.getByteTimeDomainData(timeData)

    const barCount = 32
    const barWidth = width / barCount

    for (let i = 0; i < barCount; i++) {
      const v = freqData[i] / 255
      const barHeight = v * 140

      ctx.fillStyle = `rgba(34, 211, 238, ${v})`
      ctx.fillRect(
        i * barWidth,
        groundY - barHeight,
        barWidth - 2,
        barHeight
      )
    }

    ctx.save()
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()

    const slice = width / timeData.length
    let x = 0

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0
      const y = v * height * 0.3

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)

      x += slice
    }

    ctx.stroke()
    ctx.restore()
  }

  // Player
  const playerColor = gameOver.value && deathByEnemy
    ? 'transparent'
    : gameOver.value
    ? '#f97316'
    : '#22c55e'

  ctx.save()
  ctx.translate(
    player.x + player.width / 2,
    player.y + player.height / 2
  )
  ctx.rotate(rotation)

  ctx.fillStyle = playerColor
  ctx.fillRect(
    -player.width / 2,
    -player.height / 2,
    player.width,
    player.height
  )

  if (gameOver.value && deathByEnemy) {
    ctx.strokeStyle = '#020617'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-14, -14)
    ctx.lineTo(14, 14)
    ctx.moveTo(14, -14)
    ctx.lineTo(-14, 14)
    ctx.stroke()
  }
  ctx.restore()

  // Player glow
  ctx.save()
  ctx.shadowColor = playerColor
  ctx.shadowBlur = 18
  ctx.strokeStyle = playerColor
  ctx.lineWidth = 2
  ctx.strokeRect(player.x, player.y, player.width, player.height)
  ctx.restore()

  // Player fragments
  for (const f of playerFragments) {
    ctx.save()
    ctx.globalAlpha = f.alpha
    ctx.fillStyle = '#22c55e'
    ctx.fillRect(
      f.x - f.size / 2,
      f.y - f.size / 2,
      f.size,
      f.size
    )
    ctx.restore()
  }

  // Ground shockwaves
  for (const s of shockwaves) {
    ctx.save()
    ctx.globalAlpha = s.alpha
    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // Sonic bursts
  for (const s of sonicBursts) {
    ctx.save()
    ctx.globalAlpha = s.alpha

    ctx.strokeStyle = '#f97316'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = '#fde68a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r * 0.6, 0, Math.PI * 2)
    ctx.stroke()

    ctx.restore()
  }

  // Score pops
  for (const p of scorePops) {
    ctx.save()
    ctx.globalAlpha = p.alpha
    ctx.fillStyle = p.value >= 250 ? '#f97316' : '#facc15'
    ctx.font = 'bold 18px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(`+${p.value}`, p.x, p.y)
    ctx.restore()
  }

  // Obstacles
  ctx.fillStyle = '#38bdf8'
  for (const o of obstacles) {
    ctx.fillRect(o.x, o.y, o.width, o.height)
    ctx.save()
    ctx.globalAlpha = 0.7
    ctx.fillStyle = '#f97316'
    ctx.fillRect(o.x, o.y - 6, o.width, 4)
    ctx.restore()
  }

  // Enemies
  for (const e of enemies) {
    ctx.save()

    const bobY = e.bob || 0
    const squash = e.squash || 1

    if (!e.squished) {
      ctx.translate(e.x + e.width / 2, e.y + e.height / 2 + bobY)
      ctx.scale(1 / squash, squash)
      ctx.translate(-e.width / 2, -e.height / 2)

      if (e.type === 'goomba') {
        ctx.fillStyle = '#f97316'
        ctx.fillRect(0, 0, e.width, e.height)

        ctx.fillStyle = '#020617'
        ctx.fillRect(7, 8, 4, 4)
        ctx.fillRect(e.width - 11, 8, 4, 4)
        ctx.fillRect(e.width / 2 - 3, 16, 6, 2)
      }

      if (e.type === 'spiker') {
        ctx.fillStyle = '#38bdf8'
        ctx.fillRect(0, 0, e.width, e.height)

        ctx.fillStyle = '#020617'
        ctx.beginPath()
        ctx.moveTo(4, 0)
        ctx.lineTo(13, -8)
        ctx.lineTo(22, 0)
        ctx.fill()
      }

      if (e.type === 'floater') {
        const rage = e.rage ?? 0
        const r = Math.round(168 + rage * 60)
        const g = Math.round(85 - rage * 40)
        const b = Math.round(247 - rage * 80)
        ctx.fillStyle = `rgb(${r},${Math.max(g, 0)},${Math.max(b, 80)})`

        ctx.beginPath()
        ctx.arc(e.width / 2, e.height / 2, e.width / 2, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#020617'
        ctx.beginPath()
        ctx.arc(e.width / 2 - 5, e.height / 2 - 2, 2, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 5, e.height / 2 - 2, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()

  }

  drawHUD()
}

function loop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp
  const dt = (timestamp - lastTimestamp) / 1000
  lastTimestamp = timestamp

  update(dt)
  draw()

  animationId = requestAnimationFrame(loop)
}

function handleKeydown(e) {
  // JUMP
  if (e.code === 'Space') {
    e.preventDefault()
    handleJump()
  }

  // SLAM
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault()
    handleSlam()
  }

  // HANG
  if (e.code === 'ArrowUp') {
    hangHeld = true
  }

  // SLOW
  if (e.code === 'ArrowDown') {
    slowHeld = true
  }
}


function handleKeyup(e) {
  if (e.code === 'ArrowUp') hangHeld = false
  if (e.code === 'ArrowDown') slowHeld = false
}


function handleClick() {
  handleJump()
}

onMounted(() => {
  const c = canvas.value
  if (!c) return
  const rect = c.parentElement.getBoundingClientRect()
  width = Math.min(960, rect.width - 16)
  height = 400

  c.width = width
  c.height = height
  ctx = c.getContext('2d')

  resetGame()
  startObstacleSpawner()
  animationId = requestAnimationFrame(loop)

  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
  c.addEventListener('click', handleClick)
  c.addEventListener('touchstart', (e) => {
    e.preventDefault()
    handleJump()
  }, { passive: false })
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (beatIntervalId) clearInterval(beatIntervalId)
  if (obstacleSpawnIntervalId) clearInterval(obstacleSpawnIntervalId)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  const c = canvas.value
  if (c) {
    c.removeEventListener('click', handleClick)
  }
})
</script>

<style scoped>
.game-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 980px;
}

.hud {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}


.hud-audio {
  margin-top: 0.25rem;
  display: flex;
  justify-content: center;
}

.audio-label {
  font-size: 0.75rem;
  color: #e5e7eb;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(15, 23, 42, 0.9);
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.audio-label input {
  font-size: 0.75rem;
}

.hud-item {
  background: rgba(15, 23, 42, 0.9);
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
}

.hud-item .label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #9ca3af;
}

.hud-item .value {
  font-size: 0.95rem;
  font-weight: 600;
  color: #e5e7eb;
}

.game-frame {
  position: relative;
  border-radius: 1.2rem;
  padding: 0.5rem;
  background: radial-gradient(circle at top left, #0f172a 0, #020617 60%);
  border: 1px solid rgba(148, 163, 184, 0.4);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.85);
  transition: box-shadow 120ms ease-out, transform 120ms ease-out;
  width: 100%;
  max-width: 960px;
}

.game-frame--beat {
  box-shadow: 0 0 24px rgba(56, 189, 248, 0.45);
  transform: translateY(-1px);
}

.game-canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.9rem;
}

.overlay {
  position: absolute;
  inset: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.overlay-card {
  pointer-events: auto;
  background: rgba(15, 23, 42, 0.95);
  border-radius: 1rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid rgba(148, 163, 184, 0.6);
  text-align: center;
  max-width: 320px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.9);
}

.overlay-card h2 {
  font-size: 1.3rem;
  margin-bottom: 0.4rem;
}

.overlay-card p {
  font-size: 0.9rem;
  margin: 0.2rem 0;
}

.overlay-card .help {
  margin-top: 0.4rem;
  opacity: 0.8;
}

kbd {
  background: #111827;
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
  border: 1px solid rgba(148, 163, 184, 0.7);
  font-size: 0.8em;
}

.controls {
  font-size: 0.8rem;
  opacity: 0.8;
  text-align: center;
}
</style>
