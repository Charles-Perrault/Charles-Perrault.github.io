const layerBits = 14;
const layerMask = (1 << layerBits) - 1;
const axisAndSlabMask = (1 << 30) - 1;
export const maxPackedSize = layerMask + 1;

function encode({ axis, layer, endLayer = layer, turns }) {
  return layer | (endLayer << layerBits) | (axis << 28) | ((turns & 3) << 30);
}

function decode(word) {
  const axis = (word >>> 28) & 3;
  const layer = word & layerMask;
  const endLayer = (word >>> layerBits) & layerMask;
  const turns = word >>> 30 === 3 ? -1 : word >>> 30;
  return endLayer === layer ? { axis, layer, turns } : { axis, layer, endLayer, turns };
}

export function* unpackTurns(words) {
  for (const word of words) yield decode(word);
}

export class PackedTurns {
  constructor() {
    this.words = new Uint32Array(1024);
    this.length = 0;
  }

  append(move) {
    const word = encode(move);
    const prev = this.words[this.length - 1];
    if (this.length && (prev & axisAndSlabMask) === (word & axisAndSlabMask)) {
      const turns = ((prev >>> 30) + (word >>> 30)) & 3;
      if (turns) this.words[this.length - 1] = (word & axisAndSlabMask) | (turns << 30);
      else this.length--;
      return;
    }
    if (this.length === this.words.length) {
      const larger = new Uint32Array(this.words.length * 2);
      larger.set(this.words);
      this.words = larger;
    }
    this.words[this.length++] = word;
  }

  push(...moves) {
    for (const move of moves) this.append(move);
  }

  appendWords(words) {
    const length = this.length + words.length;
    if (length > this.words.length) {
      const larger = new Uint32Array(Math.max(this.words.length * 2, length));
      larger.set(this.view());
      this.words = larger;
    }
    this.words.set(words, this.length);
    this.length = length;
  }

  at(index) {
    return index >= 0 && index < this.length ? decode(this.words[index]) : undefined;
  }

  view() {
    return this.words.subarray(0, this.length);
  }

  [Symbol.iterator]() {
    return unpackTurns(this.view());
  }
}
