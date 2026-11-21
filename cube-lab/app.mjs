import { Cube, formatTurn, parseMoves, scrambleLength, scrambleMoves, solvedColors } from './cube.mjs?v=18';
import { CubeRenderer } from './renderer.mjs?v=17';
import { greedyWhiteMoves } from './greedy-white.mjs?v=11';
import { PackedTurns, unpackTurns } from './packed-turns.mjs?v=16';
import { SolutionList } from './solution-list.mjs?v=18';
import { validatePaintedCube } from './painted-cube.mjs?v=17';

const get = (id) => document.getElementById(id);
const sizeInput = get('cube-size');
const speedInput = get('turn-speed');
const sequenceInput = get('move-sequence');
const status = get('cube-status');
const message = get('status-message');
const progress = get('turn-progress');
const planningEstimate = get('planning-estimate');
const stopButton = get('stop-turns');
const endSearchButton = get('end-search');
const playbackButton = get('playback-toggle');
const paintToggle = get('color-picker');
const paintPanel = get('color-panel');
const paintError = get('color-error');
const swatches = [...paintPanel.querySelectorAll('[data-color]')];
const solutionList = new SolutionList(get('solution-panel'));
const animatedButton = get('animate-scramble');
const instantButton = get('instant-scramble');
const lightScrambleForm = get('light-scramble-form');
const lightScrambleCount = get('light-scramble-count');
const solveWhiteButton = get('solve-white');
const greedyWhiteButton = get('greedy-white');
const solveBlocksButton = get('solve-white-blocks');
const solveYellowButton = get('solve-yellow');
const solveCubeButton = get('solve-cube');
const solveFastButton = get('solve-fast');
const solveMessages = {
  full: { solved: 'Cube solved', alreadySolved: 'Cube already solved' },
  fast: { solved: 'Cube solved', alreadySolved: 'Cube already solved' },
  yellow: { solved: 'White and yellow centers solved', alreadySolved: 'White and yellow centers already solved' },
  blocks: { solved: 'White center solved with blocks', alreadySolved: 'White center already solved' },
  white: { solved: 'White center solved', alreadySolved: 'White center already solved' },
};
const incompleteSolve = 'Solve incomplete. Try again.';

function solveGoalReached(stage) {
  if (stage === 'full' || stage === 'fast') return cube.isSolved();
  return cube.hasSolvedCenters(stage === 'yellow' ? [3, 0] : [3]);
}
const faceButtons = [...document.querySelectorAll('[data-move]')];
const sizeButtons = [...document.querySelectorAll('[data-size]')];
const countFormat = new Intl.NumberFormat();

let cube = new Cube(3);
let paintDraft = null;
let paintChanges = 0;
let paintColor = 0;
const animationLimit = 100_000;
let turnHistory = new PackedTurns();
const maxHistory = 250_000;

function rememberTurn(move) {
  if (turnHistory?.length === maxHistory) turnHistory = null;
  turnHistory?.append(move);
}
let renderer;
let task = null;
let worker = null;
let frame = 0;
let totalMoves = 0;
let rate = speedInput.valueAsNumber;
function showMessage(text) {
  message.textContent = text;
}

function updateMoves() {
  get('moves-applied').textContent = countFormat.format(totalMoves);
}

function setBusy(busy, label) {
  const editing = Boolean(paintDraft);
  const locked = busy || editing;
  const solved = !locked && cube.isSolved();
  status.textContent = busy ? label : editing ? 'Editing colors' : solved ? 'Solved' : 'Scrambled';
  status.dataset.state = locked ? 'busy' : solved ? 'solved' : 'scrambled';
  stopButton.disabled = !busy;
  paintToggle.disabled = busy;
  animatedButton.disabled = locked;
  instantButton.disabled = locked;
  lightScrambleForm.querySelector('button').disabled = locked;
  for (const button of [solveWhiteButton, greedyWhiteButton, solveBlocksButton, solveYellowButton, solveCubeButton, solveFastButton, ...faceButtons]) {
    button.disabled = locked;
  }
  get('move-form').querySelector('button').disabled = locked;
  get('reset-cube').disabled = editing;
  get('size-form').querySelector('button').disabled = editing;
  for (const button of sizeButtons) button.disabled = editing;
}

