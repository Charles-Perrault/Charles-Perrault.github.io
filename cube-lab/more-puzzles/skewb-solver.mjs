function project(state, slots) {
  return String.fromCharCode(...slots.map(slot => state[slot]));
}

function apply(state, permutation) {
  let next = '';
  for (const source of permutation) next += state[source];
  return next;
}

function invert(permutation) {
  const inverse = [];
  for (let i = 0; i < permutation.length; i++) inverse[permutation.charCodeAt(i)] = i;
  return inverse;
}
const inverseWord = word => word.slice().reverse().map(move => move ^ 1);

function pathTo(state, records) {
  const word = [];
  for (let record = records.get(state); record?.previous !== undefined; record = records.get(record.previous)) {
    word.push(record.move);
  }
  return word.reverse();
}

function orbit(home, permutations) {
  const queue = [home];
  const records = new Map([[home, null]]);
  for (const previous of queue) {
    for (const [move, permutation] of permutations.entries()) {
      const next = apply(previous, permutation);
      if (records.has(next)) continue;
      records.set(next, { previous, move });
      queue.push(next);
    }
  }
  return records;
}

function slicePermutation(permutation, slots) {
  return slots.map(slot => slots.indexOf(permutation[slot]));
}

function actionsFor(puzzle, corners, centers) {
  const snapshot = puzzle.state.slice();
  const labels = Uint8Array.from({ length: puzzle.home.length }, (_, i) => i);
  const actions = [];
  try {
    for (const turn of puzzle.moves) for (const direction of [1, -1]) {
      puzzle.state.set(labels);
      puzzle.turn(turn, direction);
      const permutation = puzzle.state;
      actions.push({ corners: slicePermutation(permutation, corners), centers: slicePermutation(permutation, centers) });
    }
  } finally {
    puzzle.state.set(snapshot);
  }
  return actions;
}

function buildTables(actions, homeCorners, homeCenters) {
  // Use one cap per diagonal. These moves leave one tetrahedron of corners
  // in place. A pair of complementary caps rotates the entire puzzle.
  const baseMoves = actions.flatMap((_, move) => (move & 2) === 0 ? [move] : []);
  const rotations = orbit(homeCorners, baseMoves.map(move =>
    actions[move + 2].corners.map(i => actions[move].corners[i])));
  const frames = [...rotations.keys()].map(position =>
    pathTo(position, rotations).flatMap(index => [baseMoves[index], baseMoves[index] + 2]));
  const centersOnly = baseMoves.map(move => actions[move].centers);
  const centerCount = orbit(homeCenters, centersOnly).size;
  const queue = [homeCorners];
  const corners = new Map([[homeCorners, { center: homeCenters }]]);
  const macros = [], permutations = [];
  let kernel = orbit(homeCenters, permutations);
  for (const previous of queue) {
    const record = corners.get(previous);
    for (const move of baseMoves) {
      const action = actions[move];
      const next = apply(previous, action.corners);
      const center = kernel.size < centerCount ? apply(record.center, action.centers) : null;
      const destination = corners.get(next);
      if (!destination) {
        corners.set(next, { previous, move, center });
        queue.push(next);
      } else if (center !== null && center !== destination.center) {
        // Two paths to the same corner arrangement differ only in the centers.
        const relation = apply(center, invert(destination.center));
        if (kernel.has(relation)) continue;
        const inverse = invert(relation);
        const word = [...pathTo(previous, corners), move, ...inverseWord(pathTo(next, corners))];
        macros.push(word, inverseWord(word));
        permutations.push([...relation].map(value => value.charCodeAt(0)), inverse);
        kernel = orbit(homeCenters, permutations);
      }
    }
  }
  return { corners, kernels: kernel, macros, frames };
}

function simplify(word) {
  const output = [];
  for (const move of word) {
    const last = output.at(-1);
    if (last === undefined || (last >> 1) !== (move >> 1)) output.push(move);
    else {
      output.pop();
      if (last === move) output.push(move ^ 1);
    }
  }
  return output;
}

let cached;
export function solveSkewb(puzzle, state = puzzle.state) {
  if (puzzle.home.length !== 30 || puzzle.moves.length !== 8 || state.length !== 30) {
    throw new RangeError('The Skewb solver needs a standard two-layer sticker snapshot.');
  }
  const counts = new Uint8Array(6);
  for (const color of state) {
    if (!Number.isInteger(color) || color < 0 || color >= counts.length) throw new RangeError('Invalid Skewb sticker color.');
    counts[color]++;
  }
  if (counts.some(count => count !== 5)) throw new RangeError('Each Skewb color needs five stickers.');
  if (puzzle.home.every((color, i) => color === state[i])) return [];

  const corners = [], centers = [];
  puzzle.stickers.forEach((tile, i) => (tile.polygon.length === 3 ? corners : centers).push(i));
  const actions = actionsFor(puzzle, corners, centers);
  const homeCorners = project(puzzle.home, corners);
  const homeCenterLabels = centers.map((_, i) => i);
  const homeCenters = String.fromCharCode(...homeCenterLabels);
  const signature = JSON.stringify([actions, homeCorners, homeCenters]);
  if (cached?.signature !== signature) cached = { signature, ...buildTables(actions, homeCorners, homeCenters) };
  const position = project(state, corners);
  const framed = cached.frames.map(frame => ({
    frame,
    corners: frame.reduce((current, move) => apply(current, actions[move].corners), position),
  })).find(({ corners }) => cached.corners.has(corners));
  if (!framed) throw new Error('Invalid Skewb corner arrangement.');
  const cornerWord = [...framed.frame, ...inverseWord(pathTo(framed.corners, cached.corners))];
  const centerLabels = new Map(centers.map((slot, i) => [puzzle.home[slot], i]));
  let center = String.fromCharCode(...centers.map(slot => centerLabels.get(state[slot])));
  for (const move of cornerWord) center = apply(center, actions[move].centers);
  if (!cached.kernels.has(center)) throw new Error('Invalid Skewb center arrangement.');
  const centerWord = inverseWord(pathTo(center, cached.kernels).flatMap(move => cached.macros[move]));
  return simplify([...cornerWord, ...centerWord]).map(move => ({ turn: puzzle.moves[move >> 1], direction: move & 1 ? -1 : 1 }));
}
