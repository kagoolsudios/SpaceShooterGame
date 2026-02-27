# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development commands

This project is a static HTML5 Canvas game with inline JavaScript and CSS in `index.html`. There is no build step, package.json, or configured test/lint tooling.

Run the game via a simple HTTP server (recommended so that audio works consistently across browsers):

```bash
# From the repo root
python -m http.server 8000
# then open http://localhost:8000/index.html
```

Alternatively, using Node:

```bash
npx serve .
# then open the served URL for index.html
```

You can also open `index.html` directly in a browser, but some browsers may restrict audio when not served over HTTP (see `README.md`).

As of this version of the repo there are no automated tests or linting commands defined. If you add tooling (e.g. Jest, ESLint, Playwright), update this section with the canonical commands, including how to run a single test.

## High-level architecture

The entire game lives in `index.html` as a single-page HTML5 Canvas application:

- **HTML structure**
  - `#gameContainer` wraps the game canvas, in-game UI, start screen, and game-over screen.
  - `#gameCanvas` (800x600) is the sole rendering surface for gameplay.
  - `#ui` overlays score, health, current wave, and active power-up indicator.
  - `#startScreen` and `#gameOver` are overlay panels shown/hidden by the JS control functions.

- **Inline CSS**
  - Defines the retro space aesthetic, including the background gradient, neon borders, button styles, and basic responsive centering.
  - All styling is local to this file; there is no external CSS.

- **Core game state (JS)**
  - Top-level variables track global game state: `gameActive`, `score`, `wave`, `enemiesInWave`, `enemiesDefeated`.
  - `player` is a single object with position, movement speed, health, bullet list, and power-up state.
  - Arrays `enemies`, `particles`, and `powerups` hold all dynamic world entities.
  - A `keys` map tracks input state for arrow/WASD movement and space to shoot.

- **Audio**
  - Uses `AudioContext` with simple oscillator-based sounds (`playSound`) for shots, hits, explosions, power-up pickups, and game-over.
  - Because this relies on the Web Audio API, launching via HTTP (see commands above) avoids common autoplay restrictions.

- **Entity classes**
  - `Particle` handles small visual explosion/exhaust particles with simple physics and fade-out.
  - `Enemy` encapsulates enemy ships. The `type` (`basic`, `fast`, `tank`, `boss`) determines speed, health, size, color, points, and firing cadence. Each enemy maintains its own bullet list and draw/update logic.
  - `Powerup` represents falling power-ups with a randomly chosen type (`rapidfire`, `shield`, `spread`, `health`) and renders as a glowing rotating square with a letter/icon.

- **Player rendering & control**
  - `drawPlayer()` is responsible for rendering the ship, optional shield aura, engine glow, and the player bullets.
  - `updatePlayer()` reads `keys` to move within canvas bounds, runs auto-fire when `rapidfire` is active, advances bullet positions, and manages power-up timers and expiration.
  - `shoot()` constructs one or three bullets depending on whether `spread` is active.

- **Enemy and power-up lifecycle**
  - `spawnEnemy()` chooses an enemy type based on the current wave and randomness, then pushes a new `Enemy` instance into `enemies`.
  - Each `Enemy` manages its own movement, conditional boss behavior, shooting cadence, and bullet updates.
  - `Powerup` instances fall downward and rotate until collected or leaving the screen.

- **Collisions and game rules**
  - `checkCollisions()` resolves:
    - Player bullets vs enemies (damage, particles, scoring, power-up drops, enemy removal).
    - Enemy bullets vs player (damage unless shielded, particles).
    - Direct player–enemy collisions (damage and enemy removal).
    - Player vs power-ups (health restore or activation/refresh of timed power-ups). 
  - Wave progression: when `enemiesDefeated >= enemiesInWave`, the wave increments, difficulty increases (`enemiesInWave` grows, spawn rate scales), the player gets a small health boost, and the UI briefly shows the new wave.
  - Game over is triggered when `player.health <= 0`.

- **Rendering loop & flow control**
  - `drawStars()` renders a simple pseudo-random animated starfield background each frame.
  - `updateGame()` is the main game loop called via `requestAnimationFrame` while `gameActive` is `true`. It:
    - Clears the canvas and draws the starfield.
    - Updates and draws the player, enemies, power-ups, and particles.
    - Prunes off-screen entities and spawns new enemies based on wave-scaled probability and a cap on concurrent enemies.
    - Calls `checkCollisions()` and updates HUD elements (`score`, `health`, `wave`, `powerupIndicator`).
  - `startGame()` initializes/reset all game state, hides the start screen, and kicks off `updateGame()`.
  - `gameOver()` stops the loop by setting `gameActive = false`, shows the game-over overlay with final score, and plays a distinct sound.
  - `restartGame()` hides the game-over panel and delegates to `startGame()`.

## How future agents should work in this repo

- Treat `index.html` as the single source of truth for HTML layout, CSS styling, and game logic. Any refactor that splits JS/CSS into separate files must keep behavior identical unless the user explicitly requests gameplay changes.
- When modifying gameplay systems (difficulty, power-ups, enemy types, scoring), focus on the JS section of `index.html`, especially:
  - Global state variables near the top of the script.
  - The `Enemy` and `Powerup` classes.
  - `updateGame()`, `checkCollisions()`, and `spawnEnemy()` for spawning/progression logic.
- When asked about controls, features, or how to run the game, prefer using the canonical descriptions and instructions from `README.md` rather than re-inventing them.
- If adding new tooling (bundler, linter, tests), keep the existing "open `index.html` / simple HTTP server" flow working as a minimal path, and update this file with any new required commands or project layout changes.
