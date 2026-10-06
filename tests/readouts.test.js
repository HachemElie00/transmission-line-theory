/* Everything the workbench reads off the chart for you, against the theory:
   the radially scaled ruler under the chart, the row of readouts beside it,
   and the frequency-response plot.

   RULER. Each of the six scales is a function of |Gamma| alone. The page
   reports every tick it drew (value and x), the scale's two ends, the
   cursor and the live value printed for each scale (data-drawn on #nomo).
   Each tick must sit at x0 + (x1 - x0)|Gamma(t)|, with |Gamma(t)| from the
   scale's definition written here: SWR = (1+|G|)/(1-|G|), the same in dB,
   return loss -20 log|G|, mismatch loss -10 log(1-|G|^2), reflected power
   100|G|^2. The scale must span the chart's diameter exactly, the cursor sit
   at the load's |Gamma|, and each live value be the definition evaluated
   there, to the precision printed.

   READOUTS. The row beside the chart (#big): z, Z, y, Y, Gamma, tau = 1 +
   Gamma, SWR, return and mismatch loss, reflected power, the distances from
   the load to the first voltage minimum and maximum, the wavelength-scale
   reading at the drawn point, and the bandwidth. Gamma at the travelled point
   comes from the tangent formula, never from rotating Gamma; the voltage
   extremes are FOUND, by scanning |1 + Gamma(d)| along the line, not by a
   formula for them.

   RESPONSE. The curve plotted for the chosen design and for the other one,
   the band it reports, and the words under it. The independent model works
   with impedances and the tangent formula at electrical lengths scaled by
   f/f0, and scales the L-network's elements as the components they are (an
   inductor's reactance with f, a capacitor's with 1/f). Band edges are
   found here by a scan ten times finer than the page's walk, then bisection,
   so a band that the page's walk would cut short, or an excursion above the
   limit it would step over, shows up as a disagreement.

   Run:  node tests/readouts.test.js                                        */

const H = require('./lib/harness');
const T = require('./lib/tline');
const TAU = 2*Math.PI;

const gam = z => { const g = T.div(T.add(z, T.C(-1, 0)), T.add(z, T.C(1, 0))); return [g.re, g.im]; };
const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
/* a printed string against a template, numbers compared to half their last digit */
function fmtOk(str, template, values){
  if (typeof str !== 'string') return false;
  const nums = [];
  const shape = str.replace(/−/g, '-').replace(/-?\d+(?:\.(\d+))?/g, (m, dec) => {
    nums.push([parseFloat(m), dec ? dec.length : 0]); return '#'; });
  if (shape !== template || nums.length !== values.length) return false;
  return nums.every(([v, nd], i) => values[i] === Infinity ? false : printedOk(v, values[i], nd));
}
const numOk = (str, value) => {
  if (value === Infinity) return String(str).trim().replace(/ .*/, '') === '∞';
  return fmtOk(String(str).trim().replace(/ (dB|%)$/, ''), '#', [value]);
};

/* ---- the scales, from their definitions ---- */
const SCALE_M = {
  'SWR':                  t => (t - 1)/(t + 1),
  'SWR (dB)':             t => { const S = Math.pow(10, t/20); return (S - 1)/(S + 1); },
  'Return loss (dB)':     t => Math.pow(10, -t/20),
  'Mismatch loss (dB)':   t => Math.sqrt(1 - Math.pow(10, -t/10)),
  '|Γ|':             t => t,
  'Reflected power (%)':  t => Math.sqrt(t/100)
};
/* q = 1 - |Gamma|^2 = 4r/|z + 1|^2 exactly (power delivered over power
   available): the values near the rim are computed from it, because there
   1 - |Gamma| has cancelled away most of its digits. SWR = (1+m)^2/q is
   (1+m)/(1-m) multiplied through by (1+m). */
