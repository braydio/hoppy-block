// === render/playerAnimation.ts ===
/**
 * Player animation state machine and interpolation utilities.
 * Handles sprite-like animation frames using procedural drawing.
 */

import type { GameRuntime } from '../core/gameState'
import { SLIDE_CROUCH_DURATION } from '../core/constants'

export interface PlayerAnimationState {
  // Core animation timing
  frameTime: number
  stateTime: number

  // Current animation state
  currentState: PlayerState
  previousState: PlayerState
  transitionProgress: number

  // Squash and stretch
  scaleX: number
  scaleY: number
  targetScaleX: number
  targetScaleY: number

  // Rotation and tilt
  tilt: number
  targetTilt: number

  // Breathing/idle animation
  breathPhase: number

  // Thruster animation
  thrusterIntensity: number
  thrusterFlicker: number

  // Wing animation
  wingAngle: number
  wingFlap: number

  // Trail particles
  trailParticles: TrailParticle[]

  // Impact effects
  impactShake: number
  impactDirection: number

  // Anticipation for jumps
  anticipationPhase: number

  // Landing recovery
  landingSquash: number
  landingRecoveryTime: number
}

export type PlayerState =
  | 'idle'
  | 'running'
  | 'jumping'
  | 'falling'
  | 'landing'
  | 'dashing'
  | 'dash_anticipation'
  | 'sliding'
  | 'floating'
  | 'slowmo'
  | 'hurt'
  | 'death'

export interface TrailParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

/**
 * Initialize the animation state with defaults
 */
export function createAnimationState(): PlayerAnimationState {
  return {
    frameTime: 0,
    stateTime: 0,
    currentState: 'idle',
    previousState: 'idle',
    transitionProgress: 1,
    scaleX: 1,
    scaleY: 1,
    targetScaleX: 1,
    targetScaleY: 1,
    tilt: 0,
    targetTilt: 0,
    breathPhase: 0,
    thrusterIntensity: 0.3,
    thrusterFlicker: 0,
    wingAngle: 0,
    wingFlap: 0,
    trailParticles: [],
    impactShake: 0,
    impactDirection: 0,
    anticipationPhase: 0,
    landingSquash: 0,
    landingRecoveryTime: 0,
  }
}

/**
 * Easing functions for smooth animations
 */
export const Easing = {
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeOutBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  },
  easeOutBounce: (t: number) => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  },
}

/**
 * Lerp with delta time for frame-independent animation
 */
export function smoothLerp(current: number, target: number, speed: number, dt: number): number {
  const factor = 1 - Math.pow(1 - speed, dt * 60)
  return current + (target - current) * factor
}

/**
 * Determine the player state based on game runtime
 */
export function determinePlayerState(runtime: GameRuntime): PlayerState {
  // Death state takes priority
  if (runtime.deathByEnemy) return 'death'

  // Check for hurt/invulnerable
  if (runtime.invulnTimer > 0 && runtime.invulnTimer > 0.3) return 'hurt'

  // Dash states
  if (runtime.dashActive) return 'dashing'
  if (runtime.slideActive && runtime.slideElapsed < SLIDE_CROUCH_DURATION)
    return 'dash_anticipation'
  if (runtime.slideActive) return 'sliding'

  // Antigrav/float
  if (runtime.hangActive) return 'floating'

  // Slow motion
  if (runtime.slowActive) return 'slowmo'

  // Air states
  if (!runtime.player.onGround) {
    if (runtime.player.vy < 0) return 'jumping'
    return 'falling'
  }

  // Ground states - check for landing recovery
  if (runtime.landingRecovery && runtime.landingRecovery > 0) return 'landing'

  // Default running (since player is always moving forward)
  return 'running'
}

/**
 * Update animation state each frame
 */
