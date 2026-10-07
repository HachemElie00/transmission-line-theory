/* The SOLVED construction, mark by mark, against the theory.

   solvers.test.js checks the numbers the page prints. practice.test.js and
   scenarios.test.js check the reader's own attempt. Neither looks at what the
   chart DRAWS when it shows an answer, and a chart can print every number
   right while drawing the construction on the wrong circle, from the wrong
   side, the wrong way round, or on the wrong chart. This file holds every
   mark against the theory:

   - each construction path starts and ends where the design puts it, never
     leaves the circle the theory names, and runs the right way (travel is
     clockwise, by exactly 4 pi d);
   - each half turn is a diameter from the right point, and only the turns
     the convention calls for are drawn;
   - each auxiliary circle is the right locus, displayed the right way up;
   - the stub's rim arc starts at its own termination and ends where the rim
     presents the immittance the stub must supply;
   - the filled marker and the wavelength-ring marks are at the drawn point;
   - the words round the chart say true things about the grid in view;
   - the readouts, solution cards, picker and both circuit drawings carry the
     design's values, and the circuit's part symbols match their signs.

   Both conventions are covered for every method: on the impedance chart
   (the point turned half a turn for shunt work, chapter 11's route) and on
   the admittance chart (nothing turned, the admittance or combined grid).

   EVERYTHING EXPECTED IS COMPUTED HERE, from lib/tline.js (tangent formula
   and bisection, no reflection coefficients) and textbook circle geometry
   (constant r: centre r/(1+r), radius 1/(1+r)). The page's own solver and
   path code are never reused. The page publishes what it drew as data-drawn
   on the chart and both circuit canvases.

   Run:  node tests/construction.test.js                                    */

const H = require('./lib/harness');
const T = require('./lib/tline');
const TAU = 2*Math.PI;

/* ---- geometry, from the textbook ---- */
const gam = z => { const g = T.div(T.add(z, T.C(-1, 0)), T.add(z, T.C(1, 0))); return [g.re, g.im]; };
const neg = p => [-p[0], -p[1]];
const sc  = (k, p) => [k*p[0], k*p[1]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const offCircle = (p, c, r) => Math.abs(Math.hypot(p[0] - c[0], p[1] - c[1]) - r);
const rCircle = r => [[r/(1 + r), 0], 1/(1 + r)];      /* constant r, in Gamma_z */
const gCircle = g => [[-g/(1 + g), 0], 1/(1 + g)];     /* constant g, in Gamma_z */
const zOfGam = p => T.div(T.C(1 + p[0], p[1]), T.C(1 - p[0], -p[1]));
const TOL = 2e-5;                                      /* data-drawn is rounded to 1e-6 */

/* the formatting the page uses, reproduced to compare printed text */
const n3 = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3);
const n2 = v => (Math.abs(v) < 5e-3 ? 0 : v).toFixed(2);
const sig = v => { const a = Math.abs(v);
  return a >= 10000 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toFixed(3); };
const Z0 = 50, FMHZ = 1000, W = TAU*FMHZ*1e6, LAMMM = 299792458/(FMHZ*1e6)*1000;
const xComp = xs => { const X = xs*Z0; return X > 0 ? 'L = ' + sig(X/W*1e9) + ' nH'
                                                   : 'C = ' + sig(-1/(W*X)*1e12) + ' pF'; };
const bComp = bp => { const B = bp/Z0; return B > 0 ? 'C = ' + sig(B/W*1e12) + ' pF'
                                                   : 'L = ' + sig(-1/(W*B)*1e9) + ' nH'; };
/* every complex number printed as "a + jb" / "a - jb" (U+2212) */
const parseCpx = s => { const m = String(s).replace(/−/g, '-')
    .match(/(-?\d+(?:\.\d+)?)\s*([+-])\s*j\s*(\d+(?:\.\d+)?)/);
  return m ? [parseFloat(m[1]), (m[2] === '-' ? -1 : 1)*parseFloat(m[3])] : null; };
const firstNum = s => { const m = String(s).replace(/−/g, '-').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN; };
/* printed value v of true value t, at nd decimals */
const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
/* A printed string against a template: the words must match exactly, with
   every number replaced by '#', and each number must be within half its own
   last digit of its true value. Comparing numbers rather than strings keeps a
   rounding tie (an exact half, reached by two routes) from flipping. */
function fmtOk(str, template, values){
  if (typeof str !== 'string') return false;
  const nums = [];
  const shape = str.replace(/\u2212/g, '-').replace(/-?\d+(?:\.(\d+))?/g, (m, dec) => {
    nums.push([parseFloat(m), dec ? dec.length : 0]); return '#'; });
  if (shape !== template || nums.length !== values.length) return false;
  return nums.every(([v, nd], i) => printedOk(v, values[i], nd));
}
const anyFmt = (list, template, values) => (list || []).some(q => fmtOk(q, template, values));

/* the angle travelled clockwise along a path, unwrapped; null if it ever
   turns back */
function cwSweep(pts){
  let tot = 0;
  for (let i = 1; i < pts.length; i++){
    let a = Math.atan2(pts[i][1], pts[i][0]) - Math.atan2(pts[i-1][1], pts[i-1][0]);
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    if (a > 1e-9) return null;
    tot -= a;
  }
  return tot;
}
const angMod = a => ((a % TAU) + TAU) % TAU;
const sameAng = (a, b) => { const d = Math.abs(angMod(a) - angMod(b)); return Math.min(d, TAU - d) < 1e-4; };

/* ---- what each word round the chart claims, and whether it is true ----
   A claim is (kind, quantity, sign) for the upper or lower half. x is read on
   an unturned impedance grid; b either on the turned point (impedance grid,
   view turned) or on an admittance grid (unturned). Truth is worked out from
   the reflection coefficient of a point in that half, not from a table. */
