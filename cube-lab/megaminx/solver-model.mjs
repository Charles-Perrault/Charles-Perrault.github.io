import { Megaminx, stickers, faces, dot } from './puzzle.mjs';

export const identity = Uint8Array.from(stickers, (_, i) => i);
export const undo = word => word.slice().reverse().map(move => move ^ 1);
export const moves = Array.from({ length: 24 }, (_, i) => ({ face: i >> 1, direction: i % 2 ? -1 : 1 }));
export const pull = moves.map(({ face, direction }) => {
  const puzzle = new Megaminx();
  puzzle.state = identity;
  puzzle.turn(face, direction);
  return puzzle.state;
});
export const push = pull.map((_, i) => pull[i ^ 1]);
export const apply = (state, word) => word.reduce((a, move) => pull[move].map(i => a[i]), state);

const byFaces = new Map();
for (const [id, sticker] of stickers.entries()) {
  if (sticker.layerFaces.length === 1) continue;
  const key = sticker.layerFaces.join(',');
  if (!byFaces.has(key)) byFaces.set(key, []);
  byFaces.get(key).push(id);
}
export const pieces = [...byFaces.values()];
export const pieceIndex = new Int8Array(stickers.length).fill(-1);
for (const [index, piece] of pieces.entries()) for (const id of piece) pieceIndex[id] = index;

export function identify(state) {
  const labels = identity.slice();
  for (const piece of pieces) {
    const home = byFaces.get(piece.map(i => state[i]).sort((a, b) => a - b).join(','));
    if (!home) throw new Error('Invalid Megaminx piece');
    for (const id of piece) labels[id] = home.find(i => stickers[i].face === state[id]);
  }
  return labels;
}

export const lastFace = faces.findIndex(face => dot(face, faces[0]) < -0.99);
export const lastPieces = pieces.filter(piece => stickers[piece[0]].layerFaces.includes(lastFace));
const band = face => face === 0 ? 0 : face === lastFace ? 3 : dot(faces[face], faces[0]) > 0 ? 1 : 2;
export const layerStages = [
  ['White star', ['01']],
  ['White corners', ['011']],
  ['Edges around white', ['11']],
  ['Middle layer', ['112', '12']],
  ['Last slots', ['122', '22']],
].map(([name, bands]) => ({
  name,
  pieces: bands.flatMap(key => pieces.filter(piece =>
    stickers[piece[0]].layerFaces.map(band).sort().join('') === key)),
}));

export function simplify(word) {
  const result = [];
  for (const turn of word) {
    let power = turn % 2 ? -1 : 1;
    while (result.length && result.at(-1) >> 1 === turn >> 1) power += result.pop() % 2 ? -1 : 1;
    power = (power + 7) % 5 - 2;
    for (let i = 0; i < Math.abs(power); i++) result.push(turn & ~1 | Number(power < 0));
  }
  return result;
}

export const commutator = (a, b) => [...a, ...b, ...undo(a), ...undo(b)];

export function macro(word) {
  word = simplify(word);
  const perm = apply(identity, undo(word));
  const touched = [];
  const edges = [], corners = [];
  for (const [index, piece] of pieces.entries()) {
    if (piece.every(id => perm[id] === id)) continue;
    touched.push(index);
    (piece.length === 2 ? edges : corners).push(piece);
  }
  return { word, perm, touched, edges, corners };
}

let basic;
export function basicMacros() {
  if (basic) return basic;
  const seen = new Map();
  const add = word => {
    const item = macro(word);
    if (!item.touched.length) return;
    const key = item.perm.join(',');
    if (!seen.has(key) || seen.get(key).word.length > item.word.length) seen.set(key, item);
  };
  for (let a = 0; a < 24; a++) {
    add([a]);
    for (let b = 0; b < 24; b++) {
      add([a, b, a ^ 1]);
      add(commutator([a], [b]));
    }
  }
  return basic = [...seen.values()];
}

const catalogs = new Map();
export function cycles(size) {
  if (catalogs.has(size)) return catalogs.get(size);
  const slots = pieces.filter(piece => piece.length === size).flat();
  const width = slots.length;
  const toLocal = new Int8Array(stickers.length).fill(-1);
  slots.forEach((id, i) => { toLocal[id] = i; });
  const transitions = push.map(p => slots.map(id => toLocal[p[id]]));
  const pack = (a, b, c) => (a * width + b) * width + c;
  const links = new Int32Array(width ** 3);
  const via = new Uint8Array(links.length);
  const seeds = [];

  const comms = basicMacros().filter(m => m.word.length === 4 && m.edges.length === 3 && m.corners.length === 4);
  // Conjugation transports a pure 3-cycle to any desired triple of oriented stickers.
  for (const a of comms) for (const b of size === 2 ? comms : moves.keys()) {
    const word = commutator(a.word, size === 2 ? b.word : [b]);
    const item = macro(word);
    const group = size === 2 ? item.edges : item.corners;
    if (group.length === 3 && item.touched.length === 3) seeds.push(item);
  }
  seeds.sort((a, b) => a.word.length - b.word.length);
  // Multi-source search by turn cost. A conjugation adds two turns.
  const buckets = [];
  const distance = new Uint8Array(links.length).fill(255);
  for (const [index, item] of seeds.entries()) {
    for (const id of (size === 2 ? item.edges : item.corners).flat()) {
      const key = pack(toLocal[id], toLocal[item.perm[id]], toLocal[item.perm[item.perm[id]]]);
      if (distance[key] <= item.word.length) continue;
      links[key] = -index - 1;
      distance[key] = item.word.length;
      (buckets[item.word.length] ??= []).push(key);
    }
  }
  for (let cost = 0; cost < buckets.length; cost++) for (const key of buckets[cost] ?? []) {
    if (distance[key] !== cost) continue;
    const a = Math.floor(key / width ** 2), b = Math.floor(key / width) % width, c = key % width;
    for (const [turn, next] of transitions.entries()) {
      const target = pack(next[a], next[b], next[c]);
      if (distance[target] <= cost + 2) continue;
      links[target] = key + 1;
      via[target] = turn;
      distance[target] = cost + 2;
      (buckets[cost + 2] ??= []).push(target);
    }
  }
  const get = (a, b, c) => {
    let key = pack(toLocal[a], toLocal[b], toLocal[c]);
    if (!links[key]) throw new Error('Missing Megaminx 3-cycle');
    const suffix = [];
    while (links[key] > 0) {
      suffix.push(via[key]);
      key = links[key] - 1;
    }
    return simplify([...suffix.map(turn => turn ^ 1), ...seeds[-links[key] - 1].word, ...suffix.reverse()]);
  };
  const cost = (a, b, c) => distance[pack(toLocal[a], toLocal[b], toLocal[c])];
  const result = { get, cost };
  catalogs.set(size, result);
  return result;
}
