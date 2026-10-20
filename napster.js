(() => {
  const win = document.getElementById('napster');
  if (!win) return;
  win.classList.add('napster-window');
  const root = win.querySelector('.utility-content');
  root.className = 'utility-content napster-content';
  root.innerHTML = `<div class="music-menubar"><details><summary>File</summary><div class="music-menu"><button type="button" id="music-open">Open files…</button><a href="?app=napster" target="_blank" rel="noopener">Open in new tab</a></div></details><span id="music-file-summary"></span></div>
    <input type="file" id="music-files" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" multiple hidden>
    <div class="music-brand"><img class="napster-logo" src="assets/napster-logo-1999.svg" alt="Napster" width="1080" height="300"></div>
    <nav class="music-tabs" aria-label="Music library"><button type="button" data-music-view="all" aria-pressed="true"><img src="assets/icons/win95/folder-16.png" alt="">Library</button><button type="button" id="music-search-tab" aria-pressed="false"><span aria-hidden="true">⌕</span>Search</button><button type="button" data-music-view="liked" aria-pressed="false"><span aria-hidden="true">★</span>Hot List</button></nav>
    <div class="music-toolbar"><label class="music-search">Search <input id="music-search" type="search" placeholder="Title or artist" autocomplete="off"></label></div>
    <div class="music-library"><div class="music-list"><table><thead><tr><th scope="col">Filename</th><th scope="col">Filesize</th><th scope="col">Bitrate</th><th scope="col">Frequency</th><th scope="col">Length</th><th scope="col" aria-label="Liked">★</th></tr></thead><tbody id="music-tracks"></tbody></table><p id="music-empty">No tracks yet. Open files to listen.</p></div></div>
    <div class="music-player"><fieldset class="music-audio-panel"><legend>Internal Audio Controls</legend>
    <div class="music-now"><div><strong id="music-title">No track selected</strong><span id="music-artist"></span></div><button type="button" id="music-like" aria-label="Like current track" aria-pressed="false" disabled>☆</button></div>
    <div class="music-timeline"><canvas id="music-wave" height="64" aria-hidden="true"></canvas><label><input id="music-seek" type="range" min="0" max="1000" value="0" disabled aria-label="Playback position"></label><div class="music-times"><span id="music-position">0:00</span><span id="music-duration">0:00</span></div></div>
    <div class="music-controls"><button type="button" id="music-prev" aria-label="Previous track" disabled>|◀</button><button type="button" id="music-stop" aria-label="Stop" disabled>■</button><button type="button" id="music-play" disabled>Play</button><button type="button" id="music-next" aria-label="Next track" disabled>▶|</button><button type="button" id="music-repeat" aria-label="Repeat track" aria-pressed="false">Repeat</button></div><div class="music-volume"><label>Volume <input id="music-volume" type="range" min="0" max="100" value="80"></label></div></fieldset>
    <fieldset class="music-queue-panel"><legend>Playlist Control Panel</legend><ol id="music-queue" aria-label="Playlist"></ol><div class="music-queue-controls"><button type="button" id="music-shuffle" aria-pressed="false">Random Play</button><button type="button" id="music-continuous" aria-pressed="true">Continuous Play</button></div></fieldset></div>
    <div class="music-statusbar"><div class="music-status" id="music-status" role="status">Ready</div><span id="music-library-summary"></span></div><audio id="music-audio" preload="metadata"></audio>`;
  const el = id => document.getElementById('music-' + id);
  const audio = el('audio');
  audio.volume = 0.8;
  const tracks = [], objectURLs = [];
  let current = -1, view = 'all', shuffle = false, repeat = false, continuous = true, stopped = false, peaks = null, waveController;
  let liked;
  try { const saved = JSON.parse(localStorage.getItem('napster-likes-v1') || '[]'); liked = new Set(Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : []); }
  catch { liked = new Set(); }
  const status = text => { el('status').textContent = text; };
  const time = seconds => Number.isFinite(seconds) && seconds >= 0 ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00';
  const saveLikes = () => { try { localStorage.setItem('napster-likes-v1', JSON.stringify([...liked])); } catch {} };
  function toggleLike(index) {
    const track = tracks[index];
    if (!track) return;
    if (liked.has(track.id)) liked.delete(track.id); else liked.add(track.id);
    saveLikes(); render(); updateLike();
  }
  function updateLike() {
    const active = current >= 0 && liked.has(tracks[current].id);
    el('like').disabled = current < 0;
    el('like').textContent = active ? '★' : '☆';
    el('like').setAttribute('aria-pressed', String(active));
  }
  function render() {
    const query = el('search').value.trim().toLowerCase();
    const body = el('tracks'); body.replaceChildren();
    tracks.forEach((track, index) => {
      if ((view === 'liked' && !liked.has(track.id)) || !`${track.title} ${track.artist}`.toLowerCase().includes(query)) return;
      const row = document.createElement('tr');
      row.classList.toggle('music-current', index === current);
      const play = document.createElement('button');
      play.type = 'button'; play.textContent = index === current && !audio.paused ? 'Ⅱ' : '▶';
      play.setAttribute('aria-label', `${index === current && !audio.paused ? 'Pause' : 'Play'} ${track.title}`);
      play.addEventListener('click', () => index === current ? togglePlay() : select(index));
      const like = document.createElement('button'); like.type = 'button';
      like.textContent = liked.has(track.id) ? '★' : '☆';
      like.setAttribute('aria-label', `Like ${track.title}`);
      like.setAttribute('aria-pressed', String(liked.has(track.id)));
      like.addEventListener('click', () => toggleLike(index));
      const filename = document.createElement('span'); filename.className = 'music-filename';
      filename.textContent = track.file ? track.file.name : `${track.artist} - ${track.title}.mp3`;
      const fileCell = document.createElement('td'); fileCell.append(play, filename); row.append(fileCell);
      row.addEventListener('dblclick', () => select(index));
      const format = value => Number.isFinite(value) && value > 0 ? Math.round(value).toLocaleString('en-US') : '—';
      for (const value of [format(track.bytes), format(track.bitrate), format(track.sampleRate), track.duration ? time(track.duration) : '—', like]) {
        const cell = document.createElement('td');
        if (typeof value === 'string') cell.textContent = value; else cell.append(value);
        row.append(cell);
      }
      body.append(row);
    });
    el('empty').hidden = body.childElementCount > 0;
    el('empty').textContent = tracks.length ? 'No matching tracks.' : 'No tracks yet. Open files to listen.';
    el('play').disabled = !tracks.length;
    el('prev').disabled = el('next').disabled = tracks.length < 2;
    el('stop').disabled = current < 0;
    el('file-summary').textContent = `${tracks.length} files`;
    el('library-summary').textContent = `${tracks.length} songs in library`;
    const queue = el('queue'); queue.replaceChildren();
    tracks.slice(Math.max(0, current + 1), Math.max(0, current + 1) + 8).forEach((track, offset) => {
      const item = document.createElement('li'), button = document.createElement('button');
      const index = Math.max(0, current + 1) + offset;
      button.type = 'button'; button.textContent = `${track.artist} - ${track.title}`;
      button.addEventListener('click', () => select(index));
      item.append(button); queue.append(item);
    });
  }
  function drawWave() {
    const canvas = el('wave'), width = canvas.clientWidth;
    if (!width) return;
    canvas.width = width * (window.devicePixelRatio || 1);
    canvas.height = 64 * (window.devicePixelRatio || 1);
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    ctx.fillStyle = '#071923'; ctx.fillRect(0, 0, width, 64);
    if (!peaks) { ctx.fillStyle = '#808080'; ctx.fillRect(0, 31, width, 1); return; }
    const progress = Number.isFinite(audio.duration) ? audio.currentTime / audio.duration : 0;
    peaks.forEach((peak, i) => {
      ctx.fillStyle = i / peaks.length < progress ? '#8ee5f4' : '#36748a';
      const height = Math.max(1, peak * 58);
      ctx.fillRect(i * width / peaks.length, (64 - height) / 2, Math.max(1, width / peaks.length - 1), height);
    });
  }
  async function waveform(track, index) {
    waveController?.abort(); waveController = new AbortController();
    const signal = waveController.signal;
    let context;
    try {
      if (track.file?.size > 32 * 1024 * 1024) return;
      const response = await fetch(track.src, {signal});
      if (!response.ok || Number(response.headers.get('content-length')) > 32 * 1024 * 1024) return;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 32 * 1024 * 1024 || signal.aborted) return;
      context = new AudioContext();
      const decoded = await context.decodeAudioData(bytes);
      if (signal.aborted || index !== current) return;
      const samples = decoded.getChannelData(0), count = 180, block = Math.max(1, Math.floor(samples.length / count));
      const values = Array.from({length: count}, (_, i) => {
        let peak = 0;
        for (let j = i * block; j < Math.min(samples.length, (i + 1) * block); j++) peak = Math.max(peak, Math.abs(samples[j]));
        return peak;
      });
      const max = Math.max(...values, 0.001);
      peaks = values.map(value => value / max); drawWave();
    } catch { /* Decoding/CORS failures do not prevent ordinary audio playback. */ }
    finally { if (context) context.close().catch(() => {}); }
  }
  async function play() {
    stopped = false;
    try { await audio.play(); } catch { status('Playback could not start. Try Play or choose another file.'); }
  }
  function select(index, autoplay = true) {
    if (!tracks[index]) return;
    current = index; const track = tracks[index];
    audio.pause(); audio.src = track.src;
    peaks = null; el('seek').value = 0; el('seek').disabled = true;
    el('position').textContent = el('duration').textContent = '0:00';
    el('title').textContent = track.title; el('artist').textContent = track.artist;
    status('Loading…'); updateLike(); render(); drawWave(); waveform(track, index);
    if (autoplay) play();
  }
  function togglePlay() {
    if (current < 0) select(0);
    else if (audio.paused) play(); else audio.pause();
  }
  function advance(direction) {
    if (!tracks.length) return;
    if (current < 0) { select(0); return; }
    if (direction < 0 && audio.currentTime > 3) { audio.currentTime = 0; return; }
    const index = shuffle && tracks.length > 1 ? (current + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length : (Math.max(0, current) + direction + tracks.length) % tracks.length;
    select(index);
  }
  el('open').addEventListener('click', () => { el('open').closest('details').open = false; el('files').click(); });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.music-menubar details')) root.querySelector('.music-menubar details').open = false; });
  root.addEventListener('keydown', event => { if (event.key === 'Escape') root.querySelector('.music-menubar details').open = false; });
  el('files').addEventListener('change', () => {
    let added = 0;
    for (const file of el('files').files) {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac|opus|aiff?)$/i.test(file.name)) continue;
      const src = URL.createObjectURL(file); objectURLs.push(src);
      tracks.push({title: file.name.replace(/\.[^.]+$/, ''), artist: 'Local file', src, file, bytes: file.size, id: `local:${file.name}:${file.size}:${file.lastModified}`}); added++;
    }
    render(); status(added ? `${added} file${added === 1 ? '' : 's'} added for this session. Nothing uploaded.` : 'Choose an audio file.');
    el('files').value = '';
  });
  el('search').addEventListener('input', render);
  root.querySelectorAll('[data-music-view]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.musicView;
    root.querySelectorAll('[data-music-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    el('search-tab').setAttribute('aria-pressed', 'false');
    render();
  }));
  el('search-tab').addEventListener('click', () => {
    view = 'all'; root.querySelectorAll('[data-music-view]').forEach(item => item.setAttribute('aria-pressed', 'false'));
    el('search-tab').setAttribute('aria-pressed', 'true'); el('search').focus(); render();
  });
  el('play').addEventListener('click', togglePlay);
  el('prev').addEventListener('click', () => advance(-1));
  el('next').addEventListener('click', () => advance(1));
  el('stop').addEventListener('click', () => { stopped = true; audio.pause(); audio.currentTime = 0; status('Stopped'); });
  el('like').addEventListener('click', () => toggleLike(current));
  el('shuffle').addEventListener('click', () => { shuffle = !shuffle; el('shuffle').setAttribute('aria-pressed', String(shuffle)); });
  el('repeat').addEventListener('click', () => { repeat = !repeat; el('repeat').setAttribute('aria-pressed', String(repeat)); });
  el('continuous').addEventListener('click', () => { continuous = !continuous; el('continuous').setAttribute('aria-pressed', String(continuous)); });
  el('volume').addEventListener('input', () => { audio.volume = Number(el('volume').value) / 100; });
  el('seek').addEventListener('input', () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(el('seek').value) / 1000 * audio.duration; });
  audio.addEventListener('loadedmetadata', () => { el('duration').textContent = time(audio.duration); el('seek').disabled = !Number.isFinite(audio.duration); status('Ready'); });
  audio.addEventListener('timeupdate', () => { el('position').textContent = time(audio.currentTime); el('seek').value = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration * 1000 : 0; drawWave(); });
  audio.addEventListener('play', () => { el('play').textContent = 'Pause'; status('Playing'); render(); });
  audio.addEventListener('pause', () => { el('play').textContent = 'Play'; if (current >= 0) status(stopped ? 'Stopped' : 'Paused'); render(); });
  audio.addEventListener('waiting', () => status('Buffering…'));
  audio.addEventListener('playing', () => status('Playing'));
  audio.addEventListener('error', () => status('Could not play this file. Check the file or its audio format.'));
  audio.addEventListener('ended', () => {
    if (repeat) { audio.currentTime = 0; play(); }
    else if (continuous && (shuffle || current < tracks.length - 1)) advance(1);
    else { status('Finished'); el('play').textContent = 'Play'; }
  });
  win.querySelector('[data-window-action="close"]').addEventListener('click', () => audio.pause());
  new ResizeObserver(drawWave).observe(el('wave'));
  window.addEventListener('pagehide', event => { if (!event.persisted) { audio.pause(); waveController?.abort(); objectURLs.forEach(url => URL.revokeObjectURL(url)); } });
  render();
  fetch('music/library.json', {cache: 'no-cache'}).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(library => {
    if (!Array.isArray(library)) throw new Error();
    let invalid = 0;
    library.forEach(track => {
      if (!track || typeof track.title !== 'string' || typeof track.src !== 'string') { invalid++; return; }
      let url;
      try { url = new URL(track.src, document.baseURI); } catch { invalid++; return; }
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) { invalid++; return; }
      const metadata = {};
      for (const key of ['bytes', 'duration', 'bitrate', 'sampleRate']) if (Number.isFinite(track[key]) && track[key] > 0) metadata[key] = track[key];
      tracks.push({title: track.title, artist: typeof track.artist === 'string' ? track.artist : '', src: url.href, ...metadata, id: url.pathname});
    });
    render(); if (invalid) status('Some library entries could not be loaded.');
  }).catch(() => status('Shared library unavailable. You can still open local files.'));
})();
