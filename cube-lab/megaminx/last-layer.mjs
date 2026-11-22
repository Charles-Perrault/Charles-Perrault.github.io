import { stickers } from './puzzle.mjs';
import { apply, identity, lastFace, lastPieces, pull, undo } from './solver-model.mjs';

export const top = lastFace * 2;
export const auf = [[], [top], [top, top], [top ^ 1, top ^ 1], [top ^ 1]];
export const lastStickers = lastPieces.flat();
const lastIndex = new Map(lastStickers.map((id, i) => [id, i]));
const alignment = auf.map(word => apply(identity, undo(word)));

export function orientationKey(state) {
  let key = 0;
  for (const id of lastStickers) key = key * 2 + Number(stickers[state[id]].face === lastFace);
  return key;
}

export function permutationKey(state) {
  return lastStickers.map(id => String.fromCharCode(65 + lastIndex.get(state[id]))).join('');
}

export function lastLayerSetup(state, type) {
  const variants = [];
  let rotated = state;
  for (const before of auf) {
    if (type === 'oll') variants.push({ key: orientationKey(rotated), before, after: [] });
    else for (const [i, relabel] of alignment.entries()) {
      // A color alignment after PLL is equivalent to relabeling the homes before it.
      variants.push({ key: permutationKey(rotated.map(id => relabel[id])), before, after: undo(auf[i]) });
    }
    rotated = pull[top].map(id => rotated[id]);
  }
  return variants;
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWX';
export const encodeWord = word => word.map(turn => alphabet[turn]).join('');
export const decodeWord = text => Array.from(text, char => alphabet.indexOf(char));

export function lookup(state, type, database) {
  let best;
  for (const { key, before, after } of lastLayerSetup(state, type)) {
    const entry = database[key];
    if (entry === undefined) continue;
    const word = [...before, ...decodeWord(entry), ...after];
    if (!best || word.length < best.length) best = word;
  }
  if (!best) throw new Error(`Unrecognized Megaminx ${type.toUpperCase()} case`);
  return best;
}
