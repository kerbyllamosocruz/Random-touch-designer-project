import { OPERATOR_DEFINITIONS } from '../nodes/NodeDefinitions.js';
import { texturePipeline } from '../operators/TexturePipeline.js';
import { glslRunner, DEFAULT_GLSL_SHADERS } from '../operators/GlslRunner.js';
import { onnxService } from '../onnx/OnnxRuntimeService.js';
import { audioEngine } from '../audio/AudioEngine.js';
import { mediaService } from '../video/MediaService.js';

export class GraphEngine {
  constructor() {
    this.nodes = new Map();         // nodeId -> nodeObject
    this.connections = [];          // Array of { id, fromNode, fromPin, toNode, toPin }
    this.nodeCanvases = new Map();  // nodeId -> HTMLCanvasElement
    this.nodeChannels = new Map();  // nodeId -> channelObject { ... }
    this.nodeOutputs = new Map();   // nodeId -> { texture: Canvas, channels: {} }

    this.frame = 0;
    this.time = 0;
    this.fps = 60;
    this.lastFrameTime = performance.now();
    this.isPlaying = true;
    this.rafId = null;
    this.subscribers = new Set();
    this.onnxPending = new Set(); // nodeIds currently running async ONNX inference

    // Active preset
    this.activePresetId = 'hand_gesture_studio';
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    this.subscribers.forEach(cb => cb(this));
  }

  createNode(type, position = { x: 100, y: 100 }, customParams = {}) {
    const def = OPERATOR_DEFINITIONS[type];
    if (!def) {
      console.error(`Unknown operator type: ${type}`);
      return null;
    }

    const id = `${type}_${Math.random().toString(36).substring(2, 7)}`;
    const params = { ...def.defaultParams, ...customParams };

    if (type === 'glsl' && !params.code) {
      const presetKey = params.shaderPreset || 'raymarch_tunnel';
      params.code = DEFAULT_GLSL_SHADERS[presetKey]?.code || DEFAULT_GLSL_SHADERS.raymarch_tunnel.code;
    }

    const node = {
      id,
      type,
      category: def.category,
      name: id,
      label: def.label,
      position,
      params,
      bypassed: false,
      locked: false,
      inputs: def.inputs,
      outputs: def.outputs,
      status: { fps: 60, ms: 0, res: '640x360' }
    };

    // Allocate canvas buffer for TOP / AI / OUT nodes
    if (def.category === 'TOP' || def.category === 'AI' || def.category === 'OUT') {
      const { canvas } = texturePipeline.getBuffer(id, 640, 360);
      this.nodeCanvases.set(id, canvas);
    }

    this.nodes.set(id, node);
    this.notify();
    return node;
  }

  removeNode(nodeId) {
    // Remove connections to/from this node
    this.connections = this.connections.filter(
      conn => conn.fromNode !== nodeId && conn.toNode !== nodeId
    );
    this.nodes.delete(nodeId);
    this.nodeCanvases.delete(nodeId);
    this.nodeChannels.delete(nodeId);
    this.notify();
  }

  connect(fromNode, fromPin, toNode, toPin) {
    // Avoid self-connections or duplicate connections to the same input pin
    if (fromNode === toNode) return false;
    this.disconnect(toNode, toPin);

    const conn = {
      id: `conn_${Math.random().toString(36).substring(2, 8)}`,
      fromNode,
      fromPin,
      toNode,
      toPin
    };

    this.connections.push(conn);
    this.notify();
    return true;
  }

  disconnect(toNode, toPin) {
    const prevLen = this.connections.length;
    this.connections = this.connections.filter(
      c => !(c.toNode === toNode && c.toPin === toPin)
    );
    if (this.connections.length !== prevLen) {
      this.notify();
    }
  }

