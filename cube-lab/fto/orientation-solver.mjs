import { faces, Octahedron } from './puzzle.mjs';

const home = '01234567';
// An outer-turn word found by composing a fixed benchmark state with its
// Omelettehedron solution. On the 72-sticker core it is a 120° change of hold.
// This is a fixed generator, independent of the user's current state.
const rotationWord = [
  7, 0, 7, 14, 6, 9, 3, 9, 13, 4, 7, 13, 7, 11, 7, 4, 8, 15, 7, 12, 15, 3,
  10, 14, 12, 1, 7, 1, 7, 12, 3, 15, 12, 8, 6, 1, 2, 13, 4, 1, 9, 5, 14, 2,
  15, 8, 14, 3, 0, 10, 1, 14, 10, 9, 6, 12, 6, 0, 5, 6, 10, 6, 11, 8, 4, 9,
  4, 2, 1, 12, 15, 9, 14, 2, 5, 9, 1, 9, 0, 13, 8, 10,
];
const rotations = [
  [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
];
const invert = word => word.slice().reverse().map(turn => turn ^ 1);
const movesFor = word => word.map(turn => ({
  axis: turn >> 1, layer: 1, direction: turn % 2 ? -1 : 1,
}));

function buildCorrections() {
  const generators = new Map();
  for (const signs of rotations) for (let offset = 0; offset < 3; offset++) {
    const axes = faces.map(({ signs: normal }) => faces.findIndex(face =>
      face.signs.every((value, i) => value === signs[i] * normal[(i + offset) % 3])));
    const word = rotationWord.map(turn => 2 * axes[turn >> 1] + turn % 2);
    for (const sequence of [word, invert(word)]) {
      const puzzle = new Octahedron(3);
      for (const move of movesFor(sequence)) puzzle.turn(move.axis, move.layer, move.direction);
      if (!puzzle.solved) throw new Error('FTO orientation generator did not verify');
      const pull = faces.map((_, face) => puzzle.state[9 * face]);
      generators.set(pull.join(''), { pull, sequence });
    }
  }
  const queue = [home], corrections = new Map([[home, []]]);
  for (const color of queue) for (const { pull, sequence } of generators.values()) {
    const next = pull.map(face => color[face]).join('');
    if (corrections.has(next)) continue;
    queue.push(next);
    corrections.set(next, [...invert(sequence), ...corrections.get(color)]);
  }
  return corrections;
}

let corrections;
export function orientationCorrection(projected) {
  const colors = faces.map((_, face) => projected[face * 9]).join('');
  if (colors === home) return [];
  corrections ??= buildCorrections();
  const word = corrections.get(colors);
  if (!word) throw new Error('The projected FTO is outside the reachable solved orientations.');
  return movesFor(word);
}
