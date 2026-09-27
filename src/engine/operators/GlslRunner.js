/**
 * WebGL GLSL Fragment Shader Runner for TouchDesigner GLSL TOP
 */

export const DEFAULT_GLSL_SHADERS = {
  raymarch_tunnel: {
    name: 'Cyber Raymarch Tunnel',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform sampler2D u_texture0;
uniform float u_bass;
uniform float u_beat;

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    
    // Tunnel coordinates
    vec2 p = vec2(1.0 / (r + 0.05) + u_time * 1.5, a * 3.0 / 3.14159);
    
    // Beat pulse
    p += u_beat * 0.15;
    
    // Procedural neon pattern
    float col = sin(p.x * 4.0) * sin(p.y * 6.0);
    vec3 color = vec3(0.5 + 0.5 * sin(p.x + u_time), 0.2 + 0.8 * u_bass, 0.8 + 0.2 * cos(p.y));
    color *= (col + 0.8) / (r * 1.8 + 0.2);
    
    // Sample texture0
    vec4 tex = texture2D(u_texture0, fract(p * 0.2));
    gl_FragColor = vec4(mix(color, tex.rgb, 0.4), 1.0);
}`
  },
  liquid_chrome: {
    name: 'Liquid Chromatic Flow',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform sampler2D u_texture0;
uniform float u_bass;
uniform float u_mid;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 p = uv * 3.0 - vec2(1.5);
    
    float t = u_time * 0.8;
    for (int i = 1; i < 5; i++) {
        float fi = float(i);
        p.x += 0.3 / fi * sin(fi * 3.0 * p.y + t + 0.3 * fi) + 0.5;
        p.y += 0.3 / fi * cos(fi * 3.0 * p.x + t + 0.3 * (fi + 10.0)) - 0.5;
    }
    
    float r = sin(p.x + p.y + 1.0) * 0.5 + 0.5;
    float g = sin(p.x - p.y + 2.0) * 0.5 + 0.5;
    float b = sin(p.x + 3.0) * 0.5 + 0.5;
    
    vec4 tex = texture2D(u_texture0, uv + vec2(r, g) * 0.05);
    gl_FragColor = vec4(mix(vec3(r, g, b) * (1.0 + u_bass * 0.5), tex.rgb, 0.5), 1.0);
}`
  },
  vhs_glitch: {
    name: 'Retro VHS Synth Glitch',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform sampler2D u_texture0;
uniform float u_beat;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    
    // Scanlines
    float scanline = sin(uv.y * 800.0) * 0.04;
    
    // Glitch shift on beat
    float glitch = step(0.95, fract(sin(floor(uv.y * 30.0) + u_time * 10.0) * 43758.5453)) * u_beat * 0.05;
    vec2 uvR = uv + vec2(glitch + 0.005, 0.0);
    vec2 uvB = uv - vec2(glitch + 0.005, 0.0);
    
    float r = texture2D(u_texture0, uvR).r;
    float g = texture2D(u_texture0, uv).g;
    float b = texture2D(u_texture0, uvB).b;
    
    gl_FragColor = vec4(vec3(r, g, b) - scanline, 1.0);
}`
  }
};

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export class GlslRunner {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 360;
    this.gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true });

    this.programs = new Map(); // code -> { program, uniforms, ... }
    this.quadBuffer = null;
    this.texture0 = null;
    this.texture1 = null;

    if (this.gl) {
      this.initGL();
    }
  }

  initGL() {
    const gl = this.gl;
    // Quad buffer
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]), gl.STATIC_DRAW);

    // Create textures
    this.texture0 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.texture1 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  compileProgram(fragCode) {
    if (!this.gl) return { error: 'WebGL not supported' };
    const gl = this.gl;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VERTEX_SHADER_SRC);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragCode);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(fs);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return { error: err };
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      return { error: err };
    }

    return {
      program: prog,
      uniforms: {
        u_time: gl.getUniformLocation(prog, 'u_time'),
        u_resolution: gl.getUniformLocation(prog, 'u_resolution'),
        u_texture0: gl.getUniformLocation(prog, 'u_texture0'),
        u_texture1: gl.getUniformLocation(prog, 'u_texture1'),
        u_bass: gl.getUniformLocation(prog, 'u_bass'),
        u_mid: gl.getUniformLocation(prog, 'u_mid'),
        u_treble: gl.getUniformLocation(prog, 'u_treble'),
        u_beat: gl.getUniformLocation(prog, 'u_beat'),
      },
      attribs: {
        a_position: gl.getAttribLocation(prog, 'a_position')
      }
    };
  }

  render(fragCode, time, audioMetrics, inCanvas0, inCanvas1, width = 640, height = 360) {
    if (!this.gl) return this.canvas;
    const gl = this.gl;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    let compiled = this.programs.get(fragCode);
    if (!compiled) {
      compiled = this.compileProgram(fragCode);
      this.programs.set(fragCode, compiled);
    }

    if (compiled.error) {
      // Draw error message on canvas
      const ctx2d = document.createElement('canvas').getContext('2d');
      ctx2d.canvas.width = width;
      ctx2d.canvas.height = height;
      ctx2d.fillStyle = '#450a0a';
      ctx2d.fillRect(0, 0, width, height);
      ctx2d.fillStyle = '#f87171';
      ctx2d.font = '12px "JetBrains Mono", monospace';
      ctx2d.fillText('GLSL COMPILE ERROR:', 14, 24);
      ctx2d.font = '10px "JetBrains Mono", monospace';
      ctx2d.fillText(compiled.error.slice(0, 80), 14, 48);
      return ctx2d.canvas;
    }

    const { program, uniforms, attribs } = compiled;
    gl.useProgram(program);

    // Uniforms
    gl.uniform1f(uniforms.u_time, time * 0.001);
    gl.uniform2f(uniforms.u_resolution, width, height);
    gl.uniform1f(uniforms.u_bass, audioMetrics.bass || 0);
    gl.uniform1f(uniforms.u_mid, audioMetrics.mid || 0);
    gl.uniform1f(uniforms.u_treble, audioMetrics.treble || 0);
    gl.uniform1f(uniforms.u_beat, audioMetrics.beat || 0);

    // Texture 0
    if (inCanvas0 && uniforms.u_texture0) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inCanvas0);
      gl.uniform1i(uniforms.u_texture0, 0);
    }

    // Texture 1
    if (inCanvas1 && uniforms.u_texture1) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texture1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inCanvas1);
      gl.uniform1i(uniforms.u_texture1, 1);
    }

    // Draw quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(attribs.a_position);
    gl.vertexAttribPointer(attribs.a_position, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return this.canvas;
  }
}

export const glslRunner = new GlslRunner();
