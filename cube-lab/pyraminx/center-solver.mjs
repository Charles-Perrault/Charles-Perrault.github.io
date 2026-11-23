import { faces, forEachTransfer } from './puzzle.mjs';

const at = (permutation, id) => permutation.get(id) ?? id;
const inverse = word => word.slice().reverse().map(move => move ^ 1);
const commutator = (a, b) => [...a, ...b, ...inverse(a), ...inverse(b)];

function commute(a, b) {
  const affected = new Set();
  for (const id of a.forward.keys()) {
    if (!b.forward.has(id)) continue;
    affected.add(id);
    affected.add(at(a.backward, id));
    affected.add(at(b.backward, id));
  }
  const forward = new Map(), backward = new Map();
  for (const id of affected) {
    const to = at(b.backward, at(a.backward, at(b.forward, at(a.forward, id))));
    if (to !== id) {
      forward.set(id, to);
      backward.set(to, id);
    }
  }
  return { forward, backward, word: commutator(a.word, b.word) };
}

function centerModel(size) {
  const area = size ** 2, depth = size - 1;
  const isCenter = new Uint8Array(4 * area);
  const memberships = Array.from({ length: 4 * area }, () => []);
  const actions = Array.from({ length: 4 * depth }, (_, id) => {
    const axis = Math.floor(id / depth), layer = id % depth + 1;
    const forward = new Map(), backward = new Map();
    forEachTransfer(size, axis, layer, 1, (from, to) => {
      forward.set(from, to);
      backward.set(to, from);
      memberships[from].push(id);
    });
    return { axis, layer, forward, backward, word: [2 * id] };
  });
  for (const face of faces.keys()) for (let row = 1; row < size; row++) {
    for (let column = 1; column < size - row; column++) for (const parity of [0, 1]) {
      if (row + column + parity >= size - 1) continue;
      isCenter[face * area + row * (2 * size - row) + 2 * column + parity] = 1;
    }
  }

  const orbitOf = new Int32Array(4 * area).fill(-1), orbits = [];
  for (let root = 0; root < isCenter.length; root++) {
    if (!isCenter[root] || orbitOf[root] >= 0) continue;
    const slots = [root], turns = new Set(), index = orbits.length;
    orbitOf[root] = index;
    for (const slot of slots) for (const turn of memberships[slot]) {
      turns.add(turn);
      const next = actions[turn].forward.get(slot);
      if (orbitOf[next] >= 0) continue;
      slots.push(next);
      orbitOf[next] = index;
    }
    orbits.push({ slots, turns, seed: null });
  }
  return { actions, memberships, orbitOf, orbits };
}

function findSeeds({ actions, memberships, orbitOf, orbits }) {
  const record = action => {
    if (action.forward.size !== 3) return;
    const a = action.forward.keys().next().value;
    const b = action.forward.get(a), c = action.forward.get(b);
    if (action.forward.get(c) !== a || a === b || b === c || a === c) return;
    const orbit = orbitOf[a];
    if (orbit < 0 || orbitOf[b] !== orbit || orbitOf[c] !== orbit) return;
    if (orbits[orbit].seed?.word.length <= action.word.length) return;
    orbits[orbit].seed = { triple: [a, b, c], word: action.word };
  };
  for (const [i, a] of actions.entries()) for (let j = i + 1; j < actions.length; j++) {
    const b = actions[j];
    if (a.axis === b.axis || a.layer === 1 || b.layer === 1) continue;
    const pair = commute(a, b);
    if (!pair.forward.size) continue;
    record(pair);
    const touching = new Set();
    for (const slot of pair.forward.keys()) for (const turn of memberships[slot]) touching.add(turn);
    for (const turn of touching) record(commute(pair, actions[turn]));
  }
}

function targetPermutation(puzzle, orbit) {
  const { state, faceArea } = puzzle;
  const expected = orbit.slots.map(slot => Math.floor(slot / faceArea));
  const current = orbit.slots.map(slot => state[slot]);
  const offsets = expected.map((_, i) => i);
  const targets = Array.from({ length: 4 }, () => []);
  for (const [i, color] of expected.entries()) if (current[i] !== color) targets[color].push(i);
  for (const [i, color] of current.entries()) {
    if (color === expected[i]) continue;
    const next = targets[color]?.pop();
    if (next === undefined) return null;
    offsets[i] = next;
  }
  let odd = false;
  for (let i = 0; i < offsets.length; i++) for (let j = 0; j < i; j++) if (offsets[j] > offsets[i]) odd = !odd;
  if (odd) {
    const first = current.findIndex((color, i) => offsets[i] !== i && current.indexOf(color) !== current.lastIndexOf(color));
    if (first === -1) return null;
    const second = current.findIndex((color, i) => i !== first && color === current[first]);
    [offsets[first], offsets[second]] = [offsets[second], offsets[first]];
  }
  return offsets;
}

