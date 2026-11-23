import { Octahedron } from './puzzle.mjs?v=2';

// Arhan Chaudhary's published pattern interface reads five stickers, then
// three, then one for each face. The simulator's signed-axis frame differs.
// The mapping was checked against the action of all eight hosted face moves.
const remoteFaces = ['U', 'R', 'F', 'L', 'B', 'BL', 'D', 'BR'];
const localFaces = [0, 1, 5, 3, 2, 6, 7, 4];
export const standardHold = 'WRGPBOYA';
const localColors = Array(8);
localFaces.forEach((face, remote) => { localColors[face] = standardHold[remote]; });

const slots = [
  0, 1, 5, 6, 8, 2, 3, 7, 4,
  17, 15, 14, 10, 9, 16, 12, 11, 13,
  45, 46, 50, 51, 53, 47, 48, 52, 49,
  35, 33, 32, 28, 27, 34, 30, 29, 31,
  26, 24, 23, 19, 18, 25, 21, 20, 22,
  54, 55, 59, 60, 62, 56, 57, 61, 58,
  71, 69, 68, 64, 63, 70, 66, 65, 67,
  36, 37, 41, 42, 44, 38, 39, 43, 40,
];

export function toPattern(state) {
  if (!(state instanceof Uint8Array) || state.length !== slots.length || state.some(color => color > 7)) {
    throw new Error('Omelettehedron needs the 72 stickers of a 3-layer FTO.');
  }
  return slots.map(id => localColors[state[id]]).join('');
}

export function verifiedSolution(state, solution) {
  const puzzle = new Octahedron(3);
  puzzle.state.set(state);
  const moves = [];
  for (const token of solution.trim().split(/\s+/).filter(Boolean)) {
    const match = /^(BL|BR|[URFLBD])(['2]?)$/.exec(token);
    if (!match) throw new Error(`Omelettehedron returned an unsupported turn: ${token}`);
    const axis = localFaces[remoteFaces.indexOf(match[1])];
    const direction = match[2] ? -1 : 1;
    puzzle.turn(axis, 1, direction);
    moves.push({ axis, layer: 1, direction });
  }
  if (!puzzle.solved) throw new Error('Omelettehedron’s move sequence did not replay to a solved FTO.');
  return moves;
}
