/* Shared plumbing for the checks in this folder.

   Two things every check needs: a static server on a free port (the earlier
   throwaway versions hard-coded ports and collided when run together), and a
   way to record pass/fail so the process exits non-zero when something
   breaks. */

const http = require('http'), fs = require('fs'), path = require('path');
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

/* Every HTML page in the site, in a stable order. */
function pages(root){
  return fs.readdirSync(root || SITE).filter(f => f.endsWith('.html')).sort();
}

const fileUrl = name => 'file://' + path.join(SITE, name);

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

module.exports = { SITE, serve, pages, fileUrl, cutTheWire, watchErrors,
                   canvasHash, setInput, suite, chromium, path, fs };
