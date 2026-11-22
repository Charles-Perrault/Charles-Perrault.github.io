import { identity, pieces, push, simplify, undo } from './solver-model.mjs';

let radius;
function threeTurnPaths() {
  if (radius) return radius;
  const paths = [{ word: [], permutation: identity }];
  const commute = push.map(a => push.map(b => identity.every(id => a[b[id]] === b[a[id]])));
  for (const { word, permutation } of paths) {
    if (word.length === 3) break;
    const previous = word.at(-1);
    for (const [turn, next] of push.entries()) {
      if (previous !== undefined && turn >> 1 === previous >> 1) {
        if (turn !== previous || word.at(-2) === turn) continue;
      } else if (turn < previous && commute[previous][turn]) {
        continue;
      }
      paths.push({ word: [...word, turn], permutation: permutation.map(id => next[id]) });
    }
  }
  return radius = paths;
}

function reach(groups, source, paths, limit) {
  const routes = new Array(identity.length);
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const forward = new Array(identity.length);
    const landings = [];
    for (const index of group) {
      const path = paths[index], position = path.permutation[source];
      if (forward[position]) continue;
      forward[position] = path;
      landings.push(position);
    }
    for (const index of group) {
      const back = paths[index];
      for (const position of landings) {
        const front = forward[position], cost = front.word.length + back.word.length;
        if (cost >= limit) break;
        const goal = back.inverse[position];
        if (goal !== source && cost < (routes[goal]?.cost ?? limit)) routes[goal] = { front, back, cost };
      }
    }
  }
  return routes;
}

// Join two short lock-preserving insertions through the same intermediate slot.
export function findTripleBridge(source, target, locked, limit) {
  const anchors = pieces.flatMap(([id], index) => locked[index] ? [id] : []);
  const key = new Uint8Array(anchors.length);
  const paths = threeTurnPaths();
  const groups = new Map();
  for (const [index, path] of paths.entries()) {
    if (!path.inverse) {
      path.inverse = new Uint8Array(identity.length);
      path.permutation.forEach((id, from) => { path.inverse[id] = from; });
    }
    for (let i = 0; i < anchors.length; i++) key[i] = path.permutation[anchors[i]];
    const signature = String.fromCharCode(...key);
    const group = groups.get(signature);
    if (group) group.push(index);
    else groups.set(signature, [index]);
  }
  const fromSource = reach(groups, source, paths, limit);
  const fromTarget = reach(groups, target, paths, limit);
  let best = null;
  for (const [slot, a] of fromSource.entries()) {
    const b = fromTarget[slot];
    if (!a || !b) continue;
    const word = simplify([...a.front.word, ...undo(a.back.word), ...b.back.word, ...undo(b.front.word)]);
    if (word.length < (best?.length ?? limit)) best = word;
  }
  return best;
}

export function findTripleInsertion(source, target, locked, limit = 6) {
  const anchors = pieces.flatMap(([id], index) => locked[index] ? [id] : []);
  const key = new Uint8Array(anchors.length + 1);
  const paths = threeTurnPaths();
  const forward = new Map();
  const maxDepth = Math.min(3, limit);

  const project = (permutation, id) => {
    for (let i = 0; i < anchors.length; i++) key[i] = permutation[anchors[i]];
    key[anchors.length] = permutation[id];
    return String.fromCharCode(...key);
  };

  // Match the tracked stickers after no more than three turns from each side.
  for (const { word, permutation } of paths) {
    if (word.length > maxDepth) break;
    const position = project(permutation, source);
    if (!forward.has(position)) forward.set(position, word);
  }
  let best = null;
  for (const { word, permutation } of paths) {
    if (word.length > maxDepth || word.length >= (best?.length ?? limit + 1)) break;
    const prefix = forward.get(project(permutation, target));
    if (!prefix || prefix.length + word.length > limit) continue;
    if (!best || prefix.length + word.length < best.length) best = [...prefix, ...undo(word)];
  }
  return best;
}