function stopWork() {
  endSearchButton.hidden = true;
  endSearchButton.onclick = null;
  cancelAnimationFrame(frame);
  frame = 0;
  if (task?.sequence) solutionList.update(task, cube.size, { ended: true, force: true });
  task = null;
  if (worker) worker.terminate();
  worker = null;
  progress.hidden = true;
  planningEstimate.hidden = true;
  playbackButton.hidden = true;
}

function settle(text) {
  stopWork();
  if (cube.faces.every((face, i) => face[0] === solvedColors[i]) && cube.isSolved()) {
    turnHistory = new PackedTurns();
  }
  renderer.cancelDrag();
  renderer.draw(cube);
  setBusy(false);
  showMessage(text);
}

function showSize() {
  sizeInput.value = cube.size;
  get('cube-dimensions').textContent = `${cube.size} × ${cube.size} × ${cube.size}`;
  get('scramble-count').textContent = countFormat.format(scrambleLength(cube.size));
  get('size-link').href = `#id=${cube.size}`;
  for (const button of sizeButtons)
    button.setAttribute('aria-pressed', Number(button.dataset.size) === cube.size);
  updateMoves();
}

function resizeCube(size, updateUrl = true) {
  if (paintDraft) return;
  if (!Number.isSafeInteger(size) || size < 2) {
    showMessage('Enter a whole cube size of 2 or greater.');
    return;
  }
  if (size > renderer.maxSize) {
    showMessage(`This device supports up to ${countFormat.format(renderer.maxSize)} layers.`);
    return;
  }
  if (size !== cube.size) {
    let next;
    try {
      next = new Cube(size);
      renderer.draw(next);
    } catch (error) {
      showMessage(
        error instanceof RangeError ? 'This cube is too large for available memory.' : error.message,
      );
      return;
    }
    cube = next;
    turnHistory = new PackedTurns();
    totalMoves = 0;
    settle('Ready to turn');
    solutionList.clear();
  }
  if (updateUrl && location.hash !== `#id=${size}`) history.pushState(null, '', `#id=${size}`);
  showSize();
}

function openColorPicker() {
  if (task || worker || paintDraft) return;
  try {
    paintDraft = cube.clone();
  } catch (error) {
    showMessage(error instanceof RangeError ? 'There is not enough memory to edit this cube.' : error.message);
    return;
  }
  paintChanges = 0;
  renderer.cancelDrag();
  renderer.draw(paintDraft);
  paintToggle.hidden = true;
  paintPanel.hidden = false;
  get('cube-canvas').classList.add('painting');
  paintError.textContent = '';
  setBusy(false);
  showMessage('Pick a color and click a sticker');
  swatches[paintColor].focus();
}

function paintSticker(face, row, col) {
  const previous = paintDraft.stickerAt(face, row, col);
  if (!paintDraft.setSticker(face, row, col, paintColor)) return;
  const original = cube.stickerAt(face, row, col);
  paintChanges += Number(paintColor !== original) - Number(previous !== original);
  paintError.textContent = '';
  renderer.draw(paintDraft);
}

function closeColorPicker(apply) {
  if (!paintDraft) return;
  if (apply && paintChanges) {
    const error = validatePaintedCube(paintDraft);
    if (error) {
      paintError.textContent = error;
      return;
    }
    cube = paintDraft;
    turnHistory = null;
    totalMoves = 0;
    updateMoves();
    solutionList.clear();
  }
  paintDraft = null;
  paintPanel.hidden = true;
  paintToggle.hidden = false;
  get('cube-canvas').classList.remove('painting');
  settle(apply ? 'Cube colors applied' : 'Color changes discarded');
  paintToggle.focus();
}

function useHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const value = params.get('id');
  const size = value === null ? 3 : /^\d+$/.test(value) ? Number(value) : NaN;
  if (paintDraft && size !== cube.size) closeColorPicker(false);
  resizeCube(size, false);
}

