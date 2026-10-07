/* Chapter 07, standing waves: every computed figure against the theory.

   Independent routes used here:
   - envelopes are |V(l)| from the phasor sum V = e^{jbl} + Gamma e^{-jbl}
     (and I = e^{jbl} - Gamma e^{-jbl}), in complex arithmetic;
   - maxima and minima are FOUND by scanning that envelope, never placed by a
     formula;
   - the impedance at a maximum or minimum is the line transformation from
     lib/tline (tangent formula) evaluated there;
   - the lossy line uses the complex propagation constant, with alpha from the
     dB figure by its definition;
   - the build-up is an independent echo-by-echo simulation, and the steady
     envelope is checked as the long-time limit of that simulation.

   Run:  node tests/ch07.test.js                                            */

const H = require('./lib/harness');
const T = require('./lib/tline');
const TAU = 2*Math.PI;

const cx = (r, i) => [r, i];
const cmul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const cexp = t => [Math.cos(t), Math.sin(t)];
const cabs = a => Math.hypot(a[0], a[1]);
const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
const num = s => parseFloat(String(s).replace(/−/g, '-'));
/* V and I (scaled by V0+ and V0+/Z0) a distance l (wavelengths) from the load */
const V = (G, l) => cadd(cexp(TAU*l), cmul(G, cexp(-TAU*l)));
const I = (G, l) => cadd(cexp(TAU*l), cmul([-G[0], -G[1]], cexp(-TAU*l)));
/* the first max and min within [0, 0.5), found by scanning |V| */
function extremes(G){
  const f = l => cabs(V(G, l));
  let lmx = 0, lmn = 0, vmx = -1, vmn = 9;
  for (let i = 0; i < 50000; i++){ const l = i/100000; const v = f(l); if (v > vmx){ vmx = v; lmx = l; } if (v < vmn){ vmn = v; lmn = l; } }
  const gold = (l0, sgn) => { let a = l0 - 2e-5, b = l0 + 2e-5;
    for (let i = 0; i < 100; i++){ const m1 = a + (b - a)/3, m2 = b - (b - a)/3; if (sgn*f(m1) > sgn*f(m2)) b = m2; else a = m1; }
    return ((a + b)/2 + 0.5) % 0.5; };
  return { lmax: gold(lmx, 1), lmin: gold(lmn, -1) };
}
const wrapGap = (a, b) => { const d = Math.abs(a - b) % 0.5; return Math.min(d, 0.5 - d); };