function claims(txt){
  const out = [], t = String(txt);
  let m;
  const re1 = /(inductive|capacitive):\s+([xb])\s*([<>])\s*0,\s+([xb])\s*([<>])\s*0/g;
  while ((m = re1.exec(t))) { out.push([m[1], m[2], m[3]]); out.push([m[1], m[4], m[5]]); }
  if (out.length) return out;
  const re2 = /(inductive|capacitive)\s+([xb])\s*([<>])\s*0/g;
  while ((m = re2.exec(t))) out.push([m[1], m[2], m[3]]);
  return out;
}
function wordsTrue(words, grid, sign, mixed){
  const bad = [];
  for (const [half, txt] of [[1, words.top], [-1, words.bot]]){
    const cs = claims(txt);
    if (!cs.length) bad.push('no claim in "' + txt + '"');
    const gd = [0, 0.5*half];                      /* a displayed point in that half */
    for (const [kind, q, s] of cs){
      let val;
      if (q === 'x') val = T.div(T.C(1 + gd[0], gd[1]), T.C(1 - gd[0], -gd[1])).im;   /* z, unturned */
      else {
        const turnedB = (grid === 'z');           /* b read on the turned point */
        const gz = turnedB ? neg(gd) : gd;         /* the working Gamma_z there */
        val = T.div(T.C(1 - gz[0], -gz[1]), T.C(1 + gz[0], gz[1])).im;                /* y */
        if (!turnedB && grid === 'z') bad.push('b claimed on an unturned impedance grid');
      }
      const truth = val > 0 ? '>' : '<';
      if (truth !== s) bad.push('"' + txt + '" says ' + q + ' ' + s + ' 0 in that half');
      const ind = (q === 'x') ? val > 0 : val < 0;
      if ((kind === 'inductive') !== ind) bad.push('"' + txt + '" calls ' + q + ' ' + s + ' 0 ' + kind);
    }
    /* x may be claimed only where z is read unturned; b only where y is read */
    if (grid === 'z' && sign < 0 && cs.some(c => c[1] === 'x')) bad.push('x claimed in a turned view');
    if (grid === 'y' && cs.some(c => c[1] === 'x')) bad.push('x claimed on the admittance grid');
    if (grid === 'z' && sign > 0 && !mixed && cs.some(c => c[1] === 'b')) bad.push('b claimed on an unturned impedance grid');
    /* an L-network on the impedance chart reads the same grid as z for one
       element and as y for the other, so both readings must be described */
    if (mixed && !(cs.some(c => c[1] === 'x') && cs.some(c => c[1] === 'b')))
      bad.push('"' + txt + '" does not say how the grid reads for both elements');
  }
  /* the ends of the axis: what the grid in view reads there */
  const wantL = grid === 'y' ? 'y → ∞' : (grid === 'z' && sign < 0) ? 'open' : 'short';
  const wantR = grid === 'y' ? 'y = 0' : (grid === 'z' && sign < 0) ? 'short' : 'open';
  if (words.left !== wantL) bad.push('left end says "' + words.left + '", want "' + wantL + '"');
  if (words.right !== wantR) bad.push('right end says "' + words.right + '", want "' + wantR + '"');
  return bad;
}

/* the stub's rim arc: starts at its own termination, runs clockwise (toward
   the generator) by 4 pi l, and ends where the rim presents what the stub must
   supply. Display angle a is working Gamma_z = sign * e^{ja}. */
function stubArcBad(stub, sign, open, series, ls, need){
  const bad = [];
  if (!stub) return ['no stub arc'];
  const [a0, a1, l] = stub;
  if (Math.abs(l - ls) > 1e-5) bad.push('arc for l = ' + l + ', design ' + ls);
  const g0 = sc(sign, [Math.cos(a0), Math.sin(a0)]);
  const term = open ? [1, 0] : [-1, 0];           /* short: Gamma_z = -1; open: +1, both kinds */
  if (dist(g0, term) > 1e-5) bad.push('starts at the wrong end (' + (open ? 'open' : 'short') + ')');
  if (Math.abs((a0 - a1) - 2*TAU*ls) > 1e-5) bad.push('does not run clockwise by 4 pi l');
  const g1 = sc(sign, [Math.cos(a1), Math.sin(a1)]);
  const imm = series ? zOfGam(g1) : T.invc(zOfGam(g1));
  if (Math.abs(imm.re) > 1e-4 || Math.abs(imm.im - need) > 1e-4*Math.max(1, Math.abs(need)))
    bad.push('ends where the rim gives ' + imm.im.toFixed(4) + ', stub must give ' + need.toFixed(4));
  return bad;
}

/* The grid circle highlighted with the stub arc: on the grid in view (Q = +1
   for the printed impedance grid, -1 for the admittance overlay), every point
   of it reads the value the stub must supply, it runs from that grid's
   infinity point to the end of the rim arc, and it stays inside the disc. */
function stubCircleBad(D, grid, need){
  const path = (D.paths || []).find(q => q.tag === 'stub circle');
  if (Math.abs(need) > 1e3) return path ? ['circle drawn for a stub at infinity'] : [];
  if (!path) return ['no stub circle'];
  if (!D.stub) return ['no stub arc to end on'];
  const Q = grid === 'y' ? -1 : 1, pts = path.pts, bad = [];
  if (dist(pts[0], [Q, 0]) > 1e-5) bad.push('starts at ' + pts[0] + ', not the grid\'s infinity point ' + Q);
  const E = [Math.cos(D.stub[1]), Math.sin(D.stub[1])];
  if (dist(pts[pts.length-1], E) > 1e-5) bad.push('ends at ' + pts[pts.length-1] + ', not the arc\'s end ' + E.map(v => v.toFixed(5)));
  /* in the grid's own frame (Q p), Im w = need is the circle centre
     (1, 1/need), radius 1/|need|, or the real axis for need = 0. Tested as
     geometry, not by reading w: near the infinity point the reading magnifies
     data-drawn's 1e-6 rounding past any sensible tolerance */
  for (const p of pts){
    if (Math.hypot(p[0], p[1]) > 1 + 1e-6){ bad.push('leaves the disc at ' + p); break; }
    const g = [Q*p[0], Q*p[1]];
    const off = Math.abs(need) < 1e-6 ? Math.abs(g[1]) : Math.abs(Math.hypot(g[0] - 1, g[1] - 1/need) - 1/Math.abs(need));
    if (off > 1e-5){ bad.push('off the ' + need.toFixed(4) + ' circle by ' + off.toExponential(1) + ' at ' + p); break; }
  }
  /* and, away from infinity, what the grid reads there */
  const mid = pts[Math.floor(pts.length/2)], wm = zOfGam([Q*mid[0], Q*mid[1]]);
  if (dist(mid, [Q, 0]) > 0.2 && Math.abs(wm.im - need) > 1e-4*Math.max(1, Math.abs(need))) bad.push('reads ' + wm.im.toFixed(4) + ', stub gives ' + need.toFixed(4));
  return bad;
}

