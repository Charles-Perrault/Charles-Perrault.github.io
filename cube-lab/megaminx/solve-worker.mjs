import { solveMegaminx } from './solver.mjs?v=4';

self.onmessage = async ({ data: { size, state } }) => {
  try {
    const progress = (stage, details) => self.postMessage({ stage, ...details });
    const commit = (name, moves) => {
      for (let start = 0; start < moves.length; start += 8192) {
        self.postMessage({ commit: { name, moves: moves.slice(start, start + 8192) } });
      }
    };
    if (size === 3) solveMegaminx(state, progress, commit);
    else (await import('./layered-solver.mjs?v=8')).solveLayeredMinx(size, state, progress, commit);
    self.postMessage({ done: true });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
