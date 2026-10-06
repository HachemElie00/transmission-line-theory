/* Chapter 06, reflection: every computed figure against the theory.

   - Gamma for each load from (ZL - Z0)/(ZL + Z0) in complex arithmetic here,
     with the readouts and the power split checked against it.
   - The mismatched source is checked by a different route from the page's:
     the page sums echoes; here the circuit is solved directly -- source, Rg,
     a lossless line of length l (tangent formula), the load -- and the power
     into the line, which a lossless line delivers to the load, is divided by
     the source's available power. Its claims are tested as properties: the
     extremes, the matched-source line, and full power only when |Gg| = |GL|.
   - The TDR trace is checked by integrating each load's own differential
     equation with Runge-Kutta, driven by the Thevenin equivalent of the
     arriving wave, and the time constant is measured off that solution.

   Run:  node tests/ch06.test.js                                            */

const H = require('./lib/harness');
const T = require('./lib/tline');

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
const num = s => parseFloat(String(s).replace(/−/g, '-'));

(async () => {
  const s = H.suite('ch06');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'reflection.html', { waitUntil: 'load' });
  await p.waitForTimeout(1800);

  const drawn = id => p.evaluate(id => JSON.parse(document.getElementById(id).getAttribute('data-drawn') || 'null'), id);
  const text = id => p.evaluate(id => document.getElementById(id).textContent, id);
  const set = (id, v, ev) => p.evaluate(({ id, v, ev }) => {
    const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event(ev || 'input', { bubbles: true }));
  }, { id, v, ev });
  const click = sel => p.evaluate(sel => document.querySelector(sel).click(), sel);
  const fails = {};
  const bad = (k, why) => (fails[k] = fails[k] || []).push(why);

  /* ================= Gamma on the complex plane ================= */
  const checkG = async (tag, R, X, Z0, open) => {
    const D = await drawn('gplane'), B = await drawn('gbars');
    let g;
    if (open) g = [1, 0];
    else { const q = T.div(T.C(R - Z0, X), T.C(R + Z0, X)); g = [q.re, q.im]; }
    if (dist(D.g, g) > 1e-9) bad('Gamma: the point', tag + ': ' + D.g + ' vs ' + g);
    const m = Math.hypot(g[0], g[1]);
    if (!printedOk(num(await text('r-gm')), m, 3)) bad('Gamma: |Gamma| readout', tag + ': ' + await text('r-gm'));
    const deg = Math.atan2(g[1], g[0])*180/Math.PI, ga = num(await text('r-ga'));
    if (m > 1e-4 && Math.abs(((ga - deg) % 360 + 540) % 360 - 180) > 0.5 + 1e-9) bad('Gamma: angle readout', tag + ': ' + await text('r-ga') + ' vs ' + deg);
    if (!printedOk(num(await text('r-pw')), 100*m*m, 1)) bad('Gamma: power reflected', tag + ': ' + await text('r-pw'));
    const rl = await text('r-rl');
    if (m < 1e-4 ? rl !== '∞' : !printedOk(num(rl), -20*Math.log10(m), 1)) bad('Gamma: return loss', tag + ': ' + rl);
    if (Math.abs(B.reflected - m*m) > 1e-9 || Math.abs(B.delivered - (1 - m*m)) > 1e-9) bad('Gamma: the power split', tag);
    /* where the table says each kind of load lands */
    if (!open && X === 0 && R > Z0 && !(g[0] > 0 && g[0] < 1 && Math.abs(g[1]) < 1e-12)) bad('Gamma: R > Z0 on the right of the axis', tag);
    if (!open && X === 0 && R < Z0 && !(g[0] < 0 && g[0] >= -1 && Math.abs(g[1]) < 1e-12)) bad('Gamma: R < Z0 on the left of the axis', tag);
    if (!open && R === 0 && Math.abs(m - 1) > 1e-12) bad('Gamma: a reactance on the unit circle', tag);
  };
  for (const z0 of [50, 75, 150]){
    await set('z0sel', z0, 'change');
    for (const [R, X] of [[90, -120], [0, 0], [0, 120], [300, 0], [20, 0], [0, -250], [150, 250], [1, 1]]){
      await set('rl', R); await set('xl', X);
      await checkG('Z0 ' + z0 + ' ZL ' + R + ' ' + X, R, X, z0, false);
    }
    await click('button[data-match]'); await checkG('Z0 ' + z0 + ' matched', z0, 0, z0, false);
    const D = await drawn('gplane');
    if (Math.hypot(...D.g) > 1e-12) bad('Gamma: matched is matched at every Z0', 'Z0 ' + z0);
    await click('#gopen'); await checkG('Z0 ' + z0 + ' open', 0, 0, z0, true);
    await click('button[data-g="0,120"]'); await checkG('Z0 ' + z0 + ' inductor', 0, 120, z0, false);
  }

  /* ================= the mismatched source ================= */
  for (const [Rg, RL, XL] of [[20, 120, 40], [50, 120, 40], [5, 300, -150], [200, 5, 150], [120, 50, 0], [33, 77, -60]]){
    await set('sg-r', Rg); await set('sg-l', RL); await set('sg-x', XL);
    const D = await drawn('srcfig'), tag = 'Rg ' + Rg + ' ZL ' + RL + ' ' + XL, Z0 = 50;
    /* the circuit itself: power into the line over the available power */
    const ratio = l => {
      const zin = T.mul(T.zin(T.C(RL/Z0, XL/Z0), l), T.C(Z0, 0));      /* ohms */
      const den = T.add(T.C(Rg, 0), zin), d2 = den.re*den.re + den.im*den.im;
      return 4*Rg*zin.re/d2;                                          /* |Vg|^2 Re(Zin)/(2|Rg+Zin|^2) over |Vg|^2/(8Rg) */
    };
    let worst = 0;
    for (const [l, v] of D.curve) worst = Math.max(worst, Math.abs(v - ratio(l)));
    if (worst > 1e-8) bad('mismatched source: the curve is the circuit', tag + ': off by ' + worst);
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i <= 20000; i++){ const v = ratio(0.5*i/20000); mn = Math.min(mn, v); mx = Math.max(mx, v); }
    if (Math.abs(D.min - mn) > 1e-6 || Math.abs(D.max - mx) > 1e-6) bad('mismatched source: least and most delivered', tag + ': ' + [D.min, D.max] + ' vs ' + [mn, mx]);
    if (!printedOk(num(await text('sg-min')), mn, 3) || !printedOk(num(await text('sg-max')), mx, 3))
      bad('mismatched source: readouts', tag + ': ' + await text('sg-min') + ' / ' + await text('sg-max'));
    const gg = Math.abs((Rg - Z0)/(Rg + Z0)), gl = Math.hypot(...(() => { const q = T.div(T.C(RL - Z0, XL), T.C(RL + Z0, XL)); return [q.re, q.im]; })());
    if (!printedOk(num(await text('sg-gg')), gg, 3) || !printedOk(num(await text('sg-gl')), gl, 3)) bad('mismatched source: |Gamma| readouts', tag);
    /* the dashed line: what a matched source would deliver, by the same circuit with Rg = Z0 */
    const zin0 = T.mul(T.zin(T.C(RL/Z0, XL/Z0), 0.1), T.C(Z0, 0)), d0 = T.add(T.C(Z0, 0), zin0);
    if (Math.abs(D.matchedSource - 4*Z0*zin0.re/(d0.re*d0.re + d0.im*d0.im)) > 1e-9) bad('mismatched source: matched-source line', tag);
    /* with either end matched the length stops mattering */
    if (Rg === 50 && mx - mn > 1e-9) bad('mismatched source: no ripple with the source matched', tag);
  }
  /* the claim: full available power is reached only when |Gg| = |GL| */
  { const Z0 = 50, RL = 120, XL = 40, q = T.div(T.C(RL - Z0, XL), T.C(RL + Z0, XL)), gl = Math.hypot(q.re, q.im);
    const RgEq = Z0*(1 - gl)/(1 + gl);                                 /* Rg < Z0 with |Gg| = |GL| */
    for (const [Rg, full] of [[RgEq, true], [RgEq*0.8, false], [Math.min(200, Z0*(1 + gl)/(1 - gl)), true]]){
      let mx = 0;
      for (let i = 0; i <= 20000; i++){
        const zin = T.mul(T.zin(T.C(RL/Z0, XL/Z0), 0.5*i/20000), T.C(Z0, 0)), den = T.add(T.C(Rg, 0), zin);
        mx = Math.max(mx, 4*Rg*zin.re/(den.re*den.re + den.im*den.im));
      }
      if ((Math.abs(mx - 1) < 1e-6) !== full) bad('mismatched source: full power only when |Gg| = |GL| (as claimed)', 'Rg ' + Rg.toFixed(3) + ': max ' + mx);
    } }

  /* ================= the TDR ================= */
  for (const kind of ['r', 'rl', 'rc']) for (const [R, X] of [[50, 20], [0, 5], [250, 60], [10, 1], [100, 33]]){
    await set('td-k', kind, 'change'); await set('td-r', R); await set('td-x', X);
    const D = await drawn('tdrfig'), tag = kind + ' R ' + R + ' X ' + X, Z0 = 50, VP = 0.5;
    /* integrate the load's own equation, driven by 2V+ behind Z0 (ns, ohms, nH, pF) */
    const vL = tEnd => {
      if (kind === 'r') return 2*VP*R/(R + Z0);
      let y = 0; const n = 4000, h = tEnd/n;
      const f = kind === 'rl'
        ? i => (2*VP - (R + Z0)*i)/(X*1e-9)*1e-9                      /* di/dt, per ns */
        : v => ((2*VP - v)/Z0 - (R > 0 ? v/R : 1e12*v))/(X*1e-12)*1e-9; /* dv/dt, per ns */
      for (let k = 0; k < n; k++){
        const k1 = f(y), k2 = f(y + h*k1/2), k3 = f(y + h*k2/2), k4 = f(y + h*k3);
        y += h*(k1 + 2*k2 + 2*k3 + k4)/6;
      }
      return kind === 'rl' ? 2*VP - Z0*y : y;
    };
    let worst = 0;
    for (const [t, v] of D.trace){
      const want = t < 2 ? VP : vL(t - 2);
      if (kind === 'rc' && R === 0) continue;                         /* a short across C: no dynamics to integrate */
      worst = Math.max(worst, Math.abs(v - want));
    }
    if (worst > 1e-6) bad('TDR: the trace is the load’s equation', tag + ': off by ' + worst);
    const gR = (R - Z0)/(R + Z0);
    const g0 = kind === 'r' ? gR : kind === 'rl' ? 1 : -1;
    if (Math.abs(D.g0 - g0) > 1e-9 || Math.abs(D.g1 - gR) > 1e-9) bad('TDR: first and settled reflection', tag + ': ' + [D.g0, D.g1]);
    const f3 = v => Math.abs(v) < 5e-4 ? '0.000' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(3);
    if (await text('td-g0') !== f3(g0) || await text('td-g1') !== f3(gR)) bad('TDR: readouts', tag + ': ' + await text('td-g0') + ' ' + await text('td-g1'));
    if (kind !== 'r' && !(kind === 'rc' && R === 0)){
      /* the time constant, measured: when the reflection has relaxed to 1/e of the way */
      const gam = t => (vL(t) - VP)/VP, target = gR + (g0 - gR)/Math.E;
      let a = 0, c = 50;
      for (let i = 0; i < 60; i++){ const m = (a + c)/2; if ((gam(m) - target)*(g0 - gR) > 0) a = m; else c = m; }
      if (Math.abs(D.tau - a) > 1e-4*Math.max(1, a)) bad('TDR: time constant', tag + ': ' + D.tau + ' vs measured ' + a);
      if (!printedOk(num(await text('td-tau')), a, 2)) bad('TDR: time constant readout', tag + ': ' + await text('td-tau'));
    }
  }

  const keys = ['Gamma: the point', 'Gamma: |Gamma| readout', 'Gamma: angle readout', 'Gamma: power reflected', 'Gamma: return loss',
    'Gamma: the power split', 'Gamma: R > Z0 on the right of the axis', 'Gamma: R < Z0 on the left of the axis',
    'Gamma: a reactance on the unit circle', 'Gamma: matched is matched at every Z0',
    'mismatched source: the curve is the circuit', 'mismatched source: least and most delivered', 'mismatched source: readouts',
    'mismatched source: |Gamma| readouts', 'mismatched source: matched-source line', 'mismatched source: no ripple with the source matched',
    'mismatched source: full power only when |Gg| = |GL| (as claimed)',
    'TDR: the trace is the load’s equation', 'TDR: first and settled reflection', 'TDR: readouts', 'TDR: time constant',
    'TDR: time constant readout'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
