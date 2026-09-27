/**
 * Texture Processing Pipeline for TouchDesigner TOPs
 */

export class TexturePipeline {
  constructor() {
    this.buffers = new Map(); // nodeId -> HTMLCanvasElement
    this.contexts = new Map();
    this.feedbackBuffers = new Map(); // nodeId -> HTMLCanvasElement
    this.glslPrograms = new Map(); // nodeId -> { gl, program, textures, ... }
    this.scratchCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    this.scratchCtx = this.scratchCanvas ? this.scratchCanvas.getContext('2d') : null;
    this.glassParticles = [];
    this.initGlassParticles(35);
  }

  initGlassParticles(count = 35) {
    this.glassParticles = [];
    for (let i = 0; i < count; i++) {
      this.glassParticles.push({
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: 1.5 + Math.random() * 2.2,
        color: ['#38bdf8', '#c084fc', '#f43f5e', '#34d399', '#ffffff'][i % 5],
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  getBuffer(nodeId, width = 640, height = 360) {
    let canvas = this.buffers.get(nodeId);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      this.buffers.set(nodeId, canvas);
      this.contexts.set(nodeId, canvas.getContext('2d', { willReadFrequently: true }));
    } else if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { canvas, ctx: this.contexts.get(nodeId) };
  }

  getFeedbackBuffer(nodeId, width = 640, height = 360) {
    let canvas = this.feedbackBuffers.get(nodeId);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      this.feedbackBuffers.set(nodeId, canvas);
    } else if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return canvas;
  }

  /**
   * Level TOP: Brightness, Contrast, Gamma, Invert, Saturation
   */
  processLevel(inCanvas, params, outCanvas, outCtx) {
    const w = inCanvas.width;
    const h = inCanvas.height;
    outCanvas.width = w;
    outCanvas.height = h;

    const brightness = params.brightness !== undefined ? params.brightness : 1.0;
    const contrast = params.contrast !== undefined ? params.contrast : 1.0;
    const gamma = params.gamma !== undefined ? params.gamma : 1.0;
    const invert = params.invert ? 1.0 : 0.0;
    const opacity = params.opacity !== undefined ? params.opacity : 1.0;

    outCtx.save();
    outCtx.globalAlpha = opacity;
    // Fast path using CSS filters
    const bPct = Math.round(brightness * 100);
    const cPct = Math.round(contrast * 100);
    const iPct = invert ? 100 : 0;
    outCtx.filter = `brightness(${bPct}%) contrast(${cPct}%) invert(${iPct}%)`;
    outCtx.drawImage(inCanvas, 0, 0, w, h);
    outCtx.restore();
  }

  /**
   * Feedback TOP: Infinite recursive trails and vortexes
   */
  processFeedback(inCanvas, params, nodeId, outCanvas, outCtx) {
    const w = inCanvas.width;
    const h = inCanvas.height;
    outCanvas.width = w;
    outCanvas.height = h;

    const feedbackBuf = this.getFeedbackBuffer(nodeId, w, h);
    const fCtx = feedbackBuf.getContext('2d');

    const decay = params.decay !== undefined ? params.decay : 0.88;
    const zoom = params.zoom !== undefined ? params.zoom : 1.015;
    const rotate = params.rotate !== undefined ? params.rotate : 0.006; // radians
    const blendMode = params.blendMode || 'source-over'; // 'source-over', 'lighter', 'screen', 'difference'
    const hueShift = params.hueShift || 0;

    // Draw previous feedback frame transformed
    outCtx.save();
    outCtx.fillStyle = '#000000';
    outCtx.fillRect(0, 0, w, h);

    // Apply transformed previous frame
    outCtx.save();
    outCtx.translate(w / 2, h / 2);
    outCtx.scale(zoom, zoom);
    outCtx.rotate(rotate);
    outCtx.translate(-w / 2, -h / 2);
    outCtx.globalAlpha = decay;
    if (hueShift) {
      outCtx.filter = `hue-rotate(${hueShift}deg)`;
    }
    outCtx.drawImage(feedbackBuf, 0, 0, w, h);
    outCtx.restore();

    // Composite incoming frame
    outCtx.save();
    if (blendMode === 'source-over') {
      outCtx.globalCompositeOperation = 'source-over';
      outCtx.globalAlpha = Math.max(0.15, 1.0 - decay * 0.95);
      outCtx.drawImage(inCanvas, 0, 0, w, h);
    } else {
      outCtx.globalCompositeOperation = blendMode;
      outCtx.drawImage(inCanvas, 0, 0, w, h);
    }
    outCtx.restore();

    // Copy result back to feedback buffer for next frame
    fCtx.clearRect(0, 0, w, h);
    fCtx.drawImage(outCanvas, 0, 0, w, h);
  }

  /**
   * Kaleidoscope TOP: Radial mirror symmetry
   */
  processKaleidoscope(inCanvas, params, outCanvas, outCtx) {
    const w = inCanvas.width;
    const h = inCanvas.height;
    outCanvas.width = w;
    outCanvas.height = h;

    const segments = Math.max(2, Math.min(32, params.segments || 8));
    const rotation = (params.rotation || 0) * (Math.PI / 180);
    const zoom = params.zoom || 1.0;
    const angleStep = (Math.PI * 2) / segments;

    outCtx.save();
    outCtx.fillStyle = '#000000';
    outCtx.fillRect(0, 0, w, h);
    outCtx.translate(w / 2, h / 2);
    outCtx.scale(zoom, zoom);

    for (let i = 0; i < segments; i++) {
      outCtx.save();
      outCtx.rotate(i * angleStep + rotation);
      if (i % 2 === 1) {
        outCtx.scale(1, -1);
      }
      outCtx.beginPath();
      outCtx.moveTo(0, 0);
      outCtx.arc(0, 0, Math.max(w, h), -angleStep / 2, angleStep / 2);
      outCtx.closePath();
      outCtx.clip();

      outCtx.drawImage(inCanvas, -w / 2, -h / 2, w, h);
      outCtx.restore();
    }
    outCtx.restore();
  }

  /**
   * Chromatic Aberration TOP: RGB Split
   */
  processChromatic(inCanvas, params, outCanvas, outCtx) {
    const w = inCanvas.width;
    const h = inCanvas.height;

    // Guard against inCanvas === outCanvas self-overwrite
    let src = inCanvas;
    if (inCanvas === outCanvas) {
      if (!this.scratchCanvas && typeof document !== 'undefined') {
        this.scratchCanvas = document.createElement('canvas');
        this.scratchCtx = this.scratchCanvas.getContext('2d');
      }
      if (this.scratchCanvas) {
        this.scratchCanvas.width = w;
        this.scratchCanvas.height = h;
        this.scratchCtx.drawImage(inCanvas, 0, 0);
        src = this.scratchCanvas;
      }
    }

    outCanvas.width = w;
    outCanvas.height = h;

    const offset = params.offset !== undefined ? params.offset : 12;
    const angle = ((params.angle || 0) * Math.PI) / 180;
    const dx = Math.cos(angle) * offset;
    const dy = Math.sin(angle) * offset;

    // Use offscreen buffers to isolate R, G, B
    outCtx.save();
    outCtx.fillStyle = '#000000';
    outCtx.fillRect(0, 0, w, h);

    // Red Channel
    outCtx.globalCompositeOperation = 'screen';
    outCtx.save();
    outCtx.translate(dx, dy);
    outCtx.drawImage(src, 0, 0);
    outCtx.restore();

    // Blue/Green Channel
    outCtx.save();
    outCtx.translate(-dx, -dy);
    outCtx.drawImage(src, 0, 0);
    outCtx.restore();

    // Center base
    outCtx.globalAlpha = 0.6;
    outCtx.drawImage(src, 0, 0);
    outCtx.restore();
  }

  /**
   * Displace TOP: Distorts source image using map texture (depth, mask, noise)
   */
  processDisplace(inCanvas, mapCanvas, params, outCanvas, outCtx) {
    const w = inCanvas.width;
    const h = inCanvas.height;
    outCanvas.width = w;
    outCanvas.height = h;

    if (!mapCanvas) {
      outCtx.drawImage(inCanvas, 0, 0, w, h);
      return;
    }

    const weightX = params.weightX !== undefined ? params.weightX : 25;
    const weightY = params.weightY !== undefined ? params.weightY : 25;

    // Fast image data displacement
    const inData = inCanvas.getContext('2d').getImageData(0, 0, w, h);
    const inPixels = inData.data;

    const mapData = mapCanvas.getContext('2d').getImageData(0, 0, w, h);
    const mapPixels = mapData.data;

    const outData = outCtx.createImageData(w, h);
    const outPixels = outData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        // Read displacement vector from map (e.g. Red and Green channels)
        const dispX = ((mapPixels[idx] / 255.0) - 0.5) * weightX * 2;
        const dispY = ((mapPixels[idx + 1] / 255.0) - 0.5) * weightY * 2;

        let srcX = Math.round(x + dispX);
        let srcY = Math.round(y + dispY);

        if (srcX < 0) srcX = 0;
        if (srcX >= w) srcX = w - 1;
        if (srcY < 0) srcY = 0;
        if (srcY >= h) srcY = h - 1;

        const srcIdx = (srcY * w + srcX) * 4;
        outPixels[idx] = inPixels[srcIdx];
        outPixels[idx + 1] = inPixels[srcIdx + 1];
        outPixels[idx + 2] = inPixels[srcIdx + 2];
        outPixels[idx + 3] = inPixels[srcIdx + 3];
      }
    }

    outCtx.putImageData(outData, 0, 0);
  }

