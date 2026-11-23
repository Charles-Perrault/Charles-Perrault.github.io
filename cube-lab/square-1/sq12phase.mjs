// Adapted from Shuang Chen's sq12phase, MIT license. See SQ12PHASE-LICENSE.txt.
const HALF_MASK = 0x3f;
const RING_MASK = 0xfff;
const permutations = 40320;
const factorials = [1, 1, 2, 6, 24, 120, 720, 5040];
const countBits = value => {
  let count = 0;
  for (; value; value &= value - 1) count++;
  return count;
};

function distances(size, starts, visit) {
  const distance = new Int8Array(size).fill(-1);
  const queue = new Uint32Array(size);
  queue.set(starts);
  for (const start of starts) distance[start] = 0;
  let limit = starts.length;
  for (let i = 0; i < limit; i++) {
    const from = queue[i];
    visit(from, next => {
      if (distance[next] !== -1) return;
      distance[next] = distance[from] + 1;
      queue[limit++] = next;
    });
  }
  return distance;
}

function rank(perm) {
  let result = 0;
  for (let i = 0; i < 7; i++) {
    let order = 0;
    for (let j = i + 1; j < 8; j++) order += Number(perm[j] < perm[i]);
    result += order * factorials[7 - i];
  }
  return result;
}

function unrank(value) {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7];
  return factorials.slice().reverse().map(factorial => {
    const entry = pool.splice(Math.floor(value / factorial), 1)[0];
    value %= factorial;
    return entry;
  });
}

function permTables() {
  const top = new Uint16Array(permutations), bottom = top.slice(), slash = top.slice();
  for (let i = 0; i < permutations; i++) {
    const [a, b, c, d, e, f, g, h] = unrank(i);
    top[i] = rank([b, c, d, a, e, f, g, h]);
    bottom[i] = rank([a, b, c, d, f, g, h, e]);
    slash[i] = rank([a, b, e, f, c, d, g, h]);
  }
  const distance = distances(permutations * 2, [0], (id, push) => {
    const perm = id >> 1, middle = id & 1;
    push(slash[perm] * 2 + (1 - middle));
    for (const turns of [top, bottom]) {
      for (let p = turns[perm]; p !== perm; p = turns[p]) push(p * 2 + middle);
    }
  });
  return { top, bottom, slash, distance };
}

function shapeTables() {
  // Each six-unit half is a tiling by one-unit edges and two-unit corners.
  const halfShapes = [];
  function tile(remaining, bits) {
    if (!remaining) return halfShapes.push(bits);
    tile(remaining - 1, bits << 1);
    if (remaining >= 2) tile(remaining - 2, (bits << 2) | 3);
  }
  tile(6, 0);
  const shapes = [];
  for (const a of halfShapes) for (const b of halfShapes) {
    for (const c of halfShapes) for (const d of halfShapes) {
      const bits = a << 18 | b << 12 | c << 6 | d;
      if (countBits(bits) === 16) shapes.push(bits);
    }
  }
  const ids = new Map(shapes.map((bits, i) => [bits, i * 2]));
  const index = (bits, parity) => (ids.get(bits) ?? -2) + parity;
  const next = Array.from({ length: shapes.length * 2 }, () => new Uint32Array(3));

  function turn(ring) {
    let amount = 0, movedParity = 0;
    do {
      if (ring & 0x800) {
        amount += 2;
        ring = (ring << 2) ^ 0x3003;
      } else {
        amount++;
        ring <<= 1;
      }
      movedParity ^= 1;
    } while (countBits(ring & HALF_MASK) % 2);
    return { ring, amount, parity: (countBits(ring) & 2) ? 0 : movedParity };
  }

  for (const [i, bits] of shapes.entries()) {
    const upper = bits >> 12, lower = bits & RING_MASK;
    const u = turn(upper), d = turn(lower);
    const topSlice = upper & HALF_MASK, bottomSlice = lower >> 6;
    const sliced = (upper & 0xfc0 | bottomSlice) << 12 | topSlice << 6 | lower & HALF_MASK;
    const sliceParity = (countBits(topSlice) & countBits(bottomSlice)) >> 1 & 1;
    for (const p of [0, 1]) {
      const row = next[i * 2 + p];
      row[0] = index(sliced, p ^ sliceParity);
      row[1] = index(u.ring << 12 | lower, p ^ u.parity) << 4 | u.amount;
      row[2] = index(upper << 12 | d.ring, p ^ d.parity) << 4 | d.amount;
    }
  }

  const starts = [0x0db66db, 0x1db6db6, 0x16db6db, 0x06dbdb6].map(value =>
    index(value & 0xffffff, value >> 24));
  const distance = distances(next.length, starts, (id, push) => {
    push(next[id][0]);
    for (const side of [1, 2]) {
      let current = id;
      for (let amount = 0; amount < 12;) {
        const entry = next[current][side];
        current = entry >> 4;
        amount += entry & 15;
        push(current);
      }
    }
  });
  return { next, distance, index };
}

function shifted(ring, amount) {
  return ring.slice(amount).concat(ring.slice(0, amount));
}

