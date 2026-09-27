import * as ort from 'onnxruntime-web';
import { BUILTIN_MODELS } from './BuiltinModels.js';
import { getClassName } from './imagenetLabels.js';

// Setup ORT Wasm paths
try {
  // Use local wasm if available, with CDN fallback
  ort.env.wasm.wasmPaths = '/ort-wasm/';
  ort.env.wasm.numThreads = 1; // universally safe without requiring SharedArrayBuffer cross-origin isolation
} catch (e) {
  console.warn('[ORT] Failed to configure wasm paths:', e);
}

class OnnxRuntimeService {
  constructor() {
    this.sessions = new Map(); // modelId -> { session, metadata, info }
    this.loading = new Map();  // modelId -> Promise
    this.sharedCanvas = document.createElement('canvas');
    this.sharedCtx = this.sharedCanvas.getContext('2d', { willReadFrequently: true });
    this.outputCanvas = document.createElement('canvas');
    this.outputCtx = this.outputCanvas.getContext('2d');
    this.provider = 'wasm'; // 'wasm' or 'webgpu'
    this.lastInferenceTime = 0;
  }

  setExecutionProvider(provider) {
    if (this.provider !== provider) {
      this.provider = provider;
      // Clear sessions to reload with new provider
      this.sessions.clear();
    }
  }

  async loadModel(modelId, customBuffer = null, customName = 'Custom Model') {
    if (this.sessions.has(modelId)) {
      return this.sessions.get(modelId);
    }

    if (this.loading.has(modelId)) {
      return await this.loading.get(modelId);
    }

    const loadPromise = (async () => {
      try {
        let session;
        const options = {
          executionProviders: [this.provider],
          graphOptimizationLevel: 'all'
        };

        let modelData;
        let modelMeta = BUILTIN_MODELS[modelId] || {
          id: modelId,
          name: customName,
          type: 'custom',
          color: '#f59e0b'
        };

        if (customBuffer) {
          modelData = customBuffer;
        } else if (modelMeta.url) {
          const res = await fetch(modelMeta.url);
          if (!res.ok) {
            throw new Error(`Failed to fetch model from ${modelMeta.url}: ${res.statusText}`);
          }
          modelData = await res.arrayBuffer();
        } else {
          throw new Error(`No URL or buffer provided for model: ${modelId}`);
        }

        try {
          session = await ort.InferenceSession.create(modelData, options);
        } catch (firstErr) {
          // If webgpu failed, try wasm fallback
          if (this.provider !== 'wasm') {
            console.warn('[ORT] Fallback from', this.provider, 'to wasm:', firstErr);
            session = await ort.InferenceSession.create(modelData, {
              executionProviders: ['wasm'],
              graphOptimizationLevel: 'all'
            });
          } else {
            // Try CDN wasm fallback if local wasm paths failed
            ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';
            session = await ort.InferenceSession.create(modelData, {
              executionProviders: ['wasm']
            });
          }
        }

        const inputNames = session.inputNames;
        const outputNames = session.outputNames;

        const sessionInfo = {
          session,
          meta: modelMeta,
          inputNames,
          outputNames,
          id: modelId,
          ready: true
        };

        this.sessions.set(modelId, sessionInfo);
        console.log(`[ORT] Model '${modelMeta.name}' loaded successfully. Inputs:`, inputNames, 'Outputs:', outputNames);
        return sessionInfo;
      } catch (err) {
        console.error(`[ORT] Error loading model ${modelId}:`, err);
        throw err;
      } finally {
        this.loading.delete(modelId);
      }
    })();

    this.loading.set(modelId, loadPromise);
    return await loadPromise;
  }

