const slots = 12;
export const step = Math.PI / 6;
export const sideColors = ['#43b76e', '#e9574e', '#5188e5', '#f08e42'];
const faceColors = ['#f5d953', '#f5f2e8'];

export const pieces = Array.from({ length: 16 }, (_, id) => {
  const layer = Math.floor(id / 8), position = id % 8;
  const side = Math.floor(position / 2);
  return {
    layer,
    width: position % 2 ? 1 : 2,
    color: faceColors[layer],
    sides: position % 2 ? [sideColors[side]] : [sideColors[(side + 3) % 4], sideColors[side]],
  };
});

const home = faceColors.map((_, layer) =>
  Array.from({ length: 8 }, (_, position) => Array(pieces[layer * 8 + position].width).fill(layer * 8 + position)).flat());
const modulo = value => ((value % slots) + slots) % slots;

function turnRing(ring, steps) {
  return ring.map((_, i) => ring[modulo(i - steps)]);
}

function atCut(ring) {
  return ring[11] !== ring[0] && ring[5] !== ring[6];
}

export function readRing(ring) {
  return ring.flatMap((id, i) => ring[modulo(i - 1)] === id ? [] : [{ id, start: i, width: pieces[id].width }]);
}

export class Square1 {
  constructor() {
    this.reset();
  }

  reset() {
    [this.top, this.bottom] = home.map(ring => ring.slice());
    this.flipped = false;
  }

  get canSlash() {
    return atCut(this.top) && atCut(this.bottom);
  }

  get solved() {
    return !this.flipped && [this.top, this.bottom].every((ring, layer) => ring.every((id, i) => id === home[layer][i]));
  }

  turn(top, bottom) {
    if (!Number.isInteger(top) || !Number.isInteger(bottom)) return false;
    this.top = turnRing(this.top, top);
    this.bottom = turnRing(this.bottom, -bottom);
    return true;
  }

  slash() {
    if (!this.canSlash) return false;
    const rightTop = this.top.slice(0, 6).reverse();
    const leftTop = this.top.slice(6), leftBottom = this.bottom.slice(6);
    this.top = [...this.bottom.slice(0, 6).reverse(), ...leftTop];
    this.bottom = [...rightTop, ...leftBottom];
    this.flipped = !this.flipped;
    return true;
  }

  planScramble(length = 12, random = Math.random) {
    const draft = new Square1();
    draft.top = this.top.slice();
    draft.bottom = this.bottom.slice();
    draft.flipped = this.flipped;
    const sequence = [];
    const offsets = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
    for (let i = 0; i < length; i++) {
      const top = offsets.filter(step => atCut(turnRing(draft.top, step)));
      const bottom = offsets.filter(step => atCut(turnRing(draft.bottom, -step)));
      const pairs = top.flatMap(x => bottom.filter(y => x || y).map(y => ({ top: x, bottom: y })));
      const move = pairs[Math.floor(random() * pairs.length)] ?? { top: 0, bottom: 0 };
      draft.turn(move.top, move.bottom);
      draft.slash();
      sequence.push(move, { slash: true });
    }
    return sequence;
  }
}
