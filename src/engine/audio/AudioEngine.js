/**
 * AudioEngine (Muted / Deactivated)
 * Fully silenced: No AudioContext generation, no oscillators, no mic capture.
 * Provides safe zero-metric telemetry for node graphs without generating any audio.
 */

class AudioEngine {
  constructor() {
    this.isPlayingSynth = false;
    this.isMicActive = false;

    this.fftData = new Uint8Array(256);
    this.waveData = new Uint8Array(256);

    // Audio metrics - zeroed
    this.metrics = {
      bass: 0,
      mid: 0,
      treble: 0,
      energy: 0,
      beat: 0,
      waveform: []
    };
  }

  startMicrophone() {
    // Audio permanently disabled
    return Promise.resolve(false);
  }

  stopMicrophone() {
    this.isMicActive = false;
  }

  startSynth() {
    // Audio permanently disabled
    this.isPlayingSynth = false;
  }

  stopSynth() {
    this.isPlayingSynth = false;
  }

  update() {
    // Safe zeroed telemetry
    return this.metrics;
  }
}

export const audioEngine = new AudioEngine();
