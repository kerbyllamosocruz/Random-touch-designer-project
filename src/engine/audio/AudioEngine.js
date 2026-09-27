class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.micStream = null;
    this.micSource = null;
    this.synthInterval = null;
    this.synthGain = null;
    this.isPlayingSynth = false;
    this.isMicActive = false;

    this.fftData = new Uint8Array(256);
    this.waveData = new Uint8Array(256);

    // Audio metrics
    this.metrics = {
      bass: 0,
      mid: 0,
      treble: 0,
      energy: 0,
      beat: 0,
      waveform: []
    };

    this.beatThreshold = 0.25;
    this.beatDecay = 0.95;
    this.lastEnergy = 0;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
      this.fftData = new Uint8Array(this.analyser.frequencyBinCount);
      this.waveData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  async startMicrophone() {
    this.ensureContext();
    this.stopSynth();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micStream = stream;
      if (this.micSource) this.micSource.disconnect();
      this.micSource = this.ctx.createMediaStreamSource(stream);
      this.micSource.connect(this.analyser);
      this.isMicActive = true;
      return true;
    } catch (err) {
      console.warn('[Audio] Failed to access microphone:', err);
      // Fallback to internal synth
      this.startSynth();
      return false;
    }
  }

  stopMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    this.isMicActive = false;
  }

  /**
   * Generates a pulsating electronic synth beat for immediate audio reactivity testing
   */
  startSynth() {
    this.ensureContext();
    this.stopMicrophone();
    if (this.isPlayingSynth) return;

    this.synthGain = this.ctx.createGain();
    this.synthGain.gain.value = 0.4;
    this.synthGain.connect(this.analyser);
    this.synthGain.connect(this.ctx.destination); // Can be heard softly

    this.isPlayingSynth = true;
    let step = 0;

    this.synthInterval = setInterval(() => {
      if (!this.isPlayingSynth || !this.ctx) return;
      const now = this.ctx.currentTime;

      // 4-on-the-floor Kick
      if (step % 4 === 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.synthGain);
        osc.start(now);
        osc.stop(now + 0.16);
      }

      // Snare / clap on beat 2 and 4
      if (step % 8 === 4) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.synthGain);
        osc.start(now);
        osc.stop(now + 0.12);
      }

      // Hi-hats
      if (step % 2 === 1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(6000 + (step % 3) * 500, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.synthGain);
        osc.start(now);
        osc.stop(now + 0.06);
      }

      step = (step + 1) % 16;
    }, 125); // ~120 BPM 16th notes
  }

  stopSynth() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    if (this.synthGain) {
      this.synthGain.disconnect();
      this.synthGain = null;
    }
    this.isPlayingSynth = false;
  }

  update() {
    if (!this.analyser) {
      return this.metrics;
    }

    this.analyser.getByteFrequencyData(this.fftData);
    this.analyser.getByteTimeDomainData(this.waveData);

    const binCount = this.analyser.frequencyBinCount;
    // Bins: 0 to ~255
    // Bass: bins 1 to 12 (~20-150Hz)
    let bassSum = 0;
    const bassEnd = Math.min(12, binCount);
    for (let i = 1; i < bassEnd; i++) {
      bassSum += this.fftData[i];
    }
    const bass = bassSum / (bassEnd - 1) / 255;

    // Mid: bins 12 to 64 (~150-1500Hz)
    let midSum = 0;
    const midEnd = Math.min(64, binCount);
    for (let i = bassEnd; i < midEnd; i++) {
      midSum += this.fftData[i];
    }
    const mid = midSum / (midEnd - bassEnd) / 255;

    // Treble: bins 64 to 200 (~1500-6000Hz)
    let trebleSum = 0;
    const trebleEnd = Math.min(200, binCount);
    for (let i = midEnd; i < trebleEnd; i++) {
      trebleSum += this.fftData[i];
    }
    const treble = trebleSum / (trebleEnd - midEnd) / 255;

    // Overall energy
    const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;

    // Beat detection
    let beat = this.metrics.beat * this.beatDecay;
    if (energy - this.lastEnergy > this.beatThreshold && energy > 0.35) {
      beat = 1.0;
    }
    this.lastEnergy = energy;

    this.metrics = {
      bass,
      mid,
      treble,
      energy,
      beat,
      fftData: this.fftData,
      waveData: this.waveData
    };

    return this.metrics;
  }
}

export const audioEngine = new AudioEngine();
