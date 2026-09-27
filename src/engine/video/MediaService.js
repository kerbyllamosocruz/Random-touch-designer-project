class MediaService {
  constructor() {
    this.webcamVideo = document.createElement('video');
    this.webcamVideo.autoplay = true;
    this.webcamVideo.muted = true;
    this.webcamVideo.playsInline = true;
    this.webcamStream = null;
    this.isWebcamActive = false;

    // File video element
    this.fileVideo = document.createElement('video');
    this.fileVideo.autoplay = true;
    this.fileVideo.loop = true;
    this.fileVideo.muted = true;
    this.fileVideo.playsInline = true;

    // Procedural animated video loop canvases
    this.procCanvas = document.createElement('canvas');
    this.procCanvas.width = 640;
    this.procCanvas.height = 360;
    this.procCtx = this.procCanvas.getContext('2d');
  }

  async startWebcam(deviceId = null) {
    this.stopWebcam();
    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.webcamStream = stream;
      this.webcamVideo.srcObject = stream;
      await this.webcamVideo.play();
      this.isWebcamActive = true;
      return true;
    } catch (err) {
      console.warn('[MediaService] Webcam access denied or unavailable:', err);
      this.isWebcamActive = false;
      return false;
    }
  }

  stopWebcam() {
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
      this.webcamStream = null;
    }
    this.webcamVideo.srcObject = null;
    this.isWebcamActive = false;
  }

  loadVideoFile(file) {
    const url = URL.createObjectURL(file);
    this.fileVideo.src = url;
    this.fileVideo.play();
    return url;
  }

  /**
   * Renders high-quality procedural animated video loops when webcam is idle or preset is selected
   */
  renderProceduralLoop(type = 'cyber_grid', time = 0, width = 640, height = 360) {
    if (this.procCanvas.width !== width || this.procCanvas.height !== height) {
      this.procCanvas.width = width;
      this.procCanvas.height = height;
    }

    const ctx = this.procCtx;
    const t = time * 0.001;

    if (type === 'cyber_grid') {
      // Dark synthwave gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0a0a14');
      grad.addColorStop(0.5, '#2e0854');
      grad.addColorStop(0.52, '#ec4899');
      grad.addColorStop(1, '#050508');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Glowing Neon Sun
      const sunY = height * 0.45;
      const sunGrad = ctx.createRadialGradient(width / 2, sunY, 10, width / 2, sunY, 80);
      sunGrad.addColorStop(0, '#fef08a');
      sunGrad.addColorStop(0.4, '#f43f5e');
      sunGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(width / 2, sunY, 80, 0, Math.PI * 2);
      ctx.fill();

      // Sun stripes
      ctx.fillStyle = '#0a0a14';
      for (let i = 0; i < 6; i++) {
        const stripeY = sunY + 15 + i * 10;
        ctx.fillRect(width / 2 - 80, stripeY, 160, 2 + i * 0.8);
      }

      // 3D Perspective Grid
      const horizon = height * 0.52;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;

      // Vertical perspective lines
      const vanishingX = width / 2;
      const numLines = 18;
      for (let i = -numLines; i <= numLines; i++) {
        const xBottom = vanishingX + i * 40;
        ctx.beginPath();
        ctx.moveTo(vanishingX, horizon);
        ctx.lineTo(xBottom, height);
        ctx.stroke();
      }

      // Horizontal moving grid lines
      const speed = (t * 60) % 30;
      for (let y = horizon; y < height; y += (y - horizon + 10) * 0.18) {
        const lineY = y + (speed * (y - horizon) / 80);
        if (lineY >= horizon && lineY <= height) {
          ctx.beginPath();
          ctx.moveTo(0, lineY);
          ctx.lineTo(width, lineY);
          ctx.stroke();
        }
      }

    } else if (type === 'particle_vortex') {
      // Swirling particle vortex
      ctx.fillStyle = 'rgba(10, 10, 16, 0.25)';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const numParticles = 120;

      for (let i = 0; i < numParticles; i++) {
        const angle = i * 0.15 + t * 1.5;
        const dist = ((i * 3 + t * 80) % 240) + 10;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * (dist * 0.6);
        const radius = (dist / 240) * 4 + 1;

        const hue = (i * 4 + t * 40) % 360;
        ctx.fillStyle = `hsl(${hue}, 95%, 65%)`;
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

    } else if (type === 'liquid_waves') {
      // Flowing colorful plasma
      ctx.fillStyle = '#090a0f';
      ctx.fillRect(0, 0, width, height);

      for (let y = 0; y < height; y += 8) {
        const wave = Math.sin(y * 0.02 + t * 2) * 40 + Math.cos(y * 0.05 - t) * 20;
        const hue = (y * 0.5 + t * 60) % 360;
        ctx.fillStyle = `hsla(${hue}, 80%, 55%, 0.7)`;
        ctx.fillRect(width * 0.3 + wave, y, width * 0.4 + wave * 0.5, 6);
      }

    } else {
      // Geometric kaleido
      ctx.fillStyle = '#0f1117';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const petals = 8;
      for (let p = 0; p < petals; p++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((p * Math.PI * 2) / petals + t * 0.5);

        ctx.strokeStyle = `hsl(${(p * 45 + t * 30) % 360}, 90%, 60%)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(60, 0, 80 + Math.sin(t * 2) * 20, 25, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }
    }

    return this.procCanvas;
  }
}

export const mediaService = new MediaService();
