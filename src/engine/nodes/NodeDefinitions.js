/**
 * TouchDesigner Operator Node Definitions
 */

export const NODE_CATEGORIES = {
  TOP: { id: 'TOP', label: 'TOP (Texture)', color: '#8b5cf6', badge: '🟣' },
  AI: { id: 'AI', label: 'AI (ONNX Runtime)', color: '#06b6d4', badge: '🔵' },
  CHOP: { id: 'CHOP', label: 'CHOP (Channel)', color: '#10b981', badge: '🟢' },
  OUT: { id: 'OUT', label: 'OUT (Render / Record)', color: '#f59e0b', badge: '🟠' }
};

export const OPERATOR_DEFINITIONS = {
  // === TOPs ===
  videoIn: {
    type: 'videoIn',
    category: 'TOP',
    name: 'videoIn',
    label: 'Video In (Webcam)',
    inputs: [],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      source: 'webcam', // 'webcam' or 'loop'
      presetLoop: 'cyber_grid',
      mirror: true,
      resolution: '640x360',
      active: true
    }
  },
  movieFileIn: {
    type: 'movieFileIn',
    category: 'TOP',
    name: 'movieFileIn',
    label: 'Movie File In',
    inputs: [],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      preset: 'cyber_grid', // 'cyber_grid', 'particle_vortex', 'liquid_waves', 'geometric_kaleido'
      speed: 1.0,
      play: true
    }
  },
  feedback: {
    type: 'feedback',
    category: 'TOP',
    name: 'feedback',
    label: 'Feedback TOP',
    inputs: [{ id: 'in1', label: 'Source', type: 'texture' }],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      decay: 0.93,
      zoom: 1.03,
      rotate: 0.015,
      hueShift: 2.0,
      blendMode: 'lighter'
    }
  },
  displace: {
    type: 'displace',
    category: 'TOP',
    name: 'displace',
    label: 'Displace TOP',
    inputs: [
      { id: 'in1', label: 'Source', type: 'texture' },
      { id: 'in2', label: 'Displace Map', type: 'texture' }
    ],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      weightX: 28,
      weightY: 28
    }
  },
  chromatic: {
    type: 'chromatic',
    category: 'TOP',
    name: 'chromatic',
    label: 'Chromatic Aberration',
    inputs: [{ id: 'in1', label: 'Source', type: 'texture' }],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      offset: 14,
      angle: 45
    }
  },
  bloom: {
    type: 'bloom',
    category: 'TOP',
    name: 'bloom',
    label: 'Bloom / Glow TOP',
    inputs: [{ id: 'in1', label: 'Source', type: 'texture' }],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      intensity: 1.8,
      blur: 16
    }
  },
  kaleidoscope: {
    type: 'kaleidoscope',
    category: 'TOP',
    name: 'kaleidoscope',
    label: 'Kaleidoscope TOP',
    inputs: [{ id: 'in1', label: 'Source', type: 'texture' }],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      segments: 8,
      rotation: 0,
      zoom: 1.0
    }
  },
  level: {
    type: 'level',
    category: 'TOP',
    name: 'level',
    label: 'Level TOP',
    inputs: [{ id: 'in1', label: 'Source', type: 'texture' }],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      brightness: 1.1,
      contrast: 1.2,
      gamma: 1.0,
      invert: false,
      opacity: 1.0
    }
  },
  composite: {
    type: 'composite',
    category: 'TOP',
    name: 'composite',
    label: 'Composite TOP',
    inputs: [
      { id: 'in1', label: 'Input 1', type: 'texture' },
      { id: 'in2', label: 'Input 2', type: 'texture' }
    ],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      operation: 'lighter', // 'source-over', 'lighter', 'multiply', 'screen', 'difference'
      opacity2: 1.0
    }
  },
  noise: {
    type: 'noise',
    category: 'TOP',
    name: 'noise',
    label: 'Noise TOP',
    inputs: [],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      scale: 0.02,
      speed: 1.2
    }
  },
  transform: {
    type: 'transform',
    category: 'TOP',
    name: 'transform',
    label: 'Transform TOP',
    inputs: [{ id: 'in1', label: 'Source', type: 'texture' }],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      scale: 1.0,
      rotate: 0,
      tx: 0,
      ty: 0
    }
  },
  glsl: {
    type: 'glsl',
    category: 'TOP',
    name: 'glsl',
    label: 'GLSL Shader TOP',
    inputs: [
      { id: 'in1', label: 'Texture 0', type: 'texture' },
      { id: 'in2', label: 'Texture 1', type: 'texture' }
    ],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      shaderPreset: 'raymarch_tunnel',
      code: null // will populate from preset
    }
  },

  // === AI / ONNX Operators ===
  onnxModel: {
    type: 'onnxModel',
    category: 'AI',
    name: 'onnxModel',
    label: 'ONNX Hand & Vision AI',
    inputs: [{ id: 'in1', label: 'Image In', type: 'texture' }],
    outputs: [
      { id: 'out1', label: 'Output Texture', type: 'texture' },
      { id: 'chanOut', label: 'ONNX Channels', type: 'channel' }
    ],
    defaultParams: {
      modelId: 'hand_landmark', // 'hand_landmark', 'selfie_segmentation', 'sobel_edge', 'neural_filter', 'squeezenet', 'custom'
      mode: 'matte', // 'matte', 'cutout', 'glow'
      threshold: 0.5,
      invert: false,
      edgeBoost: 2.5,
      customFileName: '',
      interval: 1 // Run every N frames
    }
  },

  handActionFX: {
    type: 'handActionFX',
    category: 'TOP',
    name: 'handActionFX',
    label: 'Hand Gesture Action FX',
    inputs: [
      { id: 'in1', label: 'Texture In', type: 'texture' },
      { id: 'chanIn', label: 'Hand CHOP In', type: 'channel' }
    ],
    outputs: [{ id: 'out1', label: 'Texture', type: 'texture' }],
    defaultParams: {
      intensity: 1.0,
      active: true
    }
  },

  // === CHOPs ===
  audioIn: {
    type: 'audioIn',
    category: 'CHOP',
    name: 'audioIn',
    label: 'Audio In CHOP',
    inputs: [],
    outputs: [{ id: 'chanOut', label: 'Audio Signal', type: 'channel' }],
    defaultParams: {
      source: 'synth', // 'mic' or 'synth'
      active: true
    }
  },
  audioAnalysis: {
    type: 'audioAnalysis',
    category: 'CHOP',
    name: 'audioAnalysis',
    label: 'Audio Analysis CHOP',
    inputs: [{ id: 'chanIn', label: 'Audio In', type: 'channel' }],
    outputs: [{ id: 'chanOut', label: 'FFT Channels', type: 'channel' }],
    defaultParams: {
      sensitivity: 1.5,
      smoothing: 0.8
    }
  },
  lfo: {
    type: 'lfo',
    category: 'CHOP',
    name: 'lfo',
    label: 'LFO CHOP',
    inputs: [],
    outputs: [{ id: 'chanOut', label: 'LFO Signal', type: 'channel' }],
    defaultParams: {
      waveform: 'sine', // 'sine', 'triangle', 'square', 'ramp'
      frequency: 0.5,
      amplitude: 1.0,
      offset: 0.0
    }
  },
  math: {
    type: 'math',
    category: 'CHOP',
    name: 'math',
    label: 'Math CHOP',
    inputs: [{ id: 'chanIn', label: 'Input Signal', type: 'channel' }],
    outputs: [{ id: 'chanOut', label: 'Math Signal', type: 'channel' }],
    defaultParams: {
      operation: 'multiply', // 'multiply', 'add', 'remap'
      multiplier: 2.0,
      offset: 0.0
    }
  },

  // === OUT ===
  outWindow: {
    type: 'outWindow',
    category: 'OUT',
    name: 'outWindow',
    label: 'Out Window TOP',
    inputs: [{ id: 'in1', label: 'Final Output', type: 'texture' }],
    outputs: [],
    defaultParams: {
      title: 'Final Render',
      resolution: '1280x720',
      active: true
    }
  }
};
