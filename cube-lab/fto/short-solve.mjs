import { faces, Octahedron } from './puzzle.mjs?v=2';

const inverse = word => word.slice().reverse().map(move => ({ ...move, direction: -move.direction }));
const key = state => String.fromCharCode(...state);

// A bounded search for lightly scrambled inner slices, independent of move history.
export function shortSolution(size, state) {
  if (size > 12) return null;
  const draft = new Octahedron(size);
  const turns = faces.flatMap((_, axis) => Array.from({ length: draft.depth }, (_, i) =>
    [1, -1].map(direction => ({ axis, layer: i + 1, direction }))).flat());
  const build = (start, visit) => {
    if (visit(key(start), [])) return true;
    for (const first of turns) {
      draft.state.set(start);
      draft.turn(first.axis, first.layer, first.direction);
      if (visit(key(draft.state), [first])) return true;
      const after = draft.state.slice();
      for (const second of turns) {
        if (first.axis === second.axis && first.layer === second.layer) continue;
        draft.state.set(after);
        draft.turn(second.axis, second.layer, second.direction);
        if (visit(key(draft.state), [first, second])) return true;
      }
    }
    return false;
  };
  const home = new Map();
  build(draft.state.slice(), (position, word) => {
    if ((home.get(position)?.length ?? Infinity) > word.length) home.set(position, word);
  });
  let solution = null;
  build(state, (position, word) => {
    const toHome = home.get(position);
    if (!toHome) return false;
    const candidate = [...word, ...inverse(toHome)];
    if (!solution || candidate.length < solution.length) solution = candidate;
    return candidate.length <= 2;
  });
  if (!solution) return null;
  draft.state.set(state);
  for (const { axis, layer, direction } of solution) draft.turn(axis, layer, direction);
  return draft.solved ? solution : null;
}
