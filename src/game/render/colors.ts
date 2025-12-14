import { DEFAULT_PALETTE, PHASE_PALETTES } from '../core/constants'
import type { UiState } from '../core/gameState'
import type { GameRuntime } from '../core/gameState'

export function withAlpha(rgb: string, alpha: number) {
  if (rgb.startsWith('rgb(')) {
    return rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
  }
  if (rgb.startsWith('rgba(')) {
    return rgb.replace(/rgba\(([^)]+)\)/, (_m, inner) => {
      const parts = inner.split(',').map((p: string) => p.trim())
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`
    })
  }
  return rgb
}

export function getPalette(runtime: GameRuntime, ui: UiState, pulse: number, intensity: number) {
  const energyHue = Math.round(20 + intensity * 120)
  const phaseHue = runtime.phaseActive ? 30 + runtime.phaseModeIndex * 40 : 0
  const hue = energyHue + phaseHue

  const baseDefault = ui.colorblindMode.value
    ? {
        ...DEFAULT_PALETTE,
        beat: '#fbbf24',
        visBar: 'rgb(251, 191, 36)',
        visWave: 'rgba(59, 130, 246, 0.7)',
        obstacle: '#0ea5e9',
        obstacleGlow: '#f97316',
        player: '#e879f9',
        stroke: '#e879f9',
      }
    : DEFAULT_PALETTE
  const basePhase = ui.colorblindMode.value
    ? {
        ...PHASE_PALETTES[runtime.phaseMode as keyof typeof PHASE_PALETTES] || PHASE_PALETTES.terrain,
        beat: '#fbbf24',
      }
    : PHASE_PALETTES[runtime.phaseMode as keyof typeof PHASE_PALETTES] || PHASE_PALETTES.terrain

  const base = runtime.phaseActive ? basePhase : baseDefault
  const [r, g, b] = base.bgBase

  return {
    ...base,
    bg: `rgb(${r + pulse}, ${g}, ${b})`,
    skyStops: [
      `hsl(${hue}, 65%, 16%)`,
      `hsl(${hue + 24}, 70%, 12%)`,
    ] as [string, string],
  }
}
