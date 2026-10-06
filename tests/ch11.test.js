/* Chapter 11, matching: every computed figure against the theory.

   Expectations come from lib/tline (designs by bisection on the tangent
   formula; lengths that scale with frequency handled by the same formula at
   the scaled length) and from cascading actual components. Where the chapter
   states a property -- the escape from the forbidden region needs at most a
   quarter wave, a pi network's Q cannot go below the L-network's, no network
   beats the Bode-Fano floor -- the property itself is tested.

   Run:  node tests/ch11.test.js                                            */

const H = require('./lib/harness');
const T = require('./lib/tline');
const TAU = 2*Math.PI;

const gam = z => { const g = T.div(T.add(z, T.C(-1, 0)), T.add(z, T.C(1, 0))); return [g.re, g.im]; };
const gAbs = z => Math.hypot(...gam(z));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const angGap = (a, b) => { const d = Math.abs(((a - b) % TAU + TAU) % TAU); return Math.min(d, TAU - d); };
const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
const num = s => parseFloat(String(s).replace(/\u2212/g, '-'));

/* the contiguous band around f0 with f(k) <= lim, fine scan then bisection */
function bandIndep(f, lim, KLO, KHI){
  if (f(1) > lim) return null;
  let lo = 1, hi = 1, nx; const st = 1e-4;
  while (lo > KLO){ nx = Math.max(KLO, lo - st); if (f(nx) > lim) break; lo = nx; }
  while (hi < KHI){ nx = Math.min(KHI, hi + st); if (f(nx) > lim) break; hi = nx; }
  const edge = (a, b) => { for (let i = 0; i < 70; i++){ const m = (a + b)/2; if (f(m) <= lim) a = m; else b = m; } return a; };
  const open = lo <= KLO || hi >= KHI;
  if (lo > KLO) lo = edge(lo, Math.max(KLO, lo - st));
  if (hi < KHI) hi = edge(hi, Math.min(KHI, hi + st));
  return { frac: hi - lo, lo, hi, open };
}
const bandTxtOk = (txt, b) => {
  txt = String(txt).replace(/\u2014/g, '-').trim();
  if (b === null) return txt === '-';
  const m = txt.match(/^(> )?(\d+\.\d) %$/);
  return !!m && !!m[1] === !!b.open && printedOk(+m[2], 100*b.frac, 1);
};

