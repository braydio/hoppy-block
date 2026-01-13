<template>
  <div class="game-shell">
    <Teleport v-if="titleVignetteReady" to=".title-vignette-slot">
      <canvas ref="statusCanvas" class="status-canvas"></canvas>
    </Teleport>
    <div class="hud">
      <div class="hud-item hud-item--stack">
        <div class="hud-row">
          <span class="label">Score</span>
          <span class="value">{{ Math.floor(ui.score.value) }}</span>
        </div>
        <span class="subvalue"
          >Base {{ Math.floor(ui.baseScore.value) }} · Bonus
          {{ Math.floor(ui.bonusScore.value) }}</span
        >
      </div>
      <div class="hud-item">
        <span class="label">Speed</span>
        <span class="value">{{ ui.speed.value.toFixed(1) }}x</span>
      </div>
      <div class="hud-item">
        <span class="label">Difficulty</span>
        <div class="difficulty-toggle">
          <button
            v-for="opt in difficultyOptions"
            :key="opt.id"
            class="difficulty-button"
            :class="{ 'difficulty-button--active': ui.difficulty.value === opt.id }"
            @click="setDifficulty(opt.id)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div class="hud-audio">
        <label class="audio-label">
          <span>Track</span>
          <input type="file" accept="audio/*" @change="handleAudioUpload" />
        </label>
      </div>
      <div class="hud-item">
        <span class="label">State</span>
        <button class="pause-button" @click="togglePause">
          {{ ui.paused.value ? 'Resume' : 'Pause' }}
        </button>
        <label class="dev-toggle">
          <input type="checkbox" v-model="ui.invincible.value" />
          <span>Dev invincible</span>
        </label>
      </div>
    </div>

    <div class="game-frame" :class="{ 'game-frame--beat': ui.beatPulse.value }">
      <div v-if="ui.invincible.value" class="dev-badge">DEV INVINCIBLE</div>
      <canvas ref="canvas" class="game-canvas"></canvas>

      <div v-if="ui.snapshotMessageTimer.value > 0" class="replay-toast">
        <div class="replay-title">{{ ui.celebrationMessage.value || 'TRICKY!' }}</div>
        <div class="replay-sub">
          {{ ui.celebrationSubtitle.value || 'Feudal thrusters engaged!' }}
        </div>
      </div>

      <div v-if="ui.gameOver.value" class="overlay">
        <div class="overlay-card">
          <h2>Game Over</h2>
          <p>Your score: {{ Math.floor(ui.score.value) }}</p>
          <div class="score-save" v-if="ui.canSaveScore.value">
            <input
              class="name-input"
              type="text"
              v-model="ui.playerName"
              maxlength="16"
              placeholder="Your name"
            />
            <button class="save-button" @click="handleSaveScore">Save Score</button>
          </div>
          <button class="restart-button" @click="handleRestart">Restart</button>
          <p class="help">
            Press <kbd>{{ keyLabel(keybinds.restart) }}</kbd> to restart.
          </p>
        </div>
      </div>

      <div v-if="ui.paused.value && !ui.gameOver.value" class="overlay overlay--paused">
        <div class="overlay-card overlay-card--paused">
          <h2>Paused</h2>
          <p>
            Press <kbd>{{ keyLabel(keybinds.pause) }}</kbd> or click Resume.
          </p>
        </div>
      </div>

      <div
        v-if="(!ui.started.value || ui.introCollapsing.value) && !ui.gameOver.value"
        class="overlay"
        :class="{ 'overlay--collapse': ui.introCollapsing.value }"
      >
        <div
          class="overlay-card"
          :class="{ 'overlay-card--collapse': ui.introCollapsing.value }"
          @click="handleStart"
        >
          <h2>Hoppy Block</h2>

          <p>
            <kbd>{{ keyLabel(keybinds.jump) }}</kbd> — Jump
          </p>
          <p>
            <kbd>{{ keyLabel(keybinds.slam) }}</kbd> — Slide / Slam
          </p>
          <p>
            <kbd>{{ keyLabel(keybinds.antigrav) }}</kbd> — Antigrav
          </p>
          <p>
            <kbd>{{ keyLabel(keybinds.slowmo) }}</kbd> — Slow-Mo
          </p>
          <p>
            <kbd>{{ keyLabel(keybinds.blast) }}</kbd> — Beat Blast
          </p>
          <p>
            <kbd>{{ keyLabel(keybinds.phase) }}</kbd> — Phase Shift
          </p>

          <p class="help" style="margin-top: 0.6rem">
            Load a local mp3 file<br />
            with the <strong><kbd>Track</kbd></strong> selector above <br />
            to generate a custom level.
          </p>
        </div>
      </div>
    </div>

    <section class="levelmap-panel">
      <header class="levelmap-header">
        <div>
          <h3>Level Map</h3>
          <p>Audio intensity and beat grid aligned to the track.</p>
        </div>
        <div class="levelmap-controls">
          <label>
            Zoom
            <input type="range" min="0.5" max="8" step="0.1" v-model.number="levelMapZoom" />
          </label>
        </div>
      </header>
      <div ref="levelMapScroll" class="levelmap-scroll">
        <canvas ref="levelMapCanvas" class="levelmap-canvas"></canvas>
      </div>
    </section>

    <section v-if="ui.debugAudioSpawnView.value" class="spawn-debug-panel">
      <header class="spawn-debug-header">
        <div>
          <h3>Audio-Driven Spawn Debug</h3>
          <p>Hover or click markers to inspect spawn causes.</p>
        </div>
      </header>
      <div class="spawn-debug-legend">
        <div class="legend-row">
          <span class="legend-chip legend-chip--bass"></span>
          <span>Bass energy</span>
          <span class="legend-chip legend-chip--mids"></span>
          <span>Mids energy</span>
          <span class="legend-chip legend-chip--highs"></span>
          <span>Highs energy</span>
        </div>
        <div class="legend-row">
          <span class="legend-dot legend-dot--gomba"></span>
          <span>Gomba spawn</span>
          <span class="legend-dot legend-dot--spiker"></span>
          <span>Spiker spawn</span>
          <span class="legend-dot legend-dot--floater"></span>
          <span>Floater spawn</span>
        </div>
        <div class="legend-row">
          <span class="legend-line legend-line--intensity"></span>
          <span>Intensity</span>
          <span class="legend-line legend-line--drive"></span>
          <span>Drive</span>
          <span class="legend-line legend-line--loudness"></span>
          <span>|LoudnessΔ|</span>
          <span class="legend-bar"></span>
          <span>Target/beat</span>
          <span class="legend-dot legend-dot--actual"></span>
          <span>Actual spawns</span>
        </div>
        <p class="legend-note">
          Top panel shows audio band energy; bottom panel shows intensity/drive/dynamics and target
          vs actual spawns.
        </p>
      </div>
      <canvas ref="spawnDebugCanvas" class="spawn-debug-canvas"></canvas>
    </section>

    <section v-if="ui.debugAudioSpawnView.value" class="spawn-log-panel">
      <header class="spawn-log-header">
        <div>
          <h3>Spawner Log</h3>
          <p>Recent spawn calculations (latest first).</p>
        </div>
        <button class="spawn-log-toggle" @click="showSpawnNotes = !showSpawnNotes">
          {{ showSpawnNotes ? 'Hide notes' : 'Show notes' }}
        </button>
      </header>
      <div v-if="showSpawnNotes" class="spawn-log-notes">
        <div><span class="note-tag">Beat</span> B# is beat index, B#s is sub-beat.</div>
        <div><span class="note-tag">acc</span> Spawn accumulator after tick.</div>
        <div><span class="note-tag">tgt</span> Target spawns per beat based on audio drive.</div>
        <div><span class="note-tag">ch</span> Random spawn chance this tick.</div>
        <div><span class="note-tag">fm</span> Formation spawn chance.</div>
        <div><span class="note-tag">ob</span> Obstacle spawn chance.</div>
        <div><span class="note-tag">sp</span> Spawns executed this tick.</div>
      </div>
      <div class="spawn-log-table">
        <div class="spawn-log-row spawn-log-row--head">
          <span>Beat</span>
          <span>acc</span>
          <span>tgt</span>
          <span>ch</span>
          <span>fm</span>
          <span>ob</span>
          <span>sp</span>
        </div>
        <div
          v-for="entry in spawnLogRows"
          :key="`${entry.beat}-${entry.isSubBeat}-${entry.timestamp}`"
          class="spawn-log-row"
        >
          <span>{{ entry.isSubBeat ? `B${entry.beat}s` : `B${entry.beat}` }}</span>
          <span>{{ entry.spawnAccumulator.toFixed(2) }}</span>
          <span>{{ entry.targetPerBeat.toFixed(2) }}</span>
          <span>{{ entry.spawnChance.toFixed(2) }}</span>
          <span>{{ entry.formationChance.toFixed(2) }}</span>
          <span>{{ entry.obstacleChance.toFixed(2) }}</span>
          <span>{{ entry.spawns }}</span>
        </div>
        <div v-if="spawnLogRows.length === 0" class="spawn-log-empty">
          No spawn log entries yet.
        </div>
      </div>
    </section>

    <div class="controls">
      <div class="controls-row">
        <span class="controls-label">Controls</span>
      </div>
      <div class="controls-row">
        <kbd>{{ keyLabel(keybinds.jump) }}</kbd> Jump
      </div>
      <div class="controls-row">
        <kbd>{{ keyLabel(keybinds.slam) }}</kbd> Slide / Slam
      </div>
      <div class="controls-row">
        <kbd>{{ keyLabel(keybinds.antigrav) }}</kbd> Antigrav ·
        <kbd>{{ keyLabel(keybinds.slowmo) }}</kbd> Slow-Mo
      </div>
      <div class="controls-row">
        <kbd>{{ keyLabel(keybinds.blast) }}</kbd> Blast ·
        <kbd>{{ keyLabel(keybinds.phase) }}</kbd> Phase Shift
      </div>
      <div class="controls-row">
        <kbd>{{ keyLabel(keybinds.pause) }}</kbd> Pause / Resume
      </div>
      <div class="controls-row">
        <kbd>{{ keyLabel(keybinds.restart) }}</kbd> Restart
      </div>
    </div>

    <section class="keybinds-panel">
      <header class="keybinds-header">
        <h3>Keybinds</h3>
        <p>Click a field, then press the key you want to use.</p>
      </header>
      <div class="keybinds-grid">
        <div v-for="action in keybindOptions" :key="action.id" class="keybind-row">
          <span class="keybind-label">{{ action.label }}</span>
          <input
            class="keybind-input"
            type="text"
            :value="keyLabel(keybinds[action.id])"
            readonly
            @click="editingKey = action.id"
            @focus="editingKey = action.id"
            @blur="editingKey = null"
            @keydown.prevent="setKeybind(action.id, $event)"
            :placeholder="editingKey === action.id ? 'Press a key' : ''"
          />
          <span class="keybind-editing" v-if="editingKey === action.id"> Listening… </span>
        </div>
      </div>
    </section>

    <section class="access-panel">
      <header class="keybinds-header">
        <h3>Accessibility</h3>
        <p>Personalize visuals and timing.</p>
      </header>
      <div class="access-grid">
        <label class="toggle-row">
          <input type="checkbox" v-model="ui.colorblindMode" />
          <span>High-contrast palette</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" v-model="ui.debugAudioSpawnView.value" />
          <span>Debug spawn view</span>
        </label>
        <label class="slider-row">
          <span>Beat window</span>
          <div class="slider-wrap">
            <input type="range" min="40" max="160" step="5" v-model.number="ui.beatWindowMs" />
            <span class="slider-value">{{ Math.round(ui.beatWindowMs.value) }} ms</span>
          </div>
        </label>
      </div>
    </section>

    <section class="scoreboard-panel">
      <header class="keybinds-header">
        <h3>High Scores</h3>
        <p>Top 10 runs (local to this browser)</p>
      </header>
      <transition-group name="score-slide" tag="div" class="scoreboard-list">
        <div
          v-for="(entry, idx) in ui.highScores.value"
          :key="entry.id || entry.name + entry.score + entry.date + idx"
          class="score-row"
          :class="{
            'score-row--placeholder': entry.placeholder,
            'score-row--new':
              ui.savedCurrentRun.value && !entry.placeholder && idx === ui.lastSavedIndex.value,
          }"
        >
          <span class="score-rank">#{{ idx + 1 }}</span>
          <span class="score-name">{{ entry.name }}</span>
          <span class="score-value">{{ entry.score }}</span>
          <span class="score-date">{{ entry.date }}</span>
        </div>
        <p v-if="ui.highScores.value.length === 0" class="score-empty" key="empty">
          No runs yet. Finish a game to record your score.
        </p>
      </transition-group>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import {
  createGameState,
  loadHighScores,
  saveHighScore,
  difficultyOptions,
  keybindOptions,
} from '@/game/core/gameState'
import { keyLabel } from '@/game/core/keybinds'
import { createGameLoop } from '@/game/loop'
import { createSpawnDebugView } from '@/debug/spawnDebugView'
import { drawPlayer } from '@/game/render/drawPlayer'
import { drawEnemies } from '@/game/render/drawEnemies'
import { getPalette } from '@/game/render/colors'
import type { GameRuntime } from '@/game/core/gameState'
import type { Enemy } from '@/game/core/types'