function updateSpeed() {
  const next = speedInput.valueAsNumber;
  if (speedInput.validity.valid && next > 0 && Number.isFinite(next)) {
    if (next > animationLimit && rate <= animationLimit && task && renderer.move) renderer.draw(cube);
    rate = next;
    const formatted = next < 0.01 || next >= 1e7 ? next.toExponential(2) : countFormat.format(next);
    get('speed-rate').textContent = `${formatted} ${next === 1 ? 'turn' : 'turns'}/sec`;
  } else {
    get('speed-rate').textContent = 'Enter a positive speed';
  }
}

function animate(now) {
  frame = 0;
  const work = task;
  if (!work || work.paused) return;
  let turnCredit = work.progress + (Math.min(Math.max(now - work.lastTime, 0), 100) / 1000) * rate;
  work.lastTime = now;
  const snap = rate > animationLimit;
  const deadline = performance.now() + (snap ? 12 : 7);
  let applied = 0;
  // Use the available frame time when the requested rate exceeds the refresh rate.
  while (turnCredit >= 1 && work.move) {
    const move = work.move;
    renderer.recordTurn(cube, move);
    cube.apply(move);
    rememberTurn(move);
    work.done++;
    applied++;
    turnCredit--;
    work.move = work.sequence ? work.sequence.at(work.done) : work.done < work.count ? work.moves.next().value : undefined;
    const checkBudget = (applied & 15) === 0 || cube.size >= 2048 || (move.endLayer ?? move.layer) - move.layer >= 16;
    if (checkBudget && performance.now() >= deadline) {
      turnCredit = 0;
      break;
    }
  }
  if (applied) {
    totalMoves += applied;
    updateMoves();
    if (!work.live) progress.value = work.done;
  }
  if (work.sequence) solutionList.update(work, cube.size, { snap });
  if (work.move) {
    work.progress = turnCredit;
    if (!snap) renderer.draw(cube, turnCredit > 0 ? work.move : null, turnCredit);
    else if (now - work.lastDraw >= 32 || renderer.move) {
      renderer.draw(cube);
      work.lastDraw = now;
    }
    frame = requestAnimationFrame(animate);
  } else if (work.live) {
    work.progress = 0;
    renderer.draw(cube);
    showMessage('Waiting for more solution moves');
  } else finishPlayback(work);
}

function finishPlayback(work) {
  settle(work.greedy ? greedyWhiteResult() : work.center && !solveGoalReached(work.center) ? incompleteSolve : work.complete);
}

function greedyWhiteResult() {
  return cube.hasSolvedCenters([3]) ? 'White center solved' : 'No improving turn or pair found';
}

function togglePlayback() {
  if (!task) return;
  if (task.paused) {
    task.paused = false;
    task.started = true;
    task.lastTime = performance.now();
    playbackButton.textContent = 'Pause';
    status.textContent = task.label;
    showMessage(task.move ? task.playingMessage : 'Waiting for more solution moves');
    if (task.move) frame = requestAnimationFrame(animate);
  } else {
    task.paused = true;
    cancelAnimationFrame(frame);
    frame = 0;
    playbackButton.textContent = 'Resume';
    if (rate > animationLimit) renderer.draw(cube);
    status.textContent = 'Paused';
    showMessage('Playback paused');
  }
  if (task.sequence) solutionList.update(task, cube.size, { snap: rate > animationLimit, force: true });
}

