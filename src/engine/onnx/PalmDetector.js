/**
 * MediaPipe BlazePalm SSD Detector
 * Fast in-browser palm bounding box localization for precise hand tracking
 * Prevents hand landmark false positives on head, face, or background
 */
import * as ort from 'onnxruntime-web';

export class PalmDetector {
  constructor() {
    this.session = null;
    this.loadingPromise = null;
    this.anchors = this.generateAnchors();
    this.canvas128 = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (this.canvas128) {
      this.canvas128.width = 128;
      this.canvas128.height = 128;
      this.ctx128 = this.canvas128.getContext('2d', { willReadFrequently: true });
    }
    this.inputData = new Float32Array(3 * 128 * 128);
  }

  generateAnchors() {
    const anchors = [];
    // Layer 1: stride 8, 16x16 grid, 2 anchors per cell
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const cx = (x + 0.5) / 16;
        const cy = (y + 0.5) / 16;
        anchors.push({ x: cx, y: cy });
        anchors.push({ x: cx, y: cy });
      }
    }
    // Layer 2: stride 16, 8x8 grid, 6 anchors per cell
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cx = (x + 0.5) / 8;
        const cy = (y + 0.5) / 8;
        for (let k = 0; k < 6; k++) {
          anchors.push({ x: cx, y: cy });
        }
      }
    }
    return anchors;
  }

  async load(modelUrl = '/models/palm_detection.onnx', provider = 'wasm') {
    if (this.session) return this.session;
    if (this.loadingPromise) return await this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        const res = await fetch(modelUrl);
        if (!res.ok) throw new Error(`Failed to fetch ${modelUrl}: ${res.statusText}`);
        const modelBuffer = await res.arrayBuffer();
        this.session = await ort.InferenceSession.create(modelBuffer, {
          executionProviders: [provider],
          graphOptimizationLevel: 'all'
        });
        console.log('[PalmDetector] Initialized BlazePalm model successfully');
        return this.session;
      } catch (err) {
        console.warn('[PalmDetector] Error initializing palm detector:', err);
        throw err;
      } finally {
        this.loadingPromise = null;
      }
    })();

    return await this.loadingPromise;
  }

  sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Preprocess source into 128x128 Float32 tensor [-1, 1]
   */
  preprocess(sourceElement) {
    if (!this.canvas128 && typeof document !== 'undefined') {
      this.canvas128 = document.createElement('canvas');
      this.canvas128.width = 128;
      this.canvas128.height = 128;
      this.ctx128 = this.canvas128.getContext('2d', { willReadFrequently: true });
    }
    this.ctx128.drawImage(sourceElement, 0, 0, 128, 128);
    const imgData = this.ctx128.getImageData(0, 0, 128, 128);
    const rgba = imgData.data;

    const numPixels = 128 * 128;
    const rOffset = 0;
    const gOffset = numPixels;
    const bOffset = 2 * numPixels;

    // Symmetric [-1, 1]
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
      this.inputData[rOffset + j] = (rgba[i] / 127.5) - 1.0;
      this.inputData[gOffset + j] = (rgba[i + 1] / 127.5) - 1.0;
      this.inputData[bOffset + j] = (rgba[i + 2] / 127.5) - 1.0;
    }

    return new ort.Tensor('float32', this.inputData, [1, 3, 128, 128]);
  }

  /**
   * Runs palm detection on an input source canvas or video
   */
  async detect(sourceElement, minScore = 0.55) {
    if (!this.session) {
      await this.load();
    }

    const tensor = this.preprocess(sourceElement);
    const results = await this.session.run({ input: tensor });

    const scores = results.classificators.data;
    const regressors = results.regressors.data;

    let bestScore = -1;
    let best = null;

    for (let i = 0; i < scores.length; i++) {
      const s = this.sigmoid(scores[i]);
      if (s > minScore && s > bestScore) {
        bestScore = s;
        const a = this.anchors[i];
        const r = i * 18;
        const dx = regressors[r] / 128;
        const dy = regressors[r + 1] / 128;
        const w = regressors[r + 2] / 128;
        const h = regressors[r + 3] / 128;
        best = {
          cx: a.x + dx,
          cy: a.y + dy,
          w: Math.max(0.08, w),
          h: Math.max(0.08, h),
          score: s
        };
      }
    }

    return best;
  }

  /**
   * Computes square Hand ROI (covering palm + extended fingers) in normalized [0, 1] coords
   */
  getHandRoi(palm) {
    if (!palm) return null;
    const size = Math.max(palm.w, palm.h) * 2.3;
    const cy = palm.cy - size * 0.15; // Shift center towards fingers
    const cx = palm.cx;

    const x1 = Math.max(0, cx - size / 2);
    const y1 = Math.max(0, cy - size / 2);
    const x2 = Math.min(1.0, cx + size / 2);
    const y2 = Math.min(1.0, cy + size / 2);

    return {
      x: x1,
      y: y1,
      w: x2 - x1,
      h: y2 - y1,
      size: Math.max(x2 - x1, y2 - y1),
      score: palm.score
    };
  }
}

export const palmDetector = new PalmDetector();
