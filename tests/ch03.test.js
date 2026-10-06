/* Chapter 03, the telegrapher's equations: every computed figure against the
   theory.

   - the cascade: each node's voltage is the wave sampled at that node;
   - L' and C' of coax and two-wire line, with Z0 checked against its other
     form (eta/2pi) ln(b/a) and (eta/pi) acosh(D/2a) -- written with
     ln(x + sqrt(x^2 - 1)) here -- and L'C' = mu eps as the prose claims; the
     cross-section drawn to the ratio chosen;
   - R', wL', G', wC' against the skin-effect and loss-tangent formulas, the
     dashed stretch where delta > a/3 ("below about 200 kHz"), the crossing
     R' = 0.1 wL' found by bisection, and the claim that above a few MHz both
     ratios are under a tenth;
   - the bounce diagram against the method of characteristics: the forward
     wave leaving the source is F(t) = V1 u(t) + Gs GL F(t - 2), and
     v(z, t) = F(t - z) + GL F(t - 2 + z). The final value against DC
     circuit theory, and the prose's special cases.

   Run:  node tests/ch03.test.js                                            */

const H = require('./lib/harness');
const TAU = 2*Math.PI;
const MU0 = 4e-7*Math.PI, EPS0 = 8.8541878128e-12;

const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
const sigOk = (v, t, sig) => { const e = Math.pow(10, Math.floor(Math.log10(Math.abs(t))) - sig + 1); return Math.abs(v - t) <= 0.5*e*(1 + 1e-9) + 1e-12; };
const num = s => parseFloat(String(s).replace(/−/g, '-'));

