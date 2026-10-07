/* The printed chart itself: are the grid and the scales where the theory puts
   them?

   construction.test.js checks the marks a solution draws ON the chart. This
   file checks the chart they are drawn on. A grid circle a few pixels out, or
   a wavelength scale numbered from the wrong end, would make every reading
   taken off the chart wrong while every printed number stayed right.

   SCALES. The page reports each number it letters round the rim and the
   angle it put it at (data-drawn "scale"). Each is held against the
   definition, not against the page's formula:
     wavelengths toward generator: 0 at the short (Gamma = -1), clockwise,
       half a wavelength per turn  ->  angle = pi - 4 pi w
     wavelengths toward load: the same, counter-clockwise
     reflection coefficient angle: the angle of Gamma itself
     transmission coefficient angle: arg(1 + e^{j theta}) = theta/2 on the rim,
       since 1 + e^{j theta} = 2cos(theta/2) e^{j theta/2} and the cosine is
       positive for |theta| < 180 deg (checked here as arg(1 + e^{j theta})
       computed directly, not as theta/2).

   GRID. A pixel probe that names no colour. The chart is rendered twice, once
   with the impedance grid and once with the admittance grid, and the two are
   differenced pixel by pixel. Where the theory puts an impedance line (and no
   admittance line), the difference must be large; where it puts neither, the
   difference must be nil. Constant r: centre r/(1+r), radius 1/(1+r);
   constant x: centre (1, 1/x), radius 1/|x|; the admittance grid is the same
   turned half a turn. Done at zoom 1, and again magnified and panned, where
   the mapping from Gamma to the screen has the most to get wrong.

   Run:  node tests/chart.test.js                                           */

const H = require('./lib/harness');
const TAU = 2*Math.PI;

/* the lines the chart prints (a design choice, not physics) */
const R_MAJ = [0.1,0.2,0.3,0.4,0.5,0.6,0.8,1,1.2,1.5,2,3,4,5,10,20];
const X_MAJ = [0.1,0.2,0.3,0.4,0.5,0.6,0.8,1,1.2,1.5,2,3,4,5,10,20];

const angMod = a => ((a % TAU) + TAU) % TAU;
const angGap = (a, b) => { const d = Math.abs(angMod(a) - angMod(b)); return Math.min(d, TAU - d); };

/* every grid line as [kind, centre, radius] in Gamma; kind 'line' is the axis */
function lines(turned){
  const k = turned ? -1 : 1, out = [];
  R_MAJ.forEach(r => out.push(['r=' + r, [k*r/(1 + r), 0], 1/(1 + r)]));
  X_MAJ.forEach(x => { out.push(['x=' + x, [k*1, k*1/x], 1/x]); out.push(['x=-' + x, [k*1, -k*1/x], 1/x]); });
  return out;
}
const distTo = (p, L) => Math.abs(Math.hypot(p[0] - L[1][0], p[1] - L[1][1]) - L[2]);

