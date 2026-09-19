export type TouchGesture = 'tap' | 'up' | 'down' | 'left' | null
export type TouchAction = 'jump' | 'laneUp' | 'laneDown' | 'slam'

export function touchGestureAction(gesture: TouchGesture): TouchAction | null {
  if (gesture === 'tap') return 'jump'
  if (gesture === 'up') return 'laneUp'
  if (gesture === 'left') return 'laneDown'
  if (gesture === 'down') return 'slam'
  return null
}

/** Classify a completed gesture in CSS pixels; diagonal drags are ignored. */
export function classifyTouchGesture(dx: number, dy: number): TouchGesture {
  if (Math.hypot(dx, dy) < 18) return 'tap'
  if (Math.abs(dy) >= 42 && Math.abs(dy) > Math.abs(dx) * 1.25) return dy < 0 ? 'up' : 'down'
  if (dx <= -42 && Math.abs(dx) > Math.abs(dy) * 1.25) return 'left'
  return null
}
