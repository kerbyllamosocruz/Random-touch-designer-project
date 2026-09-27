import React, { useState, useRef, useEffect } from 'react';
import { NodeTile } from './NodeTile.jsx';
import { NODE_CATEGORIES } from '../engine/nodes/NodeDefinitions.js';

export function NodeCanvas({
  graphEngine,
  selectedNodeId,
  onSelectNode,
  onOpenOpModal,
  nodes,
  connections,
  nodeCanvases,
  nodeChannels
}) {
  const wrapperRef = useRef(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Node dragging state
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Cable connecting state
  const [connecting, setConnecting] = useState(null); // { fromNode, fromPin, mouseX, mouseY }

  // Canvas Pan (drag background)
  const handleMouseDownCanvas = (e) => {
    // Only pan if clicking canvas background directly
    if (e.target.classList.contains('canvas-wrapper') || e.target.classList.contains('canvas-pan-zoom') || e.target.tagName === 'svg') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      onSelectNode(null);
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
    } else if (draggingNodeId) {
      const node = graphEngine.getNode(draggingNodeId);
      if (node) {
        const newX = Math.round((e.clientX - pan.x) / zoom - dragOffsetRef.current.x);
        const newY = Math.round((e.clientY - pan.y) / zoom - dragOffsetRef.current.y);
        node.position = { x: newX, y: newY };
        graphEngine.notify();
      }
    } else if (connecting) {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = (e.clientX - rect.left - pan.x) / zoom;
        const my = (e.clientY - rect.top - pan.y) / zoom;
        setConnecting(prev => prev ? { ...prev, mouseX: mx, mouseY: my } : null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    if (connecting) {
      setConnecting(null);
    }
  };

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(2.0, Math.max(0.4, zoom * zoomFactor));

    // Zoom towards cursor
    const rect = wrapperRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Node Dragging Start
  const handleDragStartNode = (e, nodeId) => {
    const node = graphEngine.getNode(nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    dragOffsetRef.current = {
      x: (e.clientX - pan.x) / zoom - node.position.x,
      y: (e.clientY - pan.y) / zoom - node.position.y
    };
  };

  // Start Cable Connection
  const handleStartConnect = (e, nodeId, pinId) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;
    setConnecting({ fromNode: nodeId, fromPin: pinId, mouseX: mx, mouseY: my });
  };

  // End Cable Connection
  const handleEndConnect = (toNodeId, toPinId) => {
    if (connecting) {
      graphEngine.connect(connecting.fromNode, connecting.fromPin, toNodeId, toPinId);
      setConnecting(null);
    }
  };

  // Double click canvas to add node
  const handleDoubleClickCanvas = (e) => {
    if (e.target.classList.contains('canvas-wrapper') || e.target.classList.contains('canvas-pan-zoom')) {
      onOpenOpModal();
    }
  };

  // Pin coordinates calculation helper
  const getNodeOutputPinPos = (nodeId, pinId) => {
    const node = graphEngine.getNode(nodeId);
    if (!node) return { x: 0, y: 0 };
    const pinIdx = node.outputs.findIndex(p => p.id === pinId);
    const numPins = node.outputs.length;
    const yStep = 124 / (numPins + 1);
    return {
      x: node.position.x + 220,
      y: node.position.y + 28 + (pinIdx + 1) * yStep
    };
  };

  const getNodeInputPinPos = (nodeId, pinId) => {
    const node = graphEngine.getNode(nodeId);
    if (!node) return { x: 0, y: 0 };
    const pinIdx = node.inputs.findIndex(p => p.id === pinId);
    const numPins = node.inputs.length;
    const yStep = 124 / (numPins + 1);
    return {
      x: node.position.x,
      y: node.position.y + 28 + (pinIdx + 1) * yStep
    };
  };

  return (
    <div
      ref={wrapperRef}
      className="canvas-wrapper"
      id="node-canvas-wrapper"
      onMouseDown={handleMouseDownCanvas}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClickCanvas}
    >
      <div
        className="canvas-pan-zoom"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        {/* SVG Cable Routing Layer */}
        <svg className="cables-svg">
          <defs>
            <linearGradient id="grad-top" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="grad-ai" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <linearGradient id="grad-chop" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          {/* Render Connections */}
          {connections.map((conn) => {
            const p1 = getNodeOutputPinPos(conn.fromNode, conn.fromPin);
            const p2 = getNodeInputPinPos(conn.toNode, conn.toPin);
            const dx = Math.abs(p2.x - p1.x) * 0.5 + 40;
            const pathD = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;

            const fromNode = graphEngine.getNode(conn.fromNode);
            const strokeColor =
              fromNode?.category === 'AI' ? 'url(#grad-ai)' :
              fromNode?.category === 'CHOP' ? 'url(#grad-chop)' : 'url(#grad-top)';

            return (
              <g key={conn.id} onClick={() => graphEngine.disconnect(conn.toNode, conn.toPin)} title="Click to disconnect">
                {/* Glow backdrop path */}
                <path d={pathD} stroke="rgba(0,0,0,0.5)" strokeWidth="6" fill="none" />
                {/* Active connection path */}
                <path d={pathD} stroke={strokeColor} className="cable-path" />
                {/* Animated data flow dots */}
                <path
                  d={pathD}
                  stroke="rgba(255, 255, 255, 0.7)"
                  strokeWidth="2"
                  strokeDasharray="4 16"
                  className="cable-pulse"
                  fill="none"
                />
              </g>
            );
          })}

          {/* Active Dragging Connection Line */}
          {connecting && (() => {
            const p1 = getNodeOutputPinPos(connecting.fromNode, connecting.fromPin);
            const p2 = { x: connecting.mouseX, y: connecting.mouseY };
            const dx = Math.abs(p2.x - p1.x) * 0.5 + 40;
            const pathD = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
            return (
              <path
                d={pathD}
                stroke="#38bdf8"
                strokeWidth="3"
                strokeDasharray="6 6"
                fill="none"
                filter="drop-shadow(0 0 8px #38bdf8)"
              />
            );
          })()}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => (
          <NodeTile
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onSelect={onSelectNode}
            onStartConnect={handleStartConnect}
            onEndConnect={handleEndConnect}
            onDelete={(id) => graphEngine.removeNode(id)}
            onToggleBypass={(id) => {
              const n = graphEngine.getNode(id);
              if (n) {
                n.bypassed = !n.bypassed;
                graphEngine.notify();
              }
            }}
            onToggleLock={(id) => {
              const n = graphEngine.getNode(id);
              if (n) {
                n.locked = !n.locked;
                graphEngine.notify();
              }
            }}
            onDragStart={handleDragStartNode}
            canvasSource={nodeCanvases.get(node.id)}
            channelData={nodeChannels.get(node.id)}
          />
        ))}
      </div>

      {/* Mini-Map */}
      <div className="canvas-minimap" id="canvas-minimap">
        <svg width="100%" height="100%" viewBox="0 0 1600 1000">
          {nodes.map(n => {
            const cat = NODE_CATEGORIES[n.category] || NODE_CATEGORIES.TOP;
            return (
              <rect
                key={n.id}
                x={n.position.x}
                y={n.position.y}
                width={220}
                height={160}
                rx={12}
                fill={cat.color}
                opacity={0.8}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
