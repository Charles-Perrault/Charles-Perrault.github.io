import { solve } from './solver.mjs';
import { applyPose, cubeSlots, findCubeShape, installShapeTable, remapColors, searchCubeShape } from './jumbling.mjs';

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
      const moves = findCubeShape(poses) ?? searchCubeShape(poses, depth => {
        self.postMessage({ stage: `Deeper shape search · depth ${depth}` });
      });
      const slots = moves && cubeSlots(moves.reduce(applyPose, poses));
      if (!slots) throw new Error('No route to cube shape found within the search limit.');
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
