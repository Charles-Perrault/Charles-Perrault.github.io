import { add, cross, dot, rotate, scale } from '../pyraminx/renderer.mjs';

const vertex = `#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec2 texcoord;
layout(location=2) in float faceIndex;
layout(location=3) in vec3 normal;
uniform mat3 pose;
uniform vec3 forward, right, up;
uniform vec2 offset, lens;
out vec2 uv;
flat out int face;
flat out float shade;
void main() {
  vec3 point = pose * position;
  float depth = 4.0 - dot(point, forward);
  gl_Position = vec4(offset * depth + lens * vec2(dot(point, right), dot(point, up)), depth - 2.0, depth);
  uv = texcoord;
  face = int(faceIndex);
  shade = .22 * (1.0 - max(0.0, dot(pose * normal, vec3(.28, .74, .59))));
}`;
const fragment = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2DArray faces;
uniform highp usampler2D state;
uniform highp sampler2D palette;
uniform int stateWidth;
uniform uint group;
in vec2 uv;
flat in int face;
flat in float shade;
out vec4 pixel;
void main() {
  uint entry = texture(faces, vec3(uv, float(face))).r;
  int id = int(entry & 0x7fffffffu) - 1;
  if (id < 0) discard;
  uvec2 slot = texelFetch(state, ivec2(id % stateWidth, id / stateWidth), 0).rg;
  if (slot.g != group) discard;
  vec3 color = vec3(20.0, 25.0, 31.0) / 255.0;
  if ((entry & 0x80000000u) != 0u) {
    color = mix(texelFetch(palette, ivec2(int(slot.r), 0), 0).rgb, vec3(4.0, 10.0, 20.0) / 255.0, shade);
  }
  pixel = vec4(color, 1.0);
}`;

const identity = [[1,0,0], [0,1,0], [0,0,1]];
const unit = vector => scale(vector, 1 / Math.hypot(...vector));
const minus = (a, b) => add(a, scale(b, -1));
const movedTo = (point, pose) => add(add(scale(pose[0], point[0]), scale(pose[1], point[1])), scale(pose[2], point[2]));
const outlineOf = tile => tile.polygons ?? [tile.renderPolygon ?? tile.polygon];

function shaderProgram(gl) {
  const program = gl.createProgram();
  for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  return program;
}

function rasterize(image, side, polygons, value) {
  const edges = [];
  let bottom = side, top = 0;
  for (const polygon of polygons) for (const [i, [x, y]] of polygon.entries()) {
    const [u, v] = polygon[(i + 1) % polygon.length];
    if (y === v) continue;
    bottom = Math.min(bottom, y, v);
    top = Math.max(top, y, v);
    edges.push([x, y, Math.min(y, v), Math.max(y, v), (u - x) / (v - y)]);
  }
  const starts = Math.max(0, Math.ceil(bottom - .5)), ends = Math.min(side, Math.ceil(top - .5));
  const hits = [];
  for (let row = starts; row < ends; row++) {
    hits.length = 0;
    const scan = row + .5;
    for (const [x, y, low, high, slope] of edges) {
      if (scan >= low && scan < high) hits.push(x + slope * (scan - y));
    }
    hits.sort((a, b) => a - b);
    for (let i = 1; i < hits.length; i += 2) {
      const left = Math.max(0, Math.ceil(hits[i - 1] - .5));
      const right = Math.min(side, Math.ceil(hits[i] - .5));
      image.fill(value, row * side + left, row * side + right);
    }
  }
}

function texture(gl, unitIndex, target) {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unitIndex);
  gl.bindTexture(target, texture);
  for (const property of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(target, property, gl.NEAREST);
  for (const property of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(target, property, gl.CLAMP_TO_EDGE);
  return texture;
}

export class FaceTextures {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2');
    if (!gl) throw Error('WebGL 2 is unavailable');
    this.gl = gl;
    const program = shaderProgram(gl);
    gl.useProgram(program);
    this.uniform = Object.fromEntries([
      'pose', 'forward', 'right', 'up', 'offset', 'lens', 'faces', 'palette', 'state', 'stateWidth', 'group',
    ].map(name => [name, gl.getUniformLocation(program, name)]));
    this.faceTexture = texture(gl, 0, gl.TEXTURE_2D_ARRAY);
    this.stateTexture = texture(gl, 1, gl.TEXTURE_2D);
    this.paletteTexture = texture(gl, 2, gl.TEXTURE_2D);
    ['faces', 'state', 'palette'].forEach((name, i) => gl.uniform1i(this.uniform[name], i));
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    for (const [index, count, offset] of [[0, 3, 0], [1, 2, 12], [2, 1, 20], [3, 3, 24]]) {
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, count, gl.FLOAT, false, 36, offset);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  }

  setPuzzle(puzzle, palette, affects) {
    const { gl } = this;
    const groups = [];
    for (const [id, tile] of puzzle.stickers.entries()) {
      if (!tile.hiddenSticker) (groups[tile.face] ??= []).push({ tile, id });
    }
    const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (groups.length > gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS)) throw Error('Too many faces for this graphics device');
    const longest = Math.max(...groups.map(tiles => tiles.length));
    const budgetSide = 2 ** Math.floor(Math.log2(Math.sqrt((64 * 1024 ** 2) / (4 * groups.length))));
    const side = Math.min(limit, budgetSide, Math.max(512, 2 ** Math.ceil(Math.log2(Math.sqrt(longest) * 32))));
    const stateWidth = Math.min(limit, Math.max(1, Math.ceil(Math.sqrt(puzzle.state.length))));
    const stateHeight = Math.ceil(puzzle.state.length / stateWidth);
    const triangles = [];
    const rect = [[0,0],[1,0],[1,1],[0,1]];
    gl.activeTexture(gl.TEXTURE0);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R32UI, side, side, groups.length, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, null);
    const faces = groups.map((tiles, face) => {
      const { normal } = tiles[0].tile;
      const point = outlineOf(tiles[0].tile)[0][0];
      const origin = scale(normal, dot(normal, point));
      const right = unit(cross(Math.abs(normal[2]) < .8 ? [0,0,1] : [0,1,0], normal));
      const up = cross(normal, right);
      let left = Infinity, bottom = Infinity, rightmost = -Infinity, top = -Infinity;
      for (const { tile } of tiles) for (const polygon of outlineOf(tile)) for (const p of polygon) {
        const x = dot(p, right), y = dot(p, up);
        left = Math.min(left, x); rightmost = Math.max(rightmost, x);
        bottom = Math.min(bottom, y); top = Math.max(top, y);
      }
      const width = rightmost - left, height = top - bottom;
      const toUV = p => [(dot(p, right) - left) / width, (dot(p, up) - bottom) / height];
      const corners = rect.map(([u,v]) => add(origin, add(scale(right, left + u * width), scale(up, bottom + v * height))));
      for (const i of [0,1,2,0,2,3]) triangles.push(...corners[i], ...rect[i], face, ...normal);
      const project = polygons => polygons.map(polygon => polygon.map(p => toUV(p).map(v => v * side)));
      const image = new Uint32Array(side * side);
      for (const { tile, id } of tiles) {
        const outline = outlineOf(tile);
        rasterize(image, side, project(outline), id + 1);
        const center = tile.renderCenter ?? tile.center;
        const sticker = tile.stickerPolygon ? [tile.stickerPolygon] : outline.map(polygon =>
          polygon.map(p => add(scale(p, .96), scale(center, .04))));
        rasterize(image, side, project(sticker), (id + 1) | 0x80000000);
      }
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, face, side, side, 1, gl.RED_INTEGER, gl.UNSIGNED_INT, image);
      return { normal, origin, toUV, image };
    });
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(triangles), gl.STATIC_DRAW);
    gl.activeTexture(gl.TEXTURE1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16UI, stateWidth, stateHeight, 0, gl.RG_INTEGER, gl.UNSIGNED_SHORT, null);
    gl.activeTexture(gl.TEXTURE2);
    const bytes = Uint8Array.from(palette.flatMap(rgb => [...rgb, 255]));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, palette.length, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    if (gl.getError() !== gl.NO_ERROR) throw Error('Could not allocate puzzle face textures');
    Object.assign(this, { puzzle, faces, side, stateWidth, stateHeight, affects, vertexCount: triangles.length / 9,
      data: new Uint16Array(2 * stateWidth * stateHeight) });
    this.sync(puzzle.state);
  }

  sync(state) {
    this.colors = state;
    this.dirty = true;
  }

  update(active) {
    if (!this.dirty && this.active === active) return;
    const { gl, puzzle, data } = this;
    this.active = active;
    this.dirty = false;
    const byPose = new Map(), keys = new Map();
    this.groups = [];
    for (const [id, tile] of puzzle.stickers.entries()) {
      const pose = puzzle.poseFor?.(tile) ?? identity;
      let key = keys.get(pose);
      if (!key) {
        key = pose.flat().map(v => Math.round(v * 1e7)).join(',');
        keys.set(pose, key);
      }
      const moving = Boolean(active && this.affects(tile, active.turn));
      const signature = key + Number(moving);
      if (!byPose.has(signature)) {
        byPose.set(signature, this.groups.length);
        this.groups.push({ pose, moving });
      }
      data[2 * id] = this.colors[id];
      data[2 * id + 1] = byPose.get(signature);
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.stateWidth, this.stateHeight, gl.RG_INTEGER, gl.UNSIGNED_SHORT, data);
  }

  draw(view, active, fraction) {
    const { gl, canvas, uniform } = this;
    if (gl.isContextLost() || !view.width || !view.height) return false;
    this.update(active);
    const width = Math.round(view.width * view.dpr), height = Math.round(view.height * view.dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (const name of ['forward', 'right', 'up']) gl.uniform3fv(uniform[name], view[name]);
    gl.uniform2f(uniform.offset, 2 * view.center[0] / view.width - 1, 1 - 2 * view.center[1] / view.height);
    gl.uniform2f(uniform.lens, 2 * view.lens / view.width, 2 * view.lens / view.height);
    gl.uniform1i(uniform.stateWidth, this.stateWidth);
    const angle = active ? (active.turn.angle ?? active.direction * 2 * Math.PI / active.turn.order) * fraction : 0;
    for (const [id, group] of this.groups.entries()) {
      const pose = group.moving && angle ? group.pose.map(axis => rotate(axis, active.turn.normal, angle)) : group.pose;
      group.drawPose = pose;
      gl.uniformMatrix3fv(uniform.pose, false, pose.flat());
      gl.uniform1ui(uniform.group, id);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }
    return true;
  }

  pick([x, y], view) {
    const ray = add(scale(view.forward, -1), add(scale(view.right, (x - view.center[0]) / view.lens),
      scale(view.up, (view.center[1] - y) / view.lens)));
    let closest = null;
    for (const [group, { drawPose: pose }] of this.groups.entries()) {
      const localEye = pose.map(axis => dot(view.eye, axis));
      const localRay = pose.map(axis => dot(ray, axis));
      for (const { normal, origin, toUV, image } of this.faces) {
        const heading = dot(localRay, normal);
        if (heading >= 0) continue;
        const distance = dot(minus(origin, localEye), normal) / heading;
        if (distance < 0 || (closest && closest.distance <= distance)) continue;
        const point = add(localEye, scale(localRay, distance)), [u, v] = toUV(point);
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        const entry = image[Math.floor(v * this.side) * this.side + Math.floor(u * this.side)];
        const id = (entry & 0x7fffffff) - 1;
        if (id >= 0 && this.data[2 * id + 1] === group) {
          closest = { tile: this.puzzle.stickers[id], center: movedTo(point, pose), distance };
        }
      }
    }
    return closest;
  }
}
