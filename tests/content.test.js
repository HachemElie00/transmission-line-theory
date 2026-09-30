/* Content checks. No browser, no Playwright -- these are text scans, and they
   run in well under a second.

   Every class of mistake here actually happened during development, and every
   one of them survived a full run of the browser suite, because a page can be
   perfectly rendered and still say something untrue. A figure drawn correctly
   with a caption naming the wrong colour is not a rendering bug; a chapter
   telling you to press a button that is now a dropdown is not a rendering bug.
   Nothing that samples pixels will ever catch either.

   Run:  node tests/content.test.js                                         */

const fs = require('fs');
const path = require('path');
const H = require('./lib/harness');

const s = H.suite('content');
const pages = H.pages();
const read = f => fs.readFileSync(path.join(H.SITE, f), 'utf8');
const siteJs = fs.readFileSync(path.join(H.SITE, 'assets', 'site.js'), 'utf8');

/* strip tags, scripts, styles and TeX: what is left is what a reader sees */
function prose(html){
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]{1,200}\$/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

/* ---- 1. colours named in prose ----
   A caption reading "teal: travel, coral: the stub" went silently wrong the
   moment the palette was rebuilt: the figure was still right, only the words
   describing it were not. Say what a mark is, not what colour it is drawn in. */
{
  const COLOURS = /\b(teal|violet|coral|rust|mauve|magenta|crimson|turquoise|cyan)\b/i;
  const bad = [];
  for (const f of pages){
    prose(read(f)).split(/\n/).forEach((line, i) => {
      const m = line.match(COLOURS);
      if (m) bad.push(f + ':' + (i + 1) + ' "' + m[1] + '"');
    });
  }
  s.check('no colour names in the page text', bad.length === 0, bad.slice(0, 4).join('  '));
}

/* ---- 2. every control an instruction names actually exists ----
   The five matching methods became a dropdown, and three sentences went on
   telling the reader to press them. */
{
  const bad = [];
  for (const f of pages){
    const html = read(f);
    const ctrls = new Set();
    const add = re => { let m; while ((m = re.exec(html))) ctrls.add(
      m[1].replace(/<[^>]+>/g, '').replace(/&lambda;/g, 'λ').replace(/&[a-z]+;/g, ' ')
          .trim().toLowerCase()); };
    add(/<button[^>]*>([\s\S]*?)<\/button>/g);
    add(/<option[^>]*>([\s\S]*?)<\/option>/g);
    add(/<label[^>]*>([\s\S]*?)<\/label>/g);

    const re = /\b(?:[Pp]ress|[Cc]lick|[Cc]hoose)\s+<b>([\s\S]*?)<\/b>/g;
    let m;
    while ((m = re.exec(html))){
      const want = m[1].replace(/<[^>]+>/g, '').replace(/&lambda;/g, 'λ')
                       .replace(/&[a-z]+;/g, ' ').trim().toLowerCase();
      if (!want) continue;
      const found = [...ctrls].some(c => c && (c.indexOf(want) >= 0 || want.indexOf(c) >= 0));
      if (!found) bad.push(f + ' "' + want + '"');
    }
  }
  s.check('every control named in an instruction exists', bad.length === 0, bad.slice(0, 4).join('  '));
}

/* ---- 3. colour tokens a canvas asks for must exist ----
   C.ui was never exposed to figures. Canvas ignores an undefined strokeStyle
   rather than complaining, so the mark kept the previous colour -- which was
   the chart's own background, making it invisible. Nothing rendered wrongly;
   it just could not be seen. */
{
  const KEYS = new Set(
    /var KEYS = \[([\s\S]*?)\]/.exec(siteJs)[1].replace(/['\s]/g, '').split(','));
  const bad = [];
  for (const f of pages){
    const html = read(f);
    const seen = new Set();
    let m; const re = /\bC\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((m = re.exec(html))) seen.add(m[1]);
    for (const t of seen) if (!KEYS.has(t)) bad.push(f + ' C.' + t);
  }
  s.check('every colour a figure asks for is exposed by the engine',
          bad.length === 0, bad.join('  '));
}

/* ---- 4. internal links and anchors ---- */
{
  const ids = {};
  for (const f of pages) ids[f] = new Set([...read(f).matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const bad = [];
  for (const f of pages){
    for (const m of read(f).matchAll(/href="([^"]+)"/g)){
      const href = m[1];
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [tgt, frag] = href.split('#');
      if (tgt && !fs.existsSync(path.join(H.SITE, tgt))) bad.push(f + ' -> ' + href + ' (no file)');
      else if (frag){
        const owner = tgt || f;
        if (ids[owner] && !ids[owner].has(frag)) bad.push(f + ' -> ' + href + ' (no anchor)');
      }
    }
  }
  s.check('every internal link and anchor resolves', bad.length === 0, bad.slice(0, 4).join('  '));
}

/* ---- 5. the chapter count in the prose ----
   "Chapter 06 of eleven" is written into eleven footers, index.html's lead,
   README.txt and matching.html's "the last". Adding a twelfth chapter means
   editing all of them, and missing one leaves the site quietly contradicting
   itself. This does not fix that -- it makes forgetting impossible, and names
   every place that needs the edit. */
{
  const WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine',
                 'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen',
                 'seventeen','eighteen','nineteen','twenty'];
  const model = /var SITE_PAGES = \[([\s\S]*?)\n\];/.exec(siteJs)[1];
  const chapters = (model.match(/\['Chapters',/g) || []).length;
  const want = WORDS[chapters];

  s.check('the navigation model has a sane chapter count', chapters > 0 && !!want, String(chapters));

  const wrong = [];
  for (const f of pages.concat(['README.txt'])){
    const txt = read(f);
    for (const m of txt.matchAll(/\bof (\w+)\b/g)){
      const ctx = txt.slice(Math.max(0, m.index - 30), m.index);
      if (/Chapter \d\d\s*$/.test(ctx) && m[1] !== want)
        wrong.push(f + ': "of ' + m[1] + '" should be "of ' + want + '"');
    }
    if (/\b(\w+) chapters that build\b/.test(txt)){
      const got = /\b(\w+) chapters that build\b/.exec(txt)[1].toLowerCase();
      if (got !== want) wrong.push(f + ': lead says "' + got + ' chapters"');
    }
  }
  s.check('the chapter count in the prose matches the navigation model',
          wrong.length === 0, wrong.slice(0, 4).join('  '));
}

s.done();
