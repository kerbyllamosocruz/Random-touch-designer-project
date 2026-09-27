/**
 * Texture Processing Pipeline for TouchDesigner TOPs
 */

export class TexturePipeline {
  constructor() {
    this.buffers = new Map(); // nodeId -> HTMLCanvasElement
    this.contexts = new Map();
    this.feedbackBuffers = new Map(); // nodeId -> HTMLCanvasElement
    this.glslPrograms = new Map(); // nodeId -> { gl, program, textures, ... }
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

    const decay = params.decay !== undefined ? params.decay : 0.94;
    const zoom = params.zoom !== undefined ? params.zoom : 1.02;
    const rotate = params.rotate !== undefined ? params.rotate : 0.01; // radians
    const blendMode = params.blendMode || 'lighter'; // 'lighter', 'source-over', 'screen', 'difference'
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
    outCtx.globalCompositeOperation = blendMode;
    outCtx.drawImage(inCanvas, 0, 0, w, h);
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
    outCtx.drawImage(inCanvas, 0, 0);
    outCtx.restore();

    // Blue/Green Channel
    outCtx.save();
    outCtx.translate(-dx, -dy);
    outCtx.drawImage(inCanvas, 0, 0);
    outCtx.restore();

    // Center base
    outCtx.globalAlpha = 0.6;
    outCtx.drawImage(inCanvas, 0, 0);
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
   * Hand Action FX: Unique visual result for each hand or finger action!
   */
  processHandAction(inCanvas, handData, params, time, nodeId, outCanvas, outCtx) {
    const w = inCanvas.width;
    const h = inCanvas.height;
    outCanvas.width = w;
    outCanvas.height = h;

    const gesture = handData?.gesture || 'none';
    const pinchDist = handData?.pinchDist !== undefined ? handData.pinchDist : 1.0;
    const indexX = (handData?.indexX !== undefined ? handData.indexX : 0.5) * w;
    const indexY = (handData?.indexY !== undefined ? handData.indexY : 0.5) * h;
    const speed = handData?.handSpeed || 0;
    const t = time * 0.001;

    // Apply different visual transformation based on gesture:
    if (gesture === 'fist') {
      // ✊ 1. Gravitational Vortex / Singularity
      outCtx.save();
      outCtx.fillStyle = '#050508';
      outCtx.fillRect(0, 0, w, h);
      outCtx.translate(w / 2, h / 2);
      outCtx.rotate(t * 2.5);
      outCtx.scale(0.85, 0.85);
      outCtx.translate(-w / 2, -h / 2);
      outCtx.drawImage(inCanvas, 0, 0, w, h);

      // Vortex accretion disk
      outCtx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
      outCtx.lineWidth = 4;
      outCtx.shadowColor = '#f43f5e';
      outCtx.shadowBlur = 20;
      for (let r = 20; r < 140; r += 25) {
        outCtx.beginPath();
        outCtx.arc(w / 2, h / 2, r, t * 4, t * 4 + Math.PI * 1.5);
        outCtx.stroke();
      }
      outCtx.restore();

    } else if (gesture === 'open_palm') {
      // ✋ 2. Supernova Expansion / 12-Segment Kaleidoscope
      this.processKaleidoscope(inCanvas, { segments: 12, zoom: 1.15 + Math.sin(t * 4) * 0.05, rotation: t * 20 }, outCanvas, outCtx);
      outCtx.save();
      outCtx.globalCompositeOperation = 'lighter';
      outCtx.filter = 'blur(8px) brightness(160%)';
      outCtx.drawImage(outCanvas, 0, 0);
      outCtx.restore();

    } else if (gesture === 'pointing') {
      // ☝️ 3. Neon Laser Stylus & Interactive Displacement Ripple
      outCtx.drawImage(inCanvas, 0, 0, w, h);

      // Interactive laser ripple centered on index finger tip!
      outCtx.save();
      outCtx.strokeStyle = '#c084fc';
      outCtx.lineWidth = 3;
      outCtx.shadowColor = '#a855f7';
      outCtx.shadowBlur = 25;
      const ripple = (t * 80) % 60;
      outCtx.beginPath();
      outCtx.arc(indexX, indexY, ripple, 0, Math.PI * 2);
      outCtx.stroke();

      // Glowing fingertip emitter
      const radGrad = outCtx.createRadialGradient(indexX, indexY, 2, indexX, indexY, 40);
      radGrad.addColorStop(0, '#ffffff');
      radGrad.addColorStop(0.3, '#a855f7');
      radGrad.addColorStop(1, 'transparent');
      outCtx.fillStyle = radGrad;
      outCtx.beginPath();
      outCtx.arc(indexX, indexY, 40, 0, Math.PI * 2);
      outCtx.fill();
      outCtx.restore();

    } else if (gesture === 'peace') {
      // ✌️ 4. Dual Mirror Kaleidoscope & Rainbow Split
      this.processKaleidoscope(inCanvas, { segments: 8, zoom: 1.05, rotation: 45 }, outCanvas, outCtx);
      this.processChromatic(outCanvas, { offset: 20, angle: 90 }, outCanvas, outCtx);

    } else if (gesture === 'pinch') {
      // 🤏 5. Dynamic Pinch Zoom & Optical Lens Warp
      const zoom = 0.6 + (pinchDist * 1.5);
      outCtx.save();
      outCtx.translate(w / 2, h / 2);
      outCtx.scale(zoom, zoom);
      outCtx.translate(-w / 2, -h / 2);
      outCtx.drawImage(inCanvas, 0, 0, w, h);
      outCtx.restore();

      // Lens boundary indicator
      outCtx.save();
      outCtx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
      outCtx.lineWidth = 2;
      outCtx.strokeRect(w * (1 - zoom * 0.5) * 0.5, h * (1 - zoom * 0.5) * 0.5, w * zoom * 0.5, h * zoom * 0.5);
      outCtx.restore();

    } else if (gesture === 'rock') {
      // 🤘 6. Electric Glitch & Chromatic Strobe
      this.processChromatic(inCanvas, { offset: 25 + Math.random() * 15, angle: (t * 300) % 360 }, outCanvas, outCtx);
      outCtx.save();
      outCtx.strokeStyle = '#ec4899';
      outCtx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        outCtx.beginPath();
        outCtx.moveTo(Math.random() * w, 0);
        outCtx.lineTo(Math.random() * w, h);
        outCtx.stroke();
      }
      outCtx.restore();

    } else if (gesture === 'thumbs_up') {
      // 👍 7. Color Spectrum Inversion & Radioactive Glow
      this.processLevel(inCanvas, { brightness: 1.4, contrast: 1.5, invert: true }, outCanvas, outCtx);
      this.processBloom(outCanvas, { intensity: 2.5, blur: 22 }, outCanvas, outCtx);

    } else {
      // Hand movement swipe / idle pass-through with velocity rotation
      if (speed > 0.4) {
        outCtx.save();
        outCtx.translate(w / 2, h / 2);
        outCtx.rotate(speed * 0.08);
        outCtx.filter = `hue-rotate(${speed * 30}deg)`;
        outCtx.translate(-w / 2, -h / 2);
        outCtx.drawImage(inCanvas, 0, 0, w, h);
        outCtx.restore();
      } else {
        outCtx.drawImage(inCanvas, 0, 0, w, h);
      }
    }
  }
}

export const texturePipeline = new TexturePipeline();
