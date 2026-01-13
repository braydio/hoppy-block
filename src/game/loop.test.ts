import { describe, expect, it } from 'vitest'
import { getSupportingGroundSegment } from './loop'
import type { GroundSegment } from './core/types'

describe('getSupportingGroundSegment', () => {
  const segments: GroundSegment[] = [
    { start: 0, end: 120, y: 300 },
    { start: 140, end: 220, y: 340 },
  ]

  it('requires horizontal overlap and vertical alignment', () => {
    expect(getSupportingGroundSegment(segments, 20, 40, 300, 4)).toEqual(segments[0])
    expect(getSupportingGroundSegment(segments, 20, 40, 310, 4)).toBeNull()
    expect(getSupportingGroundSegment(segments, 200, 40, 340, 4)).toBeNull()
  })
})
