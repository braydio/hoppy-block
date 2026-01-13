/**
 * Shared type definitions for game entities, inputs, and runtime structures.
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
 * Horizontal ground coverage expressed as a screen-space span with a vertical anchor.
 */
export interface GroundSegment {
  start: number
  end: number
  y: number
}

export interface Keybinds {
  [action: string]: string[]
}