(async () => {
  const s = H.suite('ch11');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'matching.html', { waitUntil: 'load' });
  await p.waitForTimeout(1800);

  const drawn = id => p.evaluate(id => JSON.parse(document.getElementById(id).getAttribute('data-drawn') || 'null'), id);
  const text = id => p.evaluate(id => document.getElementById(id).textContent, id);
  const html = id => p.evaluate(id => document.getElementById(id).innerHTML, id);
  const setInput = (id, v) => p.evaluate(({ id, v }) => {
    const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, v });
  const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fails = {};
  const bad = (k, why) => (fails[k] = fails[k] || []).push(why);

  /* ================= the single-stub figure ================= */
  const LOADS = [[2, 0], [0.5, 0], [1, 1.5], [0.3, -0.6], [3, 2], [0.05, 4.9], [6, -5], [1, 0.4], [0.8, -0.1]];
  for (const [r, x] of LOADS) for (const open of [false, true]) for (const which of [0, 1]){
    await p.evaluate(({ r, x, open, which }) => {
      document.getElementById('mr').value = r; document.getElementById('mx').value = x;
      const tb = document.getElementById('typ');
      if ((tb.textContent === 'Open stub') !== open) tb.click();
      const D = JSON.parse(document.getElementById('match').getAttribute('data-drawn') || '{}');
      if (D.which !== undefined && D.which !== which) document.getElementById('alt').click();
      document.getElementById('mr').dispatchEvent(new Event('input', { bubbles: true }));
    }, { r, x, open, which });
    await frame();
    let D = await drawn('match');
    if (D.which !== which){ await p.evaluate(() => document.getElementById('alt').click()); await frame(); D = await drawn('match'); }
    const tag = 'z ' + r + ' ' + x + (open ? ' open' : ' short') + ' #' + which;
    const zL = T.C(r, x), des = T.shunt(zL, open);
    /* the page's design is one of the theory's */
    const t = des.find(q => Math.min(Math.abs(q.d - D.d), 0.5 - Math.abs(q.d - D.d)) < 1e-7);
    if (!t){ bad('single stub: a theory design', tag + ': d ' + D.d + ' vs ' + des.map(q => q.d.toFixed(5))); continue; }
    if (Math.abs(t.ls - D.ls) > 1e-7 && Math.abs(Math.abs(t.ls - D.ls) - 0.5) > 1e-7) bad('single stub: stub length', tag + ': ' + D.ls + ' vs ' + t.ls);
    if (dist(D.load, gam(zL)) > 1e-9) bad('single stub: the load', tag);
    const zd = T.zin(zL, D.d), yd = T.invc(zd);
    if (dist(D.at, gam(zd)) > 1e-7) bad('single stub: where travel lands', tag + ': ' + D.at + ' vs ' + gam(zd));
    if (Math.abs(yd.re - 1) > 1e-7) bad('single stub: lands on g = 1', tag + ': g = ' + yd.re);
    if (Math.abs(D.b - yd.im) > 1e-6) bad('single stub: b there', tag + ': ' + D.b + ' vs ' + yd.im);
    /* the stub presents -b at the stub's own length */
    const sy = T.stubY(D.ls, open);
    if (Math.abs(sy.im + yd.im) > 1e-6*Math.max(1, Math.abs(yd.im))) bad('single stub: stub cancels b', tag + ': stub gives ' + sy.im);
    /* the drawing: travel clockwise from the load by 4 pi d; stub arc on g = 1 from the landing point to the centre */
    if (angGap(D.travel[0], Math.atan2(gam(zL)[1], gam(zL)[0])) > 1e-7 || Math.abs((D.travel[0] - D.travel[1]) - 2*TAU*D.d) > 1e-7)
      bad('single stub: travel arc', tag);
    if (dist(D.target, [-0.5, 0, 0.5].slice(0, 2)) > 1e-12 || D.target[2] !== 0.5) bad('single stub: g = 1 circle', tag);
    { const yOnCircle = Math.hypot(D.at[0] + 0.5, D.at[1]) - 0.5;
      const sa = D.stubArc, a = sa.from;
      if (Math.abs(yOnCircle) > 1e-7) bad('single stub: stub arc', tag + ': landing point off g = 1 by ' + yOnCircle);
      if (angGap(a, Math.atan2(D.at[1], D.at[0] + 0.5)) > 1e-7) bad('single stub: stub arc', tag + ': does not start at the landing point');
      if (sa.to !== 0) bad('single stub: stub arc', tag + ': does not end at the centre');
      /* the short way to the centre, never through Gamma = -1 (angle pi on this
         circle): on screen (y down) that is anticlockwise from below the axis */
      if (D.at[1] !== 0 && sa.ccwOnScreen !== (D.at[1] < 0)) bad('single stub: stub arc', tag + ': goes the long way round, through -1'); }
    /* readouts */
    const m = gAbs(zL);
    if (!printedOk(num(await text('m-swr')), (1 + m)/(1 - m), 2)) bad('single stub: SWR readout', tag + ': ' + await text('m-swr'));
    if (!printedOk(num(await text('m-d')), D.d, 3)) bad('single stub: d readout', tag + ': ' + await text('m-d'));
    if (!printedOk(num(await text('m-ls')), D.ls, 3)) bad('single stub: stub readout', tag + ': ' + await text('m-ls'));
    const ym = String(await text('m-y')).replace(/\u2212/g, '-').match(/^1 ([+-]) j(\d+\.\d\d)$/);
    if (!(ym && printedOk((ym[1] === '-' ? -1 : 1)*(+ym[2]), yd.im, 2))) bad('single stub: y there readout', tag + ': ' + await text('m-y'));
    if (await text('m-tot') !== '1.00 + j0.00') bad('single stub: matched after the stub', tag + ': ' + await text('m-tot'));
  }
  /* both crossings are offered */
  { await p.evaluate(() => { document.querySelector('button[data-m="1,1.5"]').click(); });
    const a = await drawn('match'); await p.evaluate(() => document.getElementById('alt').click()); const c = await drawn('match');
    if (Math.abs(a.d - c.d) < 1e-6) bad('single stub: other solution is another design', a.d + ' ' + c.d); }

  /* ================= the four designs across frequency ================= */
  for (const [r, x] of [[2, 0], [0.5, 0.5], [4.5, -1.5], [0.2, 2], [1.3, 0.1], [1, 0.3], [3, 1]]){
    await setInput('ch-r', r); await setInput('ch-x', x); await frame();
    const D = await drawn('chfig'), tag = 'z ' + r + ' ' + x, zL = T.C(r, x);
    const theory = [].concat(T.shunt(zL, false).map(q => Object.assign({ open: false }, q)),
                             T.shunt(zL, true).map(q => Object.assign({ open: true }, q)));
    if (D.designs.length !== theory.length) bad('four designs: all four', tag + ': ' + D.designs.length);
    const html0 = await html('ch-ro');
    for (const d of D.designs){
      const t = theory.find(q => q.open === d.open && Math.abs(q.d - d.d) < 1e-6);
      if (!t){ bad('four designs: each is a theory design', tag + ': ' + JSON.stringify([d.d, d.ls, d.open])); continue; }
      if (Math.abs(t.ls - d.ls) > 1e-6) bad('four designs: stub lengths', tag + ': ' + d.ls + ' vs ' + t.ls);
      const resp = k => gAbs(T.invc(T.add(T.invc(T.zin(zL, t.d*k)), T.stubY(t.ls*k, t.open))));
      const worst = Math.max(...d.curve.map(([k, g]) => Math.abs(g - resp(k))));
      if (worst > 1e-6) bad('four designs: curves are the theory', tag + ': off by ' + worst.toExponential(2));
      if (resp(1) > 1e-6) bad('four designs: matched at f0', tag);
      const bi = bandIndep(resp, 0.2, 0.005, 2);
      if ((bi === null) !== (d.band === null) || (bi && (Math.abs(bi.lo - d.band.lo) > 1e-6 || Math.abs(bi.hi - d.band.hi) > 1e-6 || bi.open !== d.band.open)))
        bad('four designs: band edges', tag + ': page ' + JSON.stringify(d.band) + ' theory ' + JSON.stringify(bi));
      /* the readout row for this design */
      const row = html0.split('</div>').find(q => q.indexOf('d ' + d.d.toFixed(3) + 'λ, ' + (d.open ? 'open ' : 'short ') + d.ls.toFixed(3)) >= 0);
      const dd = row && row.split('<dd>')[1].split('</dd>')[0];
      if (!row || !bandTxtOk(dd.replace(/&gt;/g, '>').replace(/&mdash;/g, '\u2014'), bi)) bad('four designs: band readouts', tag + ': ' + dd + ' vs ' + JSON.stringify(bi));
    }
  }

  /* ================= escaping the forbidden region ================= */
  let worstEscape = 0;
  for (const g of [2.05, 2.5, 3, 4, 6]) for (const bl of [-2, -1, 0, 0.5, 2]){
    await setInput('es-g', g); await setInput('es-b', bl); await frame();
    const D = await drawn('esfig'), tag = 'y ' + g + ' ' + bl;
    const yL = T.C(g, bl), yAt = l => T.zin(yL, l);     /* an admittance moves by the same rule */
    /* the shortest line taking g to 2, by fine scan and bisection */
    let l0 = null; for (let l = 0; l <= 0.5; l += 2e-5) if (yAt(l).re <= 2){ l0 = l; break; }
    let a = l0 - 2e-5, c = l0; for (let i = 0; i < 70; i++){ const m = (a + c)/2; if (yAt(m).re <= 2) c = m; else a = m; }
    const lw = c;
    worstEscape = Math.max(worstEscape, lw);
    if (Math.abs(D.l - lw) > 1e-7) bad('escape: line length', tag + ': ' + D.l + ' vs ' + lw);
    if (!printedOk(num(await text('es-l')), lw, 3)) bad('escape: line length readout', tag + ': ' + await text('es-l'));
    const ya = yAt(lw);
    if (!printedOk(num(await text('es-g2')), ya.re, 3)) bad('escape: g after it readout', tag + ': ' + await text('es-g2'));
    /* the path: on the load's constant-|Gamma| circle, from the load to the end */
    const m0 = gAbs(yL);
    if (D.path.some(q => Math.abs(gAbs(T.C(q[0], q[1])) - m0) > 1e-7) || dist(D.path[0], [g, bl]) > 1e-9 ||
        dist(D.path[D.path.length - 1], [ya.re, ya.im]) > 1e-6) bad('escape: the added line on its SWR circle', tag);
    /* the stubs then: one of the lambda/8 tuner's designs for that admittance.
       There g sits at the limit 1/sin^2(pi/4) = 2, a double root, so b just
       after stub 1 is 1/t = 1 */
    const b1 = 1 - ya.im, yA = T.C(ya.re, 1), yB = T.invc(T.zin(T.invc(yA), 0.125)), b2 = -yB.im;
    if (!(D.stubs && Math.abs(D.stubs.s1 - b1) < 2e-3 && Math.abs(D.stubs.s2 - b2) < 2e-3)) bad('escape: stub susceptances', tag + ': ' + JSON.stringify(D.stubs) + ' vs ' + [b1, b2]);
    const st = String(await text('es-s')).replace(/\u2212/g, '-').match(/^j(-?\d+\.\d\d) \/ j(-?\d+\.\d\d)$/);
    if (!(st && printedOk(+st[1], D.stubs.s1, 2) && printedOk(+st[2], D.stubs.s2, 2))) bad('escape: stubs readout', tag + ': ' + await text('es-s'));
  }
  if (!(worstEscape <= 0.25)) bad('escape: never more than a quarter wave (as claimed)', 'worst ' + worstEscape);

  /* ================= three lumped matches ================= */
  for (const RL of [60, 120, 200, 450, 800]) for (const Qp of [1, 3, 5.5, 8]){
    await setInput('lq-r', RL); await setInput('lq-q', Qp); await frame();
    const D = await drawn('lqfig'), tag = 'RL ' + RL + ' Qpi ' + Qp, Z0 = 50;
    /* cascade the actual parts: shunt C across what is there, then a series L */
    const zOf = (parts, f) => { let z = T.C(RL, 0);
      for (const sct of parts){ z = T.invc(T.add(T.invc(z), T.C(0, sct.shunt*f))); if (!sct.shuntLast) z = T.add(z, T.C(0, sct.series*f)); }
      return z; };
    const gOf = (parts, f) => { const z = zOf(parts, f); return Math.hypot(...(() => { const g = T.div(T.add(z, T.C(-Z0, 0)), T.add(z, T.C(Z0, 0))); return [g.re, g.im]; })()); };
    const qmin = Math.sqrt(RL/Z0 - 1);
    for (const name of ['single', 'cascade', 'pi']){
      const n = D.nets[name];
      if (n.parts.some(q => !(q.shunt > 0) || q.series < 0)) bad('lumped: inductors in series, capacitors in shunt', tag + ' ' + name);
      /* part values are published rounded to 1e-9, about 1e-7 of a shunt
         susceptance near 1/R, so the cascade is held to 1e-6 */
      if (gOf(n.parts, 1) > 1e-6) bad('lumped: each network matches at f0', tag + ' ' + name + ': ' + gOf(n.parts, 1));
      const worst = Math.max(...n.curve.map(([f, g]) => Math.abs(g - gOf(n.parts, f))));
      if (worst > 1e-6) bad('lumped: curves are the cascade', tag + ' ' + name + ': ' + worst);
      const bi = bandIndep(f => gOf(n.parts, f), 0.2, 0.005, 2);
      if ((bi === null) !== (n.band === null) || (bi && (Math.abs(bi.lo - n.band.lo) > 1e-5 || Math.abs(bi.hi - n.band.hi) > 1e-5)))
        bad('lumped: band edges', tag + ' ' + name + ': ' + JSON.stringify(n.band) + ' vs ' + JSON.stringify(bi));
    }
    /* node Qs: B x R at the load node is the network's Q there */
    if (Math.abs(D.nets.single.parts[0].shunt*RL - qmin) > 1e-6 || Math.abs(D.qmin - qmin) > 1e-8) bad('lumped: single L-network Q', tag);
    const Rm = Math.sqrt(RL*Z0), zMid = zOf([D.nets.cascade.parts[0]], 1);
    if (Math.abs(zMid.re - Rm) > 1e-4 || Math.abs(zMid.im) > 1e-4) bad('lumped: cascade steps through sqrt(RL Z0)', tag + ': ' + zMid.re + ' vs ' + Rm);
    if (Math.abs(D.qc - Math.sqrt(RL/Rm - 1)) > 1e-8) bad('lumped: cascade Q', tag + ': ' + D.qc);
    if (Math.abs(D.nets.pi.parts[0].shunt*RL - D.q) > 1e-6) bad('lumped: pi network Q', tag + ': ' + D.nets.pi.parts[0].shunt*RL + ' vs ' + D.q);
    if (!(D.q > qmin)) bad('lumped: a pi network cannot have Q below the L (as claimed)', tag);
    if (!(D.qc < qmin)) bad('lumped: the cascade has the lower Q (as claimed)', tag);
  }

  /* ================= the Bode-Fano floor ================= */
  for (const Q of [0.5, 2, 4.4, 10]){
    await setInput('bf-q', Q); await frame();
    const D = await drawn('bffig'), tag = 'Q ' + Q;
    /* R = Z0 = 1, C = Q, L = 1/Q at w0 = 1: y = 1 + j(fC - 1/(fL)) */
    const gAt = f => { const y = T.C(1, f*Q - Q/f); return gAbs(T.invc(y)); };
    const worstIn = w => { let mx = 0; for (let i = 0; i <= 2000; i++){ const f = 1 - w/2 + w*i/2000; mx = Math.max(mx, f <= 0 ? 1 : gAt(f)); } return mx; };
    for (const [w, v] of D.bound) if (Math.abs(v - Math.exp(-Math.PI/(Q*w))) > 1e-9) bad('Bode-Fano: the floor', tag + ' w ' + w);
    for (const [w, v] of D.simple){
      if (Math.abs(v - worstIn(w)) > 1e-8) bad('Bode-Fano: one shunt inductor, worst in the band', tag + ' w ' + w + ': ' + v + ' vs ' + worstIn(w));
      if (v < Math.exp(-Math.PI/(Q*w)) - 1e-12) bad('Bode-Fano: nothing beats the floor (as claimed)', tag + ' w ' + w);
    }
    const fmOk = (txt, pre, v) => {
      const t = String(txt).replace(/\u2212/g, '-');
      if (v >= 0.01){ const m = t.match(new RegExp('^' + pre + '(\\d+\\.\\d{3})$')); return !!m && printedOk(+m[1], v, 3); }
      const m = t.match(new RegExp('^' + pre + '(\\d+\\.\\d)\u00d710(-\\d+)$'));
      return !!m && Math.abs(+m[1]*Math.pow(10, +m[2]) - v) <= 0.05*Math.pow(10, +m[2]) + 1e-15;
    };
    if (!fmOk(await text('bf-b'), '\\|\u0393\\| \u2265 ', Math.exp(-Math.PI/(Q*0.2)))) bad('Bode-Fano: readouts', tag + ': ' + await text('bf-b'));
    if (!fmOk(await text('bf-l'), '\\|\u0393\\| = ', worstIn(0.2))) bad('Bode-Fano: readouts', tag + ': ' + await text('bf-l'));
    if (!fmOk(await text('bf-c'), '\\|\u0393\\| \u2265 ', Math.exp(-Math.PI/(Q*0.5)))) bad('Bode-Fano: readouts', tag + ': ' + await text('bf-c'));
  }

  const keys = ['single stub: a theory design', 'single stub: stub length', 'single stub: the load', 'single stub: where travel lands',
    'single stub: lands on g = 1', 'single stub: b there', 'single stub: stub cancels b', 'single stub: travel arc',
    'single stub: g = 1 circle', 'single stub: stub arc', 'single stub: SWR readout', 'single stub: d readout',
    'single stub: stub readout', 'single stub: y there readout', 'single stub: matched after the stub',
    'single stub: other solution is another design',
    'four designs: all four', 'four designs: each is a theory design', 'four designs: stub lengths',
    'four designs: curves are the theory', 'four designs: matched at f0', 'four designs: band edges', 'four designs: band readouts',
    'escape: line length', 'escape: line length readout', 'escape: g after it readout', 'escape: the added line on its SWR circle',
    'escape: stub susceptances', 'escape: stubs readout', 'escape: never more than a quarter wave (as claimed)',
    'lumped: inductors in series, capacitors in shunt', 'lumped: each network matches at f0', 'lumped: curves are the cascade',
    'lumped: band edges', 'lumped: single L-network Q', 'lumped: cascade steps through sqrt(RL Z0)', 'lumped: cascade Q',
    'lumped: pi network Q', 'lumped: a pi network cannot have Q below the L (as claimed)', 'lumped: the cascade has the lower Q (as claimed)',
    'Bode-Fano: the floor', 'Bode-Fano: one shunt inductor, worst in the band', 'Bode-Fano: nothing beats the floor (as claimed)',
    'Bode-Fano: readouts'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
