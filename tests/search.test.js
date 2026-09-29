/* Search: the index is generated, so the thing that can rot is the index.

   assets/search-index.js is built from the pages by tools/build-search-index.js
   and committed. Edit a chapter without rebuilding and search quietly answers
   questions about the old text -- the worst kind of failure, because nothing
   looks broken. So the first check here rebuilds it in memory and compares.

   The rest drives the real UI: a generated index nothing can open is no better
   than no index.

   Run:  node tests/search.test.js                                          */

const fs = require('fs');
const path = require('path');
const H = require('./lib/harness');
const builder = require('../tools/build-search-index');

(async () => {
  const s = H.suite('search');
  const file = path.join(H.SITE, 'assets', 'search-index.js');

  /* ---- 1. the committed index is current ---- */
  const onDisk = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  s.check('assets/search-index.js exists', !!onDisk);

  const fresh = builder.serialise(builder.build());
  s.check('index is up to date with the pages', onDisk === fresh,
          onDisk === fresh ? '' : 'run: node tools/build-search-index.js');

  /* Served without a charset, exactly like site.js, so the same rule applies
     and for the same reason -- a stray Gamma from a chapter heading would
     become mojibake in every result that quoted it. */
  let bad = -1;
  for (let i = 0; i < onDisk.length; i++){
    const c = onDisk.charCodeAt(i);
    if (c > 126 || (c < 32 && c !== 10 && c !== 13 && c !== 9)){ bad = i; break; }
  }
  s.check('index is pure ASCII', bad < 0, bad < 0 ? '' : 'first at char ' + bad);

  const index = builder.build();
  s.check('every page is indexed', index.length === H.pages().length,
          index.length + ' of ' + H.pages().length);
  const noSections = index.filter(e => !e.s.length).map(e => e.p);
  s.check('every page yielded sections', noSections.length === 0, noSections.join(' '));

  /* ---- 2. the UI works against it ---- */
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
  const errs = H.watchErrors(p);

  await p.goto(srv.url + 'propagation.html', { waitUntil: 'load' });
  await p.waitForTimeout(2600);

  s.check('index script loaded on a chapter page',
          await p.evaluate(() => !!(window.TLT_INDEX && window.TLT_INDEX.length)));
  s.check('search button built', await p.evaluate(() => !!document.querySelector('.searchbtn')));

  /* The overlay is position:fixed across the whole viewport. An author
     `display` beats the browser's own [hidden]{display:none}, so the closed
     overlay once stayed laid out and swallowed every click on the page behind
     it -- the entire site became unclickable, while looking completely normal.
     Ask the document what is actually on top at a few points. */
  const onTop = await p.evaluate(() => {
    const pts = [[80, 300], [700, 400], [1200, 800], [400, 120]];
    return pts.map(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? (el.closest('.searchbox') ? 'SEARCHBOX' : 'ok') : 'none';
    });
  });
  s.check('closed overlay does not intercept clicks',
          onTop.every(v => v !== 'SEARCHBOX'), onTop.join(' '));

  await p.keyboard.press('/');
  await p.waitForTimeout(350);
  s.check('"/" opens it', await p.evaluate(() => !document.querySelector('.searchbox').hidden));

  /* Terms a student would actually type, each with a section that should win.
     Checking the destination, not just that something came back: a search that
     returns the right count of wrong answers is still broken. */
  const wants = [
    ['half-wave', 'line-lengths.html'],
    ['stub', 'matching.html'],
    ['standing wave', 'standing-waves.html'],
    ['microstrip', 'microstrip.html'],
    ['telegrapher', 'telegraphers.html']
  ];
  for (const [q, want] of wants){
    await p.fill('.searchbox input', q);
    await p.waitForTimeout(220);
    const hits = await p.evaluate(() =>
      Array.from(document.querySelectorAll('.searchbox a')).map(a => a.getAttribute('href')));
    s.check('"' + q + '" finds ' + want,
            hits.some(h => h && h.indexOf(want) === 0),
            hits.length ? hits.slice(0, 3).join(' ') : 'no results');
  }

  await p.fill('.searchbox input', 'zzzqqq');
  await p.waitForTimeout(220);
  s.check('a miss says so rather than listing everything',
          await p.evaluate(() => document.querySelectorAll('.searchbox a').length === 0));

  /* Enter follows the selected result. */
  await p.fill('.searchbox input', 'quarter-wave');
  await p.waitForTimeout(250);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1200);
  const landed = await p.evaluate(() => location.pathname.split('/').pop() + location.hash);
  s.check('Enter opens the selected result', /line-lengths\.html/.test(landed), landed);

  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' '));

  await b.close();
  await srv.close();
  s.done();
})();
