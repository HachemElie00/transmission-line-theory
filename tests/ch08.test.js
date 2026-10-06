/* Chapter 08, input impedance: every computed figure against the theory.

   - Z_in along the line from lib/tline's tangent formula, never from the
     page's rotation of Gamma;
   - the lossy line from the hyperbolic form Z0 (ZL + Z0 tanh gd)/(Z0 + ZL
     tanh gd), with alpha from the dB figure by its definition, and the "below
     0.1 beyond" length found by scanning;
   - the short/open measurement: Zsc and Zoc from the test line's own Z0 and
     gamma, and the inversion required to recover them (beta l modulo pi);
   - Foster: the stub reactances, and the claim itself -- every branch rises,
     poles and zeros alternate;
   - the resonator: Q measured here off |Z0 tanh(gl)| by its half-power
     points, and the claim Q = beta/2alpha tested against that measurement.

   Run:  node tests/ch08.test.js                                            */

const H = require('./lib/harness');
const T = require('./lib/tline');
const TAU = 2*Math.PI;

const gam = z => { const g = T.div(T.add(z, T.C(-1, 0)), T.add(z, T.C(1, 0))); return [g.re, g.im]; };
const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
const num = s => parseFloat(String(s).replace(/−/g, '-'));
/* complex tanh, written out here */
const ctanh = (x, y) => { const d = Math.cosh(2*x) + Math.cos(2*y); return T.C(Math.sinh(2*x)/d, Math.sin(2*y)/d); };

