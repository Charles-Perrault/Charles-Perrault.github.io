import { Cube, faceCoordinates, parseMoves } from './cube.mjs?v=17';
import { parseFacelets } from './vendor/optimal3/engine.mjs';

const size = 3;
const area = size * size;
const stickerCount = faceCoordinates.length * area;
const indices = Array.from({ length: stickerCount }, (_, i) => i);
const faceOf = slot => Math.floor(slot / area);
const speffzFaces = [0, 4, 2, 1, 5, 3]; // U L F R B D
const pieces = new Map();
for (const [face, { normal, row, col }] of faceCoordinates.entries()) {
  for (let i = 0; i < area; i++) {
    const position = normal.map((value, axis) =>
      value + (Math.floor(i / size) - 1) * row[axis] + (i % size - 1) * col[axis]);
    const key = position.join(',');
    if (!pieces.has(key)) pieces.set(key, []);
    pieces.get(key).push(face * area + i);
  }
}
const pieceAt = [];
const homeSlots = new Map();
const pieceKey = faces => faces.reduce((key, face) => key | (1 << face), 0);
for (const piece of pieces.values()) {
  for (const slot of piece) pieceAt[slot] = piece;
  homeSlots.set(pieceKey(piece.map(faceOf)), piece);
}

function facelets(cube) {
  return indices.map(slot => cube.stickerAt(faceOf(slot), Math.floor(slot % area / size), slot % size));
}

function permutation(moves) {
  const labeled = new Cube(size, faceCoordinates.map((_, face) =>
    Uint8Array.from(indices.slice(face * area, (face + 1) * area))));
  for (const move of moves) labeled.apply(move);
  return facelets(labeled);
}

const inverse = moves => moves.slice().reverse().map(move => ({ ...move, turns: move.turns === 2 ? 2 : -move.turns }));
const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
const yPerm = "R U' R' U' R U R' F' R U R' U' R' F R";
const parity = parseMoves("R U' R' U' R U R D R' U' R D' R' U2 R' U'", size);

// Old Pochmann uses UR and ULB buffers and disjoint collateral swaps.
// https://www.stefan-pochmann.info/spocc/blindsolving/3x3/old.php
function buildMethod(offsets, buffer, target, algorithm, allowed) {
  const slots = speffzFaces.flatMap(face => offsets.map(offset => face * area + offset));
  const main = parseMoves(algorithm, size);
  const turns = allowed.flatMap(face => ['', "'", '2'].map(suffix => {
    const [move] = parseMoves(face + suffix, size);
    return { move, back: permutation([move]) };
  }));
  const setups = new Map([[target, []]]);
  const queue = [target];
  for (const slot of queue) {
    for (const { move, back } of turns) {
      // Prepend the move that takes the newly discovered sticker to this slot.
      const from = back[slot];
      if (setups.has(from)) continue;
      setups.set(from, [move, ...setups.get(slot)]);
      queue.push(from);
    }
  }
  const shots = new Map();
  for (const slot of slots) {
    if (pieceAt[slot] === pieceAt[buffer]) continue;
    const setup = setups.get(slot);
    if (!setup) throw new Error('Missing Old Pochmann setup.');
    const moves = [...setup, ...main, ...inverse(setup)];
    const back = permutation(moves);
    if (back[slot] !== buffer || back[buffer] !== slot) throw new Error('Incorrect Old Pochmann shot.');
    shots.set(slot, { moves, back });
  }
  return { slots, buffer, shots };
}

let methods;

function stickerLabels(colors) {
  const faces = new Map(faceCoordinates.map((_, face) => [colors[face * area + 4], face]));
  const labels = new Uint8Array(stickerCount);
  for (const piece of pieces.values()) {
    const observed = piece.map(slot => faces.get(colors[slot]));
    const home = homeSlots.get(pieceKey(observed));
    for (const [i, slot] of piece.entries()) labels[slot] = home.find(at => faceOf(at) === observed[i]);
  }
  return labels;
}

function shootCycles(labels, { slots, buffer, shots }) {
  const moves = [], memo = [];
  for (;;) {
    const unsolved = slots.find(slot => shots.has(slot) && labels[slot] !== slot);
    if (unsolved === undefined) return { labels, memo, moves };
    if (memo.length >= slots.length) throw new Error('The Old Pochmann cycles could not close.');
    // A home or flipped buffer cannot shoot to itself, so break into another cycle.
    const target = shots.has(labels[buffer]) ? labels[buffer] : unsolved;
    const { back, moves: shot } = shots.get(target);
    labels = back.map(source => labels[source]);
    memo.push(String.fromCharCode(65 + slots.indexOf(target)));
    moves.push(...shot);
  }
}

export function solveBlind(cube, onStage = () => {}) {
  if (cube.size !== size) throw new RangeError('Blind solving is available for the 3 × 3 cube.');
  const colors = facelets(cube);
  if (!parseFacelets(colors).ok) throw new Error('The 3 × 3 sticker layout is invalid.');
  if (cube.isSolved()) return [];
  methods ??= {
    edges: buildMethod([1, 5, 7, 3], 5, 3, tPerm, ['L', 'Lw', 'D', 'Dw']),
    corners: buildMethod([0, 2, 8, 6], 0, 15, yPerm, ['R', 'F', 'D']),
    parity: permutation(parity),
  };
  const edges = shootCycles(stickerLabels(colors), methods.edges);
  const needsParity = edges.memo.length % 2 === 1;
  const afterEdges = needsParity ? methods.parity.map(source => edges.labels[source]) : edges.labels;
  const corners = shootCycles(afterEdges, methods.corners);
  const stages = [{ name: 'Edges', moves: edges.moves, memo: edges.memo }];
  if (needsParity) stages.push({ name: 'Parity', moves: parity, memo: [] });
  stages.push({ name: 'Corners', moves: corners.moves, memo: corners.memo });
  const replay = cube.clone();
  const moves = stages.flatMap(stage => stage.moves);
  for (const move of moves) replay.apply(move);
  if (!replay.isSolved()) throw new Error('Old Pochmann solution replay did not solve the cube.');
  for (const stage of stages) if (stage.moves.length) onStage(stage);
  return moves;
}
