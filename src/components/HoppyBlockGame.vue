
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
      <div class="hud-item hud-difficulty">
        <span class="label">Difficulty</span>
        <div class="difficulty-toggle">
          <button
            v-for="opt in difficultyOptions"
            :key="opt.id"
            class="difficulty-button"
            :class="{ 'difficulty-button--active': difficulty === opt.id }"
            @click="setDifficulty(opt.id)"
          >
            {{ opt.label }}
          </button>
        </div>
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

      <div
        v-if="snapshotMessageTimer > 0"
        class="replay-toast"
      >
        <div class="replay-title">Tricky!</div>
        <div class="replay-sub">Instant replay captured!</div>
      </div>

      <div
        v-if="replayVisible && replayVideoUrl"
        class="replay-pip"
      >
        <video
          :key="replayPlaybackKey"
          :src="replayVideoUrl"
          class="replay-video"
          autoplay
          muted
          playsinline
        ></video>
      </div>

      <div v-if="gameOver" class="overlay">
        <div class="overlay-card">
          <h2>Game Over</h2>
          <p>Your score: {{ Math.floor(score) }}</p>
          <div class="score-save" v-if="canSaveScore">
            <input
              class="name-input"
              type="text"
              v-model="playerName"
              maxlength="16"
              placeholder="Your name"
            />
            <button class="save-button" @click="saveHighScore">
              Save Score
            </button>
          </div>
          <p class="help">
            Press <kbd>Space</kbd> or click to restart.
          </p>
        </div>
      </div>

      <div v-if="!started && !gameOver" class="overlay">
        <div class="overlay-card" :class="{ 'overlay-card--collapse': introCollapsing }">
          <h2>Hoppy Block</h2>

          <p><kbd>{{ keyLabel(keybinds.jump) }}</kbd> — Jump</p>
          <p><kbd>{{ keyLabel(keybinds.slam) }}</kbd> — Slide / Slam</p>
          <p><kbd>{{ keyLabel(keybinds.antigrav) }}</kbd> — Antigrav</p>
          <p><kbd>{{ keyLabel(keybinds.slowmo) }}</kbd> — Slow-Mo</p>
          <p><kbd>{{ keyLabel(keybinds.blast) }}</kbd> — Beat Blast</p>
          <p><kbd>{{ keyLabel(keybinds.phase) }}</kbd> — Phase Shift</p>
          <p><kbd>{{ keyLabel(keybinds.parry) }}</kbd> — Beat Parry</p>

          <p class="help" style="margin-top: 0.6rem;">
          Slam Gombas for bonus energy.
          Slide clears ground foes.
          Blast on-beat to shred everything.
          </p>
        </div>
      </div>


    </div>

    <div class="controls">
      <div class="controls-row">
        <span class="controls-label">Controls</span>
      </div>
      <div class="controls-row">
        <kbd>{{ keyLabel(keybinds.jump) }}</kbd> Jump
      </div>
      <div class="controls-row">
        <kbd>{{ keyLabel(keybinds.slam) }}</kbd> Slide / Slam
      </div>
      <div class="controls-row">
        <kbd>{{ keyLabel(keybinds.antigrav) }}</kbd> Antigrav ·
        <kbd>{{ keyLabel(keybinds.slowmo) }}</kbd> Slow-Mo
      </div>
      <div class="controls-row">
        <kbd>{{ keyLabel(keybinds.blast) }}</kbd> Blast ·
        <kbd>{{ keyLabel(keybinds.phase) }}</kbd> Phase Shift ·
        <kbd>{{ keyLabel(keybinds.parry) }}</kbd> Parry
      </div>
    </div>

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

    <section class="scoreboard-panel">
      <header class="keybinds-header">
        <h3>High Scores</h3>
        <p>Top 10 runs (local to this browser)</p>
      </header>
      <transition-group name="score-slide" tag="div" class="scoreboard-list">
        <div
          v-for="(entry, idx) in highScores"
          :key="entry.id || entry.name + entry.score + entry.date + idx"
          class="score-row"
          :class="{
            'score-row--placeholder': entry.placeholder,
            'score-row--new': savedCurrentRun && !entry.placeholder && idx === lastSavedIndex
          }"
        >
          <span class="score-rank">#{{ idx + 1 }}</span>
          <span class="score-name">{{ entry.name }}</span>
          <span class="score-value">{{ entry.score }}</span>
          <span class="score-date">{{ entry.date }}</span>
        </div>
        <p v-if="highScores.length === 0" class="score-empty" key="empty">
          No runs yet. Finish a game to record your score.
        </p>
      </transition-group>
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
const introCollapsing = ref(false)
const beatWindowMs = ref(90)
const colorblindMode = ref(false)
const highScores = ref([])
const playerName = ref('Player')
const canSaveScore = ref(false)
const savedCurrentRun = ref(false)
const savingHighScore = ref(false)
const placeholderIndex = ref(null)
const lastSavedIndex = ref(null)
const difficulty = ref('medium')
const difficultyOptions = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
]

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
let dashVelocity = 0
let slideActive = false
let slideTimer = 0
let slideStartX = 0
let slideJumped = false
let slideElapsed = 0
let slideTargetX = 0
let flashTimer = 0
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
let airComboMultiplier = 1
let airComboStreak = 0
let slamOriginY = null
let dashGhosts = []
let deathSlowTimer = 0
let wasGameOver = false
let replayRecorder = null
let replayBuffer = []
let replayStopTimeout = null
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
const snapshotMessageTimer = ref(0)
const replayVideoUrl = ref(null)
const replayVisible = ref(false)
const replayPlaybackKey = ref(0)
const replayVideoUrl = ref(null)
const replayVisible = ref(false)
const replayPlaybackKey = ref(0)

