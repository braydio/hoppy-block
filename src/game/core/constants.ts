import type { Keybinds } from './types'

export const DASH_WINDOW_MS = 110
export const DASH_DURATION = 0.24
export const DASH_THRUST = 900
export const PLAYER_ANCHOR_X = 150
export const DASH_RANGE = 200
export const DASH_COST = 16
export const SLIDE_DURATION = 0.6
export const SLIDE_DISTANCE = 150
export const SLIDE_CROUCH_DURATION = 0.1
export const SLIDE_DASH_DURATION = 0.12
export const SLIDE_GLIDE_DURATION = 0.08
export const SLIDE_FLIP_DURATION = 0.2
export const PHASE_DURATION = 10
export const PHASE_COST = 20
export const PHASE_COOLDOWN = 20
export const DOUBLE_JUMP_COST = 10
export const PARRY_COST = 6
export const INTENSE_SLAM_HEIGHT = 180
export const AIR_COMBO_STEP = 0.35
export const AIR_COMBO_MAX = 3.2
export const MAX_MULTIPLIER = 3
export const CHARGE_DRAIN_RATE = 30
export const CHARGE_REGEN_GROUND = 40
export const CHARGE_REGEN_AIR = 30
export const DEFAULT_TRACK = '/audio/clarity.mp3'
export const PHASE_STATES = ['terrain', 'gomba', 'spiker', 'floater'] as const

export const DEFAULT_PALETTE = {
  stripe: '#0f172a',
  ground: '#111827',
  beat: '#22d3ee',
  visBar: 'rgb(34, 211, 238)',
  visWave: 'rgba(250, 204, 21, 0.7)',
  obstacle: '#38bdf8',
  obstacleGlow: '#f97316',
  player: '#22c55e',
  stroke: '#22c55e',
  bgBase: [2, 6, 23] as [number, number, number],
}

export const PHASE_PALETTES = {
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
    bgBase: [40, 6, 48] as [number, number, number],
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
    bgBase: [60, 12, 6] as [number, number, number],
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
    bgBase: [8, 20, 48] as [number, number, number],
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
    bgBase: [14, 24, 52] as [number, number, number],
  },
}

export const DIFFICULTY_PRESETS = {
  easy: { speedMult: 0.9, spawnRate: 0.78, uniformity: 0.85 },
  medium: { speedMult: 1, spawnRate: 1, uniformity: 0.45 },
  hard: { speedMult: 1.15, spawnRate: 1.35, uniformity: 0.15 },
}

export const difficultyOptions = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
] as const

export const keybindOptions = [
  { id: 'jump', label: 'Jump' },
  { id: 'slam', label: 'Slam' },
  { id: 'antigrav', label: 'Antigrav' },
  { id: 'slowmo', label: 'Slow-Mo' },
  { id: 'blast', label: 'Beat Blast' },
  { id: 'phase', label: 'Phase Shift' },
  { id: 'parry', label: 'Beat Parry' },
] as const

export const defaultKeybinds: Keybinds = {
  jump: ['Space'],
  slam: ['ShiftLeft', 'ShiftRight'],
  antigrav: ['ArrowUp'],
  slowmo: ['ArrowDown'],
  blast: ['ArrowRight'],
  phase: ['ArrowLeft'],
  parry: ['KeyE'],
}
