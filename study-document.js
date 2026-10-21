(() => {
  'use strict';
  const study = document.getElementById('bench-study');
  if (!study) return;
  const paper = study.querySelector('.word-paper');
  const resultsSection = paper.querySelector('.study-results');
  const resultsData = resultsSection.querySelector('.study-results-data');
  const statistics = resultsData.querySelector('ul');
  const title = paper.querySelector('.standalone-study-title');
  const announcement = paper.querySelector('.results-announcement');
  const documentId = '1dHttdjSnuX73fnJlae1UNR9Ba1dhbFBmCvsCzX-EUTU';
  const sourceUrl = `https://docs.google.com/document/d/${documentId}/edit`;
  const cacheKey = 'bench-study-document-v1';
  let pending, lastAttempt = 0, signature = '';
  const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
  const headingName = value => value.replace(/^\s*(?:[IVXLCDM]+[.)]|\d+[.)])\s+/i, '').trim();
  const isResults = value => headingName(value).toLowerCase() === 'results';
  function roman(number) {
    let value = '';
    for (const [digit, symbol] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]) {
      while (number >= digit) { value += symbol; number -= digit; }
    }
    return value;
  }

  // Import words and basic inline formatting, never the document's scripts,
  // arbitrary CSS, event handlers, embeds, or Google-generated list numbering.
  function parse(html) {
    if (typeof html !== 'string' || html.length > 2000000) throw new Error('Invalid study document');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const styles = new Map();
    for (const sheet of doc.querySelectorAll('style')) {
      for (const match of sheet.textContent.matchAll(/\.([\w-]+)\s*\{([^}]+)\}/g)) styles.set(match[1], match[2]);
    }
    function inline(node) {
      if (node.nodeType === 3) return escape(node.textContent);
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
      if (tag === 'a') {
        try {
          let url = new URL(node.getAttribute('href'));
          if (url.hostname === 'www.google.com' && url.pathname === '/url' && url.searchParams.has('q')) url = new URL(url.searchParams.get('q'));
          if (['https:','http:','mailto:'].includes(url.protocol)) content = `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${content}</a>`;
        } catch { /* Keep text for malformed or unsafe links. */ }
      }
      return content;
    }
    const sections = [];
    let current;
    for (const node of doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li')) {
      if (node.tagName !== 'LI' && node.parentElement.closest('li,p,h1,h2,h3,h4,h5,h6')) continue;
      const clean = Array.from(node.childNodes, inline).join('');
      const plain = new DOMParser().parseFromString(clean, 'text/html').body.textContent.trim();
      if (!plain) continue;
      const name = headingName(plain);
      const knownHeading = /^(Intro|Methods|Limitations|Results|Reflection)$/i.test(name);
      const listLevel = node.parentElement.className.match(/lst-kix_[\w-]+-(\d+)\b/)?.[1];
      if (!current && /^(Bench Press Study|1RM Every Day)$/i.test(name)) continue;
      if (knownHeading || /^H[1-2]$/.test(node.tagName) || (node.tagName === 'LI' && listLevel === '0')) {
        current = {title: name, blocks: []}; sections.push(current);
      } else if (current) {
        let level = 0;
        if (node.tagName === 'LI') {
          level = listLevel === undefined ? 0 : Math.max(0, Number(listLevel) - 1);
          if (listLevel === undefined) {
            let parent = node.parentElement.parentElement;
            while (parent && parent !== doc.body) { if (parent.tagName === 'LI') level++; parent = parent.parentElement; }
          }
        }
        current.blocks.push({kind: node.tagName === 'LI' ? 'bullet' : /^H[3-6]$/.test(node.tagName) ? 'heading' : 'paragraph', level: Math.min(level, 7), html: clean});
      }
    }
    if (sections.length < 2 || sections.filter(section => isResults(section.title)).length !== 1 || !sections.some(section => !isResults(section.title) && section.blocks.length)) throw new Error('Study sections not found');
    return sections;
  }
  function blocksHtml(blocks) {
    // Each paragraph keeps its list depth without inheriting Google Docs' letters.
    return blocks.map(block => block.kind === 'bullet'
      ? `<ul class="study-doc-list" style="margin-left:${block.level * 24}px"><li>${block.html}</li></ul>`
      : `<${block.kind === 'heading' ? 'h3' : 'p'} class="study-doc-paragraph">${block.html}</${block.kind === 'heading' ? 'h3' : 'p'}>`).join('');
  }
  function render(sections) {
    const nextSignature = JSON.stringify(sections);
    if (signature === nextSignature) return;
    const fragment = document.createDocumentFragment();
    if (title) fragment.append(title);
    sections.forEach((section, index) => {
      const heading = `${roman(index + 1)}. ${section.title}`;
      if (isResults(section.title)) {
        resultsSection.querySelector('h2').textContent = heading;
        const manuscript = document.createElement('div'); manuscript.className = 'study-results-manuscript';
        manuscript.innerHTML = blocksHtml(section.blocks);
        resultsData.replaceChildren(manuscript, statistics);
        fragment.append(resultsSection);
      } else {
        const element = document.createElement('section');
        const label = document.createElement('h2'); label.textContent = heading;
        element.append(label); element.insertAdjacentHTML('beforeend', blocksHtml(section.blocks));
        fragment.append(element);
      }
    });
    if (announcement) fragment.append(announcement);
    paper.replaceChildren(fragment);
    signature = nextSignature;
  }
  async function refresh(force = false) {
    if (pending) return pending;
    if (!force && (document.hidden || study.hidden || Date.now() - lastAttempt < 60000)) return;
    lastAttempt = Date.now();
    pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(`https://docs.google.com/document/d/${documentId}/export?format=html&_=${Date.now()}`, {credentials:'omit', cache:'no-store', signal:controller.signal});
        if (!response.ok) throw new Error('Study document unavailable');
        const html = await response.text();
        render(parse(html));
        try { localStorage.setItem(cacheKey, JSON.stringify({documentId, html, updatedAt:Date.now()})); } catch { /* The visible document still works. */ }
        study.dataset.documentSync = 'live';
      } catch {
        // Keep the last successfully loaded manuscript or the bundled fallback.
        study.dataset.documentSync = 'saved';
      } finally { clearTimeout(timeout); }
    })();
    try { await pending; } finally { pending = null; }
  }

  // Reuse the Word template's styles, but export the same manuscript and live
  // numbers that are actually displayed, so there is no second text copy to edit.
  function writeWordBody(xml) {
    const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const body = xml.getElementsByTagNameNS(ns, 'body')[0];
    const sectionProperties = Array.from(body.children).find(node => node.localName === 'sectPr');
    const element = (name, attributes = {}) => {
      const node = xml.createElementNS(ns, `w:${name}`);
      for (const [key, value] of Object.entries(attributes)) node.setAttributeNS(ns, `w:${key}`, value);
      return node;
    };
    const paragraphs = [];
    function paragraph(nodes, style, level = 0, bold = false) {
      const p = element('p'), properties = element('pPr');
      properties.append(element('pStyle', {val:style}));
      if (style.startsWith('ListBullet')) properties.append(element('ind', {left:String(360 * (level + 1)), hanging:'360'}));
      p.append(properties);
      function runs(node, format = {}) {
        if (node.nodeType === 3) {
          if (!node.textContent) return;
          const run = element('r'), settings = element('rPr');
          for (const key of ['b','i','u','strike']) if (format[key]) settings.append(element(key, key === 'u' ? {val:'single'} : {}));
          if (settings.children.length) run.append(settings);
          const text = element('t'); text.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); text.textContent = node.textContent;
          run.append(text); p.append(run); return;
        }
        if (node.nodeType !== 1 || ['UL','OL','IMG'].includes(node.tagName)) return;
        if (node.tagName === 'BR') { const run = element('r'); run.append(element('br')); p.append(run); return; }
        const next = {...format};
        if (['B','STRONG'].includes(node.tagName)) next.b = true;
        if (['I','EM'].includes(node.tagName)) next.i = true;
        if (node.tagName === 'U') next.u = true;
        if (['S','DEL'].includes(node.tagName)) next.strike = true;
        for (const child of node.childNodes) runs(child, next);
      }
      for (const node of nodes) runs(node, {b:bold});
      paragraphs.push(p);
    }
    function walk(node, level = 0) {
      if (node.nodeType !== 1) return;
      if (node.tagName === 'IMG' || node.classList.contains('study-chart')) return;
      if (/^H[1-6]$/.test(node.tagName)) { paragraph(node.childNodes, node.tagName === 'H1' ? 'Title' : 'Heading1'); return; }
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        const depth = node.classList.contains('study-doc-list') ? Math.round((parseFloat(node.style.marginLeft) || 0) / 24) : level;
        for (const item of node.children) {
          if (item.tagName !== 'LI') continue;
          paragraph(Array.from(item.childNodes).filter(child => !['UL','OL'].includes(child.tagName)), depth ? 'ListBullet2' : 'ListBullet', depth);
          for (const list of item.children) if (['UL','OL'].includes(list.tagName)) walk(list, depth + 1);
        }
        return;
      }
      if (node.tagName === 'P') { paragraph(node.childNodes, 'Normal', 0, node.classList.contains('results-announcement')); return; }
      for (const child of node.children) walk(child, level);
    }
    for (const child of paper.children) walk(child);
    if (!paragraphs.length) throw new Error('Study document is empty');
    for (const child of Array.from(body.children)) if (child !== sectionProperties) child.remove();
    for (const p of paragraphs) body.insertBefore(p, sectionProperties || null);
  }

  window.BenchStudyDocument = {refresh, writeWordBody};
  const toolbar = study.querySelector('.word-toolbar');
  const edit = document.createElement('a');
  edit.href = sourceUrl; edit.target = '_blank'; edit.rel = 'noopener noreferrer'; edit.textContent = 'Edit in Google Docs';
  toolbar.insertBefore(edit, toolbar.querySelector('[download]'));
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached?.documentId === documentId && typeof cached.updatedAt === 'number' && cached.updatedAt <= Date.now() + 60000) render(parse(cached.html));
  } catch { /* Use the bundled manuscript until the first live read succeeds. */ }
  // A quick edit in another tab/window must not be swallowed by the periodic
  // one-minute throttle, including a page restored from the back/forward cache.
  const refreshOnReturn = () => {
    if (!document.hidden && !study.hidden) refresh(true);
  };
  document.addEventListener('bench-study-open', refreshOnReturn);
  document.addEventListener('visibilitychange', refreshOnReturn);
  window.addEventListener('focus', refreshOnReturn);
  window.addEventListener('pageshow', refreshOnReturn);
  setInterval(() => refresh(), 5 * 60 * 1000);
  refresh();
})();
