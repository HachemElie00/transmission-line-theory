/* Chapter 04, propagation: every computed figure against the theory.

   - the explorer: alpha and beta from the closed forms
       beta = sqrt( (|Z'||Y'| - (R'G' - w^2 L'C')) / 2 ),  alpha = Im(Z'Y')/(2 beta)
     and Z0 in polar form, sqrt(|Z'|/|Y'|) at half the difference of the
     angles -- the page takes a complex square root instead; the drawn wave,
     every readout, and the claims made for each preset;
   - Z0 across frequency: both curves, sqrt(R'/G') at the bottom, the -36.0
     degree minimum found by golden section, the 45 degree bound, and 50 ohm
     above a megahertz;
   - Heaviside: the pulses by a separate quadrature (trapezoid, finer, wider
     band), peaks and widths refined here, the alphas at both ends, and the
     claims: at the balance the three shapes coincide; without it they spread;
   - loss across frequency: alpha_c from the surface resistance and the coax
     Z0, alpha_d from beta tan(delta)/2, the crossing by bisection, and the
     prose's two claims about where it falls.

   Run:  node tests/ch04.test.js                                            */

const H = require('./lib/harness');
const TAU = 2*Math.PI;
const MU0 = 4e-7*Math.PI, EPS0 = 8.8541878128e-12, C0 = 299792458;

const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
const sigOk = (v, t, sig) => { const e = Math.pow(10, Math.floor(Math.log10(Math.abs(t))) - sig + 1); return Math.abs(v - t) <= 0.5*e*(1 + 1e-9) + 1e-12; };
const num = s => parseFloat(String(s).replace(/−/g, '-'));
const dps = s => (String(s).replace(/[^0-9.]/g, ' ').trim().split(/\s+/)[0].split('.')[1] || '').length;

function line(R, G, L, C, f){
  const w = TAU*f, mz = Math.hypot(R, w*L), my = Math.hypot(G, w*C), q = R*G - w*w*L*C;
  /* beta from the closed form; alpha from Im(gamma^2) = 2 alpha beta, since
     the closed form for alpha cancels to sqrt(rounding) on a lossless line */
  const be = Math.sqrt(Math.max(0, (mz*my - q)/2));
  return { a: (R*w*C + G*w*L)/(2*be), b: be,
           zm: Math.sqrt(mz/my), za: (Math.atan2(w*L, R) - Math.atan2(w*C, G))/2*180/Math.PI };
}

