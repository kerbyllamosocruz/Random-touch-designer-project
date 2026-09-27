import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Video, Square, Maximize2, Download } from 'lucide-react';

export function OutModal({ isOpen, onClose, outCanvas }) {
  const displayCanvasRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // Copy loop
  useEffect(() => {
    if (!isOpen || !displayCanvasRef.current || !outCanvas) return;

    let animId;
    const dest = displayCanvasRef.current;
    const ctx = dest.getContext('2d');

    const render = () => {
      if (dest.width !== outCanvas.width || dest.height !== outCanvas.height) {
        dest.width = outCanvas.width;
        dest.height = outCanvas.height;
      }
      ctx.drawImage(outCanvas, 0, 0);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, outCanvas]);

  // Snapshot PNG
  const handleSnapshot = () => {
    if (!outCanvas) return;
    const url = outCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `touchdesigner_snapshot_${Date.now()}.png`;
    a.click();
  };

  // Video Recording
  const handleStartRecord = () => {
    if (!displayCanvasRef.current) return;
    try {
      const stream = displayCanvasRef.current.captureStream(60);
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `touchdesigner_capture_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
        setRecordSeconds(0);
        clearInterval(timerIntervalRef.current);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (e) {
      alert(`MediaRecorder error: ${e.message}`);
    }
  };

  const handleStopRecord = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  // Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      displayCanvasRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="out-modal-backdrop" onClick={onClose}>
      <div className="out-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="out-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Master Render Output (Live)</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>
              1280x720 · 60fps
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-outline" onClick={handleToggleFullscreen} title="Fullscreen (F)">
              <Maximize2 size={13} />
            </button>
            <button className="btn btn-outline" onClick={onClose} title="Close (ESC)">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="out-modal-canvas-wrap">
          <canvas ref={displayCanvasRef} className="out-modal-canvas" />
        </div>

        {/* Footer Actions */}
        <div className="out-modal-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button id="btn-out-snapshot" className="btn btn-secondary" onClick={handleSnapshot} title="Capture PNG Snapshot">
              <Camera size={13} />
              <span>Snapshot (PNG)</span>
            </button>

            {!isRecording ? (
              <button id="btn-out-start-record" className="btn btn-primary" onClick={handleStartRecord} title="Record WebM Video">
                <Video size={13} />
                <span>Record Video</span>
              </button>
            ) : (
              <button id="btn-out-stop-record" className="btn btn-outline" style={{ background: '#ef4444', color: '#fff' }} onClick={handleStopRecord}>
                <Square size={13} fill="#fff" />
                <span>Stop Rec ({recordSeconds}s)</span>
              </button>
            )}
          </div>

          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>
            Real-time WebGL & ONNX Inference
          </span>
        </div>
      </div>
    </div>
  );
}
