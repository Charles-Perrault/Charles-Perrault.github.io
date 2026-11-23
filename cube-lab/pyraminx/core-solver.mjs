import { faces, forEachTransfer } from './puzzle.mjs';

function coreGroups(size) {
  const groups = new Map();
  const area = size ** 2;
  const mid = Math.floor((size - 1) / 2);
  for (const face of faces.keys()) for (let row = 0; row < size; row++) {
    for (let column = 0; column < size - row; column++) for (const parity of [0, 1]) {
      const last = size - 1 - parity - row - column;
      if (last < 0) continue;
      const coordinates = [row, column, last].filter(value => value > 0);
      const depth = size - coordinates[0];
      const axial = coordinates.length === 1;
      const middleEdge = coordinates.length === 2 && coordinates.every(value => value === mid);
      const faceCenter = coordinates.length === 3 && coordinates.every(value => value === coordinates[0]);
      if (!axial && !middleEdge && !faceCenter) continue;
      if (!groups.has(depth)) groups.set(depth, []);
      groups.get(depth).push(face * area + row * (2 * size - row) + 2 * column + parity);
    }
  }
  return groups;
}

function projectionMoves(size, depth, slots) {
  const indexOf = new Map(slots.map((slot, index) => [slot, index]));
  return faces.flatMap((_, axis) => [1, -1].map(direction => {
    const pull = slots.map((_, index) => index);
    forEachTransfer(size, axis, depth, direction, (from, to) => {
      if (indexOf.has(from)) pull[indexOf.get(to)] = indexOf.get(from);
    });
    return { axis, layer: depth, direction, pull };
  }));
}

function findCoreWord(start, goal, moves) {
  if (start === goal) return [];
  let left = [start], right = [goal];
  const fromStart = new Map([[start, null]]), fromGoal = new Map([[goal, null]]);
  while (left.length && right.length) {
    const advanceStart = left.length <= right.length;
    const current = advanceStart ? left : right;
    const own = advanceStart ? fromStart : fromGoal;
    const other = advanceStart ? fromGoal : fromStart;
    const next = [];
    for (const value of current) for (const [index, { pull }] of moves.entries()) {
      const key = pull.map(i => value[i]).join('');
      if (own.has(key)) continue;
      own.set(key, { parent: value, index });
      if (other.has(key)) {
        const prefix = [], suffix = [];
        for (let step = fromStart.get(key); step; step = fromStart.get(step.parent)) prefix.push(step.index);
        for (let step = fromGoal.get(key); step; step = fromGoal.get(step.parent)) suffix.push(step.index ^ 1);
        return [...prefix.reverse(), ...suffix];
      }
      next.push(key);
    }
    if (advanceStart) left = next;
    else right = next;
  }
  throw new Error('Pyraminx core colors do not match a reachable state');
}

export function solveCore(puzzle, onMoves = () => {}) {
  const { size, state, faceArea } = puzzle;
  for (const [depth, slots] of coreGroups(size)) {
    const start = slots.map(slot => state[slot]).join('');
    const target = slots.map(slot => Math.floor(slot / faceArea)).join('');
    if (start === target) continue;
    const moves = projectionMoves(size, depth, slots);
    const word = findCoreWord(start, target, moves).map(index => {
      const { axis, layer, direction } = moves[index];
      puzzle.turn(axis, layer, direction);
      return { axis, layer, direction };
    });
    onMoves(word);
  }
}