  /**
   * Bloom TOP: High-pass glow
   */
  processBloom(inCanvas, params, outCanvas, outCtx) {
    const w = inCanvas.width;
    const h = inCanvas.height;
    outCanvas.width = w;
    outCanvas.height = h;

    const intensity = params.intensity !== undefined ? params.intensity : 1.5;
    const blur = params.blur !== undefined ? params.blur : 16;

    // Draw base
    outCtx.drawImage(inCanvas, 0, 0, w, h);

    // High-pass threshold glow layer
    outCtx.save();
    outCtx.globalCompositeOperation = 'screen';
    outCtx.filter = `blur(${blur}px) brightness(150%)`;
    outCtx.globalAlpha = Math.min(1.0, intensity * 0.7);
    outCtx.drawImage(inCanvas, 0, 0, w, h);
    outCtx.restore();
  }

  /**
   * Composite TOP: Blend two inputs
   */
  processComposite(in1Canvas, in2Canvas, params, outCanvas, outCtx) {
    const w = in1Canvas.width;
    const h = in1Canvas.height;
    outCanvas.width = w;
    outCanvas.height = h;

    const op = params.operation || 'source-over'; // 'source-over', 'lighter', 'multiply', 'screen', 'difference'
    const opacity2 = params.opacity2 !== undefined ? params.opacity2 : 1.0;

    outCtx.drawImage(in1Canvas, 0, 0, w, h);

    if (in2Canvas) {
      outCtx.save();
      outCtx.globalCompositeOperation = op;
      outCtx.globalAlpha = opacity2;
      outCtx.drawImage(in2Canvas, 0, 0, w, h);
      outCtx.restore();
    }
  }

