import React, { useState } from 'react';
import { NODE_CATEGORIES } from '../engine/nodes/NodeDefinitions.js';
import { BUILTIN_MODELS } from '../engine/onnx/BuiltinModels.js';
import { DEFAULT_GLSL_SHADERS } from '../engine/operators/GlslRunner.js';
import { onnxService } from '../engine/onnx/OnnxRuntimeService.js';
import { mediaService } from '../engine/video/MediaService.js';
import { X, Sliders, Upload, Play, Pause, Camera, Hand, Target } from 'lucide-react';

export function ParametersPane({
  node,
  onClose,
  onUpdateParams,
  channelData
}) {
  const [activeTab, setActiveTab] = useState('parameters');

  if (!node) {
    return (
      <div className="params-pane" id="params-pane">
        <div className="params-header">
          <span className="params-title">
            <Sliders size={14} /> Parameter Inspector
          </span>
          <button className="btn btn-outline" style={{ padding: '2px 6px' }} onClick={onClose}>
            <X size={13} />
          </button>
        </div>
        <div style={{ padding: '24px', color: 'var(--text-dim)', textAlign: 'center' }}>
          Select a node on the canvas to inspect and edit its parameters.
        </div>
      </div>
    );
  }

  const cat = NODE_CATEGORIES[node.category] || NODE_CATEGORIES.TOP;
  const params = node.params;

  const handleChange = (key, val) => {
    onUpdateParams(node.id, { [key]: val });
  };

  const handleCustomModelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const modelId = `custom_${Date.now()}`;
      await onnxService.loadModel(modelId, buffer, file.name);
      onUpdateParams(node.id, {
        modelId,
        customFileName: file.name
      });
      alert(`Custom ONNX model '${file.name}' loaded successfully!`);
    } catch (err) {
      alert(`Error loading ONNX model: ${err.message}`);
    }
  };

  const handleMediaUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    mediaService.loadVideoFile(file);
    onUpdateParams(node.id, {
      customFileName: file.name
    });
  };

  return (
    <div className="params-pane" id="params-pane">
      {/* Header */}
      <div className="params-header" style={{ borderLeft: `3px solid ${cat.color}` }}>
        <div className="params-title">
          <span className="op-category-tag" style={{ backgroundColor: cat.color }}>
            {cat.id}
          </span>
          <span>{node.name}</span>
        </div>
        <button className="btn btn-outline" style={{ padding: '3px 6px' }} onClick={onClose} title="Close Inspector (P)">
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="params-tabs">
        <div
          className={`param-tab ${activeTab === 'parameters' ? 'active' : ''}`}
          onClick={() => setActiveTab('parameters')}
        >
          Parameters
        </div>
        {node.type === 'glsl' && (
          <div
            className={`param-tab ${activeTab === 'shader' ? 'active' : ''}`}
            onClick={() => setActiveTab('shader')}
          >
            GLSL Code
          </div>
        )}
        <div
          className={`param-tab ${activeTab === 'common' ? 'active' : ''}`}
          onClick={() => setActiveTab('common')}
        >
          Common
        </div>
      </div>

      {/* Content */}
      <div className="params-content">
        {activeTab === 'parameters' && (
          <>
            {/* === MEDIAPIPE HAND TRACKER OPERATOR === */}
            {node.type === 'mediaPipeHand' && (
              <>
                <div className="param-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.5px' }}>
                      MEDIAPIPE HANDLANDMARKER
                    </span>
                    <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.3)', fontFamily: 'var(--font-mono)' }}>
                      {params.delegate || 'GPU'} ACCELERATED
                    </span>
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Live Gesture & Interaction</span>
                  </div>
                  <div style={{ background: '#090d16', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ACTIVE ACTION:</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                        {channelData?.effect || 'AWAITING HAND'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        background: 'rgba(198, 255, 0, 0.12)',
                        border: '1px solid var(--accent-sharp)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-sharp)'
                      }}>
                        <Hand size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                          [{channelData?.gesture ? channelData.gesture.toUpperCase() : 'SEARCHING'}] {channelData?.gestureName || 'Awaiting Hand Feed'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {channelData?.detected ? `${channelData.handCount || 1} HAND(S) · ${channelData.handednessName?.toUpperCase() || 'RIGHT'} · SPEED: ${channelData.handSpeed?.toFixed(1)}` : 'CAMERA FEED ACTIVE'}
                        </div>
                      </div>
                    </div>

                    {/* Dominant Hand Fingers */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      {['Thumb', 'Index', 'Mid', 'Ring', 'Pinky'].map((fName, i) => {
                        const isExt = [channelData?.thumbExt, channelData?.indexExt, channelData?.middleExt, channelData?.ringExt, channelData?.pinkyExt][i];
                        return (
                          <span
                            key={fName}
                            style={{
                              flex: 1,
                              textAlign: 'center',
                              fontSize: '9px',
                              fontFamily: 'var(--font-mono)',
                              padding: '3px 0',
                              borderRadius: '3px',
                              background: isExt ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.05)',
                              color: isExt ? '#38bdf8' : 'var(--text-dim)',
                              border: isExt ? '1px solid #0284c7' : '1px solid transparent'
                            }}
                          >
                            {fName}
                          </span>
                        );
                      })}
                    </div>

                    {/* Pinch Meter */}
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-dim)', marginBottom: '3px' }}>
                        <span>PINCH DISTANCE</span>
                        <span>{channelData?.pinchDist ? `${(channelData.pinchDist * 100).toFixed(0)}%` : '100%'}</span>
                      </div>
                      <div style={{ width: '100%', height: '4px', background: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, (channelData?.pinchDist || 1.0) * 100))}%`,
                            height: '100%',
                            background: channelData?.isPinching ? '#f59e0b' : '#38bdf8',
                            transition: 'width 0.05s ease'
                          }}
                        />
                      </div>
                    </div>

                    {/* Hand 2 Info if present */}
                    {channelData?.hand2_detected ? (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                        <span style={{ color: 'var(--accent-sharp)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>// HAND 2: {channelData.hand2_gesture?.toUpperCase()}</span>
                        <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Span: {Math.round(channelData.twoHandDist * 100)}%</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Visual Overlay Mode</span>
                  </div>
                  <select
                    className="select-dropdown"
                    value={params.overlayMode || 'composite'}
                    onChange={(e) => handleChange('overlayMode', e.target.value)}
                  >
                    <option value="composite">Composite (Video + FX)</option>
                    <option value="skeleton_only">Skeleton Only (Dark Canvas)</option>
                    <option value="clean">Clean Video (Pass-through)</option>
                  </select>
                </div>

                {/* === HAND TRACKING OVERLAY TOGGLES === */}
                <div className="param-group">
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
                    OVERLAY LAYERS
                  </div>
                  {[
                    { key: 'showSkeleton',  label: 'Skeleton Bones',       desc: 'Colored gradient bones connecting joints' },
                    { key: 'showJoints',    label: 'Joint Dots',            desc: 'Circle markers at each of 21 landmarks' },
                    { key: 'showReticles',  label: 'Fingertip Reticles',    desc: 'Ring + L-IDX / R-IDX label badges on tips' },
                    { key: 'showGestureFX', label: 'Gesture FX',            desc: 'Fist vortex, palm burst, pointing laser etc.' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="param-toggle-row" style={{ marginBottom: '6px', cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{desc}</div>
                      </div>
                      <div
                        className={`toggle-switch ${params[key] ? 'active' : ''}`}
                        onClick={() => handleChange(key, !params[key])}
                      >
                        <div className="toggle-knob" />
                      </div>
                    </label>
                  ))}
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Max Hands Tracked</span>
                    <span className="param-value">{params.maxHands || 2}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="2"
                    step="1"
                    className="range-slider"
                    value={params.maxHands || 2}
                    onChange={(e) => handleChange('maxHands', parseInt(e.target.value, 10))}
                  />
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Hardware Delegate</span>
                  </div>
                  <select
                    className="select-dropdown"
                    value={params.delegate || 'GPU'}
                    onChange={(e) => handleChange('delegate', e.target.value)}
                  >
                    <option value="GPU">GPU (WebGL / WebGPU Hardware Accelerated)</option>
                    <option value="CPU">CPU (WASM SIMD Multi-threaded)</option>
                  </select>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Inference Interval</span>
                    <span className="param-value">Every {params.interval || 1} frame</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    className="range-slider"
                    value={params.interval || 1}
                    onChange={(e) => handleChange('interval', parseInt(e.target.value, 10))}
                  />
                </div>
              </>
            )}

            {/* === ONNX MODEL OPERATOR === */}
            {node.type === 'onnxModel' && (
              <>
                <div className="param-group">
                  <div className="param-label">
                    <span>ONNX Model</span>
                  </div>
                  <select
                    className="select-dropdown"
                    value={params.modelId || 'hand_landmark'}
                    onChange={(e) => handleChange('modelId', e.target.value)}
                  >
                    <option value="hand_landmark">MediaPipe Hand & Finger Movement</option>
                    <option value="selfie_segmentation">MediaPipe Selfie Segmentation</option>
                    <option value="sobel_edge">Neural Sobel Edge Tensor</option>
                    <option value="neural_filter">Cyber Neural Color Grade</option>
                    <option value="squeezenet">SqueezeNet 1.1 Classifier</option>
                    <option value="custom">Upload Custom .onnx Model</option>
                  </select>
                </div>

                {params.modelId === 'hand_landmark' && (
                  <div className="param-group">
                    <div className="param-label">
                      <span>Detected Hand Gesture & Action</span>
                    </div>
                    <div style={{ background: '#090d16', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ACTIVE ACTION:</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                          {channelData?.effect || 'AWAITING HAND'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          background: 'rgba(198, 255, 0, 0.12)',
                          border: '1px solid var(--accent-sharp)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-sharp)'
                        }}>
                          <Target size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                            [{channelData?.gesture ? channelData.gesture.toUpperCase() : 'SEARCHING'}] {channelData?.gestureName || 'Awaiting Hand Feed'}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {channelData?.detected ? `${channelData.fingerCount} FINGERS UP · SPEED: ${channelData.handSpeed?.toFixed(1)}` : 'CAMERA TRACKING ACTIVE'}
                          </div>
                        </div>
                      </div>

                      {/* Individual Finger Status Pills */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {['Thumb', 'Index', 'Mid', 'Ring', 'Pinky'].map((fName, i) => {
                          const isExt = [channelData?.thumbExt, channelData?.indexExt, channelData?.middleExt, channelData?.ringExt, channelData?.pinkyExt][i];
                          return (
                            <span
                              key={fName}
                              style={{
                                flex: 1,
                                textAlign: 'center',
                                fontSize: '9px',
                                fontFamily: 'var(--font-mono)',
                                padding: '3px 0',
                                borderRadius: '3px',
                                background: isExt ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.05)',
                                color: isExt ? '#38bdf8' : 'var(--text-dim)',
                                border: isExt ? '1px solid #0284c7' : '1px solid transparent'
                              }}
                            >
                              {fName}
                            </span>
                          );
                        })}
                      </div>

                      {/* Pinch Meter */}
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-dim)', marginBottom: '3px' }}>
                          <span>PINCH DISTANCE</span>
                          <span>{channelData?.pinchDist ? `${(channelData.pinchDist * 100).toFixed(0)}%` : '100%'}</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, (channelData?.pinchDist || 1.0) * 100))}%`,
                              height: '100%',
                              background: channelData?.isPinching ? '#f59e0b' : '#38bdf8',
                              transition: 'width 0.05s ease'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {params.modelId === 'custom' && (
                  <div className="param-group">
                    <div className="param-label">
                      <span>Upload .onnx File</span>
                    </div>
                    <label className="btn btn-primary" style={{ justifyContent: 'center' }}>
                      <Upload size={13} />
                      <span>{params.customFileName || 'Choose .onnx file'}</span>
                      <input
                        type="file"
                        accept=".onnx"
                        style={{ display: 'none' }}
                        onChange={handleCustomModelUpload}
                      />
                    </label>
                  </div>
                )}

                {params.modelId === 'selfie_segmentation' && (
                  <>
                    <div className="param-group">
                      <div className="param-label">
                        <span>Segmentation Mode</span>
                      </div>
                      <select
                        className="select-dropdown"
                        value={params.mode || 'matte'}
                        onChange={(e) => handleChange('mode', e.target.value)}
                      >
                        <option value="matte">Grayscale Alpha Matte</option>
                        <option value="cutout">RGB Person Cutout</option>
                        <option value="glow">Cyberpunk Neon Body Glow</option>
                      </select>
                    </div>

                    <div className="param-group">
                      <div className="param-label">
                        <span>Threshold</span>
                        <span className="val">{params.threshold?.toFixed(2) || '0.50'}</span>
                      </div>
                      <div className="param-slider-row">
                        <input
                          type="range"
                          className="param-slider"
                          min="0.1"
                          max="0.9"
                          step="0.02"
                          value={params.threshold !== undefined ? params.threshold : 0.5}
                          onChange={(e) => handleChange('threshold', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="param-group">
                      <label className="param-toggle-row">
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Invert Mask</span>
                        <div
                          className={`toggle-switch ${params.invert ? 'active' : ''}`}
                          onClick={() => handleChange('invert', !params.invert)}
                        >
                          <div className="toggle-knob" />
                        </div>
                      </label>
                    </div>
                  </>
                )}

                {params.modelId === 'sobel_edge' && (
                  <div className="param-group">
                    <div className="param-label">
                      <span>Edge Boost</span>
                      <span className="val">{params.edgeBoost?.toFixed(1) || '2.5'}</span>
                    </div>
                    <div className="param-slider-row">
                      <input
                        type="range"
                        className="param-slider"
                        min="0.5"
                        max="5.0"
                        step="0.1"
                        value={params.edgeBoost || 2.5}
                        onChange={(e) => handleChange('edgeBoost', parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                )}

                {params.modelId === 'squeezenet' && (
                  <div className="param-group">
                    <div className="param-label">
                      <span>Real-time Top Classifications</span>
                    </div>
                    <div style={{ background: '#0a0d14', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                      <p style={{ fontSize: '10px', color: '#10b981', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
                        TOP PREDICTION:
                      </p>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }}>
                        {channelData?.classIndex !== undefined ? `Class #${channelData.classIndex}` : 'Running SqueezeNet...'}
                      </p>
                      <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                        Probability: {((channelData?.topProb || 0) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}

                <div className="param-group">
                  <div className="param-label">
                    <span>Frame Throttle Interval</span>
                    <span className="val">Every {params.interval || 1} frame(s)</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="1"
                      max="4"
                      step="1"
                      value={params.interval || 1}
                      onChange={(e) => handleChange('interval', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </>
            )}

            {/* === DUAL HAND GLASS PORTAL OPERATOR === */}
            {node.type === 'handActionFX' && (() => {
              const af = params.activeFingers || { thumb: true, index: true, middle: true, ring: true, pinky: true };
              const fingerKeys = ['thumb', 'index', 'middle', 'ring', 'pinky'];
              const fingerLabels = ['THB', 'IDX', 'MID', 'RNG', 'PNK'];

              const toggleFinger = (key) => {
                const next = { ...af, [key]: !af[key] };
                handleChange('activeFingers', next);
              };

              const setPreset = (preset) => {
                if (preset === 'all') handleChange('activeFingers', { thumb: true, index: true, middle: true, ring: true, pinky: true });
                else if (preset === 'index') handleChange('activeFingers', { thumb: false, index: true, middle: false, ring: false, pinky: false });
                else if (preset === 'pinch') handleChange('activeFingers', { thumb: true, index: true, middle: false, ring: false, pinky: false });
              };

              // SVG hand: normalized viewBox coords for each fingertip hit zone
              // Left-hand silhouette shown; right mirrors same selection
              const tipPositions = [
                { key: 'thumb',  cx: 28,  cy: 55,  label: 'Thumb' },
                { key: 'index',  cx: 52,  cy: 18,  label: 'Index' },
                { key: 'middle', cx: 72,  cy: 10,  label: 'Middle' },
                { key: 'ring',   cx: 91,  cy: 18,  label: 'Ring' },
                { key: 'pinky',  cx: 108, cy: 34,  label: 'Pinky' },
              ];

              return (
                <>
                  <div className="param-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.5px' }}>
                        BIMANUAL HOLOGRAPHIC GLASS
                      </span>
                      <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', border: '1px solid rgba(56, 189, 248, 0.3)', fontFamily: 'var(--font-mono)' }}>
                        η 1.52 REFRACTION
                      </span>
                    </div>
                  </div>

                  {/* === INTERACTIVE FINGER SELECTOR === */}
                  <div className="param-group">
                    <div className="param-label" style={{ marginBottom: '10px' }}>
                      <span>Active Fingertip Connections</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {fingerKeys.filter(k => af[k] !== false).length}/5 ACTIVE
                      </span>
                    </div>

                    {/* SVG Hand Diagram */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', position: 'relative' }}>
                      <svg
                        viewBox="0 0 140 130"
                        width="140"
                        height="130"
                        style={{ display: 'block' }}
                        aria-label="Hand fingertip selector"
                      >
                        {/* Palm silhouette */}
                        <path
                          d="M30 95 Q20 80 22 65 L26 48 Q27 42 32 42 Q37 42 38 48 L38 55
                             Q44 28 48 18 Q50 12 55 12 Q60 12 62 18 L64 40
                             Q67 14 70 10 Q72 4 77 4 Q82 4 84 10 L86 38
                             Q89 20 92 18 Q96 14 100 18 L106 35
                             Q110 30 112 34 Q116 38 115 45 L112 65
                             Q115 80 110 95 Q105 115 85 118 L60 118 Q40 118 30 95 Z"
                          fill="rgba(255,255,255,0.06)"
                          stroke="rgba(255,255,255,0.18)"
                          strokeWidth="1.5"
                        />

                        {/* Finger connection lines (decorative) */}
                        {tipPositions.map((tp) => (
                          <line
                            key={`line-${tp.key}`}
                            x1={tp.cx} y1={tp.cy}
                            x2={tp.cx} y2={tp.cy + 25}
                            stroke={af[tp.key] !== false ? '#c6ff00' : 'rgba(255,255,255,0.12)'}
                            strokeWidth="1"
                            strokeDasharray={af[tp.key] !== false ? 'none' : '3 3'}
                          />
                        ))}

                        {/* Clickable fingertip nodes */}
                        {tipPositions.map((tp) => {
                          const isOn = af[tp.key] !== false;
                          return (
                            <g
                              key={tp.key}
                              onClick={() => toggleFinger(tp.key)}
                              style={{ cursor: 'pointer' }}
                              role="button"
                              aria-label={`Toggle ${tp.label} finger`}
                              aria-pressed={isOn}
                            >
                              {/* Outer glow ring when active */}
                              {isOn && (
                                <circle
                                  cx={tp.cx} cy={tp.cy}
                                  r="12"
                                  fill="none"
                                  stroke="rgba(198,255,0,0.35)"
                                  strokeWidth="1"
                                />
                              )}
                              {/* Main circle */}
                              <circle
                                cx={tp.cx} cy={tp.cy}
                                r="9"
                                fill={isOn ? 'rgba(198,255,0,0.15)' : 'rgba(255,255,255,0.04)'}
                                stroke={isOn ? '#c6ff00' : 'rgba(255,255,255,0.22)'}
                                strokeWidth={isOn ? '2' : '1.2'}
                                strokeDasharray={isOn ? 'none' : '3 2'}
                              />
                              {/* Dot / cross indicator */}
                              {isOn ? (
                                <circle cx={tp.cx} cy={tp.cy} r="3" fill="#c6ff00" />
                              ) : (
                                <>
                                  <line x1={tp.cx - 3} y1={tp.cy} x2={tp.cx + 3} y2={tp.cy} stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
                                  <line x1={tp.cx} y1={tp.cy - 3} x2={tp.cx} y2={tp.cy + 3} stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
                                </>
                              )}
                              {/* Label below */}
                              <text
                                x={tp.cx} y={tp.cy + 22}
                                textAnchor="middle"
                                fontSize="7"
                                fill={isOn ? '#c6ff00' : 'rgba(255,255,255,0.3)'}
                                fontFamily="JetBrains Mono, monospace"
                                fontWeight={isOn ? '700' : '400'}
                              >
                                {fingerLabels[tipPositions.findIndex(t => t.key === tp.key)]}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* Preset Buttons */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[
                        { id: 'all', label: 'ALL 5' },
                        { id: 'index', label: 'POINTING' },
                        { id: 'pinch', label: 'PINCH' },
                      ].map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPreset(p.id)}
                          style={{
                            flex: 1,
                            background: 'rgba(20,22,28,0.9)',
                            border: '1.5px solid rgba(255,255,255,0.12)',
                            padding: '5px 4px',
                            color: '#cbd5e1',
                            fontSize: '9px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Skeleton & Reticle Toggles */}
                  <div className="param-group">
                    <label className="param-toggle-row">
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Show Fingertip Reticles</span>
                      <div
                        className={`toggle-switch ${params.showReticles ? 'active' : ''}`}
                        onClick={() => handleChange('showReticles', !params.showReticles)}
                      >
                        <div className="toggle-knob" />
                      </div>
                    </label>
                  </div>

                  <div className="param-group">
                    <div className="param-label">
                      <span>Portal Visual Style</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {[
                        { id: 'glass_prism',    label: 'PRISM GLASS',     desc: 'Refractive Optics' },
                        { id: 'halftone_dots',  label: 'HALFTONE MATRIX', desc: 'Pop-Art Dot Grid' },
                        { id: 'thermal_vision', label: 'THERMAL INFRARED',desc: 'Heat Signature' },
                        { id: 'cyber_grid',     label: 'CYBER SCANLINE',  desc: 'Holographic Vector' },
                        { id: 'glitch_rgb',     label: 'VHS GLITCH',      desc: 'RGB Channel Split' },
                        { id: 'void_rift',      label: 'VOID RIFT',       desc: 'Electric Arc Void' },
                        { id: 'neon_noir',      label: 'NEON NOIR',       desc: 'Neon Wireframe Trace' },
                        { id: 'pixelate',       label: 'PIXELATE',        desc: '8-Bit Mosaic' },
                        { id: 'liquid_chrome',  label: 'LIQUID CHROME',   desc: 'Iridescent Metal' },
                      ].map(st => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleChange('style', st.id)}
                          style={{
                            background: (params.style || 'glass_prism') === st.id ? 'var(--accent-sharp)' : 'rgba(20, 22, 28, 0.9)',
                            border: `1.5px solid ${(params.style || 'glass_prism') === st.id ? 'var(--accent-sharp)' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: '0px',
                            padding: '8px 10px',
                            color: (params.style || 'glass_prism') === st.id ? '#000' : '#cbd5e1',
                            fontSize: '11px',
                            fontWeight: (params.style || 'glass_prism') === st.id ? 800 : 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          <div>{st.label}</div>
                          <div style={{ fontSize: '9px', opacity: 0.8, letterSpacing: '0.02em' }}>{st.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="param-group">
                    <div className="param-label">
                      <span>Glass Portal Intensity</span>
                      <span className="val">{params.intensity?.toFixed(1) || '1.0'}x</span>
                    </div>
                    <div className="param-slider-row">
                      <input
                        type="range"
                        className="param-slider"
                        min="0.2"
                        max="3.0"
                        step="0.1"
                        value={params.intensity || 1.0}
                        onChange={(e) => handleChange('intensity', parseFloat(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="param-group">
                    <div className="param-label">
                      <span>Active Optical Engine Specs</span>
                    </div>
                    <div style={{ background: '#090a0f', padding: '10px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                      <div><span style={{ color: 'var(--accent-sharp)' }}>//</span> <strong>Prism Refractive Optics:</strong> Chromatic dispersion &amp; dynamic zoom between palms</div>
                      <div><span style={{ color: 'var(--accent-sharp)' }}>//</span> <strong>Tip-To-Tip Lasers:</strong> Straight white connectors between selected fingertips</div>
                      <div><span style={{ color: 'var(--accent-sharp)' }}>//</span> <strong>Trapped Quantum Dust:</strong> Constellation energy points tracked to hand positions</div>
                      <div><span style={{ color: 'var(--accent-sharp)' }}>//</span> <strong>Core Singularity:</strong> Gyroscopic rings at centroid between both palms</div>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* === VIDEO IN === */}
            {node.type === 'videoIn' && (
              <>
                <div className="param-group">
                  <div className="param-label">
                    <span>Source</span>
                  </div>
                  <select
                    className="select-dropdown"
                    value={params.source || 'webcam'}
                    onChange={(e) => handleChange('source', e.target.value)}
                  >
                    <option value="webcam">Live Webcam Capture</option>
                    <option value="loop">Procedural Video Loop</option>
                  </select>
                </div>

                <div className="param-group">
                  <label className="param-toggle-row">
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Horizontal Mirror</span>
                    <div
                      className={`toggle-switch ${params.mirror ? 'active' : ''}`}
                      onClick={() => handleChange('mirror', !params.mirror)}
                    >
                      <div className="toggle-knob" />
                    </div>
                  </label>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Fallback Video Loop</span>
                  </div>
                  <select
                    className="select-dropdown"
                    value={params.presetLoop || 'cyber_grid'}
                    onChange={(e) => handleChange('presetLoop', e.target.value)}
                  >
                    <option value="cyber_grid">Synthwave Cyber Grid</option>
                    <option value="particle_vortex">Swirling Particle Vortex</option>
                    <option value="liquid_waves">Liquid Plasma Waves</option>
                    <option value="geometric_kaleido">Sacred Geometry Flower</option>
                  </select>
                </div>
              </>
            )}

            {/* === MOVIE FILE IN === */}
            {node.type === 'movieFileIn' && (
              <>
                <div className="param-group">
                  <div className="param-label">
                    <span>Generative Preset Loop</span>
                  </div>
                  <select
                    className="select-dropdown"
                    value={params.preset || 'particle_vortex'}
                    onChange={(e) => handleChange('preset', e.target.value)}
                  >
                    <option value="particle_vortex">Swirling Particle Galaxy</option>
                    <option value="cyber_grid">Neon Cyber Grid</option>
                    <option value="liquid_waves">Chromatic Liquid Waves</option>
                    <option value="geometric_kaleido">Morphing Sacred Geometry</option>
                  </select>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Playback Speed</span>
                    <span className="val">{params.speed?.toFixed(1) || '1.0'}x</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="0.1"
                      max="3.0"
                      step="0.1"
                      value={params.speed || 1.0}
                      onChange={(e) => handleChange('speed', parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Load Custom Video / Image File</span>
                  </div>
                  <label className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                    <Upload size={13} />
                    <span>Upload Media File (.mp4, .png)</span>
                    <input
                      type="file"
                      accept="video/*,image/*"
                      style={{ display: 'none' }}
                      onChange={handleMediaUpload}
                    />
                  </label>
                </div>
              </>
            )}

            {/* === FEEDBACK TOP === */}
            {node.type === 'feedback' && (
              <>
                <div className="param-group">
                  <div className="param-label">
                    <span>Decay / Persistence</span>
                    <span className="val">{(params.decay * 100).toFixed(0)}%</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="0.75"
                      max="0.99"
                      step="0.01"
                      value={params.decay || 0.92}
                      onChange={(e) => handleChange('decay', parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Zoom Echo</span>
                    <span className="val">{params.zoom?.toFixed(3) || '1.020'}</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="0.90"
                      max="1.15"
                      step="0.005"
                      value={params.zoom || 1.02}
                      onChange={(e) => handleChange('zoom', parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Rotation Vortex</span>
                    <span className="val">{((params.rotate || 0) * (180 / Math.PI)).toFixed(1)}°</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="-0.08"
                      max="0.08"
                      step="0.002"
                      value={params.rotate || 0.01}
                      onChange={(e) => handleChange('rotate', parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Hue Shift</span>
                    <span className="val">{params.hueShift || 0}°</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="0"
                      max="360"
                      step="5"
                      value={params.hueShift || 0}
                      onChange={(e) => handleChange('hueShift', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Blend Mode</span>
                  </div>
                  <select
                    className="select-dropdown"
                    value={params.blendMode || 'source-over'}
                    onChange={(e) => handleChange('blendMode', e.target.value)}
                  >
                    <option value="source-over">Over / Motion Trail (Normal)</option>
                    <option value="lighter">Lighter / Add (Particles)</option>
                    <option value="screen">Screen Glow</option>
                    <option value="difference">Difference Glitch</option>
                  </select>
                </div>
              </>
            )}

            {/* === DISPLACE TOP === */}
            {node.type === 'displace' && (
              <>
                <div className="param-group">
                  <div className="param-label">
                    <span>Weight X</span>
                    <span className="val">{params.weightX || 25}</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="-80"
                      max="80"
                      step="1"
                      value={params.weightX || 25}
                      onChange={(e) => handleChange('weightX', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Weight Y</span>
                    <span className="val">{params.weightY || 25}</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="-80"
                      max="80"
                      step="1"
                      value={params.weightY || 25}
                      onChange={(e) => handleChange('weightY', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </>
            )}

            {/* === KALEIDOSCOPE TOP === */}
            {node.type === 'kaleidoscope' && (
              <>
                <div className="param-group">
                  <div className="param-label">
                    <span>Segments</span>
                    <span className="val">{params.segments || 8}</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="2"
                      max="24"
                      step="2"
                      value={params.segments || 8}
                      onChange={(e) => handleChange('segments', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Rotation</span>
                    <span className="val">{params.rotation || 0}°</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="0"
                      max="360"
                      step="5"
                      value={params.rotation || 0}
                      onChange={(e) => handleChange('rotation', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Zoom</span>
                    <span className="val">{params.zoom?.toFixed(2) || '1.00'}</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="0.5"
                      max="2.5"
                      step="0.05"
                      value={params.zoom || 1.0}
                      onChange={(e) => handleChange('zoom', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </>
            )}

            {/* === CHROMATIC ABERRATION === */}
            {node.type === 'chromatic' && (
              <>
                <div className="param-group">
                  <div className="param-label">
                    <span>Offset Distance</span>
                    <span className="val">{params.offset || 14} px</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="0"
                      max="50"
                      step="1"
                      value={params.offset || 14}
                      onChange={(e) => handleChange('offset', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Angle</span>
                    <span className="val">{params.angle || 45}°</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="0"
                      max="360"
                      step="5"
                      value={params.angle || 45}
                      onChange={(e) => handleChange('angle', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </>
            )}

            {/* === BLOOM / GLOW === */}
            {node.type === 'bloom' && (
              <>
                <div className="param-group">
                  <div className="param-label">
                    <span>Intensity</span>
                    <span className="val">{params.intensity?.toFixed(1) || '1.8'}</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="0.2"
                      max="4.0"
                      step="0.1"
                      value={params.intensity || 1.8}
                      onChange={(e) => handleChange('intensity', parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Blur Radius</span>
                    <span className="val">{params.blur || 16} px</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="4"
                      max="40"
                      step="2"
                      value={params.blur || 16}
                      onChange={(e) => handleChange('blur', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </>
            )}

            {/* === LEVEL TOP === */}
            {node.type === 'level' && (
              <>
                <div className="param-group">
                  <div className="param-label">
                    <span>Brightness</span>
                    <span className="val">{params.brightness?.toFixed(2) || '1.00'}</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="0.2"
                      max="2.5"
                      step="0.05"
                      value={params.brightness || 1.0}
                      onChange={(e) => handleChange('brightness', parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <div className="param-label">
                    <span>Contrast</span>
                    <span className="val">{params.contrast?.toFixed(2) || '1.00'}</span>
                  </div>
                  <div className="param-slider-row">
                    <input
                      type="range"
                      className="param-slider"
                      min="0.2"
                      max="2.5"
                      step="0.05"
                      value={params.contrast || 1.0}
                      onChange={(e) => handleChange('contrast', parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="param-group">
                  <label className="param-toggle-row">
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Invert Colors</span>
                    <div
                      className={`toggle-switch ${params.invert ? 'active' : ''}`}
                      onClick={() => handleChange('invert', !params.invert)}
                    >
                      <div className="toggle-knob" />
                    </div>
                  </label>
                </div>
              </>
            )}
          </>
        )}

        {/* === GLSL CODE EDITOR TAB === */}
        {activeTab === 'shader' && node.type === 'glsl' && (
          <div className="param-group">
            <div className="param-label">
              <span>Preset Shader</span>
            </div>
            <select
              className="select-dropdown"
              value={params.shaderPreset || 'raymarch_tunnel'}
              onChange={(e) => {
                const key = e.target.value;
                handleChange('shaderPreset', key);
                handleChange('code', DEFAULT_GLSL_SHADERS[key]?.code);
              }}
            >
              <option value="raymarch_tunnel">Raymarch Neon Tunnel</option>
              <option value="liquid_chrome">Liquid Chromatic Flow</option>
              <option value="vhs_glitch">Retro VHS Synth Glitch</option>
            </select>

            <div className="param-label" style={{ marginTop: '12px' }}>
              <span>GLSL Fragment Shader Code (Live)</span>
            </div>
            <textarea
              className="glsl-editor-textarea"
              value={params.code || DEFAULT_GLSL_SHADERS.raymarch_tunnel.code}
              onChange={(e) => handleChange('code', e.target.value)}
              spellCheck="false"
            />
            <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
              Uniforms: <code>u_time</code>, <code>u_resolution</code>, <code>u_texture0</code>, <code>u_bass</code>, <code>u_beat</code>
            </span>
          </div>
        )}

        {/* === COMMON TAB === */}
        {activeTab === 'common' && (
          <>
            <div className="param-group">
              <div className="param-label">
                <span>Node Name</span>
              </div>
              <input
                type="text"
                className="param-input-text"
                value={node.name}
                onChange={(e) => {
                  node.name = e.target.value;
                  onUpdateParams(node.id, {});
                }}
              />
            </div>

            <div className="param-group">
              <div className="param-label">
                <span>Operator Category</span>
              </div>
              <span style={{ color: cat.color, fontWeight: 600 }}>
                {cat.label}
              </span>
            </div>

            <div className="param-group">
              <div className="param-label">
                <span>Execution Time</span>
                <span className="val">{node.status.ms} ms</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
