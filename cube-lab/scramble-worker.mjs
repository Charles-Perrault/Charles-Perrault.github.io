import { Cube, scrambleMoves } from './cube.mjs?v=14';
import { PackedTurns } from './packed-turns.mjs';

self.onmessage = ({ data: { size, faces, orientations } }) => {
  try {
    const cube = new Cube(size, faces, orientations);
    const turns = new PackedTurns();
    for (const move of scrambleMoves(size)) {
      cube.apply(move);
      turns.append(move);
    }
    const history = turns.view();
    self.postMessage(
      { faces, orientations: cube.orientations, history },
      [...faces.map((face) => face.buffer), cube.orientations.buffer, history.buffer],
    );
  } catch {
    self.postMessage({ error: 'Could not finish the instant scramble.' });
  }
};
