import { Octahedron, faces, layerAt } from './puzzle.mjs?v=2';
import { oddSchedules } from './odd-schedules.mjs';

const reverse = word => word.slice().reverse().map(v => v ^ 1);
const at = (map, id) => map.get(id) ?? id;
const textKey = state => String.fromCharCode(...state);

function commutator(a, b) {
  const affected = new Set();
  const [small, large] = a.forward.size < b.forward.size ? [a, b] : [b, a];
  for (const id of small.forward.keys()) if (large.forward.has(id)) {
    affected.add(id);
    affected.add(at(a.backward, id));
    affected.add(at(b.backward, id));
  }
  const forward = new Map(), backward = new Map();
  for (const from of affected) {
    const to = at(b.backward, at(a.backward, at(b.forward, at(a.forward, from))));
    if (to !== from) { forward.set(from, to); backward.set(to, from); }
  }
  return { forward, backward, word: [...a.word, ...b.word, ...reverse(a.word), ...reverse(b.word)] };
}

function geometry(size) {
  const cube = new Octahedron(size), area = size * size, count = cube.state.length;
  const groups = new Map();
  for (const [face, { signs }] of faces.entries()) for (let row = 0; row < size; row++) {
    for (let col = 0; col < size - row; col++) for (const offset of [0, 1]) {
      if (col + row + offset >= size) continue;
      const a = 3 * col + 1 + offset, b = 3 * row + 1 + offset;
      const coordinates = [a, b, 3 * size - a - b].map((value, i) => signs[i] * value / (3 * size));
      const key = faces.map((_, axis) => layerAt(size, axis, coordinates)).join(',');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(face * area + row * (2 * size - row) + 2 * col + offset);
    }
  }
  const pieces = [...groups.values()], pieceOf = new Uint32Array(count);
  pieces.forEach((slots, i) => slots.forEach(slot => { pieceOf[slot] = i; }));
  const home = cube.state.slice();
  cube.state = new Uint32Array(count);
  cube.buffer = new Uint32Array(count);
  const identity = Uint32Array.from({ length: count }, (_, i) => i);
  const actions = [], moves = [];
  for (let axis = 0; axis < 8; axis++) for (let layer = 1; layer <= cube.depth; layer++) {
    cube.state.set(identity);
    cube.turn(axis, layer, 1);
    const forward = new Map(), backward = new Map();
    cube.state.forEach((from, to) => {
      if (from !== to) { forward.set(from, to); backward.set(to, from); }
    });
    const id = moves.length;
    actions.push({ forward, backward, word: [id] }, { forward: backward, backward: forward, word: [id+1] });
    moves.push({axis, layer, direction: 1}, {axis, layer, direction: -1});
  }
  const orbitOf = new Int32Array(pieces.length).fill(-1), orbits = [];
  for (const [id, slots] of pieces.entries()) {
    if (orbitOf[id] >= 0) continue;
    const orbit = [id];
    orbitOf[id] = orbits.length;
    for (const piece of orbit) for (const action of actions) {
      const destination = pieceOf[at(action.forward, pieces[piece][0])];
      if (orbitOf[destination] < 0) {
        orbitOf[destination] = orbitOf[id];
        orbit.push(destination);
      }
    }
    orbits.push({ pieces: orbit, core: slots.length === 4 || orbit.length < 6, seed: null });
  }
  return { pieces, pieceOf, orbitOf, orbits, actions, moves, home };
}

function seedOrbits(model) {
  const { actions, pieceOf, orbitOf, orbits } = model;
  let remaining = orbits.filter(orbit => !orbit.core).length;
  function record(action) {
    if (action.forward.size < 3 || action.forward.size > 6) return;
    const ids = [...new Set([...action.forward.keys()].map(id => pieceOf[id]))];
    if (ids.length !== 3) return;
    const orbit = orbits[orbitOf[ids[0]]];
    if (orbit.core || orbit.seed || !ids.every(id => orbitOf[id] === orbitOf[ids[0]])) return;
    const [a] = ids, b = pieceOf[at(action.forward, model.pieces[a][0])];
    const c = pieceOf[at(action.forward, model.pieces[b][0])];
    if (new Set([a,b,c]).size !== 3 || pieceOf[at(action.forward, model.pieces[c][0])] !== a) return;
    orbit.seed = { triple: [a,b,c], word: action.word };
    remaining--;
  }
  const generators = actions.filter((_, i) => !(i & 1)), pairs = [], triples = [];
  for (const [i, a] of generators.entries()) for (let j = i + 1; j < generators.length; j++) {
    const pair = commutator(a, generators[j]);
    if (!pair.forward.size) continue;
    record(pair);
    pairs.push(pair);
  }
  for (const pair of pairs) for (const action of generators) {
    const combo = commutator(pair, action);
    if (!combo.forward.size) continue;
    record(combo);
    if (!remaining) return;
    triples.push(combo);
  }
  for (const triple of triples) for (const action of generators) {
    record(commutator(triple, action));
    if (!remaining) return;
  }
}

function corePattern(slots, model) {
  const { actions, home } = model;
  const index = new Map(slots.map((slot, i) => [slot,i]));
  const perm = actions.map(a => slots.map(id => index.get(at(a.backward,id))));
  const goal = textKey(slots.map(id => home[id]));
  const keys = [goal], ids = new Map([[goal,0]]), distance = [0], next = [];
  for (const key of keys) {
    const row = [];
    for (const move of perm) {
      const target = textKey(move.map(i => key.charCodeAt(i)));
      if (!ids.has(target)) {
        ids.set(target, keys.length);
        keys.push(target);
        distance.push(distance[ids.get(key)] + 1);
      }
      row.push(ids.get(target));
    }
    next.push(row);
  }
  return { ids, slots, distance, next };
}

