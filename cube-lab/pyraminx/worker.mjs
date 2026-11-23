import { solve } from './solver.mjs?v=2';

self.onmessage = ({ data: { size, state } }) => {
  try {
    let moves = [], misplaced = 0;
    let lastReport = performance.now();
    const flush = () => {
      if (!moves.length) return;
      self.postMessage({ moves, misplaced });
      moves = [];
      lastReport = performance.now();
    };
    const remaining = solve(size, state, (batch, count) => {
      moves.push(...batch);
      if (count !== undefined) misplaced = count;
      if (size <= 3 || moves.length >= 64 || performance.now() - lastReport > 80) flush();
    });
    flush();
    self.postMessage({ remaining });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