(async () => {
  const s = H.suite('ch03');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'telegraphers.html', { waitUntil: 'load' });
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

  /* ================= the cascade ================= */
  for (const n of [3, 6, 14]){
    await set('cells', n); await frame();
    for (const t of [0, 2.1, 9.4]){
      const D = await at('ladderfig', t);
      if (D.n !== n || D.nodes.length !== n + 1) { bad('cascade: one bar per node', 'n ' + n + ': ' + D.n + ', ' + D.nodes.length); continue; }
      for (const [k, v] of D.nodes) if (Math.abs(v - Math.cos(t - TAU*k/D.cellsPerWave)) > 1e-9){ bad('cascade: node voltages are the wave', 'n ' + n + ' t ' + t + ' node ' + k); break; }
    }
  }

  /* ================= L' and C' ================= */
  for (const geo of ['coax', 'twin']){
    await set('lc-g', geo, 'change');
    for (const r of geo === 'coax' ? [1.2, 2.3, 3.35, 7.01, 12] : [2.1, 3, 6.37, 12]) for (const er of [1, 2.1, 4.4, 10]){
      await set('lc-r', r); await set('lc-e', er); await frame();
      const D = await drawn('lcfig'), tag = geo + ' ' + r + ' er ' + er;
      if (D.geo !== geo || Math.abs(D.ratio - r) > 1e-12 || Math.abs(D.er - er) > 1e-12) { bad('L C: controls reach the figure', tag); continue; }
      const eps = er*EPS0, k = geo === 'coax' ? Math.log(r) : Math.log(r/2 + Math.sqrt(r*r/4 - 1));
      const L = geo === 'coax' ? MU0*k/TAU : MU0*k/Math.PI, C = geo === 'coax' ? TAU*eps/k : Math.PI*eps/k;
      if (Math.abs(D.nH - L*1e9) > 1e-6*L*1e9 || Math.abs(D.pF - C*1e12) > 1e-6*C*1e12) bad('L C: per-metre values', tag + ': ' + D.nH + ' nH ' + D.pF + ' pF');
      /* Z0 the other way: the wave impedance of the dielectric times the geometric factor */
      const eta = Math.sqrt(MU0/eps), z0 = eta*k/(geo === 'coax' ? TAU : Math.PI);
      if (!sigOk(num(await text('lc-l')), L*1e9, 3)) bad('L C: L readout', tag + ': ' + await text('lc-l'));
      if (!sigOk(num(await text('lc-c')), C*1e12, 3)) bad('L C: C readout', tag + ': ' + await text('lc-c'));
      if (!printedOk(num(await text('lc-z')), z0, 1)) bad('L C: Z0 readout', tag + ': ' + await text('lc-z') + ' vs ' + z0);
      if (!printedOk(num(await text('lc-p')), 1, 3) || Math.abs(L*C/(MU0*eps) - 1) > 1e-12) bad('L C: L\'C\' = mu eps (as claimed)', tag);
      if (Math.abs(D.drawn - r) > 1e-6*r) bad('L C: cross-section drawn to the ratio', tag + ': ' + D.drawn);
    }
  }
  await set('lc-g', 'coax', 'change');

  /* ================= R', G' ================= */
  const A = 0.45e-3, B = 1.47e-3, SIG = 5.8e7, TD = [2e-4, 2e-4, 0.02], ER = [2.25, 2.1, 4.4];
  for (let di = 0; di < 3; di++){
    await set('rg-d', di, 'change'); await frame();
    const D = await drawn('rgfig'), tag = 'dielectric ' + di;
    const Lp = MU0/TAU*Math.log(B/A), Cp = TAU*ER[di]*EPS0/Math.log(B/A);
    const delta = f => Math.sqrt(2/(TAU*f*MU0*SIG));                       /* sqrt(2/(omega mu sigma)) */
    const Rp = f => (1/(SIG*delta(f)))*(1/A + 1/B)/TAU;                     /* surface resistance 1/(sigma delta) */
    if (D.diel.td !== TD[di] || D.diel.er !== ER[di]) { bad('RG: controls reach the figure', tag); continue; }
    const want = { 'ωL′': f => TAU*f*Lp, 'R′': Rp, 'ωC′': f => TAU*f*Cp, 'G′': f => TAU*f*Cp*TD[di] };
    for (const name of Object.keys(want)){
      const cur = D.curves[name];
      if (!cur) { bad('RG: the four curves', tag + ': ' + name + ' missing'); continue; }
      for (const [f, v, dash] of cur){
        if (Math.abs(v - Math.log10(want[name](f))) > 1e-7){ bad('RG: the four curves', tag + ' ' + name + ' at ' + f + ': ' + v); break; }
        const shouldDash = name === 'R′' && delta(f) >= A/3;
        if (dash !== shouldDash){ bad('RG: R\' dashed where delta > a/3', tag + ' at ' + f); break; }
      }
    }
    /* the dashed stretch ends "about 200 kHz" */
    const fv = 1/(Math.PI*MU0*SIG*(A/3)*(A/3));
    if (fv < 150e3 || fv > 250e3) bad('RG: R\' dashed where delta > a/3', 'boundary at ' + fv);
    /* R' = 0.1 wL', by bisection on a log scale */
    let lo = 1, hi = 1e10;
    for (let i = 0; i < 200; i++){ const m = Math.sqrt(lo*hi); if (Rp(m) > 0.1*TAU*m*Lp) lo = m; else hi = m; }
    const fx = Math.sqrt(lo*hi), xt = await text('rg-x');
    const unit = /GHz/.test(xt) ? 1e9 : /MHz/.test(xt) ? 1e6 : 1e3;
    if (!sigOk(num(xt)*unit, fx, 3)) bad('RG: R\' = 0.1 wL\' readout', tag + ': ' + xt + ' vs ' + fx);
    if (!sigOk(num(await text('rg-r')), Rp(1e9)/(TAU*1e9*Lp), 2)) bad('RG: ratio at 1 GHz', tag + ': ' + await text('rg-r'));
    if (num(await text('rg-g')) !== TD[di]) bad('RG: G\'/wC\' readout', tag + ': ' + await text('rg-g'));
    /* the claim: above a few MHz both ratios are under a tenth */
    for (const f of [3e6, 1e7, 1e8, 1e9, 1e10])
      if (Rp(f)/(TAU*f*Lp) > 0.1 || TD[di] > 0.1) bad('RG: lossless above a few MHz (as claimed)', tag + ' at ' + f);
  }

  /* ================= the bounce diagram ================= */
  const Z0 = 50;
  const cases = [[25, 305], [25, 50], [0, 305], [50, 305], [100, 0], [0, 0], [10, 150], [200, 20], [37, 305], [0, 100]];
  for (const [Rs, RL] of cases){
    await set('lt-s', Rs); await set('lt-l', RL); await frame();
    const open = RL >= 305, tag = 'Rs ' + Rs + ' RL ' + (open ? 'open' : RL);
    const V1 = Z0/(Z0 + Rs), Gs = (Rs - Z0)/(Rs + Z0), GL = open ? 1 : (RL - Z0)/(RL + Z0);
    const F = t => { let s = 0, g = 1; for (; t >= 0; t -= 2, g *= Gs*GL) s += g*V1; return s; };
    const vz = (z, t) => F(t - z) + GL*F(t - 2 + z);
    for (const tt of [0.4, 3.3, 7.9, 13.1, 26.6]){
      const D = await at('latfig', tt);
      if (D.rs !== Rs || D.rl !== (open ? null : RL)) { bad('bounce: controls reach the figure', tag); break; }
      /* away from the instants a wave is exactly at the point sampled */
      const clear = (z, t) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].every(k => Math.abs(t - (k + (k % 2 ? 1 - z : z))) > 1e-6);
      for (const [z, v] of D.snap) if (clear(z, D.now) && Math.abs(v - vz(z, D.now)) > 1e-9){ bad('bounce: the snapshot along the line', tag + ' t ' + D.now.toFixed(3) + ' z ' + z + ': ' + v + ' vs ' + vz(z, D.now)); break; }
      for (const [t, v] of D.source) if (clear(0, t) && Math.abs(v - vz(0, t)) > 1e-9){ bad('bounce: the trace at the source', tag + ' t ' + t); break; }
      for (const [t, v] of D.load) if (clear(1, t) && Math.abs(v - vz(1, t)) > 1e-9){ bad('bounce: the trace at the load', tag + ' t ' + t); break; }
      /* each segment carries the launched step times the coefficients met */
      for (const [w, amp, lab] of D.segs){
        let want = V1; for (let k = 1; k <= w; k++) want *= (k % 2 ? GL : Gs);
        if (Math.abs(amp - want) > 1e-9 || Math.abs(num(lab) - want) > 5e-4 + 1e-9){ bad('bounce: segment labels', tag + ' wave ' + w + ': ' + lab + ' vs ' + want); break; }
      }
    }
    if (!printedOk(num(await text('lt-v1')), V1, 3)) bad('bounce: launched step', tag);
    if (!printedOk(num(await text('lt-gs')), Gs, 3)) bad('bounce: Gamma_s readout', tag);
    if (!printedOk(num(await text('lt-gl')), GL, 3)) bad('bounce: Gamma_L readout', tag);
    /* DC circuit theory: a divider, or the source itself with no load current */
    const fin = await text('lt-fin');
    if (Math.abs(Gs*GL) > 0.9999){ if (fin !== 'never settles') bad('bounce: settles to', tag + ': ' + fin); }
    else if (!printedOk(num(fin), open ? 1 : RL/(Rs + RL), 3)) bad('bounce: settles to', tag + ': ' + fin);
    /* and the series of steps does converge there */
    if (Math.abs(Gs*GL) < 0.9){ const lim = vz(1, 400.5); if (Math.abs(lim - (open ? 1 : RL/(Rs + RL))) > 1e-6) bad('bounce: settles to', tag + ': the steps go to ' + lim); }
    /* the prose's cases */
    if (RL === 50 && Math.abs(vz(1, 1.5) - vz(1, 30.5)) > 1e-12) bad('bounce: a matched load settles after one delay (as claimed)', tag);
    if (Rs === 25 && open && Math.abs(vz(1, 1.5) - 4/3) > 1e-12) bad('bounce: Rs = Z0/2, open: 4/3 at the far end (as claimed)', tag);
  }

  const keys = ['cascade: one bar per node', 'cascade: node voltages are the wave',
    'L C: controls reach the figure', 'L C: per-metre values', 'L C: L readout', 'L C: C readout', 'L C: Z0 readout', 'L C: L\'C\' = mu eps (as claimed)',
    'L C: cross-section drawn to the ratio',
    'RG: controls reach the figure', 'RG: the four curves', 'RG: R\' dashed where delta > a/3', 'RG: R\' = 0.1 wL\' readout', 'RG: ratio at 1 GHz',
    'RG: G\'/wC\' readout', 'RG: lossless above a few MHz (as claimed)',
    'bounce: controls reach the figure', 'bounce: the snapshot along the line', 'bounce: the trace at the source', 'bounce: the trace at the load',
    'bounce: segment labels', 'bounce: launched step', 'bounce: Gamma_s readout', 'bounce: Gamma_L readout', 'bounce: settles to',
    'bounce: a matched load settles after one delay (as claimed)', 'bounce: Rs = Z0/2, open: 4/3 at the far end (as claimed)'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
