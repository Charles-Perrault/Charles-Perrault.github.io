import { solvedColors } from './cube.mjs?v=17';
import ThreeByThree from './vendor/cubejs/cube.mjs';

const letters = 'URFDLB';
const colorNames = ['white', 'red', 'green', 'yellow', 'orange', 'blue'];
const sum = (values) => values.reduce((total, value) => total + value, 0);

function parity(pieces) {
  let odd = 0;
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) odd ^= Number(pieces[i] > pieces[j]);
  }
  return odd;
}

export function validatePaintedCube(cube) {
  const { size } = cube;
  const total = size * size;
  const counts = new Uint32Array(6);
  for (const face of cube.faces) for (const color of face) counts[color]++;
  const wrong = counts.findIndex((count) => count !== total);
  if (wrong !== -1) return `Each color needs ${total} stickers. You have ${counts[wrong]} ${colorNames[wrong]} stickers.`;

  const middle = Math.floor(size / 2);
  if (size % 2 && solvedColors.some((color, face) => cube.stickerAt(face, middle, middle) !== color)) {
    return 'Match the six fixed centers with yellow up and green in front.';
  }

  // Validate real corners at any size. The full 3×3 also has fixed edge positions.
  let facelets = '';
  const indices = [0, middle, size - 1];
  for (let face = 0; face < 6; face++) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        facelets += size === 3 || (row !== 1 && col !== 1)
          ? letters[solvedColors.indexOf(cube.stickerAt(face, indices[row], indices[col]))]
          : letters[face];
      }
    }
  }
  const state = ThreeByThree.fromString(facelets);
  if (state.asString() !== facelets) return 'Some sticker combinations are impossible. Check the colors on each piece.';
  if (new Set(state.cp).size !== 8 || sum(state.co) % 3) {
    return 'The corner colors are impossible on a physical cube. Check the corner stickers.';
  }
  if (size === 3 && (new Set(state.ep).size !== 12 || sum(state.eo) % 2 || parity(state.cp) !== parity(state.ep))) {
    return 'The edge positions or orientations are impossible. Check the edge stickers.';
  }
  return null;
}
