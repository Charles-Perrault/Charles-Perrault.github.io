import { solveSquare1 } from './solver.mjs';

self.onmessage = ({ data: state }) => {
  try {
    const stages = solveSquare1(state, status => self.postMessage({ status }));
    self.postMessage({ stages });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
