import { spatialPuzzle } from './model.mjs?v=5';
import { solveRedi } from './redi-solver.mjs';
import { solveSkewb } from './skewb-solver.mjs';

self.onmessage = ({ data: { kind, state } }) => {
  try {
    const puzzle = spatialPuzzle(kind, kind === 'redi' ? 3 : 2);
    const solve = kind === 'redi' ? solveRedi : solveSkewb;
    const moves = solve(puzzle, state).map(({ turn, direction }) => ({ index: puzzle.moves.indexOf(turn), direction }));
    postMessage({ moves });
  } catch (error) {
    postMessage({ error: error.message });
  }
};
