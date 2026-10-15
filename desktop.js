(() => {
  const drawings = {
    computer: '<path fill="#c0c0c0" d="M3 2h26v21H3zM12 23h8v4h-8zM6 27h20v3H6z"/><path fill="#fff" d="M4 3h24v2H6v16H4z"/><path fill="#404040" d="M7 6h18v14H7z"/><path fill="#008080" d="M9 8h14v10H9z"/><path fill="#000" d="M3 22h26v2H3zM6 30h20v1H6z"/>',
    folder: '<path fill="#808000" d="M2 8h11l3 4h14v17H2z"/><path fill="#ffff80" d="M3 7h10l3 4h13v3H3z"/><path fill="#ffdf60" d="M5 14h26l-5 14H1z"/><path fill="#fff" d="M5 14h26v2H5z"/>',
    document: '<path fill="#404040" d="M7 2h15l6 6v23H7z"/><path fill="#fff" d="M6 1h15l5 6v22H6z"/><path fill="#c0c0c0" d="M21 1v7h5z"/><path stroke="#000080" d="M10 12h12M10 16h12M10 20h12M10 24h8"/>',
    mail: '<path fill="#808080" d="M2 9h28v20H2z"/><path fill="#fff" d="M1 8h28v19H1z"/><path fill="#ffffc0" stroke="#808000" d="m2 9 13 10L28 9M2 26l9-9m17 9-9-9"/><path fill="#000080" d="M21 4h9v9h-9z"/><path fill="#fff" d="M24 6h3v5h-3z"/>',
    globe: '<circle cx="16" cy="16" r="13" fill="#000080" stroke="#000"/><circle cx="15" cy="15" r="11" fill="#168cce"/><path fill="#40b050" d="m9 5 9-1 1 5-5 3-1 5-7-2-2-5zm8 12 8 1-1 6-5 4-2-5z"/><path fill="none" stroke="#80dfff" d="M5 15h21M16 4c-8 8-8 16 0 24M16 4c8 8 8 16 0 24"/>',
    recycle: '<path fill="#808080" d="M7 8h19l-3 22H10z"/><path fill="#dfdfdf" d="M5 5h23v5H5zM8 10h17l-3 18H11z"/><path fill="#008040" d="m16 12 4 6h-3l-2-3-2 3h-3zm5 7 2 5h-7v-3h4zm-8 6H9l-1-5 3-1v3h2z"/>',
    notepad: '<path fill="#000080" d="M5 4h23v26H5z"/><path fill="#fff" d="M4 3h22v25H4z"/><path fill="#008080" d="M4 3h22v4H4z"/><path stroke="#808080" d="M8 1v5m5-5v5m5-5v5m5-5v5M8 11h14M8 15h14M8 19h14M8 23h10"/>',
    windows: '<path fill="#000" d="m4 5 11-3 14 4-3 22-12-4-12 3z"/><path fill="#f04030" d="m6 7 8-2-1 8-8 2z"/><path fill="#30a040" d="m16 5 10 3-1 8-10-3z"/><path fill="#2050e0" d="m5 17 8-2-1 7-8 2z"/><path fill="#ffdf30" d="m15 15 10 3-1 7-10-3z"/>',
    speaker: '<path fill="#808080" stroke="#000" d="M3 12h7l9-8v24l-9-8H3z"/><path fill="#dfdfdf" d="m12 12 5-5v18l-5-5z"/><path fill="none" stroke="#000" stroke-width="2" d="M22 10q6 6 0 12m4-16q10 10 0 20"/>'
  };
  const icon = name => `<svg class="pixel-icon" aria-hidden="true" viewBox="0 0 32 32" shape-rendering="crispEdges">${drawings[name] || drawings.document}</svg>`;
  const portfolio = document.querySelector('body > .window');
  portfolio.id = 'portfolio';
  portfolio.setAttribute('aria-label', 'Charles Perrault — Home Page');
  portfolio.querySelector('.title .icon').outerHTML = icon('globe');
  portfolio.querySelector('.winbtns').innerHTML = '<button type="button" data-window-action="minimize" aria-label="Minimize Home Page">_</button><button type="button" data-window-action="maximize" aria-label="Maximize Home Page">□</button><button type="button" data-window-action="close" aria-label="Close Home Page">×</button>';
  const shortcuts = [
    ['computer', 'My Computer', 'computer'], ['globe', 'About Me', 'portfolio'],
    ['folder', 'My Documents', 'documents'], ['mail', 'Email', 'mailto:cbperrault@gmail.com'],
    ['document', 'Resume', 'Charles_Perrault_Resume_v1.2.2.pdf'],
    ['globe', 'GitHub', 'https://github.com/charles-perrault'],
    ['recycle', 'Recycle Bin', 'recycle']
  ];
  function shortcut([image, label, action], className) {
    const link = /^(https:|mailto:)|\.pdf$/.test(action);
    return link ? `<a class="${className}" href="${action}" ${action.startsWith('mailto:') ? '' : 'target="_blank" rel="noopener noreferrer"'}>${icon(image)}<span>${label}</span></a>` : `<button type="button" class="${className}" data-open="${action}">${icon(image)}<span>${label}</span></button>`;
  }
  document.body.insertAdjacentHTML('afterbegin', `<main class="desktop" aria-label="Windows 95 desktop"><nav class="desktop-icons" aria-label="Desktop shortcuts">${shortcuts.map(s => shortcut(s, 'desktop-icon')).join('')}</nav><div class="desktop-caption">CHARLES PERRAULT · PERSONAL COMPUTER</div></main>`);
  document.body.insertAdjacentHTML('beforeend', `<section class="start-menu" id="start-menu" aria-label="Start menu" hidden><div class="start-brand">Windows <b>95</b></div><nav class="start-items">${shortcut(['globe', 'About Me', 'portfolio'], 'start-item')}${shortcut(['computer', 'My Computer', 'computer'], 'start-item')}${shortcut(['folder', 'Documents', 'documents'], 'start-item')}${shortcut(['notepad', 'Notepad', 'notepad'], 'start-item')}<hr>${shortcut(['mail', 'Email Charles', 'mailto:cbperrault@gmail.com'], 'start-item')}${shortcut(['windows', 'About this desktop', 'welcome'], 'start-item')}</nav></section><footer class="taskbar" aria-label="Taskbar"><button class="taskbar-button start-button" id="start-button" aria-expanded="false" aria-controls="start-menu">${icon('windows')}Start</button><div class="task-divider"></div><button class="taskbar-button task-button" id="portfolio-task" aria-pressed="true">${icon('globe')}<span>Charles Perrault — Home Page</span></button><button class="taskbar-button task-button" id="utility-task" hidden></button><div class="system-tray">${icon('speaker')}<time id="desktop-clock" aria-label="Local time"></time></div></footer><section class="window utility-window" id="utility" aria-labelledby="utility-title" hidden><div class="titlebar"><div class="title" id="utility-title"></div><div class="winbtns"><button type="button" data-window-action="minimize" aria-label="Minimize utility window">_</button><button type="button" data-window-action="maximize" aria-label="Maximize utility window">□</button><button type="button" data-window-action="close" aria-label="Close utility window">×</button></div></div><div class="utility-content" id="utility-content"></div></section>`);
  const utility = document.getElementById('utility');
  const task = document.getElementById('portfolio-task');
  const utilityTask = document.getElementById('utility-task');
  const start = document.getElementById('start-button');
  const startMenu = document.getElementById('start-menu');
  let layer = 10;
  function focusWindow(win) { win.hidden = false; win.style.zIndex = Math.min(++layer, 90); }
  function closeStart() { startMenu.hidden = true; start.setAttribute('aria-expanded', 'false'); }
  start.addEventListener('click', e => { e.stopPropagation(); startMenu.hidden = !startMenu.hidden; start.setAttribute('aria-expanded', String(!startMenu.hidden)); });
  document.addEventListener('click', e => { if (!startMenu.contains(e.target)) closeStart(); });
  task.addEventListener('click', () => { portfolio.hidden = !portfolio.hidden; task.setAttribute('aria-pressed', String(!portfolio.hidden)); if (!portfolio.hidden) focusWindow(portfolio); });
  utilityTask.addEventListener('click', () => { utility.hidden = !utility.hidden; utilityTask.setAttribute('aria-pressed', String(!utility.hidden)); if (!utility.hidden) focusWindow(utility); });
  const pages = {
    computer: ['computer', 'My Computer', `<h2>Charles’s Computer</h2><p>Welcome to my corner of the internet.</p><div class="file-grid">${[shortcuts[1], shortcuts[2], ['notepad', 'Notepad', 'notepad'], ['windows', 'System', 'welcome']].map(s => shortcut(s, 'desktop-icon')).join('')}</div>`],
    documents: ['folder', 'My Documents', `<h2>My Documents</h2><div class="file-grid">${[shortcuts[4], shortcuts[5], ['globe', 'LinkedIn', 'https://www.linkedin.com/in/charles-perrault-b4a933327']].map(s => shortcut(s, 'desktop-icon')).join('')}</div><p>Resume, projects, and places to find me online.</p>`],
    recycle: ['recycle', 'Recycle Bin', '<h2>Recycle Bin is empty.</h2><p>0 objects · 0 bytes</p>'],
    notepad: ['notepad', 'Untitled — Notepad', '<label for="notes">Scratch pad</label><textarea class="notepad" id="notes" placeholder="Your next great idea starts here…"></textarea><p class="utility-note">Notes stay here while this page is open.</p>'],
    welcome: ['windows', 'Welcome to Charles’s desktop', '<h2>Welcome to my desktop.</h2><p>A little Windows 95 nostalgia, running in your browser.</p><p>Open icons with a click or tap. Drag windows by their title bars, minimize them to the taskbar, or use Start to explore.</p><p>The taskbar clock uses your local time. Open About Me for my background, or My Documents for my resume and links.</p>']
  };
  let notes = '';
  document.addEventListener('input', e => { if (e.target.id === 'notes') notes = e.target.value; });
  document.addEventListener('click', e => {
    const launcher = e.target.closest('[data-open]');
    if (!launcher) return;
    closeStart();
    const name = launcher.dataset.open;
    if (name === 'portfolio') { focusWindow(portfolio); task.hidden = false; task.setAttribute('aria-pressed', 'true'); return; }
    const [image, title, html] = pages[name];
    document.getElementById('utility-title').innerHTML = icon(image) + title;
    document.getElementById('utility-content').innerHTML = html;
    if (name === 'notepad') document.getElementById('notes').value = notes;
    utilityTask.innerHTML = icon(image) + `<span>${title}</span>`;
    utilityTask.hidden = false; utilityTask.setAttribute('aria-pressed', 'true');
    focusWindow(utility);
  });
  [portfolio, utility].forEach(win => {
    win.addEventListener('pointerdown', () => focusWindow(win));
    win.querySelectorAll('[data-window-action]').forEach(button => button.addEventListener('click', () => {
      const action = button.dataset.windowAction;
      const taskButton = win === portfolio ? task : utilityTask;
      if (action === 'maximize') {
        win.classList.toggle('maximized');
        button.setAttribute('aria-label', `${win.classList.contains('maximized') ? 'Restore' : 'Maximize'} ${win === portfolio ? 'Home Page' : 'utility window'}`);
      } else { win.hidden = true; taskButton.setAttribute('aria-pressed', 'false'); if (action === 'close') taskButton.hidden = true; }
    }));
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
  window.addEventListener('resize', () => [portfolio, utility].forEach(win => {
    if (win.hidden || win.classList.contains('maximized')) return;
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
})();