function beginTurns(moves, count, { scramble = false, center = '', start = 0, greedy = false, backend = '', sequence, live = false } = {}) {
  if (paintDraft || task || (worker && !live) || !count) return;
  const move = sequence ? sequence.at(0) : moves.next().value;
  if (greedy && !move) {
    showMessage(greedyWhiteResult());
    return;
  }
  const label = center || greedy ? 'Solving' : scramble ? 'Scrambling' : 'Turning';
  const solveCount = countFormat.format(count);
  const playingMessage = greedy
    ? 'Picking the best turn for white on D'
    : center
      ? live ? 'Solving while Brobdicube plans ahead' : `Solving in ${solveCount} turns`
      : scramble
        ? `Playing ${countFormat.format(count)} turns`
        : count === 1
          ? formatTurn(move, cube.size)
          : 'Playing move sequence';
  task = {
    moves,
    sequence,
    move,
    count,
    live,
    center,
    greedy,
    label,
    playingMessage,
    paused: Boolean(center),
    started: !center,
    progress: start,
    done: 0,
    lastTime: performance.now(),
    lastDraw: -Infinity,
    complete: center
      ? solveMessages[center].solved
      : scramble
        ? 'Scramble complete'
        : count === 1
          ? `${formatTurn(move, cube.size)} complete`
          : 'Sequence complete',
  };
  renderer.cancelDrag();
  setBusy(true, center ? 'Solution ready' : label);
  playbackButton.hidden = false;
  playbackButton.textContent = center ? 'Start solution' : 'Pause';
  if (center) {
    const source = backend ? ` from ${backend}` : '';
    const detail = live ? 'More moves on the way' : `${solveCount} turns`;
    showMessage(`Solution ready${source} · ${detail}`);
  } else showMessage(playingMessage);
  progress.max = count;
  progress.value = 0;
  if (live) progress.removeAttribute('value');
  planningEstimate.hidden = true;
  progress.setAttribute('aria-label', 'Turn progress');
  progress.hidden = greedy || (!live && count === 1);
  if (sequence) solutionList.update(task, cube.size, { force: true });
  else solutionList.clear();
  renderer.draw(cube, start && rate <= animationLimit ? move : null, start);
  if (!task.paused) frame = requestAnimationFrame(animate);
}

function acceptSolutionBatch(batch, center) {
  if (!task) {
    const sequence = new PackedTurns();
    sequence.appendWords(batch);
    beginTurns(null, sequence.length, { center, backend: 'Brobdicube', sequence, live: true });
    return;
  }
  task.sequence.appendWords(batch);
  task.count = task.sequence.length;
  if (!task.move) {
    task.move = task.sequence.at(task.done);
    if (!task.paused) {
      task.lastTime = performance.now();
      showMessage(task.playingMessage);
      frame = requestAnimationFrame(animate);
    }
  }
  solutionList.update(task, cube.size, { snap: rate > animationLimit });
}

function finishSolutionStream() {
  worker.terminate();
  worker = null;
  const work = task;
  work.live = false;
  if (!work.move) {
    finishPlayback(work);
    return;
  }
  const total = countFormat.format(work.count);
  work.playingMessage = `Solving in ${total} turns`;
  progress.max = work.count;
  progress.value = work.done;
  if (!work.started) showMessage(`Solution ready from Brobdicube · ${total} turns`);
  else if (!work.paused) showMessage(work.playingMessage);
  solutionList.update(work, cube.size, { snap: rate > animationLimit, force: true });
}

function instantScramble() {
  if (paintDraft || task || worker) return;
  solutionList.clear();
  renderer.cancelDrag();
  const { size, faces, orientations } = cube;
  try {
    const job = new Worker(new URL('./scramble-worker.mjs?v=14', import.meta.url), { type: 'module' });
    worker = job;
    job.onmessage = ({ data }) => {
      if (worker !== job) return;
      if (data.error) {
        settle(data.error);
        return;
      }
      cube = new Cube(size, data.faces, data.orientations);
      for (const move of unpackTurns(data.history)) rememberTurn(move);
      totalMoves += scrambleLength(size);
      updateMoves();
      settle('Scramble complete');
    };
    job.onerror = () => {
      if (worker === job) settle('Could not scramble the cube. Try again.');
    };
    // The worker gets copies. Stopping a scramble leaves the previous puzzle intact.
    job.postMessage({ size, faces, orientations });
  } catch {
    settle('Could not start instant scramble.');
    return;
  }
  setBusy(true, 'Scrambling');
  showMessage('Applying scramble');
}

