import { faces, Octahedron } from './puzzle.mjs';

// Outer turns only distinguish the subsets of coordinates that lie in the
// outer slab. This groups stickers whose face colors must move together.
function colorGroups(size) {
  const groups = new Map(), slots = [];
  for (let axis = 0; axis < faces.length; axis++) {
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size - row; column++) {
        for (let parity = 0; parity <= Number(row + column < size - 1); parity++) {
          const x = 3 * column + 1 + parity, y = 3 * row + 1 + parity, z = 3 * size - x - y;
          const bits = Number(x < 3) + 2 * Number(y < 3) + 4 * Number(z < 3) +
            8 * Number(x + y < 3) + 16 * Number(x + z < 3) + 32 * Number(y + z < 3);
          const key = axis * 64 + bits;
          let group = groups.get(key);
          if (!group) {
            group = { id: groups.size, face: axis, fixed: bits === 0, count: 0 };
            groups.set(key, group);
          }
          group.count++;
          slots.push(group.id);
        }
      }
    }
  }
  return { groups: [...groups.values()], slots: Uint16Array.from(slots) };
}

function scoring(size) {
  const { groups, slots } = colorGroups(size);
  const counts = new Uint32Array(8 * groups.length);
  return state => {
    counts.fill(0);
    for (let id = 0; id < slots.length; id++) counts[slots[id] * 8 + state[id]]++;
    let score = 0;
    for (const { id, face, fixed, count } of groups) {
      let keep = counts[8 * id + face];
      if (!fixed) {
        for (let color = 0; color < 8; color++) keep = Math.max(keep, counts[8 * id + color]);
      }
      score += count - keep;
    }
    return score;
  };
}

export function isOuterReduced(size, state) {
  if (!Number.isSafeInteger(size) || size < 4 || state.length !== 8 * size ** 2) {
    throw new RangeError('Size and sticker count must match an FTO with inner slices.');
  }
  return scoring(size)(state) === 0;
}

function availableMoves(size) {
  const puzzle = new Octahedron(size);
  const identity = Uint32Array.from(puzzle.state, (_, id) => id);
  puzzle.state = identity.slice();
  puzzle.buffer = identity.slice();
  const candidates = [];
  for (let axis = 0; axis < faces.length; axis++) {
    for (let layer = 1; layer <= puzzle.depth; layer++) {
      puzzle.state.set(identity);
      puzzle.turn(axis, layer, 1);
      const from = [], to = [];
      for (let id = 0; id < puzzle.state.length; id++) {
        if (puzzle.state[id] === id) continue;
        from.push(puzzle.state[id]);
        to.push(id);
      }
      const sources = Uint32Array.from(from), destinations = Uint32Array.from(to);
      candidates.push({ axis, layer, direction: 1, sources, destinations });
      candidates.push({ axis, layer, direction: -1, sources: destinations, destinations: sources });
    }
  }
  return candidates;
}

// A bounded search from the actual colors. Returns null when it cannot
// reduce the given state within the work limit.
export function reduceInnerSlices(size, state, { maxDepth = 8, beamWidth = 96, nodeBudget = 40_000 } = {}) {
  if (!Number.isSafeInteger(size) || size < 4 || state.length !== 8 * size ** 2) {
    throw new RangeError('Size and sticker count must match an FTO with inner slices.');
  }
  const score = scoring(size);
  const initialPenalty = score(state);
  if (!initialPenalty) return [];
  // Bound both the size of the move tables and the sticker work performed.
  if (state.length * Math.floor(size / 2) * faces.length > 2_000_000) return null;
  nodeBudget = Math.min(nodeBudget, Math.floor(25_000_000 / state.length));
  const moves = availableMoves(size), scratch = new Uint8Array(state.length);
  // Exact transposition keys are economical for the sizes where search scales.
  const key = values => {
    let packed = '';
    for (let from = 0; from < values.length; from += 4096) {
      packed += String.fromCharCode(...values.subarray(from, from + 4096));
    }
    return packed;
  };
  let queue = [{ state, path: [], penalty: initialPenalty, stateKey: key(state) }];
  let nodes = 0;
  for (let depth = 0; depth < maxDepth; depth++) {
    const children = [];
    const seen = new Set(queue.map(child => child.stateKey));
    let worstRetained = Infinity;
    for (const current of queue) for (const move of moves) {
      const last = current.path.at(-1);
      if (last?.axis === move.axis && last.layer === move.layer) continue;
      if (++nodes > nodeBudget) return null;
      scratch.set(current.state);
      for (let i = 0; i < move.sources.length; i++) scratch[move.destinations[i]] = current.state[move.sources[i]];
      const penalty = score(scratch);
      if (penalty >= worstRetained) continue;
      const stateKey = key(scratch);
      if (seen.has(stateKey)) continue;
      seen.add(stateKey);
      const path = [...current.path, { axis: move.axis, layer: move.layer, direction: move.direction }];
      if (!penalty) return path;
      children.push({ state: scratch.slice(), path, penalty, stateKey });
      if (children.length >= 2 * beamWidth) {
        children.sort((a, b) => a.penalty - b.penalty);
        children.length = beamWidth;
        worstRetained = children.at(-1).penalty;
      }
    }
    children.sort((a, b) => a.penalty - b.penalty);
    queue = children.slice(0, beamWidth);
    if (!queue.length) break;
  }
  return null;
}
