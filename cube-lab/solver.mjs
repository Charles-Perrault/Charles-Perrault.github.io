import { solvedColors } from './cube.mjs?v=14';
import { findShortCenterPlan } from './near-centers.mjs?v=14';
import { greedyWhiteMoves } from './greedy-white.mjs?v=11';
import { maxPackedSize, PackedTurns } from './packed-turns.mjs';

const U = 0,
  D = 3,
  F = 2,
  WHITE = 0,
  YELLOW = 3,
  GREEN = 2;
// Signed face normals and local row/column directions in U R F D L B order.
const normal = [
  [1, 1],
  [0, 1],
  [2, 1],
  [1, -1],
  [0, -1],
  [2, -1],
];
const rowAxis = [
  [2, 1],
  [1, -1],
  [1, -1],
  [2, -1],
  [1, -1],
  [1, -1],
];
const colAxis = [
  [0, 1],
  [2, -1],
  [0, 1],
  [0, 1],
  [2, 1],
  [0, -1],
];

const inverse = ({ turns, ...move }) => ({ ...move, turns: turns === 2 ? 2 : -turns });
const inner = (axis, layer, turns) => ({ axis, layer, turns });
const undo = (moves) => [...moves].reverse().map(inverse);
const key = (point) => point.join(',');
const endOf = (move) => move.endLayer ?? move.layer;
const sameSlices = (a, b) => a.axis === b.axis && a.layer === b.layer && endOf(a) === endOf(b);

function appendTurn(list, move) {
  const previous = list.at(-1);
  if (!previous || !sameSlices(previous, move)) {
    list.push(move);
    return;
  }
  const turns = (previous.turns + move.turns + 4) % 4;
  if (turns === 0) list.pop();
  else list[list.length - 1] = { ...move, turns: turns === 3 ? -1 : turns };
}

function rotate(point, axis, turns, last) {
  const result = [...point];
  const a = (axis + 1) % 3,
    b = (axis + 2) % 3;
  result[a] = turns === 2 ? last - point[a] : turns === 1 ? last - point[b] : point[b];
  result[b] = turns === 2 ? last - point[b] : turns === 1 ? point[a] : last - point[a];
  return result;
}

function pointAt(face, row, col, last) {
  const point = [];
  for (const [[axis, sign], value] of [
    [normal[face], last],
    [rowAxis[face], row],
    [colAxis[face], col],
  ]) {
    point[axis] = sign > 0 ? value : last - value;
  }
  return point;
}

function faceAt(point, last) {
  return normal.findIndex(([axis, sign]) => point[axis] === (sign > 0 ? last : 0));
}

function stickerAddress(point, last) {
  const face = faceAt(point, last);
  const [r, rs] = rowAxis[face],
    [c, cs] = colAxis[face];
  return [face, rs > 0 ? point[r] : last - point[r], cs > 0 ? point[c] : last - point[c]];
}

function colorAt(cube, point) {
  return cube.stickerAt(...stickerAddress(point, cube.size - 1));
}

function faceMove(face, turns, last) {
  const [axis, sign] = normal[face];
  return inner(axis, sign > 0 ? last : 0, turns === 2 ? 2 : -sign * turns);
}

function orbit(point, last) {
  const points = [point];
  const seen = new Set([key(point)]);
  for (const current of points) {
    for (let axis = 0; axis < 3; axis++) {
      const next = rotate(current, axis, 1, last);
      const id = key(next);
      if (!seen.has(id)) {
        seen.add(id);
        points.push(next);
      }
    }
  }
  return points;
}

function orientCenters(cube, emit) {
  const last = cube.size - 1,
    mid = Math.floor(last / 2);
  const fixed = normal.map((_, face) => pointAt(face, mid, mid, last));
  const scores = fixed.map((point, face) => {
    const colors = new Uint32Array(6);
    if (cube.size % 2) colors[colorAt(cube, point)]++;
    else
      for (let row = 1; row < last; row++) {
        for (let col = 1; col < last; col++) colors[cube.stickerAt(face, row, col)]++;
      }
    return colors;
  });
  const queue = [{ points: fixed, moves: [] }];
  const seen = new Set();
  let best;
  for (const state of queue) {
    const id = state.points.map(key).join('/');
    if (seen.has(id)) continue;
    seen.add(id);
    const white = scores[state.points.findIndex((point) => faceAt(point, last) === D)][WHITE];
    const green = scores[state.points.findIndex((point) => faceAt(point, last) === F)][GREEN];
    if (!best || white > best.white || (white === best.white && green > best.green)) {
      best = { white, green, moves: state.moves };
    }
    for (let axis = 0; axis < 3; axis++) {
      for (const turns of [-1, 1, 2]) {
        queue.push({
          points: state.points.map((point) => rotate(point, axis, turns, last)),
          moves: [...state.moves, { axis, layer: 0, endLayer: last, turns }],
        });
      }
    }
  }
  emit(best.moves);
}

function colorAfterFaceSetup(cube, point, setup) {
  return colorAt(cube, setup ? rotate(point, setup.axis, inverse(setup).turns, cube.size - 1) : point);
}

