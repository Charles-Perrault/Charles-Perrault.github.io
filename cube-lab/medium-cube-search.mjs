import { parseMoves, solvedColors } from './cube.mjs?v=17';

const seconds = { 5: 30, 6: 45, 7: 60 };
const faceLetters = ['U', 'R', 'F', 'D', 'L', 'B'];

export function mediumCubeFacelets(cube) {
  const { size } = cube;
  let facelets = '';
  for (let face = 0; face < 6; face++) {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        facelets += faceLetters[solvedColors.indexOf(cube.stickerAt(face, row, col))];
      }
    }
  }
  return facelets;
}

export function replayMediumCandidate(cube, notation) {
  const replay = cube.clone();
  const moves = [];
  for (const token of notation.trim().split(/\s+/u).filter(Boolean)) {
    const match = /^(\d+)?([URFDLB])([2']?)$/u.exec(token);
    if (!match) throw new Error(`Invalid gullicube move ${token}.`);
    const [, depth, face, suffix] = match;
    const fromEdge = Number(depth ?? 1);
    if (fromEdge < 1 || fromEdge > cube.size) throw new Error(`Slice ${token} is outside the cube.`);
    const [move] = parseMoves(face + suffix, cube.size);
    move.layer = move.layer === 0 ? fromEdge - 1 : cube.size - fromEdge;
    replay.apply(move);
    moves.push(move);
  }
  if (!replay.isSolved()) throw new Error('Gullicube returned an incomplete solution.');
  return moves;
}

export async function solveMediumCube(cube, report = () => {}, options = {}) {
  if (!seconds[cube.size]) throw new RangeError('Medium search supports 5×5 through 7×7.');
  const budget = options.seconds ?? seconds[cube.size];
  if (!Number.isFinite(budget) || budget <= 0) throw new RangeError('The search needs a positive time budget.');
  if (cube.isSolved()) return [];
  const worker = new Worker(new URL('./medium-cube-gullicube-worker.mjs?v=19', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const started = performance.now();
    let best;
    const finish = (error) => {
      clearTimeout(timeout);
      worker.terminate();
      if (best) resolve(best);
      else reject(error ?? new Error('Gullicube did not find a solution in time.'));
    };
    const timeout = setTimeout(() => finish(), budget * 1000);
    worker.onmessage = ({ data }) => {
      if (typeof data.candidate === 'string') {
        try {
          let moves = replayMediumCandidate(cube, data.candidate);
          const compacted = options.compact?.(moves, cube.size);
          if (compacted && compacted.length < moves.length) {
            const replay = cube.clone();
            for (const move of compacted) replay.apply(move);
            if (replay.isSolved()) moves = compacted;
          }
          if (!best || moves.length < best.length) best = moves;
        } catch (error) {
          if (data.done) return finish(error);
        }
      }
      if (data.done) finish();
      else if (data.error) finish(new Error(data.error));
      else if (data.stage) report(data.stage, Math.min(0.99, (performance.now() - started) / (budget * 1000)));
    };
    worker.onerror = ({ message }) => finish(new Error(message || 'Could not start the beam search.'));
    worker.postMessage({ size: cube.size, facelets: mediumCubeFacelets(cube), budget, fast: options.fast });
  });
}
