import { forEachTransfer, Pyraminx } from './puzzle.mjs';
import { solveCenters } from './center-solver.mjs';
import { solveCore } from './core-solver.mjs';
import { solveWings } from './wing-solver.mjs';

const inverse = move => ({ ...move, direction: -move.direction });
let mainSearch;

function prepareMainSearch() {
  const size = 3, puzzle = new Pyraminx(size);
  const tips = new Set();
  for (let axis = 0; axis < 4; axis++) forEachTransfer(size, axis, 1, 1, from => tips.add(from));
  const core = [...puzzle.state.keys()].filter(id => !tips.has(id));
  const slots = new Map(core.map((id, index) => [id, index]));
  const values = core.map((_, index) => 4 ** index);
  const encode = state => core.reduce((position, id, index) => position + state[id] * values[index], 0);
  const moves = [];
  for (let axis = 0; axis < 4; axis++) for (const direction of [1, -1]) {
    const transfers = [];
    forEachTransfer(size, axis, 2, direction, (from, to) => {
      const source = values[slots.get(from)], target = values[slots.get(to)];
      transfers.push([source, target - source]);
    });
    moves.push({ axis, layer: 2, direction, transfers });
  }
  const apply = (state, move) => {
    let next = state;
    for (const [source, difference] of moves[move].transfers) {
      next += Math.floor(state / source) % 4 * difference;
    }
    return next;
  };
  const goal = encode(puzzle.state);
  const towardHome = new Map([[goal, { move: -1 }]]);
  let queue = [goal];
  for (let depth = 0; depth < 5; depth++) {
    const nextQueue = [];
    for (const position of queue) for (let move = 0; move < moves.length; move++) {
      if ((move >> 1) === (towardHome.get(position).move >> 1)) continue;
      const next = apply(position, move);
      if (towardHome.has(next)) continue;
      towardHome.set(next, { move: move ^ 1, next: position });
      nextQueue.push(next);
    }
    queue = nextQueue;
  }
  return { encode, moves, apply, goal, towardHome };
}

function mainSolution(state) {
  const { encode, moves, apply, goal, towardHome } = mainSearch ??= prepareMainSearch();
  const start = encode(state);
  const seen = new Map([[start, { move: -1 }]]);
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const position = queue[head++];
    if (towardHome.has(position)) {
      const path = [];
      for (let from = position; from !== start;) {
        const node = seen.get(from);
        path.push(node.move);
        from = node.previous;
      }
      path.reverse();
      for (let from = position; from !== goal;) {
        const node = towardHome.get(from);
        path.push(node.move);
        from = node.next;
      }
      return path.map(id => {
        const { axis, layer, direction } = moves[id];
        return { axis, layer, direction };
      });
    }
    for (let move = 0; move < moves.length; move++) {
      if ((move >> 1) === (seen.get(position).move >> 1)) continue;
      const next = apply(position, move);
      if (seen.has(next)) continue;
      seen.set(next, { move, previous: position });
      queue.push(next);
    }
  }
  throw new Error('No solution was found for this sticker state.');
}

function solveTips(puzzle) {
  const moves = [];
  for (let axis = 0; axis < 4; axis++) {
    const move = { axis, layer: 1, direction: 1 };
    const good = direction => {
      let matches = true;
      forEachTransfer(puzzle.size, axis, 1, direction, (from, to) => {
        matches &&= puzzle.state[from] === Math.floor(to / puzzle.faceArea);
      });
      return matches;
    };
    if (good(1)) moves.push(move);
    else if (good(-1)) moves.push(inverse(move));
  }
  for (const move of moves) puzzle.turn(move.axis, move.layer, move.direction);
  return moves;
}

export function countMisplaced(puzzle) {
  let count = 0;
  for (let face = 0; face < 4; face++) {
    const end = (face + 1) * puzzle.faceArea;
    for (let id = face * puzzle.faceArea; id < end; id++) count += Number(puzzle.state[id] !== face);
  }
  return count;
}