function bestBar(cube, col, color) {
  const last = cube.size - 1;
  let best;
  for (const turns of [-1, 1, 2]) {
    const donor = faceAt(rotate(pointAt(F, 1, col, last), 1, inverse({ turns }).turns, last), last);
    for (const setup of [null, ...[-1, 1, 2].map((turn) => faceMove(donor, turn, last))]) {
      let start = 1,
        gain = 0;
      for (let row = 1; row <= last; row++) {
        const sendsWhite =
          row < last &&
          row !== last / 2 &&
          colorAfterFaceSetup(
            cube,
            rotate(pointAt(F, row, col, last), 1, inverse({ turns }).turns, last),
            setup,
          ) === color;
        if (sendsWhite) {
          gain += Number(cube.stickerAt(F, row, col) !== color);
          continue;
        }
        const cost = setup ? 2 : 1;
        if (gain > 0 && (!best || gain * best.cost > best.gain * cost)) {
          const shift = { axis: 1, layer: last - row + 1, endLayer: last - start, turns };
          best = { moves: setup ? [setup, shift] : [shift], gain, cost };
        }
        start = row + 1;
        gain = 0;
      }
    }
  }
  return best;
}

function upperBar(cube, col) {
  const last = cube.size - 1;
  let best;
  for (const turns of [-1, 1, 2]) {
    const setup = faceMove(U, turns, last);
    let gain = 0,
      losesWhite = false;
    for (let row = 1; row < last; row++) {
      const previous = cube.stickerAt(F, row, col) === WHITE;
      const onUpper = rotate(pointAt(F, row, col, last), 0, -1, last);
      const source = rotate(onUpper, setup.axis, inverse(setup).turns, last);
      // The staging slice has temporarily removed this column from U.
      const incoming =
        source[0] === col
          ? colorAt(cube, rotate(source, 0, 1, last)) === WHITE
          : colorAt(cube, source) === WHITE;
      if (previous && !incoming) losesWhite = true;
      if (!previous && incoming) gain++;
    }
    if (!losesWhite && gain > (best?.gain ?? 0)) {
      best = { gain, cost: 3, moves: [inner(0, col, -1), setup, inner(0, col, 1)] };
    }
  }
  return best;
}

function stageBar(cube, col, color) {
  const staged = [];
  while (true) {
    let next = bestBar(cube, col, color);
    const upper = color === WHITE ? upperBar(cube, col) : null;
    if (upper && (!next || upper.gain * next.cost > next.gain * upper.cost)) next = upper;
    if (!next) return staged;
    for (const move of next.moves) cube.apply(move);
    staged.push(...next.moves);
  }
}

function tryBar(cube, col, emit) {
  const last = cube.size - 1;
  if (col === last / 2) return;
  const staged = stageBar(cube, col, WHITE);
  let gainsWhite = false,
    losesWhite = false;
  for (let row = 1; row < last; row++) {
    const down = cube.stickerAt(D, row, col) === WHITE;
    const front = cube.stickerAt(F, row, col) === WHITE;
    if (!down && front) gainsWhite = true;
    if (down && !front) losesWhite = true;
  }
  if (gainsWhite && !losesWhite) {
    emit(staged, true);
    emit([inner(0, col, 1)]);
  } else {
    for (const move of undo(staged)) cube.apply(move);
  }
}

function commutator(a, setup, b) {
  const conjugated = [setup, b, inverse(setup)];
  return [a, ...conjugated, inverse(a), ...undo(conjugated)];
}

function finishWhiteInOneTurn(cube, emit) {
  const last = cube.size - 1;
  let candidateCol;
  let candidateDepth;
  for (let row = 1; row < last; row++) {
    for (let col = 1; col < last; col++) {
      if (cube.stickerAt(D, row, col) === WHITE) continue;
      const depth = last - row;
      if (candidateCol === undefined) {
        candidateCol = col;
        candidateDepth = depth;
      } else {
        if (candidateCol !== col) candidateCol = -1;
        if (candidateDepth !== depth) candidateDepth = -1;
        if (candidateCol < 0 && candidateDepth < 0) return false;
      }
    }
  }
  if (candidateCol === undefined) return true;
  for (const axis of [0, 2]) {
    const layer = axis === 0 ? candidateCol : candidateDepth;
    if (layer < 0) continue;
    for (const turns of [-1, 1, 2]) {
      let allWhite = true;
      for (let index = 1; index < last; index++) {
        const target = axis === 0 ? pointAt(D, index, layer, last) : pointAt(D, last - layer, index, last);
        if (colorAt(cube, rotate(target, axis, inverse({ turns }).turns, last)) !== WHITE) {
          allWhite = false;
          break;
        }
      }
      if (allWhite) {
        emit([inner(axis, layer, turns)]);
        return true;
      }
    }
  }
  return false;
}

function scanWhiteStrip(cube, axis, layer, donorAxis, turns, alignment, choose) {
  const last = cube.size - 1;
  const parallel = donorAxis === axis;
  const reverseTurn = turns === 2 ? 2 : -turns;
  const align = alignment ? [alignment] : [];
  let lineGain = 0;
  let losesWhite = false;
  let gain = 0,
    start = 0,
    end = 0;
  for (let i = 1; i <= last; i++) {
    const point = axis === 0 ? [layer, 0, i] : [i, 0, layer];
    const incoming =
      i < last && colorAfterFaceSetup(cube, rotate(point, donorAxis, reverseTurn, last), alignment) === WHITE;
    const already = i < last && colorAt(cube, point) === WHITE;
    if (already && !incoming) losesWhite = true;
    if (incoming && !already) lineGain++;
    if (incoming && !(layer === last / 2 && i === last / 2)) {
      if (!already) {
        if (!gain) start = i;
        end = i;
        gain++;
      }
    } else {
      if (gain >= 2 && turns !== 2) {
        const strip = { axis: 2 - axis, layer: start, endLayer: end, turns: parallel ? 1 : turns };
        const line = inner(axis, layer, parallel ? turns : 1);
        const first = parallel ? line : strip;
        const second = parallel ? strip : line;
        choose(gain, [...align, first, second, inverse(first), inverse(second)], axis, layer, start, end);
      }
      gain = 0;
    }
  }
  if (parallel && layer !== last / 2 && !losesWhite) {
    choose(lineGain, [...align, inner(axis, layer, turns)], axis, layer, 1, last - 1);
  }
}

