
<template>
  <div class="game-shell">
    <div class="hud">
      <div class="hud-item hud-item--stack">
        <div class="hud-row">
          <span class="label">Score</span>
          <span class="value">{{ Math.floor(score) }}</span>
        </div>
        <span class="subvalue">Base {{ Math.floor(baseScore) }} · Bonus {{ Math.floor(bonusScore) }}</span>
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
          <template v-if="countdownTimer > 0">
            <h2>Get Ready</h2>
            <p style="font-size: 2.5rem; margin: 0.4rem 0;">{{ Math.ceil(countdownTimer) }}</p>
          </template>
          <template v-else>
            <h2>Hoppy Block</h2>

            <p><kbd>{{ keyLabel(keybinds.jump) }}</kbd> — Jump</p>
            <p><kbd>{{ keyLabel(keybinds.slam) }}</kbd> — Slam</p>
            <p><kbd>{{ keyLabel(keybinds.antigrav) }}</kbd> — Antigrav</p>
            <p><kbd>{{ keyLabel(keybinds.slowmo) }}</kbd> — Slow-Mo</p>
            <p><kbd>{{ keyLabel(keybinds.blast) }}</kbd> — Beat Blast</p>
            <p><kbd>{{ keyLabel(keybinds.phase) }}</kbd> — Phase Shift</p>
            <p><kbd>{{ keyLabel(keybinds.parry) }}</kbd> — Beat Parry</p>

            <p class="help" style="margin-top: 0.6rem;">
            Slam Gombas for bonus energy.
            Don't slam the Spikers.
            Blast on-beat to shred everything.
            </p>
          </template>
        </div>
      </div>


    </div>

    <p class="controls">
    Controls:
    <kbd>{{ keyLabel(keybinds.jump) }}</kbd> Jump ·
    <kbd>{{ keyLabel(keybinds.slam) }}</kbd> Slam ·
    <kbd>{{ keyLabel(keybinds.antigrav) }}</kbd> Antigrav ·
    <kbd>{{ keyLabel(keybinds.slowmo) }}</kbd> Slow-Mo ·
    <kbd>{{ keyLabel(keybinds.blast) }}</kbd> Blast ·
    <kbd>{{ keyLabel(keybinds.phase) }}</kbd> Phase Shift ·
    <kbd>{{ keyLabel(keybinds.parry) }}</kbd> Parry
    </p>

    <section class="keybinds-panel">
      <header class="keybinds-header">
        <h3>Keybinds</h3>
        <p>Click a field, then press the key you want to use.</p>
      </header>
      <div class="keybinds-grid">
        <div
          v-for="action in keybindOptions"
          :key="action.id"
          class="keybind-row"
        >
          <span class="keybind-label">{{ action.label }}</span>
          <input
            class="keybind-input"
            type="text"
            :value="keyLabel(keybinds[action.id])"
            readonly
            @click="editingKey = action.id"
            @focus="editingKey = action.id"
            @blur="editingKey = null"
            @keydown.prevent="setKeybind(action.id, $event)"
            :placeholder="editingKey === action.id ? 'Press a key' : ''"
          />
          <span
            class="keybind-editing"
            v-if="editingKey === action.id"
          >
            Listening…
          </span>
        </div>
      </div>
    </section>

    <section class="access-panel">
      <header class="keybinds-header">
        <h3>Accessibility</h3>
        <p>Personalize visuals and timing.</p>
      </header>
      <div class="access-grid">
        <label class="toggle-row">
          <input type="checkbox" v-model="colorblindMode" />
          <span>High-contrast palette</span>
        </label>
        <label class="slider-row">
          <span>Beat window</span>
          <div class="slider-wrap">
            <input
              type="range"
              min="40"
              max="160"
              step="5"
              v-model.number="beatWindowMs"
            />
            <span class="slider-value">{{ Math.round(beatWindowMs) }} ms</span>
          </div>
        </label>
      </div>
    </section>
  </div>
</template>


<script setup>
import { reactive, ref, onMounted, onUnmounted } from 'vue'

const canvas = ref(null)

const score = ref(0)
const baseScore = ref(0)
const bonusScore = ref(0)
const speed = ref(1)
const gameOver = ref(false)
const started = ref(false)
const beatPulse = ref(false)
const bpm = ref(120)
const charge = ref(0) // 0–100 power meter
const dashReady = ref(false)
const phaseReady = ref(false)
const phaseCooldown = ref(0)
const countdownTimer = ref(0)
const beatWindowMs = ref(90)
const colorblindMode = ref(false)

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
let lastSubBeatTime = 0
let beatIndex = 0
let audioCtx = null
let analyser = null
let freqData = null
let timeData = null
let bassEnergy = 0
let midEnergy = 0
let highEnergy = 0
let obstacleSpawnIntervalId
let rotation = 0
let isSlamming = false
let jumpStartY = 0
let jumpApexY = 0
let enemies = []
let shockwaves = []
let scorePops = []
let sonicBursts = []
let hatBursts = []
let deathByEnemy = false
let playerFragments = []
let dashActive = false
let dashTimer = 0
let phaseActive = false
let phaseTimer = 0
let phaseModeIndex = 0
let phaseMode = 'terrain'
let lastEnemySpawnBeat = -2
let lastObstacleSpawnBeat = -2
let invulnTimer = 0
let graceUsed = false
let cameraShake = 0
let airJumps = 1
let beatStreak = 0
let scoreMultiplier = 1
let lastBeatActionTime = 0
let dashGhosts = []
let deathSlowTimer = 0
const keybindOptions = [
  { id: 'jump', label: 'Jump' },
  { id: 'slam', label: 'Slam' },
  { id: 'antigrav', label: 'Antigrav' },
  { id: 'slowmo', label: 'Slow-Mo' },
  { id: 'blast', label: 'Beat Blast' },
  { id: 'phase', label: 'Phase Shift' },
  { id: 'parry', label: 'Beat Parry' },
]
const defaultKeybinds = {
  jump: ['Space'],
  slam: ['ShiftLeft', 'ShiftRight'],
  antigrav: ['ArrowUp'],
  slowmo: ['ArrowDown'],
  blast: ['ArrowRight'],
  phase: ['ArrowLeft'],
  parry: ['KeyE'],
}
const keybinds = reactive({ ...defaultKeybinds })
const editingKey = ref(null)

