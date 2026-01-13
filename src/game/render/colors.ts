/**
 * Palette utilities for adapting colors based on energy, accessibility toggles,
 * and active gameplay states such as phase modes.
 */
import { DEFAULT_PALETTE, PHASE_PALETTES } from '../core/constants'
import type { UiState } from '../core/gameState'
import type { GameRuntime } from '../core/gameState'
import type { IntensityWindowState } from '../systems/audioEngine'

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

/**
 * Build a palette tuned to the current gameplay and audio state.
 *
 * @param runtime Game runtime state for phase toggles and sizing.
 * @param ui UI state for accessibility toggles.
 * @param pulse Bass-driven color pulse amount.
 * @param intensity Rolling audio intensity value.
 * @param intensityWindow Active intensity window used to sync palette with mapped sections.
 */
export function getPalette(
  runtime: GameRuntime,
  ui: UiState,
  pulse: number,
  intensity: number,
  intensityWindow: IntensityWindowState | null = null,
) {
  const energyHue = Math.round(20 + intensity * 120)
  const phaseHue = runtime.phaseActive ? 30 + runtime.phaseModeIndex * 40 : 0
  const sectionLift =
    intensityWindow == null
      ? 0
      : intensityWindow.phase === 'lead-in'
        ? intensityWindow.progress * 0.5
        : 0.6 + intensityWindow.progress * 0.4
  const hue = energyHue + phaseHue + sectionLift * 30

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
        ...(PHASE_PALETTES[runtime.phaseMode as keyof typeof PHASE_PALETTES] ||
          PHASE_PALETTES.terrain),
        beat: '#fbbf24',
      }
    : PHASE_PALETTES[runtime.phaseMode as keyof typeof PHASE_PALETTES] || PHASE_PALETTES.terrain

  const base = runtime.phaseActive ? basePhase : baseDefault
  const [r, g, b] = base.bgBase

  return {
    ...base,
    bg: `rgb(${r + pulse + sectionLift * 28}, ${g + sectionLift * 12}, ${b})`,
    skyStops: [
      `hsl(${hue}, ${65 + sectionLift * 12}%, ${16 + sectionLift * 10}%)`,
      `hsl(${hue + 24}, ${70 + sectionLift * 8}%, ${12 + sectionLift * 10}%)`,
    ] as [string, string],
    leadInGround: `hsl(${hue + 18}, 60%, 8%)`,
    leadInOverlay: `rgba(${Math.min(255, r + 28)}, ${Math.min(255, g + 52)}, ${Math.min(255, b + 92)}, 0.25)`,
  }
}
