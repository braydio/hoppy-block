import { describe, expect, it } from 'vitest'
import { gameplayTips, pickGameplayTip } from './gameplayTips'

describe('pickGameplayTip', () => {
  it('chooses a listed tip and avoids immediately repeating it', () => {
    const first = pickGameplayTip(undefined, () => 0)
    expect(gameplayTips).toContain(first)
    expect(pickGameplayTip(first, () => 0)).not.toBe(first)
  })
})
