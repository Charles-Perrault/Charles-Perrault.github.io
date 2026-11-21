import { parseMoves } from './cube.mjs?v=17';
import { solvePocketCube } from './pocket-cube.mjs';

const standardTable = 'cubelab-optimal3-mrdenzzz-standard-v1.bin';

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

async function getCacheDirectory() {
  try {
    return await globalThis.navigator?.storage?.getDirectory();
  } catch {
    return undefined;
  }
}

async function readTable(directory) {
  try {
    if (!directory) return null;
    const file = await (await directory.getFileHandle(standardTable)).getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
}

async function cacheTable(directory, bytes) {
  try {
    if (!directory) return;
    const handle = await directory.getFileHandle(standardTable, { create: true });
    const stream = await handle.createWritable();
    await stream.write(bytes);
    await stream.close();
  } catch {
    // The proof still works when this browser cannot persist its pruning table.
  }
}

async function proveShortest(engine, state, phaseTables, optimalTables, report) {
  const upperBound = engine.createTwoPhaseSolver(phaseTables)(state, {
    maxLength: 18,
    timeLimitMs: 900,
    directions: 6,
  }).moves;
  const canParallelize = typeof Worker === 'function' && (navigator.deviceMemory ?? 8) > 4;
  const threadCount = canParallelize ? Math.min(4, navigator.hardwareConcurrency ?? 1) : 1;
  report('optimal-search', null);
  if (threadCount > 1) {
    try {
      return await searchInParallel(engine, state, optimalTables, upperBound, threadCount);
    } catch {
      // Embedded/older browsers can disallow nested module workers.
    }
  }
  return engine.createOptimalSolver(optimalTables)(state, { upperBound }).moves;
}

async function searchInParallel(engine, state, tables, upperBound, threadCount) {
  const root = engine.createSearcher(tables, () => false);
  const firstDepth = root.setRoot(state);
  if (firstDepth >= upperBound?.length) return upperBound;
  const workers = [];
  try {
    const { classes, twistConj, prune, cornerDepth, twistMove, flipMove, sliceSortedMove, cornerPermMove } = tables;
    const searchTables = { classes: { classOf: classes.classOf, sorted: classes.sorted }, twistConj, prune, cornerDepth, twistMove, flipMove, sliceSortedMove, cornerPermMove };
    for (let i = 0; i < threadCount; i++) {
      const worker = new Worker(new URL('./optimal3-worker.mjs', import.meta.url), { type: 'module' });
      workers.push(worker);
      worker.postMessage({ searchTables, root: root.state });
    }
    for (let depth = firstDepth; depth <= engine.MAX_DEPTH; depth++) {
      if (depth >= upperBound?.length) return upperBound;
      const found = await new Promise((resolve, reject) => {
        let waiting = workers.length;
        workers.forEach((worker, first) => {
          worker.onerror = reject;
          worker.onmessage = ({ data }) => {
            if (data.path) resolve(data.path);
            else if (--waiting === 0) resolve(null);
          };
          worker.postMessage({ depth, first, stride: workers.length });
        });
      });
      if (found) return Array.from(found, index => engine.FACE_TURNS[index]);
    }
    throw new Error('Could not prove a 3×3 solution.');
  } finally {
    for (const worker of workers) worker.terminate();
  }
}

async function solveThree(cube, report) {
  const engine = await import('./vendor/optimal3/engine.mjs');
  const input = engine.parseFacelets(faceletString(cube));
  if (!input.ok) throw new Error('The 3×3 sticker layout is invalid.');
  report('optimal-search', null);
  const nearby = solveNearby(engine, input.value);
  if (nearby) return engine.formatFaceTurns(nearby);

  report('optimal-tables', 0);
  const directory = await getCacheDirectory();
  const saved = await readTable(directory);
  const phase = engine.buildTwoPhaseTables();
  const tables = engine.buildOptimalTables('standard', phase, saved, {
    onProgress: (done, total) => report('optimal-tables', done / total),
  });
  if (!tables.restored) await cacheTable(directory, tables.file);
  const shortest = await proveShortest(engine, input.value, phase, tables, report);
  if (!shortest) throw new Error('Could not prove a 3×3 solution.');
  return engine.formatFaceTurns(shortest);
}

export async function solveSmallCube(cube, report = () => {}) {
  if (cube.isSolved()) return [];
  let notation;
  if (cube.size === 2) {
    report('optimal-search', null);
    notation = solvePocketCube(cube).join(' ');
  } else if (cube.size === 3) notation = await solveThree(cube, report);
  else throw new Error('Shortest-solution search is available for 2×2 and 3×3 cubes.');
  const moves = parseMoves(notation, cube.size);
  const replay = cube.clone();
  for (const move of moves) replay.apply(move);
  if (!replay.isSolved()) throw new Error('Shortest-solution replay did not solve the cube.');
  return moves;
}
