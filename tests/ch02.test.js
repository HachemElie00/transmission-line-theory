/* Chapter 02, from circuit to line: every computed figure against the theory.

   - electrical length: the profile cos(wt - beta l u), the error readout as
     the magnitude of the phasor difference |1 - e^{-j beta l}|, the verdict
     against the table's cutoffs, and the mains button against l f / u_p;
   - the edge: the far end of the line by the recursion of the wave leaving
     the source (V_inc s(t) + Gs times what left two delays earlier), the
     lumped capacitor by Runge-Kutta, the peaks by scanning, and the claims:
     a fast edge overshoots to 4/3, a slow one agrees with the capacitor;
   - the ladder: the pi-sections cascaded as ABCD matrices against the
     line's own ABCD matrix (the page instead walks admittances from the
     load), the 1 % lengths bisected here, and the prose: lambda/17 and
     lambda/4 for the 100 ohm load, cube in length, 1/N^2 in sections.

   Run:  node tests/ch02.test.js                                            */

const H = require('./lib/harness');
const TAU = 2*Math.PI;

const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
const num = s => parseFloat(String(s).replace(/−/g, '-'));
const dps = s => (String(s).replace(/[^0-9.e−-]/g, '').split('e')[0].split('.')[1] || '').length;

/* complex arithmetic and 2x2 complex matrices, written here */
const cm = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
const ca = (a, b) => [a[0] + b[0], a[1] + b[1]];
const cd = (a, b) => { const d = b[0]*b[0] + b[1]*b[1]; return [(a[0]*b[0] + a[1]*b[1])/d, (a[1]*b[0] - a[0]*b[1])/d]; };
const mm = (P, Q) => [[ca(cm(P[0][0], Q[0][0]), cm(P[0][1], Q[1][0])), ca(cm(P[0][0], Q[0][1]), cm(P[0][1], Q[1][1]))],
                      [ca(cm(P[1][0], Q[0][0]), cm(P[1][1], Q[1][0])), ca(cm(P[1][0], Q[0][1]), cm(P[1][1], Q[1][1]))]];
const zinOf = (M, z) => cd(ca(cm(M[0][0], z), M[0][1]), ca(cm(M[1][0], z), M[1][1]));
const lineM = bl => [[[Math.cos(bl), 0], [0, Math.sin(bl)]], [[0, Math.sin(bl)], [Math.cos(bl), 0]]];
const shunt = b => [[[1, 0], [0, 0]], [[0, b], [1, 0]]];
const series = x => [[[1, 0], [0, x]], [[0, 0], [1, 0]]];
function ladderM(bl, N){
  const d = bl/N, sec = mm(mm(shunt(d/2), series(d)), shunt(d/2));
  let M = [[[1, 0], [0, 0]], [[0, 0], [1, 0]]];
  for (let k = 0; k < N; k++) M = mm(M, sec);
  return M;
}
const ladErr = (z, x, N) => { const e = zinOf(lineM(TAU*x), z), l = zinOf(ladderM(TAU*x, N), z); return Math.hypot(l[0] - e[0], l[1] - e[1])/Math.hypot(e[0], e[1]); };

/* the edge, two ways that are not the page's sum */
const ramp = (t, tr) => t <= 0 ? 0 : Math.min(t/tr, 1);
function fwd(t, tr){ let s = 0, g = 1; for (; t >= 0; t -= 2, g *= -1/3) s += g*(2/3)*ramp(t, tr); return s; }   /* f(t) = Vi s(t) + Gs f(t - 2) */
const farEnd = (t, tr) => 2*fwd(t - 1, tr);
/* the capacitor by Runge-Kutta, stepped exactly onto each requested time */
function rk4(times, tr){
  const g = (t, v) => (ramp(t, tr) - v)/0.5;                              /* Rs C'l = (Z0/2)(td/Z0) = td/2 */
  let v = 0, t = 0;
  return times.map(te => {
    const n = Math.max(1, Math.ceil((te - t)/1e-4)), dt = (te - t)/n;
    for (let k = 0; k < n; k++, t += dt){
      const k1 = g(t, v), k2 = g(t + dt/2, v + dt/2*k1), k3 = g(t + dt/2, v + dt/2*k2), k4 = g(t + dt, v + dt*k3);
      v += dt/6*(k1 + 2*k2 + 2*k3 + k4);
    }
    t = te; return v;
  });
}

