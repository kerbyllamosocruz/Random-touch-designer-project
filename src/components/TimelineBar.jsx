import React from 'react';
import { Play, Pause, RotateCcw, Cpu, Terminal } from 'lucide-react';

export function TimelineBar({
  isPlaying,
  onTogglePlay,
  frame,
  totalFrames = 600,
  onSeek,
  provider,
  onChangeProvider
}) {
  const formatFrame = (f) => String(f % totalFrames).padStart(5, '0');

  // Compute simulated timecode HH:MM:SS:FF at 60fps
  const totalSeconds = Math.floor(frame / 60);
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  const ff = String(frame % 60).padStart(2, '0');
  const timecode = `00:${mm}:${ss}:${ff}`;

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
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          <span className="transport-btn-label">{isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>

        <button
          id="btn-transport-rewind"
          className="transport-btn"
          onClick={() => onSeek(0)}
          title="Rewind to Frame 0"
        >
          <RotateCcw size={12} />
          <span className="transport-btn-label">REW</span>
        </button>

        <div className="frame-counter" id="frame-counter">
          <span className="frame-current">{formatFrame(frame)}</span>
          <span className="frame-separator">//</span>
          <span className="frame-total">{String(totalFrames).padStart(5, '0')}</span>
        </div>
      </div>

      {/* Scrubber */}
      <div className="timeline-center">
        <div className="timeline-track-wrap">
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
      </div>

      {/* Utilitarian Telemetry (Silent / Audio-Free) */}
      <div className="timeline-right">
        {/* Timecode Readout */}
        <div className="timeline-telemetry-tag" title="Timecode (SMPTE)">
          <Terminal size={11} color="var(--accent-sharp)" />
          <span className="timecode-text">TC: {timecode}</span>
        </div>

        {/* Status Indicator */}
        <div className="timeline-status-badge">
          <span className="status-blink-dot" />
          <span className="status-text">{isPlaying ? 'ENGINE // RUN' : 'ENGINE // IDLE'}</span>
        </div>

        {/* Execution Provider Toggle */}
        <div className="provider-select-wrap">
          <Cpu size={12} color="var(--accent-sharp)" />
          <select
            className="select-dropdown provider-select"
            value={provider}
            onChange={(e) => onChangeProvider(e.target.value)}
            title="ONNX Execution Provider"
          >
            <option value="wasm">WASM-SIMD</option>
            <option value="webgpu">WEBGPU</option>
          </select>
        </div>
      </div>
    </footer>
  );
}
