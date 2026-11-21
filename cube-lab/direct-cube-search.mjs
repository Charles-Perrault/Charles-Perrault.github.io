import { Cube, solvedColors } from './cube.mjs?v=17';

const opposite = [3, 4, 5, 0, 1, 2];
const depthBits = 20;
const codeMask = (1 << depthBits) - 1;
const decodeColors = new TextDecoder();

// A color relabeling by a proper cube rotation commutes with every turn.
// Two adjacent colors determine a unique orientation of the six colors.
function colorFrames() {
  const frames = [];
  const seen = new Set();
  const pending = [new Cube(2)];
  while (pending.length) {
    const cube = pending.pop();
    const colors = cube.faces.map((face) => face[0]);
    const key = colors.join('');
    if (seen.has(key)) continue;
    seen.add(key);
    const map = new Uint8Array(6);
    for (let face = 0; face < 6; face++) map[colors[face]] = solvedColors[face];
    frames[colors[3] * 6 + colors[4]] = map;
    for (let axis = 0; axis < 3; axis++) {
      const rotated = cube.clone();
      rotated.apply({ axis, layer: 0, endLayer: 1, turns: 1 });
      pending.push(rotated);
    }
  }
  return frames;
}

const frames = colorFrames();

function facelets(cube) {
  const { size } = cube;
  const values = new Uint8Array(6 * size * size);
  let i = 0;
  for (let face = 0; face < 6; face++) {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) values[i++] = cube.stickerAt(face, row, col);
    }
  }
  return values;
}

function turnsFor(size) {
  const area = size * size;
  const count = area * 6;
  const stamp = (bits) => new Cube(size, solvedColors.map((_, face) =>
    Uint8Array.from({ length: area }, (_, index) => (face * area + index) >> bits)));
  const low = stamp(0);
  const high = stamp(8);
  const moves = [];
  for (let axis = 0; axis < 3; axis++) {
    for (let layer = 0; layer < size; layer++) {
      for (const turns of [1, -1, 2]) {
        const move = { axis, layer, turns };
        const a = low.clone(), b = high.clone();
        a.apply(move);
        b.apply(move);
        const lower = facelets(a), upper = facelets(b);
        const permutation = Uint16Array.from(lower, (value, index) => value | (upper[index] << 8));
        const seen = new Uint8Array(count);
        const cycles = [];
        for (let i = 0; i < count; i++) {
          if (seen[i] || permutation[i] === i) continue;
          const cycle = [];
          for (let j = i; !seen[j]; j = permutation[j]) {
            seen[j] = 1;
            cycle.push(j);
          }
          cycles.push(cycle);
        }
        moves.push({ move, cycles });
      }
    }
  }
  return moves;
}

function rotate(state, cycles) {
  for (const cycle of cycles) {
    const first = state[cycle[0]];
    for (let i = 0; i < cycle.length - 1; i++) state[cycle[i]] = state[cycle[i + 1]];
    state[cycle[cycle.length - 1]] = first;
  }
}

// Look up exact, short single-slice solutions from stickers. Half turns cost one.
// The two exhaustive radius-three searches cover every path of length at most six.
export function findDirectSolution(source, { budgetMs = 1800, radius = 3 } = {}) {
  if (source.isSolved()) return [];
  const { size } = source;
  if (size < 4 || size > 7 || !Number.isInteger(radius) || radius < 1 || radius > 3) return null;
  const deadline = performance.now() + budgetMs;
  const turns = turnsFor(size);
  const origin = facelets(source);
  const scratch = new Uint8Array(origin.length);
  let nodes = 0;

  function key(state) {
    const first = state[0];
    let adjacent = 1;
    while (state[adjacent] === first || state[adjacent] === opposite[first]) adjacent++;
    const frame = frames[first * 6 + state[adjacent]];
    for (let i = 0; i < state.length; i++) scratch[i] = frame[state[i]];
    return decodeColors.decode(scratch);
  }

  function visit(state, remaining, previous, code, callback) {
    if (remaining === 0) {
      if ((++nodes & 1023) === 0 && performance.now() >= deadline) return false;
      callback(key(state), code);
      return true;
    }
    const last = turns[previous]?.move;
    for (let index = 0; index < turns.length; index++) {
      const { move, cycles } = turns[index];
      if (last?.axis === move.axis && last.layer >= move.layer) continue;
      rotate(state, cycles);
      const complete = visit(state, remaining - 1, index, code * turns.length + index, callback);
      rotate(state, turns[inverse(index)].cycles);
      if (!complete) return false;
    }
    return true;
  }

  function inverse(index) {
    const direction = index % 3;
    return direction === 2 ? index : index + (direction ? -1 : 1);
  }

  function decode(code, depth) {
    const result = new Array(depth);
    for (let i = depth - 1; i >= 0; i--) {
      result[i] = code % turns.length;
      code = Math.floor(code / turns.length);
    }
    return result;
  }

  function join(front, frontDepth, back) {
    const prefix = decode(front, frontDepth);
    const suffix = decode(back & codeMask, back >>> depthBits).reverse().map(inverse);
    return prefix.concat(suffix).map((index) => turns[index].move);
  }

  const goal = facelets(new Cube(size));
  const table = new Map([[key(goal), 0]]);
  const originKey = key(origin);
  for (let depth = 1; depth <= radius; depth++) {
    if (!visit(goal, depth, -1, 0, (state, code) => {
      if (!table.has(state)) table.set(state, (depth << depthBits) | code);
    })) return null;
    if (table.has(originKey)) return join(0, 0, table.get(originKey));
  }
  let best = null;
  for (let depth = 1; depth <= radius; depth++) {
    if (!visit(origin, depth, -1, 0, (state, code) => {
      const back = table.get(state);
      if (back === undefined) return;
      const length = depth + (back >>> depthBits);
      if (!best || length < best.length) best = join(code, depth, back);
    })) return null;
    if (best && best.length <= depth + radius) return best;
  }
  return null;
}
