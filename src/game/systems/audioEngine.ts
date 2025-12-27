/**
 * Audio engine for music-driven gameplay.
 *
 * Provides playback control, spectral analysis, beat-aligned metrics, and
 * timeline cues derived from the loaded track so other systems can stay
 * synchronized with musical structure.
 */
export type SfxName =
  | 'slam'
  | 'phase'
  | 'antigravOn'
  | 'slowmoOn'
  | 'enemyPop'
  | 'combo'
  | 'death'
  | 'blast'

// audioEngine.ts
export function createAudioEngine() {
  let audio: HTMLAudioElement | null = null
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null

  let freqData: Uint8Array | null = null
  let timeData: Uint8Array | null = null

  let bpm = 120
  let audioStarted = false

  let bassEnergy = 0
  let midEnergy = 0
  let highEnergy = 0
  let intensity = 0
  let loudness = 0
  let loudnessDelta = 0
  let drive = 0
  let driveDelta = 0
  let loudnessMean = 0
  let loudnessVar = 0
  let intensityMean = 0
  let intensityVar = 0
  let bandMean = 0
  let bandVar = 0
  let slapMix: GainNode | null = null
  let sfxGain: GainNode | null = null
  let levelMap: {
    bpm: number
    duration: number
    beatDuration: number
    beatIntensities: number[]
    maxIntensity: number
  } | null = null
  let intensityWindows: IntensityWindow[] = []
  let activeIntensityWindow: IntensityWindowState | null = null
  const audioTimeline: Array<{
    time: number
    bass: number
    mids: number
    highs: number
    intensity: number
    drive: number
    loudnessDelta: number
  }> = []
  let debugTimelineEnabled = false

  const windowListeners: Array<(window: IntensityWindowState | null) => void> = []

  const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

  async function configure(trackUrl: string, getArrayBuffer?: () => Promise<ArrayBuffer>) {
    audio?.pause()

    audio = new Audio(trackUrl)
    audio.crossOrigin = 'anonymous'
    audio.loop = true
    audio.volume = 0.72

    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const src = audioCtx.createMediaElementSource(audio)

    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048

    freqData = new Uint8Array(analyser.frequencyBinCount)
    timeData = new Uint8Array(analyser.fftSize)
    sfxGain = audioCtx.createGain()
    sfxGain.gain.value = 0.25

    const slapDelay = audioCtx.createDelay(0.5)
    slapDelay.delayTime.value = 0.14
    const slapFeedback = audioCtx.createGain()
    slapFeedback.gain.value = 0.32
    slapMix = audioCtx.createGain()
    slapMix.gain.value = 0

    slapDelay.connect(slapFeedback)
    slapFeedback.connect(slapDelay)
    slapDelay.connect(slapMix)

    const dryGain = audioCtx.createGain()
    dryGain.gain.value = 1.0

    const compressor = audioCtx.createDynamicsCompressor()
    compressor.threshold.value = -20
    compressor.knee.value = 16
    compressor.ratio.value = 2.8
    compressor.attack.value = 0.005
    compressor.release.value = 0.18

    src.connect(dryGain)
    dryGain.connect(compressor)
    compressor.connect(analyser)
    analyser.connect(audioCtx.destination)
    compressor.connect(slapDelay)
    slapMix.connect(analyser)
    sfxGain.connect(audioCtx.destination)

    if (getArrayBuffer) {
      const buf = await getArrayBuffer()
      const decoded = await audioCtx.decodeAudioData(buf)
      bpm = detectBPMFromBuffer(decoded)
      levelMap = buildLevelMap(decoded, bpm)
      intensityWindows = levelMap ? detectIntensityWindows(levelMap) : []
      activeIntensityWindow = null
    } else {
      levelMap = null
      intensityWindows = []
      activeIntensityWindow = null
    }

    audioStarted = false
  }

  async function start() {
    if (!audio || audioStarted) return
    if (audioCtx?.state === 'suspended') await audioCtx.resume()
    await audio.play()
    audioStarted = true
  }

  async function pause() {
    if (!audio) return
    audio.pause()
    if (audioCtx?.state === 'running') await audioCtx.suspend()
  }

  async function resume() {
    if (!audio || !audioStarted) return
    if (audioCtx?.state === 'suspended') await audioCtx.resume()
    if (audio.paused) await audio.play()
  }

  function updateEnergy() {
    if (!analyser || !freqData || !timeData) return

    const freq = freqData as unknown as Uint8Array
    const time = timeData as unknown as Uint8Array

    ;(analyser as any).getByteFrequencyData(freq)
    ;(analyser as any).getByteTimeDomainData(time)
    let bass = 0, mids = 0, highs = 0
    for (let i = 0; i < 30; i++) bass += freq[i] ?? 0
    for (let i = 40; i < 120; i++) mids += freq[i] ?? 0
    for (let i = 140; i < 220; i++) highs += freq[i] ?? 0

    bassEnergy = bass / 30 / 255
    midEnergy = mids / 80 / 255
    highEnergy = highs / 80 / 255

    const raw = bassEnergy * 0.4 + midEnergy * 0.25 + highEnergy * 0.15
    intensity += (raw - intensity) * 0.03

    // Loudness and change detection to drive spawn surges
    let sumSq = 0
    for (let i = 0; i < time.length; i++) {
      const sample = (time[i] ?? 128) - 128
      sumSq += sample * sample
    }
    const rms = Math.sqrt(sumSq / Math.max(1, time.length)) / 128
    const prevLoud = loudness
    loudness += (rms - loudness) * 0.12
    loudnessDelta = (loudness - prevLoud) * 1.6

    const bandRaw = bassEnergy * 0.55 + midEnergy * 0.35 + highEnergy * 0.25
    const updateStats = (value: number, mean: number, variance: number, alpha: number) => {
      const nextMean = mean + (value - mean) * alpha
      const delta = value - nextMean
      const nextVar = variance + (delta * delta - variance) * alpha
      return { mean: nextMean, variance: nextVar }
    }

    const sL = updateStats(loudness, loudnessMean, loudnessVar, 0.02)
    loudnessMean = sL.mean
    loudnessVar = sL.variance
    const sI = updateStats(intensity, intensityMean, intensityVar, 0.02)
    intensityMean = sI.mean
    intensityVar = sI.variance
    const sB = updateStats(bandRaw, bandMean, bandVar, 0.02)
    bandMean = sB.mean
    bandVar = sB.variance

    const z = (value: number, mean: number, variance: number) => {
      const std = Math.sqrt(Math.max(1e-6, variance))
      return (value - mean) / std
    }
    const lz = z(loudness, loudnessMean, loudnessVar)
    const iz = z(intensity, intensityMean, intensityVar)
    const bz = z(bandRaw, bandMean, bandVar)

    const targetDrive = Math.max(0, Math.min(1, 0.42 + 0.14 * lz + 0.16 * iz + 0.12 * bz))
    const prevDrive = drive
    drive += (targetDrive - drive) * 0.08
    driveDelta = (drive - prevDrive) * 2.2

    if (debugTimelineEnabled) {
      audioTimeline.push({
        time: audio?.currentTime ?? 0,
        bass: bassEnergy,
        mids: midEnergy,
        highs: highEnergy,
        intensity,
        drive,
        loudnessDelta,
      })
      if (audioTimeline.length > 600) audioTimeline.shift()
    }
  }

  /**
   * Update and return the current intensity window aligned to playback time.
   *
   * The active window is determined by comparing the playback position to
   * precomputed intensity spans, including their lead-in padding. The window
   * is memoized on the engine and listeners are notified when the window
   * changes or clears.
   *
   * @param timeSeconds Current audio playback time in seconds.
   * @returns The active intensity window state, or null when outside any window.
   */
  function updateIntensityWindow(timeSeconds: number) {
    if (!levelMap || levelMap.duration <= 0 || intensityWindows.length === 0) {
      if (activeIntensityWindow) {
        activeIntensityWindow = null
        windowListeners.forEach(listener => listener(null))
      }
      return null
    }

    const position = ((timeSeconds % levelMap.duration) + levelMap.duration) % levelMap.duration
    const nextWindow = intensityWindows.find(win => position >= win.leadInStart && position <= win.end)

    if (!nextWindow) {
      if (activeIntensityWindow) {
        activeIntensityWindow = null
        windowListeners.forEach(listener => listener(null))
      }
      return null
    }

    const phase: IntensityWindowState['phase'] = position < nextWindow.start ? 'lead-in' : 'active'
    const windowStart = phase === 'lead-in' ? nextWindow.leadInStart : nextWindow.start
    const windowEnd = phase === 'lead-in' ? nextWindow.start : nextWindow.end
    const progress = clamp01((position - windowStart) / Math.max(0.0001, windowEnd - windowStart))
    const computed: IntensityWindowState = { ...nextWindow, phase, progress }

    const changed =
      !activeIntensityWindow ||
      activeIntensityWindow.start !== computed.start ||
      activeIntensityWindow.end !== computed.end ||
      activeIntensityWindow.phase !== computed.phase

    activeIntensityWindow = computed
    if (changed) windowListeners.forEach(listener => listener(computed))
    return computed
  }

  function resetEnergy() {
    bassEnergy = 0
    midEnergy = 0
    highEnergy = 0
    intensity = 0
    loudness = 0
    loudnessDelta = 0
    drive = 0
    driveDelta = 0
    loudnessMean = 0
    loudnessVar = 0
    intensityMean = 0
    intensityVar = 0
    bandMean = 0
    bandVar = 0
    activeIntensityWindow = null
  }

  function applyPlaybackRate(rate: number) {
    if (audio) audio.playbackRate = rate
  }

  function setSlapMix(value: number) {
    if (slapMix) slapMix.gain.value = value
  }

  function playSfx(name: SfxName, loudness = 1) {
    if (!audioCtx || !sfxGain) return
    const ctx = audioCtx
    const sfxBus = sfxGain
    const now = ctx.currentTime
    const ceiling = Math.min(0.35, (audio?.volume ?? 1) * (0.22 + intensity * 0.35))
    const level = Math.max(0.08, Math.min(ceiling, 0.35)) * loudness
    if (level <= 0) return

    const playNoiseBurst = (duration: number, cutoff: number, resonance = 0.6) => {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = cutoff
      filter.Q.value = resonance
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(level, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(sfxBus)
      source.start()
      source.stop(now + duration)
    }

    const playTone = (freqStart: number, freqEnd: number, duration: number, type: OscillatorType, gainMult = 1) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freqStart, now)
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration)
      gain.gain.setValueAtTime(level * gainMult, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      osc.connect(gain)
      gain.connect(sfxBus)
      osc.start()
      osc.stop(now + duration)
    }

    switch (name) {
      case 'slam':
        playNoiseBurst(0.2, 320)
        break
      case 'phase':
        playTone(520, 880, 0.18, 'sawtooth', 0.8)
        playNoiseBurst(0.16, 1200, 0.4)
        break
      case 'antigravOn':
        playTone(260, 540, 0.18, 'triangle', 0.6)
        break
      case 'slowmoOn':
        playTone(420, 140, 0.25, 'sine', 0.7)
        break
      case 'enemyPop':
        playTone(620, 340, 0.12, 'square', 0.7)
        playNoiseBurst(0.1, 900, 0.2)
        break
      case 'combo':
        playTone(740, 980, 0.12, 'triangle', 0.8)
        playTone(420, 640, 0.18, 'sine', 0.5)
        break
      case 'death':
        playNoiseBurst(0.35, 220, 0.8)
        playTone(180, 90, 0.35, 'sawtooth', 0.6)
        break
      case 'blast':
        playTone(360, 620, 0.14, 'sawtooth', 0.8)
        playNoiseBurst(0.12, 1400, 0.2)
        break
    }
  }

  function detectBPMFromBuffer(buffer: AudioBuffer) {
    const channelData = buffer.getChannelData(0)
    const sampleRate = buffer.sampleRate
    const peaks: number[] = []
    const threshold = 0.9
    let lastPeak = 0

    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i] ?? 0
      if (sample > threshold && i - lastPeak > sampleRate * 0.25) {
        peaks.push(i)
        lastPeak = i
      }
    }

    const intervals: number[] = []
    for (let i = 1; i < peaks.length; i++) {
      const current = peaks[i] ?? 0
      const prev = peaks[i - 1] ?? 0
      intervals.push((current - prev) / sampleRate)
    }

    const tempos = intervals.map(i => 60 / i)
    const grouped: Record<string, number> = {}

    for (const t of tempos) {
      const rounded = Math.round(t)
      grouped[rounded] = (grouped[rounded] || 0) + 1
    }

    const strongest = Object.entries(grouped).sort((a, b) => b[1] - a[1])[0]
    return strongest ? Number(strongest[0]) : 120
  }

  function buildLevelMap(buffer: AudioBuffer, detectedBpm: number) {
    const beatDuration = 60 / Math.max(1, detectedBpm)
    const totalBeats = Math.max(1, Math.ceil(buffer.duration / beatDuration))
    const beatIntensities = new Array(totalBeats).fill(0)
    const channel = buffer.getChannelData(0)
    const sampleRate = buffer.sampleRate
    let max = 0

    for (let i = 0; i < totalBeats; i += 1) {
      const start = Math.floor(i * beatDuration * sampleRate)
      const end = Math.min(channel.length, Math.floor((i + 1) * beatDuration * sampleRate))
      if (end <= start) break
      const span = end - start
      const step = Math.max(1, Math.floor(span / 2000))
      let sum = 0
      let count = 0
      for (let s = start; s < end; s += step) {
        const v = channel[s] ?? 0
        sum += v * v
        count += 1
      }
      const rms = Math.sqrt(sum / Math.max(1, count))
      beatIntensities[i] = rms
      if (rms > max) max = rms
    }

    if (max > 0) {
      for (let i = 0; i < beatIntensities.length; i += 1) {
        beatIntensities[i] = beatIntensities[i] / max
      }
    }

    return {
      bpm: detectedBpm,
      duration: buffer.duration,
      beatDuration,
      beatIntensities,
      maxIntensity: max,
    }
  }

  /**
   * Compute sustained intensity windows from beat-normalized RMS values.
   *
   * The detector smooths beat intensities, derives a dynamic threshold using
   * standard deviation, and then aggregates contiguous runs above that
   * threshold into windows with configurable lead-in padding.
   */
  function detectIntensityWindows(map: LevelMap) {
    const smoothed = smoothBeatIntensities(map.beatIntensities)
    const mean = smoothed.reduce((acc, value) => acc + value, 0) / Math.max(1, smoothed.length)
    const variance = smoothed.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / Math.max(1, smoothed.length)
    const std = Math.sqrt(Math.max(1e-6, variance))
    const threshold = clamp01(mean + std * 0.45)
    const minBeats = 4
    const windows: IntensityWindow[] = []

    let startIdx: number | null = null
    for (let i = 0; i < smoothed.length; i += 1) {
      const above = (smoothed[i] ?? 0) >= threshold
      if (above && startIdx === null) startIdx = i
      if ((!above || i === smoothed.length - 1) && startIdx !== null) {
        const endIdx = above && i === smoothed.length - 1 ? i : i - 1
        const span = endIdx - startIdx + 1
        if (span >= minBeats) {
          const start = startIdx * map.beatDuration
          const end = (endIdx + 1) * map.beatDuration
          const leadInStart = Math.max(0, start - map.beatDuration * 2.5)
          const peak = smoothed.slice(startIdx, endIdx + 1).reduce((acc, value) => Math.max(acc, value), 0)
          windows.push({ start, end, leadInStart, peak })
        }
        startIdx = null
      }
    }

    return windows
  }

  /**
   * Apply a small moving-average smoothing to beat intensities to reduce noise.
   */
  function smoothBeatIntensities(values: number[]) {
    if (values.length === 0) return values
    const radius = 1
    const smoothed: number[] = []
    for (let i = 0; i < values.length; i += 1) {
      let sum = 0
      let count = 0
      for (let j = -radius; j <= radius; j += 1) {
        const idx = i + j
        if (idx < 0 || idx >= values.length) continue
        sum += values[idx] ?? 0
        count += 1
      }
      smoothed.push(sum / Math.max(1, count))
    }
    return smoothed
  }

  return {
    configure,
    start,
    pause,
    resume,
    updateEnergy,
    resetEnergy,
    applyPlaybackRate,
    setSlapMix,
    playSfx,
    updateIntensityWindow,
    get bpm() { return bpm },
    get started() { return audioStarted },
    get bass() { return bassEnergy },
    get mids() { return midEnergy },
    get highs() { return highEnergy },
    get intensity() { return intensity },
    get loudness() { return loudness },
    get loudnessDelta() { return loudnessDelta },
    get drive() { return drive },
    get driveDelta() { return driveDelta },
    get analyser() { return analyser },
    get freqData() { return freqData },
    get timeData() { return timeData },
    get audio() { return audio },
    get levelMap() { return levelMap },
    get audioTimeline() { return audioTimeline },
    get intensityWindows() { return intensityWindows },
    get intensityWindow() { return activeIntensityWindow },
    onIntensityWindowChange(listener: (window: IntensityWindowState | null) => void) {
      windowListeners.push(listener)
    },
    setDebugTimelineEnabled(value: boolean) {
      debugTimelineEnabled = value
      if (!debugTimelineEnabled) audioTimeline.length = 0
    },
  }
}

interface LevelMap {
  bpm: number
  duration: number
  beatDuration: number
  beatIntensities: number[]
  maxIntensity: number
}

export interface IntensityWindow {
  start: number
  end: number
  leadInStart: number
  peak: number
}

export interface IntensityWindowState extends IntensityWindow {
  phase: 'lead-in' | 'active'
  progress: number
}
