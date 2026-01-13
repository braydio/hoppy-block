import { clamp } from './physicsSystem'
import type { GameRuntime, UiState } from '../core/gameState'
import { MAX_MULTIPLIER } from '../core/constants'

export function isOnBeat(
  runtime: GameRuntime,
  ui: UiState,
  audioStarted: boolean,
  windowMs: number = ui.beatWindowMs.value,
) {
  if (!audioStarted) return false
  const beatMs = 60000 / ui.bpm.value
  const now = performance.now()
  const distToCurrent = Math.abs(now - runtime.lastBeatTime)
  const distToNext = Math.abs(runtime.lastBeatTime + beatMs - now)
  return Math.min(distToCurrent, distToNext) <= windowMs
}

export function registerBeatAction(runtime: GameRuntime, onBeat: boolean) {
  if (onBeat) {
    runtime.beatStreak += 1
    runtime.scoreMultiplier = clamp(1 + runtime.beatStreak * 0.25, 1, MAX_MULTIPLIER)
    runtime.lastBeatActionTime = performance.now()
  } else {
    runtime.beatStreak = Math.max(0, runtime.beatStreak - 1)
    runtime.scoreMultiplier = clamp(1 + runtime.beatStreak * 0.25, 1, MAX_MULTIPLIER)
  }
}
