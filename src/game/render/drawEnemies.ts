import type { GameRuntime } from '../core/gameState'
import { withAlpha } from './colors'
import { clamp } from '../systems/physicsSystem'

export function drawEnemies(ctx: CanvasRenderingContext2D, runtime: GameRuntime) {
  const enemyPalettes = {
    gomba: {
      body: '#94a3b8',
      accent: '#22d3ee',
      face: '#0b1224',
      blush: '#cbd5f5',
      trim: '#38bdf8',
    },
    spiker: {
      body: '#64748b',
      accent: '#22d3ee',
      face: '#0b1224',
      blush: '#a5b4fc',
      trim: '#f97316',
    },
    floater: {
      body: '#cbd5f5',
      accent: '#22d3ee',
      face: '#0b1224',
      blush: '#fef9c3',
      trim: '#a855f7',
    },
  }

  for (const e of runtime.enemies) {
    ctx.save()

    const bobY = clamp(e.bob || 0, -6, 10)
    const hopPhase = performance.now() * 0.01 + e.x * 0.05
    const hopLift = e.type === 'floater' ? 0 : Math.abs(Math.sin(hopPhase)) * 8
    const squash = clamp(e.squash || 1, 0.85, 1.2)
    const enemyColors = enemyPalettes[e.type as keyof typeof enemyPalettes] || enemyPalettes.gomba

    if (e.telegraph && e.telegraph > 0) {
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(performance.now() * 0.015)
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 3
      ctx.strokeRect(e.x - 4, e.y - 4, e.width + 8, e.height + 8)
      ctx.restore()
      continue
    }

    if (!e.squished) {
      if (e.type !== 'floater') {
        ctx.fillStyle = withAlpha(enemyColors.face, 0.15)
        ctx.beginPath()
        ctx.ellipse(
          e.x + e.width / 2,
          e.y + e.height + 4,
          (e.width * 0.9) / 2,
          3,
          0,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }

      ctx.translate(e.x + e.width / 2, e.y + e.height / 2 + bobY - hopLift)
      ctx.scale(1 / squash, squash)
      ctx.translate(-e.width / 2, -e.height / 2)

      if (e.type === 'gomba') {
        const metal = ctx.createLinearGradient(0, 4, 0, e.height)
        metal.addColorStop(0, withAlpha(enemyColors.body, 0.95))
        metal.addColorStop(1, withAlpha(enemyColors.body, 0.8))
        ctx.fillStyle = metal
        ctx.beginPath()
        ctx.roundRect(0, 4, e.width, e.height - 4, 9)
        ctx.fill()

        ctx.save()
        ctx.fillStyle = enemyColors.trim
        const finW = 8
        const finH = 12
        ctx.save()
        ctx.translate(-2, 6)
        ctx.rotate(-0.2)
        ctx.beginPath()
        ctx.moveTo(0, finH)
        ctx.quadraticCurveTo(finW * 0.1, 0, finW, -1)
        ctx.quadraticCurveTo(finW * 0.4, finH * 0.5, 0, finH)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
        ctx.save()
        ctx.translate(e.width + 2, 6)
        ctx.rotate(0.2)
        ctx.beginPath()
        ctx.moveTo(0, finH)
        ctx.quadraticCurveTo(-finW * 0.1, 0, -finW, -1)
        ctx.quadraticCurveTo(-finW * 0.4, finH * 0.5, 0, finH)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
        ctx.restore()

        ctx.fillStyle = withAlpha(enemyColors.face, 0.1)
        ctx.fillRect(3, e.height - 10, e.width - 6, 8)

        ctx.fillStyle = withAlpha(enemyColors.accent, 0.85)
        ctx.fillRect(6, e.height * 0.34, e.width - 12, e.height * 0.24)
        ctx.fillStyle = withAlpha('#0f172a', 0.6)
        ctx.fillRect(8, e.height * 0.36, e.width - 16, e.height * 0.2)

        ctx.fillStyle = enemyColors.accent
        ctx.beginPath()
        ctx.arc(e.width / 2, e.height * 0.34, 5, 0, Math.PI * 2)
        ctx.fill()

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

        ctx.fillStyle = '#f8fafc'
        ctx.beginPath()
        ctx.arc(eyeOffset - 1, eyeY - 5, 0.8, 0, Math.PI * 2)
        ctx.arc(e.width - eyeOffset + 1, eyeY - 5, 0.8, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = enemyColors.face
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(e.width / 2 - 4, eyeY + 1)
        ctx.lineTo(e.width / 2 + 4, eyeY + 1)
        ctx.stroke()

        ctx.globalAlpha = 0.6
        ctx.fillStyle = enemyColors.blush
        ctx.fillRect(eyeOffset - 3, eyeY, 6, 2)
        ctx.fillRect(e.width - eyeOffset - 3, eyeY, 6, 2)
        ctx.globalAlpha = 1
      }

      if (e.type === 'spiker') {
        const baseH = e.height * 0.8
        const spikesIntact = e.spikes !== false
        const concerned = e.concerned || !spikesIntact
        const plate = ctx.createLinearGradient(0, e.height - baseH, 0, e.height)
        plate.addColorStop(0, withAlpha(enemyColors.body, 0.95))
        plate.addColorStop(1, withAlpha(enemyColors.body, 0.8))
        ctx.fillStyle = plate
        ctx.beginPath()
        ctx.roundRect(0, e.height - baseH, e.width, baseH, 8)
        ctx.fill()

        ctx.fillStyle = spikesIntact ? enemyColors.trim : withAlpha(enemyColors.trim, 0.6)
        ctx.beginPath()
        ctx.moveTo(2, e.height - baseH + 6)
        ctx.lineTo(e.width / 2, spikesIntact ? -6 : 4)
        ctx.lineTo(e.width - 2, e.height - baseH + 6)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = withAlpha(enemyColors.accent, 0.8)
        ctx.beginPath()
        ctx.roundRect(3, e.height - baseH + 10, e.width - 6, baseH - 18, 6)
        ctx.fill()

        ctx.fillStyle = withAlpha('#0f172a', 0.55)
        ctx.fillRect(6, e.height - baseH + 14, e.width - 12, baseH - 26)

        ctx.strokeStyle = enemyColors.accent
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(e.width / 2, e.height - baseH + 12)
        ctx.lineTo(e.width / 2, e.height - baseH + 20)
        ctx.moveTo(4, e.height - 10)
        ctx.lineTo(e.width - 4, e.height - 10)
        ctx.stroke()

        ctx.fillStyle = enemyColors.face
        const eyeY = e.height - baseH + 18
        const eyeR = 2.2
        ctx.beginPath()
        ctx.arc(e.width / 2 - 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#e2e8f0'
        ctx.beginPath()
        ctx.arc(e.width / 2 - 7, eyeY - 1.5, 0.8, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 5, eyeY - 1.5, 0.8, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = enemyColors.face
        ctx.lineWidth = 1.8
        ctx.beginPath()
        if (concerned) {
          ctx.moveTo(e.width / 2 - 5, eyeY + 6)
          ctx.quadraticCurveTo(e.width / 2, eyeY + 10, e.width / 2 + 5, eyeY + 6)
        } else {
          ctx.moveTo(e.width / 2 - 5, eyeY + 4)
          ctx.quadraticCurveTo(e.width / 2, eyeY + (e.confident ? 0 : 6), e.width / 2 + 5, eyeY + 4)
        }
        ctx.stroke()

        ctx.globalAlpha = 0.6
        ctx.fillStyle = enemyColors.blush
        ctx.fillRect(4, eyeY + 4, 5, 2)
        ctx.fillRect(e.width - 9, eyeY + 4, 5, 2)
        ctx.globalAlpha = 1
      }

      if (e.type === 'floater') {
        const rage = e.rage ?? 0
        const core = ctx.createRadialGradient(
          e.width / 2,
          e.height / 2,
          4,
          e.width / 2,
          e.height / 2,
          e.width / 2,
        )
        core.addColorStop(0, withAlpha(enemyColors.accent, 0.95))
        core.addColorStop(1, withAlpha(enemyColors.body, 0.8))
        ctx.fillStyle = core
        ctx.beginPath()
        ctx.arc(e.width / 2, e.height / 2, e.width / 2, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = withAlpha(enemyColors.trim, 0.8)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(e.width / 2, e.height / 2, e.width / 2.4, 0, Math.PI * 2)
        ctx.stroke()

        ctx.strokeStyle = withAlpha(enemyColors.accent, 0.6 + rage * 0.3)
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(e.width / 2, e.height / 2 - 10, e.width / 3, 0, Math.PI * 2)
        ctx.stroke()

        const eyeY = e.height * 0.52
        const eyeR = 1.9
        ctx.fillStyle = enemyColors.face
        ctx.beginPath()
        ctx.arc(e.width / 2 - 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 6, eyeY, eyeR, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#e2e8f0'
        ctx.beginPath()
        ctx.arc(e.width / 2 - 7, eyeY - 1, 0.7, 0, Math.PI * 2)
        ctx.arc(e.width / 2 + 5, eyeY - 1, 0.7, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = enemyColors.face
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(e.width / 2, eyeY + 4, 3.2, 0, Math.PI)
        ctx.stroke()

        ctx.globalAlpha = 0.6
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
