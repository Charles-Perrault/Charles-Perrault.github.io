import { Square1, pieces } from './puzzle.mjs';
import { searchSquare1 } from './sq12phase.mjs';

const solvedWire = Array.from('011233455677998bbaddcffe', token => parseInt(token, 16));
const home = new Square1();
const wireToLocal = (top, bottom) => top.slice().reverse().concat(bottom);
const wirePiece = new Map(wireToLocal(home.top, home.bottom).map((id, i) => [id, solvedWire[i]]));

function fromSnapshot(snapshot) {
  const { top, bottom, flipped } = snapshot;
  if (!Array.isArray(top) || !Array.isArray(bottom) || top.length !== 12 || bottom.length !== 12 || typeof flipped !== 'boolean') {
    throw new TypeError('Invalid Square-1 state.');
  }
  const counts = Array(pieces.length).fill(0);
  for (const ring of [top, bottom]) {
    for (const [i, id] of ring.entries()) {
      if (!Number.isInteger(id) || !pieces[id]) throw new TypeError('Invalid Square-1 piece.');
      const adjacent = Number(ring[(i + 11) % 12] === id) + Number(ring[(i + 1) % 12] === id);
      if (adjacent !== pieces[id].width - 1) throw new TypeError('Invalid Square-1 wedge.');
      counts[id]++;
    }
  }
  if (counts.some((count, id) => count !== pieces[id].width)) throw new TypeError('Invalid Square-1 piece count.');
  return Object.assign(new Square1(), { top: top.slice(), bottom: bottom.slice(), flipped });
}

function align(puzzle) {
  const choices = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6];
  const atCut = (ring, shift) => {
    const i = (12 - shift) % 12;
    return ring[i] !== ring[(i + 11) % 12] && ring[(i + 6) % 12] !== ring[(i + 5) % 12];
  };
  const top = choices.find(shift => atCut(puzzle.top, shift));
  const bottom = choices.find(shift => atCut(puzzle.bottom, -shift));
  if (top === undefined || bottom === undefined) throw new Error('Square-1 layers cannot line up with the slice.');
  return { top, bottom };
}

const normalized = turns => (turns + 5) % 12 - 5;

function translate(word) {
  const moves = [];
  let top = 0, bottom = 0;
  for (const turn of word) {
    if (turn > 0) top = normalized(turn);
    else if (turn < 0) bottom = normalized(-turn);
    else {
      if (top || bottom) moves.push({ top, bottom });
      moves.push({ slash: true });
      top = bottom = 0;
    }
  }
  if (top || bottom) moves.push({ top, bottom });
  return moves;
}

export function solveSquare1(snapshot, report = () => {}) {
  const draft = fromSnapshot(snapshot);
  if (draft.solved) return [];
  const setup = align(draft);
  draft.turn(setup.top, setup.bottom);
  const positions = wireToLocal(draft.top, draft.bottom).map(id => wirePiece.get(id));
  const { shape, finish } = searchSquare1(positions.slice(0, 12), positions.slice(12), Number(draft.flipped), report);
  const stages = [
    { name: 'Aligning the layers', moves: setup.top || setup.bottom ? [setup] : [] },
    { name: 'Restoring cube shape', moves: translate(shape) },
    { name: 'Solving the pieces', moves: translate(finish) },
  ].filter(stage => stage.moves.length);
  const replay = fromSnapshot(snapshot);
  for (const { moves } of stages) for (const move of moves) {
    if (move.slash) {
      if (!replay.slash()) throw new Error('Square-1 solution replay encountered a blocked slice.');
    } else replay.turn(move.top, move.bottom);
  }
  if (!replay.solved) throw new Error('Square-1 solution replay did not solve the puzzle.');
  return stages;
}
