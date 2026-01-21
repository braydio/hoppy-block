# Gameplay Notes

## Phase Shift lane snapping

- When segmented terrain is active, triggering Phase Shift snaps the player to the nearest adjacent
  lane up or down at their current horizontal position.
- A brief invulnerability window is applied during the lane swap to prevent immediate collision
  damage as the transition completes.

## Ground contact detection

- Ground contacts are resolved using frame-to-frame crossings so fast downward movement still snaps
  cleanly onto safe platforms without tunneling through gaps.
