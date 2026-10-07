/* Chapter 05, microstrip: every computed figure against the theory.

   - Hammerstad: eps_eff and Z0 re-implemented here from the formulas printed
     on the page, lambda_g, every readout, the cross-section drawn to the ratio
     at every width, the presets (each value reaching its slider), the
     curve, and the prose: wider is lower, the frequency moves nothing but
     lambda_g, the synthesis worked example, the 17 mm quarter wave;
   - the field solve: the discrete problem the caption describes solved here
     to convergence (Gauss-Seidel, then a check that Gauss's law gives the
     same charge on two different closed blocks of nodes), against the page,
     and the prose's claim that it lands within 3 % of Hammerstad;
   - Getsinger: the curves, the 5 % frequencies by bisection, and f5 scaling
     as 1/h exactly;
   - the open end: Hammerstad and Bekkadal's delta-l, the quarter wave, the cut
     length, the frequency error, and the extension drawn to scale.

   Run:  node tests/ch05.test.js                                            */

const H = require('./lib/harness');
const C0 = 299792458, MU0 = 4e-7*Math.PI, EPS0 = 8.8541878128e-12;

const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
const sigOk = (v, t, sig) => { const e = Math.pow(10, Math.floor(Math.log10(Math.abs(t))) - sig + 1); return Math.abs(v - t) <= 0.5*e*(1 + 1e-9) + 1e-12; };
const num = s => parseFloat(String(s).replace(/−/g, '-'));

/* the page's printed formulas, written again */
const ee = (er, u) => (er + 1)/2 + (er - 1)/2/Math.sqrt(1 + 12/u) + (u < 1 ? (er - 1)/2*0.04*(1 - u)*(1 - u) : 0);
const z0 = (er, u) => u <= 1 ? 60/Math.sqrt(ee(er, u))*Math.log(8/u + u/4)
                             : 120*Math.PI/(Math.sqrt(ee(er, u))*(u + 1.393 + 0.667*Math.log(u + 1.444)));
const synth = (z, er) => {
  const A = z/60*Math.sqrt((er + 1)/2) + (er - 1)/(er + 1)*(0.23 + 0.11/er), B = 377*Math.PI/(2*z*Math.sqrt(er));
  const narrow = 8*Math.exp(A)/(Math.exp(2*A) - 2);
  const wide = 2/Math.PI*(B - 1 - Math.log(2*B - 1) + (er - 1)/(2*er)*(Math.log(B - 1) + 0.39 - 0.61/er));
  return { A, B, narrow, wide, wh: narrow < 2 ? narrow : wide };
};

/* the discrete field problem of the caption, solved here */
function fieldSolve(wh, er){
  const HC = 10, NX = 160, NY = 80, w = Math.max(2, Math.round(wh*HC)), xa0 = Math.round(NX/2 - w/2), xb0 = xa0 + w - 1;
  const ev = (j, e) => j <= HC ? e : 1, eh = (j, e) => j < HC ? e : (j === HC ? (e + 1)/2 : 1);
  const run = e => {
    const p = new Float64Array(NX*NY), fx = new Uint8Array(NX*NY);
    for (let i = xa0; i <= xb0; i++){ p[HC*NX + i] = 1; fx[HC*NX + i] = 1; }
    for (let it = 0; it < 20000; it++){
      let ch = 0;
      for (let j = 1; j < NY - 1; j++){
        const a = ev(j, e), b = ev(j + 1, e), c = eh(j, e), d = 2*c + a + b;
        for (let i = 1; i < NX - 1; i++){ const k = j*NX + i; if (fx[k]) continue;
          const v = (c*(p[k - 1] + p[k + 1]) + a*p[k - NX] + b*p[k + NX])/d, nv = p[k] + 1.95*(v - p[k]); ch = Math.max(ch, Math.abs(nv - p[k])); p[k] = nv; }
      }
      if (ch < 1e-13) break;
    }
    const Q = m => {
      const xa = xa0 - m, xb = xb0 + m, ya = HC - m + 1, yb = HC + m - 1; let q = 0;
      for (let i = xa; i <= xb; i++) q += (p[yb*NX + i] - p[(yb + 1)*NX + i])*ev(yb + 1, e) + (p[ya*NX + i] - p[(ya - 1)*NX + i])*ev(ya, e);
      for (let j = ya; j <= yb; j++) q += ((p[j*NX + xb] - p[j*NX + xb + 1]) + (p[j*NX + xa] - p[j*NX + xa - 1]))*eh(j, e);
      return q;
    };
    return [Q(3), Q(7)];
  };
  const [c1, c2] = run(er), [a1, a2] = run(1);
  return { e: c1/a1, z: 1/(C0*EPS0*Math.sqrt(c1*a1)), spread: Math.max(Math.abs(c1/c2 - 1), Math.abs(a1/a2 - 1)), w, x0: xa0, x1: xb0 };
}

