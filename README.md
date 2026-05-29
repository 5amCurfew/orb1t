# ORB1T 🌙

A 1-bit isometric space survival game built with Three.js

## Features

- **Procedurally Generated Terrain**: Dramatic moon-like landscapes with dynamic generation
- **Three Climate Types**: Arctic, Tropical, and Stone biomes
- **Low Gravity Physics**: Moon-like movement with responsive jumping
- **Isometric Camera**: 4-directional rotation with elevated perspective
- **Stippling Shader for Cliffs**: Dot-based shading on steep slopes (more dots = more shadow)
- **Square Grid Overlay**: Black grid lines that follow terrain elevation
- **Smart Slope Traversal**: Characters can climb small steps but not steep cliffs
- **Character Controller**: Blue character with screen-relative diagonal movement
- **Sniper Rifle**: Red projectile bullets with physics and fast firing rate

## Project Structure

```
orb1t/
├── src/
│   ├── character/
│   │   └── Character.js       # Player controller with physics and shooting
│   ├── world/
│   │   ├── Terrain.js         # Procedural terrain generation
│   │   └── IsometricCamera.js # Camera system with rotation
│   ├── lib/
│   │   ├── shaders.js         # 1-bit rendering shaders
│   │   ├── noise.js           # Simplex noise generator
│   │   └── utils.js           # Utility functions
│   └── main.js                # Game entry point
├── index.html
├── package.json
└── vite.config.js
```

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Controls

- **Arrow Keys**: Move character (relative to camera orientation)
- **W**: Jump (low gravity with responsive feel)
- **R**: Shoot sniper rifle (red projectile)
- **Q/E**: Rotate camera 90° (4 directions)

## Technical Details

### Terrain Generation

The terrain uses multi-octave simplex noise to create:
- **Elevation**: Base height maps with mountainous regions
- **Moisture**: Determines water feature placement
- **Temperature**: Defines climate zones

### 1-Bit Rendering

Custom GLSL shaders provide the retro 1-bit aesthetic:
- Threshold-based black/white rendering
- Dithering patterns for texture
- Climate-specific subtle tinting
- Animated water with procedural patterns

### World Scale

- World size: 1000x1000 units
- Character scale: ~2 units tall
- Chunk-based terrain streaming for performance
- View distance: 3 chunks in each direction

## Roadmap

- [ ] Survival mechanics (oxygen, health)
- [ ] Resource gathering
- [ ] Base building
- [ ] Enemy AI
- [ ] Inventory system
- [ ] Day/night cycle
- [ ] Weather effects

## License

MIT
