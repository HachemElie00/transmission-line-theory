/* The shared furniture: sidebar, figure toolbars, and the ASCII rule.

     - the hamburger collapses the sidebar, the choice survives a navigation,
       and below 1180px the same button opens the dropdown instead
     - from file://, with storage kept per file as Firefox keeps it, theme and
       sidebar still follow every way of leaving a page (sidebar, pager,
       search, report button); over http links are left alone
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
      off: !document.documentElement.classList.contains('sb-on'),
      pad: getComputedStyle(document.body).paddingLeft,
      stored: (() => { try { return localStorage.getItem('tlt-sidebar'); } catch (e) { return 'ERR'; } })()
    }));

    await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
    await p.waitForTimeout(1800);
    const a = await state();
    s.check('the sidebar is hidden by default', a.off && a.pad === '0px' && a.stored === null, JSON.stringify(a));
    await p.click('.menubtn'); await p.waitForTimeout(700);
    const c = await state();
    s.check('hamburger shows the sidebar', !c.off && c.pad === '252px' && c.stored === 'on', a.pad + ' -> ' + c.pad);

    await p.goto(srv.url + 'propagation.html', { waitUntil: 'load' });
    await p.waitForTimeout(1600);
    const d = await state();
    s.check('the choice survives a navigation', d.off === c.off && d.pad === c.pad);
    await p.click('.menubtn'); await p.waitForTimeout(700);
    await p.goto(srv.url + 'telegraphers.html', { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    const e = await state();
    s.check('hiding it survives a navigation too', e.off && e.pad === '0px' && e.stored === 'off', JSON.stringify(e));

    await p.setViewportSize({ width: 900, height: 900 });
    await p.goto(srv.url + 'propagation.html', { waitUntil: 'load' });
    await p.waitForTimeout(1600);
    await p.click('.menubtn'); await p.waitForTimeout(400);
    const narrow = await p.evaluate(() => !document.getElementById('sitemenu').hidden);
    s.check('below 1180px the same button opens the menu', narrow);

    s.check('no page errors (sidebar)', errs.length === 0, errs.slice(0, 2).join(' '));
    await ctx.close();
  }

  /* ---- local files with one storage per file ----
     Firefox gives every file:// page its own localStorage, so a theme or
     sidebar chosen on one page was unknown to the next: the reader saw the
     choice reset on every link. Chromium shares one storage across file://,
     so the fault cannot happen here unless it is made to: the init script
     keys every stored item by the page's path, which is what Firefox does. */
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript(() => {
      const real = window.localStorage, pre = location.pathname + '|';
      const shim = {
        getItem: k => real.getItem(pre + k),
        setItem: (k, v) => real.setItem(pre + k, String(v)),
        removeItem: k => real.removeItem(pre + k)
      };
      Object.defineProperty(window, 'localStorage', { get: () => shim, configurable: true });
    });
    const p = await ctx.newPage();
    const errs = H.watchErrors(p);
    await H.cutTheWire(p, 'file://');
    const look = () => p.evaluate(() => ({
      th: document.documentElement.getAttribute('data-theme'),
      sb: document.documentElement.classList.contains('sb-on'),
      mb: document.documentElement.classList.contains('mb-off'),
      file: location.pathname.split('/').pop(),
      search: location.search,
      stored: [localStorage.getItem('tlt-theme'), localStorage.getItem('tlt-sidebar'),
               localStorage.getItem('tlt-mastbar')].join('/')
    }));
    const go = async (fn) => {
      await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), fn()]);
      await p.waitForTimeout(700);
    };

    /* the emulation is real: a choice made on one page does not reach another
       opened directly. Without this the checks below would prove nothing. */
    await p.goto(H.fileUrl('propagation.html'), { waitUntil: 'load' });
    await p.waitForTimeout(800);
    await p.click('.themebtn'); await p.click('.menubtn'); await p.waitForTimeout(400);
    await p.goto(H.fileUrl('telegraphers.html'), { waitUntil: 'load' });
    await p.waitForTimeout(600);
    const iso = await look();
    s.check('file:// emulation: storage is per file', iso.th !== 'dark' && !iso.sb, JSON.stringify(iso));

    /* by a sidebar link */
    await p.goto(H.fileUrl('propagation.html'), { waitUntil: 'load' });
    await p.waitForTimeout(800);
    await go(() => p.click('.sidebar a[href="reflection.html"]'));
    const a = await look();
    s.check('file://: theme and sidebar follow a sidebar link',
            a.file === 'reflection.html' && a.th === 'dark' && a.sb && !a.mb, JSON.stringify(a));
    s.check('file://: the arriving page keeps them as its own and cleans its address',
            a.stored === 'dark/on/on' && a.search === '', a.stored + ' ' + a.search);

    /* by the pager, after a change made on this page */
    await p.click('.menubtn'); await p.waitForTimeout(300);
    await go(() => p.click('.pager a:last-child'));
    const c = await look();
    s.check('file://: a change made on the previous page follows the pager',
            c.file !== 'reflection.html' && c.th === 'dark' && !c.sb && c.stored === 'dark/off/on',
            JSON.stringify(c));

    /* by search, which navigates from script */
    await p.keyboard.press('/'); await p.waitForTimeout(300);
    await p.keyboard.type('Smith chart'); await p.waitForTimeout(400);
    await go(() => p.keyboard.press('Enter'));
    const d = await look();
    s.check('file://: theme follows a search result', d.file !== c.file && d.th === 'dark' && d.search === '',
            JSON.stringify(d));

    /* the report button carries them too, without disturbing its own query */
    await go(() => p.click('.bugbtn'));
    const r = await p.evaluate(() => ({
      th: document.documentElement.getAttribute('data-theme'),
      page: document.getElementById('r-page').value,
      search: location.search
    }));
    s.check('file://: the report page keeps ?from= and gets the theme',
            r.th === 'dark' && r.page === d.file && /from=/.test(r.search) && !/tlt=/.test(r.search),
            JSON.stringify(r));

    /* a link within the page is not turned into a reload */
    const same = await p.evaluate(() => [carryURL('#x'), carryURL('report.html#y').indexOf('tlt=')]);
    s.check('file://: a same-page link is left alone', same[0] === '#x' && same[1] === -1, JSON.stringify(same));
    s.check('no page errors (file:// carry)', errs.length === 0, errs.slice(0, 2).join(' '));
    await ctx.close();
  }

  /* ---- over http one storage serves every page: links are left alone ---- */
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await ctx.newPage();
    await p.goto(srv.url + 'propagation.html', { waitUntil: 'load' });
    await p.waitForTimeout(600);
    const h = await p.evaluate(() => {
      const a = document.querySelector('.pager a:last-child'), before = a.getAttribute('href');
      a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return [before, a.getAttribute('href')];
    });
    s.check('http: links are not rewritten', h[0] === h[1] && !/tlt=/.test(h[1]), h.join(' -> '));
    await ctx.close();
  }

  /* ---- collapsing the sidebar buys chart width ---- */
  for (const [vw, vh] of [[1440, 900], [1180, 900]]){
    const ctx = await b.newContext({ viewport: { width: vw, height: vh } });
    const p = await ctx.newPage();
    await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
    await p.waitForTimeout(1800);
    /* hidden is the default now, so open it first and then collapse it */
    await p.click('.menubtn'); await p.waitForTimeout(900);
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
