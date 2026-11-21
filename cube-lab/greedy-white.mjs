const DOWN = 3;
const WHITE = 0;
const directions = [-1, 2, 1];

class WhiteLines {
  constructor(cube) {
    const { size, faces } = cube;
    this.size = size;
    this.faces = faces;
    this.lines = faces.map((stickers) => {
      const rows = new Int32Array(size);
      const cols = new Int32Array(size);
      for (let row = 1; row < size - 1; row++) {
        for (let col = 1, i = row * size + 1; col < size - 1; col++, i++) {
          if (stickers[i] !== WHITE) continue;
          rows[row]++;
          cols[col]++;
        }
      }
      return { rows, cols };
    });
    this.updateOrientations(cube);
  }

  updateOrientations(cube) {
    this.strips = cube.cycles.map(({ strips }) => strips.map(
      ({ face, byOrientation }) => byOrientation[cube.orientations[face]],
    ));
  }

  whiteOnDown() {
    return this.lines[DOWN].rows.reduce((sum, count) => sum + count, 0);
  }

  count(strip, layer) {
    const { size } = this;
    const index = strip.base + strip.layerStride * layer;
    const { rows, cols } = this.lines[strip.face];
    return Math.abs(strip.stripStride) === 1 ? rows[Math.floor(index / size)] : cols[index % size];
  }

  bestTurn(keepFixedCenters = false) {
    let bestGain = 0;
    let best;
    for (const axis of [0, 2]) {
      const strips = this.strips[axis];
      const down = strips.findIndex(({ face }) => face === DOWN);
      const running = [0, 0, 0];
      const starts = [1, 1, 1];
      for (let layer = 1; layer < this.size - 1; layer++) {
        if (keepFixedCenters && layer === (this.size - 1) / 2) {
          running.fill(0);
          continue;
        }
        const before = this.count(strips[down], layer);
        for (let i = 0; i < 3; i++) {
          if (running[i] <= 0) {
            starts[i] = layer;
            running[i] = 0;
          }
          running[i] += this.count(strips[(down + i + 1) % 4], layer) - before;
          if (running[i] > bestGain) {
            bestGain = running[i];
            best = { axis, layer: starts[i], endLayer: layer, turns: directions[i] };
          }
        }
      }
    }
    return best && { move: best, gain: bestGain };
  }

  updateForTurn(move) {
    const { size } = this;
    const strips = this.strips[move.axis];
    // Read the old source and destination strips before playback commits the turn.
    for (let i = 0; i < 4; i++) {
      const to = strips[i];
      const from = strips[(i - move.turns + 4) % 4];
      const old = this.faces[to.face];
      const incoming = this.faces[from.face];
      const { rows, cols } = this.lines[to.face];
      for (let layer = Math.max(1, move.layer); layer <= Math.min(size - 2, move.endLayer ?? move.layer); layer++) {
        let dest = to.base + to.layerStride * layer + to.stripStride;
        let source = from.base + from.layerStride * layer + from.stripStride;
        for (let p = 1; p < size - 1; p++, dest += to.stripStride, source += from.stripStride) {
          const delta = Number(incoming[source] === WHITE) - Number(old[dest] === WHITE);
          if (delta) {
            rows[Math.floor(dest / size)] += delta;
            cols[dest % size] += delta;
          }
        }
      }
    }
  }
}

export function bestWhiteTurn(cube) {
  return new WhiteLines(cube).bestTurn()?.move;
}

function setupLayers(last) {
  if (last <= 15) return Array.from({ length: last + 1 }, (_, i) => i);
  return Array.from({ length: 8 }, (_, i) => Math.round(i * last / 7));
}

function bestWhitePair(cube, lines, keepFixedCenters) {
  const last = cube.size - 1;
  const before = lines.whiteOnDown();
  if (before === (last - 1) ** 2) return [];
  const trial = cube.clone();
  const trialLines = Object.create(WhiteLines.prototype);
  trialLines.size = cube.size;
  trialLines.faces = trial.faces;
  let best = [];
  let maximum = before;
  for (const axis of [0, 1, 2]) {
    for (const layer of setupLayers(last)) {
      if (keepFixedCenters && layer === last / 2) continue;
      for (const turns of directions) {
        const first = { axis, layer, turns };
        trialLines.lines = lines.lines.map(({ rows, cols }) => ({ rows: rows.slice(), cols: cols.slice() }));
        trialLines.updateOrientations(trial);
        trialLines.updateForTurn(first);
        trial.apply(first);
        trialLines.updateOrientations(trial);
        const second = trialLines.bestTurn(keepFixedCenters);
        const score = trialLines.whiteOnDown() + (second?.gain ?? 0);
        trial.apply({ ...first, turns: turns === 2 ? 2 : -turns });
        if (second && score > maximum) {
          maximum = score;
          best = [first, second.move];
        }
      }
    }
  }
  return best;
}

export function* greedyWhiteMoves(cube, { keepFixedCenters = false } = {}) {
  const lines = new WhiteLines(cube);
  while (true) {
    const next = lines.bestTurn(keepFixedCenters);
    const moves = next ? [next.move] : bestWhitePair(cube, lines, keepFixedCenters);
    if (!moves.length) return;
    for (const move of moves) {
      lines.updateForTurn(move);
      yield move;
      lines.updateOrientations(cube);
    }
  }
}
