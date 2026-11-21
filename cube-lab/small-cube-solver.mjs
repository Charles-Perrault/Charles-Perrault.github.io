import { parseMoves } from './cube.mjs?v=17';
import { solvePocketCube } from './pocket-cube.mjs';

let twoPhase;

function faceletString(cube) {
  let stickers = '';
  for (let face = 0; face < 6; face++) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) stickers += String(cube.stickerAt(face, row, col));
    }
  }
  return stickers;
}

function nearbyStates(engine, start, limit) {
  const key = ({ cp, co, ep, eo }) => String.fromCharCode(...cp, ...co, ...ep, ...eo);
  const queue = [{ state: start, path: 1, depth: 0, lastFace: -1 }];
  const paths = new Map([[key(start), 1]]);
  for (let i = 0; i < queue.length; i++) {
    const { state, path, depth, lastFace } = queue[i];
    for (let move = 0; move < engine.FACE_TURNS.length; move++) {
      const face = Math.floor(move / 3);
      if (face === lastFace) continue;
      const next = engine.applyFaceTurn(state, engine.FACE_TURNS[move]);
      const id = key(next);
      if (paths.has(id)) continue;
      const nextPath = (path << 5) | move;
      paths.set(id, nextPath);
      if (depth + 1 < limit) queue.push({ state: next, path: nextPath, depth: depth + 1, lastFace: face });
    }
  }
  return paths;
}

function decodePath(engine, path) {
  const turns = [];
  while (path > 1) {
    turns.push(engine.FACE_TURNS[path & 31]);
    path >>>= 5;
  }
  return turns.reverse();
}

function solveNearby(engine, state) {
  for (const limit of [3, 4]) {
    const toGoal = nearbyStates(engine, engine.SOLVED, limit);
    const fromCube = nearbyStates(engine, state, limit);
    let best;
    for (const [id, path] of fromCube) {
      const back = toGoal.get(id);
      if (back === undefined) continue;
      const forward = decodePath(engine, path);
      const reverse = decodePath(engine, back);
      if (best === undefined || forward.length + reverse.length < best.length) {
        best = forward.concat(engine.invertFaceTurns(reverse));
      }
    }
    if (best) return best;
  }
  return undefined;
}

async function solveThree(cube, report) {
  const engine = await import('./vendor/optimal3/engine.mjs');
  const input = engine.parseFacelets(faceletString(cube));
  if (!input.ok) throw new Error('The 3×3 sticker layout is invalid.');
  report('three-search', null);
  const nearby = solveNearby(engine, input.value);
  if (nearby) return engine.formatFaceTurns(nearby);

  twoPhase ??= engine.createTwoPhaseSolver(engine.buildTwoPhaseTables());
  const { moves } = twoPhase(input.value, { maxLength: 18, timeLimitMs: 900, directions: 6 });
  if (!moves) throw new Error('Could not find a 3×3 solution.');
  return engine.formatFaceTurns(moves);
}

export async function solveSmallCube(cube, report = () => {}) {
  if (cube.isSolved()) return [];
  let notation;
  if (cube.size === 2) {
    report('optimal-search', null);
    notation = solvePocketCube(cube).join(' ');
  } else if (cube.size === 3) notation = await solveThree(cube, report);
  else throw new Error('Small-cube search is available for 2×2 and 3×3 cubes.');
  const moves = parseMoves(notation, cube.size);
  const replay = cube.clone();
  for (const move of moves) replay.apply(move);
  if (!replay.isSolved()) throw new Error('Solution replay did not solve the cube.');
  return moves;
}