const SCALE_V = {
  'SWR':                  (m, q) => q <= 0 ? Infinity : (1 + m)*(1 + m)/q,
  'SWR (dB)':             (m, q) => q <= 0 ? Infinity : 20*Math.log10((1 + m)*(1 + m)/q),
  'Return loss (dB)':     (m, q) => m <= 1e-12 ? Infinity : m < 0.5 ? -20*Math.log10(m) : -10*Math.log10(1 - q),
  'Mismatch loss (dB)':   (m, q) => q <= 0 ? Infinity : -10*Math.log10(q),
  '|Γ|':             (m, q) => m,
  'Reflected power (%)':  (m, q) => m < 0.5 ? 100*m*m : 100*(1 - q)
};
const qOf = (r, x) => 4*r/((r + 1)*(r + 1) + x*x);

/* ---- the response, independently ---- */
function respIndep(method, zL, open, dd, d, k){
  const zinK = (z, len) => T.zin(z, len*k);
  let z;
  if (method === 'shunt'){
    const y = T.add(T.invc(zinK(zL, d.d)), T.stubY(d.ls*k, open));
    z = T.invc(y);
  } else if (method === 'series'){
    z = T.add(zinK(zL, d.d), T.stubZ(d.ls*k, open));
  } else if (method === 'qwt'){
    const zq = zinK(zL, d.d), z1 = d.z1;
    /* a quarter wave of Z1 at f0: normalise to Z1, transform, renormalise */
    const zt = T.zin(T.div(zq, T.C(z1, 0)), 0.25*k);
    z = T.mul(zt, T.C(z1, 0));
  } else if (method === 'dstub'){
    const yA = T.add(T.invc(zL), T.stubY(d.ls1*k, open));
    const yB = T.invc(T.zin(T.invc(yA), dd*k));
    z = T.invc(T.add(yB, T.stubY(d.ls2*k, open)));
  } else {
    /* lumped: the sign at f0 says which component it is */
    const X = d.xs > 0 ? d.xs*k : d.xs < 0 ? d.xs/k : 0;
    const B = d.bp > 0 ? d.bp*k : d.bp < 0 ? d.bp/k : 0;
    if (d.order === 'series first') z = T.invc(T.add(T.invc(T.add(zL, T.C(0, X))), T.C(0, B)));
    else z = T.add(T.invc(T.add(T.invc(zL), T.C(0, B))), T.C(0, X));
  }
  const g = gam(z);
  return Math.hypot(g[0], g[1]);
}
/* the contiguous band, found by a fine scan and bisection */
function bandIndep(f, lim){
  if (f(1) > lim) return null;
  const step = 5e-5, KLO = 0.02, KHI = 3.0;
  let lo = 1, hi = 1, nx;
  while (lo > KLO){ nx = Math.max(KLO, lo - step); if (f(nx) > lim) break; lo = nx; }
  while (hi < KHI){ nx = Math.min(KHI, hi + step); if (f(nx) > lim) break; hi = nx; }
  const edge = (a, b) => { for (let i = 0; i < 60; i++){ const m = (a + b)/2; if (f(m) <= lim) a = m; else b = m; } return a; };
  const openLo = lo <= KLO, openHi = hi >= KHI;
  if (!openLo) lo = edge(lo, Math.max(KLO, lo - step));
  if (!openHi) hi = edge(hi, Math.min(KHI, hi + step));
  return { lo, hi, frac: hi - lo, open: openLo || openHi };
}

