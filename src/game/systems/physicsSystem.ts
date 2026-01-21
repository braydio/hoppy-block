/**
 * Clamp a number between a minimum and maximum bound.
 *
 * @param v Value to clamp.
 * @param min Minimum allowed value.
 * @param max Maximum allowed value.
 * @returns Clamped value.
 */
export function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v
}

/**
 * Linearly interpolate between two values.
 *
 * @param a Start value.
 * @param b End value.
 * @param t Normalized progress from 0 to 1.
 * @returns Interpolated value.
 */
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * Determine whether a body crossed a ground plane between frames.
 *
 * @param prevY Previous bottom Y position.
 * @param currY Current bottom Y position.
 * @param groundY Ground plane Y position.
 * @param epsilon Snap tolerance in pixels.
 * @returns True if the body crossed or reached the ground plane.
 */
export function detectGroundContact(
  prevY: number,
  currY: number,
  groundY: number,
  epsilon = 0.5,
): boolean {
  return prevY + epsilon < groundY && currY >= groundY - epsilon
}

/**
 * Integrate vertical velocity and position for the player.
 *
 * @param player Player instance to update.
 * @param gravity Gravity value in pixels per second squared.
 * @param dt Delta time in seconds.
 * @param timeScale Time scaling multiplier.
 * @param gravityScale Additional gravity multiplier.
 */
export function integratePlayerPhysics(
  player: { y: number; vy: number },
  gravity: number,
  dt: number,
  timeScale: number,
  gravityScale = 1,
): void {
  player.vy += gravity * gravityScale * dt * timeScale
  player.y += player.vy * dt * timeScale
}