// global song energy (0–1)
let songIntensity = 0

// power state
let hangActive = false
let slowActive = false
const DASH_WINDOW_MS = 110
const DASH_DURATION = 0.24
const DASH_RANGE = 200
const DASH_COST = 16
const PHASE_DURATION = 10
const PHASE_COST = 20
const PHASE_COOLDOWN = 20
const DOUBLE_JUMP_COST = 10
const PARRY_COST = 6
const MAX_MULTIPLIER = 3
const CHARGE_DRAIN_RATE = 30
const CHARGE_REGEN_GROUND = 40
const CHARGE_REGEN_AIR = 30
const DEFAULT_TRACK = '/audio/clarity.mp3'
const PHASE_STATES = ['terrain', 'gomba', 'spiker', 'floater']
const DEFAULT_PALETTE = {
  stripe: '#0f172a',
  ground: '#111827',
  beat: '#22d3ee',
  visBar: 'rgb(34, 211, 238)',
  visWave: 'rgba(250, 204, 21, 0.7)',
  obstacle: '#38bdf8',
  obstacleGlow: '#f97316',
  player: '#22c55e',
  stroke: '#22c55e',
  bgBase: [2, 6, 23],
}
const PHASE_PALETTES = {
  terrain: {
    stripe: '#1f172a',
    ground: '#0b1224',
    beat: '#a855f7',
    visBar: 'rgb(168, 85, 247)',
    visWave: 'rgba(239, 68, 68, 0.7)',
    obstacle: '#a855f7',
    obstacleGlow: '#fb7185',
    player: '#c084fc',
    stroke: '#c084fc',
    bgBase: [40, 6, 48],
  },
  gomba: {
    stripe: '#2a1410',
    ground: '#1a0f0b',
    beat: '#f97316',
    visBar: 'rgb(251, 146, 60)',
    visWave: 'rgba(252, 211, 77, 0.8)',
    obstacle: '#fb923c',
    obstacleGlow: '#facc15',
    player: '#f97316',
    stroke: '#facc15',
    bgBase: [60, 12, 6],
  },
  spiker: {
    stripe: '#0c1e26',
    ground: '#0b2430',
    beat: '#38bdf8',
    visBar: 'rgb(56, 189, 248)',
    visWave: 'rgba(56, 189, 248, 0.7)',
    obstacle: '#38bdf8',
    obstacleGlow: '#22d3ee',
    player: '#0ea5e9',
    stroke: '#38bdf8',
    bgBase: [8, 20, 48],
  },
  floater: {
    stripe: '#10202c',
    ground: '#0a1b26',
    beat: '#22d3ee',
    visBar: 'rgb(103, 232, 249)',
    visWave: 'rgba(59, 130, 246, 0.7)',
    obstacle: '#67e8f9',
    obstacleGlow: '#a855f7',
    player: '#67e8f9',
    stroke: '#a855f7',
    bgBase: [14, 24, 52],
  },
}

function normalizeBind(bind) {
  if (!bind) return []
  return Array.isArray(bind) ? bind : [bind]
}

function keyLabel(bind) {
  const key = normalizeBind(bind)[0]
  if (!key) return ''

  const map = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: 'Space',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
  }

  return map[key] ?? key
}

function getPalette(pulse) {
  const energyHue = Math.round(20 + songIntensity * 120)
  const phaseHue = phaseActive ? 30 + phaseModeIndex * 40 : 0
  const hue = energyHue + phaseHue

  const baseDefault = colorblindMode.value
    ? {
        ...DEFAULT_PALETTE,
        beat: '#fbbf24',
        visBar: 'rgb(251, 191, 36)',
        visWave: 'rgba(59, 130, 246, 0.7)',
        obstacle: '#0ea5e9',
        obstacleGlow: '#f97316',
        player: '#e879f9',
        stroke: '#e879f9',
      }
    : DEFAULT_PALETTE
  const basePhase = colorblindMode.value
    ? {
        ...PHASE_PALETTES[phaseMode] || PHASE_PALETTES.terrain,
        beat: '#fbbf24',
      }
    : PHASE_PALETTES[phaseMode] || PHASE_PALETTES.terrain

  const base = phaseActive ? basePhase : baseDefault
  const [r, g, b] = base.bgBase

  return {
    ...base,
    bg: `rgb(${r + pulse}, ${g}, ${b})`,
    skyStops: [
      `hsl(${hue}, 65%, 16%)`,
      `hsl(${hue + 24}, 70%, 12%)`,
    ],
  }
}

