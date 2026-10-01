/* The shared furniture: sidebar, figure toolbars, and the ASCII rule.

     - the hamburger collapses the sidebar, the choice survives a navigation,
       and below 1180px the same button opens the dropdown instead
     - collapsing the sidebar actually buys the chart width (that is the whole
       reason the toggle exists), with no horizontal overflow either way
     - every page's figures have a toolbar, play/pause lives in it rather than
       among the physics controls, and the old inline pause buttons are gone
     - assets/site.js contains no byte outside printable ASCII. It is served
       without a charset declaration, so one stray character becomes mojibake.

   Run:  node tests/chrome.test.js                                         */

const H = require('./lib/harness');

(async () => {
  const s = H.suite('chrome');

  /* ---- the ASCII rule, checked without a browser ---- */
  const js = H.fs.readFileSync(H.path.join(H.SITE, 'assets', 'site.js'), 'latin1');
  const offenders = [];
  for (let i = 0; i < js.length; i++){
    const c = js.charCodeAt(i);
    if (c > 126 || (c < 32 && c !== 9 && c !== 10 && c !== 13)){
      offenders.push(i);
      if (offenders.length > 5) break;
    }
  }
  s.check('assets/site.js is pure ASCII', offenders.length === 0,
          offenders.length ? 'first at byte ' + offenders[0] : '');

  const srv = await H.serve();
  const b = await H.launch();

  /* ---- sidebar ---- */
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await ctx.newPage();
    const errs = H.watchErrors(p);
    const state = () => p.evaluate(() => ({
      off: document.documentElement.classList.contains('sb-off'),
      pad: getComputedStyle(document.body).paddingLeft,
      stored: (() => { try { return localStorage.getItem('tlt-sidebar'); } catch (e) { return 'ERR'; } })()
    }));

    await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
    await p.waitForTimeout(1800);
    const a = await state();
    await p.click('.menubtn'); await p.waitForTimeout(700);
    const c = await state();
    s.check('hamburger collapses the sidebar', a.off !== c.off, a.pad + ' -> ' + c.pad);

    await p.goto(srv.url + 'propagation.html', { waitUntil: 'load' });
    await p.waitForTimeout(1600);
    const d = await state();
    s.check('the choice survives a navigation', d.off === c.off);

    await p.setViewportSize({ width: 900, height: 900 });
    await p.goto(srv.url + 'propagation.html', { waitUntil: 'load' });
    await p.waitForTimeout(1600);
    await p.click('.menubtn'); await p.waitForTimeout(400);
    const narrow = await p.evaluate(() => !document.getElementById('sitemenu').hidden);
    s.check('below 1180px the same button opens the menu', narrow);

    s.check('no page errors (sidebar)', errs.length === 0, errs.slice(0, 2).join(' '));
    await ctx.close();
  }

  /* ---- collapsing the sidebar buys chart width ---- */
  for (const [vw, vh] of [[1440, 900], [1180, 900]]){
    const ctx = await b.newContext({ viewport: { width: vw, height: vh } });
    const p = await ctx.newPage();
    await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
    await p.waitForTimeout(1800);
    const on = await p.evaluate(() => ({
      w: document.getElementById('chart').clientWidth,
      ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    await p.click('.menubtn'); await p.waitForTimeout(900);
    const off = await p.evaluate(() => ({
      w: document.getElementById('chart').clientWidth,
      ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    s.check(vw + 'px: collapsing widens the chart, no overflow',
            off.w > on.w && on.ovf <= 1 && off.ovf <= 1,
            on.w + ' -> ' + off.w + ' (+' + (off.w - on.w) + 'px)');
    await ctx.close();
  }

  /* ---- figure toolbars ---- */
  {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    await H.cutTheWire(p, 'file://');
    let total = 0, bad = [];
    for (const pg of H.pages()){
      await p.goto(H.fileUrl(pg), { waitUntil: 'load' });
      await p.waitForTimeout(2400);
      const r = await p.evaluate(() => ({
        canvases: document.querySelectorAll('canvas').length,
        bars: document.querySelectorAll('.figbar').length,
        play: document.querySelectorAll('.figbar [data-play]').length,
        png : [...document.querySelectorAll('.figbar button')].filter(x => /PNG/.test(x.textContent)).length,
        strayPause: document.querySelectorAll('#pause, #pause2').length,
        wordy: [...document.querySelectorAll('.figbar [data-play]')]
                 .filter(x => /pause|play/i.test(x.textContent)).length,
        /* a toolbar must never be a flex item in a row of canvases: two
           figures put theirs between the two canvases they belong to */
        wedged: [...document.querySelectorAll('.figbar')].filter(x => {
          const par = x.parentElement, cs = getComputedStyle(par);
          return cs.display.indexOf('flex') >= 0 && cs.flexDirection.indexOf('row') === 0 &&
                 !par.classList.contains('figbars') && par.querySelectorAll(':scope > canvas').length > 0;
        }).length
      }));
      total += r.bars;
      if (r.canvases && (!r.bars || !r.png || r.strayPause || r.wordy || r.wedged))
        bad.push(pg + ' ' + JSON.stringify(r));
    }
    bad.forEach(x => s.note('FAIL ' + x));
    s.check('every figure has a toolbar, symbols not words, no stray pause buttons, none wedged between canvases',
            bad.length === 0, total + ' toolbars across the site');

    /* EM.rich draws real subscripts on canvas. It must hand the context back
       as it found it: it once left c.font at its last subscript size, and a
       figure sizing its next label from c.font shrank every label after it. */
    await p.goto(H.fileUrl('line-lengths.html'), { waitUntil: 'load' });
    await p.waitForTimeout(800);
    const rich = await p.evaluate(() => {
      const c = document.createElement('canvas').getContext('2d');
      c.font = '13px serif'; c.textAlign = 'right';
      const before = c.font + '|' + c.textAlign;
      const w = EM.rich(c, [['Z','n'], ['0','b'], ['+','p'], ['0|+','bp'], [' tail','n']], 50, 50, 11, 'center');
      return { before, after: c.font + '|' + c.textAlign, w };
    });
    s.check('EM.rich leaves font and alignment as it found them',
            rich.before === rich.after && rich.w > 0, rich.before + '  ->  ' + rich.after);
    await ctx.close();
  }

  await b.close();
  await srv.close();
  s.done();
})();
