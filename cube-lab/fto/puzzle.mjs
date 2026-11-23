const palette = [
  ['U', '#f5f2e6', [1, 1, 1]], ['R', '#da404b', [1, 1, -1]],
  ['F', '#2f9b58', [-1, 1, 1]], ['BR', '#3b91df', [1, -1, 1]],
  ['L', '#ef8c42', [-1, 1, -1]], ['B', '#edc53b', [1, -1, -1]],
  ['BL', '#a66cdb', [-1, -1, 1]], ['D', '#8295a4', [-1, -1, -1]],
];

export const step = 2 * Math.PI / 3;
export const faces = palette.map(([name, color, signs]) => ({
  name, color, signs,
  normal: signs.map(value => value / Math.sqrt(3)),
}));
const signKey = ([x, y, z]) => Number(x < 0) * 4 + Number(y < 0) * 2 + Number(z < 0);
const faceIndex = new Uint8Array(8);
faces.forEach(({ signs }, id) => { faceIndex[signKey(signs)] = id; });
const index = (n, x, y, parity) => y * (2 * n - y) + 2 * x + parity;
export const moveDepth = n => Math.floor(n / 2);

export function sizeIsValid(size) {
  return Number.isSafeInteger(size) && size >= 2 && Number.isSafeInteger(8 * size ** 2);
}

function rotation(axis, face, direction) {
  const a = faces[axis].signs;
  const b = faces[face].signs;
  const clockwise = direction * a[0] * a[1] * a[2] > 0;
  const source = clockwise ? [1, 2, 0] : [2, 0, 1];
  const signs = source.map((s, i) => a[s] * b[s] * a[i]);
  return { source, face: faceIndex[signKey(signs)] };
}

export function layerAt(size, axis, point) {
  const a = faces[axis].signs;
  return Math.min(size, Math.floor((1 - (a[0] * point[0] + a[1] * point[1] + a[2] * point[2])) * size / 2) + 1);
}

export function* scrambleMoves(size, random = Math.random, outerOnly = false) {
  const depth = outerOnly ? 1 : moveDepth(size);
  let previous = -1;
  for (let i = 0; i < 20 * size; i++) {
    const range = 8 * depth;
    let id = Math.floor(random() * (range - Number(previous >= 0)));
    if (previous >= 0 && id >= previous) id++;
    yield { axis: Math.floor(id / depth), layer: id % depth + 1, direction: random() < 0.5 ? -1 : 1 };
    previous = id;
  }
}

export class Octahedron {
  constructor(size) {
    if (!sizeIsValid(size)) throw new RangeError('Enter a whole size of at least 2.');
    this.size = size;
    this.depth = moveDepth(size);
    this.faceArea = size ** 2;
    this.state = new Uint8Array(8 * this.faceArea);
    this.buffer = new Uint8Array(this.state.length);
    this.reset();
  }

  reset() {
    for (let face = 0; face < 8; face++) this.state.fill(face, face * this.faceArea, (face + 1) * this.faceArea);
  }

  get solved() {
    return this.state.every((color, id) => color === this.state[id - id % this.faceArea]);
  }

  turn(axis, layer = 1, direction = 1) {
    if (!faces[axis] || !Number.isInteger(layer) || layer < 1 || layer > this.depth || ![1, -1].includes(direction)) {
      throw new RangeError('Invalid octahedron turn.');
    }
    const n = this.size, area = this.faceArea, axisSigns = faces[axis].signs, side = 3 * n;
    this.buffer.set(this.state);
    for (let face = 0; face < 8; face++) {
      const { source, face: target } = rotation(axis, face, direction);
      const [sx, sy, sz] = faces[face].signs.map((sign, i) => sign * axisSigns[i]);
      // The opposite face never intersects any of the turns from this side.
      if (sx === -1 && sy === -1 && sz === -1) continue;
      // Whole parallel rows have the same fixed coordinate. Bound the two
      // varying coordinates before enumerating stickers in the cut slab.
      const low = 6 * (layer - 1), high = 6 * layer;
      const origin = side * (1 - sz), xCoefficient = sz - sx, yCoefficient = sz - sy;
      for (let row = 0; row < n; row++) {
        const rowIndex = row * (2 * n - row);
        for (let parity = 0; parity < 2; parity++) {
          let first = 0, last = n - row - parity - 1;
          const residual = origin + yCoefficient * (3 * row + 1 + parity) + xCoefficient * (1 + parity);
          if (xCoefficient === 0) {
            if (residual < low || residual >= high) continue;
          } else if (xCoefficient > 0) {
            first = Math.max(0, Math.ceil((low - residual) / 6));
            last = Math.min(last, Math.floor((high - 1 - residual) / 6));
          } else {
            first = Math.max(0, Math.ceil((residual - high + 1) / 6));
            last = Math.min(last, Math.floor((residual - low) / 6));
          }
          const point = [0, 3 * row + 1 + parity, 0];
          for (let column = first; column <= last; column++) {
            point[0] = 3 * column + 1 + parity;
            point[2] = side - point[0] - point[1];
            const x = (point[source[0]] - 1 - parity) / 3;
            const y = (point[source[1]] - 1 - parity) / 3;
            this.buffer[target * area + index(n, x, y, parity)] = this.state[face * area + rowIndex + 2 * column + parity];
          }
        }
      }
    }
    [this.state, this.buffer] = [this.buffer, this.state];
  }

}
