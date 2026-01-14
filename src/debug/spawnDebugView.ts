import type { UiState } from '../game/core/gameState'
import type { SpawnAttribution } from './spawnCauses'
import type { Enemy } from '../game/core/types'

type AudioTimelineEntry = {
  time: number
  bass: number
  mids: number
  highs: number
  intensity: number
  drive: number
  loudnessDelta: number
}

type SpawnHistoryEntry = {
  attribution: SpawnAttribution
  x: number
  y: number
  time: number
  enemyType?: Enemy['type']
}

type SpawnDebugTick = {
  beat: number
  time: number
  targetPerBeat: number
  spawns: number
}

type LaneDebugLane = {
  levelIndex: number
  y: number
  safe: boolean
}

type LaneDebugEntry = {
  time: number
  laneIndex: number | null
  lanes: LaneDebugLane[]
}

type SpawnDebugData = {
  timeline: AudioTimelineEntry[]
  spawnHistory: SpawnHistoryEntry[]
  spawnTicks: SpawnDebugTick[]
  laneHistory: LaneDebugEntry[]
  currentTime: number
}

type Range = { min: number; max: number }

/**
 * Spawn debug renderer that visualizes audio energy, spawns, and lane safety over time.
 *
 * @param canvas Canvas used to render the debug overlay.
 * @returns Pointer handlers and a draw function for the overlay.
 */
