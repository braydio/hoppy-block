// === drawPlayer.ts ===
import type { GameRuntime, UiState } from '../core/gameState'
import type { Palette } from './types'
import { clamp } from '../systems/physicsSystem'
import { SLIDE_CROUCH_DURATION } from '../core/constants'
import { PlayerAnimationState, getShakeOffset, Easing } from './playerAnimation'
import { withAlpha } from './colors'

/**
 * Draw the player with full animation support
 */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  ui: UiState,
  palette: Palette,
  anim?: PlayerAnimationState,
) {
  // Fallback for when animation state isn't provided
  if (!anim) {
    drawPlayerLegacy(ctx, runtime, ui, palette)
    return
  }

  const shake = getShakeOffset(anim)

  // Draw trail particles first (behind player)
  drawTrailParticles(ctx, anim)

  // Calculate final transforms
  const baseX = runtime.player.x + runtime.player.width / 2 + shake.x
  const baseY = runtime.player.y + runtime.player.height / 2 + shake.y

  ctx.save()
  ctx.translate(baseX, baseY)
  ctx.rotate(runtime.rotation + anim.tilt)
  ctx.scale(anim.scaleX, anim.scaleY)

  // Determine colors based on state
  const { bodyColor, glowColor, glowIntensity } = getStateColors(anim, runtime, ui, palette)

  // Draw glow layer
  if (glowIntensity > 0) {
    drawPlayerGlow(ctx, runtime, glowColor, glowIntensity, anim)
  }

  // Draw main body
  drawPlayerBody(ctx, runtime, bodyColor, anim, palette)

  // Draw animated details
  drawAnimatedDetails(ctx, runtime, anim, palette)

  // Draw thrusters
  drawThrusters(ctx, runtime, anim, palette)

  ctx.restore()

  // Draw invulnerability shield
  if (runtime.invulnTimer > 0) {
    drawInvulnShield(ctx, runtime, anim)
  }

  // Draw death explosion
  if (ui.gameOver.value && runtime.deathByEnemy) {
    drawDeathExplosion(ctx, runtime, anim)
  }

  // Draw fragments
  drawPlayerFragments(ctx, runtime)
}

/**
 * Get colors based on current animation state
 */
function getStateColors(
  anim: PlayerAnimationState,
  runtime: GameRuntime,
  ui: UiState,
  palette: Palette,
): { bodyColor: string; glowColor: string; glowIntensity: number } {
  const baseColor = palette.player

  switch (anim.currentState) {
    case 'dashing':
      return {
        bodyColor: '#fb7185',
        glowColor: '#f472b6',
        glowIntensity: 0.8 + Math.sin(anim.stateTime * 20) * 0.2,
      }
    case 'floating':
      return {
        bodyColor: withAlpha(baseColor, 0.9),
        glowColor: '#facc15',
        glowIntensity: 0.5 + Math.sin(anim.stateTime * 5) * 0.3,
      }
    case 'slowmo':
      return {
        bodyColor: withAlpha(baseColor, 0.85),
        glowColor: '#38bdf8',
        glowIntensity: 0.4,
      }
    case 'hurt':
      const flash = Math.sin(anim.stateTime * 30) > 0
      return {
        bodyColor: flash ? '#f97316' : baseColor,
        glowColor: '#f97316',
        glowIntensity: flash ? 0.6 : 0.2,
      }
    case 'death':
      return {
        bodyColor: 'transparent',
        glowColor: '#f97316',
        glowIntensity: 1 - anim.stateTime,
      }
    default:
      return {
        bodyColor: baseColor,
        glowColor: palette.stroke,
        glowIntensity: 0.3,
      }
  }
}

/**
 * Draw trail particles
 */
function drawTrailParticles(ctx: CanvasRenderingContext2D, anim: PlayerAnimationState): void {
  for (const p of anim.trailParticles) {
    const alpha = (p.life / p.maxLife) * 0.8
    const size = p.size * (p.life / p.maxLife)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color

    // Draw as a soft circle
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size)
    gradient.addColorStop(0, p.color)
    gradient.addColorStop(1, withAlpha(p.color, 0))
    ctx.fillStyle = gradient

    ctx.beginPath()
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/**
 * Draw player glow effect
 */
function drawPlayerGlow(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  color: string,
  intensity: number,
  anim: PlayerAnimationState,
): void {
  const w = runtime.player.width
  const h = runtime.player.height

  ctx.save()
  ctx.globalAlpha = intensity * 0.4
  ctx.shadowColor = color
  ctx.shadowBlur = 20 + intensity * 15
  ctx.fillStyle = color

  // Pulsing glow shape
  const pulseScale = 1 + Math.sin(anim.frameTime * 8) * 0.05
  ctx.scale(pulseScale, pulseScale)

  ctx.beginPath()
  ctx.roundRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 8)
  ctx.fill()
  ctx.restore()
}

