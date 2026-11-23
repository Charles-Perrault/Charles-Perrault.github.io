import { LayeredMinx } from './layered-minx.mjs?v=3';
import { stickers as megaminxStickers } from './puzzle.mjs';
import { solveMegaminx } from './solver.mjs';
import { simplify } from './solver-model.mjs';
import { greedyCenterMoves } from './greedy-centers.mjs';

const inverse = word => word.slice().reverse().map(move => move ^ 1);
const commutator = (a, b) => [...a, ...b, ...inverse(a), ...inverse(b)];
const destination = (action, slot) => action.get(slot) ?? slot;

// AB and BA can only differ on the overlap of the two moves and its preimages.
function commutation(a, b) {
  const overlap = [];
  const [small, large] = a.forward.size < b.forward.size ? [a, b] : [b, a];
  for (const id of small.forward.keys()) {
    if (large.forward.has(id)) overlap.push(id);
  }
  const affected = new Set();
  for (const id of overlap) {
    affected.add(id);
    affected.add(destination(a.backward, id));
    affected.add(destination(b.backward, id));
  }
  const forward = new Map(), backward = new Map();
  for (const from of affected) {
    const after = destination(b.forward, destination(a.forward, from));
    const to = destination(b.backward, destination(a.backward, after));
    if (from === to) continue;
    forward.set(from, to);
    backward.set(to, from);
  }
  return { forward, backward, word: commutator(a.word, b.word) };
}

