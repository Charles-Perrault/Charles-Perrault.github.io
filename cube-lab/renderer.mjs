const viewCenterY = 0.05;
const closestCameraDistance = 3.1;

const VERTEX = `#version 300 es
in vec3 aPosition;
in vec2 aUV;
uniform vec3 uRight, uUp, uEye;
uniform float uAspect, uZoom, uAngle;
uniform int uAxis;
out vec2 vUV;
vec3 rotatePoint(vec3 p) {
  float c=cos(uAngle), s=sin(uAngle);
  if(uAxis==0) return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);
  if(uAxis==1) return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
  return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);
}
void main(){
  vec3 p=rotatePoint(aPosition), d=p-uEye;
  float z=-dot(d,normalize(uEye));
  float near=0.1, far=100.0;
  gl_Position=vec4(dot(d,uRight)*uZoom/uAspect,dot(d,uUp)*uZoom+${viewCenterY}*z,
    (far+near)/(far-near)*z-2.0*far*near/(far-near),z);
  vUV=aUV;
}`;
const FRAGMENT = `#version 300 es
precision highp float;
precision highp usampler2D;
in vec2 vUV;
uniform highp usampler2D uTexture;
uniform float uSize, uLight;
uniform int uFaceRotation;
uniform bool uCap;
out vec4 color;
void main(){
  if(uCap){ color=vec4(vec3(0.035,0.042,0.052)*uLight,1.0); return; }
  vec2 cell=clamp(vUV,vec2(0.0),vec2(0.999999))*uSize;
  ivec2 texel=ivec2(cell);
  int last=int(uSize)-1;
  if(uFaceRotation==1) texel=ivec2(texel.y,last-texel.x);
  else if(uFaceRotation==2) texel=ivec2(last)-texel;
  else if(uFaceRotation==3) texel=ivec2(last-texel.y,texel.x);
  uint id=texelFetch(uTexture,texel,0).r;
  vec3 palette[6]=vec3[6](vec3(.94,.94,.90),vec3(.79,.13,.13),vec3(.08,.60,.34),vec3(.96,.78,.14),vec3(.96,.40,.10),vec3(.10,.30,.75));
  vec2 f=fract(cell);
  float edge=min(min(f.x,1.0-f.x),min(f.y,1.0-f.y));
  float aa=max(fwidth(edge),0.002);
  float sticker=smoothstep(0.045-aa,0.045+aa,edge);
  vec3 ink=vec3(.035,.040,.048);
  color=vec4(mix(ink,palette[min(id,5u)]*uLight,sticker),1.0);
}`;

const FACES = [
  { o: [-1, 1, -1], u: [2, 0, 0], v: [0, 0, 2], light: 1.0 },
  { o: [1, 1, 1], u: [0, 0, -2], v: [0, -2, 0], light: 0.86 },
  { o: [-1, 1, 1], u: [2, 0, 0], v: [0, -2, 0], light: 0.94 },
  { o: [-1, -1, 1], u: [2, 0, 0], v: [0, 0, -2], light: 0.72 },
  { o: [-1, 1, -1], u: [0, 0, 2], v: [0, -2, 0], light: 0.82 },
  { o: [1, 1, -1], u: [-2, 0, 0], v: [0, -2, 0], light: 0.76 },
];
const corners = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
const normals = [2, 1, 3, -2, -1, -3];

function writeQuad(vertices, offset, origin, a, b, s0, s1, t0, t1) {
  for (let i = 0; i < corners.length; i += 2) {
    const s = corners[i] ? s1 : s0;
    const t = corners[i + 1] ? t1 : t0;
    for (let axis = 0; axis < 3; axis++) vertices[offset++] = origin[axis] + a[axis] * s + b[axis] * t;
    vertices[offset++] = s;
    vertices[offset++] = t;
  }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};
function projectionScale(width, height) {
  // Narrow layouts place the controls above and below the cube.
  const verticalFit = width <= 680 ? Math.max(0.18, (height - 508) / (0.77 * height)) : 0.86;
  return 2.65 * Math.min(0.86, width / (0.92 * height), verticalFit);
}
function shader(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error('Could not compile cube shader: ' + gl.getShaderInfoLog(s));
  return s;
}

