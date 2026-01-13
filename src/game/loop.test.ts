import { describe, expect, it } from 'vitest'
import { getSupportingGroundSegment } from './loop'
import type { GroundSegment } from './core/types'

describe('getSupportingGroundSegment', () => {
  const segments: GroundSegment[] = [
    { start: 0, end: 120, y: 300, levelIndex: 0, safe: true },
    { start: 140, end: 220, y: 340, levelIndex: 1, safe: true },
  ]

  it('requires horizontal overlap and vertical alignment', () => {
    expect(getSupportingGroundSegment(segments, 20, 40, 300, 4)).toEqual(segments[0])
    expect(getSupportingGroundSegment(segments, 20, 40, 310, 4)).toBeNull()
    expect(getSupportingGroundSegment(segments, 230, 40, 340, 4)).toBeNull()
  })
})