(async () => {
  const s = H.suite('ch05');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'microstrip.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);

  const drawn = id => p.evaluate(id => JSON.parse(document.getElementById(id).getAttribute('data-drawn') || 'null'), id);
  const text = id => p.evaluate(id => document.getElementById(id).textContent, id);
  const set = (id, v, ev) => p.evaluate(({ id, v, ev }) => {
    const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event(ev || 'input', { bubbles: true }));
  }, { id, v, ev });
  const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fails = {};
  const bad = (k, why) => (fails[k] = fails[k] || []).push(why);

  /* ================= Hammerstad ================= */
  const ham = async (wh, er, h, f, tag) => {
    const D = await drawn('msfig');
    if (D.wh !== wh || D.er !== er || D.h !== h || D.f !== f) { bad('Hammerstad: controls reach the figure', tag + ': ' + [D.wh, D.er, D.h, D.f]); return null; }
    const e = ee(er, wh), z = z0(er, wh), lg = C0/(f*1e9)/Math.sqrt(e)*1e3;
    if (Math.abs(D.ee - e) > 1e-9 || Math.abs(D.z - z) > 1e-7) bad('Hammerstad: eps_eff and Z0', tag + ': ' + D.ee + ' ' + D.z + ' vs ' + e + ' ' + z);
    if (!printedOk(num(await text('m-ee')), e, 2)) bad('Hammerstad: readouts', tag + ' eeff ' + await text('m-ee'));
    if (!printedOk(num(await text('m-z0')), z, 1)) bad('Hammerstad: readouts', tag + ' Z0 ' + await text('m-z0'));
    if (!printedOk(num(await text('m-w')), wh*h, 2)) bad('Hammerstad: readouts', tag + ' W ' + await text('m-w'));
    if (!printedOk(num(await text('m-lg')), lg, 1)) bad('Hammerstad: readouts', tag + ' lg ' + await text('m-lg') + ' vs ' + lg);
    if (!printedOk(num(await text('m-q')), lg/4, 1)) bad('Hammerstad: readouts', tag + ' lg/4 ' + await text('m-q'));
    if (Math.abs(D.drawn - wh) > 1e-6*wh) bad('Hammerstad: cross-section drawn to the ratio', tag + ': ' + D.drawn);
    for (const [u, zu] of D.curve) if (Math.abs(zu - z0(er, u)) > 1e-6){ bad('Hammerstad: the curve', tag + ' at ' + u); break; }
    return D;
  };
  for (const [wh, er, h, f] of [[2, 4.4, 1.6, 2.4], [0.1, 4.4, 1.6, 2.4], [0.98, 2.2, 0.5, 5], [1, 10.2, 0.63, 1.2], [5.7, 4.4, 1.6, 3], [8, 12, 3, 10], [3.14, 1, 0.1, 0.1]]){
    await set('wh', wh); await set('er', er); await set('hh', h); await set('fr', f); await frame();
    await ham(wh, er, h, f, 'sliders ' + [wh, er, h, f]);
  }
  const presets = await p.evaluate(() => [...document.querySelectorAll('.btns button[data-m]')].map(b => [b.textContent, b.getAttribute('data-m')]));
  const got = {};
  for (const [lab, v] of presets){
    await p.evaluate(lab => [...document.querySelectorAll('.btns button[data-m]')].find(b => b.textContent === lab).click(), lab);
    await frame();
    const [wh, er, h, f] = v.split(',').map(Number);
    got[lab] = await ham(wh, er, h, f, 'preset ' + lab);
  }
  { const def = got[presets[0][0]], nar = got[presets[1][0]], wid = got[presets[2][0]];
    if (!(def && nar && wid && nar.z > def.z && nar.ee < def.ee && wid.z < def.z)) bad('Hammerstad: narrow is high Z0 and lower eps_eff, wide is low Z0 (as claimed)', '');
    for (const er of [1.5, 4.4, 12]) for (let u = 0.1; u < 8; u += 0.05) if (z0(er, u + 0.05) >= z0(er, u)) bad('Hammerstad: wider is lower impedance (as claimed)', er + ' at ' + u);
  }
  /* the frequency moves lambda_g and nothing else */
  { await set('wh', 2); await set('er', 4.4); await set('hh', 1.6); await set('fr', 0.5); await frame();
    const a = await drawn('msfig'); await set('fr', 9.7); await frame(); const c = await drawn('msfig');
    if (JSON.stringify(a.curve) !== JSON.stringify(c.curve) || a.z !== c.z || a.ee !== c.ee) bad('Hammerstad: frequency moves only lambda_g (as claimed)', ''); }
  /* the worked synthesis, and the quarter wave */
  { const S = synth(50, 4.4);
    if (Math.abs(S.A - 1.53) > 0.005 || Math.abs(S.B - 5.65) > 0.005 || Math.abs(S.narrow - 1.91) > 0.005 || Math.abs(S.wide - 1.91) > 0.005 || Math.abs(S.narrow/S.wide - 1) > 1e-3)
      bad('Hammerstad: the synthesis example (as printed)', [S.A, S.B, S.narrow, S.wide].map(x => x.toFixed(4)).join(' '));
    if (Math.abs(z0(4.4, 1.91) - 50.3) > 0.05 || Math.abs(1.91*1.6 - 3.0) > 0.06) bad('Hammerstad: the synthesis example (as printed)', 'round trip ' + z0(4.4, 1.91));
    const q0 = C0/2.4e9/4*1e3;
    if (Math.abs(q0 - 31) > 0.5 || Math.abs(q0/Math.sqrt(3.3) - 17) > 0.5) bad('Hammerstad: the 17 mm quarter wave (as printed)', q0); }

  /* ================= the field solve ================= */
  for (const [wh, er] of [[2, 4.4], [0.3, 12], [1, 4.4], [5, 2.2], [2, 1], [0.5, 10]]){
    await set('fd-w', wh); await set('fd-e', er);
    let D = null;
    for (let k = 0; k < 200; k++){ await frame(); D = await drawn('fdfig'); if (D && D.res && D.wh === wh && D.er === er) break; }
    const tag = 'W/h ' + wh + ' er ' + er;
    if (!D || !D.res || D.wh !== wh || D.er !== er) { bad('field: the solve finishes', tag); continue; }
    const R = fieldSolve(wh, er);
    if (D.track[0] !== R.x0 || D.track[1] !== R.x1) bad('field: the track is W wide', tag + ': nodes ' + D.track + ' vs ' + [R.x0, R.x1]);
    if (R.spread > 1e-9) bad('field: Gauss\'s law closes (reference)', tag + ': ' + R.spread);
    if (Math.abs(D.res.e/R.e - 1) > 1e-6 || Math.abs(D.res.z/R.z - 1) > 1e-6) bad('field: eps_eff and Z0', tag + ': ' + D.res.e + ' ' + D.res.z + ' vs ' + R.e + ' ' + R.z);
    if (!printedOk(num(await text('fd-e1')), R.e, 3)) bad('field: readouts', tag + ' ' + await text('fd-e1'));
    if (!printedOk(num(await text('fd-z1')), R.z, 1)) bad('field: readouts', tag + ' ' + await text('fd-z1'));
    if (!printedOk(num(await text('fd-e2')), ee(er, wh), 3)) bad('field: readouts', tag + ' ham ' + await text('fd-e2'));
    if (!printedOk(num(await text('fd-z2')), z0(er, wh), 1)) bad('field: readouts', tag + ' ham ' + await text('fd-z2'));
    if (Math.abs(R.z/z0(er, wh) - 1) > 0.03 || Math.abs(R.e/ee(er, wh) - 1) > 0.03) bad('field: within 3 % of Hammerstad (as claimed)', tag + ': Z0 ' + (100*(R.z/z0(er, wh) - 1)).toFixed(2) + ' %, eps ' + (100*(R.e/ee(er, wh) - 1)).toFixed(2) + ' %');
  }

  /* ================= Getsinger ================= */
  for (const er of [2, 4.4, 9.8, 12]){
    await set('gs-e', er); await frame();
    const D = await drawn('gsfig'), tag = 'er ' + er;
    if (D.er !== er) { bad('Getsinger: controls reach the figure', tag); continue; }
    const wh = synth(50, er).wh, e0 = ee(er, wh), z = z0(er, wh), G = 0.6 + 0.009*z;
    const ro = await p.evaluate(() => [...document.querySelectorAll('#gs-ro dd')].map(d => d.textContent));
    const f5s = D.hs.map((h, n) => {
      const fp = z/(2*MU0*h), ef = f => er - (er - e0)/(1 + G*(f/fp)*(f/fp));
      for (const [fg, v] of D.curves[n]) if (Math.abs(v - ef(fg*1e9)) > 1e-9){ bad('Getsinger: the curves', tag + ' h ' + h + ' at ' + fg); break; }
      /* what is plotted: the rise above the static value, in percent */
      for (const [fg, v] of D.rise[n]) if (Math.abs(v - 100*(ef(fg*1e9)/e0 - 1)) > 1e-7){ bad('Getsinger: the plotted rise', tag + ' h ' + h + ' at ' + fg); break; }
      let lo = 1e6, hi = 1e13;
      for (let i = 0; i < 200; i++){ const m = Math.sqrt(lo*hi); if (ef(m) > 1.05*e0) hi = m; else lo = m; }
      if (!sigOk(num(ro[n])*1e9, hi, 3)) bad('Getsinger: 5 % frequencies', tag + ' h ' + h + ': ' + ro[n] + ' vs ' + hi);
      if (Math.abs(D.f5[n]/hi - 1) > 1e-9) bad('Getsinger: 5 % frequencies', tag + ' h ' + h + ' unrounded ' + D.f5[n]);
      return hi;
    });
    for (let n = 1; n < f5s.length; n++) if (Math.abs(f5s[n]*D.hs[n]/(f5s[0]*D.hs[0]) - 1) > 1e-9) bad('Getsinger: f5 scales as 1/h (as claimed)', tag);
    /* the axes do not follow the slider, and hold everything drawn */
    if (D.axis[0] !== 0 || D.axis[1] !== 60 || Math.abs(D.top - 100*(er/e0 - 1)) > 1e-7 || !(D.top < 60))
      bad('Getsinger: fixed axes, asymptote at eps_r', tag + ': ' + JSON.stringify([D.axis, D.top]));
    if (er === 4.4){ const i16 = D.hs.indexOf(1.6e-3); if (i16 < 0 || f5s[i16] < 1e9 || f5s[i16] > 10e9) bad('Getsinger: a few GHz on 1.6 mm FR-4 (as claimed)', f5s[i16]); }
  }

  /* ================= the open end ================= */
  for (const wh of [0.3, 1, 2, 3.55, 5]) for (const f of [0.5, 2.4, 6.1, 10]){
    await set('oe-w', wh); await set('oe-f', f); await frame();
    const D = await drawn('oefig'), tag = 'W/h ' + wh + ' f ' + f;
    if (D.wh !== wh || D.f !== f) { bad('open end: controls reach the figure', tag); continue; }
    const e = ee(D.er, wh), dl = 0.412*D.h*(e + 0.3)*(wh + 0.264)/((e - 0.258)*(wh + 0.8)), q = C0/(f*1e9)/Math.sqrt(e)/4*1e3;
    /* the stub resonates where its electrical length q + dl is a quarter wave: f q/(q + dl) */
    const low = 100*(1 - q/(q + dl));
    if (Math.abs(D.dl - dl) > 1e-9 || Math.abs(D.q - q) > 1e-7 || Math.abs(D.cut - (q - dl)) > 1e-7 || Math.abs(D.err - low) > 1e-7) bad('open end: values', tag);
    if (!printedOk(num(await text('oe-dl')), dl, 2)) bad('open end: readouts', tag + ' dl');
    if (!printedOk(num(await text('oe-q')), q, 1)) bad('open end: readouts', tag + ' q');
    if (!printedOk(num(await text('oe-cut')), q - dl, 1)) bad('open end: readouts', tag + ' cut');
    if (!printedOk(num(await text('oe-err')), low, 1)) bad('open end: readouts', tag + ' err');
    if (Math.abs(D.drawn - dl/(wh*D.h)) > 1e-6) bad('open end: drawn to scale', tag + ': ' + D.drawn + ' vs ' + dl/(wh*D.h));
  }

  const keys = ['Hammerstad: controls reach the figure', 'Hammerstad: eps_eff and Z0', 'Hammerstad: readouts', 'Hammerstad: cross-section drawn to the ratio',
    'Hammerstad: the curve', 'Hammerstad: narrow is high Z0 and lower eps_eff, wide is low Z0 (as claimed)', 'Hammerstad: wider is lower impedance (as claimed)',
    'Hammerstad: frequency moves only lambda_g (as claimed)', 'Hammerstad: the synthesis example (as printed)', 'Hammerstad: the 17 mm quarter wave (as printed)',
    'field: the solve finishes', 'field: the track is W wide', 'field: Gauss\'s law closes (reference)', 'field: eps_eff and Z0', 'field: readouts',
    'field: within 3 % of Hammerstad (as claimed)',
    'Getsinger: controls reach the figure', 'Getsinger: the curves', 'Getsinger: the plotted rise', 'Getsinger: fixed axes, asymptote at eps_r', 'Getsinger: 5 % frequencies', 'Getsinger: f5 scales as 1/h (as claimed)',
    'Getsinger: a few GHz on 1.6 mm FR-4 (as claimed)',
    'open end: controls reach the figure', 'open end: values', 'open end: readouts', 'open end: drawn to scale'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
