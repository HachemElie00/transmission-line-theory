/* Every practice scenario, worked through the way a reader works it, with the
   drawing held against the physics at every step.

   practice.test.js asks whether correct answers are ACCEPTED. This file asks
   whether the chart MEANS what it shows while the reader is getting there.
   Every bug it was written for left a chart that was drawn perfectly and said
   the wrong thing:

   - the reader's marker started on the short or the open instead of on their
     point, because the "do nothing" stub was the shunt one for a series stub,
     and a shared link started from a zero-length (dead-short) stub;
   - switching shorted/open threw the marker to the rim;
   - with the point turned to y, the wavelength-ring marks and the stub arc
     stayed where z was, half a turn from the point they measured;
   - "back to z" after a finished match unticked the first step.

   The page publishes what it drew on the chart canvas as data-drawn (the
   point, the attempt marker, the two ring marks, the stub arc, all in display
   coordinates). Everything expected here is computed in this file, from the
   theory, and never read back from the page's own solver.

   Loads x methods x stub type x admittance convention x both designs: a few
   hundred scenarios on one page, each set up through the URL hash exactly as a
   shared link would set it up.

   Run:  node tests/scenarios.test.js                                       */

const H = require('./lib/harness');
const TAU = Math.PI * 2;

/* ---- complex arithmetic, minimal ---- */
const C = (re, im) => [re, im || 0];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
/* 1/0 as a very large real: a dead short's admittance, an open's impedance.
   NaN here would make the checks below skip silently instead of failing. */
const inv = a => { const d = a[0]*a[0] + a[1]*a[1];
  return d < 1e-30 ? [1e15, 0] : [a[0]/d, -a[1]/d]; };
const div = (a, b) => mul(a, inv(b));
const abs = a => Math.hypot(a[0], a[1]);
const arg = a => Math.atan2(a[1], a[0]);
const rot = (a, t) => mul(a, [Math.cos(t), Math.sin(t)]);
const neg = a => [-a[0], -a[1]];

/* Gamma of a normalised impedance, and back */
const gOfZ = z => div(add(z, C(-1)), add(z, C(1)));
const zOfG = g => div(add(C(1), g), add(C(1), neg(g)));

/* what a lossless stub presents, from its own definition rather than from any
   formula shared with the page: a shorted line of length l has z = j tan(bl),
   an open one z = -j cot(bl). Shunt stubs are wanted as admittance. */
function stubZ(l, open){
  const t = Math.tan(TAU * l);
  return open ? C(0, -1/(Math.abs(t) < 1e-15 ? 1e-15 : t)) : C(0, t);
}
const wrapHalf = d => (((d % 0.5) + 0.5) % 0.5);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/* stub length presenting a wanted reactance (series) or susceptance (shunt),
   by bisection on the definition above: no closed form shared with the page */
function stubFor(want, open, shunt){
  const val = l => { const z = stubZ(l, open); return shunt ? inv(z)[1] : z[1]; };
  /* the function is monotonic between its poles; scan for the bracket */
  const N = 2000;
  for (let i = 0; i < N; i++){
    const a = (i + 0.37)/N * 0.5, b = (i + 1.37)/N * 0.5;
    const fa = val(a) - want, fb = val(b) - want;
    if (!isFinite(fa) || !isFinite(fb) || Math.abs(fa) > 1e6 || Math.abs(fb) > 1e6) continue;
    if (fa === 0) return a;
    if (fa * fb < 0){
      let lo = a, hi = b;
      for (let k = 0; k < 80; k++){
        const m = (lo + hi)/2, fm = val(m) - want;
        if ((fa < 0) === (fm < 0)) lo = m; else hi = m;
      }
      /* a sign change across a POLE (tan running from +inf to -inf) also
         brackets, and bisection then converges on the pole: a dead short
         where a stub was wanted. Keep only real roots. */
      const l = (lo + hi)/2;
      if (Math.abs(val(l) - want) < 1e-6 * Math.max(1, Math.abs(want))) return l;
    }
  }
  return null;
}

/* ---- designs, from the theory ----
   travel: find every d in [0, 0.5) where the line's admittance (shunt) or
   impedance (series) has real part 1, by scanning the travelled point. */
