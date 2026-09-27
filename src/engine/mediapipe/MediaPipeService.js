import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { handGestureDetector, GESTURE_DEFINITIONS, HAND_CONNECTIONS } from '../onnx/HandGestureDetector.js';

class MediaPipeService {
  constructor() {
    this.handLandmarker = null;
    this.initPromise = null;
    this.isReady = false;
    this.currentOptions = {
      maxHands: 2,
      minDetectionConfidence: 0.5,
      minPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      delegate: 'GPU'
    };
    this.lastTimestamp = -1;
    this.outputCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    this.outputCtx = this.outputCanvas ? this.outputCanvas.getContext('2d') : null;
  }

  async init(options = {}) {
    if (this.isReady && this.handLandmarker) {
      if (options.maxHands && options.maxHands !== this.currentOptions.maxHands) {
        try {
          await this.handLandmarker.setOptions({ numHands: options.maxHands });
          this.currentOptions.maxHands = options.maxHands;
        } catch (e) {
          console.warn('[MediaPipe] Could not update options dynamically:', e);
        }
      }
      return this.handLandmarker;
    }

    if (this.initPromise) {
      return await this.initPromise;
    }

    this.currentOptions = { ...this.currentOptions, ...options };

    this.initPromise = (async () => {
      try {
        console.log('[MediaPipe] Initializing Vision FilesetResolver...');
        let vision;
        try {
          // Attempt loading local WASM binaries first (fast, offline)
          vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        } catch (localWasmErr) {
          console.warn('[MediaPipe] Local WASM load failed, falling back to CDN:', localWasmErr);
          vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
          );
        }

        const modelPath = '/models/hand_landmarker.task';
        const fallbackModelPath =
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

        console.log('[MediaPipe] Creating HandLandmarker instance...');
        try {
          this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelPath,
              delegate: this.currentOptions.delegate || 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: this.currentOptions.maxHands || 2,
            minHandDetectionConfidence: this.currentOptions.minDetectionConfidence || 0.5,
            minHandPresenceConfidence: this.currentOptions.minPresenceConfidence || 0.5,
            minTrackingConfidence: this.currentOptions.minTrackingConfidence || 0.5
          });
        } catch (gpuErr) {
          console.warn('[MediaPipe] GPU delegate failed, falling back to CPU or CDN model:', gpuErr);
          this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: fallbackModelPath,
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            numHands: this.currentOptions.maxHands || 2,
            minHandDetectionConfidence: this.currentOptions.minDetectionConfidence || 0.5,
            minHandPresenceConfidence: this.currentOptions.minPresenceConfidence || 0.5,
            minTrackingConfidence: this.currentOptions.minTrackingConfidence || 0.5
          });
        }

        this.isReady = true;
        console.log('[MediaPipe] HandLandmarker ready (GPU/CPU initialized successfully)');
        return this.handLandmarker;
      } catch (err) {
        console.error('[MediaPipe] Initialization fatal error:', err);
        this.isReady = false;
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return await this.initPromise;
  }

  /**
   * Run hand detection on an ImageSource (HTMLCanvasElement, HTMLVideoElement, etc.)
   */
  async detect(sourceElement, params = {}) {
    if (!this.isReady || !this.handLandmarker) {
      await this.init(params);
    }

    const sw = sourceElement.videoWidth || sourceElement.width || 640;
    const sh = sourceElement.videoHeight || sourceElement.height || 360;

    if (this.outputCanvas) {
      this.outputCanvas.width = sw;
      this.outputCanvas.height = sh;
    }

    // MediaPipe detectForVideo requires strictly monotonically increasing timestamps in ms
    let timestamp = performance.now();
    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }
    this.lastTimestamp = timestamp;

    const startTime = performance.now();
    let mpResult;
    try {
      mpResult = this.handLandmarker.detectForVideo(sourceElement, timestamp);
    } catch (err) {
      console.warn('[MediaPipe] detectForVideo warning:', err);
      return this.buildEmptyResult(sourceElement, sw, sh);
    }
    const inferenceMs = performance.now() - startTime;

    const rawLandmarksArray = mpResult.landmarks || [];
    const handednessArray = mpResult.handednesses || mpResult.handedness || [];
    const worldLandmarksArray = mpResult.worldLandmarks || [];

    const hands = [];
    for (let i = 0; i < rawLandmarksArray.length; i++) {
      const landmarks = rawLandmarksArray[i];
      const handednessObj = handednessArray[i]?.[0];
      const handedness = handednessObj?.categoryName || (i === 0 ? 'Right' : 'Left');
      const handednessScore = handednessObj?.score || 1.0;
      const worldLandmarks = worldLandmarksArray[i] || null;

      // Analyze finger movement, pinch, and gestures
      const analysis = handGestureDetector.analyze(landmarks, handednessScore);

      hands.push({
        index: i,
        handedness,
        handednessScore,
        landmarks,
        worldLandmarks,
        analysis
      });
    }

    const primaryHand = hands[0] || null;
    const secondHand = hands[1] || null;

    // Build comprehensive TouchDesigner CHOP channels
    const channels = {
      detected: primaryHand ? 1.0 : 0.0,
      handCount: hands.length,
      handedness: primaryHand ? (primaryHand.handedness === 'Right' ? 1.0 : -1.0) : 0.0,
      handednessName: primaryHand?.handedness || 'None',
      gesture: primaryHand?.analysis?.gesture?.id || 'none',
      gestureName: primaryHand?.analysis?.gesture?.name || 'No Hand Detected',
      effect: primaryHand?.analysis?.gesture?.effectName || 'AWAITING HAND MOVEMENT',
      fingerCount: primaryHand?.analysis?.fingerCount || 0,
      thumbExt: primaryHand?.analysis?.fingers[0] ? 1.0 : 0.0,
      indexExt: primaryHand?.analysis?.fingers[1] ? 1.0 : 0.0,
      middleExt: primaryHand?.analysis?.fingers[2] ? 1.0 : 0.0,
      ringExt: primaryHand?.analysis?.fingers[3] ? 1.0 : 0.0,
      pinkyExt: primaryHand?.analysis?.fingers[4] ? 1.0 : 0.0,
      indexX: primaryHand?.analysis?.indexPos?.x ?? 0.5,
      indexY: primaryHand?.analysis?.indexPos?.y ?? 0.5,
      thumbX: primaryHand?.analysis?.thumbPos?.x ?? 0.5,
      thumbY: primaryHand?.analysis?.thumbPos?.y ?? 0.5,
      wristX: primaryHand?.analysis?.wristPos?.x ?? 0.5,
      wristY: primaryHand?.analysis?.wristPos?.y ?? 0.5,
      pinchDist: primaryHand?.analysis?.pinchDist ?? 1.0,
      isPinching: (primaryHand?.analysis?.pinchDist || 1.0) < 0.085 ? 1.0 : 0.0,
      handSpeed: primaryHand?.analysis?.speed ?? 0.0,
      swipe: primaryHand?.analysis?.swipe || 'none',

      // Multi-Hand Channels
      hand2_detected: secondHand ? 1.0 : 0.0,
      hand2_handedness: secondHand ? (secondHand.handedness === 'Right' ? 1.0 : -1.0) : 0.0,
      hand2_gesture: secondHand?.analysis?.gesture?.id || 'none',
      hand2_fingerCount: secondHand?.analysis?.fingerCount || 0,
      hand2_indexX: secondHand?.analysis?.indexPos?.x ?? 0.5,
      hand2_indexY: secondHand?.analysis?.indexPos?.y ?? 0.5,
      twoHandDist: hands.length >= 2 ? Math.hypot(
        hands[0].analysis.wristPos.x - hands[1].analysis.wristPos.x,
        hands[0].analysis.wristPos.y - hands[1].analysis.wristPos.y
      ) : 0.0
    };

    // Render composited visual output with cyberpunk skeleton & FX
    const overlayMode = params.overlayMode || 'composite'; // 'composite', 'skeleton_only', 'clean'
    const ctx = this.outputCtx;
    if (ctx) {
      if (overlayMode === 'composite') {
        ctx.drawImage(sourceElement, 0, 0, sw, sh);
      } else if (overlayMode === 'skeleton_only') {
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, sw, sh);
      } else {
        ctx.drawImage(sourceElement, 0, 0, sw, sh);
      }

      if (overlayMode !== 'clean') {
        this.renderMultiHandOverlay(ctx, hands, sw, sh);
      }
    }

    return {
      canvas: this.outputCanvas,
      type: 'hand_pose',
      inferenceMs,
      hands,
      primaryHand,
      analysis: primaryHand?.analysis || handGestureDetector.analyze(null, 0),
      channels
    };
  }

  buildEmptyResult(sourceElement, sw, sh) {
    if (this.outputCtx) {
      this.outputCtx.drawImage(sourceElement, 0, 0, sw, sh);
      const emptyAnalysis = handGestureDetector.analyze(null, 0);
      handGestureDetector.renderSkeleton(this.outputCtx, emptyAnalysis, sw, sh);
    }

    return {
      canvas: this.outputCanvas,
      type: 'hand_pose',
      inferenceMs: 0,
      hands: [],
      primaryHand: null,
      analysis: handGestureDetector.analyze(null, 0),
      channels: {
        detected: 0.0,
        handCount: 0,
        handedness: 0.0,
        handednessName: 'None',
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
        swipe: 'none',
        hand2_detected: 0.0,
        twoHandDist: 0.0
      }
    };
  }

  /**
   * Render Multi-Hand Skeletons, Banners, and Interactive FX
   */
  renderMultiHandOverlay(ctx, hands, width, height) {
    if (!hands || hands.length === 0) {
      const emptyAnalysis = handGestureDetector.analyze(null, 0);
      handGestureDetector.renderSkeleton(ctx, emptyAnalysis, width, height);
      return;
    }

    hands.forEach((hand, idx) => {
      const { landmarks, analysis, handedness } = hand;
      const isDominant = idx === 0;

      // Color scheme: Cyan for Dominant/Right, Fuchsia/Magenta for Left/Secondary
      const handColor = isDominant ? (analysis.gesture.color || '#38bdf8') : '#ec4899';

      ctx.save();

      // Holographic HUD Badge per hand
      const badgeY = 12 + idx * 42;
      ctx.fillStyle = 'rgba(10, 14, 23, 0.85)';
      ctx.fillRect(10, badgeY, Math.min(width - 20, 310), 36);
      ctx.strokeStyle = handColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(10, badgeY, Math.min(width - 20, 310), 36);

      ctx.font = '16px sans-serif';
      ctx.fillText(analysis.gesture.icon, 20, badgeY + 24);

      ctx.font = 'bold 11px "Outfit", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${handedness.toUpperCase()} · ${analysis.gesture.name.toUpperCase()}`, 48, badgeY + 16);

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = handColor;
      ctx.fillText(`EFFECT: ${analysis.gesture.effectName}`, 48, badgeY + 29);

      // Bones
      ctx.lineWidth = 3;
      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const p1 = landmarks[startIdx];
        const p2 = landmarks[endIdx];
        if (!p1 || !p2) return;

        const grad = ctx.createLinearGradient(p1.x * width, p1.y * height, p2.x * width, p2.y * height);
        grad.addColorStop(0, handColor);
        grad.addColorStop(1, '#06b6d4');

        ctx.strokeStyle = grad;
        ctx.shadowColor = handColor;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      });

      // Joints
      landmarks.forEach((p, jIdx) => {
        const x = p.x * width;
        const y = p.y * height;
        const isTip = [4, 8, 12, 16, 20].includes(jIdx);

        ctx.fillStyle = isTip ? '#ffffff' : handColor;
        ctx.shadowColor = handColor;
        ctx.shadowBlur = isTip ? 12 : 5;

        ctx.beginPath();
        ctx.arc(x, y, isTip ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Gesture-specific FX
      if (analysis.gesture.id === 'pointing' && analysis.indexPos) {
        const ix = analysis.indexPos.x * width;
        const iy = analysis.indexPos.y * height;
        ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
        ctx.beginPath();
        ctx.arc(ix, iy, 22, 0, Math.PI * 2);
        ctx.fill();
      } else if (analysis.gesture.id === 'pinch') {
        const t1 = landmarks[4];
        const t2 = landmarks[8];
        if (t1 && t2) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(t1.x * width, t1.y * height);
          ctx.lineTo(t2.x * width, t2.y * height);
          ctx.stroke();
        }
      }

      ctx.restore();
    });

    // If 2 hands are tracked, draw interactive connection arc between wrists
    if (hands.length >= 2) {
      const w1 = hands[0].landmarks[0];
      const w2 = hands[1].landmarks[0];
      if (w1 && w2) {
        ctx.save();
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(w1.x * width, w1.y * height);
        ctx.lineTo(w2.x * width, w2.y * height);
        ctx.stroke();

        const midX = (w1.x + w2.x) * 0.5 * width;
        const midY = (w1.y + w2.y) * 0.5 * height;
        const dist = Math.hypot((w1.x - w2.x) * width, (w1.y - w2.y) * height);

        ctx.fillStyle = '#06b6d4';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`DUAL HAND SPAN: ${Math.round(dist)}px`, midX, midY - 8);
        ctx.restore();
      }
    }
  }
}

export const mediaPipeService = new MediaPipeService();
