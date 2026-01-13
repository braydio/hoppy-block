<template>
  <div class="app-root">
    <header class="app-header">
      <div class="title-wrap">
        <div class="title-vignette-slot" aria-hidden="true"></div>
        <h1>HOPPY BLOCK</h1>
        <span class="title-glow"></span>
      </div>
      <p class="byline">by brayden</p>
    </header>

    <main class="app-main">
      <HoppyBlockGame />
    </main>
  </div>
</template>

<script setup>
import HoppyBlockGame from './components/HoppyBlockGame.vue'
</script>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at top, #1f2933 0, #020617 60%);
  color: #e5e7eb;
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

.app-header {
  text-align: center;
  padding: 1.5rem 1rem 0.5rem;
}

.title-wrap {
  position: relative;
  display: inline-block;
  padding: 0.35rem 1.2rem 0.35rem 12rem;
  border-radius: 0.9rem;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(56, 189, 248, 0.14));
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 8px 28px rgba(34, 211, 238, 0.25);
  overflow: visible;
}

.title-vignette-slot {
  position: absolute;
  left: 0.6rem;
  bottom: -0.2rem;
  width: 180px;
  height: 64px;
  pointer-events: none;
  z-index: 2;
}

.title-wrap h1 {
  font-size: 2.4rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin: 0;
  color: #e2f3ff;
  text-shadow:
    0 0 12px rgba(34, 211, 238, 0.8),
    0 0 24px rgba(56, 189, 248, 0.6);
  font-family: 'Audiowide', 'Orbitron', 'Michroma', system-ui, sans-serif;
}

.title-glow {
  position: absolute;
  inset: -6px;
  border-radius: 1.1rem;
  background:
    radial-gradient(circle at 20% 20%, rgba(34, 197, 94, 0.4), transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(56, 189, 248, 0.35), transparent 45%);
  filter: blur(12px);
  z-index: -1;
}

.byline {
  opacity: 0.75;
  margin-top: 0.35rem;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  font-style: italic;
}

.app-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .title-wrap {
    padding-left: 10.5rem;
  }

  .title-vignette-slot {
    width: 150px;
    height: 54px;
    left: 0.4rem;
    bottom: -0.15rem;
  }
}
</style>
