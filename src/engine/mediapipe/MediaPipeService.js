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

    // Determine screen-left and screen-right hands for clean bilateral coordination
    let leftHandObj = null;
    let rightHandObj = null;
    if (hands.length >= 2) {
      const h0X = (hands[0].landmarks[0].x + hands[0].landmarks[9].x) * 0.5;
      const h1X = (hands[1].landmarks[0].x + hands[1].landmarks[9].x) * 0.5;
      leftHandObj = h0X <= h1X ? hands[0] : hands[1];
      rightHandObj = h0X <= h1X ? hands[1] : hands[0];
    } else if (hands.length === 1) {
      const h0X = (hands[0].landmarks[0].x + hands[0].landmarks[9].x) * 0.5;
      if (h0X < 0.5) leftHandObj = hands[0];
      else rightHandObj = hands[0];
    }

    const formatHandAnchor = (h) => {
      if (!h || !h.landmarks) return null;
      return {
        wrist: { x: h.analysis.wristPos.x, y: h.analysis.wristPos.y },
        index: { x: h.analysis.indexPos.x, y: h.analysis.indexPos.y },
        thumb: { x: h.analysis.thumbPos.x, y: h.analysis.thumbPos.y },
        palm: {
          x: (h.landmarks[0].x + h.landmarks[5].x + h.landmarks[17].x) / 3,
          y: (h.landmarks[0].y + h.landmarks[5].y + h.landmarks[17].y) / 3
        },
        fingertips: [
          { x: h.landmarks[4].x, y: h.landmarks[4].y, name: 'Thumb', tipIdx: 4, code: 'THB' },
          { x: h.landmarks[8].x, y: h.landmarks[8].y, name: 'Index', tipIdx: 8, code: 'IDX' },
          { x: h.landmarks[12].x, y: h.landmarks[12].y, name: 'Middle', tipIdx: 12, code: 'MID' },
          { x: h.landmarks[16].x, y: h.landmarks[16].y, name: 'Ring', tipIdx: 16, code: 'RNG' },
          { x: h.landmarks[20].x, y: h.landmarks[20].y, name: 'Pinky', tipIdx: 20, code: 'PNK' }
        ],
        gesture: h.analysis.gesture.id,
        gestureName: h.analysis.gesture.name,
        landmarks: h.landmarks
      };
    };

    const leftFormatted = formatHandAnchor(leftHandObj);
    const rightFormatted = formatHandAnchor(rightHandObj);

    // Compute fingertip-to-fingertip distances across left & right hands
    const fingerDistances = {
      thumbDist: 0.0,
      indexDist: 0.0,
      middleDist: 0.0,
      ringDist: 0.0,
      pinkyDist: 0.0
    };

    if (leftFormatted && rightFormatted) {
      fingerDistances.thumbDist = Math.hypot(leftFormatted.fingertips[0].x - rightFormatted.fingertips[0].x, leftFormatted.fingertips[0].y - rightFormatted.fingertips[0].y);
      fingerDistances.indexDist = Math.hypot(leftFormatted.fingertips[1].x - rightFormatted.fingertips[1].x, leftFormatted.fingertips[1].y - rightFormatted.fingertips[1].y);
      fingerDistances.middleDist = Math.hypot(leftFormatted.fingertips[2].x - rightFormatted.fingertips[2].x, leftFormatted.fingertips[2].y - rightFormatted.fingertips[2].y);
      fingerDistances.ringDist = Math.hypot(leftFormatted.fingertips[3].x - rightFormatted.fingertips[3].x, leftFormatted.fingertips[3].y - rightFormatted.fingertips[3].y);
      fingerDistances.pinkyDist = Math.hypot(leftFormatted.fingertips[4].x - rightFormatted.fingertips[4].x, leftFormatted.fingertips[4].y - rightFormatted.fingertips[4].y);
    }

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
      ) : 0.0,

      // 5-Finger Tip-to-Tip Spatial Link Channels
      allFingertipsConnected: (leftFormatted && rightFormatted) ? 1.0 : 0.0,
      ...fingerDistances,

      // Spatial Hand Anchors
      h1: leftFormatted || formatHandAnchor(primaryHand),
      h2: rightFormatted || formatHandAnchor(secondHand),
      leftHand: leftFormatted,
      rightHand: rightFormatted,
      hands
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
        this.renderMultiHandOverlay(ctx, hands, sw, sh, params);
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
      // No overlay on empty result — camera shows clean
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
   * Render Multi-Hand Overlays — skeleton, joints, reticles, and connecting lines.
   * All visual layers are opt-in via `params` flags from the mediaPipeHand node settings.
   */
  renderMultiHandOverlay(ctx, hands, width, height, params = {}) {
    if (!hands || hands.length < 2) return;

    const showSkeleton = params.showSkeleton === true;
    const showJoints   = params.showJoints   === true;
    const showReticles = params.showReticles  === true;
    const showGestureFX = params.showGestureFX === true;

    // Sort so leftHand is screen-left (smaller X) and rightHand is screen-right
    const h0X = (hands[0].landmarks[0].x + hands[0].landmarks[9].x) * 0.5;
    const h1X = (hands[1].landmarks[0].x + hands[1].landmarks[9].x) * 0.5;
    const leftHand  = h0X <= h1X ? hands[0] : hands[1];
    const rightHand = h0X <= h1X ? hands[1] : hands[0];

    const FINGER_SPECS = [
      { tipIdx: 4,  name: 'Thumb',  code: 'THB', fingerKey: 'thumb'  },
      { tipIdx: 8,  name: 'Index',  code: 'IDX', fingerKey: 'index'  },
      { tipIdx: 12, name: 'Middle', code: 'MID', fingerKey: 'middle' },
      { tipIdx: 16, name: 'Ring',   code: 'RNG', fingerKey: 'ring'   },
      { tipIdx: 20, name: 'Pinky',  code: 'PNK', fingerKey: 'pinky'  }
    ];

    const leftTips  = FINGER_SPECS.map(f => ({ x: leftHand.landmarks[f.tipIdx].x  * width, y: leftHand.landmarks[f.tipIdx].y  * height, ...f }));
    const rightTips = FINGER_SPECS.map(f => ({ x: rightHand.landmarks[f.tipIdx].x * width, y: rightHand.landmarks[f.tipIdx].y * height, ...f }));

    ctx.save();

    // === OPTIONAL: Per-hand skeleton bones ===
    if (showSkeleton) {
      [leftHand, rightHand].forEach(hand => {
        ctx.lineWidth = 2;
        HAND_CONNECTIONS.forEach(([a, b]) => {
          const p1 = hand.landmarks[a];
          const p2 = hand.landmarks[b];
          const grad = ctx.createLinearGradient(p1.x * width, p1.y * height, p2.x * width, p2.y * height);
          grad.addColorStop(0, hand.analysis.gesture.color || '#38bdf8');
          grad.addColorStop(1, '#06b6d4');
          ctx.strokeStyle = grad;
          ctx.shadowColor = hand.analysis.gesture.color || '#38bdf8';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(p1.x * width, p1.y * height);
          ctx.lineTo(p2.x * width, p2.y * height);
          ctx.stroke();
        });
        ctx.shadowBlur = 0;
      });
    }

    // === OPTIONAL: Joint dots ===
    if (showJoints) {
      [leftHand, rightHand].forEach(hand => {
        hand.landmarks.forEach((p, idx) => {
          const isTip = [4, 8, 12, 16, 20].includes(idx);
          ctx.fillStyle = isTip ? '#ffffff' : (hand.analysis.gesture.color || '#38bdf8');
          ctx.shadowColor = hand.analysis.gesture.color || '#38bdf8';
          ctx.shadowBlur = isTip ? 12 : 4;
          ctx.beginPath();
          ctx.arc(p.x * width, p.y * height, isTip ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.shadowBlur = 0;
      });
    }

    // === OPTIONAL: Gesture FX (per-hand) ===
    if (showGestureFX) {
      for (const hand of [leftHand, rightHand]) {
        handGestureDetector.renderSkeleton(ctx, hand.analysis, width, height);
      }
    }

    // NOTE: All polygon membranes and finger-to-finger lines are drawn by handActionFX
    // (TexturePipeline), which respects the activeFingers selection. Nothing is drawn here.

    // === OPTIONAL: Fingertip reticle circles + label badges ===
    if (showReticles) {
      const LABEL_SIDE = ['L', 'R'];
      [leftTips, rightTips].forEach((tips, side) => {
        tips.forEach(tp => {
          // Reticle ring
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 8, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Label badge
          const label = `${LABEL_SIDE[side]}-${tp.code}`;
          ctx.fillStyle = 'rgba(8,8,10,0.75)';
          const textW = label.length * 5.5 + 6;
          ctx.fillRect(tp.x + 10, tp.y - 9, textW, 14);
          ctx.fillStyle = '#c6ff00';
          ctx.font = 'bold 8px "JetBrains Mono", monospace';
          ctx.fillText(label, tp.x + 13, tp.y + 2);
        });
      });
    }

    ctx.restore();
  }
}

export const mediaPipeService = new MediaPipeService();