export function updateAnimationState(
  anim: PlayerAnimationState,
  runtime: GameRuntime,
  dt: number,
): void {
  anim.frameTime += dt

  // Determine new state
  const newState = determinePlayerState(runtime)

  // Handle state transitions
  if (newState !== anim.currentState) {
    anim.previousState = anim.currentState
    anim.currentState = newState
    anim.stateTime = 0
    anim.transitionProgress = 0

    // Trigger state-specific effects
    onStateEnter(anim, newState, runtime)
  } else {
    anim.stateTime += dt
    anim.transitionProgress = Math.min(1, anim.transitionProgress + dt * 8)
  }

  // Update state-specific animations
  updateStateAnimation(anim, runtime, dt)

  // Interpolate scale smoothly
  anim.scaleX = smoothLerp(anim.scaleX, anim.targetScaleX, 0.15, dt)
  anim.scaleY = smoothLerp(anim.scaleY, anim.targetScaleY, 0.15, dt)

  // Interpolate tilt
  anim.tilt = smoothLerp(anim.tilt, anim.targetTilt, 0.12, dt)

  // Update breathing
  anim.breathPhase += dt * 2.5

  // Update thruster flicker
  anim.thrusterFlicker = Math.random() * 0.3 + 0.7

  // Decay impact shake
  anim.impactShake = smoothLerp(anim.impactShake, 0, 0.2, dt)

  // Update trail particles
  updateTrailParticles(anim, runtime, dt)

  // Landing recovery
  if (anim.landingRecoveryTime > 0) {
    anim.landingRecoveryTime -= dt
    const t = 1 - anim.landingRecoveryTime / 0.2
    anim.landingSquash = Easing.easeOutElastic(t) * 0.15
  }
}

/**
 * Called when entering a new animation state
 */
function onStateEnter(anim: PlayerAnimationState, state: PlayerState, runtime: GameRuntime): void {
  switch (state) {
    case 'jumping':
      anim.targetScaleX = 0.85
      anim.targetScaleY = 1.2
      anim.anticipationPhase = 0
      break

    case 'landing':
      anim.targetScaleX = 1.3
      anim.targetScaleY = 0.7
      anim.landingRecoveryTime = 0.2
      anim.impactShake = 0.3
      break

    case 'dashing':
      anim.targetScaleX = 1.4
      anim.targetScaleY = 0.75
      anim.thrusterIntensity = 1
      break

    case 'dash_anticipation':
      anim.targetScaleX = 0.8
      anim.targetScaleY = 1.15
      break

    case 'hurt':
      anim.impactShake = 0.5
      anim.impactDirection = Math.random() * Math.PI * 2
      break

    case 'floating':
      anim.targetScaleX = 1.05
      anim.targetScaleY = 0.95
      break

    default:
      anim.targetScaleX = 1
      anim.targetScaleY = 1
  }
}

/**
 * Per-frame animation updates based on current state
 */
