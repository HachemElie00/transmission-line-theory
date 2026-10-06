/* Prologue part one, Maxwell's equations: every computed figure against the
   theory.

   - the boundary-condition figure: the arrows drawn, read as vectors in a
     right-handed frame (x right, y up, z out of the page), satisfy
     n.D = rho_s with the sign of the charge drawn, and n x H = J_s with the
     sense of the surface current drawn (dot or cross); the pillbox and the
     loop straddle the surface. Wide and narrow layouts.
   - sigma / (omega eps): every material's line from the relaxation time
     tau = eps/sigma (ratio = 1/(omega tau)), the cursor dots, the readouts,
     each verdict against the shading the figure draws, labels on their lines,
     and the prose's crossovers (copper near 1e18 Hz, sea water near 900 MHz).
   - the coax power: Z0 as sqrt(L'/C'), the power as V^2/2Z0, the share of
     power inside each radius and the half-power radius by this file's own
     quadrature of E x H and bisection, the density from the field formulas,
     the cross-section to the ratio, and E x H pointing out of the page as the
     caption says.

   Run:  node tests/p1.test.js                                              */

const H = require('./lib/harness');
const TAU = 2*Math.PI;
const MU0 = 4e-7*Math.PI, EPS0 = 8.8541878128e-12;

const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd)*(1 + 1e-9) + 1e-12;
const num = s => parseFloat(String(s).replace(/−/g, '-'));
const UNIT = { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9, THz: 1e12 };

