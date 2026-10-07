/* Prologue part two, the wave equation and Helmholtz: every computed figure
   against the theory.

   - the plane wave: E and H against e^(-alpha z) cos(wt - beta z) with H
     lagging by arg(eta), arg(eta) found by complex division eta ~ j/(alpha +
     j beta); the presets and the readout; alpha held below beta (alpha^2 -
     beta^2 = -w^2 mu eps), so the lag never passes the 45 degrees the
     derivation names as the bound; the wavelength bracket from crest to crest.
   - alpha and beta across frequency: against the closed forms
     alpha, beta = w sqrt(mu eps / 2) sqrt(sqrt(1 + tan^2) -+ 1), the dashed
     limits, the axis range, the crossover by bisection on |J_c| = |J_d|, the
     readouts, and the prose (alpha/beta = tan 22.5 deg at the crossover for
     every medium; the two regimes; sea water's 84 Np/m and "over 700 dB").
   - skin depth: delta as 1/Re(gamma) and R_s as Re(eta) of the metal,
     both exact with eps0 kept; the current density as Re{e^-(1+j)z e^jt};
     the depth ticks; the claim that R_s is a slab one skin depth thick, by
     integrating the dissipated power.
   - normal incidence: Gamma and tau from the two continuity conditions as a
     linear system; the drawn waves, their sum, continuity of E across the
     boundary at every instant, the envelope found by scanning time, the
     power split, the labels, the presets; the prose's minimum at the
     boundary and the null on a perfect conductor.
   - TEM: every field line is tangent to the field of the two line charges
     at every point, every equipotential holds one potential, each wire is an
     equipotential around its own charge. Wide and narrow layouts.

   Run:  node tests/p2.test.js                                              */

const H = require('./lib/harness');
const TAU = 2*Math.PI;
const MU0 = 4e-7*Math.PI, EPS0 = 8.8541878128e-12, ETA0 = Math.sqrt(MU0/EPS0);

const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd)*(1 + 1e-9) + 1e-12;
const sigOk = (v, t, sig) => { const e = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - sig + 1); return Math.abs(v - t) <= 0.5*e*(1 + 1e-9) + 1e-15; };
const num = s => parseFloat(String(s).replace(/−/g, '-'));
const UNIT = { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9, THz: 1e12, mm: 1e-3, 'µm': 1e-6, 'mΩ': 1e-3, 'Ω/m': 1 };
const parseU = s => { const m = /^(−?[\d.]+)\s*(\S+)$/.exec(s.trim()); return m && UNIT[m[2]] !== undefined ? num(m[1])*UNIT[m[2]] : NaN; };
/* complex helpers, square root by the rectangular identity */
const cmul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
const cdiv = (a, b) => { const d = b[0]*b[0] + b[1]*b[1]; return [(a[0]*b[0] + a[1]*b[1])/d, (a[1]*b[0] - a[0]*b[1])/d]; };
const csqrt = z => { const m = Math.hypot(z[0], z[1]); return [Math.sqrt((m + z[0])/2), (z[1] < 0 ? -1 : 1)*Math.sqrt(Math.max(0, (m - z[0])/2))]; };

