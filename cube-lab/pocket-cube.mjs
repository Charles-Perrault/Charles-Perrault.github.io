import CubieCube from './vendor/cubejs/cube.mjs';

const positions = [0, 1, 2, 3, 4, 5, 7];
const orientationCount = 3 ** 6;
const permutationCount = 5040;
const moves = ['U', 'R', 'F'].flatMap(face => [face, `${face}2`, `${face}'`]);
const opposite = [3, 4, 5, 0, 1, 2];
const faceNames = 'URFDLB';
let tables;

function rankPermutation(permutation) {
  let rank = 0;
  for (let i = 0; i < permutation.length; i++) {
    let smaller = 0;
    for (let j = i + 1; j < permutation.length; j++) smaller += Number(permutation[j] < permutation[i]);
    rank = rank * (permutation.length - i) + smaller;
  }
  return rank;
}

function unrankPermutation(rank) {
  const remaining = [0, 1, 2, 3, 4, 5, 6];
  const digits = new Array(remaining.length);
  for (let i = digits.length - 1; i >= 0; i--) {
    const radix = digits.length - i;
    digits[i] = rank % radix;
    rank = Math.floor(rank / radix);
  }
  return digits.map(digit => remaining.splice(digit, 1)[0]);
}

function rankOrientation(orientation) {
  let rank = 0;
  for (let i = 0; i < 6; i++) rank = rank * 3 + orientation[i];
  return rank;
}

function unrankOrientation(rank) {
  const orientation = new Array(7);
  let sum = 0;
  for (let i = 5; i >= 0; i--) {
    orientation[i] = rank % 3;
    sum += orientation[i];
    rank = Math.floor(rank / 3);
  }
  orientation[6] = (3 - sum % 3) % 3;
  return orientation;
}

function buildTables() {
  const cubieMoves = moves.map(move => new CubieCube().move(move));
  const sources = cubieMoves.map(move => positions.map(position => positions.indexOf(move.cp[position])));
  const twists = cubieMoves.map(move => positions.map(position => move.co[position]));
  const permutations = new Uint16Array(permutationCount * moves.length);
  const orientations = new Uint16Array(orientationCount * moves.length);
  for (let p = 0; p < permutationCount; p++) {
    const permutation = unrankPermutation(p);
    sources.forEach((source, move) => {
      permutations[p * moves.length + move] = rankPermutation(source.map(position => permutation[position]));
    });
  }
  for (let o = 0; o < orientationCount; o++) {
    const orientation = unrankOrientation(o);
    sources.forEach((source, move) => {
      orientations[o * moves.length + move] = rankOrientation(source.map((position, i) => (orientation[position] + twists[move][i]) % 3));
    });
  }

  const distance = new Uint8Array(permutationCount * orientationCount).fill(255);
  const queue = new Uint32Array(distance.length);
  distance[0] = 0;
  let tail = 1;
  for (let head = 0; head < tail; head++) {
    const state = queue[head];
    const p = Math.floor(state / orientationCount) * moves.length;
    const o = (state % orientationCount) * moves.length;
    const nextDistance = distance[state] + 1;
    for (let move = 0; move < moves.length; move++) {
      const next = permutations[p + move] * orientationCount + orientations[o + move];
      if (distance[next] !== 255) continue;
      distance[next] = nextDistance;
      queue[tail++] = next;
    }
  }
  if (tail !== distance.length) throw new Error('Pocket cube distance table is incomplete.');
  return { permutations, orientations, distance };
}

function anchoredCorners(cube) {
  // Relabel colors so the lower-left back corner is solved. A free whole-cube
  // rotation can replace each D/L/B turn with an equivalent U/R/F turn, so the
  // nine moves fixing this corner preserve the minimum over all orientations.
  const colors = new Array(6);
  for (const [face, row, col] of [[3, 1, 0], [4, 1, 0], [5, 1, 1]]) {
    const color = cube.stickerAt(face, row, col);
    colors[color] = faceNames[face];
    colors[opposite[color]] = faceNames[face - 3];
  }
  let facelets = '';
  for (let face = 0; face < 6; face++) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        facelets += row === 1 || col === 1 ? faceNames[face] : colors[cube.stickerAt(face, row / 2, col / 2)] ?? '?';
      }
    }
  }
  const { cp, co } = CubieCube.fromString(facelets);
  if (cp[6] !== 6 || co[6] !== 0 || new Set(cp).size !== 8 || co.reduce((sum, twist) => sum + twist, 0) % 3) {
    throw new Error('The 2×2 corner arrangement is invalid.');
  }
  const roundTrip = new CubieCube();
  roundTrip.cp = cp;
  roundTrip.co = co;
  if (roundTrip.asString() !== facelets) throw new Error('The 2×2 corner colors are invalid.');
  return [rankPermutation(positions.map(position => positions.indexOf(cp[position]))), rankOrientation(positions.map(position => co[position]))];
}

export function solvePocketCube(cube) {
  let [p, o] = anchoredCorners(cube);
  const solution = [];
  if (p === 0 && o === 0) return solution;
  const { permutations, orientations, distance } = tables ??= buildTables();
  for (let depth = distance[p * orientationCount + o]; depth > 0; depth--) {
    for (let move = 0; move < moves.length; move++) {
      const nextP = permutations[p * moves.length + move];
      const nextO = orientations[o * moves.length + move];
      if (distance[nextP * orientationCount + nextO] !== depth - 1) continue;
      solution.push(moves[move]);
      p = nextP;
      o = nextO;
      break;
    }
  }
  return solution;
}
