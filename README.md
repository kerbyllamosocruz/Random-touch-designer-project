# TouchDesigner Web Studio (ONNX Runtime Web)

A web-based visual programming canvas and real-time generative visual synthesis studio inspired by **Derivative TouchDesigner**, powered by **ONNX Runtime Web (`onnxruntime-web`)**, WebGL, and the Web Audio API.

![TouchDesigner Web Studio](/public/logo.svg)

---

## ⚡ Features

### 1. 🟣 Texture Operators (TOPs)
- **`videoIn`**: Real-time webcam video feed with mirror controls, plus procedural video loops (Cyber Grid, Particle Vortex, Liquid Waves, Sacred Geometry).
- **`movieFileIn`**: Video player supporting custom user video/image file uploads (`.mp4`, `.webm`, `.png`, `.jpg`, `.gif`) with variable speed and loop modes.
- **`feedback`**: TouchDesigner's signature feedback loop operator for recursive trailing, zoom vortexes, rotation, and hue cycling.
- **`displace`**: Dynamic 2D coordinate displacement mapping using secondary textures (depth maps, noise, or ONNX masks).
- **`chromatic`**: Chromatic aberration RGB optical split with configurable distance and angle.
- **`bloom`**: High-pass luminous glow with adjustable blur radius and boost.
- **`kaleidoscope`**: Radial mirror symmetry generator with configurable segment counts and rotation.
- **`level`**: Real-time brightness, contrast, gamma, invert, and opacity controls.
- **`composite`**: Multi-layer blending (`Over`, `Add`, `Screen`, `Multiply`, `Difference`).
- **`noise`**: Procedural animated Simplex/Perlin trigonometric noise.
- **`glsl`**: Live GLSL fragment shader editor with WebGL compilation, live error reporting, and presets (Raymarching Tunnel, Liquid Chrome, VHS Glitch).

### 2. 🔵 ONNX Runtime AI Operators (`onnxModel`)
Run deep learning models directly in the browser via WebAssembly (WASM-SIMD) or WebGPU:
- **MediaPipe Selfie Segmentation** (`selfie_segmentation.onnx`): Real-time person segmentation and background matte extraction (Matte, Cutout, or Neon Glow modes).
- **Neural Sobel Edge Tensor** (`sobel_edge.onnx`): High-speed tensor convolution gradient magnitude edge extractor.
- **Cyber Neural Color Grade** (`neural_filter.onnx`): Neural color matrix transformation and edge contrast sharpening.
- **SqueezeNet 1.1 Vision Classifier** (`squeezenet1.1.onnx`): Deep CNN classifying 1,000 object categories in real time to drive visual parameters.
- **Custom `.onnx` Model Loader**: Drag-and-drop or upload ANY `.onnx` model file (YOLO, MiDaS, FaceMesh, etc.) to inspect and execute in real time.

### 3. 🟢 Channel Operators (CHOPs)
- **`audioIn`**: Live microphone capture or built-in electronic synthesizer beat generator.
- **`audioAnalysis`**: Real-time 512-bin FFT spectrum analysis extracting Sub-Bass, Bass, Mid, Treble, RMS Energy, and Beat transient triggers.
- **`lfo`**: Low-Frequency Oscillator (Sine, Triangle, Square, Ramp) with configurable frequency and amplitude.
- **`math`**: Math transformations (multiplication, addition, range remapping).

### 4. 🟠 Output Operators (OUT)
- **`outWindow`**: Master output window supporting:
  - Fullscreen display (`F10`)
  - High-resolution PNG snapshot download
  - Real-time 60 FPS WebM video recording with live timer and direct download

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production
```bash
npm run build
```

---

## 🎹 Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`TAB`** / **Double Click Canvas** | Open OP Create Dialog |
| **`P`** | Toggle Parameter Inspector Pane |
| **`Space`** | Play / Pause Timeline |
| **`Delete` / `Backspace`** | Delete Selected Operator |
| **`O`** | Open Master Live Output Window |
| **Mouse Wheel** | Zoom Canvas in / out |
| **Drag Canvas Background** | Pan Canvas |

---

## 🎨 Built-in Presets

1. **AI Person Segment & Neon Feedback**: Webcam $\to$ ONNX Selfie Segmentation $\to$ Feedback TOP $\to$ Chromatic Aberration $\to$ Out Window.
2. **Neural Sobel Edge & Kaleidoscope**: Video Loop $\to$ ONNX Sobel Edge $\to$ Kaleidoscope $\to$ Bloom $\to$ Out Window.
3. **Audio-Reactive GLSL & AI**: Audio FFT CHOP $\to$ Webcam $\to$ ONNX Color Grade $\to$ Live GLSL Shader $\to$ Feedback $\to$ Out Window.
4. **SqueezeNet Vision & Displace**: Webcam $\to$ ONNX SqueezeNet Classifier $\to$ Noise $\to$ Displace TOP $\to$ Out Window.

---

## 📦 Project Architecture

```
src/
├── engine/
│   ├── graph/GraphEngine.js            # Core graph engine, topological evaluation loop
│   ├── nodes/NodeDefinitions.js        # Operator definitions & categories
│   ├── onnx/
│   │   ├── OnnxRuntimeService.js       # ONNX Runtime Web session management & inference
│   │   ├── BuiltinModels.js            # Model metadata registry
│   │   └── imagenetLabels.js           # 1,000 ImageNet classification labels
│   ├── operators/
│   │   ├── TexturePipeline.js          # TOP texture processing (Feedback, Displace, etc.)
│   │   └── GlslRunner.js               # WebGL GLSL fragment shader compiler & presets
│   ├── audio/AudioEngine.js            # Web Audio API FFT analyzer & synth generator
│   └── video/MediaService.js           # Webcam streaming & procedural video loops
├── components/
│   ├── Header.jsx                      # Menu bar, presets, toggles, performance monitor
│   ├── NodeCanvas.jsx                  # Infinite pan/zoom canvas, bezier cables, minimap
│   ├── NodeTile.jsx                    # Operator cards with live canvas previews & pins
│   ├── OpCreateDialog.jsx              # Tabbed operator creation dialog
│   ├── ParametersPane.jsx              # Multi-tab parameter inspector
│   ├── TimelineBar.jsx                 # Transport bar, frame counter, audio VU meter
│   └── OutModal.jsx                    # Master render window, video recorder & snapshot
└── index.css                           # Vanilla CSS design system
```
