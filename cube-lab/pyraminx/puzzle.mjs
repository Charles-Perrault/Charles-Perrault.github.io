const palette = [
  ['U', '#dfca43', [1, 1, 1]], ['L', '#df4d4f', [1, -1, -1]],
  ['R', '#4791dd', [-1, 1, -1]], ['B', '#50ad65', [-1, -1, 1]],
];
const radius = 0.82;
export const step = 2 * Math.PI / 3;
export const vertices = palette.map(([, , signs]) => signs.map(sign => sign * radius));
export const faces = palette.map(([name, color, signs], omitted) => ({
  name, color, signs,
  normal: signs.map(sign => -sign / Math.sqrt(3)),
  axis: signs.map(sign => sign / Math.sqrt(3)),
  corners: [0, 1, 2, 3].filter(vertex => vertex !== omitted),
}));
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const index = (size, x, y, parity) => y * (2 * size - y) + 2 * x + parity;
export const planeDistance = radius;
export const moveDepth = size => size - 1;

export function sizeIsValid(size) {
  return Number.isSafeInteger(size) && size >= 2 && Number.isSafeInteger(4 * size ** 2);
}

export function layerAt(size, axis, point) {
  const coordinate = (1 + dot(point, faces[axis].signs) / radius) / 4;
  return Math.floor((1 - coordinate) * size + 1e-9) + 1;
}

const rotations = faces.map(({ axis }, tip) => [1, -1].map(direction => vertices.map((point, vertex) => {
  if (tip === vertex) return tip;
  const perpendicular = cross(axis, point);
  const rotated = point.map((value, i) => -0.5 * value + 1.5 * dot(axis, point) * axis[i]
    - direction * Math.sqrt(3) / 2 * perpendicular[i]);
  return vertices.findIndex(candidate => dot(candidate, rotated) > 3 * radius ** 2 - 1e-8);
})));

export function* scrambleMoves(size, random = Math.random, amount = 20 * size) {
  const depth = moveDepth(size);
  let previous = -1;
  for (let i = 0; i < amount; i++) {
    const range = 4 * depth;
    let id = Math.floor(random() * (range - Number(previous >= 0)));
    if (previous >= 0 && id >= previous) id++;
    yield { axis: Math.floor(id / depth), layer: id % depth + 1, direction: random() < 0.5 ? -1 : 1 };
    previous = id;
  }
}

export function forEachTransfer(size, axis, layer, direction, visit) {
  const rotation = rotations[axis][Number(direction < 0)];
  const area = size ** 2;
  const low = 3 * (size - layer), high = low + 3;
  for (const [face, { corners }] of faces.entries()) {
    if (face === axis) continue;
    const slot = corners.indexOf(axis);
    const target = rotation[face];
    const coordinates = faces[target].corners.map(vertex => corners.findIndex(source => rotation[source] === vertex));
    for (let row = 0; row < size; row++) {
      for (let parity = 0; parity < 2; parity++) {
        let first = 0, last = size - row - parity - 1;
        const y = 3 * row + 1 + parity;
        const offset = 1 + parity;
        if (slot === 0) {
          first = Math.max(0, Math.ceil((low - offset) / 3));
          last = Math.min(last, Math.floor((high - 1 - offset) / 3));
        } else if (slot === 1) {
          if (y <= low || y >= high) continue;
        } else {
          const residual = 3 * size - y - offset;
          first = Math.max(0, Math.ceil((residual - high + 1) / 3));
          last = Math.min(last, Math.floor((residual - low) / 3));
        }
        for (let column = first; column <= last; column++) {
          const x = 3 * column + offset;
          const z = 3 * size - x - y;
          const coordinate0 = coordinates[0] === 0 ? x : coordinates[0] === 1 ? y : z;
          const coordinate1 = coordinates[1] === 0 ? x : coordinates[1] === 1 ? y : z;
          const toX = (coordinate0 - offset) / 3;
          const toY = (coordinate1 - offset) / 3;
          visit(face * area + index(size, column, row, parity), target * area + index(size, toX, toY, parity));
        }
      }
    }
  }
}

export class Pyraminx {
  constructor(size) {
    if (!sizeIsValid(size)) throw new RangeError('Enter a whole size of at least 2.');
    this.size = size;
    this.depth = moveDepth(size);
    this.faceArea = size ** 2;
    this.state = new Uint8Array(4 * this.faceArea);
    // Only a triangular band on three faces moves. Keep its destinations in
    // scratch space and update the main state once the band has been read.
    this.destinations = new Uint32Array(6 * size);
    this.stickers = new Uint8Array(6 * size);
    this.reset();
  }

  reset() {
    for (let face = 0; face < 4; face++) this.state.fill(face, face * this.faceArea, (face + 1) * this.faceArea);
  }

  get solved() {
    return this.state.every((color, id) => color === Math.floor(id / this.faceArea));
  }

  turn(axis, layer = 1, direction = 1) {
    if (!faces[axis] || !Number.isInteger(layer) || layer < 1 || layer > this.depth || ![1, -1].includes(direction)) {
      throw new RangeError('Invalid Pyraminx turn.');
    }
    let count = 0;
    forEachTransfer(this.size, axis, layer, direction, (from, to) => {
      this.destinations[count] = to;
      this.stickers[count++] = this.state[from];
    });
    for (let i = 0; i < count; i++) this.state[this.destinations[i]] = this.stickers[i];
  }
}