export function repairWhiteStrips(cube, emit, passLimit = cube.size - 2) {
  const last = cube.size - 1;
  const width = last - 1;
  const missingOnAxis = [new Uint32Array(cube.size), new Uint32Array(cube.size)];
  let missing = 0;
  for (let row = 1; row < last; row++) {
    for (let col = 1; col < last; col++) {
      if (cube.stickerAt(D, row, col) === WHITE) continue;
      missingOnAxis[0][col]++;
      missingOnAxis[1][last - row]++;
      missing++;
    }
  }
  if (missing > (width * width) / 4) return false;
  const mid = last / 2;
  let setup;
  let transfers = [];
  const flushTransfers = () => {
    if (!setup) return;
    emit([setup, ...transfers, inverse(setup), ...undo(transfers)], true);
    setup = undefined;
    transfers = [];
  };
  // Prefer whole lines on a lightly scrambled cube, then transfer matching portions.
  for (let pass = 0; missing && pass < passLimit; pass++) {
    let best;
    const choose = (gain, moves, axis, layer, start, end) => {
      const minimumGain = pass === 0 ? Math.max(4, Math.ceil(missingOnAxis[axis / 2][layer] * 0.75)) : 1;
      if (gain >= minimumGain && (!best || gain * best.moves.length > best.gain * moves.length)) {
        best = { gain, moves, axis, layer, start, end };
      }
    };
    for (const axis of [0, 2]) {
      for (let layer = 1; layer < last; layer++) {
        if (!missingOnAxis[axis / 2][layer]) continue;
        for (const donorAxis of [axis, 2 - axis]) {
          const parallel = donorAxis === axis;
          for (const turns of parallel ? [-1, 1, 2] : [-1, 1]) {
            const reverseTurn = turns === 2 ? 2 : -turns;
            const sample = axis === 0 ? [layer, 0, 1] : [1, 0, layer];
            const donorFace = faceAt(rotate(sample, donorAxis, reverseTurn, last), last);
            for (const rotation of [0, -1, 1, 2]) {
              const alignment = rotation ? faceMove(donorFace, rotation, last) : null;
              scanWhiteStrip(cube, axis, layer, donorAxis, turns, alignment, choose);
            }
          }
        }
      }
    }
    if (!best) break;
    const { axis, layer, start, end, moves } = best;
    const previous = [];
    for (let i = start; i <= end; i++) {
      previous.push(cube.stickerAt(D, axis === 0 ? last - i : last - layer, axis === 0 ? layer : i));
    }
    for (const move of moves) cube.apply(move);
    if (moves.length === 4) {
      const [first, across] = moves;
      if (
        setup &&
        (!sameSlices(setup, first) ||
          setup.turns !== first.turns ||
          transfers.some((transfer) => across.layer <= endOf(transfer) && transfer.layer <= endOf(across)))
      )
        flushTransfers();
      // A transfer in a disjoint perpendicular slab commutes with the other
      // strip cycles, so they can share the same setup and restore turns.
      setup = first;
      transfers.push(across);
    } else {
      flushTransfers();
      emit(moves, true);
    }
    for (let i = start; i <= end; i++) {
      const col = axis === 0 ? layer : i;
      const depth = axis === 0 ? i : layer;
      const change =
        Number(previous[i - start] === WHITE) - Number(cube.stickerAt(D, last - depth, col) === WHITE);
      missingOnAxis[0][col] += change;
      missingOnAxis[1][depth] += change;
      missing += change;
    }
  }
  flushTransfers();
  return missing === 0;
}

function* rectangleTargets(layouts, last) {
  for (const [width, height] of layouts) {
    for (let x = 1; x + width <= last; x += width) {
      for (let z = 1; z + height <= last; z += height) yield [x, z, width, height];
    }
  }
}

function whiteRectangles(cube, emit, report, candidates) {
  const last = cube.size - 1;
  const whites = new Uint32Array(cube.size);
  for (let col = 1; col < last; col++) {
    for (let row = 1; row < last; row++) whites[col] += Number(cube.stickerAt(D, row, col) === WHITE);
  }
  const alignDonor = whites.reduce((sum, count) => sum + count, 0) >= (last - 1) ** 2 * 0.75;
  const sizes = [];
  for (let span = 2; span * 2 <= last - 1; span *= 2) sizes.unshift(span);
  const layouts = sizes.flatMap((span) => [
    [span * 2, span],
    [span, span * 2],
    [span, span],
  ]);
  const area = candidates ? candidates.reduce((sum, [, , width, height]) => sum + width * height, 0) : layouts.reduce(
    (sum, [width, height]) =>
      sum + Math.floor((last - 1) / width) * Math.floor((last - 1) / height) * width * height,
    0,
  );
  let checked = 0;
  // Widths are powers of two. Refine the search down to 2 × 2 blocks.
  for (const [a, b, width, height] of candidates ?? rectangleTargets(layouts, last)) {
    const direct = directRectangle(cube, whites, a, width, b, height, alignDonor);
    const disjoint = a >= b + height || b >= a + width;
    const setup = disjoint ? bestRectangle(cube, whites, a, width, b, height) : null;
    const choice =
      direct && (!setup || direct.gain * setup.moves.length >= setup.gain * direct.moves.length)
        ? direct
        : setup;
    if (choice) {
      emit(choice.moves);
      for (const [col, delta] of choice.changes) whites[col] += delta;
    }
    checked += width * height;
    report(checked / area);
  }
}

