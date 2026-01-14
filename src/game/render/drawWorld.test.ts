import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { GameRuntime, UiState } from '../core/gameState'
import type { Palette } from './types'
import { drawWorld } from './drawWorld'

type FillCall = {
  x: number
  y: number
  w: number
  h: number
  alpha: number
  fillStyle: string | CanvasGradient | CanvasPattern
}

function createMockContext() {
  const fillCalls: FillCall[] = []
  let lineDash: number[] = []
  const stateStack: Array<{
    fillStyle: string | CanvasGradient | CanvasPattern
    strokeStyle: string | CanvasGradient | CanvasPattern
    globalAlpha: number
    lineWidth: number
    lineDash: number[]
  }> = []
  const ctx = {
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    strokeStyle: '' as string | CanvasGradient | CanvasPattern,
    globalAlpha: 1,
    lineWidth: 1,
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      fillCalls.push({ x, y, w, h, alpha: ctx.globalAlpha, fillStyle: ctx.fillStyle })
    }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(() => {
      stateStack.push({
        fillStyle: ctx.fillStyle,
        strokeStyle: ctx.strokeStyle,
        globalAlpha: ctx.globalAlpha,
        lineWidth: ctx.lineWidth,
        lineDash: [...lineDash],
      })
    }),
    restore: vi.fn(() => {
      const prev = stateStack.pop()
      if (!prev) return
      ctx.fillStyle = prev.fillStyle
      ctx.strokeStyle = prev.strokeStyle
      ctx.globalAlpha = prev.globalAlpha
      ctx.lineWidth = prev.lineWidth
      lineDash = [...prev.lineDash]
    }),
    setLineDash: vi.fn((dash: number[]) => {
      lineDash = dash
    }),
  } as unknown as CanvasRenderingContext2D

  return { ctx, fillCalls }
}

describe('drawWorld', () => {
  it('renders per-lane ground spans with safe pulses and unsafe dashes', () => {
    const { ctx, fillCalls } = createMockContext()
    const runtime = {
      width: 200,
      height: 200,
      groundY: 150,
      phaseActive: false,
      intensityLeadInActive: false,
      groundSegments: [
        { start: 0, end: 100, y: 150, levelIndex: 1, safe: true },
        { start: 0, end: 90, y: 120, levelIndex: 0, safe: false },
      ],
    } as GameRuntime
    const ui = {
      beatPulse: ref(true),
    } as UiState
    const palette: Palette = {
      stripe: '#222222',
      ground: '#333333',
      beat: '#ffcc00',
      visBar: '#111111',
      visWave: '#222222',
      obstacle: '#444444',
      obstacleGlow: '#555555',
      player: '#ffffff',
      stroke: '#000000',
      bg: '#000000',
    }

    drawWorld(ctx, runtime, ui, palette, null)

    const groundFills = fillCalls.filter(
      (call) => call.h > 20 && (call.y === 150 || call.y === 120),
    )
    const safeFill = groundFills.find((call) => call.y === 150)

    expect(safeFill).toBeDefined()
    expect(safeFill?.x).toBe(3)
    expect(
      fillCalls.some((call) => call.y === 150 && call.h === 6 && call.fillStyle === palette.beat),
    ).toBe(true)
    expect(ctx.setLineDash).toHaveBeenCalledWith([10, 8])
  })
})
