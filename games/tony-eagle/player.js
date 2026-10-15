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
  const notifyHost = type => { if (window.parent !== window) window.parent.postMessage({ type }, window.location.origin); };
  function setPaused(value) {
    paused = value;
    if (!instance || failed) return;
    instance.SendMessage('BrowserBridge', 'SetPaused', value ? '1' : '0');
    cover.hidden = !value;
    status.textContent = 'Game paused. Resume when you are ready.';
    resume.textContent = 'Resume game';
    resume.hidden = !value;
    pauseButton.textContent = value ? 'Resume' : 'Pause';
    if (!value) { canvas.focus(); notifyHost('tony-eagle:focus'); }
  }
  function fail(message) {
    failed = true;
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
    if (event.key === 'Escape') { setPaused(true); resume.focus(); }
  });
  document.getElementById('fullscreen').addEventListener('click', async () => {
    try { await document.getElementById('stage').requestFullscreen(); }
    catch { status.textContent = 'Fullscreen is unavailable in this browser. Open the game standalone for more space.'; }
  });
  async function load() {
    if (window.location.protocol === 'file:') { fail('Open this page through a web server. Unity cannot load its data directly from a local file URL.'); return; }
    const build = new URL('Build/', document.baseURI);
    const loaderUrl = new URL('tony-eagle.loader.js', build).href;
    // Catch missing deployment files before a 404 HTML page is treated as JavaScript or WebAssembly.
    const names = ['tony-eagle.loader.js', 'tony-eagle.data', 'tony-eagle.framework.js', 'tony-eagle.wasm'];
    try {
      await Promise.all(names.map(async name => {
        const response = await fetch(new URL(name, build), { method: 'HEAD', cache: 'no-cache' });
        if (!response.ok) throw new Error(`Missing Build/${name} (HTTP ${response.status}).`);
      }));
      const loader = document.createElement('script');
      loader.src = loaderUrl;
      await new Promise((resolve, reject) => { loader.onload = resolve; loader.onerror = () => reject(new Error('The Unity loader could not be downloaded.')); document.head.appendChild(loader); });
      instance = await createUnityInstance(canvas, {
        dataUrl: new URL('tony-eagle.data', build).href,
        frameworkUrl: new URL('tony-eagle.framework.js', build).href,
        codeUrl: new URL('tony-eagle.wasm', build).href,
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
