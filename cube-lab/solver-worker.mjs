import { Cube } from './cube.mjs?v=14';
import { PackedTurns, unpackTurns } from './packed-turns.mjs';
import { brobdicubeInput } from './brobdicube-input.mjs';
import { solveEdges } from './edge-solver.mjs?v=14';
import { orientWhitePlanningCube, solveAllCenters, solveWhiteBlocks, solveWhiteCenter, solveYellowCenter } from './solver.mjs?v=14';

const solvers = {
  fast: async (cube, report) => (await import('./full-solver.mjs?v=14')).solveCubeFast(cube, report),
  full: async (cube, report, candidates) => (await import('./full-solver.mjs?v=14')).solveCube(cube, report, candidates),
  edges: solveEdges,
  all: solveAllCenters,
  yellow: solveYellowCenter,
  blocks: solveWhiteBlocks,
  white: solveWhiteCenter,
};

async function shortCubePlan(cube, center, report) {
  const { size } = cube;
  if (cube.isSolved()) return { moves: [] };
  if (size <= 3) {
    const { solveSmallCube } = await import('./small-cube-solver.mjs?v=19');
    return { moves: await solveSmallCube(cube, report), backend: size === 2 ? 'optimal search' : '3×3 search' };
  }

  const { findDirectSolution } = await import('./direct-cube-search.mjs?v=18');
  const { compactSmallTurns } = await import('./compact-small-turns.mjs?v=18');
  const verified = (moves, backend) => {
    const compact = compactSmallTurns(moves, size);
    const selected = compact.length < moves.length ? compact : moves;
    const replay = cube.clone();
    for (const move of selected) replay.apply(move);
    return replay.isSolved() ? { moves: selected, backend } : null;
  };
  report('direct-search', null);
  // In 4×4 and larger cubes this search counts a single slice, including a half turn, as one move.
  const direct = findDirectSolution(cube);
  if (direct) {
    const result = verified(direct, 'direct slice search');
    if (result) return result;
  }

  try {
    const fast = center === 'fast';
    let moves, backend;
    if (size === 4) {
      const { solveFour } = await import('./four-solver.mjs?v=18');
      moves = await solveFour(cube, report, { thorough: !fast });
      backend = '4×4 search';
    } else {
      const { solveMediumCube } = await import('./medium-cube-search.mjs?v=20');
      moves = await solveMediumCube(cube, report, {
        compact: compactSmallTurns,
        onBest: (moves) => self.postMessage({ bestSearch: moves }),
      });
      backend = 'Gullicube';
    }
    const result = verified(moves, backend);
    if (result) return result;
  } catch (error) {
    console.warn(`Specialized ${size}×${size} solver unavailable`, error);
  }
  report('fallback', 0);
}

async function searchCuda(cube) {
  try {
    const response = await fetch('/_cuda/white-blocks', {
      method: 'POST',
      headers: { 'X-Cube-Size': String(cube.size) },
      body: new Blob([cube.orientations, ...cube.faces]),
      signal: AbortSignal.timeout(30000),
    });
    if (response.ok) return await response.json();
  } catch {
    // The browser solver can run independently of the optional CUDA service.
  }
}

async function verifyStream(response, cube, report, publish) {
  const replay = cube.clone();
  let pending = new Uint8Array(0);
  let started = false;
  let checked = 0;
  const reader = response.body.getReader();
  report('verify', null);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const bytes = new Uint8Array(pending.length + value.length);
      bytes.set(pending);
      bytes.set(value, pending.length);
      let start = 0;
      if (!started) {
        if (bytes.length < 4) {
          pending = bytes;
          continue;
        }
        if (new DataView(bytes.buffer).getUint32(0, true) !== 0x31504c43) return false;
        started = true;
        start = 4;
      }
      // Keep the raw count and the completion marker out of the move queue.
      const end = Math.max(start, bytes.length - bytes.length % 4 - 8);
      pending = bytes.slice(end);
      if (end === start) continue;
      const batch = new Uint32Array(bytes.buffer, start, (end - start) / 4);
      for (const move of unpackTurns(batch)) replay.apply(move);
      checked += batch.length;
      publish(batch);
    }
    if (!started || pending.length !== 8) return false;
    const footer = new DataView(pending.buffer);
    return footer.getUint32(4, true) === 0x31444e45 && footer.getUint32(0, true) >= checked && replay.isSolved();
  } finally {
    await reader.cancel();
  }
}

async function nativePlan(cube, history, report, publish) {
  if (!history?.length || cube.size < 4 || cube.size > 2048) return;
  const input = brobdicubeInput(history, cube.size);
  if (!input) return;
  try {
    report('brobdicube', 0);
    const request = {
      method: 'POST',
      headers: { 'X-Cube-Size': String(cube.size) },
      body: input,
      signal: AbortSignal.timeout(305000),
    };
    let response = await fetch('/_brobdicube/solve', {
      ...request,
      headers: { ...request.headers, 'X-CubeLab-Stream': '1' },
    });
    if (response.status === 409) response = await fetch('/_brobdicube/solve', request);
    if (!response.ok) return;
    if (response.headers.get('Content-Type') === 'application/x-cubelab-turns') {
      return await verifyStream(response, cube, report, publish);
    }
    const packed = new Uint32Array(await response.arrayBuffer());
    report('verify', 0);
    const replay = cube.clone();
    let checked = 0;
    for (const move of unpackTurns(packed)) {
      replay.apply(move);
      if (++checked % 16384 === 0) report('verify', checked / packed.length);
    }
    if (replay.isSolved()) return packed;
  } catch {
    // The exact browser solver is available when the local backend cannot finish.
  }
}

self.onmessage = async ({ data: { size, faces, orientations, center, cuda, brobdicube, history } }) => {
  try {
    const cube = new Cube(size, faces, orientations);
    const solve = solvers[center];
    let lastPhase;
    let lastReport = -Infinity;
    const report = (phase, fraction) => {
      const now = performance.now();
      if (phase === lastPhase && now - lastReport < 250) return;
      lastPhase = phase;
      lastReport = now;
      self.postMessage({ progress: { phase, fraction } });
    };
    if ((center === 'full' || center === 'fast') && size <= 7) {
      const result = await shortCubePlan(cube, center, report);
      if (result) {
        self.postMessage(result);
        return;
      }
    }
    if (center === 'fast' && brobdicube && !cube.isSolved()) {
      let streamed = false;
      const packed = await nativePlan(cube, history, report, (batch) => {
        streamed = true;
        self.postMessage({ batch }, [batch.buffer]);
      });
      if (streamed) {
        self.postMessage(packed === true ? { streamEnd: true } : { error: 'The solve stream ended early. Run Solve cube fast to continue.' });
        return;
      }
      if (packed instanceof Uint32Array) {
        self.postMessage({ packed, backend: 'Brobdicube' }, [packed.buffer]);
        return;
      }
      report('fallback', 0);
    }
    if (cuda && center !== 'blocks' && center !== 'fast' && size >= 32 && size <= 2048) {
      const oriented = cube.clone();
      const orientation = orientWhitePlanningCube(oriented);
      if (!oriented.hasSolvedCenters([3])) {
        report('cuda', 0);
        const candidates = await searchCuda(oriented);
        if (Array.isArray(candidates)) {
          const moves = await solve(oriented, report, candidates);
          self.postMessage({ moves: orientation.concat(moves) });
          return;
        }
      }
    }
    const moves = await solve(cube, report);
    if (moves instanceof PackedTurns) {
      const packed = moves.view();
      self.postMessage({ packed }, [packed.buffer]);
    } else self.postMessage({ moves });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