// A generated cut only touches O(size) stickers. Score the changed band
// directly, and accept a two-turn setup only if it improves the state.
function improve(puzzle, misplaced, report) {
  const { size, depth, faceArea, state } = puzzle;
  const cacheBands = size <= 180;
  const choices = [];
  for (let axis = 0; axis < 4; axis++) for (let layer = 2; layer <= depth; layer++) {
    for (const direction of [1, -1]) {
      const move = { axis, layer, direction };
      if (!cacheBands) { choices.push({ move }); continue; }
      const from = [], to = [];
      forEachTransfer(size, axis, layer, direction, (source, target) => {
        from.push(source);
        to.push(target);
      });
      choices.push({
        move, from: Uint32Array.from(from), to: Uint32Array.from(to),
        start: Uint8Array.from(from, id => Math.floor(id / faceArea)),
        end: Uint8Array.from(to, id => Math.floor(id / faceArea)),
      });
    }
  }
  const gain = ({ move, from, start, end }) => {
    let total = 0;
    if (!from) {
      forEachTransfer(size, move.axis, move.layer, move.direction, (a, b) => {
        const color = state[a];
        total += Number(color === Math.floor(b / faceArea)) - Number(color === Math.floor(a / faceArea));
      });
      return total;
    }
    for (let i = 0; i < from.length; i++) {
      const color = state[from[i]];
      total += Number(color === end[i]) - Number(color === start[i]);
    }
    return total;
  };
  const scratch = new Uint8Array(6 * size);
  const apply = (entry, undo = false) => {
    if (!entry.from) {
      const { axis, layer, direction } = entry.move;
      puzzle.turn(axis, layer, undo ? -direction : direction);
      return;
    }
    const from = undo ? entry.to : entry.from, to = undo ? entry.from : entry.to;
    for (let i = 0; i < from.length; i++) scratch[i] = state[from[i]];
    for (let i = 0; i < to.length; i++) state[to[i]] = scratch[i];
  };
  const deadline = performance.now() + 2500;
  while (misplaced && performance.now() < deadline) {
    const ranked = choices.map(entry => ({ entry, score: gain(entry) })).sort((a, b) => b.score - a.score);
    let best = ranked[0].score > 0 ? [ranked[0].entry] : null;
    let score = Math.max(0, ranked[0].score);
    if (!best) {
      for (const first of ranked.slice(0, size < 64 ? 16 : 6)) {
        apply(first.entry);
        for (const second of choices) {
          const total = first.score + gain(second);
          if (total <= score) continue;
          best = [first.entry, second];
          score = total;
        }
        apply(first.entry, true);
        if (performance.now() >= deadline) break;
      }
    }
    if (!best) return misplaced;
    for (const entry of best) apply(entry);
    misplaced -= score;
    report(best.map(entry => entry.move), misplaced);
  }
  return misplaced;
}

export function solve(size, state, report = () => {}) {
  const puzzle = new Pyraminx(size);
  if (state.length !== puzzle.state.length) throw new RangeError('Sticker state size does not match the Pyraminx.');
  puzzle.state.set(state);
  const tipMoves = solveTips(puzzle);
  let misplaced = countMisplaced(puzzle);
  if (tipMoves.length) report(tipMoves, misplaced);
  if (size <= 3) {
    const moves = size === 3 ? mainSolution(puzzle.state) : [];
    for (const { axis, layer, direction } of moves) puzzle.turn(axis, layer, direction);
    if (!puzzle.solved) throw new Error('The planned moves did not solve the puzzle.');
    if (moves.length) report(moves, 0);
    return 0;
  }
  if (misplaced) misplaced = improve(puzzle, misplaced, report);
  if (misplaced) {
    solveCore(puzzle, moves => report(moves));
    if (!puzzle.solved) solveWings(puzzle, moves => report(moves));
    misplaced = countMisplaced(puzzle);
  }
  if (misplaced) {
    solveCenters(puzzle, moves => {
      // The generated commutator touches one center orbit, but its setup
      // can make the intermediate states look much further from solved.
      report(moves);
    });
    misplaced = countMisplaced(puzzle);
  }
  return misplaced;
}
