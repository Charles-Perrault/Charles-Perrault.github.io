// Coordinates increase toward R, U and F. Face storage starts in top-left order.
// Row and column steps describe coordinates on the sticker's cubie.
export const faceCoordinates = [
  { col: [1, 0, 0], row: [0, 0, 1], normal: [0, 1, 0] },
  { col: [0, 0, -1], row: [0, -1, 0], normal: [1, 0, 0] },
  { col: [1, 0, 0], row: [0, -1, 0], normal: [0, 0, 1] },
  { col: [1, 0, 0], row: [0, 0, -1], normal: [0, -1, 0] },
  { col: [0, 0, 1], row: [0, -1, 0], normal: [-1, 0, 0] },
  { col: [-1, 0, 0], row: [0, -1, 0], normal: [0, 0, -1] },
];

const axisFaces = [
  ['L', 'R'],
  ['D', 'U'],
  ['B', 'F'],
];
const sliceSymbols = ['m', 'e', 's'];
const sliceDirections = [1, 1, -1];
const allFaces = 0b111111;
// Yellow, orange, green, white, red, blue in U R F D L B order.
export const solvedColors = Object.freeze([3, 4, 2, 0, 1, 5]);

function rotateVector(vector, axis) {
  const result = [...vector];
  result[(axis + 1) % 3] = -vector[(axis + 2) % 3];
  result[(axis + 2) % 3] = vector[(axis + 1) % 3];
  return result;
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function faceFromNormal(normal) {
  return faceCoordinates.findIndex((face) => dot(face.normal, normal) === 1);
}

function storedIndex(index, size, clockwiseTurns) {
  if (clockwiseTurns === 0) return index;
  if (clockwiseTurns === 2) return size * size - 1 - index;
  const row = Math.floor(index / size);
  const col = index % size;
  return clockwiseTurns === 1 ? (size - 1 - col) * size + row : col * size + size - 1 - row;
}

function stripCycle(axis, size) {
  const last = size - 1;
  const start = faceCoordinates.find((face) => face.normal[axis] === 0);
  let normal = start.normal;
  let direction = start.row[axis] === 0 ? start.row : start.col;
  const axisVector = [0, 0, 0];
  axisVector[axis] = 1;
  const strips = [];

  for (let i = 0; i < 4; i++) {
    const face = faceFromNormal(normal);
    const { row, col } = faceCoordinates[face];
    const layerStride = dot(row, axisVector) * size + dot(col, axisVector);
    const stripStride = dot(row, direction) * size + dot(col, direction);
    const base = (layerStride < 0 ? -last * layerStride : 0) + (stripStride < 0 ? -last * stripStride : 0);
    const byOrientation = Array.from({ length: 4 }, (_, rotation) => {
      const first = storedIndex(base, size, rotation);
      return {
        face,
        base: first,
        layerStride: storedIndex(base + layerStride, size, rotation) - first,
        stripStride: storedIndex(base + stripStride, size, rotation) - first,
      };
    });
    strips.push({ face, byOrientation });
    normal = rotateVector(normal, axis);
    direction = rotateVector(direction, axis);
  }

  return {
    strips,
    mask: strips.reduce((mask, strip) => mask | (1 << strip.face), 0),
    negativeFace: faceFromNormal(axisVector.map((sign) => -sign)),
    positiveFace: faceFromNormal(axisVector),
  };
}

export class Cube {
  constructor(size, faces, orientations = new Uint8Array(6)) {
    if (!Number.isSafeInteger(size) || size < 2 || !Number.isSafeInteger(size * size * 6)) {
      throw new RangeError('Enter a whole cube size of 2 or greater.');
    }
    this.size = size;
    if (
      !(orientations instanceof Uint8Array) ||
      orientations.length !== 6 ||
      orientations.some((turns) => turns > 3)
    ) {
      throw new RangeError('Cube orientations must contain six quarter-turn counts.');
    }
    this.orientations = orientations;
    this.revision = 0;
    this.dirtyFaces = allFaces;
    this.cycles = [0, 1, 2].map((axis) => stripCycle(axis, size));
    const area = size * size;
    if (faces) {
      if (faces.length !== 6 || faces.some((face) => !(face instanceof Uint8Array) || face.length !== area)) {
        throw new RangeError('Cube stickers must contain six faces of the selected size.');
      }
      this.faces = faces;
    } else {
      this.faces = solvedColors.map((color) => new Uint8Array(area).fill(color));
    }
  }

  reset() {
    this.faces.forEach((face, index) => face.fill(solvedColors[index]));
    this.orientations.fill(0);
    this.revision++;
    this.dirtyFaces = allFaces;
  }

  isSolved() {
    return this.faces.every((face) => face.every((sticker) => sticker === face[0]));
  }

  clone() {
    return new Cube(this.size, this.faces.map((face) => face.slice()), this.orientations.slice());
  }

  hasSolvedCenters(faces = solvedColors.keys()) {
    const last = this.size - 1;
    for (const face of faces) {
      for (let row = 1; row < last; row++) {
        for (let col = 1; col < last; col++) {
          if (this.stickerAt(face, row, col) !== solvedColors[face]) return false;
        }
      }
    }
    return true;
  }

  hasPairedEdges() {
    const last = this.size - 1;
    for (const face of solvedColors.keys()) {
      for (const side of [0, last]) {
        const rowColor = this.stickerAt(face, side, 1);
        const colColor = this.stickerAt(face, 1, side);
        for (let i = 2; i < last; i++) {
          if (this.stickerAt(face, side, i) !== rowColor || this.stickerAt(face, i, side) !== colColor) {
            return false;
          }
        }
      }
    }
    return true;
  }

  stickerAt(face, row, col) {
    return this.faces[face][storedIndex(row * this.size + col, this.size, this.orientations[face])];
  }

  setSticker(face, row, col, color) {
    const stickers = this.faces[face];
    const index = storedIndex(row * this.size + col, this.size, this.orientations[face]);
    if (stickers[index] === color) return false;
    stickers[index] = color;
    this.dirtyFaces = 1 << face;
    this.revision++;
    return true;
  }

  cycleCenterStickers(stickers) {
    const addresses = stickers.map(([face, row, col]) => [
      face, storedIndex(row * this.size + col, this.size, this.orientations[face]),
    ]);
    const colors = addresses.map(([face, index]) => this.faces[face][index]);
    this.dirtyFaces = 0;
    addresses.forEach(([face, index], i) => {
      this.faces[face][index] = colors[(i + 2) % 3];
      this.dirtyFaces |= 1 << face;
    });
    this.revision++;
  }

  apply({ axis, layer, endLayer = layer, turns }) {
    if (
      !Number.isInteger(axis) ||
      axis < 0 ||
      axis > 2 ||
      !Number.isInteger(layer) ||
      layer < 0 ||
      layer >= this.size ||
      !Number.isInteger(endLayer) ||
      endLayer < layer ||
      endLayer >= this.size ||
      (turns !== -1 && turns !== 1 && turns !== 2)
    ) {
      throw new RangeError('Invalid cube turn.');
    }
    const { strips, mask, negativeFace, positiveFace } = this.cycles[axis];
    const [first, second, third, fourth] = strips;
    const a = first.byOrientation[this.orientations[first.face]];
    const b = second.byOrientation[this.orientations[second.face]];
    const c = third.byOrientation[this.orientations[third.face]];
    const d = fourth.byOrientation[this.orientations[fourth.face]];
    for (let slice = layer; slice <= endLayer; slice++) {
      if (turns === 1) this.rotateStrips(a, b, c, d, slice);
      else if (turns === -1) this.rotateStrips(a, d, c, b, slice);
      else this.swapStrips(a, b, c, d, slice);
    }
    this.dirtyFaces = mask;
    // Face textures stay in storage order when their logical orientation changes.
    if (layer === 0) this.orientations[negativeFace] = (this.orientations[negativeFace] + turns + 4) % 4;
    if (endLayer === this.size - 1)
      this.orientations[positiveFace] = (this.orientations[positiveFace] - turns + 4) % 4;
    this.revision++;
  }

  rotateStrips(a, b, c, d, layer) {
    const fa = this.faces[a.face];
    const fb = this.faces[b.face];
    const fc = this.faces[c.face];
    const fd = this.faces[d.face];
    let ia = a.base + a.layerStride * layer;
    let ib = b.base + b.layerStride * layer;
    let ic = c.base + c.layerStride * layer;
    let id = d.base + d.layerStride * layer;
    const size = this.size;
    for (let i = 0; i < size; i++) {
      const first = fa[ia];
      fa[ia] = fd[id];
      fd[id] = fc[ic];
      fc[ic] = fb[ib];
      fb[ib] = first;
      ia += a.stripStride;
      ib += b.stripStride;
      ic += c.stripStride;
      id += d.stripStride;
    }
  }

  swapStrips(a, b, c, d, layer) {
    const fa = this.faces[a.face];
    const fb = this.faces[b.face];
    const fc = this.faces[c.face];
    const fd = this.faces[d.face];
    let ia = a.base + a.layerStride * layer;
    let ib = b.base + b.layerStride * layer;
    let ic = c.base + c.layerStride * layer;
    let id = d.base + d.layerStride * layer;
    const size = this.size;
    for (let i = 0; i < size; i++) {
      const first = fa[ia];
      const second = fb[ib];
      fa[ia] = fc[ic];
      fb[ib] = fd[id];
      fc[ic] = first;
      fd[id] = second;
      ia += a.stripStride;
      ib += b.stripStride;
      ic += c.stripStride;
      id += d.stripStride;
    }
  }
}

export function parseMoves(text, size) {
  const tokens = text.trim().split(/\s+/u).filter(Boolean);
  return tokens.map((token) => {
    const match = /^(?:(\d+)?([UDRLFB])(w?)|([xyz])|(\d+)(?::(\d+))?([MES]))([2'’])?$/iu.exec(token);
    if (!match) throw new SyntaxError(`Unknown move “${token}”. Try R, U', F2 or 1m.`);
    const [, widthPrefix, face, wide, rotation, depth, endDepth, slice, suffix] = match;
    let axis, layer, endLayer, direction;
    if (face) {
      const letter = face.toUpperCase();
      axis = axisFaces.findIndex((pair) => pair.includes(letter));
      const positive = axisFaces[axis][1] === letter;
      const width = wide ? Number(widthPrefix || 2) : 1;
      if ((widthPrefix && !wide) || (wide && width < 2) || width > size) {
        throw new RangeError(`Turn “${token}” must use a valid layer count, such as Rw or 3Rw.`);
      }
      layer = positive ? size - width : 0;
      endLayer = positive ? size - 1 : width - 1;
      direction = positive ? -1 : 1;
    } else if (rotation) {
      axis = 'xyz'.indexOf(rotation.toLowerCase());
      layer = 0;
      endLayer = size - 1;
      direction = -1;
    } else {
      axis = sliceSymbols.indexOf(slice.toLowerCase());
      const index = Number(depth);
      const end = Number(endDepth ?? depth);
      if (index < 1 || end < index || end > size - 2) {
        throw new RangeError(
          size === 2
            ? 'A 2 × 2 × 2 cube has no inner slices.'
            : `Slice “${token}” is outside this cube. Use layers 1 through ${size - 2}.`,
        );
      }
      layer = axis === 2 ? size - 1 - end : index;
      endLayer = axis === 2 ? size - 1 - index : end;
      direction = sliceDirections[axis];
    }
    const move = { axis, layer, turns: suffix === '2' ? 2 : suffix ? -direction : direction };
    if (endLayer !== layer) move.endLayer = endLayer;
    return move;
  });
}

export function formatTurn({ axis, layer, endLayer = layer, turns }, size) {
  const outer = layer === 0 || endLayer === size - 1;
  const whole = layer === 0 && endLayer === size - 1;
  const direction = whole ? -1 : outer ? (layer === 0 ? 1 : -1) : sliceDirections[axis];
  const start = axis === 2 ? size - 1 - endLayer : layer;
  const end = axis === 2 ? size - 1 - layer : endLayer;
  const width = endLayer - layer + 1;
  const name = whole
    ? 'xyz'[axis]
    : outer
      ? `${width > 2 ? width : ''}${axisFaces[axis][Number(layer > 0)]}${width > 1 ? 'w' : ''}`
      : `${start}${start === end ? '' : `:${end}`}${sliceSymbols[axis]}`;
  return name + (turns === 2 ? '2' : turns === direction ? '' : "'");
}

const baseScrambleLength = (size) => 20 * size;
const bonusFaceTurns = (size) => (size >= 500 ? Math.round(baseScrambleLength(size) / 1000) : 0);

export function scrambleLength(size) {
  return baseScrambleLength(size) + bonusFaceTurns(size);
}

export function* scrambleMoves(size, random = Math.random, count) {
  const slices = 3 * size;
  const faceSlices = [0, size - 1, size, 2 * size - 1, 2 * size, slices - 1];
  const angles = [-1, 1, 2];
  let faceTurnsLeft = count === undefined ? bonusFaceTurns(size) : 0;
  let previous = -1;
  for (let remaining = count ?? scrambleLength(size); remaining > 0; remaining--) {
    // Choose a random interleaving without storing the full scramble.
    const addFaceTurn = faceTurnsLeft > 0 && random() * remaining < faceTurnsLeft;
    const excluded = addFaceTurn ? faceSlices.indexOf(previous) : previous;
    const poolSize = addFaceTurn ? faceSlices.length : slices;
    let index = Math.floor(random() * (poolSize - Number(excluded !== -1)));
    if (excluded !== -1 && index >= excluded) index++;
    const slice = addFaceTurn ? faceSlices[index] : index;
    if (addFaceTurn) faceTurnsLeft--;
    previous = slice;
    yield { axis: Math.floor(slice / size), layer: slice % size, turns: angles[Math.floor(random() * 3)] };
  }
}
