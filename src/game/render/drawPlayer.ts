import type { GameRuntime, UiState } from '../core/gameState'
import type { Palette } from './types'
import { clamp } from '../systems/physicsSystem'
import { SLIDE_CROUCH_DURATION } from '../core/constants'

export function drawPlayer(ctx: CanvasRenderingContext2D, runtime: GameRuntime, ui: UiState, palette: Palette) {
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
    runtime.player.y + runtime.player.height / 2
  )
  ctx.rotate(runtime.rotation)
  ctx.scale(playerSquishX, playerSquishY)

  ctx.fillStyle = playerColor
  ctx.fillRect(
    -runtime.player.width / 2,
    -runtime.player.height / 2,
    runtime.player.width,
    runtime.player.height
  )

  if (!ui.gameOver.value || !runtime.deathByEnemy) {
    const w = runtime.player.width
    const h = runtime.player.height
    const left = -w / 2
    const top = -h / 2

    // Tail boom.
    ctx.save()
    ctx.fillStyle = 'rgba(226, 232, 240, 0.5)'
    ctx.fillRect(left + w * 0.46, top + h * 0.82, w * 0.08, h * 0.22)
    ctx.restore()

    // Winglets / flaps.
    ctx.save()
    ctx.fillStyle = 'rgba(56, 189, 248, 0.55)'
    ctx.beginPath()
    ctx.moveTo(left + w * 0.08, top + h * 0.7)
    ctx.lineTo(left - w * 0.16, top + h * 0.78)
    ctx.lineTo(left + w * 0.08, top + h * 0.86)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(left + w * 0.92, top + h * 0.7)
    ctx.lineTo(left + w * 1.16, top + h * 0.78)
    ctx.lineTo(left + w * 0.92, top + h * 0.86)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // Hull trim for a feudal spacer-tech vibe.
    ctx.save()
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)'
    ctx.lineWidth = 2
    ctx.strokeRect(left + 2, top + 2, w - 4, h - 4)

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.6)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(left + 4, top + h * 0.35)
    ctx.lineTo(left + w - 4, top + h * 0.35)
    ctx.moveTo(left + 4, top + h * 0.65)
    ctx.lineTo(left + w - 4, top + h * 0.65)
    ctx.stroke()
    ctx.restore()

    // Canopy window with a gothic arch feel.
    ctx.save()
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'
    ctx.beginPath()
    ctx.moveTo(left + w * 0.32, top + h * 0.2)
    ctx.lineTo(left + w * 0.68, top + h * 0.2)
    ctx.lineTo(left + w * 0.62, top + h * 0.48)
    ctx.lineTo(left + w * 0.38, top + h * 0.48)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()

    // Side thrusters.
    ctx.save()
    ctx.fillStyle = 'rgba(34, 197, 94, 0.55)'
    const thrusterW = w * 0.16
    const thrusterH = h * 0.16
    ctx.fillRect(left + w * 0.08, top + h * 0.72, thrusterW, thrusterH)
    ctx.fillRect(left + w * 0.76, top + h * 0.72, thrusterW, thrusterH)
    ctx.restore()

    // Crest badge.
    ctx.save()
    ctx.fillStyle = 'rgba(250, 204, 21, 0.8)'
    ctx.fillRect(left + w * 0.44, top + h * 0.7, w * 0.12, h * 0.18)
    ctx.restore()

    // Rivets.
    ctx.save()
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)'
    const rivet = (x: number, y: number) => ctx.fillRect(x, y, 2, 2)
    rivet(left + 6, top + 6)
    rivet(left + w - 8, top + 6)
    rivet(left + 6, top + h - 8)
    rivet(left + w - 8, top + h - 8)
    ctx.restore()
  }

  if (ui.gameOver.value && runtime.deathByEnemy) {
    const shardCount = 10
    for (let i = 0; i < shardCount; i++) {
      const angle = (Math.PI * 2 * i) / shardCount
      const len = 26 + Math.random() * 22
      const thickness = 5 + Math.random() * 3
      ctx.save()
      ctx.rotate(angle)
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = thickness
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(len, 0)
      ctx.stroke()
      ctx.restore()
    }

    const pulse = ctx.createRadialGradient(0, 0, 0, 0, 0, 38)
    pulse.addColorStop(0, 'rgba(249, 115, 22, 0.35)')
    pulse.addColorStop(1, 'rgba(249, 115, 22, 0)')
    ctx.fillStyle = pulse
    ctx.fillRect(-40, -40, 80, 80)
  }
  ctx.restore()

  // Player glow
  ctx.save()
  ctx.translate(
    runtime.player.x + runtime.player.width / 2,
    runtime.player.y + runtime.player.height / 2
  )
  ctx.rotate(runtime.rotation)
  ctx.scale(playerSquishX, playerSquishY)
  ctx.shadowColor = playerColor
  ctx.shadowBlur = 18
  ctx.strokeStyle = runtime.dashActive ? '#fb7185' : palette.stroke
  ctx.lineWidth = 2
  ctx.strokeRect(-runtime.player.width / 2, -runtime.player.height / 2, runtime.player.width, runtime.player.height)
  ctx.restore()

  if (runtime.invulnTimer > 0) {
    ctx.save()
    const alpha = 0.3 + 0.25 * Math.sin(performance.now() * 0.01)
    ctx.strokeStyle = `rgba(244, 63, 94, ${alpha})`
    ctx.lineWidth = 3
    ctx.shadowColor = 'rgba(244,63,94,0.6)'
    ctx.shadowBlur = 14
    ctx.strokeRect(
      runtime.player.x - 6,
      runtime.player.y - 6,
      runtime.player.width + 12,
      runtime.player.height + 12
    )
    ctx.restore()
  }

  for (const f of runtime.playerFragments) {
    ctx.save()
    ctx.globalAlpha = f.alpha
    ctx.fillStyle = '#22c55e'
    ctx.fillRect(
      f.x - f.size / 2,
      f.y - f.size / 2,
      f.size,
      f.size
    )
    ctx.restore()
  }
}
