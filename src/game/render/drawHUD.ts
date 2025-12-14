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
  audio: AudioView
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
  ctx.fillStyle = '#fde68a'
  ctx.fillText(`BPM ${Math.round(audio.bpm)}`, bpmX, pad + 10)

  const intensityBarWidth = 120
  const iFill = audio.intensity * intensityBarWidth

  ctx.fillStyle = '#020617'
  ctx.fillRect(runtime.width - intensityBarWidth - pad, pad + 18, intensityBarWidth, 8)

  ctx.fillStyle = '#a855f7'
  ctx.fillRect(runtime.width - intensityBarWidth - pad, pad + 18, iFill, 8)

  ctx.strokeStyle = '#f472b6'
  ctx.strokeRect(runtime.width - intensityBarWidth - pad, pad + 18, intensityBarWidth, 8)

  ctx.fillStyle = '#e5e7eb'
  ctx.fillText('INTENSITY', bpmX, pad + 40)

  ctx.fillStyle = '#fcd34d'
  ctx.fillText(`Combo X${Math.max(1, runtime.beatStreak)}`, bpmX, pad + 56)

  ctx.restore()
}