/* a path: right ends, never off its circle */
function pathBad(name, path, start, end, circ){
  if (!path) return [name + ' not drawn'];
  const bad = [], pts = path.pts;
  if (dist(pts[0], start) > TOL) bad.push(name + ' starts at ' + pts[0] + ', want ' + start.map(v => v.toFixed(5)));
  if (dist(pts[pts.length-1], end) > TOL) bad.push(name + ' ends at ' + pts[pts.length-1] + ', want ' + end.map(v => v.toFixed(5)));
  if (circ){
    const worst = Math.max(...pts.map(p => offCircle(p, circ[0], circ[1])));
    if (worst > TOL) bad.push(name + ' leaves its circle by ' + worst.toExponential(1));
  }
  return bad;
}
/* along an element circle to the centre: every step gets nearer it */
const approachBad = (name, path) => {
  if (!path) return [];
  const d = path.pts.map(p => Math.hypot(p[0], p[1]));
  for (let i = 1; i < d.length; i++) if (d[i] > d[i-1] + 1e-9) return [name + ' moves away from the centre'];
  return [];
};
const circleBad = (circles, tag, c, r) => {
  const hit = (circles || []).filter(k => k.tag === tag);
  if (hit.length !== 1) return ['circle "' + tag + '" drawn ' + hit.length + ' times'];
  if (dist(hit[0].c, c) > TOL || Math.abs(hit[0].r - r) > TOL)
    return ['circle "' + tag + '" at ' + hit[0].c + ' r ' + hit[0].r + ', want ' + c.map(v => v.toFixed(4)) + ' r ' + r.toFixed(4)];
  return [];
};
function turnsBad(turns, want){
  turns = turns || [];
  if (turns.length !== want.length) return [turns.length + ' half turns drawn, want ' + want.length];
  const bad = [];
  want.forEach((w, i) => {
    if (dist(turns[i][0], w) > TOL || dist(turns[i][1], neg(w)) > TOL)
      bad.push('half turn ' + (i+1) + ' from ' + turns[i][0] + ', want ' + w.map(v => v.toFixed(5)));
  });
  return bad;
}

