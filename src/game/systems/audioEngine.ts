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
  let slapMix: GainNode | null = null

  async function configure(trackUrl: string, getArrayBuffer?: () => Promise<ArrayBuffer>) {
    audio?.pause()

    audio = new Audio(trackUrl)
    audio.crossOrigin = 'anonymous'
    audio.loop = true

    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const src = audioCtx.createMediaElementSource(audio)

    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048

    freqData = new Uint8Array(analyser.frequencyBinCount)
    timeData = new Uint8Array(analyser.fftSize)

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

    if (getArrayBuffer) {
      const buf = await getArrayBuffer()
      const decoded = await audioCtx.decodeAudioData(buf)
      bpm = detectBPMFromBuffer(decoded)
    }

    audioStarted = false
  }

  async function start() {
    if (!audio || audioStarted) return
    if (audioCtx?.state === 'suspended') await audioCtx.resume()
    await audio.play()
    audioStarted = true
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

    const raw = bassEnergy * 0.5 + midEnergy * 0.3 + highEnergy * 0.2
    intensity += (raw - intensity) * 0.04
  }

  function resetEnergy() {
    bassEnergy = 0
    midEnergy = 0
    highEnergy = 0
    intensity = 0
  }

  function applyPlaybackRate(rate: number) {
    if (audio) audio.playbackRate = rate
  }

  function setSlapMix(value: number) {
    if (slapMix) slapMix.gain.value = value
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

  return {
    configure,
    start,
    updateEnergy,
    resetEnergy,
    applyPlaybackRate,
    setSlapMix,
    get bpm() { return bpm },
    get started() { return audioStarted },
    get bass() { return bassEnergy },
    get mids() { return midEnergy },
    get highs() { return highEnergy },
    get intensity() { return intensity },
    get analyser() { return analyser },
    get freqData() { return freqData },
    get timeData() { return timeData },
    get audio() { return audio },
  }
}
