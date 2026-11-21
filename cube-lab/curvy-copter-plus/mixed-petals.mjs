import { edges, identity, tiles, dot } from './puzzle.mjs';
import { applyPose, cubePoses, cubeSlots, jumbleAngle, optionsAt, remapColors } from './jumbling.mjs';

const t = jumbleAngle, long = Math.PI - t, half = Math.PI;
const indexed = notation => notation.map(([name, angle]) => [edges.findIndex(edge => edge.name === name), angle]);
const undo = word => [...word].reverse().map(([edge, angle]) => [edge, -angle]);
const commutator = (a, b) => [...a, ...b, ...undo(a), ...undo(b)];
const pairedJumble = indexed([['UF', long], ['DR', long], ['FR', half], ['DR', -long], ['UF', -long]]);
const crossing = indexed([['UR', long], ['UF', t], ['BR', t], ['UR', half], ['BR', -t], ['UF', -t], ['UR', -long]]);
const singleEdge = indexed([['UF', t], ['UR', -t], ['FL', -t], ['UF', half], ['FL', t], ['UR', t], ['UF', -t]]);
const diagonal = indexed(['UF', 'FL', 'UL', 'FL', 'UF', 'FL', 'UL', 'FL'].map(name => [name, half]));

function verifyWord(word) {
  let poses = cubePoses();
  const moves = [];
  for (const [edge, angle] of word) {
    const move = optionsAt(poses, edge).find(option => Math.abs(Math.sin((option.angle - angle) / 2)) < 1e-7);
    if (!move) throw new Error('A jumbling algorithm attempted a blocked cut');
    poses = applyPose(poses, move);
    moves.push(move);
  }
  const perm = cubeSlots(poses);
  if (!perm) throw new Error('A jumbling algorithm failed to return to cube shape');
  return { perm, moves, word };
}

const isIdentity = (perm, selection) => selection.every(id => perm[id] === id);

function symmetricWords(word) {
  const axes = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [1, 0, 2], [2, 1, 0]];
  const palette = [];
  for (const [i, order] of axes.entries()) for (const x of [1, -1]) for (const y of [1, -1]) for (const z of [1, -1]) {
    const sign = [x, y, z], determinant = x * y * z * (i < 3 ? 1 : -1);
    const mapping = edges.map(({ axis }) => {
      const mapped = order.map((j, k) => sign[k] * axis[j]);
      return edges.findIndex(other => dot(other.axis, mapped) > 0.9999);
    });
    palette.push(word.map(([edge, angle]) => [mapping[edge], determinant * angle]));
  }
  return palette;
}

export function colorJumble(random = Math.random) {
  const choices = symmetricWords(singleEdge);
  return verifyWord(choices[Math.floor(random() * choices.length)]).moves;
}

const baseTurns = edges.map((_, edge) => [[edge, half]]);
let transports;
function transportMoves() {
  if (transports) return transports;
  const available = new Map();
  for (const word of [...baseTurns, ...symmetricWords(pairedJumble), ...symmetricWords(singleEdge)]) {
    const method = verifyWord(word);
    const key = String.fromCharCode(...method.perm);
    if (!available.has(key)) available.set(key, method);
  }
  return transports = [...available.values()];
}

const tables = new Map();
const forKind = kind => tiles.flatMap((tile, id) => tile.kind === kind ? [id] : []);
const centers = [...forKind('petal'), ...forKind('tip')];
const fixedPieces = [...forKind('edge'), ...forKind('corner')];
let exchanges;

function exchangeAlgorithms() {
  if (exchanges) return exchanges;
  const byEffect = new Map(), found = new Map();
  const inverse = perm => {
    const result = [];
    perm.forEach((destination, source) => { result[destination] = source; });
    return result;
  };
  const candidates = transportMoves();
  for (const method of [...candidates, ...symmetricWords(crossing).map(verifyWord)]) {
    const key = String.fromCharCode(...fixedPieces.map(id => method.perm[id]));
    if (!byEffect.has(key)) byEffect.set(key, []);
    byEffect.get(key).push(method);
  }
  for (const group of byEffect.values()) for (const a of group) for (const b of group) {
    if (a === b) continue;
    const back = inverse(b.perm);
    const perm = a.perm.map(id => back[id]);
    const changes = centers.filter(id => perm[id] !== id);
    if (!changes.length) continue;
    const key = String.fromCharCode(...perm);
    const word = [...a.word, ...undo(b.word)];
    if ((found.get(key)?.word.length ?? Infinity) > word.length) found.set(key, { word, perm, changes });
  }
  return exchanges = [...found.values()];
}

export function improvePetalColors(state, goal) {
  const algorithms = exchangeAlgorithms();
  const word = [];
  while (true) {
    let best, rate = 0;
    for (const item of algorithms) {
      let gain = 0;
      for (const id of item.changes) {
        gain += Number(state[id] === goal[item.perm[id]]) - Number(state[id] === goal[id]);
      }
      if (gain / item.word.length > rate) {
        best = item;
        rate = gain / item.word.length;
      }
    }
    if (!best) return word;
    word.push(verifyWord(best.word));
    state = remapColors(state, best.perm);
  }
}

