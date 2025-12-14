
<template>
  <div class="game-shell">
    <div class="hud">
      <div class="hud-item hud-item--stack">
        <div class="hud-row">
          <span class="label">Score</span>
          <span class="value">{{ Math.floor(ui.score.value) }}</span>
        </div>
        <span class="subvalue">Base {{ Math.floor(ui.baseScore.value) }} · Bonus {{ Math.floor(ui.bonusScore.value) }}</span>
      </div>
      <div class="hud-item">
        <span class="label">Speed</span>
        <span class="value">{{ ui.speed.value.toFixed(1) }}x</span>
      </div>
      <div class="hud-item">
        <span class="label">Hoppy Block</span>
        <span class="value">{{ ui.bpm.value }} BPM</span>
      </div>
      <div class="hud-item hud-difficulty">
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
          <input
            type="file"
            accept="audio/*"
            @change="handleAudioUpload"
          />
        </label>
      </div>
    </div>

    <div
      class="game-frame"
      :class="{ 'game-frame--beat': ui.beatPulse.value }"
    >
      <canvas ref="canvas" class="game-canvas"></canvas>

      <div
        v-if="ui.snapshotMessageTimer.value > 0"
        class="replay-toast"
      >
        <div class="replay-title">Tricky!</div>
        <div class="replay-sub">Instant replay captured!</div>
      </div>

      <div
        v-if="ui.replayVisible.value && ui.replayVideoUrl.value"
        class="replay-pip"
      >
        <video
          :key="ui.replayPlaybackKey.value"
          :src="ui.replayVideoUrl.value"
          class="replay-video"
          autoplay
          muted
          playsinline
        ></video>
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
            <button class="save-button" @click="handleSaveScore">
              Save Score
            </button>
          </div>
          <p class="help">
            Press <kbd>Space</kbd> or click to restart.
          </p>
        </div>
      </div>

      <div v-if="!ui.started.value && !ui.gameOver.value" class="overlay">
        <div class="overlay-card" :class="{ 'overlay-card--collapse': ui.introCollapsing.value }">
          <h2>Hoppy Block</h2>

          <p><kbd>{{ keyLabel(keybinds.jump) }}</kbd> — Jump</p>
          <p><kbd>{{ keyLabel(keybinds.slam) }}</kbd> — Slide / Slam</p>
          <p><kbd>{{ keyLabel(keybinds.antigrav) }}</kbd> — Antigrav</p>
          <p><kbd>{{ keyLabel(keybinds.slowmo) }}</kbd> — Slow-Mo</p>
          <p><kbd>{{ keyLabel(keybinds.blast) }}</kbd> — Beat Blast</p>
          <p><kbd>{{ keyLabel(keybinds.phase) }}</kbd> — Phase Shift</p>
          <p><kbd>{{ keyLabel(keybinds.parry) }}</kbd> — Beat Parry</p>

          <p class="help" style="margin-top: 0.6rem;">
          Slam Gombas for bonus energy.
          Slide clears ground foes.
          Blast on-beat to shred everything.
          </p>
        </div>
      </div>


    </div>

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
        <kbd>{{ keyLabel(keybinds.phase) }}</kbd> Phase Shift ·
        <kbd>{{ keyLabel(keybinds.parry) }}</kbd> Parry
      </div>
    </div>

    <section class="keybinds-panel">
      <header class="keybinds-header">
        <h3>Keybinds</h3>
        <p>Click a field, then press the key you want to use.</p>
      </header>
      <div class="keybinds-grid">
        <div
          v-for="action in keybindOptions"
          :key="action.id"
          class="keybind-row"
        >
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
          <span
            class="keybind-editing"
            v-if="editingKey === action.id"
          >
            Listening…
          </span>
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
        <label class="slider-row">
          <span>Beat window</span>
          <div class="slider-wrap">
            <input
              type="range"
              min="40"
              max="160"
              step="5"
              v-model.number="ui.beatWindowMs"
            />
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
            'score-row--new': ui.savedCurrentRun.value && !entry.placeholder && idx === ui.lastSavedIndex.value
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
import { onMounted, onUnmounted, ref } from 'vue'

import { createGameState, loadHighScores, saveHighScore, difficultyOptions, keybindOptions } from '@/game/core/gameState'
import { keyLabel } from '@/game/core/keybinds'
import { createGameLoop } from '@/game/loop'

const canvas = ref<HTMLCanvasElement | null>(null)
const state = createGameState()
const { ui, keybinds, editingKey } = state

let game: ReturnType<typeof createGameLoop> | null = null

function handleSaveScore() {
  saveHighScore(ui, ui.score.value)
}

function handleAudioUpload(event: Event) {
  game?.handleAudioUpload(event)
}

function setDifficulty(level: string) {
  game?.setDifficulty(level)
}

function setKeybind(action: string, event: KeyboardEvent) {
  game?.setKeybind(action, event)
}

onMounted(() => {
  if (!canvas.value) return
  game = createGameLoop(canvas.value, state)
  game.boot()
  loadHighScores(ui)
})

onUnmounted(() => {
  game?.destroy()
})
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

.game-frame {
  position: relative;
  border-radius: 1.2rem;
  padding: 0.5rem;
  background: radial-gradient(circle at top left, #0f172a 0, #020617 60%);
  border: 1px solid rgba(148, 163, 184, 0.4);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.85);
  transition: box-shadow 120ms ease-out, transform 120ms ease-out;
  width: 100%;
  max-width: 960px;
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

@keyframes collapse-beat {
  0% { transform: scale(1) translateY(0); opacity: 1; }
  50% { transform: scale(1.05) translateY(-6px); opacity: 0.8; }
  100% { transform: scale(0.15) translateY(-40px); opacity: 0; }
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

.replay-pip {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 200px;
  height: 112px;
  border: 2px solid rgba(125, 211, 252, 0.8);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.4);
  background: rgba(15, 23, 42, 0.8);
}

.replay-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@keyframes toast-pop {
  from { transform: translate(-50%, -10px) scale(0.98); opacity: 0; }
  to { transform: translate(-50%, 0) scale(1); opacity: 1; }
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
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35), 0 10px 24px rgba(56, 189, 248, 0.2);
  animation: pulse-new 0.6s ease-in-out 1;
}

.score-row--new .score-value {
  color: #38bdf8;
}

@keyframes pulse-new {
  0% { transform: translateY(-6px) scale(1.02); opacity: 0; }
  40% { transform: translateY(0) scale(1.01); opacity: 1; }
  100% { transform: translateY(0) scale(1); }
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
