(() => {
  'use strict';
  const api = 'https://tony-eagle-leaderboard.new-plum-8104.chatgpt.site';
  let run = null, generation = 0, lastState = null, blocked = false, resetting = false;
  const get = id => document.getElementById(id);
  async function request(path, input) {
    const response = await fetch(api + path, input === undefined ? {cache:'no-store'} : {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(input)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Leaderboard unavailable. Try again.');
    return result;
  }
  async function note() {
    const header = 'TONY EAGLE: AMATEUR SKATEBOARDING\nSHARED LEADERBOARD — TOP 20\n\n';
    try {
      const {entries} = await request('/api/leaderboard');
      const rows = entries.map((entry, index) => `${String(index + 1).padStart(2)}. ${entry.name.padEnd(24)} ${Number(entry.score).toLocaleString()}`).join('\n');
      return header + (rows || 'No scores yet. Go skate and set the first record!') + '\n\n------------------------------------------\nKonami-code runs do not qualify.\nScores are shared by everyone visiting this site.\nUpdated ' + new Date().toLocaleString();
    } catch { return header + 'Could not connect to the leaderboard.\nClick Refresh to try again.'; }
  }
  async function refreshNote() {
    const target = get('leaderboard-note');
    if (!target) return;
    target.value = 'Opening Leaderboard.txt…';
    const text = await note();
    if (get('leaderboard-note') === target) target.value = text;
  }
  function result(message, offerSubmit = false) {
    if (!get('ranked-result')) return;
    get('ranked-result').hidden = false;
    get('ranked-message').textContent = message;
    get('ranked-submit').hidden = !offerSubmit;
  }
  async function disqualify() {
    blocked = true;
    if (get('reset-upgrades')) get('reset-upgrades').hidden = false;
    result('Konami code used — this run is disqualified from the leaderboard.');
    if (!run) return;
    run.disqualified = true;
    const active = run;
    try {
      const credentials = await active.ready;
      if (credentials) await request(`/api/runs/${credentials.id}`, {token:credentials.token, action:'disqualify'});
    } catch { /* Submission stays blocked locally even when the connection fails. */ }
  }
  function startRun() {
    const active = {generation:++generation, disqualified:false, score:0, finished:false, submitted:false};
    active.ready = request('/api/runs', {cheated:false}).catch(() => null);
    run = active;
    if (get('ranked-result')) get('ranked-result').hidden = true;
  }
  async function stateChanged(state) {
    const previous = lastState;
    lastState = state;
    if (resetting && state.scene === 'Start' && !state.leaderboardDisqualified && !state.unlimitedUpgradePoints) {
      blocked = resetting = false; run = null; generation++;
      if (get('reset-upgrades')) get('reset-upgrades').hidden = true;
      if (get('ranked-result')) get('ranked-result').hidden = true;
    }
    if (state.leaderboardDisqualified || state.unlimitedUpgradePoints) {
      if (!blocked || (run && !run.disqualified)) void disqualify();
      return;
    }
    if (blocked) return;
    if (state.scene !== 'Map') { run = null; return; }
    if (!previous || previous.scene !== 'Map' || (previous.timer < 10 && state.timer > 80)) startRun();
    if (!run || run.disqualified) return;
    if (!run.finished) run.score = Math.max(0, Math.round(state.score));
    if (state.roundOver && !run.finished) {
      run.finished = true;
      const active = run;
      const credentials = await active.ready;
      if (active !== run || blocked) return;
      if (!credentials) result('The leaderboard connection failed for this run. Try a new round.');
      else if (active.score > 0) result(`Round complete: ${active.score.toLocaleString()} points.`, true);
      else result('Score some points next round to enter the leaderboard.');
    }
  }
  async function submit(event) {
    event.preventDefault();
    const active = run;
    if (!active || blocked || active.disqualified || !active.finished || active.submitted) return;
    const name = get('ranked-name').value.trim();
    if (!name) return;
    const button = get('ranked-submit-button'); button.disabled = true;
    try {
      const credentials = await active.ready;
      if (!credentials || active !== run || blocked) return;
      await request(`/api/runs/${credentials.id}`, {token:credentials.token, action:'submit', name, score:active.score});
      if (active.disqualified || blocked) { void disqualify(); return; }
      active.submitted = true;
      result('Score saved! Open Leaderboard.txt in Notepad to see the rankings.');
      if (window.parent !== window) window.parent.postMessage({type:'tony-eagle:score-saved'}, location.origin);
    } catch (error) { if (!blocked && active === run) result(error.message, true); }
    finally { button.disabled = false; }
  }
  function resetProgress() {
    if (!window.confirm('Reset all speed, jump, and spin upgrades to enter ranked play again?')) return;
    resetting = true;
    window.dispatchEvent(new CustomEvent('tony-eagle:reset-progress'));
  }
  window.TonyLeaderboard = {disqualify, refreshNote, resetProgress};
  window.addEventListener('tony-eagle:state', event => { void stateChanged(event.detail); });
  get('ranked-submit')?.addEventListener('submit', submit);
  get('reset-upgrades')?.addEventListener('click', resetProgress);
  get('leaderboard-open')?.addEventListener('click', () => {
    if (window.parent !== window) window.parent.postMessage({type:'tony-eagle:leaderboard'}, location.origin);
    else window.open('https://charles-perrault.github.io/?notepad=leaderboard', '_blank', 'noopener');
  });
})();
