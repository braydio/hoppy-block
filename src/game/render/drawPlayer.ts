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