const canvas = ref<HTMLCanvasElement | null>(null)
const state = createGameState()
const { ui, keybinds, editingKey } = state
const showSpawnNotes = ref(false)
const spawnLogRows = computed(() => [...ui.spawnLog.value].slice().reverse())
const levelMapCanvas = ref<HTMLCanvasElement | null>(null)
const levelMapScroll = ref<HTMLDivElement | null>(null)
const levelMapZoom = ref(1.2)
let levelMapRaf: number | null = null
let lastLevelMapScroll = 0
let isLevelMapScrubbing = false
let levelMapScrollTimer: number | null = null
const statusCanvas = ref<HTMLCanvasElement | null>(null)
const titleVignetteReady = ref(false)
let statusRaf: number | null = null
let statusLastTime = 0
let statusMode: 'live' | 'combo' | 'death' = 'live'
let celebrationStart = 0
let celebrationRuntime: GameRuntime | null = null
const celebrationEnemies: Enemy[] = []
const celebrationPinState: Array<{ vx: number; vy: number; spin: number }> = []
const celebrationBursts: Array<{ x: number; y: number; vx: number; vy: number; alpha: number }> = []
let celebrationImpact = false
let liveRuntime: GameRuntime | null = null
const liveEnemies: Enemy[] = []
let deathRuntime: GameRuntime | null = null
let deathStart = 0
let deathVariant = 0
const deathFragments: Array<{
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
}> = []
const spawnDebugCanvas = ref<HTMLCanvasElement | null>(null)
let spawnDebugView: ReturnType<typeof createSpawnDebugView> | null = null
let spawnDebugRaf: number | null = null

let game: ReturnType<typeof createGameLoop> | null = null

function handleSaveScore() {
  saveHighScore(ui, ui.score.value)
}

function handleAudioUpload(event: Event) {
  game?.handleAudioUpload(event)
}

function handleRestart() {
  game?.resetGame()
}

function handleStart() {
  game?.handleJump()
}

function setDifficulty(level: string) {
  game?.setDifficulty(level)
}

function setKeybind(action: string, event: KeyboardEvent) {
  game?.setKeybind(action, event)
}

function togglePause() {
  game?.togglePause()
}

onMounted(() => {
  if (!canvas.value) return
  game = createGameLoop(canvas.value, state)
  game.boot()
  loadHighScores(ui)
  startLevelMap()
  if (ui.debugAudioSpawnView.value) {
    startSpawnDebugView()
  }
  nextTick().then(() => startStatusScreen())
  const waitForTitleSlot = () => {
    const slot = document.querySelector('.title-vignette-slot')
    if (slot) {
      titleVignetteReady.value = true
      return
    }
    requestAnimationFrame(waitForTitleSlot)
  }
  waitForTitleSlot()
  if (levelMapScroll.value) {
    levelMapScroll.value.addEventListener('scroll', handleLevelMapScroll, { passive: true })
    levelMapScroll.value.addEventListener('pointerdown', handleLevelMapPointerDown)
  }
})

