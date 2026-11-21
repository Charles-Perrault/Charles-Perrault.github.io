import { createSearcher, FACE_TURNS, FOUND } from './vendor/optimal3/engine.mjs';

let searcher;

self.onmessage = ({ data }) => {
  if (data.searchTables) {
    searcher = createSearcher(data.searchTables, () => false);
    searcher.copyRoot(data.root);
    return;
  }
  const { depth, first, stride } = data;
  for (let move = first; move < FACE_TURNS.length; move += stride) {
    if (!searcher.descend(0, depth, move)) continue;
    searcher.path[0] = move;
    if (searcher.search(1, depth - 1, Math.floor(move / 3)) !== FOUND) continue;
    self.postMessage({ path: searcher.path.slice(0, depth) });
    return;
  }
  self.postMessage({ path: null });
};
