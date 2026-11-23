import { Cube, faceCoordinates, parseMoves, solvedColors } from './cube.mjs?v=14';
import { planAllCentersInPlace } from './solver.mjs?v=15';

// White-side edges first, then yellow-side edges, then the four between them.
const edgeFaces = [
  [3, 2], [3, 1], [3, 5], [3, 4],
  [0, 2], [0, 1], [0, 5], [0, 4],
  [5, 1], [5, 4], [2, 4], [2, 1],
];
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const axisOf = (normal) => normal.findIndex(Boolean);
const colorPair = (first, second) => first * 6 + second;
const invert = (moves) => [...moves].reverse().map((move) => ({
  ...move, turns: move.turns === 2 ? 2 : -move.turns,
}));

function edgeSlots(last, depth, mirrored) {
  return edgeFaces.flatMap((pair) => {
    const [a, b] = pair.map((face) => axisOf(faceCoordinates[face].normal));
    const free = 3 - a - b;
    return (mirrored ? [depth, last - depth] : [depth]).map((layer) => {
      const point = [];
      point[free] = layer;
      for (const face of pair) {
        const normal = faceCoordinates[face].normal;
        const axis = axisOf(normal);
        point[axis] = normal[axis] > 0 ? last : 0;
      }
      // This orientation convention follows a wing through any legal turn.
      const sign = faceCoordinates[pair[0]].normal[a] * faceCoordinates[pair[1]].normal[b];
      const cross = (a + 1) % 3 === b ? sign : -sign;
      const swap = mirrored && cross !== (layer === depth ? 1 : -1);
      const faces = swap ? [...pair].reverse() : pair;
      return faces.map((face) => {
        const { row, col } = faceCoordinates[face];
        return {
          face,
          row: dot(point, row) + (row.includes(-1) ? last : 0),
          col: dot(point, col) + (col.includes(-1) ? last : 0),
        };
      });
    });
  });
}

function readPair(cube, slots) {
  return colorPair(...slots.map(({ face, row, col }) => cube.stickerAt(face, row, col)));
}

const wingCount = 24;
const tripleId = (a, b, c) => (a * wingCount + b) * wingCount + c;
let insertionTable;

function buildInsertionTable() {
  const slots = edgeSlots(3, 1, true);
  const permutation = (moves) => {
    const cube = new Cube(4);
    slots.forEach((stickers, index) => {
      for (const { face, row, col } of stickers) cube.faces[face][row * 4 + col] = index;
    });
    for (const move of moves) cube.apply(move);
    const destinations = [];
    slots.forEach(([{ face, row, col }], index) => {
      destinations[cube.stickerAt(face, row, col)] = index;
    });
    return destinations;
  };
  // The reference solver inserts a wing with a slice and a conjugated face turn.
  const insertion = parseMoves("1m F R' F' 1m' F R F'", 4);
  const insertPermutation = permutation(insertion);
  const a = insertPermutation.findIndex((to, from) => to !== from);
  const b = insertPermutation[a];
  const root = [a, b, insertPermutation[b]];
  const generators = parseMoves("U U' R R' F F' D D' L L' B B'", 4).map((move) => [move]);
  generators.push(insertion, invert(insertion));
  const actions = generators.map(permutation);
  const queue = [root];
  const paths = new Map([[tripleId(...root), null]]);
  for (const triple of queue) {
    const previous = tripleId(...triple);
    actions.forEach((action, generator) => {
      const next = triple.map((slot) => action[slot]);
      const id = tripleId(...next);
      if (paths.has(id)) return;
      paths.set(id, { previous, generator });
      queue.push(next);
    });
  }
  return { insertion, generators, paths };
}

function wingCycle(from, to, spare, depth, last) {
  const { insertion, generators, paths } = insertionTable ??= buildInsertionTable();
  const id = tripleId(from, to, spare);
  if (!paths.has(id)) throw new Error('Could not align edge wings for insertion.');
  const steps = [];
  for (let path = paths.get(id); path; path = paths.get(path.previous)) {
    steps.push(generators[path.generator]);
  }
  const setup = steps.reverse().flat();
  const layers = [0, depth, last - depth, last];
  return [...invert(setup), ...insertion, ...setup].map((move) => ({ ...move, layer: layers[move.layer] }));
}

function isOddPermutation(current, target) {
  const order = new Map(target.map((piece, index) => [piece, index]));
  let odd = false;
  for (let a = 0; a < current.length; a++) {
    for (let b = a + 1; b < current.length; b++) {
      if (order.get(current[a]) > order.get(current[b])) odd = !odd;
    }
  }
  return odd;
}

function pairWingOrbit(cube, depth, middle, emit) {
  const last = cube.size - 1;
  const slots = edgeSlots(last, depth, true);
  const target = slots.map((stickers, index) => {
    const colors = stickers.map(({ face }) => middle?.[index >> 1].get(face) ?? solvedColors[face]);
    return colorPair(...colors);
  });
  let current = slots.map((stickers) => readPair(cube, stickers));
  if (isOddPermutation(current, target)) {
    // Flip both wings of one edge at this depth. Middle edges and centers stay put.
    const near = depth + 'm';
    const far = (last - depth) + 'm';
    emit(parseMoves(`${far}2 B2 U2 ${near} U2 ${far} U2 ${far}' U2 F2 ${far}' F2 ${near}' B2 ${far}2`, cube.size));
    current = slots.map((stickers) => readPair(cube, stickers));
  }
  for (let to = 0; to < wingCount; to++) {
    if (current[to] === target[to]) continue;
    const from = current.indexOf(target[to]);
    const spare = current.findIndex((piece, index) => index !== from && index !== to && piece !== target[index]);
    if (from < 0 || spare < 0) throw new Error('Could not resolve edge pairing parity.');
    emit(wingCycle(from, to, spare, depth, last));
    [current[to], current[spare], current[from]] = [current[from], current[to], current[spare]];
  }
}

export function solveEdges(source, onProgress, candidates, onMove) {
  return planEdgesInPlace(source.clone(), onProgress, candidates, undefined, onMove);
}

export function planEdgesInPlace(cube, onProgress = () => {}, candidates, planCenters = planAllCentersInPlace, onMove = () => {}) {
  const { size } = cube;
  if (size === 2) return [];
  const moves = planCenters(cube, onProgress, candidates, onMove);
  onProgress('edges', 0);
  if (cube.hasPairedEdges()) return moves;

  const last = size - 1;
  const orbitCount = Math.floor((size - 2) / 2);
  // On odd cubes the middle piece determines where its matching wings belong.
  const middle = size % 2 ? edgeSlots(last, last / 2, false).map((slots) => new Map(
    slots.map(({ face, row, col }) => [face, cube.stickerAt(face, row, col)]),
  )) : null;
  const emit = (sequence) => {
    for (const move of sequence) {
      cube.apply(move);
      onMove(move);
    }
    moves.push(...sequence);
  };
  for (let depth = 1; depth <= orbitCount; depth++) {
    pairWingOrbit(cube, depth, middle, emit);
    onProgress('edges', depth / orbitCount);
  }
  if (!cube.hasSolvedCenters() || !cube.hasPairedEdges()) throw new Error('Edge pairing verification failed.');
  return moves;
}
