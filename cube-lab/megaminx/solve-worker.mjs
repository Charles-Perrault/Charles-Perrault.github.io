import { solveMegaminx } from './solver.mjs';

self.onmessage = async ({ data: { size, state } }) => {
  try {
    const progress = stage => self.postMessage({ stage });
    const stages = size === 3 ? solveMegaminx(state, progress) :
      (await import('./layered-solver.mjs?v=3')).solveLayeredMinx(size, state, progress);
    self.postMessage({ stages });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
