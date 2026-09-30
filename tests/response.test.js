/* The frequency response, checked against an independent implementation.

   The page computes how far a match holds; this file computes the same thing
   from the theory, sharing no code with it, and compares. The decisive check
   is the one at the design frequency: a correct design must give |Gamma| = 0
   at f0, so if the page's solver and this file's sweep disagree there, one of
   them is wrong and the plot is worthless.

   That a plot appears is not evidence of anything, which is the trap this
   suite has fallen into before.

   Run:  node tests/response.test.js                                         */

const H = require('./lib/harness');
const TAU = Math.PI * 2;

/* ---- complex helpers ---- */
const cdiv = (a, b) => {
  const d = b[0]*b[0] + b[1]*b[1];
  return d < 1e-18 ? [1e9, 0]
                   : [(a[0]*b[0] + a[1]*b[1])/d, (a[1]*b[0] - a[0]*b[1])/d];
};
const cmul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
const zToG = z => cdiv([z[0] - 1, z[1]], [z[0] + 1, z[1]]);
const gToZ = g => cdiv([1 + g[0], g[1]], [1 - g[0], -g[1]]);
const mag = g => Math.hypot(g[0], g[1]);

/* ---- the sweep, from the theory ---- */
function gammaAt(cfg, sol, k){
  const { r, x, method, openStub, dd } = cfg;
  const gL = zToG([r, x]);

  if (method === 'lnet'){
    const xk = sol.xs >= 0 ? sol.xs*k : sol.xs/k;
    const bk = sol.bp >= 0 ? sol.bp*k : sol.bp/k;
    let z, y;
    if (String(sol.order).startsWith('series')){
      z = [r, x + xk];
      y = cdiv([1, 0], z); y = [y[0], y[1] + bk];
      z = cdiv([1, 0], y);
    } else {
      y = cdiv([1, 0], [r, x]); y = [y[0], y[1] + bk];
      z = cdiv([1, 0], y); z = [z[0], z[1] + xk];
    }
    return zToG(z);
  }

  const travel = (g, d) => {
    const a = Math.atan2(g[1], g[0]) - 2*TAU*d*k, m = mag(g);
    return [m*Math.cos(a), m*Math.sin(a)];
  };
  const stub = (l, open) => {
    const t = Math.tan(TAU*l*k);
    return open ? t : (Math.abs(t) < 1e-12 ? -1e9 : -1/t);
  };

  if (method === 'shunt' || method === 'series'){
    const z1 = gToZ(travel(gL, sol.d));
    if (method === 'series'){
      const t = Math.tan(TAU*sol.ls*k);
      const xs = openStub ? (Math.abs(t) < 1e-12 ? -1e9 : -1/t) : t;
      return zToG([z1[0], z1[1] + xs]);
    }
    const y1 = cdiv([1, 0], z1);
    const yt = [y1[0], y1[1] + stub(sol.ls, openStub)];
    return zToG(cdiv([1, 0], yt));
  }

  if (method === 'qwt'){
    const zq = gToZ(travel(gL, sol.d));
    const t = Math.tan(Math.PI/2*k);
    const z1 = sol.z1;
    const A = [zq[0], zq[1] + z1*t];
    const B = [z1 - zq[1]*t, zq[0]*t];
    return zToG(cmul([z1, 0], cdiv(A, B)));
  }

  if (method === 'dstub'){
    let y = cdiv([1, 0], [r, x]);
    y = [y[0], y[1] + stub(sol.ls1, openStub)];
    const gb = travel(zToG(cdiv([1, 0], y)), dd);
    let yb = cdiv([1, 0], gToZ(gb));
    yb = [yb[0], yb[1] + stub(sol.ls2, openStub)];
    return zToG(cdiv([1, 0], yb));
  }
  return null;
}

function bandOf(cfg, sol, lim){
  const at = k => mag(gammaAt(cfg, sol, k));
  if (at(1) > lim) return null;
  const step = 0.0015;
  let lo = 1, hi = 1;
  while (lo > 0.02 && at(lo - step) <= lim) lo -= step;
  while (hi < 3.0  && at(hi + step) <= lim) hi += step;
  return hi - lo;
}