(async () => {
  const s = H.suite('p1');
  const srv = await H.serve();
  const b = await H.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'prologue-maxwell.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);

  const drawn = id => p.evaluate(id => JSON.parse(document.getElementById(id).getAttribute('data-drawn') || 'null'), id);
  const text = id => p.evaluate(id => document.getElementById(id).textContent, id);
  const set = (id, v, ev) => p.evaluate(({ id, v, ev }) => {
    const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event(ev || 'input', { bubbles: true }));
  }, { id, v, ev });
  const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fails = {};
  const bad = (k, why) => (fails[k] = fails[k] || []).push(why);

  /* ================= boundary conditions ================= */
  async function boundary(tag){
    const D = await drawn('bcfig');
    if (!D || !D.box || !D.loop) { bad('boundary: published', tag); return; }
    for (const kind of ['box', 'loop']){
      const P = D[kind];
      /* the outward normal points from the conductor into the dielectric:
         the conductor band lies below the surface on the canvas (y down) */
      const ny = (P.conductor[0] + P.conductor[1])/2 > P.surface ? 1 : -1;
      if (!(P.shape[0] < P.surface && P.surface < P.shape[1])) bad('boundary: the shapes straddle the surface', tag + ' ' + kind);
      if (kind === 'box'){
        const q = P.charge === '+' ? 1 : P.charge === '−' || P.charge === '-' ? -1 : 0;
        if (!q || !P.D.length) { bad('boundary: n . D = rho_s', tag + ': charge ' + P.charge); continue; }
        for (const [x0, y0, x1, y1] of P.D){
          const dx = x1 - x0, dy = -(y1 - y0);                       /* physical, y up */
          if (Math.abs(dx) > 1e-9) bad('boundary: D normal to the surface', tag + ': ' + [x0, y0, x1, y1]);
          if (Math.sign(dy*ny) !== q) bad('boundary: n . D = rho_s', tag + ': D ' + (dy > 0 ? 'up' : 'down') + ' over ' + P.charge);
          if (Math.abs(y0 - P.surface) > 3 || (y1 - P.surface)*ny > 0) bad('boundary: D starts at the surface, in the dielectric', tag);
        }
      } else {
        if (!P.H.length || Math.abs(P.js) !== 1) { bad('boundary: n x H = J_s', tag + ': nothing drawn'); continue; }
        for (const [x0, y0, x1, y1] of P.H){
          const hx = x1 - x0, hy = -(y1 - y0);
          if (Math.abs(hy) > 1e-9) bad('boundary: H tangential', tag);
          /* (n x H)_z with n = (0, ny, 0), H = (hx, hy, 0) */
          const z = 0*hy - ny*hx;
          if (Math.sign(z) !== P.js) bad('boundary: n x H = J_s', tag + ': H ' + (hx > 0 ? 'right' : 'left') + ', J_s ' + (P.js > 0 ? 'out' : 'in'));
          if ((y0 - P.surface)*ny > 0) bad('boundary: H in the dielectric', tag);
        }
      }
    }
  }
  await boundary('wide');

  /* ================= sigma / omega eps ================= */
  const ratioOf = (m, f) => { const tau = m.er*EPS0/m.sig; return 1/(TAU*f*tau); };
  for (const lf of [0, 2.37, 3, 6, 8.95, 9.5, 11.99, 12]){
    await set('sf', lf); await frame();
    const D = await drawn('sigfig'), f = Math.pow(10, lf), tag = 'lf ' + lf;
    if (Math.abs(D.lf - lf) > 1e-12) { bad('sigma: slider reaches the figure', tag); continue; }
    const fv = (await text('sfv')).trim().split(' ');
    if (!UNIT[fv[1]] || !printedOk(num(fv[0]), f/UNIT[fv[1]], 2) || num(fv[0]) >= 1000 || num(fv[0]) < 0.995) bad('sigma: frequency readout', tag + ': ' + fv.join(' '));
    const [X0, X1, Y0, Y1] = D.axes;
    const ro = await p.evaluate(() => Array.from(document.querySelectorAll('#sig-ro .rd')).map(d =>
      Array.from(d.children).map(e => e.textContent)));
    if (ro.length !== D.mats.length) bad('sigma: one readout per material', tag);
    D.mats.forEach((m, i) => {
      const want = x => Math.log10(ratioOf(m, Math.pow(10, x)));
      if (Math.abs(m.line[0] - want(X0)) > 1e-7 || Math.abs(m.line[1] - want(X1)) > 1e-7) bad('sigma: each line', tag + ' ' + m.name);
      const yc = want(lf), inside = yc >= Y0 && yc <= Y1;
      if (inside ? m.dot === null || Math.abs(m.dot - yc) > 1e-7 : m.dot !== null) bad('sigma: cursor dots', tag + ' ' + m.name + ': ' + m.dot + ' vs ' + yc);
      if (Math.abs(m.label[1] - want(m.label[0])) > 1e-7 || m.label[0] < X0 || m.label[0] > X1) bad('sigma: labels on their lines', tag + ' ' + m.name);
      const r = ro[i] || [];
      if (r[0] !== m.name) { bad('sigma: one readout per material', tag + ': ' + r[0]); return; }
      const mm = /^([\d.]+)×10(−?)(\d+)$/.exec(r[1]);
      const ratio = ratioOf(m, f);
      if (!mm) bad('sigma: readout value', tag + ' ' + m.name + ': ' + r[1]);
      else {
        const ex = (mm[2] ? -1 : 1)*num(mm[3]), v = num(mm[1])*Math.pow(10, ex);
        if (num(mm[1]) < 1 || num(mm[1]) >= 10 || Math.abs(v - ratio) > 0.5*Math.pow(10, ex - 2)*(1 + 1e-6)) bad('sigma: readout value', tag + ' ' + m.name + ': ' + r[1] + ' vs ' + ratio);
      }
      /* the verdict agrees with the shading drawn */
      const lr = Math.log10(ratio), v = lr > D.shade[0] ? 'conductor' : lr < D.shade[1] ? 'dielectric' : 'in between';
      if (r[2] !== v) bad('sigma: verdict matches the shading', tag + ' ' + m.name + ': ' + r[2] + ' at 10^' + lr.toFixed(3));
    });
  }
  {
    const D = await drawn('sigfig');
    /* where each crosses 1, by bisection on the ratio */
    const cross = m => { let lo = 1e-3, hi = 1e25; for (let i = 0; i < 300; i++){ const c = Math.sqrt(lo*hi); if (ratioOf(m, c) > 1) lo = c; else hi = c; } return Math.sqrt(lo*hi); };
    const M = n => D.mats.find(m => m.name === n);
    const cu = cross(M('copper')), sea = cross(M('sea water'));
    s.check('sigma: copper crosses near 1e18 Hz (as claimed)', cu > 5e17 && cu < 2e18, cu.toExponential(3));
    s.check('sigma: sea water crosses near 900 MHz (as claimed)', Math.abs(sea/9e8 - 1) < 0.03, sea.toExponential(3));
    s.check('sigma: sea water conducts at low radio frequencies, not at microwave (as claimed)',
      ratioOf(M('sea water'), 1e4) > 100 && ratioOf(M('sea water'), 1e10) < 1, '');
    s.check('sigma: the crossover is where the line meets ratio 1 on the plot', D.mats.every(m => {
      const x = Math.log10(cross(m)), y = m.line[0] + (m.line[1] - m.line[0])*(x - D.axes[0])/(D.axes[1] - D.axes[0]);
      return Math.abs(y) < 1e-6; }), '');
  }

  /* ================= coax power ================= */
  /* share of the power inside rho (in units of a), by Simpson on S 2 pi rho */
  const S = (rho, ba, er) => { const k = Math.log(ba), z0 = Math.sqrt((MU0/TAU*k)/(TAU*er*EPS0/k)), I = 1/z0;
    return 0.5*(1/(rho*k))*(I/(TAU*rho)); };
  const integ = (f, a, b, n) => { n = n || 4000; const h = (b - a)/n; let t = f(a) + f(b); for (let i = 1; i < n; i++) t += f(a + i*h)*(i % 2 ? 4 : 2); return t*h/3; };
  async function coax(tag, layout){
    for (const ba of [1.5, 2.3, 3.5, 7.05, 10]) for (const er of [1, 2.25, 4.4, 10]){
      await set('pba', ba); await set('per', er); await frame();
      const D = await drawn('poyfig'), t = tag + ' b/a ' + ba + ' er ' + er;
      if (Math.abs(D.ba - ba) > 1e-12 || Math.abs(D.er - er) > 1e-12) { bad('coax: sliders reach the figure', t); continue; }
      const k = Math.log(ba), Lp = MU0/TAU*k, Cp = TAU*er*EPS0/k, z0 = Math.sqrt(Lp/Cp), P = 1/(2*z0);
      if (Math.abs(D.z0 - z0) > 1e-9*z0) bad('coax: Z0 = sqrt(L\'/C\')', t + ': ' + D.z0 + ' vs ' + z0);
      const Pint = integ(r => S(r, ba, er)*TAU*r, 1, ba);
      if (Math.abs(Pint/P - 1) > 1e-9) bad('coax: integrating S gives |V|^2/2Z0 (reference)', t);
      if (Math.abs(D.pInt/P - 1) > 1e-7) bad('coax: the page\'s integral', t + ': ' + D.pInt + ' vs ' + P);
      if (!printedOk(num(await text('po-z0')), z0, 1)) bad('coax: Z0 readout', t + ': ' + await text('po-z0'));
      if (!printedOk(num(await text('po-int')), Pint*1e3, 3)) bad('coax: P readouts', t + ': ' + await text('po-int'));
      if (!printedOk(num(await text('po-ckt')), P*1e3, 3)) bad('coax: P readouts', t + ': ' + await text('po-ckt'));
      /* half the power inside: bisection on the share */
      let lo = 1, hi = ba;
      for (let i = 0; i < 60; i++){ const m = (lo + hi)/2; if (integ(r => S(r, ba, er)*TAU*r, 1, m, 400) < Pint/2) lo = m; else hi = m; }
      const rh = (lo + hi)/2, ht = (await text('po-half')).replace(/[^\d.]/g, '');
      if (!printedOk(num(ht), rh, 2)) bad('coax: half-power radius readout', t + ': ' + ht + ' vs ' + rh);
      if (Math.abs(D.Rh/D.Ra - rh) > 1e-6) bad('coax: half-power circle drawn', t + ': ' + D.Rh/D.Ra);
      if (Math.abs(D.Rb/D.Ra - ba) > 1e-9*ba) bad('coax: cross-section drawn to the ratio', t);
      /* shading proportional to the density, 1/rho^2 */
      const sh0 = D.shade[0][1]*D.shade[0][0]**2;
      if (D.shade.some(([r, a]) => Math.abs(a*r*r - sh0) > 1e-6)) bad('coax: shading follows the density', t);
      if (layout === 'wide'){
        if (!D.density || !D.share) { bad('coax: the plot is drawn', t); continue; }
        for (const [r, v] of D.density) if (Math.abs(v - S(r, ba, er)/S(1, ba, er)) > 1e-9){ bad('coax: density curve', t + ' at ' + r); break; }
        for (const [r, v] of D.share) if (Math.abs(v - integ(x => S(x, ba, er)*TAU*x, 1, r, 400)/Pint) > 1e-7){ bad('coax: share curve', t + ' at ' + r + ': ' + v); break; }
        if (Math.abs(D.halfMark - rh) > 1e-6) bad('coax: half-power mark on the plot', t);
      }
      /* E radial and outward; E x H out of the page (physical frame, y up) */
      for (const [x0, y0, x1, y1] of D.E){
        const r0 = Math.hypot(x0 - D.cx, y0 - D.cy), r1 = Math.hypot(x1 - D.cx, y1 - D.cy);
        const cr = (x0 - D.cx)*(y1 - y0) - (y0 - D.cy)*(x1 - x0);
        if (!(r1 > r0) || Math.abs(cr) > 1e-6*r0*r1) { bad('coax: E radial, outward', t); break; }
      }
      for (const [x0, y0, x1, y1] of D.H){
        const mx = (x0 + x1)/2, my = (y0 + y1)/2;
        const ex = mx - D.cx, ey = -(my - D.cy), hx = x1 - x0, hy = -(y1 - y0);
        const sz = ex*hy - ey*hx;
        if (!(sz > 0)) bad('coax: E x H out of the page (as captioned)', t + ': ' + sz);
        if (Math.abs(ex*hx + ey*hy) > 0.3*Math.hypot(ex, ey)*Math.hypot(hx, hy)) bad('coax: H circles the axis', t);
      }
    }
    await set('pba', 3.5); await set('per', 2.25);
  }
  await coax('wide', 'wide');

  /* the narrow layouts */
  await p.setViewportSize({ width: 390, height: 900 });
  await p.waitForTimeout(600); await frame();
  await boundary('narrow');
  await coax('narrow', 'narrow');

  const keys = ['boundary: published', 'boundary: the shapes straddle the surface', 'boundary: D normal to the surface', 'boundary: n . D = rho_s',
    'boundary: D starts at the surface, in the dielectric', 'boundary: H tangential', 'boundary: n x H = J_s', 'boundary: H in the dielectric',
    'sigma: slider reaches the figure', 'sigma: frequency readout', 'sigma: each line', 'sigma: cursor dots', 'sigma: labels on their lines',
    'sigma: one readout per material', 'sigma: readout value', 'sigma: verdict matches the shading',
    'coax: sliders reach the figure', 'coax: Z0 = sqrt(L\'/C\')', 'coax: integrating S gives |V|^2/2Z0 (reference)', 'coax: the page\'s integral',
    'coax: Z0 readout', 'coax: P readouts', 'coax: half-power radius readout', 'coax: half-power circle drawn', 'coax: cross-section drawn to the ratio',
    'coax: shading follows the density', 'coax: the plot is drawn', 'coax: density curve', 'coax: share curve', 'coax: half-power mark on the plot',
    'coax: E radial, outward', 'coax: E x H out of the page (as captioned)', 'coax: H circles the axis'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