export function createSpawnDebugView(canvas: HTMLCanvasElement) {
  let hoveredIndex: number | null = null
  let pinnedIndex: number | null = null
  let frozenRange: Range | null = null

  const colors = {
    bass: 'rgba(34, 197, 94, 0.6)',
    mids: 'rgba(56, 189, 248, 0.6)',
    highs: 'rgba(248, 113, 113, 0.6)',
    intensity: 'rgba(244, 114, 182, 0.7)',
    drive: 'rgba(56, 189, 248, 0.7)',
    loudness: 'rgba(250, 204, 21, 0.7)',
  }

  const typeColors: Record<Enemy['type'], string> = {
    gomba: '#f97316',
    spiker: '#a855f7',
    floater: '#22d3ee',
  }

  const laneColors = {
    safe: 'rgba(34, 197, 94, 0.55)',
    unsafe: 'rgba(248, 113, 113, 0.55)',
    path: 'rgba(226, 232, 240, 0.85)',
    currentTime: 'rgba(226, 232, 240, 0.55)',
  }

  /**
   * Ensure the canvas matches the layout size needed for the debug panels.
   */
  function ensureCanvasSize() {
    const parentWidth = canvas.parentElement?.clientWidth ?? 800
    const width = Math.max(320, parentWidth)
    const height = 520
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
  }

  function getRange(timeline: AudioTimelineEntry[]) {
    if (timeline.length === 0) return { min: 0, max: 1 }
    const min = timeline[0]?.time ?? 0
    const max = timeline[timeline.length - 1]?.time ?? min + 1
    return { min, max: Math.max(min + 0.0001, max) }
  }

  function timeToX(t: number, range: Range, width: number, pad: number) {
    const pct = (t - range.min) / (range.max - range.min)
    return pad + pct * (width - pad * 2)
  }

  function drawCurve(
    ctx: CanvasRenderingContext2D,
    timeline: AudioTimelineEntry[],
    getValue: (p: AudioTimelineEntry) => number,
    range: Range,
    xMin: number,
    xMax: number,
    yTop: number,
    yBottom: number,
    stroke: string,
    fill: string,
  ) {
    if (timeline.length < 2) return
    ctx.beginPath()
    for (let i = 0; i < timeline.length; i += 1) {
      const p = timeline[i]
      if (!p) continue
      const x = timeToX(p.time, range, xMax - xMin, 0) + xMin
      const v = Math.max(0, Math.min(1, getValue(p)))
      const y = yBottom - v * (yBottom - yTop)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.lineTo(xMax, yBottom)
    ctx.lineTo(xMin, yBottom)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
  }

  function getSelectedIndex() {
    if (pinnedIndex != null) return pinnedIndex
    if (hoveredIndex != null) return hoveredIndex
    return null
  }

  function getSpawnForTime(data: SpawnDebugData, time: number) {
    let bestIndex: number | null = null
    let bestDist = Infinity
    for (let i = 0; i < data.spawnHistory.length; i += 1) {
      const entry = data.spawnHistory[i]
      if (!entry) continue
      const dist = Math.abs(entry.time - time)
      if (dist < bestDist) {
        bestDist = dist
        bestIndex = i
      }
    }
    if (bestDist > 0.25) return null
    return bestIndex
  }

  /**
   * Find the nearest lane debug entry for a given timestamp.
   *
   * @param history Lane debug samples.
   * @param time Timestamp to search around.
   * @returns Closest entry or null when history is empty.
   */
  function getLaneEntryForTime(history: LaneDebugEntry[], time: number) {
    let bestEntry: LaneDebugEntry | null = null
    let bestDist = Infinity
    for (const entry of history) {
      const dist = Math.abs(entry.time - time)
      if (dist < bestDist) {
        bestDist = dist
        bestEntry = entry
      }
    }
    return bestEntry
  }

  function drawInfoBox(
    ctx: CanvasRenderingContext2D,
    entry: SpawnHistoryEntry,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    ctx.save()
    ctx.fillStyle = 'rgba(2, 6, 23, 0.92)'
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
    ctx.lineWidth = 1
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)

    ctx.fillStyle = '#e2e8f0'
    ctx.font = '12px system-ui'
    ctx.fillText('Spawn Attribution', x + 10, y + 18)
    ctx.font = '11px system-ui'

    let offsetY = y + 36
    for (const cause of entry.attribution.causes) {
      let label = ''
      if (cause.kind === 'beat') label = `beat: ${cause.beat}`
      if (cause.kind === 'band') label = `band: ${cause.band} (${cause.value.toFixed(2)})`
      if (cause.kind === 'intensity') label = `intensity: ${cause.value.toFixed(2)}`
      if (cause.kind === 'drive') label = `drive: ${cause.value.toFixed(2)}`
      if (cause.kind === 'dynamics') label = `dynamics: ${cause.delta.toFixed(2)}`
      if (cause.kind === 'patternBias')
        label = `pattern: ${cause.signature} (${cause.bias.toFixed(2)})`
      ctx.fillText(label, x + 10, offsetY)
      offsetY += 14
      if (offsetY > y + h - 10) break
    }
    ctx.restore()
  }

  /**
   * Render the lane timeline, unsafe gaps, and player lane track.
   *
   * @param ctx Canvas context used for drawing.
   * @param history Lane debug samples.
   * @param range Current time range.
   * @param panel Panel bounds.
   * @param currentTime Audio time cursor.
   */
  function drawLaneTimeline(
    ctx: CanvasRenderingContext2D,
    history: LaneDebugEntry[],
    range: Range,
    panel: { x: number; y: number; width: number; height: number; pad: number },
    currentTime: number,
  ) {
    if (history.length === 0) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)'
      ctx.font = '11px system-ui'
      ctx.fillText('Lane data will appear once the run starts.', panel.x + 10, panel.y + 18)
      return
    }

    const [firstEntry] = history
    if (!firstEntry) return
    const referenceEntry = history.reduce(
      (best, entry) => (entry.lanes.length > best.lanes.length ? entry : best),
      firstEntry,
    )
    const laneCount = Math.max(1, referenceEntry.lanes.length)
    const laneRowHeight = panel.height / laneCount

    for (let i = 0; i < history.length; i += 1) {
      const entry = history[i]
      if (!entry) continue
      const nextEntry = history[i + 1]
      const x = timeToX(entry.time, range, canvas.width, panel.pad)
      const nextX = nextEntry ? timeToX(nextEntry.time, range, canvas.width, panel.pad) : x + 3
      const barWidth = Math.max(1, nextX - x)
      for (let laneIndex = 0; laneIndex < laneCount; laneIndex += 1) {
        const lane = entry.lanes[laneIndex]
        const safe = lane?.safe ?? false
        ctx.fillStyle = safe ? laneColors.safe : laneColors.unsafe
        ctx.fillRect(x, panel.y + laneIndex * laneRowHeight, barWidth, laneRowHeight - 1)
      }
    }

    ctx.strokeStyle = laneColors.path
    ctx.lineWidth = 1.5
    ctx.beginPath()
    let pathStarted = false
    for (const entry of history) {
      if (entry.laneIndex == null) continue
      const x = timeToX(entry.time, range, canvas.width, panel.pad)
      const y = panel.y + (entry.laneIndex + 0.5) * laneRowHeight
      if (!pathStarted) {
        ctx.moveTo(x, y)
        pathStarted = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()

    const currentEntry = getLaneEntryForTime(history, currentTime)
    const currentLaneLabel =
      currentEntry?.laneIndex != null
        ? `Current lane: ${currentEntry.laneIndex}`
        : 'Current lane: -'
    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)'
    ctx.font = '11px system-ui'
    ctx.fillText(currentLaneLabel, panel.x + panel.width - 150, panel.y + 14)

    const currentX = timeToX(currentTime, range, canvas.width, panel.pad)
    ctx.strokeStyle = laneColors.currentTime
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(currentX, panel.y)
    ctx.lineTo(currentX, panel.y + panel.height)
    ctx.stroke()

    ctx.fillStyle = 'rgba(226, 232, 240, 0.8)'
    ctx.font = '10px system-ui'
    for (let laneIndex = 0; laneIndex < laneCount; laneIndex += 1) {
      const lane = referenceEntry?.lanes[laneIndex]
      const labelY = panel.y + laneIndex * laneRowHeight + 12
      const label = lane ? `Lane ${laneIndex} · y=${Math.round(lane.y)}` : `Lane ${laneIndex}`
      ctx.fillText(label, panel.x + 8, labelY)
    }

    const legendY = panel.y + panel.height - 10
    ctx.fillStyle = laneColors.safe
    ctx.fillRect(panel.x + panel.width - 160, legendY - 8, 10, 10)
    ctx.fillStyle = 'rgba(226, 232, 240, 0.8)'
    ctx.fillText('Safe', panel.x + panel.width - 144, legendY)
    ctx.fillStyle = laneColors.unsafe
    ctx.fillRect(panel.x + panel.width - 96, legendY - 8, 10, 10)
    ctx.fillStyle = 'rgba(226, 232, 240, 0.8)'
    ctx.fillText('Unsafe', panel.x + panel.width - 80, legendY)
  }

  /**
   * Draw the spawn debug overlay when debug mode is active.
   *
   * @param data Debug data payload from the game loop.
   * @param ui UI state with debug flag.
   */
  function draw(data: SpawnDebugData, ui: UiState) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!ui.debugAudioSpawnView.value) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    ensureCanvasSize()

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(2, 6, 23, 0.9)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (data.timeline.length === 0) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.8)'
      ctx.font = '12px system-ui'
      ctx.fillText('Waiting for audio data...', 18, 24)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)'
      ctx.font = '11px system-ui'
      ctx.fillText('Load a track and start playback to populate the timelines.', 18, 42)
      return
    }

    const pad = 18
    const bandHeight = 140
    const gap = 16
    const magHeight = 110
    const laneHeight = 90
    const infoHeight = Math.max(
      32,
      canvas.height - pad * 2 - bandHeight - magHeight - laneHeight - gap * 3,
    )
    const bandTop = pad
    const magTop = bandTop + bandHeight + gap
    const laneTop = magTop + magHeight + gap
    const infoTop = laneTop + laneHeight + gap
    const xMin = pad
    const xMax = canvas.width - pad

    const range = frozenRange ?? getRange(data.timeline)

    if (!frozenRange && getSelectedIndex() != null) {
      frozenRange = range
    }
    if (getSelectedIndex() == null) {
      frozenRange = null
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'
    ctx.fillRect(xMin, bandTop, xMax - xMin, bandHeight)
    ctx.fillRect(xMin, magTop, xMax - xMin, magHeight)
    ctx.fillRect(xMin, laneTop, xMax - xMin, laneHeight)

    drawCurve(
      ctx,
      data.timeline,
      (p) => p.bass,
      range,
      xMin,
      xMax,
      bandTop + 8,
      bandTop + bandHeight - 8,
      colors.bass,
      'rgba(34, 197, 94, 0.15)',
    )
    drawCurve(
      ctx,
      data.timeline,
      (p) => p.mids,
      range,
      xMin,
      xMax,
      bandTop + 8,
      bandTop + bandHeight - 8,
      colors.mids,
      'rgba(56, 189, 248, 0.12)',
    )
    drawCurve(
      ctx,
      data.timeline,
      (p) => p.highs,
      range,
      xMin,
      xMax,
      bandTop + 8,
      bandTop + bandHeight - 8,
      colors.highs,
      'rgba(248, 113, 113, 0.12)',
    )

    for (const entry of data.spawnHistory) {
      if (!entry.attribution) continue
      const x = timeToX(entry.time, range, canvas.width, pad)
      const bandY =
        entry.attribution.dominantBand === 'high'
          ? bandTop + 18
          : entry.attribution.dominantBand === 'mid'
            ? bandTop + bandHeight * 0.5
            : bandTop + bandHeight - 18
      ctx.fillStyle = entry.enemyType ? typeColors[entry.enemyType] : '#e2e8f0'
      ctx.beginPath()
      ctx.arc(x, bandY, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    drawCurve(
      ctx,
      data.timeline,
      (p) => p.intensity,
      range,
      xMin,
      xMax,
      magTop + 8,
      magTop + magHeight - 8,
      colors.intensity,
      'rgba(244, 114, 182, 0.1)',
    )
    drawCurve(
      ctx,
      data.timeline,
      (p) => p.drive,
      range,
      xMin,
      xMax,
      magTop + 8,
      magTop + magHeight - 8,
      colors.drive,
      'rgba(56, 189, 248, 0.1)',
    )
    drawCurve(
      ctx,
      data.timeline,
      (p) => Math.min(1, Math.abs(p.loudnessDelta)),
      range,
      xMin,
      xMax,
      magTop + 8,
      magTop + magHeight - 8,
      colors.loudness,
      'rgba(250, 204, 21, 0.1)',
    )

    const maxTarget = Math.max(1, ...data.spawnTicks.map((t) => t.targetPerBeat))
    const maxSpawns = Math.max(1, ...data.spawnTicks.map((t) => t.spawns))
    for (const tick of data.spawnTicks) {
      const x = timeToX(tick.time, range, canvas.width, pad)
      const barH = (tick.targetPerBeat / maxTarget) * (magHeight - 16)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)'
      ctx.fillRect(x - 2, magTop + magHeight - 8 - barH, 4, barH)

      const dotY = magTop + magHeight - 8 - (tick.spawns / maxSpawns) * (magHeight - 16)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)'
      ctx.beginPath()
      ctx.arc(x, dotY, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    drawLaneTimeline(
      ctx,
      data.laneHistory,
      range,
      { x: xMin, y: laneTop, width: xMax - xMin, height: laneHeight, pad },
      data.currentTime,
    )

    const selectedIndex = getSelectedIndex()
    if (selectedIndex != null) {
      const entry = data.spawnHistory[selectedIndex]
      if (entry) {
        const x = timeToX(entry.time, range, canvas.width, pad)
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, bandTop)
        ctx.lineTo(x, magTop + magHeight)
        ctx.stroke()

        drawInfoBox(ctx, entry, xMin, infoTop, xMax - xMin, infoHeight)
      }
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)'
      ctx.font = '11px system-ui'
      ctx.fillText('Hover or click a spawn marker to inspect causes.', xMin, infoTop + 20)
    }
  }

  /**
   * Update hover state for spawn attribution markers.
   *
   * @param event Pointer event for hover position.
   * @param data Debug data payload.
   * @param ui UI state with debug flag.
   */
  function onPointerMove(event: PointerEvent, data: SpawnDebugData, ui: UiState) {
    if (!ui.debugAudioSpawnView.value || pinnedIndex != null) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const range = frozenRange ?? getRange(data.timeline)
    const pad = 18
    const t = range.min + ((x - pad) / (canvas.width - pad * 2)) * (range.max - range.min)
    hoveredIndex = getSpawnForTime(data, t)
  }

  /**
   * Pin the spawn attribution tooltip on click.
   *
   * @param event Pointer event for the click.
   * @param data Debug data payload.
   * @param ui UI state with debug flag.
   */
  function onPointerDown(event: PointerEvent, data: SpawnDebugData, ui: UiState) {
    if (!ui.debugAudioSpawnView.value) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const range = frozenRange ?? getRange(data.timeline)
    const pad = 18
    const t = range.min + ((x - pad) / (canvas.width - pad * 2)) * (range.max - range.min)
    const next = getSpawnForTime(data, t)
    if (next != null && pinnedIndex === next) {
      pinnedIndex = null
    } else {
      pinnedIndex = next
    }
  }

  /**
   * Clear hover state when leaving the canvas.
   */
  function onPointerLeave() {
    if (pinnedIndex == null) hoveredIndex = null
  }

  return {
    draw,
    onPointerMove,
    onPointerDown,
    onPointerLeave,
  }
}
