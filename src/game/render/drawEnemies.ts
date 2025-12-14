import type { GameRuntime } from '../core/gameState'
import type { Palette } from './types'
import { withAlpha } from './colors'

export function drawEnemies(ctx: CanvasRenderingContext2D, runtime: GameRuntime, palette: Palette) {
  const enemyPalettes = {
    gomba: { body: '#fb923c', accent: '#fdba74', face: '#0b1224', blush: '#fecdd3' },
    spiker: { body: '#38bdf8', accent: '#a855f7', face: '#0b1224', blush: '#c4b5fd' },
    floater: { body: '#a5f3fc', accent: '#e0f2fe', face: '#0b1224', blush: '#fecdd3' },
  }

  for (const e of runtime.enemies) {
    ctx.save()

    const bobY = e.bob || 0
    const squash = e.squash || 1
    const enemyColors = enemyPalettes[e.type as keyof typeof enemyPalettes] || enemyPalettes.gomba

    if (e.telegraph && e.telegraph > 0) {
      const t = e.telegraph
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(performance.now() * 0.015)
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 3
      ctx.strokeRect(e.x - 4, e.y - 4, e.width + 8, e.height + 8)
      ctx.restore()
      continue
    }

    if (!e.squished) {
      ctx.translate(e.x + e.width / 2, e.y + e.height / 2 + bobY)
      ctx.scale(1 / squash, squash)
      ctx.translate(-e.width / 2, -e.height / 2)

      if (e.type === 'gomba') {
        ctx.fillStyle = enemyColors.body
        ctx.beginPath()
        ctx.roundRect(0, 4, e.width, e.height - 4, 8)
        ctx.fill()

        ctx.save()
        ctx.translate(e.width / 2, 4)
        ctx.rotate(-0.25)
        ctx.fillStyle = '#bef264'
        ctx.beginPath()
        ctx.moveTo(-2, 0)
        ctx.quadraticCurveTo(-6, -10, 4, -14)
        ctx.quadraticCurveTo(10, -4, 0, 2)
        ctx.closePath()
        ctx.fill()
        ctx.restore()

        ctx.fillStyle = enemyColors.accent
        ctx.beginPath()
        ctx.roundRect(4, e.height - 12, e.width - 8, 10, 5)
        ctx.fill()

        const eyeOffset = 7
        const eyeY = e.height * 0.55
        const eyeR = 2.6
        ctx.fillStyle = enemyColors.face
        ctx.beginPath()
        ctx.arc(eyeOffset, eyeY - 4, eyeR, 0, Math.PI * 2)
        ctx.arc(e.width - eyeOffset, eyeY - 4, eyeR, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#fef9c3'
        ctx.beginPath()
        ctx.arc(eyeOffset - 1, eyeY - 5, 0.8, 0, Math.PI * 2)
        ctx.arc(e.width - eyeOffset + 1, eyeY - 5, 0.8, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = enemyColors.face
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.arc(e.width / 2, eyeY + 2, 3, 0, Math.PI)
        ctx.stroke()

        ctx.globalAlpha = 0.7
        ctx.fillStyle = enemyColors.blush
        ctx.beginPath()
        ctx.arc(eyeOffset - 1, eyeY, 2, 0, Math.PI * 2)
        ctx.arc(e.width - eyeOffset + 1, eyeY, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      if (e.type === 'spiker') {
        const baseH = e.height * 0.75
        const spikesIntact = e.spikes !== false
        const concerned = e.concerned || !spikesIntact
        ctx.fillStyle = enemyColors.body
        ctx.beginPath()
        ctx.roundRect(0, e.height - baseH, e.width, baseH, 7)
        ctx.fill()

        ctx.fillStyle = enemyColors.accent
        ctx.beginPath()
        if (spikesIntact) {
          ctx.moveTo(2, e.height - baseH + 4)
          ctx.lineTo(e.width / 2, -6)
          ctx.lineTo(e.width - 2, e.height - baseH + 4)
          ctx.closePath()
          ctx.fill()
        } else {
          ctx.roundRect(4, e.height - baseH + 2, e.width - 8, 8, 3)
          ctx.fill()
        }

        ctx.fillStyle = enemyColors.face
        const eyeY = e.height - baseH + 10
        const eyeR = 2
        ctx.beginPath()
        ctx.arc(e.width / 2 - 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#fef3c7'
        ctx.beginPath()
        ctx.arc(e.width / 2 - 7, eyeY - 1.5, 0.8, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 5, eyeY - 1.5, 0.8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fb7185'
        ctx.beginPath()
        ctx.moveTo(4, e.height - baseH + 8)
        ctx.bezierCurveTo(2, e.height - baseH + 4, 8, e.height - baseH + 2, 10, e.height - baseH + 8)
        ctx.bezierCurveTo(8, e.height - baseH + 14, 2, e.height - baseH + 12, 4, e.height - baseH + 8)
        ctx.fill()

        ctx.strokeStyle = enemyColors.face
        ctx.lineWidth = 1.6
        ctx.beginPath()
        if (concerned) {
          ctx.moveTo(e.width / 2 - 5, e.height - baseH + 17)
          ctx.quadraticCurveTo(e.width / 2, e.height - baseH + 22, e.width / 2 + 5, e.height - baseH + 17)
        } else {
          ctx.moveTo(e.width / 2 - 4, e.height - baseH + 15)
          ctx.quadraticCurveTo(e.width / 2, e.height - baseH + (e.confident ? 12 : 16), e.width / 2 + 4, e.height - baseH + 15)
        }
        ctx.stroke()

        ctx.globalAlpha = 0.6
        ctx.fillStyle = enemyColors.blush
        ctx.fillRect(5, e.height - baseH + 14, 4, 2)
        ctx.fillRect(e.width - 9, e.height - baseH + 14, 4, 2)
        ctx.globalAlpha = 1
      }

      if (e.type === 'floater') {
        const rage = e.rage ?? 0
        const r = Math.round(150 + rage * 40)
        const g = Math.round(220 - rage * 40)
        const b = Math.round(245 - rage * 50)
        ctx.fillStyle = `rgb(${r},${Math.max(g, 150)},${Math.max(b, 140)})`

        ctx.beginPath()
        ctx.arc(e.width / 2, e.height / 2, e.width / 2, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = withAlpha(enemyColors.accent, 0.9)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(e.width / 2, e.height / 2 - 10, e.width / 2.2, 0, Math.PI * 2)
        ctx.stroke()

        ctx.fillStyle = enemyColors.accent
        ctx.beginPath()
        ctx.arc(e.width / 2 - 4, e.height / 2 - 4, e.width / 3.4, 0, Math.PI * 2)
        ctx.fill()

        const eyeY = e.height * 0.52
        const eyeR = 1.8
        ctx.fillStyle = enemyColors.face
        ctx.beginPath()
        ctx.arc(e.width / 2 - 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#fef3c7'
        ctx.beginPath()
        ctx.arc(e.width / 2 - 7, eyeY - 1, 0.7, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 5, eyeY - 1, 0.7, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = enemyColors.face
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(e.width / 2, eyeY + 4, 3.2, 0, Math.PI)
        ctx.stroke()

        ctx.globalAlpha = 0.65
        ctx.fillStyle = enemyColors.blush
        ctx.fillRect(e.width / 2 - 10, eyeY + 2, 4, 2.4)
        ctx.fillRect(e.width / 2 + 6, eyeY + 2, 4, 2.4)
        ctx.globalAlpha = 1
      }
    }
    if (e.squished) {
      ctx.save()
      const bodyH = Math.max(e.pancakeHeight ?? e.height * 0.35, e.currentHeight ?? e.height * 0.45)
      const yOffset = e.height - bodyH
      ctx.translate(e.x, e.y + yOffset + bobY)

      ctx.fillStyle = enemyColors.body
      ctx.beginPath()
      ctx.roundRect(0, 0, e.width, bodyH, 6)
      ctx.fill()

      ctx.globalAlpha = 0.5
      ctx.fillStyle = 'rgba(11, 18, 36, 0.2)'
      ctx.fillRect(2, bodyH - 4, e.width - 4, 3)
      ctx.globalAlpha = 1

      const shockPulse = 1 + Math.max(0, e.squishTimer ?? 0) * 3
      const eyeR = 1.8 * shockPulse
      const eyeOffset = e.width * 0.28
      const faceY = bodyH * 0.55
      ctx.fillStyle = enemyColors.face
      ctx.beginPath()
      ctx.arc(eyeOffset, faceY, eyeR, 0, Math.PI * 2)
      ctx.arc(e.width - eyeOffset, faceY, eyeR, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = enemyColors.face
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(e.width / 2, faceY + 6, 3.5 * shockPulse, 0, Math.PI * 2)
      ctx.stroke()

      ctx.restore()
    }
    ctx.restore()
  }
}
