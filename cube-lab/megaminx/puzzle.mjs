const phi = (1 + Math.sqrt(5)) / 2;
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const scale = (v, s) => v.map(x => x * s);
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const unit = v => scale(v, 1 / Math.hypot(...v));
const mix = (a, b, t) => add(scale(a, 1 - t), scale(b, t));
const mean = points => scale(points.reduce(add), 1 / points.length);
export const step = 2 * Math.PI / 5;

export function rotate(v, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, dot(axis, v) * (1 - c)));
}

const normals = [];
for (const a of [1, -1]) for (const b of [1, -1]) {
  normals.push(unit([0, a, b * phi]), unit([b * phi, 0, a]), unit([a, b * phi, 0]));
}
export const colors = [
  ['White', '#f0ebd8'], ['Orange', '#ed8239'], ['Yellow', '#f6cc47'], ['Blue', '#428ee5'],
  ['Pink', '#ee83ac'], ['Mint', '#6dd3b1'], ['Violet', '#a07bdd'], ['Green', '#35975a'],
  ['Red', '#df5151'], ['Grey', '#8c9baa'], ['Lime', '#b7d460'], ['Cream', '#eac28b'],
];
const vertices = normals.map(() => []);
const adjacent = (a, b) => dot(normals[a], normals[b]) > 0.44;
for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) for (let c = b + 1; c < 12; c++) {
  if (!adjacent(a, b) || !adjacent(b, c) || !adjacent(a, c)) continue;
  const faces = [a, b, c];
  const v = scale(faces.map(i => normals[i]).reduce(add), 1 / (1 + 2 / Math.sqrt(5)));
  for (const face of faces) vertices[face].push({ v, faces });
}

export const stickers = [];
for (const [face, normal] of normals.entries()) {
  const ring = vertices[face];
  const right = unit(add(ring[0].v, scale(normal, -1)));
  const up = cross(normal, right);
  const angle = ({ v }) => Math.atan2(dot(v, up), dot(v, right));
  ring.sort((a, b) => angle(a) - angle(b));
  const inner = ring.map(({ v }) => mix(normal, v, 0.51));
  const addSticker = (polygon, layerFaces) => {
    const point = mean(polygon);
    stickers.push({ face, normal, point, polygon, inset: polygon.map(v => mix(point, v, 0.91)), layerFaces });
  };
  addSticker(inner, [face]);
  for (let i = 0; i < 5; i++) {
    const next = (i + 1) % 5, prev = (i + 4) % 5;
    const v = ring[i].v, w = ring[next].v;
    const start = mix(v, w, 0.32), end = mix(v, w, 0.68);
    addSticker([v, start, inner[i], mix(v, ring[prev].v, 0.32)], ring[i].faces);
    addSticker([start, end, inner[next], inner[i]], ring[i].faces.filter(f => ring[next].faces.includes(f)));
  }
}

export const faces = normals;
export const faceVertices = vertices.map(ring => ring.map(({ v }) => v));
const destinations = faces.map((axis, face) => stickers.map((tile, id) => {
  if (!tile.layerFaces.includes(face)) return id;
  const point = rotate(tile.point, axis, -step);
  const normal = rotate(tile.normal, axis, -step);
  const index = stickers.findIndex(candidate =>
    dot(candidate.normal, normal) > 0.999999 && Math.hypot(...add(candidate.point, scale(point, -1))) < 1e-6);
  if (index < 0) throw new Error('Invalid Megaminx turn geometry');
  return index;
}));

export class Megaminx {
  constructor() { this.reset(); }
  reset() { this.state = Uint8Array.from(stickers, tile => tile.face); }
  get solved() { return this.state.every((color, id) => color === stickers[id].face); }
  turn(face, direction = 1) {
    const permutation = destinations[face];
    const next = new Uint8Array(stickers.length);
    for (const [from, to] of permutation.entries()) {
      if (direction > 0) next[to] = this.state[from];
      else next[from] = this.state[to];
    }
    this.state = next;
  }
}

export function scramble(length = 70, random = Math.random) {
  const moves = [];
  let previous = -1;
  for (let i = 0; i < length; i++) {
    let face = Math.floor(random() * (previous < 0 ? 12 : 11));
    if (previous >= 0 && face >= previous) face++;
    moves.push({ face, direction: random() < 0.5 ? -1 : 1 });
    previous = face;
  }
  return moves;
}
