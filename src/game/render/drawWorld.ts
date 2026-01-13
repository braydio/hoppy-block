/**
 * Base world rendering: sky gradient, parallax, ground, and beat line.
 */
import type { GameRuntime, UiState } from '../core/gameState'
import type { GroundSegment } from '../core/types'
import type { Palette } from './types'
import type { IntensityWindowState } from '../systems/audioEngine'

/**
 * Paints the world background and ground, layering parallax stripes, segmented lanes,
 * beat pulses for safe spans, and subtle lead-in overlays when an intense section is
 * approaching.
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
  const leadInActive = runtime.intensityLeadInActive || intensityWindow?.phase === 'lead-in'
  const groundFill = leadInActive && palette.leadInGround ? palette.leadInGround : palette.ground
  const segments: GroundSegment[] =
    runtime.groundSegments.length > 0
      ? runtime.groundSegments
      : [{ start: 0, end: runtime.width, y: runtime.groundY, levelIndex: 0, safe: true }]
  const lanes = new Map<number, { y: number; segments: GroundSegment[] }>()
  for (const segment of segments) {
    const lane = lanes.get(segment.levelIndex)
    if (lane) {
      lane.segments.push(segment)
    } else {
      lanes.set(segment.levelIndex, { y: segment.y, segments: [segment] })
    }
  }

  const orderedLanes = Array.from(lanes.values()).sort((a, b) => a.y - b.y)
  const laneCount = orderedLanes.length || 1
  const laneCenter = (laneCount - 1) / 2
  const parallaxStep = 6
  const safePulseBoost = ui.beatPulse.value ? 0.18 : 0
  const safePulseGlow = ui.beatPulse.value ? 0.12 : 0
  const unsafeDashPattern = [10, 8]

  orderedLanes.forEach((lane, laneIndex) => {
    // Slight x-axis parallax separates lanes to keep vertical tiers legible.
    const laneOffset = (laneIndex - laneCenter) * parallaxStep
    lane.segments.forEach((segment) => {
      const segmentWidth = segment.end - segment.start
      if (segmentWidth <= 0) return
      const segmentX = segment.start + laneOffset
      const segmentHeight = runtime.height - segment.y
      const baseAlpha = segment.safe ? 0.86 + safePulseBoost : 0.38

      ctx.save()
      ctx.globalAlpha = Math.min(1, Math.max(0, baseAlpha))
      ctx.fillStyle = groundFill
      ctx.fillRect(segmentX, segment.y, segmentWidth, segmentHeight)

      if (segment.safe && safePulseGlow > 0) {
        ctx.globalAlpha = Math.min(1, Math.max(0, baseAlpha + safePulseGlow))
        ctx.fillStyle = palette.beat
        ctx.fillRect(segmentX, segment.y, segmentWidth, 6)
      }

      if (!segment.safe) {
        // Dashed interior stripes reinforce unsafe spans without overwhelming the base fill.
        ctx.save()
        ctx.globalAlpha = Math.min(1, Math.max(0, baseAlpha + 0.18))
        ctx.strokeStyle = palette.beat
        ctx.lineWidth = 6
        ctx.setLineDash(unsafeDashPattern)
        ctx.beginPath()
        for (let y = segment.y + 12; y < runtime.height; y += 18) {
          ctx.moveTo(segmentX, y)
          ctx.lineTo(segmentX + segmentWidth, y)
        }
        ctx.stroke()
        ctx.restore()
      }
      ctx.restore()

      if (leadInActive) {
        ctx.save()
        ctx.fillStyle = palette.leadInOverlay ?? 'rgba(8, 47, 73, 0.22)'
        ctx.fillRect(
          segmentX,
          segment.y - 24,
          segmentWidth,
          Math.min(runtime.height - segment.y + 36, runtime.height),
        )
        ctx.restore()
      }
    })
  })

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