function threeCycles(kind, seed) {
  if (tables.has(kind)) return tables.get(kind);
  const slots = forKind(kind), size = slots.length;
  const outside = [...identity].filter(id => !slots.includes(id));
  const local = new Int8Array(identity.length).fill(-1);
  slots.forEach((id, i) => { local[id] = i; });
  const actions = transportMoves().map(({ perm, word }) => ({ word, to: slots.map(id => local[perm[id]]) }));
  const idOf = (a, b, c) => (a * size + b) * size + c;
  const links = new Int32Array(size ** 3);
  const via = new Uint8Array(links.length);
  const costs = new Uint16Array(links.length).fill(65535);
  const starts = [], queue = [];
  for (const word of symmetricWords(seed)) for (const turn of [word, undo(word)]) {
    const { perm } = verifyWord(turn);
    const changed = slots.filter(id => perm[id] !== id);
    if (changed.length !== 3 || !isIdentity(perm, outside)) throw new Error('Expected a pure split-petal three-cycle');
    const first = starts.length;
    starts.push(turn);
    for (const id of changed) {
      const key = idOf(local[id], local[perm[id]], local[perm[perm[id]]]);
      if (costs[key] <= turn.length) continue;
      costs[key] = turn.length;
      links[key] = -1 - first;
      (queue[turn.length] ??= []).push(key);
    }
  }
  // Conjugation moves a cycle to any ordered triple while keeping its support pure.
  for (let depth = 0; depth < queue.length; depth++) for (const key of queue[depth] ?? []) {
    if (costs[key] !== depth) continue;
    const a = Math.floor(key / size ** 2), b = Math.floor(key / size) % size, c = key % size;
    for (const [move, { to, word }] of actions.entries()) {
      const next = idOf(to[a], to[b], to[c]), cost = depth + word.length * 2;
      if (costs[next] <= cost) continue;
      costs[next] = cost;
      links[next] = key + 1;
      via[next] = move;
      (queue[cost] ??= []).push(next);
    }
  }
  if (costs.filter(cost => cost !== 65535).length !== size * (size - 1) * (size - 2)) {
    throw new Error('The jumbling table does not cover every ordered triple');
  }
  const distance = (a, b, c) => costs[idOf(local[a], local[b], local[c])];
  const wordFor = (a, b, c) => {
    let key = idOf(local[a], local[b], local[c]);
    const suffix = [];
    while (links[key] > 0) {
      suffix.unshift(...actions[via[key]].word);
      key = links[key] - 1;
    }
    return [...undo(suffix), ...starts[-1 - links[key]], ...suffix];
  };
  const table = { slots, distance, wordFor };
  tables.set(kind, table);
  return table;
}

function petalCycles() {
  const crossingTwist = commutator(pairedJumble, crossing);
  return threeCycles('petal', crossingTwist);
}

function tipCycles() {
  if (tables.has('tip')) return tables.get('tip');
  const { slots, wordFor } = petalCycles();
  const { perm } = verifyWord(diagonal);
  const a = slots.find(id => perm[id] !== id), b = perm[a], c = perm[b];
  return threeCycles('tip', [...diagonal, ...wordFor(b, a, c)]);
}

export function cornerParityAlgorithm() {
  const word = [...singleEdge, ...baseTurns[edges.findIndex(edge => edge.name === 'UF')]];
  return verifyWord(word);
}

export function oddPermutation(positions) {
  let parity = false;
  for (const [i, value] of positions.entries()) for (let j = 0; j < i; j++) if (positions[j] > value) parity = !parity;
  return parity;
}

function destinations(state, goal, slots) {
  const free = new Set(slots.filter(id => state[id] !== goal[id]));
  const assignments = [...identity];
  for (const id of [...free]) {
    const to = [...free].find(place => goal[place] === state[id]);
    if (to === undefined) throw new Error('Check the number of stickers of each color on the split petals');
    free.delete(to);
    assignments[id] = to;
  }
  if (oddPermutation(slots.map(id => assignments[id]))) {
    // Two stickers of the same color can exchange destinations without changing the goal.
    const choices = slots.flatMap((a, i) => slots.slice(i + 1).filter(b => state[a] === state[b]).map(b => [a, b]));
    choices.sort(([a, b], [c, d]) => Number(a === assignments[a]) + Number(b === assignments[b]) -
      Number(c === assignments[c]) - Number(d === assignments[d]));
    const [a, b] = choices[0];
    [assignments[a], assignments[b]] = [assignments[b], assignments[a]];
  }
  return assignments;
}

export function arrangeSplitPieces(state, goal, kind) {
  if (forKind(kind).every(id => state[id] === goal[id])) return [];
  const { slots, distance, wordFor } = kind === 'petal' ? petalCycles() : tipCycles();
  let positions = destinations(state, goal, slots);
  const moves = [];
  for (;;) {
    const open = slots.filter(id => positions[id] !== id);
    if (!open.length) return moves;
    let best, score = Infinity;
    for (const a of open) {
      const b = positions[a];
      for (const c of open) {
        if (c === a || c === b) continue;
        const placed = 1 + Number(positions[b] === c) + Number(positions[c] === a);
        const cost = distance(a, b, c) / placed;
        if (cost < score) {
          score = cost;
          best = [a, b, c];
        }
      }
    }
    if (!best) throw new Error('Could not assign remaining split petals to their colors');
    const item = verifyWord(wordFor(...best));
    positions = remapColors(positions, item.perm);
    moves.push(item);
  }
}