onUnmounted(() => {
  if (levelMapRaf) cancelAnimationFrame(levelMapRaf)
  stopSpawnDebugView()
  if (statusRaf) cancelAnimationFrame(statusRaf)
  if (levelMapScroll.value) {
    levelMapScroll.value.removeEventListener('scroll', handleLevelMapScroll)
    levelMapScroll.value.removeEventListener('pointerdown', handleLevelMapPointerDown)
  }
  window.removeEventListener('pointerup', handleLevelMapPointerUp)
  game?.destroy()
})

function startLevelMap() {
  const draw = () => {
    levelMapRaf = requestAnimationFrame(draw)
    const canvasEl = levelMapCanvas.value
    if (!canvasEl) return
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return
    const mapData = game?.getLevelMapData()
    if (!mapData?.map) {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
      return
    }

    const containerWidth = levelMapScroll.value?.clientWidth ?? 600
    const basePixelsPerSecond = 60
    const width = Math.max(
      containerWidth,
      mapData.map.duration * basePixelsPerSecond * levelMapZoom.value,
    )
    const height = 120
    if (canvasEl.width !== Math.floor(width)) canvasEl.width = Math.floor(width)
    if (canvasEl.height !== height) canvasEl.height = height

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)

    ctx.fillStyle = 'rgba(2, 6, 23, 0.9)'
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height)

    const beatPx = mapData.map.beatDuration * basePixelsPerSecond * levelMapZoom.value
    const beatCount = mapData.map.beatIntensities.length

    const highlightThreshold = 0.65
    for (let i = 0; i < beatCount; i += 1) {
      const intensity = mapData.map.beatIntensities[i] ?? 0
      const x = i * beatPx
      const barHeight = 16 + intensity * 52
      const y = height - barHeight - 18
      const color =
        intensity > highlightThreshold ? 'rgba(248, 113, 113, 0.8)' : 'rgba(56, 189, 248, 0.55)'
      ctx.fillStyle = color
      ctx.fillRect(x, y, beatPx, barHeight)

      if (intensity > highlightThreshold) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.14)'
        ctx.fillRect(x, 8, beatPx, height - 16)
      }
    }

    const gridColor = 'rgba(148, 163, 184, 0.3)'
    const beatLineColor = 'rgba(148, 163, 184, 0.6)'
    const measureColor = 'rgba(226, 232, 240, 0.7)'

    let majorStep = 1
    while (beatPx * majorStep < 26) majorStep *= 2

    let subdivisions = 1
    if (beatPx >= 160) subdivisions = 16
    else if (beatPx >= 120) subdivisions = 8
    else if (beatPx >= 80) subdivisions = 4
    else if (beatPx >= 50) subdivisions = 2

    if (subdivisions > 1) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)'
      ctx.lineWidth = 1
      for (let i = 0; i < beatCount; i += 1) {
        for (let s = 1; s < subdivisions; s += 1) {
          const x = (i + s / subdivisions) * beatPx
          ctx.beginPath()
          ctx.moveTo(x, 8)
          ctx.lineTo(x, height - 12)
          ctx.stroke()
        }
      }
    }

    for (let i = 0; i <= beatCount; i += 1) {
      if (i % majorStep !== 0) continue
      const x = i * beatPx
      const isMeasure = i % 4 === 0
      ctx.strokeStyle = isMeasure ? measureColor : beatLineColor
      ctx.lineWidth = isMeasure ? 2 : 1
      ctx.beginPath()
      ctx.moveTo(x, 6)
      ctx.lineTo(x, height - 8)
      ctx.stroke()

      if (isMeasure && beatPx * 4 >= 40) {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.7)'
        ctx.font = '10px system-ui'
        ctx.fillText(`${i}`, x + 4, 14)
      }
    }

    const playheadXRaw = (mapData.currentTime / mapData.map.beatDuration) * beatPx
    const playheadX = isLevelMapScrubbing ? 24 : playheadXRaw
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, 6)
    ctx.lineTo(playheadX, height - 8)
    ctx.stroke()

    ctx.fillStyle = 'rgba(34, 197, 94, 0.9)'
    ctx.beginPath()
    ctx.moveTo(playheadX - 4, 6)
    ctx.lineTo(playheadX + 4, 6)
    ctx.lineTo(playheadX, 0)
    ctx.closePath()
    ctx.fill()

    if (beatPx >= 28) {
      const events = mapData.spawnEvents ?? []
      for (const e of events) {
        const x = (e.beat + (e.isSubBeat ? 0.5 : 0)) * beatPx
        if (x < 0 || x > canvasEl.width) continue
        const size = Math.min(10, 4 + e.count * 2)
        ctx.fillStyle = 'rgba(248, 113, 113, 0.9)'
        ctx.beginPath()
        ctx.arc(x, 20, size * 0.4, 0, Math.PI * 2)
        ctx.fill()
        if (beatPx >= 60) {
          ctx.fillStyle = 'rgba(248, 113, 113, 0.7)'
          ctx.font = '10px system-ui'
          ctx.fillText(`${e.count}`, x + 6, 24)
        }
      }
    }

    const scrollEl = levelMapScroll.value
    if (scrollEl && !isLevelMapScrubbing) {
      const now = performance.now()
      if (now - lastLevelMapScroll > 1200) {
        const rightEdge = scrollEl.scrollLeft + containerWidth
        if (playheadXRaw > rightEdge - 2) {
          const target = Math.min(
            scrollEl.scrollLeft + containerWidth,
            canvasEl.width - containerWidth,
          )
          scrollEl.scrollLeft = Math.max(0, target)
        }
      }
    }
  }
  draw()
}

function handleLevelMapScroll() {
  lastLevelMapScroll = performance.now()
  isLevelMapScrubbing = true
  if (levelMapScrollTimer) window.clearTimeout(levelMapScrollTimer)
  levelMapScrollTimer = window.setTimeout(() => {
    isLevelMapScrubbing = false
  }, 160)
}

function handleLevelMapPointerDown() {
  isLevelMapScrubbing = true
  lastLevelMapScroll = performance.now()
  window.addEventListener('pointerup', handleLevelMapPointerUp)
}

function handleLevelMapPointerUp() {
  isLevelMapScrubbing = false
  window.removeEventListener('pointerup', handleLevelMapPointerUp)
}

function initCelebrationScene(width: number, height: number) {
  celebrationEnemies.length = 0
  celebrationPinState.length = 0
  celebrationBursts.length = 0
  celebrationEnemies.push(
    {
      type: 'gomba',
      band: 'bass',
      x: 0,
      y: 0,
      width: 26,
      height: 24,
      alive: true,
      squished: false,
      squishTimer: 0,
      pancakeHeight: 6,
      currentHeight: 24,
      bob: 0,
      squash: 1,
      confident: true,
    },
    {
      type: 'spiker',
      band: 'mid',
      x: 0,
      y: 0,
      width: 24,
      height: 30,
      alive: true,
      squished: false,
      squishTimer: 0,
      pancakeHeight: 8,
      currentHeight: 30,
      bob: 0,
      squash: 1,
      confident: true,
      spikes: true,
      concerned: false,
    },
    {
      type: 'floater',
      band: 'high',
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      alive: true,
      squished: false,
      bob: 0,
      phase: 0,
      rage: 0,
    },
  )
  for (let i = 0; i < celebrationEnemies.length; i += 1) {
    celebrationPinState.push({ vx: 0, vy: 0, spin: 0 })
  }

  celebrationRuntime = {
    width,
    height,
    groundY: height - 6,
    player: {
      x: 16,
      y: height - 50,
      width: 32,
      height: 32,
      vy: 0,
      onGround: true,
    },
    dashActive: false,
    rotation: 0,
    slideActive: false,
    slideElapsed: 0,
    dashGhosts: [],
    invulnTimer: 0,
    deathByEnemy: false,
    phaseActive: false,
    phaseMode: 'terrain',
    phaseModeIndex: 0,
    enemies: celebrationEnemies,
    intensityWindow: null,
  } as GameRuntime
}

