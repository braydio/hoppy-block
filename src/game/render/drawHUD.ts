import type { UiState } from '../core/gameState'
import type { Keybinds } from '../core/types'
import type { GameRuntime } from '../core/gameState'
import { keyLabel } from '../core/keybinds'

type AudioView = {
  bpm: number
  intensity: number
}

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  runtime: GameRuntime,
  ui: UiState,
  keybinds: Keybinds,
  audio: AudioView,
) {
  const pad = 14

  // Charge Bar
  const barWidth = 180
  const barHeight = 10
  const fill = (ui.charge.value / 100) * barWidth

  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.fillStyle = '#020617'
  ctx.fillRect(pad, pad, barWidth, barHeight)

  ctx.fillStyle = '#22c55e'
  ctx.fillRect(pad, pad, fill, barHeight)

  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 1.5
  ctx.strokeRect(pad, pad, barWidth, barHeight)

  ctx.font = '12px system-ui'
  ctx.fillStyle = '#e5e7eb'
  ctx.fillText(`CHARGE`, pad, pad - 4)
  ctx.restore()

  // Power Status Icons
  ctx.save()
  ctx.font = '14px system-ui'
  ctx.textAlign = 'left'
  ctx.fillStyle = runtime.hangActive ? '#facc15' : '#64748b'
  ctx.fillText(`${keyLabel(keybinds.antigrav)} ANTIGRAV`, pad, pad + 28)

  ctx.fillStyle = runtime.slowActive ? '#38bdf8' : '#64748b'
  ctx.fillText(`${keyLabel(keybinds.slowmo)} SLOW-MO`, pad + 80, pad + 28)
  ctx.fillStyle = runtime.dashActive ? '#fb7185' : ui.dashReady.value ? '#f472b6' : '#64748b'
  ctx.fillText(`${keyLabel(keybinds.blast)} BLAST`, pad + 160, pad + 28)

  ctx.fillStyle = runtime.phaseActive ? '#c084fc' : ui.phaseReady.value ? '#a855f7' : '#475569'
  ctx.fillText(`${keyLabel(keybinds.phase)} PHASE SHIFT`, pad + 240, pad + 28)
  ctx.fillStyle = runtime.scoreMultiplier > 1 ? '#fcd34d' : '#94a3b8'
  ctx.restore()

  // BPM + Intensity
  ctx.save()
  ctx.font = '13px system-ui'
  ctx.textAlign = 'right'

  const bpmX = runtime.width - pad

  const intensityBarWidth = 120
  const iFill = audio.intensity * intensityBarWidth

  ctx.fillStyle = '#020617'
  ctx.fillRect(runtime.width - intensityBarWidth - pad, pad + 12, intensityBarWidth, 8)

  ctx.fillStyle = '#a855f7'
  ctx.fillRect(runtime.width - intensityBarWidth - pad, pad + 12, iFill, 8)

  ctx.strokeStyle = '#f472b6'
  ctx.strokeRect(runtime.width - intensityBarWidth - pad, pad + 12, intensityBarWidth, 8)

  ctx.fillStyle = '#e5e7eb'
  ctx.fillText('INTENSITY', bpmX, pad + 32)

  // Beat pulse indicator
  const beatX = runtime.width - intensityBarWidth - pad - 20
  const beatY = pad + 16
  const beatMs = 60000 / Math.max(1, ui.bpm.value)
  const nearestEnemy = runtime.enemies
    .filter((e) => e.alive && !e.squished && e.x + e.width > runtime.player.x)
    .sort((a, b) => a.x - b.x)[0]
  const indicatorX = nearestEnemy
    ? nearestEnemy.x + nearestEnemy.width / 2
    : runtime.width - pad - 20
  const beatPhase = Math.min(1, (performance.now() - runtime.lastBeatTime) / beatMs)
  const cycle = (runtime.beatIndex % 4) as 0 | 1 | 2 | 3
  const colors = [
    'rgba(56, 189, 248, 0.12)',
    'rgba(94, 234, 212, 0.12)',
    'rgba(244, 114, 182, 0.12)',
    'rgba(167, 139, 250, 0.12)',
  ] as const
  const strokeColors = [
    'rgba(94, 234, 212, 0.25)',
    'rgba(56, 189, 248, 0.25)',
    'rgba(244, 114, 182, 0.25)',
    'rgba(167, 139, 250, 0.25)',
  ] as const
  const outerR = 18
  const macroPhase = Math.min(1, ((runtime.beatIndex % 4) + beatPhase) / 4)
  const converge = 1 - macroPhase
  const ringR = outerR * (0.35 + 0.65 * converge)
  const innerR = 4 + converge * 5

  ctx.save()
  ctx.translate(indicatorX, runtime.groundY + 6)
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)'
  ctx.beginPath()
  ctx.arc(1.5, 1.5, outerR + 2, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = strokeColors[cycle]
  ctx.beginPath()
  ctx.arc(0, 0, ringR, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = colors[cycle]
  ctx.beginPath()
  ctx.arc(0, 0, innerR, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()

  ctx.fillStyle = '#fcd34d'
  ctx.fillText(`Combo x${Math.max(0, runtime.airKillCombo)}`, bpmX, pad + 50)

  ctx.restore()
}
