# Hoppy Block

Rhythm runner where you surf the beat, jump gaps, and slam enemies for charge and points.

## Quickstart
- Install deps: `npm install`
- Dev server: `npm run dev` then open the shown URL.
- Production build: `npm run build`
- Type-check only: `npm run type-check`

## How to Play
- Survive as long as possible while the scroll speed ramps up with your score.
- Stay on-beat for stronger actions and score multipliers.
- Slam Gombas (orange) for bonus charge; avoid slamming Spikers (blue).
- Floaters (purple) get angry over time—slam them only when calm or while slowed.
- Double-jump midair (costs charge) to extend combos; antigrav/slow-mo drain charge while held.
- Huge slams near Spikers pop their spikes off, letting you stomp them safely afterward.
- Beat Blast (dash) deletes anything in front of you when timed near the beat.
- Phase Shift lets you ignore one category of hazard until the timer ends.
- Energy (charge) powers special moves; keep it above zero to retain options.
- Land three aerial hits in a row to trigger an instant-replay clip of the moment.

## Controls (default, all rebindable in UI)
- Jump: Space
- Slam: Shift
- Antigrav (hang): Arrow Up
- Slow-Mo: Arrow Down
- Beat Blast (dash): Arrow Right
- Phase Shift: Arrow Left
- Beat Parry: E

## Tips
- Jump or slam slightly on-beat to earn charge.
- Use slow-mo to line up tight jumps or calm enraged floaters.
- Phase terrain to bypass walls; phase enemy types to ghost through them.
- Dash when the beat glow appears to maximize range and score.
- Slide to clear low enemies; chain into a jump to keep your combo alive.

## Music & Beat Sync
- Upload your own track from the HUD; BPM is auto-detected and drives spawns/beat pulses.
- A default track is provided if you skip the upload.
- Adjust beat leniency with the Beat Window slider (ms) under Accessibility.

## Difficulty & Accessibility
- Difficulty buttons in the HUD tweak speed, spawn rate, and rhythm uniformity.
- Rebind any action via the Keybinds panel—click a field and press a key.
- High-contrast palette toggle helps colorblind players distinguish enemies/hazards.

## High Scores & Replays
- Enter your name on the Game Over screen to save runs locally; top 10 scores are kept with dates.
- Stylish air-combo moments auto-capture a 5s instant replay, shown picture-in-picture.
