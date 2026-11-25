import { inTurn } from './model.mjs';

let tables;

function pattern(radix, byDigit, startDigits, moveCount) {
  const encode = digits => digits.reduceRight((value, digit) => value * radix + digit, 0);
  const target = encode(startDigits), size = radix ** startDigits.length;
  const distances = new Uint8Array(size).fill(255);
  const transitions = new Uint16Array(size * moveCount), queue = [target];
  distances[target] = 0;
  for (const current of queue) {
    for (let move = 0; move < moveCount; move++) {
      let value = current, next = 0, factor = 1;
      for (const lookup of byDigit) {
        next += lookup[move][value % radix] * factor;
        value = Math.floor(value / radix);
        factor *= radix;
      }
      transitions[current * moveCount + move] = next;
      if (distances[next] === 255) {
        distances[next] = distances[current] + 1;
        queue.push(next);
      }
    }
  }
  return { encode, target, distances, transitions };
}

function search(patterns, start, count) {
  const word = [];
  const h = positions => Math.max(...positions.map((value, i) => patterns[i].distances[value]));
  function visit(positions, depth, last) {
    const lower = h(positions);
    if (lower > depth) return false;
    if (!lower) return true;
    for (let move = 0; move < count; move++) {
      if ((move >> 1) === (last >> 1)) continue;
      const next = positions.map((p, i) => patterns[i].transitions[p * count + move]);
      word.push(move);
      if (visit(next, depth - 1, move)) return true;
      word.pop();
    }
    return false;
  }
  for (let depth = h(start); depth <= 20; depth++) if (visit(start, depth, -1)) return word;
  throw new Error('No Redi solution found for these stickers.');
}

function build(puzzle) {
  const groups = new Map();
  for (const [id, tile] of puzzle.stickers.entries()) {
    const key = puzzle.moves.map(turn => Number(inTurn(tile.center, turn))).join('');
    if (!key.includes('1')) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  const edges = [...groups.values()].filter(piece => piece.length === 2);
  const corners = [...groups.values()].filter(piece => piece.length === 3);
  if (edges.length !== 12 || corners.length !== 8) throw new Error('Expected the standard Redi geometry.');
  const indices = [...puzzle.moves.keys()].sort((a,b) => puzzle.moves[b].normal[1] - puzzle.moves[a].normal[1]);
  const actions = indices.flatMap(index => [1,-1].map(direction => ({ index, direction })));
  const identity = Uint8Array.from(puzzle.state, (_, i) => i), before = puzzle.state.slice();
  const destinations = actions.map(({ index, direction }) => {
    puzzle.state.set(identity);
    puzzle.turn(puzzle.moves[index], direction);
    const destination = new Uint8Array(identity.length);
    puzzle.state.forEach((from, to) => { destination[from] = to; });
    return destination;
  });
  puzzle.state.set(before);
  const map = destinations.map(dest => edges.map(([a]) => edges.findIndex(piece => piece.includes(dest[a]))));
  const bottomEdges = edges.flatMap((_, i) => map.slice(0, 8).every(m => m[i] === i) ? [i] : []);
  const mid = edges.flatMap((_, i) => bottomEdges.includes(i) ? [] : [i]);
  const lower = corners.filter(piece => destinations.slice(0, 8).every(m => m[piece[0]] === piece[0]));
  const upper = corners.filter(piece => !lower.includes(piece));
  function edgePattern(ids, moves) {
    return pattern(12, ids.map(() => map.slice(0, moves)), ids, moves);
  }
  function cornerPattern(pieces, moves) {
    const lookup = pieces.map(slots => destinations.slice(0, moves).map(dest =>
      slots.map(id => slots.indexOf(dest[id]))));
    return pattern(3, lookup, pieces.map(() => 0), moves);
  }
  const phase1 = [edgePattern(bottomEdges, 16), cornerPattern(lower, 16)];
  const phase2 = [edgePattern(mid.slice(0, 4), 8), edgePattern(mid.slice(4), 8), cornerPattern(upper, 8)];
  const edgeKey = (piece, state) => piece.map(id => state[id]).sort().join(',');
  const homeKeys = edges.map(piece => edgeKey(piece, puzzle.home));
  function positions(state) {
    const located = edges.map(piece => homeKeys.indexOf(edgeKey(piece, state)));
    const encodeEdges = (ids, p) => p.encode(ids.map(id => located.indexOf(id)));
    const encodeCorners = (pieces, p) => p.encode(pieces.map(piece => piece.findIndex(id => state[id] === puzzle.home[piece[0]])));
    return { first: [encodeEdges(bottomEdges, phase1[0]), encodeCorners(lower, phase1[1])],
      second: [encodeEdges(mid.slice(0, 4), phase2[0]), encodeEdges(mid.slice(4), phase2[1]), encodeCorners(upper, phase2[2])] };
  }
  return { actions, destinations, phase1, phase2, positions };
}

export function solveRedi(puzzle, state = puzzle.state) {
  const input = state.slice();
  if (!tables) tables = build(puzzle);
  const { actions, destinations, phase1, phase2, positions } = tables;
  const first = search(phase1, positions(input).first, 16);
  const replay = (data, word) => {
    for (const index of word) {
      const next = data.slice();
      destinations[index].forEach((to, from) => { next[to] = data[from]; });
      data = next;
    }
    return data;
  };
  const middle = replay(input, first);
  const second = search(phase2, positions(middle).second, 8);
  if (!replay(middle, second).every((color, i) => color === puzzle.home[i])) {
    throw new Error('The Redi solution did not verify.');
  }
  return [...first, ...second].map(id => {
    const { index, direction } = actions[id];
    return { turn: puzzle.moves[index], direction };
  });
}
