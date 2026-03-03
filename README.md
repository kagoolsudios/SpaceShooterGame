# 🚀 Space Shooter (HTML5 Canvas Game)

A fast-paced arcade-style space shooter built with vanilla JavaScript and HTML5 Canvas.

Defend the galaxy from alien waves, collect power-ups, and survive as long as possible.

## 🎮 Features
- Smooth canvas-based rendering
- Multiple enemy types (basic, fast, tank, boss)
- Power-ups:
  - Rapid fire
  - Shield
  - Triple shot
  - Health restore
- Particle effects and explosions
- Sound effects via Web Audio API
- Progressive difficulty with wave and boss rounds
- Combo multiplier and persistent high score

## 🕹 Controls
- Arrow Keys / WASD: Move
- Space: Fire
- P: Pause

## 📁 Project structure
```text
SpaceShooterGame/
├── index.html
├── styles/
│   └── game.css
└── js/
    ├── main.js
    ├── config.js
    ├── audio.js
    ├── storage.js
    └── utils.js
```

## ▶️ How to run
No build tools are required.

### Option 1: Open directly
Open `index.html` in your browser.

### Option 2: Local server (recommended)
Some browsers restrict audio unless served via HTTP.

```bash
# Python
python -m http.server

# Node
npx serve
```

Then open `http://localhost:8000` (Python) or the URL printed by `serve`.