function rigidPieces(puzzle, actions) {
  const groups = new Map();
  const pieceOf = new Int32Array(puzzle.stickers.length);
  for (const [id, { bands }] of puzzle.stickers.entries()) {
    const key = String.fromCharCode(...bands);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  const pieces = [...groups.values()];
  pieces.forEach((slots, i) => slots.forEach(id => { pieceOf[id] = i; }));
  const orbitOf = new Int32Array(pieces.length).fill(-1);
  const orbits = [];
  for (const [root, slots] of pieces.entries()) {
    if (orbitOf[root] !== -1) continue;
    const orbit = { pieces: [root], seeds: [], core: slots.length === 3 ||
      (slots.length === 2 && puzzle.stickers[slots[0]].bands.every(band => band < 2)) };
    const id = orbits.push(orbit) - 1;
    orbitOf[root] = id;
    for (const piece of orbit.pieces) for (const action of actions) {
      const next = pieceOf[destination(action.forward, pieces[piece][0])];
      if (orbitOf[next] !== -1) continue;
      orbitOf[next] = id;
      orbit.pieces.push(next);
    }
  }
  return { pieces, pieceOf, orbits, orbitOf };
}

function projection(puzzle) {
  const core = new Map();
  for (const [id, { face, bands }] of puzzle.stickers.entries()) {
    if (bands.some(band => band > 1)) continue;
    const outer = [...bands].flatMap((band, i) => band === 1 ? [i] : []);
    core.set([face, ...outer].join(','), id);
  }
  return Uint8Array.from(megaminxStickers, ({ face, layerFaces }) => {
    const id = core.get([face, ...layerFaces].join(','));
    return id === undefined ? face : puzzle.state[id];
  });
}

function findSeeds(model, actions, depth) {
  const { pieces, orbits, orbitOf, pieceOf } = model;
  const store = action => {
    const moved = new Map();
    for (const slot of action.forward.keys()) {
      const piece = pieceOf[slot], orbit = orbitOf[piece];
      if (orbits[orbit].core) return;
      if (!moved.has(orbit)) moved.set(orbit, new Set());
      moved.get(orbit).add(piece);
    }
    for (const [ordinal, involved] of moved) {
      if (involved.size !== 3) continue;
      const [a] = involved;
      const b = pieceOf[destination(action.forward, pieces[a][0])];
      const c = pieceOf[destination(action.forward, pieces[b][0])];
      if (a === b || b === c || a === c || pieceOf[destination(action.forward, pieces[c][0])] !== a) continue;
      const conflicts = [...moved.keys()].filter(id => id !== ordinal);
      const seeds = orbits[ordinal].seeds;
      if (!seeds.some(seed => seed.conflicts.length === conflicts.length &&
        seed.conflicts.every(id => conflicts.includes(id)) && seed.action.word.length <= action.word.length)) {
        seeds.push({ action, cycle: [a, b, c], conflicts });
      }
    }
  };
  const inner = actions.filter((_, id) => id % depth !== 0);
  // Rotating the entire puzzle preserves types. A single reference face
  // therefore supplies the commutator setups for all depths.
  for (let face = 1; face < 12; face++) {
    const across = actions[face * depth];
    const outerPair = commutation(actions[0], across);
    if (outerPair.forward.size) for (const turn of inner) store(commutation(outerPair, turn));
    for (let layer = 1; layer < depth; layer++) {
      const cross = commutation(actions[0], actions[face * depth + layer]);
      if (!cross.forward.size) continue;
      store(cross);
      for (const turn of inner) store(commutation(cross, turn));
    }
  }
}

function colorKeys(model, orbit) {
  const { pieces } = model;
  const orientation = new Map();
  if (pieces[orbit.pieces[0]].length === 2) {
    // A wing never flips within its orbit. Follow one sticker to choose
    // a consistent orientation for the ordered pair of colors.
    const [first] = pieces[orbit.pieces[0]];
    const pending = [first];
    orientation.set(model.pieceOf[first], first);
    for (const id of pending) for (const action of model.actions) {
      const next = destination(action.forward, id), piece = model.pieceOf[next];
      if (orientation.has(piece)) continue;
      orientation.set(piece, next);
      pending.push(next);
    }
  }
  const keys = (state, piece) => {
    const slots = pieces[piece];
    if (slots.length === 1) return state[slots[0]];
    const first = orientation.get(piece), second = slots.find(id => id !== first);
    return state[first] * 12 + state[second];
  };
  return keys;
}

function assignTargets(model, puzzle, orbit) {
  const { home } = model, keys = colorKeys(model, orbit);
  const destinations = new Int16Array(orbit.pieces.length);
  const missing = [];
  const targets = new Map();
  for (const [i, piece] of orbit.pieces.entries()) {
    const color = keys(puzzle.state, piece), expected = keys(home, piece);
    destinations[i] = i;
    if (color === expected) continue;
    if (!targets.has(expected)) targets.set(expected, []);
    targets.get(expected).push(i);
    missing.push([i, color]);
  }
  for (const [i, color] of missing) {
    const target = targets.get(color)?.pop();
    if (target === undefined) throw new Error('The colors do not match this layer orbit');
    destinations[i] = target;
  }
  let odd = false;
  for (let i = 0; i < destinations.length; i++) for (let j = 0; j < i; j++) {
    if (destinations[j] > destinations[i]) odd = !odd;
  }
  if (odd) {
    if (model.pieces[orbit.pieces[0]].length !== 1) throw new Error('Unexpected wing permutation parity');
    const [a, b] = orbit.pieces.flatMap((piece, i) => orbit.pieces.slice(i + 1)
      .flatMap((other, j) => keys(puzzle.state, piece) === keys(puzzle.state, other) ? [[i, i + j + 1]] : []))
      .sort(([x, y], [u, v]) => Number(destinations[x] === x) + Number(destinations[y] === y) -
        Number(destinations[u] === u) - Number(destinations[v] === v))[0];
    [destinations[a], destinations[b]] = [destinations[b], destinations[a]];
  }
  return destinations;
}

function cycleTable(model, orbit, seed) {
  const ids = new Map(orbit.pieces.map((piece, i) => [piece, i]));
  const size = ids.size, square = size * size;
  const pack = (a, b, c) => a * square + b * size + c;
  const moves = [];
  const seen = new Set();
  for (const [i, action] of model.actions.entries()) for (const direction of [0, 1]) {
    const perm = direction ? action.backward : action.forward;
    const row = Uint8Array.from(orbit.pieces, piece =>
      ids.get(model.pieceOf[destination(perm, model.pieces[piece][0])]));
    if (row.every((value, j) => value === j)) continue;
    const signature = String.fromCharCode(...row);
    if (seen.has(signature)) continue;
    seen.add(signature);
    moves.push({ turn: i * 2 + direction, row });
  }
  const roots = seed.cycle.map(piece => ids.get(piece));
  const signature = [...seen].join('') + String.fromCharCode(...roots);
  let search = model.cycleCache.get(signature);
  if (!search) {
    search = buildCycleTable(moves.map(move => move.row), roots, size);
    if (model.cycleCache.size >= 24) model.cycleCache.delete(model.cycleCache.keys().next().value);
    model.cycleCache.set(signature, search);
  }
  const { parents, via, distance } = search;
  const word = (a, b, c) => {
    let key = pack(a, b, c);
    const setup = [];
    while (parents[key] > 0) {
      setup.push(moves[via[key]].turn ^ 1);
      key = parents[key] - 1;
    }
    if (!parents[key]) throw new Error('Unsupported three-cycle');
    return [...setup, ...(parents[key] === -1 ? seed.action.word : inverse(seed.action.word)), ...inverse(setup)];
  };
  return { score: (a, b, c) => distance[pack(a, b, c)], word };
}

function buildCycleTable(rows, roots, size) {
  const square = size * size;
  const pack = (a, b, c) => a * square + b * size + c;
  // A conjugation transports a three-cycle while leaving its other orbit
  // effects unchanged up to relabeling. Search only this orbit's three slots.
  const parents = new Int32Array(size ** 3);
  const via = new Uint16Array(parents.length);
  const distance = new Uint8Array(parents.length).fill(255);
  const queue = new Int32Array(parents.length);
  let tail = 0;
  for (let i = 0; i < 3; i++) for (const direction of [0, 1]) {
    const key = pack(...[i, i + (direction ? 2 : 1), i + (direction ? 1 : 2)]
      .map(j => roots[j % 3]));
    parents[key] = -1 - direction;
    distance[key] = 0;
    queue[tail++] = key;
  }
  for (let head = 0; head < tail; head++) {
    const key = queue[head];
    const a = Math.floor(key / square), b = Math.floor(key / size) % size, c = key % size;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const next = pack(row[a], row[b], row[c]);
      if (distance[next] !== 255) continue;
      parents[next] = key + 1;
      via[next] = i;
      distance[next] = distance[key] + 1;
      queue[tail++] = next;
    }
  }
  return { parents, via, distance };
}

