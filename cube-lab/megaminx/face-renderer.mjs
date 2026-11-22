import { colors, cross, dot, faceVertices, faces, rotate, stickers, unit } from './puzzle.mjs';

const seam = 0x8000;
const stateWidth = 512;
const faceAxes = faceVertices.map((ring, face) => {
  const right = unit(ring[0].map((value, i) => value - faces[face][i]));
  const up = cross(faces[face], right);
  const diameter = 2 * dot(ring[0], right);
  return point => [0.5 + dot(point, right) / diameter, 0.5 + dot(point, up) / diameter];
});

const vertexShader = `#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec2 faceUV;
layout(location=2) in float faceNumber;
uniform mat3 rotation;
uniform vec3 forward, right, up;
uniform vec2 offset, lens;
flat out int face;
out vec2 uv;
void main() {
  vec3 point = rotation * position;
  float depth = 5.0 - dot(point, forward);
  gl_Position = vec4(offset * depth + lens * vec2(dot(point, right), dot(point, up)),
                     depth - 2.0, depth);
  face = int(faceNumber);
  uv = faceUV;
}`;

const fragmentShader = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2DArray images;
uniform highp usampler2D state, bands;
uniform vec3 palette[12], normals[12];
uniform mat3 rotation;
uniform int perFace, stateHeight, axis, layer;
uniform float imageSide;
uniform bool moving;
flat in int face;
in vec2 uv;
out vec4 pixel;
void main() {
  float footprint = imageSide * max(length(dFdx(uv)), length(dFdy(uv)));
  uint packedID = texture(images, vec3(uv, float(face))).r;
  if (packedID == 0u) discard;
  int id = face * perFace + int(packedID & 32767u) - 1;
  ivec2 texel = ivec2(id % 512, id / 512);
  if (layer != 0) {
    uint band = texelFetch(bands, texel + ivec2(0, axis * stateHeight), 0).r;
    if ((band == uint(layer)) != moving) discard;
  }
  vec3 normal = rotation * normals[face];
  float shade = 0.08 + 0.24 * (1.0 - max(0.0, dot(normal, vec3(-0.2, 0.59, 0.78))));
  vec3 color = palette[int(texelFetch(state, texel, 0).r)];
  color = mix(color, vec3(4.0, 12.0, 23.0) / 255.0, shade);
  if ((packedID & 32768u) != 0u) {
    float border = imageSide < 1024.0 ? 1.0 : 1.0 - smoothstep(1.25, 3.5, footprint);
    color = mix(color, vec3(8.0, 12.0, 18.0) / 255.0, border);
  }
  pixel = vec4(color, 1.0);
}`;

function programFor(gl) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]]) {
    const shader = gl.createShader(type);
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

// Each pixel identifies a sticker. The high bit marks the dark border of that
// sticker so it follows the same slice during animation and remains pickable.
function rasterize(image, side, polygon, value) {
  const firstY = Math.max(0, Math.ceil(Math.min(...polygon.map(p => p[1])) - 0.5));
  const lastY = Math.min(side, Math.ceil(Math.max(...polygon.map(p => p[1])) - 0.5));
  for (let y = firstY; y < lastY; y++) {
    const scan = y + 0.5;
    let left = Infinity, right = -Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const [x1, y1] = polygon[i], [x2, y2] = polygon[(i + 1) % polygon.length];
      if ((scan < y1) === (scan < y2)) continue;
      const x = x1 + (x2 - x1) * (scan - y1) / (y2 - y1);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    if (right <= left) continue;
    const row = y * side;
    image.fill(value, row + Math.max(0, Math.ceil(left - 0.5)), row + Math.min(side, Math.ceil(right - 0.5)));
  }
}

const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

export class FaceRenderer {
  constructor(gl) {
    this.gl = gl;
    const program = programFor(gl);
    gl.useProgram(program);
    this.uniform = Object.fromEntries([
      'images', 'state', 'bands', 'palette[0]', 'normals[0]', 'rotation', 'forward', 'right', 'up',
      'offset', 'lens', 'perFace', 'stateHeight', 'axis', 'layer', 'moving', 'imageSide',
    ].map(name => [name, gl.getUniformLocation(program, name)]));
    gl.uniform3fv(this.uniform['normals[0]'], faces.flat());
    gl.uniform3fv(this.uniform['palette[0]'], colors.flatMap(([, hex]) =>
      hex.slice(1).match(/../g).map(pair => parseInt(pair, 16) / 255)));
    const vertices = [];
    for (const [face, ring] of faceVertices.entries()) {
      for (let i = 1; i < ring.length - 1; i++) {
        for (const point of [ring[0], ring[i], ring[i + 1]]) vertices.push(...point, ...faceAxes[face](point), face);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    for (const [index, count, offset] of [[0, 3, 0], [1, 2, 12], [2, 1, 20]]) {
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, count, gl.FLOAT, false, 24, offset);
    }
    this.vertexCount = vertices.length / 6;
    for (const [unitIndex, name, target] of [[0, 'images', gl.TEXTURE_2D_ARRAY], [1, 'state', gl.TEXTURE_2D], [2, 'bands', gl.TEXTURE_2D]]) {
      gl.activeTexture(gl.TEXTURE0 + unitIndex);
      gl.bindTexture(target, gl.createTexture());
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(this.uniform[name], unitIndex);
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  }

  setPuzzle(puzzle, size) {
    const gl = this.gl, tiles = puzzle.stickers ?? stickers;
    this.side = size <= 36 ? 512 : 1024;
    this.perFace = tiles.length / faces.length;
    this.images = [];
    this.stateHeight = Math.ceil(tiles.length / stateWidth);
    const stride = stateWidth * this.stateHeight;
    this.statePixels = new Uint8Array(stride);
    const bands = new Uint8Array(stride * faces.length);

    gl.activeTexture(gl.TEXTURE0);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R16UI, this.side, this.side, faces.length,
      0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, null);
    for (const [face, toUV] of faceAxes.entries()) {
      const image = new Uint16Array(this.side ** 2);
      const toPixel = point => toUV(point).map(coord => coord * this.side);
      for (let local = 0; local < this.perFace; local++) {
        const id = face * this.perFace + local, tile = tiles[id];
        rasterize(image, this.side, tile.polygon.map(toPixel), (local + 1) | seam);
        rasterize(image, this.side, tile.inset.map(toPixel), local + 1);
        if (tile.bands) {
          for (let axis = 0; axis < faces.length; axis++) bands[axis * stride + id] = tile.bands[axis];
        } else {
          for (const axis of tile.layerFaces) bands[axis * stride + id] = 1;
        }
      }
      this.images.push(image);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, face, this.side, this.side, 1,
        gl.RED_INTEGER, gl.UNSIGNED_SHORT, image);
    }
    gl.activeTexture(gl.TEXTURE2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, stateWidth, this.stateHeight * faces.length,
      0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, bands);
    gl.activeTexture(gl.TEXTURE1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, stateWidth, this.stateHeight,
      0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, null);
    gl.uniform1i(this.uniform.perFace, this.perFace);
    gl.uniform1i(this.uniform.stateHeight, this.stateHeight);
    gl.uniform1f(this.uniform.imageSide, this.side);
    this.sync(puzzle.state);
  }

  sync(state) {
    const gl = this.gl;
    this.statePixels.set(state);
    gl.activeTexture(gl.TEXTURE1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, stateWidth, this.stateHeight,
      gl.RED_INTEGER, gl.UNSIGNED_BYTE, this.statePixels);
  }

  draw(camera, move, angle) {
    const { gl, uniform } = this;
    const { width, height, forward, right, up, center, lens } = camera;
    if (!width || !height) return;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform3fv(uniform.forward, forward);
    gl.uniform3fv(uniform.right, right);
    gl.uniform3fv(uniform.up, up);
    gl.uniform2f(uniform.offset, 2 * center[0] / width - 1, 1 - 2 * center[1] / height);
    gl.uniform2f(uniform.lens, 2 * lens / width, 2 * lens / height);
    gl.uniform1i(uniform.axis, angle ? move.face : 0);
    gl.uniform1i(uniform.layer, angle ? move.layer ?? 1 : 0);
    gl.uniform1i(uniform.moving, 0);
    gl.uniformMatrix3fv(uniform.rotation, false, identity);
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    if (angle) {
      const columns = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].flatMap(axis => rotate(axis, faces[move.face], angle));
      gl.uniformMatrix3fv(uniform.rotation, false, columns);
      gl.uniform1i(uniform.moving, 1);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }
  }

  hit(point, { eye, onFace }) {
    for (const [face, normal] of faces.entries()) {
      if (dot(eye, normal) <= 1) continue;
      const [x, y] = faceAxes[face](onFace(point, normal)).map(value => Math.floor(value * this.side));
      if (!(x >= 0 && y >= 0 && x < this.side && y < this.side)) continue;
      const id = this.images[face][y * this.side + x] & (seam - 1);
      if (id) return { face, id: face * this.perFace + id - 1 };
    }
    return null;
  }
}