function directRectangle(cube, whites, x, width, z, height, alignDonor = false) {
  const last = cube.size - 1;
  const mid = last / 2;
  if (cube.size % 2 && x <= mid && mid < x + width && z <= mid && mid < z + height) return null;
  let best;
  // Perpendicular inner slabs meet on D and U. Their four-turn commutator cycles
  // the D rectangle with one region on each of two side faces.
  for (const [axis, start, end] of [
    [0, x, x + width - 1],
    [2, z, z + height - 1],
  ]) {
    for (const turns of [-1, 1]) {
      const donorFace = faceAt(rotate([x, 0, z], axis, -turns, last), last);
      const rotations = alignDonor ? [0, -1, 1, 2] : [0];
      for (const rotation of rotations) {
        const alignment = rotation ? faceMove(donorFace, rotation, last) : null;
        const changes = new Map();
        let gain = 0,
          incoming = 0,
          losesCompleted = false;
        for (let col = x; col < x + width && !losesCompleted; col++) {
          for (let depth = z; depth < z + height; depth++) {
            const source = rotate([col, 0, depth], axis, -turns, last);
            const from = Number(colorAfterFaceSetup(cube, source, alignment) === WHITE);
            const to = Number(cube.stickerAt(D, last - depth, col) === WHITE);
            if (whites?.[col] === last - 1 && from < to) {
              losesCompleted = true;
              break;
            }
            incoming += from;
            gain += from - to;
            changes.set(col, (changes.get(col) ?? 0) + from - to);
          }
        }
        const cost = alignment ? 5 : 4;
        const minimumGain = whites ? Math.ceil(cost / 2) : 1;
        if (
          losesCompleted ||
          incoming * 2 <= width * height ||
          gain < minimumGain ||
          (best &&
            (whites
              ? gain * best.moves.length <= best.gain * cost
              : gain < best.gain || (gain === best.gain && cost >= best.moves.length)))
        )
          continue;
        const donor = { axis, layer: start, endLayer: end, turns };
        const across =
          axis === 0
            ? { axis: 2, layer: z, endLayer: z + height - 1, turns: 1 }
            : { axis: 0, layer: x, endLayer: x + width - 1, turns: 1 };
        const moves = [donor, across, inverse(donor), inverse(across)];
        if (alignment) moves.unshift(alignment);
        best = { gain, changes, moves };
      }
    }
  }
  return best;
}

function bestRectangle(cube, whites, a, width, b, height) {
  const last = cube.size - 1;
  let best;
  for (let face = 0; face < 6; face++) {
    const faceAxis = normal[face][0];
    for (const axis of [0, 1, 2]) {
      if (axis === faceAxis) continue;
      // With a horizontal slice, only the setup face can be D.
      if (axis === 1 && face !== D) continue;
      const across = 3 - axis - faceAxis;
      for (const sign of [-1, 1]) {
        const setup = faceMove(face, sign, last);
        const origin = pointAt(face, 1, 1, last);
        origin[axis] = a;
        origin[across] = 0;
        const mirrored = rotate(origin, setup.axis, setup.turns, last)[axis] === last;
        origin[across] = mirrored ? last - b : b;
        for (const aTurn of [-1, 1]) {
          for (const bTurn of [-1, 1]) {
            const cycle = (point) => [
              point,
              rotate(rotate(point, setup.axis, setup.turns, last), axis, -bTurn, last),
              rotate(point, axis, -aTurn, last),
            ];
            const destinations = cycle(origin).map((point) => faceAt(point, last));
            const target = destinations.indexOf(D);
            if (target < 0 || destinations.lastIndexOf(D) !== target) continue;
            for (const direction of [1, -1]) {
              const donor = (target - direction + 3) % 3;
              const changes = new Map();
              let gain = 0,
                incoming = 0,
                losesCompleted = false;
              const point = [...origin];
              for (let x = 0; x < width && !losesCompleted; x++) {
                point[axis] = a + x;
                for (let y = 0; y < height; y++) {
                  point[across] = origin[across] + (mirrored ? -y : y);
                  const positions = cycle(point);
                  const from = Number(colorAt(cube, positions[donor]) === WHITE);
                  const to = Number(colorAt(cube, positions[target]) === WHITE);
                  const col = positions[target][0];
                  if (whites[col] === last - 1 && from < to) {
                    losesCompleted = true;
                    break;
                  }
                  incoming += from;
                  gain += from - to;
                  changes.set(col, (changes.get(col) ?? 0) + from - to);
                }
              }
              if (losesCompleted || incoming * 2 <= width * height || gain < 4 || gain <= (best?.gain ?? 0))
                continue;
              const moves = commutator({ axis, layer: a, endLayer: a + width - 1, turns: aTurn }, setup, {
                axis,
                layer: b,
                endLayer: b + height - 1,
                turns: bTurn,
              });
              best = { gain, changes, moves: direction === 1 ? moves : undo(moves) };
            }
          }
        }
      }
    }
  }
  return best;
}

