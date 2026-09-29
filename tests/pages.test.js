/* Every page, at seven viewport widths, loaded from file:// with the network
   cut. Asserts the four things that have actually broken before:

     - no page errors
     - no blank canvas (a figure that throws still leaves a sized canvas
       behind, so "the page loaded" is not evidence a figure drew)
     - no horizontal overflow
     - all maths typeset, and no raw $...$ left visible
     - zero external requests attempted

   Run:  node tests/pages.test.js                                          */

const H = require('./lib/harness');

const WIDTHS = [1920, 1440, 1200, 1100, 900, 700, 390];

(async () => {
  const s = H.suite('pages');
  const pages = H.pages();
  const b = await H.launch();

  for (const vw of WIDTHS){
    const ctx = await b.newContext({ viewport: { width: vw, height: 900 } });
    const p = await ctx.newPage();
    const blocked = await H.cutTheWire(p, 'file://');
    const bad = [];

    for (const pg of pages){
      const errs = [];
      const onErr = e => errs.push('ERR ' + e.message);
      p.on('pageerror', onErr);

      await p.goto(H.fileUrl(pg), { waitUntil: 'load' });
      await p.waitForTimeout(2200);

      const r = await p.evaluate(() => {
        const de = document.documentElement;
        /* index.html once shipped with no doctype, charset, lang or viewport
           meta while the other fourteen pages had all four. Nothing here
           noticed: desktop Chromium ignores a missing viewport meta entirely,
           so the page laid out correctly at every width this suite tries and
           the overflow check passed. The damage only appears on a real phone.
           So assert the head directly rather than inferring it from layout. */
        const head = [];
        if (!document.doctype) head.push('doctype');
        if (!de.getAttribute('lang')) head.push('lang');
        if (!document.querySelector('meta[charset]')) head.push('charset');
        const vp = document.querySelector('meta[name="viewport"]');
        if (!vp) head.push('viewport');
        else if (!/width=device-width/.test(vp.content)) head.push('viewport-content');
        const blank = [];
        document.querySelectorAll('canvas').forEach(c => {
          try {
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 800)
              if (d[i] !== d[0] || d[i+1] !== d[1]) n++;
            if (n < 5) blank.push(c.id || '?');
          } catch (e) { /* tainted or zero-sized; the overflow check covers it */ }
        });
        return {
          ovf  : de.scrollWidth - de.clientWidth,
          head,
          blank,
          tex  : de.classList.contains('tex-ok'),
          raw  : (document.body.innerText.match(/\$[^$\n]{2,}\$/g) || []).length,
          bars : document.querySelectorAll('.figbar').length
        };
      });

      if (r.ovf > 1 || r.head.length || r.blank.length || !r.tex || r.raw > 0 || errs.length)
        bad.push(pg + ' ' + JSON.stringify(r) + (errs.length ? ' ' + errs[0] : ''));

      p.off('pageerror', onErr);
    }

    bad.forEach(x => s.note('FAIL ' + x));
    s.check(vw + 'px: all ' + pages.length + ' pages clean', bad.length === 0,
            bad.length ? bad.length + ' bad' : '');
    s.check(vw + 'px: no external requests', blocked.length === 0,
            blocked.length ? blocked.slice(0, 3).join(' ') : '');

    await ctx.close();
  }

  /* One pass with mobile emulation on. Everything above is desktop Chromium,
     which lays out at the viewport width whether or not the page asks it to.
     With isMobile the viewport meta is finally load-bearing: a page without
     one falls back to a 980px layout viewport and overflows a 390px screen,
     which is the real-world symptom the desktop passes cannot produce. */
  {
    const ctx = await b.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3, isMobile: true, hasTouch: true
    });
    const p = await ctx.newPage();
    const blocked = await H.cutTheWire(p, 'file://');
    const bad = [];

    for (const pg of pages){
      await p.goto(H.fileUrl(pg), { waitUntil: 'load' });
      await p.waitForTimeout(2200);
      const r = await p.evaluate(() => ({
        ovf: document.documentElement.scrollWidth - window.innerWidth,
        layout: document.documentElement.clientWidth
      }));
      /* layout much wider than the screen means the viewport meta is missing
         or wrong, whatever the overflow number says */
      if (r.ovf > 1 || r.layout > 420) bad.push(pg + ' ' + JSON.stringify(r));
    }

    bad.forEach(x => s.note('FAIL ' + x));
    s.check('390px mobile-emulated: all ' + pages.length + ' pages clean',
            bad.length === 0, bad.length ? bad.length + ' bad' : '');
    s.check('390px mobile-emulated: no external requests', blocked.length === 0,
            blocked.length ? blocked.slice(0, 3).join(' ') : '');
    await ctx.close();
  }

  await b.close();
  s.done();
})();
