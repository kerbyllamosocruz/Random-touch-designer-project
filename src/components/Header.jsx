import React, { useRef } from 'react';
import {
  Plus,
  Video,
  VideoOff,
  Sliders,
  Maximize2,
  Download,
  Upload,
  Layers,
  Cpu
} from 'lucide-react';

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
  onToggleWebcam
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
        <div className="brand" onClick={() => onSelectPreset('hand_gesture_studio')} title="TouchDesigner Web Home">
          <img src="/logo.svg" alt="TouchDesigner Web" className="brand-logo" />
          <span className="brand-text">
            TOUCHDESIGNER <span className="brand-badge">ONNX.STUDIO</span>
          </span>
        </div>

        <div className="breadcrumb">
          <span>//</span>
          <span>PROJECT1</span>
          <span>//</span>
          <span className="active">CONTAINER1</span>
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
          <Plus size={13} strokeWidth={2.5} />
          <span>ADD OP [TAB]</span>
        </button>

        <div className="preset-selector-wrap">
          <Layers size={13} color="var(--accent-sharp)" />
          <select
            id="preset-network-select"
            className="select-dropdown"
            value={activePreset}
            onChange={(e) => onSelectPreset(e.target.value)}
            title="Load Preset Network"
          >
            <option value="hand_gesture_studio">[01] DUAL-HAND GLASS MATRIX</option>
            <option value="person_matte">[02] AI PERSON MATTE & FEEDBACK</option>
            <option value="sobel_kaleido">[03] NEURAL SOBEL & KALEIDOSCOPE</option>
            <option value="squeezenet_vision">[04] SQUEEZENET VISION & DISPLACE</option>
          </select>
        </div>

        {/* Camera Toggle */}
        <button
          id="btn-toggle-webcam"
          className={`btn ${isWebcamActive ? 'btn-active' : 'btn-secondary'}`}
          onClick={onToggleWebcam}
          title={isWebcamActive ? 'Turn Webcam Off' : 'Turn Webcam On'}
        >
          {isWebcamActive ? <Video size={13} color="var(--accent-sharp)" /> : <VideoOff size={13} />}
          <span>{isWebcamActive ? 'CAM: ON' : 'CAM: OFF'}</span>
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
          <Download size={12} />
          <span>EXPORT</span>
        </button>

        <button
          id="btn-import-network"
          className="btn btn-outline"
          onClick={() => fileInputRef.current?.click()}
          title="Import Network JSON"
        >
          <Upload size={12} />
          <span>IMPORT</span>
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
          <Maximize2 size={12} color="var(--accent-sharp)" />
          <span>LIVE OUT</span>
        </button>

        <button
          id="btn-toggle-params-pane"
          className={`btn ${isParamsOpen ? 'btn-active' : 'btn-secondary'}`}
          onClick={onToggleParams}
          title="Toggle Parameters Inspector (P)"
        >
          <Sliders size={12} />
          <span>PARAMS [P]</span>
        </button>

        {/* Utilitarian Telemetry Pill */}
        <div className="perf-pill" id="perf-pill" title="Real-time Performance">
          <div className="perf-dot" />
          <span className="perf-stat">
            <strong>{fps}</strong> FPS
          </span>
          <span className="perf-divider">|</span>
          <span className="perf-stat mono-accent">
            <Cpu size={11} />
            WASM-SIMD
          </span>
        </div>
      </div>
    </header>
  );
}