function incomingCycles(target, last, protectedFaces) {
  const incoming = new Map();
  const targetId = key(target);
  const connect = (from, to, moves, cycle) => {
    const id = key(to);
    if (!incoming.has(id)) incoming.set(id, []);
    incoming.get(id).push({ from, moves, cycle });
  };

  for (const intersection of orbit(target, last)) {
    const face = faceAt(intersection, last);
    for (let axis = 0; axis < 3; axis++) {
      if (axis === normal[face][0]) continue;
      const layer = intersection[axis];
      for (const setupTurn of [-1, 1]) {
        const setup = faceMove(face, setupTurn, last);
        const aligned = rotate(intersection, setup.axis, setup.turns, last);
        const otherLayer = aligned[axis];
        if (otherLayer === layer) continue;
        for (const aTurn of [-1, 1]) {
          for (const bTurn of [-1, 1]) {
            const a = inner(axis, layer, aTurn);
            const b = inner(axis, otherLayer, bTurn);
            const aSource = rotate(intersection, axis, -aTurn, last);
            const bSource = rotate(aligned, axis, -bTurn, last);
            const cycle = [intersection, bSource, aSource];
            if (cycle.some((p) => protectedFaces.includes(faceAt(p, last)) && key(p) !== targetId)) continue;
            // Parallel inner slices meet once after conjugating one by the face turn.
            const moves = commutator(a, setup, b);
            const reversed = undo(moves);
            const reverseCycle = [...cycle].reverse();
            for (let i = 0; i < 3; i++) {
              const from = cycle[i],
                to = cycle[(i + 1) % 3];
              connect(from, to, moves, cycle);
              connect(to, from, reversed, reverseCycle);
            }
          }
        }
      }
    }
  }
  return incoming;
}

function insertionPaths(target, last, protectedFaces, alignDonors) {
  const incoming = incomingCycles(target, last, protectedFaces);
  const queue = [{ point: target, steps: [] }];
  const seen = new Set([key(target)]);
  for (const { point, steps } of queue) {
    const edges = [...(incoming.get(key(point)) ?? [])];
    const face = faceAt(point, last);
    if (alignDonors && !protectedFaces.includes(face)) {
      for (const turns of [-1, 1, 2]) {
        const move = faceMove(face, turns, last);
        edges.push({ from: rotate(point, move.axis, -move.turns, last), moves: [move] });
      }
    }
    for (const edge of edges) {
      const id = key(edge.from);
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push({ point: edge.from, steps: [edge, ...steps] });
    }
  }
  return queue;
}

const insertionTemplates = new Map();

function fillSpot(cube, target, color, protectedFaces, emit, alignDonors, simulateCycles) {
  const last = cube.size - 1;
  // Center commutators depend only on coordinate equality and reflection.
  // Reuse the same insertion paths at every depth with the same geometry.
  const layers = [...new Set([0, last, ...target, ...target.map((value) => last - value)])].sort((a, b) => a - b);
  const canonical = target.map((value) => layers.indexOf(value));
  const id = JSON.stringify([layers.length, canonical, protectedFaces, alignDonors]);
  let paths = insertionTemplates.get(id);
  if (!paths) {
    paths = insertionPaths(canonical, layers.length - 1, protectedFaces, alignDonors);
    insertionTemplates.set(id, paths);
  }
  const expand = (point) => point.map((value) => layers[value]);
  for (const { point, steps } of paths) {
    if (colorAt(cube, expand(point)) === color) {
      for (const { moves, cycle } of steps) {
        const applied = Boolean(simulateCycles && cycle);
        if (applied) cube.cycleCenterStickers(cycle.map((p) => stickerAddress(expand(p), last)));
        emit(moves.map((move) => ({ ...move, layer: layers[move.layer] })), applied);
      }
      return;
    }
  }
  throw new Error('Could not place a compatible center.');
}

function whiteCenter(cube, emit, report, candidates) {
  orientCenters(cube, emit);
  const last = cube.size - 1;
  if (finishWhiteInOneTurn(cube, emit)) return;
  const short = findShortCenterPlan(cube, false);
  if (short) {
    emit(short.moves);
    if (short.complete || finishWhiteInOneTurn(cube, emit)) return;
  }
  if (repairWhiteStrips(cube, emit)) return;
  const rectangleShare = last >= 5 ? 0.35 : 0;
  whiteRectangles(cube, emit, (fraction) => report(fraction * rectangleShare), candidates);
  for (let col = 1; col < last; col++) {
    if (!columnSolved(cube, D, col, WHITE)) {
      tryBar(cube, col, emit);
      fillColumn(cube, D, col, WHITE, [D], emit);
    }
    report(rectangleShare + ((0.99 - rectangleShare) * col) / (last - 1));
  }
}

function sweepWhiteRuns(cube, emit, report) {
  const last = cube.size - 1;
  let totalGain = 0;
  for (const axis of [0, 2]) {
    const across = 2 - axis;
    const point = [0, 0, 0];
    for (let layer = 1; layer < last; layer++) {
      point[axis] = layer;
      for (const turns of [-1, 1]) {
        const donor = inner(axis, layer, turns);
        const ranges = [];
        let start = 0;
        let end = 0;
        let gain = 0;
        for (let index = 1; index <= last; index++) {
          point[across] = index;
          const fixed = layer === last / 2 && index === last / 2;
          const white = index < last && colorAt(cube, point) === WHITE;
          const incoming = index < last && !fixed && colorAt(cube, rotate(point, axis, -turns, last)) === WHITE;
          if (index === last || fixed || (white && !incoming)) {
            if (gain >= 2) {
              ranges.push({ axis: across, layer: start, endLayer: end, turns: 1 });
              totalGain += gain;
            }
            gain = 0;
          } else if (incoming && !white) {
            if (!gain) start = index;
            end = index;
            gain++;
          }
        }
        if (ranges.length) emit([donor, ...ranges, inverse(donor), ...undo(ranges)]);
      }
      report((axis / 2 + layer / (last - 1)) / 2);
    }
  }
  return totalGain;
}