  /**
   * Preprocess an HTMLCanvasElement, HTMLVideoElement, or Image into a Float32Array Tensor
   */
  preprocess(source, targetWidth = 256, targetHeight = 256, normalize = 'zero_to_one') {
    this.sharedCanvas.width = targetWidth;
    this.sharedCanvas.height = targetHeight;

    // Draw source scaled to target dimensions
    this.sharedCtx.drawImage(source, 0, 0, targetWidth, targetHeight);
    const imgData = this.sharedCtx.getImageData(0, 0, targetWidth, targetHeight);
    const rgba = imgData.data;

    // Output layout: NCHW [1, 3, H, W]
    const numPixels = targetWidth * targetHeight;
    const floatData = new Float32Array(3 * numPixels);
    const redOffset = 0;
    const greenOffset = numPixels;
    const blueOffset = 2 * numPixels;

    if (normalize === 'imagenet') {
      // Mean: [0.485, 0.456, 0.406], Std: [0.229, 0.224, 0.225]
      const mean = [0.485, 0.456, 0.406];
      const std = [0.229, 0.224, 0.225];

      for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
        floatData[redOffset + j] = ((rgba[i] / 255.0) - mean[0]) / std[0];
        floatData[greenOffset + j] = ((rgba[i + 1] / 255.0) - mean[1]) / std[1];
        floatData[blueOffset + j] = ((rgba[i + 2] / 255.0) - mean[2]) / std[2];
      }
    } else if (normalize === 'symmetric') {
      // [-1, 1]
      for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
        floatData[redOffset + j] = (rgba[i] / 127.5) - 1.0;
        floatData[greenOffset + j] = (rgba[i + 1] / 127.5) - 1.0;
        floatData[blueOffset + j] = (rgba[i + 2] / 127.5) - 1.0;
      }
    } else {
      // zero_to_one [0, 1]
      for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
        floatData[redOffset + j] = rgba[i] / 255.0;
        floatData[greenOffset + j] = rgba[i + 1] / 255.0;
        floatData[blueOffset + j] = rgba[i + 2] / 255.0;
      }
    }

    return new ort.Tensor('float32', floatData, [1, 3, targetHeight, targetWidth]);
  }

  /**
   * Run inference on an input source with chosen model
   */
  async runInference(modelId, sourceElement, params = {}) {
    const sessionInfo = await this.loadModel(modelId);
    if (!sessionInfo || !sessionInfo.session) {
      throw new Error(`Model ${modelId} session not ready`);
    }

    const { session, meta, inputNames, outputNames } = sessionInfo;
    const inputName = meta.inputName || inputNames[0];
    const targetW = (meta.inputShape && meta.inputShape[3]) || 256;
    const targetH = (meta.inputShape && meta.inputShape[2]) || 256;
    const normalize = meta.normalize || 'zero_to_one';

    // 1. Preprocess
    const tensor = this.preprocess(sourceElement, targetW, targetH, normalize);

    // 2. Execute
    const startTime = performance.now();
    const feeds = { [inputName]: tensor };
    const results = await session.run(feeds);
    const duration = performance.now() - startTime;
    this.lastInferenceTime = duration;

    // 3. Postprocess
    const outputName = meta.outputName || outputNames[0];
    const outputTensor = results[outputName] || Object.values(results)[0];

    return this.postprocess(meta.type, outputTensor, sourceElement, targetW, targetH, params, duration);
  }

  /**
   * Postprocess output tensors into Visual Canvas and/or Numeric Channels
   */
  postprocess(type, outputTensor, sourceElement, width, height, params, duration) {
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    const ctx = this.outputCtx;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    let result = {
      canvas: this.outputCanvas,
      type,
      inferenceMs: duration,
      channels: {}, // For CHOPs
      classes: []   // For classification
    };

    if (type === 'segmentation') {
      // Tensor is [1, 1, H, W] float mask in [0, 1]
      const mask = outputTensor.data;
      const threshold = params.threshold !== undefined ? params.threshold : 0.5;
      const invert = params.invert || false;
      const mode = params.mode || 'matte'; // 'matte', 'cutout', 'glow'

      // Pre-sample source element pixels for cutout
      let srcPixels = null;
      if (mode === 'cutout' || mode === 'glow') {
        this.sharedCanvas.width = width;
        this.sharedCanvas.height = height;
        this.sharedCtx.drawImage(sourceElement, 0, 0, width, height);
        srcPixels = this.sharedCtx.getImageData(0, 0, width, height).data;
      }

      let personPixelCount = 0;

      for (let i = 0; i < mask.length; i++) {
        let val = mask[i];
        if (invert) val = 1.0 - val;

        const isPerson = val >= threshold;
        if (isPerson) personPixelCount++;

        const idx = i * 4;
        if (mode === 'cutout' && srcPixels) {
          data[idx] = srcPixels[idx];
          data[idx + 1] = srcPixels[idx + 1];
          data[idx + 2] = srcPixels[idx + 2];
          data[idx + 3] = Math.round(val * 255);
        } else if (mode === 'glow' && srcPixels) {
          if (isPerson) {
            data[idx] = srcPixels[idx];
            data[idx + 1] = srcPixels[idx + 1];
            data[idx + 2] = srcPixels[idx + 2];
            data[idx + 3] = 255;
          } else {
            // Neon cyan background glow
            data[idx] = 6;
            data[idx + 1] = 182;
            data[idx + 2] = 212;
            data[idx + 3] = 255;
          }
        } else {
          // 'matte': grayscale alpha mask
          const byteVal = Math.round(Math.min(1.0, Math.max(0.0, val)) * 255);
          data[idx] = byteVal;
          data[idx + 1] = byteVal;
          data[idx + 2] = byteVal;
          data[idx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // CHOP channels output
      result.channels = {
        coverage: personPixelCount / mask.length, // 0.0 to 1.0 percentage of person in frame
        confidence: mask.reduce((acc, v) => acc + v, 0) / mask.length,
        presence: personPixelCount > (mask.length * 0.05) ? 1.0 : 0.0
      };

    } else if (type === 'edge_filter') {
      // Tensor is [1, 1, H, W] float edge magnitudes
      const edge = outputTensor.data;
      const boost = params.edgeBoost || 2.0;

      for (let i = 0; i < edge.length; i++) {
        const val = Math.min(255, Math.max(0, Math.round(edge[i] * 255 * boost)));
        const idx = i * 4;
        // Neon purple/cyan edge styling
        data[idx] = val;
        data[idx + 1] = Math.round(val * 0.8);
        data[idx + 2] = 255;
        data[idx + 3] = val > 20 ? 255 : 0;
      }

      ctx.putImageData(imgData, 0, 0);

      let totalEnergy = 0;
      for (let i = 0; i < edge.length; i += 8) {
        totalEnergy += edge[i];
      }
      result.channels = {
        edgeEnergy: Math.min(1.0, (totalEnergy / (edge.length / 8)) * boost)
      };

    } else if (type === 'color_filter') {
      // Tensor is [1, 3, H, W]
      const tensorData = outputTensor.data;
      const numPixels = width * height;
      const redOffset = 0;
      const greenOffset = numPixels;
      const blueOffset = 2 * numPixels;

      for (let i = 0; i < numPixels; i++) {
        const idx = i * 4;
        data[idx] = Math.min(255, Math.max(0, Math.round(tensorData[redOffset + i] * 255)));
        data[idx + 1] = Math.min(255, Math.max(0, Math.round(tensorData[greenOffset + i] * 255)));
        data[idx + 2] = Math.min(255, Math.max(0, Math.round(tensorData[blueOffset + i] * 255)));
        data[idx + 3] = 255;
      }

      ctx.putImageData(imgData, 0, 0);

    } else if (type === 'classification') {
      // Tensor is [1, 1000] logits
      const logits = Array.from(outputTensor.data);
      // Softmax
      const maxLogit = Math.max(...logits);
      const exps = logits.map(l => Math.exp(l - maxLogit));
      const sumExps = exps.reduce((a, b) => a + b, 0);
      const probs = exps.map(e => e / sumExps);

      // Top 5 predictions
      const indexed = probs.map((prob, idx) => ({ prob, idx }));
      indexed.sort((a, b) => b.prob - a.prob);
      const top5 = indexed.slice(0, 5).map(item => ({
        index: item.idx,
        label: getClassName(item.idx),
        probability: item.prob
      }));

      result.classes = top5;

      // Draw Top 5 HUD onto canvas
      ctx.fillStyle = '#111216';
      ctx.fillRect(0, 0, width, height);

      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#06b6d4';
      ctx.fillText('ONNX CLASSIFICATION', 12, 22);

      top5.forEach((item, idx) => {
        const y = 46 + idx * 36;
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px "Inter", sans-serif';
        const label = item.label.length > 18 ? item.label.slice(0, 18) + '...' : item.label;
        ctx.fillText(label, 12, y);

        const pct = (item.probability * 100).toFixed(1) + '%';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(pct, width - 48, y);

        // Bar
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(12, y + 6, width - 24, 6);
        ctx.fillStyle = idx === 0 ? '#10b981' : '#3b82f6';
        ctx.fillRect(12, y + 6, Math.max(2, (width - 24) * item.probability), 6);
      });

      result.channels = {
        topProb: top5[0].probability,
        secondProb: top5[1].probability,
        classIndex: top5[0].index,
        entropy: probs.reduce((acc, p) => p > 0.001 ? acc - p * Math.log2(p) : acc, 0)
      };

    } else {
      // Custom / generic model: visualize output shape
      const outData = outputTensor.data;
      if (outData.length >= width * height) {
        for (let i = 0; i < width * height; i++) {
          const val = Math.min(255, Math.max(0, Math.round(outData[i] * 255)));
          const idx = i * 4;
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
          data[idx + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
      } else {
        // Output numeric stats
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText('CUSTOM TENSOR OUTPUT', 10, 24);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`Shape: [${outputTensor.dims.join(', ')}]`, 10, 44);
        ctx.fillText(`Type: ${outputTensor.type}`, 10, 64);
        ctx.fillText(`Length: ${outData.length}`, 10, 84);
      }

      result.channels = {
        val0: outData[0] || 0,
        val1: outData[1] || 0,
        val2: outData[2] || 0
      };
    }

    return result;
  }
}

export const onnxService = new OnnxRuntimeService();