function updateStateAnimation(anim: PlayerAnimationState, runtime: GameRuntime, dt: number): void {
  const t = anim.stateTime

  switch (anim.currentState) {
    case 'idle':
    case 'running':
      const breath = Math.sin(anim.breathPhase) * 0.02
      anim.targetScaleX = 1 + breath
      anim.targetScaleY = 1 - breath * 0.5
      anim.targetTilt = 0
      anim.thrusterIntensity = smoothLerp(anim.thrusterIntensity, 0.4, 0.1, dt)
      anim.wingFlap = Math.sin(t * 8) * 0.1
      break

    case 'jumping':
      const jumpT = Math.min(1, t / 0.3)
      anim.targetScaleX = 0.9 + Easing.easeOutQuad(jumpT) * 0.1
      anim.targetScaleY = 1.15 - Easing.easeOutQuad(jumpT) * 0.15
      anim.targetTilt = -0.1
      anim.thrusterIntensity = 1 - jumpT * 0.3
      anim.wingFlap = Math.sin(t * 15) * 0.2
      break

    case 'falling':
      anim.targetScaleX = 0.95
      anim.targetScaleY = 1.08
      anim.targetTilt = 0.15
      anim.thrusterIntensity = smoothLerp(anim.thrusterIntensity, 0.2, 0.15, dt)
      anim.wingFlap = Math.sin(t * 12) * 0.15
      break

    case 'landing':
      const landT = Math.min(1, t / 0.15)
      anim.targetScaleX = 1.25 - Easing.easeOutBounce(landT) * 0.25
      anim.targetScaleY = 0.75 + Easing.easeOutBounce(landT) * 0.25
      anim.targetTilt = 0
      break

    case 'dashing':
      const dashOsc = Math.sin(t * 30) * 0.03
      anim.targetScaleX = 1.35 + dashOsc
      anim.targetScaleY = 0.75 - dashOsc
      anim.targetTilt = 0.05
      anim.thrusterIntensity = 1 + Math.sin(t * 40) * 0.2
      break

    case 'dash_anticipation':
      const prepT = Math.min(1, t / 0.15)
      anim.targetScaleX = 0.85 - prepT * 0.1
      anim.targetScaleY = 1.1 + prepT * 0.15
      anim.targetTilt = -0.15
      break

    case 'floating':
      const floatBob = Math.sin(t * 3) * 0.05
      anim.targetScaleX = 1.02 + floatBob
      anim.targetScaleY = 0.98 - floatBob * 0.5
      anim.targetTilt = Math.sin(t * 2) * 0.08
      anim.wingAngle = Math.sin(t * 4) * 0.2
      anim.thrusterIntensity = 0.6 + Math.sin(t * 8) * 0.2
      break

    case 'slowmo':
      anim.targetScaleX = 1 + Math.sin(t * 1.5) * 0.03
      anim.targetScaleY = 1 - Math.sin(t * 1.5) * 0.02
      anim.targetTilt = Math.sin(t) * 0.05
      break

    case 'hurt':
      const shakeX = Math.sin(t * 50) * anim.impactShake * 0.1
      const shakeY = Math.cos(t * 50) * anim.impactShake * 0.1
      anim.targetScaleX = 1 + shakeX
      anim.targetScaleY = 1 + shakeY
      break

    case 'death':
      anim.targetScaleX = Math.max(0, 1 - t * 2)
      anim.targetScaleY = Math.max(0, 1 - t * 2)
      anim.targetTilt = t * 10
      break
  }
}

/**
 * Update and spawn trail particles
 */
function updateTrailParticles(anim: PlayerAnimationState, runtime: GameRuntime, dt: number): void {
  // Update existing particles
  for (let i = anim.trailParticles.length - 1; i >= 0; i--) {
    const p = anim.trailParticles[i]
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 50 * dt

    if (p.life <= 0) {
      anim.trailParticles.splice(i, 1)
    }
  }

  // Spawn new particles based on state
  const spawnRate = getTrailSpawnRate(anim.currentState)
  if (spawnRate > 0 && Math.random() < spawnRate * dt * 60) {
    const colors = getTrailColors(anim.currentState)
    anim.trailParticles.push({
      x: runtime.player.x + runtime.player.width * 0.2,
      y: runtime.player.y + runtime.player.height * 0.8,
      vx: -100 - Math.random() * 50,
      vy: (Math.random() - 0.5) * 30,
      life: 0.3 + Math.random() * 0.2,
      maxLife: 0.5,
      size: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
}

function getTrailSpawnRate(state: PlayerState): number {
  switch (state) {
    case 'dashing':
      return 3
    case 'jumping':
      return 1
    case 'floating':
      return 0.5
    default:
      return 0.2
  }
}

function getTrailColors(state: PlayerState): string[] {
  switch (state) {
    case 'dashing':
      return ['#fb7185', '#f472b6', '#fda4af']
    case 'floating':
      return ['#facc15', '#fef08a', '#fef9c3']
    case 'jumping':
      return ['#22d3ee', '#67e8f9', '#a5f3fc']
    default:
      return ['#94a3b8', '#cbd5e1', '#e2e8f0']
  }
}

/**
 * Get the shake offset for rendering
 */
export function getShakeOffset(anim: PlayerAnimationState): { x: number; y: number } {
  if (anim.impactShake <= 0.01) return { x: 0, y: 0 }

  const intensity = anim.impactShake * 8
  return {
    x: Math.sin(anim.frameTime * 80 + anim.impactDirection) * intensity,
    y: Math.cos(anim.frameTime * 80 + anim.impactDirection * 0.7) * intensity,
  }
}
