export type SpawnCause =
  | { kind: 'beat'; beat: number }
  | { kind: 'band'; band: 'bass' | 'mid' | 'high'; value: number }
  | { kind: 'intensity'; value: number }
  | { kind: 'drive'; value: number }
  | { kind: 'dynamics'; delta: number }
  | { kind: 'patternBias'; signature: string; bias: number }

export type SpawnAttribution = {
  beat: number
  isSubBeat: boolean
  dominantBand: 'bass' | 'mid' | 'high'
  causes: SpawnCause[]
}
