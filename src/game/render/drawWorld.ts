/**
 * Base world rendering: sky gradient, parallax, ground, and beat line.
 */
import type { GameRuntime, UiState } from '../core/gameState'
import type { Palette } from './types'
import type { IntensityWindowState } from '../systems/audioEngine'

/**
 * Paints the world background and ground, layering parallax stripes, beat markers,
 * and subtle lead-in overlays when an intense section is approaching.
 *
 * @param ctx - Canvas rendering context.
 * @param runtime - Current game runtime values.
 * @param ui - Reactive UI state.
 * @param palette - Active color palette.
 */
export function drawWorld(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  ui: UiState,
  palette: Palette,
  intensityWindow: IntensityWindowState | null = null,
) {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, runtime.width, runtime.height * 0.6)
  skyGrad.addColorStop(0, palette.skyStops ? palette.skyStops[0] : palette.bg)
  skyGrad.addColorStop(1, palette.skyStops ? palette.skyStops[1] : palette.bg)
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, runtime.width, runtime.height)

  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, runtime.width, runtime.height)

  // Parallax stripes
  ctx.save()
  const windowGlow =
    intensityWindow == null
      ? 0
      : intensityWindow.phase === 'lead-in'
        ? 0.08 + intensityWindow.progress * 0.12
        : 0.18 + intensityWindow.progress * 0.2
  ctx.globalAlpha = runtime.phaseActive ? 0.2 : 0.12 + windowGlow
  ctx.fillStyle = palette.stripe
  const stripeHeight = 32
  for (let y = 0; y < runtime.height; y += stripeHeight) {
    ctx.fillRect(0, y, runtime.width, stripeHeight - 8)
  }
  ctx.restore()

  // Ground
  const groundFill =
    runtime.intensityLeadInActive && palette.leadInGround ? palette.leadInGround : palette.ground
  ctx.fillStyle = groundFill
  ctx.fillRect(0, runtime.groundY, runtime.width, runtime.height - runtime.groundY)
  if (runtime.intensityLeadInActive) {
    ctx.save()
    ctx.fillStyle = palette.leadInOverlay ?? 'rgba(8, 47, 73, 0.22)'
    ctx.fillRect(
      0,
      runtime.groundY - 24,
      runtime.width,
      Math.min(runtime.height - runtime.groundY + 36, runtime.height),
    )
    ctx.restore()
  }

  // Beat line
  ctx.save()
  ctx.globalAlpha = ui.beatPulse.value ? 0.7 : 0.25
  ctx.strokeStyle = palette.beat
  ctx.lineWidth = 3
  ctx.setLineDash(ui.beatPulse.value ? [8, 6] : [2, 10])
  ctx.beginPath()
  ctx.moveTo(0, runtime.groundY)
  ctx.lineTo(runtime.width, runtime.groundY)
  ctx.stroke()
  ctx.restore()
}