function fastWhiteCenter(cube, emit, report) {
  orientCenters(cube, emit);
  if (finishWhiteInOneTurn(cube, emit)) return;
  const short = findShortCenterPlan(cube, false);
  if (short) {
    emit(short.moves);
    if (short.complete || finishWhiteInOneTurn(cube, emit)) return;
  }
  if (repairWhiteStrips(cube, emit, 2)) return;
  for (const move of greedyWhiteMoves(cube, { keepFixedCenters: true })) emit([move]);
  if (cube.hasSolvedCenters([D])) return;
  const firstSweepGain = sweepWhiteRuns(cube, emit, (fraction) => report(fraction * 0.1));
  if (firstSweepGain >= (cube.size - 2) ** 2 / 160) {
    sweepWhiteRuns(cube, emit, (fraction) => report(0.1 + fraction * 0.1));
  }
  const last = cube.size - 1;
  for (let col = 1; col < last; col++) {
    fillColumn(cube, D, col, WHITE, [D], emit, true, true);
    report(0.2 + (0.79 * col) / (last - 1));
  }
}

function centerRunRecipes(face, axis, protectedFaces, last) {
  const recipes = [];
  for (const sign of [-1, 1]) {
    const setup = faceMove(face, sign, last);
    for (const aTurn of [-1, 1]) {
      for (const bTurn of [-1, 1]) {
        const positions = (point) => [
          point,
          rotate(rotate(point, setup.axis, setup.turns, last), axis, -bTurn, last),
          rotate(point, axis, -aTurn, last),
        ];
        const [, first, second] = positions(pointAt(face, 1, 1, last));
        if ([first, second].some((point) => protectedFaces.includes(faceAt(point, last)))) continue;
        for (const donor of [1, 2]) {
          recipes.push({ setup, aTurn, bTurn, donor, positions });
        }
      }
    }
  }
  return recipes;
}

function sweepCenterRuns(cube, face, protectedFaces, emit) {
  const last = cube.size - 1;
  if (last < 3) return 0;
  const color = solvedColors[face];
  const faceAxis = normal[face][0];
  let totalGain = 0;
  for (const axis of [rowAxis[face][0], colAxis[face][0]]) {
    const across = 3 - axis - faceAxis;
    const recipes = centerRunRecipes(face, axis, protectedFaces, last);
    if (!recipes.length) continue;
    const point = pointAt(face, 1, 1, last);
    for (let layer = 1; layer < last; layer++) {
      point[axis] = layer;
      let best;
      for (const recipe of recipes) {
        const { setup, donor, positions } = recipe;
        point[across] = 0;
        const mirrored = rotate(point, setup.axis, setup.turns, last)[axis] === last;
        point[across] = 1;
        const [targetFace, row, col] = stickerAddress(point, last);
        const [sourceFace, sourceRow, sourceCol] = stickerAddress(positions(point)[donor], last);
        point[across] = 2;
        const [, nextRow, nextCol] = stickerAddress(point, last);
        const [, donorRow, donorCol] = stickerAddress(positions(point)[donor], last);
        const rowStep = nextRow - row, colStep = nextCol - col;
        const sourceRowStep = donorRow - sourceRow, sourceColStep = donorCol - sourceCol;
        const ranges = [];
        let start = 0, end = 0, runGain = 0, gain = 0;
        for (let index = 1; index <= last; index++) {
          const alignment = mirrored ? last - index : index;
          const excluded = index === last || layer === alignment;
          const offset = index - 1;
          const previous = !excluded && cube.stickerAt(targetFace, row + offset * rowStep, col + offset * colStep) === color;
          const incoming = !excluded && cube.stickerAt(sourceFace,
            sourceRow + offset * sourceRowStep, sourceCol + offset * sourceColStep) === color;
          if (excluded || (previous && !incoming)) {
            if (runGain) {
              ranges.push([start, end]);
              gain += runGain;
              runGain = 0;
            }
          } else if (incoming && !previous) {
            if (!runGain) start = index;
            end = index;
            runGain++;
          }
        }
        const cost = 6 + ranges.length * 2;
        if (gain * 6 >= cost && (!best || gain * best.cost > best.gain * cost)) {
          best = { recipe, ranges, mirrored, gain, cost };
        }
      }
      if (!best) continue;
      const { recipe, ranges, mirrored } = best;
      totalGain += best.gain;
      const { setup, aTurn, bTurn, donor, positions } = recipe;
      const a = inner(axis, layer, aTurn);
      const b = ranges.map(([start, end]) => ({
        axis, layer: mirrored ? last - end : start, endLayer: mirrored ? last - start : end, turns: bTurn,
      }));
      const joined = [setup, ...b, inverse(setup)];
      const moves = [a, ...joined, inverse(a), ...undo(joined)];
      // The conjugated slabs intersect the setup slice at disjoint center stickers.
      // Record the physical commutator while simulating only its affected cycles.
      for (const [start, end] of ranges) {
        for (let index = start; index <= end; index++) {
          point[across] = index;
          const cycle = positions(point);
          if (donor === 1) cycle.reverse();
          cube.cycleCenterStickers(cycle.map((p) => stickerAddress(p, last)));
        }
      }
      emit(donor === 1 ? undo(moves) : moves, true);
    }
  }
  return totalGain;
}

