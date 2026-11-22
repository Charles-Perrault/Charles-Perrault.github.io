import { add, dot, faceVertices, faces, rotate, scale, step } from './puzzle.mjs';

export const maxLayers = 100;
const vertexLevel = Math.sqrt(5) - 2;
const epsilon = 1e-9;
const average = vertices => scale(vertices.reduce(add), 1 / vertices.length);
const midpoint = (a, b) => scale(add(a, b), 0.5);

function clip(polygon, axis, limit, sign) {
  const points = [];
  for (const [i, a] of polygon.entries()) {
    const b = polygon[(i + 1) % polygon.length];
    const offset = sign * (dot(a, axis) - limit);
    const nextOffset = sign * (dot(b, axis) - limit);
    if (offset >= -epsilon) points.push(a);
    if ((offset < -epsilon && nextOffset > epsilon) || (offset > epsilon && nextOffset < -epsilon)) {
      points.push(add(a, scale(add(b, scale(a, -1)), offset / (offset - nextOffset))));
    }
  }
  return points;
}

function cutFace(polygon, cutAxes, cuts) {
  let regions = [polygon];
  for (const axis of cutAxes) for (const threshold of cuts) {
    const next = [];
    for (const region of regions) {
      const values = region.map(point => dot(point, faces[axis]) - threshold);
      if (values.some(x => x < -epsilon) && values.some(x => x > epsilon)) {
        next.push(clip(region, faces[axis], threshold, 1), clip(region, faces[axis], threshold, -1));
      } else next.push(region);
    }
    regions = next;
  }
  return regions;
}

const sharedEdge = (face, vertex, next) => faces.findIndex((axis, i) =>
  i !== face && dot(vertex, axis) > 1 - epsilon && dot(next, axis) > 1 - epsilon);
const limitsFor = (n, count) => Array.from({ length: count }, (_, i) => 1 - (1 - vertexLevel) * (i + 1) / n);
const bin = (point, normal) => [normal, ...point.map(x => Math.round(x * 1e7))].join(',');

export function tileInLayer(tile, face, layer) {
  return tile.bands ? tile.bands[face] === layer : layer === 1 && tile.layerFaces.includes(face);
}

export class LayeredMinx {
  constructor(size) {
    if (!Number.isInteger(size) || size < 2 || size > maxLayers) throw new RangeError('Unsupported layer count');
    this.size = size;
    this.depth = Math.floor(size / 2);
    this.stickers = [];
    this.byPoint = new Map();
    this.permutations = new Map();
    this.cycles = new Map();
    this.sliceIds = new Array(faces.length);
    const even = size % 2 === 0;
    const limits = limitsFor(size, this.depth - Number(even));
    for (const [face, ring] of faceVertices.entries()) {
      const neighbors = ring.map((point, i) => sharedEdge(face, point, ring[(i + 1) % 5]));
      const sectors = even ? ring.map((point, i) => {
        const previous = (i + 4) % 5;
        return { polygon: [point, midpoint(point, ring[(i + 1) % 5]), faces[face], midpoint(ring[previous], point)],
          axes: [neighbors[i], neighbors[previous]] };
      }) : [{ polygon: ring, axes: neighbors }];
      for (const { polygon, axes } of sectors) for (const cell of cutFace(polygon, axes, limits)) {
        const point = average(cell);
        const bands = new Uint8Array(12);
        bands[face] = 1;
        for (const axis of axes) {
          const position = dot(point, faces[axis]);
          const band = limits.findIndex(limit => position > limit);
          if (band >= 0) bands[axis] = band + 1;
          else if (even) bands[axis] = this.depth;
        }
        const id = this.stickers.length;
        this.byPoint.set(bin(point, face), id);
        this.stickers.push({ face, normal: faces[face], point, polygon: cell, bands,
          inset: cell.map(v => add(scale(v, 0.91), scale(point, 0.09))) });
      }
    }
    this.reset();
  }
  reset() { this.state = Uint8Array.from(this.stickers, tile => tile.face); }
  get solved() { return this.state.every((color, id) => color === this.stickers[id].face); }

  permutation(face, layer) {
    const key = face * this.depth + layer;
    if (this.permutations.has(key)) return this.permutations.get(key);
    const axis = faces[face];
    const faceMap = faces.map(normal => {
      const rotated = rotate(normal, axis, -step);
      return faces.findIndex(candidate => dot(candidate, rotated) > 1 - epsilon);
    });
    if (!this.sliceIds[face]) {
      const layers = Array.from({ length: this.depth + 1 }, () => []);
      for (let id = 0; id < this.stickers.length; id++) {
        const band = this.stickers[id].bands[face];
        if (band) layers[band].push(id);
      }
      this.sliceIds[face] = layers;
    }
    const entries = [];
    for (const id of this.sliceIds[face][layer]) {
      const tile = this.stickers[id];
      const point = rotate(tile.point, axis, -step);
      const to = this.byPoint.get(bin(point, faceMap[tile.face]));
      if (to === undefined || !tileInLayer(this.stickers[to], face, layer)) throw new Error('Invalid layered turn');
      if (to !== id) entries.push(id, to);
    }
    const result = Uint32Array.from(entries);
    this.permutations.set(key, result);
    this.sliceIds[face][layer] = null;
    return result;
  }

  turn(face, direction = 1, layer = 1) {
    if (!Number.isInteger(layer) || layer < 1 || layer > this.depth) throw new RangeError('Unsupported turn layer');
    const key = face * this.depth + layer;
    if (!this.cycles.has(key)) {
      const entries = this.permutation(face, layer);
      const bySource = new Map();
      for (let i = 0; i < entries.length; i += 2) bySource.set(entries[i], entries[i + 1]);
      const cycles = [];
      for (const from of bySource.keys()) {
        let next = from;
        do {
          const destination = bySource.get(next);
          cycles.push(next);
          bySource.delete(next);
          next = destination;
        } while (next !== from);
      }
      this.cycles.set(key, Uint32Array.from(cycles));
    }
    const state = this.state, cycles = this.cycles.get(key);
    for (let i = 0; i < cycles.length; i += 5) {
      const a = cycles[i], b = cycles[i + 1], c = cycles[i + 2], d = cycles[i + 3], e = cycles[i + 4];
      if (direction > 0) {
        const last = state[e];
        state[e] = state[d]; state[d] = state[c]; state[c] = state[b]; state[b] = state[a]; state[a] = last;
      } else {
        const first = state[a];
        state[a] = state[b]; state[b] = state[c]; state[c] = state[d]; state[d] = state[e]; state[e] = first;
      }
    }
  }
}

export function layeredScramble(length, depth, random = Math.random) {
  const moves = [];
  for (let i = 0; i < length; i++) {
    const previous = moves.at(-1);
    const count = 12 * depth;
    let index = Math.floor(random() * (previous ? count - 1 : count));
    if (previous && index >= previous.face * depth + previous.layer - 1) index++;
    moves.push({ face: Math.floor(index / depth), layer: index % depth + 1, direction: random() < 0.5 ? -1 : 1 });
  }
  return moves;
}
