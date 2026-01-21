import { describe, expect, it } from 'vitest'
import { getAdjacentLaneY, getLaneDebugSnapshot, getSupportingGroundSegment } from './loop'
import type { GroundSegment } from './core/types'

describe('getSupportingGroundSegment', () => {
  const segments: GroundSegment[] = [
    { start: 0, end: 120, y: 300, levelIndex: 0, safe: true },
    { start: 140, end: 220, y: 340, levelIndex: 1, safe: true },
  ]

  it('requires horizontal overlap and vertical alignment', () => {
    expect(getSupportingGroundSegment(segments, 20, 40, 296, 300, 4)).toEqual(segments[0])
    expect(getSupportingGroundSegment(segments, 20, 40, 300, 310, 4)).toBeNull()
    expect(getSupportingGroundSegment(segments, 230, 40, 340, 340, 4)).toBeNull()
  })

  it('detects continuous ground crossings', () => {
    expect(getSupportingGroundSegment(segments, 20, 40, 290, 302, 4)).toEqual(segments[0])
  })
})

describe('getAdjacentLaneY', () => {
  const segments: GroundSegment[] = [
    { start: 0, end: 200, y: 420, levelIndex: 0, safe: true },
    { start: 0, end: 200, y: 340, levelIndex: 1, safe: false },
    { start: 0, end: 200, y: 260, levelIndex: 2, safe: false },
  ]

  it('selects the nearest adjacent lane to the current lane', () => {
    expect(getAdjacentLaneY(segments, 40, 40, 420)).toBe(340)
    expect(getAdjacentLaneY(segments, 40, 40, 260)).toBe(340)
    expect(getAdjacentLaneY(segments, 40, 40, 335)).toBe(260)
  })
})

describe('getLaneDebugSnapshot', () => {
  const segments: GroundSegment[] = [
    { start: 0, end: 120, y: 320, levelIndex: 0, safe: true },
    { start: 0, end: 120, y: 240, levelIndex: 1, safe: false },
    { start: 140, end: 200, y: 320, levelIndex: 0, safe: true },
  ]

  it('orders lanes by height and marks gaps as unsafe', () => {
    const snapshot = getLaneDebugSnapshot(segments, 20, 30, 320)
    expect(snapshot.laneIndex).toBe(1)
    expect(snapshot.lanes).toHaveLength(2)
    expect(snapshot.lanes[0]?.safe).toBe(false)
    expect(snapshot.lanes[1]?.safe).toBe(true)
  })

  it('treats missing overlaps as unsafe lanes', () => {
    const snapshot = getLaneDebugSnapshot(segments, 130, 5, 320)
    expect(snapshot.lanes[1]?.safe).toBe(false)
  })
})