function travelHits(zL, shunt){
  const gL = gOfZ(zL), hits = [];
  const f = d => {
    const z = zOfG(rot(gL, -2*TAU*d));
    return (shunt ? inv(z) : z)[0] - 1;
  };
  const N = 4000;
  for (let i = 0; i < N; i++){
    const a = (i + 0.31)/N * 0.5, b = (i + 1.31)/N * 0.5;
    const fa = f(a), fb = f(b);
    if (fa * fb < 0){
      let lo = a, hi = b;
      for (let k = 0; k < 80; k++){
        const m = (lo + hi)/2;
        if ((f(m) < 0) === (fa < 0)) lo = m; else hi = m;
      }
      hits.push(wrapHalf((lo + hi)/2));
    }
  }
  return hits;
}

/* ---- the attempt, from the theory: what the reader has built ---- */
function attemptZ(sc, v){
  const zL = C(sc.r, sc.x);
  const zd = zOfG(rot(gOfZ(zL), -2*TAU*v.d));
  if (sc.m === 'shunt')  return inv(add(inv(zd), inv(stubZ(v.l1, sc.open))));
  if (sc.m === 'series') return add(zd, stubZ(v.l1, sc.open));
  if (sc.m === 'qwt'){   const z1 = v.z1 / 50; return div(C(z1*z1), zd); }
  if (sc.m === 'lnet'){
    if (v.order === 'series') return inv(add(inv(add(zL, C(0, v.x1))), C(0, v.b1)));
    return add(inv(add(inv(zL), C(0, v.b1))), C(0, v.x1));
  }
  if (sc.m === 'dstub'){
    const ya = add(inv(zL), inv(stubZ(v.l1, sc.open)));
    const zb = zOfG(rot(gOfZ(inv(ya)), -2*TAU*sc.dd));
    return inv(add(inv(zb), inv(stubZ(v.l2, sc.open))));
  }
}

/* ---- scenarios ---- */
const LOADS = [
  [0.5, -0.6],   /* the page's default, 25 - j30 on 50 */
  [2, 0], [0.5, 0], [1, 1.5], [1, -0.4], [0.2, 0.4], [0.1, -0.5],
  [4, 3], [3, -2], [0.3, 1.8], [0.05, 0.1], [0.6, 0.3], [1.6, -1.2]
];
const DD = 0.125;

function scenarios(){
  const out = [];
  for (const [r, x] of LOADS){
    for (const open of [false, true]){
      for (const ymode of ['point', 'grid']){
        for (const di of [0, 1]){
          out.push({ m: 'shunt', r, x, open, ymode, di });
          if (ymode === 'point') out.push({ m: 'series', r, x, open, ymode, di });
          out.push({ m: 'dstub', r, x, open, ymode, di, dd: DD });
          if (ymode === 'point' && !open) out.push({ m: 'qwt', r, x, open, ymode, di });
        }
      }
    }
    for (const order of ['series', 'shunt']) for (const di of [0, 1])
      out.push({ m: 'lnet', r, x, open: false, ymode: 'point', di, order });
  }
  return out;
}

