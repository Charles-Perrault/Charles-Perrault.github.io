import { dot, faces, rotate, step } from './puzzle.mjs';

const forward = faces.map(axis => faces.map(normal => {
  const rotated = rotate(normal, axis, -step);
  return faces.findIndex(candidate => dot(candidate, rotated) > 0.999999);
}));
const backward = forward.map(mapping => mapping.map((_, face) => mapping.indexOf(face)));

export function greedyCenterMoves(puzzle, report = () => {}) {
  const { stickers, state, depth } = puzzle;
  const gains = new Int32Array(faces.length * depth * 2);
  const centers = new Uint8Array(stickers.length);
  const moves = [];

  // A turn changes the score only when a center crosses onto a different face.
  // Keep both directions up to date using only the stickers that changed color.
  function update(id, color, weight) {
    const { bands, face } = stickers[id];
    for (let axis = 0; axis < faces.length; axis++) {
      const layer = bands[axis];
      if (!layer || axis === face) continue;
      const index = 2 * (axis * depth + layer - 1);
      const wasHome = Number(color === face);
      gains[index] += weight * (Number(color === forward[axis][face]) - wasHome);
      gains[index + 1] += weight * (Number(color === backward[axis][face]) - wasHome);
    }
  }

  for (const [id, tile] of stickers.entries()) {
    let outerFaces = 0;
    for (const layer of tile.bands) outerFaces += Number(layer === 1);
    if (outerFaces !== 1) continue;
    centers[id] = 1;
    update(id, state[id], 1);
  }

  for (;;) {
    let best = -1, gain = 0;
    for (let i = 0; i < gains.length; i++) {
      if (gains[i] <= gain) continue;
      best = i;
      gain = gains[i];
    }
    if (best < 0) return moves;
    const slice = Math.floor(best / 2);
    const face = Math.floor(slice / depth), layer = slice % depth + 1;
    const direction = best % 2 ? -1 : 1;
    const permutation = puzzle.permutation(face, layer);

    // Inspect the whole cycle against its old state before applying the turn.
    for (let i = 0; i < permutation.length; i += 2) {
      const from = permutation[i + (direction < 0 ? 1 : 0)];
      const to = permutation[i + (direction > 0 ? 1 : 0)];
      if (!centers[to] || state[from] === state[to]) continue;
      update(to, state[to], -1);
      update(to, state[from], 1);
    }
    puzzle.turn(face, direction, layer);
    moves.push({ face, direction, layer });
    if (moves.length % 64 === 0) report(`Greedy centers · ${moves.length.toLocaleString()} turns`);
  }
}