export class CubeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl)
      throw new Error(
        'WebGL 2 is unavailable in this browser. Please enable hardware acceleration or try a supported browser.',
      );
    this.gl = gl;
    this.maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error('Could not initialize cube renderer: ' + gl.getProgramInfoLog(program));
    this.program = program;
    gl.useProgram(program);
    this.uniform = {};
    for (const name of [
      'uRight',
      'uUp',
      'uEye',
      'uAspect',
      'uZoom',
      'uAngle',
      'uAxis',
      'uTexture',
      'uSize',
      'uLight',
      'uFaceRotation',
      'uCap',
    ])
      this.uniform[name] = gl.getUniformLocation(program, name);
    const position = gl.getAttribLocation(program, 'aPosition'),
      uv = gl.getAttribLocation(program, 'aUV');
    const geometry = (data, usage) => {
      const vao = gl.createVertexArray();
      const buffer = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(uv);
      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12);
      return { vao, buffer };
    };
    const staticVertices = new Float32Array(6 * 30);
    FACES.forEach(({ o, u, v }, face) => writeQuad(staticVertices, face * 30, o, u, v, 0, 1, 0, 1));
    this.staticGeometry = geometry(staticVertices, gl.STATIC_DRAW);
    this.turnVertices = new Float32Array(22 * 30);
    this.turnGeometry = geometry(this.turnVertices, gl.DYNAMIC_DRAW);
    this.dirtySpans = new Int32Array(24);
    this.textures = [];
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.enable(gl.DEPTH_TEST);
    this.yaw = 0.72;
    this.pitch = 0.52;
    this.zoomDistance = 5.7;
    this.pointers = new Map();
    canvas.style.touchAction = 'none';
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 2) return;
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (this.pointers.size === 1) {
        const paint = e.button === 0 && this.canPaint?.();
        const hit =
          e.button === 0 && (paint || !this.canTurn || this.canTurn()) ? this._hit(e.clientX, e.clientY) : null;
        this.gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, hit, paint };
      } else this.gesture = null;
      this.pinch = this._pinchDistance();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const old = this.pointers.get(e.pointerId);
      this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (this.pointers.size > 1) {
        const d = this._pinchDistance();
        if (d && this.pinch) this.zoomBy(this.pinch / d);
        this.pinch = d;
      } else if (this.gesture?.hit && !this.gesture.paint) {
        this.updateSwipe(e);
      } else {
        const gesture = this.gesture;
        if (gesture?.paint && !gesture.dragged) {
          if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) < 9) return;
          gesture.dragged = true;
        }
        const sensitivity = 0.008 / Math.sqrt(this.lensScale);
        this.yaw -= (e.clientX - old[0]) * sensitivity;
        this.pitch += (e.clientY - old[1]) * sensitivity;
      }
      this._redraw();
    });
    const end = (e) => {
      let turn;
      let sticker;
      const gesture = this.gesture;
      if (e.type === 'pointerup' && gesture?.id === e.pointerId && gesture.hit) {
        if (gesture.paint) {
          if (!gesture.dragged && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) < 9) {
            sticker = this.stickerAtHit(gesture.hit);
          }
        } else {
          this.updateSwipe(e);
          turn = gesture.turn;
        }
      }
      if (this.gesture?.id === e.pointerId) this.gesture = null;
      this.pointers.delete(e.pointerId);
      this.pinch = this._pinchDistance();
      if (sticker && this.canPaint?.()) this.onPaint(...sticker);
      else if (turn && this.onTurn && (!this.canTurn || this.canTurn())) this.onTurn(turn.move, turn.progress);
      else this._redraw();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomBy(Math.exp(e.deltaY * 0.002));
        this._redraw();
      },
      { passive: false },
    );
    canvas.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowLeft') this.yaw += 0.12;
      else if (k === 'ArrowRight') this.yaw -= 0.12;
      else if (k === 'ArrowUp') this.pitch += 0.12;
      else if (k === 'ArrowDown') this.pitch -= 0.12;
      else if (k === '+' || k === '=') this.zoomBy(0.8);
      else if (k === '-') this.zoomBy(1 / 0.8);
      else return;
      e.preventDefault();
      this._redraw();
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this._redraw());
      this.observer.observe(canvas);
    } else window.addEventListener('resize', () => this._redraw());
  }
  get distance() {
    return Math.max(closestCameraDistance, this.zoomDistance);
  }
  get lensScale() {
    return this.distance / this.zoomDistance;
  }
  zoomBy(factor) {
    // Magnify the projection once the camera reaches a safe distance from the cube.
    const maxLens = Math.max(8, (this.cube?.size ?? 3) / 10);
    this.zoomDistance = clamp(this.zoomDistance * factor, closestCameraDistance / maxLens, 14);
  }
  _camera() {
    const cp = Math.cos(this.pitch),
      eye = [
        this.distance * Math.sin(this.yaw) * cp,
        this.distance * Math.sin(this.pitch),
        this.distance * Math.cos(this.yaw) * cp,
      ];
    const forward = norm(eye),
      right = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)],
      up = cross(forward, right);
    return { eye, forward, right, up };
  }
  _hit(x, y) {
    if (!this.cube) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const { eye, forward, right, up } = this._camera();
    const nx = ((x - rect.left) / rect.width) * 2 - 1,
      ny = 1 - ((y - rect.top) / rect.height) * 2 - viewCenterY;
    const aspect = rect.width / rect.height,
      zoom = projectionScale(rect.width, rect.height) * this.lensScale;
    const ray = norm(forward.map((v, i) => -v + (right[i] * nx * aspect) / zoom + (up[i] * ny) / zoom));
    let near = -Infinity,
      far = Infinity,
      hitAxis = -1,
      hitSign = 0;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(ray[i]) < 1e-9) {
        if (eye[i] < -1 || eye[i] > 1) return null;
        continue;
      }
      let a = (-1 - eye[i]) / ray[i],
        b = (1 - eye[i]) / ray[i],
        sign = -1;
      if (a > b) {
        [a, b] = [b, a];
        sign = 1;
      }
      if (a > near) {
        near = a;
        hitAxis = i;
        hitSign = sign;
      }
      far = Math.min(far, b);
    }
    if (near < 0 || near > far || hitAxis < 0) return null;
    const p = eye.map((v, i) => v + ray[i] * near),
      normal = [0, 0, 0];
    normal[hitAxis] = hitSign;
    return { p, normal, hitAxis };
  }
  stickerAtHit({ p, normal, hitAxis }) {
    const face = normals.indexOf((hitAxis + 1) * normal[hitAxis]);
    const { o, u, v } = FACES[face];
    const offset = p.map((value, axis) => value - o[axis]);
    const size = this.cube.size;
    const cell = (vector) => clamp(Math.floor(dot(offset, vector) * size / 4), 0, size - 1);
    return [face, cell(v), cell(u)];
  }
  updateSwipe(event) {
    const gesture = this.gesture;
    const dx = event.clientX - gesture.x,
      dy = event.clientY - gesture.y;
    if (!gesture.slice && Math.hypot(dx, dy) >= 9) gesture.slice = this.pickSlice(gesture.hit, dx, dy);
    if (!gesture.slice) return;
    const { axis, layer, sx, sy, pixelsPerQuarter, direction } = gesture.slice;
    const travel = dx * sx + dy * sy;
    gesture.turn =
      Math.abs(travel) < 9
        ? null
        : {
            move: { axis, layer, turns: direction * Math.sign(travel) },
            progress: clamp(Math.abs(travel) / pixelsPerQuarter, 0, 0.96),
          };
  }
  pickSlice({ p, normal, hitAxis }, dx, dy) {
    const { forward, right, up } = this._camera();
    const rect = this.canvas.getBoundingClientRect(),
      zoom = projectionScale(rect.width, rect.height) * this.lensScale;
    const project = (pt) => {
      const scale = (zoom * rect.height) / (2 * (this.distance - dot(pt, forward)));
      return [dot(pt, right) * scale, -dot(pt, up) * scale];
    };
    const base = project(p);
    let best = null;
    for (let i = 0; i < 3; i++) {
      if (i === hitAxis) continue;
      const v = [0, 0, 0];
      v[i] = 1;
      const end = project(p.map((x, j) => x + v[j] * 0.1));
      const sx = end[0] - base[0],
        sy = end[1] - base[1],
        length = Math.hypot(sx, sy);
      if (length < 1e-9) continue;
      const score = (dx * sx + dy * sy) / length;
      if (!best || Math.abs(score) > Math.abs(best.score))
        best = { v, score, sx: sx / length, sy: sy / length, length };
    }
    if (!best || Math.abs(best.score) < 9) return null;
    const rotation = cross(normal, best.v);
    const axis = rotation.findIndex((v) => v !== 0);
    const layer = clamp(Math.floor((p[axis] + 1) * 0.5 * this.cube.size), 0, this.cube.size - 1);
    return {
      axis,
      layer,
      sx: best.sx,
      sy: best.sy,
      pixelsPerQuarter: Math.max(40, best.length * 16),
      direction: rotation[axis],
    };
  }
  _pinchDistance() {
    const p = [...this.pointers.values()];
    return p.length >= 2 ? Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) : 0;
  }
  cancelDrag() {
    if (!this.gesture?.hit) return;
    this.gesture = null;
    this._redraw();
  }
  resetView() {
    this.yaw = 0.72;
    this.pitch = 0.52;
    this.zoomDistance = 5.7;
    this._redraw();
  }
  _redraw() {
    if (this.cube) this.draw(this.cube, this.move, this.progress);
  }
  recordTurn(cube, { axis, layer, endLayer = layer }) {
    if (cube !== this.uploadedCube) return;
    if (cube.revision === this.uploadedRevision) {
      this.trackedRevision = cube.revision;
      this.trackedFaces = 0;
      this.trackedTurns = 0;
      for (let i = 0; i < 24; i += 2) {
        this.dirtySpans[i] = cube.size;
        this.dirtySpans[i + 1] = -1;
      }
    }
    if (cube.revision !== this.trackedRevision) return;
    this.trackedRevision++;
    const { strips, mask } = cube.cycles[axis];
    this.trackedFaces |= mask;
    if (++this.trackedTurns > 16 || cube.size < 24) return;
    const n = cube.size;
    for (const { face, byOrientation } of strips) {
      const { base, layerStride, stripStride } = byOrientation[cube.orientations[face]];
      const a = base + layerStride * layer;
      const b = base + layerStride * endLayer;
      const horizontal = Math.abs(stripStride) === 1;
      const first = horizontal ? Math.floor(a / n) : a % n;
      const last = horizontal ? Math.floor(b / n) : b % n;
      const slot = face * 4 + (horizontal ? 0 : 2);
      this.dirtySpans[slot] = Math.min(this.dirtySpans[slot], first, last);
      this.dirtySpans[slot + 1] = Math.max(this.dirtySpans[slot + 1], first, last);
    }
  }
  upload(cube) {
    if (this.uploadedCube === cube && this.uploadedRevision === cube.revision) return;
    const gl = this.gl,
      n = cube.size;
    gl.activeTexture(gl.TEXTURE0);
    if (this.uploadedSize !== n) {
      const textures = cube.faces.map((face) => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, n, n, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, face);
        return texture;
      });
      if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) {
        textures.forEach((texture) => gl.deleteTexture(texture));
        throw new Error('The graphics device could not allocate this cube. Try a smaller size.');
      }
      this.textures.forEach((texture) => gl.deleteTexture(texture));
      this.textures = textures;
      this.uploadedSize = n;
    } else {
      const sameCube = this.uploadedCube === cube;
      const tracked = sameCube && this.trackedRevision === cube.revision;
      const detailed = tracked && this.trackedTurns <= 16 && n >= 24;
      const mask = tracked ? this.trackedFaces
        : sameCube && cube.revision === this.uploadedRevision + 1 ? cube.dirtyFaces : 63;
      if (detailed) gl.pixelStorei(gl.UNPACK_ROW_LENGTH, n);
      for (let i = 0; i < 6; i++) {
        if (!(mask & (1 << i))) continue;
        gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
        const face = cube.faces[i];
        const row = this.dirtySpans[i * 4], col = this.dirtySpans[i * 4 + 2];
        const rows = Math.max(0, this.dirtySpans[i * 4 + 1] - row + 1);
        const cols = Math.max(0, this.dirtySpans[i * 4 + 3] - col + 1);
        if (detailed && rows + cols < n * 0.65) {
          if (rows) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, row, n, rows, gl.RED_INTEGER, gl.UNSIGNED_BYTE, face, row * n);
          if (cols) gl.texSubImage2D(gl.TEXTURE_2D, 0, col, 0, cols, n, gl.RED_INTEGER, gl.UNSIGNED_BYTE, face, col);
        } else {
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, n, gl.RED_INTEGER, gl.UNSIGNED_BYTE, face);
        }
      }
      if (detailed) gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    }
    this.uploadedCube = cube;
    this.uploadedRevision = cube.revision;
    this.trackedRevision = undefined;
  }
  draw(cube, move = null, progress = 0) {
    if (cube.size > this.maxSize) throw new Error(`This device supports up to ${this.maxSize} layers.`);
    this.upload(cube);
    if ((this.cube !== cube || move) && this.gesture?.hit) this.gesture = null;
    const resized = this.cube?.size !== cube.size;
    this.cube = cube;
    if (resized) this.zoomBy(1);
    this.move = move;
    this.progress = progress;
    if (!move && this.gesture?.turn) ({ move, progress } = this.gesture.turn);
    const gl = this.gl,
      n = cube.size,
      u = this.uniform;
    const cssWidth = Math.max(1, this.canvas.clientWidth);
    const cssHeight = Math.max(1, this.canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    const { eye, right, up } = this._camera();
    gl.uniform3fv(u.uEye, eye);
    gl.uniform3fv(u.uRight, right);
    gl.uniform3fv(u.uUp, up);
    gl.uniform1f(u.uAspect, width / height);
    gl.uniform1f(u.uZoom, projectionScale(cssWidth, cssHeight) * this.lensScale);
    gl.uniform1f(u.uSize, n);
    gl.uniform1i(u.uTexture, 0);
    const angle = move ? ((move.turns * Math.PI) / 2) * clamp(progress, 0, 1) : 0;
    const axis = move?.axis ?? 0,
      layer = move?.layer ?? 0;
    const lo = -1 + (2 * layer) / n,
      hi = -1 + (2 * ((move?.endLayer ?? layer) + 1)) / n;
    const geometry = move ? this.turnGeometry : this.staticGeometry;
    gl.bindVertexArray(geometry.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.buffer);
    gl.uniform1i(u.uAxis, axis);
    if (!move) {
      gl.uniform1f(u.uAngle, 0);
      gl.uniform1i(u.uCap, 0);
    }
    const quads = [];
    const quad = (o, a, b, s0, s1, t0, t1, rot, face, light) => {
      writeQuad(this.turnVertices, quads.length * 30, o, a, b, s0, s1, t0, t1);
      quads.push({ rot, face, light });
    };
    for (let i = 0; i < 6; i++) {
      const f = FACES[i];
      if (!move) {
        const normal = normals[i];
        if (eye[Math.abs(normal) - 1] * Math.sign(normal) <= 1) continue;
        gl.uniform1i(u.uFaceRotation, cube.orientations[i]);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
        gl.uniform1f(u.uLight, f.light);
        gl.drawArrays(gl.TRIANGLES, i * 6, 6);
        continue;
      }
      const au = f.u[axis],
        av = f.v[axis],
        fixed = f.o[axis];
      if (au === 0 && av === 0) {
        quad(f.o, f.u, f.v, 0, 1, 0, 1, fixed >= lo - 1e-7 && fixed <= hi + 1e-7, i, f.light);
        continue;
      }
      const delta = au || av;
      const p = clamp((lo - fixed) / delta, 0, 1),
        q = clamp((hi - fixed) / delta, 0, 1);
      const a = Math.min(p, q),
        b = Math.max(p, q);
      for (const [start, end, rot] of [
        [0, a, false],
        [a, b, true],
        [b, 1, false],
      ]) {
        if (end - start < 1e-8) continue;
        quad(f.o, f.u, f.v, au ? start : 0, au ? end : 1, av ? start : 0, av ? end : 1, rot, i, f.light);
      }
    }
    if (move && Math.abs(angle) > 1e-6) {
      for (const value of [lo, hi]) {
        if (value <= -1 + 1e-7 || value >= 1 - 1e-7) continue;
        const axes = [0, 1, 2].filter((i) => i !== axis),
          o = [-1, -1, -1],
          a = [0, 0, 0],
          b = [0, 0, 0];
        o[axis] = value;
        a[axes[0]] = 2;
        b[axes[1]] = 2;
        quad(o, a, b, 0, 1, 0, 1, false, -1, 0.9);
        quad(o, a, b, 0, 1, 0, 1, true, -1, 0.9);
      }
    }
    if (move) {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.turnVertices, 0, quads.length * 30);
      let previousFace;
      for (let i = 0; i < quads.length; i++) {
        const { rot, face, light } = quads[i];
        if (face !== previousFace) {
          gl.uniform1i(u.uCap, face < 0 ? 1 : 0);
          if (face >= 0) {
            gl.uniform1i(u.uFaceRotation, cube.orientations[face]);
            gl.bindTexture(gl.TEXTURE_2D, this.textures[face]);
          }
          previousFace = face;
        }
        gl.uniform1f(u.uAngle, rot ? angle : 0);
        gl.uniform1f(u.uLight, light);
        gl.drawArrays(gl.TRIANGLES, i * 6, 6);
      }
    }
  }
}