(async () => {
  const s = H.suite('ch07');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'standing-waves.html', { waitUntil: 'load' });
  await p.waitForTimeout(1800);

  const drawn = id => p.evaluate(id => JSON.parse(document.getElementById(id).getAttribute('data-drawn') || 'null'), id);
  const text = id => p.evaluate(id => document.getElementById(id).textContent, id);
  const set = (id, v, ev) => p.evaluate(({ id, v, ev }) => {
    const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event(ev || 'input', { bubbles: true }));
  }, { id, v, ev });
  const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fails = {};
  const bad = (k, why) => (fails[k] = fails[k] || []).push(why);

  /* ================= two waves, one line ================= */
  for (const [m, ph] of [[0.5, -90], [0, 0], [1, 180], [1, 0], [0.3, 45], [0.85, -150], [0.62, 179]]){
    await set('gm', m); await set('gpp', ph); await frame();
    const D = await drawn('mainfig'), tag = '|G| ' + m + ' th ' + ph;
    const G = cmul([m, 0], cexp(ph*Math.PI/180));
    let worst = 0, worstT = 0;
    for (const [l, env, inc, ref, tot] of D.samples){
      worst = Math.max(worst, Math.abs(env - cabs(V(G, l))));
      /* the instant: incident Re{e^{j(wt + bl)}}, reflected Re{Gamma e^{j(wt - bl)}} */
      const vi = Math.cos(D.t + TAU*l), vr = cmul(G, cexp(D.t - TAU*l))[0];
      worstT = Math.max(worstT, Math.abs(inc - vi), Math.abs(ref - vr), Math.abs(tot - (vi + vr)));
      if (Math.abs(tot) > env + 1e-9) bad('main: the total stays inside the envelope', tag + ' at l ' + l);
    }
    if (worst > 1e-9) bad('main: envelope is |V|', tag + ': ' + worst);
    if (worstT > 1e-9) bad('main: the waves at this instant', tag + ': ' + worstT);
    const sw = await text('o-s');
    if (m >= 0.999 ? sw !== '∞' : !printedOk(num(sw), (1 + m)/(1 - m), 2)) bad('main: SWR readout', tag + ': ' + sw);
    if (m > 0.005){
      const e = extremes(G);
      if (wrapGap(D.marks.min, e.lmin) > 1e-6 || wrapGap(D.marks.max, e.lmax) > 1e-6) bad('main: min and max marks', tag + ': ' + JSON.stringify(D.marks) + ' vs ' + [e.lmin, e.lmax]);
      if (!printedOk(num(await text('o-mn')), e.lmin, 3) && wrapGap(num(await text('o-mn')), e.lmin) > 5e-4) bad('main: first min readout', tag + ': ' + await text('o-mn'));
      if (!printedOk(num(await text('o-mx')), e.lmax, 3) && wrapGap(num(await text('o-mx')), e.lmax) > 5e-4) bad('main: first max readout', tag + ': ' + await text('o-mx'));
    }
    /* ZL on 50 ohm: (1 + Gamma)/(1 - Gamma) */
    const z = T.div(T.C(1 + G[0], G[1]), T.C(1 - G[0], -G[1])), zt = await text('o-zl');
    if (Math.abs(1 - G[0]) + Math.abs(G[1]) > 1e-6){
      const mm = String(zt).replace(/−/g, '-').match(/^(-?\d+)(?: ([+-]) j(\d+))? Ω$/);
      const im = mm && mm[2] ? (mm[2] === '-' ? -1 : 1)*(+mm[3]) : 0;
      if (!(mm && Math.abs(+mm[1] - 50*z.re) <= 0.5 + 1e-6 && Math.abs(im - 50*z.im) <= 0.5 + 1e-6)) bad('main: ZL readout', tag + ': ' + zt + ' vs ' + (50*z.re).toFixed(2) + ' ' + (50*z.im).toFixed(2));
    } else if (zt !== '→ ∞ Ω') bad('main: ZL readout', tag + ': ' + zt);
  }

  /* ================= standing, travelling, in between ================= */
  { await set('gm', 0.5); await set('gpp', -90);
    const a = {}, c = {};
    await frame(); await frame();
    for (const id of ['m0', 'm1', 'm2']) a[id] = await drawn(id);
    await p.waitForTimeout(400); await frame();
    for (const id of ['m0', 'm1', 'm2']) c[id] = await drawn(id);
    /* each zero is a true zero of the total at that instant */
    for (const id of ['m0', 'm1', 'm2']) for (const D of [a[id], c[id]]){
      const G = cmul([D.g, 0], cexp(D.ph*Math.PI/180));
      for (const z of D.zeros){
        const v = Math.cos(D.t + TAU*z) + cmul(G, cexp(D.t - TAU*z))[0];
        if (Math.abs(v) > 2e-3) bad('regimes: the triangles are zero crossings', id + ' at ' + z.toFixed(4) + ': ' + v);
      }
    }
    /* the shaded band is the envelope, |1 + Gamma e^{-j 4 pi x}| */
    for (const id of ['m0', 'm1', 'm2']){
      const D = c[id], G = cmul([D.g, 0], cexp(D.ph*Math.PI/180));
      for (const [x, e] of D.band || []){
        const w = cmul(G, cexp(-2*TAU*x)), want = Math.hypot(1 + w[0], w[1]);
        if (Math.abs(e - want) > 1e-6){ bad('regimes: the band is the envelope', id + ' at ' + x + ': ' + e + ' vs ' + want); break; }
      }
      if (!(D.band && D.band.length > 10)) bad('regimes: the band is the envelope', id + ': no band');
    }
    /* Each frame is drawn from scratch: along the row of triangles, away from
       the ones drawn now, the canvas is exactly its own background. A faded
       trail left ghost triangles there. No colour is assumed: the reference is
       the canvas's own corner pixel, in every channel. */
    for (const id of ['m0', 'm1', 'm2']){
      const r = await p.evaluate(id => {
        const cv = document.getElementById(id), D = JSON.parse(cv.getAttribute('data-drawn'));
        const x = cv.getContext('2d'), k = cv.width/cv._w, img = x.getImageData(0, 0, cv.width, cv.height).data;
        const at = (u, v) => { const i = 4*(Math.round(v*k)*cv.width + Math.round(u*k)); return img[i] + ',' + img[i+1] + ',' + img[i+2]; };
        const bg = at(2, 2), L = 14, R = 14, B = 20, sx = (cv._w - L - R)/1.25;
        let bad = 0, n = 0;
        for (let u = L; u < cv._w - R; u += 3){
          if (D.zeros.some(z => Math.abs(L + z*sx - u) < 7)) continue;
          for (const v of [cv._h - B + 5, cv._h - B + 8]){ n++; if (at(u, v) !== bg) bad++; }
        }
        return { bad, n };
      }, id);
      if (r.bad || !r.n) bad('regimes: every frame drawn from scratch', id + ': ' + r.bad + ' of ' + r.n + ' samples off the background');
    }
    /* travelling: the crossings march; full standing: they are pinned */
    const moved = (x, y) => x.zeros.length && y.zeros.length && Math.abs(x.zeros[0] - y.zeros[0]) > 1e-3;
    if (Math.abs(a.m0.t - c.m0.t) > 1e-3 && !moved(a.m0, c.m0)) bad('regimes: travelling crossings march', JSON.stringify([a.m0.zeros, c.m0.zeros]));
    if (a.m2.ph !== -90 || c.m2.ph !== -90) bad('regimes: standing nodes are pinned', 'frames not drawn at the phase set: ' + a.m2.ph + ', ' + c.m2.ph);
    /* only frames drawn at the same phase of Gamma can be compared */
    if (Math.abs(a.m2.t - c.m2.t) > 1e-3 && a.m2.ph === c.m2.ph){
      const same = a.m2.zeros.every(z => c.m2.zeros.some(w => Math.abs(z - w) < 1e-3)) || c.m2.zeros.length === 0 || a.m2.zeros.length === 0;
      if (!same) bad('regimes: standing nodes are pinned', JSON.stringify([a.m2.zeros, c.m2.zeros]));
    } }

  /* ================= the load sets the pattern ================= */
  const zlCases = [[100, 0, 50], [25, 0, 50], [50, 0, 50], [50, 50, 50], [50, -50, 50], [0, 0, 50], [75, 75, 75], [0, 120, 50], [0, -60, 75], [200, -130, 50], [10, 40, 75]];
  for (const [R, X, Z0] of zlCases){
    await set('zz0', Z0, 'change'); await set('zr', R); await set('zx', X); await frame();
    const D = await drawn('zlfig'), tag = 'ZL ' + R + ' ' + X + ' Z0 ' + Z0;
    const Gq = T.div(T.C(R - Z0, X), T.C(R + Z0, X)), G = [Gq.re, Gq.im], m = cabs(G);
    if (Math.hypot(D.gl[0] - G[0], D.gl[1] - G[1]) > 1e-9) bad('load: Gamma_L', tag);
    if (Math.max(...D.env.map(([l, e]) => Math.abs(e - cabs(V(G, l))))) > 1e-9) bad('load: envelope is |V|', tag);
    /* Gamma at the probe turns clockwise from Gamma_L, and |1 + Gamma| is the height there */
    const [lp, gp, ev] = D.probe;
    const gw = cmul(G, cexp(-2*TAU*lp));
    if (Math.hypot(gp[0] - gw[0], gp[1] - gw[1]) > 1e-8 || Math.abs(ev - cabs(V(G, lp))) > 1e-8 || Math.abs(ev - cabs(cadd([1, 0], gp))) > 1e-8)
      bad('load: Gamma at the probe, distance from -1', tag);
    if (m > 5e-4){
      const e = extremes(G);
      if (wrapGap(D.lmax, e.lmax) > 1e-6 || wrapGap(D.lmin, e.lmin) > 1e-6) bad('load: first max and min', tag + ': ' + [D.lmax, D.lmin] + ' vs ' + [e.lmax, e.lmin]);
      if (wrapGap(num(await text('zl-mx')), e.lmax) > 5e-4 + 1e-9 || wrapGap(num(await text('zl-mn')), e.lmin) > 5e-4 + 1e-9) bad('load: max and min readouts', tag);
      /* the impedance there, by the tangent formula: real, S Z0 and Z0/S */
      const zx = T.zin(T.C(R/Z0, X/Z0), e.lmax), zn = T.zin(T.C(R/Z0, X/Z0), e.lmin);
      const S = (1 + m)/(1 - m);
      const ohm = t => String(t).trim() === '∞' ? Infinity : num(t);
      const zxT = ohm(await text('zl-zmx')), znT = ohm(await text('zl-zmn'));
      if (m < 0.9995){
        if (Math.abs(zx.im) > 1e-3*Math.max(1, zx.re) || Math.abs(zn.im) > 1e-3*Math.max(1, zn.re)) bad('load: real at the max and min (as claimed)', tag);
        const ok = (shown, want) => Math.abs(shown - want) <= 0.5*Math.pow(10, -(want < 10 ? 2 : want < 1000 ? 1 : 0)) + 1e-6*want;
        if (!ok(zxT, Z0*zx.re) || !ok(znT, Z0*zn.re) || Math.abs(Z0*zx.re - S*Z0) > 1e-6*S*Z0) bad('load: Z at a max and min', tag + ': ' + zxT + ' / ' + znT + ' vs ' + Z0*zx.re + ' / ' + Z0*zn.re);
      }
      /* the sentence: which comes first, and where the load sits */
      const cs = await text('zl-case');
      const first = (e.lmax < 1e-6 || (e.lmax < e.lmin && e.lmin > 1e-6)) ? 'max' : 'min';
      const claimsMax = /maximum comes first|maximum comes before|sits at a voltage maximum|a voltage maximum at the load/.test(cs);
      const claimsMin = /minimum comes first|minimum comes before|sits at a voltage minimum|null at the load/.test(cs);
      if (m < 0.9995 || X !== 0 || R !== 0){
        if (first === 'max' ? !claimsMax || claimsMin : !claimsMin || claimsMax) bad('load: the sentence says which comes first', tag + ': ' + cs + ' (first is ' + first + ')');
      }
    } else if (!/matched/.test(await text('zl-case'))) bad('load: the sentence says which comes first', tag + ': ' + await text('zl-case'));
  }

  /* ================= V and I, and the energy ================= */
  for (const [m, th] of [[0.5, 60], [0, 0], [1, -180], [0.9, 30], [0.25, -120]]){
    await set('vi-m', m); await set('vi-p', th); await frame();
    const D = await drawn('vifig'), tag = '|G| ' + m + ' th ' + th, G = cmul([m, 0], cexp(th*Math.PI/180));
    for (const [l, v, i] of D.samples){
      if (Math.abs(v - cabs(V(G, l))) > 1e-9 || Math.abs(i - cabs(I(G, l))) > 1e-9){ bad('V and I: the envelopes', tag + ' at ' + l); break; }
      /* the power flow, from the phasors at this point */
      const pw = cmul(V(G, l), [I(G, l)[0], -I(G, l)[1]])[0];
      if (Math.abs(pw - (1 - m*m)) > 1e-9){ bad('V and I: power flow the same everywhere (as claimed)', tag + ' at ' + l); break; }
    }
    if (!printedOk(num(await text('vi-pw')), 1 - m*m, 3)) bad('V and I: power readout', tag);
    /* the impedance at a voltage max and min, from V/I there */
    if (m > 0.01 && m < 0.999){
      const e = extremes(G), zmx = T.div(T.C(...V(G, e.lmax)), T.C(...I(G, e.lmax))), zmn = T.div(T.C(...V(G, e.lmin)), T.C(...I(G, e.lmin)));
      if (!printedOk(num(await text('vi-zx')), zmx.re, 2) || !printedOk(num(await text('vi-zn')), zmn.re, 2)) bad('V and I: Z at a max and min', tag + ': ' + await text('vi-zx') + ' ' + await text('vi-zn') + ' vs ' + zmx.re + ' ' + zmn.re);
    }
    /* the energies over half a wavelength, by quadrature here */
    let we = 0, wm = 0; for (let k = 0; k < 4000; k++){ const l = 0.5*(k + 0.5)/4000; we += cabs(V(G, l))**2; wm += cabs(I(G, l))**2; }
    if (!printedOk(num(await text('vi-we')), we/wm, 3)) bad('V and I: the energies balance over half a wavelength', tag + ': ' + await text('vi-we'));
  }

  /* ================= reading a line backwards ================= */
  { const D = await drawn('anat'), G = cmul([D.m, 0], cexp(D.a)), e = extremes(G);
    if (Math.max(...D.env.map(([l, v]) => Math.abs(v - cabs(V(G, l))))) > 1e-9) bad('anatomy: envelope', '');
    if (wrapGap(D.min1[0], e.lmin) > 1e-6 || Math.abs(D.min1[1] - (1 - D.m)) > 1e-12) bad('anatomy: 1st min', JSON.stringify(D.min1) + ' vs ' + e.lmin);
    if (wrapGap(D.max1[0], e.lmax) > 1e-6 || Math.abs(D.max1[1] - (1 + D.m)) > 1e-12) bad('anatomy: 1st max', JSON.stringify(D.max1) + ' vs ' + e.lmax);
    if (Math.abs(D.min2[0] - D.min1[0] - 0.5) > 1e-12 || Math.abs(Math.abs(D.max1[0] - D.min1[0]) - 0.25) > 1e-9) bad('anatomy: lambda/4 and lambda/2 spacings', JSON.stringify([D.min1, D.max1, D.min2]));
    /* the drawn heights are the envelope's own values there */
    if (Math.abs(cabs(V(G, D.min1[0])) - D.min1[1]) > 1e-9 || Math.abs(cabs(V(G, D.max1[0])) - D.max1[1]) > 1e-9) bad('anatomy: marks sit on the curve', ''); }

  /* ================= a lossy line ================= */
  for (const [db, m] of [[0.5, 1], [0, 0.5], [1, 0.05], [0.25, 0.8]]){
    await set('ls-a', db); await set('ls-g', m); await frame();
    const D = await drawn('lsfig'), tag = 'loss ' + db + ' dB/lambda |GL| ' + m;
    const alpha = db*Math.log(10)/20, LL = 6;                       /* Np per wavelength, from 20 log10 e^{alpha} = dB */
    for (const [l, inc, ref, env] of D.samples){
      /* V = V+ e^{gamma (LL - l)}... incident 1 at the generator end, the load (Gamma_L = -m) at l = 0 */
      const Vp = Math.exp(-alpha*(LL - l)), GL = -m;
      const Vl = cadd(cmul([Vp, 0], cexp(TAU*l)), cmul([Vp*GL*Math.exp(-2*alpha*l), 0], cexp(-TAU*l)));
      if (Math.abs(inc - Vp) > 1e-9 || Math.abs(ref - m*Vp*Math.exp(-2*alpha*l)) > 1e-9 || Math.abs(env - cabs(Vl)) > 1e-9){ bad('lossy: the waves and the envelope', tag + ' at ' + l); break; }
    }
    const s0 = await text('ls-s0'), s1 = await text('ls-s1'), g1 = m*Math.exp(-2*alpha*LL);
    const sOk = (txt, g) => g >= 0.9995 ? txt === '∞' : printedOk(num(txt), (1 + g)/(1 - g), 2);
    if (!sOk(s0, m) || !sOk(s1, g1)) bad('lossy: SWR at the load and 6 lambda back', tag + ': ' + s0 + ' / ' + s1);
    if (!printedOk(num(await text('ls-ll')), db*LL, 2)) bad('lossy: one-way loss', tag);
    /* the claim: return loss at the input = return loss at the load + twice the line loss */
    if (m < 1 && Math.abs((-20*Math.log10(g1)) - (-20*Math.log10(m) + 2*db*LL)) > 1e-9) bad('lossy: RL in = RL load + 2 x loss (as claimed)', tag);
  }
  { await set('ls-a', 0.5); await set('ls-g', 1); if (num(await text('ls-s1')).toFixed(0) !== '3') bad('lossy: the shorted 6-wavelength example reads SWR 3 (as claimed)', await text('ls-s1')); }

  /* ================= how the pattern forms ================= */
  for (const [GLv, ggv] of [[0.8, -0.5], [0, 0.6], [1, 0], [-0.6, 0.9], [0.5, 0.5]]){
    await set('bu-l', GLv); await set('bu-g', ggv); await frame();
    const D = await drawn('bufig'), tag = 'GL ' + GLv + ' Gg ' + ggv, LN = 1.25;
    /* the echoes, simulated here: echo k leaves the generator end (even k)
       or the load (odd k) and reaches l after its own delay */
    const sim = (l, t) => { let sm = 0, amp = 1;
      for (let k = 0; k < 400; k++){
        const delay = k*LN + (k % 2 === 0 ? LN - l : l);
        if (t < delay) break;
        sm += amp*Math.sin(TAU*(t - delay));
        amp *= (k % 2 === 0 ? GLv : ggv);
        if (Math.abs(amp) < 1e-14) break;
      }
      return sm; };
    let worst = 0;
    for (const [l, v] of D.samples) worst = Math.max(worst, Math.abs(v - sim(l, D.tt)));
    if (worst > 1e-9) bad('build-up: the trace is the sum of echoes', tag + ': ' + worst);
    /* the dashed steady envelope is what the echoes converge to: the peak of
       the simulated wave over one period, long after switch-on */
    if (Math.abs(ggv*GLv) < 0.95){
      for (const [l, , st] of D.samples.filter((q, i) => i % 5 === 0)){
        let pk = 0; for (let k = 0; k < 400; k++) pk = Math.max(pk, Math.abs(sim(l, 300 + k/400)));
        if (Math.abs(pk - st) > 2e-3){ bad('build-up: the steady envelope is the long-time limit', tag + ' at l ' + l + ': ' + pk + ' vs ' + st); break; }
      }
    }
    const m = Math.abs(GLv);
    const bs = await text('bu-s');
    if (m > 0.999 ? bs !== '∞' : !printedOk(num(bs), (1 + m)/(1 - m), 2)) bad('build-up: SWR', tag + ': ' + bs);
    const kind = await text('bu-k');
    if (kind !== (m < 1e-9 ? 'travelling wave' : m > 0.999 ? 'full standing wave' : 'partial standing wave')) bad('build-up: steady-state word', tag + ': ' + kind);
    if (!printedOk(num(await text('bu-q')), Math.abs(GLv*ggv), 2)) bad('build-up: per-trip factor', tag);
    /* the steady peak: the echoes summed as a geometric series, at its largest
       on the line, (1 + |GL|)/|1 - Gg GL e^{-j 4 pi LN}| */
    const ph = -4*Math.PI*LN, dr = 1 - ggv*GLv*Math.cos(ph), di = -ggv*GLv*Math.sin(ph);
    const pkT = (1 + Math.abs(GLv))/Math.hypot(dr, di);
    if (!printedOk(num(await text('bu-a')), pkT, 2) || Math.abs(D.peak - pkT) > 1e-4) bad('build-up: steady peak', tag + ': ' + await text('bu-a') + ' vs ' + pkT);
    /* the scale is fixed: Gamma_g's effect on the size is not divided out */
    if (D.scale !== 4 || D.clipped !== (pkT > 4)) bad('build-up: fixed scale', tag + ': ' + JSON.stringify([D.scale, D.clipped]));
  }

  const keys = ['main: envelope is |V|', 'main: the waves at this instant', 'main: the total stays inside the envelope',
    'build-up: steady peak', 'build-up: fixed scale',
    'main: SWR readout', 'main: min and max marks', 'main: first min readout', 'main: first max readout', 'main: ZL readout',
    'regimes: the triangles are zero crossings', 'regimes: the band is the envelope', 'regimes: every frame drawn from scratch', 'regimes: travelling crossings march', 'regimes: standing nodes are pinned',
    'load: Gamma_L', 'load: envelope is |V|', 'load: Gamma at the probe, distance from -1', 'load: first max and min',
    'load: max and min readouts', 'load: real at the max and min (as claimed)', 'load: Z at a max and min',
    'load: the sentence says which comes first',
    'V and I: the envelopes', 'V and I: power flow the same everywhere (as claimed)', 'V and I: power readout',
    'V and I: Z at a max and min', 'V and I: the energies balance over half a wavelength',
    'anatomy: envelope', 'anatomy: 1st min', 'anatomy: 1st max', 'anatomy: lambda/4 and lambda/2 spacings', 'anatomy: marks sit on the curve',
    'lossy: the waves and the envelope', 'lossy: SWR at the load and 6 lambda back', 'lossy: one-way loss',
    'lossy: RL in = RL load + 2 x loss (as claimed)', 'lossy: the shorted 6-wavelength example reads SWR 3 (as claimed)',
    'build-up: the trace is the sum of echoes', 'build-up: the steady envelope is the long-time limit', 'build-up: SWR',
    'build-up: steady-state word', 'build-up: per-trip factor'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