function startSolve(center) {
  if (paintDraft || task || worker) return;
  if (cube.size === 2 && center !== 'full' && center !== 'fast') {
    showMessage('A 2 × 2 × 2 cube has no centers');
    return;
  }
  solutionList.clear();
  renderer.cancelDrag();
  try {
    const job = new Worker(new URL('./solver-worker.mjs?v=20', import.meta.url), { type: 'module' });
    worker = job;
    let bestSearch;
    let phase = 'white';
    let phaseStarted = performance.now();
    const showPlanningProgress = (nextPhase, fraction) => {
      if (phase !== nextPhase) {
        phase = nextPhase;
        phaseStarted = performance.now();
        const subject = { brobdicube: 'with Brobdicube', fallback: 'with the browser solver', cuda: 'white blocks on the GPU', edges: 'edge pairing', finish: 'the 3 × 3 finish' }[phase] ?? `the ${phase} center`;
        const stages = {
          verify: 'Checking Brobdicube solution',
          'direct-search': 'Checking for a short solution',
          'three-search': 'Searching for a short 3×3 solution',
          'optimal-search': 'Finding the shortest 2×2 solution',
          'four-tables': 'Preparing 4×4 search tables',
          'four-search': 'Searching 4×4 solutions',
          'gulli-download': 'Loading Gullicube search tables',
          'gulli-prep': 'Preparing Gullicube search',
          'gulli-search': 'Searching for shorter solutions',
        };
        const stageMessage = stages[phase] ?? `Planning ${subject}`;
        showMessage(phase === 'gulli-search' && bestSearch
          ? `${stageMessage} · Best so far: ${countFormat.format(bestSearch.length)} turns`
          : stageMessage);
        progress.setAttribute('aria-label', stageMessage);
      }
      if (fraction === null) {
        progress.removeAttribute('value');
        planningEstimate.textContent = '';
        return;
      }
      progress.value = fraction * 100;
      planningEstimate.textContent = `~${Math.floor(progress.value)}%`;
      const elapsed = (performance.now() - phaseStarted) / 1000;
      if (fraction >= 0.05 && elapsed >= 2) {
        const remaining = (elapsed * (1 - fraction)) / fraction;
        const time =
          remaining < 60 ? `${Math.max(1, Math.round(remaining))}s` : `${Math.round(remaining / 60)}m`;
        planningEstimate.textContent += ` · ~${time} left`;
      }
    };
    job.onmessage = ({ data }) => {
      if (worker !== job) return;
      if (data.bestSearch) {
        bestSearch = data.bestSearch;
        showMessage(`Searching for shorter solutions · Best so far: ${countFormat.format(bestSearch.length)} turns`);
        return;
      }
      if (data.progress) {
        showPlanningProgress(data.progress.phase, data.progress.fraction);
        return;
      }
      if (data.batch) {
        acceptSolutionBatch(data.batch, center);
        return;
      }
      if (data.streamEnd) {
        finishSolutionStream();
        return;
      }
      stopWork();
      const count = data.packed?.length ?? data.moves?.length ?? 0;
      if (data.error || !count) {
        settle(data.error || (solveGoalReached(center) ? solveMessages[center].alreadySolved : incompleteSolve));
        return;
      }
      const sequence = data.moves ?? new PackedTurns();
      if (data.packed) sequence.appendWords(data.packed);
      beginTurns(null, count, { center, backend: data.backend, sequence });
    };
    job.onerror = () => {
      if (worker === job) settle('Could not plan the solve');
    };
    setBusy(true, 'Solving');
    if (cube.size >= 5 && cube.size <= 7 && (center === 'full' || center === 'fast')) {
      endSearchButton.hidden = false;
      endSearchButton.onclick = () => {
        if (worker !== job) return;
        if (!bestSearch) {
          settle('Search ended before finding a solution');
          return;
        }
        stopWork();
        beginTurns(null, bestSearch.length, { center, backend: 'Gullicube', sequence: bestSearch });
      };
    }
    showMessage(center === 'blocks' ? 'Planning the white center with blocks' : 'Planning the white center');
    progress.max = 100;
    progress.setAttribute('aria-label', 'Planning progress for the white center');
    progress.hidden = false;
    planningEstimate.hidden = false;
    showPlanningProgress('white', 0);
    job.postMessage({
      size: cube.size,
      faces: cube.faces,
      orientations: cube.orientations,
      center,
      history: center === 'fast' ? turnHistory?.view().slice() : undefined,
      brobdicube: location.port === '8766' || new URLSearchParams(location.search).get('brobdicube') === '1',
      cuda: new URLSearchParams(location.search).get('cuda') === '1',
    });
  } catch {
    settle('Could not start the solve');
  }
}

function applyNotation(text) {
  try {
    const moves = parseMoves(text, cube.size);
    if (moves.length) beginTurns(moves.values(), moves.length);
    else showMessage('Enter a move sequence.');
  } catch (error) {
    showMessage(error.message);
  }
}

