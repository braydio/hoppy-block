
<template>
  <div class="app-root">
    <header class="app-header">
      <h1>Hoppy Block</h1>
      <p></p>
    </header>

    <main class="app-main">
      <BeatRunnerGame />
    </main>
  </div>
</template>

<script setup>
import BeatRunnerGame from './components/BeatRunnerGame.vue'
</script>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at top, #1f2933 0, #020617 60%);
  color: #e5e7eb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.app-header {
  text-align: center;
  padding: 1.5rem 1rem 0.5rem;
}

.app-header h1 {
  font-size: 2rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.app-header p {
  opacity: 0.8;
  margin-top: 0.25rem;
  font-size: 0.9rem;
}

.app-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
</style>

