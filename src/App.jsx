import React, { useState, useEffect } from 'react';
import { graphEngine } from './engine/graph/GraphEngine.js';
import { mediaService } from './engine/video/MediaService.js';
import { onnxService } from './engine/onnx/OnnxRuntimeService.js';
import { Header } from './components/Header.jsx';
import { NodeCanvas } from './components/NodeCanvas.jsx';
import { ParametersPane } from './components/ParametersPane.jsx';
import { TimelineBar } from './components/TimelineBar.jsx';
import { OpCreateDialog } from './components/OpCreateDialog.jsx';
import { OutModal } from './components/OutModal.jsx';
import { LiveHeroMonitor } from './components/LiveHeroMonitor.jsx';

export default function App() {
  const [engineState, setEngineState] = useState({
    nodes: [],
    connections: [],
    frame: 0,
    fps: 60,
    isPlaying: true
  });

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isParamsOpen, setIsParamsOpen] = useState(true);
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [isOutModalOpen, setIsOutModalOpen] = useState(false);
  const [activePreset, setActivePreset] = useState('hand_gesture_studio');
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [provider, setProvider] = useState('wasm');

  // Initialize engine and load default preset on mount
  useEffect(() => {
    const unsubscribe = graphEngine.subscribe((engine) => {
      setEngineState({
        nodes: Array.from(engine.nodes.values()),
        connections: [...engine.connections],
        frame: engine.frame,
        fps: engine.fps,
        isPlaying: engine.isPlaying
      });
    });

    graphEngine.loadPreset('hand_gesture_studio');
    graphEngine.startLoop();

    return () => {
      unsubscribe();
      graphEngine.stopLoop();
      mediaService.stopWebcam();
    };
  }, []);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in text inputs or textareas
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        setIsOpModalOpen((prev) => !prev);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setIsParamsOpen((prev) => !prev);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        graphEngine.isPlaying = !graphEngine.isPlaying;
        setEngineState((prev) => ({ ...prev, isPlaying: graphEngine.isPlaying }));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          graphEngine.removeNode(selectedNodeId);
          setSelectedNodeId(null);
        }
      } else if (e.key === 'o' || e.key === 'O') {
        setIsOutModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId]);

  // Handle Preset selection
  const handleSelectPreset = (presetId) => {
    setActivePreset(presetId);
    graphEngine.loadPreset(presetId);
    setSelectedNodeId(null);
  };

  // Toggle Webcam
  const handleToggleWebcam = async () => {
    if (isWebcamActive) {
      mediaService.stopWebcam();
      setIsWebcamActive(false);
    } else {
      const ok = await mediaService.startWebcam();
      setIsWebcamActive(ok);
    }
  };

  // Handle Provider Change
  const handleChangeProvider = (newProvider) => {
    setProvider(newProvider);
    onnxService.setExecutionProvider(newProvider);
  };

  const selectedNode = selectedNodeId ? graphEngine.getNode(selectedNodeId) : null;
  const outputNode = engineState.nodes.find((n) => n.type === 'handActionFX') || engineState.nodes.find((n) => n.type === 'outWindow');
  const masterOutCanvas = outputNode ? graphEngine.nodeCanvases.get(outputNode.id) : null;

  return (
    <div className="app-container" id="touch-designer-app">
      {/* Top Header Bar */}
      <Header
        graphEngine={graphEngine}
        onOpenOpModal={() => setIsOpModalOpen(true)}
        onToggleParams={() => setIsParamsOpen((prev) => !prev)}
        isParamsOpen={isParamsOpen}
        onOpenOutModal={() => setIsOutModalOpen(true)}
        fps={engineState.fps}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
        isWebcamActive={isWebcamActive}
        onToggleWebcam={handleToggleWebcam}
      />

      {/* Main Node Graph Workspace & Parameters Inspector */}
      <div className="workspace-container">
        <NodeCanvas
          graphEngine={graphEngine}
          selectedNodeId={selectedNodeId}
          onSelectNode={(id) => {
            setSelectedNodeId(id);
            if (id && !isParamsOpen) setIsParamsOpen(true);
          }}
          onOpenOpModal={() => setIsOpModalOpen(true)}
          nodes={engineState.nodes}
          connections={engineState.connections}
          nodeCanvases={graphEngine.nodeCanvases}
          nodeChannels={graphEngine.nodeChannels}
        />

        {/* Live Hero Viewport Monitor for handActionFX Master Output */}
        <LiveHeroMonitor
          outputCanvas={masterOutCanvas}
          nodeName={outputNode?.name || 'handActionFX'}
          onMaximize={() => setIsOutModalOpen(true)}
        />

        {isParamsOpen && (
          <ParametersPane
            node={selectedNode}
            onClose={() => setIsParamsOpen(false)}
            onUpdateParams={(nodeId, params) => graphEngine.updateNodeParams(nodeId, params)}
            channelData={selectedNode ? graphEngine.nodeChannels.get(selectedNode.id) : null}
          />
        )}
      </div>

      {/* Bottom Transport / Timeline Bar */}
      <TimelineBar
        isPlaying={engineState.isPlaying}
        onTogglePlay={() => {
          graphEngine.isPlaying = !graphEngine.isPlaying;
          setEngineState((prev) => ({ ...prev, isPlaying: graphEngine.isPlaying }));
        }}
        frame={engineState.frame}
        totalFrames={600}
        onSeek={(f) => {
          graphEngine.frame = f;
          setEngineState((prev) => ({ ...prev, frame: f }));
        }}
        provider={provider}
        onChangeProvider={handleChangeProvider}
      />

      {/* OP Create Dialog Modal (TAB) */}
      <OpCreateDialog
        isOpen={isOpModalOpen}
        onClose={() => setIsOpModalOpen(false)}
        onAddOperator={(type) => {
          const node = graphEngine.createNode(type, { x: 300, y: 200 });
          if (node) {
            setSelectedNodeId(node.id);
            setIsParamsOpen(true);
          }
        }}
      />

      {/* Master Live Out Modal */}
      <OutModal
        isOpen={isOutModalOpen}
        onClose={() => setIsOutModalOpen(false)}
        outCanvas={masterOutCanvas}
      />
    </div>
  );
}