(async () => {
  const s = H.suite('ch02');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'circuit-to-line.html', { waitUntil: 'load' });
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

  /* ================= electrical length ================= */
  const lenCase = async (l, tag) => {
    for (const t of [0, 1.3, 7.7]){
      const D = await at('lenfig', t);
      if (Math.abs(D.l - l) > 1e-12) { bad('length: controls reach the figure', tag + ': ' + D.l); return; }
      for (const [u, v] of D.samples) if (Math.abs(v - Math.cos(t - TAU*l*u)) > 1e-9){ bad('length: the profile is cos(wt - beta l u)', tag); break; }
      if (Math.abs(D.ends[0] - Math.cos(t)) > 1e-9 || Math.abs(D.ends[1] - Math.cos(t - TAU*l)) > 1e-9) bad('length: the two ends', tag);
    }
    const deg = 360*l, err = 100*Math.hypot(1 - Math.cos(TAU*l), Math.sin(TAU*l));   /* |1 - e^{-j beta l}| */
    const dt = await text('o-deg'), et = await text('o-err');
    if (!printedOk(num(dt), deg, dps(dt))) bad('length: degrees readout', tag + ': ' + dt + ' vs ' + deg);
    if (!printedOk(num(et), err, dps(et))) bad('length: error readout', tag + ': ' + et + ' vs ' + err);
    if (num(dt) === 0 || num(et) === 0) bad('length: tiny values are not printed as zero', tag + ': ' + dt + ', ' + et);
    /* the verdict, against the table: lambda/100 fine, lambda/20 the conservative cutoff */
    const want = l <= 0.01 ? 'lumped is fine' : l <= 0.05 ? 'borderline' : 'line model needed';
    if (await text('o-ver') !== want) bad('length: verdict', tag + ': ' + await text('o-ver'));
  };
  for (const l of [0.002, 0.01, 0.02, 0.05, 0.1, 0.25, 0.37, 0.5, 0.6]){ await set('ell', l); await frame(); await lenCase(l, 'l ' + l); }
  for (const lab of ['60 Hz mains, 1 m', 'λ/20', 'λ/10', 'λ/4']){
    await p.evaluate(lab => [...document.querySelectorAll('.btns button')].find(b => b.textContent === lab).click(), lab);
    await frame();
    const want = { '60 Hz mains, 1 m': 1*60/2e8, 'λ/20': 0.05, 'λ/10': 0.1, 'λ/4': 0.25 }[lab];
    await lenCase(want, 'button ' + lab);
  }

  /* ================= the edge ================= */
  let lastGap = Infinity;
  for (const lr of [-0.7, -0.3, 0, 0.3, 0.5, 0.8, 1, 1.3]){
    await set('rs-r', lr); await frame();
    const tr = Math.pow(10, lr), D = await drawn('risefig'), tag = 'tr ' + tr.toFixed(3);
    if (Math.abs(D.tr - tr) > 1e-8) { bad('edge: controls reach the figure', tag + ': ' + D.tr); continue; }
    const T = D.T;
    for (const [t, v] of D.line) if (Math.abs(v - farEnd(t, tr)) > 1e-8){ bad('edge: the line model', tag + ' at ' + t + ': ' + v + ' vs ' + farEnd(t, tr)); break; }
    const grid = []; for (let i = 0; i <= 2000; i++) grid.push(T*i/2000);
    const ref = rk4(grid, tr), lumpRef = rk4(D.lumped.map(q => q[0]), tr);
    for (let i = 0; i < D.lumped.length; i++) if (Math.abs(D.lumped[i][1] - lumpRef[i]) > 1e-6){ bad('edge: the lumped model', tag + ' at ' + D.lumped[i][0] + ': ' + D.lumped[i][1] + ' vs ' + lumpRef[i]); break; }
    /* readouts */
    if (!printedOk(num(await text('rs-l')), 0.35/tr, 3)) bad('edge: l/lambda readout', tag);
    let pk = 0, tk = 0;
    for (let i = 0; i <= 200000; i++){ const t = T*i/200000, v = farEnd(t, tr); if (v > pk){ pk = v; tk = t; } }
    let a = Math.max(0, tk - T/200000), c = Math.min(T, tk + T/200000);
    for (let i = 0; i < 100; i++){ const m1 = a + (c - a)/3, m2 = c - (c - a)/3; if (farEnd(m1, tr) < farEnd(m2, tr)) a = m1; else c = m2; }
    pk = Math.max(pk, farEnd((a + c)/2, tr));
    if (!printedOk(num(await text('rs-pk')), pk, 3)) bad('edge: line peak readout', tag + ': ' + await text('rs-pk') + ' vs ' + pk);
    const pl = Math.max(...ref);
    if (!printedOk(num(await text('rs-pl')), pl, 3)) bad('edge: lumped peak readout', tag + ': ' + await text('rs-pl') + ' vs ' + pl);
    /* the claims */
    if (tr < 2 && Math.abs(pk - 4/3) > 1e-9) bad('edge: a fast edge overshoots to 4/3 (as claimed)', tag + ': ' + pk);
    let gap = 0; grid.forEach((t, i) => { gap = Math.max(gap, Math.abs(ref[i] - farEnd(t, tr))); });
    if (gap > lastGap + 1e-9) bad('edge: slower edges agree better (as claimed)', tag + ': gap ' + gap + ' after ' + lastGap);
    lastGap = gap;
    if (lr === 1.3 && gap > 0.03) bad('edge: slower edges agree better (as claimed)', 'slowest edge still ' + gap + ' apart');
  }

  /* ================= the ladder ================= */
  const LOADS = [[2, 0], [0.5, 0], [1, 1]];
  for (let li = 0; li < 3; li++){
    await set('ld-z', li, 'change'); await frame();
    const D = await drawn('ladfig'), z = LOADS[li], tag = 'load ' + z;
    if (JSON.stringify(D.load) !== JSON.stringify(z)) { bad('ladder: controls reach the figure', tag + ': ' + D.load); continue; }
    for (const N of [1, 2, 4, 8]) for (const [x, e] of D.curves[N]){
      const r = ladErr(z, x, N);
      if (Math.abs(e - r) > 1e-6*r + 2e-9){ bad('ladder: the error curves', tag + ' N ' + N + ' at ' + x + ': ' + e + ' vs ' + r); break; }
    }
    const ro = await p.evaluate(() => [...document.querySelectorAll('#ld-ro dd')].map(d => d.textContent));
    const one = {};
    [1, 2, 4, 8].forEach((N, i) => {
      let a = 0.002, x = a;
      for (; x < 0.5; a = x, x *= 1.01) if (ladErr(z, x, N) > 0.01) break;
      for (let k = 0; k < 80; k++){ const m = (a + x)/2; if (ladErr(z, m, N) > 0.01) x = m; else a = m; }
      one[N] = a;
      const got = num(String(ro[i]).replace(/^l < /, ''));
      if (!printedOk(got, a, 3)) bad('ladder: 1 % lengths', tag + ' N ' + N + ': ' + ro[i] + ' vs ' + a.toFixed(5));
    });
    if (li === 0){
      if (Math.abs(1/one[1] - 17) > 1) bad('ladder: one section to lambda/17, eight to lambda/4 (as claimed)', 'one section to 1/' + (1/one[1]).toFixed(2));
      if (Math.abs(1/one[8] - 4) > 0.5) bad('ladder: one section to lambda/17, eight to lambda/4 (as claimed)', 'eight to 1/' + (1/one[8]).toFixed(2));
    }
    for (const N of [1, 2, 4]){
      const cube = ladErr(z, 0.02, N)/ladErr(z, 0.01, N), quad = ladErr(z, 0.05, N)/ladErr(z, 0.05, 2*N);
      if (cube < 7 || cube > 9.5) bad('ladder: error grows as the cube of the length (as claimed)', tag + ' N ' + N + ': ratio ' + cube);
      if (quad < 3.6 || quad > 4.4) bad('ladder: error falls as 1/N^2 (as claimed)', tag + ' N ' + N + ': ratio ' + quad);
    }
  }

  const keys = ['length: controls reach the figure', 'length: the profile is cos(wt - beta l u)', 'length: the two ends', 'length: degrees readout',
    'length: error readout', 'length: tiny values are not printed as zero', 'length: verdict',
    'edge: controls reach the figure', 'edge: the line model', 'edge: the lumped model', 'edge: l/lambda readout', 'edge: line peak readout',
    'edge: lumped peak readout', 'edge: a fast edge overshoots to 4/3 (as claimed)', 'edge: slower edges agree better (as claimed)',
    'ladder: controls reach the figure', 'ladder: the error curves', 'ladder: 1 % lengths',
    'ladder: one section to lambda/17, eight to lambda/4 (as claimed)', 'ladder: error grows as the cube of the length (as claimed)',
    'ladder: error falls as 1/N^2 (as claimed)'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