(async () => {
  const s = H.suite('ch08');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'input-impedance.html', { waitUntil: 'load' });
  await p.waitForTimeout(1800);

  const drawn = id => p.evaluate(id => JSON.parse(document.getElementById(id).getAttribute('data-drawn') || 'null'), id);
  const text = id => p.evaluate(id => document.getElementById(id).textContent, id);
  const set = (id, v, ev) => p.evaluate(({ id, v, ev }) => {
    const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event(ev || 'input', { bubbles: true }));
  }, { id, v, ev });
  const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fails = {};
  const bad = (k, why) => (fails[k] = fails[k] || []).push(why);

  /* ================= watching it rotate ================= */
  const Z0 = 50;
  for (const [R, X] of [[25, 0], [50, 0], [0, 0], [0, 80], [30, -60], [250, 200], [7, -199]]) for (const d of [0, 0.06, 0.124, 0.25, 0.33, 0.5]){
    await set('zr', R); await set('zx', X); await set('zd', d); await frame();
    const P = await drawn('zplane'), Tr = await drawn('ztrace'), tag = 'ZL ' + R + ' ' + X + ' d ' + P.d;
    const zL = T.C(R/Z0, X/Z0), q = T.div(T.C(R - Z0, X), T.C(R + Z0, X));
    if (Math.hypot(P.gl[0] - q.re, P.gl[1] - q.im) > 1e-9) bad('rotate: Gamma_L', tag);
    const zin = T.mul(T.zin(zL, P.d), T.C(Z0, 0)), big = !isFinite(zin.re) || Math.abs(zin.re) > 9e5 || Math.abs(zin.im) > 9e5;
    if (!big && (Math.abs(P.zin[0] - zin.re) > 1e-6*Math.max(1, Math.abs(zin.re)) || Math.abs(P.zin[1] - zin.im) > 1e-6*Math.max(1, Math.abs(zin.im))))
      bad('rotate: Z_in is the line transformation', tag + ': ' + P.zin + ' vs ' + [zin.re, zin.im]);
    if (!big){ const gd = gam(T.zin(zL, P.d)); if (Math.hypot(P.gd[0] - gd[0], P.gd[1] - gd[1]) > 1e-7) bad('rotate: Gamma at d', tag); }
    for (const [dq, r, x] of Tr.trace){
      const zq = T.mul(T.zin(zL, dq), T.C(Z0, 0));
      if (!isFinite(zq.re) || Math.abs(zq.re) > 1e5 || Math.abs(zq.im) > 1e5) continue;
      if (Math.abs(r - zq.re) > 1e-6*Math.max(1, Math.abs(zq.re)) || Math.abs(x - zq.im) > 1e-6*Math.max(1, Math.abs(zq.im))){ bad('rotate: R and X traces', tag + ' at ' + dq); break; }
    }
    /* readouts */
    const m = Math.hypot(q.re, q.im);
    if (!printedOk(num(await text('z-gm')), m, 3)) bad('rotate: |Gamma| readout', tag);
    const sw = await text('z-swr');
    if (m >= 0.999 ? sw !== '∞' : !printedOk(num(sw), (1 + m)/(1 - m), 2)) bad('rotate: SWR readout', tag + ': ' + sw);
    if (num(await text('z-bd')) !== Math.round(360*P.d)) bad('rotate: beta d readout', tag + ': ' + await text('z-bd'));
    const zt = String(await text('z-zin')).replace(/−/g, '-');
    if (big){ if (!/→ ∞/.test(zt)) bad('rotate: Z_in readout', tag + ': ' + zt); }
    else {
      const mm = zt.match(/^(-?\d+(?:\.\d)?) ([+-]) j(\d+(?:\.\d)?) Ω$/);
      const dp = v => (String(v).split('.')[1] || '').length;
      if (!(mm && printedOk(+mm[1], zin.re, dp(mm[1])) && printedOk((mm[2] === '-' ? -1 : 1)*(+mm[3]), zin.im, dp(mm[3]))))
        bad('rotate: Z_in readout', tag + ': ' + zt + ' vs ' + zin.re.toFixed(3) + ' ' + zin.im.toFixed(3));
    }
    /* the claim: half a wavelength repeats the load */
    if (Math.abs(P.d - 0.5) < 1e-12 && !big && (Math.abs(zin.re - R) > 1e-6*Math.max(1, R) || Math.abs(zin.im - X) > 1e-6*Math.max(1, Math.abs(X)))) bad('rotate: a half-wave line repeats the load', tag);
  }

  /* ================= the lossy spiral ================= */
  for (const li of [0, 1, 2]) for (const db of [0.4, 0, 0.05, 1.3, 2]){
    await set('sp-l', li, 'change'); await set('sp-a', db); await frame();
    const D = await drawn('spfig'), tag = ['short', 'open', '25 - j50'][li] + ' ' + db + ' dB/lambda';
    const alpha = db*Math.log(10)/20;                                 /* Np per wavelength */
    const zinL = d => {                                               /* ohms, by the hyperbolic form */
      const th = ctanh(alpha*d, TAU*d);
      if (li === 0) return T.mul(T.C(Z0, 0), th);
      if (li === 1) return T.mul(T.C(Z0, 0), T.invc(th));
      const ZL = T.C(25, -50);
      return T.mul(T.C(Z0, 0), T.div(T.add(ZL, T.mul(T.C(Z0, 0), th)), T.add(T.C(Z0, 0), T.mul(ZL, th))));
    };
    const gIn = d => { const z = zinL(d); const q = T.div(T.add(z, T.C(-Z0, 0)), T.add(z, T.C(Z0, 0))); return [q.re, q.im]; };
    let worst = 0;
    for (const [d, gr, gi, zr, zi] of D.samples){
      const g = gIn(d), z = zinL(d);
      if (!isFinite(z.re) || Math.abs(z.re) > 1e6 || Math.abs(z.im) > 1e6) continue;
      worst = Math.max(worst, Math.hypot(gr - g[0], gi - g[1]), Math.abs(zr - z.re)/Math.max(1, Math.abs(z.re)), Math.abs(zi - z.im)/Math.max(1, Math.abs(z.im)));
    }
    if (worst > 1e-6) bad('lossy: Gamma and Z_in are the hyperbolic form', tag + ': ' + worst);
    if (!printedOk(num(await text('sp-g2')), Math.hypot(...gIn(2)), 3)) bad('lossy: |Gamma| after 2 lambda', tag + ': ' + await text('sp-g2'));
    /* below 0.1 beyond: scan, then bisect */
    /* an open has no finite Z_in at d = 0, so the scan starts just past the load */
    const l1 = await text('sp-l1'), m0 = Math.hypot(...gIn(1e-9));
    if (alpha < 1e-6){ if (l1 !== 'never') bad('lossy: |Gamma| < 0.1 beyond', tag + ': ' + l1); }
    else if (m0 <= 0.1){ if (num(l1) !== 0) bad('lossy: |Gamma| < 0.1 beyond', tag + ': ' + l1); }
    else {
      let lo = 0, hi = 1e-9; while (Math.hypot(...gIn(hi)) > 0.1) hi += 0.25;
      lo = hi - 0.25; for (let i = 0; i < 70; i++){ const m = (lo + hi)/2; if (Math.hypot(...gIn(m)) > 0.1) lo = m; else hi = m; }
      if (!printedOk(num(l1), hi, 2)) bad('lossy: |Gamma| < 0.1 beyond', tag + ': ' + l1 + ' vs ' + hi);
    }
    /* the claim: a long lossy line looks matched -- |Gamma| only shrinks */
    if (alpha > 0){ let prev = 9; for (let d = 0; d <= 4; d += 0.01){ const m = Math.hypot(...gIn(d)); if (m > prev + 1e-12){ bad('lossy: |Gamma| shrinks along the line (as claimed)', tag); break; } prev = m; } }
  }

  /* ================= measuring Z0 and gamma ================= */
  for (const f of [0.7, 0.1, 0.99, 1.5, 2.3, 3]){
    await set('sc-f', f); await frame();
    const D = await drawn('scfig'), tag = 'f ' + D.f;
    const ZT = T.C(50, -2), ax = 0.02*Math.sqrt(D.f), bx = Math.PI/2*D.f, th = ctanh(ax, bx);
    const sc = T.mul(ZT, th), oc = T.div(ZT, th);
    if (Math.hypot(D.sc[0] - sc.re, D.sc[1] - sc.im) > 1e-6*T.dist1(T.C(sc.re + 1, sc.im)) + 1e-6 ||
        Math.hypot(D.oc[0] - oc.re, D.oc[1] - oc.im) > 1e-6*Math.max(1, Math.hypot(oc.re, oc.im))) bad('measure: Zsc and Zoc', tag);
    /* recovered: Z0 exactly, alpha l exactly, beta l modulo pi */
    if (Math.hypot(D.z0[0] - 50, D.z0[1] + 2) > 1e-6) bad('measure: Z0 recovered', tag + ': ' + D.z0);
    if (Math.abs(D.gl[0] - ax) > 1e-7) bad('measure: alpha l recovered', tag + ': ' + D.gl[0] + ' vs ' + ax);
    const k = Math.round((bx - D.gl[1])/Math.PI);
    if (Math.abs(bx - D.gl[1] - k*Math.PI) > 1e-7 || Math.abs(D.gl[1]) > Math.PI/2 + 1e-9) bad('measure: beta l recovered modulo pi', tag + ': ' + D.gl[1] + ' vs ' + bx);
    const sz = String(await text('sc-z')).replace(/−/g, '-');
    if (sz !== '50.0 - j2.0 Ω') bad('measure: Z0 readout', tag + ': ' + sz);
    if (!printedOk(num(await text('sc-a')), ax, 4)) bad('measure: alpha l readout', tag);
    if (!printedOk(num(await text('sc-bt')), bx*180/Math.PI, 1) || !printedOk(num(await text('sc-b')), D.gl[1]*180/Math.PI, 1)) bad('measure: beta l readouts', tag);
    for (const [fq, a, o] of D.curves){
      const t2 = ctanh(0.02*Math.sqrt(fq), Math.PI/2*fq);
      const s2 = Math.hypot(T.mul(ZT, t2).re, T.mul(ZT, t2).im), o2 = Math.hypot(T.div(ZT, t2).re, T.div(ZT, t2).im);
      if (Math.abs(a - s2) > 1e-6*s2 || Math.abs(o - o2) > 1e-6*o2){ bad('measure: the two curves', tag + ' at ' + fq); break; }
    }
  }

  /* ================= Foster ================= */
  { const D = await drawn('fofig');
    for (const [name, fn] of [['shorted', f => Math.tan(Math.PI/2*f)], ['open', f => -1/Math.tan(Math.PI/2*f)]]){
      if (D[name].some(([f, x]) => Math.abs(x - fn(f)) > 1e-7*Math.max(1, Math.abs(fn(f))))) bad('Foster: the stub reactances', name);
      /* rising on every branch: between consecutive samples, either it rose or a pole was crossed (a jump down through infinity) */
      for (let i = 1; i < D[name].length; i++){
        const [f0, x0] = D[name][i-1], [f1, x1] = D[name][i];
        /* through a pole the reactance leaves at +infinity and returns from -infinity */
        const pole = x0 > 0 && x1 < 0 && Math.abs(x0) + Math.abs(x1) > 4;
        if (x1 < x0 && !pole){ bad('Foster: every branch rises (as claimed)', name + ' at ' + f1); break; }
      }
    }
    /* poles and zeros alternate, from the reactance itself */
    const ev = []; for (let i = 1; i <= 20000; i++){ const f = 2.5*i/20000, x0 = Math.tan(Math.PI/2*(f - 2.5/20000)), x1 = Math.tan(Math.PI/2*f);
      if (x0 < 0 && x1 >= 0) ev.push('zero'); else if (x0 > 0 && x1 < 0) ev.push('pole'); }
    if (ev.some((e, i) => i && e === ev[i-1])) bad('Foster: poles and zeros alternate (as claimed)', ev.join(' ')); }

  /* ================= the resonator ================= */
  for (const db of [0.1, 0.02, 0.37, 1]){
    await set('q-a', db); await frame();
    const D = await drawn('qfig'), tag = db + ' dB/lambda';
    const alpha = db*Math.log(10)/20, zf = f => Math.hypot(ctanh(alpha*0.25, Math.PI/2*f).re, ctanh(alpha*0.25, Math.PI/2*f).im);
    if (D.samples.some(([f, v]) => Math.abs(v - zf(f)) > 1e-7*v)) bad('resonator: the curve is |tanh(gamma l)|', tag);
    /* Q measured here: peak by golden section, half-power edges by bisection */
    let a = 0.98, c = 1.02;
    for (let i = 0; i < 200; i++){ const m1 = a + (c - a)/3, m2 = c - (c - a)/3; if (zf(m1) < zf(m2)) a = m1; else c = m2; }
    const fp = (a + c)/2, pk = zf(fp), lim = pk/Math.SQRT2;
    const edge = (inside, outside) => { for (let i = 0; i < 80; i++){ const m = (inside + outside)/2; if (zf(m) > lim) inside = m; else outside = m; } return inside; };
    const lo = edge(fp, fp - 0.2), hi = edge(fp, fp + 0.2), Q = fp/(hi - lo);
    if (Math.abs(D.q - Q) > 1e-6*Q) bad('resonator: Q from the curve', tag + ': ' + D.q + ' vs ' + Q);
    if (!printedOk(num(await text('q-c')), Q, 1)) bad('resonator: Q readout', tag + ': ' + await text('q-c'));
    const qf = TAU/(2*alpha);                                        /* beta/2alpha, per wavelength */
    if (!printedOk(num(await text('q-f')), qf, 1)) bad('resonator: beta/2alpha readout', tag);
    if (!printedOk(num(await text('q-p')), pk, 1)) bad('resonator: peak readout', tag);
    /* the claim: Q = beta/2alpha, to within the small-loss approximation */
    if (Math.abs(Q - qf) > 0.01*qf) bad('resonator: Q = beta/2alpha (as claimed)', tag + ': curve ' + Q + ', formula ' + qf);
  }

  const keys = ['rotate: Gamma_L', 'rotate: Z_in is the line transformation', 'rotate: Gamma at d', 'rotate: R and X traces',
    'rotate: |Gamma| readout', 'rotate: SWR readout', 'rotate: beta d readout', 'rotate: Z_in readout', 'rotate: a half-wave line repeats the load',
    'lossy: Gamma and Z_in are the hyperbolic form', 'lossy: |Gamma| after 2 lambda', 'lossy: |Gamma| < 0.1 beyond',
    'lossy: |Gamma| shrinks along the line (as claimed)',
    'measure: Zsc and Zoc', 'measure: Z0 recovered', 'measure: alpha l recovered', 'measure: beta l recovered modulo pi',
    'measure: Z0 readout', 'measure: alpha l readout', 'measure: beta l readouts', 'measure: the two curves',
    'Foster: the stub reactances', 'Foster: every branch rises (as claimed)', 'Foster: poles and zeros alternate (as claimed)',
    'resonator: the curve is |tanh(gamma l)|', 'resonator: Q from the curve', 'resonator: Q readout', 'resonator: beta/2alpha readout',
    'resonator: peak readout', 'resonator: Q = beta/2alpha (as claimed)'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
