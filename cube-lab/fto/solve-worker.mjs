import { constructiveSolution } from './constructive-solver.mjs';
import { reduceInnerSlices, isOuterReduced } from './reduction.mjs';
import { standardHold, toPattern, verifiedSolution } from './omelettehedron-adapter.mjs';
import { Octahedron } from './puzzle.mjs?v=2';
import { outerProjection } from './outer-projection.mjs';
import { orientationCorrection } from './orientation-solver.mjs';
import { shortSolution } from './short-solve.mjs';

const origin = 'https://omelettehedron.arhan.sh';
let instance;
let preparedTier;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cube-lab-fto', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('tables');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function cachedTables(tier) {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('tables');
      const request = transaction.objectStore('tables').get(`omelettehedron:${tier}`);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
      transaction.onabort = () => db.close();
    });
  } catch {
    return null;
  }
}

async function cacheTables(tier, tables) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction('tables', 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => db.close();
    transaction.objectStore('tables').put(tables, `omelettehedron:${tier}`);
  } catch {
    // Browser storage is optional. Keep the tables in the running worker.
  }
}

async function prepareTables(solver, tier, cached) {
  if (cached) {
    postMessage({ status: 'Loading saved solve tables…' });
    try {
      await solver.loadTables(...cached);
      preparedTier = tier;
      return;
    } catch {
      // Rebuild if the hosted engine no longer accepts the old table format.
    }
  }
  postMessage({ status: tier === 'tiny' ? 'Building solve tables for the first time…' : 'Building larger solve tables for this position…' });
  solver.generate({ tier });
  preparedTier = tier;
  void cacheTables(tier, solver.exportTables().map(({ blob }) => blob));
}

async function getSolver() {
  if (instance) return instance;
  postMessage({ status: 'Loading Omelettehedron…' });
  let solver;
  try {
    const { FtoSolver, wasmFile } = await import(`${origin}/omelettehedron.mjs`);
    solver = await FtoSolver.create({ wasm: `${origin}/dist/${wasmFile('tiny')}`, onLine: () => {} });
  } catch {
    throw new Error('Could not load Omelettehedron. Check your internet connection and try again.');
  }
  const larger = await cachedTables('small');
  if (larger) await prepareTables(solver, 'small', larger);
  else await prepareTables(solver, 'tiny', await cachedTables('tiny'));
  instance = solver;
  return instance;
}

self.onmessage = async ({ data: { size, state } }) => {
  try {
    if (size > 3) {
      const short = shortSolution(size, state);
      if (short) {
        postMessage({ moves: short });
        return;
      }
    }
    let prefix = [];
    if (size > 3 && !isOuterReduced(size, state)) {
      postMessage({ status: 'Reducing inner slices�' });
      const direct = size % 2 === 0 ? constructiveSolution(size, state) : null;
      if (direct) { postMessage({ moves: direct }); return; }
      prefix = reduceInnerSlices(size, state);
      if (!prefix) throw new Error('Could not reduce the inner slices within the search limit.');
      const draft = new Octahedron(size);
      draft.state.set(state);
      for (const move of prefix) draft.turn(move.axis, move.layer, move.direction);
      state = draft.state;
    }
    const projected = size === 3 ? state : outerProjection(size, state);
    const pattern = toPattern(projected);
    const solver = await getSolver();
    postMessage({ status: 'Searching for a solution…' });
    const search = seconds => solver.solvePattern(pattern, { usual: standardHold, seconds, maxLength: 32 });
    let result = search(preparedTier === 'tiny' ? 12 : 55);
    if (!result.solution && !result.error && preparedTier === 'tiny') {
      await prepareTables(solver, 'small', await cachedTables('small'));
      postMessage({ status: 'Searching with larger tables…' });
      result = search(55);
    }
    if (result.error) throw new Error(size > 3 ?
      'This position requires inner-slice reduction before Omelettehedron can solve it.' :
      result.error.message ?? String(result.error));
    if (!result.solution) throw new Error('Omelettehedron did not find a solution before the search limit.');
    const moves = verifiedSolution(projected, result.solution);
    if (size > 3) {
      const full = new Octahedron(size);
      full.state.set(state);
      for (const { axis, layer, direction } of moves) full.turn(axis, layer, direction);
      if (!full.solved) {
        const reductionNeeded = 'This position requires inner-slice reduction before Omelettehedron can solve it.';
        let correction;
        try {
          correction = orientationCorrection(outerProjection(size, full.state));
        } catch {
          throw new Error(reductionNeeded);
        }
        for (const { axis, layer, direction } of correction) full.turn(axis, layer, direction);
        if (!full.solved) throw new Error(reductionNeeded);
        moves.push(...correction);
      }
    }
    postMessage({ moves: [...prefix, ...moves] });
  } catch (error) {
    postMessage({ error: error.message });
  }
};
