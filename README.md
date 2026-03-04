# CatanSight

Real-time strategic overlays for [colonist.io](https://colonist.io). See pip counts at every intersection, track dice rolls, analyze resource scarcity, and more — all without leaving the game.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/License-CC%20BY--NC--ND%204.0-lightgrey)

## Features

### Pip Count Overlay
Color-coded badges on every intersection showing total pip values. Hover for a detailed breakdown of adjacent resources and their individual pip counts.

- **Green** = Excellent (10+ pips)
- **Blue** = Good (7–9 pips)
- **Yellow** = Average (4–6 pips)
- **Red** = Poor (1–3 pips)

### Dice Tracker
Live histogram of all dice rolls during the game. Shows expected vs actual distribution with hot/cold number highlighting.

### Resource Scarcity
Board-wide analysis showing total pips per resource type, ranked from scarcest to most abundant.

### Resource Income Tracker
Per-player resource income tracking based on settlements, cities, and dice rolls.

### Calibration Tool
Visual calibration panel with sliders to precisely align the overlay with your game board. Settings persist across sessions.

## Installation

1. Download or clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `CatanSight` folder
5. Navigate to [colonist.io](https://colonist.io) and start a game

## Usage

Once installed, CatanSight activates automatically when you join a game on colonist.io. The extension intercepts game data via WebSocket messages to provide real-time analysis.

### Controls

| Action | Method |
|--------|--------|
| Toggle pip overlay | `Alt+P` |
| Toggle side panels | `Alt+S` |
| Toggle features | Extension popup |
| Calibrate overlay | Popup > "Calibrate Overlay Position" |

### Calibrating the Overlay

The pip badges need to align with the hex intersections on the game board. If they're misaligned:

1. Click the CatanSight extension icon
2. Click **Calibrate Overlay Position**
3. Adjust the sliders:
   - **Scale** — spread badges out or pull them in
   - **Offset X/Y** — shift the entire overlay
   - **Center X/Y** — adjust the center anchor point
4. Click **Save** when aligned

Calibration is saved and will persist across sessions.

### Side Panels

- **Drag** panels by their header to reposition them anywhere on screen
- **Collapse** panels with the arrow icon
- **Close** panels with the × button
- Re-enable closed panels from the extension popup

## How It Works

CatanSight uses a content script architecture with a MAIN world injector for WebSocket interception:

```
inject.js (MAIN world)          content-script.js (ISOLATED world)
  WebSocket interception  --->    Message routing & module coordination
  MessagePack decoding            Board parser, pip calculator, overlay
  CustomEvent dispatch            Dice tracker, scarcity, resources
```

1. **inject.js** patches `WebSocket.prototype` to capture game messages
2. Binary MessagePack messages are decoded and forwarded via `CustomEvent`
3. **board-parser.js** extracts hex tile data (positions, resources, dice numbers)
4. **hex-geometry.js** computes 54 unique intersections using pointy-top axial coordinates
5. **pip-calculator.js** sums pip values per intersection
6. **overlay-renderer.js** positions HTML badges over the PIXI.js canvas

## Project Structure

```
CatanSight/
├── manifest.json              # Chrome MV3 extension manifest
├── background/
│   └── service-worker.js      # Extension lifecycle & command handling
├── content/
│   ├── inject.js              # MAIN world WebSocket interceptor
│   ├── content-script.js      # Orchestrator & message router
│   ├── board-parser.js        # Extracts board state from WS messages
│   ├── pip-calculator.js      # Pip values & tier classification
│   ├── overlay-renderer.js    # Badge positioning & calibration UI
│   ├── panel-dragger.js       # Drag-to-reposition for panels
│   ├── dice-tracker.js        # Roll histogram panel
│   ├── scarcity-analyzer.js   # Resource scarcity panel
│   └── resource-tracker.js    # Per-player income panel
├── lib/
│   ├── hex-geometry.js        # Axial coordinate math (pointy-top)
│   └── msgpack.js             # Minimal MessagePack decoder
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Toggle & settings logic
│   └── popup.css              # Popup styles
├── styles/
│   └── overlay.css            # All overlay & panel styles
└── icons/                     # Extension icons (16/48/128px)
```

## Disclaimer

CatanSight is an independent project and is not affiliated with, endorsed by, or associated with Catan GmbH, colonist.io, or any of their affiliates. "Catan" is a registered trademark of Catan GmbH. This extension is provided for educational and personal use only.

## License

This project is licensed under [CC BY-NC-ND 4.0](LICENSE).

## Support

If you find CatanSight useful, consider [donating](DONATIONS.md) to support development.

**GitHub:** [KeaganGilmore](https://github.com/KeaganGilmore)
**Discord:** [keagan2980](https://discord.com/users/keagan2980)
