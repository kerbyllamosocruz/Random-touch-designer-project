import React, { useRef, useEffect, useState } from 'react';
import { Maximize2, ChevronDown, ChevronUp } from 'lucide-react';

export function LiveHeroMonitor({ outputCanvas, nodeName = 'handActionFX', onMaximize }) {
  const canvasRef = useRef(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !outputCanvas || isCollapsed) return;

    let animId;
    const dest = canvasRef.current;
    const ctx = dest.getContext('2d');

    const render = () => {
      if (dest.width !== outputCanvas.width || dest.height !== outputCanvas.height) {
        dest.width = outputCanvas.width;
        dest.height = outputCanvas.height;
      }
      ctx.drawImage(outputCanvas, 0, 0);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [outputCanvas, isCollapsed]);

  if (!outputCanvas) return null;

  return (
    <div className={`live-hero-monitor ${isCollapsed ? 'collapsed' : ''}`} id="live-hero-monitor">
      <div className="hero-monitor-header">
        <div className="hero-monitor-title">
          <span className="hero-live-dot" />
          <span className="hero-tag">FINAL OUTPUT</span>
          <span className="hero-node-name">[{nodeName}]</span>
        </div>
        <div className="hero-monitor-actions">
          <button
            className="hero-action-btn"
            onClick={onMaximize}
            title="Maximize Viewport (O)"
          >
            <Maximize2 size={12} />
          </button>
          <button
            className="hero-action-btn"
            onClick={() => setIsCollapsed(prev => !prev)}
            title={isCollapsed ? 'Expand Live Viewport' : 'Minimize Live Viewport'}
          >
            {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="hero-monitor-screen" onClick={onMaximize} title="Click to expand fullscreen (O)">
          <canvas ref={canvasRef} className="hero-canvas" />
          <div className="hero-screen-scrim">
            <span className="hero-expand-hint">[FULLSCREEN // EXPAND]</span>
          </div>
        </div>
      )}
    </div>
  );
}
