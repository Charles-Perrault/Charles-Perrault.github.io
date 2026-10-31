(() => {
  'use strict';
  // Minutes, energy (1-3), maximum cost, creative medium.
  const ideas = [
  [
    "A website for one extremely specific opinion",
    "Make a single page defending an opinion like the best spoon shape. Start with a headline, three arguments, and one ridiculous diagram.",
    30,
    1,
    0,
    "code"
  ],
  [
    "A one-button sound machine",
    "Build a page with one enormous button that plays a sound you record. Start with the button and a five-second recording.",
    30,
    1,
    0,
    "code"
  ],
  [
    "A useless progress bar",
    "Make a progress bar for an imaginary task like downloading confidence. Start with one bar and five status messages.",
    30,
    1,
    0,
    "code"
  ],
  [
    "A tiny personal museum",
    "Build a page displaying three ordinary objects you own as priceless artifacts. Start by photographing the first object.",
    60,
    2,
    0,
    "code"
  ],
  [
    "A game with one key",
    "Build a game where one key makes a square jump over obstacles. Start with the square, a floor, and a jump.",
    120,
    3,
    0,
    "code"
  ],
  [
    "A fake operating system error",
    "Make an interactive error dialog for a problem computers should never have. Start by writing the error and two button labels.",
    30,
    1,
    0,
    "code"
  ],
  [
    "A pocket-sized habit tracker",
    "Build a page that checks off one habit and remembers it on this device. Start with a checkbox and local storage.",
    60,
    2,
    0,
    "code"
  ],
  [
    "An apology generator for inanimate objects",
    "Make a button that generates apologies from objects. Start with five objects, five offenses, and five excuses.",
    60,
    2,
    0,
    "code"
  ],
  [
    "An album cover for a band that does not exist",
    "Invent a band name and album title. Make a square cover using two colors and one object in your room.",
    30,
    1,
    0,
    "art"
  ],
  [
    "A warning sign for a harmless thing",
    "Design a very serious warning sign for a pillow, spoon, or sock. Start with a bold symbol and a six-word warning.",
    30,
    1,
    0,
    "art"
  ],
  [
    "A portrait made only of rectangles",
    "Draw a face using twelve rectangles and three colors. Start with the head shape and keep every edge straight.",
    30,
    1,
    0,
    "art"
  ],
  [
    "A poster for an imaginary local event",
    "Design a poster for an event like competitive sitting. Start with its title, date, and one oversized visual.",
    60,
    2,
    0,
    "art"
  ],
  [
    "A six-panel comic about a minor inconvenience",
    "Turn a small annoyance into an epic story. Start by drawing six empty boxes and writing the final punchline.",
    60,
    2,
    0,
    "art"
  ],
  [
    "An object redesigned for an alien",
    "Sketch a household item as if its designer had never met a human. Start with three absurd variations.",
    30,
    1,
    0,
    "art"
  ],
  [
    "A miniature illustrated field guide",
    "Make a one-page field guide to five types of people, clouds, or chairs. Start with five silhouettes and invented names.",
    120,
    3,
    0,
    "art"
  ],
  [
    "A complaint letter from your chair",
    "Write 200 words from your chair to you. Start with its biggest grievance and end with one unreasonable demand.",
    30,
    1,
    0,
    "writing"
  ],
  [
    "A story told through five notifications",
    "Tell a complete story using only five phone notifications. Start with an ordinary notification and make the last one change its meaning.",
    30,
    1,
    0,
    "writing"
  ],
  [
    "Instructions for an impossible task",
    "Write a short manual for folding a shadow or returning a Tuesday. Start with a materials list and five steps.",
    30,
    1,
    0,
    "writing"
  ],
  [
    "A review of a place that does not exist",
    "Write a one-star review of an imaginary location. Start with one strangely specific detail that makes it feel real.",
    30,
    1,
    0,
    "writing"
  ],
  [
    "A story with one room and one strange rule",
    "Write a 700-word story set in one room where one ordinary action is forbidden. Start with someone breaking the rule.",
    120,
    3,
    0,
    "writing"
  ],
  [
    "A tiny newspaper from tomorrow",
    "Make a page with three fictional headlines, a classified ad, and the weather. Start with a headline about a very small disaster.",
    60,
    2,
    0,
    "writing"
  ],
  [
    "A poem made of overheard fragments",
    "Write twelve lines using phrases you remember hearing today. Start with the weirdest phrase and repeat it at the end.",
    30,
    1,
    0,
    "writing"
  ],
  [
    "A beat made from your desk",
    "Record three desk sounds and arrange a twenty-second loop with tools you already have. Start with a tap, a scrape, and a knock.",
    30,
    1,
    0,
    "music"
  ],
  [
    "A theme song for an ordinary object",
    "Make a twenty-second theme for your lamp, shoe, or kettle. Start by humming a four-note melody into your phone.",
    30,
    1,
    0,
    "music"
  ],
  [
    "A fake radio station ident",
    "Record a ten-second station announcement for a fictional radio station. Start with its name and one absurd slogan.",
    30,
    1,
    0,
    "music"
  ],
  [
    "A tiny soundtrack for a made-up game",
    "Make a one-minute loop for an imaginary game menu. Start with a repeating four-note pattern and one contrasting layer.",
    60,
    2,
    0,
    "music"
  ],
  [
    "A room turned into a soundscape",
    "Record five sounds around you and arrange a one-minute audio scene. Start with thirty seconds of room tone.",
    60,
    2,
    0,
    "music"
  ],
  [
    "A song with only three sounds",
    "Use a voice, a clap, and one other sound to make a ninety-second track. Start with an eight-beat rhythm.",
    120,
    3,
    0,
    "music"
  ],
  [
    "A dramatic documentary about a spoon",
    "Film a thirty-second documentary treating an ordinary object as historically significant. Start with a close-up and a very serious opening line.",
    30,
    1,
    0,
    "video"
  ],
  [
    "An advertisement for something nobody needs",
    "Film a twenty-second commercial for a useless invention. Start with an exaggerated problem and demonstrate the solution with household objects.",
    30,
    1,
    0,
    "video"
  ],
  [
    "A five-shot story with no dialogue",
    "Tell a tiny story using exactly five shots and no spoken words. Start by listing the five images.",
    60,
    2,
    0,
    "video"
  ],
  [
    "A stop-motion escape attempt",
    "Make an object cross your desk in ten seconds of stop motion. Start with a locked camera position and ten photos.",
    60,
    2,
    0,
    "video"
  ],
  [
    "An ordinary task as a thriller",
    "Film making a drink or putting on shoes as a suspense scene. Start with three extreme close-ups.",
    30,
    1,
    0,
    "video"
  ],
  [
    "A one-minute fake movie trailer",
    "Create a trailer for a film about a petty problem. Start with three title cards and an ominous voice-over.",
    120,
    3,
    0,
    "video"
  ],
  [
    "A tiny paper creature",
    "Fold or cut scrap paper into a creature that can stand up. Start with its body, then give it a name and one bad habit.",
    30,
    1,
    0,
    "physical"
  ],
  [
    "A museum label for something you own",
    "Make a physical museum label for an ordinary object. Start with its title, invented origin, and an absurd estimated value.",
    30,
    1,
    0,
    "physical"
  ],
  [
    "A miniature zine from one sheet",
    "Fold a sheet into a tiny booklet about one very specific obsession. Start with the cover and one page of facts or drawings.",
    60,
    2,
    0,
    "physical"
  ],
  [
    "A cardboard monument to a small achievement",
    "Use packaging you already have to build a trophy for something like answering an email. Start with the base and its inscription.",
    60,
    2,
    0,
    "physical"
  ],
  [
    "A board game on one sheet of paper",
    "Make a two-player game using a hand-drawn board and household objects as pieces. Start with the win condition and one rule.",
    120,
    3,
    0,
    "physical"
  ],
  [
    "A postcard from an imaginary town",
    "Make a postcard using scrap paper and whatever drawing supplies you own. Start with the town name and its least impressive landmark.",
    30,
    1,
    0,
    "physical"
  ],
  [
    "A pocket notebook with a ridiculous purpose",
    "Use up to $10 of paper and basic supplies to make a notebook for one absurd category of observations. Start by designing its cover.",
    60,
    2,
    10,
    "physical"
  ],
  [
    "A tiny diorama of an impossible room",
    "Use packaging and up to $25 of supplies to build a room with one impossible feature. Start with a shoebox-sized floor plan.",
    120,
    3,
    25,
    "physical"
  ]
].map(([title, steps, time, energy, budget, medium], id) => ({id: `create-${id}`, title, steps, time, energy, budget, medium}));
  const $ = id => document.getElementById(id);
  const key = 'creative-decision-v1';
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
  for (const id of ['time', 'energy', 'budget', 'medium', 'custom']) {
    if (typeof state.settings[id] === 'string') {
      if (id === 'custom') $(id).value = state.settings[id].slice(0, 10000);
      else if ([...$(id).options].some(option => option.value === state.settings[id])) $(id).value = state.settings[id];
    }
  }
  function settings() { return Object.fromEntries(['time', 'energy', 'budget', 'medium', 'custom'].map(id => [id, $(id).value])); }
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
    let pool = custom.length ? custom.map(title => ({id: `custom:${title}`, title, steps: 'This is your plan.', custom: true})) : ideas.filter(x => x.time <= +s.time && x.energy <= +s.energy && x.budget <= +s.budget && (s.medium === 'any' || x.medium === s.medium));
    if (!pool.length) { $('message').textContent = 'No matching ideas. Change a filter or add your own options.'; return; }
    const recent = new Set(state.history.slice(0, 7).map(x => x.id));
    const fresh = pool.filter(x => !recent.has(x.id) && x.id !== state.current?.id);
    if (fresh.length) pool = fresh;
    else if (pool.some(x => x.id !== state.current?.id)) pool = pool.filter(x => x.id !== state.current?.id);
    else if (force) $('message').textContent = 'That is the only matching option. Add another or change your filters for a different choice.';
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    const item = pool[Math.floor(random[0] / 4294967296 * pool.length)];
    state.current = {...item, date: today(), accepted: false, reason: item.custom ? 'Picked from your own options.' : `${item.time} min · ${item.budget ? `Up to $${item.budget}` : '$0'} · ${$('medium').options[[...$('medium').options].findIndex(option => option.value === item.medium)].text} · Matches your filters`};
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
