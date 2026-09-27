# TouchDesigner Web Studio

A web-based visual programming canvas and real-time generative visual synthesis studio inspired by **Derivative TouchDesigner**, powered by **MediaPipe Hand Landmark detection**, **ONNX Runtime Web**, and WebGL.

---

## ⚡ Features

### 1. 🖐 MediaPipe Hand Tracking (`mediaPipeHand`)
Real-time dual-hand detection using MediaPipe HandLandmarker (GPU/WebGL accelerated):
- Tracks **21 landmarks** per hand at up to 60 FPS
- Exports per-finger extension state, gesture classification, wrist & fingertip positions as CHOP channels
- **Toggleable overlay layers** (all off by default for a clean camera feed):
  - **Skeleton Bones** — colored gradient lines connecting all 21 joints
  - **Joint Dots** — circle markers at each landmark
  - **Fingertip Reticles** — ring circles + `L-IDX / R-IDX` label badges at each fingertip
  - **Gesture FX** — gesture-reactive particles (fist vortex, palm burst, pointing laser trail, etc.)
- Gesture classification: `open_palm`, `fist`, `pointing`, `peace`, `pinch`, `rock`, `thumbs_up`

### 2. ✨ Dual-Hand Glass Portal Operator (`handActionFX`)
Holographic glass membrane that forms between both hands' fingertips with real-time visual effects:

#### Interactive Fingertip Selector
- **SVG hand diagram** with 5 clickable fingertip nodes — click to toggle each finger ON/OFF
- Active fingers shown in electric lime `#c6ff00`; inactive shown as dashed circles
- Live counter: `X/5 ACTIVE`
- **Preset buttons**: `ALL 5`, `POINTING` (index only), `PINCH` (thumb + index)
- Glass polygon and all connecting lines only span the **selected fingers**

#### 9 Portal Visual Styles
| Style | Description |
|---|---|
| **PRISM GLASS** | Refractive magnification + chromatic RGB dispersion |
| **HALFTONE MATRIX** | Pop-art magenta dot grid |
| **THERMAL INFRARED** | Blue-to-yellow heat signature map |
| **CYBER SCANLINE** | Teal holographic grid with moving scanner line |
| **VHS GLITCH** | RGB channel split + horizontal noise bars |
| **VOID RIFT** | Pure black void with electric arc lightning bolts |
| **NEON NOIR** | Black interior with cycling neon hue wireframe overlay |
| **PIXELATE** | Pulsing 8-bit mosaic with pixel grid lines |
| **LIQUID CHROME** | Grayscale feed with iridescent interference bands |

#### Gesture Controls
- **Closed fist (either hand)** → all effects immediately suppressed, clean camera only
  - Uses **per-frame landmark distance check** — zero lag, fires the instant fingers curl
- **Open hands** → full effect active
- Adjustable **Intensity** (0.2× – 3.0×) slider

### 3. 🟣 Texture Operators (TOPs)
- **`videoIn`**: Real-time webcam feed with mirror controls + procedural video loops
- **`movieFileIn`**: Video/image file player with variable speed and loop modes
- **`feedback`**: Recursive trailing, zoom vortex, rotation, hue cycling
- **`displace`**: 2D coordinate displacement with secondary textures
- **`chromatic`**: RGB optical split with configurable distance and angle
- **`bloom`**: High-pass luminous glow
- **`kaleidoscope`**: Radial mirror symmetry generator
- **`level`**: Brightness, contrast, gamma, invert, opacity
- **`composite`**: Multi-layer blending (Over, Add, Screen, Multiply, Difference)
- **`noise`**: Procedural animated Simplex/Perlin noise
- **`glsl`**: Live GLSL fragment shader editor with WebGL compilation and presets

### 4. 🔵 ONNX Runtime AI Operators (`onnxModel`)
Run deep learning models in-browser via WASM-SIMD or WebGPU:
- **MediaPipe Selfie Segmentation**: Person segmentation & background matte
- **Neural Sobel Edge Tensor**: Gradient magnitude edge extractor
- **Cyber Neural Color Grade**: Neural color matrix transformation
- **SqueezeNet 1.1**: 1,000-class vision classifier
- **Custom `.onnx` Model Loader**: Upload any `.onnx` file and execute in real time

