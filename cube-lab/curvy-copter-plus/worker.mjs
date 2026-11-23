import { solve } from './solver.mjs?v=2';
import { applyPose, cubeSlots, findCubeShape, installShapeTable, remapColors, searchCubeShape, walkCubeShape } from './jumbling.mjs';

let ready;
self.onmessage = async ({ data: { state, poses } }) => {
  try {
    let aligned = state;
    if (poses) {
      ready ??= fetch(new URL('./shapes.bin', import.meta.url)).then(async response => {
        if (!response.ok) throw new Error('Could not load the jumbling shape table');
        installShapeTable(new Uint8Array(await response.arrayBuffer()));
      });
      await ready;
      self.postMessage({ stage: 'Searching for cube shape…' });
      let moves = findCubeShape(poses, 1200);
      if (!moves) {
        self.postMessage({ stage: 'Exploring alternate shape routes…' });
        moves = walkCubeShape(poses, 180000, count => {
          self.postMessage({ stage: `Exploring alternate shape routes · ${count.toLocaleString()} turns checked` });
        });
      }
      moves ??= searchCubeShape(poses, depth => {
        self.postMessage({ stage: `Deeper shape search · depth ${depth}` });
      });
      const slots = cubeSlots(moves.reduce(applyPose, poses));
      if (!slots) throw new Error('The planned turns did not restore cube shape.');
      aligned = remapColors(state, slots);
      if (moves.length) self.postMessage({ batch: { name: 'Restoring cube shape', moves } });
    }
    self.postMessage({ stage: 'Planning the color solve…' });
    solve(aligned, batch => self.postMessage({ batch }));
    self.postMessage({ done: true });
  } catch (error) {
    ready = undefined;
    self.postMessage({ error: error.message });
  }
};
