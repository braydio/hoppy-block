export function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
