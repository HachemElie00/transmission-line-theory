/* Shared plumbing for the checks in this folder.

   Two things every check needs: a static server on a free port (the earlier
   throwaway versions hard-coded ports and collided when run together), and a
   way to record pass/fail so the process exits non-zero when something
   breaks. */

const http = require('http'), fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const SITE = path.resolve(__dirname, '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css',
  '.js'  : 'text/javascript',
  '.json': 'application/json',
  '.woff2':'font/woff2',
  '.svg' : 'image/svg+xml',
  '.png' : 'image/png'
};

/* Static server on an ephemeral port. Returns {url, close}. */
async function serve(root){
  root = root || SITE;
  const srv = http.createServer((q, r) => {
    /* The site ships no favicon, and does not need one. Some browsers ask for
       it anyway and log a console error when it 404s -- Edge does, headless
       Chromium does not, which is exactly the kind of difference that makes a
       suite pass on one machine and fail on another. The request is issued by
       the browser rather than the page, so it never reaches page.on('response')
       and cannot be filtered there. Answering it is the only clean place. */
    if (q.url === '/favicon.ico'){ r.writeHead(204); r.end(); return; }
    let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (f.endsWith(path.sep) || q.url === '/') f = path.join(root, 'index.html');
    fs.readFile(f, (e, d) => {
      if (e) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      r.end(d);
    });
  });
  await new Promise(res => srv.listen(0, res));
  const port = srv.address().port;
  return { url: 'http://localhost:' + port + '/', port,
           close: () => new Promise(res => srv.close(res)) };
}

/* Launch a Chromium-family browser, preferring Playwright's own build but
   falling back to one already on the machine.

   `npx playwright install chromium` downloads from cdn.playwright.dev, which
   is not reachable from every network even where the npm registry is. Without
   a fallback the entire suite is unrunnable in that situation, which is a poor
   trade for a set of checks that only need a Chromium engine -- Edge ships on
   every Windows machine and is the same engine.

   Set TLT_BROWSER=chrome|msedge|chromium to force one. */
let announced = false;
async function launch(opts){
  const forced = process.env.TLT_BROWSER;
  const tries = forced ? [forced] : [null, 'chrome', 'msedge'];
  const errs = [];
  for (const channel of tries){
    try {
      const b = await chromium.launch(Object.assign({}, opts,
        channel && channel !== 'chromium' ? { channel } : {}));
      if (!announced){
        announced = true;
        console.log('       browser: ' + (channel || 'bundled chromium'));
      }
      return b;
    } catch (e) { errs.push((channel || 'bundled') + ': ' + e.message.split('\n')[0]); }
  }
  throw new Error('no Chromium-family browser could be launched\n  ' + errs.join('\n  '));
}

/* Every HTML page in the site, in a stable order. */
function pages(root){
  return fs.readdirSync(root || SITE).filter(f => f.endsWith('.html')).sort();
}

/* Not 'file://' + path.join(...). That is correct only where paths start with
   a slash: on Windows it produces file://C:\site\index.html, which is not a
   URL at all -- wrong number of slashes, backslash separators, and no drive
   encoding. pathToFileURL handles all three and is right on both platforms. */
const fileUrl = name => pathToFileURL(path.join(SITE, name)).href;

/* Abort every request that does not start with `allow`, and collect what was
   attempted. This is how "no network at runtime" is proved: not by reading the
   markup, but by cutting the wire and seeing whether the page notices. */
async function cutTheWire(page, allow){
  const blocked = [];
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(allow)) return route.continue();
    blocked.push(u);
    return route.abort();
  });
  return blocked;
}

/* Collect page errors and console errors on a page. */
function watchErrors(page){
  const errs = [];
  page.on('pageerror', e => errs.push('ERR ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/net::|TUNNEL/.test(m.text()))
      errs.push('CON ' + m.text().slice(0, 120));
  });
  return errs;
}

/* FNV-1a over one channel of a canvas. Two renders that differ anywhere give
   different hashes; two identical renders give the same one. */
function canvasHash(page, id){
  return page.evaluate(cid => {
    const c = document.getElementById(cid);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i += 4) { h ^= d[i]; h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }, id);
}

/* Wait for a canvas to stop changing, and return its final hash.

   Fixed sleeps after clicking a control were the worst source of flakiness in
   this suite, and they fail in the most misleading way available: read the
   canvas too early and you get the PREVIOUS render, which is indistinguishable
   from a control that did not restore what it found. That is exactly how the
   fine-grid check failed -- 450ms was enough for two grid modes and not for
   the third, and merely adding a debug print between the click and the read
   made it pass.

   Pass `from` (the hash before the click) to wait for the render to actually
   change first; without it a poll that lands before the redraw sees the old
   value twice and calls that stable. */
async function settle(page, id, from){
  let prev = null;
  for (let i = 0; i < 60; i++){
    const h = await canvasHash(page, id);
    if (from !== undefined && h === from){ prev = null; await page.waitForTimeout(100); continue; }
    if (h === prev) return h;
    prev = h;
    await page.waitForTimeout(100);
  }
  return prev;
}

/* Set one of the workbench's number inputs and let it re-render. */
function setInput(page, id, v){
  return page.evaluate(({ id, v }) => {
    const e = document.getElementById(id);
    e.value = String(v);
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, v });
}

/* ---- result recording ---- */
function suite(title){
  const rows = [];
  let failed = 0;
  return {
    check(name, ok, detail){
      rows.push([ok, name, detail === undefined ? '' : String(detail)]);
      if (!ok) failed++;
      console.log((ok ? '  ok   ' : '  FAIL ') + name.padEnd(52) + '  ' +
                  (detail === undefined ? '' : detail));
      return ok;
    },
    note(line){ console.log('       ' + line); },
    /* Call at the end. Sets the exit code so a runner or CI can see it. */
    done(){
      console.log('\n' + title + ': ' + (rows.length - failed) + '/' + rows.length +
                  ' passed' + (failed ? '  — ' + failed + ' FAILED' : ''));
      if (failed) process.exitCode = 1;
      return failed;
    }
  };
}

module.exports = { SITE, serve, pages, fileUrl, cutTheWire, watchErrors, launch, settle,
                   canvasHash, setInput, suite, chromium, path, fs };