/* the designs a scenario can be finished with, or null if it has none */
function design(sc){
  const zL = C(sc.r, sc.x);
  if (sc.m === 'shunt' || sc.m === 'series'){
    const shunt = sc.m === 'shunt';
    const hits = travelHits(zL, shunt).sort((a, b) => a - b);
    if (hits.length < 2) return null;
    const d = hits[sc.di];
    const zd = zOfG(rot(gOfZ(zL), -2*TAU*d));
    const left = shunt ? inv(zd)[1] : zd[1];
    const l1 = stubFor(-left, sc.open, shunt);
    return l1 == null ? null : { d, l1 };
  }
  if (sc.m === 'qwt'){
    /* the line is real where Im z changes sign */
    const gL = gOfZ(zL), hits = [];
    const f = d => zOfG(rot(gL, -2*TAU*d))[1];
    for (let i = 0; i < 4000; i++){
      const a = (i + 0.31)/4000*0.5, b = (i + 1.31)/4000*0.5;
      if (f(a)*f(b) < 0 && Math.abs(f(a)) < 50){
        let lo = a, hi = b;
        for (let k = 0; k < 80; k++){ const m = (lo+hi)/2; if ((f(m) < 0) === (f(a) < 0)) lo = m; else hi = m; }
        hits.push((lo + hi)/2);
      }
    }
    if (hits.length < 2) return null;
    const d = hits.sort((a, b) => a - b)[sc.di];
    const R = zOfG(rot(gL, -2*TAU*d))[0];
    return { d, z1: 50*Math.sqrt(R) };
  }
  if (sc.m === 'lnet'){
    /* first element: the value putting the point on the target circle, found
       by scanning; second: whatever cancels what is left */
    const first = sc.order === 'series'
      ? v => inv(add(zL, C(0, v)))[0] - 1            /* g after a series x */
      : v => inv(add(inv(zL), C(0, v)))[0] - 1;      /* r after a shunt b */
    const roots = [];
    for (let i = 0; i < 20000; i++){
      const a = -10 + i*0.001, b = a + 0.001;
      if (first(a)*first(b) < 0){
        let lo = a, hi = b;
        for (let k = 0; k < 80; k++){ const m = (lo+hi)/2; if ((first(m) < 0) === (first(a) < 0)) lo = m; else hi = m; }
        roots.push((lo + hi)/2);
      }
    }
    if (roots.length < 2) return null;
    const v1 = roots.sort((a, b) => a - b)[sc.di];
    if (sc.order === 'series'){
      const y1 = inv(add(zL, C(0, v1)));
      return { order: 'series', x1: v1, b1: -y1[1] };
    }
    const z1 = inv(add(inv(zL), C(0, v1)));
    return { order: 'shunt', b1: v1, x1: -z1[1] };
  }
  if (sc.m === 'dstub'){
    /* stub 1 susceptance b1 such that after the spacing g = 1 */
    const yL = inv(zL);
    const g2 = b => {
      const ya = add(yL, C(0, b));
      return inv(zOfG(rot(gOfZ(inv(ya)), -2*TAU*sc.dd)))[0] - 1;
    };
    const roots = [];
    for (let i = 0; i < 40000; i++){
      const a = -20 + i*0.001, b = a + 0.001;
      if (g2(a)*g2(b) < 0){
        let lo = a, hi = b;
        for (let k = 0; k < 80; k++){ const m = (lo+hi)/2; if ((g2(m) < 0) === (g2(a) < 0)) lo = m; else hi = m; }
        roots.push((lo + hi)/2);
      }
    }
    if (roots.length < 2) return null;
    const bs1 = roots.sort((a, b) => a - b)[sc.di];
    const ya = add(yL, C(0, bs1));
    const yb = inv(zOfG(rot(gOfZ(inv(ya)), -2*TAU*sc.dd)));
    const l1 = stubFor(bs1, sc.open, true), l2 = stubFor(-yb[1], sc.open, true);
    return (l1 == null || l2 == null) ? null : { l1, l2, d: 0 };
  }
}

