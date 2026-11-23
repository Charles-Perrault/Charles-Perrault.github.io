// A face turn only distinguishes coordinates below its first cut. Every
// octahedral face has representatives of the same three classes as order 3:
// two coordinates of 1 (corner), one small coordinate (edge), or two 2s
// on opposite sides of a cut (center). The classes retain their labels
// under rotations of the three coordinates.
export function outerProjection(size, state) {
  if (!Number.isSafeInteger(size) || size < 3 || state.length !== 8 * size ** 2) {
    throw new RangeError('FTO sticker count does not match its size');
  }
  const edgeLow = size % 2 ? 1 : 2;
  const edgeHigh = (3 * size - edgeLow) / 2;
  const ids = [];
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3 - row; column++) {
    for (const parity of [0, 1]) {
      if (column + row + parity >= 3) continue;
      const x = 3 * column + 1 + parity;
      const y = 3 * row + 1 + parity;
      const coordinates = [x, y, 9 - x - y];
      const mapped = parity ? coordinates.map(value => value === 2 ? 2 : 3 * size - 4)
        : coordinates.includes(7) ? coordinates.map(value => value === 1 ? 1 : 3 * size - 2)
          : coordinates.map(value => value === 1 ? edgeLow : edgeHigh);
      const down = mapped[0] % 3 - 1;
      const [newX, newY] = mapped.map(value => (value - 1 - down) / 3);
      ids.push(newY * (2 * size - newY) + 2 * newX + down);
    }
  }
  return Uint8Array.from({ length: 72 }, (_, index) =>
    state[Math.floor(index / 9) * size ** 2 + ids[index % 9]]);
}