  updateNodeParams(nodeId, newParams) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.params = { ...node.params, ...newParams };
      this.notify();
    }
  }

  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  getIncomingNode(nodeId, pinId) {
    const conn = this.connections.find(c => c.toNode === nodeId && c.toPin === pinId);
    if (!conn) return null;
    return this.nodes.get(conn.fromNode);
  }

  getIncomingCanvas(nodeId, pinId) {
    const inNode = this.getIncomingNode(nodeId, pinId);
    if (!inNode) return null;
    return this.nodeCanvases.get(inNode.id) || null;
  }

  getIncomingChannels(nodeId, pinId) {
    const inNode = this.getIncomingNode(nodeId, pinId);
    if (!inNode) return null;
    return this.nodeChannels.get(inNode.id) || null;
  }

  /**
   * Topological sorting to evaluate nodes in order of dependency
   */
  getEvaluationOrder() {
    const visited = new Set();
    const order = [];

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // Find parents
      const parents = this.connections
        .filter(c => c.toNode === nodeId)
        .map(c => c.fromNode);

      parents.forEach(pId => visit(pId));
      order.push(nodeId);
    };

    this.nodes.forEach((_, id) => visit(id));
    return order;
  }

  /**
   * Main animation & evaluation loop (runs up to 60fps)
   */
  startLoop() {
    if (this.rafId) return;

    const loop = (timestamp) => {
      if (!this.lastFrameTime) this.lastFrameTime = timestamp;
      const delta = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;
      if (delta > 0) {
        this.fps = Math.round(1000 / delta);
      }

      if (this.isPlaying) {
        this.step(timestamp);
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Single frame execution
   */
  step(timestamp) {
    this.time = timestamp;
    this.frame++;

    // 1. Update audio reactive metrics
    const audioMetrics = audioEngine.update();

    // 2. Evaluate nodes in topological order
    const evalOrder = this.getEvaluationOrder();

    for (const nodeId of evalOrder) {
      const node = this.nodes.get(nodeId);
      if (!node || node.locked) continue;

      const startTime = performance.now();
      const { canvas, ctx } = texturePipeline.getBuffer(nodeId, 640, 360);

      // If bypassed, pass through input 1
      if (node.bypassed) {
        const inCanvas = this.getIncomingCanvas(nodeId, 'in1');
        if (inCanvas) {
          ctx.drawImage(inCanvas, 0, 0, canvas.width, canvas.height);
        }
        continue;
      }

      // Process operator based on type
      switch (node.type) {
        case 'videoIn': {
          if (node.params.source === 'webcam' && mediaService.isWebcamActive) {
            ctx.save();
            if (node.params.mirror) {
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
            }
            ctx.drawImage(mediaService.webcamVideo, 0, 0, canvas.width, canvas.height);
            ctx.restore();
          } else {
            // Fallback to procedural animated loop
            const loopCanvas = mediaService.renderProceduralLoop(node.params.presetLoop || 'cyber_grid', this.time, canvas.width, canvas.height);
            ctx.drawImage(loopCanvas, 0, 0, canvas.width, canvas.height);
          }
          break;
        }

        case 'movieFileIn': {
          const loopCanvas = mediaService.renderProceduralLoop(node.params.preset || 'particle_vortex', this.time * (node.params.speed || 1.0), canvas.width, canvas.height);
          ctx.drawImage(loopCanvas, 0, 0, canvas.width, canvas.height);
          break;
        }

        case 'noise': {
          texturePipeline.processNoise(this.time, node.params, canvas, ctx);
          break;
        }

        case 'onnxModel': {
          const inCanvas = this.getIncomingCanvas(nodeId, 'in1');
          if (inCanvas) {
            // Draw inCanvas base
            // If we are not currently waiting on an async inference frame, trigger one
            if (!this.onnxPending.has(nodeId)) {
              if (this.frame % (node.params.interval || 1) === 0) {
                this.onnxPending.add(nodeId);
                onnxService.runInference(node.params.modelId, inCanvas, node.params)
                  .then(result => {
                    if (result && result.canvas) {
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                      ctx.drawImage(result.canvas, 0, 0, canvas.width, canvas.height);
                      if (result.channels) {
                        this.nodeChannels.set(nodeId, result.channels);
                      }
                      node.status.ms = Math.round(result.inferenceMs);
                    }
                  })
                  .catch(err => {
                    console.warn(`[ONNX] Inference error in node ${nodeId}:`, err);
                  })
                  .finally(() => {
                    this.onnxPending.delete(nodeId);
                  });
              }
            }
          } else {
            // Draw placeholder notice
            ctx.fillStyle = '#181824';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#06b6d4';
            ctx.font = '12px "JetBrains Mono", monospace';
            ctx.fillText('ONNX TOP: Connect a Texture Input', 20, canvas.height / 2);
          }
          break;
        }

        case 'feedback': {
          const inCanvas = this.getIncomingCanvas(nodeId, 'in1');
          if (inCanvas) {
            texturePipeline.processFeedback(inCanvas, node.params, nodeId, canvas, ctx);
          }
          break;
        }

        case 'displace': {
          const in1 = this.getIncomingCanvas(nodeId, 'in1');
          const in2 = this.getIncomingCanvas(nodeId, 'in2');
          if (in1) {
            texturePipeline.processDisplace(in1, in2, node.params, canvas, ctx);
          }
          break;
        }

        case 'chromatic': {
          const inCanvas = this.getIncomingCanvas(nodeId, 'in1');
          if (inCanvas) {
            texturePipeline.processChromatic(inCanvas, node.params, canvas, ctx);
          }
          break;
        }

        case 'bloom': {
          const inCanvas = this.getIncomingCanvas(nodeId, 'in1');
          if (inCanvas) {
            texturePipeline.processBloom(inCanvas, node.params, canvas, ctx);
          }
          break;
        }

        case 'kaleidoscope': {
          const inCanvas = this.getIncomingCanvas(nodeId, 'in1');
          if (inCanvas) {
            texturePipeline.processKaleidoscope(inCanvas, node.params, canvas, ctx);
          }
          break;
        }

        case 'level': {
          const inCanvas = this.getIncomingCanvas(nodeId, 'in1');
          if (inCanvas) {
            texturePipeline.processLevel(inCanvas, node.params, canvas, ctx);
          }
          break;
        }

        case 'composite': {
          const in1 = this.getIncomingCanvas(nodeId, 'in1');
          const in2 = this.getIncomingCanvas(nodeId, 'in2');
          if (in1) {
            texturePipeline.processComposite(in1, in2, node.params, canvas, ctx);
          }
          break;
        }

        case 'transform': {
          const inCanvas = this.getIncomingCanvas(nodeId, 'in1');
          if (inCanvas) {
            texturePipeline.processTransform(inCanvas, node.params, canvas, ctx);
          }
          break;
        }

        case 'glsl': {
          const in1 = this.getIncomingCanvas(nodeId, 'in1');
          const in2 = this.getIncomingCanvas(nodeId, 'in2');
          const code = node.params.code || DEFAULT_GLSL_SHADERS.raymarch_tunnel.code;
          const glCanvas = glslRunner.render(code, this.time, audioMetrics, in1, in2, canvas.width, canvas.height);
          ctx.drawImage(glCanvas, 0, 0, canvas.width, canvas.height);
          break;
        }

        case 'audioIn': {
          this.nodeChannels.set(nodeId, {
            active: node.params.active,
            energy: audioMetrics.energy,
            waveform: audioMetrics.waveData
          });
          break;
        }

        case 'audioAnalysis': {
          this.nodeChannels.set(nodeId, {
            bass: audioMetrics.bass * (node.params.sensitivity || 1.0),
            mid: audioMetrics.mid * (node.params.sensitivity || 1.0),
            treble: audioMetrics.treble * (node.params.sensitivity || 1.0),
            energy: audioMetrics.energy,
            beat: audioMetrics.beat
          });
          break;
        }

        case 'lfo': {
          const freq = node.params.frequency || 0.5;
          const amp = node.params.amplitude || 1.0;
          const t = (this.time * 0.001 * freq) % 1.0;
          let val = 0;
          if (node.params.waveform === 'sine') {
            val = Math.sin(t * Math.PI * 2);
          } else if (node.params.waveform === 'triangle') {
            val = 1.0 - Math.abs(t * 4 - 2);
          } else if (node.params.waveform === 'square') {
            val = t < 0.5 ? 1 : -1;
          } else {
            val = t * 2 - 1; // ramp
          }
          this.nodeChannels.set(nodeId, {
            val: val * amp + (node.params.offset || 0)
          });
          break;
        }

        case 'handActionFX': {
          const inCanvas = this.getIncomingCanvas(nodeId, 'in1');
          let handData = this.getIncomingChannels(nodeId, 'chanIn');
          if (!handData) {
            for (const [_, ch] of this.nodeChannels.entries()) {
              if (ch && ch.gesture) {
                handData = ch;
                break;
              }
            }
          }
          if (inCanvas) {
            texturePipeline.processHandAction(inCanvas, handData, node.params, this.time, nodeId, canvas, ctx);
          }
          break;
        }

        case 'outWindow': {
          const inCanvas = this.getIncomingCanvas(nodeId, 'in1');
          if (inCanvas) {
            ctx.drawImage(inCanvas, 0, 0, canvas.width, canvas.height);
          } else {
            ctx.fillStyle = '#0a0a0f';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#f59e0b';
            ctx.font = '12px "JetBrains Mono", monospace';
            ctx.fillText('OUT WINDOW: Connect Final TOP', 20, canvas.height / 2);
          }
          break;
        }

        default:
          break;
      }

      const elapsed = performance.now() - startTime;
      if (node.type !== 'onnxModel') {
        node.status.ms = parseFloat(elapsed.toFixed(1));
      }
    }
  }

  /**
   * Load standard starter preset networks
   */
  loadPreset(presetId) {
    this.nodes.clear();
    this.connections = [];
    this.nodeCanvases.clear();
    this.nodeChannels.clear();
    this.activePresetId = presetId;

    if (presetId === 'hand_gesture_studio' || presetId === 'ai_segmentation') {
      // 1. ONNX Hand & Finger Movement Gesture Studio (Different visual results for each gesture!)
      const videoIn = this.createNode('videoIn', { x: 60, y: 140 }, { source: 'webcam', mirror: true, presetLoop: 'cyber_grid' });
      const onnx = this.createNode('onnxModel', { x: 320, y: 140 }, { modelId: 'hand_landmark' });
      const handFX = this.createNode('handActionFX', { x: 580, y: 140 }, { intensity: 1.0 });
      const feedback = this.createNode('feedback', { x: 840, y: 140 }, { decay: 0.86, zoom: 1.015, rotate: 0.005, blendMode: 'source-over' });
      const out = this.createNode('outWindow', { x: 1100, y: 140 });

      this.connect(videoIn.id, 'out1', onnx.id, 'in1');
      this.connect(onnx.id, 'out1', handFX.id, 'in1');
      this.connect(onnx.id, 'chanOut', handFX.id, 'chanIn');
      this.connect(handFX.id, 'out1', feedback.id, 'in1');
      this.connect(feedback.id, 'out1', out.id, 'in1');

    } else if (presetId === 'person_matte') {
      // 2. AI Person Segmentation & Neon Feedback Loop
      const videoIn = this.createNode('videoIn', { x: 80, y: 140 }, { source: 'webcam', mirror: true, presetLoop: 'cyber_grid' });
      const onnx = this.createNode('onnxModel', { x: 340, y: 140 }, { modelId: 'selfie_segmentation', mode: 'glow', threshold: 0.5 });
      const feedback = this.createNode('feedback', { x: 600, y: 140 }, { decay: 0.92, zoom: 1.02, rotate: 0.012, hueShift: 4.0 });
      const chromatic = this.createNode('chromatic', { x: 860, y: 140 }, { offset: 12, angle: 30 });
      const out = this.createNode('outWindow', { x: 1120, y: 140 });

      this.connect(videoIn.id, 'out1', onnx.id, 'in1');
      this.connect(onnx.id, 'out1', feedback.id, 'in1');
      this.connect(feedback.id, 'out1', chromatic.id, 'in1');
      this.connect(chromatic.id, 'out1', out.id, 'in1');

    } else if (presetId === 'sobel_kaleido') {
      // 2. Neural Sobel Edge & Kaleidoscope
      const movie = this.createNode('movieFileIn', { x: 80, y: 140 }, { preset: 'particle_vortex', speed: 1.0 });
      const sobel = this.createNode('onnxModel', { x: 340, y: 140 }, { modelId: 'sobel_edge', edgeBoost: 3.0 });
      const kaleido = this.createNode('kaleidoscope', { x: 600, y: 140 }, { segments: 10, zoom: 1.2, rotation: 15 });
      const bloom = this.createNode('bloom', { x: 860, y: 140 }, { intensity: 2.0, blur: 20 });
      const out = this.createNode('outWindow', { x: 1120, y: 140 });

      this.connect(movie.id, 'out1', sobel.id, 'in1');
      this.connect(sobel.id, 'out1', kaleido.id, 'in1');
      this.connect(kaleido.id, 'out1', bloom.id, 'in1');
      this.connect(bloom.id, 'out1', out.id, 'in1');

    } else if (presetId === 'audio_glsl_ai') {
      // 3. Audio-Reactive GLSL + ONNX Neural Color
      const audio = this.createNode('audioIn', { x: 80, y: 320 }, { source: 'synth' });
      const audioAnalysis = this.createNode('audioAnalysis', { x: 300, y: 320 }, { sensitivity: 1.8 });
      const videoIn = this.createNode('videoIn', { x: 80, y: 120 }, { source: 'webcam', presetLoop: 'liquid_waves' });
      const onnx = this.createNode('onnxModel', { x: 320, y: 120 }, { modelId: 'neural_filter' });
      const glsl = this.createNode('glsl', { x: 580, y: 180 }, { shaderPreset: 'raymarch_tunnel' });
      const feedback = this.createNode('feedback', { x: 840, y: 180 }, { decay: 0.88, zoom: 1.04 });
      const out = this.createNode('outWindow', { x: 1100, y: 180 });

      this.connect(videoIn.id, 'out1', onnx.id, 'in1');
      this.connect(onnx.id, 'out1', glsl.id, 'in1');
      this.connect(audio.id, 'chanOut', audioAnalysis.id, 'chanIn');
      this.connect(glsl.id, 'out1', feedback.id, 'in1');
      this.connect(feedback.id, 'out1', out.id, 'in1');

    } else if (presetId === 'squeezenet_vision') {
      // 4. SqueezeNet Classifier HUD & Displacement
      const videoIn = this.createNode('videoIn', { x: 80, y: 140 }, { source: 'webcam', presetLoop: 'cyber_grid' });
      const onnx = this.createNode('onnxModel', { x: 340, y: 140 }, { modelId: 'squeezenet' });
      const noise = this.createNode('noise', { x: 340, y: 320 }, { scale: 0.04, speed: 1.5 });
      const displace = this.createNode('displace', { x: 620, y: 180 }, { weightX: 30, weightY: 30 });
      const out = this.createNode('outWindow', { x: 900, y: 180 });

      this.connect(videoIn.id, 'out1', onnx.id, 'in1');
      this.connect(videoIn.id, 'out1', displace.id, 'in1');
      this.connect(noise.id, 'out1', displace.id, 'in2');
      this.connect(displace.id, 'out1', out.id, 'in1');
    }

    this.notify();
  }

  /**
   * Export network JSON definition
   */
  exportNetwork() {
    const data = {
      version: '1.0',
      nodes: Array.from(this.nodes.values()).map(n => ({
        id: n.id,
        type: n.type,
        name: n.name,
        position: n.position,
        params: n.params,
        bypassed: n.bypassed,
        locked: n.locked
      })),
      connections: this.connections
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import network JSON definition
   */
  importNetwork(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.nodes.clear();
      this.connections = [];
      this.nodeCanvases.clear();
      this.nodeChannels.clear();

      data.nodes.forEach(n => {
        const node = this.createNode(n.type, n.position, n.params);
        if (node) {
          node.id = n.id;
          node.name = n.name;
          node.bypassed = n.bypassed || false;
          node.locked = n.locked || false;
        }
      });

      this.connections = data.connections || [];
      this.notify();
      return true;
    } catch (e) {
      console.error('Failed to import network JSON:', e);
      return false;
    }
  }
}

export const graphEngine = new GraphEngine();
