import type { GameRuntime, UiState } from '../core/gameState'
import type { Palette } from './types'
import type { IntensityWindowState } from '../systems/audioEngine'

/**
 * Render the world background and ground, tinted by rhythm cues and section windows.
 */
export function drawWorld(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  ui: UiState,
  palette: Palette,
  intensityWindow: IntensityWindowState | null = null
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

  // Ground segments
  ctx.fillStyle = palette.ground
  for (const segment of runtime.groundSegments) {
    ctx.fillRect(segment.start, runtime.groundY, segment.end - segment.start, runtime.height - runtime.groundY)
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
