import { action, identity, isSolved, replay, solved, tiles } from './puzzle.mjs';
import { remapColors } from './jumbling.mjs';
import { arrangeSplitPieces, cornerParityAlgorithm, improvePetalColors, oddPermutation } from './mixed-petals.mjs';

const slots = kind => tiles.flatMap((tile, id) => tile.kind === kind ? [id] : []);
const edges = slots('edge').filter(id => id < action[tiles[id].moving[0]][id]);
const corners = slots('corner');
const petals = slots('petal');
const groups = new Map();
for (const id of corners) {
  const key = [tiles[id].face, ...tiles[id].neighbors].sort().join(',');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(id);
}
const positions = [...groups.values()];
const slotOf = [];
positions.forEach((group, i) => group.forEach(id => { slotOf[id] = i; }));

const undo = word => [...word].reverse();
const range = [...action.keys()];
const effect = word => ({ word, push: replay(identity, undo(word)), pull: replay(identity, word) });
const fixer = (macro, ids) => ids.every(id => macro.push[id] === id);

function shortest(start, methods, key, next, goal) {
  const queue = [[{ state: start, word: [] }]];
  const found = new Map([[key(start), 0]]);
  for (let cost = 0; cost < queue.length; cost++) for (const { state, word } of queue[cost] ?? []) {
    if (found.get(key(state)) !== cost) continue;
    if (goal(state)) return word;
    for (const move of methods) {
      const moved = next(state, move), code = key(moved), distance = cost + move.word.length;
      if ((found.get(code) ?? Infinity) <= distance) continue;
      found.set(code, distance);
      (queue[distance] ??= []).push({ state: moved, word: [...word, ...move.word] });
    }
  }
  throw new Error('This position is outside the supported edge-flip group');
}

let catalog;
function tables() {
  if (catalog) return catalog;
  const basics = [];
  const conjugates = new Map();
  const keep = item => {
    const k = corners.map(id => String.fromCharCode(item.push[id])).join('');
    if (!conjugates.has(k) || conjugates.get(k).word.length > item.word.length) conjugates.set(k, item);
  };
  for (const a of range) for (const b of range) {
    if (a === b) continue;
    const word = [a, b, a, b], base = effect(word);
    if (fixer(base, corners)) continue;
    basics.push(base);
    keep(base);
    for (const c of range) {
      keep(effect([c, ...word, c]));
      for (const d of range) if (d !== c) keep(effect([c, d, ...word, d, c]));
    }
  }
  const permutation = push => positions.map(([id]) => slotOf[push[id]]).join('');
  const byPermutation = new Map();
  for (const item of conjugates.values()) {
    const code = permutation(item.push);
    if (!byPermutation.has(code)) byPermutation.set(code, []);
    byPermutation.get(code).push(item);
  }
  const twists = new Map();
  for (const choices of byPermutation.values()) for (const a of choices) for (const b of choices) {
    if (a === b) continue;
    const item = effect([...a.word, ...undo(b.word)]);
    const signature = positions.map(([id]) => String.fromCharCode(item.push[id])).join('');
    if (fixer(item, corners)) continue;
    if (!twists.has(signature) || twists.get(signature).word.length > item.word.length) twists.set(signature, item);
  }

  const leaves = new Map();
  for (const a of range) for (const b of range) for (const c of range) {
    if (a === b || b === c || a === c) continue;
    const item = effect([a, b, c, b, a, b, c, b]);
    if (fixer(item, corners) && petals.filter(id => item.push[id] !== id).length === 3) {
      leaves.set(petals.map(id => String.fromCharCode(item.push[id])).join(''), item);
    }
  }
  for (const item of leaves.values()) for (const a of range) {
    const next = effect([a, ...item.word, a]);
    const key = petals.map(id => String.fromCharCode(next.push[id])).join('');
    if (!leaves.has(key)) leaves.set(key, next);
  }
  const orbits = [];
  const pending = new Set(petals);
  while (pending.size) {
    const orbit = [pending.values().next().value];
    pending.delete(orbit[0]);
    for (const id of orbit) for (const move of action) if (pending.delete(move[id])) orbit.push(move[id]);
    orbits.push({ orbit, moves: [...leaves.values()].filter(item => petals.every(id => item.push[id] === id || orbit.includes(id))) });
  }

  return catalog = { basics, twists: [...twists.values()], orbits };
}

