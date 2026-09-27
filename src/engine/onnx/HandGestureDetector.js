/**
 * Hand Gesture & Finger Movement Detector for ONNX Runtime
 * Parses 21 3D hand landmarks and classifies hand/finger actions
 */

export const FINGER_NAMES = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

export const GESTURE_DEFINITIONS = {
  open_palm: {
    id: 'open_palm',
    name: 'Open Palm',
    icon: '✋',
    description: 'All 5 fingers open',
    effectName: 'SUPERNOVA EXPANSION',
    color: '#38bdf8'
  },
  fist: {
    id: 'fist',
    name: 'Closed Fist',
    icon: '✊',
    description: 'All fingers curled tight',
    effectName: 'GRAVITATIONAL VORTEX',
    color: '#f43f5e'
  },
  pointing: {
    id: 'pointing',
    name: 'Index Pointing',
    icon: '☝️',
    description: 'Index finger extended',
    effectName: 'NEON LASER POINTER',
    color: '#a855f7'
  },
  peace: {
    id: 'peace',
    name: 'Peace / Victory',
    icon: '✌️',
    description: 'Index & Middle extended',
    effectName: 'DUAL KALEIDOSCOPE',
    color: '#10b981'
  },
  pinch: {
    id: 'pinch',
    name: 'Finger Pinch',
    icon: '🤏',
    description: 'Thumb & Index touching',
    effectName: 'DYNAMIC PINCH ZOOM',
    color: '#f59e0b'
  },
  rock: {
    id: 'rock',
    name: 'Rock / Horns',
    icon: '🤘',
    description: 'Index & Pinky extended',
    effectName: 'ELECTRIC GLITCH',
    color: '#ec4899'
  },
  thumbs_up: {
    id: 'thumbs_up',
    name: 'Thumbs Up',
    icon: '👍',
    description: 'Thumb extended upwards',
    effectName: 'SPECTRUM INVERSION',
    color: '#eab308'
  },
  none: {
    id: 'none',
    name: 'No Hand Detected',
    icon: '👋',
    description: 'Wave hand in front of camera',
    effectName: 'AWAITING HAND MOVEMENT',
    color: '#64748b'
  }
};

// Skeleton bone connections
export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm Base
  [5, 9], [9, 13], [13, 17]
];

export class HandGestureDetector {
  constructor() {
    this.prevWrist = null;
    this.prevTime = performance.now();
    this.particles = [];
    this.trailPoints = [];
    this.rippleRadius = 0;
  }

  /**
   * Parses 63 floats into 21 {x, y, z} keypoints normalized [0, 1]
   * and enforces strict anatomical constraints to prevent false head/face snapping
   */
  parseLandmarks(rawValues) {
    if (!rawValues || rawValues.length < 63) return null;
    const landmarks = [];
    for (let i = 0; i < 21; i++) {
      const idx = i * 3;
      landmarks.push({
        x: Math.min(1.0, Math.max(0.0, rawValues[idx] / 224)),
        y: Math.min(1.0, Math.max(0.0, rawValues[idx + 1] / 224)),
        z: rawValues[idx + 2] / 224
      });
    }
    return this.cleanLandmarks(landmarks);
  }

  /**
   * Enforces human hand anatomical proportions:
   * Rejects fingers that unnaturally stretch towards head, face, or background.
   */
  /**
   * Enforces human hand anatomical proportions:
   * Rejects fingers or joints that unnaturally stretch towards head, face, or background.
   */
  cleanLandmarks(landmarks) {
    if (!landmarks || landmarks.length < 21) return landmarks;

    const wrist = landmarks[0];
    const indexMcp = landmarks[5];
    const middleMcp = landmarks[9];
    const ringMcp = landmarks[13];
    const pinkyMcp = landmarks[17];

    const palmWidth = this.dist(indexMcp, pinkyMcp);
    const palmLength = this.dist(wrist, middleMcp);
    const palmScale = Math.max(0.06, Math.max(palmWidth, palmLength));

    // 1. Clamp MCP knuckles relative to wrist
    [5, 9, 13, 17].forEach(mcpIdx => {
      const d = this.dist(landmarks[mcpIdx], wrist);
      const maxMcp = palmScale * 1.25;
      if (d > maxMcp && d > 0.001) {
        const s = maxMcp / d;
        landmarks[mcpIdx].x = wrist.x + (landmarks[mcpIdx].x - wrist.x) * s;
        landmarks[mcpIdx].y = wrist.y + (landmarks[mcpIdx].y - wrist.y) * s;
      }
    });

    // 2. Strict Thumb distance clamping relative to wrist and index base
    // A thumb tip can NEVER be farther from wrist than middle fingertip (max ~1.15 * palmScale)
    const maxThumbDist = palmScale * 1.15;
    const thumbDist = this.dist(landmarks[4], wrist);
    if (thumbDist > maxThumbDist && thumbDist > 0.001) {
      const s = maxThumbDist / thumbDist;
      [1, 2, 3, 4].forEach(idx => {
        landmarks[idx].x = wrist.x + (landmarks[idx].x - wrist.x) * s;
        landmarks[idx].y = wrist.y + (landmarks[idx].y - wrist.y) * s;
      });
    }

    // 3. Finger definitions [knuckleIdx, pipIdx, dipIdx, tipIdx, maxLenRatio]
    const fingerDefs = [
      [5, 6, 7, 8, 1.20],   // Index
      [9, 10, 11, 12, 1.25],// Middle
      [13, 14, 15, 16, 1.20],// Ring
      [17, 18, 19, 20, 1.05] // Pinky
    ];

    fingerDefs.forEach(([baseIdx, pipIdx, dipIdx, tipIdx, maxRatio]) => {
      const base = landmarks[baseIdx];
      const tip = landmarks[tipIdx];
      const len = this.dist(base, tip);
      const maxLen = palmScale * maxRatio;

      if (len > maxLen && len > 0.001) {
        const scale = maxLen / len;
        [pipIdx, dipIdx, tipIdx].forEach(idx => {
          landmarks[idx].x = base.x + (landmarks[idx].x - base.x) * scale;
          landmarks[idx].y = base.y + (landmarks[idx].y - base.y) * scale;
        });
      }
    });

    return landmarks;
  }

  dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  /**
   * Analyzes landmarks to detect gestures and finger movement
   */
  analyze(landmarks, score = 1.0) {
    if (!landmarks || landmarks.length < 21 || score < 0.2) {
      return {
        detected: false,
        gesture: GESTURE_DEFINITIONS.none,
        landmarks: null,
        fingers: [false, false, false, false, false],
        fingerCount: 0,
        pinchDist: 1.0,
        speed: 0,
        swipe: 'none',
        indexPos: { x: 0.5, y: 0.5 },
        thumbPos: { x: 0.5, y: 0.5 },
        wristPos: { x: 0.5, y: 0.5 }
      };
    }

    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // Distance from wrist to tips vs joints to determine extension
    const indexExt = this.dist(indexTip, wrist) > this.dist(landmarks[6], wrist) * 1.15;
    const middleExt = this.dist(middleTip, wrist) > this.dist(landmarks[10], wrist) * 1.15;
    const ringExt = this.dist(ringTip, wrist) > this.dist(landmarks[14], wrist) * 1.15;
    const pinkyExt = this.dist(pinkyTip, wrist) > this.dist(landmarks[18], wrist) * 1.15;
    const thumbExt = this.dist(thumbTip, landmarks[17]) > this.dist(landmarks[2], landmarks[17]) * 1.25;

    // Robust Peace Sign (✌️): Index & Middle extended, Ring & Pinky curled
    const isPeace = indexExt && middleExt &&
      (!ringExt || this.dist(ringTip, wrist) < this.dist(middleTip, wrist) * 0.82) &&
      (!pinkyExt || this.dist(pinkyTip, wrist) < this.dist(middleTip, wrist) * 0.82);

    const fingers = [thumbExt, indexExt, middleExt, ringExt, pinkyExt];
    const fingerCount = fingers.filter(Boolean).length;

    // Pinch distance (Thumb tip to Index tip)
    const pinchDist = this.dist(thumbTip, indexTip);
    const isPinching = pinchDist < 0.085;

    // Movement speed & swipe direction
    const now = performance.now();
    const dt = Math.max(0.001, (now - this.prevTime) * 0.001);
    this.prevTime = now;

    let speed = 0;
    let swipe = 'none';
    if (this.prevWrist) {
      const dx = wrist.x - this.prevWrist.x;
      const dy = wrist.y - this.prevWrist.y;
      speed = Math.hypot(dx, dy) / dt;

      if (speed > 1.2) {
        if (Math.abs(dx) > Math.abs(dy)) {
          swipe = dx > 0 ? 'right' : 'left';
        } else {
          swipe = dy > 0 ? 'down' : 'up';
        }
      }
    }
    this.prevWrist = { ...wrist };

    // Gesture Classification
    let gestureKey = 'open_palm';

    if (isPinching) {
      gestureKey = 'pinch';
    } else if (fingerCount === 0 || (!indexExt && !middleExt && !ringExt && !pinkyExt && !thumbExt)) {
      gestureKey = 'fist';
    } else if (isPeace) {
      gestureKey = 'peace';
    } else if (fingerCount === 5) {
      gestureKey = 'open_palm';
    } else if (indexExt && !middleExt && !ringExt && !pinkyExt) {
      gestureKey = 'pointing';
    } else if (indexExt && pinkyExt && !middleExt && !ringExt) {
      gestureKey = 'rock';
    } else if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
      gestureKey = 'thumbs_up';
    } else {
      gestureKey = fingerCount >= 3 ? 'open_palm' : 'pointing';
    }

    const gesture = GESTURE_DEFINITIONS[gestureKey] || GESTURE_DEFINITIONS.open_palm;

    // Record trail point for pointing
    if (gestureKey === 'pointing') {
      this.trailPoints.push({ x: indexTip.x, y: indexTip.y, age: 0 });
      if (this.trailPoints.length > 25) this.trailPoints.shift();
    } else {
      this.trailPoints = [];
    }