// global song energy (0–1)
let songIntensity = 0

// power state
let hangActive = false
let slowActive = false
const DASH_WINDOW_MS = 110
const DASH_DURATION = 0.24
const DASH_THRUST = 900
const PLAYER_ANCHOR_X = 150
const DASH_RANGE = 200
const DASH_COST = 16
const SLIDE_DURATION = 0.6
const SLIDE_DISTANCE = 150
const SLIDE_CROUCH_DURATION = 0.1
const SLIDE_DASH_DURATION = 0.12
const SLIDE_GLIDE_DURATION = 0.08
const SLIDE_FLIP_DURATION = 0.2
const PHASE_DURATION = 10
const PHASE_COST = 20
const PHASE_COOLDOWN = 20
const DOUBLE_JUMP_COST = 10
const PARRY_COST = 6
const INTENSE_SLAM_HEIGHT = 180
const AIR_COMBO_STEP = 0.35
const AIR_COMBO_MAX = 3.2
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

const DIFFICULTY_PRESETS = {
  easy: { speedMult: 0.9, spawnRate: 0.78, uniformity: 0.85 },
  medium: { speedMult: 1, spawnRate: 1, uniformity: 0.45 },
  hard: { speedMult: 1.15, spawnRate: 1.35, uniformity: 0.15 },
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

  const letterMatch = key.match(/^Key([A-Z])$/)
  if (letterMatch) {
    return letterMatch[1]
  }

  const digitMatch = key.match(/^Digit([0-9])$/)
  if (digitMatch) {
    return digitMatch[1]
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

function getDifficultySettings() {
  return DIFFICULTY_PRESETS[difficulty.value] || DIFFICULTY_PRESETS.medium
}

function applyDifficultySettings() {
  const settings = getDifficultySettings()
  baseScrollSpeed = 380 * settings.speedMult
  scrollSpeed = baseScrollSpeed * speed.value
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
  bonusScore.value += points * scoreMultiplier * airComboMultiplier
  syncScore()
}
function addBase(points) {
  baseScore.value += points * scoreMultiplier
  syncScore()
}
function triggerReplayCapture() {
  if (!canvas.value || typeof MediaRecorder === 'undefined') return

  snapshotMessageTimer.value = 3

  const now = performance.now()
  const startTime = now - 5000
  const recent = replayBuffer.filter(c => c.t >= startTime)
  if (!recent.length) return

  const blob = new Blob(recent.map(r => r.data), { type: recent[0].type || 'video/webm' })
  if (replayVideoUrl.value) URL.revokeObjectURL(replayVideoUrl.value)
  replayVideoUrl.value = URL.createObjectURL(blob)
  replayPlaybackKey.value += 1
  replayVisible.value = true

  setTimeout(() => {
    replayVisible.value = false
    if (replayVideoUrl.value) {
      URL.revokeObjectURL(replayVideoUrl.value)
      replayVideoUrl.value = null
    }
  }, 6000)
}
function triggerSquishBounce(intensity = 1) {
  const airborneBefore = !player.onGround
  const bounceScale = Math.max(0.6, intensity)
  player.vy = jumpVelocity * 0.7 * bounceScale
  player.onGround = false
  player.y = Math.min(player.y, groundY - player.height - 2)

  if (airborneBefore) {
    airComboMultiplier = clamp(
      airComboMultiplier + AIR_COMBO_STEP * bounceScale,
      1,
      AIR_COMBO_MAX
    )
    airComboStreak += 1
    if (airComboStreak >= 3) {
      triggerReplayCapture()
      airComboStreak = 0
    }
  } else {
    airComboMultiplier = 1 + AIR_COMBO_STEP * 0.5
    airComboStreak = 1
  }
}
function loadHighScores() {
  try {
    const raw = localStorage.getItem('hoppy-highscores')
    if (raw) {
      highScores.value = JSON.parse(raw)
    }
    const storedName = localStorage.getItem('hoppy-name')
    if (storedName) playerName.value = storedName
  } catch (err) {
    console.warn('high score load failed', err)
  }
}
function persistHighScores() {
  try {
    localStorage.setItem('hoppy-highscores', JSON.stringify(highScores.value))
  } catch (err) {
    console.warn('high score save failed', err)
  }
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
  applyDifficultySettings()
  lastTimestamp = null
  songIntensity = 0

  player = {
    x: PLAYER_ANCHOR_X,
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
  dashVelocity = 0
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
  airComboMultiplier = 1
  airComboStreak = 0
  lastBeatActionTime = 0
  slamOriginY = null
  dashGhosts = []
  deathSlowTimer = 0
  snapshotMessageTimer.value = 0
  replayVisible.value = false
  if (replayVideoUrl.value) {
    URL.revokeObjectURL(replayVideoUrl.value)
    replayVideoUrl.value = null
  }
  replayBuffer = []
  slideActive = false
  slideTimer = 0
  slideJumped = false
  slideElapsed = 0
  slideTargetX = 0
  flashTimer = 0
  introCollapsing.value = false
  started.value = false
  canSaveScore.value = false
  savedCurrentRun.value = false
  savingHighScore.value = false
  placeholderIndex.value = null
  lastSavedIndex.value = null
  wasGameOver = false
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
  lastBeatTime = performance.now()
  lastSubBeatTime = lastBeatTime
  beatIndex = 0
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
      confident: true,
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
      confident: true,
      spikes: true,
      concerned: false,
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

function pulseEnemiesOnBeat(strength = 1) {
  for (const e of enemies) {
    if (!e.alive || e.squished) continue
    e.squashImpulse = (e.squashImpulse || 0) + 0.35 * strength
    e.beatBob = (e.beatBob || 0) + 8 * strength
    if (e.band === 'high') {
      e.phase = 0
    }
  }
}

function spawnBeatDrivenEntities(isSubBeat, beatMs) {
  const diff = getDifficultySettings()
  const uniformity = diff.uniformity ?? 0.5
  const beatsSinceEnemy = beatIndex - lastEnemySpawnBeat
  const beatsSinceObstacle = beatIndex - lastObstacleSpawnBeat

  const intensity = clamp(songIntensity, 0, 1)
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
    lastEnemySpawnBeat = beatIndex + 1
  } else if (beatsSinceEnemy >= minBeatGap && Math.random() < spawnChance) {
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

  const obstacleNoise = (Math.random() - 0.5) * (1 - uniformity) * 0.25
  const obstacleChance = (0.12 + intensity * 0.28 + highEnergy * 0.18 + obstacleNoise) * diff.spawnRate
  const minObstacleGap = 1 + uniformity * 0.25
  if (!isSubBeat && beatsSinceObstacle >= minObstacleGap && Math.random() < obstacleChance) {
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
  // moved combo readout near intensity meter
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

  ctx.fillStyle = '#fcd34d'
  ctx.fillText(`Combo X${Math.max(1, beatStreak)}`, bpmX, pad + 56)

  ctx.restore()
}
async function startAudio() {
  if (!audio || audioStarted) return

  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume()
  }

  audio.playbackRate = 1.0
  try {
    if (audio.readyState < 2) {
      await new Promise(resolve => {
        const onCanPlay = () => {
          audio.removeEventListener('canplay', onCanPlay)
          resolve()
        }
        audio.addEventListener('canplay', onCanPlay)
      })
    }
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
  if (!started.value && !gameOver.value) {
    beginRun()
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
  if (!started.value && !gameOver.value) {
    beginRun()
  }
  if (player.onGround && !gameOver.value) {
    startSlide()
  } else if (!player.onGround && !isSlamming && !gameOver.value) {
    isSlamming = true
    slamOriginY = player.y
    player.vy = 2000 // aggressive downward force
  }
}

function handlePhase() {
  startAudio()
  if (gameOver.value) return
  if (!started.value && !gameOver.value) {
    beginRun()
  }
  if (charge.value < PHASE_COST || phaseActive || phaseCooldown.value > 0) return

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
  if (!started.value && !gameOver.value) {
    beginRun()
  }

  const beatMs = 60000 / bpm.value
  const now = performance.now()
  const beatDist = lastBeatTime
    ? Math.min(Math.abs(now - lastBeatTime), Math.abs(lastBeatTime + beatMs - now))
    : Infinity

  const onTime = beatDist < DASH_WINDOW_MS

  if (onTime && charge.value >= DASH_COST && !dashActive) {
    consumeCharge(DASH_COST)
    dashActive = true
    dashTimer = DASH_DURATION
    dashVelocity = DASH_THRUST
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
  if (!started.value && !gameOver.value) {
    beginRun()
  }

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
      w: 80,
      h: 12,
      alpha: 0.5,
    })
  }
}

function applySlideStrike() {
  const slideLeft = Math.min(slideStartX, slideStartX + SLIDE_DISTANCE)
  const slideRight = Math.max(slideStartX, slideStartX + SLIDE_DISTANCE)
  const hitTop = groundY - 48
  const hitBottom = groundY + 4

  for (const e of enemies) {
    if (!e.alive || e.squished) continue
    if (e.y + e.height < hitTop || e.y > hitBottom) continue
    const overlaps = e.x < slideRight && e.x + e.width > slideLeft
    if (overlaps) {
      e.alive = false
      e.squished = true
      e.squishTimer = 0.14
      e.currentHeight = e.height
      addBonus(220)
      sonicBursts.push({
        x: e.x + e.width / 2,
        y: e.y + e.height / 2,
        r: 0,
        alpha: 0.75,
      })
    }
  }
}

function update(dtRaw) {
  // Determine power intents before time scaling
  const dt = dtRaw
  const beatMs = 60000 / bpm.value
  const now = performance.now()
  const prevGameOver = wasGameOver
  wasGameOver = gameOver.value
  const beatDist = lastBeatTime
    ? Math.min(Math.abs(now - lastBeatTime), Math.abs(lastBeatTime + beatMs - now))
    : Infinity

  dashReady.value = !gameOver.value && !dashActive && charge.value >= DASH_COST && beatDist < DASH_WINDOW_MS
  phaseReady.value = !gameOver.value && !phaseActive && charge.value >= PHASE_COST && phaseCooldown.value <= 0

  if (dashActive) {
    dashTimer -= dtRaw
    if (dashTimer <= 0) {
      dashActive = false
      dashVelocity = 0
    } else {
      player.x += dashVelocity * dtRaw
      dashVelocity = lerp(dashVelocity, 0, dtRaw * 8)
      const maxLead = PLAYER_ANCHOR_X + 180
      player.x = clamp(player.x, 40, maxLead)
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
  } else if (!slideActive) {
    player.x = lerp(player.x, PLAYER_ANCHOR_X, dtRaw * 3.2)
  }

  if (snapshotMessageTimer.value > 0) {
    snapshotMessageTimer.value = Math.max(0, snapshotMessageTimer.value - dtRaw)
  }

  if (slideActive) {
    slideTimer -= dtRaw
    slideElapsed += dtRaw
    const crouchEnd = SLIDE_CROUCH_DURATION
    const dashEnd = SLIDE_CROUCH_DURATION + SLIDE_DASH_DURATION
    const glideEnd = dashEnd + SLIDE_GLIDE_DURATION
    const flipEnd = glideEnd + SLIDE_FLIP_DURATION

    if (slideElapsed < crouchEnd) {
      player.x = slideStartX
      player.y = groundY - player.height
      player.vy = 0
      rotation = -0.25
    } else if (slideElapsed < dashEnd) {
      const t = clamp((slideElapsed - crouchEnd) / SLIDE_DASH_DURATION, 0, 1)
      const eased = 1 - Math.pow(1 - t, 3) // aggressive ease-out
      player.x = lerp(slideStartX, slideTargetX, eased)
      player.y = groundY - player.height
      player.vy = 0
      rotation = 0.05
      applySlideStrike()
    } else if (slideElapsed < glideEnd) {
      const t = clamp((slideElapsed - dashEnd) / SLIDE_GLIDE_DURATION, 0, 1)
      const eased = 1 - Math.pow(t, 2)
      player.x = lerp(slideTargetX, slideTargetX - 18, 1 - eased)
      player.y = groundY - player.height
      rotation = -0.05
    } else if (slideElapsed < flipEnd) {
      const t = clamp((slideElapsed - glideEnd) / SLIDE_FLIP_DURATION, 0, 1)
      const backX = lerp(slideTargetX, slideStartX, t)
      const lift = Math.sin(t * Math.PI) * (player.height * 0.85)
      player.x = backX
      player.y = groundY - player.height - lift
      if (!slideJumped) {
        player.vy = jumpVelocity * 0.28
        slideJumped = true
      }
      rotation = -t * Math.PI * 2.4
    } else {
      slideActive = false
      slideJumped = false
      player.x = slideStartX
      player.y = groundY - player.height
      player.vy = 0
      player.onGround = true
      rotation = 0
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
  const targetShake = started.value && !gameOver.value
    ? (beatPulse.value ? bassEnergy * 5 : 0) + songIntensity * 1.4
    : 0
  cameraShake = lerp(cameraShake, targetShake, 0.16)

  if (started.value && !gameOver.value && beatPulse.value && highEnergy > 0.6) {
    const count = 2 + Math.floor(highEnergy * 3)
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
    e.squashImpulse = (e.squashImpulse || 0) * 0.86
    e.beatBob = (e.beatBob || 0) * 0.82
    const squashImpulse = e.squashImpulse || 0
    const beatBob = e.beatBob || 0
    e.dancePhase = (e.dancePhase || Math.random() * Math.PI * 2) + dt * 2.4

    const bandEnergy = e.band === 'bass' ? bassEnergy : e.band === 'mid' ? midEnergy : highEnergy
    const groove = Math.sin(e.dancePhase) * 0.08
    const grooveBob = Math.cos(e.dancePhase) * 8 * bandEnergy
    const beatLift = beatPulseStrength * (bandEnergy * (e.band === 'bass' ? 14 : 10))
    const targetSquash = 1 + groove + bandEnergy * 0.2 + squashImpulse
    const targetBob = -(grooveBob + beatBob + beatLift)

    e.squash = lerp(e.squash || 1, targetSquash, 0.22)
    e.bob = lerp(e.bob || 0, targetBob, 0.2)

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
        pulseEnemiesOnBeat(1 + songIntensity * 0.6)
        spawnBeatDrivenEntities(false, beatMs)
      }
    }

    while (now - lastSubBeatTime >= subBeatMs) {
      lastSubBeatTime += subBeatMs
      if (started.value && !gameOver.value) {
        pulseEnemiesOnBeat(0.45 + songIntensity * 0.3)
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
  if (!audioStarted && started.value && !gameOver.value && audio && audio.readyState >= 2) {
    startAudio()
  }

  if (deathSlowTimer > 0) {
    deathSlowTimer = Math.max(0, deathSlowTimer - dtRaw)
  }

  const deathScale = deathSlowTimer > 0 ? 0.35 : 1
  const timeScale = (slowActive ? 0.45 : 1) * deathScale

  const effectiveGravity = hangActive ? gravity * 0.035 : gravity

  const lockSlideOnGround = slideActive && slideElapsed < (SLIDE_CROUCH_DURATION + SLIDE_DASH_DURATION)
  if (!lockSlideOnGround) {
    player.vy += (isSlamming ? effectiveGravity * 2.5 : effectiveGravity) * dtRaw * timeScale
    player.y += player.vy * dtRaw * timeScale
  } else {
    player.vy = 0
    player.y = groundY - player.height
  }

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
      if (e.type === 'spiker' && e.spikes === false && e.alive && !e.squished) {
        e.squished = true
        e.alive = false
        e.squishTimer = 0.18
        e.currentHeight = e.height
        addBonus(280)
        addCharge(10)
        triggerSquishBounce(1.05)

        sonicBursts.push({
          x: e.x + e.width / 2,
          y: e.y + e.height / 2,
          r: 0,
          alpha: 0.8,
        })

        scorePops.push({
          x: e.x + e.width / 2,
          y: e.y,
          value: 280,
          alpha: 1,
          vy: -80,
        })
      } else if (e.type === 'gomba' && isSlamming && e.alive && !e.squished) {
        // slam kill
        e.squished = true
        e.alive = false
        e.squishTimer = 0.18
        e.currentHeight = e.height
        addBonus(250)
        addCharge(12)
        triggerSquishBounce()

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
          triggerSquishBounce(1.1)

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
    s.w = (s.w || 0) + 2000 * dt * (s.intense ? 1.2 : 1)
    s.alpha -= (s.intense ? 2 : 1.8) * dt
  }
  shockwaves = shockwaves.filter(s => s.alpha > 0 && s.w < width * 2)

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
    const landingSlam = isSlamming
    const slamDepth = landingSlam ? groundY - (slamOriginY ?? groundY) : 0
    const intenseSlam = landingSlam && slamDepth > INTENSE_SLAM_HEIGHT
    const slamPower = intenseSlam ? 1.4 : 1

    player.y = groundY - player.height
    player.vy = 0
    player.onGround = true
    airJumps = 1
    airComboMultiplier = 1
    airComboStreak = 0

    if (landingSlam) {
      shockwaves.push({
        x: player.x + player.width / 2,
        y: groundY,
        w: 120 * slamPower,
        h: 18 + (intenseSlam ? 8 : 0),
        alpha: 0.7,
        intense: intenseSlam,
      })

      if (intenseSlam) {
        flashTimer = Math.max(flashTimer, 0.12)
        cameraShake = Math.max(cameraShake, 12)
        sonicBursts.push({
          x: player.x + player.width / 2,
          y: player.y + player.height / 2,
          r: 0,
          alpha: 0.9,
        })

        const slamCenter = player.x + player.width / 2
        const knockRange = 240
        for (const e of enemies) {
          if (e.type !== 'spiker' || !e.alive || e.squished || e.spikes === false) continue
          const ex = e.x + e.width / 2
          if (Math.abs(ex - slamCenter) <= knockRange) {
            e.spikes = false
            e.confident = false
            e.concerned = true
            hatBursts.push({
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

    isSlamming = false
    slamOriginY = null
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
            w: 100,
            h: 14,
            alpha: 0.7,
            intense: true,
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

  if (!prevGameOver && gameOver.value) {
    canSaveScore.value = true
    savedCurrentRun.value = false
  }
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
  const preppingDash = slideActive && slideElapsed < SLIDE_CROUCH_DURATION
  const prepT = preppingDash ? clamp(slideElapsed / SLIDE_CROUCH_DURATION, 0, 1) : 0
  const squishEase = preppingDash ? 1 - Math.pow(1 - prepT, 2) : 0
  const dashSquish = dashActive ? 0.78 : 1
  const dashStretch = dashActive ? 1.18 : 1
  const prepSquishY = preppingDash ? 0.8 + squishEase * 0.08 : 1
  const prepSquishX = preppingDash ? 1.12 + squishEase * 0.05 : 1
  const playerSquishY = prepSquishY * dashSquish
  const playerSquishX = prepSquishX * dashStretch

  ctx.save()
  ctx.translate(
    player.x + player.width / 2,
    player.y + player.height / 2
  )
  ctx.rotate(rotation)
  ctx.scale(playerSquishX, playerSquishY)

  ctx.fillStyle = playerColor
  ctx.fillRect(
    -player.width / 2,
    -player.height / 2,
    player.width,
    player.height
  )

  if (gameOver.value && deathByEnemy) {
    const shardCount = 10
    for (let i = 0; i < shardCount; i++) {
      const angle = (Math.PI * 2 * i) / shardCount
      const len = 26 + Math.random() * 22
      const thickness = 5 + Math.random() * 3
      ctx.save()
      ctx.rotate(angle)
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = thickness
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(len, 0)
      ctx.stroke()
      ctx.restore()
    }

    const pulse = ctx.createRadialGradient(0, 0, 0, 0, 0, 38)
    pulse.addColorStop(0, 'rgba(249, 115, 22, 0.35)')
    pulse.addColorStop(1, 'rgba(249, 115, 22, 0)')
    ctx.fillStyle = pulse
    ctx.fillRect(-40, -40, 80, 80)
  }
  ctx.restore()

  // Player glow
  ctx.save()
  ctx.translate(
    player.x + player.width / 2,
    player.y + player.height / 2
  )
  ctx.rotate(rotation)
  ctx.scale(playerSquishX, playerSquishY)
  ctx.shadowColor = playerColor
  ctx.shadowBlur = 18
  ctx.strokeStyle = dashActive ? '#fb7185' : palette.stroke
  ctx.lineWidth = 2
  ctx.strokeRect(-player.width / 2, -player.height / 2, player.width, player.height)
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
    const halfW = (s.w || 0) / 2
    const h = s.h || 16
    const color = s.intense ? '#fbbf24' : palette.beat
    const grad = ctx.createLinearGradient(s.x - halfW, s.y, s.x + halfW, s.y)
    grad.addColorStop(0, withAlpha(color, 0))
    grad.addColorStop(0.5, withAlpha(color, 0.9))
    grad.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = grad
    ctx.fillRect(s.x - halfW, s.y - h / 2, s.w || 0, h)
    ctx.shadowColor = withAlpha(color, 0.4)
    ctx.shadowBlur = s.intense ? 18 : 10
    ctx.fillRect(s.x - halfW, s.y - h / 2, s.w || 0, h)
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
  for (const o of obstacles) {
    ctx.save()
    const rad = 6
    ctx.fillStyle = palette.obstacle
    ctx.beginPath()
    ctx.moveTo(o.x + rad, o.y)
    ctx.lineTo(o.x + o.width - rad, o.y)
    ctx.quadraticCurveTo(o.x + o.width, o.y, o.x + o.width, o.y + rad)
    ctx.lineTo(o.x + o.width, o.y + o.height - rad)
    ctx.quadraticCurveTo(o.x + o.width, o.y + o.height, o.x + o.width - rad, o.y + o.height)
    ctx.lineTo(o.x + rad, o.y + o.height)
    ctx.quadraticCurveTo(o.x, o.y + o.height, o.x, o.y + o.height - rad)
    ctx.lineTo(o.x, o.y + rad)
    ctx.quadraticCurveTo(o.x, o.y, o.x + rad, o.y)
    ctx.closePath()
    ctx.fill()

    ctx.globalAlpha = 0.35
    ctx.fillStyle = palette.obstacleGlow
    ctx.fillRect(o.x, o.y - 4, o.width, 3)
    ctx.restore()
  }

  const enemyPalettes = {
    gomba: { body: '#fb923c', accent: '#fdba74', face: '#0b1224', blush: '#fecdd3' },
    spiker: { body: '#38bdf8', accent: '#a855f7', face: '#0b1224', blush: '#c4b5fd' },
    floater: { body: '#a5f3fc', accent: '#e0f2fe', face: '#0b1224', blush: '#fecdd3' },
  }

  // Enemies
  for (const e of enemies) {
    ctx.save()

    const bobY = e.bob || 0
    const squash = e.squash || 1
    const enemyColors = enemyPalettes[e.type] || enemyPalettes.gomba

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
        ctx.fillStyle = enemyColors.body
        ctx.beginPath()
        ctx.roundRect(0, 4, e.width, e.height - 4, 8)
        ctx.fill()

        // leaf tuft
        ctx.save()
        ctx.translate(e.width / 2, 4)
        ctx.rotate(-0.25)
        ctx.fillStyle = '#bef264'
        ctx.beginPath()
        ctx.moveTo(-2, 0)
        ctx.quadraticCurveTo(-6, -10, 4, -14)
        ctx.quadraticCurveTo(10, -4, 0, 2)
        ctx.closePath()
        ctx.fill()
        ctx.restore()

        ctx.fillStyle = enemyColors.accent
        ctx.beginPath()
        ctx.roundRect(4, e.height - 12, e.width - 8, 10, 5)
        ctx.fill()

        const eyeOffset = 7
        const eyeY = e.height * 0.55
        const eyeR = 2.6
        ctx.fillStyle = enemyColors.face
        ctx.beginPath()
        ctx.arc(eyeOffset, eyeY - 4, eyeR, 0, Math.PI * 2)
        ctx.arc(e.width - eyeOffset, eyeY - 4, eyeR, 0, Math.PI * 2)
        ctx.fill()

        // eye shine
        ctx.fillStyle = '#fef9c3'
        ctx.beginPath()
        ctx.arc(eyeOffset - 1, eyeY - 5, 0.8, 0, Math.PI * 2)
        ctx.arc(e.width - eyeOffset + 1, eyeY - 5, 0.8, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = enemyColors.face
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.arc(e.width / 2, eyeY + 2, 3, 0, Math.PI)
        ctx.stroke()

        ctx.globalAlpha = 0.7
        ctx.fillStyle = enemyColors.blush
        ctx.beginPath()
        ctx.arc(eyeOffset - 1, eyeY, 2, 0, Math.PI * 2)
        ctx.arc(e.width - eyeOffset + 1, eyeY, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      if (e.type === 'spiker') {
        const baseH = e.height * 0.75
        const spikesIntact = e.spikes !== false
        const concerned = e.concerned || !spikesIntact
        ctx.fillStyle = enemyColors.body
        ctx.beginPath()
        ctx.roundRect(0, e.height - baseH, e.width, baseH, 7)
        ctx.fill()

        ctx.fillStyle = enemyColors.accent
        ctx.beginPath()
        if (spikesIntact) {
          ctx.moveTo(2, e.height - baseH + 4)
          ctx.lineTo(e.width / 2, -6)
          ctx.lineTo(e.width - 2, e.height - baseH + 4)
          ctx.closePath()
          ctx.fill()
        } else {
          ctx.roundRect(4, e.height - baseH + 2, e.width - 8, 8, 3)
          ctx.fill()
        }

        ctx.fillStyle = enemyColors.face
        const eyeY = e.height - baseH + 10
        const eyeR = 2
        ctx.beginPath()
        ctx.arc(e.width / 2 - 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.fill()

        // eye gleam + heart sticker
        ctx.fillStyle = '#fef3c7'
        ctx.beginPath()
        ctx.arc(e.width / 2 - 7, eyeY - 1.5, 0.8, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 5, eyeY - 1.5, 0.8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fb7185'
        ctx.beginPath()
        ctx.moveTo(4, e.height - baseH + 8)
        ctx.bezierCurveTo(2, e.height - baseH + 4, 8, e.height - baseH + 2, 10, e.height - baseH + 8)
        ctx.bezierCurveTo(8, e.height - baseH + 14, 2, e.height - baseH + 12, 4, e.height - baseH + 8)
        ctx.fill()

        ctx.strokeStyle = enemyColors.face
        ctx.lineWidth = 1.6
        ctx.beginPath()
        if (concerned) {
          ctx.moveTo(e.width / 2 - 5, e.height - baseH + 17)
          ctx.quadraticCurveTo(e.width / 2, e.height - baseH + 22, e.width / 2 + 5, e.height - baseH + 17)
        } else {
          ctx.moveTo(e.width / 2 - 4, e.height - baseH + 15)
          ctx.quadraticCurveTo(e.width / 2, e.height - baseH + (e.confident ? 12 : 16), e.width / 2 + 4, e.height - baseH + 15)
        }
        ctx.stroke()

        ctx.globalAlpha = 0.6
        ctx.fillStyle = enemyColors.blush
        ctx.fillRect(5, e.height - baseH + 14, 4, 2)
        ctx.fillRect(e.width - 9, e.height - baseH + 14, 4, 2)
        ctx.globalAlpha = 1
      }

      if (e.type === 'floater') {
        const rage = e.rage ?? 0
        const r = Math.round(150 + rage * 40)
        const g = Math.round(220 - rage * 40)
        const b = Math.round(245 - rage * 50)
        ctx.fillStyle = `rgb(${r},${Math.max(g, 150)},${Math.max(b, 140)})`

        ctx.beginPath()
        ctx.arc(e.width / 2, e.height / 2, e.width / 2, 0, Math.PI * 2)
        ctx.fill()

        // tiny halo
        ctx.strokeStyle = withAlpha(enemyColors.accent, 0.9)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(e.width / 2, e.height / 2 - 10, e.width / 2.2, 0, Math.PI * 2)
        ctx.stroke()

        ctx.fillStyle = enemyColors.accent
        ctx.beginPath()
        ctx.arc(e.width / 2 - 4, e.height / 2 - 4, e.width / 3.4, 0, Math.PI * 2)
        ctx.fill()

        const eyeY = e.height * 0.52
        const eyeR = 1.8
        ctx.fillStyle = enemyColors.face
        ctx.beginPath()
        ctx.arc(e.width / 2 - 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.fill()

        // eye sparkle
        ctx.fillStyle = '#fef3c7'
        ctx.beginPath()
        ctx.arc(e.width / 2 - 7, eyeY - 1, 0.7, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 5, eyeY - 1, 0.7, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = enemyColors.face
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(e.width / 2, eyeY + 4, 3.2, 0, Math.PI)
        ctx.stroke()

        ctx.globalAlpha = 0.65
        ctx.fillStyle = enemyColors.blush
        ctx.fillRect(e.width / 2 - 10, eyeY + 2, 4, 2.4)
        ctx.fillRect(e.width / 2 + 6, eyeY + 2, 4, 2.4)
        ctx.globalAlpha = 1
      }
    }
    if (e.squished) {
      ctx.save()
      const bodyH = Math.max(e.pancakeHeight ?? e.height * 0.35, e.currentHeight ?? e.height * 0.45)
      const yOffset = e.height - bodyH
      ctx.translate(e.x, e.y + yOffset + bobY)

      ctx.fillStyle = enemyColors.body
      ctx.beginPath()
      ctx.roundRect(0, 0, e.width, bodyH, 6)
      ctx.fill()

      ctx.globalAlpha = 0.5
      ctx.fillStyle = 'rgba(11, 18, 36, 0.2)'
      ctx.fillRect(2, bodyH - 4, e.width - 4, 3)
      ctx.globalAlpha = 1

      const shockPulse = 1 + Math.max(0, e.squishTimer) * 3
      const eyeR = 1.8 * shockPulse
      const eyeOffset = e.width * 0.28
      const faceY = bodyH * 0.55
      ctx.fillStyle = enemyColors.face
      ctx.beginPath()
      ctx.arc(eyeOffset, faceY, eyeR, 0, Math.PI * 2)
      ctx.arc(e.width - eyeOffset, faceY, eyeR, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = enemyColors.face
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(e.width / 2, faceY + 6, 3.5 * shockPulse, 0, Math.PI * 2)
      ctx.stroke()

      ctx.restore()
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

  if (flashTimer > 0) {
    ctx.save()
    const alpha = clamp(flashTimer / 0.14, 0, 1) * 0.7
    ctx.fillStyle = `rgba(250, 250, 255, ${alpha})`
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
    flashTimer = Math.max(0, flashTimer - (1 / 60))
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

function setDifficulty(level) {
  difficulty.value = level
  applyDifficultySettings()
}

function beginRun() {
  if (started.value || gameOver.value) return
  introCollapsing.value = true
  setTimeout(() => {
    started.value = true
  }, 320)
}

function startSlide() {
  if (slideActive || gameOver.value) return
  slideActive = true
  slideTimer = SLIDE_DURATION
  slideElapsed = 0
  slideStartX = player.x
  slideTargetX = player.x + SLIDE_DISTANCE
  slideJumped = false
  player.vy = 0
  isSlamming = false
  slamOriginY = null
  player.onGround = true
  applySlideStrike()
  flashTimer = 0.14
}

function saveHighScore() {
  if (!canSaveScore.value || savedCurrentRun.value) return
  const name = playerName.value.trim() || 'Player'
  const entry = {
    id: Date.now(),
    name: name.slice(0, 16),
    score: Math.floor(score.value),
    date: new Date().toISOString().slice(0, 10),
  }
  const sorted = [...highScores.value, entry].sort((a, b) => b.score - a.score)
  const insertIdx = sorted.findIndex(e => e.id === entry.id)

  const placeholder = { ...entry, id: `placeholder-${entry.id}`, placeholder: true }
  const withPlaceholder = [...sorted]
  withPlaceholder.splice(insertIdx, 1, placeholder)
  const slicedPlaceholder = withPlaceholder.slice(0, 10)
  placeholderIndex.value = Math.min(insertIdx, slicedPlaceholder.length - 1)
  highScores.value = slicedPlaceholder
  savingHighScore.value = true
  savedCurrentRun.value = false

  setTimeout(() => {
    const finalList = sorted.slice(0, 10)
    highScores.value = finalList
    lastSavedIndex.value = finalList.findIndex(e => e.id === entry.id)
    persistHighScores()
    savingHighScore.value = false
    placeholderIndex.value = null
    savedCurrentRun.value = true
  }, 420)

  localStorage.setItem('hoppy-name', entry.name)
  playerName.value = entry.name
  savedCurrentRun.value = true
  canSaveScore.value = false
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

  // Rolling replay recorder
  if (c.captureStream && typeof MediaRecorder !== 'undefined') {
    try {
      const stream = c.captureStream(60)
      replayRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })
    } catch (_) {
      try {
        const stream = c.captureStream(60)
        replayRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
      } catch (err) {
        console.warn('replay recorder unavailable', err)
      }
    }

    if (replayRecorder) {
      replayRecorder.ondataavailable = e => {
        if (!e.data || e.data.size === 0) return
        const entry = { data: e.data, t: performance.now(), type: e.data.type }
        replayBuffer.push(entry)
        // keep last ~6 seconds
        const cutoff = performance.now() - 6000
        replayBuffer = replayBuffer.filter(chunk => chunk.t >= cutoff)
      }
      replayRecorder.start(500)
    }
  }

  resetGame()
  loadDefaultAudio()
  startObstacleSpawner()
  animationId = requestAnimationFrame(loop)
  loadHighScores()

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
  if (replayStopTimeout) clearTimeout(replayStopTimeout)
  try {
    if (replayRecorder && replayRecorder.state === 'recording') {
      replayRecorder.stop()
    }
  } catch (_) {}
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

.hud-difficulty {
  border-radius: 0.9rem;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}

.difficulty-toggle {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.difficulty-button {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #e2e8f0;
  padding: 0.35rem 0.65rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.18s ease;
}

.difficulty-button:hover {
  border-color: #38bdf8;
  color: #38bdf8;
}

.difficulty-button--active {
  border-color: #38bdf8;
  color: #0f172a;
  background: linear-gradient(120deg, #38bdf8, #a855f7);
  box-shadow: 0 6px 18px rgba(56, 189, 248, 0.3);
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

.overlay-card--collapse {
  animation: collapse-beat 0.32s ease-in forwards;
}

@keyframes collapse-beat {
  0% { transform: scale(1) translateY(0); opacity: 1; }
  50% { transform: scale(1.05) translateY(-6px); opacity: 0.8; }
  100% { transform: scale(0.15) translateY(-40px); opacity: 0; }
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

.replay-toast {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(14, 165, 233, 0.9);
  border: 1px solid rgba(125, 211, 252, 0.8);
  color: #0b1224;
  padding: 0.65rem 1.1rem;
  border-radius: 0.75rem;
  box-shadow: 0 10px 24px rgba(59, 130, 246, 0.35);
  text-align: center;
  animation: toast-pop 0.14s ease-out;
  pointer-events: none;
}

.replay-title {
  font-weight: 800;
  font-size: 0.95rem;
  letter-spacing: 0.03em;
}

.replay-sub {
  font-size: 0.8rem;
}

.replay-pip {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 200px;
  height: 112px;
  border: 2px solid rgba(125, 211, 252, 0.8);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.4);
  background: rgba(15, 23, 42, 0.8);
}

.replay-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@keyframes toast-pop {
  from { transform: translate(-50%, -10px) scale(0.98); opacity: 0; }
  to { transform: translate(-50%, 0) scale(1); opacity: 1; }
}

.score-save {
  display: flex;
  gap: 0.5rem;
  margin: 0.6rem 0;
  justify-content: center;
}

.name-input {
  background: #0b1224;
  border: 1px solid rgba(148, 163, 184, 0.45);
  color: #e5e7eb;
  padding: 0.35rem 0.6rem;
  border-radius: 0.5rem;
  min-width: 140px;
}

.save-button {
  background: linear-gradient(90deg, #22c55e, #38bdf8);
  color: #0b1224;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 0.5rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(56, 189, 248, 0.35);
}

.save-button:hover {
  filter: brightness(1.05);
}

kbd {
  background: #111827;
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
  border: 1px solid rgba(148, 163, 184, 0.7);
  font-size: 0.8em;
}

.controls {
  font-size: 0.85rem;
  opacity: 0.9;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
}

.controls-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}

.controls-label {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 600;
  opacity: 0.8;
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

.scoreboard-panel {
  margin-top: 1rem;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.9rem;
  padding: 1rem;
}

.scoreboard-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.score-slide-enter-active,
.score-slide-leave-active {
  transition: all 0.28s ease;
}
.score-slide-enter-from {
  opacity: 0;
  transform: translateY(14px);
}
.score-slide-leave-to {
  opacity: 0;
  transform: translateY(-14px);
}

.score-row {
  display: grid;
  grid-template-columns: 50px 1fr 100px 100px;
  gap: 0.5rem;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.6rem;
  padding: 0.5rem 0.75rem;
}

.score-row--placeholder {
  border-style: dashed;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.02);
}

.score-row--new {
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35), 0 10px 24px rgba(56, 189, 248, 0.2);
  animation: pulse-new 0.6s ease-in-out 1;
}

.score-row--new .score-value {
  color: #38bdf8;
}

@keyframes pulse-new {
  0% { transform: translateY(-6px) scale(1.02); opacity: 0; }
  40% { transform: translateY(0) scale(1.01); opacity: 1; }
  100% { transform: translateY(0) scale(1); }
}

.score-rank {
  font-weight: 700;
  color: #38bdf8;
}

.score-name {
  font-weight: 600;
}

.score-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #facc15;
  font-weight: 700;
}

.score-date {
  text-align: right;
  opacity: 0.75;
  font-size: 0.85rem;
}

.score-empty {
  opacity: 0.7;
  margin: 0.2rem 0 0;
}
</style>