function apply(state, turn) {
  if (turn > 0) state.top = shifted(state.top, turn);
  else if (turn < 0) state.bottom = shifted(state.bottom, -turn);
  else {
    const upper = state.top.slice(6), lower = state.bottom.slice(0, 6);
    state.top = state.top.slice(0, 6).concat(lower);
    state.bottom = upper.concat(state.bottom.slice(6));
    state.middle ^= 1;
  }
}

function shapeId(top, bottom, index) {
  let bits = 0, parity = 0;
  const order = [];
  for (const piece of top.concat(bottom)) {
    bits = (bits << 1) | (piece & 1);
    if (order.at(-1) !== piece) {
      for (const earlier of order) parity ^= Number(earlier > piece);
      order.push(piece);
    }
  }
  return index(bits, parity);
}

let shape, square;

export function searchSquare1(top, bottom, middle, report = () => {}) {
  if (!shape || !square) {
    report('Building search tables');
    shape ??= shapeTables();
    square ??= permTables();
  }
  const start = shapeId(top, bottom, shape.index);
  if (start < 0 || shape.distance[start] < 0) throw new Error('The Square-1 shape is invalid.');
  const word = [];
  let split = 0, length = 0, maxFinish = 0;

  function phase2(edge, corner, topEdge, bottomEdge, flip, depth, offset, last) {
    if (!depth) return !topEdge && bottomEdge && edge === 0 && corner === 0 && flip === 0;
    const cost = (permutation, equator = flip) => square.distance[2 * permutation + equator];
    if (last !== 0 && topEdge === bottomEdge) {
      const e = square.slash[edge], c = square.slash[corner];
      if (cost(e, 1 - flip) < depth && cost(c, 1 - flip) < depth) {
        word[offset] = 0;
        if (phase2(e, c, topEdge, bottomEdge, 1 - flip, depth - 1, offset + 1, 0)) return true;
      }
    }
    for (let side = 1; side <= 2; side++) {
      if (last > side - 1) continue;
      const onTop = side === 1, turns = onTop ? square.top : square.bottom;
      let edgeFirst = onTop ? topEdge : bottomEdge;
      let e = edge, c = corner;
      const stop = !onTop && depth > 6 ? 6 : 12;
      for (let amount = 0;;) {
        edgeFirst = !edgeFirst;
        if (edgeFirst) {
          e = turns[e];
          amount += 1;
        } else {
          c = turns[c];
          amount += 2;
        }
        if (amount >= stop || cost(e) > depth || cost(c) > depth) break;
        if (cost(e) >= depth || cost(c) >= depth) continue;
        word[offset] = onTop ? amount : -amount;
        if (phase2(e, c, onTop ? edgeFirst : topEdge, onTop ? bottomEdge : edgeFirst, flip, depth - 1, offset + 1, side)) return true;
      }
    }
    return false;
  }

  function finish(offset) {
    const state = { top, bottom, middle };
    for (let i = 0; i < offset; i++) apply(state, word[i]);
    const rings = [state.top, state.bottom];
    const corners = rings.flatMap(ring => [1, 4, 7, 10].map(i => ring[i] >> 1));
    const edges = rings.flatMap(ring => {
      const first = ring[0] === ring[1] ? 2 : 0;
      return Array.from({ length: 4 }, (_, i) => ring[first + 3 * i] >> 1);
    });
    const edge = rank(edges), corner = rank(corners), flip = state.middle;
    const minimum = Math.max(square.distance[edge * 2 + flip], square.distance[corner * 2 + flip]);
    for (let depth = minimum; depth < maxFinish; depth++) {
      if (!phase2(edge, corner, state.top[0] === state.top[1], state.bottom[0] === state.bottom[1], flip, depth, offset, 0)) continue;
      split = offset;
      length = offset + depth;
      return true;
    }
    return false;
  }

  function phase1(id, depth, offset, last) {
    if (shape.distance[id] === 0 && depth < 4) return depth === 0 && finish(offset);
    if (last !== 0 && shape.distance[shape.next[id][0]] < depth) {
      word[offset] = 0;
      if (phase1(shape.next[id][0], depth - 1, offset + 1, 0)) return true;
    }
    for (let side = 1; side <= 2; side++) {
      if (last > side - 1) continue;
      let current = id;
      for (let amount = 0;;) {
        const entry = shape.next[current][side];
        current = entry >> 4;
        amount += entry & 15;
        if (amount >= (side === 1 ? 12 : 6) || shape.distance[current] > depth) break;
        if (shape.distance[current] >= depth) continue;
        word[offset] = side === 1 ? amount : -amount;
        if (phase1(current, depth - 1, offset + 1, side)) return true;
      }
    }
    return false;
  }

  report('Searching shape and permutation');
  for (let depth = shape.distance[start]; depth < 31; depth++) {
    maxFinish = Math.min(31 - depth, 17);
    if (phase1(start, depth, 0, -1)) return { shape: word.slice(0, split), finish: word.slice(split, length) };
  }
  throw new Error('The Square-1 search could not find a solution.');
}