(async () => {
  const s = H.suite('readouts');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1150 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);

  let nonce = 0;
  const go = (h, method) => p.evaluate(async ({ h, n, method }) => {
    await new Promise(res => { window.addEventListener('hashchange', () => setTimeout(res, 0), { once: true });
                               location.hash = h + '&nonce=' + n; });
    if (method !== undefined){
      const sel = document.getElementById('i-method');
      sel.value = method; sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return document.querySelectorAll('#sols [data-pick]').length;
  }, { h, n: ++nonce, method });
  const read = () => p.evaluate(() => {
    const big = {};
    document.querySelectorAll('#big dt').forEach(dt => { big[dt.textContent] = dt.nextElementSibling.textContent; });
    const J = id => JSON.parse(document.getElementById(id).getAttribute('data-drawn') || 'null');
    return { big, nomo: J('nomo'), resp: J('resp'), chart: J('chart'),
             d: parseFloat(document.getElementById('i-d').value) };
  });

  const fails = {};
  const bad = (key, tag, why) => (fails[key] = fails[key] || []).push(tag + ': ' + why);
  const counts = { ruler: 0, readouts: 0, curves: 0, bands: 0 };

  /* ================= ruler and readouts, over loads and travel ================= */
  const LOADS = T.LOADS.concat([[1, 0], [0, 0.7], [0, -2], [1e-9, 0], [1000, 0]]);
  const TRAVEL = [0, 0.0371, 0.125, 0.2, 0.3333, 0.4718];
  for (const [r, x] of LOADS) for (const dtr of TRAVEL){
    const zL = T.C(r, x);
    await go('r=' + r + '&x=' + x + '&z0=50&f=1000&ee=1&practice=0&d=' + dtr + '&ymode=point');
    const o = await read(), tag = 'z=' + r + (x < 0 ? '' : '+') + x + 'j d=' + dtr;
    const N = o.nomo, geoR = o.chart.geo[2];
    const zd = T.zin(zL, dtr), gd = gam(zd), m = Math.hypot(gd[0], gd[1]);
    const mL = Math.hypot(...gam(zL));

    /* --- ruler --- */
    counts.ruler++;
    if (Math.abs((N.x1 - N.x0) - 2*geoR) > 0.01) bad('ruler spans the chart diameter', tag, (N.x1 - N.x0) + ' vs ' + 2*geoR);
    if (N.rows.length !== 6) bad('ruler has six scales', tag, N.rows.map(q => q.name).join(', '));
    for (const row of N.rows){
      const toM = SCALE_M[row.name], val = SCALE_V[row.name];
      if (!toM){ bad('ruler scale names', tag, 'unknown scale ' + row.name); continue; }
      for (const [t, px, lbl] of row.ticks){
        const want = N.x0 + (N.x1 - N.x0)*Math.min(1, toM(t));
        if (Math.abs(px - want) > 0.01) bad('every ruler tick at its definition', tag, row.name + ' ' + t + ' at ' + px.toFixed(2) + ', want ' + want.toFixed(2));
        if (lbl !== false && parseFloat(lbl) !== t) bad('every ruler tick at its definition', tag, row.name + ' tick ' + t + ' lettered ' + lbl);
      }
      if (!row.ticks.some(q => q[2] !== false)) bad('ruler scales are lettered', tag, row.name);
      /* the live value: the definition at the point's |Gamma| (travel keeps it) */
      const v = val(mL, qOf(r, x));
      if (!numOk(row.value, v)) bad('ruler values are the definitions at |Γ|', tag, row.name + ' shows ' + row.value + ', want ' + v);
    }
    if (Math.abs(N.cursor - (N.x0 + (N.x1 - N.x0)*Math.min(1, mL))) > 0.01) bad('ruler cursor at |Γ|', tag, String(N.cursor));

    /* --- readouts --- */
    counts.readouts++;
    const B = o.big, inf = Math.abs(zd.re) > 1e6 || !isFinite(zd.re);
    const yd = T.invc(zd);
    if (r > 0 && !inf){
      if (!fmtOk(B['z = Z/Z0'], '# ' + (zd.im < -0.005 ? '-' : '+') + ' j#', [zd.re, Math.abs(zd.im)]) &&
          !fmtOk(B['z = Z/Z0'], '# + j#', [zd.re, 0])) bad('readout z', tag, B['z = Z/Z0'] + ' vs ' + zd.re + ' ' + zd.im);
      const yOk = fmtOk(B['y = Y·Z0'], '# ' + (yd.im < -0.005 ? '-' : '+') + ' j#', [yd.re, Math.abs(yd.im)]) ||
                  fmtOk(B['y = Y·Z0'], '# + j#', [yd.re, 0]);
      if (!yOk && Math.abs(yd.re) < 1e6) bad('readout y', tag, B['y = Y·Z0'] + ' vs ' + yd.re + ' ' + yd.im);
    }
    /* Gamma and tau, as magnitude and angle in degrees */
    const polOk = (str, g) => { const mm = Math.hypot(g[0], g[1]);
      let a = Math.atan2(g[1], g[0])*180/Math.PI;
      const sh = String(str).replace(/−/g, '-');
      const mt = sh.match(/^(-?\d+\.\d+)∠(-?\d+\.\d+)°$/);
      if (!mt) return false;
      const ap = parseFloat(mt[2]);
      if (mm < 5e-4) return printedOk(parseFloat(mt[1]), 0, 3);
      /* +-180 is one angle */
      const da = Math.abs(((ap - a) % 360 + 540) % 360 - 180);
      return printedOk(parseFloat(mt[1]), mm, 3) && da <= 0.05 + 1e-9; };
    if (!polOk(B['Γ'], gd)) bad('readout Γ', tag, B['Γ'] + ' vs ' + gd);
    if (!polOk(B['τ = 1+Γ'], [1 + gd[0], gd[1]])) bad('readout τ', tag, B['τ = 1+Γ'] + ' vs ' + [1 + gd[0], gd[1]]);
    if (!numOk(B['SWR'], SCALE_V['SWR'](mL, qOf(r, x)))) bad('readout SWR', tag, B['SWR']);
    if (!numOk(B['Return loss'], SCALE_V['Return loss (dB)'](mL, qOf(r, x)))) bad('readout return loss', tag, B['Return loss']);
    if (!numOk(B['Mismatch loss'], SCALE_V['Mismatch loss (dB)'](mL, qOf(r, x)))) bad('readout mismatch loss', tag, B['Mismatch loss']);
    if (!numOk(B['Refl. power'], SCALE_V['Reflected power (%)'](mL, qOf(r, x)))) bad('readout reflected power', tag, B['Refl. power']);
    /* voltage extremes, found by scanning |1 + Gamma(d)| from the load */
    if (mL > 1e-3 && mL < 0.999){
      const vAt = dd => { const g = gam(T.zin(zL, dd)); return Math.hypot(1 + g[0], g[1]); };
      const ext = (sgn) => {
        let best = 0, bv = Infinity;
        for (let i = 0; i < 5000; i++){ const dd = (i + 0.5)/10000; const v = sgn*vAt(dd); if (v < bv){ bv = v; best = dd; } }
        let a = best - 1e-4, c = best + 1e-4;
        for (let i = 0; i < 100; i++){ const m1 = a + (c - a)/3, m2 = c - (c - a)/3;
          if (sgn*vAt(m1) < sgn*vAt(m2)) c = m2; else a = m1; }
        return ((a + c)/2 + 0.5) % 0.5;
      };
      const dmin = ext(1), dmax = ext(-1);
      const near = (str, want) => { const v = parseFloat(String(str)); const e = Math.abs(v - want);
        return Math.min(e, 0.5 - e) <= 0.0005 + 1e-6; };
      if (!near(B['d → V min'], dmin)) bad('readout distance to V min', tag, B['d → V min'] + ' vs ' + dmin.toFixed(5));
      if (!near(B['d → V max'], dmax)) bad('readout distance to V max', tag, B['d → V max'] + ' vs ' + dmax.toFixed(5));
      /* the wavelength scale at the drawn point: 0 at the short, half a
         wavelength per clockwise turn (the scale itself is checked in chart.test) */
      const ang = Math.atan2(gd[1], gd[0]);
      const wtg = (((Math.PI - ang)/(2*TAU)) % 0.5 + 0.5) % 0.5;
      const v = parseFloat(String(B['ring: WTG'])), e = Math.abs(v - wtg);
      if (Math.min(e, 0.5 - e) > 0.0005 + 1e-6) bad('readout WTG reading', tag, B['ring: WTG'] + ' vs ' + wtg.toFixed(5));
    }
  }

  /* ================= frequency response, every method and design ================= */
  const lims = [[2, (2 - 1)/(2 + 1)], [1.5, 0.5/2.5], [3, 2/4]];
  for (const [r, x] of T.LOADS) for (const method of ['shunt', 'series', 'qwt', 'lnet', 'dstub'])
  for (const open of (method === 'shunt' || method === 'series' || method === 'dstub') ? [false, true] : [false]){
    const zL = T.C(r, x), dd = 0.125;
    let des = method === 'shunt' ? T.shunt(zL, open) : method === 'series' ? T.series(zL, open)
            : method === 'qwt' ? T.qwt(zL) : method === 'dstub' ? T.dstub(zL, dd, open) : [];
    if (method === 'lnet'){
      T.lnet(zL).forEach(d => {
        if (Math.abs(d.xs) < 1e-7) d.xs = 0;
        if (Math.abs(d.bp) < 1e-7) d.bp = 0;
        if (!des.some(e => Math.abs(e.xs - d.xs) < 1e-6 && Math.abs(e.bp - d.bp) < 1e-6)) des.push(d);
      });
    }
    /* exactly on the double-stub boundary the two designs are one double
       root, which no sign change brackets: there b1 = 1/t - b_L */
    if (method === 'dstub' && !des.length){
      const yL = T.invc(zL), tt = Math.tan(TAU*dd), gmax = (1 + tt*tt)/(tt*tt);
      if (Math.abs(yL.re - gmax) < 1e-9){
        const b1 = 1/tt - yL.im, after = T.invc(T.zin(T.invc(T.add(yL, T.C(0, b1))), dd));
        des = [{ b1, b2: -after.im, ls1: T.findStub(b1, open, false), ls2: T.findStub(-after.im, open, false) }];
      }
    }
    const [swr, lim] = lims[(counts.curves) % 3];
    const n = await go('r=' + r + '&x=' + x + '&z0=50&f=1000&ee=1&practice=0&ymode=point&dd=' + dd +
                       '&openStub=' + (open ? 1 : 0) + '&blim=' + swr + '&bspan=0.5', method);
    const tag0 = method + ' z=' + r + (x < 0 ? '' : '+') + x + 'j ' + (open ? 'open' : 'short') + ' SWR' + swr;
    if (n !== des.length){ bad('response: designs', tag0, n + ' vs ' + des.length); continue; }
    const used = new Set();
    for (let i = 0; i < n; i++){
      await p.evaluate(i => document.querySelector('#sols [data-pick="' + i + '"]').click(), i);
      const o = await read(), R = o.resp, tag = tag0 + ' #' + (i+1);
      if (!R || !R.picked){ bad('response: plotted', tag, 'no curve'); continue; }
      /* which theory design the page is showing: the one whose own curve the
         page's curve follows (all designs agree at f0, so compare off it) */
      let k = -1, best = Infinity;
      des.forEach((d, j) => { if (used.has(j)) return;
        const e = R.picked.reduce((a, q) => a + Math.abs(Math.min(1, respIndep(method, zL, open, dd, d, q[0])) - q[1]), 0);
        if (e < best){ best = e; k = j; } });
      used.add(k);
      const d = des[k], f = kk => respIndep(method, zL, open, dd, d, kk);
      counts.curves++;
      /* 1. the curve: every sample, value and height */
      let worst = 0, worstK = 0;
      for (const [kk, mg, Y] of R.picked){
        const e = Math.abs(Math.min(1, f(kk)) - mg);
        if (e > worst){ worst = e; worstK = kk; }
        const wantY = R.pickedY[0] + (R.pickedY[1] - R.pickedY[0])*Math.min(1, f(kk));
        if (Math.abs(Y - wantY) > 0.01) bad('response: curve height on the axis', tag, 'k ' + kk);
      }
      if (worst > 1e-6) bad('response: curve is the theory', tag, '|G| off by ' + worst.toExponential(2) + ' at f/f0 = ' + worstK.toFixed(3));
      if (Math.abs(f(1)) > 1e-6) bad('response: matched at f0', tag, '|G(f0)| = ' + f(1));
      /* 2. the band */
      const bi = bandIndep(f, lim);
      counts.bands++;
      if (!bi !== !R.band) bad('response: band', tag, JSON.stringify(R.band) + ' vs ' + JSON.stringify(bi));
      else if (bi){
        if (Math.abs(bi.lo - R.band.lo) > 1e-6 || Math.abs(bi.hi - R.band.hi) > 1e-6 || !!bi.open !== !!R.band.open)
          bad('response: band edges', tag, 'page ' + R.band.lo.toFixed(6) + '..' + R.band.hi.toFixed(6) + (R.band.open ? ' open' : '') +
              ', theory ' + bi.lo.toFixed(6) + '..' + bi.hi.toFixed(6) + (bi.open ? ' open' : ''));
        const more = bi.open ? 'more than ' : '';
        if (!fmtOk(R.text, 'holds to SWR # over ' + more + '# MHz  (' + more + '#% of f#)', [swr, 1000*bi.frac, 100*bi.frac, 0]))
          bad('response: what it says', tag, R.text + '  [band ' + (100*bi.frac).toFixed(4) + '%]');
        const bw = o.big['Bandwidth'];
        if (!fmtOk(bw, (bi.open ? '> ' : '') + '# %', [100*bi.frac])) bad('response: readout bandwidth', tag, bw);
      }
      /* 3. the other design, where there are exactly two */
      if (n === 2){
        const dO = des[k === 0 ? 1 : 0], fo = kk => respIndep(method, zL, open, dd, dO, kk);
        if (!R.other) bad('response: other design plotted', tag, 'missing');
        else {
          const wo = Math.max(...R.other.map(([kk, mg]) => Math.abs(Math.min(1, fo(kk)) - mg)));
          if (wo > 1e-6) bad('response: other curve is the theory', tag, wo.toExponential(2));
          const bo = bandIndep(fo, lim);
          const ok = bo ? fmtOk(R.otherText, 'other solution: ' + (bo.open ? 'more than ' : '') + '#%', [100*bo.frac])
                        : R.otherText === 'other solution: none';
          if (!ok) bad('response: what it says about the other', tag, R.otherText);
        }
      } else if (R.other) bad('response: other design plotted', tag, 'with ' + n + ' designs there is no single "other"');
      /* 4. the frequency axis */
      const tk = R.ticks || [];
      if (!(tk.length === 3 && fmtOk(tk[0][0], '#', [500]) && fmtOk(tk[1][0], '#', [1000]) && fmtOk(tk[2][0], '#', [1500])))
        bad('response: frequency axis', tag, JSON.stringify(tk));
    }
  }

  s.note('checked: ' + JSON.stringify(counts));
  s.check('enough was checked', counts.ruler >= 150 && counts.curves >= 300 && counts.bands >= 300, JSON.stringify(counts));
  const keys = ['ruler spans the chart diameter', 'ruler has six scales', 'every ruler tick at its definition',
    'ruler scales are lettered', 'ruler values are the definitions at |Γ|', 'ruler cursor at |Γ|',
    'readout z', 'readout y', 'readout Γ', 'readout τ', 'readout SWR', 'readout return loss',
    'readout mismatch loss', 'readout reflected power', 'readout distance to V min', 'readout distance to V max',
    'readout WTG reading', 'response: designs', 'response: plotted', 'response: curve is the theory',
    'response: curve height on the axis', 'response: matched at f0', 'response: band', 'response: band edges',
    'response: what it says', 'response: readout bandwidth', 'response: other design plotted',
    'response: other curve is the theory', 'response: what it says about the other', 'response: frequency axis'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
