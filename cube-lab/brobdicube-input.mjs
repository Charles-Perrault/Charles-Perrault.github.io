import { unpackTurns } from './packed-turns.mjs';

const faces = [['L', 'R'], ['D', 'U'], ['B', 'F']];

export function brobdicubeInput(history, size) {
  const tokens = [];
  for (const { axis, layer, endLayer = layer, turns } of unpackTurns(history)) {
    for (let slice = layer; slice <= endLayer; slice++) {
      if (tokens.length === 1_000_000) return null;
      const positive = slice > (size - 1) / 2;
      const depth = positive ? size - slice : slice + 1;
      const suffix = turns === 2 ? '2' : turns === (positive ? -1 : 1) ? '' : "'";
      tokens.push((depth === 1 ? '' : depth) + faces[axis][Number(positive)] + suffix);
    }
  }
  return tokens.join(' ');
}