function centerWords(orbit, actions, offsets, cache) {
  const { slots, turns, seed } = orbit;
  const ids = new Map(slots.map((slot, id) => [slot, id]));
  const n = slots.length, pack = (a, b, c) => (a * n + b) * n + c;
  const [a, b, c] = seed.triple.map(slot => ids.get(slot));
  const transitions = [];
  const seen = new Set();
  for (const turn of turns) {
    const action = actions[turn];
    for (const direction of [0, 1]) {
      const permutation = direction ? action.backward : action.forward;
      const row = slots.map(slot => ids.get(at(permutation, slot)));
      if (row.every((id, i) => id === i)) continue;
      const key = String.fromCharCode(...row);
      if (seen.has(key)) continue;
      seen.add(key);
      transitions.push({ move: 2 * turn + direction, row });
    }
  }
  const signature = String.fromCharCode(n, a, b, c) + [...seen].join('');
  let paths = cache.get(signature);
  if (!paths) {
    paths = new Map();
    const queue = [
      { triple: [a, b, c], reversed: false, setup: [] },
      { triple: [a, c, b], reversed: true, setup: [] },
    ];
    for (const entry of queue) paths.set(pack(...entry.triple), entry);
    for (const entry of queue) for (const [index, { row }] of transitions.entries()) {
      const triple = entry.triple.map(id => row[id]), key = pack(...triple);
      if (paths.has(key)) continue;
      const next = { triple, reversed: entry.reversed, setup: [...entry.setup, index] };
      paths.set(key, next);
      queue.push(next);
    }
    if (cache.size >= 64) cache.delete(cache.keys().next().value);
    cache.set(signature, paths);
  }
  const word = [];
  for (;;) {
    const open = offsets.flatMap((target, i) => target === i ? [] : [i]);
    if (!open.length) return word;
    let best, price = Infinity;
    for (const a of open) {
      const b = offsets[a];
      for (const c of open) {
        if (c === a || c === b) continue;
        const route = paths.get(pack(a, b, c));
        if (!route) continue;
        const gain = 1 + Number(offsets[b] === c) + Number(offsets[c] === a);
        const cost = (seed.word.length + 2 * route.setup.length) / gain;
        if (cost < price) { price = cost; best = route; }
      }
    }
    if (!best) return null;
    const [a, b, c] = best.triple;
    const setup = best.setup.map(index => transitions[index].move);
    word.push(...inverse(setup), ...(best.reversed ? inverse(seed.word) : seed.word), ...setup);
    [offsets[b], offsets[c], offsets[a]] = [offsets[a], offsets[b], offsets[c]];
  }
}

function compact(word, actions) {
  const runs = [];
  for (const move of word) {
    const turn = move >> 1, { axis } = actions[turn];
    let run = runs.at(-1);
    if (run?.axis !== axis) {
      run = { axis, powers: new Map() };
      runs.push(run);
    }
    const power = ((run.powers.get(turn) ?? 0) + (move % 2 ? 2 : 1)) % 3;
    if (power) run.powers.set(turn, power);
    else run.powers.delete(turn);
    if (!run.powers.size) runs.pop();
  }
  return runs.flatMap(({ powers }) => [...powers].map(([turn, power]) => turn * 2 + Number(power === 2)));
}

export function solveCenters(puzzle, onMoves = () => {}) {
  const model = centerModel(puzzle.size);
  findSeeds(model);
  const cache = new Map();
  for (const orbit of model.orbits) {
    if (!orbit.seed) continue;
    const offsets = targetPermutation(puzzle, orbit);
    if (!offsets || offsets.every((target, i) => target === i)) continue;
    const word = centerWords(orbit, model.actions, offsets, cache);
    if (!word?.length) continue;
    const moves = compact(word, model.actions).map(turn => {
      const { axis, layer } = model.actions[turn >> 1];
      return { axis, layer, direction: turn % 2 ? -1 : 1 };
    });
    for (const { axis, layer, direction } of moves) puzzle.turn(axis, layer, direction);
    onMoves(moves);
  }
}
