import type { Keybinds } from './types'

export function normalizeBind(bind?: string | string[]) {
  if (!bind) return []
  return Array.isArray(bind) ? bind : [bind]
}

export function keyLabel(bind?: string | string[]) {
  const key = normalizeBind(bind)[0]
  if (!key) return ''

  const map: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: 'Space',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
  }

  const letterMatch = key.match(/^Key([A-Z])$/)
  if (letterMatch) {
    return letterMatch[1]
  }

  const digitMatch = key.match(/^Digit([0-9])$/)
  if (digitMatch) {
    return digitMatch[1]
  }

  return map[key] ?? key
}

export function matchesKey(action: string, code: string, keybinds: Keybinds) {
  return normalizeBind(keybinds[action]).includes(code)
}
