/* Chapter 09, line lengths: every computed figure against the theory.

   - the quarter-wave transformer's response from lib/tline (a section of Z1
     normalised to itself, by the tangent formula), its band found here by scan
     and bisection, and the claim that a harder match is a narrower one;
   - multisection designs checked by their DEFINING properties, not by
     re-deriving the page's numbers: binomial steps in the ratio of binomial
     coefficients, Chebyshev equal ripple at Gm, every design's logs summing to
     ln(RL/Z0); the exact response by an independent cascade; the exponential
     taper against the continuous line integrated by Runge-Kutta;
   - Richards: the lumped filter against the Butterworth loss 10 log(1 + w^6),
     the stub filter against the same with w = tan(pi f / 4 fc);
   - Kuroda: both networks multiplied out here as ABCD matrices.

   Run:  node tests/ch09.test.js                                            */

const H = require('./lib/harness');
const T = require('./lib/tline');

const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
const num = s => parseFloat(String(s).replace(/−/g, '-'));
const gAbs = (z, Z0) => { const q = T.div(T.add(z, T.C(-Z0, 0)), T.add(z, T.C(Z0, 0))); return Math.hypot(q.re, q.im); };
/* a contiguous band of f(x) <= lim around x0, within [a, b], by scan and bisection */
function bandOf(f, lim, x0, a, b){
  if (f(x0) > lim) return null;
  let lo = x0, hi = x0, nx; const st = 1e-4;
  while (lo > a){ nx = Math.max(a, lo - st); if (f(nx) > lim) break; lo = nx; }
  while (hi < b){ nx = Math.min(b, hi + st); if (f(nx) > lim) break; hi = nx; }
  const edge = (p, q) => { for (let i = 0; i < 70; i++){ const m = (p + q)/2; if (f(m) <= lim) p = m; else q = m; } return p; };
  if (lo > a) lo = edge(lo, Math.max(a, lo - st));
  if (hi < b) hi = edge(hi, Math.min(b, hi + st));
  return [lo, hi];
}