(async () => {
  const s = H.suite('construction');
  const srv = await H.serve(H.SITE);
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1150 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);

  let nonce = 0;
  const setup = (st) => p.evaluate(async ({ st, n }) => {
    const h = 'r=' + st.r + '&x=' + st.x + '&z0=50&f=1000&ee=1&practice=0&openStub=' +
              (st.open ? 1 : 0) + '&ymode=' + st.ymode + '&dd=' + (st.dd || 0.125) + '&nonce=' + n;
    /* a pending debounced replaceState from the last case can land between
       the assignment and the hashchange event, and the page then reads the
       OLD hash: retry until the URL carries this case's nonce */
    for (let k = 0; k < 5; k++){
      await new Promise(res => { window.addEventListener('hashchange', () => setTimeout(res, 0), { once: true });
                                 location.hash = h; });
      if (location.hash.indexOf('nonce=' + n) >= 0) break;
    }
    const sel = document.getElementById('i-method');
    sel.value = st.m; sel.dispatchEvent(new Event('change', { bubbles: true }));
    return { cards: document.querySelectorAll('#sols [data-pick]').length,
             none: (document.querySelector('#sols .none') || {}).textContent || '' };
  }, { st, n: ++nonce });
  const take = (i) => p.evaluate((i) => {
    const btn = document.querySelector('#sols [data-pick="' + i + '"]');
    btn.click();
    const card = {};
    const sol = document.querySelectorAll('#sols .sol')[i];
    sol.querySelectorAll('dt').forEach(dt => { card[dt.textContent] = dt.nextElementSibling.textContent; });
    const vals = {};
    document.querySelectorAll('#vals tr').forEach(tr => {
      const c = tr.children; vals[c[0].textContent] = c[1].textContent; vals[c[2].textContent] = c[3].textContent; });
    const pressed = document.querySelector('[data-grid][aria-pressed="true"]');
    const pick = document.getElementById('i-pick');
    return {
      drawn: JSON.parse(document.getElementById('chart').getAttribute('data-drawn') || '{}'),
      ckt: JSON.parse(document.getElementById('ckt').getAttribute('data-drawn') || 'null'),
      mini: JSON.parse(document.getElementById('ckt-mini').getAttribute('data-drawn') || 'null'),
      card, vals, grid: pressed ? pressed.getAttribute('data-grid') : null,
      pickOpts: [...pick.options].map(o => o.textContent),
      pickShown: document.getElementById('row-pick').style.display !== 'none',
      ymodeTxt: document.getElementById('b-ymode').textContent
    };
  }, i);

  const fails = {};
  const bad = (key, tag, list) => { if (list.length) (fails[key] = fails[key] || []).push(tag + ': ' + list[0]); };
  const counted = {};
  const count = k => { counted[k] = (counted[k] || 0) + 1; };

  /* a few loads past lib/tline's spread: exactly on r = 1 and g = 1, which give
     the L-network a repeated root, and one hugging the rim */
  /* ... and two nearly reactive ones, 0.001 ohm and 0.005 + j65 ohm on 50:
     |Gamma| past 0.9999, matchable by every method, which the stub and
     transformer solvers once refused as "purely reactive" */
  const LOADS = T.LOADS.concat([[1, 0.8], [0.5, 0.5], [0.05, 0.3], [2e-5, 0], [1e-4, 1.3]]);

  for (const [r, x] of LOADS){
    const zL = T.C(r, x), gL = gam(zL), yL = T.invc(zL);

    /* ---------- single stubs ---------- */
    for (const m of ['shunt', 'series']) for (const open of [false, true]) for (const ymode of ['point', 'grid']){
      const series = m === 'series';
      const des = series ? T.series(zL, open) : T.shunt(zL, open);
      const st = await setup({ r, x, m, open, ymode });
      const tag = m + ' ' + r + (x < 0 ? '' : '+') + x + 'j ' + (open ? 'open' : 'short') + ' ' + ymode;
      if (st.cards !== des.length){ bad('solution count', tag, [st.cards + ' solutions, theory ' + des.length]); continue; }
      const sign = (!series && ymode === 'point') ? -1 : 1;
      const wantGrid = series ? 'z' : (ymode === 'point' ? 'z' : 'y');
      for (let i = 0; i < des.length; i++){
        const d = des[i], o = await take(i), D = o.drawn, t = tag + ' #' + (i+1);
        count(m);
        const gd = gam(T.zin(zL, d.d));            /* Gamma_z at the stub */
        const target = series ? [[0.5, 0], 0.5] : [[-0.5, 0], 0.5];
        const tDisp = [sc(sign, target[0]), 0.5];
        bad('grid in view', t, o.grid === wantGrid ? [] : ['grid ' + o.grid + ', want ' + wantGrid]);
        bad('half turns', t, turnsBad(D.turns, sign < 0 ? [gL] : []));
        bad('target circle', t, circleBad(D.circles, series ? 'r = 1' : 'g = 1', tDisp[0], 0.5));
        bad('travel path', t, pathBad('travel', (D.paths || []).find(q => q.tag === 'travel'),
            sc(sign, gL), sc(sign, gd), [[0, 0], Math.hypot(gL[0], gL[1])]));
        const tp = (D.paths || []).find(q => q.tag === 'travel');
        if (tp){
          const sw = cwSweep(tp.pts);
          bad('travel direction', t, sw == null ? ['travel turns anticlockwise']
              : Math.abs(sw - 2*TAU*d.d) > 1e-4 ? ['travel sweeps ' + sw.toFixed(5) + ' rad, want 4 pi d = ' + (2*TAU*d.d).toFixed(5)] : []);
        }
        bad('travel lands on the target', t, offCircle(sc(sign, gd), tDisp[0], 0.5) > 1e-6 ? ['crossing is off the target circle'] : []);
        bad('stub path', t, pathBad('stub', (D.paths || []).find(q => q.tag === 'stub'),
            sc(sign, gd), [0, 0], tDisp));
        bad('stub path', t, approachBad('stub', (D.paths || []).find(q => q.tag === 'stub')));
        bad('marker', t, dist(D.pt, sc(sign, gd)) > TOL ? ['filled marker at ' + D.pt] : []);
        bad('ring marks', t, (D.ring && sameAng(D.ring[0], Math.atan2(sign*gL[1], sign*gL[0])) &&
            sameAng(D.ring[1], Math.atan2(sign*gd[1], sign*gd[0]))) ? [] : ['ring marks at ' + D.ring]);
        if (d.d >= 5e-4) bad('ring label', t, fmtOk(D.ringTxt, 'd = #\u03bb', [d.d]) ? [] : ['ring says ' + D.ringTxt]);
        bad('stub arc', t, stubArcBad(D.stub, sign, open, series, d.ls, d.need));
        bad('stub circle', t, stubCircleBad(D, wantGrid, d.need));
        bad('stub arc label', t, (d.ls > 0.02 ? fmtOk(D.stubTxt, 'stub #\u03bb from the ' + (open ? 'open' : 'short'), [d.ls])
                                              : D.stubTxt === undefined) ? [] : ['says ' + D.stubTxt]);
        bad('words round the chart', t, wordsTrue(D.words || {}, o.grid, sign, false));
        /* readouts at the stub, before it is attached */
        const zd = T.zin(zL, d.d), yd = T.invc(zd);
        const zr = parseCpx(o.vals.z), yr = parseCpx(o.vals.y);
        bad('readout at the stub', t, (zr && yr && printedOk(zr[0], zd.re, 2) && printedOk(zr[1], zd.im, 2) &&
            printedOk(yr[0], yd.re, 2) && printedOk(yr[1], yd.im, 2)) ? [] : ['z ' + o.vals.z + ', y ' + o.vals.y]);
        /* the card */
        const c = o.card;
        bad('card', t, (printedOk(firstNum(c['distance d']), d.d, 3) && printedOk(firstNum(c['stub length']), d.ls, 3) &&
            printedOk(firstNum(c['stub must give'].replace(/^[xb] = /, '')), d.need, 3) &&
            c['stub end'] === (open ? 'open' : 'shorted')) ? [] : [JSON.stringify(c)]);
        /* the circuit, full and miniature */
        const ck = o.ckt || { text: [], parts: [] };
        const stubWord = (open ? 'open' : 'shorted') + (series ? ' series stub' : ' stub');
        bad('circuit', t, (anyFmt(ck.text, 'd = #\u03bb  #mm', [d.d, d.d*LAMMM]) &&
            anyFmt(ck.text, '#\u03bb  #mm', [d.ls, d.ls*LAMMM]) &&
            ck.parts.join() === (open ? 'open end' : 'short end') && ck.text.includes(stubWord))
            ? [] : [JSON.stringify(ck)]);
        const mk = o.mini || { text: [], parts: [] };
        bad('miniature circuit', t, (anyFmt(mk.text, 'd = #\u03bb', [d.d]) && anyFmt(mk.text, '#\u03bb', [d.ls]) &&
            mk.parts.join() === ck.parts.join() && mk.text.includes(stubWord)) ? [] : [JSON.stringify(mk)]);
        if (des.length > 1)
          bad('picker', t, (o.pickShown && fmtOk(o.pickOpts[i], '#:  d #\u03bb, stub #\u03bb', [i+1, d.d, d.ls])) ? [] : [JSON.stringify(o.pickOpts)]);
        bad('toggle label', t, o.ymodeTxt === 'solve on: ' + (ymode === 'point' ? 'impedance' : 'admittance') + ' chart' ? [] : [o.ymodeTxt]);
      }
    }

    /* ---------- quarter-wave transformer ----------
       The real points are where Im z = 0. Near the rim z is huge at the
       voltage maximum and Im z leaps across it, which lib/tline's root finder
       rightly treats as the signature of a pole and discards; y is small and
       smooth there. So the roots of Im y = 0 are found too, and merged. */
    const qwtAll = () => {
      const ds = T.roots(d => T.zin(zL, d).im, 0, 0.5, 40000)
        .concat(T.roots(d => T.yin(zL, d).im, 0, 0.5, 40000)).sort((a, b) => a - b)
        .filter((v, i, a) => i === 0 || v - a[i-1] > 1e-6);
      return ds.map(d => { const zr = T.zin(zL, d); return { d, zr: zr.re, z1: Math.sqrt(zr.re) }; });
    };
    for (const ymode of ['point', 'grid']){
      const des = qwtAll();
      const st = await setup({ r, x, m: 'qwt', ymode });
      const tag = 'qwt ' + r + (x < 0 ? '' : '+') + x + 'j ' + ymode;
      if (st.cards !== des.length){ bad('solution count', tag, [st.cards + ' solutions, theory ' + des.length]); continue; }
      for (let i = 0; i < des.length; i++){
        const d = des[i], o = await take(i), D = o.drawn, t = tag + ' #' + (i+1);
        count('qwt');
        const gd = gam(T.zin(zL, d.d));
        bad('grid in view', t, o.grid === 'z' ? [] : ['grid ' + o.grid]);
        bad('half turns', t, turnsBad(D.turns, []));
        bad('travel path', t, pathBad('travel', (D.paths || []).find(q => q.tag === 'travel'),
            gL, gd, [[0, 0], Math.hypot(gL[0], gL[1])]));
        bad('travel lands on the axis', t, Math.abs(gd[1]) > 1e-9 ? ['not real'] : []);
        bad('transformer', t, pathBad('transformer', (D.paths || []).find(q => q.tag === 'transformer'), gd, [0, 0], null));
        bad('transformer label', t, anyFmt(D.labels, '\u03bb/# of # \u03a9', [4, d.z1*Z0]) ? [] : [JSON.stringify(D.labels)]);
        bad('marker', t, dist(D.pt, gd) > TOL ? ['filled marker at ' + D.pt] : []);
        bad('words round the chart', t, wordsTrue(D.words || {}, o.grid, 1, false));
        const c = o.card;
        bad('card', t, (printedOk(firstNum(c['distance d']), d.d, 3) && printedOk(firstNum(c['z there']), d.zr, 3) &&
            fmtOk(c['Z1'], '# Ω', [d.z1*Z0]) &&
            c['put it at the'] === 'voltage ' + (d.zr < 1 ? 'minimum' : 'maximum')) ? [] : [JSON.stringify(c)]);
        const ck = o.ckt || { text: [] };
        bad('circuit', t, anyFmt(ck.text, 'Z# = # \u03a9', [1, d.z1*Z0]) ? [] : [JSON.stringify(ck.text)]);
      }
    }

    /* ---------- L-network ---------- */
    for (const ymode of ['point', 'grid']){
      /* a zero element is no element, so the two orders can be one circuit;
         the theory's list is reduced to distinct circuits */
      const des = [];
      T.lnet(zL).forEach(d => {
        if (Math.abs(d.xs) < 1e-7) d.xs = 0;
        if (Math.abs(d.bp) < 1e-7) d.bp = 0;
        if (!des.some(e => Math.abs(e.xs - d.xs) < 1e-6*(1 + Math.abs(d.xs)) &&
                           Math.abs(e.bp - d.bp) < 1e-6*(1 + Math.abs(d.bp)))) des.push(d);
      });
      const st = await setup({ r, x, m: 'lnet', ymode });
      const tag = 'lnet ' + r + (x < 0 ? '' : '+') + x + 'j ' + ymode;
      if (st.cards !== des.length){ bad('solution count', tag, [st.cards + ' solutions, theory ' + des.length]); continue; }
      const onZ = ymode === 'point';
      const used = new Set();
      for (let i = 0; i < des.length; i++){
        const o = await take(i), D = o.drawn, c = o.card;
        const t = tag + ' #' + (i+1);
        count('lnet');
        /* the page's design i is the theory's design with the same order and x */
        const order = c['order'], xsP = firstNum(c['series x']), bpP = firstNum(c['shunt b']);
        let k = -1, best = Infinity;
        des.forEach((d, j) => { const e = Math.abs(d.xs - xsP) + Math.abs(d.bp - bpP);
          if (!used.has(j) && e < best){ best = e; k = j; } });
        if (k < 0 || best > 1.2e-3){ bad('card', t, ['no theory design for ' + JSON.stringify(c)]); continue; }
        used.add(k);
        const d = des[k], sf = d.order === 'series first';
        const single = d.bp === 0 ? 'series' : d.xs === 0 ? 'shunt' : null;
        const hasS = d.xs !== 0, hasP = d.bp !== 0;
        bad('card', t, order === (single ? single + ' element only' : d.order) ? [] : ['order says ' + order]);
        bad('grid in view', t, o.grid === (onZ ? 'z' : 'zy') ? [] : ['grid ' + o.grid]);
        let midZ;
        if (sf){
          midZ = T.add(zL, T.C(0, d.xs));
          const gm = gam(midZ);
          bad('half turns', t, turnsBad(D.turns, onZ && hasP ? [gm] : []));
          bad('auxiliary circle', t, circleBad(D.circles, 'g = 1', [-0.5, 0], 0.5));
          const se = (D.paths || []).find(q => q.tag === 'series');
          if (hasS) bad('series path', t, pathBad('series', se, gL, gm, rCircle(r)));
          else bad('series path', t, se ? ['a zero series element is drawn'] : []);
          bad('series lands where g = 1', t, offCircle(gm, [-0.5, 0], 0.5) > 1e-6 ? ['off g = 1'] : []);
          const sh = (D.paths || []).find(q => q.tag === 'shunt');
          if (hasP){
            bad('shunt path', t, onZ ? pathBad('shunt', sh, neg(gm), [0, 0], rCircle(1))
                                     : pathBad('shunt', sh, gm, [0, 0], gCircle(1)));
            bad('shunt path', t, approachBad('shunt', sh));
          } else bad('shunt path', t, sh ? ['a zero shunt element is drawn'] : []);
        } else {
          const yM = T.add(yL, T.C(0, d.bp));
          midZ = T.invc(yM);
          const gm = gam(midZ);
          bad('half turns', t, turnsBad(D.turns, !onZ || !hasP ? [] : hasS ? [gL, neg(gm)] : [gL]));
          bad('auxiliary circle', t, onZ ? circleBad(D.circles, 'r = 1 turned', [-0.5, 0], 0.5)
                                         : circleBad(D.circles, 'r = 1', [0.5, 0], 0.5));
          const shp = (D.paths || []).find(q => q.tag === 'shunt');
          if (hasP) bad('shunt path', t, onZ ? pathBad('shunt', shp, neg(gL), neg(gm), rCircle(yL.re))
                                             : pathBad('shunt', shp, gL, gm, gCircle(yL.re)));
          else bad('shunt path', t, shp ? ['a zero shunt element is drawn'] : []);
          bad('shunt lands where r = 1', t, offCircle(gm, [0.5, 0], 0.5) > 1e-6 ? ['off r = 1'] : []);
          const se = (D.paths || []).find(q => q.tag === 'series');
          if (hasS){
            bad('series path', t, pathBad('series', se, gm, [0, 0], rCircle(1)));
            bad('series path', t, approachBad('series', se));
          } else bad('series path', t, se ? ['a zero series element is drawn'] : []);
        }
        bad('marker', t, dist(D.pt, gL) > TOL ? ['filled marker at ' + D.pt] : []);
        bad('words round the chart', t, wordsTrue(D.words || {}, o.grid, 1, onZ));
        bad('labels', t, ((D.labels || []).includes('series x') === hasS && (D.labels || []).includes('shunt b') === hasP)
            ? [] : [JSON.stringify(D.labels)]);
        /* component values from the reactance, independently: L = X/w, C = -1/(wX),
           and for the shunt C = B/w, L = -1/(wB) */
        const X = d.xs*Z0, B = d.bp/Z0;
        const xT = !hasS ? null : X > 0 ? ['L = # nH', X/W*1e9] : ['C = # pF', -1/(W*X)*1e12];
        const bT = !hasP ? null : B > 0 ? ['C = # pF', B/W*1e12] : ['L = # nH', -1/(W*B)*1e9];
        const partOk = (txt, tp) => tp ? fmtOk(txt, tp[0], [tp[1]]) : txt === '\u2014';
        const cs = String(c['series x']).split(/\s{3}/), cb = String(c['shunt b']).split(/\s{3}/);
        bad('card', t, (printedOk(bpP, d.bp, 3) && printedOk(xsP, d.xs, 3) &&
            partOk(cs[1], xT) && partOk(cb[1], bT)) ? [] : [JSON.stringify(c) + ' want ' + JSON.stringify([xT, bT])]);
        const ck = o.ckt || { text: [], parts: [] };
        const wantParts = [].concat(hasS ? [d.xs > 0 ? 'series L' : 'series C'] : [],
                                    hasP ? [d.bp > 0 ? 'shunt C' : 'shunt L'] : []);
        const wantNote = single === 'series' ? 'only a series element is needed: the load is on r = 1'
                       : single === 'shunt' ? 'only a shunt element is needed: the load is on g = 1'
                       : sf ? 'series element next to the load, shunt element toward the source'
                            : 'shunt element next to the load, series element toward the source';
        bad('circuit', t, (ck.parts.join() === wantParts.join() && (!hasS || anyFmt(ck.text, xT[0], [xT[1]])) &&
            (!hasP || anyFmt(ck.text, bT[0], [bT[1]])) && ck.text.includes(wantNote))
            ? [] : [JSON.stringify(ck) + ' want ' + wantParts + ' ' + JSON.stringify([xT, bT]) + ' / ' + wantNote]);
        /* and the network as drawn really is a match */
        const zIn = sf ? T.invc(T.add(T.invc(midZ), T.C(0, d.bp))) : T.add(midZ, T.C(0, d.xs));
        bad('design matches', t, T.dist1(zIn) > 1e-6 ? ['assembles to ' + zIn.re + ' ' + zIn.im] : []);
      }
    }

    /* ---------- double stub ---------- */
    for (const dd of [0.125, 0.375]) for (const open of [false, true]) for (const ymode of ['point', 'grid']){
      const des = T.dstub(zL, dd, open);
      const st = await setup({ r, x, m: 'dstub', open, ymode, dd });
      const tag = 'dstub ' + r + (x < 0 ? '' : '+') + x + 'j dd' + dd + ' ' + (open ? 'open' : 'short') + ' ' + ymode;
      const tt = Math.tan(TAU*dd), gmax = (1 + tt*tt)/(tt*tt);
      /* exactly on the boundary the two designs merge into a double root,
         which no sign change brackets: there 1 - t b = 0 just after stub 1,
         so b1 = 1/t - b_L */
      if (!des.length && Math.abs(yL.re - gmax) < 1e-9){
        const b1 = 1/tt - yL.im;
        const after = T.invc(T.zin(T.invc(T.add(yL, T.C(0, b1))), dd));
        const b2 = -after.im;
        des.push({ b1, b2, ls1: T.findStub(b1, open, false), ls2: T.findStub(b2, open, false) });
        bad('forbidden region', tag, Math.abs(after.re - 1) > 1e-6 ? ['boundary design does not reach g = 1'] : []);
      }
      if (!des.length){
        bad('forbidden region', tag, (st.cards === 0 && /forbidden/.test(st.none) && yL.re > gmax - 1e-9) ? [] :
            ['theory finds no design; page shows ' + st.cards + ' and says "' + st.none + '"']);
        continue;
      }
      if (st.cards !== des.length){ bad('solution count', tag, [st.cards + ' solutions, theory ' + des.length]); continue; }
      const sign = ymode === 'point' ? -1 : 1;
      const used = new Set();
      for (let i = 0; i < des.length; i++){
        const o = await take(i), D = o.drawn, c = o.card, t = tag + ' #' + (i+1);
        count('dstub');
        const b1P = firstNum(c['stub 1 gives'].replace(/^b = /, ''));
        let k = -1, best = Infinity;
        des.forEach((d, j) => { if (!used.has(j) && Math.abs(d.b1 - b1P) < best){ best = Math.abs(d.b1 - b1P); k = j; } });
        if (best > 6e-4*Math.max(1, Math.abs(b1P))){ bad('card', t, ['no theory design for ' + JSON.stringify(c)]); continue; }
        used.add(k);
        const d = des[k];
        const yA = T.add(yL, T.C(0, d.b1)), gA = gam(T.invc(yA));
        const yB = T.invc(T.zin(T.invc(yA), dd)), gB = gam(T.invc(yB));
        bad('grid in view', t, o.grid === (sign < 0 ? 'z' : 'y') ? [] : ['grid ' + o.grid]);
        bad('half turns', t, turnsBad(D.turns, sign < 0 ? [gL] : []));
        bad('forbidden circle', t, circleBad(D.circles, 'forbidden', sc(sign, gCircle(gmax)[0]), gCircle(gmax)[1]));
        bad('rotated circle', t, circleBad(D.circles, 'g = 1 rotated back',
            sc(sign, [-0.5*Math.cos(2*TAU*dd), -0.5*Math.sin(2*TAU*dd)]), 0.5));
        bad('stub 1 path', t, pathBad('stub 1', (D.paths || []).find(q => q.tag === 'stub 1'),
            sc(sign, gL), sc(sign, gA), [sc(sign, gCircle(yL.re)[0]), gCircle(yL.re)[1]]));
        bad('stub 1 lands on the rotated circle', t,
            offCircle(gA, [-0.5*Math.cos(2*TAU*dd), -0.5*Math.sin(2*TAU*dd)], 0.5) > 1e-6 ? ['off it'] : []);
        const spc = (D.paths || []).find(q => q.tag === 'spacing');
        bad('spacing path', t, pathBad('spacing', spc, sc(sign, gA), sc(sign, gB), [[0, 0], Math.hypot(gA[0], gA[1])]));
        /* stub 1 can land exactly on the centre; the spacing then has no
           direction to check */
        if (spc && Math.hypot(gA[0], gA[1]) > 1e-6){ const sw = cwSweep(spc.pts);
          bad('spacing direction', t, (sw != null && Math.abs(sw - 2*TAU*dd) < 1e-4) ? [] : ['sweeps ' + sw]); }
        bad('spacing lands on g = 1', t, offCircle(gB, [-0.5, 0], 0.5) > 1e-6 ? ['off g = 1'] : []);
        const s2 = (D.paths || []).find(q => q.tag === 'stub 2');
        bad('stub 2 path', t, pathBad('stub 2', s2, sc(sign, gB), [0, 0], [sc(sign, [-0.5, 0]), 0.5]));
        bad('stub 2 path', t, approachBad('stub 2', s2));
        bad('marker', t, dist(D.pt, sc(sign, gL)) > TOL ? ['filled marker at ' + D.pt] : []);
        bad('stub arc', t, stubArcBad(D.stub, sign, open, false, d.ls2, d.b2));
        bad('stub circle', t, stubCircleBad(D, sign < 0 ? 'z' : 'y', d.b2));
        bad('words round the chart', t, wordsTrue(D.words || {}, o.grid, sign, false));
        bad('card', t, (printedOk(b1P, d.b1, 3) && printedOk(firstNum(c['stub 1 length']), d.ls1, 3) &&
            printedOk(firstNum(c['stub 2 gives'].replace(/^b = /, '')), d.b2, 3) &&
            printedOk(firstNum(c['stub 2 length']), d.ls2, 3)) ? [] : [JSON.stringify(c)]);
        const ck = o.ckt || { text: [], parts: [] };
        bad('circuit', t, (anyFmt(ck.text, '#\u03bb  #mm', [d.ls1, d.ls1*LAMMM]) &&
            anyFmt(ck.text, '#\u03bb  #mm', [d.ls2, d.ls2*LAMMM]) && anyFmt(ck.text, 'd = #\u03bb  #mm', [dd, dd*LAMMM]) &&
            ck.parts.join() === [open ? 'open end' : 'short end', open ? 'open end' : 'short end'].join()) ? [] : [JSON.stringify(ck)]);
      }
    }
  }

  /* ---------- loads with nothing to do, or nothing that can be done ---------- */
  for (const m of ['shunt', 'series', 'qwt', 'lnet', 'dstub']){
    const a = await setup({ r: 1, x: 0, m, ymode: 'point' });
    bad('matched load', m, (a.cards === 0 && /already matched/.test(a.none)) ? [] : [a.cards + ' / ' + a.none]);
    const z = await setup({ r: 0, x: 0.7, m, ymode: 'point' });
    bad('purely reactive load', m, (z.cards === 0 && /absorbs no power/.test(z.none)) ? [] : [z.cards + ' / ' + z.none]);
  }

  /* ---------- published worked examples ----------
     An anchor outside this project: the answers printed in textbooks, held
     to the precision the source gives (its chart readings are good to about
     0.002 lambda). Every one of these agreed when checked by hand on
     2026-10-03; this keeps it that way. The sources' own rounding is noted
     where the page is more exact than they are. */
  {
    const P = [];
    const cardsOf = () => p.evaluate(() => [...document.querySelectorAll('#sols .sol')].map(sl => {
      const o = {}; sl.querySelectorAll('dt').forEach(dt => { o[dt.textContent] = dt.nextElementSibling.textContent; }); return o; }));
    const within = (v, want, tol) => Math.abs(v - want) <= tol;
    const ex = async (name, st, test) => {
      await p.evaluate(async ({ h, n }) => {
        /* a pending debounced replaceState from the last case can land between
       the assignment and the hashchange event, and the page then reads the
       OLD hash: retry until the URL carries this case's nonce */
    for (let k = 0; k < 5; k++){
      await new Promise(res => { window.addEventListener('hashchange', () => setTimeout(res, 0), { once: true });
                                 location.hash = h + '&nonce=' + n; });
      if (location.hash.indexOf('nonce=' + n) >= 0) break;
    }
      }, { h: 'z0=' + st.z0 + '&f=' + st.f + '&ee=1&r=' + st.r + '&x=' + st.x + '&practice=0&openStub=' +
              (st.open ? 1 : 0) + '&ymode=point&dd=' + (st.dd || 0.125), n: ++nonce });
      await p.evaluate(m => { const e = document.getElementById('i-method'); e.value = m;
                              e.dispatchEvent(new Event('change', { bubbles: true })); }, st.m);
      const why = test(await cardsOf());
      if (why) P.push(name + ': ' + why);
    };
    const num = s => firstNum(String(s));
    const after = s => num(String(s).split(/\s{3}/)[1] || '');
    /* Pozar, Microwave Engineering 4e, example 5.1: 200 - j100 on 100 ohm, 500 MHz.
       Pozar computes L and C from x rounded to 1.22; the exact x is 1.2247. */
    await ex('Pozar 5.1 L-network', { z0: 100, f: 500, r: 2, x: -1, m: 'lnet' }, c => {
      const a = c.find(q => num(q['shunt b']) > 0), b = c.find(q => num(q['shunt b']) < 0);
      if (c.length !== 2 || !a || !b) return c.length + ' designs';
      if (!(within(num(a['shunt b']), 0.29, 0.005) && within(num(a['series x']), 1.22, 0.006))) return JSON.stringify(a);
      if (!(within(after(a['shunt b']), 0.92, 0.005) && within(after(a['series x']), 38.8, 0.25))) return JSON.stringify(a);
      if (!(within(num(b['shunt b']), -0.69, 0.005) && within(num(b['series x']), -1.22, 0.006))) return JSON.stringify(b);
      if (!(within(after(b['shunt b']), 46.1, 0.06) && within(after(b['series x']), 2.61, 0.015))) return JSON.stringify(b);
    });
    /* 5.2: 60 - j80 on 50, shorted shunt stubs */
    await ex('Pozar 5.2 shunt stub', { z0: 50, f: 2000, r: 1.2, x: -1.6, m: 'shunt' }, c => {
      const want = [[0.110, 0.095], [0.260, 0.405]];
      if (c.length !== 2) return c.length + ' designs';
      for (let i = 0; i < 2; i++)
        if (!(within(num(c[i]['distance d']), want[i][0], 0.002) && within(num(c[i]['stub length']), want[i][1], 0.002)))
          return JSON.stringify(c[i]);
      if (!within(Math.abs(num(c[0]['stub must give'].replace(/^b = /, ''))), 1.47, 0.006)) return 'b ' + c[0]['stub must give'];
    });
    /* 5.3: 100 + j80 on 50, open series stubs */
    await ex('Pozar 5.3 series stub', { z0: 50, f: 2000, r: 2, x: 1.6, m: 'series', open: true }, c => {
      const want = [[0.120, 0.397], [0.463, 0.103]];
      if (c.length !== 2) return c.length + ' designs';
      for (let i = 0; i < 2; i++)
        if (!(within(num(c[i]['distance d']), want[i][0], 0.002) && within(num(c[i]['stub length']), want[i][1], 0.002)))
          return JSON.stringify(c[i]);
    });
    /* 5.4: 60 - j80 on 50, open stubs lambda/8 apart */
    await ex('Pozar 5.4 double stub', { z0: 50, f: 2000, r: 1.2, x: -1.6, m: 'dstub', open: true, dd: 0.125 }, c => {
      const want = [[1.314, 0.146, 3.38, 0.204], [-0.114, 0.482, -1.38, 0.350]];
      if (c.length !== 2) return c.length + ' designs';
      for (const w of want){
        const q = c.find(k => within(num(k['stub 1 gives'].replace(/^b = /, '')), w[0], 0.002));
        if (!q || !within(num(q['stub 1 length']), w[1], 0.002) ||
            !within(num(q['stub 2 gives'].replace(/^b = /, '')), w[2], 0.006) || !within(num(q['stub 2 length']), w[3], 0.002))
          return 'no design like ' + w + ' in ' + JSON.stringify(c);
      }
    });
    /* 5.5: a 10 ohm load to 50 ohm, Z1 = 22.36 */
    await ex('Pozar 5.5 quarter-wave', { z0: 50, f: 3000, r: 0.2, x: 0, m: 'qwt' }, c => {
      const q = c.find(k => num(k['distance d']) === 0);
      if (!q || !within(num(q['Z1']), 22.36, 0.05)) return JSON.stringify(c);
    });
    /* Jackson, ECE 3317 notes 13 (Houston): 50 + j75 on 50, transformer at the
       voltage maximum 0.074 lambda from the load. (The notes read SWR 4.3 off
       their chart and give 103.7 ohm; |Gamma| is exactly 0.6, so SWR = 4 and
       Z_T = 100 ohm, which is what is checked.) */
    await ex('Houston quarter-wave, complex load', { z0: 50, f: 1000, r: 1, x: 1.5, m: 'qwt' }, c => {
      const q = c.find(k => /maximum/.test(k['put it at the']));
      if (!q || !within(num(q['distance d']), 0.074, 0.002) || !within(num(q['Z1']), 100, 0.05)) return JSON.stringify(c);
    });
    /* same notes: 100 + j100 on 50, shorted shunt stub at 0.219 lambda, 0.090 lambda long */
    await ex('Houston shunt stub', { z0: 50, f: 1000, r: 2, x: 2, m: 'shunt' }, c => {
      if (!(c.length === 2 && within(num(c[0]['distance d']), 0.219, 0.002) && within(num(c[0]['stub length']), 0.090, 0.002) &&
            within(num(c[1]['distance d']), 0.363, 0.002))) return JSON.stringify(c);
    });
    bad('published examples', 'textbooks', P);
  }

  /* ---------- an exact half prints as one ----------
     75 ohms on a lambda/8 double-stub tuner needs a shorted stub 2 of exactly
     3/16 = 0.1875 lambda (b2 = -(sqrt2 - 1), -cot(3 pi/8) = 1 - sqrt2). It
     reaches the page as 0.18749999999999997, which printed 0.187; by hand it
     is 0.188. */
  {
    await setup({ r: 1.5, x: 0, m: 'dstub', open: false, ymode: 'point', dd: 0.125 });
    const cards = await p.evaluate(() => [...document.querySelectorAll('#sols .sol')].map(sl => {
      const o = {}; sl.querySelectorAll('dt').forEach(dt => { o[dt.textContent] = dt.nextElementSibling.textContent; }); return o; }));
    const d = T.dstub(T.C(1.5, 0), 0.125, false).find(q => Math.abs(q.ls2 - 0.1875) < 1e-9);
    const c = cards.find(q => /^0\.18[78]/.test(q['stub 2 length'] || ''));
    bad('exact halves round as by hand', '75 ohm dstub', (d && c && /^0\.188λ/.test(c['stub 2 length'])) ? [] :
        ['stub 2 printed ' + (c && c['stub 2 length'])]);
  }

  /* ---------- |Gamma| = 1 typed in is a reactive load ----------
     Entering the load as |Gamma| and angle used to clamp |Gamma| to 0.999999,
     which turned a lossless load into a slightly lossy one that the solvers
     then "matched". On the rim the load is jX, x = cot(theta/2). */
  for (const deg of [60, -120, 179]){
    await setup({ r: 0.5, x: -0.6, m: 'shunt', ymode: 'point' });
    const got = await p.evaluate(async (deg) => {
      const lm = document.getElementById('i-lmode');
      lm.value = 'g'; lm.dispatchEvent(new Event('change', { bubbles: true }));
      const a = document.getElementById('i-r'), b = document.getElementById('i-x');
      a.value = '1'; a.dispatchEvent(new Event('input', { bubbles: true }));
      b.value = String(deg); b.dispatchEvent(new Event('input', { bubbles: true }));
      const none = (document.querySelector('#sols .none') || {}).textContent || '';
      const z = (() => { const o = {}; document.querySelectorAll('#big dt').forEach(dt => { o[dt.textContent] = dt.nextElementSibling.textContent; }); return o; })();
      lm.value = 'rx'; lm.dispatchEvent(new Event('change', { bubbles: true }));
      return { none, cards: document.querySelectorAll('#sols [data-pick]').length, z: z['z = Z/Z0'],
               r: document.getElementById('i-r').value, x: document.getElementById('i-x').value };
    }, deg);
    const xWant = 1/Math.tan(deg*Math.PI/360);
    bad('|Γ| = 1 typed in is lossless', deg + ' deg', (/absorbs no power/.test(got.none) &&
        parseFloat(got.r) === 0 && Math.abs(parseFloat(got.x) - 50*xWant) <= 0.06*Math.max(1, Math.abs(50*xWant))/10)
        ? [] : [JSON.stringify(got) + ' want X = ' + (50*xWant).toFixed(2)]);
  }

  const keys = Object.keys(fails);
  s.note('designs drawn and checked: ' + Object.entries(counted).map(([k, v]) => k + ' ' + v).join(', '));
  s.check('every design was checked', (counted.shunt || 0) > 150 && (counted.series || 0) > 150 &&
          (counted.qwt || 0) > 80 && (counted.lnet || 0) > 80 && (counted.dstub || 0) > 200,
          JSON.stringify(counted));
  for (const k of ['grid in view', 'half turns', 'target circle', 'auxiliary circle', 'travel path',
                   'travel direction', 'travel lands on the target', 'stub path', 'marker', 'ring marks',
                   'ring label', 'stub arc', 'stub circle', 'stub arc label', 'words round the chart', 'readout at the stub',
                   'card', 'circuit', 'miniature circuit', 'picker', 'toggle label', 'transformer',
                   'transformer label', 'series path', 'shunt path', 'labels', 'design matches',
                   'forbidden circle', 'rotated circle', 'stub 1 path', 'spacing path', 'spacing direction',
                   'stub 2 path', 'forbidden region', 'solution count', 'matched load', 'purely reactive load',
                   'exact halves round as by hand', 'published examples', '|Γ| = 1 typed in is lossless']
                  .concat(keys).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