function renderCelebrationClip(ctx: CanvasRenderingContext2D, width: number, height: number) {
  if (!celebrationRuntime) initCelebrationScene(width, height)
  const runtime = celebrationRuntime
  if (!runtime) return
  runtime.width = width
  runtime.height = height
  runtime.groundY = height - 6

  const t = (performance.now() - celebrationStart) / 1000
  const tier = Math.max(3, ui.celebrationTier.value || 3)
  const intensity = Math.min(2.8, 1 + (tier - 3) * 0.45)
  const loopT = t % 3.6
  if (loopT < 0.05) {
    celebrationImpact = false
    for (let i = 0; i < celebrationPinState.length; i += 1) {
      celebrationPinState[i] = { vx: 0, vy: 0, spin: 0 }
    }
    celebrationBursts.length = 0
  }

  const dashPhase = Math.max(0, Math.min(1, (loopT - 0.4) / 1.0))
  runtime.dashActive = loopT > 0.4 && loopT < 1.6
  runtime.rotation = runtime.dashActive ? dashPhase * 0.8 * intensity : 0
  runtime.player.x = 10 + dashPhase * (width - 60)
  runtime.player.y = runtime.groundY - runtime.player.height + Math.sin(loopT * 8) * (2 + intensity)

  const baseX = width * 0.62
  const offsets = [0, 22, 44]
  celebrationEnemies.forEach((e, i) => {
    const state = celebrationPinState[i]
    const targetX = baseX + offsets[i]
    const targetY = e.type === 'floater' ? runtime.groundY - 58 : runtime.groundY - e.height
    if (!celebrationImpact) {
      e.x = targetX
      e.y = targetY
      e.bob = Math.sin(loopT * 4 + i * 0.7) * 4
      e.squash = 1 + Math.sin(loopT * 3 + i) * 0.05
      state.vx = 0
      state.vy = 0
      state.spin = 0
      e.squished = false
      e.squishTimer = 0.25
    } else {
      state.vy += 520 * 0.016
      e.x += state.vx * 0.016
      e.y += state.vy * 0.016
      e.bob = Math.sin(loopT * 6 + i) * 2
      e.squash = 1 - Math.min(0.2, Math.abs(state.spin) * 0.01)
      if (e.y > runtime.groundY - e.height) {
        e.y = runtime.groundY - e.height
        state.vy *= -0.35
        state.vx *= 0.7
      }
      state.spin *= 0.92
      e.squished = e.type !== 'floater'
      e.squishTimer = Math.max(0.05, e.squishTimer ?? 0.2)
      if (e.type === 'floater') e.rage = Math.min(1, (e.rage ?? 0) + 0.03)
    }
  })

  if (!celebrationImpact && runtime.player.x + runtime.player.width > baseX - 6) {
    celebrationImpact = true
    celebrationEnemies.forEach((e, i) => {
      const state = celebrationPinState[i]
      const dir = e.type === 'floater' ? 1 : 1.2
      state.vx = (160 + i * 50) * intensity * dir
      state.vy = -(200 + i * 40) * intensity
      state.spin = 2.2 * intensity * (i % 2 === 0 ? 1 : -1)
    })
    const burstCount = tier >= 6 ? 36 : tier >= 5 ? 26 : 18
    for (let i = 0; i < burstCount; i += 1) {
      celebrationBursts.push({
        x: baseX + 12,
        y: runtime.groundY - 30,
        vx: (Math.random() - 0.5) * 260 * intensity,
        vy: -Math.random() * 260 * intensity,
        alpha: 0.9,
      })
    }
  }

  const palette = getPalette(runtime, ui, 0, 0.6, null)
  const accent = { r: 56, g: 189, b: 248 }
  const accentAlt = { r: 236, g: 72, b: 153 }
  const accentColor = (a: number) => `rgba(${accent.r}, ${accent.g}, ${accent.b}, ${a})`
  const accentAltColor = (a: number) => `rgba(${accentAlt.r}, ${accentAlt.g}, ${accentAlt.b}, ${a})`
  if (celebrationImpact && intensity > 1) {
    const shake = Math.sin(loopT * 40) * (intensity - 1) * 2
    ctx.translate(shake, Math.cos(loopT * 28) * (intensity - 1) * 1.2)
  }

  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, runtime.groundY + 1)
  ctx.lineTo(width, runtime.groundY + 1)
  ctx.stroke()

  for (let i = 0; i < 4; i += 1) {
    const twinkleX = width * 0.12 + i * 28
    const twinkleY = 8 + Math.sin(loopT * 3 + i) * 1.5
    ctx.fillStyle = accentColor(0.25)
    ctx.beginPath()
    ctx.arc(twinkleX, twinkleY, 2, 0, Math.PI * 2)
    ctx.fill()
  }

  if (runtime.dashActive) {
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = accentAltColor(0.7)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(runtime.player.x, runtime.player.y + runtime.player.height / 2)
    ctx.lineTo(runtime.player.x + 40, runtime.player.y + runtime.player.height / 2)
    ctx.stroke()
    ctx.restore()
  }

  if (tier >= 5) {
    ctx.save()
    ctx.globalAlpha = 0.25 + (intensity - 1) * 0.2
    ctx.strokeStyle = accentColor(0.45)
    ctx.lineWidth = 2
    for (let i = 0; i < 4; i += 1) {
      const sx = width - i * 26
      const sy = 6 + (i % 2) * 10
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx - 18, sy + 6)
      ctx.stroke()
    }
    ctx.restore()
  }

  if (tier >= 6 && celebrationImpact) {
    ctx.save()
    const pulse = Math.min(0.5, Math.abs(Math.sin(loopT * 6)) * 0.35)
    ctx.globalAlpha = pulse
    ctx.fillStyle = accentAltColor(0.4)
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }

  if (celebrationImpact) {
    for (const p of celebrationBursts) {
      p.x += p.vx * 0.016
      p.y += p.vy * 0.016
      p.vy += 480 * 0.016
      p.alpha *= 0.92
      const size = tier >= 6 ? 3 : 2
      ctx.fillStyle = accentAltColor(p.alpha)
      ctx.fillRect(p.x, p.y, size, size)
    }
  }

  drawEnemies(ctx, runtime, palette)
  drawPlayer(ctx, runtime, ui, palette)

  ctx.save()
  const bannerW = width * 0.7
  const bannerH = 24
  const bannerX = (width - bannerW) / 2
  const bannerY = 6
  const glow = Math.min(1, 0.4 + intensity * 0.3)
  ctx.fillStyle = accentAltColor(0.16 + intensity * 0.14)
  ctx.strokeStyle = accentAltColor(0.55 + intensity * 0.25)
  ctx.lineWidth = 1.6 + intensity * 0.5
  ctx.fillRect(bannerX, bannerY, bannerW, bannerH)
  ctx.strokeRect(bannerX, bannerY, bannerW, bannerH)
  ctx.fillStyle = accentAltColor(0.85 + intensity * 0.1)
  ctx.font = `bold ${12 + intensity * 2.6}px system-ui`
  ctx.textAlign = 'center'
  ctx.shadowColor = `rgba(248, 113, 113, ${glow})`
  ctx.shadowBlur = 10 + intensity * 8
  ctx.fillText(ui.celebrationMessage.value || 'TRICKY!', width / 2, bannerY + 16)
  ctx.restore()
}

function startSpawnDebugView() {
  if (!ui.debugAudioSpawnView.value || !spawnDebugCanvas.value || spawnDebugView) return
  spawnDebugView = createSpawnDebugView(spawnDebugCanvas.value)
  spawnDebugCanvas.value.addEventListener('pointermove', handleSpawnDebugPointerMove)
  spawnDebugCanvas.value.addEventListener('pointerdown', handleSpawnDebugPointerDown)
  spawnDebugCanvas.value.addEventListener('pointerleave', handleSpawnDebugPointerLeave)

  const draw = () => {
    spawnDebugRaf = requestAnimationFrame(draw)
    if (!ui.debugAudioSpawnView.value) {
      const ctx = spawnDebugCanvas.value?.getContext('2d')
      if (ctx)
        ctx.clearRect(0, 0, spawnDebugCanvas.value?.width ?? 0, spawnDebugCanvas.value?.height ?? 0)
      return
    }
    const data = game?.getSpawnDebugData()
    if (!data) return
    spawnDebugView?.draw(data, ui)
  }
  draw()
}

