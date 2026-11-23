import { faces, forEachTransfer } from './puzzle.mjs';

const at = (map, id) => map.get(id) ?? id;
const inverse = word => word.slice().reverse().map(move => move ^ 1);
const slotId = (size, x, y, parity) => y * (2 * size - y) + 2 * x + parity;

function pieceCoordinates(size, sticker) {
  const face = Math.floor(sticker / size ** 2);
  const index = sticker % size ** 2;
  const y = Math.floor(size - Math.sqrt(size ** 2 - index));
  const row = index - y * (2 * size - y);
  const x = Math.floor(row / 2), parity = row % 2;
  const q = [0, 0, 0, 0];
  const corners = faces[face].corners;
  q[corners[0]] = x;
  q[corners[1]] = y;
  q[corners[2]] = size - 1 - parity - x - y;
  return q;
}

function buildWings(size) {
  const pieces = [], pieceOf = new Map(), byCoordinates = new Map();
  for (const [face, { corners }] of faces.entries()) {
    for (const missing of corners) for (const parity of [0, 1]) {
      const [a, b] = corners.filter(axis => axis !== missing);
      const sum = size - 1 - parity;
      for (let first = 1; first < sum; first++) {
        if (first === sum - first) continue; // The symmetric six-edge orbit belongs to the core.
        const q = [0, 0, 0, 0];
        q[a] = first;
        q[b] = sum - first;
        const key = q.join();
        if (!byCoordinates.has(key)) {
          byCoordinates.set(key, pieces.length);
          pieces.push({ q, slots: [] });
        }
        const piece = byCoordinates.get(key);
        const id = face * size ** 2 + slotId(size, q[corners[0]], q[corners[1]], parity);
        pieces[piece].slots.push(id);
        pieceOf.set(id, piece);
      }
    }
  }
  return { pieces, pieceOf };
}

function commutation(a, b) {
  const affected = new Set();
  const [small, large] = a.forward.size < b.forward.size ? [a, b] : [b, a];
  for (const id of small.forward.keys()) {
    if (!large.forward.has(id)) continue;
    affected.add(id);
    affected.add(at(a.backward, id));
    affected.add(at(b.backward, id));
  }
  const changes = new Map();
  for (const id of affected) {
    const to = at(b.backward, at(a.backward, at(b.forward, at(a.forward, id))));
    if (id !== to) changes.set(id, to);
  }
  return changes;
}

function wingModel(size) {
  const { pieces, pieceOf } = buildWings(size);
  const depth = size - 1;
  const actionCache = new Map();
  function action(id) {
    if (actionCache.has(id)) return actionCache.get(id);
    const forward = new Map(), backward = new Map();
    forEachTransfer(size, Math.floor(id / depth), id % depth + 1, 1, (from, to) => {
      forward.set(from, to);
      backward.set(to, from);
    });
    const move = { id, forward, backward };
    actionCache.set(id, move);
    return move;
  }
  const orbitOf = new Int32Array(pieces.length).fill(-1), orbits = [];
  for (const [root, piece] of pieces.entries()) {
    if (orbitOf[root] !== -1) continue;
    const orientation = new Map([[root, piece.slots[0]]]);
    const moves = new Set();
    const id = orbits.length;
    orbits.push({ orientation, moves, seed: null });
    for (const [slot, anchor] of orientation) {
      orbitOf[slot] = id;
      for (const [axis, coordinate] of pieces[slot].q.entries()) {
        if (!coordinate) continue;
        const index = axis * depth + size - coordinate - 1;
        const to = action(index).forward.get(anchor);
        moves.add(index);
        const target = pieceOf.get(to);
        if (!orientation.has(target)) orientation.set(target, to);
      }
    }
  }
  for (let axis = 0; axis < 4; axis++) for (let other = axis + 1; other < 4; other++) {
    for (const sum of [size - 1, size - 2]) for (let a = 1; a < sum; a++) {
      const b = sum - a;
      if (a === b) continue;
      const left = axis * depth + size - a - 1, right = other * depth + size - b - 1;
      const changes = commutation(action(left), action(right));
      const wings = new Map();
      let safe = true;
      for (const [from, to] of changes) {
        const start = pieceOf.get(from);
        if (start === undefined) {
          const q = pieceCoordinates(size, from).filter(value => value > 0);
          if (q.length !== 3 || q.every(value => value === q[0])) { safe = false; break; }
          continue;
        }
        wings.set(start, pieceOf.get(to));
      }
      if (!safe || wings.size !== 3) continue;
      const x = wings.keys().next().value, y = wings.get(x), z = wings.get(y);
      if (x === y || y === z || z === x || wings.get(z) !== x) continue;
      const orbit = orbits[orbitOf[x]];
      if (orbit.seed || orbitOf[x] !== orbitOf[y] || orbitOf[x] !== orbitOf[z]) continue;
      orbit.seed = { triple: [x, y, z], word: [2 * left, 2 * right, 2 * left + 1, 2 * right + 1] };
    }
  }
  return { action, pieces, pieceOf, orbits };
}

