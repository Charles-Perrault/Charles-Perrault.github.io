export class CellTextures {
  constructor(n, palette) {
    this.n = n;
    this.palette = palette;
    this.cells = Array.from({ length: 8 }, () => {
      const canvas = document.createElement('canvas');
      canvas.width = n;
      canvas.height = n;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not allocate a cell texture.');
      return { canvas, ctx, image: ctx.createImageData(n, n) };
    });
  }

  prepare(puzzle, plane, active, revision) {
    if (this.revision === revision && this.plane === plane && this.active === active) return this.moving;
    const { n, palette } = this;
    this.revision = revision;
    this.plane = plane;
    this.active = active;
    const moving = [];
    for (const [cell, { image, ctx }] of this.cells.entries()) {
      const start = (cell * n + plane) * n * n;
      for (let i = 0; i < n * n; i++) {
        const id = start + i;
        const target = active ? puzzle.destination(id, active.turn, active.direction) : id;
        if (target === id) {
          const [r, g, b] = palette[puzzle.state[id]];
          const pixel = 4 * i;
          image.data[pixel] = r;
          image.data[pixel + 1] = g;
          image.data[pixel + 2] = b;
          image.data[pixel + 3] = 255;
          continue;
        }
        image.data[4 * i + 3] = 0;
        if (Math.floor(target / (n * n)) % n === plane) moving.push({ id, from: id, to: target });
        else moving.push({ id, from: id, to: id, fade: 'out' });
        const previous = puzzle.destination(id, active.turn, -active.direction);
        if (Math.floor(previous / (n * n)) % n !== plane) {
          moving.push({ id: previous, from: id, to: id, fade: 'in' });
        }
      }
      ctx.putImageData(image, 0, 0);
    }
    this.moving = moving;
    return moving;
  }
}
