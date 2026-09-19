import { describe, expect, it } from 'vitest'
import { classifyTouchGesture, touchGestureAction } from './touchGestures'

describe('classifyTouchGesture', () => {
  it('keeps jitter as a tap and ignores ambiguous drags', () => {
    expect(classifyTouchGesture(8, -9)).toBe('tap')
    expect(classifyTouchGesture(32, 31)).toBe(null)
  })
  it('recognizes only deliberate dominant-axis swipes', () => {
    expect(classifyTouchGesture(4, -48)).toBe('up')
    expect(classifyTouchGesture(3, 50)).toBe('down')
    expect(classifyTouchGesture(-55, 8)).toBe('left')
    expect(classifyTouchGesture(55, 8)).toBe(null)
  })
  it('keeps swipe down dedicated to Slam', () => {
    expect(touchGestureAction('down')).toBe('slam')
    expect(touchGestureAction('left')).toBe('laneDown')
    expect(touchGestureAction('up')).toBe('laneUp')
    expect(touchGestureAction('tap')).toBe('jump')
  })
})
