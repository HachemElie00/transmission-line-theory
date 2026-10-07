/* The animated construction in the workbench, instant by instant.

   construction.test.js holds the FINISHED solved drawing against the theory.
   This file holds everything before it:

   - the finished frame of the animation is the static solved view, exactly:
     data-drawn identical, and the canvas identical pixel for pixel;
   - the steps are the ones chapter 11 lists for that method, convention and
     design, in that order (a zero element, or a load already where the
     travel would take it, is no step);
   - at the end of every step, the marks of the steps done are exactly the
     finished drawing's marks, and the marks of the steps to come are absent;
   - half way through every step, what is drawn is where the theory puts it:
     the half turn rides the point's own circle clockwise with the diameter
     drawn as far as it has got, a travel stands at zin(zL, d/2), a stub arc
     has grown half its length, an element's move has covered half its path;
   - each step's caption carries the theory's numbers;
   - the controls reach every step, play stops after one step, the double
     arrow plays them all, speed scales the clock, pausing stops mid-step,
     reduced motion shows each step whole, anything that changes the design
     turns the animation off while zoom does not, the strip is hidden exactly
     when no solution is drawn, and chart plus strip fit the window, in full
     screen too, with nothing overflowing on a phone.

   Every expected position is computed here from lib/tline.js (tangent
   formula, bisection) and textbook circle geometry. The page publishes each
   instant as data-drawn; window.animSeek(t) sets the animation clock (null
   puts the static view back).

   Run:  node tests/animation.test.js                (~4 min)
         TLT_QUICK=1 node tests/animation.test.js    (three loads, ~1 min) */

const H = require('./lib/harness');
const T = require('./lib/tline');
const TAU = 2*Math.PI;