function withAlpha(rgb, alpha) {
  if (rgb.startsWith('rgb(')) {
    return rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
  }
  if (rgb.startsWith('rgba(')) {
    return rgb.replace(/rgba\(([^)]+)\)/, (m, inner) => {
      const parts = inner.split(',').map(p => p.trim())
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`
    })
  }
  return rgb
}

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
function isOnBeat(windowMs = beatWindowMs.value) {
  if (!audioStarted) return false
  const beatMs = 60000 / bpm.value
  const now = performance.now()
  const distToCurrent = Math.abs(now - lastBeatTime)
  const distToNext = Math.abs((lastBeatTime + beatMs) - now)
  return Math.min(distToCurrent, distToNext) <= windowMs
}
function registerBeatAction(onBeat) {
  if (onBeat) {
    beatStreak += 1
    scoreMultiplier = clamp(1 + beatStreak * 0.25, 1, MAX_MULTIPLIER)
    lastBeatActionTime = performance.now()
  } else {
    beatStreak = Math.max(0, beatStreak - 1)
    scoreMultiplier = clamp(1 + beatStreak * 0.25, 1, MAX_MULTIPLIER)
  }
}
function usePhaseMode() {
  phaseMode = PHASE_STATES[phaseModeIndex]
  phaseModeIndex = (phaseModeIndex + 1) % PHASE_STATES.length
  return phaseMode
}
function syncScore() {
  score.value = baseScore.value + bonusScore.value
}
function addBonus(points) {
  bonusScore.value += points * scoreMultiplier
  syncScore()
}
function addBase(points) {
  baseScore.value += points * scoreMultiplier
  syncScore()
}

function resetGame() {
  score.value = 0
  baseScore.value = 0
  bonusScore.value = 0
  speed.value = 1
  gameOver.value = false
  started.value = false
  charge.value = 50
  deathByEnemy = false

  phaseActive = false
  phaseTimer = 0
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
  dashActive = false
  dashTimer = 0
  dashReady.value = false
  phaseReady.value = false
  phaseCooldown.value = 0
  phaseModeIndex = 0
  phaseMode = PHASE_STATES[phaseModeIndex]
  invulnTimer = 0
  graceUsed = false
  airJumps = 1
  beatStreak = 0
  scoreMultiplier = 1
  lastBeatActionTime = 0
  dashGhosts = []
  deathSlowTimer = 0
}

async function configureAudio(trackUrl, getArrayBuffer) {
  if (audio) {
    try { audio.pause() } catch (_) {}
  }

  audio = new Audio(trackUrl)
  audio.crossOrigin = 'anonymous'
  audio.loop = true

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

  const slapDelay = audioCtx.createDelay(0.5)
  slapDelay.delayTime.value = 0.14

  const slapFeedback = audioCtx.createGain()
  slapFeedback.gain.value = 0.32

  const slapMix = audioCtx.createGain()
  slapMix.gain.value = 0

  slapDelay.connect(slapFeedback)
  slapFeedback.connect(slapDelay)
  slapDelay.connect(slapMix)

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

  compressor.connect(slapDelay)
  slapMix.connect(analyser)

  // store refs
  audio._dryGain = dryGain
  audio._wetGain = wetGain
  audio._drive = drive
  audio._compressor = compressor
  audio._slapMix = slapMix

  analyser.connect(audioCtx.destination)

  try {
    if (getArrayBuffer) {
      const arrayBuffer = await getArrayBuffer()
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer)
      detectedBpm = detectBPMFromBuffer(decodedBuffer)
      bpm.value = detectedBpm
      console.log('✅ Decoded BPM:', detectedBpm)
    }
  } catch (err) {
    console.warn('BPM detect failed, using default 120', err)
    bpm.value = 120
  }

  audioStarted = false
}

async function handleAudioUpload(e) {
  const file = e.target.files[0]
  if (!file) return

  const url = URL.createObjectURL(file)
  await configureAudio(url, () => file.arrayBuffer())
}

async function loadDefaultAudio() {
  try {
    await configureAudio(DEFAULT_TRACK, async () => {
      const res = await fetch(DEFAULT_TRACK)
      if (!res.ok) throw new Error('failed fetch default track')
      return res.arrayBuffer()
    })
  } catch (err) {
    console.warn('Default track unavailable, waiting for user upload.', err)
  }
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

  if (type === 'gomba') {
    enemy = {
      type: 'gomba',
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

  if (enemy) {
    enemies.push(enemy)
    return enemy
  }
  return null
}

function pickEnemyByEnergy() {
  const weights = [
    { type: 'gomba', weight: 0.35 + Math.max(0, bassEnergy - 0.25) * 2.6 },
    { type: 'spiker', weight: 0.35 + Math.max(0, midEnergy - 0.25) * 2.2 },
    { type: 'floater', weight: 0.25 + Math.max(0, highEnergy - 0.2) * 2.4 },
  ]

  const total = weights.reduce((sum, w) => sum + w.weight, 0)
  if (total < 0.45) return null

  let roll = Math.random() * total
  for (const w of weights) {
    roll -= w.weight
    if (roll <= 0) return w.type
  }
  return weights[0].type
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

function spawnTelegraphedEnemy(type) {
  const e = spawnEnemy(type)
  if (e) {
    e.telegraph = 0.5
  }
}

function spawnFormation(kind) {
  const spacing = 90
  if (kind === 'triple-line') {
    const types = ['gomba', 'spiker', 'gomba']
    types.forEach((t, i) => {
      const e = spawnEnemy(t)
      if (e) e.x += i * spacing
    })
  } else if (kind === 'aerial') {
    ['floater', 'floater'].forEach((t, i) => {
      const e = spawnEnemy(t)
      if (e) {
        e.x += i * (spacing + 30)
        e.y -= 30 * i + 20
      }
    })
  } else if (kind === 'stagger') {
    const types = ['gomba', 'spiker', 'floater']
    types.forEach((t, i) => {
      const e = spawnEnemy(t)
      if (e) e.x += i * (spacing + 20)
    })
  }
}

function spawnBeatDrivenEntities(isSubBeat, beatMs) {
  const beatsSinceEnemy = beatIndex - lastEnemySpawnBeat
  const beatsSinceObstacle = beatIndex - lastObstacleSpawnBeat

  const intensity = clamp(songIntensity, 0, 1)
  const spawnChance = isSubBeat
    ? 0.1 + intensity * 0.25
    : 0.2 + intensity * 0.35

  const formationChance = !isSubBeat && intensity > 0.35 ? 0.15 : 0
  if (!isSubBeat && Math.random() < formationChance && beatsSinceEnemy >= 1.5) {
    const form = intensity > 0.6 ? 'stagger' : 'triple-line'
    spawnFormation(form)
    lastEnemySpawnBeat = beatIndex + 1
  } else if (beatsSinceEnemy >= (isSubBeat ? 0.5 : 1) && Math.random() < spawnChance) {
    const type = pickEnemyByEnergy()
    if (type) {
      if (!isSubBeat && intensity > 0.6 && Math.random() < 0.25) {
        spawnTelegraphedEnemy(type)
      } else {
        spawnEnemy(type)
      }
      lastEnemySpawnBeat = beatIndex + (isSubBeat ? 0.5 : 0)
    }
  }

  const obstacleChance = 0.12 + intensity * 0.28 + highEnergy * 0.18
  if (!isSubBeat && beatsSinceObstacle >= 1.5 && Math.random() < obstacleChance) {
    spawnObstacle()
    lastObstacleSpawnBeat = beatIndex
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
  ctx.fillText(`${keyLabel(keybinds.antigrav)} ANTIGRAV`, pad, pad + 28)

  ctx.fillStyle = slowActive ? '#38bdf8' : '#64748b'
  ctx.fillText(`${keyLabel(keybinds.slowmo)} SLOW-MO`, pad + 80, pad + 28)
  ctx.fillStyle = dashActive ? '#fb7185' : dashReady.value ? '#f472b6' : '#64748b'
  ctx.fillText(`${keyLabel(keybinds.blast)} BLAST`, pad + 160, pad + 28)

  ctx.fillStyle = phaseActive ? '#c084fc' : phaseReady.value ? '#a855f7' : '#475569'
  ctx.fillText(`${keyLabel(keybinds.phase)} PHASE SHIFT`, pad + 240, pad + 28)
  ctx.fillStyle = scoreMultiplier > 1 ? '#fcd34d' : '#94a3b8'
  ctx.fillText(`x${scoreMultiplier.toFixed(2)} MULT`, pad + 380, pad + 28)
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
  try {
    await audio.play()
  } catch (err) {
    console.warn('Autoplay blocked, waiting for interaction', err)
    return
  }
  audioStarted = true
  lastBeatTime = performance.now()
  lastSubBeatTime = lastBeatTime
  beatIndex = 0
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
  if (!started.value && countdownTimer.value <= 0 && !gameOver.value) {
    countdownTimer.value = 2.5
  }
  if (countdownTimer.value > 0 && !started.value) return
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
    airJumps = 1
    registerBeatAction(isOnBeat())
  } else if (airJumps > 0 && charge.value >= DOUBLE_JUMP_COST) {
    consumeCharge(DOUBLE_JUMP_COST)
    player.vy = jumpVelocity * 0.85
    isSlamming = false
    rotation = 0
    airJumps -= 1
    sonicBursts.push({
      x: player.x + player.width / 2,
      y: player.y + player.height / 2,
      r: 0,
      alpha: 0.8,
    })
    registerBeatAction(isOnBeat(90))
  }
}

function handleSlam() {
  startAudio()
  if (!started.value && countdownTimer.value <= 0 && !gameOver.value) {
    countdownTimer.value = 2.5
  }
  if (countdownTimer.value > 0 && !started.value) return
  if (!player.onGround && !isSlamming && !gameOver.value) {
    isSlamming = true
    player.vy = 2000 // aggressive downward force
  }
}

function handlePhase() {
  startAudio()
  if (gameOver.value) return
  if (!started.value && countdownTimer.value <= 0 && !gameOver.value) {
    countdownTimer.value = 2.5
  }
  if (countdownTimer.value > 0 && !started.value) return
  if (charge.value < PHASE_COST || phaseActive || phaseCooldown.value > 0) return
  if (!started.value) started.value = true

  phaseActive = true
  phaseTimer = PHASE_DURATION
  consumeCharge(PHASE_COST)
  usePhaseMode()

  if (audio && audio._slapMix) {
    audio._slapMix.gain.value = 0.9
  }

  sonicBursts.push({
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
    r: 0,
    alpha: 1,
  })
}

function handleBlast() {
  startAudio()
  if (gameOver.value) return
  if (!started.value && countdownTimer.value <= 0 && !gameOver.value) {
    countdownTimer.value = 2.5
  }
  if (countdownTimer.value > 0 && !started.value) return
  if (!started.value) {
    started.value = true
  }

  const beatMs = 60000 / bpm.value
  const now = performance.now()
  const beatDist = lastBeatTime
    ? Math.min(Math.abs(now - lastBeatTime), Math.abs(lastBeatTime + beatMs - now))
    : Infinity

  if (countdownTimer.value > 0) {
    countdownTimer.value = Math.max(0, countdownTimer.value - dtRaw)
    if (countdownTimer.value === 0) {
      started.value = true
    }
  }
  const onTime = beatDist < DASH_WINDOW_MS

  if (onTime && charge.value >= DASH_COST && !dashActive) {
    consumeCharge(DASH_COST)
    dashActive = true
    dashTimer = DASH_DURATION
    isSlamming = false
    registerBeatAction(true)

    sonicBursts.push({
      x: player.x + player.width / 2,
      y: player.y + player.height / 2,
      r: 0,
      alpha: 0.7,
    })
  } else if (charge.value > 0) {
    consumeCharge(4)
    registerBeatAction(false)
  }
}

function handleParry() {
  startAudio()
  if (gameOver.value) return
  if (!started.value && countdownTimer.value <= 0 && !gameOver.value) {
    countdownTimer.value = 2.5
  }
  if (countdownTimer.value > 0 && !started.value) return
  if (!started.value) started.value = true

  const onBeat = isOnBeat(70)
  if (!onBeat && charge.value < PARRY_COST) return

  if (onBeat) {
    addCharge(8)
  } else {
    consumeCharge(PARRY_COST)
  }

  invulnTimer = Math.max(invulnTimer, 0.9)
  registerBeatAction(onBeat)

  const radius = 140
  enemies = enemies.map(e => {
    const cx = e.x + e.width / 2
    const cy = e.y + e.height / 2
    const dx = cx - (player.x + player.width / 2)
    const dy = cy - (player.y + player.height / 2)
    const dist = Math.hypot(dx, dy)
    if (dist < radius && e.alive && !e.squished) {
      addBonus(120)
      return { ...e, squished: true, alive: false, squishTimer: 0.12, currentHeight: e.height }
    }
    return e
  })

  sonicBursts.push({
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
    r: radius / 2,
    alpha: 1,
  })
}

function applyBlastStrikes() {
  const hitLeft = player.x
  const hitRight = player.x + player.width + DASH_RANGE
  const hitTop = player.y - 6
  const hitBottom = player.y + player.height + 6
  let hitSomething = false

  obstacles = obstacles.filter(o => {
    const overlaps = o.x < hitRight && o.x + o.width > hitLeft &&
      o.y < hitBottom && o.y + o.height > hitTop
    if (overlaps) {
      hitSomething = true
      addBonus(120)
      addCharge(6)
      sonicBursts.push({
        x: o.x + o.width / 2,
        y: o.y + o.height / 2,
        r: 0,
        alpha: 0.8,
      })
      scorePops.push({
        x: o.x + o.width / 2,
        y: o.y - 10,
        value: 120,
        alpha: 1,
        vy: -90,
      })
      return false
    }
    return true
  })

  for (const e of enemies) {
    if (!e.alive || e.squished) continue
    const overlaps = e.x < hitRight && e.x + e.width > hitLeft &&
      e.y < hitBottom && e.y + e.height > hitTop

    if (overlaps) {
      hitSomething = true
      e.alive = false
      e.squished = true
      e.squishTimer = 0.18
      e.currentHeight = e.height

      const points =
        e.type === 'floater' ? 450 :
        e.type === 'spiker' ? 320 :
        250

      addBonus(points)
      addCharge(12)

      sonicBursts.push({
        x: e.x + e.width / 2,
        y: e.y + e.height / 2,
        r: 0,
        alpha: 0.9,
      })

      scorePops.push({
        x: e.x + e.width / 2,
        y: e.y,
        value: points,
        alpha: 1,
        vy: -90,
      })
    }
  }

  if (hitSomething) {
    shockwaves.push({
      x: player.x + player.width / 2 + 40,
      y: player.y + player.height / 2,
      r: 20,
      alpha: 0.5,
    })
  }
}

function update(dtRaw) {
  // Determine power intents before time scaling
  const dt = dtRaw
  const beatMs = 60000 / bpm.value
  const now = performance.now()
  const beatDist = lastBeatTime
    ? Math.min(Math.abs(now - lastBeatTime), Math.abs(lastBeatTime + beatMs - now))
    : Infinity

  dashReady.value = !gameOver.value && !dashActive && charge.value >= DASH_COST && beatDist < DASH_WINDOW_MS
  phaseReady.value = !gameOver.value && !phaseActive && charge.value >= PHASE_COST && phaseCooldown.value <= 0

  if (dashActive) {
    dashTimer -= dtRaw
    if (dashTimer <= 0) {
      dashActive = false
    } else {
      applyBlastStrikes()
      dashGhosts.push({
        x: player.x,
        y: player.y,
        w: player.width,
        h: player.height,
        alpha: 0.45,
      })
      dashGhosts = dashGhosts.slice(-10)
    }
  }

  if (phaseActive) {
    phaseTimer -= dtRaw
    if (phaseTimer <= 0) {
      phaseActive = false
      phaseCooldown.value = PHASE_COOLDOWN
      if (audio && audio._slapMix) {
        audio._slapMix.gain.value = 0
      }
    } else if (audio && audio._slapMix) {
      const wobble = (Math.sin(now * 0.002) + 1) * 0.35
      audio._slapMix.gain.value = 0.6 + wobble * 0.4
    }
  }
  if (phaseCooldown.value > 0 && !phaseActive) {
    phaseCooldown.value = Math.max(0, phaseCooldown.value - dtRaw)
  }
  if (invulnTimer > 0) {
    invulnTimer = Math.max(0, invulnTimer - dtRaw)
  }

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

  if (audio && audio._slapMix && !phaseActive) {
    audio._slapMix.gain.value = 0
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
    const phase = (performance.now() % beatMs) / beatMs
    const tremolo = 0.85 + Math.sin(phase * Math.PI * 2) * 0.15
    audio.volume = tremolo
  } else if (audio) {
    audio.volume = 1
  }

  const beatPhase = (now - lastBeatTime) / beatMs
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

  // Camera shake & hat bursts
  cameraShake = lerp(cameraShake, 0, 0.08)
  if (beatPulse.value && bassEnergy > 0.45) {
    cameraShake = Math.min(12, cameraShake + bassEnergy * 4)
  }

  if (beatPulse.value && highEnergy > 0.45) {
    const count = 4 + Math.floor(highEnergy * 6)
    for (let i = 0; i < count; i++) {
      hatBursts.push({
        x: Math.random() * width,
        y: groundY - 100 - Math.random() * 120,
        r: 4 + Math.random() * 8,
        alpha: 0.9,
        vy: -40 - Math.random() * 30,
      })
    }
  }

  if (beatStreak > 0 && performance.now() - lastBeatActionTime > 4000) {
    beatStreak = 0
    scoreMultiplier = 1
  }

  // === CHARGE SYSTEM ===

  if (hangActive || slowActive) {
    charge.value -= CHARGE_DRAIN_RATE * dtRaw
  } else if (player.onGround) {
    charge.value += CHARGE_REGEN_GROUND * dtRaw
  } else {
    charge.value += CHARGE_REGEN_AIR * dtRaw
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

  // Beat-quantized spawning & pulse
  if (audioStarted) {
    const subBeatMs = beatMs / 2

    while (now - lastBeatTime >= beatMs) {
      lastBeatTime += beatMs
      beatIndex += 1
      beatPulse.value = true

      setTimeout(() => {
        beatPulse.value = false
      }, 90)

      if (started.value && !gameOver.value) {
        spawnBeatDrivenEntities(false, beatMs)
      }
    }

    while (now - lastSubBeatTime >= subBeatMs) {
      lastSubBeatTime += subBeatMs
      if (started.value && !gameOver.value) {
        spawnBeatDrivenEntities(true, beatMs)
      }
    }
  }


  // Score + speed ramp (bonus during slow-mo)
  const baseGain = scrollSpeed * 0.02 * dt * (0.6 + songIntensity) * (slowActive ? 1.1 : 1)
  if (started.value && !gameOver.value) {
    addBase(baseGain)
  }
  const speedFactor = 1 + score.value / 8000
  speed.value = speedFactor
  scrollSpeed = baseScrollSpeed * speedFactor

  if (deathSlowTimer > 0) {
    deathSlowTimer = Math.max(0, deathSlowTimer - dtRaw)
  }

  const deathScale = deathSlowTimer > 0 ? 0.35 : 1
  const timeScale = (slowActive ? 0.45 : 1) * deathScale

  const effectiveGravity = hangActive ? gravity * 0.035 : gravity


  player.vy += (isSlamming ? effectiveGravity * 2.5 : effectiveGravity) * dtRaw * timeScale
  player.y += player.vy * dtRaw * timeScale

  scrollSpeed = baseScrollSpeed * speed.value * timeScale

  if (player.y < jumpApexY) {
    jumpApexY = player.y
  }

  // Move enemies
  for (const e of enemies) {
    if (e.telegraph && e.telegraph > 0) {
      e.telegraph -= dt
      continue
    }
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
  const pad = 6
  const playerHitbox = {
    x: player.x + pad,
    y: player.y + pad,
    w: player.width - pad * 2,
    h: player.height - pad * 2,
  }

  for (const e of enemies) {
    if (phaseActive && phaseMode === e.type) continue
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
      if (e.type === 'gomba' && isSlamming && e.alive && !e.squished) {
        // slam kill
        e.squished = true
        e.alive = false
        e.squishTimer = 0.18
        e.currentHeight = e.height
        addBonus(250)
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
          addBonus(enraged ? 500 : 400)
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
        if (!graceUsed) {
          graceUsed = true
          invulnTimer = 1.5
          consumeCharge(12)
          sonicBursts.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            r: 0,
            alpha: 0.8,
          })
        } else if (invulnTimer <= 0) {
          gameOver.value = true
          deathByEnemy = true
          deathSlowTimer = 0.9
        }
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
    airJumps = 1

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
  obstacles = obstacles.filter(o => o.x + o.width > 0 && !o._destroy)

  // Hat particles
  hatBursts = hatBursts
    .map(p => ({
      ...p,
      y: p.y + p.vy * dt,
      r: p.r * 0.985,
      alpha: p.alpha - dt * 0.9,
    }))
    .filter(p => p.alpha > 0.05)

  // Directional block collision
  for (const o of obstacles) {
    const ox = o.x + pad
    const oy = o.y + pad
    const ow = o.width - pad * 2
    const oh = o.height - pad * 2

    if (phaseActive && phaseMode === 'terrain') {
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
        // Side impact = lethal unless dashing or phased
        if (dashActive) {
          o._destroy = true
          addBonus(150)
          addCharge(10)
          sonicBursts.push({
            x: o.x + o.width / 2,
            y: o.y + o.height / 2,
            r: 0,
            alpha: 0.8,
          })
        } else if (phaseActive) {
          // phase lets you ghost through terrain
          o._destroy = true
        } else {
          if (!graceUsed) {
            graceUsed = true
            invulnTimer = 1.5
            consumeCharge(10)
            sonicBursts.push({
              x: player.x + player.width / 2,
              y: player.y + player.height / 2,
              r: 0,
              alpha: 0.7,
            })
          } else if (invulnTimer <= 0) {
            gameOver.value = true
            deathByEnemy = true
            deathSlowTimer = 0.9
          }
        }
      }
    }
  }

  // Clean up dashed obstacles
  obstacles = obstacles.filter(o => !o._destroy)
}

function draw() {
  ctx.clearRect(0, 0, width, height)

  const pulse = 20 + bassEnergy * 80
  const palette = getPalette(pulse)

  ctx.save()
  if (cameraShake > 0.05) {
    ctx.translate(
      (Math.random() - 0.5) * cameraShake,
      (Math.random() - 0.5) * cameraShake
    )
  }

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, width, height * 0.6)
  skyGrad.addColorStop(0, palette.skyStops ? palette.skyStops[0] : palette.bg)
  skyGrad.addColorStop(1, palette.skyStops ? palette.skyStops[1] : palette.bg)
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, width, height)

  // Parallax stripes
  ctx.save()
  ctx.globalAlpha = phaseActive ? 0.2 : 0.12
  ctx.fillStyle = palette.stripe
  const stripeHeight = 32
  for (let y = 0; y < height; y += stripeHeight) {
    ctx.fillRect(0, y, width, stripeHeight - 8)
  }
  ctx.restore()

  // Ground
  ctx.fillStyle = palette.ground
  ctx.fillRect(0, groundY, width, height - groundY)

  // Beat line
  ctx.save()
  ctx.globalAlpha = beatPulse.value ? 0.7 : 0.25
  ctx.strokeStyle = palette.beat
  ctx.lineWidth = 3
  ctx.setLineDash(beatPulse.value ? [8, 6] : [2, 10])
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.lineTo(width, groundY)
  ctx.stroke()
  ctx.restore()

  // Hat sparkle bursts
  for (const p of hatBursts) {
    ctx.save()
    ctx.globalAlpha = p.alpha
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
    grad.addColorStop(0, withAlpha(palette.visWave, 0.9))
    grad.addColorStop(1, withAlpha(palette.visBar, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  if (dashActive) {
    ctx.save()
    const beamWidth = player.width + DASH_RANGE
    const beamHeight = player.height + 20
    const beamY = player.y - 10
    const gradient = ctx.createLinearGradient(player.x, 0, player.x + beamWidth, 0)
    gradient.addColorStop(0, 'rgba(251, 113, 133, 0.5)')
    gradient.addColorStop(0.35, 'rgba(244, 114, 182, 0.55)')
    gradient.addColorStop(0.75, 'rgba(125, 211, 252, 0.65)')
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.4)')

    ctx.fillStyle = gradient
    ctx.shadowColor = '#f472b6'
    ctx.shadowBlur = 24
    ctx.fillRect(player.x, beamY, beamWidth, beamHeight)

    ctx.shadowBlur = 0
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = '#f8fafc'
    ctx.lineWidth = 2
    const stripeCount = 6
    const t = performance.now() * 0.012
    for (let i = 0; i < stripeCount; i++) {
      const y = beamY + (beamHeight / stripeCount) * i + ((t + i * 7) % (beamHeight / stripeCount))
      ctx.beginPath()
      ctx.moveTo(player.x, y)
      ctx.lineTo(player.x + beamWidth, y - 8)
      ctx.stroke()
    }

    ctx.restore()
  }

  // Dash ghosts
  for (const g of dashGhosts) {
    ctx.save()
    ctx.globalAlpha = g.alpha
    ctx.fillStyle = 'rgba(251, 113, 133, 0.5)'
    ctx.translate(g.x + g.w / 2, g.y + g.h / 2)
    ctx.scale(1.05, 0.95)
    ctx.fillRect(-g.w / 2, -g.h / 2, g.w, g.h)
    ctx.restore()
    g.alpha *= 0.92
  }
  dashGhosts = dashGhosts.filter(g => g.alpha > 0.05)

  // AUDIO VISUALIZER
  if (analyser && audioStarted) {
    analyser.getByteFrequencyData(freqData)
    analyser.getByteTimeDomainData(timeData)

    const barCount = 32
    const barWidth = width / barCount

    for (let i = 0; i < barCount; i++) {
      const v = freqData[i] / 255
      const barHeight = v * 140

      ctx.fillStyle = withAlpha(palette.visBar, v)
      ctx.fillRect(
        i * barWidth,
        groundY - barHeight,
        barWidth - 2,
        barHeight
      )
    }

    ctx.save()
    ctx.strokeStyle = palette.visWave
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
  const basePlayerColor = palette.player
  const playerColor = dashActive
    ? '#fb7185'
    : gameOver.value && deathByEnemy
    ? 'transparent'
    : gameOver.value
    ? '#f97316'
    : basePlayerColor

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
  ctx.strokeStyle = dashActive ? '#fb7185' : palette.stroke
  ctx.lineWidth = 2
  ctx.strokeRect(player.x, player.y, player.width, player.height)
  ctx.restore()

  // Invulnerability halo
  if (invulnTimer > 0) {
    ctx.save()
    const alpha = 0.3 + 0.25 * Math.sin(performance.now() * 0.01)
    ctx.strokeStyle = `rgba(244, 63, 94, ${alpha})`
    ctx.lineWidth = 3
    ctx.shadowColor = 'rgba(244,63,94,0.6)'
    ctx.shadowBlur = 14
    ctx.strokeRect(
      player.x - 6,
      player.y - 6,
      player.width + 12,
      player.height + 12
    )
    ctx.restore()
  }

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
  ctx.fillStyle = palette.obstacle
  for (const o of obstacles) {
    ctx.fillRect(o.x, o.y, o.width, o.height)
    ctx.save()
    ctx.globalAlpha = 0.7
    ctx.fillStyle = palette.obstacleGlow
    ctx.fillRect(o.x, o.y - 6, o.width, 4)
    ctx.restore()
  }

  // Enemies
  for (const e of enemies) {
    ctx.save()

    const bobY = e.bob || 0
    const squash = e.squash || 1

    if (e.telegraph && e.telegraph > 0) {
      const t = e.telegraph
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(performance.now() * 0.015)
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 3
      ctx.strokeRect(e.x - 4, e.y - 4, e.width + 8, e.height + 8)
      ctx.restore()
      continue
    }

    if (!e.squished) {
      ctx.translate(e.x + e.width / 2, e.y + e.height / 2 + bobY)
      ctx.scale(1 / squash, squash)
      ctx.translate(-e.width / 2, -e.height / 2)

      if (e.type === 'gomba') {
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

  if (phaseActive) {
    ctx.save()
    ctx.globalAlpha = 0.15
    ctx.fillStyle = withAlpha(palette.beat, 0.4)
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }

  if (beatPulse.value) {
    ctx.save()
    const g = ctx.createRadialGradient(player.x + player.width / 2, groundY, 20, player.x + player.width / 2, groundY, 280)
    g.addColorStop(0, withAlpha(palette.visWave, 0.22))
    g.addColorStop(1, withAlpha(palette.visWave, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }

  ctx.restore() // camera shake

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

function setKeybind(action, event) {
  event.preventDefault()
  event.stopPropagation()
  keybinds[action] = [event.code]
  editingKey.value = null
}

function matchesKey(action, code) {
  return normalizeBind(keybinds[action]).includes(code)
}

function handleKeydown(e) {
  // JUMP
  if (matchesKey('jump', e.code)) {
    e.preventDefault()
    handleJump()
  }

  // SLAM
  if (matchesKey('slam', e.code)) {
    e.preventDefault()
    handleSlam()
  }

  // BLAST
  if (matchesKey('blast', e.code)) {
    e.preventDefault()
    handleBlast()
  }

  // PHASE
  if (matchesKey('phase', e.code)) {
    e.preventDefault()
    handlePhase()
  }

  // PARRY
  if (matchesKey('parry', e.code)) {
    e.preventDefault()
    handleParry()
  }

  // HANG
  if (matchesKey('antigrav', e.code)) {
    e.preventDefault()
    hangHeld = true
  }

  // SLOW
  if (matchesKey('slowmo', e.code)) {
    e.preventDefault()
    slowHeld = true
  }
}


function handleKeyup(e) {
  if (matchesKey('antigrav', e.code)) hangHeld = false
  if (matchesKey('slowmo', e.code)) slowHeld = false
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
  loadDefaultAudio()
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

.hud-row {
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
}

.hud-item--stack {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
}

.subvalue {
  font-size: 0.65rem;
  color: #94a3b8;
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

.keybinds-panel {
  margin-top: 1.4rem;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 0.9rem;
  padding: 1rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.keybinds-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.keybinds-header h3 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.keybinds-header p {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.8;
}

.keybinds-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.keybind-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.25);
  padding: 0.6rem 0.75rem;
  border-radius: 0.7rem;
  position: relative;
}

.keybind-label {
  font-size: 0.9rem;
  letter-spacing: 0.02em;
}

.keybind-input {
  width: 120px;
  text-align: center;
  background: #0b1224;
  border: 1px solid rgba(148, 163, 184, 0.45);
  color: #e5e7eb;
  padding: 0.35rem 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
}

.keybind-input:focus {
  outline: 2px solid #38bdf8;
  border-color: transparent;
}

.keybind-editing {
  position: absolute;
  bottom: 0.45rem;
  right: 0.75rem;
  font-size: 0.7rem;
  color: #38bdf8;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.access-panel {
  margin-top: 1rem;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.9rem;
  padding: 1rem;
}

.access-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.85rem;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.95rem;
}

.slider-row {
  display: grid;
  gap: 0.35rem;
  font-size: 0.95rem;
}

.slider-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.slider-value {
  min-width: 60px;
  text-align: right;
  font-size: 0.85rem;
  color: #e5e7eb;
}
</style>