export function solveLayeredMinx(size, state, report = () => {}) {
  const puzzle = new LayeredMinx(size);
  if (state.length !== puzzle.state.length) throw new Error('Layer count does not match the puzzle');
  puzzle.state = state.slice();
  if (puzzle.solved) return [];
  const stages = [];
  const decode = move => ({
    face: Math.floor((move >> 1) / puzzle.depth),
    layer: (move >> 1) % puzzle.depth + 1,
    direction: move % 2 ? -1 : 1,
  });
  const addStage = (name, moves) => {
    if (moves.length) stages.push({ name, moves });
  };
  if (size >= 4) {
    report('Greedy centers');
    addStage('Greedy centers', greedyCenterMoves(puzzle, report));
    if (puzzle.solved) return stages;
  }
  report('Corners and middle edges');
  const core = solveMegaminx(projection(puzzle)).flatMap(stage => stage.moves);
  for (const { face, direction } of core) puzzle.turn(face, direction);
  addStage('Corners and middle edges', core);
  if (puzzle.solved) return stages;

  report('Generating slice algorithms');
  const actions = facesFor(puzzle);
  const model = { ...rigidPieces(puzzle, actions), actions, cycleCache: new Map(),
    home: Uint8Array.from(puzzle.stickers, tile => tile.face) };
  findSeeds(model, actions, puzzle.depth);
  const { orbits } = model;
  // Coupled center orbits go before pure cycles can overwrite their working space.
  const order = orbits.flatMap((orbit, id) => {
    if (orbit.core || orbit.pieces.length === 1) return [];
    orbit.seeds.sort((a, b) => a.conflicts.length - b.conflicts.length || a.action.word.length - b.action.word.length);
    return [{ id, priority: orbit.seeds[0]?.conflicts.length ?? Infinity }];
  }).sort((a, b) => b.priority - a.priority);
  const done = new Set();
  const sequence = [];
  for (const [i, { id }] of order.entries()) {
    const orbit = orbits[id];
    const offsets = assignTargets(model, puzzle, orbit);
    if (offsets.some((target, j) => target !== j)) {
      const seed = orbit.seeds.find(candidate => candidate.conflicts.every(other => !done.has(other)));
      if (!seed) throw new Error('Could not generate an insertion for this orbit');
      report(`Slice orbit ${i + 1} of ${order.length}`);
      const table = cycleTable(model, orbit, seed);
      for (;;) {
        const open = [...offsets.keys()].filter(j => offsets[j] !== j);
        if (!open.length) break;
        let best, cost = Infinity;
        for (const a of open) {
          const b = offsets[a];
          for (const c of open) {
            if (c === a || c === b) continue;
            const gain = 1 + Number(offsets[b] === c) + Number(offsets[c] === a);
            const price = (seed.action.word.length + 2 * table.score(a, b, c)) / gain;
            if (price < cost) { best = [a, b, c]; cost = price; }
          }
        }
        if (!best || table.score(...best) === 255) throw new Error('Could not place the remaining orbit pieces');
        const [a, b, c] = best;
        const word = table.word(a, b, c);
        for (const turn of word) {
          const { face, direction, layer } = decode(turn);
          puzzle.turn(face, direction, layer);
        }
        sequence.push(...word);
        [offsets[b], offsets[c], offsets[a]] = [offsets[a], offsets[b], offsets[c]];
      }
    }
    done.add(id);
  }
  addStage('Wings and centers', simplify(sequence).map(decode));
  if (!puzzle.solved) throw new Error('The generated solution did not verify');
  return stages;
}

function facesFor(puzzle) {
  return Array.from({ length: 12 * puzzle.depth }, (_, i) => {
    const entries = puzzle.permutation(Math.floor(i / puzzle.depth), i % puzzle.depth + 1);
    const forward = new Map(), backward = new Map();
    for (let j = 0; j < entries.length; j += 2) {
      forward.set(entries[j], entries[j + 1]);
      backward.set(entries[j + 1], entries[j]);
    }
    return { forward, backward, word: [i * 2] };
  });
}