    return {
      detected: true,
      gesture,
      landmarks,
      fingers,
      fingerCount,
      pinchDist,
      speed: Math.min(5.0, speed),
      swipe,
      indexPos: indexTip,
      thumbPos: thumbTip,
      wristPos: wrist
    };
  }

  /**
   * Draws the cybernetic hand skeleton and interactive visual fx on canvas
   */
  renderSkeleton(ctx, analysis, width, height) {
    if (!analysis.detected || !analysis.landmarks) {
      // Draw simulated pulsing HUD when awaiting hand
      ctx.save();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.strokeRect(width * 0.25, height * 0.2, width * 0.5, height * 0.6);
      ctx.setLineDash([]);

      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('AWAITING HAND MOVEMENT...', width / 2, height / 2 - 10);
      ctx.font = '10px "Inter", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Show hand to camera or use gestures', width / 2, height / 2 + 12);
      ctx.restore();
      return;
    }

    const { landmarks, gesture, fingers, pinchDist, indexPos } = analysis;

    ctx.save();

    // 1. Draw Gesture Action Holographic Banner
    ctx.fillStyle = 'rgba(10, 14, 23, 0.75)';
    ctx.fillRect(10, 10, width - 20, 36);
    ctx.strokeStyle = gesture.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, width - 20, 36);

    ctx.font = '16px sans-serif';
    ctx.fillText(gesture.icon, 20, 34);

    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(gesture.name.toUpperCase(), 48, 26);

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = gesture.color;
    ctx.fillText(`EFFECT: ${gesture.effectName}`, 48, 38);

    // Finger count badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(width - 110, 16, 90, 24);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${analysis.fingerCount} FINGERS`, width - 96, 32);

    // 2. Draw Bones / Connections
    ctx.lineWidth = 3;
    HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];

      const grad = ctx.createLinearGradient(p1.x * width, p1.y * height, p2.x * width, p2.y * height);
      grad.addColorStop(0, gesture.color);
      grad.addColorStop(1, '#06b6d4');

      ctx.strokeStyle = grad;
      ctx.shadowColor = gesture.color;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    });

    // 3. Draw Joints
    landmarks.forEach((p, idx) => {
      const x = p.x * width;
      const y = p.y * height;
      const isTip = [4, 8, 12, 16, 20].includes(idx);

      ctx.fillStyle = isTip ? '#ffffff' : gesture.color;
      ctx.shadowColor = gesture.color;
      ctx.shadowBlur = isTip ? 14 : 6;

      ctx.beginPath();
      ctx.arc(x, y, isTip ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // 4. Interactive Special FX based on GESTURE:
    if (gesture.id === 'fist') {
      // Gravitational Singularity / Vortex
      const cx = landmarks[0].x * width;
      const cy = landmarks[0].y * height;
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
      ctx.lineWidth = 2;
      for (let r = 10; r < 70; r += 15) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + (performance.now() * 0.05) % 15, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (gesture.id === 'open_palm') {
      // Supernova Particle Blast
      const cx = landmarks[9].x * width;
      const cy = landmarks[9].y * height;
      const t = performance.now() * 0.003;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const ang = i * (Math.PI / 4) + t;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * 90, cy + Math.sin(ang) * 90);
        ctx.stroke();
      }
    } else if (gesture.id === 'pointing') {
      // Laser Pointer Trail from index tip
      const ix = indexPos.x * width;
      const iy = indexPos.y * height;

      // Laser flare
      ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.beginPath();
      ctx.arc(ix, iy, 20, 0, Math.PI * 2);
      ctx.fill();

      // Spark trail
      if (this.trailPoints.length > 1) {
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 4;
        ctx.beginPath();
        this.trailPoints.forEach((pt, i) => {
          const px = pt.x * width;
          const py = pt.y * height;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
    } else if (gesture.id === 'pinch') {
      // Pinch Magnetic Arc
      const t1 = landmarks[4];
      const t2 = landmarks[8];
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(t1.x * width, t1.y * height);
      ctx.lineTo(t2.x * width, t2.y * height);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`PINCH: ${(pinchDist * 100).toFixed(0)}%`, (t1.x + t2.x) * 0.5 * width + 10, (t1.y + t2.y) * 0.5 * height);
    } else if (gesture.id === 'peace') {
      // Dual Mirrors
      const p1 = landmarks[8];
      const p2 = landmarks[12];
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p1.x * width, p1.y * height, 16, 0, Math.PI * 2);
      ctx.arc(p2.x * width, p2.y * height, 16, 0, Math.PI * 2);
      ctx.stroke();
    } else if (gesture.id === 'rock') {
      // Electric sparks
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2;
      [8, 20].forEach(tipIdx => {
        const pt = landmarks[tipIdx];
        const tx = pt.x * width;
        const ty = pt.y * height;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + (Math.random() - 0.5) * 30, ty - 25 + (Math.random() - 0.5) * 20);
        ctx.stroke();
      });
    }

    ctx.restore();
  }
}

export const handGestureDetector = new HandGestureDetector();
