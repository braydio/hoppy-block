/**
 * Shared color configuration for rendering the world and HUD layers.
 */
export interface Palette {
  stripe: string
  ground: string
  beat: string
  visBar: string
  visWave: string
  obstacle: string
  obstacleGlow: string
  player: string
  stroke: string
  bgBase?: [number, number, number]
  bg: string
  skyStops?: [string, string]
  leadInGround?: string
  leadInOverlay?: string
}