(async () => {
  const s = H.suite('response');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1250 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
  await p.waitForTimeout(2600);

  const pick = m => p.evaluate(m => {
    const sel = document.getElementById('i-method');
    sel.value = m; sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, m);

  /* read the design the page is showing, out of the practice fields */
  const designOf = async (m) => {
    await p.evaluate(() => {
      const pb = document.getElementById('b-prac');
      if (pb.getAttribute('aria-pressed') !== 'true') pb.click();
    });
    await p.waitForTimeout(200);
    await pick(m); await p.waitForTimeout(350);
    await p.click('#b-prac-show'); await p.waitForTimeout(500);
    return p.evaluate(() => {
      const v = id => { const e = document.getElementById(id); return e ? parseFloat(e.value) : null; };
      const ob = document.getElementById('p-order');
      return { d: v('i-d'), l1: v('p-l1'), l2: v('p-l2'), z1: v('p-z1'),
               x1: v('p-x1'), b1: v('p-b1'),
               order: ob ? ob.textContent.trim() : null };
    });
  };

  const cfg0 = await p.evaluate(() => ({
    r: 25/50, x: -30/50, openStub: false, dd: 0.125
  }));

  const LIM = (2 - 1)/(2 + 1);           /* SWR 2 */

  for (const m of ['shunt', 'series', 'qwt', 'lnet', 'dstub']){
    const d = await designOf(m);
    const cfg = Object.assign({}, cfg0, { method: m });
    const sol = { d: d.d, ls: d.l1, ls1: d.l1, ls2: d.l2,
                  z1: d.z1 / 50, xs: d.x1, bp: d.b1,
                  order: d.order && d.order.indexOf('shunt') >= 0 ? 'shunt first' : 'series first' };

    /* the decisive one: the design must actually match at f0 */
    const g0 = mag(gammaAt(cfg, sol, 1));
    s.check(m + ': independent sweep gives |G| = 0 at f0', g0 < 2e-3, '|G| = ' + g0.toExponential(2));

    /* and the page's own bandwidth must agree with this file's */
    const mine = bandOf(cfg, sol, LIM);
    const shown = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#big > div')];
      const row = rows.find(r => r.querySelector('dt').textContent.trim() === 'Bandwidth');
      return row ? row.querySelector('dd').textContent.trim() : null;
    });
    const got = shown && shown !== '—' ? parseFloat(shown) : null;
    const want = mine == null ? null : mine*100;
    const ok = (got == null && want == null) ||
               (got != null && want != null && Math.abs(got - want) <= 0.35);
    s.check(m + ': page bandwidth matches the independent sweep', ok,
            'page ' + shown + '   independent ' + (want == null ? 'none' : want.toFixed(1) + ' %'));
  }

  /* the response must actually change with the limit -- a control that does
     nothing is the failure this suite exists to catch */
  /* leave practice mode first: reading the designs above turned it on, and a
     fresh attempt is not matched, so the band would read as none */
  await p.evaluate(() => {
    const pb = document.getElementById('b-prac');
    if (pb.getAttribute('aria-pressed') === 'true') pb.click();
  });
  await p.waitForTimeout(250);
  await pick('shunt'); await p.waitForTimeout(400);
  const readBw = () => p.evaluate(() => {
    const rows = [...document.querySelectorAll('#big > div')];
    const row = rows.find(r => r.querySelector('dt').textContent.trim() === 'Bandwidth');
    return row ? row.querySelector('dd').textContent.trim() : null;
  });
  const at2 = await readBw();
  await p.evaluate(() => { const e = document.getElementById('i-blim');
    e.value = '3'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(400);
  const at3 = await readBw();
  s.check('a looser SWR limit gives a wider band',
          parseFloat(at3) > parseFloat(at2), at2 + ' -> ' + at3);

  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' '));

  await b.close();
  await srv.close();
  s.done();
})();