(async () => {
  const s = H.suite('ch04');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'propagation.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);

  const drawn = id => p.evaluate(id => JSON.parse(document.getElementById(id).getAttribute('data-drawn') || 'null'), id);
  const at = (id, t) => p.evaluate(({ id, t }) => {
    const cv = document.getElementById(id); EM.seek(cv, t); return JSON.parse(cv.getAttribute('data-drawn'));
  }, { id, t });
  const text = id => p.evaluate(id => document.getElementById(id).textContent, id);
  const set = (id, v, ev) => p.evaluate(({ id, v, ev }) => {
    const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event(ev || 'input', { bubbles: true }));
  }, { id, v, ev });
  const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fails = {};
  const bad = (k, why) => (fails[k] = fails[k] || []).push(why);

  /* ================= the explorer ================= */
  const F = 1e9;
  const explore = async (R, Gm, Ln, Cp, tag) => {
    const G = Gm*1e-3, L = Ln*1e-9, C = Cp*1e-12, k = line(R, G, L, C, F);
    const D = await at('linefig', 3.7);
    if (D.R !== R || Math.abs(D.G - G) > 1e-12 || D.nH !== Ln || D.pF !== Cp) { bad('explorer: controls reach the figure', tag + ': ' + [D.R, D.G, D.nH, D.pF]); return null; }
    if (Math.abs(D.a - k.a) > 1e-6*Math.max(k.a, 1) || Math.abs(D.b - k.b) > 1e-6*k.b) bad('explorer: alpha and beta', tag + ': ' + D.a + ' ' + D.b + ' vs ' + k.a + ' ' + k.b);
    const z0r = k.zm*Math.cos(k.za*Math.PI/180), z0i = k.zm*Math.sin(k.za*Math.PI/180);
    if (Math.abs(D.z0[0] - z0r) > 1e-6*k.zm || Math.abs(D.z0[1] - z0i) > 1e-6*k.zm) bad('explorer: Z0', tag + ': ' + D.z0 + ' vs ' + [z0r, z0i]);
    for (const [z, v] of D.samples) if (Math.abs(v - Math.exp(-k.a*z)*Math.cos(D.t - k.b*z)) > 1e-7){ bad('explorer: the drawn wave', tag + ' at ' + z + ': ' + v + ' vs ' + Math.exp(-k.a*z)*Math.cos(D.t - k.b*z) + ' t ' + D.t + ' b ' + D.b); break; }
    if (k.a > 0.01 ? Math.abs(D.left - Math.exp(-k.a)) > 1e-9 : D.left !== null) bad('explorer: what is left at 1 m', tag + ': ' + D.left);
    const ta = await text('o-a'), tb = await text('o-b'), tl = await text('o-l'), tz = await text('o-z'), tu = await text('o-u');
    if (!printedOk(num(ta), k.a, k.a < 1 ? 3 : 2) || dps(ta) !== (k.a < 1 ? 3 : 2)) bad('explorer: readouts', tag + ' alpha ' + ta);
    if (!printedOk(num(tb), k.b, 1)) bad('explorer: readouts', tag + ' beta ' + tb);
    if (!printedOk(num(tl), TAU/k.b*100, 2)) bad('explorer: readouts', tag + ' lambda ' + tl);
    if (!printedOk(num(tu), TAU*F/k.b/C0, 2)) bad('explorer: readouts', tag + ' u ' + tu);
    const zm = String(tz).replace(/−/g, '-').match(/^(\d+\.\d)(?: ∠(-?\d+)°)?$/);
    if (!zm || !printedOk(+zm[1], k.zm, 1) || (Math.abs(k.za) >= 0.5 ? !(zm[2] !== undefined && Math.abs(+zm[2] - k.za) <= 0.5 + 1e-9) : zm[2] !== undefined))
      bad('explorer: readouts', tag + ' Z0 ' + tz + ' vs ' + k.zm.toFixed(3) + ' at ' + k.za.toFixed(3));
    return { k, D };
  };
  for (const [R, Gm, Ln, Cp] of [[0, 0, 250, 100], [50, 0, 250, 100], [0, 5, 400, 60], [200, 10, 100, 400], [17, 2.3, 735, 158]]){
    await set('rp', R); await set('gp', Gm); await set('lp', Ln); await set('cp', Cp); await frame();
    await explore(R, Gm, Ln, Cp, 'sliders ' + [R, Gm, Ln, Cp]);
  }
  const preset = async lab => {
    const v = await p.evaluate(lab => { const b = [...document.querySelectorAll('.btns button[data-p]')].find(b => b.textContent.startsWith(lab)); b.click(); return b.getAttribute('data-p'); }, lab);
    await frame();
    const [R, Gm, Ln, Cp] = v.split(',').map(Number);
    return explore(R, Gm, Ln, Cp, 'preset ' + lab);
  };
  const lossless = await preset('lossless');
  const coax = await preset('real coax');
  const loud = await preset('exaggerated');
  const shortL = await preset('same Z0');
  const dblZ = await preset('same λ');
  if (lossless && shortL && dblZ && loud && coax){
    /* as the table says */
    if (Math.abs(TAU/shortL.k.b - 0.10) > 1e-6 || Math.abs(shortL.k.zm - 50) > 1e-6) bad('explorer: same Z0, shorter lambda (as claimed)', 'lambda ' + TAU/shortL.k.b + ', Z0 ' + shortL.k.zm);
    if (Math.abs(TAU/dblZ.k.b - 0.20) > 1e-6 || Math.abs(dblZ.k.zm - 100) > 1e-6) bad('explorer: same lambda, double Z0 (as claimed)', 'lambda ' + TAU/dblZ.k.b + ', Z0 ' + dblZ.k.zm);
    if (JSON.stringify(dblZ.D.samples) !== JSON.stringify(lossless.D.samples)) bad('explorer: same lambda, double Z0 (as claimed)', 'the drawn wave changed');
    if (Math.abs(loud.k.b/lossless.k.b - 1) > 0.005 || Math.abs(loud.k.za) < 0.5 || Math.abs(loud.k.za) > 5) bad('explorer: exaggerated loss (as claimed)', 'beta ' + loud.k.b + ', angle ' + loud.k.za);
    if (Math.exp(-coax.k.a) < 0.97 || Math.exp(-30*coax.k.a) > 0.6) bad('explorer: real coax flat over a metre, obvious over tens (as claimed)', 'alpha ' + coax.k.a);
  }

  /* ================= Z0 across frequency ================= */
  { const D = await drawn('dispfig'), R = D.R, G = D.G, L = D.nH*1e-9, C = D.pF*1e-12;
    for (const [lf, m] of D.mag) if (Math.abs(m - line(R, G, L, C, Math.pow(10, lf)).zm) > 1e-6*m){ bad('Z0(f): |Z0| curve', 'at 10^' + lf); break; }
    for (const [lf, a] of D.ang) if (Math.abs(a - line(R, G, L, C, Math.pow(10, lf)).za) > 1e-6){ bad('Z0(f): angle curve', 'at 10^' + lf); break; }
    const lo = line(R, G, L, C, 1);
    if (Math.abs(lo.zm/Math.sqrt(R/G) - 1) > 0.01 || lo.zm < 200 || lo.zm > 900) bad('Z0(f): sqrt(R/G) at the bottom (as claimed)', lo.zm);
    let a = 2, c = 6;
    for (let i = 0; i < 100; i++){ const m1 = a + (c - a)/3, m2 = c - (c - a)/3; if (line(R, G, L, C, Math.pow(10, m1)).za < line(R, G, L, C, Math.pow(10, m2)).za) c = m2; else a = m1; }
    const fmin = Math.pow(10, (a + c)/2), amin = line(R, G, L, C, fmin).za;
    if (Math.abs(amin + 36.0) > 0.05 || fmin < 5e3 || fmin > 2e4) bad('Z0(f): bottoms out near -36 degrees around 10 kHz (as claimed)', amin.toFixed(3) + ' at ' + fmin.toFixed(0));
    if (Math.abs((R/L)/(G/C) - 40) > 1e-9) bad('Z0(f): corners a factor of 40 apart (as claimed)', (R/L)/(G/C));
    /* "only above roughly a megahertz does it settle": within 2 degrees there, a fifth of a degree a decade on */
    for (const lf of [6, 7, 8, 9, 10]){ const k = line(R, G, L, C, Math.pow(10, lf)); if (Math.abs(k.zm - 50) > 0.5 || Math.abs(k.za) > (lf === 6 ? 2 : 0.2)) bad('Z0(f): 50 ohm above a megahertz (as claimed)', 'at 10^' + lf + ': ' + k.zm + ' ' + k.za); }
    for (const [lf, ang] of D.ang) if (Math.abs(ang) > 45) bad('Z0(f): never past 45 degrees (as claimed)', lf + ': ' + ang);
  }

  /* ================= Heaviside ================= */
  /* the trapezoid rule in u = sqrt(w), to w = 9: smooth across the branch
     point at w = 0 that alpha ~ sqrt(w) puts there when G' = 0 */
  const pulse = (z, g, t) => {
    let s = 0; const N = 3000, UM = 3;
    for (let k = 0; k <= N; k++){
      const u = UM*k/N, w = u*u, ar = 0.5*g - w*w, ai = w*(g + 0.5), m = Math.sqrt(Math.hypot(ar, ai)), th = Math.atan2(ai, ar)/2;
      const al = m*Math.cos(th), be = m*Math.sin(th);
      s += (k === 0 || k === N ? 0.5 : 1)*2*u*Math.exp(-w*w/2 - al*z)*Math.cos(w*t + w*z - be*z);
    }
    return s*(UM/N)/Math.PI;
  };
  for (const frac of [0, 0.3, 1, 1.6, 2]){
    await set('hv-g', frac); await frame();
    const D = await drawn('hvfig'), g = 0.5*frac, tag = 'G/Heaviside ' + frac;
    if (Math.abs(D.frac - frac) > 1e-12) { bad('Heaviside: controls reach the figure', tag); continue; }
    [0, 2, 4].forEach((z, n) => {
      for (const [t, v] of D.shapes[n].filter((q, i) => i % 3 === 0)) if (Math.abs(v - pulse(z, g, t)) > 1e-6){ bad('Heaviside: the pulses', tag + ' z ' + z + ' t ' + t + ': ' + v + ' vs ' + pulse(z, g, t)); break; }
    });
    /* peaks and widths, refined here */
    const pw = z => {
      let tb = -4, vb = -1; for (let t = -4; t <= 10; t += 0.02){ const v = pulse(z, g, t); if (v > vb){ vb = v; tb = t; } }
      let a = tb - 0.02, c = tb + 0.02;
      for (let i = 0; i < 50; i++){ const m1 = a + (c - a)/3, m2 = c - (c - a)/3; if (pulse(z, g, m1) < pulse(z, g, m2)) a = m1; else c = m2; }
      const pk = pulse(z, g, (a + c)/2), half = pk/2;
      const edge = (inT, step) => { let o = inT; while (pulse(z, g, o) > half) o += step; let i0 = o - step; for (let i = 0; i < 50; i++){ const m = (i0 + o)/2; if (pulse(z, g, m) > half) i0 = m; else o = m; } return (i0 + o)/2; };
      return { pk, w: edge((a + c)/2, 0.05) - edge((a + c)/2, -0.05) };
    };
    const P0 = pw(0), P2 = pw(2), P4 = pw(4);
    /* what the readouts are built from, before any rounding */
    [P0, P2, P4].forEach((P, n) => {
      if (Math.abs(D.peaks[n] - P.pk) > 1e-7) bad('Heaviside: peaks and widths before rounding', tag + ' z ' + 2*n + ' peak ' + D.peaks[n] + ' vs ' + P.pk);
      if (Math.abs(D.widths[n] - P.w) > 1e-6) bad('Heaviside: peaks and widths before rounding', tag + ' z ' + 2*n + ' width ' + D.widths[n] + ' vs ' + P.w);
    });
    if (!printedOk(num(await text('hv-pk')), P4.pk/P0.pk, 3)) bad('Heaviside: peak readout', tag + ': ' + await text('hv-pk') + ' vs ' + P4.pk/P0.pk);
    if (!printedOk(num(await text('hv-w')), P4.w/P0.w, 2)) bad('Heaviside: width readout', tag + ': ' + await text('hv-w') + ' vs ' + P4.w/P0.w);
    if (!printedOk(num(await text('hv-a0')), Math.sqrt(0.5*g), 3)) bad('Heaviside: alpha readouts', tag + ' low');
    const hi = (() => { const w = 1e7, ar = 0.5*g - w*w, ai = w*(g + 0.5), m = Math.sqrt(Math.hypot(ar, ai)); return m*Math.cos(Math.atan2(ai, ar)/2); })();
    if (!printedOk(num(await text('hv-a1')), hi, 3)) bad('Heaviside: alpha readouts', tag + ' high: ' + await text('hv-a1') + ' vs ' + hi);
    /* the claims */
    if (frac === 1){
      const n0 = D.shapes[0].map(q => q[1]/D.peaks[0]);
      for (const n of [1, 2]) D.shapes[n].forEach((q, i) => { if (Math.abs(q[1]/D.peaks[n] - n0[i]) > 1e-6) bad('Heaviside: at the balance the shapes coincide (as claimed)', 'z ' + 2*n + ' at ' + q[0]); });
      if (Math.abs(P4.pk/P0.pk - Math.exp(-4*Math.sqrt(0.5*g))) > 1e-6) bad('Heaviside: at the balance the shapes coincide (as claimed)', 'peak ratio ' + P4.pk/P0.pk);
    }
    /* G' = 0: wider, and a long tail behind */
    if (frac === 0 && (P4.w/P0.w < 1.05 || (pulse(4, 0, 3)/P4.pk)/(pulse(0, 0, 3)/P0.pk) < 5)) bad('Heaviside: without the balance the pulse spreads (as claimed)', P4.w/P0.w);
  }

  /* ================= loss across frequency ================= */
  const A = 0.45e-3, B = 1.47e-3, SIG = 5.8e7, DIEL = [[2.25, 2e-4], [4.4, 0.02]];
  const NPDB = 20*Math.log10(Math.E);
  for (let di = 0; di < 2; di++){
    const [er, td] = DIEL[di];
    const z0 = Math.sqrt(MU0/(er*EPS0))/TAU*Math.log(B/A);
    const ac = f => (1/(SIG*Math.sqrt(2/(TAU*f*MU0*SIG))))*(1/A + 1/B)/TAU/(2*z0);
    const ad = f => TAU*f*Math.sqrt(MU0*er*EPS0)/2*td;
    for (const lf of [6, 7.3, 9, 10.2, 11]){
      await set('lp-d', di, 'change'); await set('lp-f', lf); await frame();
      const D = await drawn('lpfig'), f = Math.pow(10, lf), tag = 'dielectric ' + di + ' at 10^' + lf;
      if (Math.abs(D.f/f - 1) > 1e-9) { bad('loss: controls reach the figure', tag); continue; }
      const fns = [ac, ad, q => ac(q) + ad(q)];
      D.curves.forEach((cs, n) => { for (const [x, l] of cs) if (Math.abs(l - Math.log10(fns[n](Math.pow(10, x))*NPDB)) > 1e-6){ bad('loss: the three curves', tag + ' curve ' + n + ' at 10^' + x); break; } });
      const fmt = v => v < 0.1 ? +v.toPrecision(2) : +v.toFixed(2);
      const okDb = (txt, v) => Math.abs(num(txt) - v) <= (v < 0.1 ? 0.5*Math.pow(10, Math.floor(Math.log10(v)) - 1) : 0.005) + 1e-12;
      if (!okDb(await text('lp-c'), ac(f)*NPDB)) bad('loss: readouts', tag + ' conductor ' + await text('lp-c') + ' vs ' + fmt(ac(f)*NPDB));
      if (!okDb(await text('lp-dd'), ad(f)*NPDB)) bad('loss: readouts', tag + ' dielectric ' + await text('lp-dd') + ' vs ' + fmt(ad(f)*NPDB));
      if (!sigOk(num(await text('lp-p')), 100*Math.pow(10, -(ac(f) + ad(f))*NPDB*10/10), 3)) bad('loss: readouts', tag + ' power ' + await text('lp-p'));
    }
    /* the crossing, by bisection on a log scale */
    let lo = 1e3, hi = 1e15;
    for (let i = 0; i < 200; i++){ const m = Math.sqrt(lo*hi); if (ac(m) > ad(m)) lo = m; else hi = m; }
    const fx = Math.sqrt(lo*hi), xt = await text('lp-x');
    if (!sigOk(num(xt)*(/GHz/.test(xt) ? 1e9 : 1e6), fx, 3)) bad('loss: crossing readout', 'dielectric ' + di + ': ' + xt + ' vs ' + fx);
    if (di === 0 && fx < 100e9) bad('loss: polyethylene, conductor dominates past 100 GHz (as claimed)', fx);
    if (di === 1 && (fx > 20e6 || fx < 1e6)) bad('loss: FR-4, dielectric takes over below 20 MHz (as claimed)', fx);
    if (Math.abs(ac(4e9)/ac(1e9) - 2) > 1e-12) bad('loss: conductor loss doubles per factor of four (as claimed)', ac(4e9)/ac(1e9));
  }

  const keys = ['explorer: controls reach the figure', 'explorer: alpha and beta', 'explorer: Z0', 'explorer: the drawn wave', 'explorer: what is left at 1 m',
    'explorer: readouts', 'explorer: same Z0, shorter lambda (as claimed)', 'explorer: same lambda, double Z0 (as claimed)',
    'explorer: exaggerated loss (as claimed)', 'explorer: real coax flat over a metre, obvious over tens (as claimed)',
    'Z0(f): |Z0| curve', 'Z0(f): angle curve', 'Z0(f): sqrt(R/G) at the bottom (as claimed)', 'Z0(f): bottoms out near -36 degrees around 10 kHz (as claimed)',
    'Z0(f): corners a factor of 40 apart (as claimed)', 'Z0(f): 50 ohm above a megahertz (as claimed)', 'Z0(f): never past 45 degrees (as claimed)',
    'Heaviside: controls reach the figure', 'Heaviside: the pulses', 'Heaviside: peaks and widths before rounding', 'Heaviside: peak readout', 'Heaviside: width readout', 'Heaviside: alpha readouts',
    'Heaviside: at the balance the shapes coincide (as claimed)', 'Heaviside: without the balance the pulse spreads (as claimed)',
    'loss: controls reach the figure', 'loss: the three curves', 'loss: readouts', 'loss: crossing readout',
    'loss: polyethylene, conductor dominates past 100 GHz (as claimed)', 'loss: FR-4, dielectric takes over below 20 MHz (as claimed)',
    'loss: conductor loss doubles per factor of four (as claimed)'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