function coreWord(model, state, core) {
  const patterns = core.map(orbit => corePattern(orbit.pieces.flatMap(piece => model.pieces[piece]), model));
  const start = patterns.map(({ ids, slots }) => ids.get(textKey(slots.map(id => state[id]))));
  const word = [], h = nodes => Math.max(...nodes.map((id,i) => patterns[i].distance[id]));
  function find(nodes, depth, previous) {
    const lower = h(nodes);
    if (lower > depth) return false;
    if (lower === 0) return true;
    for (const [move] of model.moves.entries()) {
      if ((move >> 1) === (previous >> 1)) continue;
      const next = nodes.map((id,i) => patterns[i].next[id][move]);
      if (!next.some((n,i) => n !== nodes[i])) continue;
      word.push(move);
      if (find(next, depth-1, move)) return true;
      word.pop();
    }
    return false;
  }
  for (let depth = h(start); depth <= 14; depth++) if (find(start, depth, -1)) return word;
  return null;
}

function cycleWords(orbit, model, state) {
  const { pieces, actions, pieceOf, home } = model;
  const slots = orbit.pieces;
  const keys = (values, id) => pieces[id].map(i => values[i]).sort().join(',');
  const wanted = slots.map(id => keys(home,id)), current = slots.map(id => keys(state,id));
  const target = current.map((key,i) => wanted[i] === key ? i : -1);
  const free = new Set(slots.keys());
  for (const idx of target) if (idx >= 0) free.delete(idx);
  for (const i of target.keys()) if (target[i] < 0) {
    const dst = [...free].find(j => current[i] === wanted[j]);
    if (dst === undefined) return null;
    target[i] = dst;
    free.delete(dst);
  }
  let odd = false;
  for (const [i, value] of target.entries()) for (let j = 0; j < i; j++) if (target[j] > value) odd = !odd;
  if (odd) {
    const i = current.findIndex((value,j) => current.indexOf(value) !== j);
    if (i < 0) return null;
    const j = current.indexOf(current[i]);
    [target[i], target[j]] = [target[j], target[i]];
  }
  if (target.every((v,i) => v === i)) return [];
  const { triple, word } = orbit.seed;
  const local = new Map(slots.map((id,i) => [id,i]));
  const rows = actions.map(action => slots.map(id => local.get(pieceOf[at(action.forward,pieces[id][0])])));
  const N=slots.length, code = ([a,b,c]) => (a*N+b)*N+c;
  const initial = triple.map(id => local.get(id));
  const nodes = new Map([[code(initial), { triple: initial, previous: null, move: -1 }]]);
  for (const node of nodes.values()) for (const [move,row] of rows.entries()) {
    const next = node.triple.map(i => row[i]), id = code(next);
    if (!nodes.has(id)) nodes.set(id,{ triple: next, previous: node, move });
  }
  function setup(a,b,c) {
    for (const [x,y,z] of [[a,b,c],[b,c,a],[c,a,b]]) {
      let node = nodes.get(code([x,y,z]));
      if (!node) continue;
      const undo=[];
      while(node.previous){undo.push(node.move^1);node=node.previous;}
      return [...undo,...word,...reverse(undo)];
    }
    return null;
  }
  const result = [];
  for (let a = target.findIndex((v,i) => v !== i); a >= 0; a = target.findIndex((v,i) => v !== i)) {
    const b=target[a], c=target[b] === a ? target.findIndex((v,i) => v !== i && i !== a && i !== b) : target[b];
    if (c < 0) return null;
    const insert = setup(a,b,c);
    if (!insert) return null;
    result.push(...insert);
    [target[a],target[b],target[c]]=[target[c],target[a],target[b]];
  }
  return result;
}

export function constructiveSolution(size, input) {
  if (size > 12) return null;
  const model = geometry(size);
  const core = model.orbits.filter(orbit => orbit.core);
  const schedule = oddSchedules[size];
  let remaining;
  if (schedule) {
    remaining = schedule.map(([id, word]) => {
      const orbit = model.orbits[id];
      function destination(piece) {
        let sticker = model.pieces[piece][0];
        for (const move of word) sticker = at(model.actions[move].forward, sticker);
        return model.pieceOf[sticker];
      }
      const a = orbit.pieces.find(piece => destination(piece) !== piece);
      const b = destination(a), c = destination(b);
      orbit.seed = { triple: [a, b, c], word };
      return orbit;
    });
  } else {
    seedOrbits(model);
    remaining = model.orbits.filter(orbit => !orbit.core);
  }
  if (remaining.some(orbit => !orbit.seed)) return null;
  const draft = new Octahedron(size), plan = [];
  draft.state.set(input);
  function perform(word) {
    for (const index of word) {
      const {axis,layer,direction} = model.moves[index];
      draft.turn(axis,layer,direction);
      plan.push(model.moves[index]);
    }
  }
  // Corner turns and the two odd-order centroid orbits have disjoint moves.
  const coreGroups = schedule ? [core.slice(0, 1), core.slice(1)] : [core];
  for (const group of coreGroups) {
    if (!group.length) continue;
    const word = coreWord(model, draft.state, group);
    if (!word) return null;
    perform(word);
  }
  for (const orbit of remaining) {
    const word = cycleWords(orbit, model, draft.state);
    if (!word) return null;
    perform(word);
  }
  return draft.solved ? plan : null;
}
