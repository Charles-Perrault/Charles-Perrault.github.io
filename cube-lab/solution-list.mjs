import { formatTurn } from './cube.mjs?v=18';

const pageSize = 9;
const number = new Intl.NumberFormat();

export class SolutionList {
  constructor(panel) {
    this.panel = panel;
    this.list = panel.querySelector('ol');
    this.current = panel.querySelector('#solution-current');
    this.label = panel.querySelector('#solution-current-label');
    this.count = panel.querySelector('#solution-count');
    this.previous = panel.querySelector('#solution-prev');
    this.next = panel.querySelector('#solution-next');
    this.follow = panel.querySelector('#solution-follow');
    this.previous.addEventListener('click', () => this.browse(this.page - 1));
    this.next.addEventListener('click', () => this.browse(this.page + 1));
    this.follow.addEventListener('click', () => this.browse(this.browsing ? null : this.page));
    window.addEventListener('resize', () => {
      if (this.work) this.update(this.work, this.size, { snap: this.snap, ended: this.ended, force: true });
    });
  }

  clear() {
    this.panel.hidden = true;
    this.work = null;
    this.list.replaceChildren();
  }

  browse(page) {
    this.browsing = page !== null;
    if (this.browsing) this.page = page;
    this.update(this.work, this.size, { snap: this.snap, ended: this.ended, force: true });
  }

  update(work, size, { snap = false, ended = false, force = false } = {}) {
    const now = performance.now();
    if (this.work === work && !force && now - this.lastPaint < 100) return;
    if (this.work !== work) {
      this.work = work;
      this.browsing = false;
      this.pageStart = -1;
      this.pageEnd = -1;
      this.highlight = null;
    }
    this.lastPaint = now;
    this.size = size;
    this.snap = snap;
    this.ended = ended;
    const { sequence, done, live } = work;
    const lastApplied = done > 0 && (snap || ended || !work.move);
    const index = lastApplied ? done - 1 : done;
    const lastPage = Math.floor((sequence.length - 1) / pageSize);
    this.page = this.browsing ? Math.min(this.page, lastPage) : Math.floor(index / pageSize);
    const start = this.page * pageSize;
    const end = Math.min(start + pageSize, sequence.length);
    if (this.pageStart !== start || this.pageEnd !== end) {
      const rows = [];
      for (let i = start; i < end; i++) {
        const row = document.createElement('li');
        const position = document.createElement('span');
        const move = document.createElement('code');
        position.textContent = number.format(i + 1);
        move.textContent = formatTurn(sequence.at(i), size);
        row.append(position, move);
        rows.push(row);
      }
      this.list.start = start + 1;
      this.list.replaceChildren(...rows);
      this.list.scrollTop = 0;
      this.pageStart = start;
      this.pageEnd = end;
    }
    this.panel.hidden = false;
    const highlight = this.list.children[index - start];
    const changed = highlight !== this.highlight;
    if (changed) {
      this.highlight?.removeAttribute('aria-current');
      highlight?.setAttribute('aria-current', 'step');
      this.highlight = highlight;
    }
    if (highlight && !this.browsing && (changed || force)) {
      const rowBox = highlight.getBoundingClientRect();
      const listBox = this.list.getBoundingClientRect();
      if (rowBox.top < listBox.top) this.list.scrollTop += rowBox.top - listBox.top;
      else if (rowBox.bottom > listBox.bottom) this.list.scrollTop += rowBox.bottom - listBox.bottom;
    }
    this.label.textContent = done && (ended || !work.move) ? 'Last move' : work.started ? 'Current move' : 'Next move';
    this.current.textContent = formatTurn(sequence.at(index), size);
    this.count.textContent = `${number.format(sequence.length)} ${live ? ended ? 'received' : 'available' : 'planned'}`;
    this.previous.disabled = this.page === 0;
    this.next.disabled = this.page >= lastPage;
    this.follow.setAttribute('aria-pressed', String(!this.browsing));
  }
}