function initialize() {
  try {
    renderer = new CubeRenderer(get('cube-canvas'));
    renderer.draw(cube);
  } catch (error) {
    showMessage(error.message);
    document.querySelectorAll('.controls button, .controls input, #reset-view').forEach((control) => {
      control.disabled = true;
    });
    return;
  }

  renderer.canTurn = () => !paintDraft && !task && !worker;
  renderer.canPaint = () => Boolean(paintDraft);
  renderer.onPaint = paintSticker;
  renderer.onTurn = (move, start) => beginTurns([move].values(), 1, { start });
  paintToggle.addEventListener('click', openColorPicker);
  get('apply-colors').addEventListener('click', () => closeColorPicker(true));
  get('cancel-colors').addEventListener('click', () => closeColorPicker(false));
  for (const button of swatches) {
    button.addEventListener('click', () => {
      paintColor = Number(button.dataset.color);
      for (const swatch of swatches) swatch.setAttribute('aria-pressed', String(swatch === button));
    });
  }
  paintPanel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeColorPicker(false);
  });
  get('reset-view').addEventListener('click', () => renderer.resetView());
  get('size-form').addEventListener('submit', (event) => {
    event.preventDefault();
    resizeCube(sizeInput.valueAsNumber);
  });
  for (const button of sizeButtons)
    button.addEventListener('click', () => resizeCube(Number(button.dataset.size)));
  window.addEventListener('hashchange', useHash);
  get('size-link').addEventListener('click', async (event) => {
    event.preventDefault();
    const link = get('size-link').href;
    try {
      await navigator.clipboard.writeText(link);
      showMessage('Size link copied');
    } catch {
      if (location.href !== link) history.replaceState(null, '', link);
      showMessage('Size link is in the address bar');
    }
  });
  speedInput.addEventListener('input', updateSpeed);
  animatedButton.addEventListener('click', () =>
    beginTurns(scrambleMoves(cube.size), scrambleLength(cube.size), { scramble: true }),
  );
  instantButton.addEventListener('click', instantScramble);
  lightScrambleForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const count = lightScrambleCount.valueAsNumber;
    if (!Number.isSafeInteger(count) || count < 1) {
      showMessage('Enter a positive whole number of moves');
      return;
    }
    beginTurns(scrambleMoves(cube.size, Math.random, count), count, { scramble: true });
  });
  solveWhiteButton.addEventListener('click', () => startSolve('white'));
  greedyWhiteButton.addEventListener('click', () => {
    if (cube.size === 2) {
      showMessage('A 2 × 2 × 2 cube has no centers');
      return;
    }
    beginTurns(greedyWhiteMoves(cube), 2 * (cube.size - 2) ** 2, { greedy: true });
  });
  solveBlocksButton.addEventListener('click', () => startSolve('blocks'));
  solveYellowButton.addEventListener('click', () => startSolve('yellow'));
  solveCubeButton.addEventListener('click', () => startSolve('full'));
  solveFastButton.addEventListener('click', () => startSolve('fast'));
  stopButton.addEventListener('click', () => settle('Stopped'));
  playbackButton.addEventListener('click', togglePlayback);
  get('reset-cube').addEventListener('click', () => {
    cube.reset();
    turnHistory = new PackedTurns();
    totalMoves = 0;
    updateMoves();
    settle('Cube reset');
    solutionList.clear();
  });
  for (const button of faceButtons) {
    button.addEventListener('click', (event) =>
      applyNotation(button.dataset.move + (event.shiftKey ? "'" : '')),
    );
  }
  get('move-form').addEventListener('submit', (event) => {
    event.preventDefault();
    applyNotation(sequenceInput.value);
  });
  get('cube-canvas').addEventListener('keydown', (event) => {
    if (!event.altKey && !event.ctrlKey && !event.metaKey && /^[UDRLFB]$/i.test(event.key)) {
      applyNotation(event.key.toUpperCase() + (event.shiftKey ? "'" : ''));
    }
    if (event.key === 'Escape') {
      if (paintDraft) closeColorPicker(false);
      else if (task || worker) settle('Stopped');
      else renderer.cancelDrag();
    }
  });

  showSize();
  setBusy(false);
  updateSpeed();
  useHash();
}

initialize();