function orbitPlan(puzzle, model, orbit) {
  const { pieces, pieceOf, action } = model;
  const { orientation, moves, seed } = orbit;
  const positions = [...orientation.keys()], size = positions.length;
  const ids = new Map(positions.map((piece, i) => [piece, i]));
  const identity = (piece, getColor) => {
    const anchor = orientation.get(piece);
    const other = pieces[piece].slots.find(id => id !== anchor);
    return 4 * getColor(anchor) + getColor(other);
  };
  const targets = new Map(positions.map((piece, i) => [identity(piece, id => Math.floor(id / puzzle.faceArea)), i]));
  const offsets = positions.map(piece => targets.get(identity(piece, id => puzzle.state[id])));
  if (offsets.some(value => value === undefined) || new Set(offsets).size !== size) return null;
  if (offsets.every((target, i) => target === i)) return [];
  if (!seed) return null;

  const pack = (a, b, c) => (a * size + b) * size + c;
  const paths = new Map(), queue = [];
  const [a, b, c] = seed.triple.map(piece => ids.get(piece));
  for (const [triple, word] of [[[a, b, c], seed.word], [[a, c, b], inverse(seed.word)]]) {
    const entry = { triple, word, setup: [] };
    paths.set(pack(...triple), entry);
    queue.push(entry);
  }
  const transitions = [];
  for (const move of moves) for (const direction of [0, 1]) {
    const map = direction ? action(move).backward : action(move).forward;
    const row = positions.map(piece => ids.get(pieceOf.get(at(map, orientation.get(piece)))));
    transitions.push({ word: 2 * move + direction, row });
  }
  for (const entry of queue) for (const { word, row } of transitions) {
    const triple = entry.triple.map(value => row[value]), key = pack(...triple);
    if (paths.has(key)) continue;
    const next = { triple, word: entry.word, setup: [...entry.setup, word] };
    paths.set(key, next);
    queue.push(next);
  }
  const plan = [];
  for (;;) {
    const open = offsets.flatMap((target, i) => target === i ? [] : [i]);
    if (!open.length) return plan;
    let best, price = Infinity;
    for (const x of open) for (const z of open) {
      const y = offsets[x];
      if (z === x || z === y) continue;
      const route = paths.get(pack(x, y, z));
      if (!route) continue;
      const gain = 1 + Number(offsets[y] === z) + Number(offsets[z] === x);
      const cost = (route.word.length + 2 * route.setup.length) / gain;
      if (cost < price) { best = route; price = cost; }
    }
    if (!best) return null;
    const [x, y, z] = best.triple;
    plan.push(...inverse(best.setup), ...best.word, ...best.setup);
    [offsets[y], offsets[z], offsets[x]] = [offsets[x], offsets[y], offsets[z]];
  }
}

export function solveWings(puzzle, onMoves = () => {}) {
  const model = wingModel(puzzle.size);
  for (const orbit of model.orbits) {
    const word = orbitPlan(puzzle, model, orbit);
    if (!word?.length) continue;
    const moves = word.map(turn => ({
      axis: Math.floor((turn >> 1) / puzzle.depth),
      layer: (turn >> 1) % puzzle.depth + 1,
      direction: turn % 2 ? -1 : 1,
    }));
    for (const { axis, layer, direction } of moves) puzzle.turn(axis, layer, direction);
    onMoves(moves);
  }
}
