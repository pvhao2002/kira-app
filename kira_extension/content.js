// Copies pre-match + in-play odds from an AiScore match page as a prediction prompt. Hotkey: Alt+Shift+C.
// Also runs as a bookmarklet (see make-bookmarklet.mjs): then it copies once instead of binding the hotkey.
(() => {
  const text = (el) => (el?.textContent || '').trim();
  const has = (v) => v && v !== '-';

  // Row index per phase from the label column (Opening, Pre-match, In-play), by structure not text: labels are
  // localized (/vi/ shows "Tỷ lệ cược trước trận đấu"). In-play carries the live gif; pre-match is the row before it.
  function phaseRows(odds) {
    const rows = [...odds.querySelectorAll('.table.oddType > .row')];
    const live = rows.findIndex((r) => r.querySelector('.liveOdds'));
    const pre = (live >= 0 ? live : rows.length) - 1;
    return { pre: pre >= 1 ? pre : -1, live };
  }

  function cols(table, i) {
    const row = i < 0 ? null : table?.querySelectorAll(':scope > .row')[i];
    return row ? [...row.querySelectorAll('.col')] : [];
  }

  function ah(table, i) {
    const [home, away] = cols(table, i).map((c) => [text(c.querySelector('.leftText')), text(c.querySelector('.rightText'))]);
    if (!home || !away || ![...home, ...away].every(has)) return null;
    return `Home ${home[0]} @ ${home[1]}, Away ${away[0]} @ ${away[1]}`;
  }

  function overUnder(table, i) {
    const [line, over, under] = cols(table, i).map(text);
    if (![line, over, under].every(has)) return null;
    return `Line ${line}, Over @ ${over}, Under @ ${under}`;
  }

  function readDesktop(doc) {
    const odds = doc.querySelector('.flex.odds');
    if (!odds) return null;
    const { pre, live } = phaseRows(odds);
    return [
      ['Asian Handicap', ah, odds.querySelector('.table.asia')],
      ['Goals Over/Under', overUnder, odds.querySelector('.table.bs')],
      ['Corners Over/Under', overUnder, odds.querySelector('.table.corner')],
    ].map(([name, fmt, table]) => ({ name, pre: fmt(table, pre), live: fmt(table, live) }));
  }

  // ---- Mobile (m.aiscore.com): one tab per market, one block per bookmaker, rows border1/2/3 = open/pre-match/live.
  // Pre-match is locked (lock icon, no numbers) once the match is live; the bookmaker's history popup still has it.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(fn, ms = 2000) {
    const end = Date.now() + ms;
    let v;
    while (!(v = fn()) && Date.now() < end) await wait(50);
    return v || null;
  }

  const ODD = /^\d+(\.\d+)?$/;
  const MINUTE = /^\d+(\+\d+)?\s*['’′]/;

  // A side is one odds cell: optional `.handicap` line plus the price. The price may be a nested leaf span or the cell itself.
  function sideOf(side) {
    const leaves = [...side.querySelectorAll('span')].filter((s) => !s.children.length && !s.classList.contains('handicap'));
    return {
      line: text(side.querySelector('.handicap')),
      odd: (leaves.length ? leaves : [side]).map(text).find((t) => ODD.test(t)),
    };
  }

  function readRow(row, sideSelector) {
    const sides = [...row.querySelectorAll(sideSelector)].map(sideOf);
    return { lines: sides.map((s) => s.line).filter(Boolean), odds: sides.map((s) => s.odd).filter(Boolean) };
  }

  const fmtAh = ({ lines, odds }) =>
    lines.length === 2 && odds.length === 2 ? `Home ${lines[0]} @ ${odds[0]}, Away ${lines[1]} @ ${odds[1]}` : null;
  const fmtOu = ({ lines, odds }) =>
    lines.length >= 1 && odds.length === 2 ? `Line ${lines[0]}, Over @ ${odds[0]}, Under @ ${odds[1]}` : null;

  const openPopup = (doc) =>
    [...doc.querySelectorAll('.van-popup')].find((p) => getComputedStyle(p).display !== 'none' && p.querySelector('ul.oddContent > li'));

  // History is newest first. The earliest live row is the last one with a minute; the pre-match odd is the first valid row after it.
  function preMatchFromPopup(popup, fmt) {
    const rows = [...popup.querySelectorAll('ul.oddContent > li')].map((li) => ({
      live: MINUTE.test(text(li.firstElementChild)),
      value: fmt(readRow(li, ':scope > .oddsBox')),
    }));
    return rows.slice(rows.map((r) => r.live).lastIndexOf(true) + 1).find((r) => r.value)?.value ?? null;
  }

  async function readPopup(doc, company, fmt) {
    for (const opener of [company.querySelector('.oddsBoxRight'), company.querySelector('.oddsBoxContent')]) {
      if (!opener) continue;
      opener.click();
      const popup = await until(() => openPopup(doc), 1500);
      if (!popup) continue;
      try {
        return preMatchFromPopup(popup, fmt);
      } finally {
        popup.querySelector('.top .right')?.click();
        await until(() => !openPopup(doc), 1500);
      }
    }
    return null;
  }

  async function readMobile(doc) {
    const tabAt = (i) => doc.querySelectorAll('.oddTypesBox > span')[i];
    if (!tabAt(1)) return null;
    const original = [...doc.querySelectorAll('.oddTypesBox > span')].findIndex((t) => t.classList.contains('activeTab'));
    const found = [];
    try {
      // Tab 0 is 1X2 (not used); tabs are positional because their labels are localized.
      for (const [name, fmt, i] of [['Asian Handicap', fmtAh, 1], ['Goals Over/Under', fmtOu, 2], ['Corners Over/Under', fmtOu, 3]]) {
        const tab = tabAt(i);
        if (!tab) continue;
        if (!tab.classList.contains('activeTab')) {
          tab.click();
          await until(() => tabAt(i)?.classList.contains('activeTab'), 1500);
          await wait(100);
        }
        const company = doc.querySelector('.oddsContent > .oddsBox');
        if (!company) continue;
        const at = (n) => {
          const row = company.querySelector(`.oddsBoxContent > .border${n}`);
          return row ? fmt(readRow(row, ':scope > span')) : null;
        };
        const live = at(3);
        const pre = at(2) || (await readPopup(doc, company, fmt));
        found.push({ name, pre, live });
      }
    } finally {
      if (original >= 0 && !tabAt(original)?.classList.contains('activeTab')) tabAt(original)?.click();
    }
    return found;
  }

  // Any live odds → recommend live only (pre-match stays as reference for line movement); otherwise pre-match.
  function composePrompt(found) {
    const hasLive = found?.some((m) => m.live);
    const sections = (found || [])
      .filter((m) => m.pre || m.live)
      .map((m) => {
        const lines = [m.pre && `   + Pre-match${hasLive ? ' (reference only)' : ''}: ${m.pre}`, m.live && `   + Live: ${m.live}`].filter(Boolean);
        return `- ${m.name}:\n${lines.join('\n')}`;
      });
    if (!sections.length) return null;
    return [
      'Run 1,000 Monte Carlo simulations of this football match and recommend the bet with the best value, based on the simulated win probability (%) versus the implied probability of the odds.',
      hasLive
        ? 'Live (in-play) odds are available, so recommend live bets only. Use the pre-match odds only as a reference for how the lines moved.'
        : 'Only pre-match odds are available, so recommend pre-match bets.',
      'Use the following odds lines:',
      ...sections,
      'Finish with a summary: the recommended bets ranked by priority (best value first), each with its market, line, odds, simulated win probability and edge.',
    ].join('\n');
  }

  const buildPrompt = (doc) => composePrompt(readDesktop(doc));

  function toast(msg, ok) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.setAttribute('role', 'status');
    el.style.cssText = `position:fixed;top:16px;right:16px;z-index:2147483647;padding:10px 14px;border-radius:6px;font:14px sans-serif;color:#fff;background:${ok ? '#2e7d32' : '#c62828'};box-shadow:0 2px 8px rgba(0,0,0,.3)`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  function debugInfo() {
    const classes = new Set();
    document.querySelectorAll('[class*="odd" i], [class*="asia" i], [class*="handicap" i], [class*="corner" i]')
      .forEach((el) => el.classList.forEach((c) => classes.add(c)));
    const box = document.querySelector('.flex.odds') || document.querySelector('[class*="odds" i]');
    const flat = (el, max) => (el ? el.outerHTML.replace(/\s+/g, ' ').slice(0, max) : '(none)');
    // Mobile (m.aiscore.com): the full dump overflows, so send tabs + first bookmaker block + any open popup instead.
    const tabs = [...document.querySelectorAll('.oddTypesBox > span')].map((t) => `${t.className.includes('activeTab') ? '*' : ''}${text(t)}`);
    const company = document.querySelector('.oddsContent > .oddsBox');
    const popups = [...document.querySelectorAll('.van-popup, .van-overlay, .van-dialog, [role="dialog"], [class*="popup" i], [class*="modal" i]')]
      .filter((el) => el.offsetParent !== null || getComputedStyle(el).display !== 'none');
    return [
      'Kira debug: no odds found. Copy this and send it back.',
      `url: ${location.href}`,
      `.flex.odds: ${!!document.querySelector('.flex.odds')}`,
      `classes: ${[...classes].slice(0, 60).join(' ')}`,
      `tabs: ${tabs.join(' | ')}`,
      `first-bookmaker: ${flat(company, 4000)}`,
      `popups(${popups.length}): ${popups.map((p) => flat(p, 6000)).join('\n---\n') || '(none open)'}`,
      `html: ${box ? flat(box, 3000) : '(no odds container)'}`,
    ].join('\n');
  }

  async function copyOdds() {
    const prompt = composePrompt(readDesktop(document) || (await readMobile(document)));
    if (!prompt) {
      toast('Kira: no odds found on this page', false);
      // On a phone there is no DevTools, so hand back what the page looks like for fixing the selectors.
      if (globalThis.kiraBookmarklet) copyPanel(debugInfo());
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      toast('Kira: odds copied', true);
    } catch {
      copyPanel(prompt);
    }
  }

  // iOS Safari often refuses clipboard writes from a bookmarklet; a tap on this button is a fresh user gesture.
  function copyPanel(prompt) {
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;inset:16px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:8px;background:#fff;color:#000;font:16px sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.4)';
    const area = document.createElement('textarea');
    area.value = prompt;
    area.readOnly = true;
    area.setAttribute('aria-label', 'Kira odds prompt');
    area.style.cssText = 'flex:1;font:14px monospace';
    const button = (label, onClick) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'padding:12px;font:16px sans-serif';
      b.addEventListener('click', onClick);
      return b;
    };
    const close = button('Close', () => panel.remove());
    const copy = button('Copy', async () => {
      try {
        await navigator.clipboard.writeText(prompt);
        panel.remove();
        toast('Kira: odds copied', true);
      } catch {
        area.focus();
        area.setSelectionRange(0, prompt.length); // last resort: user long-presses → Copy
        toast('Kira: copy the selected text manually', false);
      }
    });
    panel.append(area, copy, close);
    document.body.appendChild(panel);
  }

  // Exposed for the headless self-check (test/check.html); harmless on the page.
  globalThis.kiraBuildPrompt = buildPrompt;
  globalThis.kiraBuildPromptMobile = async (doc) => composePrompt(await readMobile(doc));

  if (globalThis.kiraBookmarklet) return void copyOdds();

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyC') {
      e.preventDefault();
      copyOdds();
    }
  }, true);
})();
