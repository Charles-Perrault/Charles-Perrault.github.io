import { Cube, faceCoordinates, solvedColors } from './cube.mjs?v=14';

function copyCube(cube) {
  return new Cube(
    cube.size,
    cube.faces.map((face) => face.slice()),
    cube.orientations.slice(),
  );
}

function centerMatches(cube) {
  const counts = new Uint32Array(6);
  for (let face = 0; face < 6; face++) {
    for (let row = 1; row < cube.size - 1; row++) {
      for (let col = 1; col < cube.size - 1; col++) {
        counts[face] += Number(cube.stickerAt(face, row, col) === solvedColors[face]);
      }
    }
  }
  return counts;
}

function goalReached(cube, includeYellow) {
  const mid = Math.floor(cube.size / 2);
  if (cube.size % 2 && cube.stickerAt(2, mid, mid) !== solvedColors[2]) return false;
  for (let row = 1; row < cube.size - 1; row++) {
    for (let col = 1; col < cube.size - 1; col++) {
      if (cube.stickerAt(3, row, col) !== solvedColors[3]) return false;
      if (includeYellow && cube.stickerAt(0, row, col) !== solvedColors[0]) return false;
    }
  }
  return true;
}

function candidateTurns(state) {
  const { cube, score, moves } = state;
  const last = cube.size - 1;
  const prior = moves.at(-1);
  const candidates = [];
  const counts = new Uint32Array(24);
  for (let axis = 0; axis < 3; axis++) {
    // Reuse the cube's orientation-aware strip addresses. Only the interior
    // stickers on these four strips can change the center score.
    const { strips, negativeFace, positiveFace } = cube.cycles[axis];
    const logical = strips.map(({ face, byOrientation }) => byOrientation[cube.orientations[face]]);
    for (let layer = 1; layer < last; layer++) {
      if (prior?.axis === axis && prior.layer === layer) continue;
      counts.fill(0);
      let before = 0;
      for (let side = 0; side < 4; side++) {
        const { face, base, layerStride, stripStride } = logical[side];
        const stickers = cube.faces[face];
        const offset = 6 * side;
        let index = base + layerStride * layer + stripStride;
        for (let i = 1; i < last; i++, index += stripStride) counts[offset + stickers[index]]++;
        before += counts[offset + solvedColors[face]];
      }
      if (before === 4 * (last - 1)) continue;
      for (const turns of [1, -1, 2]) {
        let after = 0;
        let evidence = 0;
        for (let side = 0; side < 4; side++) {
          const target = logical[(side + turns + 4) % 4].face;
          const matching = counts[6 * side + solvedColors[target]];
          after += matching;
          if (matching >= (last - 1) * 0.65) evidence++;
        }
        if (after - before < -8 && evidence < 2) continue;
        candidates.push({ state, score: score + after - before, axis, layer, turns, priority: 0, evidence });
      }
    }
    for (const [face, layer] of [
      [negativeFace, 0],
      [positiveFace, last],
    ]) {
      if ((prior?.axis === axis && prior.layer === layer) || state.matches[face] === (last - 1) ** 2)
        continue;
      // A face turn preserves its color count but can line up the next slice.
      for (const turns of [1, -1, 2]) {
        candidates.push({
          state,
          score,
          axis,
          layer,
          turns,
          priority: (last - 1) ** 2 - state.matches[face],
        });
      }
    }
  }
  return candidates;
}

function centerStateKey(cube) {
  let hash = 2166136261;
  let second = 0;
  for (let face = 0; face < 6; face++) {
    for (let row = 1; row < cube.size - 1; row++) {
      for (let col = 1; col < cube.size - 1; col++) {
        const color = cube.stickerAt(face, row, col);
        hash = Math.imul(hash ^ color, 16777619);
        second = (Math.imul(second, 31) + color) | 0;
      }
    }
  }
  return hash + '/' + second;
}

function unsupportedFaces(cube, active, ignored) {
  const last = cube.size - 1;
  let wrong = 0;
  for (let face = 0; face < 6; face++) {
    if (ignored & (1 << face)) continue;
    const { row, col } = faceCoordinates[face];
    const rowAxis = row.findIndex(Boolean),
      colAxis = col.findIndex(Boolean);
    outer: for (let r = 1; r < last; r++) {
      if (active[rowAxis][row[rowAxis] > 0 ? r : last - r]) continue;
      for (let c = 1; c < last; c++) {
        if (active[colAxis][col[colAxis] > 0 ? c : last - c]) continue;
        if (cube.stickerAt(face, r, c) === solvedColors[face]) continue;
        wrong |= 1 << face;
        break outer;
      }
    }
  }
  return wrong;
}

function reverseTurn(move) {
  return { ...move, turns: move.turns === 2 ? 2 : -move.turns };
}