(async () => {
  const s = H.suite('ch09');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'line-lengths.html', { waitUntil: 'load' });
  await p.waitForTimeout(1800);

  const drawn = id => p.evaluate(id => JSON.parse(document.getElementById(id).getAttribute('data-drawn') || 'null'), id);
  const text = id => p.evaluate(id => document.getElementById(id).textContent, id);
  const set = (id, v, ev) => p.evaluate(({ id, v, ev }) => {
    const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event(ev || 'input', { bubbles: true }));
  }, { id, v, ev });
  const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fails = {};
  const bad = (k, why) => (fails[k] = fails[k] || []).push(why);
  const Z0 = 50;

  /* ================= the quarter-wave transformer ================= */
  const widths = [];
  for (const RL of [100, 25, 200, 12, 50, 51, 300, 5]) for (const gm of [0.2, 0.05, 0.5]){
    await set('rl', RL); await set('tol', gm); await frame();
    const D = await drawn('qwt'), tag = 'RL ' + RL + ' Gm ' + gm, Z1 = Math.sqrt(Z0*RL);
    const g = f => gAbs(T.mul(T.zin(T.C(RL/Z1, 0), 0.25*f), T.C(Z1, 0)), Z0);
    if (g(1) > 1e-9) bad('qwt: Z1 matches at f0', tag + ': ' + g(1));
    if (D.curve.some(([f, v]) => Math.abs(v - g(f)) > 1e-9)) bad('qwt: the curve', tag);
    const bi = bandOf(g, gm, 1, 0, 2);
    if (!bi || Math.abs(bi[0] - D.band[0]) > 1e-6 || Math.abs(bi[1] - D.band[1]) > 1e-6) bad('qwt: band edges', tag + ': ' + D.band + ' vs ' + bi);
    const whole = bi[0] <= 1e-9 && bi[1] >= 2 - 1e-9;
    const bt = await text('q-band'), bw = await text('q-bw');
    if (whole){ if (bt !== 'whole sweep') bad('qwt: band readouts', tag + ': ' + bt); }
    else {
      const mm = String(bt).match(/^(\d\.\d\d)–(\d\.\d\d) f0$/);
      if (!(mm && printedOk(+mm[1], bi[0], 2) && printedOk(+mm[2], bi[1], 2) && printedOk(num(bw), 100*(bi[1] - bi[0]), 0)))
        bad('qwt: band readouts', tag + ': ' + bt + ' ' + bw + ' vs ' + bi.map(v => v.toFixed(4)));
      if (gm === 0.2 && RL >= 50) widths.push([RL, bi[1] - bi[0]]);
    }
    if (!printedOk(num(await text('q-z1')), Z1, 1)) bad('qwt: Z1 readout', tag);
    const g0 = Math.abs(RL - Z0)/(RL + Z0);
    if (!printedOk(num(await text('q-swr')), (1 + g0)/(1 - g0), 2) || !printedOk(num(await text('q-lim')), (1 + gm)/(1 - gm), 2)) bad('qwt: SWR readouts', tag);
  }
  /* the claim: a harder match is a narrower one */
  widths.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < widths.length; i++) if (widths[i][1] > widths[i-1][1] + 1e-9) bad('qwt: a harder match is narrower (as claimed)', JSON.stringify(widths));

  /* ================= stubs ================= */
  { const D = await drawn('stub');
    if (D.samples.some(([u, sh, op]) => Math.abs(sh - Math.tan(2*Math.PI*u)) > 1e-9*Math.max(1, Math.abs(sh)) ||
                                        Math.abs(op + 1/Math.tan(2*Math.PI*u)) > 1e-9*Math.max(1, Math.abs(op)))) bad('stubs: the reactances', '');
    /* the table's lambda/8 rows */
    if (Math.abs(Math.tan(2*Math.PI*0.125) - 1) > 1e-12 || Math.abs(-1/Math.tan(2*Math.PI*0.375) - 1) > 1e-12) bad('stubs: the table', ''); }

  /* ================= multisection transformers and a taper ================= */
  const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r*(n - k + i)/i; return r; };
  const cheT = (n, x) => Math.abs(x) <= 1 ? Math.cos(n*Math.acos(x)) : Math.sign(x)**n*Math.cosh(n*Math.acosh(Math.abs(x)));
  for (const kind of ['bin', 'cheb', 'taper']) for (const N of [1, 3, 6]) for (const RL of [100, 10, 300, 55]){
    await set('mt-k', kind, 'change'); await set('mt-n', N); await set('mt-r', RL); await frame();
    const D = await drawn('mtfig'), tag = kind + ' N ' + N + ' RL ' + RL, GM = 0.05;
    let exact;
    if (kind !== 'taper'){
      const z = D.sections, gs = D.gammas.g;
      /* the design: logs of the steps add up to ln(RL/Z0) */
      const steps = [Math.log(z[0]/Z0)].concat(z.slice(1).map((v, i) => Math.log(v/z[i]))).concat([Math.log(RL/z[z.length - 1])]);
      if (Math.abs(steps.reduce((a, c) => a + c, 0) - Math.log(RL/Z0)) > 1e-7) bad('multisection: the steps reach RL', tag);
      if (Math.abs(2*gs.reduce((a, c) => a + c, 0) - Math.log(RL/Z0)) > 1e-7) bad('multisection: the steps reach RL', tag + ' (junction reflections)');
      if (!D.gammas.cheb){
        /* binomial: steps in the ratio of binomial coefficients */
        for (let n = 0; n <= N; n++) if (Math.abs(gs[n] - Math.pow(2, -N)*binom(N, n)*0.5*Math.log(RL/Z0)) > 2e-9) { bad('multisection: binomial coefficients', tag); break; }
      } else {
        /* Chebyshev: the small-reflection response is Gm |T_N(sec cos theta)|, with
           sec from |Gamma(0)| = |ln(RL/Z0)|/2, and equal ripple Gm in the band */
        const sec = Math.cosh(Math.acosh(Math.abs(Math.log(RL/Z0))/2/GM)/N);
        let worst = 0, peak = 0;
        for (let i = 0; i <= 400; i++){
          const th = Math.PI*i/400;
          let re = 0, im = 0; gs.forEach((gn, n) => { re += gn*Math.cos(2*n*th); im -= gn*Math.sin(2*n*th); });
          const want = GM*Math.abs(cheT(N, sec*Math.cos(th)));
          worst = Math.max(worst, Math.abs(Math.hypot(re, im) - want));
          if (Math.abs(sec*Math.cos(th)) <= 1) peak = Math.max(peak, Math.hypot(re, im));
        }
        if (worst > 1e-7) bad('multisection: Chebyshev response', tag + ': ' + worst);
        /* the ripple peaks, including the passband edge where sec cos(theta) = 1 */
        const thm = Math.acos(1/sec);
        let re = 0, im = 0; gs.forEach((gn, n) => { re += gn*Math.cos(2*n*thm); im -= gn*Math.sin(2*n*thm); });
        peak = Math.max(peak, Math.hypot(re, im));
        if (Math.abs(peak - GM) > 1e-6) bad('multisection: Chebyshev equal ripple at Gm', tag + ': ' + peak);
      }
      /* exact: cascade the sections from the load, each a line of its own Z */
      exact = f => { let zl = T.C(RL, 0);
        for (let i = z.length - 1; i >= 0; i--) zl = T.mul(T.zin(T.div(zl, T.C(z[i], 0)), 0.25*f), T.C(z[i], 0));
        return gAbs(zl, Z0); };
      const theory = f => { let re = 0, im = 0; gs.forEach((gn, n) => { re += gn*Math.cos(2*n*Math.PI/2*f); im -= gn*Math.sin(2*n*Math.PI/2*f); }); return Math.hypot(re, im); };
      if (D.curve.some(([f, e, t]) => Math.abs(e - exact(f)) > 1e-7 || Math.abs(t - theory(f)) > 1e-7)) bad('multisection: exact and theory curves', tag);
      if (Math.abs(exact(1)) > 0.05 + 1e-9) bad('multisection: within Gm at f0', tag);
      /* the band */
      const bi = bandOf(f => exact(Math.max(f, 1e-9)), GM, 1, 0, 2);
      if ((bi === null) !== (D.band.lo === null) || (bi && (Math.abs(bi[0] - D.band.lo) > 1e-6 || Math.abs(bi[1] - D.band.hi) > 1e-6)))
        bad('multisection: band edges', tag + ': ' + JSON.stringify(D.band) + ' vs ' + bi);
      /* and what the readout says about it: the whole sweep, more than, or the width */
      if (bi){
        const ro = await p.evaluate(() => document.getElementById('mt-ro').textContent);
        const whole = bi[0] <= 1e-9 && bi[1] >= 2 - 1e-9, open = bi[0] <= 1e-9 || bi[1] >= 2 - 1e-9;
        const m = ro.match(/band at \|Γ\| ≤ 0\.05(whole sweep|(> )?(\d+) %)/);
        if (!m || (whole ? m[1] !== 'whole sweep' : (!!m[2] !== open || !printedOk(+m[3], 100*(bi[1] - bi[0]), 0))))
          bad('multisection: band readout', tag + ': ' + (m && m[1]) + ' vs ' + bi);
      }
      /* the worst gap between design formula and exact response */
      let mx = 0; for (let i = 4; i <= 40000; i++){ const f = 2*i/40000; mx = Math.max(mx, Math.abs(exact(f) - theory(f))); }
      if (Math.abs(D.worst - mx) > 2e-5) bad('multisection: theory vs exact, worst', tag + ': ' + D.worst + ' vs ' + mx);
      /* the claim: the design formula and the exact response agree closely (small steps) */
      if (Math.abs(Math.log(RL/Z0)) < 1 && mx > 0.02) bad('multisection: theory agrees with exact for small steps (as claimed)', tag + ': ' + mx);
    } else {
      /* the continuous exponential taper, N quarter waves long: integrate
         dV/ds = -j b Z I, dI/ds = -j b V/Z from the load, Z(s) = Z0 (RL/Z0)^(s/L) */
      exact = f => {
        const L = N*0.25, M = 4000, h = L/M, bt = 2*Math.PI*f, a = Math.log(RL/Z0)/L;
        let V = [RL, 0], I = [1, 0];
        const der = (s, V, I) => { const Z = Z0*Math.exp(a*s);
          return [[bt*Z*I[1], -bt*Z*I[0]], [bt*V[1]/Z, -bt*V[0]/Z]]; };
        /* integrating from the load (s = L) toward the source (s = 0): ds < 0, and the
           wave equations for distance measured from the source end */
        const step = (s, V, I, hh) => {
          const k1 = der(s, V, I);
          const k2 = der(s + hh/2, [V[0] + hh/2*k1[0][0], V[1] + hh/2*k1[0][1]], [I[0] + hh/2*k1[1][0], I[1] + hh/2*k1[1][1]]);
          const k3 = der(s + hh/2, [V[0] + hh/2*k2[0][0], V[1] + hh/2*k2[0][1]], [I[0] + hh/2*k2[1][0], I[1] + hh/2*k2[1][1]]);
          const k4 = der(s + hh, [V[0] + hh*k3[0][0], V[1] + hh*k3[0][1]], [I[0] + hh*k3[1][0], I[1] + hh*k3[1][1]]);
          return [[V[0] + hh/6*(k1[0][0] + 2*k2[0][0] + 2*k3[0][0] + k4[0][0]), V[1] + hh/6*(k1[0][1] + 2*k2[0][1] + 2*k3[0][1] + k4[0][1])],
                  [I[0] + hh/6*(k1[1][0] + 2*k2[1][0] + 2*k3[1][0] + k4[1][0]), I[1] + hh/6*(k1[1][1] + 2*k2[1][1] + 2*k3[1][1] + k4[1][1])]];
        };
        for (let k = 0; k < M; k++){ const r = step(L - k*h, V, I, -h); V = r[0]; I = r[1]; }
        return gAbs(T.div(T.C(V[0], V[1]), T.C(I[0], I[1])), Z0);
      };
      const theory = f => { const bl = Math.PI/2*f*N; return 0.5*Math.abs(Math.log(RL/Z0))*Math.abs(Math.sin(bl)/bl); };
      if (D.curve.some(([f, e, t]) => Math.abs(t - theory(f)) > 1e-7)) bad('taper: theory curve is |sin bL / bL|', tag);
      const worstC = Math.max(...D.curve.map(([f, e]) => Math.abs(e - exact(f))));
      if (worstC > 3e-3) bad('taper: exact curve is the continuous taper', tag + ': ' + worstC);
      /* |Gamma| <= 0.05 above: the last excursion, found on the continuous taper */
      let lo = 0; for (let f = 2; f > 0; f -= 0.002) if (exact(f) > GM){ let a = f + 0.002, c = f;
        for (let i = 0; i < 40; i++){ const m = (a + c)/2; if (exact(m) <= GM) a = m; else c = m; } lo = a; break; }
      if (D.band.lo !== null && Math.abs(D.band.lo - lo) > 5e-3) bad('taper: band edge', tag + ': ' + D.band.lo + ' vs ' + lo);
    }
  }

  /* ================= Richards ================= */
  { const D = await drawn('rcfig');
    /* Butterworth, third order: loss = 10 log10(1 + w^6); stubs: w = tan(pi f / 4) */
    const lossL = f => 10*Math.log10(1 + Math.pow(f, 6)), lossS = f => 10*Math.log10(1 + Math.pow(Math.tan(Math.PI*f/4), 6));
    for (const [f, l, st] of D.curve){
      if (Math.abs(l - lossL(f)) > 1e-6*Math.max(1, l)) { bad('Richards: lumped filter is Butterworth', 'f ' + f + ': ' + l + ' vs ' + lossL(f)); break; }
      if (Math.abs(f - 2) > 0.02 && Math.abs(st - lossS(f)) > 1e-6*Math.max(1, st)) { bad('Richards: stub filter is Butterworth in tan', 'f ' + f); break; }
    }
    const rc = String(await text('rc-c'));
    if (rc !== '3.01 / 3.01 dB') bad('Richards: loss at fc', rc);
    if (Math.abs(D.period - 4) > 1e-9 || await text('rc-p') !== '4.00 fc') bad('Richards: repeats every 4 fc', await text('rc-p'));
    if (String(await text('rc-2')).replace(/\s/g, '') !== (lossL(2).toFixed(1) + '/∞dB')) bad('Richards: at 2 fc', await text('rc-2')); }

  /* ================= Kuroda ================= */
  { const D = await drawn('kufig');
    const C = (r, i) => T.C(r, i), mm = (A, B) => [[T.add(T.mul(A[0][0], B[0][0]), T.mul(A[0][1], B[1][0])), T.add(T.mul(A[0][0], B[0][1]), T.mul(A[0][1], B[1][1]))],
                                                 [T.add(T.mul(A[1][0], B[0][0]), T.mul(A[1][1], B[1][0])), T.add(T.mul(A[1][0], B[0][1]), T.mul(A[1][1], B[1][1]))]];
    /* a unit element as a line section; stubs by their own impedance and admittance */
    const ue = (Z, th) => [[C(Math.cos(th), 0), C(0, Z*Math.sin(th))], [C(0, Math.sin(th)/Z), C(Math.cos(th), 0)]];
    const serShort = (Z, th) => [[C(1, 0), C(0, Z*Math.tan(th))], [C(0, 0), C(1, 0)]];
    const shOpen = (Z, th) => [[C(1, 0), C(0, 0)], [C(0, Math.tan(th)/Z), C(1, 0)]];
    let worst = 0;
    for (const [z1, z2] of [[1.3, 0.7], [0.5, 2], [3, 0.2]]){
      const n2 = 1 + z2/z1;
      for (let i = 1; i < 400; i++){
        const th = Math.PI/4*4*i/400; if (Math.abs(Math.cos(th)) < 0.05) continue;
        const A = mm(ue(z1, th), shOpen(z2, th)), B = mm(serShort(z1/n2, th), ue(z2/n2, th));
        for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) worst = Math.max(worst, Math.hypot(A[r][c].re - B[r][c].re, A[r][c].im - B[r][c].im)/Math.max(1, Math.hypot(A[r][c].re, A[r][c].im)));
      }
    }
    if (worst > 1e-9) bad('Kuroda: the identity holds (as stated)', 'worst ' + worst);
    if (!(D.worst < 1e-9) || Math.abs(D.n2 - (1 + D.z2/D.z1)) > 1e-8) bad('Kuroda: the page’s own check', JSON.stringify(D));
    if (await text('ku-z') !== D.z1 + ', ' + D.z2) bad('Kuroda: the values tried', await text('ku-z')); }

  const keys = ['qwt: Z1 matches at f0', 'qwt: the curve', 'qwt: band edges', 'qwt: band readouts', 'qwt: Z1 readout', 'qwt: SWR readouts',
    'qwt: a harder match is narrower (as claimed)', 'stubs: the reactances', 'stubs: the table',
    'multisection: the steps reach RL', 'multisection: binomial coefficients', 'multisection: Chebyshev response',
    'multisection: Chebyshev equal ripple at Gm', 'multisection: exact and theory curves', 'multisection: within Gm at f0',
    'multisection: band edges', 'multisection: band readout', 'multisection: theory vs exact, worst', 'multisection: theory agrees with exact for small steps (as claimed)',
    'taper: theory curve is |sin bL / bL|', 'taper: exact curve is the continuous taper', 'taper: band edge',
    'Richards: lumped filter is Butterworth', 'Richards: stub filter is Butterworth in tan', 'Richards: loss at fc',
    'Richards: repeats every 4 fc', 'Richards: at 2 fc', 'Kuroda: the identity holds (as stated)', 'Kuroda: the page’s own check',
    'Kuroda: the values tried'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