function stopSpawnDebugView() {
  if (spawnDebugRaf) {
    cancelAnimationFrame(spawnDebugRaf)
    spawnDebugRaf = null
  }
  if (spawnDebugCanvas.value) {
    spawnDebugCanvas.value.removeEventListener('pointermove', handleSpawnDebugPointerMove)
    spawnDebugCanvas.value.removeEventListener('pointerdown', handleSpawnDebugPointerDown)
    spawnDebugCanvas.value.removeEventListener('pointerleave', handleSpawnDebugPointerLeave)
    const ctx = spawnDebugCanvas.value.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, spawnDebugCanvas.value.width, spawnDebugCanvas.value.height)
  }
  spawnDebugView = null
}

watch(
  () => ui.debugAudioSpawnView.value,
  async (enabled) => {
    if (!enabled) {
      stopSpawnDebugView()
      return
    }
    await nextTick()
    startSpawnDebugView()
  },
)

watch(
  () => statusCanvas.value,
  (value) => {
    if (!value) return
    if (statusRaf) cancelAnimationFrame(statusRaf)
    startStatusScreen()
  },
)

watch(
  () => spawnDebugCanvas.value,
  (value) => {
    if (!value || !ui.debugAudioSpawnView.value) return
    startSpawnDebugView()
  },
)

function initLiveScene(width: number, height: number) {
  liveEnemies.length = 0
  liveEnemies.push(
    {
      type: 'gomba',
      band: 'bass',
      x: width * 0.6,
      y: height - 44,
      width: 24,
      height: 22,
      alive: true,
      squished: false,
      squishTimer: 0,
      pancakeHeight: 5,
      currentHeight: 22,
      bob: 0,
      squash: 1,
      confident: true,
    },
    {
      type: 'spiker',
      band: 'mid',
      x: width * 0.82,
      y: height - 48,
      width: 24,
      height: 30,
      alive: true,
      squished: false,
      squishTimer: 0,
      pancakeHeight: 7,
      currentHeight: 30,
      bob: 0,
      squash: 1,
      confident: true,
      spikes: true,
      concerned: false,
    },
  )
  liveRuntime = {
    width,
    height,
    groundY: height - 6,
    player: {
      x: 16,
      y: height - 50,
      width: 32,
      height: 32,
      vy: 0,
      onGround: true,
    },
    dashActive: false,
    rotation: 0,
    slideActive: false,
    slideElapsed: 0,
    dashGhosts: [],
    invulnTimer: 0,
    deathByEnemy: false,
    phaseActive: false,
    phaseMode: 'terrain',
    phaseModeIndex: 0,
    enemies: liveEnemies,
    intensityWindow: null,
  } as GameRuntime
}

function renderLiveStatus(ctx: CanvasRenderingContext2D, width: number, height: number) {
  if (!liveRuntime || liveEnemies.length === 0) initLiveScene(width, height)
  const runtime = liveRuntime
  if (!runtime) return
  runtime.width = width
  runtime.height = height
  runtime.groundY = height - 6

  const now = performance.now()
  const dt = statusLastTime ? Math.min(0.05, (now - statusLastTime) / 1000) : 0.016
  statusLastTime = now

  const hopPhase = (now * 0.0025) % 1
  const hopHeight =
    hopPhase < 0.5 ? Math.sin(hopPhase * Math.PI) * 14 : Math.sin((1 - hopPhase) * Math.PI) * 6

  runtime.player.x = 16
  runtime.player.y = runtime.groundY - runtime.player.height - hopHeight
  runtime.dashActive = false
  runtime.rotation = 0

  const squishWindow = hopPhase > 0.35 && hopPhase < 0.52
  for (let i = 0; i < liveEnemies.length; i += 1) {
    const enemy = liveEnemies[i]
    enemy.x -= 40 * dt
    if (enemy.x < -60) {
      enemy.x = width + 30 + i * 20
      enemy.squished = false
      enemy.squishTimer = 0
    }
    enemy.y = runtime.groundY - enemy.height + Math.sin(now * 0.005 + i) * 2
    enemy.bob = Math.sin(now * 0.01 + i) * 2
    enemy.squash = 1 + Math.sin(now * 0.007 + i) * 0.04
    if (squishWindow && Math.abs(enemy.x - (runtime.player.x + 18)) < 8) {
      enemy.squished = true
      enemy.squishTimer = 0.2
      enemy.currentHeight = enemy.height
    }
    if (enemy.squished) {
      enemy.squishTimer = Math.max(0, enemy.squishTimer - dt)
      if (enemy.squishTimer === 0) enemy.squished = false
    }
  }

  const palette = getPalette(runtime, ui, 0, 0.4, null)
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.2)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, runtime.groundY + 1)
  ctx.lineTo(width, runtime.groundY + 1)
  ctx.stroke()
  drawEnemies(ctx, runtime, palette)
  drawPlayer(ctx, runtime, ui, palette)
}

function initDeathScene(width: number, height: number) {
  deathFragments.length = 0
  const baseSize = 6
  for (let i = 0; i < 14; i += 1) {
    deathFragments.push({
      x: width * 0.35 + (Math.random() - 0.5) * 8,
      y: height * 0.6 + Math.random() * 8,
      vx: (Math.random() - 0.5) * 40,
      vy: -40 - Math.random() * 60,
      alpha: 0.7 + Math.random() * 0.3,
      size: baseSize * (0.6 + Math.random() * 0.8),
    })
  }
  deathRuntime = {
    width,
    height,
    groundY: height - 6,
    player: {
      x: width * 0.35,
      y: height - 50,
      width: 32,
      height: 32,
      vy: 0,
      onGround: true,
    },
    dashActive: false,
    rotation: 0,
    slideActive: false,
    slideElapsed: 0,
    dashGhosts: [],
    invulnTimer: 0,
    deathByEnemy: true,
    phaseActive: false,
    phaseMode: 'terrain',
    phaseModeIndex: 0,
    enemies: [],
    playerFragments: [],
    intensityWindow: null,
  } as GameRuntime
}

