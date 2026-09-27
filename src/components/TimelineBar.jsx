import React from 'react';
import { Play, Pause, RotateCcw, Volume2, Cpu } from 'lucide-react';
import { onnxService } from '../engine/onnx/OnnxRuntimeService.js';

export function TimelineBar({
  isPlaying,
  onTogglePlay,
  frame,
  totalFrames = 600,
  onSeek,
  audioMetrics,
  provider,
  onChangeProvider
}) {
  const formatFrame = (f) => String(f % totalFrames).padStart(5, '0');

  return (
    <footer className="timeline-bar" id="timeline-bar">
      {/* Transport Controls */}
      <div className="timeline-left">
        <button
          id="btn-transport-play"
          className={`transport-btn ${isPlaying ? 'playing' : ''}`}
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause Timeline (Space)' : 'Play Timeline (Space)'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <button
          id="btn-transport-rewind"
          className="transport-btn"
          onClick={() => onSeek(0)}
          title="Rewind to Frame 0"
        >
          <RotateCcw size={13} />
        </button>

        <div className="frame-counter" id="frame-counter">
          <span>{formatFrame(frame)}</span>
          <span style={{ color: 'var(--text-dim)', margin: '0 4px' }}>/</span>
          <span style={{ color: 'var(--text-muted)' }}>{String(totalFrames).padStart(5, '0')}</span>
        </div>
      </div>

      {/* Scrubber */}
      <div className="timeline-center">
        <input
          id="timeline-scrubber"
          type="range"
          className="timeline-scrubber"
          min="0"
          max={totalFrames}
          value={frame % totalFrames}
          onChange={(e) => onSeek(parseInt(e.target.value))}
        />
      </div>

      {/* Audio Reactive VU Meter & Provider */}
      <div className="timeline-right">
        {/* Audio VU Bars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Audio Reactivity VU Meter">
          <Volume2 size={13} color="#10b981" />
          <div className="audio-vu-meter">
            <div className={`vu-segment ${audioMetrics?.bass > 0.1 ? 'lit-low' : ''}`} />
            <div className={`vu-segment ${audioMetrics?.bass > 0.3 ? 'lit-low' : ''}`} />
            <div className={`vu-segment ${audioMetrics?.mid > 0.2 ? 'lit-mid' : ''}`} />
            <div className={`vu-segment ${audioMetrics?.mid > 0.4 ? 'lit-mid' : ''}`} />
            <div className={`vu-segment ${audioMetrics?.treble > 0.2 ? 'lit-mid' : ''}`} />
            <div className={`vu-segment ${audioMetrics?.beat > 0.5 ? 'lit-high' : ''}`} />
          </div>
        </div>

        {/* BPM */}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
          120.0 BPM
        </span>

        {/* Execution Provider Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Cpu size={12} color="#06b6d4" />
          <select
            className="select-dropdown"
            style={{ padding: '3px 6px', fontSize: '10px' }}
            value={provider}
            onChange={(e) => onChangeProvider(e.target.value)}
            title="ONNX Execution Provider"
          >
            <option value="wasm">WASM-SIMD</option>
            <option value="webgpu">WebGPU</option>
          </select>
        </div>
      </div>
    </footer>
  );
}