function fillCenterRuns(cube, face, protectedFaces, emit, report) {
  const maxPasses = 6;
  const minimumGain = Math.max(1, Math.floor((cube.size - 2) ** 2 / 160));
  for (let pass = 0; pass < maxPasses; pass++) {
    const gain = sweepCenterRuns(cube, face, protectedFaces, emit);
    report((pass + 1) / maxPasses);
    if (gain < minimumGain) break;
  }
}

function columnSolved(cube, face, col, color) {
  for (let row = 1; row < cube.size - 1; row++) {
    if (cube.stickerAt(face, row, col) !== color) return false;
  }
  return true;
}

function fillColumn(cube, face, col, color, protectedFaces, emit, alignDonors = false, simulateCycles = false) {
  const last = cube.size - 1;
  for (let row = 1; row < last; row++) {
    if (cube.stickerAt(face, row, col) === color) continue;
    fillSpot(cube, pointAt(face, row, col, last), color, protectedFaces, emit, alignDonors, simulateCycles);
    if (cube.stickerAt(face, row, col) !== color) throw new Error('Center placement did not land.');
  }
}

function tryYellowBar(cube, col, emit, stage = true) {
  const last = cube.size - 1;
  const stagedCol = last - col;
  const staged = stage ? stageBar(cube, stagedCol, YELLOW) : [];
  let complete = true;
  for (let row = 1; row < last; row++) {
    if (col === last / 2 && row === last / 2) continue;
    if (cube.stickerAt(F, row, stagedCol) !== YELLOW) {
      complete = false;
      break;
    }
  }
  if (!complete) {
    for (const move of undo(staged)) cube.apply(move);
    return;
  }
  emit(staged, true);
  if (col === last / 2) emit([faceMove(U, 1, last)]);
  emit([inner(0, stagedCol, -1), faceMove(U, col === last / 2 ? 1 : 2, last), inner(0, stagedCol, 1)]);
}

function yellowCenter(cube, emit, report, stageBars = true) {
  const short = findShortCenterPlan(cube, true);
  if (short?.complete) {
    emit(short.moves);
    return;
  }
  const last = cube.size - 1;
  const runShare = stageBars ? 0 : 0.25;
  if (!stageBars) fillCenterRuns(cube, U, [D, U], emit, (fraction) => report(fraction * runShare));
  let checked = 0;
  for (let col = 1; col < last / 2; col++) {
    for (const target of [col, last - col]) {
      if (!columnSolved(cube, U, target, YELLOW)) {
        tryYellowBar(cube, target, emit, stageBars);
        fillColumn(cube, U, target, YELLOW, [D, U], emit, !stageBars, !stageBars);
      }
      checked++;
      report(runShare + ((0.99 - runShare) * checked) / (last - 1));
    }
  }
  if (cube.size % 2 && !columnSolved(cube, U, last / 2, YELLOW)) {
    tryYellowBar(cube, last / 2, emit, stageBars);
    fillColumn(cube, U, last / 2, YELLOW, [D, U], emit, !stageBars, !stageBars);
  }
}

export function orientWhitePlanningCube(cube) {
  const moves = [];
  orientCenters(cube, (sequence) => {
    for (const move of sequence) cube.apply(move);
    moves.push(...sequence);
  });
  return moves;
}

export function solveWhiteCenter(source, onProgress, candidates, onMove) {
  return solveCenters(source, 'white', onProgress, candidates, onMove);
}

export function solveYellowCenter(source, onProgress, candidates, onMove) {
  return solveCenters(source, 'yellow', onProgress, candidates, onMove);
}

export function solveAllCenters(source, onProgress, candidates, onMove) {
  return solveCenters(source, 'all', onProgress, candidates, onMove);
}

export function planAllCentersInPlace(cube, onProgress, candidates, onMove) {
  return solveCentersInPlace(cube, 'all', onProgress, candidates, undefined, onMove);
}

const fastCenterStrategy = { white: fastWhiteCenter, stageYellowBars: false };

export function planFastCentersInPlace(cube, onProgress, candidates, onMove) {
  return solveCentersInPlace(cube, 'all', onProgress, undefined, fastCenterStrategy, onMove);
}

export function solveWhiteCenterFast(source, onProgress) {
  return solveCentersInPlace(source.clone(), 'white', onProgress, undefined, fastCenterStrategy);
}

export function solveWhiteBlocks(source, onProgress, candidates, onMove) {
  return solveCenters(source, 'blocks', onProgress, undefined, onMove);
}

function upperBlock(cube, { x, width, z, height, whites }) {
  const last = cube.size - 1;
  const area = width * height;
  let best;
  for (const axis of [0, 2]) {
    const across = 2 - axis;
    const aStart = axis === 0 ? x : z;
    const aEnd = aStart + (axis === 0 ? width : height) - 1;
    const first = [x, 0, z];
    const opposite = [x + width - 1, 0, z + height - 1];
    for (const turns of [-1, 1]) {
      const a = { axis, layer: aStart, endLayer: aEnd, turns };
      const side = faceAt(rotate(first, axis, turns, last), last);
      for (const turn of [-1, 1]) {
        const setup = faceMove(side, turn, last);
        const crossPosition = (point) =>
          rotate(rotate(point, axis, turns, last), setup.axis, setup.turns, last);
        const bStart = crossPosition(first)[axis],
          bEnd = crossPosition(opposite)[axis];
        const b = { axis, layer: Math.min(bStart, bEnd), endLayer: Math.max(bStart, bEnd), turns: -turns };
        if (aStart <= b.endLayer && b.layer <= aEnd) continue;
        for (const alignment of [null, ...[-1, 1, 2].map((rotation) => faceMove(U, rotation, last))]) {
          let incoming = 0;
          for (let col = x; col < x + width; col++) {
            for (let depth = z; depth < z + height; depth++) {
              const source = rotate(crossPosition([col, 0, depth]), axis, -b.turns, last);
              incoming += Number(colorAfterFaceSetup(cube, source, alignment) === WHITE);
            }
          }
          if (incoming <= whites || incoming * 2 <= area || incoming <= (best?.incoming ?? 0)) continue;
          const moves = commutator(a, setup, b);
          if (alignment) moves.unshift(alignment);
          best = { incoming, gain: incoming - whites, moves };
        }
      }
    }
  }
  return best;
}

