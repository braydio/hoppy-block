import { reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { defaultKeybinds, difficultyOptions, keybindOptions, PHASE_STATES } from './constants'
import type { Enemy, Keybinds, Obstacle, Player } from './types'

export interface UiState {
  score: Ref<number>
  baseScore: Ref<number>
  bonusScore: Ref<number>
  speed: Ref<number>
  gameOver: Ref<boolean>
  started: Ref<boolean>
  beatPulse: Ref<boolean>
  bpm: Ref<number>
  charge: Ref<number>
  dashReady: Ref<boolean>
  phaseReady: Ref<boolean>
  phaseCooldown: Ref<number>
  introCollapsing: Ref<boolean>
  beatWindowMs: Ref<number>
  colorblindMode: Ref<boolean>
  highScores: Ref<HighScoreEntry[]>
  playerName: Ref<string>
  canSaveScore: Ref<boolean>
  savedCurrentRun: Ref<boolean>
  savingHighScore: Ref<boolean>
  placeholderIndex: Ref<number | null>
  lastSavedIndex: Ref<number | null>
  difficulty: Ref<string>
  snapshotMessageTimer: Ref<number>
  replayVideoUrl: Ref<string | null>
  replayVisible: Ref<boolean>
  replayPlaybackKey: Ref<number>
}

export interface GameRuntime {
  ctx: CanvasRenderingContext2D | null
  width: number
  height: number
  groundY: number
  gravity: number
  jumpVelocity: number
  baseScrollSpeed: number
  scrollSpeed: number
  lastTimestamp: number | null
  animationId: number | null
  beatIntervalId: number | null
  obstacleSpawnIntervalId: number | null
  audio: HTMLAudioElement | null
  audioCtx: AudioContext | null
  analyser: AnalyserNode | null
  freqData: Uint8Array | null
  timeData: Uint8Array | null
  detectedBpm: number
  lastBeatTime: number
  lastSubBeatTime: number
  beatIndex: number
  rotation: number
  isSlamming: boolean
  jumpStartY: number
  jumpApexY: number
  obstacles: Obstacle[]
  enemies: Enemy[]
  shockwaves: any[]
  scorePops: any[]
  sonicBursts: any[]
  hatBursts: any[]
  spawnBeacons: { x: number; y: number; alpha: number; band: 'bass' | 'mid' | 'high' }[]
  playerFragments: any[]
  dashActive: boolean
  dashTimer: number
  dashVelocity: number
  dashGhosts: any[]
  slideActive: boolean
  slideTimer: number
  slideStartX: number
  slideJumped: boolean
  slideElapsed: number
  slideTargetX: number
  flashTimer: number
  phaseActive: boolean
  phaseTimer: number
  phaseModeIndex: number
  phaseMode: string
  lastEnemySpawnBeat: number
  lastObstacleSpawnBeat: number
  invulnTimer: number
  graceUsed: boolean
  airJumps: number
  beatStreak: number
  scoreMultiplier: number
  lastBeatActionTime: number
  airComboMultiplier: number
  airComboStreak: number
  slamOriginY: number | null
  deathByEnemy: boolean
  deathSlowTimer: number
  wasGameOver: boolean
  hangActive: boolean
  slowActive: boolean
  replayRecorder: MediaRecorder | null
  replayBuffer: { data: Blob; t: number; type: string }[]
  replayStopTimeout: number | null
  player: Player
  cameraShake: number
  requestReplayCapture?: boolean
  comboGraceTimer?: number
}

export interface HighScoreEntry {
  id: number | string
  name: string
  score: number
  date: string
  placeholder?: boolean
}

export interface GameState {
  ui: UiState
  keybinds: Keybinds
  editingKey: Ref<string | null>
  runtime: GameRuntime
}

export function createGameState(): GameState {
  const ui: UiState = {
    score: ref(0),
    baseScore: ref(0),
    bonusScore: ref(0),
    speed: ref(1),
    gameOver: ref(false),
    started: ref(false),
    beatPulse: ref(false),
    bpm: ref(120),
    charge: ref(0),
    dashReady: ref(false),
    phaseReady: ref(false),
    phaseCooldown: ref(0),
    introCollapsing: ref(false),
    beatWindowMs: ref(90),
    colorblindMode: ref(false),
    highScores: ref<HighScoreEntry[]>([]),
    playerName: ref('Player'),
    canSaveScore: ref(false),
    savedCurrentRun: ref(false),
    savingHighScore: ref(false),
    placeholderIndex: ref<number | null>(null),
    lastSavedIndex: ref<number | null>(null),
    difficulty: ref('medium'),
    snapshotMessageTimer: ref(0),
    replayVideoUrl: ref<string | null>(null),
    replayVisible: ref(false),
    replayPlaybackKey: ref(0),
  }

  const runtime: GameRuntime = {
    ctx: null,
    width: 900,
    height: 400,
    groundY: 340,
    gravity: 2600,
    jumpVelocity: -1050,
    baseScrollSpeed: 380,
    scrollSpeed: 380,
    lastTimestamp: null,
    animationId: null,
    beatIntervalId: null,
    obstacleSpawnIntervalId: null,
    audio: null,
    audioCtx: null,
    analyser: null,
    freqData: null,
    timeData: null,
    detectedBpm: 120,
    lastBeatTime: 0,
    lastSubBeatTime: 0,
    beatIndex: 0,
    rotation: 0,
    isSlamming: false,
    jumpStartY: 0,
    jumpApexY: 0,
    obstacles: [],
    enemies: [],
  shockwaves: [],
  scorePops: [],
  sonicBursts: [],
  hatBursts: [],
    spawnBeacons: [],
  playerFragments: [],
    dashActive: false,
    dashTimer: 0,
    dashVelocity: 0,
    dashGhosts: [],
    slideActive: false,
    slideTimer: 0,
    slideStartX: 0,
    slideJumped: false,
    slideElapsed: 0,
    slideTargetX: 0,
    flashTimer: 0,
    phaseActive: false,
    phaseTimer: 0,
    phaseModeIndex: 0,
    phaseMode: PHASE_STATES[0],
    lastEnemySpawnBeat: -2,
    lastObstacleSpawnBeat: -2,
    invulnTimer: 0,
    graceUsed: false,
    airJumps: 1,
    beatStreak: 0,
    scoreMultiplier: 1,
    lastBeatActionTime: 0,
    airComboMultiplier: 1,
    airComboStreak: 0,
    slamOriginY: null,
    deathByEnemy: false,
    deathSlowTimer: 0,
    wasGameOver: false,
    hangActive: false,
    slowActive: false,
    replayRecorder: null,
    replayBuffer: [],
    replayStopTimeout: null,
    player: {
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      vy: 0,
      onGround: true,
    },
    cameraShake: 0,
    requestReplayCapture: false,
    comboGraceTimer: 0,
  }

  const editingKey = ref<string | null>(null)
  const keybinds = reactive({ ...defaultKeybinds }) as Keybinds

  return { ui, keybinds, editingKey, runtime }
}

export function loadHighScores(ui: UiState) {
  try {
    const raw = localStorage.getItem('hoppy-highscores')
    if (raw) ui.highScores.value = JSON.parse(raw)
    const storedName = localStorage.getItem('hoppy-name')
    if (storedName) ui.playerName.value = storedName
  } catch (err) {
    console.warn('high score load failed', err)
  }
}

export function persistHighScores(ui: UiState) {
  try {
    localStorage.setItem('hoppy-highscores', JSON.stringify(ui.highScores.value))
  } catch (err) {
    console.warn('high score save failed', err)
  }
}

export function saveHighScore(ui: UiState, scoreValue: number) {
  if (!ui.canSaveScore.value || ui.savedCurrentRun.value) return
  const name = ui.playerName.value.trim() || 'Player'
  const entry: HighScoreEntry = {
    id: Date.now(),
    name: name.slice(0, 16),
    score: Math.floor(scoreValue),
    date: new Date().toISOString().slice(0, 10),
  }
  const sorted = [...ui.highScores.value, entry].sort((a, b) => b.score - a.score)
  const insertIdx = sorted.findIndex(e => e.id === entry.id)

  const placeholder = { ...entry, id: `placeholder-${entry.id}`, placeholder: true }
  const withPlaceholder = [...sorted]
  withPlaceholder.splice(insertIdx, 1, placeholder)
  const slicedPlaceholder = withPlaceholder.slice(0, 10)
  ui.placeholderIndex.value = Math.min(insertIdx, slicedPlaceholder.length - 1)
  ui.highScores.value = slicedPlaceholder
  ui.savingHighScore.value = true
  ui.savedCurrentRun.value = false

  setTimeout(() => {
    const finalList = sorted.slice(0, 10)
    ui.highScores.value = finalList
    ui.lastSavedIndex.value = finalList.findIndex(e => e.id === entry.id)
    persistHighScores(ui)
    ui.savingHighScore.value = false
    ui.placeholderIndex.value = null
    ui.savedCurrentRun.value = true
  }, 420)

  localStorage.setItem('hoppy-name', entry.name)
  ui.playerName.value = entry.name
  ui.savedCurrentRun.value = true
  ui.canSaveScore.value = false
}

export { difficultyOptions, keybindOptions }