(async () => {
  const s = H.suite('p2');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'prologue-helmholtz.html', { waitUntil: 'load' });
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

  /* ================= the plane wave ================= */
  const lagOf = (a, be) => { const eta = cdiv([0, 1], [a, be]); return Math.atan2(eta[1], eta[0]); };   /* eta gamma = j w mu */
  async function plane(tag){
    for (const t of [0, 1.7, 5.2, 13.9]){
      const D = await at('planefig', t), lag = lagOf(D.al, D.be);
      if (D.al >= D.be) bad('plane: alpha below beta', tag + ': ' + D.al + ' >= ' + D.be);
      if (Math.abs(D.eta - lag*180/Math.PI) > 1e-7) bad('plane: H lags by arg(eta)', tag + ': ' + D.eta + ' vs ' + lag*180/Math.PI);
      if (D.eta > 45 + 1e-9) bad('plane: the lag stays within 45 degrees (as derived)', tag + ': ' + D.eta);
      if (D.envelope !== (D.al > 0.005)) bad('plane: envelope only with loss', tag);
      for (const [z, v] of D.E) if (Math.abs(v - Math.exp(-D.al*z)*Math.cos(t - D.be*z)) > 1e-8){ bad('plane: E(z, t)', tag + ' t ' + t + ' z ' + z); break; }
      for (const [z, v] of D.H) if (Math.abs(v - 0.55*Math.exp(-D.al*z)*Math.cos(t - D.be*z - lag)) > 1e-8){ bad('plane: H(z, t)', tag + ' t ' + t + ' z ' + z); break; }
      const lam = TAU/D.be;
      if (D.bracket){
        const [z1, z2, fade] = D.bracket;
        if (Math.abs(z2 - z1 - lam) > 1e-8) bad('plane: bracket is one wavelength', tag);
        const ph = ((t - D.be*z1) % TAU + TAU) % TAU;
        if (Math.min(ph, TAU - ph) > 1e-6) bad('plane: bracket from a crest of E', tag + ' t ' + t + ': phase ' + ph);
        if (z1 < -1e-9 || z2 > 10 + 1e-9 || !(fade > 0 && fade <= 1)) bad('plane: bracket on screen', tag);
      } else if (lam < 10*0.92 - 1e-9 && 2*lam < 10 - 1.2) bad('plane: bracket on screen', tag + ' t ' + t + ': missing at lambda ' + lam);
    }
    const ro = num(await text('o-eta'));
    const D = await drawn('planefig');
    if (!printedOk(ro, lagOf(D.al, D.be)*180/Math.PI, 1)) bad('plane: readout', tag + ': ' + ro);
  }
  for (const [lab, a, be] of [['lossless', 0, 1.4], ['low loss', 0.25, 1.4], ['lossy', 0.7, 1.4]]){
    await p.click('.btns button[data-a="' + a + '"]'); await frame();
    const D = await drawn('planefig');
    if (D.al !== a || D.be !== be) bad('plane: presets', lab + ': ' + D.al + ', ' + D.be);
    await plane(lab);
  }
  /* the lossless case peaks together; the presets' stated angles */
  s.check('plane: lossless E and H in phase', Math.abs(lagOf(0, 1.4)) < 1e-12, '');
  for (const be of [0.6, 0.65, 0.9, 1.4, 2.25, 3]) for (const a of [0, 0.01, 0.33, 0.59, 0.6, 0.64, 0.9]){
    await set('freq', be); await set('alpha', a); await frame();
    const D = await drawn('planefig'), mx = await p.evaluate(() => +document.getElementById('alpha').max);
    if (D.be !== be) { bad('plane: sliders reach the figure', 'beta ' + be); continue; }
    const want = Math.min(a, 0.9, Math.round((be - 0.01)*100)/100);
    if (Math.abs(D.al - want) > 1e-12) bad('plane: alpha below beta', 'asked ' + a + ' at beta ' + be + ': ' + D.al);
    if (!(mx < be) || be - mx > 0.0100001 && mx < 0.9) bad('plane: alpha slider stops one step short of beta', 'beta ' + be + ': max ' + mx);
    await plane('alpha ' + a + ' beta ' + be);
  }
  /* lowering beta under alpha pulls alpha down with it */
  await set('freq', 3); await set('alpha', 0.9); await set('freq', 0.6); await frame();
  { const D = await drawn('planefig'); if (!(D.al < D.be)) bad('plane: alpha below beta', 'beta lowered under alpha: ' + D.al); }
  await p.click('.btns button[data-a="0"]');

  /* ================= alpha and beta across frequency ================= */
  const MED = [[4, 81, 'sea water'], [1e-2, 15, 'wet soil'], [1e-3, 80, 'fresh water']];
  const ab = (f, sig, er) => {
    const w = TAU*f, k = w*Math.sqrt(MU0*er*EPS0/2), td = sig/(w*er*EPS0), q = Math.sqrt(1 + td*td);
    /* sqrt(q - 1) without cancellation: (q - 1) = td^2/(q + 1) */
    return [k*Math.sqrt(td*td/(q + 1)), k*Math.sqrt(q + 1)];
  };
  for (let mi = 0; mi < 3; mi++){
    await set('abm', mi, 'change'); await frame();
    const D = await drawn('abfig'), [sig, er, name] = MED[mi], tag = name;
    if (D.mi !== mi || D.sig !== sig || D.er !== er) { bad('ab: medium reaches the figure', tag); continue; }
    for (const [key, i] of [['alpha', 0], ['beta', 1]])
      for (const [x, y] of D[key]) if (Math.abs(y - Math.log10(ab(Math.pow(10, x), sig, er)[i])) > 1e-7){ bad('ab: the exact curves', tag + ' ' + key + ' at 10^' + x); break; }
    const [X0, X1, Y0, Y1] = D.axes;
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k <= 2400; k++){ const g = ab(Math.pow(10, X0 + (X1 - X0)*k/2400), sig, er); lo = Math.min(lo, Math.log10(g[0]), Math.log10(g[1])); hi = Math.max(hi, Math.log10(g[0]), Math.log10(g[1])); }
    if (!(Y0 <= lo && Y0 > lo - 1 && Y1 >= hi && Y1 < hi + 1)) bad('ab: axis spans both curves in whole decades', tag + ': ' + Y0 + '..' + Y1 + ' for ' + lo + '..' + hi);
    const L = D.limits, ainf = sig/2*Math.sqrt(MU0/(er*EPS0)), bl = x => Math.log10(TAU*Math.pow(10, x)/(299792458/Math.sqrt(er)));
    if (Math.abs(L.alphaLow - Math.log10(ainf)) > 1e-9) bad('ab: dashed limits', tag + ': low-loss alpha');
    if (Math.abs(L.betaLow[0] - bl(X0)) > 1e-7 || Math.abs(L.betaLow[1] - bl(X1)) > 1e-7) bad('ab: dashed limits', tag + ': low-loss beta');
    const gcl = x => Math.log10(Math.sqrt(TAU*Math.pow(10, x)*MU0*sig/2));
    if (Math.abs(L.conductor[0] - gcl(X0)) > 1e-9 || Math.abs(L.conductor[1] - gcl(X1)) > 1e-9) bad('ab: dashed limits', tag + ': good conductor');
    /* the crossover, |J_c| = |J_d|, by bisection */
    let a = 1, c = 1e15; for (let i = 0; i < 300; i++){ const m = Math.sqrt(a*c); if (sig > TAU*m*er*EPS0) a = m; else c = m; }
    const fc = Math.sqrt(a*c);
    if (Math.abs(D.fc/fc - 1) > 1e-9) bad('ab: crossover', tag + ': ' + D.fc + ' vs ' + fc);
    if (!sigOk(parseU(await text('ab-fc')), fc, 3)) bad('ab: readouts', tag + ' fc: ' + await text('ab-fc'));
    const gfc = ab(fc, sig, er);
    if (!printedOk(num(await text('ab-r')), gfc[0]/gfc[1], 3)) bad('ab: readouts', tag + ' ratio: ' + await text('ab-r'));
    /* alpha far above the crossover, from the exact form */
    const aHigh = ab(fc*1e7, sig, er)[0];
    const at = (await text('ab-ainf')).replace(/\s*Np\/m/, '');
    if (!(num(at) < 1 ? sigOk(num(at), aHigh, 3) : printedOk(num(at), aHigh, 1))) bad('ab: readouts', tag + ' alpha: ' + at + ' vs ' + aHigh);
    const dbt = num((await text('ab-db')).replace(/\s*dB\/m/, '')), dbw = 20*Math.log10(Math.exp(aHigh));
    if (!(dbw < 10 ? sigOk(dbt, dbw, 3) : printedOk(dbt, dbw, 0))) bad('ab: readouts', tag + ' dB: ' + dbt + ' vs ' + dbw);
    /* the prose */
    if (Math.abs(gfc[0]/gfc[1] - Math.tan(Math.PI/8)) > 1e-9) bad('ab: alpha/beta = tan 22.5 deg at the crossover (as claimed)', tag);
    const gl = ab(fc/100, sig, er), gh = ab(fc*100, sig, er);
    if (gl[0]/gl[1] < 0.99) bad('ab: alpha = beta below the crossover (as claimed)', tag + ': ' + gl[0]/gl[1]);
    if (Math.abs(gh[0]/ainf - 1) > 0.01 || Math.abs(gh[1]/Math.pow(10, bl(Math.log10(fc*100))) - 1) > 0.01) bad('ab: alpha flat, beta ~ f above it (as claimed)', tag);
    if (mi === 0 && (Math.abs(aHigh - 84) > 0.5 || !(dbw > 700))) bad('ab: sea water 84 Np/m, over 700 dB/m (as claimed)', aHigh + ' ' + dbw);
  }
  await set('abm', 0, 'change');

  /* ================= skin depth ================= */
  const METALS = ['5.8e7', '4.1e7', '3.5e7', '1.45e6'], A = 0.45e-3;   /* the options' own values */
  for (const sv of METALS) for (const lf of [3, 4.71, 6, 9, 10]){
    const sig = +sv;
    await set('skm', sv, 'change'); await set('skf', lf); await frame();
    const f = Math.pow(10, lf), w = TAU*f, tag = 'sigma ' + sig + ' f 1e' + lf;
    const gam = csqrt(cmul([0, w*MU0], [sig, w*EPS0])), eta = csqrt(cdiv([0, w*MU0], [sig, w*EPS0]));
    const delta = 1/gam[0], Rs = eta[0];
    for (const t of [0, 2.2, 7.3]){
      const D = await at('skinfig', t);
      if (D.sig !== sig || Math.abs(D.lf - lf) > 1e-12) { bad('skin: controls reach the figure', tag); break; }
      if (Math.abs(D.delta - delta) > 6e-10 + 1e-6*delta) bad('skin: delta = 1/Re(gamma)', tag + ': ' + D.delta + ' vs ' + delta);
      if (Math.abs(gam[1]*delta - 1) > 1e-6) bad('skin: one radian of phase per skin depth (as claimed)', tag);
      /* positions are physical depths, published in micrometres; J is the
         phasor J0 e^{-gamma z} at this instant, gamma from the metal's own constants */
      for (const [zu, v] of D.J){ const z = zu*1e-6; const e = cmul([Math.exp(-gam[0]*z)*Math.cos(-gam[1]*z), Math.exp(-gam[0]*z)*Math.sin(-gam[1]*z)], [Math.cos(t), Math.sin(t)]);
        if (Math.abs(v - e[0]) > 1e-6){ bad('skin: current density', tag + ' t ' + t + ' z ' + z + ': ' + v + ' vs ' + e[0]); break; } }
      for (const [zu, v] of D.env) if (Math.abs(Math.abs(v) - Math.exp(-gam[0]*zu*1e-6)) > 1e-6){ bad('skin: envelope', tag); break; }
      if (Math.abs(D.shade[1]*1e-6 - delta) > 1e-6*delta + 1e-15 || D.shade[0] !== D.axis[0]) bad('skin: first skin depth shaded', tag + ': ' + D.shade);
      /* one fixed axis for every setting, wide enough for every skin depth the
         slider and the metal menu can reach -- the reason it exists */
      if (D.axis[0] !== 0.1 || D.axis[1] !== 3e4 || !(delta*1e6 > D.axis[0] && delta*1e6 < D.axis[1])) bad('skin: fixed axis holds delta', tag + ': ' + D.axis);
      if (D.ticks.length !== 6 || D.ticks.some(([zu, l], i) => Math.abs(zu*1e-6 - Math.pow(10, i - 7)) > 1e-9*Math.pow(10, i - 7) || !sigOk(parseU(l), zu*1e-6, 3))) bad('skin: depth ticks', tag + ': ' + JSON.stringify(D.ticks));
      if (Math.abs(D.wire*1e-6 - A) > 1e-12) bad('skin: wire radius marked', tag + ': ' + D.wire);
    }
    if (!sigOk(parseU(await text('skfv')), f, 3)) bad('skin: frequency readout', tag + ': ' + await text('skfv'));
    if (!sigOk(parseU(await text('sk-d')), delta, 3)) bad('skin: delta readout', tag + ': ' + await text('sk-d'));
    if (!sigOk(parseU(await text('sk-rs')), Rs, 3)) bad('skin: R_s readout', tag + ': ' + await text('sk-rs') + ' vs ' + Rs);
    const rp = await text('sk-rp');
    if (delta < A/5 ? !sigOk(parseU(rp), Rs/(TAU*A), 3) : rp !== 'δ not small') bad('skin: R\' readout', tag + ': ' + rp);
  }
  /* R_s is the resistance per square of a slab one skin depth thick: the
     decaying current dissipates what a uniform one in delta would */
  {
    const sig = 5.8e7, f = 1e9, d = 1/Math.sqrt(Math.PI*f*MU0*sig);
    let P = 0, Ir = 0, Ii = 0; const N = 200000, h = 40*d/N;
    for (let k = 0; k < N; k++){ const z = (k + 0.5)*h, a = Math.exp(-z/d); P += a*a/(2*sig)*h; Ir += a*Math.cos(z/d)*h; Ii -= a*Math.sin(z/d)*h; }
    const R = P/(0.5*(Ir*Ir + Ii*Ii));
    s.check('skin: R_s is the slab one skin depth thick (as claimed)', Math.abs(R*sig*d - 1) < 1e-6, R*sig*d);
  }

  /* ================= normal incidence ================= */
  async function incidence(er, pec, tag){
    const n1 = ETA0, n2 = pec ? 1e-30 : ETA0/Math.sqrt(er);
    /* E- - Et = -1 ;  E-/n1 + Et/n2 = 1/n1  (with E+ = 1), by Cramer */
    const det = 1/n2 + 1/n1, Em = (-1/n2 + 1/n1)/det, Et = (1/n1 + 1/n1)/det;
    for (const t of [0, 1.3, 4.05]){
      const D = await at('nifig', t);
      if (D.pec !== pec || (!pec && D.er !== er)) { bad('incidence: controls reach the figure', tag); return; }
      if (Math.abs(D.G - Em) > 6e-10 || Math.abs(D.T - Et) > 6e-10) bad('incidence: Gamma and tau from continuity', tag + ': ' + D.G + ', ' + D.T);
      const n = pec ? 0 : Math.sqrt(er);
      for (const [u, v] of D.inc) if (Math.abs(v - Math.cos(t - TAU*u)) > 1e-8){ bad('incidence: incident wave', tag); break; }
      for (const [u, v] of D.ref) if (Math.abs(v - Em*Math.cos(t + TAU*u)) > 1e-8){ bad('incidence: reflected wave', tag); break; }
      for (const [u, v] of D.tot) if (Math.abs(v - (Math.cos(t - TAU*u) + Em*Math.cos(t + TAU*u))) > 1e-8){ bad('incidence: the sum', tag); break; }
      if (!pec) for (const [u, v] of D.trans) if (Math.abs(v - Et*Math.cos(t - TAU*n*u)) > 1e-8){ bad('incidence: transmitted wave, lambda / sqrt(er)', tag + ' u ' + u); break; }
      if (pec && D.trans.length) bad('incidence: nothing transmitted into a conductor', tag);
      /* E tangential is continuous across the boundary at every instant */
      const left = D.tot.find(([u]) => Math.abs(u) < 1e-9), right = pec ? [0, 0] : D.trans.find(([u]) => Math.abs(u) < 1e-9);
      if (!left || !right || Math.abs(left[1] - right[1]) > 1e-8) bad('incidence: E continuous at the boundary', tag + ' t ' + t + ': ' + (left && left[1]) + ' vs ' + (right && right[1]));
      if (pec && left && Math.abs(left[1]) > 1e-8) bad('incidence: null on a perfect conductor (as claimed)', tag);
    }
    const D = await drawn('nifig');
    /* the envelope, as the largest |E| over a cycle, found by scanning */
    for (const [u, v] of D.env){
      let m = 0; for (let k = 0; k < 7200; k++){ const t = TAU*k/7200; m = Math.max(m, Math.abs(Math.cos(t - TAU*u) + Em*Math.cos(t + TAU*u))); }
      if (Math.abs(v - m) > 1e-6){ bad('incidence: envelope', tag + ' u ' + u + ': ' + v + ' vs ' + m); break; }
    }
    if (er > 1 || pec){ const e0 = D.env.find(([u]) => Math.abs(u) < 1e-9);
      if (!e0 || D.env.some(([, v]) => v < e0[1] - 1e-9) || !(D.G < 0)) bad('incidence: denser medium, minimum at the boundary (as claimed)', tag); }
    const R = Em*Em, T = pec ? 0 : (n1/n2)*Et*Et;
    if (Math.abs(R + T - 1) > 1e-12) bad('incidence: power balance', tag);
    if (!printedOk(num(await text('ni-g')), Em, 3) || !printedOk(num(await text('ni-t')), Et, 3)) bad('incidence: readouts', tag + ': ' + await text('ni-g') + ' ' + await text('ni-t'));
    if (!printedOk(num(await text('ni-pr')), 100*R, 1) || !printedOk(num(await text('ni-pt')), 100*T, 1)) bad('incidence: readouts', tag + ' power: ' + await text('ni-pr') + ' ' + await text('ni-pt'));
    const ev = await text('ni-ev');
    if (pec ? ev !== '∞' : !printedOk(num(ev), er, 1)) bad('incidence: readouts', tag + ' er: ' + ev);
    if (D.labels[0] !== String(Math.round(ETA0)) || D.labels[1] !== String(Math.round(pec ? 0 : ETA0/Math.sqrt(er)))) bad('incidence: impedance labels', tag + ': ' + D.labels);
  }
  for (const er of [1, 2.5, 9, 30.5, 64, 80.5]){ await set('ni-e', er); await frame(); await incidence(er, false, 'slider ' + er); }
  for (const [v, er] of [['1', 1], ['4', 4], ['81', 81], ['pec', null]]){
    await p.click('button[data-ni="' + v + '"]'); await frame();
    const slider = await p.evaluate(() => +document.getElementById('ni-e').value);
    if (er !== null && slider !== er) bad('incidence: presets reach the slider', v + ': ' + slider);
    await incidence(er === null ? (await drawn('nifig')).er : er, er === null, 'preset ' + v);
  }
  await p.click('button[data-ni="4"]');

  /* ================= TEM ================= */
  async function tem(tag){
    const D = await drawn('temfig');
    if (!D || !D.charges) { bad('tem: published', tag); return; }
    const [qa, qb] = D.charges;
    const phi = (x, y) => qa[2]*-Math.log(Math.hypot(x - qa[0], y - qa[1])) + qb[2]*-Math.log(Math.hypot(x - qb[0], y - qb[1]));
    const Ef = (x, y) => { let ex = 0, ey = 0; for (const q of [qa, qb]){ const dx = x - q[0], dy = y - q[1], r2 = dx*dx + dy*dy; ex += q[2]*dx/r2; ey += q[2]*dy/r2; } return [ex, ey]; };
    const ring = (c, r, n) => Array.from({ length: n }, (_, k) => { const a = TAU*(k + 0.37)/n; return [c[0] + r*Math.cos(a), c[1] + r*Math.sin(a)]; });
    if (qa[2] + qb[2] !== 0) bad('tem: two equal and opposite charges', tag);
    for (const F of D.field){
      if (F.line){
        const [x0, y0, x1, y1] = F.line;
        if (![[x0, y0], [x1, y1]].every(P => [qa, qb].some(q => Math.hypot(P[0] - q[0], P[1] - q[1]) < 1e-9))) bad('tem: field lines join the charges', tag + ': straight line');
        continue;
      }
      for (const q of [qa, qb]) if (Math.abs(Math.hypot(q[0] - F.c[0], q[1] - F.c[1]) - F.r) > 1e-7) bad('tem: field lines join the charges', tag + ': circle ' + F.c);
      for (const [x, y] of ring(F.c, F.r, 36)){
        if (Math.min(...[qa, qb].map(q => Math.hypot(x - q[0], y - q[1]))) < 1) continue;
        const e = Ef(x, y), rx = x - F.c[0], ry = y - F.c[1];
        if (Math.abs(e[0]*rx + e[1]*ry) > 1e-7*Math.hypot(...e)*F.r){ bad('tem: field lines tangent to E', tag + ': circle at ' + F.c + ' point ' + [x, y]); break; }
      }
    }
    for (const Q of D.equi){
      const pts = Q.line ? Array.from({ length: 9 }, (_, k) => [Q.line[0] + (Q.line[2] - Q.line[0])*k/8, Q.line[1] + (Q.line[3] - Q.line[1])*k/8]) : ring(Q.c, Q.r, 36);
      const v = pts.map(P => phi(...P)), spread = Math.max(...v) - Math.min(...v);
      if (spread > 1e-9) bad('tem: equipotentials hold one potential', tag + ': ' + (Q.c || Q.line) + ' spread ' + spread);
    }
    if (D.wires.length !== 2) bad('tem: wires are equipotentials round their own charge', tag + ': ' + D.wires.length + ' wires');
    for (const Wr of D.wires){
      const v = ring(Wr.c, Wr.r, 36).map(P => phi(...P));
      const inside = [qa, qb].filter(q => Math.hypot(q[0] - Wr.c[0], q[1] - Wr.c[1]) < Wr.r);
      if (Math.max(...v) - Math.min(...v) > 1e-9 || inside.length !== 1 || inside[0][2] !== Wr.sign) bad('tem: wires are equipotentials round their own charge', tag + ': wire at ' + Wr.c);
    }
    if (D.wires.length === 2 && Math.hypot(D.wires[0].c[0] - D.wires[1].c[0], D.wires[0].c[1] - D.wires[1].c[1]) <= D.wires[0].r + D.wires[1].r) bad('tem: wires apart', tag);
  }
  await tem('wide');
  await p.setViewportSize({ width: 390, height: 900 });
  await p.waitForTimeout(600); await frame();
  await tem('narrow');

  const keys = ['plane: presets', 'plane: sliders reach the figure', 'plane: alpha below beta', 'plane: alpha slider stops one step short of beta',
    'plane: H lags by arg(eta)', 'plane: the lag stays within 45 degrees (as derived)', 'plane: readout', 'plane: envelope only with loss',
    'plane: E(z, t)', 'plane: H(z, t)', 'plane: bracket is one wavelength', 'plane: bracket from a crest of E', 'plane: bracket on screen',
    'ab: medium reaches the figure', 'ab: the exact curves', 'ab: axis spans both curves in whole decades', 'ab: dashed limits', 'ab: crossover', 'ab: readouts',
    'ab: alpha/beta = tan 22.5 deg at the crossover (as claimed)', 'ab: alpha = beta below the crossover (as claimed)', 'ab: alpha flat, beta ~ f above it (as claimed)',
    'ab: sea water 84 Np/m, over 700 dB/m (as claimed)',
    'skin: controls reach the figure', 'skin: delta = 1/Re(gamma)', 'skin: one radian of phase per skin depth (as claimed)', 'skin: current density', 'skin: envelope',
    'skin: first skin depth shaded', 'skin: fixed axis holds delta', 'skin: wire radius marked', 'skin: depth ticks', 'skin: frequency readout', 'skin: delta readout', 'skin: R_s readout', 'skin: R\' readout',
    'incidence: controls reach the figure', 'incidence: Gamma and tau from continuity', 'incidence: incident wave', 'incidence: reflected wave', 'incidence: the sum',
    'incidence: transmitted wave, lambda / sqrt(er)', 'incidence: nothing transmitted into a conductor', 'incidence: E continuous at the boundary',
    'incidence: null on a perfect conductor (as claimed)', 'incidence: envelope', 'incidence: denser medium, minimum at the boundary (as claimed)',
    'incidence: power balance', 'incidence: readouts', 'incidence: impedance labels', 'incidence: presets reach the slider',
    'tem: published', 'tem: two equal and opposite charges', 'tem: field lines join the charges', 'tem: field lines tangent to E', 'tem: equipotentials hold one potential',
    'tem: wires are equipotentials round their own charge', 'tem: wires apart'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
