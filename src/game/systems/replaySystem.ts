import type { GameRuntime, UiState } from '../core/gameState'

export function setupReplayRecorder(canvas: HTMLCanvasElement, runtime: GameRuntime) {
  if (!canvas.captureStream || typeof MediaRecorder === 'undefined') return

  try {
    const stream = canvas.captureStream(60)
    runtime.replayRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })
  } catch (_) {
    try {
      const stream = canvas.captureStream(60)
      runtime.replayRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    } catch (err) {
      console.warn('replay recorder unavailable', err)
    }
  }

  if (runtime.replayRecorder) {
    runtime.replayRecorder.ondataavailable = e => {
      if (!e.data || e.data.size === 0) return
      const entry = { data: e.data, t: performance.now(), type: e.data.type }
      runtime.replayBuffer.push(entry)
      const cutoff = performance.now() - 6000
      runtime.replayBuffer = runtime.replayBuffer.filter(chunk => chunk.t >= cutoff)
    }
    runtime.replayRecorder.start(500)
  }
}

export function stopReplayRecorder(runtime: GameRuntime) {
  try {
    if (runtime.replayRecorder && runtime.replayRecorder.state === 'recording') {
      runtime.replayRecorder.stop()
    }
  } catch (_) {
    // ignore
  }
}

export function captureInstantReplay(runtime: GameRuntime, ui: UiState) {
  if (!runtime.replayBuffer.length || typeof MediaRecorder === 'undefined') return

  ui.snapshotMessageTimer.value = 3
  const now = performance.now()
  const startTime = now - 5000
  const recent = runtime.replayBuffer.filter(c => c.t >= startTime)
  if (!recent.length) return

  try {
    const first = recent[0]!
    const blob = new Blob(recent.map(r => r.data), { type: first.type || 'video/webm' })
    if (ui.replayVideoUrl.value) URL.revokeObjectURL(ui.replayVideoUrl.value)
    ui.replayVideoUrl.value = URL.createObjectURL(blob)
    ui.replayPlaybackKey.value += 1
    ui.replayVisible.value = true

    setTimeout(() => {
      ui.replayVisible.value = false
      if (ui.replayVideoUrl.value) {
        URL.revokeObjectURL(ui.replayVideoUrl.value)
        ui.replayVideoUrl.value = null
      }
    }, 6000)
  } catch (err) {
    console.warn('replay assembly failed', err)
  }
}