const gam = z => { const g = T.div(T.add(z, T.C(-1, 0)), T.add(z, T.C(1, 0))); return [g.re, g.im]; };
const neg = p => [-p[0], -p[1]];
const sc  = (k, p) => [k*p[0], k*p[1]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rot = (p, a) => [p[0]*Math.cos(a) - p[1]*Math.sin(a), p[0]*Math.sin(a) + p[1]*Math.cos(a)];
const TOL = 2e-5;                                      /* data-drawn is rounded to 1e-6 */
const angMod = a => ((a % TAU) + TAU) % TAU;
const sameAng = (a, b) => { const d = Math.abs(angMod(a) - angMod(b)); return Math.min(d, TAU - d) < 1e-4; };
const Z0 = 50;

/* numbers in a caption: every one, with how many decimals it was printed to */
const numsIn = s => { const out = [];
  String(s).replace(/−/g, '-').replace(/-?\d+(?:\.(\d+))?/g, (m, dec) => { out.push([parseFloat(m), dec ? dec.length : 0]); return m; });
  return out; };
const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
/* the caption prints the value (to whatever precision it chose, at least nd) */
const says = (cap, v, nd) => numsIn(cap).some(([x, k]) => k >= (nd || 0) && printedOk(x, v, k));
/* the caption prints the complex number re + j im */
const saysCpx = (cap, re, im) => {
  const re2 = /(-?\d+\.\d+)\s*([+-])\s*j(\d+\.\d+)/g, s = String(cap).replace(/−/g, '-');
  let m;
  while ((m = re2.exec(s))){
    const a = parseFloat(m[1]), b = (m[2] === '-' ? -1 : 1)*parseFloat(m[3]), nd = m[1].split('.')[1].length;
    if (printedOk(a, re, nd) && printedOk(b, im, nd)) return true;
  }
  return false;
};
const sig = v => { const a = Math.abs(v); return a >= 10 ? 1 : a >= 1 ? 2 : 3; };   /* decimals sig() prints */

/* the leading fraction s of a polyline by index, as a reader would measure it */
function leadEnd(pts, s){
  const n = pts.length - 1, x = s*n, i = Math.floor(x), f = x - i;
  if (i >= n) return pts[n];
  return [pts[i][0] + (pts[i+1][0] - pts[i][0])*f, pts[i][1] + (pts[i+1][1] - pts[i][1])*f];
}

(async () => {
  const s = H.suite('animation');
  const srv = await H.serve(H.SITE);
  const b = await H.launch();

  /* =============== every step of every design, against the theory =============== */
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1150 } });
  /* CPU canvases from the first paint, so two renders can be compared pixel
     for pixel (see toggles.test.js) */
  await ctx.addInitScript(() => {
    const g = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(t, o){
      return g.call(this, t, t === '2d' ? Object.assign({ willReadFrequently: true }, o) : o); };
  });
  const p = await ctx.newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
  await p.waitForTimeout(2200);

  let nonce = 0;
  const setup = (st) => p.evaluate(async ({ st, n }) => {
    const h = 'r=' + st.r + '&x=' + st.x + '&z0=50&f=1000&ee=1&practice=0&openStub=' +
              (st.open ? 1 : 0) + '&ymode=' + st.ymode + '&dd=' + (st.dd || 0.125) + '&nonce=' + n;
    /* a pending debounced replaceState can land between the assignment and
       the hashchange event: retry until the URL carries this case's nonce */
    for (let k = 0; k < 5; k++){
      await new Promise(res => { window.addEventListener('hashchange', () => setTimeout(res, 0), { once: true });
                                 location.hash = h; });
      if (location.hash.indexOf('nonce=' + n) >= 0) break;
    }
    const sel = document.getElementById('i-method');
    sel.value = st.m; sel.dispatchEvent(new Event('change', { bubbles: true }));
    return document.querySelectorAll('#sols [data-pick]').length;
  }, { st, n: ++nonce });

  /* Pick design i, then read the static view, every integer instant and
     every half-way instant, and the static view again. With `pixels`, also
     hash the canvas for the static view and the finished frame. */
  const frames = (i, pixels) => p.evaluate(({ i, pixels }) => {
    document.querySelector('#sols [data-pick="' + i + '"]').click();
    const cv = document.getElementById('chart');
    const read = () => JSON.parse(cv.getAttribute('data-drawn') || '{}');
    const hash = () => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let h = 2166136261; for (let k = 0; k < d.length; k += 4){ h ^= d[k]; h = Math.imul(h, 16777619); h ^= d[k+1]; h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(16); };
    const card = {};
    const sol = document.querySelectorAll('#sols .sol')[i];
    sol.querySelectorAll('dt').forEach(dt => { card[dt.textContent] = dt.nextElementSibling.textContent; });
    window.animSeek(null);
    const stat = read(), hStat = pixels ? hash() : null;
    if (!window.animSeek(1e9)) return { card, stat, none: true };
    const N = read().anim.ids.length, at = {}, mid = {};
    for (let k = 0; k <= N; k++){ window.animSeek(k); at[k] = read(); }
    for (let k = 0; k < N; k++){ window.animSeek(k + 0.5); mid[k] = read(); }
    window.animSeek(N);
    const hEnd = pixels ? hash() : null;
    window.animSeek(0.5);
    const hMid = pixels ? hash() : null;
    window.animSeek(null);
    const stat2 = read();
    return { card, stat, stat2, at, mid, N, hStat, hEnd, hMid };
  }, { i, pixels });

  const fails = {}, counted = {};
  const bad = (key, tag, list) => { if (list.length) (fails[key] = fails[key] || []).push(tag + ': ' + list[0]); };
  const count = k => { counted[k] = (counted[k] || 0) + 1; };
  const strip = D => { const c = JSON.parse(JSON.stringify(D)); delete c.anim; return c; };
  const pathOf = (D, tag) => (D.paths || []).find(q => q.tag === tag);
  const firstNum = t => { const m = String(t).replace(/−/g, '-').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
  let pixelCases = 0;

  /* Which marks belong to which step: a path tag, the stub arc, the double
     stub's two circles, a half turn (by its position in the list). */
  function owners(ids, m, sf){
    const own = { paths: {}, stub: null, circles: {}, turns: [] };
    ids.forEach((id, k) => {
      if (id === 'travel') own.paths.travel = k;
      if (id === 'tocentre') own.paths.stub = k;
      if (id === 'stubarc' || id === 'stub2arc'){ own.stub = k; own.paths['stub circle'] = k; }
      if (id === 'xfmr') own.paths.transformer = k;
      if (id === 'stub1') own.paths['stub 1'] = k;
      if (id === 'spacing') own.paths.spacing = k;
      if (id === 'stub2') own.paths['stub 2'] = k;
      if (id === 'el1') own.paths[sf ? 'series' : 'shunt'] = k;
      if (id === 'el2') own.paths[sf ? 'shunt' : 'series'] = k;
      if (id === 'target'){ own.circles.forbidden = k; own.circles['g = 1 rotated back'] = k; }
      if (id === 'turn' || id === 'turn1' || id === 'turn2') own.turns.push(k);
    });
    return own;
  }

  /* The checks common to every design: the finished frame, the static view
     restored, and at each step's end exactly the marks of the steps done. */
  function common(t, F, ids, wantIds, own, pixels){
    bad('steps', t, JSON.stringify(ids) === JSON.stringify(wantIds) ? [] : ['steps ' + ids + ', want ' + wantIds]);
    bad('finished frame is the static view', t,
        JSON.stringify(strip(F.at[F.N])) === JSON.stringify(F.stat) ? [] : ['data-drawn differs']);
    bad('static view restored', t, JSON.stringify(F.stat2) === JSON.stringify(F.stat) ? [] : ['data-drawn differs after animSeek(null)']);
    if (pixels){
      pixelCases++;
      bad('finished frame pixels', t, F.hEnd === F.hStat ? [] : ['canvas ' + F.hEnd + ', static ' + F.hStat]);
      bad('mid frame is not the static view', t, F.hMid !== F.hStat ? [] : ['t = 0.5 renders the finished chart']);
    }
    for (let k = 0; k <= F.N; k++){
      const D = F.at[k];
      bad('step published', t, (D.anim && D.anim.step === k && D.anim.s === 1 && D.anim.t === k) ? [] : ['at ' + k + ': ' + JSON.stringify(D.anim)]);
      for (const tag of Object.keys(own.paths)){
        const want = own.paths[tag] < k ? pathOf(F.stat, tag) : undefined;
        const got = pathOf(D, tag);
        bad('marks of the steps done, and only them', t,
            JSON.stringify(got) === JSON.stringify(want) ? [] : ['after step ' + k + ' path "' + tag + '" ' + (got ? 'drawn' : 'missing') + (want ? '' : ' (not due)')]);
      }
      if (own.stub != null){
        const want = own.stub < k ? F.stat.stub : undefined;
        bad('marks of the steps done, and only them', t, JSON.stringify(D.stub) === JSON.stringify(want) ? [] : ['after step ' + k + ' stub arc ' + JSON.stringify(D.stub)]);
        bad('marks of the steps done, and only them', t, (own.stub < k ? D.stubTxt === F.stat.stubTxt : D.stubTxt === undefined) ? [] : ['after step ' + k + ' stub label ' + D.stubTxt]);
      }
      for (const tag of Object.keys(own.circles)){
        const n = (D.circles || []).filter(c => c.tag === tag).length;
        bad('marks of the steps done, and only them', t, n === (own.circles[tag] < k ? 1 : 0) ? [] : ['after step ' + k + ' circle "' + tag + '" x' + n]);
      }
      const nT = own.turns.filter(j => j < k).length;
      bad('marks of the steps done, and only them', t,
          JSON.stringify(D.turns || []) === JSON.stringify((F.stat.turns || []).slice(0, nT)) ? [] : ['after step ' + k + ' turns ' + JSON.stringify(D.turns)]);
      bad('no pen at rest', t, D.pen === undefined ? [] : ['a turning point drawn after step ' + k]);
    }
    /* half way: the published step and fraction */
    for (let k = 0; k < F.N; k++){
      const A = F.mid[k].anim;
      bad('step published', t, (A && A.step === k + 1 && Math.abs(A.s - 0.5) < 1e-9) ? [] : ['at ' + (k + 0.5) + ': ' + JSON.stringify(A)]);
    }
  }

  /* half way through a move along an element circle: the path drawn is the
     leading half of the finished one, and it still starts where it should */
  function halfMove(t, F, k, tag){
    const full = pathOf(F.stat, tag), got = pathOf(F.mid[k], tag);
    if (!full) return bad('half way', t, [tag + ' missing from the finished frame']);
    if (!got) return bad('half way', t, [tag + ' not drawn half way through its step']);
    const end = got.pts[got.pts.length - 1], want = leadEnd(full.pts, 0.5);
    bad('half way', t, (dist(got.pts[0], full.pts[0]) < TOL && dist(end, want) < TOL) ? [] :
        [tag + ' half way ends at ' + end + ', want ' + want.map(v => v.toFixed(5))]);
  }
  /* half way through a half turn from g (display): the diameter to the
     centre, and the point a quarter turn round clockwise */
  function halfTurn(t, D, g, pt, label){
    const tr = (D.turns || [])[(D.turns || []).length - 1];
    bad('half way', t, (tr && dist(tr[0], g) < TOL && dist(tr[1], [0, 0]) < TOL) ? [] : [label + ' diameter ' + JSON.stringify(tr)]);
    const want = rot(g, -Math.PI/2);
    bad('half way', t, (pt && dist(pt, want) < TOL) ? [] : [label + ' point at ' + pt + ', want ' + want.map(v => v.toFixed(5))]);
  }
  const capAt = (F, k) => (F.at[k].anim.cap || '').replace(/ /g, ' ');
  const capBad = (t, F, k, checks) => {
    const c = capAt(F, k);
    const miss = checks.filter(([kind, a, b2, c2]) => kind === 'num' ? !says(c, a, b2) : kind === 'cpx' ? !saysCpx(c, a, b2) : !c.includes(a));
    bad('captions', t, miss.length ? ['step ' + k + ' "' + c + '" lacks ' + JSON.stringify(miss[0])] : []);
  };

  /* TLT_QUICK=1: three loads only, for mutation runs (see the header) */
  /* 0.5 + j0.5 is on g = 1 (a shunt stub needs no travel), 0.2 is real (nor
     does the transformer), 0.25 - j0.25 is on the lambda/8 forbidden boundary */
  const LOADS = process.env.TLT_QUICK ? [[0.5, -0.6], [2, 1.4], [0.25, -0.25], [0.5, 0.5], [0.2, 0]]
                                      : T.LOADS.concat([[1, 0.8], [0.5, 0.5], [0.05, 0.3]]);
  let first = {};
  for (const [r, x] of LOADS){
    const zL = T.C(r, x), gL = gam(zL), yL = T.invc(zL), mL = Math.hypot(gL[0], gL[1]);
    const baseChecks = [['cpx', r, x], ['num', mL, 3]];
    const pix = key => { if (first[key]) return false; first[key] = 1; return true; };

    /* ---------- single stubs ---------- */
    for (const m of ['shunt', 'series']) for (const open of [false, true]) for (const ymode of ['point', 'grid']){
      const series = m === 'series';
      const des = series ? T.series(zL, open) : T.shunt(zL, open);
      const n = await setup({ r, x, m, open, ymode });
      const tag = m + ' ' + r + (x < 0 ? '' : '+') + x + 'j ' + (open ? 'open' : 'short') + ' ' + ymode;
      if (n !== des.length){ bad('solution count', tag, [n + ' solutions, theory ' + des.length]); continue; }
      const sign = (!series && ymode === 'point') ? -1 : 1;
      for (let i = 0; i < des.length; i++){
        const d = des[i], t = tag + ' #' + (i+1);
        const px = pix(m + ymode), F = await frames(i, px);
        if (F.none){ bad('steps', t, ['no animation for a drawn solution']); continue; }
        count(m);
        const wantIds = [].concat(sign < 0 ? ['turn'] : [], d.d > 5e-4 ? ['travel'] : [], ['stubarc', 'tocentre']);
        const ids = F.at[F.N].anim.ids;
        common(t, F, ids, wantIds, owners(ids, m), px);
        if (JSON.stringify(ids) !== JSON.stringify(wantIds)) continue;     /* failed above; nothing below can be located */
        const ti = ids.indexOf('turn'), vi = ids.indexOf('travel'), ai = ids.indexOf('stubarc'), ci = ids.indexOf('tocentre');
        const gd = gam(T.zin(zL, d.d));
        /* before anything: the load, unturned */
        bad('start', t, (dist(F.at[0].pt, gL) < TOL && sameAng(F.at[0].ring[0], Math.atan2(gL[1], gL[0])) &&
            sameAng(F.at[0].ring[1], Math.atan2(gL[1], gL[0]))) ? [] : ['point at ' + F.at[0].pt]);
        const left0 = (!series && ymode === 'grid') ? 'y → ∞' : 'short';     /* nothing turned yet */
        bad('start', t, F.at[0].words.left === left0 ? [] : ['left end reads ' + F.at[0].words.left + ' before any turn']);
        capBad(t, F, 0, baseChecks);
        if (ti >= 0){
          halfTurn(t, F.mid[ti], gL, F.mid[ti].pt, 'view turn');
          bad('half way', t, (sameAng(F.mid[ti].ring[0], F.mid[ti].ring[1]) &&
              sameAng(F.mid[ti].ring[1], Math.atan2(F.mid[ti].pt[1], F.mid[ti].pt[0]))) ? [] : ['ring marks ' + F.mid[ti].ring]);
          bad('after the turn', t, (dist(F.at[ti + 1].pt, neg(gL)) < TOL && F.at[ti + 1].words.left === 'open') ? [] :
              ['point at ' + F.at[ti + 1].pt + ', left end ' + F.at[ti + 1].words.left]);
          capBad(t, F, ti + 1, [['cpx', yL.re, yL.im], ['text', 'read as g']]);
        }
        if (vi >= 0){
          const want = sc(sign, gam(T.zin(zL, d.d/2))), D = F.mid[vi], tp = pathOf(D, 'travel');
          bad('half way', t, dist(D.pt, want) < TOL ? [] : ['travel point at ' + D.pt + ', want ' + want.map(v => v.toFixed(5))]);
          bad('half way', t, (tp && dist(tp.pts[0], sc(sign, gL)) < TOL && dist(tp.pts[tp.pts.length - 1], want) < TOL) ? [] : ['travel path ' + (tp ? tp.pts[tp.pts.length - 1] : 'missing')]);
          bad('half way', t, (sameAng(D.ring[0], Math.atan2(sign*gL[1], sign*gL[0])) && sameAng(D.ring[1], Math.atan2(want[1], want[0]))) ? [] : ['ring marks ' + D.ring]);
          capBad(t, F, vi + 1, [['num', d.d, 3], ['cpx', 1, -d.need],
              ['text', series ? 'r = 1 circle' : ymode === 'point' ? 'circle marked r = 1, read as g = 1' : 'g = 1 circle']]);
        }
        /* after the travel, the point stays at the stub while the stub is sized and added */
        for (const k of [ai, ci]) bad('point after the travel', t, dist(F.at[k + 1].pt, sc(sign, gd)) < TOL ? [] : ['at ' + F.at[k + 1].pt]);
        {
          const D = F.mid[ai];
          bad('half way', t, (D.stub && Math.abs(D.stub[2] - d.ls/2) < 1e-5 && Math.abs((D.stub[0] - D.stub[1]) - TAU*d.ls) < 1e-5 &&
              !pathOf(D, 'stub circle') && D.stubTxt === undefined) ? [] : ['stub arc ' + JSON.stringify(D.stub)]);
          capBad(t, F, ai + 1, [['num', d.ls, 3], ['num', d.need, 2], ['text', open ? 'from the open' : 'from the short']]);
        }
        halfMove(t, F, ci, 'stub');
        capBad(t, F, ci + 1, [['text', 'to the centre'], ['text', 'matched']]);
      }
    }

    /* ---------- quarter-wave transformer ---------- */
    {
      const ds = T.roots(dd => T.zin(zL, dd).im, 0, 0.5, 40000)
        .concat(T.roots(dd => T.yin(zL, dd).im, 0, 0.5, 40000)).sort((a, c) => a - c)
        .filter((v, i, a) => i === 0 || v - a[i-1] > 1e-6);
      const des = ds.map(dd => { const zr = T.zin(zL, dd); return { d: dd, zr: zr.re, z1: Math.sqrt(zr.re) }; });
      for (const ymode of ['point', 'grid']){
        const n = await setup({ r, x, m: 'qwt', ymode });
        const tag = 'qwt ' + r + (x < 0 ? '' : '+') + x + 'j ' + ymode;
        if (n !== des.length){ bad('solution count', tag, [n + ' solutions, theory ' + des.length]); continue; }
        for (let i = 0; i < des.length; i++){
          const d = des[i], t = tag + ' #' + (i+1);
          const px = pix('qwt' + ymode), F = await frames(i, px);
          if (F.none){ bad('steps', t, ['no animation']); continue; }
          count('qwt');
          const ids = F.at[F.N].anim.ids;
          const wantQ = [].concat(d.d > 5e-4 ? ['travel'] : [], ['xfmr']);
          common(t, F, ids, wantQ, owners(ids, 'qwt'), px);
          if (JSON.stringify(ids) !== JSON.stringify(wantQ)) continue;
          const vi = ids.indexOf('travel'), xi = ids.indexOf('xfmr'), gd = gam(T.zin(zL, d.d));
          capBad(t, F, 0, baseChecks);
          if (vi >= 0){
            const want = gam(T.zin(zL, d.d/2));
            bad('half way', t, dist(F.mid[vi].pt, want) < TOL ? [] : ['travel point at ' + F.mid[vi].pt]);
            capBad(t, F, vi + 1, [['num', d.d, 3], ['num', d.zr, sig(d.zr)], ['num', d.zr*Z0, sig(d.zr*Z0)],
                ['text', 'voltage ' + (d.zr < 1 ? 'minimum' : 'maximum')]]);
          }
          const tp = pathOf(F.mid[xi], 'transformer');
          bad('half way', t, (tp && dist(tp.pts[0], gd) < TOL && dist(tp.pts[1], sc(0.5, gd)) < TOL) ? [] : ['transformer ' + JSON.stringify(tp)]);
          capBad(t, F, xi + 1, [['num', d.z1*Z0, sig(d.z1*Z0)]]);
        }
      }
    }

    /* ---------- L-network ---------- */
    for (const ymode of ['point', 'grid']){
      const des = [];
      T.lnet(zL).forEach(d => {
        if (Math.abs(d.xs) < 1e-7) d.xs = 0;
        if (Math.abs(d.bp) < 1e-7) d.bp = 0;
        if (!des.some(e => Math.abs(e.xs - d.xs) < 1e-6*(1 + Math.abs(d.xs)) &&
                           Math.abs(e.bp - d.bp) < 1e-6*(1 + Math.abs(d.bp)))) des.push(d);
      });
      const n = await setup({ r, x, m: 'lnet', ymode });
      const tag = 'lnet ' + r + (x < 0 ? '' : '+') + x + 'j ' + ymode;
      if (n !== des.length){ bad('solution count', tag, [n + ' solutions, theory ' + des.length]); continue; }
      const onZ = ymode === 'point', used = new Set();
      for (let i = 0; i < des.length; i++){
        const px = pix('lnet' + ymode), F = await frames(i, px), t = tag + ' #' + (i+1);
        if (F.none){ bad('steps', t, ['no animation']); continue; }
        const xsP = firstNum(F.card['series x']), bpP = firstNum(F.card['shunt b']);
        let k = -1, best = Infinity;
        des.forEach((d, j) => { const e = Math.abs(d.xs - xsP) + Math.abs(d.bp - bpP);
          if (!used.has(j) && e < best){ best = e; k = j; } });
        if (k < 0 || best > 1.2e-3){ bad('card', t, ['no theory design for ' + JSON.stringify(F.card)]); continue; }
        used.add(k);
        count('lnet');
        const d = des[k], sf = d.order === 'series first', hasS = d.xs !== 0, hasP = d.bp !== 0;
        const ids = F.at[F.N].anim.ids;
        const wantIds = sf ? [].concat(hasS ? ['el1'] : [], onZ && hasP ? ['turn2'] : [], hasP ? ['el2'] : [])
                           : [].concat(onZ && hasP ? ['turn1'] : [], hasP ? ['el1'] : [], onZ && hasP && hasS ? ['turn2'] : [], hasS ? ['el2'] : []);
        common(t, F, ids, wantIds, owners(ids, 'lnet', sf), px);
        if (JSON.stringify(ids) !== JSON.stringify(wantIds)) continue;
        capBad(t, F, 0, baseChecks);
        const e1 = ids.indexOf('el1'), e2 = ids.indexOf('el2'), t1 = ids.indexOf('turn1'), t2 = ids.indexOf('turn2');
        if (sf){
          const midZ = T.add(zL, T.C(0, d.xs)), gm = gam(midZ), yM = T.invc(midZ);
          if (e1 >= 0){ halfMove(t, F, e1, 'series');
            capBad(t, F, e1 + 1, [['num', d.xs, 2]].concat(hasP ? [['cpx', midZ.re, midZ.im]] : [])); }
          if (t2 >= 0){ halfTurn(t, F.mid[t2], gm, F.mid[t2].pen, 'turn');
            capBad(t, F, t2 + 1, [['cpx', yM.re, yM.im]]); }
          if (e2 >= 0){ halfMove(t, F, e2, 'shunt'); capBad(t, F, e2 + 1, [['num', d.bp, 2]]); }
        } else {
          const yM = T.add(yL, T.C(0, d.bp)), midZ = T.invc(yM), gm = gam(midZ);
          if (t1 >= 0){ halfTurn(t, F.mid[t1], gL, F.mid[t1].pen, 'turn to y');
            capBad(t, F, t1 + 1, [['cpx', yL.re, yL.im]]); }
          if (e1 >= 0){ halfMove(t, F, e1, 'shunt');
            capBad(t, F, e1 + 1, [['num', d.bp, 2]].concat(hasS ? [['cpx', yM.re, yM.im]] : [])); }
          if (t2 >= 0){ halfTurn(t, F.mid[t2], neg(gm), F.mid[t2].pen, 'turn back');
            capBad(t, F, t2 + 1, [['cpx', midZ.re, midZ.im]]); }
          if (e2 >= 0){ halfMove(t, F, e2, 'series'); capBad(t, F, e2 + 1, [['num', d.xs, 2]]); }
        }
        /* the L-network's own view never turns: the marker stays on the load */
        for (let j = 0; j <= F.N; j++) bad('marker stays on the load', t, dist(F.at[j].pt, gL) < TOL ? [] : ['at step ' + j + ': ' + F.at[j].pt]);
      }
    }

    /* ---------- double stub ---------- */
    for (const open of [false, true]) for (const ymode of ['point', 'grid']){
      const dd = 0.125, des = T.dstub(zL, dd, open);
      const n = await setup({ r, x, m: 'dstub', open, ymode, dd });
      const tag = 'dstub ' + r + (x < 0 ? '' : '+') + x + 'j ' + (open ? 'open' : 'short') + ' ' + ymode;
      const tt = Math.tan(TAU*dd), gmax = (1 + tt*tt)/(tt*tt);
      /* exactly on the forbidden boundary the two designs merge into a double
         root, which no sign change brackets: there 1 - t b = 0 just after
         stub 1, so b1 = 1/t - b_L (as in construction.test.js) */
      if (!des.length && Math.abs(yL.re - gmax) < 1e-9){
        const b1 = 1/tt - yL.im;
        const b2 = -T.invc(T.zin(T.invc(T.add(yL, T.C(0, b1))), dd)).im;
        des.push({ b1, b2, ls1: T.findStub(b1, open, false), ls2: T.findStub(b2, open, false) });
      }
      if (!des.length){ bad('solution count', tag, n ? [n + ' solutions, theory none'] : []); continue; }
      if (n !== des.length){ bad('solution count', tag, [n + ' solutions, theory ' + des.length]); continue; }
      const sign = ymode === 'point' ? -1 : 1, used = new Set();
      for (let i = 0; i < des.length; i++){
        const px = pix('dstub' + ymode), F = await frames(i, px), t = tag + ' #' + (i+1);
        if (F.none){ bad('steps', t, ['no animation']); continue; }
        const b1P = firstNum(F.card['stub 1 gives'].replace(/^b = /, ''));
        let k = -1, best = Infinity;
        des.forEach((d, j) => { if (!used.has(j) && Math.abs(d.b1 - b1P) < best){ best = Math.abs(d.b1 - b1P); k = j; } });
        if (best > 6e-4*Math.max(1, Math.abs(b1P))){ bad('card', t, ['no theory design for ' + JSON.stringify(F.card)]); continue; }
        used.add(k);
        count('dstub');
        const d = des[k];
        const ids = F.at[F.N].anim.ids;
        const wantD = [].concat(sign < 0 ? ['turn'] : [], ['target', 'stub1', 'spacing', 'stub2arc', 'stub2']);
        common(t, F, ids, wantD, owners(ids, 'dstub'), px);
        if (JSON.stringify(ids) !== JSON.stringify(wantD)) continue;
        const ti = ids.indexOf('turn'), gi = ids.indexOf('target'), s1 = ids.indexOf('stub1'), sp = ids.indexOf('spacing');
        const a2 = ids.indexOf('stub2arc'), s2 = ids.indexOf('stub2');
        const yA = T.add(yL, T.C(0, d.b1)), gA = gam(T.invc(yA));
        const yB = T.invc(T.zin(T.invc(yA), dd));
        capBad(t, F, 0, baseChecks);
        if (ti >= 0){ halfTurn(t, F.mid[ti], gL, F.mid[ti].pt, 'view turn'); capBad(t, F, ti + 1, [['cpx', yL.re, yL.im]]); }
        capBad(t, F, gi + 1, [['num', dd, 3], ['num', 720*dd, 1], ['num', gmax, 2]]);
        halfMove(t, F, s1, 'stub 1');
        capBad(t, F, s1 + 1, [['num', d.b1, 2], ['num', d.ls1, 3], ['num', yL.re, 2], ['cpx', yA.re, yA.im]]);
        {
          const want = sc(sign, gam(T.zin(T.invc(yA), dd/2))), sp2 = pathOf(F.mid[sp], 'spacing');
          bad('half way', t, (sp2 && dist(sp2.pts[0], sc(sign, gA)) < TOL && dist(sp2.pts[sp2.pts.length - 1], want) < TOL) ? [] :
              ['spacing ends at ' + (sp2 ? sp2.pts[sp2.pts.length - 1] : 'nothing') + ', want ' + want.map(v => v.toFixed(5))]);
          capBad(t, F, sp + 1, [['num', dd, 3], ['cpx', yB.re, yB.im]]);
        }
        {
          const D = F.mid[a2];
          bad('half way', t, (D.stub && Math.abs(D.stub[2] - d.ls2/2) < 1e-5 && !pathOf(D, 'stub circle')) ? [] : ['stub 2 arc ' + JSON.stringify(D.stub)]);
          capBad(t, F, a2 + 1, [['num', d.ls2, 3], ['num', d.b2, 2]]);
        }
        halfMove(t, F, s2, 'stub 2');
        capBad(t, F, s2 + 1, [['num', d.b2, 2], ['text', 'matched']]);
        /* the target circles fade in during their step: present half way */
        bad('half way', t, (F.mid[gi].circles || []).some(c => c.tag === 'forbidden') ? [] : ['no forbidden circle half way through the target step']);
      }
    }
  }

  const total = Object.values(counted).reduce((a, c) => a + c, 0);
  s.note(total + ' designs: ' + Object.entries(counted).map(([k, v]) => k + ' ' + v).join(', ') + '; ' + pixelCases + ' compared pixel for pixel');
  for (const key of ['solution count', 'card', 'steps', 'step published', 'finished frame is the static view',
                     'static view restored', 'finished frame pixels', 'mid frame is not the static view',
                     'marks of the steps done, and only them', 'no pen at rest', 'start', 'after the turn',
                     'point after the travel', 'marker stays on the load', 'half way', 'captions']){
    const f = fails[key] || [];
    f.slice(0, 3).forEach(x => s.note('FAIL ' + key + ': ' + x));
    s.check(key, f.length === 0, f.length ? f.length + ' cases' : '');
  }
  s.check('no page errors (steps)', errs.length === 0, errs.slice(0, 2).join(' '));
  await ctx.close();

  /* =============== the controls =============== */
  const anim = pg => pg.evaluate(() => (JSON.parse(document.getElementById('chart').getAttribute('data-drawn') || '{}').anim) || null);
  const click = (pg, id) => pg.evaluate(id => document.getElementById(id).click(), id);
  const until = async (pg, fn, ms) => { const t0 = Date.now();
    while (Date.now() - t0 < (ms || 15000)){ const a = await anim(pg); if (fn(a)) return a; await pg.waitForTimeout(30); }
    return await anim(pg); };
  /* through a blank page: a URL differing only in its hash would not reload,
     and the last case's state (practice mode, say) would carry over */
  const openTool = async (pg, hash) => {
    await pg.goto('about:blank');
    await pg.goto(srv.url + 'smith-tool.html' + (hash ? '#' + hash : ''), { waitUntil: 'load' });
    await pg.waitForTimeout(1800);
  };
  const pickMethod = (pg, m) => pg.evaluate(m => { const s = document.getElementById('i-method');
    s.value = m; s.dispatchEvent(new Event('change', { bubbles: true })); }, m);
  {
    const c2 = await b.newContext({ viewport: { width: 1400, height: 900 } });
    const q = await c2.newPage();
    const e2 = H.watchErrors(q);
    await openTool(q);
    const vis = () => q.evaluate(() => !document.getElementById('anim').hidden);
    s.check('strip hidden with no method', !(await vis()));
    await pickMethod(q, 'shunt'); await q.waitForTimeout(200);
    s.check('strip shown when a solution is drawn, animation off', (await vis()) && (await anim(q)) === null);

    /* chart and strip on screen together, below the masthead */
    const fit = await q.evaluate(() => {
      const c = document.getElementById('chart'); window.scrollTo(0, window.scrollY + c.getBoundingClientRect().top - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mast-h')) || 0));
      const a = document.getElementById('anim').getBoundingClientRect(), r = c.getBoundingClientRect();
      return { top: r.top, bottom: a.bottom, h: innerHeight, under: Math.abs(a.top - r.bottom) < 1.5 };
    });
    s.check('1400x900: chart and strip fit the window, strip directly under the chart', fit.bottom <= fit.h + 0.5 && fit.under, JSON.stringify(fit));

    await click(q, 'a-start');
    let a = await anim(q);
    s.check('start: step 0, the load alone', a && a.step === 0 && a.t === 0, JSON.stringify(a));
    const N = a.ids.length, seen = [0];
    for (let k = 0; k < N; k++){ await click(q, 'a-next'); seen.push((await anim(q)).step); }
    s.check('next reaches every step in order', JSON.stringify(seen) === JSON.stringify([...Array(N + 1).keys()]), seen.join(','));
    s.check('next is disabled at the last step', await q.evaluate(() => document.getElementById('a-next').disabled));
    await click(q, 'a-back'); a = await anim(q);
    s.check('back goes back one step', a.step === N - 1 && a.t === N - 1, JSON.stringify(a));
    await click(q, 'a-start'); await click(q, 'a-back');
    s.check('back is disabled at the start, and stays at 0', (await anim(q)).t === 0 && await q.evaluate(() => document.getElementById('a-back').disabled));

    /* play: one step, then stop on it */
    await click(q, 'a-play');
    const moving = await until(q, x => x && x.playing && x.s > 0.05 && x.s < 0.95, 4000);
    s.check('play animates the step (part-drawn frames)', moving && moving.playing && moving.s > 0 && moving.s < 1, JSON.stringify(moving));
    const t0 = Date.now();
    a = await until(q, x => x && !x.playing);
    const oneStep = Date.now() - t0;
    s.check('play stops after one step', a.step === 1 && a.t === 1, JSON.stringify(a));
    /* pause mid-step */
    await click(q, 'a-play'); await until(q, x => x && x.playing && x.t > 1.2, 4000);
    await click(q, 'a-play'); await q.waitForTimeout(250);
    const p1 = await anim(q); await q.waitForTimeout(400); const p2 = await anim(q);
    s.check('pressing it again pauses mid-step', !p1.playing && p1.t > 1 && p1.t < 2 && p2.t === p1.t, JSON.stringify(p1));
    await click(q, 'a-play'); a = await until(q, x => x && !x.playing);
    s.check('play from a pause finishes that step', a.t === 2, JSON.stringify(a));
    /* speed: twice as fast */
    await q.evaluate(() => { const e = document.getElementById('a-speed'); e.value = '2'; e.dispatchEvent(new Event('change')); });
    await click(q, 'a-start'); await click(q, 'a-play');
    const t1 = Date.now(); await until(q, x => x && !x.playing); const fast = Date.now() - t1;
    s.check('2x plays a step in about half the time', fast/oneStep > 0.3 && fast/oneStep < 0.7, oneStep + ' ms -> ' + fast + ' ms');
    /* play all */
    await click(q, 'a-start'); await click(q, 'a-all');
    const allOn = await q.evaluate(() => document.getElementById('a-all').getAttribute('aria-pressed'));
    a = await until(q, x => x && !x.playing, 30000);
    s.check('the double arrow plays every step to the end', a.step === N && a.t === N && allOn === 'true', JSON.stringify(a));
    await q.evaluate(() => { const e = document.getElementById('a-speed'); e.value = '1'; e.dispatchEvent(new Event('change')); });

    /* what turns it off, and what does not */
    await click(q, 'a-start'); await click(q, 'a-next'); await click(q, 'a-next');
    await click(q, 'z-in'); a = await anim(q);
    s.check('zooming keeps the animation where it was', a && a.step === 2, JSON.stringify(a));
    await q.evaluate(() => document.querySelector('[data-grid="zy"]').click()); a = await anim(q);
    s.check('changing the grid keeps it too', a && a.step === 2, JSON.stringify(a));
    await click(q, 'z-rst');
    await q.evaluate(() => { const e = document.getElementById('i-pick'); e.selectedIndex = 1; e.dispatchEvent(new Event('change')); });
    s.check('choosing the other solution turns it off', (await anim(q)) === null);
    await click(q, 'a-start'); await click(q, 'a-next');
    await click(q, 'b-term');
    s.check('changing the stub type turns it off', (await anim(q)) === null);
    await click(q, 'a-start'); await click(q, 'b-ymode');
    s.check('changing the convention turns it off', (await anim(q)) === null);
    await click(q, 'a-start');
    await H.setInput(q, 'i-r', 40); await q.waitForTimeout(150);
    s.check('changing the load turns it off', (await anim(q)) === null);

    /* practice: hidden until "show me", then the same controls */
    await openTool(q, 'practice=1&method=shunt');
    s.check('strip hidden while practising', !(await vis()));
    await click(q, 'b-prac-show'); await q.waitForTimeout(150);
    const rv = await q.evaluate(() => { const cv = document.getElementById('chart');
      const st = cv.getAttribute('data-drawn'); animSeek(1e9);
      const D = JSON.parse(cv.getAttribute('data-drawn')); delete D.anim;
      const same = JSON.stringify(D) === st; animSeek(0); const z = JSON.parse(cv.getAttribute('data-drawn')).anim; animSeek(null);
      return { same, step0: z && z.step === 0, shown: !document.getElementById('anim').hidden }; });
    s.check('after "show me": strip shown, finished frame is the revealed view', rv.same && rv.step0 && rv.shown, JSON.stringify(rv));

    /* full screen: the strip goes with the chart, and both fit */
    await openTool(q, 'method=dstub');
    await pickMethod(q, 'dstub'); await q.waitForTimeout(200);
    await q.click('#b-full'); await q.waitForTimeout(900);     /* a real click: full screen needs a user gesture */
    const fs = await q.evaluate(() => {
      const a = document.getElementById('anim').getBoundingClientRect(), c = document.getElementById('chart').getBoundingClientRect();
      return { full: !!document.fullscreenElement, shown: !document.getElementById('anim').hidden,
               top: c.top, bottom: a.bottom, h: innerHeight };
    });
    if (!fs.full) s.note('full screen not granted to the headless browser; layout checked without it');
    s.check('full screen: strip shown, chart and strip within the screen', !fs.full || (fs.shown && fs.top >= -0.5 && fs.bottom <= fs.h + 0.5), JSON.stringify(fs));
    if (fs.full){
      await click(q, 'a-start'); await click(q, 'a-next');
      a = await anim(q);
      s.check('full screen: the controls work', a && a.step === 1, JSON.stringify(a));
      await q.evaluate(() => document.exitFullscreen()); await q.waitForTimeout(500);
    }
    s.check('no page errors (controls)', e2.length === 0, e2.slice(0, 2).join(' '));
    await c2.close();
  }

  /* reduced motion: each step appears whole, at once */
  {
    const c3 = await b.newContext({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' });
    const q = await c3.newPage();
    await openTool(q);
    await pickMethod(q, 'shunt'); await q.waitForTimeout(200);
    await click(q, 'a-start'); await click(q, 'a-play');
    const samples = [];
    for (let k = 0; k < 40; k++){ const a = await anim(q); samples.push(a); if (!a.playing) break; await q.waitForTimeout(40); }
    const playingFrames = samples.filter(a => a.playing);
    s.check('reduced motion: a step is never drawn part-way', playingFrames.length > 0 && playingFrames.every(a => a.s === 1 && a.step === 1),
            playingFrames.length + ' frames while playing, s = ' + [...new Set(playingFrames.map(a => a.s))].join(','));
    const end = samples[samples.length - 1];
    s.check('reduced motion: and it still stops on that step', !end.playing && end.t === 1, JSON.stringify(end));
    await c3.close();
  }

  /* phone: nothing overflows, every button reachable */
  {
    const c4 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
    const q = await c4.newPage();
    await openTool(q);
    await pickMethod(q, 'lnet'); await q.waitForTimeout(300);
    const ph = await q.evaluate(() => {
      const a = document.getElementById('anim').getBoundingClientRect();
      const bs = [...document.querySelectorAll('#anim button, #anim select')].map(e => e.getBoundingClientRect());
      return { ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
               right: Math.max(...bs.map(r => r.right)), w: innerWidth, stripRight: a.right };
    });
    s.check('390px: no overflow, every control on screen', ph.ovf <= 1 && ph.right <= ph.w && ph.stripRight <= ph.w + 0.5, JSON.stringify(ph));
    await c4.close();
  }

  await b.close();
  await srv.close();
  s.done();
})().catch(e => {
  /* a crash is a failure, and says so: a check that cannot run has not passed */
  console.log('  FAIL the suite crashed: ' + (e && e.stack ? e.stack.split(/\r?\n/).slice(0, 3).join(' / ') : e));
  process.exit(1);
});