/* ---- in the page ---- */
async function main(){
  const s = H.suite('scenarios');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1150 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
  await p.waitForTimeout(2600);

  /* The sweep works at drag precision -- the question is whether the tool is
     right, not whether a slider can hit an irrational number. What the slider
     alone can do is checked separately, below, at the page's own step. */
  const STEP = await p.evaluate(() => parseFloat(document.getElementById('i-d').getAttribute('step')));
  await p.evaluate(() => document.getElementById('i-d').setAttribute('step', 'any'));

  let n = 0;
  const go = async (sc) => p.evaluate(async ({ sc, n }) => {
    const grid = (sc.ymode === 'grid' && (sc.m === 'shunt' || sc.m === 'dstub')) ? 'y' : 'z';
    const h = 'r=' + sc.r + '&x=' + sc.x + '&method=' + sc.m + '&practice=1' +
              '&openStub=' + (sc.open ? 1 : 0) + '&ymode=' + sc.ymode + '&grid=' + grid +
              '&dd=' + (sc.dd || 0.125) + '&d=0&nonce=' + n;
    await new Promise(res => {
      window.addEventListener('hashchange', () => setTimeout(res, 0), { once: true });
      location.hash = h;
    });
  }, { sc, n: ++n });

  /* set a control and read back everything the chart and panel now say */
  const act = (what) => p.evaluate((what) => {
    const fire = (el, ev) => el.dispatchEvent(new Event(ev, { bubbles: true }));
    for (const [kind, id, v] of what){
      const el = document.getElementById(id);
      if (!el) return { missing: id };
      if (kind === 'click') el.click();
      else { el.value = String(v); fire(el, 'input'); }
    }
    const cv = document.getElementById('chart');
    const steps = [...document.querySelectorAll('#prac-steps li')].map(li => li.dataset.ok === '1');
    const vd = document.getElementById('prac-verdict');
    const rb = document.getElementById('b-rot');
    const val = id => { const e = document.getElementById(id); return e ? parseFloat(e.value) : null; };
    return {
      drawn: JSON.parse(cv.getAttribute('data-drawn') || '{}'),
      steps, ok: vd.getAttribute('data-ok') === '1', verdict: vd.textContent,
      rotated: rb && rb.getAttribute('aria-pressed') === 'true',
      rotVisible: !document.getElementById('prac-rot').hidden,
      d: val('i-d'), l1: val('p-l1'), l2: val('p-l2'),
      order: (document.getElementById('p-order') || {}).textContent || null
    };
  }, what);

  const fails = {};                    /* failures grouped by what failed */
  const bad = (key, sc, detail) => {
    (fails[key] = fails[key] || []).push(sc.m + ' r=' + sc.r + ' x=' + sc.x +
      (sc.open ? ' open' : ' short') + ' ' + sc.ymode + (sc.order ? ' ' + sc.order : '') +
      ' #' + sc.di + (detail ? '  ' + detail : ''));
  };
  const near = (a, b, t) => a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) <= (t || 2e-4);

  let ran = 0, skipped = 0;
  for (const sc of scenarios()){
    const des = design(sc);
    if (!des){ skipped++; continue; }
    ran++;
    await go(sc);

    /* does this convention turn the point? */
    const turns = sc.ymode === 'point' && (sc.m === 'shunt' || sc.m === 'dstub');
    const neutral = { d: 0, l1: null, l2: null, x1: 0, b1: 0, z1: 50, order: sc.order || 'series' };

    let st = await act([]);
    neutral.l1 = st.l1; neutral.l2 = st.l2;

    /* lnet: choose the order */
    if (sc.m === 'lnet'){
      const want = sc.order === 'series' ? 'series first' : 'shunt first';
      if (st.order !== want) st = await act([['click', 'p-order']]);
    }

    /* the marker starts where nothing has been built */
    const check = (tag, state, vals, sign) => {
      const zA = attemptZ(sc, vals), gA = gOfZ(zA);
      const exp = [sign*gA[0], sign*gA[1]];
      if (abs(gA) <= 1.15 && !near(state.drawn.att, exp))
        bad(tag + ': attempt marker not where the built network puts it', sc,
            'drawn ' + JSON.stringify(state.drawn.att) + ' expected ' + exp.map(v => v.toFixed(4)));
      /* the filled point and the ring marks follow the DRAWN point */
      const gL = gOfZ(C(sc.r, sc.x)), gD = rot(gL, -2*TAU*vals.d);
      const pt = [sign*gD[0], sign*gD[1]];
      if (!near(state.drawn.pt, pt)) bad(tag + ': point not at the travelled position', sc,
            'drawn ' + JSON.stringify(state.drawn.pt));
      if (abs(gL) > 0.01 && state.drawn.ring){
        const [aL, aC] = state.drawn.ring;
        if (Math.abs(angDiff(aL, arg([sign*gL[0], sign*gL[1]]))) > 1e-3 ||
            Math.abs(angDiff(aC, arg(pt))) > 1e-3)
          bad(tag + ': ring marks not at the drawn point', sc, JSON.stringify(state.drawn.ring));
      }
      /* the stub on the rim starts at its termination and ends where its own
         input sits, both as the chart is being read */
      if (state.drawn.stub){
        const [a0, a1, ls] = state.drawn.stub;
        const term = sc.open ? C(1) : C(-1);                   /* Gamma_z of open / short */
        const own = gOfZ(stubZ(ls, sc.open));
        if (Math.abs(angDiff(a0, arg([sign*term[0], sign*term[1]]))) > 1e-3 ||
            Math.abs(angDiff(a1, arg([sign*own[0], sign*own[1]]))) > 1e-3)
          bad(tag + ': stub arc does not run from its end to its own input', sc,
              JSON.stringify(state.drawn.stub));
      }
    };

    check('neutral', st, neutral, 1);
    if (st.drawn.stub) bad('neutral: a stub arc is drawn before any stub', sc);

    /* The check above holds the marker to whatever lengths the page started
       with, so a wrong "do nothing" length passes it: the marker is drawn
       faithfully on the open point. What the reader needs is stronger -- before
       anything is built, the marker is ON their point. (The double stub always
       has its fixed spacing in place, so its marker starts one spacing on; the
       transformer has no neutral section at all.) */
    if (sc.m === 'shunt' || sc.m === 'series' || sc.m === 'lnet'){
      if (!near(st.drawn.att, st.drawn.pt, 1e-4))
        bad('neutral: marker does not start on the point', sc,
            'att ' + JSON.stringify(st.drawn.att) + ' pt ' + JSON.stringify(st.drawn.pt));
    } else if (sc.m === 'dstub'){
      const gL = gOfZ(C(sc.r, sc.x)), want = rot(gL, -2*TAU*sc.dd);
      if (abs(want) <= 1.15 && !near(st.drawn.att, want, 1e-4))
        bad('neutral: marker does not start one spacing on', sc, JSON.stringify(st.drawn.att));
    }

    /* switching shorted/open twice must not move anything */
    if (sc.m !== 'qwt' && sc.m !== 'lnet'){
      const before = st.drawn.att;
      let s2 = await act([['click', 'b-term']]);
      const mid = s2.drawn.att;
      s2 = await act([['click', 'b-term']]);
      if (!near(before, mid, 1e-4)) bad('stub type switch moved the marker', sc,
            JSON.stringify(before) + ' -> ' + JSON.stringify(mid));
      if (!near(before, s2.drawn.att, 1e-4)) bad('switching back did not restore it', sc);
      st = s2;
    }

    /* the half turn, where the convention calls for one */
    let sign = 1;
    if (turns){
      if (!st.rotVisible){ bad('turn-to-y control missing', sc); continue; }
      st = await act([['click', 'b-rot']]);
      sign = -1;
      check('turned', st, neutral, sign);
      if (!st.steps[0]) bad('turning did not tick step 1', sc);
    } else if (st.rotVisible) bad('turn-to-y control shown where nothing turns', sc);

    /* travel */
    const vals = Object.assign({}, neutral, des);
    if (sc.m !== 'lnet' && sc.m !== 'dstub'){
      st = await act([['input', 'i-d', des.d]]);
      const tr = Object.assign({}, neutral, { d: st.d });
      check('travelled', st, tr, sign);
      /* the transformer has no admittance step in front, so travel is its first */
      if (!st.steps[sc.m === 'qwt' ? 0 : 1]) bad('reaching the target did not tick the travel step', sc, st.verdict);
    }

    /* first element halfway: the marker must already ride the target circle
       (single stubs) -- the projection the drag handles rely on */
    if (sc.m === 'shunt' || sc.m === 'series'){
      const zd = zOfG(rot(gOfZ(C(sc.r, sc.x)), -2*TAU*des.d));
      const left = (sc.m === 'shunt' ? inv(zd) : zd)[1];
      const half = stubFor(-left/2, sc.open, sc.m === 'shunt');
      st = await act([['input', 'p-l1', half]]);
      const hv = Object.assign({}, neutral, { d: des.d, l1: half });
      check('half stub', st, hv, sign);
      const zA = attemptZ(sc, hv);
      const re = (sc.m === 'shunt' ? inv(zA) : zA)[0];
      if (Math.abs(re - 1) > 1e-6) bad('half stub left the target circle', sc, 're=' + re);
    }

    /* finish */
    const fin = [];
    if (des.l1 != null) fin.push(['input', 'p-l1', des.l1]);
    if (des.l2 != null) fin.push(['input', 'p-l2', des.l2]);
    if (des.z1 != null) fin.push(['input', 'p-z1', des.z1]);
    if (des.x1 != null) fin.push(['input', 'p-x1', des.x1]);
    if (des.b1 != null) fin.push(['input', 'p-b1', des.b1]);
    st = await act(fin);
    check('finished', st, vals, sign);
    if (!st.ok) bad('finished design not accepted', sc, st.verdict);
    if (!st.steps.every(Boolean)) bad('finished, but a step is unticked', sc, JSON.stringify(st.steps));
    if (!(st.drawn.att && abs(st.drawn.att) < 0.01)) bad('finished, but the marker is not at the centre', sc,
          JSON.stringify(st.drawn.att));

    /* switching the stub type after finishing keeps it finished */
    if (sc.m === 'shunt' || sc.m === 'series' || sc.m === 'dstub'){
      const s3 = await act([['click', 'b-term']]);
      if (!s3.ok) bad('switching shorted/open undid a finished match', sc, s3.verdict);
      const back = await act([['click', 'b-term']]);
      if (!back.ok) bad('switching back undid it', sc);
    }

    /* turning back to z at the end: the centre is its own half turn */
    if (turns){
      const s4 = await act([['click', 'b-rot']]);
      if (!s4.ok || !s4.steps.every(Boolean)) bad('turning back after a match unticked something', sc,
            JSON.stringify(s4.steps));
    }
  }

  s.check('scenarios run', ran > 250, ran + ' run, ' + skipped + ' with no design (forbidden or degenerate)');
  const keys = ['neutral: marker does not start on the point',
    'neutral: marker does not start one spacing on',
    'neutral: attempt marker not where the built network puts it',
    'neutral: a stub arc is drawn before any stub',
    'stub type switch moved the marker', 'switching back did not restore it',
    'turn-to-y control missing', 'turn-to-y control shown where nothing turns',
    'turned: attempt marker not where the built network puts it',
    'turned: ring marks not at the drawn point', 'turned: point not at the travelled position',
    'turning did not tick step 1',
    'travelled: point not at the travelled position', 'travelled: ring marks not at the drawn point',
    'travelled: attempt marker not where the built network puts it',
    'reaching the target did not tick the travel step',
    'half stub: attempt marker not where the built network puts it', 'half stub left the target circle',
    'half stub: stub arc does not run from its end to its own input',
    'finished: attempt marker not where the built network puts it',
    'finished: stub arc does not run from its end to its own input',
    'finished design not accepted', 'finished, but a step is unticked',
    'finished, but the marker is not at the centre',
    'switching shorted/open undid a finished match', 'switching back undid it',
    'turning back after a match unticked something'];
  for (const k of Object.keys(fails)) if (!keys.includes(k)) keys.push(k);
  for (const k of keys){
    const f = fails[k] || [];
    s.check(k.replace(/^(\w[\w ]*): /, '$1 - '), f.length === 0,
            f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }

  /* ---- the solution picker beside the miniature circuit ----
     A second way to choose what the "show" buttons under the chart choose.
     Two ways to do one thing drift apart, so each must leave the page in the
     same state as the other, both must agree about which is chosen, and a
     stub design must travel to the crossing the theory gives. While
     practising it stays hidden until "show me", and after that, switching
     must carry the reader's fields with it: chart and fields showing two
     different designs is the bug this guards. */
  const pickFails = [];
  const pk = (m, why) => pickFails.push(m + ': ' + why);
  const setHash = (h) => p.evaluate(async ({ h, n }) => {
    await new Promise(res => {
      window.addEventListener('hashchange', () => setTimeout(res, 0), { once: true });
      location.hash = h + '&nonce=' + n;
    });
  }, { h, n: ++n });
  const pickState = () => p.evaluate(() => {
    const sel = document.getElementById('i-pick');
    const val = id => { const e = document.getElementById(id); return e ? parseFloat(e.value) : null; };
    return {
      shown: document.getElementById('row-pick').style.display !== 'none',
      opts: [...sel.options].map(o => o.textContent), value: sel.value,
      cards: document.querySelectorAll('#sols .sol').length,
      pressed: [...document.querySelectorAll('#sols [data-pick]')].map(b => b.getAttribute('aria-pressed') === 'true'),
      drawn: document.getElementById('chart').getAttribute('data-drawn'),
      d: val('i-d'), l1: val('p-l1'), l2: val('p-l2'), x1: val('p-x1'), b1: val('p-b1'), z1: val('p-z1'),
      ok: document.getElementById('prac-verdict').getAttribute('data-ok') === '1'
    };
  });
  const viaSelect = (i) => p.evaluate((i) => {
    const sel = document.getElementById('i-pick');
    sel.value = String(i); sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, i);
  const viaButton = (i) => p.evaluate((i) => document.querySelector('#sols [data-pick="' + i + '"]').click(), i);
  const DEF = [0.5, -0.6];                       /* 25 - j30 on 50 ohms */
  for (const m of ['shunt', 'series', 'qwt', 'lnet', 'dstub']){
    await setHash('r=' + DEF[0] + '&x=' + DEF[1] + '&method=' + m + '&practice=0&openStub=0&dd=0.125&ymode=point');
    let st = await pickState();
    if (!st.shown){ pk(m, 'picker hidden with ' + st.cards + ' solutions'); continue; }
    if (st.opts.length !== st.cards) pk(m, st.opts.length + ' options for ' + st.cards + ' solutions');
    const hits = (m === 'shunt' || m === 'series')
      ? travelHits(C(DEF[0], DEF[1]), m === 'shunt').slice().sort((a, b) => a - b) : null;
    for (let i = st.opts.length - 1; i >= 0; i--){
      await viaButton(i);
      const byButton = await pickState();
      if (byButton.value !== String(i)) pk(m, 'button ' + i + ' left the picker on ' + byButton.value);
      await viaButton((i + 1) % st.opts.length);
      await viaSelect(i);
      const bySelect = await pickState();
      if (!bySelect.pressed[i]) pk(m, 'picker ' + i + ' did not press the matching button');
      if (bySelect.drawn !== byButton.drawn) pk(m, 'picker ' + i + ' drew something other than button ' + i);
      if (Math.abs(bySelect.d - byButton.d) > 1e-12) pk(m, 'picker ' + i + ' travelled elsewhere');
      if (hits){
        const dTxt = parseFloat((bySelect.opts[i].match(/d ([\d.]+)/) || [])[1]);
        if (!(Math.abs(bySelect.d - hits[i]) < 6e-5)) pk(m, 'picker ' + i + ' at d=' + bySelect.d + ', theory ' + hits[i]);
        if (!(Math.abs(dTxt - hits[i]) < 6e-4)) pk(m, 'option ' + i + ' says d=' + dTxt + ', theory ' + hits[i]);
      }
    }
    /* practising: hidden until shown, then the fields follow the switch */
    await setHash('r=' + DEF[0] + '&x=' + DEF[1] + '&method=' + m + '&practice=1&d=0');
    st = await pickState();
    if (st.shown) pk(m, 'picker shown while practising, before "show me"');
    await p.evaluate(() => document.getElementById('b-prac-show').click());
    const fields = [];
    for (let i = 0; i < st.cards; i++){
      await viaSelect(i);
      const r = await pickState();
      if (!r.shown) pk(m, 'picker hidden after "show me"');
      if (!r.ok) pk(m, 'after "show me", picker ' + i + ' left a design that is not accepted');
      fields.push(JSON.stringify([r.d, r.l1, r.l2, r.x1, r.b1, r.z1]));
    }
    if (new Set(fields).size !== fields.length) pk(m, 'after "show me", switching left the fields unchanged');
    await p.evaluate(() => document.getElementById('b-prac-show').click());
  }
  s.check('solution picker agrees with the buttons and the theory', pickFails.length === 0,
          pickFails.slice(0, 3).join('  |  '));

  /* ---- what the slider alone can reach ----
     A reader who never drags travels in the slider's steps. At 0.001 lambda
     the nearest step to the crossing missed the 1% acceptance by itself for
     high-SWR loads (0.1 - j0.5 by 1.9%), so a reader could do everything
     right and never be accepted. Every load in the sweep must be reachable
     from the slider alone, assuming a perfect stub. */
  const tight = [];
  for (const [r, x] of LOADS){
    for (const shunt of [true, false]){
      for (const d of travelHits(C(r, x), shunt)){
        const dq = Math.round(d / STEP) * STEP;
        const zd = zOfG(rot(gOfZ(C(r, x)), -2*TAU*dq));
        const w = shunt ? inv(zd) : zd;
        const off = abs(add(shunt ? inv(C(w[0], 0)) : C(w[0], 0), C(-1)));   /* best a perfect stub can do */
        if (off > 0.01) tight.push((shunt ? 'shunt' : 'series') + ' r=' + r + ' x=' + x + ' (' + (off*100).toFixed(1) + '%)');
      }
    }
  }
  s.check('slider alone (step ' + STEP + ' lambda) reaches 1% for every load', tight.length === 0,
          tight.join(', '));

  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
}

main().catch(e => { console.error(e); process.exit(1); });
