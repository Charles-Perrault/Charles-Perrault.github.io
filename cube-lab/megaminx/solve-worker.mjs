import { solveMegaminx } from './solver.mjs?v=2';

self.onmessage = async ({ data: { size, state } }) => {
  try {
    const progress = (stage, details) => self.postMessage({ stage, ...details });
    const stages = size === 3 ? solveMegaminx(state, progress) :
      (await import('./layered-solver.mjs?v=6')).solveLayeredMinx(size, state, progress);
    self.postMessage({ stages });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