  /**
   * Transform TOP: Scale, Rotate, Translate
   */
  processTransform(inCanvas, params, outCanvas, outCtx) {
    const w = inCanvas.width;
    const h = inCanvas.height;
    outCanvas.width = w;
    outCanvas.height = h;

    const scale = params.scale !== undefined ? params.scale : 1.0;
    const rotate = ((params.rotate || 0) * Math.PI) / 180;
    const tx = params.tx || 0;
    const ty = params.ty || 0;

    outCtx.save();
    outCtx.fillStyle = '#000000';
    outCtx.fillRect(0, 0, w, h);

    outCtx.translate(w / 2 + tx, h / 2 + ty);
    outCtx.scale(scale, scale);
    outCtx.rotate(rotate);
    outCtx.translate(-w / 2, -h / 2);

    outCtx.drawImage(inCanvas, 0, 0, w, h);
    outCtx.restore();
  }

  /**
   * Procedural Noise TOP
   */
  processNoise(time, params, outCanvas, outCtx) {
    const w = outCanvas.width || 320;
    const h = outCanvas.height || 180;
    outCanvas.width = w;
    outCanvas.height = h;

    const t = time * 0.001 * (params.speed || 1.0);
    const scale = params.scale || 0.03;
    const imgData = outCtx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        // Fast synthesized 2D/3D trigonometric noise
        const n1 = Math.sin(x * scale + t);
        const n2 = Math.cos(y * scale - t * 0.8);
        const n3 = Math.sin((x + y) * scale * 0.7 + t * 1.5);
        const val = Math.floor(((n1 + n2 + n3 + 3) / 6) * 255);

        // Fill 2x2 blocks for speed
        const idx = (y * w + x) * 4;
        data[idx] = val;
        data[idx + 1] = Math.floor(val * 0.8 + 20);
        data[idx + 2] = 255 - val;
        data[idx + 3] = 255;

        const idxRight = idx + 4;
        data[idxRight] = data[idx];
        data[idxRight + 1] = data[idx + 1];
        data[idxRight + 2] = data[idx + 2];
        data[idxRight + 3] = 255;

        const idxDown = idx + w * 4;
        data[idxDown] = data[idx];
        data[idxDown + 1] = data[idx + 1];
        data[idxDown + 2] = data[idx + 2];
        data[idxDown + 3] = 255;

        const idxDiag = idxDown + 4;
        data[idxDiag] = data[idx];
        data[idxDiag + 1] = data[idx + 1];
        data[idxDiag + 2] = data[idx + 2];
        data[idxDiag + 3] = 255;
      }
    }

    outCtx.putImageData(imgData, 0, 0);
  }

  /**
   * Bimanual 5-Finger Linked Glass Portal FX:
   * Connects all 5 fingers across both hands (Thumb-to-Thumb, Index-to-Index, Middle-to-Middle,
   * Ring-to-Ring, Pinky-to-Pinky), creating an elastic holographic glass surface with optical refraction,
   * laser ribbons, floating energy particles, and cybernetic telemetry!
   */
  processHandAction(inCanvas, handData, params, time, nodeId, outCanvas, outCtx) {
    const w = inCanvas.width;
    const h = inCanvas.height;
    outCanvas.width = w;
    outCanvas.height = h;

    const t = time * 0.001;
    const intensity = params.intensity !== undefined ? params.intensity : 1.0;

    // 1. Draw base camera image
    outCtx.drawImage(inCanvas, 0, 0, w, h);

    const isDetected = !!(handData?.detected || handData?.handCount > 0);
    if (!isDetected) {
      return;
    }

    // 2. Extract 5 fingertips for both hands
    const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
    const fingerColors = ['#f59e0b', '#38bdf8', '#a855f7', '#ec4899', '#10b981'];

    let leftFingers = [];
    let rightFingers = [];
    let isDualRealHands = false;

    if (handData?.leftHand?.fingertips?.length >= 5 && handData?.rightHand?.fingertips?.length >= 5) {
      isDualRealHands = true;
      leftFingers = handData.leftHand.fingertips.map((f, i) => ({
        x: f.x * w,
        y: f.y * h,
        name: fingerNames[i],
        color: fingerColors[i]
      }));
      rightFingers = handData.rightHand.fingertips.map((f, i) => ({
        x: f.x * w,
        y: f.y * h,
        name: fingerNames[i],
        color: fingerColors[i]
      }));
    } else if (handData?.h1 && handData?.h2 && handData.h1.fingertips?.length >= 5 && handData.h2.fingertips?.length >= 5) {
      isDualRealHands = true;
      // Sort hands so leftFingers is on screen left (smaller X) and rightFingers on screen right
      const h1AvgX = handData.h1.palm?.x ?? handData.h1.fingertips[1].x;
      const h2AvgX = handData.h2.palm?.x ?? handData.h2.fingertips[1].x;

      const [leftHand, rightHand] = h1AvgX <= h2AvgX
        ? [handData.h1, handData.h2]
        : [handData.h2, handData.h1];

      leftFingers = leftHand.fingertips.map((f, i) => ({
        x: f.x * w,
        y: f.y * h,
        name: fingerNames[i],
        color: fingerColors[i]
      }));

      rightFingers = rightHand.fingertips.map((f, i) => ({
        x: f.x * w,
        y: f.y * h,
        name: fingerNames[i],
        color: fingerColors[i]
      }));
    } else {
      // Only 1 hand (or no hands) detected: Wait for 2nd real hand!
      // Do not create any effect, virtual hand, or filaments until 2nd hand is raised.
      return;
    }

    // Resolve activeFingers early — needed for polygon filtering and line drawing
    const activeFingers = params.activeFingers || { thumb: true, index: true, middle: true, ring: true, pinky: true };
    const showReticles  = params.showReticles === true;

    // === LIVE FIST CHECK (per-frame, from raw landmarks — no async gesture lag) ===
    // Mirrors HandGestureDetector.analyze(): fingerTip farther from wrist than PIP joint = extended
    const lmIsFist = (hand) => {
      const lm = hand?.landmarks;
      if (!lm || lm.length < 21) return false;
      const wrist = lm[0];
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const indexExt  = dist(lm[8],  wrist) > dist(lm[6],  wrist) * 1.15;
      const middleExt = dist(lm[12], wrist) > dist(lm[10], wrist) * 1.15;
      const ringExt   = dist(lm[16], wrist) > dist(lm[14], wrist) * 1.15;
      const pinkyExt  = dist(lm[20], wrist) > dist(lm[18], wrist) * 1.15;
      const thumbExt  = dist(lm[4],  lm[17]) > dist(lm[2], lm[17]) * 1.25;
      return !indexExt && !middleExt && !ringExt && !pinkyExt && !thumbExt;
    };

    // Get the actual hand objects (may be in leftHand/rightHand or h1/h2)
    const leftHandObj  = handData?.leftHand  ?? handData?.h1;
    const rightHandObj = handData?.rightHand ?? handData?.h2;
    if (lmIsFist(leftHandObj) || lmIsFist(rightHandObj)) {
      return; // Clean camera only — no lines, no polygon, no effects
    }

    // 3. Build the Glass Perimeter Polygon using ONLY active fingers
    const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    const activeIndices = FINGER_KEYS
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => activeFingers[k] !== false)
      .map(({ i }) => i);

    const activeLeftFingers  = activeIndices.map(i => leftFingers[i]);
    const activeRightFingers = activeIndices.map(i => rightFingers[i]);

    // Build polygon only when >=2 active fingers (1 finger = just a single line, no polygon)
    const distDirect = activeLeftFingers.length >= 2
      ? Math.hypot(activeLeftFingers.at(-1).x - activeRightFingers.at(-1).x, activeLeftFingers.at(-1).y - activeRightFingers.at(-1).y)
        + Math.hypot(activeLeftFingers[0].x - activeRightFingers[0].x, activeLeftFingers[0].y - activeRightFingers[0].y)
      : 0;
    const distCross = activeLeftFingers.length >= 2
      ? Math.hypot(activeLeftFingers.at(-1).x - activeRightFingers[0].x, activeLeftFingers.at(-1).y - activeRightFingers[0].y)
        + Math.hypot(activeLeftFingers[0].x - activeRightFingers.at(-1).x, activeLeftFingers[0].y - activeRightFingers.at(-1).y)
      : 1;

    const reverseRight = distDirect <= distCross;

    const glassPolygon = [];
    if (activeLeftFingers.length >= 2) {
      for (const f of activeLeftFingers) glassPolygon.push(f);
      if (reverseRight) {
        for (let i = activeRightFingers.length - 1; i >= 0; i--) glassPolygon.push(activeRightFingers[i]);
      } else {
        for (const f of activeRightFingers) glassPolygon.push(f);
      }
    }

    // Calculate Centroid using only active fingers
    let cx = 0, cy = 0;
    const totalActive = activeIndices.length;
    for (const i of activeIndices) {
      cx += leftFingers[i].x + rightFingers[i].x;
      cy += leftFingers[i].y + rightFingers[i].y;
    }
    cx /= (totalActive * 2) || 1;
    cy /= (totalActive * 2) || 1;

    // 4+5: Glass interior + bevel — only when >=2 active fingers form a polygon
    if (glassPolygon.length >= 4) {
      outCtx.save();
      outCtx.beginPath();
      glassPolygon.forEach((pt, idx) => {
        if (idx === 0) outCtx.moveTo(pt.x, pt.y);
        else outCtx.lineTo(pt.x, pt.y);
      });
      outCtx.closePath();

      outCtx.save();
      outCtx.clip();

      const style = params.style || 'glass_prism';

      if (style === 'halftone_dots') {
        this.renderHalftoneScreen(outCtx, inCanvas, glassPolygon, cx, cy, t, w, h, intensity);
      } else if (style === 'thermal_vision') {
        this.renderThermalScreen(outCtx, inCanvas, cx, cy, t, w, h, intensity);
      } else if (style === 'cyber_grid') {
        this.renderCyberGridScreen(outCtx, inCanvas, cx, cy, t, w, h, intensity);
      } else if (style === 'glitch_rgb') {
        this.renderGlitchRGB(outCtx, inCanvas, cx, cy, t, w, h, intensity);
      } else if (style === 'void_rift') {
        this.renderVoidRift(outCtx, cx, cy, t, w, h, intensity);
      } else if (style === 'neon_noir') {
        this.renderNeonNoir(outCtx, inCanvas, cx, cy, t, w, h, intensity);
      } else if (style === 'pixelate') {
        this.renderPixelate(outCtx, inCanvas, cx, cy, t, w, h, intensity);
      } else if (style === 'liquid_chrome') {
        this.renderLiquidChrome(outCtx, inCanvas, cx, cy, t, w, h, intensity);
      } else {
        // Glass Prism default
        outCtx.save();
        outCtx.translate(cx, cy);
        outCtx.scale(1.12, 1.12);
        outCtx.translate(-cx, -cy);
        outCtx.drawImage(inCanvas, 0, 0, w, h);
        outCtx.restore();

        outCtx.save();
        outCtx.globalCompositeOperation = 'screen';
        outCtx.globalAlpha = 0.35 * intensity;
        outCtx.drawImage(inCanvas, 6, 0, w, h);
        outCtx.drawImage(inCanvas, -6, 0, w, h);
        outCtx.restore();

        const glassTint = outCtx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(w, h) * 0.6);
        glassTint.addColorStop(0, 'rgba(15, 23, 42, 0.40)');
        glassTint.addColorStop(0.7, 'rgba(30, 41, 59, 0.32)');
        glassTint.addColorStop(1, 'rgba(15, 23, 42, 0.52)');
        outCtx.fillStyle = glassTint;
        outCtx.fill();

        const sheenProgress = ((t * 130) % (w * 1.8)) - w * 0.4;
        const sheenGrad = outCtx.createLinearGradient(sheenProgress - 60, 0, sheenProgress + 60, h);
        sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.22)');
        sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        outCtx.fillStyle = sheenGrad;
        outCtx.fill();

        this.renderTrappedParticles(outCtx, glassPolygon, cx, cy, t);
        this.renderCentralPrismCore(outCtx, cx, cy, t, leftFingers, rightFingers, isDualRealHands);
      }

      // End clip
      outCtx.restore();

      // Bevel frame
      this.renderBeveledFingerFrame(outCtx, glassPolygon, t);
      outCtx.restore();
    } else {
      // Single finger mode: just draw clean base, no polygon
      outCtx.restore();
    }

    // 6. Connect active fingertips with straight white laser lines
    this.renderFingerLinks(outCtx, leftFingers, rightFingers, t, intensity, activeFingers);

    // 7. Fingertip reticles (optional)
    if (showReticles) {
      this.renderFingertipAnchors(outCtx, leftFingers, rightFingers, isDualRealHands, t, activeFingers);
    }
  }

  /**
   * Renders individual straight white laser links between each active finger pair
   */
  renderFingerLinks(ctx, leftFingers, rightFingers, t, intensity, activeFingers = {}) {
    const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    ctx.save();

    for (let i = 0; i < 5; i++) {
      const key = FINGER_KEYS[i];
      if (activeFingers[key] === false) continue;

      const p1 = leftFingers[i];
      const p2 = rightFingers[i];

      // Clean simple straight white connecting line
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);

      // Subtle luminous white glow
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
      ctx.shadowBlur = 6 * intensity;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Sharp straight white core line
      ctx.strokeStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Floating Prismatic Particles trapped within the finger-bounded polygon
   */
  renderTrappedParticles(ctx, polygon, cx, cy, t) {
    if (!this.glassParticles || this.glassParticles.length === 0) {
      this.initGlassParticles(35);
    }

    ctx.save();
    for (let i = 0; i < this.glassParticles.length; i++) {
      const p = this.glassParticles[i];

      // Update positions relative to centroid
      p.x += p.vx * 1.6;
      p.y += p.vy * 1.6;

      const px = cx + p.x;
      const py = cy + p.y;

      const glow = Math.sin(t * 4 + p.phase) * 0.4 + 0.6;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = glow;

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Constellation threads between nearby particles
      for (let j = i + 1; j < this.glassParticles.length; j++) {
        const p2 = this.glassParticles[j];
        const pDist = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (pDist < 42) {
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = (1 - pDist / 42) * 0.25;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(cx + p2.x, cy + p2.y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  /**
   * Central floating holographic prism core & telemetry etched into the glass
   */
  renderCentralPrismCore(ctx, cx, cy, t, leftFingers, rightFingers, isDual) {
    ctx.save();
    ctx.translate(cx, cy);

    const pulse = Math.sin(t * 3) * 0.15 + 1.0;

    // Orbiting 3D Ring 1
    ctx.save();
    ctx.rotate(t * 1.2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 0, 36 * pulse, 15 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Orbiting 3D Ring 2
    ctx.save();
    ctx.rotate(-t * 1.5);
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30 * pulse, 13 * pulse, Math.PI / 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Central Floating Crystal Diamond
    ctx.save();
    ctx.rotate(t * 0.7);
    const dSize = 13 * pulse;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, -dSize);
    ctx.lineTo(dSize * 0.7, 0);
    ctx.lineTo(0, dSize);
    ctx.lineTo(-dSize * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Crystal Beveled Glass Edge around the entire 5-finger perimeter
   */
  renderBeveledFingerFrame(ctx, polygon, t) {
    ctx.save();

    // 1. Outer luminous multi-stop border
    ctx.beginPath();
    polygon.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // 2. Specular bright inner bevel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Fingertip reticle anchors — only drawn when showReticles is enabled in settings
   */
  renderFingertipAnchors(ctx, leftFingers, rightFingers, isDual, t, activeFingers = {}) {
    if (!isDual) return;
    const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const key = FINGER_KEYS[i];
      if (activeFingers[key] === false) continue;
      const pulse = Math.sin(t * 4 + i * 1.2) * 0.3 + 1.0;
      for (const tip of [leftFingers[i], rightFingers[i]]) {
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 5 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
  }

  renderGlassAwaitingHUD() {
    // Intentionally clean: no placeholder boxes or text covering camera feed
  }

  /**
   * Halftone Pop-Art Dot Matrix Screen (Rendered like reference image 2)
   */
  renderHalftoneScreen(ctx, inCanvas, polygon, cx, cy, t, w, h, intensity) {
    ctx.save();
    // Crisp frosted white screen backdrop
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    if (!this.halftoneCanvas) {
      this.halftoneCanvas = document.createElement('canvas');
      this.halftoneCtx = this.halftoneCanvas.getContext('2d', { willReadFrequently: true });
    }
    const sampleW = 80;
    const sampleH = 60;
    if (this.halftoneCanvas.width !== sampleW || this.halftoneCanvas.height !== sampleH) {
      this.halftoneCanvas.width = sampleW;
      this.halftoneCanvas.height = sampleH;
    }
    this.halftoneCtx.drawImage(inCanvas, 0, 0, sampleW, sampleH);

    let imgData;
    try {
      imgData = this.halftoneCtx.getImageData(0, 0, sampleW, sampleH).data;
    } catch {
      ctx.restore();
      return;
    }

    let minX = w, maxX = 0, minY = h, maxY = 0;
    polygon.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const step = 8;
    ctx.fillStyle = '#ec4899'; // Vibrant magenta/pink from reference photo

    for (let y = Math.floor(minY / step) * step; y <= maxY; y += step) {
      const sy = Math.floor((y / h) * sampleH);
      if (sy < 0 || sy >= sampleH) continue;

      for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
        const sx = Math.floor((x / w) * sampleW);
        if (sx < 0 || sx >= sampleW) continue;

        const idx = (sy * sampleW + sx) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        // Inverted: darker facial features produce larger dots
        const dotRadius = Math.max(0, (1.0 - lum) * (step * 0.55) * intensity);

        if (dotRadius > 0.8) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  /**
   * Infrared Thermal Vision Heat Map (Rendered like reference image 1)
   */
  renderThermalScreen(ctx, inCanvas, cx, cy, t, w, h, intensity) {
    ctx.save();
    ctx.fillStyle = '#061138';
    ctx.fill();

    ctx.save();
    ctx.filter = `contrast(${160 * intensity}%) saturate(${220 * intensity}%) hue-rotate(185deg)`;
    ctx.drawImage(inCanvas, 0, 0, w, h);
    ctx.restore();

    // Heat gradient overlay
    const heatGrad = ctx.createLinearGradient(0, 0, 0, h);
    heatGrad.addColorStop(0, 'rgba(0, 30, 200, 0.45)');
    heatGrad.addColorStop(0.5, 'rgba(235, 45, 20, 0.35)');
    heatGrad.addColorStop(1, 'rgba(245, 210, 15, 0.4)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = heatGrad;
    ctx.fill();
    ctx.restore();
  }

  /**
   * Cyberpunk Holographic Digital Grid
   */
  renderCyberGridScreen(ctx, inCanvas, cx, cy, t, w, h, intensity) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 29, 0.88)';
    ctx.fill();

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(inCanvas, 0, 0, w, h);
    ctx.restore();

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.lineWidth = 1;
    const gridStep = 24;
    for (let x = 0; x < w; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const scanY = (t * 160) % h;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(w, scanY);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * VHS Glitch RGB — Channel-split color corruption with scanline noise bars
   */
  renderGlitchRGB(ctx, inCanvas, cx, cy, t, w, h, intensity) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fill();

    const glitchSeed = Math.floor(t * 12);
    const splitAmt = Math.round(18 * intensity);

    // Red channel offset left
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.85;
    ctx.filter = 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'r\'><feColorMatrix type=\'matrix\' values=\'1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0\'/></filter></svg>#r")';
    ctx.drawImage(inCanvas, -splitAmt, 0, w, h);
    ctx.restore();

    // Green channel center
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.85;
    ctx.filter = 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'g\'><feColorMatrix type=\'matrix\' values=\'0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0\'/></filter></svg>#g")';
    ctx.drawImage(inCanvas, 0, 0, w, h);
    ctx.restore();

    // Blue channel offset right
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.85;
    ctx.filter = 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'b\'><feColorMatrix type=\'matrix\' values=\'0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0\'/></filter></svg>#b")';
    ctx.drawImage(inCanvas, splitAmt, 0, w, h);
    ctx.restore();

    // Scanline noise bars
    const numBars = Math.floor(3 + Math.sin(t * 7.3) * 2.5);
    for (let b = 0; b < numBars; b++) {
      const barY = ((glitchSeed * 137 + b * 73) % h);
      const barH = 2 + (b * 5) % 12;
      const barX = ((glitchSeed * 53 + b * 31) % (w * 0.4)) - w * 0.1;
      ctx.save();
      ctx.globalAlpha = 0.25 * intensity;
      ctx.fillStyle = b % 2 === 0 ? '#ffffff' : 'rgba(198,255,0,0.9)';
      ctx.fillRect(0, barY, w, barH);
      ctx.drawImage(inCanvas, barX, barY, w, barH, 0, barY, w, barH);
      ctx.restore();
    }

    // Dark vignette
    const vig = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vig;
    ctx.fill();
    ctx.restore();
  }

  /**
   * Void Rift — Pure black interior with electric arc lightning
   */
  renderVoidRift(ctx, cx, cy, t, w, h, intensity) {
    ctx.save();
    // Deep void
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Pulsing radial core glow
    const corePulse = (Math.sin(t * 5) * 0.5 + 0.5) * intensity;
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80 + corePulse * 40);
    coreGrad.addColorStop(0, `rgba(198,255,0,${0.25 * corePulse})`);
    coreGrad.addColorStop(0.5, `rgba(100,200,255,${0.08 * corePulse})`);
    coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Electric arc strokes — 8 jagged bolts emanating from center
    const arcCount = 8;
    for (let a = 0; a < arcCount; a++) {
      const baseAngle = (a / arcCount) * Math.PI * 2 + t * 1.3;
      const len = 60 + Math.sin(t * 4.7 + a * 1.1) * 40;
      const segments = 6;
      ctx.save();
      ctx.strokeStyle = a % 3 === 0 ? `rgba(198,255,0,${0.6 * intensity})` : `rgba(100,180,255,${0.5 * intensity})`;
      ctx.shadowColor = a % 3 === 0 ? '#c6ff00' : '#64b4ff';
      ctx.shadowBlur = 14 * intensity;
      ctx.lineWidth = 1 + (a % 2) * 0.8;
      ctx.beginPath();
      let px = cx, py = cy;
      for (let s = 0; s < segments; s++) {
        const jitter = (Math.sin(t * 11.3 + a * 7.1 + s * 3.7) * 0.3 + 0.7);
        const ang = baseAngle + Math.sin(t * 3.1 + s * 1.9) * 0.5;
        const segLen = (len / segments) * jitter;
        const nx = px + Math.cos(ang) * segLen;
        const ny = py + Math.sin(ang) * segLen;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(nx, ny);
        px = nx; py = ny;
      }
      ctx.stroke();
      ctx.restore();
    }

    // Orbiting ring
    ctx.save();
    ctx.rotate && (ctx.translate(cx, cy), ctx.rotate(t * 0.8), ctx.translate(-cx, -cy));
    ctx.beginPath();
    ctx.ellipse(cx, cy, 55 + Math.sin(t * 2.1) * 8, 22, t * 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(198,255,0,${0.4 * intensity})`;
    ctx.shadowColor = '#c6ff00';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  /**
   * Neon Noir — Black background with edge-detected neon wireframe traces
   */
  renderNeonNoir(ctx, inCanvas, cx, cy, t, w, h, intensity) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Edge-detected glow version of camera feed
    ctx.save();
    ctx.filter = `brightness(${220 * intensity}%) contrast(600%) saturate(0%) invert(100%)`;
    ctx.globalAlpha = 0.15;
    ctx.drawImage(inCanvas, 0, 0, w, h);
    ctx.restore();

    // Colored neon scan overlay
    const NEON_COLORS = ['#ff0080', '#00ffcc', '#c6ff00', '#ff6600', '#8800ff'];
    const neonIdx = Math.floor(t * 0.4) % NEON_COLORS.length;
    const neon = NEON_COLORS[neonIdx];

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.7 * intensity;
    ctx.filter = `brightness(180%) contrast(500%) hue-rotate(${(t * 60) % 360}deg) saturate(800%)`;
    ctx.drawImage(inCanvas, 0, 0, w, h);
    ctx.restore();

    // Moving neon scan line
    const scanY = (t * 90) % h;
    ctx.save();
    ctx.globalAlpha = 0.55 * intensity;
    ctx.strokeStyle = neon;
    ctx.shadowColor = neon;
    ctx.shadowBlur = 20;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(w, scanY);
    ctx.stroke();
    ctx.restore();

    // Corner cross-hairs
    ctx.save();
    ctx.strokeStyle = `rgba(198,255,0,${0.3 * intensity})`;
    ctx.lineWidth = 1;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = `rgba(198,255,0,${0.5 * intensity})`;
    const timeStr = `T:${(t % 100).toFixed(2)}`;
    ctx.fillText(timeStr, cx - 18, cy - 8);
    ctx.restore();

    ctx.restore();
  }

  /**
   * Pixelate — 8-bit mosaic of the camera feed inside the portal
   */
  renderPixelate(ctx, inCanvas, cx, cy, t, w, h, intensity) {
    if (!this.pixCanvas) {
      this.pixCanvas = document.createElement('canvas');
      this.pixCtx = this.pixCanvas.getContext('2d', { willReadFrequently: true });
    }
    // Dynamic pixel size — pulses between 8 and 20
    const pxSize = Math.round(10 + Math.sin(t * 1.5) * 6 * intensity);
    const pw = Math.max(2, Math.round(w / pxSize));
    const ph = Math.max(2, Math.round(h / pxSize));

    this.pixCanvas.width = pw;
    this.pixCanvas.height = ph;
    this.pixCtx.drawImage(inCanvas, 0, 0, pw, ph);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.pixCanvas, 0, 0, pw, ph, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();

    // Pixel grid overlay
    ctx.save();
    ctx.strokeStyle = `rgba(0,0,0,${0.18 * intensity})`;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += pxSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += pxSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();

    // Scanline tint
    ctx.save();
    ctx.globalAlpha = 0.12 * intensity;
    ctx.fillStyle = '#c6ff00';
    for (let y = 0; y < h; y += pxSize * 2) {
      ctx.fillRect(0, y, w, pxSize);
    }
    ctx.restore();
  }

  /**
   * Liquid Chrome — Iridescent metallic sheen with shifting interference bands
   */
  renderLiquidChrome(ctx, inCanvas, cx, cy, t, w, h, intensity) {
    ctx.save();

    // Base chrome dark — darken the feed heavily
    ctx.save();
    ctx.filter = `brightness(40%) contrast(120%) saturate(0%)`;
    ctx.drawImage(inCanvas, 0, 0, w, h);
    ctx.restore();

    // Interference band sweep
    const bandCount = 8;
    for (let b = 0; b < bandCount; b++) {
      const phase = (t * 1.1 + b * (Math.PI * 2 / bandCount)) % (Math.PI * 2);
      const yPos = cy + Math.sin(phase) * (h * 0.45);
      const bandH = 28 + Math.cos(phase * 1.7) * 14;
      const hue = (b * 42 + t * 25) % 360;
      const grad = ctx.createLinearGradient(0, yPos - bandH, 0, yPos + bandH);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, `hsla(${hue},100%,75%,${0.28 * intensity})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(0, yPos - bandH, w, bandH * 2);
      ctx.restore();
    }

    // Moving specular hotspot
    const specX = cx + Math.sin(t * 0.7) * w * 0.3;
    const specY = cy + Math.cos(t * 0.5) * h * 0.25;
    const spec = ctx.createRadialGradient(specX, specY, 0, specX, specY, 90);
    spec.addColorStop(0, `rgba(255,255,255,${0.55 * intensity})`);
    spec.addColorStop(0.4, `rgba(200,220,255,${0.15 * intensity})`);
    spec.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = spec;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Chrome edge vignette
    const chromeEdge = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.15, cx, cy, Math.max(w, h) * 0.7);
    chromeEdge.addColorStop(0, 'rgba(0,0,0,0)');
    chromeEdge.addColorStop(1, `rgba(10,10,18,${0.7 * intensity})`);
    ctx.fillStyle = chromeEdge;
    ctx.fill();

    ctx.restore();
  }
}

export const texturePipeline = new TexturePipeline();
