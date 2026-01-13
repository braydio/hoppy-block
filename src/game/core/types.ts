/**
 * Shared type definitions for core game entities and terrain metadata.
 */
import type { SpawnAttribution } from '../../debug/spawnCauses'

export type EnemyType = 'gomba' | 'spiker' | 'floater'

export interface Player {
  x: number
  y: number
  width: number
  height: number
  vy: number
  onGround: boolean
}

export interface Enemy {
  type: EnemyType
  band: 'bass' | 'mid' | 'high'
  x: number
  y: number
  width: number
  height: number
  alive: boolean
  squished?: boolean
  squishTimer?: number
  pancakeHeight?: number
  currentHeight?: number
  bob?: number
  squash?: number
  confident?: boolean
  spikes?: boolean
  concerned?: boolean
  phase?: number
  rage?: number
  telegraph?: number
  squishImpulse?: number
  beatBob?: number
  dancePhase?: number
  spawnAttribution?: SpawnAttribution
  spawnTime?: number
}

export interface Obstacle {
  x: number
  y: number
  width: number
  height: number
  passed?: boolean
  _destroy?: boolean
}

/**
 * Horizontal ground coverage expressed as a screen-space span.
 */
export interface GroundSegment {
  /** X start of the ground segment span. */
  start: number
  /** X end of the ground segment span. */
  end: number
  /** Y position for the segment surface. */
  y: number
  /** Index for the vertical level bucket used by segmented layouts. */
  levelIndex: number
  /** Whether the segment is currently safe to land on. */
  safe: boolean
}

export interface Keybinds {
  [action: string]: string[]
}
