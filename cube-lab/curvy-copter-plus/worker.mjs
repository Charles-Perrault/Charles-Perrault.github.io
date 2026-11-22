import { solve } from './solver.mjs';
import { applyPose, cubeSlots, findCubeShape, installShapeTable, remapColors, searchCubeShape, walkCubeShape } from './jumbling.mjs';

let ready;
self.onmessage = async ({ data: { state, poses } }) => {
  try {
    let shape = [];
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
      shape = [{ name: 'Restoring cube shape', moves }];
      aligned = remapColors(state, slots);
    }
    self.postMessage({ stage: 'Planning the color solve…' });
    self.postMessage({ plan: [...shape, ...solve(aligned)] });
  } catch (error) {
    ready = undefined;
    self.postMessage({ error: error.message });
  }
};