function detectSparseTurns(source, matches, score) {
  const active = Array.from({ length: 3 }, () => new Uint8Array(source.size));
  const layers = [];
  const candidates = candidateTurns({ cube: source, matches, score, moves: [] });
  candidates.sort((a, b) => (b.evidence ?? 0) - (a.evidence ?? 0) || b.score - a.score);
  for (const { axis, layer, turns, evidence } of candidates) {
    if (!evidence || evidence < 2) break;
    if (active[axis][layer]) continue;
    active[axis][layer] = 1;
    layers.push({ axis, layer, turns });
  }
  if (layers.length < 4 || layers.length > 14) return null;
  // Wide turns leave runs of parallel lanes. The block and bar passes can
  // handle those as single moves instead of peeling them off one at a time.
  for (const axis of active) {
    let run = 0;
    for (const marked of axis) {
      run = marked ? run + 1 : 0;
      if (run >= 4) return null;
    }
  }
  return { active, layers };
}

function orderSparseTurns(source, { active, layers }, includeYellow, deadline) {
  const unknown = unsupportedFaces(source, active, 0);
  // A face turn can leave some marks off the detected strips on that face.
  const faces = faceCoordinates.filter((_, face) => unknown & (1 << face));
  if (faces.length > 2) return null;
  const cube = copyCube(source);
  const moves = [];
  let attempts = 0;
  const dead = new Set();

  function visit(ignored) {
    if (goalReached(cube, includeYellow)) return true;
    if (++attempts > 500 || moves.length >= 14 || performance.now() >= deadline) return false;
    const id = centerStateKey(cube) + '/' + ignored;
    if (dead.has(id)) return false;
    for (let face = 0; face < 6; face++) {
      const mask = 1 << face;
      if (!(ignored & mask)) continue;
      const normal = faceCoordinates[face].normal;
      const axis = normal.findIndex(Boolean);
      const layer = normal[axis] > 0 ? cube.size - 1 : 0;
      for (const turns of [-1, 1, 2]) {
        const move = { axis, layer, turns };
        cube.apply(move);
        moves.push(move);
        if (!unsupportedFaces(cube, active, ignored ^ mask) && visit(ignored ^ mask)) return true;
        moves.pop();
        cube.apply(reverseTurn(move));
      }
    }
    for (const move of layers) {
      const { axis, layer } = move;
      if (!active[axis][layer]) continue;
      active[axis][layer] = 0;
      cube.apply(move);
      moves.push(move);
      // Stickers outside all remaining slices must already be in place.
      if (!unsupportedFaces(cube, active, ignored) && visit(ignored)) return true;
      moves.pop();
      cube.apply(reverseTurn(move));
      active[axis][layer] = 1;
    }
    dead.add(id);
    return false;
  }

  return visit(unknown) ? moves : null;
}

export function findShortCenterPlan(cube, includeYellow) {
  if (goalReached(cube, includeYellow)) return { moves: [], complete: true };
  const size = cube.size;
  const matches = centerMatches(cube);
  const correct = matches.reduce((sum, count) => sum + count, 0);
  const width = size - 2;
  const total = 6 * width * width;
  if (total - correct > Math.min(total / 3, 56 * width)) return null;
  const deadline = performance.now() + 2000;
  const detected = detectSparseTurns(cube, matches, correct);
  if (!detected) return null;
  const sparse = orderSparseTurns(cube, detected, includeYellow, Math.min(deadline, performance.now() + 750));
  if (sparse) return { moves: sparse, complete: true };

  // Bound the memory and depth of the search. Its estimate only chooses which
  // states to explore. A candidate succeeds only after checking the stickers.
  const beamWidth = Math.max(1, Math.min(12, Math.floor(6_000_000 / (6 * size * size))));
  let beam = [{ cube, matches, score: correct, moves: [] }];
  let best = beam[0];
  const seen = new Set([centerStateKey(cube)]);
  for (let depth = 0; depth < 14 && beam.length && performance.now() < deadline; depth++) {
    const candidates = beam.flatMap(candidateTurns);
    candidates.sort((a, b) => b.score - a.score || b.priority - a.priority);
    const next = [];
    for (const { state, score, axis, layer, turns } of candidates) {
      if (performance.now() >= deadline) break;
      const child = copyCube(state.cube);
      const move = { axis, layer, turns };
      child.apply(move);
      const id = centerStateKey(child);
      if (seen.has(id)) continue;
      seen.add(id);
      const moves = [...state.moves, move];
      if (goalReached(child, includeYellow)) return { moves, complete: true };
      const stateAfter = { cube: child, score, moves, matches: centerMatches(child) };
      next.push(stateAfter);
      if (score > best.score) best = stateAfter;
      if (next.length === beamWidth) break;
    }
    beam = next;
  }
  const mid = Math.floor(size / 2);
  const fixedAligned =
    size % 2 === 0 || [0, 2, 3].every((face) => best.cube.stickerAt(face, mid, mid) === solvedColors[face]);
  if (
    fixedAligned &&
    best.score - correct >= (total - correct) * 0.7 &&
    best.matches[3] > matches[3] &&
    (!includeYellow || best.matches[0] >= matches[0])
  )
    return { moves: best.moves, complete: false };
  return null;
}
