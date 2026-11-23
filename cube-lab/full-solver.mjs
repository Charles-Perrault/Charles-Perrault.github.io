import { parseMoves, solvedColors } from './cube.mjs?v=14';
import { planEdgesInPlace } from './edge-solver.mjs?v=15';
import { planFastCentersInPlace } from './solver.mjs?v=15';
import ThreeByThree from './vendor/cubejs/solve.mjs';

let initialized = false;

function reducedState(cube) {
  const last = cube.size - 1;
  const samples = [0, Math.floor(last / 2), last];
  const letters = 'URFDLB';
  let stickers = '';
  for (let face = 0; face < 6; face++) {
    for (const row of samples) {
      for (const col of samples) stickers += letters[solvedColors.indexOf(cube.stickerAt(face, row, col))];
    }
  }
  return ThreeByThree.fromString(stickers);
}

function oddPermutation(pieces) {
  let odd = false;
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) if (pieces[i] > pieces[j]) odd = !odd;
  }
  return odd;
}

export function solveCube(source, report = () => {}, candidates, onMove) {
  return solveReducedCube(source, report, candidates, undefined, onMove);
}

export function solveCubeFast(source, report = () => {}, candidates, onMove) {
  return solveReducedCube(source, report, undefined, planFastCentersInPlace, onMove);
}

function solveReducedCube(source, report, candidates, planCenters, onMove = () => {}) {
  if (source.size < 3) throw new Error('Full solve is available for cubes size 3 and up.');
  if (source.isSolved()) return [];
  const { size } = source;
  const cube = source.clone();
  const moves = planEdgesInPlace(cube, report, candidates, planCenters, onMove);
  const emit = (notation) => {
    for (const move of parseMoves(notation, size)) {
      cube.apply(move);
      moves.push(move);
      onMove(move);
    }
  };
  report('finish', 0);
  let state = reducedState(cube);
  if (size % 2 === 0) {
    if (state.eo.reduce((sum, flip) => sum + flip, 0) % 2) {
      // Flip the UF wings at every mirrored depth to flip the entire reduced edge.
      for (let depth = 1; depth < size / 2; depth++) {
        const near = depth + 'm';
        const far = (size - 1 - depth) + 'm';
        emit(`${far}2 B2 U2 ${near} U2 ${far} U2 ${far}' U2 F2 ${far}' F2 ${near}' B2 ${far}2`);
      }
      state = reducedState(cube);
    }
    if (oddPermutation(state.cp) !== oddPermutation(state.ep)) {
      const half = size / 2;
      const right = half === size - 2 ? `${half}m2` : `${half}:${size - 2}m2`;
      const up = size === 4 ? 'Uw2' : `${half}:${size - 2}e2 U2`;
      emit(`${right} U2 ${right} ${up} ${right} ${up}`);
      state = reducedState(cube);
    }
  }
  if (!cube.isSolved()) {
    if (!initialized) {
      ThreeByThree.initSolver();
      initialized = true;
    }
    emit(state.solve(25));
  }
  if (!cube.isSolved()) throw new Error('Full cube solution verification failed.');
  return moves;
}