### 5. 🟢 Channel Operators (CHOPs)
- **`audioIn`**: Live microphone capture
- **`audioAnalysis`**: Real-time 512-bin FFT — Sub-Bass, Bass, Mid, Treble, RMS, Beat triggers
- **`lfo`**: Low-Frequency Oscillator (Sine, Triangle, Square, Ramp)
- **`math`**: Multiplication, addition, range remapping

### 6. 🟠 Output Operators (OUT)
- **`outWindow`**: Master output with fullscreen (`F10`), PNG snapshot, and WebM video recording

---

## 🚀 Quick Start

```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

```bash
npm run build   # Production bundle
```

---

## 🎹 Keyboard Shortcuts

| Shortcut | Action |
|:---|:---|
| `TAB` / Double Click Canvas | Open OP Create Dialog |
| `P` | Toggle Parameter Inspector |
| `Space` | Play / Pause Timeline |
| `Delete` / `Backspace` | Delete Selected Operator |
| `O` | Open Master Live Output Window |
| Mouse Wheel | Zoom Canvas |
| Drag Canvas Background | Pan Canvas |

---

## 🎨 Using the Hand Portal

1. Add a **`videoIn`** node → connect to **`mediaPipeHand`** → connect to **`handActionFX`** → connect to **`outWindow`**
2. Allow camera access when prompted
3. Raise **both hands** in front of the camera
4. Click the **`handActionFX`** node to open its settings:
   - Click fingertip circles on the SVG hand diagram to choose which fingers draw lines
   - Pick a portal style (Prism Glass, Void Rift, VHS Glitch, etc.)
   - Adjust intensity with the slider
5. Click the **`mediaPipeHand`** node to toggle skeleton / joint / reticle overlays on the camera feed
6. **Close either fist** to instantly hide all effects — open your hands to resume

---

## 📦 Project Architecture

```
src/
├── engine/
│   ├── graph/GraphEngine.js              # Core graph evaluation loop
│   ├── nodes/NodeDefinitions.js          # Operator definitions & default params
│   ├── mediapipe/
│   │   └── MediaPipeService.js           # Hand landmark detection, overlay rendering
│   ├── onnx/
│   │   ├── OnnxRuntimeService.js         # ONNX Runtime Web session management
│   │   ├── HandGestureDetector.js        # 21-landmark gesture classifier & skeleton renderer
│   │   └── BuiltinModels.js              # Model metadata registry
│   ├── operators/
│   │   ├── TexturePipeline.js            # handActionFX: glass polygon, 9 portal styles,
│   │   │                                 #   activeFingers filtering, fist suppression
│   │   └── GlslRunner.js                 # WebGL GLSL fragment shader compiler
│   └── video/MediaService.js             # Webcam streaming & procedural video loops
├── components/
│   ├── Header.jsx                        # Menu bar, presets, performance monitor
│   ├── NodeCanvas.jsx                    # Infinite pan/zoom canvas, bezier cables
│   ├── NodeTile.jsx                      # Operator cards with live canvas previews
│   ├── OpCreateDialog.jsx                # Operator creation dialog
│   ├── ParametersPane.jsx                # Parameter inspector with SVG hand selector
│   ├── LiveHeroMonitor.jsx               # Fullscreen live preview component
│   ├── TimelineBar.jsx                   # Transport bar, frame counter
│   └── OutModal.jsx                      # Render window, video recorder & snapshot
└── index.css                             # Neo-brutalist design system (obsidian + acid lime)
```

---

## 🎨 Design System

The UI uses a **neo-brutalist** aesthetic:
- **Base**: Obsidian dark `#0a0b0f`
- **Accent**: Electric acid lime `#c6ff00`
- **Typography**: JetBrains Mono (monospace), Inter (UI)
- **Motion**: Focused micro-animations, no gratuitous effects
- **Principle**: High-contrast, utilitarian, raw

---

## 📝 License

MIT