function renderDeathMontage(ctx: CanvasRenderingContext2D, width: number, height: number) {
  if (!deathRuntime) initDeathScene(width, height)
  const runtime = deathRuntime
  if (!runtime) return
  runtime.width = width
  runtime.height = height
  runtime.groundY = height - 6

  const now = performance.now()
  const t = (now - deathStart) / 1000

  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, runtime.groundY + 1)
  ctx.lineTo(width, runtime.groundY + 1)
  ctx.stroke()

  const wreckX = width * 0.24
  const wreckY = runtime.groundY - 18
  const wreckW = 58
  const wreckH = 24
  const flameBaseX = wreckX + wreckW * 0.6
  const flameBaseY = wreckY - 4

  const rollDuration = 0.55
  const explosionDuration = 0.35
  const smokeDuration = 1.1
  const totalBlastTime = rollDuration + explosionDuration
  const clampProgress = (value: number) => Math.max(0, Math.min(1, value))
  const rollProgress = clampProgress(t / rollDuration)
  const explosionProgress = clampProgress((t - rollDuration) / explosionDuration)
  const smokeProgress = clampProgress((t - rollDuration) / smokeDuration)
  const smokeFade = Math.min(1, Math.max(0, 1 - Math.max(0, (t - totalBlastTime) / 0.8)))
  const showWreck = t >= totalBlastTime

  const gombaStartX = width + 40
  const gombaTargetX = flameBaseX - 6
  const easedRoll = 1 - Math.pow(1 - rollProgress, 2)
  const gombaX = gombaStartX + (gombaTargetX - gombaStartX) * easedRoll
  const gombaY = runtime.groundY - 12 - Math.sin(rollProgress * Math.PI) * 3.5
  const gombaRotation = (rollProgress + explosionProgress * 0.2) * Math.PI * 4
  const gombaAlpha = Math.max(0, 1 - explosionProgress)
  const shockProgress = clampProgress(explosionProgress * 1.25)

  if (gombaAlpha > 0) {
    drawDeathGomba(ctx, gombaX, gombaY, 18, gombaRotation, gombaAlpha)
  }

  if (explosionProgress > 0) {
    drawImpactShock(ctx, gombaTargetX, flameBaseY - 6, shockProgress)
    drawDeathExplosion(ctx, gombaTargetX, flameBaseY - 6, explosionProgress)
  }

  if (smokeProgress > 0 && smokeFade > 0) {
    drawDeathSmokeCloud(ctx, gombaTargetX, flameBaseY - 6, smokeProgress, smokeFade)
  }

  if (!showWreck) return

  ctx.save()
  ctx.translate(wreckX + wreckW * 0.5, wreckY + wreckH * 0.6)
  ctx.rotate(-0.25)
  ctx.fillStyle = 'rgba(30, 41, 59, 0.95)'
  ctx.fillRect(-wreckW / 2, -wreckH / 2, wreckW, wreckH)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(-wreckW / 2, -wreckH / 2, wreckW, wreckH)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
  ctx.fillRect(-wreckW / 2 + 6, -wreckH / 2 + 6, wreckW - 12, wreckH - 12)
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = 'rgba(249, 115, 22, 0.35)'
  ctx.beginPath()
  ctx.ellipse(flameBaseX + 4, flameBaseY - 4, 28, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const flameStack = [
    {
      offsetY: 2,
      baseHeight: 34,
      heightVar: 5,
      baseWidth: 30,
      widthVar: 5,
      outer: 'rgba(248, 113, 113, 0.95)',
      inner: 'rgba(251, 146, 60, 0.85)',
    },
    {
      offsetY: -8,
      baseHeight: 26,
      heightVar: 4,
      baseWidth: 24,
      widthVar: 4,
      outer: 'rgba(248, 133, 64, 0.92)',
      inner: 'rgba(253, 189, 71, 0.85)',
    },
    {
      offsetY: -18,
      baseHeight: 18,
      heightVar: 3,
      baseWidth: 18,
      widthVar: 3,
      outer: 'rgba(251, 191, 36, 0.95)',
      inner: 'rgba(255, 224, 129, 0.9)',
    },
  ]

  for (let i = 0; i < flameStack.length; i += 1) {
    const layer = flameStack[i]
    const phase = t * 3 + i * 0.7
    const flicker = 1 + Math.sin(phase * 1.4) * 0.2
    const flameH = layer.baseHeight + flicker * layer.heightVar
    const flameW = layer.baseWidth + flicker * layer.widthVar
    const wobbleX = Math.sin(phase * 1.6) * 2
    const wobbleY = Math.cos(phase * 1.2) * 1.5
    ctx.save()
    ctx.translate(flameBaseX + wobbleX, flameBaseY + layer.offsetY - flicker * 3 + wobbleY)
    ctx.rotate(Math.sin(phase * 0.9) * 0.02)
    drawFireShape(ctx, flameW, flameH, layer.outer, layer.inner)
    ctx.restore()
  }

  for (const f of deathFragments) {
    f.x += f.vx * 0.016
    f.y += f.vy * 0.016
    f.vy -= 12 * 0.016
    f.alpha -= 0.01
    if (f.alpha <= 0 || f.y < 4) {
      f.x = flameBaseX + (Math.random() - 0.5) * 16
      f.y = flameBaseY - Math.random() * 6
      f.vx = (Math.random() - 0.5) * 30
      f.vy = -30 - Math.random() * 50
      f.alpha = 0.7 + Math.random() * 0.3
      f.size = 4 + Math.random() * 5
    }
  }

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (const f of deathFragments) {
    ctx.globalAlpha = f.alpha
    ctx.fillStyle = 'rgba(248, 113, 113, 0.9)'
    ctx.fillRect(f.x, f.y, f.size, f.size)
  }
  ctx.restore()
}

function drawFireShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  outerColor: string,
  innerColor: string,
) {
  ctx.fillStyle = outerColor
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-width * 0.35, -height * 0.3, -width * 0.5, -height * 0.8, 0, -height)
  ctx.bezierCurveTo(width * 0.5, -height * 0.8, width * 0.35, -height * 0.3, 0, 0)
  ctx.closePath()
  ctx.fill()

  const innerHeight = height * 0.75
  const innerWidth = width * 0.55
  ctx.fillStyle = innerColor
  ctx.beginPath()
  ctx.moveTo(0, -height * 0.2)
  ctx.bezierCurveTo(
    -innerWidth * 0.25,
    -innerHeight * 0.35,
    -innerWidth * 0.35,
    -innerHeight,
    0,
    -innerHeight,
  )
  ctx.bezierCurveTo(
    innerWidth * 0.35,
    -innerHeight,
    innerWidth * 0.25,
    -innerHeight * 0.35,
    0,
    -height * 0.2,
  )
  ctx.closePath()
  ctx.fill()
  const highlightColor = 'rgba(255, 255, 255, 0.45)'
  drawFlameTongue(ctx, innerWidth * 0.45, innerHeight * 0.9, -innerWidth * 0.3, highlightColor)
  drawFlameTongue(ctx, innerWidth * 0.35, innerHeight * 0.8, innerWidth * 0.25, highlightColor)
}

function drawFlameTongue(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetX: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(offsetX, -height * 0.25)
  ctx.quadraticCurveTo(offsetX + width * 0.15, -height * 0.55, offsetX, -height)
  ctx.quadraticCurveTo(offsetX - width * 0.15, -height * 0.2, offsetX, -height * 0.25)
  ctx.closePath()
  ctx.fill()
}

