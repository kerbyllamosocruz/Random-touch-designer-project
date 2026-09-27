import React, { useRef, useEffect } from 'react';
import { NODE_CATEGORIES } from '../engine/nodes/NodeDefinitions.js';
import { X, Lock, SlidersHorizontal, EyeOff } from 'lucide-react';

export function NodeTile({
  node,
  isSelected,
  onSelect,
  onStartConnect,
  onEndConnect,
  onDelete,
  onToggleBypass,
  onToggleLock,
  onDragStart,
  canvasSource,
  channelData
}) {
  const previewCanvasRef = useRef(null);
  const cat = NODE_CATEGORIES[node.category] || NODE_CATEGORIES.TOP;

  // Real-time canvas copy loop for TOP, AI, and OUT nodes
  useEffect(() => {
    if (!previewCanvasRef.current || !canvasSource) return;

    let animId;
    const destCanvas = previewCanvasRef.current;
    const ctx = destCanvas.getContext('2d');

    const renderPreview = () => {
      if (destCanvas.width !== canvasSource.width || destCanvas.height !== canvasSource.height) {
        destCanvas.width = canvasSource.width;
        destCanvas.height = canvasSource.height;
      }
      ctx.drawImage(canvasSource, 0, 0);
      animId = requestAnimationFrame(renderPreview);
    };

    animId = requestAnimationFrame(renderPreview);
    return () => cancelAnimationFrame(animId);
  }, [canvasSource]);

  const handleMouseDownHeader = (e) => {
    if (e.target.closest('.node-action-btn')) return;
    e.stopPropagation();
    onSelect(node.id);
    onDragStart(e, node.id);
  };

  return (
    <div
      id={`node-${node.id}`}
      className={`node-tile ${isSelected ? 'selected' : ''} ${node.bypassed ? 'bypassed' : ''}`}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        borderColor: isSelected ? cat.color : undefined
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
    >
      {/* Node Header */}
      <div
        className="node-header"
        onMouseDown={handleMouseDownHeader}
        style={{ borderTop: `2px solid ${cat.color}` }}
      >
        <div className="node-header-left">
          <span className="op-category-tag" style={{ backgroundColor: cat.color }}>
            {cat.id}
          </span>
          <span className="node-title" title={node.name}>
            {node.name}
          </span>
        </div>

        <div className="node-header-actions">
          {/* Bypass (B) */}
          <button
            className={`node-action-btn ${node.bypassed ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleBypass(node.id);
            }}
            title="Bypass Operator (B)"
          >
            <EyeOff size={10} />
          </button>

          {/* Lock (L) */}
          <button
            className={`node-action-btn ${node.locked ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock(node.id);
            }}
            title="Lock Current Frame (L)"
          >
            <Lock size={10} />
          </button>

          {/* Delete */}
          <button
            className="node-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            title="Delete Node"
          >
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Node Body / Live View */}
      <div className="node-body">
        {node.category === 'CHOP' ? (
          // CHOP waveform / visualizer
          <div className="chop-visualizer">
            {channelData?.waveform ? (
              <div className="chop-bars">
                {Array.from(channelData.waveform.slice(0, 24)).map((v, i) => (
                  <div
                    key={i}
                    className="chop-bar"
                    style={{ height: `${Math.max(4, (v / 255) * 55)}px` }}
                  />
                ))}
              </div>
            ) : (
              <div className="chop-bars">
                {[40, 25, 60, 80, 50, 30, 70, 90, 45, 65, 35, 55].map((v, i) => (
                  <div
                    key={i}
                    className="chop-bar"
                    style={{
                      height: `${(v * (channelData?.bass || channelData?.val || 0.6))}px`
                    }}
                  />
                ))}
              </div>
            )}
            <div className="chop-numeric-readout">
              {channelData?.beat > 0.5 ? '💥 BEAT' : `VAL: ${(channelData?.val || channelData?.energy || 0).toFixed(2)}`}
            </div>
          </div>
        ) : (
          // Live Video / Canvas
          <>
            <canvas ref={previewCanvasRef} className="node-preview-canvas" />
            <div className="node-preview-overlay">
              {node.type === 'mediaPipeHand'
                ? `${node.status.ms}ms MP`
                : node.type === 'onnxModel'
                ? `${node.status.ms}ms AI`
                : 'LIVE'}
            </div>
          </>
        )}
      </div>

      {/* Input Pins (Left) */}
      <div className="node-pins-left">
        {node.inputs.map((pin) => (
          <div
            key={pin.id}
            id={`pin-in-${node.id}-${pin.id}`}
            className="pin pin-in"
            style={{ color: cat.color }}
            onMouseUp={(e) => {
              e.stopPropagation();
              onEndConnect(node.id, pin.id);
            }}
            title={`Input: ${pin.label}`}
          >
            <div className="pin-tooltip">{pin.label}</div>
          </div>
        ))}
      </div>

      {/* Output Pins (Right) */}
      <div className="node-pins-right">
        {node.outputs.map((pin) => (
          <div
            key={pin.id}
            id={`pin-out-${node.id}-${pin.id}`}
            className="pin pin-out"
            style={{ color: cat.color }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartConnect(e, node.id, pin.id);
            }}
            title={`Output: ${pin.label}`}
          >
            <div className="pin-tooltip">{pin.label}</div>
          </div>
        ))}
      </div>

      {/* Node Footer */}
      <div className="node-footer">
        <span>{node.category === 'CHOP' ? 'FLOAT32' : 'RGBA8'}</span>
        <span>{node.type === 'onnxModel' ? `${node.params.modelId}` : `${node.status.ms} ms`}</span>
      </div>
    </div>
  );
}