(async () => {
  const s = H.suite('chart');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1150 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);

  let nonce = 0;
  const show = (h) => p.evaluate(async ({ h, n }) => {
    /* a pending debounced replaceState from the last case can land between
       the assignment and the hashchange event, and the page then reads the
       OLD hash: retry until the URL carries this case's nonce */
    for (let k = 0; k < 5; k++){
      await new Promise(res => { window.addEventListener('hashchange', () => setTimeout(res, 0), { once: true });
                                 location.hash = h + '&nonce=' + n; });
      if (location.hash.indexOf('nonce=' + n) >= 0) break;
    }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return JSON.parse(document.getElementById('chart').getAttribute('data-drawn') || '{}');
  }, { h, n: ++nonce });

  /* ---------------- the scales ---------------- */
  const D = await show('r=0.5&x=-0.6&rings=1&grid=z&dense=0&zoom=1&cu=0&cv=0&practice=0');
  const sc = D.scale || [];
  const rows = {};
  sc.forEach(([row]) => { rows[row] = (rows[row] || 0) + 1; });
  s.note('scale numbers lettered: ' + JSON.stringify(rows));
  s.check('all four scales are lettered', rows.wtg === 10 && rows.wtl === 10 &&
          rows['reflection angle'] >= 16 && rows['transmission angle'] >= 14, JSON.stringify(rows));
  const bad = [];
  for (const [row, txt, ang] of sc){
    const v = parseFloat(String(txt).replace(/−/g, '-'));
    let want;
    if (row === 'wtg') want = Math.PI - 2*TAU*v;
    else if (row === 'wtl') want = Math.PI + 2*TAU*v;
    else if (row === 'reflection angle') want = v*Math.PI/180;
    else if (row === 'transmission angle'){
      /* the label v is printed at rim angle ang: arg(1 + e^{j ang}) must be v */
      /* at +-180 deg tau = 0 and its angle is the limit +-90, either side */
      if (angGap(ang, Math.PI) < 2e-6){ if (Math.abs(Math.abs(v) - 90) > 1e-9) bad.push(row + ' ' + txt + ' at 180 deg'); continue; }
      const tau = Math.atan2(Math.sin(ang), 1 + Math.cos(ang));
      if (Math.abs(tau*180/Math.PI - v) > 1e-4) bad.push(row + ' ' + txt + ' at ' + (ang*180/Math.PI).toFixed(2) + ' deg');
      continue;
    }
    /* data-drawn rounds to 1e-6 */
    if (angGap(ang, want) > 2e-6) bad.push(row + ' ' + txt + ' at ' + (ang*180/Math.PI).toFixed(2) + ' deg');
  }
  /* the wavelength scales read 0 and 0.25 where the definition says: the
     short (Gamma = -1) and the open (Gamma = +1) */
  const at = (row, txt) => (sc.find(q => q[0] === row && q[1] === txt) || [])[2];
  if (!(angGap(at('wtg', '.00'), Math.PI) < 2e-6 && angGap(at('wtg', '.25'), 0) < 2e-6)) bad.push('wtg .00/.25 not at short/open');
  if (!(angGap(at('wtl', '.00'), Math.PI) < 2e-6 && angGap(at('wtl', '.25'), 0) < 2e-6)) bad.push('wtl .00/.25 not at short/open');
  /* toward the generator is clockwise: .05 sits just clockwise of .00 */
  if (!(angMod(at('wtg', '.00') - at('wtg', '.05')) < 0.7)) bad.push('wtg does not run clockwise');
  if (!(angMod(at('wtl', '.05') - at('wtl', '.00')) < 0.7)) bad.push('wtl does not run counter-clockwise');
  s.check('every scale number is at the angle its definition gives', bad.length === 0, bad.slice(0, 4).join(' | '));

  /* ---------------- the grid ---------------- */
  /* The load is matched, so there is no SWR circle; the markers sit at the
     centre, which the samples avoid, as they avoid the axis labels and the
     rim labels. */
  async function probe(want){
    let view = want;
    const base = 'r=1&x=0&rings=1&dense=0&practice=0&zoom=' + view.zoom + '&cu=' + view.cu + '&cv=' + view.cv;
    const dz = await show(base + '&grid=z');
    await p.evaluate(() => { const cv = document.getElementById('chart');
      window.__A = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; });
    const dy = await show(base + '&grid=y');
    const geo = dz.geo, R = geo[2];
    if (JSON.stringify(dz.geo) !== JSON.stringify(dy.geo)) return { err: 'geometry changed between renders' };
    /* the view the page actually applied: it keeps the disc on screen, so a
       requested pan can be clamped */
    view = Object.assign({}, view, { zoom: geo[3], cu: geo[4], cv: geo[5] });
    if (Math.abs(view.zoom - want.zoom) > 1e-9) return { err: 'zoom not applied' };
    /* Gamma to CSS px under the view's zoom and pan */
    const toPx = q => [geo[0] + view.zoom*(q[0] - view.cu)*R, geo[1] - view.zoom*(q[1] - view.cv)*R];
    const pxTol = 7/(view.zoom*R);                      /* clearance, in Gamma */
    const Z = lines(false), Y = lines(true);
    const all = Z.concat(Y);
    const ok = q => { const m = Math.hypot(q[0], q[1]);
      return m > 0.1 && m < 0.86 && Math.abs(q[1]) > 0.07; };
    const pos = [], neg = [];
    /* on each line, away from every other line of either grid */
    [[Z, 'impedance'], [Y, 'admittance']].forEach(([set, which]) => set.forEach((L, li) => {
      let got = 0;
      for (let i = 0; i < 720 && got < 6; i++){
        const a = (i*137.508)*Math.PI/180;              /* golden-angle spread */
        const q = [L[1][0] + L[2]*Math.cos(a), L[1][1] + L[2]*Math.sin(a)];
        if (!ok(q)) continue;
        if (all.some((M, mi) => M !== L && distTo(q, M) < pxTol)) continue;
        const px = toPx(q);
        pos.push({ which, line: L[0], px }); got++;
      }
    }));
    /* a fine lattice, keeping the points clear of every line of both grids */
    /* 5x5 window (2 px) plus the stroke half-width, which the zoom scales */
    const step = 1/(view.zoom*R), clear = (4 + view.zoom)*step;
    for (let u = -0.86; u <= 0.86 && neg.length < 400; u += 11*step)
      for (let v = -0.86; v <= 0.86 && neg.length < 400; v += 7*step){
        const q = [u, v], px = toPx(q);
        if (!ok(q) || px[0] < 4 || px[1] < 4 || px[0] > 2*geo[0] - 4 || px[1] > 2*geo[1] - 4) continue;
        if (all.some(M => distTo(q, M) < clear)) continue;
        neg.push({ px, q });
      }
    const vals = await p.evaluate(({ pts }) => {
      const cv = document.getElementById('chart');
      const B = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, A = window.__A;
      const k = cv.width/cv.getBoundingClientRect().width;
      return pts.map(([x, y]) => {
        let best = 0;
        const X = Math.round(x*k), Y = Math.round(y*k);
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++){
          const xx = X + dx, yy = Y + dy;
          if (xx < 0 || yy < 0 || xx >= cv.width || yy >= cv.height) return -1;
          const o = (yy*cv.width + xx)*4;
          const d = Math.abs(A[o] - B[o]) + Math.abs(A[o+1] - B[o+1]) + Math.abs(A[o+2] - B[o+2]);
          if (d > best) best = d;
        }
        return best;
      });
    }, { pts: pos.map(q => q.px).concat(neg.map(q => q.px)) });
    pos.forEach((q, i) => { q.v = vals[i]; });
    neg.forEach((q, i) => { q.v = vals[pos.length + i]; });
    return { pos: pos.filter(q => q.v >= 0), neg: neg.filter(q => q.v >= 0), R };
  }

  for (const view of [{ zoom: 1, cu: 0, cv: 0, name: 'zoom 1' },
                      { zoom: 3, cu: 0.25, cv: 0.2, name: 'zoom 3, panned' }]){
    const r = await probe(view);
    if (r.err){ s.check(view.name + ': probe', false, r.err); continue; }
    const linesHit = new Set(r.pos.map(q => q.which + ' ' + q.line));
    const missing = r.pos.filter(q => q.v < 40);
    const stray = r.neg.filter(q => q.v > 12);
    s.note(view.name + ': ' + r.pos.length + ' points on ' + linesHit.size + ' grid lines, ' +
           r.neg.length + ' points between lines');
    s.check(view.name + ': enough of the grid is probed', linesHit.size >= (view.zoom === 1 ? 40 : 12) && r.neg.length >= 100,
            linesHit.size + ' lines, ' + r.neg.length + ' gaps');
    s.check(view.name + ': every grid line is where the theory puts it', missing.length === 0,
            missing.slice(0, 4).map(q => q.which + ' ' + q.line + ' diff ' + q.v).join(' | '));
    s.check(view.name + ': nothing is drawn where no grid line belongs', stray.length === 0,
            stray.slice(0, 4).map(q => q.px.map(v => v.toFixed(0)) + ' (Gamma ' + q.q.map(v => v.toFixed(3)) + ', nearest line ' + (() => { const L = lines(false).concat(lines(true)).map(M => [M[0], distTo(q.q, M)*view.zoom*r.R]).sort((a, b) => a[1] - b[1])[0]; return L[0] + ' at ' + L[1].toFixed(1) + 'px'; })() + ') diff ' + q.v).join(' | '));
  }

  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