function drawDeathGomba(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rotation: number,
  alpha: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = alpha

  const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius)
  gradient.addColorStop(0, '#cbd5f5')
  gradient.addColorStop(1, '#475569')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#38bdf8'
  ctx.beginPath()
  ctx.roundRect(-radius * 0.5, -radius * 0.15, radius, radius * 0.5, radius * 0.24)
  ctx.fill()

  const eyeY = -radius * 0.1
  const eyeR = radius * 0.13
  ctx.fillStyle = '#0b1224'
  ctx.beginPath()
  ctx.arc(-radius * 0.3, eyeY, eyeR, 0, Math.PI * 2)
  ctx.arc(radius * 0.3, eyeY, eyeR, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#f8fafc'
  ctx.beginPath()
  ctx.arc(-radius * 0.3, eyeY - radius * 0.04, radius * 0.04, 0, Math.PI * 2)
  ctx.arc(radius * 0.3, eyeY - radius * 0.04, radius * 0.04, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.roundRect(-radius * 0.25, radius * 0.12, radius * 0.5, radius * 0.08, radius * 0.04)
  ctx.fill()

  ctx.globalAlpha = 1
  ctx.restore()
}

function drawDeathExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  const radius = 24 + progress * 42
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = Math.max(0, 0.9 - progress * 0.7)

  const glow = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius)
  glow.addColorStop(0, 'rgba(255, 237, 213, 0.95)')
  glow.addColorStop(0.5, 'rgba(251, 146, 60, 0.6)')
  glow.addColorStop(1, 'rgba(239, 68, 68, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = Math.max(0, 0.7 - progress * 0.6)
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.85)'
  ctx.lineWidth = 3 + progress * 2
  ctx.beginPath()
  ctx.arc(x, y, radius * (0.4 + progress * 0.4), 0, Math.PI * 2)
  ctx.stroke()

  const sparkCount = 6
  for (let i = 0; i < sparkCount; i += 1) {
    const angle = (i / sparkCount) * Math.PI * 2 + progress * 3.2
    const length = radius * (0.5 + progress * 0.5)
    ctx.globalAlpha = (1 - progress) * 0.9
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.beginPath()
    ctx.ellipse(
      x + Math.cos(angle) * length,
      y + Math.sin(angle) * length,
      3,
      1.5,
      angle,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  ctx.restore()
}

function drawImpactShock(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  if (progress <= 0) return
  const radius = 12 + progress * 40
  const alpha = Math.max(0, 0.6 - progress * 0.6)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = 'rgba(251, 146, 60, 0.85)'
  ctx.lineWidth = 2 + progress * 2
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawDeathSmokeCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  fade: number,
) {
  if (progress <= 0 || fade <= 0) return
  const radius = 20 + progress * 60
  const alpha = Math.max(0, 0.8 - progress * 0.7) * fade
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha

  const gradient = ctx.createRadialGradient(x, y, radius * 0.15, x, y, radius)
  gradient.addColorStop(0, 'rgba(239, 68, 68, 0.65)')
  gradient.addColorStop(0.4, 'rgba(120, 113, 108, 0.55)')
  gradient.addColorStop(1, 'rgba(15, 23, 42, 0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.ellipse(x, y, radius, radius * 0.6, 0, 0, Math.PI * 2)
  ctx.fill()

  const puffCount = 3
  for (let i = 0; i < puffCount; i += 1) {
    const angle = (i / puffCount) * Math.PI * 2 + progress * 1.2
    const puffRadius = radius * 0.6
    ctx.beginPath()
    ctx.ellipse(
      x + Math.cos(angle) * radius * 0.35,
      y + Math.sin(angle) * radius * 0.25,
      puffRadius * 0.9,
      puffRadius * 0.5,
      angle * 0.4,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  ctx.restore()
}

function startStatusScreen() {
  if (!statusCanvas.value) return
  const draw = () => {
    statusRaf = requestAnimationFrame(draw)
    const canvasEl = statusCanvas.value
    if (!canvasEl) return
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return
    const rect = canvasEl.getBoundingClientRect()
    const width = rect.width || canvasEl.clientWidth || 180
    const height = rect.height || canvasEl.clientHeight || 64
    if (canvasEl.width !== width) canvasEl.width = width
    if (canvasEl.height !== height) canvasEl.height = height

    const nextMode = ui.gameOver.value ? 'death' : ui.celebrationVisible.value ? 'combo' : 'live'
    if (nextMode !== statusMode) {
      statusMode = nextMode
      if (nextMode === 'combo') {
        celebrationStart = performance.now()
        celebrationImpact = false
        initCelebrationScene(width, height)
      } else if (nextMode === 'death') {
        deathStart = performance.now()
        deathVariant = 0
        initDeathScene(width, height)
      }
    }

    ctx.clearRect(0, 0, width, height)
    if (nextMode === 'combo') {
      ctx.save()
      renderCelebrationClip(ctx, width, height)
      ctx.restore()
    } else if (nextMode === 'death') {
      renderDeathMontage(ctx, width, height)
    } else {
      renderLiveStatus(ctx, width, height)
    }
  }
  draw()
}

function handleSpawnDebugPointerMove(event: PointerEvent) {
  if (!ui.debugAudioSpawnView.value) return
  const data = game?.getSpawnDebugData()
  if (!data || !spawnDebugView) return
  spawnDebugView.onPointerMove(event, data, ui)
}

function handleSpawnDebugPointerDown(event: PointerEvent) {
  if (!ui.debugAudioSpawnView.value) return
  const data = game?.getSpawnDebugData()
  if (!data || !spawnDebugView) return
  spawnDebugView.onPointerDown(event, data, ui)
}

function handleSpawnDebugPointerLeave() {
  spawnDebugView?.onPointerLeave()
}
</script>

<style scoped>
.game-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 980px;
}

.hud {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.hud-row {
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
}

.hud-item--stack {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
}

.subvalue {
  font-size: 0.65rem;
  color: #94a3b8;
}

.hud-audio {
  margin-top: 0.25rem;
  display: flex;
  justify-content: center;
}

.audio-label {
  font-size: 0.75rem;
  color: #e5e7eb;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(15, 23, 42, 0.9);
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.audio-label input {
  font-size: 0.75rem;
}

.hud-item {
  background: rgba(15, 23, 42, 0.9);
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
}

.status-canvas {
  width: 100%;
  height: 100%;
  display: block;
  background: transparent;
  position: absolute;
  inset: 0;
  pointer-events: none;
  filter: drop-shadow(0 6px 10px rgba(15, 23, 42, 0.35));
}

.hud-item--title {
  padding: 0.35rem 0.7rem;
}
.dev-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  color: #e2e8f0;
}

.dev-toggle input {
  accent-color: #f87171;
}

.hud-difficulty {
  border-radius: 0.9rem;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}

.difficulty-toggle {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.difficulty-button {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #e2e8f0;
  padding: 0.35rem 0.65rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.18s ease;
}

.difficulty-button:hover {
  border-color: #38bdf8;
  color: #38bdf8;
}

.difficulty-button--active {
  border-color: #38bdf8;
  color: #0f172a;
  background: linear-gradient(120deg, #38bdf8, #a855f7);
  box-shadow: 0 6px 18px rgba(56, 189, 248, 0.3);
}

.hud-item .label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #9ca3af;
}

.hud-item .value {
  font-size: 0.95rem;
  font-weight: 600;
  color: #e5e7eb;
}

.pause-button {
  background: rgba(248, 113, 113, 0.18);
  border: 1px solid rgba(248, 113, 113, 0.6);
  color: #fee2e2;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.pause-button:hover {
  border-color: rgba(248, 113, 113, 0.9);
}

.game-frame {
  position: relative;
  border-radius: 1.2rem;
  padding: 0.5rem;
  background: radial-gradient(circle at top left, #0f172a 0, #020617 60%);
  border: 1px solid rgba(148, 163, 184, 0.4);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.85);
  transition:
    box-shadow 120ms ease-out,
    transform 120ms ease-out;
  width: 100%;
  max-width: 960px;
}

.dev-badge {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 2;
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid rgba(248, 113, 113, 0.7);
  color: #fee2e2;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 0 8px 18px rgba(248, 113, 113, 0.25);
}

.game-frame--beat {
  box-shadow: 0 0 24px rgba(56, 189, 248, 0.45);
  transform: translateY(-1px);
}

.game-canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.9rem;
}

.spawn-log-panel {
  width: 100%;
  max-width: 960px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 1rem;
  padding: 0.9rem 1.1rem;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.6);
}

.spawn-debug-panel {
  width: 100%;
  max-width: 960px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 1rem;
  padding: 0.9rem 1.1rem;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.6);
}

.spawn-debug-header h3 {
  margin-bottom: 0.2rem;
}

.spawn-debug-header p {
  margin: 0 0 0.6rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.spawn-debug-legend {
  display: grid;
  gap: 0.45rem;
  font-size: 0.72rem;
  color: #e2e8f0;
  margin-bottom: 0.6rem;
}

.legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.75rem;
  align-items: center;
}

.legend-chip {
  width: 16px;
  height: 6px;
  border-radius: 999px;
  display: inline-block;
}

.legend-chip--bass {
  background: rgba(34, 197, 94, 0.7);
}

.legend-chip--mids {
  background: rgba(56, 189, 248, 0.7);
}

.legend-chip--highs {
  background: rgba(248, 113, 113, 0.7);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  display: inline-block;
}

.legend-dot--gomba {
  background: #f97316;
}

.legend-dot--spiker {
  background: #a855f7;
}

.legend-dot--floater {
  background: #22d3ee;
}

.legend-dot--actual {
  background: rgba(34, 197, 94, 0.95);
}

.legend-line {
  width: 18px;
  height: 2px;
  border-radius: 999px;
  display: inline-block;
}

.legend-line--intensity {
  background: rgba(244, 114, 182, 0.9);
}

.legend-line--drive {
  background: rgba(56, 189, 248, 0.9);
}

.legend-line--loudness {
  background: rgba(250, 204, 21, 0.9);
}

.legend-bar {
  width: 8px;
  height: 12px;
  background: rgba(148, 163, 184, 0.6);
  border-radius: 3px;
  display: inline-block;
}

.legend-note {
  margin: 0;
  color: #94a3b8;
}

.spawn-debug-canvas {
  width: 100%;
  height: 360px;
  display: block;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.levelmap-panel {
  width: 100%;
  max-width: 960px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 1rem;
  padding: 0.9rem 1.1rem;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.6);
}

.levelmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.levelmap-header h3 {
  margin-bottom: 0.2rem;
}

.levelmap-header p {
  margin: 0;
  font-size: 0.75rem;
  color: #94a3b8;
}

.levelmap-controls label {
  font-size: 0.75rem;
  color: #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.levelmap-controls input[type='range'] {
  width: 160px;
}

.levelmap-scroll {
  margin-top: 0.75rem;
  overflow-x: auto;
  overflow-y: hidden;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(2, 6, 23, 0.8);
  cursor: grab;
  scrollbar-color: rgba(56, 189, 248, 0.8) rgba(2, 6, 23, 0.9);
  scrollbar-width: thin;
}

.levelmap-scroll:active {
  cursor: grabbing;
}

.levelmap-scroll::-webkit-scrollbar {
  height: 12px;
}

.levelmap-scroll::-webkit-scrollbar-track {
  background: rgba(2, 6, 23, 0.9);
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2);
}

.levelmap-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, rgba(56, 189, 248, 0.85), rgba(248, 113, 113, 0.8));
  border-radius: 999px;
  border: 2px solid rgba(2, 6, 23, 0.9);
}

