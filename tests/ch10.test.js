/* Chapter 10, the Smith chart: every figure against the theory.

   Each figure publishes what it drew (data-drawn, via EM.publish). Nothing
   expected here comes from the page's code:
   - grid circles are checked by mapping many impedances z = r + jx through
     Gamma = (z - 1)/(z + 1) and requiring every one to land on the circle
     the figure drew for that r (or x);
   - travel along the line uses lib/tline's tangent formula, never a rotation
     of Gamma;
   - the quarter-wave construction is checked against the impedance seen
     along a real section of Z1, from the same tangent formula;
   - the RLC loci are rebuilt from inductance and capacitance values, and
     their claimed properties (on a constant-r or constant-g circle, traced
     clockwise) are tested as properties;
   - the constant-Q arcs are checked by mapping impedances with |x|/r = Q.

   Run:  node tests/ch10.test.js                                            */

const H = require('./lib/harness');
const T = require('./lib/tline');
const TAU = 2*Math.PI;

const gam = z => { const g = T.div(T.add(z, T.C(-1, 0)), T.add(z, T.C(1, 0))); return [g.re, g.im]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const offC = (p, c, r) => Math.abs(Math.hypot(p[0] - c[0], p[1] - c[1]) - r);
const angMod = a => ((a % TAU) + TAU) % TAU;
const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;

(async () => {
  const s = H.suite('ch10');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'smith-chart.html', { waitUntil: 'load' });
  await p.waitForTimeout(1800);

  const drawn = id => p.evaluate(id => JSON.parse(document.getElementById(id).getAttribute('data-drawn') || 'null'), id);
  const text = id => p.evaluate(id => document.getElementById(id).textContent, id);
  const setInput = (id, v, ev) => p.evaluate(({ id, v, ev }) => {
    const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event(ev || 'input', { bubbles: true }));
  }, { id, v, ev });
  const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fails = {};
  const bad = (k, why) => (fails[k] = fails[k] || []).push(why);

  /* ================= the chart assembling itself ================= */
  const RS = [0.2, 0.5, 1, 2, 5], XS = [0.2, 0.5, 1, 2, 5, -0.2, -0.5, -1, -2, -5];
  for (const stage of [0, 1, 2, 3]){
    await p.evaluate(st => document.querySelector('button[data-b="' + st + '"]').click(), stage);
    await frame();
    const D = await drawn('build');
    const rc = D.circles.filter(q => q.kind === 'r'), xc = D.circles.filter(q => q.kind === 'x');
    const wantR = stage === 1 || stage === 3, wantX = stage === 2 || stage === 3;
    if (rc.length !== (wantR ? RS.length : 0) || xc.length !== (wantX ? XS.length : 0))
      bad('build: the families each stage says', 'stage ' + stage + ': ' + rc.length + ' r, ' + xc.length + ' x');
    /* every impedance with that r (or x) lands on the circle drawn for it */
    for (const q of rc){
      let worst = 0;
      for (let i = -200; i <= 200; i++){ const x = Math.sinh(i/25); worst = Math.max(worst, offC(gam(T.C(q.val, x)), q.c, q.rad)); }
      if (worst > 1e-9) bad('build: constant-r circles', 'r = ' + q.val + ' off by ' + worst);
    }
    for (const q of xc){
      let worst = 0;
      for (let i = 0; i <= 400; i++){ const r = Math.exp(i/25 - 8); worst = Math.max(worst, offC(gam(T.C(r, q.val)), q.c, q.rad)); }
      if (worst > 1e-9) bad('build: constant-x circles', 'x = ' + q.val + ' off by ' + worst);
    }
    /* and what the caption under each stage says is true of what is drawn */
    const want = ['|Γ| = 1, the boundary of every passive load',
                  'constant r: circles through Γ = +1, one passing through the centre',
                  'constant x: centred outside the disc, so the disc clips them',
                  'both families together — the Smith chart'][stage];
    if (D.said !== want) bad('build: caption per stage', 'stage ' + stage + ': ' + D.said);
    if (stage === 1){
      if (!rc.every(q => offC([1, 0], q.c, q.rad) < 1e-12)) bad('build: what the captions claim', 'an r circle misses Gamma = +1');
      if (rc.filter(q => offC([0, 0], q.c, q.rad) < 1e-12).length !== 1) bad('build: what the captions claim', 'not exactly one r circle through the centre');
    }
    if (stage === 2 && !xc.every(q => Math.hypot(q.c[0], q.c[1]) > 1)) bad('build: what the captions claim', 'an x circle centred inside the disc');
    if (wantR && !(D.r1label && offC(D.r1label, rc.find(q => q.val === 1).c, rc.find(q => q.val === 1).rad) < 1e-12))
      bad('build: r = 1 label on its circle', JSON.stringify(D.r1label));
  }

  /* ================= the interactive chart ================= */
  const PRESETS = [['0.5,0', [0.5, 0]], ['1,0', [1, 0]], ['2,-1.4', [2, -1.4]], ['0.4,0.8', [0.4, 0.8]], ['0,0', [0, 0]]];
  for (const [attr, z] of PRESETS) for (let d of [0, 0.06, 0.125, 0.2, 0.37, 0.5]){
    await p.evaluate(a => document.querySelector('button[data-s="' + a + '"]').click(), attr);
    await setInput('d', d);
    await frame();
    const D0 = await drawn('smith');
    /* the slider steps in 0.002: the travel is the one the page applied (and shows) */
    if (Math.abs(D0.d - d) > 0.0011) bad('chart: slider applies the travel', 'asked ' + d + ', got ' + D0.d);
    const D = D0; d = D0.d;
    const tag = 'z ' + z + ' d ' + d;
    if ((await text('dv')) !== d.toFixed(3) + 'λ') bad('chart: slider readout', tag + ': ' + await text('dv'));
    const zL = T.C(z[0], z[1]), gL = gam(zL);
    if (dist(D.gl, gL) > 1e-9) bad('chart: load where the preset says', tag + ': ' + D.gl);
    /* where you are standing, by the tangent formula */
    const zd = T.zin(zL, d), gd = z[0] === 0 && z[1] === 0 ? [-Math.cos(2*TAU*d), Math.sin(2*TAU*d)] : gam(zd);
    if (dist(D.g, gd) > 1e-9) bad('chart: travel is the line transformation', tag + ': drawn ' + D.g + ', theory ' + gd);
    /* the travelled arc: from the load, clockwise, 4 pi d */
    if (Math.hypot(gL[0], gL[1]) > 0.005 && d > 0.002){
      if (!D.arc || Math.abs((D.arc[0] - D.arc[1]) - 2*TAU*d) > 1e-9 || Math.abs(angMod(D.arc[0]) - angMod(Math.atan2(gL[1], gL[0]))) > 1e-9)
        bad('chart: travelled arc', tag + ': ' + JSON.stringify(D.arc));
    }
    /* readouts */
    /* an open (the short a quarter wave on) has no finite z: the page says so */
    const fz = q => (!isFinite(q.re) || !isFinite(q.im) || Math.abs(q.re) > 1000 || Math.abs(q.im) > 1000) ? null : q;
    if (!fz(zd) && (await text('s-z')) !== '→ ∞') bad('chart: readout z here', tag + ': ' + await text('s-z') + ' for an open');
    const zr = await text('s-z'), gr = await text('s-g'), sw = await text('s-swr');
    const m = Math.hypot(gd[0], gd[1]);
    const zm = String(zr).replace(/−/g, '-').match(/^(-?\d+\.\d+) ([+-]) j(\d+\.\d+)$/);
    if (fz(zd) && !(zm && printedOk(+zm[1], zd.re, 2) && printedOk((zm[2] === '-' ? -1 : 1)*(+zm[3]), zd.im, 2)))
      bad('chart: readout z here', tag + ': ' + zr + ' vs ' + zd.re.toFixed(4) + ' ' + zd.im.toFixed(4));
    const gm = String(gr).replace(/−/g, '-').match(/^(\d+\.\d+)∠(-?\d+)°$/);
    const angT = Math.atan2(gd[1], gd[0])*180/Math.PI;
    if (!(gm && printedOk(+gm[1], m, 3) && (m < 5e-4 || Math.abs(((+gm[2] - angT) % 360 + 540) % 360 - 180) <= 0.5 + 1e-9)))
      bad('chart: readout Gamma', tag + ': ' + gr + ' vs ' + m.toFixed(4) + ' at ' + angT.toFixed(2));
    const swr = m >= 0.999 ? '∞' : null;
    if (swr ? sw !== swr : !printedOk(parseFloat(sw), (1 + m)/(1 - m), 2)) bad('chart: readout SWR', tag + ': ' + sw);
  }
  /* the open preset: full reflection at the right-hand end */
  await p.evaluate(() => document.getElementById('sopen').click()); await setInput('d', 0); await frame();
  { const D = await drawn('smith'); const zr = await text('s-z');
    if (!(D.gl[0] > 0.999 && Math.abs(D.gl[1]) < 1e-12 && zr === '→ ∞')) bad('chart: open preset', JSON.stringify(D.gl) + ' ' + zr); }

  /* ================= the quarter-wave transformer as a construction ================= */
  for (const z1 of [52, 62, 70.7, 85, 98]){
    await setInput('rn-z', z1); await frame();
    const D = await drawn('rnfig'), tag = 'Z1 ' + z1;
    const Z0 = 50, RL = 100;
    if (dist(D.cross, [(z1 - Z0)/(z1 + Z0), 0]) > 1e-9) bad('quarter wave: the cross is Z1', tag);
    if (dist(D.load, [(RL - Z0)/(RL + Z0), 0]) > 1e-9) bad('quarter wave: the load', tag);
    /* point k of the published path is beta*l = (pi/2)(k/12) along the section:
       the impedance there, from the tangent formula in the section's own Z1 */
    D.path.forEach((q, i) => {
      const bl = i/12*0.25;                                   /* wavelengths along the section */
      const zin = T.mul(T.zin(T.C(RL/z1, 0), bl), T.C(z1/Z0, 0)); /* normalised to Z0 */
      const g = Math.abs(bl - 0.25) < 1e-12 ? gam(T.C(z1*z1/RL/Z0, 0)) : gam(zin);
      if (dist(q, g) > 1e-9) bad('quarter wave: the dashed arc is the section', tag + ' point ' + i + ': ' + q + ' vs ' + g);
    });
    const gin = Math.abs((z1*z1/RL - Z0)/(z1*z1/RL + Z0));
    if (dist(D.input, [(z1*z1/RL - Z0)/(z1*z1/RL + Z0), 0]) > 1e-9) bad('quarter wave: the input', tag);
    if (!printedOk(parseFloat(await text('rn-g')), gin, 4)) bad('quarter wave: |Gamma| at the input', tag + ': ' + await text('rn-g'));
  }
  if (await text('rn-s') !== Math.sqrt(5000).toFixed(1) + ' Ω') bad('quarter wave: sqrt(Z0 RL)', await text('rn-s'));

  /* ================= an RLC load across frequency ================= */
  for (const kind of ['s', 'p']) for (const [Q, rr] of [[2, 1], [0.5, 0.2], [5, 3], [10, 1], [1, 5]]){
    await setInput('lc-n', kind, 'change'); await setInput('lc-q', Q); await setInput('lc-r', rr); await frame();
    const D = await drawn('lcifig'), tag = kind + ' Q ' + Q + ' R ' + rr;
    /* from components, w0 = 1: series L = Q R, C = 1/(Q R); parallel C = Q/R, L = R/Q */
    const zOf = f => kind === 's'
      ? T.C(rr, Q*rr*f - 1/(f/(Q*rr)))
      : T.invc(T.C(1/rr, f*Q/rr - 1/(f*rr/Q)));
    let worst = 0;
    for (const [f, g] of D.locus) worst = Math.max(worst, dist(g, gam(zOf(f))));
    if (worst > 1e-8) bad('RLC: locus is the network', tag + ': off by ' + worst);
    /* claimed: a constant-r circle (series) or constant-g circle (parallel) */
    const circ = kind === 's' ? [[rr/(1 + rr), 0], 1/(1 + rr)] : [[-(1/rr)/(1 + 1/rr), 0], 1/(1 + 1/rr)];
    if (Math.max(...D.locus.map(([f, g]) => offC(g, circ[0], circ[1]))) > 1e-9) bad('RLC: on its constant-r or constant-g circle', tag);
    /* claimed: clockwise as frequency rises */
    for (let i = 2; i < D.locus.length; i++){
      const [a, bb, c] = [D.locus[i-2][1], D.locus[i-1][1], D.locus[i][1]];
      const cr = (bb[0] - a[0])*(c[1] - bb[1]) - (bb[1] - a[1])*(c[0] - bb[0]);
      if (cr > 1e-12){ bad('RLC: traced clockwise', tag + ' at f ' + D.locus[i-1][0].toFixed(3)); break; }
    }
    for (const [f, g] of D.marks) if (dist(g, gam(zOf(f))) > 1e-9) bad('RLC: f0/2, f0, 2f0 marks', tag + ' f ' + f);
    if (dist(D.arrow[0], gam(zOf(1.3))) > 1e-9 || dist(D.arrow[1], gam(zOf(1.42))) > 1e-9) bad('RLC: arrow points up in frequency', tag);
    /* the band inside |Gamma| <= 1/3, found here by a fine scan and bisection */
    const at = f => Math.hypot(...gam(zOf(f))), lim = 1/3;
    let bw = null;
    if (at(1) <= lim){
      let lo = 1, hi = 1; const st = 1.00002;
      while (lo > 0.25 && at(lo/st) <= lim) lo /= st;
      while (hi < 4 && at(hi*st) <= lim) hi *= st;
      const edge = (a, c) => { for (let i = 0; i < 80; i++){ const m = (a + c)/2; if (at(m) <= lim) a = m; else c = m; } return a; };
      if (lo > 0.25) lo = edge(lo, lo/st);
      if (hi < 4) hi = edge(hi, hi*st);
      bw = hi - lo;
    }
    if ((bw == null) !== (D.band == null) || (bw != null && Math.abs(bw - D.band) > 1e-6))
      bad('RLC: band', tag + ': page ' + D.band + ', theory ' + bw);
    const bt = await text('lc-b');
    if (bw == null ? bt !== 'never' : !(bt.endsWith('% of f0') && printedOk(parseFloat(bt), 100*bw, 1)))
      bad('RLC: band readout', tag + ': ' + bt + ' vs ' + (bw == null ? 'never' : (100*bw).toFixed(3)));
    /* the moving point is the network at its own frequency */
    /* f is published rounded to 1e-9; at Q = 10 that moves Gamma by ~1e-8 */
    if (dist(D.moving[1], gam(zOf(D.moving[0]))) > 1e-6) bad('RLC: moving point', tag);
  }

  /* ================= constant-Q arcs ================= */
  { const D = await drawn('qafig');
    for (const q of [0.5, 1, 2, 5]){
      const mine = D.arcs.filter(a => a.q === q);
      if (mine.length !== 2){ bad('Q arcs: two per Q', 'Q ' + q); continue; }
      /* every impedance with |x|/r = Q lands on one of them, above and below */
      for (const sg of [1, -1]){
        const arc = mine.find(a => (sg > 0 ? a.c[1] < 0 : a.c[1] > 0));
        if (!arc){ bad('Q arcs: one above the axis and one below', 'Q ' + q + ': none for ' + (sg > 0 ? 'x > 0' : 'x < 0')); continue; }
        let worst = 0;
        for (let i = 0; i <= 300; i++){ const r = Math.exp(i/20 - 7); worst = Math.max(worst, offC(gam(T.C(r, sg*q*r)), arc.c, arc.rad)); }
        if (worst > 1e-9) bad('Q arcs: |x|/r = Q', 'Q ' + q + (sg > 0 ? ' above' : ' below') + ': ' + worst);
        if (offC([1, 0], arc.c, arc.rad) > 1e-9 || offC([-1, 0], arc.c, arc.rad) > 1e-9) bad('Q arcs: through the short and the open', 'Q ' + q);
      }
    }
    for (const [r, x] of [[0.5, 1], [2, -3], [0.1, 0.05], [4, 4], [1, 0]]){
      await setInput('qa-r', r); await setInput('qa-x', x); await frame();
      const E = await drawn('qafig'), tag = 'z ' + r + ' ' + x;
      if (dist(E.point, gam(T.C(r, x))) > 1e-9) bad('Q arcs: the point', tag);
      const qv = Math.abs(x)/r;
      if (!printedOk(parseFloat(await text('qa-q')), qv, 2)) bad('Q arcs: node Q readout', tag + ': ' + await text('qa-q'));
      const bt = await text('qa-b');
      if (qv < 0.02 ? bt !== 'very wide' : !printedOk(parseFloat(bt), 200/qv, 0)) bad('Q arcs: 2/Q readout', tag + ': ' + bt);
    }
  }

  const keys = ['build: the families each stage says', 'build: constant-r circles', 'build: constant-x circles',
    'build: caption per stage', 'build: what the captions claim', 'build: r = 1 label on its circle',
    'chart: load where the preset says', 'chart: slider applies the travel', 'chart: slider readout',
    'chart: travel is the line transformation', 'chart: travelled arc',
    'chart: readout z here', 'chart: readout Gamma', 'chart: readout SWR', 'chart: open preset',
    'quarter wave: the cross is Z1', 'quarter wave: the load', 'quarter wave: the dashed arc is the section',
    'quarter wave: the input', 'quarter wave: |Gamma| at the input', 'quarter wave: sqrt(Z0 RL)',
    'RLC: locus is the network', 'RLC: on its constant-r or constant-g circle', 'RLC: traced clockwise',
    'RLC: f0/2, f0, 2f0 marks', 'RLC: arrow points up in frequency', 'RLC: band', 'RLC: band readout', 'RLC: moving point',
    'Q arcs: two per Q', 'Q arcs: one above the axis and one below', 'Q arcs: |x|/r = Q', 'Q arcs: through the short and the open', 'Q arcs: the point',
    'Q arcs: node Q readout', 'Q arcs: 2/Q readout'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
