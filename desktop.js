(() => {
  const stockIcons = {
    photos: 'photos', computer: 'computer', folder: 'folder',
    document: 'document', mail: 'mail', globe: 'browser', recycle: 'recycle-full',
    notepad: 'notepad', windows: 'windows', speaker: 'speaker'
  };
  const napsterIcon = '<svg class="pixel-icon" aria-hidden="true" viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#2872c8" stroke="#000" d="M5 14V7l7 4h8l7-4v7c4 16-26 16-22 0z"/><path fill="none" stroke="#000" stroke-width="3" d="M3 18v-5a13 13 0 0 1 26 0v5"/><path fill="#c0c0c0" stroke="#000" d="M1 14h5v10H1zm25 0h5v10h-5z"/><path fill="#fff" d="m9 16 5 2-4 2zm14 0-5 2 4 2z"/></svg>';
  const icon = (name, size = 32) => name === 'napster' ? napsterIcon : name === 'gurt' ? '<img class="pixel-icon gurt-icon" src="assets/gurt-icon.png" alt="" width="32" height="38">' : name === 'bench' ? '<img class="pixel-icon bench-icon" src="assets/bench-press-study.png" alt="" width="50" height="36">' : name === 'skateboard' ? '<img class="pixel-icon game-icon" src="assets/tony-eagle.png" alt="" width="64" height="36">' : `<img class="pixel-icon stock-icon" src="assets/icons/win95/${stockIcons[name] || 'document'}-${size}.png" alt="" width="${size}" height="${size}">`;
  const portfolio = document.querySelector('body > .window');
  portfolio.id = 'portfolio';
  portfolio.setAttribute('aria-label', 'Charles Perrault — Home Page');
  portfolio.querySelector('.title .icon').outerHTML = icon('globe', 16);
  portfolio.querySelector('.winbtns').innerHTML = '<button type="button" data-window-action="minimize" aria-label="Minimize Home Page">_</button><button type="button" data-window-action="maximize" aria-label="Maximize Home Page">□</button><button type="button" data-window-action="close" aria-label="Close Home Page">×</button>';
  const shortcuts = [
    ['computer', 'My Computer', 'computer'], ['globe', 'About Me', 'portfolio'],
    ['notepad', 'Notepad', 'notepad'], ['mail', 'Email', 'mailto:cbperrault@gmail.com'],
    ['document', 'Resume', 'Charles_Perrault_Resume_v1.2.2.pdf'],
    ['globe', 'GitHub', 'https://github.com/charles-perrault'],
    ['recycle', 'Recycle Bin', 'recycle'], ['skateboard', 'Tony Eagle', 'tony-eagle'],
    ['bench', 'Bench Press Study', 'bench-press-study'],
    ['napster', 'Napster', 'napster'], ['photos', 'Photos', 'photo-carousel'], ['gurt', 'gurt', 'gurt']
  ];
  function shortcut([image, label, action], className) {
    const link = /^(https:|mailto:)|\.pdf$/.test(action);
    return link ? `<a class="${className}" href="${action}" ${action.startsWith('mailto:') ? '' : 'target="_blank" rel="noopener noreferrer"'}>${icon(image)}<span>${label}</span></a>` : `<button type="button" class="${className}" data-open="${action}">${icon(image)}<span>${label}</span></button>`;
  }
  document.body.insertAdjacentHTML('afterbegin', `<main class="desktop" aria-label="Windows 95 desktop"><nav class="desktop-icons" aria-label="Desktop shortcuts">${shortcuts.map(s => shortcut(s, 'desktop-icon')).join('')}</nav></main>`);
  document.body.insertAdjacentHTML('beforeend', `<section class="start-menu" id="start-menu" aria-label="Start menu" hidden><div class="start-brand">Windows <b>95</b></div><nav class="start-items">${shortcut(['globe', 'About Me', 'portfolio'], 'start-item')}${shortcut(['computer', 'My Computer', 'computer'], 'start-item')}${shortcut(['notepad', 'Notepad', 'notepad'], 'start-item')}${shortcut(['bench', 'Bench Press Study', 'bench-press-study'], 'start-item')}${shortcut(['napster', 'Napster', 'napster'], 'start-item')}${shortcut(['photos', 'Photos', 'photo-carousel'], 'start-item')}${shortcut(['gurt', 'gurt', 'gurt'], 'start-item')}${shortcut(['skateboard', 'Tony Eagle', 'tony-eagle'], 'start-item')}<hr>${shortcut(['mail', 'Email Charles', 'mailto:cbperrault@gmail.com'], 'start-item')}</nav></section><footer class="taskbar" aria-label="Taskbar"><button class="taskbar-button start-button" id="start-button" aria-expanded="false" aria-controls="start-menu">${icon('windows', 16)}Start</button><div class="task-divider"></div><button class="taskbar-button task-button" id="portfolio-task" aria-pressed="true">${icon('globe', 16)}<span>Charles Perrault — Home Page</span></button><button class="taskbar-button task-button" id="utility-task" hidden></button><div class="system-tray">${icon('speaker', 16)}<time id="desktop-clock" aria-label="Local time"></time></div></footer><section class="window utility-window" id="utility" aria-labelledby="utility-title" hidden><div class="titlebar"><div class="title" id="utility-title"></div><div class="winbtns"><button type="button" data-window-action="minimize" aria-label="Minimize utility window">_</button><button type="button" data-window-action="maximize" aria-label="Maximize utility window">□</button><button type="button" data-window-action="close" aria-label="Close utility window">×</button></div></div><div class="utility-content" id="utility-content"></div></section>`);
  document.body.insertAdjacentHTML('beforeend', `<section class="window game-window" id="tony-eagle" aria-labelledby="game-title" hidden><div class="titlebar"><div class="title" id="game-title">${icon('skateboard')}Tony Eagle — Amateur Skateboarding</div><div class="winbtns"><button type="button" data-window-action="minimize" aria-label="Minimize Tony Eagle">_</button><button type="button" data-window-action="maximize" aria-label="Maximize Tony Eagle">□</button><button type="button" data-window-action="close" aria-label="Close Tony Eagle">×</button></div></div><div class="game-toolbar"><span>Arrows / WASD: move · Hold Space / B, release to jump</span><button type="button" id="game-fullscreen">Fullscreen</button><a href="games/tony-eagle/index.html?v=3" target="_blank" rel="noopener noreferrer">Open standalone ↗</a></div><iframe id="game-frame" title="Tony Eagle game" allow="fullscreen; autoplay; gamepad" allowfullscreen></iframe></section>`);
  document.getElementById('utility-task').insertAdjacentHTML('afterend', `<button class="taskbar-button task-button" id="game-task" aria-pressed="false" hidden>${icon('skateboard')}<span>Tony Eagle</span></button>`);
  const game = document.getElementById('tony-eagle');
  const gameFrame = document.getElementById('game-frame');
  const gameTask = document.getElementById('game-task');
  const hostOrigin = window.location.origin;
  function pauseGame() {
    if (gameFrame.contentWindow && gameFrame.hasAttribute('src')) gameFrame.contentWindow.postMessage({ type: 'tony-eagle:pause' }, hostOrigin);
  }
  function openGame() {
    if (!gameFrame.hasAttribute('src')) gameFrame.src = 'games/tony-eagle/index.html?v=3';
    gameTask.hidden = false; gameTask.setAttribute('aria-pressed', 'true');
    focusWindow(game);
    gameFrame.focus();
  }
  gameTask.addEventListener('click', () => {
    if (game.hidden) openGame();
    else { game.hidden = true; gameTask.setAttribute('aria-pressed', 'false'); pauseGame(); }
  });
  document.getElementById('game-fullscreen').addEventListener('click', async () => {
    try { await gameFrame.requestFullscreen(); gameFrame.focus(); }
    catch { openGame(); }
  });
  window.addEventListener('message', event => {
    if (event.origin !== hostOrigin || event.source !== gameFrame.contentWindow) return;
    if (event.data?.type === 'tony-eagle:focus') focusWindow(game);
    if (event.data?.type === 'tony-eagle:ready' && game.hidden) pauseGame();
    if (event.data?.type === 'tony-eagle:leaderboard') document.querySelector('[data-open="notepad"]').click();
    if (event.data?.type === 'tony-eagle:score-saved') window.TonyLeaderboard?.refreshNote();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  const utility = document.getElementById('utility');
  const task = document.getElementById('portfolio-task');
  const utilityTask = document.getElementById('utility-task');
  const start = document.getElementById('start-button');
  const startMenu = document.getElementById('start-menu');
  let layer = 10;
  function focusWindow(win) { win.hidden = false; if (layer >= 89) { document.querySelectorAll('body > .window').forEach((window, index) => { window.style.zIndex = 10 + index; }); layer = 10 + document.querySelectorAll('body > .window').length; } win.style.zIndex = ++layer; if (win !== game) pauseGame(); }
  function closeStart() { startMenu.hidden = true; start.setAttribute('aria-expanded', 'false'); }
  start.addEventListener('click', e => { e.stopPropagation(); startMenu.hidden = !startMenu.hidden; start.setAttribute('aria-expanded', String(!startMenu.hidden)); });
  document.addEventListener('click', e => { if (!startMenu.contains(e.target)) closeStart(); });
  task.addEventListener('click', () => { portfolio.hidden = !portfolio.hidden; task.setAttribute('aria-pressed', String(!portfolio.hidden)); if (!portfolio.hidden) focusWindow(portfolio); });
  utilityTask.addEventListener('click', () => { utility.hidden = !utility.hidden; utilityTask.setAttribute('aria-pressed', String(!utility.hidden)); if (!utility.hidden) focusWindow(utility); });
  const benchSections = [["I", "Intro", ["Based on a study by Julia Cox et al. me and my friend have decided to try the bench press training protocol from the study in an attempt to learn new information and also increase our own strength. The biggest piece of information we stood to learn from this experiment was the effectiveness of a different approach towards volume. In the Cox et al. experiment, participants worked up to their 1RM and then did 5 sets of either 90% of that for 2, or 85% of that for 3. In this experiment, we are choosing to do 2 sets of between 85-90%, with 0 reps in reserve."]], ["II", "Methods", ["Every day, we agreed on a time to meet to perform the lifts.", "We defined proper bench press form as laying on one’s back with an arched back, with only the head, shoulders, and glutes touching the bench. Participants were instructed to use the grip width that felt strongest to them, which each participant already knew, as all participants had prior experience benching and only used the grip width that they felt maximized strength. For both participants, this very approximately made the distance between the hand and shoulder equal to the distance between the shoulder and the center of the body.", "The participants worked up to their one rep maximum, and they did this by starting with something close to their max that they were reasonably sure they could press, and then they added 5 pounds repeatedly, waiting at least 2.5 minutes between attempts.", "The participants stopped adding weight either when they failed, or when it became obvious (from very slow rep speed) that the subject would be unable to press a weight 5 lbs heavier.", "The participants considered each participant’s “one rep max” as the highest weight they could successfully lower to their chest at around nipple height and press back up until their elbows were locked out on a flat bench using a barbell loaded with weight plates.", "The participants then multiplied this weight by 0.85 and 0.9, and found a suitable weight in between those two values that could be loaded onto a barbell with only 5 lb increments.", "After waiting 2.5 minutes, participants were instructed to press that weight as many times as they could, stopping when they did not think they could press it another time. This kind of intensity is called “0 RIR,” which means zero reps are left in reserve. Sometimes the participants reached muscular failure, where they attempted another rep but failed to press the weight up or fully lock out their arms. The participants did this twice, waiting 2.5 minutes in between."]], ["III", "Limitations", ["We couldn’t get exactly 85% or 90% of the 1rm numbers, as was the original plan, because we immediately saw we could only vary the weight in increments of 5 lbs as the lightest weight plates were 2.5 lbs. However, we tried to just get within 85-90% and we judged that as sufficiently controlled."]], ["IV", "Results", ["Work in progress"]], ["V", "Reflection", ["Work in progress"]]];
  const benchResults = `<section class="study-results"><h2>IV. Results</h2><div class="study-results-layout"><div class="study-results-data"><p>WORK IN PROGRESS</p><ul><li><strong>Starting one-rep maxes</strong><ul><li>Charlie: 165 lbs</li><li>Lucas: 130 lbs</li></ul></li><li><strong>Current highest one-rep maxes</strong><ul><li>Charlie: <span data-result="current-charlie">Loading...</span></li><li>Lucas: <span data-result="current-lucas">Loading...</span></li></ul></li><li><strong>Projected maxes by 11/22/2026 (very accurate)</strong><ul><li>Charlie: <span data-result="projected-charlie">Loading...</span></li><li>Lucas: <span data-result="projected-lucas">Loading...</span></li></ul></li></ul></div><a class="study-chart" href="https://docs.google.com/spreadsheets/d/1D7ep2dRfMzbV1DDvGQ7n3vDFC4zSjxMtq-fs5Fb24-0/edit#gid=1256876327" target="_blank" rel="noopener noreferrer" aria-label="Open graph in Google Sheets"><img id="study-chart" src="https://docs.google.com/spreadsheets/d/1D7ep2dRfMzbV1DDvGQ7n3vDFC4zSjxMtq-fs5Fb24-0/embed/oimg?id=1D7ep2dRfMzbV1DDvGQ7n3vDFC4zSjxMtq-fs5Fb24-0&amp;oid=1117997804" alt="Bench Press One-Rep Max Over Time: Charlie and Lucas" width="600" height="371" loading="lazy"></a></div></section>`;
  const benchContent = benchSections.map(([numeral, title, bullets]) => title === 'Results' ? benchResults :
    `<section><h2>${numeral}. ${title}</h2><ul>${bullets.map(text => `<li>${text}</li>`).join('')}</ul></section>`
  ).join('');
  const trashFiles = [
    ['document', 'Negative attitudes.txt', 'trash-negative'],
    ['document', 'Distractions.txt', 'trash-distractions'],
    ['photos', 'A full fish skeleton.png', 'trash-fish'],
    ['folder', 'Your mom.zip', 'trash-mom'],
    ['document', 'Laziness.txt', 'trash-laziness']
  ];
  const pages = {
    'bench-press-study': ['bench', 'Bench Press Study — Microsoft Word', `<div class="word-toolbar"><span>Times New Roman</span><span>12</span><a class="standalone-link" href="?app=bench-press-study" target="_blank" rel="noopener noreferrer">Open in new tab</a><button type="button" class="study-print" id="print-study">Print / Save PDF</button><a href="documents/Bench%20Press%20Study.docx" download="Bench Press Study.docx">Download Word document</a></div><div class="word-workspace"><article class="word-paper" aria-label="Bench Press Study document"><h1 class="standalone-study-title">Bench Press Study</h1>${benchContent}<p class="results-announcement">Full results coming November 22nd!</p></article></div><div class="word-status">Bench Press Study <span id="study-sync-status" aria-live="polite"></span></div>`],
    computer: ['computer', 'My Computer', `<div class="file-grid">${[shortcuts[1], shortcuts[2]].map(s => shortcut(s, 'desktop-icon')).join('')}</div>`],
    recycle: ['recycle', 'Recycle Bin', `<div class="file-grid">${trashFiles.map(file => shortcut(file, 'desktop-icon')).join('')}</div><p class="utility-note">${trashFiles.length} objects</p>`],
    notepad: ['notepad', 'Leaderboard.txt — Notepad', '<div class="notepad-files"><button type="button" data-note="leaderboard" aria-pressed="true">Leaderboard.txt</button><button type="button" data-note="scratch" aria-pressed="false">Untitled</button></div><textarea class="notepad" id="leaderboard-note" aria-label="Leaderboard.txt"></textarea><textarea class="notepad" id="notes" aria-label="Untitled note" hidden></textarea>'],
  };
  const trashBack = '<div class="notepad-files"><button type="button" data-open="recycle">Back to Recycle Bin</button></div>';
  for (const [id, title, content] of [
    ['trash-negative', 'Negative attitudes.txt', 'meanness, arrogance, being A CHUD, ego'],
    ['trash-distractions', 'Distractions.txt', 'Fortnite OG and Young Sheldon Youtube Shorts clips'],
    ['trash-laziness', 'Laziness.txt', "I'll put something here later"]
  ]) {
    pages[id] = ['notepad', title + ' — Notepad', `${trashBack}<textarea class="notepad" aria-label="${title}" readonly>${content}</textarea>`];
  }
  pages['trash-fish'] = ['photos', 'A full fish skeleton.png', `${trashBack}<div class="trash-image"><img src="assets/fish-skeleton.png" alt="A full fish skeleton" width="500" height="500"></div>`];
  pages['trash-mom'] = ['folder', 'Your mom.zip', '<div class="zip-opening" role="status">Opening Your mom.zip...</div><div class="zip-error" role="alert" hidden><h2>Error</h2><p>file too large!</p></div>'];
  // Keep the study independent of the shared desktop utility window.
  document.body.insertAdjacentHTML('beforeend', `<section class="window utility-window word-window" id="bench-study" aria-labelledby="bench-title" hidden><div class="titlebar"><div class="title" id="bench-title">${icon('bench')}Bench Press Study — Microsoft Word</div><div class="winbtns"><button type="button" data-window-action="minimize" aria-label="Minimize Bench Press Study">_</button><button type="button" data-window-action="maximize" aria-label="Maximize Bench Press Study">□</button><button type="button" data-window-action="close" aria-label="Close Bench Press Study">×</button></div></div><div class="utility-content">${pages['bench-press-study'][2]}</div></section>`);
  const bench = document.getElementById('bench-study');
  utilityTask.insertAdjacentHTML('afterend', `<button class="taskbar-button task-button" id="bench-task" aria-pressed="false" hidden>${icon('bench')}<span>Bench Press Study</span></button>`);
  const benchTask = document.getElementById('bench-task');
  function openBench() {
    benchTask.hidden = false;
    benchTask.setAttribute('aria-pressed', 'true');
    focusWindow(bench);
    document.dispatchEvent(new Event('bench-study-open'));
  }
  benchTask.addEventListener('click', () => {
    if (bench.hidden) openBench();
    else { bench.hidden = true; benchTask.setAttribute('aria-pressed', 'false'); }
  });
  const photos = [
    {src: 'assets/photos/portrait-01.png', alt: 'gurt', year: 2025, label: 'gurt'},
    {src: 'assets/photos/gallery/1681573395125987102.jpeg', alt: 'Person standing on a boulder above a foggy forest', year: 2025},
    {src: 'assets/photos/gallery/7247057647173750472.jpeg', alt: 'Stream in a mossy forest', year: 2025},
    {src: 'assets/photos/gallery/FullSizeRender.jpeg', alt: 'Person leaning beside a car at night', year: 2025},
    {src: 'assets/photos/gallery/IMG_1371.jpeg', alt: 'Silhouette standing on an indoor platform', year: 2025},
    {src: 'assets/photos/gallery/IMG_1908.jpeg', alt: 'Rocky desert landscape with cacti', year: 2025},
    {src: 'assets/photos/gallery/IMG_1999.jpeg', alt: 'A close-up selfie', year: 2019},
    {src: 'assets/photos/gallery/IMG_2018.jpeg', alt: 'Person looking across a construction site at night', year: 2025},
    {src: 'assets/photos/gallery/IMG_2020.jpeg', alt: 'A door marked “These doors must remain closed”', year: 2025},
    {src: 'assets/photos/gallery/IMG_2243.jpeg', alt: 'Person beside a snowy mountain lake', year: 2023},
    {src: 'assets/photos/gallery/IMG_4276.jpeg', alt: 'Friends taking a close-up selfie', year: 2025},
    {src: 'assets/photos/gallery/IMG_6208.jpeg', alt: 'Selfie with a friend', year: 2026},
    {src: 'assets/photos/gallery/IMG_7051.jpeg', alt: 'Mountain landscape at sunset', year: 2024},
    {src: 'assets/photos/gallery/IMG_7089.jpeg', alt: 'Friends with Gold Medal Burger certificates', year: 2024},
    {src: 'assets/photos/gallery/IMG_7143.jpeg', alt: 'Person giving a thumbs-up in a green mountain landscape', year: 2023},
    {src: 'assets/photos/gallery/IMG_8313.jpeg', alt: 'Two friends posing in front of a brick wall', year: 2026},
    {src: 'assets/photos/gallery/IMG_8737.jpeg', alt: 'Pink sunset behind silhouetted trees', year: 2025},
    {src: 'assets/photos/gallery/IMG_9618.jpeg', alt: 'Person standing in a rocky stream', year: 2025},
    {src: 'assets/photos/gallery/IMG_9734.jpeg', alt: 'Person standing on a bench outdoors', year: 2026},
    {src: 'assets/photos/gallery/P1070303_Original.jpeg', alt: 'Person standing outside in falling snow at night', year: 2025},
    {src: 'assets/photos/gallery/PXL_20250612_192359493_Original.jpeg', alt: 'Person looking at a waterfall in a green forest', year: 2025}
  ].sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity));
  let photoIndex = 0;
  const photoYears = [...new Set(photos.map(photo => photo.year ?? 'Year unknown'))];
  const photoGallery = photoYears.map(year => `<section class="photo-year-group"><h3>${year}</h3><div class="photo-gallery-grid">${photos.map((photo, index) => ({photo, index})).filter(({photo}) => (photo.year ?? 'Year unknown') === year).map(({photo, index}) => `<button class="photo-thumb" type="button" data-photo-index="${index}" aria-label="${photo.alt}, ${photo.year ?? 'year unknown'}" aria-current="${index === photoIndex}"><img src="${photo.src}" alt="">${photo.label ? `<span>${photo.label}</span>` : ''}</button>`).join('')}</div></section>`).join('');
  const photoViewer = `<div class="photo-toolbar"><a class="standalone-link" href="?app=photos" target="_blank" rel="noopener noreferrer">Open in new tab</a></div><div class="photo-stage"><img id="photo-image" src="${photos[0].src}" alt="${photos[0].alt}"></div><div class="photo-controls"><button type="button" id="previous-photo" aria-label="Previous photo">&larr; Previous</button><span id="photo-position" aria-live="polite"></span><button type="button" id="next-photo" aria-label="Next photo">Next &rarr;</button></div><div class="photo-gallery" aria-label="Photos grouped by year">${photoGallery}</div>`;
  const placeholderApps = new Map();
  for (const [id, image, title] of [['napster', 'napster', 'Napster'], ['photo-carousel', 'photos', 'Photos']]) {
    document.body.insertAdjacentHTML('beforeend', `<section class="window utility-window placeholder-window ${id === 'photo-carousel' ? 'photos-window' : ''}" id="${id}" aria-labelledby="${id}-title" hidden><div class="titlebar"><div class="title" id="${id}-title">${icon(image, 16)}${title}</div><div class="winbtns"><button type="button" data-window-action="minimize" aria-label="Minimize ${title}">_</button><button type="button" data-window-action="maximize" aria-label="Maximize ${title}">□</button><button type="button" data-window-action="close" aria-label="Close ${title}">×</button></div></div><div class="utility-content ${id === 'photo-carousel' ? 'photos-content' : 'placeholder-content'}">${id === 'photo-carousel' ? photoViewer : icon(image) + '<p>Work in progress</p>'}</div></section>`);
    benchTask.insertAdjacentHTML('afterend', `<button class="taskbar-button task-button" id="${id}-task" aria-pressed="false" hidden>${icon(image, 16)}<span>${title}</span></button>`);
    const win = document.getElementById(id), taskButton = document.getElementById(id + '-task');
    const open = () => { taskButton.hidden = false; taskButton.setAttribute('aria-pressed', 'true'); focusWindow(win); };
    taskButton.addEventListener('click', () => { if (win.hidden) open(); else { win.hidden = true; taskButton.setAttribute('aria-pressed', 'false'); } });
    placeholderApps.set(id, {win, taskButton, title, open});
  }
  function showPhoto(step) {
    photoIndex = (photoIndex + step + photos.length) % photos.length;
    updatePhoto();
  }
  function updatePhoto() {
    const currentPhoto = photos[photoIndex];
    const photo = document.getElementById('photo-image');
    photo.src = currentPhoto.src;
    photo.alt = currentPhoto.alt;
    document.getElementById('photo-position').textContent = `${currentPhoto.year ?? 'Year unknown'}${currentPhoto.label ? ' · ' + currentPhoto.label : ''}`;
    document.querySelectorAll('.photo-thumb').forEach(button => button.setAttribute('aria-current', Number(button.dataset.photoIndex) === photoIndex));
  }
  document.querySelectorAll('.photo-thumb').forEach(button => button.addEventListener('click', () => { photoIndex = Number(button.dataset.photoIndex); updatePhoto(); }));
  updatePhoto();
  for (const [id, step] of [['previous-photo', -1], ['next-photo', 1]]) {
    const button = document.getElementById(id);
    button.disabled = photos.length < 2;
    button.addEventListener('click', () => showPhoto(step));
  }
  document.getElementById('photo-carousel').addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showPhoto(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  const windows = [portfolio, utility, game, bench, ...Array.from(placeholderApps.values(), app => app.win)];
  const windowTasks = new Map([[portfolio, task], [utility, utilityTask], [game, gameTask], [bench, benchTask], ...Array.from(placeholderApps.values(), app => [app.win, app.taskButton])]);
  let notes = '';
  document.addEventListener('input', e => { if (e.target.id === 'notes') notes = e.target.value; });
  document.addEventListener('click', e => {
    const launcher = e.target.closest('[data-open]');
    if (!launcher) return;
    closeStart();
    const name = launcher.dataset.open;
    if (name === 'portfolio') { focusWindow(portfolio); task.hidden = false; task.setAttribute('aria-pressed', 'true'); return; }
    if (name === 'gurt') {
      if (!document.getElementById('gurt-takeover')) {
        const takeover = document.createElement('div');
        takeover.id = 'gurt-takeover';
        takeover.setAttribute('role', 'img');
        takeover.setAttribute('aria-label', 'gurt. Refresh the page to return to the desktop.');
        takeover.tabIndex = -1;
        document.body.append(takeover);
        for (const child of document.body.children) if (child !== takeover) child.inert = true;
        takeover.focus();
      }
      return;
    }
    if (name === 'tony-eagle') { openGame(); return; }
    if (name === 'bench-press-study') { openBench(); return; }
    if (placeholderApps.has(name)) { placeholderApps.get(name).open(); return; }
    if (!pages[name]) return;
    const [image, title, html] = pages[name];
    document.getElementById('utility-title').innerHTML = icon(image, 16) + title;
    document.getElementById('utility-content').innerHTML = html;
    if (name === 'trash-mom') {
      const opening = document.querySelector('.zip-opening');
      const error = document.querySelector('.zip-error');
      setTimeout(() => {
        if (!opening.isConnected) return;
        opening.hidden = true;
        error.hidden = false;
        setTimeout(() => {
          if (document.getElementById('reboot-screen')) return;
          pauseGame();
          const blackout = document.createElement('div');
          blackout.id = 'reboot-screen';
          blackout.setAttribute('role', 'status');
          blackout.setAttribute('aria-label', 'Restarting computer');
          document.body.append(blackout);
          for (const child of document.body.children) {
            if (child !== blackout) child.inert = true;
          }
          setTimeout(() => window.location.replace(window.location.pathname), 3500);
        }, 1200);
      }, 800);
    }
    if (name === 'notepad') {
      document.getElementById('notes').value = notes;
      window.TonyLeaderboard?.refreshNote();
      document.querySelectorAll('[data-note]').forEach(button => button.addEventListener('click', () => {
        const leaderboard = button.dataset.note === 'leaderboard';
        document.getElementById('leaderboard-note').hidden = !leaderboard;
        document.getElementById('notes').hidden = leaderboard;
        document.querySelectorAll('[data-note]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
        const title = leaderboard ? 'Leaderboard.txt — Notepad' : 'Untitled — Notepad';
        document.getElementById('utility-title').innerHTML = icon('notepad', 16) + title;
        utilityTask.querySelector('span').textContent = title;
      }));
    }
    utilityTask.innerHTML = icon(image, 16) + `<span>${title}</span>`;
    utilityTask.hidden = false; utilityTask.setAttribute('aria-pressed', 'true');
    focusWindow(utility);
  });
  windows.forEach(win => {
    win.addEventListener('pointerdown', () => focusWindow(win));
    win.querySelectorAll('[data-window-action]').forEach(button => button.addEventListener('click', () => {
      const action = button.dataset.windowAction;
      const taskButton = windowTasks.get(win);
      if (action === 'maximize') {
        win.classList.toggle('maximized');
        button.setAttribute('aria-label', `${win.classList.contains('maximized') ? 'Restore' : 'Maximize'} ${win === portfolio ? 'Home Page' : win === game ? 'Tony Eagle' : win === bench ? 'Bench Press Study' : placeholderApps.get(win.id)?.title || 'utility window'}`);
      } else { win.hidden = true; taskButton.setAttribute('aria-pressed', 'false'); if (win === game) { pauseGame(); if (action === 'close') gameFrame.removeAttribute('src'); } if (action === 'close') taskButton.hidden = true; }
    }));
    // Pointer capture keeps edge dragging working over the game iframe.
    for (const direction of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      const handle = document.createElement('div');
      handle.className = 'resize-handle resize-' + direction;
      handle.setAttribute('aria-hidden', 'true');
      win.append(handle);
      handle.addEventListener('pointerdown', event => {
        if (event.button !== 0 || win.classList.contains('maximized')) return;
        event.preventDefault();
        const rect = win.getBoundingClientRect();
        const startX = event.clientX, startY = event.clientY;
        const minWidth = Math.min(280, innerWidth), minHeight = Math.min(160, innerHeight - 38);
        win.classList.add('resizing');
        handle.setPointerCapture(event.pointerId);
        const move = e => {
          let left = rect.left, top = rect.top, right = rect.right, bottom = rect.bottom;
          if (direction.includes('e')) right = Math.max(left + minWidth, Math.min(innerWidth, rect.right + e.clientX - startX));
          if (direction.includes('s')) bottom = Math.max(top + minHeight, Math.min(innerHeight - 38, rect.bottom + e.clientY - startY));
          if (direction.includes('w')) left = Math.max(0, Math.min(right - minWidth, rect.left + e.clientX - startX));
          if (direction.includes('n')) top = Math.max(0, Math.min(bottom - minHeight, rect.top + e.clientY - startY));
          Object.assign(win.style, {left: left + 'px', top: top + 'px', width: (right - left) + 'px', height: (bottom - top) + 'px', maxHeight: 'none'});
        };
        const stop = () => {
          win.classList.remove('resizing');
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('lostpointercapture', stop);
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('lostpointercapture', stop);
      });
    }
    const bar = win.querySelector('.titlebar');
    bar.addEventListener('dblclick', e => { if (!e.target.closest('button')) win.querySelector('[data-window-action="maximize"]').click(); });
    bar.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || win.classList.contains('maximized')) return;
      const bounds = win.getBoundingClientRect();
      const dx = e.clientX - bounds.left, dy = e.clientY - bounds.top;
      bar.setPointerCapture(e.pointerId);
      const move = event => {
        win.style.left = Math.max(0, Math.min(innerWidth - win.offsetWidth, event.clientX - dx)) + 'px';
        win.style.top = Math.max(0, Math.min(innerHeight - 68, event.clientY - dy)) + 'px';
      };
      const stop = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', stop); bar.removeEventListener('pointercancel', stop); };
      bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', stop); bar.addEventListener('pointercancel', stop);
    });
  });
  // Keep title bars reachable when a device rotates or the viewport changes.
  window.addEventListener('resize', () => windows.forEach(win => {
    if (win.hidden || win.classList.contains('maximized')) return;
    if (win.style.width) win.style.width = Math.min(win.offsetWidth, innerWidth) + 'px';
    if (win.style.height) win.style.height = Math.min(win.offsetHeight, innerHeight - 38) + 'px';
    const bounds = win.getBoundingClientRect();
    win.style.left = Math.max(0, Math.min(bounds.left, innerWidth - win.offsetWidth)) + 'px';
    win.style.top = Math.max(0, Math.min(bounds.top, innerHeight - 68)) + 'px';
  }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeStart(); document.querySelectorAll('.overlay.show').forEach(el => el.classList.remove('show')); } });
  function tick() {
    const now = new Date();
    const clock = document.getElementById('desktop-clock');
    clock.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    clock.dateTime = now.toISOString();
    clock.title = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  tick(); setInterval(tick, 1000);
  // The existing File > Close dialog now returns to the desktop.
  document.getElementById('confirm-close').addEventListener('click', () => {
    document.getElementById('crash-screen').classList.remove('show');
    portfolio.hidden = true; task.hidden = true; task.setAttribute('aria-pressed', 'false');
  });
  document.getElementById('print-study').addEventListener('click', () => window.print());
  const standaloneApp = new URLSearchParams(location.search).get('app');
  const standaloneWindow = standaloneApp === 'bench-press-study' ? bench : standaloneApp === 'photos' ? placeholderApps.get('photo-carousel').win : null;
  if (standaloneWindow) {
    document.body.classList.add('standalone-mode');
    standaloneWindow.classList.add('standalone-window', 'maximized');
    focusWindow(standaloneWindow);
    document.title = `${standaloneApp === 'photos' ? 'Photos' : 'Bench Press Study'} — Charles Perrault`;
  }
  if (new URLSearchParams(location.search).get('notepad') === 'leaderboard') document.querySelector('[data-open="notepad"]').click();
})();