/**
 * Draw the main player body with animation-aware rendering
 */
function drawPlayerBody(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  color: string,
  anim: PlayerAnimationState,
  palette: Palette,
): void {
  const w = runtime.player.width
  const h = runtime.player.height
  const left = -w / 2
  const top = -h / 2

  // Skip body for death state
  if (anim.currentState === 'death') return

  // Main hull
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(left, top, w, h, 4)
  ctx.fill()

  // Hull trim with animated highlight
  ctx.save()
  const highlightPhase = (Math.sin(anim.frameTime * 3) + 1) * 0.5
  ctx.strokeStyle = `rgba(15, 23, 42, ${0.35 + highlightPhase * 0.1})`
  ctx.lineWidth = 2
  ctx.strokeRect(left + 2, top + 2, w - 4, h - 4)

  // Animated scan line
  ctx.strokeStyle = `rgba(226, 232, 240, ${0.4 + highlightPhase * 0.3})`
  ctx.lineWidth = 1.4
  const scanY = top + h * 0.35 + Math.sin(anim.frameTime * 2) * h * 0.1
  ctx.beginPath()
  ctx.moveTo(left + 4, scanY)
  ctx.lineTo(left + w - 4, scanY)
  ctx.stroke()
  ctx.restore()

  // Canopy with state-reactive glow
  ctx.save()
  const canopyGlow =
    anim.currentState === 'dashing' ? 0.9 : anim.currentState === 'floating' ? 0.8 : 0.7
  ctx.fillStyle = `rgba(15, 23, 42, ${canopyGlow})`
  ctx.beginPath()
  ctx.moveTo(left + w * 0.32, top + h * 0.2)
  ctx.lineTo(left + w * 0.68, top + h * 0.2)
  ctx.lineTo(left + w * 0.62, top + h * 0.48)
  ctx.lineTo(left + w * 0.38, top + h * 0.48)
  ctx.closePath()
  ctx.fill()

  // Canopy reflection animation
  const reflectX = left + w * 0.35 + Math.sin(anim.frameTime * 1.5) * w * 0.1
  ctx.strokeStyle = `rgba(125, 211, 252, ${0.5 + highlightPhase * 0.3})`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(reflectX, top + h * 0.22)
  ctx.lineTo(reflectX + w * 0.08, top + h * 0.35)
  ctx.stroke()
  ctx.restore()

  // Crest badge (pulses with energy)
  ctx.save()
  const crestPulse = 0.8 + Math.sin(anim.breathPhase * 2) * 0.2
  ctx.fillStyle = `rgba(250, 204, 21, ${crestPulse})`
  ctx.fillRect(left + w * 0.44, top + h * 0.7, w * 0.12, h * 0.18)
  ctx.restore()

  // Rivets
  ctx.save()
  ctx.fillStyle = 'rgba(148, 163, 184, 0.6)'
  const rivet = (x: number, y: number) => {
    ctx.beginPath()
    ctx.arc(x, y, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
  rivet(left + 6, top + 6)
  rivet(left + w - 6, top + 6)
  rivet(left + 6, top + h - 6)
  rivet(left + w - 6, top + h - 6)
  ctx.restore()
}

/**
 * Draw animated wing and fin details
 */
function drawAnimatedDetails(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  anim: PlayerAnimationState,
  palette: Palette,
): void {
  const w = runtime.player.width
  const h = runtime.player.height
  const left = -w / 2
  const top = -h / 2

  if (anim.currentState === 'death') return

  // Tail boom with animation
  ctx.save()
  const tailWag = Math.sin(anim.frameTime * 6) * 0.05
  ctx.translate(left + w * 0.5, top + h * 0.9)
  ctx.rotate(tailWag)
  ctx.fillStyle = 'rgba(226, 232, 240, 0.5)'
  ctx.fillRect(-w * 0.04, 0, w * 0.08, h * 0.22)
  ctx.restore()

  // Animated wings
  const wingBaseAngle = anim.wingAngle + anim.wingFlap
  const wingColor =
    anim.currentState === 'dashing'
      ? 'rgba(251, 113, 133, 0.65)'
      : anim.currentState === 'floating'
        ? 'rgba(250, 204, 21, 0.55)'
        : 'rgba(56, 189, 248, 0.55)'

  const drawWing = (side: 'left' | 'right') => {
    const dir = side === 'left' ? -1 : 1
    const baseX = side === 'left' ? left + w * 0.06 : left + w * 0.94
    const wingY = top + h * 0.62

    // Wing animation based on state
    let wingLength = w * 0.15
    let wingHeight = h * 0.16
    let flapAngle = wingBaseAngle * dir

    if (anim.currentState === 'jumping') {
      wingLength = w * 0.18
      flapAngle += Math.sin(anim.stateTime * 15) * 0.15 * dir
    } else if (anim.currentState === 'falling') {
      wingLength = w * 0.2
      flapAngle -= 0.1 * dir
    } else if (anim.currentState === 'dashing') {
      wingLength = w * 0.1
      flapAngle = 0.3 * dir // Swept back
    }

    ctx.save()
    ctx.fillStyle = wingColor
    ctx.translate(baseX, wingY)
    ctx.rotate(flapAngle)

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(dir * wingLength, wingHeight * 0.4)
    ctx.lineTo(dir * wingLength * 0.8, wingHeight)
    ctx.lineTo(0, wingHeight * 0.8)
    ctx.closePath()
    ctx.fill()

    // Wing detail line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(dir * 2, wingHeight * 0.3)
    ctx.lineTo(dir * wingLength * 0.7, wingHeight * 0.5)
    ctx.stroke()

    ctx.restore()
  }

  drawWing('left')
  drawWing('right')
}

/**
 * Draw animated thrusters
 */
function drawThrusters(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  anim: PlayerAnimationState,
  palette: Palette,
): void {
  const w = runtime.player.width
  const h = runtime.player.height
  const left = -w / 2
  const top = -h / 2

  if (anim.currentState === 'death') return

  const intensity = anim.thrusterIntensity * anim.thrusterFlicker

  // Side thruster housings
  ctx.save()
  ctx.fillStyle = 'rgba(34, 197, 94, 0.55)'
  const thrusterW = w * 0.16
  const thrusterH = h * 0.16
  ctx.fillRect(left + w * 0.08, top + h * 0.72, thrusterW, thrusterH)
  ctx.fillRect(left + w * 0.76, top + h * 0.72, thrusterW, thrusterH)
  ctx.restore()

  // Thruster flames
  const drawFlame = (x: number, y: number) => {
    const flameLength = 8 + intensity * 15
    const flameWidth = 4 + intensity * 3

    ctx.save()
    ctx.translate(x, y)

    // Create flame gradient
    const gradient = ctx.createLinearGradient(0, 0, -flameLength, 0)

    if (anim.currentState === 'dashing') {
      gradient.addColorStop(0, 'rgba(251, 113, 133, 0.9)')
      gradient.addColorStop(0.3, 'rgba(244, 114, 182, 0.7)')
      gradient.addColorStop(1, 'rgba(244, 114, 182, 0)')
    } else if (anim.currentState === 'floating') {
      gradient.addColorStop(0, 'rgba(250, 204, 21, 0.9)')
      gradient.addColorStop(0.3, 'rgba(254, 240, 138, 0.7)')
      gradient.addColorStop(1, 'rgba(254, 240, 138, 0)')
    } else {
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.9)')
      gradient.addColorStop(0.3, 'rgba(74, 222, 128, 0.7)')
      gradient.addColorStop(1, 'rgba(74, 222, 128, 0)')
    }

    ctx.fillStyle = gradient

    // Animated flame shape
    const wobble = Math.sin(anim.frameTime * 25) * flameWidth * 0.2

    ctx.beginPath()
    ctx.moveTo(0, -flameWidth / 2)
    ctx.quadraticCurveTo(-flameLength * 0.4, -flameWidth / 2 + wobble, -flameLength, 0)
    ctx.quadraticCurveTo(-flameLength * 0.4, flameWidth / 2 - wobble, 0, flameWidth / 2)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  // Draw flames behind thrusters
  drawFlame(left + w * 0.08, top + h * 0.8)
  drawFlame(left + w * 0.08, top + h * 0.8 + thrusterH / 2)
  drawFlame(left + w * 0.76 + thrusterW, top + h * 0.8)
}

/**
 * Draw invulnerability shield effect
 */
function drawInvulnShield(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  anim: PlayerAnimationState,
): void {
  ctx.save()

  const centerX = runtime.player.x + runtime.player.width / 2
  const centerY = runtime.player.y + runtime.player.height / 2
  const radius = Math.max(runtime.player.width, runtime.player.height) * 0.8

  // Pulsing alpha
  const alpha = 0.3 + 0.25 * Math.sin(anim.frameTime * 12)

  // Rotating shield segments
  const segments = 6
  const rotation = anim.frameTime * 3

  ctx.translate(centerX, centerY)
  ctx.rotate(rotation)

  for (let i = 0; i < segments; i++) {
    const angle = ((Math.PI * 2) / segments) * i
    const segmentAlpha = alpha * (0.7 + 0.3 * Math.sin(anim.frameTime * 8 + i))

    ctx.save()
    ctx.rotate(angle)
    ctx.strokeStyle = `rgba(244, 63, 94, ${segmentAlpha})`
    ctx.lineWidth = 3
    ctx.shadowColor = 'rgba(244, 63, 94, 0.6)'
    ctx.shadowBlur = 10

    ctx.beginPath()
    ctx.arc(0, 0, radius, -0.4, 0.4)
    ctx.stroke()
    ctx.restore()
  }

  ctx.restore()
}

/**
 * Draw death explosion effect
 */
function drawDeathExplosion(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  anim: PlayerAnimationState,
): void {
  const centerX = runtime.player.x + runtime.player.width / 2
  const centerY = runtime.player.y + runtime.player.height / 2

  ctx.save()
  ctx.translate(centerX, centerY)

  // Expanding shards
  const shardCount = 12
  const explosionProgress = Math.min(1, anim.stateTime / 0.5)

  for (let i = 0; i < shardCount; i++) {
    const angle = (Math.PI * 2 * i) / shardCount + anim.stateTime * 2
    const distance = Easing.easeOutQuad(explosionProgress) * 60
    const size = (1 - explosionProgress) * 8
    const alpha = 1 - explosionProgress

    ctx.save()
    ctx.rotate(angle)
    ctx.translate(distance, 0)
    ctx.rotate(anim.stateTime * 5)

    ctx.fillStyle = `rgba(249, 115, 22, ${alpha})`
    ctx.fillRect(-size / 2, -size / 2, size, size)

    ctx.restore()
  }

  // Central flash
  if (explosionProgress < 0.3) {
    const flashAlpha = (0.3 - explosionProgress) / 0.3
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 50)
    gradient.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`)
    gradient.addColorStop(0.5, `rgba(249, 115, 22, ${flashAlpha * 0.5})`)
    gradient.addColorStop(1, 'rgba(249, 115, 22, 0)')

    ctx.fillStyle = gradient
    ctx.fillRect(-50, -50, 100, 100)
  }

  ctx.restore()
}

/**
 * Draw player fragments (for hits)
 */
function drawPlayerFragments(ctx: CanvasRenderingContext2D, runtime: GameRuntime): void {
  for (const f of runtime.playerFragments) {
    ctx.save()
    ctx.globalAlpha = f.alpha
    ctx.translate(f.x, f.y)
    ctx.rotate(f.rotation || 0)

    ctx.fillStyle = '#22c55e'
    ctx.fillRect(-f.size / 2, -f.size / 2, f.size, f.size)

    ctx.restore()
  }
}

/**
 * Legacy draw function for backwards compatibility
 */
function drawPlayerLegacy(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  ui: UiState,
  palette: Palette,
) {
  // ... your original drawPlayer code here for fallback
  const basePlayerColor = palette.player
  const playerColor = runtime.dashActive
    ? '#fb7185'
    : ui.gameOver.value && runtime.deathByEnemy
      ? 'transparent'
      : ui.gameOver.value
        ? '#f97316'
        : basePlayerColor

  const preppingDash = runtime.slideActive && runtime.slideElapsed < SLIDE_CROUCH_DURATION
  const prepT = preppingDash ? clamp(runtime.slideElapsed / SLIDE_CROUCH_DURATION, 0, 1) : 0
  const squishEase = preppingDash ? 1 - Math.pow(1 - prepT, 2) : 0
  const dashSquish = runtime.dashActive ? 0.78 : 1
  const dashStretch = runtime.dashActive ? 1.18 : 1
  const prepSquishY = preppingDash ? 0.8 + squishEase * 0.08 : 1
  const prepSquishX = preppingDash ? 1.12 + squishEase * 0.05 : 1
  const playerSquishY = prepSquishY * dashSquish
  const playerSquishX = prepSquishX * dashStretch

  ctx.save()
  ctx.translate(
    runtime.player.x + runtime.player.width / 2,
    runtime.player.y + runtime.player.height / 2,
  )
  ctx.rotate(runtime.rotation)
  ctx.scale(playerSquishX, playerSquishY)
  ctx.fillStyle = playerColor
  ctx.fillRect(
    -runtime.player.width / 2,
    -runtime.player.height / 2,
    runtime.player.width,
    runtime.player.height,
  )
  ctx.restore()
}
