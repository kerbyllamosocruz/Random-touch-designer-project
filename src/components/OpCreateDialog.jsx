import React, { useState, useEffect, useRef } from 'react';
import { OPERATOR_DEFINITIONS, NODE_CATEGORIES } from '../engine/nodes/NodeDefinitions.js';
import { Search, X } from 'lucide-react';

export function OpCreateDialog({ isOpen, onClose, onAddOperator }) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handle ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const operators = Object.values(OPERATOR_DEFINITIONS).filter((op) => {
    const matchesCat = selectedCategory === 'ALL' || op.category === selectedCategory;
    const matchesSearch =
      op.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="op-modal-backdrop" onClick={onClose}>
      <div className="op-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header & Filter */}
        <div className="op-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.2px' }}>
              OP Create Dialog
            </span>
            <button
              className="btn btn-outline"
              style={{ padding: '4px 8px' }}
              onClick={onClose}
              title="Close (ESC)"
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              id="op-search-input"
              type="text"
              className="op-search-input"
              placeholder="Search operators (e.g. onnx, feedback, glsl, audio, displace)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search
              size={15}
              style={{ position: 'absolute', right: '12px', top: '10px', color: 'var(--text-dim)' }}
            />
          </div>

          {/* Category Tabs */}
          <div className="op-category-tabs">
            <button
              className={`op-cat-tab ${selectedCategory === 'ALL' ? 'active' : ''}`}
              style={{ backgroundColor: selectedCategory === 'ALL' ? 'var(--bg-elevated)' : undefined }}
              onClick={() => setSelectedCategory('ALL')}
            >
              ALL
            </button>
            {Object.values(NODE_CATEGORIES).map((cat) => (
              <button
                key={cat.id}
                className={`op-cat-tab ${selectedCategory === cat.id ? 'active' : ''}`}
                style={{
                  borderColor: selectedCategory === cat.id ? cat.color : undefined,
                  backgroundColor: selectedCategory === cat.id ? `${cat.color}25` : undefined,
                  color: selectedCategory === cat.id ? cat.color : undefined
                }}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.badge} {cat.id}
              </button>
            ))}
          </div>
        </div>

        {/* Operators Grid */}
        <div className="op-modal-grid">
          {operators.map((op) => {
            const cat = NODE_CATEGORIES[op.category] || NODE_CATEGORIES.TOP;
            return (
              <div
                key={op.type}
                id={`op-select-${op.type}`}
                className="op-card"
                onClick={() => {
                  onAddOperator(op.type);
                  onClose();
                }}
              >
                <div className="op-card-header">
                  <span className="op-card-title">{op.label}</span>
                  <span
                    className="op-category-tag"
                    style={{ backgroundColor: cat.color }}
                  >
                    {cat.id}
                  </span>
                </div>
                <span className="op-card-desc">
                  {op.type === 'onnxModel' && 'In-browser neural inference (Selfie Segmentation, SqueezeNet, Sobel Edge, or custom .onnx).'}
                  {op.type === 'videoIn' && 'Real-time webcam video feed or high-framerate procedural loops.'}
                  {op.type === 'movieFileIn' && 'Video player with playback speed, loop and file loader.'}
                  {op.type === 'feedback' && 'Signature feedback loop for infinite trailing and vortex visual synthesis.'}
                  {op.type === 'displace' && 'Texture coordinate displacement mapping using secondary map texture.'}
                  {op.type === 'chromatic' && 'Chromatic aberration RGB optical split with distance & angle.'}
                  {op.type === 'bloom' && 'High-pass threshold glow with adjustable radius and boost.'}
                  {op.type === 'kaleidoscope' && 'Radial mirror symmetry kaleidoscope generator.'}
                  {op.type === 'level' && 'Brightness, contrast, gamma, invert, and opacity adjustments.'}
                  {op.type === 'composite' && 'Multi-layer texture blending (Over, Add, Screen, Difference).'}
                  {op.type === 'noise' && 'Animated procedural Simplex/Perlin trigonometric noise.'}
                  {op.type === 'transform' && 'Spatial transform: 2D scale, rotation, and translation.'}
                  {op.type === 'glsl' && 'Custom live GLSL fragment shader editor with WebGL compilation.'}
                  {op.type === 'audioIn' && 'Live microphone audio capture or electronic synth generator.'}
                  {op.type === 'audioAnalysis' && 'Real-time FFT audio spectrum analyzer (bass, mid, treble, beat).'}
                  {op.type === 'lfo' && 'Low-frequency oscillator generating sine/triangle/square waves.'}
                  {op.type === 'math' && 'Numeric channel transformation (multiplier, offset, range remap).'}
                  {op.type === 'outWindow' && 'Final master render window, high-res snapshot, and WebM video recorder.'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
