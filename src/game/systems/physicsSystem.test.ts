import { describe, expect, it } from 'vitest'
import { detectGroundContact, integratePlayerPhysics } from './physicsSystem'

describe('detectGroundContact', () => {
  it('detects when a body crosses the ground plane', () => {
    expect(detectGroundContact(280, 300, 295, 2)).toBe(true)
  })

  it('ignores motion that remains above the ground plane', () => {
    expect(detectGroundContact(280, 288, 295, 2)).toBe(false)
  })
})

describe('integratePlayerPhysics', () => {
  it('updates velocity and position with gravity and scaling', () => {
    const player = { y: 0, vy: 0 }
    integratePlayerPhysics(player, 100, 0.5, 1, 2)
    expect(player.vy).toBeCloseTo(100)
    expect(player.y).toBeCloseTo(50)
  })
})
