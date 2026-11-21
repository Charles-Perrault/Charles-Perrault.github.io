import createGullicube from './vendor/gullicube/gullicube.mjs';

const shipped = new URL('./vendor/gullicube/', import.meta.url);
const localTables = new URL('data/', shipped);
const revision = '48bd54b36a95888639f63df63a24d8639b84cd23';
const upstream = new URL(`https://raw.githubusercontent.com/rokicki/gullicube/${revision}/data/`);
const smallTables = ['fast6', 'p8s10', 'diag2', 'mid2', 'wing3', 'pair3', 'diag3', 'mid3'];
function qualityTables(size) {
  const tables = ['diag_x10', 'wing_d6c'];
  if (size % 2) tables.push('mid_x10');
  if (size >= 6) tables.push('c12x', 'p9', 'eg8');
  return tables;
}

async function readTable(name, base, timeout) {
  const file = `${name}.cls`;
  const response = await fetch(new URL(file, base), { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`Could not load table ${name} (HTTP ${response.status}).`);
  return [file, new Uint8Array(await response.arrayBuffer())];
}

export function runGullicube({ size, facelets, budget, fast, tables, seed = 1, onReport = () => {} }) {
  return new Promise((resolve, reject) => {
    let cursor = 0;
    const solution = [];
    let lastLine;
    let lastError;
    const args = [String(size), '-f', '-o', '-t', '1', '--seed', String(seed)];
    args.push(...(fast ? ['--fast'] : ['--time', String(budget)]));
    createGullicube({
      locateFile: (name) => new URL(name, shipped).href,
      stdin: () => cursor < facelets.length ? facelets.charCodeAt(cursor++) : null,
      preRun: [(mod) => {
        mod.FS.mkdir('/data');
        for (const [name, data] of tables) mod.FS.writeFile(`/data/${name}`, data);
      }],
      print: (line) => {
        if (line.trim()) lastLine = line;
        if (/^ [1-9URFDLB]/u.test(line)) solution.push(line);
        if (line.startsWith('# checkpoint')) {
          onReport({ stage: 'gulli-search', candidate: line.slice('# checkpoint'.length) });
        } else if (line.startsWith('# time budget')) onReport({ stage: 'gulli-search' });
      },
      printErr: (line) => { lastError = line; },
      onExit: (code) => {
        if (code === 0) resolve(solution.join(' ').trim());
        else reject(new Error(lastError || `Gullicube stopped with code ${code}.`));
      },
    }).then((mod) => mod.callMain(args)).catch((error) => {
      reject(lastLine ? new Error(`${lastLine}\n${lastError ?? error.message}`) : error);
    });
  });
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) self.onmessage = async ({ data }) => {
  const started = performance.now();
  const small = Promise.all(smallTables.map((table) => readTable(table, localTables, 10000)));
  const quality = data.fast
    ? Promise.resolve([])
    : Promise.all(qualityTables(data.size).map((table) => readTable(table, upstream, Math.min(12000, data.budget * 400)))).catch(() => []);
  try {
    self.postMessage({ stage: 'gulli-download' });
    const [base, extra] = await Promise.all([small, quality]);
    self.postMessage({ stage: 'gulli-prep' });
    const repeat = !data.fast;
    const tables = [...base, ...extra];
    for (let seed = 1; ; seed++) {
      const remaining = data.budget - (performance.now() - started) / 1000;
      if (seed > 1 && remaining < 1) break;
      const candidate = await runGullicube({
        ...data,
        seed,
        fast: !extra.length,
        budget: Math.max(1, repeat && seed > 1 ? Math.min(remaining, 7) : remaining),
        tables,
        onReport: (event) => self.postMessage(event),
      });
      self.postMessage({ stage: 'gulli-search', candidate });
      if (!repeat) break;
    }
    self.postMessage({ done: true });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
