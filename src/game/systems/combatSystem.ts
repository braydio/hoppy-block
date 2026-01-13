import { AIR_COMBO_MAX, AIR_COMBO_STEP, DASH_RANGE, SLIDE_DISTANCE } from '../core/constants'
import { clamp } from './physicsSystem'
import type { GameRuntime, UiState } from '../core/gameState'
import type { SfxName } from './audioEngine'

export function registerAirKill(runtime: GameRuntime) {
  if (runtime.player.onGround) return
  runtime.airKillCombo += 1
}

export function triggerSquishBounce(
  runtime: GameRuntime,
  intensity = 1,
  playSfx?: (name: SfxName, loudness?: number) => void,
) {
  const airborneBefore = !runtime.player.onGround
  const bounceScale = Math.max(0.6, intensity)
  runtime.player.vy = runtime.jumpVelocity * 0.7 * bounceScale
  runtime.player.onGround = false
  runtime.player.y = Math.min(runtime.player.y, runtime.groundY - runtime.player.height - 2)

  if (airborneBefore) {
    runtime.airComboMultiplier = clamp(
      runtime.airComboMultiplier + AIR_COMBO_STEP * bounceScale,
      1,
      AIR_COMBO_MAX,
    )
    runtime.airComboStreak += 1
    if (runtime.airComboStreak >= 3) {
      playSfx?.('combo', 0.9)
      runtime.requestReplayCapture = true
      runtime.airComboStreak = 0
    }
  } else {
    runtime.airComboMultiplier = 1 + AIR_COMBO_STEP * 0.5
    runtime.airComboStreak = 1
  }
}

export function applyBlastStrikes(
  runtime: GameRuntime,
  addBonus: (points: number) => void,
  addCharge: (amount: number) => void,
  playSfx?: (name: SfxName, loudness?: number) => void,
) {
  const hitLeft = runtime.player.x
  const hitRight = runtime.player.x + runtime.player.width + DASH_RANGE
  const hitTop = runtime.player.y - 6
  const hitBottom = runtime.player.y + runtime.player.height + 6
  let hitSomething = false

  runtime.obstacles = runtime.obstacles.filter((o) => {
    const overlaps =
      o.x < hitRight && o.x + o.width > hitLeft && o.y < hitBottom && o.y + o.height > hitTop
    if (overlaps) {
      hitSomething = true
      addBonus(120)
      addCharge(6)
      runtime.sonicBursts.push({
        x: o.x + o.width / 2,
        y: o.y + o.height / 2,
        r: 0,
        alpha: 0.8,
      })
      runtime.scorePops.push({
        x: o.x + o.width / 2,
        y: o.y - 10,
        value: 120,
        alpha: 1,
        vy: -90,
      })
      return false
    }
    return true
  })

  for (const e of runtime.enemies) {
    if (!e.alive || e.squished) continue
    const overlaps =
      e.x < hitRight && e.x + e.width > hitLeft && e.y < hitBottom && e.y + e.height > hitTop

    if (overlaps) {
      hitSomething = true
      e.alive = false
      e.squished = true
      e.squishTimer = 0.18
      e.currentHeight = e.height

      const points = e.type === 'floater' ? 450 : e.type === 'spiker' ? 320 : 250

      addBonus(points)
      addCharge(12)

      runtime.sonicBursts.push({
        x: e.x + e.width / 2,
        y: e.y + e.height / 2,
        r: 0,
        alpha: 0.9,
      })

      runtime.scorePops.push({
        x: e.x + e.width / 2,
        y: e.y,
        value: points,
        alpha: 1,
        vy: -90,
      })

      registerAirKill(runtime)
    }
  }

  if (hitSomething) {
    runtime.shockwaves.push({
      x: runtime.player.x + runtime.player.width / 2 + 40,
      y: runtime.player.y + runtime.player.height / 2,
      w: 70,
      h: 10,
      alpha: 0.3,
    })
    playSfx?.('blast', 0.8)
  }
}

export function applySlideStrike(
  runtime: GameRuntime,
  addBonus: (points: number) => void,
  playSfx?: (name: SfxName, loudness?: number) => void,
) {
  const slideLeft = Math.min(runtime.slideStartX, runtime.slideStartX + SLIDE_DISTANCE)
  const slideRight = Math.max(runtime.slideStartX, runtime.slideStartX + SLIDE_DISTANCE)
  const hitTop = runtime.groundY - 48
  const hitBottom = runtime.groundY + 4

  for (const e of runtime.enemies) {
    if (!e.alive || e.squished) continue
    if (e.y + e.height < hitTop || e.y > hitBottom) continue
    const overlaps = e.x < slideRight && e.x + e.width > slideLeft
    if (overlaps) {
      e.alive = false
      e.squished = true
      e.squishTimer = 0.14
      e.currentHeight = e.height
      addBonus(220)
      playSfx?.('enemyPop', 0.7)
      runtime.sonicBursts.push({
        x: e.x + e.width / 2,
        y: e.y + e.height / 2,
        r: 0,
        alpha: 0.75,
      })
      registerAirKill(runtime)
    }
  }
}

export function addScore(ui: UiState, runtime: GameRuntime) {
  const syncScore = () => {
    ui.score.value = ui.baseScore.value + ui.bonusScore.value
  }

  const addBonus = (points: number) => {
    ui.bonusScore.value += points * runtime.scoreMultiplier * runtime.airComboMultiplier
    syncScore()
  }

  const addBase = (points: number) => {
    ui.baseScore.value += points * runtime.scoreMultiplier
    syncScore()
  }

  return { addBonus, addBase, syncScore }
}
