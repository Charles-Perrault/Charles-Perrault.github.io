(() => {
  'use strict';
  const app = document.getElementById('magnet-implant');
  if (!app) return;
  const journal = document.getElementById('magnet-journal-content');
  const documentId = '1kmoxCofYkDaY8u0isb6GIisNRgbQ5PrQeXvj72CseXs';
  const cacheKey = 'magnet-journal-document-v1';
  let pending, lastAttempt = 0;
  const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

  // Import only document content and basic formatting; never source scripts or CSS.
  function parse(html) {
    if (typeof html !== 'string' || html.length > 2000000) throw new Error('Invalid journal');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc.body.classList.contains('doc-content')) throw new Error('Not a document export');
    const styles = new Map();
    for (const sheet of doc.querySelectorAll('style')) {
      for (const match of sheet.textContent.matchAll(/\.([\w-]+)\s*\{([^}]+)\}/g)) styles.set(match[1], match[2]);
    }
    function inline(node) {
      if (node.nodeType === 3) return escape(node.textContent).replace(/™/g, '<span class="magnet-trademark">™</span>');
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();
      if (['script','style','iframe','object','embed','svg','math','form','input','button','img','ul','ol'].includes(tag)) return '';
      if (tag === 'br') return '<br>';
      let content = Array.from(node.childNodes, inline).join('');
      const declarations = [...node.classList].map(name => styles.get(name) || '').join(';') + ';' + (node.getAttribute('style') || '');
      if (['b','strong'].includes(tag) || /font-weight\s*:\s*(?:bold|[6-9]00)\b/i.test(declarations)) content = `<strong>${content}</strong>`;
      if (['i','em'].includes(tag) || /font-style\s*:\s*italic\b/i.test(declarations)) content = `<em>${content}</em>`;
      if (tag === 'u' || /text-decoration(?:-line)?\s*:[^;]*\bunderline\b/i.test(declarations)) content = `<u>${content}</u>`;
      if (['s','del'].includes(tag) || /text-decoration(?:-line)?\s*:[^;]*\bline-through\b/i.test(declarations)) content = `<s>${content}</s>`;
      if (tag === 'sup' || /vertical-align\s*:\s*super\b/i.test(declarations)) content = `<sup>${content}</sup>`;
      if (tag === 'sub' || /vertical-align\s*:\s*sub\b/i.test(declarations)) content = `<sub>${content}</sub>`;
      if (tag === 'a') {
        try {
          let url = new URL(node.getAttribute('href'));
          if (url.hostname === 'www.google.com' && url.pathname === '/url' && url.searchParams.has('q')) url = new URL(url.searchParams.get('q'));
          if (['https:','http:','mailto:'].includes(url.protocol)) content = `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${content}</a>`;
        } catch { /* Keep the text of invalid links. */ }
      }
      return content;
    }
    const blocks = [];
    for (const node of doc.body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li')) {
      if (node.tagName !== 'LI' && node.parentElement.closest('li,p,h1,h2,h3,h4,h5,h6')) continue;
      const content = Array.from(node.childNodes, inline).join('');
      const tag = node.tagName.toLowerCase();
      if (tag === 'li') {
        const depth = Math.min(7, Number(node.parentElement.className.match(/lst-kix_[\w-]+-(\d+)/)?.[1] || 0));
        blocks.push(`<${node.parentElement.tagName === 'OL' ? 'ol' : 'ul'} style="margin-left:${depth * 24}px"><li>${content}</li></${node.parentElement.tagName === 'OL' ? 'ol' : 'ul'}>`);
      } else blocks.push(`<${tag}>${content || '<br>'}</${tag}>`);
    }
    if (!blocks.length || !doc.body.textContent.trim()) throw new Error('Empty journal');
    return blocks.join('');
  }
  async function refresh(force = false) {
    if (pending) return pending;
    if (document.hidden || app.hidden || (!force && Date.now() - lastAttempt < 60000)) return;
    lastAttempt = Date.now();
    pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(`https://docs.google.com/document/d/${documentId}/export?format=html&tab=t.0&_=${Date.now()}`, {credentials:'omit', cache:'no-store', signal:controller.signal});
        if (!response.ok) throw new Error('Journal unavailable');
        const html = await response.text();
        journal.innerHTML = parse(html);
        app.dataset.documentSync = 'live';
        try { localStorage.setItem(cacheKey, JSON.stringify({documentId, html})); } catch { /* Storage is optional. */ }
      } catch { app.dataset.documentSync = 'saved'; }
      finally { clearTimeout(timeout); }
    })();
    try { await pending; } finally { pending = null; }
  }
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached?.documentId === documentId) journal.innerHTML = parse(cached.html);
  } catch { /* Keep the bundled journal. */ }
  const tabs = Array.from(app.querySelectorAll('[role="tab"]'));
  function select(tab) {
    for (const button of tabs) {
      const active = button === tab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
    }
    if (tab.id === 'magnet-journal-tab') refresh(true);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      select(next); next.focus();
    });
  });
  window.MagnetJournalDocument = {refresh};
  const onReturn = () => refresh(true);
  document.addEventListener('magnet-journal-open', onReturn);
  document.addEventListener('visibilitychange', onReturn);
  window.addEventListener('focus', onReturn);
  window.addEventListener('pageshow', onReturn);
  setInterval(() => refresh(), 5 * 60 * 1000);
  refresh();
})();
