import React, { useRef } from 'react';
import {
  Plus,
  Play,
  Pause,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Sliders,
  Maximize2,
  Download,
  Upload,
  Sparkles,
  Cpu
} from 'lucide-react';
import { mediaService } from '../engine/video/MediaService.js';
import { audioEngine } from '../engine/audio/AudioEngine.js';

export function Header({
  graphEngine,
  onOpenOpModal,
  onToggleParams,
  isParamsOpen,
  onOpenOutModal,
  fps,
  activePreset,
  onSelectPreset,
  isWebcamActive,
  onToggleWebcam,
  isAudioActive,
  onToggleAudio
}) {
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const json = graphEngine.exportNetwork();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `touchdesigner_network_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        graphEngine.importNetwork(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="header-bar" id="header-bar">
      {/* Brand & Breadcrumb */}
      <div className="header-left">
        <div className="brand" onClick={() => onSelectPreset('ai_segmentation')} title="TouchDesigner Web Home">
          <img src="/logo.svg" alt="TouchDesigner Web" className="brand-logo" />
          <span className="brand-text">
            TouchDesigner <span className="brand-badge">ONNX Web</span>
          </span>
        </div>

        <div className="breadcrumb">
          <span>/</span>
          <span>project1</span>
          <span>/</span>
          <span className="active">container1</span>
        </div>
      </div>

      {/* Center Controls: Add OP & Presets */}
      <div className="header-center">
        <button
          id="btn-add-operator"
          className="btn btn-primary"
          onClick={onOpenOpModal}
          title="Add Operator (Press TAB or double click canvas)"
        >
          <Plus size={14} />
          <span>Add OP (TAB)</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={13} color="#8b5cf6" />
          <select
            id="preset-network-select"
            className="select-dropdown"
            value={activePreset}
            onChange={(e) => onSelectPreset(e.target.value)}
            title="Load Preset Network"
          >
            <option value="hand_gesture_studio">🖐️ Hand & Finger Gesture Controller</option>
            <option value="person_matte">👤 AI Person Matte & Feedback</option>
            <option value="sobel_kaleido">⚡ Neural Sobel & Kaleidoscope</option>
            <option value="audio_glsl_ai">🎵 Audio GLSL & Neural Color</option>
            <option value="squeezenet_vision">👁️ SqueezeNet Vision & Displace</option>
          </select>
        </div>

        {/* Quick Toggles */}
        <button
          id="btn-toggle-webcam"
          className={`btn ${isWebcamActive ? 'btn-active' : 'btn-secondary'}`}
          onClick={onToggleWebcam}
          title={isWebcamActive ? 'Turn Webcam Off' : 'Turn Webcam On'}
        >
          {isWebcamActive ? <Video size={13} color="#06b6d4" /> : <VideoOff size={13} />}
          <span>{isWebcamActive ? 'Cam Active' : 'Cam Off'}</span>
        </button>

        <button
          id="btn-toggle-audio"
          className={`btn ${isAudioActive ? 'btn-active' : 'btn-secondary'}`}
          onClick={onToggleAudio}
          title={isAudioActive ? 'Mute Audio Reactivity' : 'Enable Audio Reactivity (Mic or Synth)'}
        >
          {isAudioActive ? <Mic size={13} color="#10b981" /> : <MicOff size={13} />}
          <span>{isAudioActive ? 'Audio ON' : 'Audio OFF'}</span>
        </button>
      </div>

      {/* Right Controls: Inspector, Output & Performance */}
      <div className="header-right">
        {/* Network Export / Import */}
        <button
          id="btn-export-network"
          className="btn btn-outline"
          onClick={handleExport}
          title="Export Network JSON"
        >
          <Download size={13} />
          <span>Export</span>
        </button>

        <button
          id="btn-import-network"
          className="btn btn-outline"
          onClick={() => fileInputRef.current?.click()}
          title="Import Network JSON"
        >
          <Upload size={13} />
          <span>Import</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />

        <button
          id="btn-open-out-window"
          className="btn btn-secondary"
          onClick={onOpenOutModal}
          title="Open Master Output Window"
        >
          <Maximize2 size={13} color="#f59e0b" />
          <span>Live Out</span>
        </button>

        <button
          id="btn-toggle-params-pane"
          className={`btn ${isParamsOpen ? 'btn-active' : 'btn-secondary'}`}
          onClick={onToggleParams}
          title="Toggle Parameters Inspector (P)"
        >
          <Sliders size={13} />
          <span>Params (P)</span>
        </button>

        {/* Performance Pill */}
        <div className="perf-pill" id="perf-pill" title="Real-time Performance">
          <div className="perf-dot" />
          <span className="perf-stat">
            <strong>{fps}</strong> FPS
          </span>
          <span style={{ color: 'var(--border-strong)' }}>|</span>
          <span className="perf-stat" style={{ color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Cpu size={11} />
            WASM-SIMD
          </span>
        </div>
      </div>
    </header>
  );
}
