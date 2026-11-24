import { identify, identity, layerStages, pieces, pieceIndex, basicMacros, cycles, apply, moves, simplify } from './solver-model.mjs';
import { lookup } from './last-layer.mjs';
import { oll, pll } from './last-layer-data.mjs';
import { findTripleBridge, findTripleInsertion } from './triple-search.mjs?v=2';

function shortInsertion(source, target, locked) {
  const available = basicMacros().filter(item => item.touched.every(i => !locked[i]));
  const paths = [];
  const cost = new Uint16Array(identity.length).fill(65535);
  const queue = [[source]];
  cost[source] = 0;
  paths[source] = [];
  for (let i = 0; i < queue.length; i++) for (const slot of queue[i] ?? []) {
    if (cost[slot] !== i) continue;
    if (slot === target) return paths[slot];
    for (const { perm, word } of available) {
      const next = perm[slot], distance = i + word.length;
      if (cost[next] <= distance) continue;
      cost[next] = distance;
      paths[next] = [...paths[slot], ...word];
      (queue[distance] ??= []).push(next);
    }
  }
  return null;
}

function cycleInsertion(source, target, locked) {
  const size = pieces[pieceIndex[target]].length;
  const catalog = cycles(size);
  const free = pieces.filter((p, i) => p.length === size && !locked[i]).flat();

  const bestCycle = (from, to) => {
    let cheapest = Infinity, third;
    for (const id of free) {
      if (pieceIndex[id] === pieceIndex[from] || pieceIndex[id] === pieceIndex[to]) continue;
      const distance = catalog.cost(from, to, id);
      if (distance >= cheapest) continue;
      cheapest = distance;
      third = id;
    }
    if (third === undefined || cheapest === 255) throw new Error('No free Megaminx insertion cycle');
    return catalog.get(from, to, third);
  };

  if (pieceIndex[source] !== pieceIndex[target]) return bestCycle(source, target);
  let best;
  for (const buffer of free) {
    if (pieceIndex[buffer] === pieceIndex[target]) continue;
    const candidate = simplify([...bestCycle(source, buffer), ...bestCycle(buffer, target)]);
    if (!best || candidate.length < best.length) best = candidate;
  }
  return best;
}

export function solveMegaminx(state, onStage = () => {}, onMoves = () => {}) {
  let labels = identify(state);
  const stages = [];
  let generated = 0;
  const locked = new Uint8Array(pieces.length);
  const record = (name, word) => {
    const planned = simplify(word).map(turn => moves[turn]);
    stages.push({ name, moves: planned });
    generated += planned.length;
    if (planned.length) onMoves(name, planned);
  };

  for (const { name, pieces: targets } of layerStages) {
    onStage(name, { generated });
    const word = [];
    // Give already-correct pieces priority so later insertions preserve them.
    const ordered = [...targets].sort((a, b) => Number(labels[b[0]] === b[0]) - Number(labels[a[0]] === a[0]));
    for (const [target] of ordered) {
      const source = labels.indexOf(target);
      if (source !== target) {
        const basic = shortInsertion(source, target, locked);
        const limit = Math.min(6, (basic?.length ?? 7) - 1);
        const shorter = limit >= 2 ? findTripleInsertion(source, target, locked, limit) : null;
        const bridge = !shorter && (basic?.length ?? Infinity) > 7
          ? findTripleBridge(source, target, locked, basic?.length ?? Infinity) : null;
        const insert = shorter ?? bridge ?? basic ?? cycleInsertion(source, target, locked);
        labels = apply(labels, insert);
        word.push(...insert);
      }
      locked[pieceIndex[target]] = 1;
    }
    record(name, word);
  }

  onStage('Last-layer orientation');
  const orient = lookup(labels, 'oll', oll);
  labels = apply(labels, orient);
  record('Last-layer orientation', orient);

  onStage('Last-layer permutation');
  const permute = lookup(labels, 'pll', pll);
  labels = apply(labels, permute);
  record('Last-layer permutation', permute);
  if (labels.some((id, i) => id !== i)) throw new Error('Megaminx solution failed verification');
  return stages;
}
