# Gassy Grub

Snake, but you're a caterpillar. Eat leaves to grow. Go too long without eating and you fart, shrinking by a third.

## Run locally

No build step. Open `index.html` in a browser, or serve the folder:

```bash
npx serve .        # or: python3 -m http.server 8000
```

Run the logic tests:

```bash
node test.js
```

## Rules

- 20x20 grid. You start at length 3, moving right, one tile per tick.
- One leaf on the board at a time. Eating it: length +1, score +10, hunger resets.
- Every tile moved without eating adds 1 hunger. The fart threshold is **10 × current length**.
- At the threshold you **fart**: lose ⌈length / 3⌉ segments (at least 1), hunger resets, and the threshold recalculates from the new length.
- You die if you hit a wall, hit yourself, or shrink below length 2 (starved out).
- Speed picks up every 5 leaves, up to a cap.
- The hunger meter under the board turns yellow at 70% and red at 90%.

## Controls

- Arrow keys / WASD, or swipe on mobile.
- Space or tap to start, pause, and restart.

## Files

- `index.html`, `style.css`, `game.js` — the game (all graphics drawn on canvas, sounds synthesized with Web Audio).
- `test.js` — node tests for the pure game logic.
