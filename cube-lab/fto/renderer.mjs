import { faces, step } from './puzzle.mjs';

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const scale = (v, k) => v.map(x => x * k);
export const add = (a, b) => a.map((x, i) => x + b[i]);
export function rotate(point, axis, radians) {
  const c = Math.cos(radians), s = Math.sin(radians);
  return add(add(scale(point, c), scale(cross(axis, point), s)), scale(axis, dot(axis, point) * (1 - c)));
}

const vertexShader = `#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec2 barycentric;
layout(location=2) in float faceNumber;
uniform mat3 rotation;
uniform vec3 forward, right, up;
uniform vec2 offset, lens;
flat out int face;
out vec2 uv;
out vec3 xyz;
void main() {
  vec3 point = rotation * position;
  float w = 4.0 - dot(point, forward);
  gl_Position = vec4(offset * w + lens * vec2(dot(point, right), dot(point, up)), w - 2.0, w);
  face = int(faceNumber);
  uv = barycentric;
  xyz = position;
}`;

const fragmentShader = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2DArray stickers;
uniform vec3 colors[8], normals[8], cut;
uniform int size, slice;
uniform mat3 rotation;
uniform bool moving;
flat in int face;
in vec2 uv;
in vec3 xyz;
out vec4 pixel;
void main() {
  vec2 grid = uv * float(size);
  vec2 d = fwidth(grid);
  if (slice > 0) {
    int band = int(floor((1.0 - dot(cut, xyz)) * float(size) * 0.5 + 0.00001)) + 1;
    if ((band == slice) != moving) discard;
  }
  ivec2 cell = clamp(ivec2(floor(grid)), ivec2(0), ivec2(size - 1));
  vec2 p = fract(grid);
  bool flipped = p.x + p.y > 1.0 && cell.x + cell.y < size - 1;
  vec3 edges = flipped ? vec3(1.0 - p.x, 1.0 - p.y, p.x + p.y - 1.0) :
    vec3(p.x, p.y, 1.0 - p.x - p.y);
  float rim = min(edges.x, min(edges.y, edges.z));
  float aa = max(0.00001, max(d.x, d.y) * 0.65);
  float sticker = smoothstep(0.028 - aa, 0.028 + aa, rim);
  sticker = mix(sticker, 0.94, smoothstep(0.3, 0.85, aa));
  int index = cell.y * (2 * size - cell.y) + 2 * cell.x + int(flipped);
  uint color = texelFetch(stickers, ivec3(index % size, index / size, face), 0).r;
  vec3 normal = rotation * normals[face];
  float light = 0.76 + 0.24 * max(0.0, dot(normal, normalize(vec3(-0.25, 0.65, 0.9))));
  pixel = vec4(mix(vec3(0.024, 0.037, 0.055), colors[int(color)] * light, sticker), 1.0);
}`;

function programFor(gl) {
  const program = gl.createProgram();
  for (const [kind, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]]) {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

export class FaceRenderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('This simulator requires WebGL 2.');
    this.gl = gl;
    this.canvas = canvas;
    this.maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const program = programFor(gl);
    gl.useProgram(program);
    this.uniforms = Object.fromEntries([
      'rotation', 'forward', 'right', 'up', 'offset', 'lens', 'stickers', 'colors[0]', 'normals[0]',
      'cut', 'size', 'slice', 'moving',
    ].map(name => [name, gl.getUniformLocation(program, name)]));
    const { uniforms } = this;
    gl.uniform3fv(uniforms['colors[0]'], faces.flatMap(({ color }) =>
      color.slice(1).match(/../g).map(component => parseInt(component, 16) / 255)));
    gl.uniform3fv(uniforms['normals[0]'], faces.flatMap(({ normal }) => normal));
    const vertices = [];
    for (const [face, { signs }] of faces.entries()) {
      const [x, y, z] = signs;
      const points = [[x, 0, 0, 1, 0], [0, y, 0, 0, 1], [0, 0, z, 0, 0]];
      if (x * y * z < 0) [points[1], points[2]] = [points[2], points[1]];
      for (const point of points) vertices.push(...point, face);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    for (const [location, count, offset] of [[0, 3, 0], [1, 2, 12], [2, 1, 20]]) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, count, gl.FLOAT, false, 24, offset);
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  }

  setPuzzle(puzzle) {
    const { gl } = this, { size, state } = puzzle;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8UI, size, size, 8, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, state);
    if (gl.getError() !== gl.NO_ERROR) {
      gl.deleteTexture(texture);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture ?? null);
      throw new RangeError('This device could not allocate these face textures.');
    }
    if (this.texture) gl.deleteTexture(this.texture);
    this.texture = texture;
    gl.uniform1i(this.uniforms.size, size);
  }

  sync({ size, state }) {
    const { gl } = this;
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, size, size, 8, gl.RED_INTEGER, gl.UNSIGNED_BYTE, state);
  }

  draw(view, move, fraction) {
    if (!this.texture || !view.width || !view.height) return;
    const { gl, uniforms, canvas } = this;
    const density = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(view.width * density), height = Math.round(view.height * density);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (const name of ['forward', 'right', 'up']) gl.uniform3fv(uniforms[name], view[name]);
    gl.uniform2f(uniforms.offset, 2 * view.center[0] / view.width - 1, 1 - 2 * view.center[1] / view.height);
    gl.uniform2f(uniforms.lens, 2 * view.lens / view.width, 2 * view.lens / view.height);
    gl.uniform1i(uniforms.slice, move?.layer ?? 0);
    if (move) gl.uniform3fv(uniforms.cut, faces[move.axis].signs);
    gl.uniformMatrix3fv(uniforms.rotation, false, identity);
    gl.uniform1i(uniforms.moving, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 24);
    if (move) {
      const normal = faces[move.axis].normal;
      const angle = -step * fraction * move.direction;
      const rotation = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].flatMap(point => rotate(point, normal, angle));
      gl.uniformMatrix3fv(uniforms.rotation, false, rotation);
      gl.uniform1i(uniforms.moving, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 24);
    }
  }
}
