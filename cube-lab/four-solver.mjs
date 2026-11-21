import { parseMoves, solvedColors } from './cube.mjs?v=17';
import {
  buildEdgePairing,
  buildReductionTables,
  buildTwoPhaseTables,
  createReductionSolver,
  createTwoPhaseSolver,
  parseFacelets4,
  TWO_PHASE_TABLE_COUNT,
} from './vendor/tpr4/solver.mjs';

const size = 4;
const faces = 'URFDLB';
const quickOptions = { phase1Candidates: 120, phase2Candidates: 50, phase3Candidates: 3, finishTimeMs: 36 };
const extraSearchMs = 5_000;
const alternateFrames = [
  ['x', [1, 3, -2]], ["x'", [1, -3, 2]],
  ['y', [-3, 2, 1]], ["y'", [3, 2, -1]],
  ['z', [2, -1, 3]], ["z'", [-2, 1, 3]],
];
let preparing;

async function tableCache(tables) {
  if (!globalThis.indexedDB) return undefined;
  let database;
  try {
    database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('cube-lab-tpr4', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('tables');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('tables', tables ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('tables');
      const key = '950fa93285640b2e64431a74186513f31d43b613';
      const request = tables ? store.put(tables, key) : store.get(key);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    // An unavailable cache has no effect on the search.
    return undefined;
  } finally {
    database?.close();
  }
}

async function prepare(report) {
  report('four-tables', 0);
  let tables = await tableCache();
  if (!tables) {
    let completed = 0;
    const stepCount = TWO_PHASE_TABLE_COUNT + 5;
    const onStep = () => report('four-tables', ++completed / stepCount);
    tables = {
      finish: buildTwoPhaseTables(onStep),
      reduction: buildReductionTables(onStep),
      edges: buildEdgePairing(),
    };
    onStep();
    await tableCache(tables);
  }
  report('four-tables', 1);
  return createReductionSolver(tables.reduction, tables.edges, createTwoPhaseSolver(tables.finish));
}

function facelets(cube) {
  let text = '';
  for (let face = 0; face < 6; face++) {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        text += faces[solvedColors.indexOf(cube.stickerAt(face, row, col))] ?? '?';
      }
    }
  }
  return text;
}

function toCubeMove({ face, from, to, turns }) {
  const outer = parseMoves(face, size)[0];
  const positive = outer.layer === size - 1;
  const layer = positive ? size - to : from - 1;
  const endLayer = positive ? size - from : to - 1;
  const angle = turns === 2 ? 2 : outer.turns * (turns === 1 ? 1 : -1);
  return layer === endLayer
    ? { axis: outer.axis, layer, turns: angle }
    : { axis: outer.axis, layer, endLayer, turns: angle };
}

function originalFrame(move, frame) {
  const sign = frame[move.axis];
  const axis = Math.abs(sign) - 1;
  if (sign > 0) return { ...move, axis };
  const layer = size - 1 - (move.endLayer ?? move.layer);
  const endLayer = size - 1 - move.layer;
  const turns = move.turns === 2 ? 2 : -move.turns;
  return layer === endLayer ? { axis, layer, turns } : { axis, layer, endLayer, turns };
}

export async function solveFour(source, report = () => {}, { thorough = false, ...options } = {}) {
  if (source.size !== size) throw new RangeError('The three-phase search needs a 4 × 4 cube.');
  const parsed = parseFacelets4(facelets(source));
  if (!parsed.ok) throw new Error('The 4 × 4 stickers do not describe a valid cube.');
  if (source.isSolved()) return [];

  const solve = await (preparing ??= prepare(report));
  report('four-search', 0);
  let result = solve(parsed.value, { ...quickOptions, ...options });
  if (!result.moves && !options.shouldStop?.()) result = solve(parsed.value, options);
  if (!result.moves) throw new Error('The 4 × 4 search did not finish.');
  let moves = result.moves.map(toCubeMove);
  if (thorough) {
    const deadline = performance.now() + extraSearchMs;
    const shouldStop = () => performance.now() >= deadline || options.shouldStop?.();
    for (const [notation, frame] of alternateFrames) {
      if (shouldStop()) break;
      const rotated = source.clone();
      rotated.apply(parseMoves(notation, size)[0]);
      const candidate = solve(parseFacelets4(facelets(rotated)).value, { ...options, shouldStop }).moves;
      if (candidate && candidate.length < moves.length) {
        moves = candidate.map((move) => originalFrame(toCubeMove(move), frame));
      }
      report('four-search', Math.min(0.99, 1 - (deadline - performance.now()) / extraSearchMs));
    }
  }
  const check = source.clone();
  for (const move of moves) check.apply(move);
  if (!check.isSolved()) throw new Error('The 4 × 4 solution failed playback verification.');
  report('four-search', 1);
  return moves;
}
