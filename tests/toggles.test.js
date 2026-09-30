/* Canvas-hash checks: does a control actually change what is drawn, and does
   turning it back restore exactly what was there before?

   A control that silently does nothing is the failure mode these catch. The
   fine grid was suppressed in both-grids mode for months and looked broken;
   nothing else would have noticed.

     - fine grid changes the render in all three grid modes, and toggling it
       back gives a pixel-identical canvas
     - zoom in, then reset, returns a pixel-identical canvas, and clicking dead
       centre still reads 1.00 + j0.00 at magnification (so the inverse
       transform in toChart() agrees with the forward one)
     - the theme switch changes the palette, persists, and leaves no errors

   Run:  node tests/toggles.test.js                                        */

const H = require('./lib/harness');

(async () => {
  const s = H.suite('toggles');
  const srv = await H.serve();
  const b = await H.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1150 } });
  const p = await ctx.newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
  /* 1500ms was not enough, and it failed in a way that looked like a site bug:
     the FIRST grid mode tested would fail to restore its hash while the other
     two passed. site.js schedules redrawStatic at 1400ms and buildBars at
     1800ms, and building the toolbars changes layout, which resizes the canvas
     and forces another redraw. So the first baseline hash was being taken
     mid-settle, and the "restored" render was the correct one. Wait past both. */
  await p.waitForTimeout(2600);

  const densePressed = () =>
    p.evaluate(() => document.getElementById('b-dense').getAttribute('aria-pressed'));

  /* ---- fine grid ---- */
  for (const g of ['z', 'y', 'zy']){
    await p.click('[data-grid="' + g + '"]');
    await p.waitForTimeout(400);
    if (await densePressed() === 'false'){ await p.click('#b-dense'); await p.waitForTimeout(400); }

    /* One full cycle before measuring, so the baseline is a settled render.

       The very first render of the page really is a one-off: in z mode it
       carries about 13% more lit pixels than every render that follows, at
       unchanged brightness, so extra faint minor lines rather than darker
       ones. It never recurs once anything has been toggled. Only z showed it
       because z is the default grid, and so the only mode whose first
       measurement is also the page's first paint. */
    let h = await H.settle(p, 'chart');
    await p.click('#b-dense'); h = await H.settle(p, 'chart', h);
    await p.click('#b-dense'); const on = await H.settle(p, 'chart', h);

    await p.click('#b-dense');
    const off = await H.settle(p, 'chart', on);
    await p.click('#b-dense');
    const back = await H.settle(p, 'chart', off);

    s.check('fine grid changes the ' + g + ' grid', on !== off, on + ' -> ' + off);
    s.check('fine grid restores the ' + g + ' grid', back === on);
  }

  /* ---- zoom ---- */
  await p.click('[data-grid="z"]'); await p.waitForTimeout(300);
  const base = await H.canvasHash(p, 'chart');
  await p.click('#z-in'); await p.waitForTimeout(400);
  const zoomed = await H.canvasHash(p, 'chart');
  s.check('zoom changes the render', zoomed !== base);

  await p.click('#z-rst'); await p.waitForTimeout(500);
  s.check('reset returns a pixel-identical render',
          (await H.canvasHash(p, 'chart')) === base);

  await p.click('#z-in'); await p.click('#z-in'); await p.waitForTimeout(400);
  const box = await p.evaluate(() => {
    const r = document.getElementById('chart').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await p.mouse.click(box.x + box.w*0.5, box.y + box.h*0.5);
  await p.waitForTimeout(400);
  const centre = await p.evaluate(() => document.querySelectorAll('#big dd')[0].textContent);
  s.check('centre of a magnified chart still reads as matched',
          /^1\.00\s*\+\s*j\s*0\.00/.test(centre.replace(/−/g, '-').trim()),
          centre.trim());
  await p.click('#z-rst'); await p.waitForTimeout(300);

  /* ---- theme ---- */
  const before = await p.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  await p.click('.themebtn'); await p.waitForTimeout(700);
  const after = await p.evaluate(() => ({
    bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    attr: document.documentElement.getAttribute('data-theme'),
    stored: (() => { try { return localStorage.getItem('tlt-theme'); } catch (e) { return null; } })()
  }));
  s.check('theme switch changes the palette', after.bg !== before, before + ' -> ' + after.bg);
  s.check('theme switch persists', after.stored === after.attr && !!after.attr, after.stored);

  /* ---- the load can be typed in five ways and they must all mean the same ----
     The state is always r + jx; these only change what the two boxes mean. The
     impedance must therefore be untouched by switching between them, and a
     value typed in one of the derived units must come back as the right
     impedance. */
  {
    const impedance = () => p.evaluate(() => {
      const rows = [...document.querySelectorAll('#big > div')];
      const r = rows.find(x => x.querySelector('dt').textContent.trim() === 'Z (Ω)');
      return r ? r.querySelector('dd').textContent.trim() : null;
    });
    const setMode = m => p.evaluate(m => {
      const s = document.getElementById('i-lmode');
      s.value = m; s.dispatchEvent(new Event('change', { bubbles: true }));
    }, m);

    /* a reactive load, or the round trip proves little: with x = 0 the L and C
       conversions are degenerate and would pass whatever they did */
    await setMode('rx'); await p.waitForTimeout(250);
    await p.evaluate(() => {
      const a = document.getElementById('i-r'), b = document.getElementById('i-x');
      a.value = '25';  a.dispatchEvent(new Event('input', { bubbles: true }));
      b.value = '-30'; b.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await p.waitForTimeout(300);
    const z0 = await impedance();
    let same = true, seen = [];
    for (const m of ['g', 'swr', 'rl', 'rc', 'rx']){
      await setMode(m); await p.waitForTimeout(250);
      const z = await impedance();
      seen.push(m + '=' + z);
      if (z !== z0) same = false;
    }
    s.check('switching load units does not change the load', same, seen.join('  '));

    /* 2 pF at 1 GHz is -1/(2*pi*f*C) = -79.6 ohm, computed here not read off */
    await setMode('rc'); await p.waitForTimeout(250);
    await p.evaluate(() => {
      const a = document.getElementById('i-r'), b = document.getElementById('i-x');
      a.value = '50'; a.dispatchEvent(new Event('input', { bubbles: true }));
      b.value = '2';  b.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await p.waitForTimeout(350);
    const want = -1 / (2*Math.PI*1e9*2e-12);
    const got = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#big > div')];
      const r = rows.find(x => x.querySelector('dt').textContent.trim() === 'Z (Ω)');
      return r ? r.querySelector('dd').textContent.trim() : '';
    });
    const gotX = parseFloat(got.replace(/.*[−-]\s*j/, '')) * -1;
    s.check('a capacitance entered in pF gives the right reactance',
            Math.abs(gotX - want) < 0.3, got + '   theory ' + want.toFixed(1));
    await setMode('rx'); await p.waitForTimeout(200);
  }

  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' '));

  await b.close();
  await srv.close();
  s.done();
})();
