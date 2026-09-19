export const gameplayTips = [
  'Double jump while airborne when you have enough charge.',
  'Slam in the air to drop quickly; on the ground it starts a slide.',
  'Beat Blast becomes a forward dash when timed to the beat with enough charge. An off-beat use still costs a little charge.',
  'Antigrav and Slow-Mo drain your charge while held.',
  'Phase Shift costs charge and needs time to recharge.',
  'A local audio track generates a custom level.',
] as const

export function pickGameplayTip(previous?: string, random = Math.random): string {
  const choices = gameplayTips.filter((tip) => tip !== previous)
  return choices[Math.floor(random() * choices.length)] ?? gameplayTips[0]
}
