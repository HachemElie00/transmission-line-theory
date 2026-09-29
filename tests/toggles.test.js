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
  const b = await H.chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1150 } });
  const p = await ctx.newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);

  const densePressed = () =>
    p.evaluate(() => document.getElementById('b-dense').getAttribute('aria-pressed'));

  /* ---- fine grid ---- */
  for (const g of ['z', 'y', 'zy']){
    await p.click('[data-grid="' + g + '"]');
    await p.waitForTimeout(400);
    if (await densePressed() === 'false'){ await p.click('#b-dense'); await p.waitForTimeout(400); }

    const on = await H.canvasHash(p, 'chart');
    await p.click('#b-dense'); await p.waitForTimeout(400);
    const off = await H.canvasHash(p, 'chart');
    await p.click('#b-dense'); await p.waitForTimeout(400);
    const back = await H.canvasHash(p, 'chart');

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

  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' '));

  await b.close();
  await srv.close();
  s.done();
})();
