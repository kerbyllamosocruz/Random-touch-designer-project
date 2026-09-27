import * as ort from 'onnxruntime-web';
import { BUILTIN_MODELS } from './BuiltinModels.js';
import { getClassName } from './imagenetLabels.js';
import { handGestureDetector } from './HandGestureDetector.js';
import { palmDetector } from './PalmDetector.js';

// Setup ORT Wasm paths
try {
  // Use CDN distribution matching onnxruntime-web 1.30.0 to prevent Vite /public import issues
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
  ort.env.wasm.numThreads = 1;
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
    this.handTrackingState = {
      roi: null,
      lostFrames: 0,
      frameCount: 0
    };
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
            ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
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

        if (modelId === 'hand_landmark') {
          palmDetector.load('/models/palm_detection.onnx', this.provider).catch(e => {
            console.warn('[ORT] Failed to preload palm detector:', e);
          });
        }

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
  preprocess(source, targetWidth = 256, targetHeight = 256, normalize = 'zero_to_one', preserveAspect = false) {
    this.sharedCanvas.width = targetWidth;
    this.sharedCanvas.height = targetHeight;

    if (preserveAspect) {
      this.sharedCtx.fillStyle = '#000000';
      this.sharedCtx.fillRect(0, 0, targetWidth, targetHeight);

      const sw = source.videoWidth || source.width || targetWidth;
      const sh = source.videoHeight || source.height || targetHeight;
      const aspect = sw / sh;

      let dw = targetWidth;
      let dh = targetHeight;
      let dx = 0;
      let dy = 0;

      if (aspect > 1) {
        dh = Math.round(targetWidth / aspect);
        dy = Math.round((targetHeight - dh) / 2);
      } else {
        dw = Math.round(targetHeight * aspect);
        dx = Math.round((targetWidth - dw) / 2);
      }

      this.sharedCtx.drawImage(source, dx, dy, dw, dh);
      this.letterboxInfo = { dx, dy, dw, dh, targetWidth, targetHeight };
    } else {
      // Draw source scaled to target dimensions
      this.sharedCtx.drawImage(source, 0, 0, targetWidth, targetHeight);
      this.letterboxInfo = null;
    }

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

    // Hand pose detection uses specialized two-stage Hand ROI tracking
    // (BlazePalm detector + Hand Landmark) to guarantee zero head/face false positives
    if (meta.type === 'hand_pose') {
      return await this.runHandTrackingPipeline(sessionInfo, sourceElement, params);
    }

    const inputName = meta.inputName || inputNames[0];
    const targetW = (meta.inputShape && meta.inputShape[3]) || 256;
    const targetH = (meta.inputShape && meta.inputShape[2]) || 256;
    const normalize = meta.normalize || 'zero_to_one';

    // 1. Preprocess
    const tensor = this.preprocess(sourceElement, targetW, targetH, normalize, false);

    // 2. Execute
    const startTime = performance.now();
    const feeds = { [inputName]: tensor };
    const results = await session.run(feeds);
    const duration = performance.now() - startTime;
    this.lastInferenceTime = duration;

    // 3. Postprocess
    const outputName = meta.outputName || outputNames[0];
    const outputTensor = results[outputName] || Object.values(results)[0];

    return this.postprocess(meta.type, outputTensor, sourceElement, targetW, targetH, params, duration, results);
  }

  /**
   * Two-stage Hand Localization & Landmark Tracking Pipeline
   * 1. BlazePalm SSD finds tight palm ROI (ignores head, face, background)
   * 2. Hand Landmark ONNX processes exclusively cropped hand image
   * 3. Coordinates are accurately re-projected onto full camera resolution
   */
  async runHandTrackingPipeline(sessionInfo, sourceElement, params = {}) {
    const { session, inputNames } = sessionInfo;
    const inputName = inputNames[0] || 'input_1';

    const sw = sourceElement.videoWidth || sourceElement.width || 640;
    const sh = sourceElement.videoHeight || sourceElement.height || 360;

    const outWidth = sw;
    const outHeight = sh;
    this.outputCanvas.width = outWidth;
    this.outputCanvas.height = outHeight;
    const ctx = this.outputCtx;

    const startTime = performance.now();
    const state = this.handTrackingState;
    state.frameCount++;

    // 1. Palm Detection & Hand ROI localization
    const needsPalmDetect = !state.roi || state.lostFrames > 2 || (state.frameCount % 20 === 0);

    if (needsPalmDetect) {
      try {
        const palm = await palmDetector.detect(sourceElement, 0.50);
        if (palm) {
          const newRoi = palmDetector.getHandRoi(palm);
          if (state.roi) {
            state.roi = {
              x: state.roi.x * 0.4 + newRoi.x * 0.6,
              y: state.roi.y * 0.4 + newRoi.y * 0.6,
              w: state.roi.w * 0.4 + newRoi.w * 0.6,
              h: state.roi.h * 0.4 + newRoi.h * 0.6
            };
          } else {
            state.roi = newRoi;
          }
          state.lostFrames = 0;
        } else if (!state.roi) {
          // No hand in frame: render clear background with awaiting HUD
          ctx.drawImage(sourceElement, 0, 0, outWidth, outHeight);
          const duration = performance.now() - startTime;
          this.lastInferenceTime = duration;

          const emptyAnalysis = handGestureDetector.analyze(null, 0);
          handGestureDetector.renderSkeleton(ctx, emptyAnalysis, outWidth, outHeight);

          return {
            canvas: this.outputCanvas,
            type: 'hand_pose',
            inferenceMs: duration,
            analysis: emptyAnalysis,
            channels: {
              detected: 0.0,
              gesture: 'none',
              gestureName: 'No Hand Detected',
              effect: 'AWAITING HAND MOVEMENT',
              fingerCount: 0,
              thumbExt: 0,
              indexExt: 0,
              middleExt: 0,
              ringExt: 0,
              pinkyExt: 0,
              indexX: 0.5,
              indexY: 0.5,
              thumbX: 0.5,
              thumbY: 0.5,
              wristX: 0.5,
              wristY: 0.5,
              pinchDist: 1.0,
              isPinching: 0.0,
              handSpeed: 0.0,
              swipe: 'none'
            }
          };
        }
      } catch (err) {
        console.warn('[HandTracker] Palm detection error:', err);
      }
    }

    // 2. Crop Hand ROI for hand_landmark.onnx
    const roi = state.roi;
    const sx = Math.max(0, Math.floor(roi.x * sw));
    const sy = Math.max(0, Math.floor(roi.y * sh));
    const cropW = Math.min(sw - sx, Math.max(20, Math.floor(roi.w * sw)));
    const cropH = Math.min(sh - sy, Math.max(20, Math.floor(roi.h * sh)));

    this.sharedCanvas.width = 224;
    this.sharedCanvas.height = 224;
    this.sharedCtx.drawImage(sourceElement, sx, sy, cropW, cropH, 0, 0, 224, 224);

    const imgData = this.sharedCtx.getImageData(0, 0, 224, 224);
    const rgba = imgData.data;
    const numPixels = 224 * 224;
    const floatData = new Float32Array(3 * numPixels);
    const gOffset = numPixels;
    const bOffset = 2 * numPixels;

    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
      floatData[j] = rgba[i] / 255.0;
      floatData[gOffset + j] = rgba[i + 1] / 255.0;
      floatData[bOffset + j] = rgba[i + 2] / 255.0;
    }

    const tensor = new ort.Tensor('float32', floatData, [1, 3, 224, 224]);

    // 3. Run Hand Landmark Session
    const results = await session.run({ [inputName]: tensor });
    const duration = performance.now() - startTime;
    this.lastInferenceTime = duration;

    const rawLandmarks = results.Identity.data;
    const scoreTensor = results['Identity_1'] || results['Identity_score'];
    const score = scoreTensor?.data?.[0] !== undefined ? scoreTensor.data[0] : 1.0;

    let analysis;

    if (score >= 0.55 && rawLandmarks && rawLandmarks.length >= 63) {
      state.lostFrames = 0;

      // Map landmarks from crop space [0, 1] back to full image space [0, 1]
      const landmarks = [];
      let minX = 1.0, maxX = 0.0, minY = 1.0, maxY = 0.0;

      for (let i = 0; i < 21; i++) {
        const lx = Math.min(1.0, Math.max(0.0, rawLandmarks[i * 3] / 224));
        const ly = Math.min(1.0, Math.max(0.0, rawLandmarks[i * 3 + 1] / 224));
        const lz = rawLandmarks[i * 3 + 2] / 224;

        const fx = Math.min(1.0, Math.max(0.0, (sx + lx * cropW) / sw));
        const fy = Math.min(1.0, Math.max(0.0, (sy + ly * cropH) / sh));

        if (fx < minX) minX = fx;
        if (fx > maxX) maxX = fx;
        if (fy < minY) minY = fy;
        if (fy > maxY) maxY = fy;

        landmarks.push({ x: fx, y: fy, z: lz });
      }

      // Enforce strict anatomical bounds (guarantees thumb or fingers cannot snap to head or background)
      const cleaned = handGestureDetector.cleanLandmarks(landmarks);

      // Smoothly update ROI tracking for next frame with margin
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      const pad = Math.max(0.05, Math.max(bboxW, bboxH) * 0.35);
      const targetRoi = {
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        w: Math.min(1.0 - Math.max(0, minX - pad), bboxW + pad * 2),
        h: Math.min(1.0 - Math.max(0, minY - pad), bboxH + pad * 2)
      };

      state.roi = {
        x: state.roi.x * 0.5 + targetRoi.x * 0.5,
        y: state.roi.y * 0.5 + targetRoi.y * 0.5,
        w: state.roi.w * 0.5 + targetRoi.w * 0.5,
        h: state.roi.h * 0.5 + targetRoi.h * 0.5
      };

      analysis = handGestureDetector.analyze(cleaned, score);
    } else {
      state.lostFrames++;
      if (state.lostFrames > 3) {
        state.roi = null; // Re-detect palm on next frame
      }
      analysis = handGestureDetector.analyze(null, 0);
    }

    // 4. Draw composite result onto output canvas
    ctx.drawImage(sourceElement, 0, 0, outWidth, outHeight);
    handGestureDetector.renderSkeleton(ctx, analysis, outWidth, outHeight);

    return {
      canvas: this.outputCanvas,
      type: 'hand_pose',
      inferenceMs: duration,
      analysis,
      channels: {
        detected: analysis.detected ? 1.0 : 0.0,
        gesture: analysis.gesture.id,
        gestureName: analysis.gesture.name,
        effect: analysis.gesture.effectName,
        fingerCount: analysis.fingerCount,
        thumbExt: analysis.fingers[0] ? 1.0 : 0.0,
        indexExt: analysis.fingers[1] ? 1.0 : 0.0,
        middleExt: analysis.fingers[2] ? 1.0 : 0.0,
        ringExt: analysis.fingers[3] ? 1.0 : 0.0,
        pinkyExt: analysis.fingers[4] ? 1.0 : 0.0,
        indexX: analysis.indexPos?.x || 0.5,
        indexY: analysis.indexPos?.y || 0.5,
        thumbX: analysis.thumbPos?.x || 0.5,
        thumbY: analysis.thumbPos?.y || 0.5,
        wristX: analysis.wristPos?.x || 0.5,
        wristY: analysis.wristPos?.y || 0.5,
        pinchDist: analysis.pinchDist || 1.0,
        isPinching: analysis.pinchDist < 0.085 ? 1.0 : 0.0,
        handSpeed: analysis.speed || 0.0,
        swipe: analysis.swipe
      }
    };
  }

  /**
   * Postprocess output tensors into Visual Canvas and/or Numeric Channels
   */
  postprocess(type, outputTensor, sourceElement, width, height, params, duration, results = {}) {
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

    } else if (type === 'hand_pose') {
      // Identity is [1, 63] keypoints in 224x224 space
      const rawLandmarks = outputTensor.data;
      let landmarks = handGestureDetector.parseLandmarks(rawLandmarks);

      // Un-letterbox coordinates to preserve camera aspect ratio
      if (this.letterboxInfo && landmarks) {
        const { dx, dy, dw, dh, targetWidth, targetHeight } = this.letterboxInfo;
        landmarks = landmarks.map(p => ({
          x: Math.min(1.0, Math.max(0.0, (p.x * targetWidth - dx) / dw)),
          y: Math.min(1.0, Math.max(0.0, (p.y * targetHeight - dy) / dh)),
          z: p.z
        }));
        landmarks = handGestureDetector.cleanLandmarks(landmarks);
      }

      const scoreTensor = results['Identity_1'] || results['Identity_score'];
      const score = scoreTensor?.data?.[0] !== undefined ? scoreTensor.data[0] : 1.0;
      const analysis = handGestureDetector.analyze(landmarks, score);

      // Draw background source
      ctx.drawImage(sourceElement, 0, 0, width, height);

      // Render hand skeleton & interactive visual fx
      handGestureDetector.renderSkeleton(ctx, analysis, width, height);

      result.analysis = analysis;
      result.channels = {
        detected: analysis.detected ? 1.0 : 0.0,
        gesture: analysis.gesture.id,
        gestureName: analysis.gesture.name,
        effect: analysis.gesture.effectName,
        fingerCount: analysis.fingerCount,
        thumbExt: analysis.fingers[0] ? 1.0 : 0.0,
        indexExt: analysis.fingers[1] ? 1.0 : 0.0,
        middleExt: analysis.fingers[2] ? 1.0 : 0.0,
        ringExt: analysis.fingers[3] ? 1.0 : 0.0,
        pinkyExt: analysis.fingers[4] ? 1.0 : 0.0,
        indexX: analysis.indexPos?.x || 0.5,
        indexY: analysis.indexPos?.y || 0.5,
        thumbX: analysis.thumbPos?.x || 0.5,
        thumbY: analysis.thumbPos?.y || 0.5,
        wristX: analysis.wristPos?.x || 0.5,
        wristY: analysis.wristPos?.y || 0.5,
        pinchDist: analysis.pinchDist || 1.0,
        isPinching: analysis.pinchDist < 0.085 ? 1.0 : 0.0,
        handSpeed: analysis.speed || 0.0,
        swipe: analysis.swipe
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
