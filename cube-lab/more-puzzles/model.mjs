import solids from './solids.mjs';
import { dodecacopter } from './dodecacopter.mjs?v=3';
import { styleRedi } from './redi-style.mjs?v=2';
import { add, cross, dot, rotate, scale } from '../pyraminx/renderer.mjs';

const signs = [1, -1];
const diagonals = signs.flatMap(x => signs.flatMap(y => signs.map(z => [x, y, z])));
const unit = point => scale(point, 1 / Math.hypot(...point));
const sub = (a, b) => add(a, scale(b, -1));
const spaced = (n, radius) => Array.from({ length: n - 1 }, (_, i) => radius * (2 * (i + 1) / n - 1));

export const variants = {
  skewb: ['Skewb', 2],
  redi: ['Redi Cube', 3],
  dodecacopter: ['Dodecacopter', 3],
  tuttminx: ['Tuttminx', 2],
  hypercube: ['4D Cube', 3],
};

function geometry(kind, n) {
  const root = Math.sqrt(3);
  const axis = (normal, order, cuts, ranges) => ({ normal: unit(normal), order, cuts, ranges });
  const caps = count => Array.from({ length: count }, (_, i) => [i + 1, count]);
  if (kind === 'skewb') {
    const cuts = spaced(n, root).map(h => Math.abs(Math.abs(h) - 1 / root) < 1e-6 ? h + 0.013 : h);
    return [solids.cube, diagonals.filter(([x,y,z]) => x * y * z > 0).map(v =>
      axis(v, 3, cuts, [...caps(cuts.length), ...cuts.map((_, i) => [0, i])]))];
  }
  if (kind === 'redi') {
    const cuts = Array.from({ length: n - 2 }, (_, i) => (1 + (i + 0.5) / (n - 2)) / root);
    return [solids.cube, diagonals.map(v => axis(v, 3, cuts, caps(cuts.length)))];
  }
  return [solids.tuttminx, solids.tuttminx.map(([normal, height, polygon]) => {
    const cuts = Array.from({ length: n - 1 }, (_, i) => height - .35 * (1 - i / (n - 1)));
    return axis(normal, polygon.length === 5 ? 5 : 3, cuts, caps(cuts.length));
  })];
}

function cut(polygon, normal, height) {
  const distances = polygon.map(p => dot(p, normal) - height);
  if (Math.min(...distances) >= -1e-8 || Math.max(...distances) <= 1e-8) return [polygon];
  const upper = [], lower = [];
  for (const [i, a] of polygon.entries()) {
    const j = (i + 1) % polygon.length, da = distances[i], db = distances[j];
    if (da >= -1e-8) upper.push(a);
    if (da <= 1e-8) lower.push(a);
    if (da * db < 0 && Math.min(Math.abs(da), Math.abs(db)) > 1e-8) {
      const point = add(a, scale(sub(polygon[j], a), da / (da - db)));
      upper.push(point);
      lower.push(point);
    }
  }
  return [upper, lower];
}

function centroid(polygon) {
  let sum = [0, 0, 0], weights = 0;
  const a = polygon[0];
  for (let i = 1; i < polygon.length - 1; i++) {
    const b = polygon[i], c = polygon[i + 1];
    const weight = Math.hypot(...cross(sub(b, a), sub(c, a)));
    sum = add(sum, scale(add(add(a, b), c), weight));
    weights += weight;
  }
  return scale(sum, 1 / (3 * weights));
}

const grid = p => p.map(x => Math.round(1000 * x));
export function inTurn(point, { normal, cuts, low, high }) {
  const depth = dot(point, normal);
  return depth >= (cuts[low - 1] ?? -Infinity) && depth <= (cuts[high] ?? Infinity);
}

