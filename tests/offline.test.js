/* The stricter offline check. pages.test.js serves from file://, which some
   browsers treat leniently; this one serves over HTTP and aborts every request
   that is not this server's own origin. So a stray CDN link fails here rather
   than silently succeeding from a cache.

   Also confirms, per page, that MathJax actually produced output and that the
   bundled typefaces loaded — "no requests blocked" alone would also be true of
   a page that rendered nothing.

   Run:  node tests/offline.test.js                                        */

const H = require('./lib/harness');

(async () => {
  const s = H.suite('offline');
  const srv = await H.serve();
  const b = await H.launch();

  for (const pg of H.pages()){
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    const blocked = await H.cutTheWire(p, srv.url);
    const errs = H.watchErrors(p);

    await p.goto(srv.url + pg, { waitUntil: 'load' });
    await p.waitForTimeout(3500);

    const st = await p.evaluate(() => {
      const de = document.documentElement;
      let loaded = 0;
      try { document.fonts.forEach(f => { if (f.status === 'loaded') loaded++; }); } catch (e) {}
      return {
        texok  : de.classList.contains('tex-ok'),
        notex  : de.classList.contains('notex'),
        mj     : document.querySelectorAll('mjx-container').length,
        rawTeX : (document.body.innerText.match(/\$[^$\n]{2,}\$/g) || []).length,
        fonts  : loaded,
        ovf    : de.scrollWidth - de.clientWidth
      };
    });

    const ok = st.texok && !st.notex && st.mj > 0 && st.rawTeX === 0 &&
               st.fonts > 0 && st.ovf < 2 && errs.length === 0 && blocked.length === 0;

    s.check(pg, ok,
            'mathjax:' + st.mj + '  fonts:' + st.fonts + '  rawTeX:' + st.rawTeX +
            '  ovf:' + st.ovf + '  blocked:' + blocked.length +
            (errs.length ? '  | ' + errs.slice(0, 2).join(' ') : ''));

    await ctx.close();
  }

  await b.close();
  await srv.close();
  s.done();
})();
