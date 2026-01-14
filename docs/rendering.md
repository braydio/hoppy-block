# Rendering Notes

## Ground lane rendering
- Ground is rendered per lane using `runtime.groundSegments` so segmented layouts can show distinct tiers.
- Safe spans receive a beat-synced pulse highlight, while unsafe spans use a lower-alpha fill with dashed
  interior strokes to keep gaps readable.
- During lead-in intensity windows, a subtle overlay is applied per segment to maintain the lead-in
  treatment without masking gaps.

## Debug overlays
- The spawn debug overlay now includes a lane timeline panel that visualizes active Y-levels, unsafe gaps,
  and the player's lane index over time to support difficulty tuning.
