(() => {
  const study = document.getElementById('bench-study');
  if (!study) return;
  const sheetId = '1D7ep2dRfMzbV1DDvGQ7n3vDFC4zSjxMtq-fs5Fb24-0';
  const cacheKey = 'bench-study-results-v2';
  const snapshot = {
    current: {charlie: 169.0925, lucas: 119.0925},
    projected: {charlie: 294.0925, lucas: 154.0925},
    updatedAt: '2026-10-18T07:53:06+00:00'
  };
  let results = snapshot, pending, lastAttempt = 0, requestId = 0, zipLibrary;
  const status = document.getElementById('study-sync-status');
  const format = value => `${new Intl.NumberFormat('en-US', {maximumFractionDigits: 1}).format(value)} lbs`;
  function valid(data) {
    return ['current', 'projected'].every(group => ['charlie', 'lucas'].every(name =>
      typeof data?.[group]?.[name] === 'number' && Number.isFinite(data[group][name]) && data[group][name] > 0)) && Number.isFinite(Date.parse(data?.updatedAt));
  }
  function render(data, live = false) {
    results = data;
    for (const group of ['current', 'projected']) for (const name of ['charlie', 'lucas']) {
      study.querySelector(`[data-result="${group}-${name}"]`).textContent = format(data[group][name]);
    }
    const time = new Date(data.updatedAt).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'});
    status.textContent = `${live ? 'Updated' : 'Saved results from'} ${time}`;
  }
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (valid(cached) && Date.parse(cached.updatedAt) > Date.parse(results.updatedAt) && Date.parse(cached.updatedAt) <= Date.now() + 60000) results = cached;
  } catch { /* The saved snapshot also works when browser storage is unavailable. */ }
  render(results);

  // Anonymous, read-only queries return only the requested cells. JSONP avoids
  // Google's cross-origin fetch restrictions without requiring account tokens.
  function query(params) {
    return new Promise((resolve, reject) => {
      const callback = `_benchStudyResponse${++requestId}`;
      const script = document.createElement('script');
      const cleanup = () => { clearTimeout(timeout); script.remove(); delete window[callback]; };
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Sheet request timed out')); }, 12000);
      window[callback] = response => {
        cleanup();
        if (response.status === 'ok' && response.table) resolve(response.table);
        else reject(new Error('Sheet data unavailable'));
      };
      script.onerror = () => { cleanup(); reject(new Error('Sheet request failed')); };
      const search = new URLSearchParams({...params, tqx: `out:json;responseHandler:${callback}`, _: String(Date.now())});
      script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${search}`;
      document.head.append(script);
    });
  }
  async function refresh(force = false) {
    if (pending) return pending;
    if (!force && (document.hidden || study.hidden || Date.now() - lastAttempt < 60000)) return;
    lastAttempt = Date.now();
    pending = (async () => {
      try {
        const [maxes, forecast] = await Promise.all([
          query({gid: '0', range: 'Z2:AA3', headers: '0'}),
          // These cells contain the sheet's own FORECAST.LINEAR(40, ...) results.
          query({gid: '1256876327', range: 'J6:J7', headers: '0'})
        ]);
        // Prefer the requested row 3; the existing MAX formulas are on row 2.
        const highest = [...(maxes.rows || [])].reverse().map(row => row.c).find(cells =>
          [0, 1].every(index => typeof cells?.[index]?.v === 'number' && Number.isFinite(cells[index].v) && cells[index].v > 0));
        const data = {
          current: {charlie: highest?.[0]?.v, lucas: highest?.[1]?.v},
          projected: {charlie: forecast.rows?.[0]?.c?.[0]?.v, lucas: forecast.rows?.[1]?.c?.[0]?.v},
          updatedAt: new Date().toISOString()
        };
        if (!valid(data)) throw new Error('Invalid sheet values');
        render(data, true);
        const chart = document.getElementById('study-chart');
        if (chart) {
          const url = new URL(chart.src);
          url.searchParams.set('_', String(Date.now()));
          chart.src = url.href;
        }
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* Keep the in-memory results. */ }
      } catch {
        render(results);
        status.textContent = `Live refresh unavailable · ${status.textContent.toLowerCase()}`;
      }
    })();
    try { await pending; } finally { pending = null; }
  }
  document.addEventListener('bench-study-open', () => refresh());
  document.addEventListener('visibilitychange', () => refresh());
  setInterval(() => refresh(), 5 * 60 * 1000);
  refresh();

  function loadZipLibrary() {
    if (window.fflate) return Promise.resolve(window.fflate);
    if (!zipLibrary) zipLibrary = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/vendor/fflate-0.8.3.js';
      script.onload = () => resolve(window.fflate);
      script.onerror = () => { zipLibrary = null; script.remove(); reject(new Error('Word download unavailable')); };
      document.head.append(script);
    });
    return zipLibrary;
  }

  // Preserve the Word template styles and export the displayed Google Doc text
  // together with the live figures, so there is only one manuscript to edit.
  async function downloadWord(link) {
    const originalLabel = link.textContent;
    if (link.getAttribute('aria-busy') === 'true') return;
    link.setAttribute('aria-busy', 'true');
    link.textContent = 'Preparing Word document…';
    try {
      await Promise.all([refresh(true), window.BenchStudyDocument.refresh(true)]);
      const [zip, response] = await Promise.all([loadZipLibrary(), fetch(link.href)]);
      if (!response.ok) throw new Error('Document template unavailable');
      const files = zip.unzipSync(new Uint8Array(await response.arrayBuffer()));
      const xml = new DOMParser().parseFromString(zip.strFromU8(files['word/document.xml']), 'application/xml');
      if (xml.getElementsByTagName('parsererror').length) throw new Error('Invalid document template');
      window.BenchStudyDocument.writeWordBody(xml);
      files['word/document.xml'] = zip.strToU8(new XMLSerializer().serializeToString(xml));
      const blob = new Blob([zip.zipSync(files)], {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
      const url = URL.createObjectURL(blob), download = document.createElement('a');
      download.href = url; download.download = 'Bench Press Study.docx';
      document.body.append(download); download.click(); download.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      alert('Could not prepare the Word document. Please try again, or use Print / Save PDF in the study tab.');
    } finally {
      link.removeAttribute('aria-busy'); link.textContent = originalLabel;
    }
  }
  study.querySelector('[download]').addEventListener('click', event => {
    event.preventDefault(); downloadWord(event.currentTarget);
  });
})();
