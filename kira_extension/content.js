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

  function buildPrompt(doc) {
    const odds = doc.querySelector('.flex.odds');
    if (!odds) return null;
    const { pre, live } = phaseRows(odds);
    const markets = [
      ['Asian Handicap', ah, odds.querySelector('.table.asia')],
      ['Goals Over/Under', overUnder, odds.querySelector('.table.bs')],
      ['Corners Over/Under', overUnder, odds.querySelector('.table.corner')],
    ];
    const sections = markets
      .map(([name, fmt, table]) => {
        const lines = [['Pre-match', fmt(table, pre)], ['Live', fmt(table, live)]]
          .filter(([, v]) => v)
          .map(([phase, v]) => `   + ${phase}: ${v}`);
        return lines.length ? `- ${name}:\n${lines.join('\n')}` : null;
      })
      .filter(Boolean);
    if (!sections.length) return null;
    return [
      'Run 1,000 Monte Carlo simulations of this football match and recommend the bet with the best value, based on the simulated win probability (%) versus the implied probability of the odds.',
      'Use the following odds lines:',
      ...sections,
    ].join('\n');
  }

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
    return [
      'Kira debug: no odds found. Copy this and send it back.',
      `url: ${location.href}`,
      `.flex.odds: ${!!document.querySelector('.flex.odds')}`,
      `classes: ${[...classes].slice(0, 60).join(' ')}`,
      `html: ${box ? box.outerHTML.replace(/\s+/g, ' ').slice(0, 6000) : '(no odds container)'}`,
    ].join('\n');
  }

  async function copyOdds() {
    const prompt = buildPrompt(document);
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

  if (globalThis.kiraBookmarklet) return void copyOdds();

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyC') {
      e.preventDefault();
      copyOdds();
    }
  }, true);
})();
