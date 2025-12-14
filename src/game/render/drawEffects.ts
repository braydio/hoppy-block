import type { GameRuntime, UiState } from '../core/gameState'
import { withAlpha } from './colors'
import type { Palette } from './types'

export function drawHatBursts(ctx: CanvasRenderingContext2D, runtime: GameRuntime, palette: Palette) {
  for (const p of runtime.hatBursts) {
    ctx.save()
    ctx.globalAlpha = p.alpha
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
    grad.addColorStop(0, withAlpha(palette.visWave, 0.9))
    grad.addColorStop(1, withAlpha(palette.visBar, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

export function drawDash(ctx: CanvasRenderingContext2D, runtime: GameRuntime) {
  if (runtime.dashActive) {
    ctx.save()
    const beamWidth = runtime.player.width + 200
    const beamHeight = runtime.player.height + 20
    const beamY = runtime.player.y - 10
    const gradient = ctx.createLinearGradient(runtime.player.x, 0, runtime.player.x + beamWidth, 0)
    gradient.addColorStop(0, 'rgba(251, 113, 133, 0.5)')
    gradient.addColorStop(0.35, 'rgba(244, 114, 182, 0.55)')
    gradient.addColorStop(0.75, 'rgba(125, 211, 252, 0.65)')
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.4)')

    ctx.fillStyle = gradient
    ctx.shadowColor = '#f472b6'
    ctx.shadowBlur = 24
    ctx.fillRect(runtime.player.x, beamY, beamWidth, beamHeight)

    ctx.shadowBlur = 0
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = '#f8fafc'
    ctx.lineWidth = 2
    const stripeCount = 6
    const t = performance.now() * 0.012
    for (let i = 0; i < stripeCount; i++) {
      const y = beamY + (beamHeight / stripeCount) * i + ((t + i * 7) % (beamHeight / stripeCount))
      ctx.beginPath()
      ctx.moveTo(runtime.player.x, y)
      ctx.lineTo(runtime.player.x + beamWidth, y - 8)
      ctx.stroke()
    }

    ctx.restore()
  }

  for (const g of runtime.dashGhosts) {
    ctx.save()
    ctx.globalAlpha = g.alpha
    ctx.fillStyle = 'rgba(251, 113, 133, 0.5)'
    ctx.translate(g.x + g.w / 2, g.y + g.h / 2)
    ctx.scale(1.05, 0.95)
    ctx.fillRect(-g.w / 2, -g.h / 2, g.w, g.h)
    ctx.restore()
    g.alpha *= 0.92
  }
  runtime.dashGhosts = runtime.dashGhosts.filter(g => g.alpha > 0.05)
}

export function drawAudioVisualizer(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  palette: Palette
) {
  if (!runtime.analyser || !runtime.freqData || !runtime.timeData) return

  const analyser = runtime.analyser
  const freq = runtime.freqData as unknown as Uint8Array
  const time = runtime.timeData as unknown as Uint8Array

  ;(analyser as any).getByteFrequencyData(freq)
  ;(analyser as any).getByteTimeDomainData(time)

  const barCount = 32
  const barWidth = runtime.width / barCount

  for (let i = 0; i < barCount; i++) {
    const v = (freq[i] ?? 0) / 255
    const barHeight = v * 140

    ctx.fillStyle = withAlpha(palette.visBar, v)
    ctx.fillRect(
      i * barWidth,
      runtime.groundY - barHeight,
      barWidth - 2,
      barHeight
    )
  }

  ctx.save()
  ctx.strokeStyle = palette.visWave
  ctx.lineWidth = 2
  ctx.beginPath()

  const slice = runtime.width / time.length
  let x = 0

  for (let i = 0; i < time.length; i++) {
    const v = (time[i] ?? 0) / 128.0
    const y = v * runtime.height * 0.3

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)

    x += slice
  }

  ctx.stroke()
  ctx.restore()
}

export function drawShockwaves(ctx: CanvasRenderingContext2D, runtime: GameRuntime, palette: Palette) {
  for (const s of runtime.shockwaves) {
    ctx.save()
    ctx.globalAlpha = s.alpha
    const halfW = (s.w || 0) / 2
    const h = s.h || 16
    const color = s.intense ? '#fbbf24' : palette.beat
    const grad = ctx.createLinearGradient(s.x - halfW, s.y, s.x + halfW, s.y)
    grad.addColorStop(0, withAlpha(color, 0))
    grad.addColorStop(0.5, withAlpha(color, 0.9))
    grad.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = grad
    ctx.fillRect(s.x - halfW, s.y - h / 2, s.w || 0, h)
    ctx.shadowColor = withAlpha(color, 0.4)
    ctx.shadowBlur = s.intense ? 18 : 10
    ctx.fillRect(s.x - halfW, s.y - h / 2, s.w || 0, h)
    ctx.restore()
  }
}

export function drawSonicBursts(ctx: CanvasRenderingContext2D, runtime: GameRuntime) {
  for (const s of runtime.sonicBursts) {
    ctx.save()
    ctx.globalAlpha = s.alpha

    ctx.strokeStyle = '#f97316'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = '#fde68a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r * 0.6, 0, Math.PI * 2)
    ctx.stroke()

    ctx.restore()
  }
}

export function drawScorePops(ctx: CanvasRenderingContext2D, runtime: GameRuntime) {
  for (const p of runtime.scorePops) {
    ctx.save()
    ctx.globalAlpha = p.alpha
    ctx.fillStyle = p.value >= 250 ? '#f97316' : '#facc15'
    ctx.font = 'bold 18px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(`+${p.value}`, p.x, p.y)
    ctx.restore()
  }
}

export function drawObstacles(ctx: CanvasRenderingContext2D, runtime: GameRuntime, palette: Palette) {
  for (const o of runtime.obstacles) {
    ctx.save()
    const rad = 6
    ctx.fillStyle = palette.obstacle
    ctx.beginPath()
    ctx.moveTo(o.x + rad, o.y)
    ctx.lineTo(o.x + o.width - rad, o.y)
    ctx.quadraticCurveTo(o.x + o.width, o.y, o.x + o.width, o.y + rad)
    ctx.lineTo(o.x + o.width, o.y + o.height - rad)
    ctx.quadraticCurveTo(o.x + o.width, o.y + o.height, o.x + o.width - rad, o.y + o.height)
    ctx.lineTo(o.x + rad, o.y + o.height)
    ctx.quadraticCurveTo(o.x, o.y + o.height, o.x, o.y + o.height - rad)
    ctx.lineTo(o.x, o.y + rad)
    ctx.quadraticCurveTo(o.x, o.y, o.x + rad, o.y)
    ctx.closePath()
    ctx.fill()

    ctx.globalAlpha = 0.35
    ctx.fillStyle = palette.obstacleGlow
    ctx.fillRect(o.x, o.y - 4, o.width, 3)
    ctx.restore()
  }
}

export function drawPhaseOverlay(ctx: CanvasRenderingContext2D, runtime: GameRuntime, palette: Palette, ui: UiState) {
  if (runtime.phaseActive) {
    ctx.save()
    ctx.globalAlpha = 0.15
    ctx.fillStyle = withAlpha(palette.beat, 0.4)
    ctx.fillRect(0, 0, runtime.width, runtime.height)
    ctx.restore()
  }

  if (ui.beatPulse.value) {
    ctx.save()
    const g = ctx.createRadialGradient(runtime.player.x + runtime.player.width / 2, runtime.groundY, 20, runtime.player.x + runtime.player.width / 2, runtime.groundY, 280)
    g.addColorStop(0, withAlpha(palette.visWave, 0.22))
    g.addColorStop(1, withAlpha(palette.visWave, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, runtime.width, runtime.height)
    ctx.restore()
  }
}

export function drawFlash(ctx: CanvasRenderingContext2D, runtime: GameRuntime) {
  if (runtime.flashTimer > 0) {
    ctx.save()
    const alpha = Math.max(0, Math.min(1, runtime.flashTimer / 0.14)) * 0.7
    ctx.fillStyle = `rgba(250, 250, 255, ${alpha})`
    ctx.fillRect(0, 0, runtime.width, runtime.height)
    ctx.restore()
    runtime.flashTimer = Math.max(0, runtime.flashTimer - (1 / 60))
  }
}
