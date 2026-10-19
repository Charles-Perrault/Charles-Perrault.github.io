(() => {
  'use strict';
  const canvas = document.getElementById('unity-canvas');
  const cover = document.getElementById('cover');
  const status = document.getElementById('status');
  const progress = document.getElementById('progress');
  const resume = document.getElementById('resume');
  const pauseButton = document.getElementById('pause');
  const help = document.getElementById('error-help');
  let instance;
  let paused = true;
  let failed = false;
  let started = false;
  const cheatCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let cheatKeys = [];
  const notifyHost = type => { if (window.parent !== window) window.parent.postMessage({ type }, window.location.origin); };
  function setPaused(value) {
    paused = value;
    if (!instance || failed) return;
    if (!value) started = true;
    instance.SendMessage('BrowserBridge', 'SetPaused', value ? '1' : '0');
    cover.hidden = !value;
    cover.dataset.mode = started ? 'paused' : 'ready';
    status.textContent = 'Game paused. Resume when you are ready.';
    resume.textContent = started ? 'GAME PAUSED' : 'Click to play';
    resume.setAttribute('aria-label', started ? 'Game paused. Click to resume.' : 'Click to play');
    resume.hidden = !value;
    pauseButton.textContent = value ? 'Resume' : 'Pause';
    if (!value) { canvas.focus(); notifyHost('tony-eagle:focus'); }
  }
  function fail(message) {
    failed = true;
    cover.dataset.mode = 'error';
    cover.hidden = false;
    progress.hidden = true;
    resume.hidden = true;
    pauseButton.disabled = true;
    status.textContent = 'The game could not load.';
    help.textContent = message;
    help.hidden = false;
  }
  resume.addEventListener('click', () => setPaused(false));
  pauseButton.addEventListener('click', () => setPaused(!paused));
  window.addEventListener('blur', () => setPaused(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    if (event.data?.type === 'tony-eagle:pause') setPaused(true);
  });
  // Keep movement keys inside the game; Escape also gives keyboard focus back to the page.
  canvas.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  });
  window.addEventListener('keydown', event => {
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) {
      cheatKeys = [];
      return;
    }
    if (instance && !failed && !event.repeat && !event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      cheatKeys.push(key);
      cheatKeys = cheatKeys.slice(-cheatCode.length);
      if (cheatKeys.length === cheatCode.length && cheatKeys.every((key, index) => key === cheatCode[index])) {
        window.TonyLeaderboard?.disqualify();
        instance.SendMessage('BrowserBridge', 'EnableUnlimitedUpgradePoints', '');
        document.getElementById('cheat-notice').hidden = false;
        cheatKeys = [];
      }
    }
    if (event.key === 'Escape' && instance && started) {
      event.preventDefault();
      setPaused(!paused);
      if (paused) resume.focus();
    }
  });
  document.getElementById('fullscreen').addEventListener('click', async () => {
    try { await document.getElementById('stage').requestFullscreen(); }
    catch { status.textContent = 'Fullscreen is unavailable in this browser. Open the game standalone for more space.'; }
  });
  window.addEventListener('tony-eagle:reset-progress', () => {
    if (!instance || failed) return;
    instance.SendMessage('BrowserBridge', 'ResetRankedProgress', '');
    document.getElementById('cheat-notice').hidden = true;
    setPaused(false);
  });
  async function load() {
    const phone = navigator.userAgentData?.mobile || /iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(navigator.userAgent);
    if (phone) {
      cover.dataset.mode = 'phone';
      cover.querySelector('h1').textContent = 'COME BACK LATER WHEN YOU HAVE ACCESS TO A COMPUTER!!!';
      status.hidden = progress.hidden = resume.hidden = canvas.hidden = true;
      document.getElementById('controls').hidden = true;
      pauseButton.hidden = document.getElementById('fullscreen').hidden = true;
      return;
    }
    if (window.location.protocol === 'file:') { fail('Open this page through a web server. Unity cannot load its data directly from a local file URL.'); return; }
    const build = new URL('Build/', document.baseURI);
    const assetUrl = name => {
      const url = new URL(name, build);
      url.searchParams.set('v', '20261019-1');
      return url.href;
    };
    const loaderUrl = assetUrl('tony-eagle.loader.js');
    // Catch missing deployment files before a 404 HTML page is treated as JavaScript or WebAssembly.
    const names = ['tony-eagle.loader.js', 'tony-eagle.data', 'tony-eagle.framework.js', 'tony-eagle.wasm'];
    try {
      await Promise.all(names.map(async name => {
        const response = await fetch(assetUrl(name), { method: 'HEAD', cache: 'no-cache' });
        if (!response.ok) throw new Error(`Missing Build/${name} (HTTP ${response.status}).`);
      }));
      const loader = document.createElement('script');
      loader.src = loaderUrl;
      await new Promise((resolve, reject) => { loader.onload = resolve; loader.onerror = () => reject(new Error('The Unity loader could not be downloaded.')); document.head.appendChild(loader); });
      instance = await createUnityInstance(canvas, {
        dataUrl: assetUrl('tony-eagle.data'),
        frameworkUrl: assetUrl('tony-eagle.framework.js'),
        codeUrl: assetUrl('tony-eagle.wasm'),
        streamingAssetsUrl: new URL('StreamingAssets/', document.baseURI).href,
        companyName: 'GloveGames', productName: 'Tony Eagle: Amateur Skateboarding', productVersion: '1.0',
        showBanner: (message, type) => { if (type === 'error') fail(String(message)); }
      }, value => { progress.value = value; });
      if (failed) return;
      progress.hidden = true;
      pauseButton.disabled = false;
      setPaused(true);
      status.textContent = 'Ready. Arrows / WASD to move; hold and release Space or B to jump.';
      resume.textContent = 'Click to play';
      notifyHost('tony-eagle:ready');
    } catch (error) { fail(`${error.message || error} Reload to try again. If this persists, the game build may be incomplete.`); }
  }
  load();
})();