function bestBlock(cube, block) {
  const { x, width, z, height, whites } = block;
  const side = directRectangle(cube, null, x, width, z, height, true);
  if (side?.gain === width * height - whites) return side;
  const upper = upperBlock(cube, block);
  return upper && (!side || upper.gain > side.gain) ? upper : side;
}

function whiteBlocks(cube, emit, report) {
  orientCenters(cube, emit);
  const last = cube.size - 1;
  const total = (last - 1) ** 2;
  let solved = 0;
  let pending = [{ x: 1, width: last - 1, z: 1, height: last - 1 }];
  while (pending.length) {
    for (const block of pending) {
      const { x, width, z, height } = block;
      block.area = width * height;
      block.whites = 0;
      for (let col = x; col < x + width; col++) {
        for (let depth = z; depth < z + height; depth++) {
          block.whites += Number(cube.stickerAt(D, last - depth, col) === WHITE);
        }
      }
      if (block.whites < block.area && block.area > 1) block.swap = bestBlock(cube, block);
    }
    const revision = cube.revision;
    const hasLargerBlocks = pending.some((block) => block.area > 1 && block.whites < block.area);
    // All blocks at this scale compete before any region is split further.
    pending.sort(
      (a, b) =>
        a.whites / a.area - b.whites / b.area ||
        (b.whites + (b.swap?.gain ?? 0)) / b.area - (a.whites + (a.swap?.gain ?? 0)) / a.area,
    );
    const next = [];
    for (const block of pending) {
      const { x, width, z, height, area } = block;
      if (area === 1 && !block.whites && hasLargerBlocks) {
        next.push(block);
        continue;
      }
      if (block.whites < area && area > 1) {
        const swap = cube.revision === revision ? block.swap : bestBlock(cube, block);
        if (swap) {
          emit(swap.moves);
          block.whites += swap.gain;
        }
      }
      if (block.whites === area || area === 1) {
        if (!block.whites) fillSpot(cube, [x, 0, z], WHITE, [D], emit);
        solved += area;
        report((0.99 * solved) / total);
      } else if (width >= height) {
        const left = Math.floor(width / 2);
        next.push({ x, width: left, z, height }, { x: x + left, width: width - left, z, height });
      } else {
        const first = Math.floor(height / 2);
        next.push({ x, width, z, height: first }, { x, width, z: z + first, height: height - first });
      }
    }
    pending = next;
  }
}

function solveCenters(source, mode, onProgress, candidates, onMove) {
  return solveCentersInPlace(source.clone(), mode, onProgress, candidates, undefined, onMove);
}

function solveCentersInPlace(cube, mode, onProgress = () => {}, candidates, strategy, onMove = () => {}) {
  const { size } = cube;
  if (size === 2) return [];
  onProgress('white', 0);
  const packed = strategy && size <= maxPackedSize;
  const moves = packed ? new PackedTurns() : [];
  const record = packed ? (move) => moves.append(move) : (move) => appendTurn(moves, move);
  const emit = (sequence, alreadyApplied = false) => {
    for (const move of sequence) {
      if (!alreadyApplied) cube.apply(move);
      record(move);
      onMove(move);
    }
  };
  // An already white D is the preferred orientation when continuing to yellow.
  const solveWhite = mode === 'blocks' ? whiteBlocks : strategy?.white ?? whiteCenter;
  solveWhite(cube, emit, (fraction) => onProgress('white', fraction), candidates);
  const includeYellow = mode === 'yellow' || mode === 'all';
  let whiteMoves = [];
  if (includeYellow) {
    if (!packed) whiteMoves = moves.splice(0);
    onProgress('yellow', 0);
    yellowCenter(cube, emit, (fraction) => onProgress('yellow', fraction), strategy?.stageYellowBars);
  }
  const completed = includeYellow ? [D, U] : [D];
  if (mode === 'all') {
    // Match RubiksProgram's five-face order. Red follows from the remaining stickers.
    for (const [face, phase] of [[5, 'blue'], [1, 'orange'], [F, 'green']]) {
      completed.push(face);
      onProgress(phase, 0);
      const runShare = strategy ? 0.25 : 0;
      if (strategy) fillCenterRuns(cube, face, completed, emit, (fraction) => onProgress(phase, fraction * runShare));
      for (let col = 1; col < size - 1; col++) {
        fillColumn(cube, face, col, solvedColors[face], completed, emit, true, Boolean(strategy));
        onProgress(phase, runShare + ((1 - runShare) * col) / (size - 2));
      }
    }
    completed.push(4);
  }
  if (!cube.hasSolvedCenters(completed)) throw new Error('Center solution verification failed.');
  return packed ? moves : whiteMoves.concat(moves);
}