export function spatialPuzzle(kind, n) {
  if (kind === 'dodecacopter') return dodecacopter(n);
  const [faces, axes] = geometry(kind, n);
  const radius = Math.max(...faces.flatMap(([, , polygon]) => polygon.map(p => Math.hypot(...p))));
  const normalizedAxes = axes.map(a => ({ ...a, cuts: a.cuts.map(h => h / radius) }));
  const stickers = faces.flatMap(([normal, , vertices], face) => {
    let polygons = [vertices.map(p => scale(p, 1 / radius))];
    for (const { normal: axis, cuts } of normalizedAxes) {
      for (const h of cuts) polygons = polygons.flatMap(polygon => cut(polygon, axis, h));
    }
    return polygons.map(polygon => ({ face, normal, polygon, center: centroid(polygon) }));
  });
  const locations = new Map();
  stickers.forEach(({ center }, id) => {
    const key = grid(center).join(',');
    if (!locations.has(key)) locations.set(key, []);
    locations.get(key).push(id);
  });
  const home = Uint8Array.from(stickers, tile => tile.face);
  const moves = normalizedAxes.flatMap(({ normal, order, cuts, ranges }, axis) =>
    ranges.map(([low, high]) => ({ normal, order, cuts, low, high, name: `Axis ${axis + 1} · ${low + 1}${low === high ? '' : '–' + (high + 1)}` })));
  const state = home.slice();
  const palette = kind === 'redi' ? styleRedi(stickers, n) : undefined;
  return { stickers, moves, home, state, palette, turn(move, direction) {
    const { normal, order } = move;
    const angle = direction * 2 * Math.PI / order;
    const next = state.slice();
    const destinations = new Set();
    for (const [id, { center }] of stickers.entries()) {
      if (!inTurn(center, move)) continue;
      const target = rotate(center, normal, angle);
      const [x, y, z] = grid(target);
      let found;
      for (const dx of [0, -1, 1]) for (const dy of [0, -1, 1]) for (const dz of [0, -1, 1]) {
        const bucket = locations.get(`${x + dx},${y + dy},${z + dz}`);
        if (found === undefined) found = bucket?.find(i => Math.hypot(...sub(stickers[i].center, target)) < 1e-7);
      }
      if (found === undefined || destinations.has(found)) throw new Error('The selected cut does not produce a valid turn.');
      destinations.add(found);
      next[found] = state[id];
    }
    state.set(next);
  } };
}

const coordinates = ['X', 'Y', 'Z', 'W'];
export function hypercube(n) {
  const area = n ** 3, count = 8 * area;
  const home = Uint8Array.from({ length: count }, (_, id) => Math.floor(id / area));
  const state = home.slice(), next = home.slice();
  const moves = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    for (let c = 0; c < 4; c++) if (c !== a && c !== b) {
      for (let layer = 0; layer < n; layer++) {
        moves.push({ a, b, c, layer, name: `${coordinates[a]}${coordinates[b]} · ${coordinates[c]} ${layer + 1}` });
      }
    }
  }
  const p = [0, 0, 0, 0];
  function destination(id, { a, b, c, layer }, direction) {
    const cell = home[id], axis = cell >> 1, positive = !(cell % 2);
    let offset = id % area;
    for (let i = 3; i >= 0; i--) {
      p[i] = i === axis ? (positive ? n - 1 : 0) : offset % n;
      if (i !== axis) offset = Math.floor(offset / n);
    }
    if (p[c] !== layer) return id;
    const pa = p[a], pb = p[b];
    p[a] = direction > 0 ? n - 1 - pb : pb;
    p[b] = direction > 0 ? pa : n - 1 - pa;
    const destAxis = axis === a ? b : axis === b ? a : axis;
    const destPositive = axis === (direction > 0 ? b : a) ? !positive : positive;
    let dest = 0;
    for (let i = 0; i < 4; i++) if (i !== destAxis) dest = dest * n + p[i];
    return (2 * destAxis + Number(!destPositive)) * area + dest;
  }
  return { n, home, state, moves, destination, turn(move, direction) {
    for (let id = 0; id < count; id++) {
      next[destination(id, move, direction)] = state[id];
    }
    state.set(next);
  } };
}
