src/
├─ main.ts
├─ App.vue
│
├─ game/
│ ├─ core/
│ │ ├─ gameState.ts // central mutable state (player, score, flags)
│ │ ├─ constants.ts // all those beautiful magic numbers
│ │ └─ types.ts // Enemy, Player, Obstacle, etc.
│ │
│ ├─ systems/
│ │ ├─ audioEngine.ts // Web Audio + analyser + BPM + energy
│ │ ├─ beatSystem.ts // beat timing, windows, streaks
│ │ ├─ physicsSystem.ts // gravity, movement, collisions
│ │ ├─ spawnSystem.ts // enemies, formations, obstacles
│ │ ├─ combatSystem.ts // slam, blast, parry logic
│ │ └─ replaySystem.ts // MediaRecorder buffer & replay
│ │
│ ├─ render/
│ │ ├─ drawWorld.ts // sky, ground, stripes, beat line
│ │ ├─ drawPlayer.ts
│ │ ├─ drawEnemies.ts
│ │ ├─ drawEffects.ts // shockwaves, bursts, pops
│ │ └─ drawHUD.ts
│ │
│ └─ loop.ts // update(dt), draw(), requestAnimationFrame
│
├─ components/
│ └─ HoppyBlockGame.vue // now thin: wiring + refs + UI
│
├─ style.css
└─ assets/
└─ audio/
└─ clarity.mp3
