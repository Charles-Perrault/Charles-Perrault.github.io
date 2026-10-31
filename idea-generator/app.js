(() => {
  'use strict';
  // Minutes, energy (1–3), maximum cost, setting, company.
  const ideas = [
    ['Comfort episode', 'Put on one episode of a show you already love. Get comfortable and let the credits roll.', 30, 1, 0, 'home', 'any'],
    ['An album, front to back', 'Pick an album you already have access to. Put your phone down and listen in order.', 60, 1, 0, 'home', 'any'],
    ['Movie night', 'Choose a movie from your existing watchlist or collection. Start it before browsing for another.', 120, 1, 0, 'home', 'any'],
    ['Read one chapter', 'Grab a book you already own. Read a chapter somewhere comfortable.', 30, 1, 0, 'home', 'any'],
    ['The photo rabbit hole', 'Open an old photo album. Pick five favorites and enjoy the memories.', 30, 1, 0, 'home', 'any'],
    ['A real phone call', 'Call someone you miss. Ask what the best part of their week was.', 30, 1, 0, 'home', 'solo'],
    ['Draw something badly', 'Get paper and a pen. Draw whatever is in front of you for ten minutes. Skill is irrelevant.', 30, 1, 0, 'home', 'any'],
    ['Trade favorite songs', 'Take turns playing three favorite songs. Each person gets to explain one pick.', 30, 1, 0, 'home', 'together'],
    ['Cards on the table', 'Grab a deck of cards you already have and play a familiar game.', 60, 1, 0, 'home', 'together'],
    ['Play an old favorite', 'Launch a game you already own. Play for one session, then stop at a natural break.', 60, 1, 0, 'home', 'any'],
    ['Make the easy dinner', 'Make a meal you already know with ingredients you have. Put on music while you cook.', 60, 2, 0, 'home', 'any'],
    ['Fix one tiny thing', 'Choose one small annoyance in your room. Spend fifteen minutes fixing it, then call it done.', 30, 2, 0, 'home', 'any'],
    ['Make a ridiculous playlist', 'Pick a very specific theme and build a ten-song playlist from music you know.', 30, 1, 0, 'home', 'any'],
    ['Write tomorrow a favor', 'Write down tomorrow’s first task and set out what you need. Spend the rest of the evening relaxing.', 30, 1, 0, 'home', 'any'],
    ['Dessert experiment', 'Make a simple dessert with ingredients you have, or spend up to $10 on what is missing.', 60, 2, 10, 'home', 'any'],
    ['Living-room picnic', 'Make snacks from what you have. Sit somewhere other than the usual table and leave your phone aside.', 30, 1, 0, 'home', 'any'],
    ['Step outside', 'Sit outside near home for ten minutes. Notice the sounds and let yourself do nothing.', 30, 1, 0, 'out', 'any'],
    ['A short familiar walk', 'Take a short walk on a familiar, well-lit route. Turn back halfway through your available time.', 30, 2, 0, 'out', 'any'],
    ['Look at the sky', 'Find a comfortable spot near home and spend ten minutes looking at the sky.', 30, 1, 0, 'out', 'any'],
    ['A camera walk', 'Take a familiar route and photograph five things you usually overlook.', 60, 2, 0, 'out', 'any'],
    ['A little treat', 'Walk to a familiar nearby place that is open. Choose one snack within $10, then enjoy it without scrolling.', 60, 2, 10, 'out', 'any'],
    ['Catch up outside', 'Sit outside together and take turns sharing a good thing, a bad thing, and a weird thing from today.', 30, 1, 0, 'out', 'together'],
    ['Explore a familiar route', 'Walk a longer version of a route you know. Pick one interesting detail to tell someone about later.', 120, 3, 0, 'out', 'any'],
    ['Dinner with no menu spiral', 'Go to a familiar nearby place you know is open. Order your usual within $25.', 120, 2, 25, 'out', 'any']
  ].map(([title, steps, time, energy, budget, place, company], id) => ({id: `idea-${id}`, title, steps, time, energy, budget, place, company}));
  const $ = id => document.getElementById(id);
  const key = 'nightly-idea-generator-v1';
  const today = () => new Date().toLocaleDateString('en-CA');
  let state = {history: [], settings: {}, current: null};
  let storageWorks = true;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved === 'object') {
      if (Array.isArray(saved.history)) state.history = saved.history.filter(x => x && typeof x.title === 'string' && typeof x.date === 'string').slice(0, 30);
      if (saved.settings && typeof saved.settings === 'object') state.settings = saved.settings;
      if (saved.current && typeof saved.current.title === 'string' && typeof saved.current.steps === 'string' && typeof saved.current.date === 'string') state.current = saved.current;
    }
  } catch { /* An empty or unavailable store should never prevent a decision. */ }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch { storageWorks = false; $('status').textContent = 'Session only — storage unavailable'; }
  }
  for (const id of ['time', 'energy', 'budget', 'company', 'place', 'custom']) {
    if (typeof state.settings[id] === 'string') {
      if (id === 'custom') $(id).value = state.settings[id].slice(0, 10000);
      else if ([...$(id).options].some(option => option.value === state.settings[id])) $(id).value = state.settings[id];
    }
  }
  function settings() { return Object.fromEntries(['time', 'energy', 'budget', 'company', 'place', 'custom'].map(id => [id, $(id).value])); }
  function history() {
    $('history').replaceChildren();
    if (!state.history.length) { const li = document.createElement('li'); li.textContent = 'No decisions yet.'; $('history').append(li); }
    for (const item of state.history) { const li = document.createElement('li'); li.textContent = `${item.date}: ${item.title}`; $('history').append(li); }
  }
  function render() {
    const item = state.current;
    if (!item) return;
    $('result').hidden = false;
    $('choice').textContent = item.title;
    $('steps').textContent = item.steps;
    $('reason').textContent = item.reason || '';
    $('accept').textContent = item.accepted ? 'Decided ✓' : 'Doing this';
    $('accept').disabled = !!item.accepted;
    if (storageWorks) $('status').textContent = item.accepted ? 'Decided' : 'One decision. Ready to go.';
  }
  function choose(force) {
    const s = settings();
    state.settings = s;
    $('message').textContent = '';
    const custom = [...new Set(s.custom.split('\n').map(x => x.trim()).filter(Boolean))];
    let pool = custom.length ? custom.map(title => ({id: `custom:${title}`, title, steps: 'This is your plan.', custom: true})) : ideas.filter(x => x.time <= +s.time && x.energy <= +s.energy && x.budget <= +s.budget && (s.place === 'either' || x.place === s.place) && (x.company === 'any' || x.company === s.company));
    if (!pool.length) { $('message').textContent = 'No matching ideas. Change a filter or add your own options.'; return; }
    const recent = new Set(state.history.slice(0, 7).map(x => x.id));
    const fresh = pool.filter(x => !recent.has(x.id) && x.id !== state.current?.id);
    if (fresh.length) pool = fresh;
    else if (pool.some(x => x.id !== state.current?.id)) pool = pool.filter(x => x.id !== state.current?.id);
    else if (force) $('message').textContent = 'That is the only matching option. Add another or change your filters for a different choice.';
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    const item = pool[Math.floor(random[0] / 4294967296 * pool.length)];
    state.current = {...item, date: today(), accepted: false, reason: item.custom ? 'Picked from your own options.' : `${item.time} min · ${item.budget ? `Up to $${item.budget}` : '$0'} · ${item.place === 'home' ? 'Staying in' : 'Going out'} · Matches tonight’s filters`};
    save(); render();
  }
  $('settings').addEventListener('submit', e => { e.preventDefault(); choose(false); });
  $('settings').addEventListener('input', () => { state.settings = settings(); save(); });
  $('reroll').addEventListener('click', () => choose(true));
  $('accept').addEventListener('click', () => {
    if (!state.current || state.current.accepted) return;
    state.current.accepted = true;
    state.history.unshift({id: state.current.id, title: state.current.title, date: state.current.date});
    state.history = state.history.slice(0, 30); save(); history(); render();
  });
  $('clear').addEventListener('click', () => { state.history = []; save(); history(); });
  if (state.current?.date === today()) render();
  history();
})();