function cornerAnchors(state) {
  return positions.map(group => {
    // Match one sticker of each unique corner by identifying its triplet of colors.
    const key = group.map(id => solved[id]).sort().join(',');
    const where = positions.find(pos => pos.map(id => state[id]).sort().join(',') === key);
    return where?.find(id => state[id] === solved[group[0]]);
  });
}

export function solve(state, onStage) {
  let checkpoint = state;
  const committed = [];
  const emit = (stage, next) => {
    if (!onStage) return;
    checkpoint = next;
    committed.push(stage);
    onStage(stage);
  };
  try {
    return solveAligned(state, false, emit);
  } catch {
    if (!onStage) return solveAligned(state, true);
    solveAligned(checkpoint, true, emit);
    return committed;
  }
}

function solveAligned(state, mixed, emit = () => {}) {
  if (isSolved(state)) return [];
  const { basics, twists, orbits } = tables();
  const plan = [];
  const step = (name, word) => {
    const reduced = [];
    for (const move of word) {
      if (reduced.at(-1) === move) reduced.pop();
      else reduced.push(move);
    }
    state = replay(state, reduced);
    if (reduced.length) {
      const stage = { name, moves: reduced };
      plan.push(stage);
      emit(stage, state);
    }
  };
  const mix = (name, algorithms) => {
    const moves = [];
    for (const { moves: turns, perm } of algorithms) {
      moves.push({ ...turns[0], startAligned: true }, ...turns.slice(1));
      state = remapColors(state, perm);
    }
    if (moves.length) {
      const stage = { name, moves };
      plan.push(stage);
      emit(stage, state);
    }
  };

  step('Orienting edges', edges.flatMap(id => state[id] === solved[id] ? [] : tiles[id].moving));
  let current = cornerAnchors(state);
  if (current.includes(undefined) || new Set(current.map(id => slotOf[id])).size !== positions.length) {
    throw new Error('Check the sticker colors on the corners');
  }
  if (oddPermutation(current.map(id => slotOf[id]))) {
    if (!mixed) throw new Error('This state needs a jumbling algorithm');
    mix('Correcting corner parity', [cornerParityAlgorithm()]);
    current = cornerAnchors(state);
  }
  const home = positions.map(([id]) => id);
  const toKey = ids => ids.map(id => slotOf[id]).join('');
  const homeKey = toKey(home);
  step('Placing corners', shortest(current, basics, toKey, (ids, { push }) => ids.map(id => push[id]),
    ids => toKey(ids) === homeKey));
  step('Orienting corners', shortest(cornerAnchors(state), twists, ids => String.fromCharCode(...ids),
    (ids, { push }) => ids.map(id => push[id]), ids => ids.every((id, i) => id === home[i])));
  if (mixed) {
    mix('Matching split petals', improvePetalColors(state, solved));
    mix('Placing marked petals', arrangeSplitPieces(state, solved, 'petal'));
    mix('Placing outer petals', arrangeSplitPieces(state, solved, 'tip'));
  } else {
    for (const { orbit, moves } of orbits) {
      const goal = orbit.map(id => solved[id]).join('');
      step('Placing split petals', shortest(orbit.map(id => state[id]), moves, colors => colors.join(''),
        (colors, { pull }) => orbit.map(id => colors[orbit.indexOf(pull[id])]), colors => colors.join('') === goal));
    }
  }
  if (!isSolved(state)) throw new Error('No verified solution for these sticker colors');
  return plan;
}

export function scramble(length, random = Math.random) {
  const word = [];
  for (let i = 0; i < length; i++) {
    const previous = word.at(-1);
    let move = Math.floor(random() * (i ? action.length - 1 : action.length));
    if (i && move >= previous) move++;
    word.push(move);
  }
  return word;
}