.levelmap-scroll::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(90deg, rgba(56, 189, 248, 1), rgba(248, 113, 113, 0.95));
}

.levelmap-canvas {
  display: block;
  height: 120px;
}

.spawn-log-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.spawn-log-header h3 {
  font-size: 1rem;
  margin-bottom: 0.2rem;
}

.spawn-log-header p {
  margin: 0;
  font-size: 0.75rem;
  color: #94a3b8;
}

.spawn-log-toggle {
  background: rgba(56, 189, 248, 0.18);
  border: 1px solid rgba(56, 189, 248, 0.6);
  color: #e2e8f0;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.spawn-log-toggle:hover {
  border-color: rgba(56, 189, 248, 0.9);
}

.spawn-log-notes {
  margin: 0.6rem 0 0.8rem;
  display: grid;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #cbd5f5;
}

.note-tag {
  display: inline-block;
  min-width: 3.2rem;
  font-weight: 700;
  color: #38bdf8;
}

.spawn-log-table {
  display: grid;
  gap: 0.35rem;
}

.spawn-log-row {
  display: grid;
  grid-template-columns: 1.2fr repeat(6, 0.8fr);
  gap: 0.4rem;
  font-size: 0.75rem;
  color: #e2e8f0;
  background: rgba(2, 6, 23, 0.65);
  padding: 0.4rem 0.6rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.spawn-log-row--head {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.65rem;
  color: #94a3b8;
  background: transparent;
  border: none;
  padding: 0 0.2rem;
}

.spawn-log-empty {
  font-size: 0.75rem;
  color: #94a3b8;
  padding: 0.4rem 0.6rem;
}

.overlay {
  position: absolute;
  inset: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.overlay-card {
  pointer-events: auto;
  background: rgba(15, 23, 42, 0.95);
  border-radius: 1rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid rgba(148, 163, 184, 0.6);
  text-align: center;
  max-width: 320px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.9);
}

.overlay-card--collapse {
  animation: collapse-beat 0.32s ease-in forwards;
}

.overlay--paused {
  background: rgba(2, 6, 23, 0.4);
}

.overlay--collapse {
  animation: overlay-fade 0.32s ease-in forwards;
}

.overlay-card--paused {
  border-color: rgba(248, 113, 113, 0.6);
  box-shadow: 0 18px 40px rgba(248, 113, 113, 0.25);
}

@keyframes collapse-beat {
  0% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
  50% {
    transform: scale(1.05) translateY(-6px);
    opacity: 0.8;
  }
  100% {
    transform: scale(0.15) translateY(-40px);
    opacity: 0;
  }
}

@keyframes overlay-fade {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.overlay-card h2 {
  font-size: 1.3rem;
  margin-bottom: 0.4rem;
}

.overlay-card p {
  font-size: 0.9rem;
  margin: 0.2rem 0;
}

.overlay-card .help {
  margin-top: 0.4rem;
  opacity: 0.8;
}

.replay-toast {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(14, 165, 233, 0.9);
  border: 1px solid rgba(125, 211, 252, 0.8);
  color: #0b1224;
  padding: 0.65rem 1.1rem;
  border-radius: 0.75rem;
  box-shadow: 0 10px 24px rgba(59, 130, 246, 0.35);
  text-align: center;
  animation: toast-pop 0.14s ease-out;
  pointer-events: none;
}

.replay-title {
  font-weight: 800;
  font-size: 0.95rem;
  letter-spacing: 0.03em;
}

.replay-sub {
  font-size: 0.8rem;
}

@keyframes toast-pop {
  from {
    transform: translate(-50%, -10px) scale(0.98);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0) scale(1);
    opacity: 1;
  }
}

.score-save {
  display: flex;
  gap: 0.5rem;
  margin: 0.6rem 0;
  justify-content: center;
}

.name-input {
  background: #0b1224;
  border: 1px solid rgba(148, 163, 184, 0.45);
  color: #e5e7eb;
  padding: 0.35rem 0.6rem;
  border-radius: 0.5rem;
  min-width: 140px;
}

.save-button {
  background: linear-gradient(90deg, #22c55e, #38bdf8);
  color: #0b1224;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 0.5rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(56, 189, 248, 0.35);
}

.save-button:hover {
  filter: brightness(1.05);
}

.restart-button {
  margin-top: 0.35rem;
  background: rgba(248, 113, 113, 0.2);
  color: #fee2e2;
  border: 1px solid rgba(248, 113, 113, 0.6);
  padding: 0.35rem 0.8rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 700;
}

.restart-button:hover {
  border-color: rgba(248, 113, 113, 0.9);
}

kbd {
  background: #111827;
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
  border: 1px solid rgba(148, 163, 184, 0.7);
  font-size: 0.8em;
}

.controls {
  font-size: 0.85rem;
  opacity: 0.9;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
}

.controls-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}

.controls-label {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 600;
  opacity: 0.8;
}

.keybinds-panel {
  margin-top: 1.4rem;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 0.9rem;
  padding: 1rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.keybinds-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.keybinds-header h3 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.keybinds-header p {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.8;
}

.keybinds-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.keybind-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.25);
  padding: 0.6rem 0.75rem;
  border-radius: 0.7rem;
  position: relative;
}

.keybind-label {
  font-size: 0.9rem;
  letter-spacing: 0.02em;
}

.keybind-input {
  width: 120px;
  text-align: center;
  background: #0b1224;
  border: 1px solid rgba(148, 163, 184, 0.45);
  color: #e5e7eb;
  padding: 0.35rem 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
}

.keybind-input:focus {
  outline: 2px solid #38bdf8;
  border-color: transparent;
}

.keybind-editing {
  position: absolute;
  bottom: 0.45rem;
  right: 0.75rem;
  font-size: 0.7rem;
  color: #38bdf8;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.access-panel {
  margin-top: 1rem;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.9rem;
  padding: 1rem;
}

.access-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.85rem;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.95rem;
}

.slider-row {
  display: grid;
  gap: 0.35rem;
  font-size: 0.95rem;
}

.slider-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.slider-value {
  min-width: 60px;
  text-align: right;
  font-size: 0.85rem;
  color: #e5e7eb;
}

.scoreboard-panel {
  margin-top: 1rem;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.9rem;
  padding: 1rem;
}

.scoreboard-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.score-slide-enter-active,
.score-slide-leave-active {
  transition: all 0.28s ease;
}
.score-slide-enter-from {
  opacity: 0;
  transform: translateY(14px);
}
.score-slide-leave-to {
  opacity: 0;
  transform: translateY(-14px);
}

.score-row {
  display: grid;
  grid-template-columns: 50px 1fr 100px 100px;
  gap: 0.5rem;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.6rem;
  padding: 0.5rem 0.75rem;
}

.score-row--placeholder {
  border-style: dashed;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.02);
}

.score-row--new {
  box-shadow:
    0 0 0 1px rgba(56, 189, 248, 0.35),
    0 10px 24px rgba(56, 189, 248, 0.2);
  animation: pulse-new 0.6s ease-in-out 1;
}

.score-row--new .score-value {
  color: #38bdf8;
}

@keyframes pulse-new {
  0% {
    transform: translateY(-6px) scale(1.02);
    opacity: 0;
  }
  40% {
    transform: translateY(0) scale(1.01);
    opacity: 1;
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

.score-rank {
  font-weight: 700;
  color: #38bdf8;
}

.score-name {
  font-weight: 600;
}

.score-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #facc15;
  font-weight: 700;
}

.score-date {
  text-align: right;
  opacity: 0.75;
  font-size: 0.85rem;
}

.score-empty {
  opacity: 0.7;
  margin: 0.2rem 0 0;
}
</style>
