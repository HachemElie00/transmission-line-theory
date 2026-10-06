/* Practice mode: the reader constructs the match themselves and the tool says
   whether what they built is matched.

   The thing worth testing is not that the tool's answer is accepted -- that
   would pass even if the check were `your numbers === my numbers`. It is that
   EVERY correct answer is accepted and wrong ones are not. A single stub has
   two positions; a stub half a wavelength longer is the same stub; an
   L-network has two orders. A check built by comparison would mark most of
   those wrong, which is the worst possible thing to do to someone learning.

   So the designs here are derived from the theory in this file, independently
   of the page, and one of them is deliberately outside the set the solver
   returns at all.

   Run:  node tests/practice.test.js                                        */

const H = require('./lib/harness');
const TAU = Math.PI * 2;

/* ---- independent designs, from the theory ---- */
function gamma(r, x){
  const dr = r + 1, di = x, d = dr*dr + di*di;
  return [((r-1)*dr + x*di)/d, (x*dr - (r-1)*di)/d];
}
function stubLen(need, isOpen, isSeries){
  const direct = isSeries ? !isOpen : isOpen;
  let a = direct ? Math.atan(need) : Math.atan2(-1, need);
  while (a < 0) a += Math.PI;
  while (a >= Math.PI) a -= Math.PI;
  return a / TAU;
}
const wrapHalf = d => (((d % 0.5) + 0.5) % 0.5);

/* single stub, both positions. series=false is the shunt case. */
function stubDesigns(r, x, isOpen, series){
  const g = gamma(r, x), m = Math.hypot(g[0], g[1]), th = Math.atan2(g[1], g[0]);
  const out = [];
  for (const sgn of [1, -1]){
    const u = series ? m*m : -m*m;
    const v = sgn * m * Math.sqrt(Math.max(0, 1 - m*m));
    const d = wrapHalf((th - Math.atan2(v, u)) / (2*TAU));
    const line = series ? 2*v/(1 - m*m) : -2*v/(1 - m*m);
    out.push({ d, ls: stubLen(-line, isOpen, series) });
  }
  return out.sort((a, b) => a.d - b.d);
}

/* quarter-wave transformer at the voltage maximum and minimum */
function qwtDesigns(r, x, z0){
  const g = gamma(r, x), m = Math.hypot(g[0], g[1]), th = Math.atan2(g[1], g[0]);
  const swr = (1 + m) / (1 - m);
  return [
    { d: wrapHalf(th / (2*TAU)),                z1: z0 * Math.sqrt(swr) },
    { d: wrapHalf((th - Math.PI) / (2*TAU)),    z1: z0 * Math.sqrt(1/swr) }
  ].sort((a, b) => a.d - b.d);
}

/* L-network, both orders, both roots */
function lnetDesigns(r, x){
  const out = [];
  if (r <= 1){
    const root = Math.sqrt(Math.max(0, r*(1 - r)));
    for (const sg of [1, -1]){
      const x1 = sg*root;
      out.push({ order: 'series', x1: x1 - x, b1: x1/r });
    }
  }
  const d = r*r + x*x, g = r/d, bb = -x/d;
  if (g <= 1){
    const root = Math.sqrt(Math.max(0, g*(1 - g)));
    for (const sg of [1, -1]){
      const b1 = sg*root;
      out.push({ order: 'shunt', b1: b1 - bb, x1: b1/g });
    }
  }
  return out;
}

(async () => {
  const s = H.suite('practice');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1150 } })).newPage();
  const errs = H.watchErrors(p);

  await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
  await p.waitForTimeout(2600);

  const set = (id, v) => p.evaluate(({ id, v }) => {
    const e = document.getElementById(id);
    if (!e) return false;
    e.value = String(v);
    e.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, { id, v });

  const verdict = () => p.evaluate(() => {
    const v = document.getElementById('prac-verdict');
    return { ok: v.getAttribute('data-ok') === '1', text: v.textContent.trim(),
             hidden: document.getElementById('prac').hidden };
  });

  /* Start a method cleanly: practice on, this method selected, attempt reset.

     The method buttons are toggles -- pressing the selected one turns it off.
     An earlier version of this helper just clicked the button, so every second
     call switched the method OFF and the checks that followed were reading a
     hidden panel. It failed in an alternating pattern that looked exactly like
     a flaky app. Clear whatever is selected first. */
  async function begin(m){
    await p.evaluate(() => {
      const pb = document.getElementById('b-prac');
      if (pb.getAttribute('aria-pressed') === 'true') pb.click();
    });
    await p.waitForTimeout(150);
    await p.click('#b-prac'); await p.waitForTimeout(200);
    await p.evaluate(m => {
      const sel = document.getElementById('i-method');
      sel.value = '';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.value = m;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }, m);
    await p.waitForTimeout(450);
    /* Shunt work now begins with the reader turning the point half a turn to
       get y, on the impedance grid. It changes nothing physical, so it is not
       part of what the checks below are testing -- but the steps do not tick
       along without it. */
    if (m === 'shunt' || m === 'dstub'){
      const need = await p.evaluate(() =>
        !document.getElementById('prac-rot').hidden &&
        document.getElementById('b-rot').getAttribute('aria-pressed') !== 'true');
      if (need){ await p.click('#b-rot'); await p.waitForTimeout(250); }
    }
  }

  /* The load the page starts with: 25 - j30 on 50 ohm, i.e. 0.5 - j0.6. */
  const R = 0.5, X = -0.6, Z0 = 50, isOpen = false;

  s.check('practice panel appears with a method',
          await (async () => { await begin('shunt'); return !(await verdict()).hidden; })());

  /* ---- single shunt stub: both positions ---- */
  {
    const designs = stubDesigns(R, X, isOpen, false);
    for (let i = 0; i < designs.length; i++){
      await begin('shunt');
      await set('i-d', designs[i].d.toFixed(3)); await p.waitForTimeout(250);
      await set('p-l1', designs[i].ls.toFixed(4)); await p.waitForTimeout(350);
      const v = await verdict();
      s.check('shunt stub, position ' + (i+1) + ' accepted', v.ok,
              'd=' + designs[i].d.toFixed(3) + ' ls=' + designs[i].ls.toFixed(4) + '  ' + v.text);
    }

    /* A stub half a wavelength longer is the same stub. The solver only ever
       returns lengths in [0, 0.5), so this is a correct answer it would never
       produce -- if the check were a comparison, this would fail. */
    await begin('shunt');
    await set('i-d', designs[0].d.toFixed(3)); await p.waitForTimeout(250);
    await set('p-l1', (designs[0].ls + 0.5).toFixed(4)); await p.waitForTimeout(350);
    const v2 = await verdict();
    s.check('a stub half a wavelength longer is still accepted', v2.ok, v2.text);
  }

  /* ---- single series stub ---- */
  {
    const designs = stubDesigns(R, X, isOpen, true);
    await begin('series');
    await set('i-d', designs[0].d.toFixed(3)); await p.waitForTimeout(250);
    await set('p-l1', designs[0].ls.toFixed(4)); await p.waitForTimeout(350);
    const v = await verdict();
    s.check('series stub accepted', v.ok,
            'd=' + designs[0].d.toFixed(3) + ' ls=' + designs[0].ls.toFixed(4) + '  ' + v.text);
  }

  /* ---- quarter-wave transformer, at the maximum and the minimum ---- */
  {
    const designs = qwtDesigns(R, X, Z0);
    for (let i = 0; i < designs.length; i++){
      await begin('qwt');
      await set('i-d', designs[i].d.toFixed(3)); await p.waitForTimeout(250);
      await set('p-z1', designs[i].z1.toFixed(3)); await p.waitForTimeout(350);
      const v = await verdict();
      s.check('quarter-wave transformer ' + (i+1) + ' accepted', v.ok,
              'd=' + designs[i].d.toFixed(3) + ' Z1=' + designs[i].z1.toFixed(2) + '  ' + v.text);
    }
  }

  /* ---- L-network, every order and root that exists for this load ---- */
  {
    const designs = lnetDesigns(R, X);
    for (let i = 0; i < designs.length; i++){
      const d = designs[i];
      await begin('lnet');
      const order = await p.evaluate(() => {
        const btn = document.getElementById('p-order');
        return btn ? btn.textContent.trim() : '';
      });
      if ((d.order === 'shunt') !== /shunt/.test(order)){
        await p.click('#p-order'); await p.waitForTimeout(300);
      }
      await set('p-x1', d.x1.toFixed(4)); await p.waitForTimeout(220);
      await set('p-b1', d.b1.toFixed(4)); await p.waitForTimeout(350);
      const v = await verdict();
      s.check('L-network (' + d.order + ' first, root ' + (i+1) + ') accepted', v.ok,
              'x=' + d.x1.toFixed(3) + ' b=' + d.b1.toFixed(3) + '  ' + v.text);
    }
  }

  /* ---- wrong answers must not pass ---- */
  {
    const designs = stubDesigns(R, X, isOpen, false);
    await begin('shunt');
    await set('i-d', (designs[0].d + 0.04).toFixed(3)); await p.waitForTimeout(250);
    await set('p-l1', designs[0].ls.toFixed(4)); await p.waitForTimeout(350);
    s.check('wrong travel rejected', !(await verdict()).ok);

    await begin('shunt');
    await set('i-d', designs[0].d.toFixed(3)); await p.waitForTimeout(250);
    await set('p-l1', (designs[0].ls + 0.06).toFixed(4)); await p.waitForTimeout(350);
    s.check('wrong stub length rejected', !(await verdict()).ok);
  }

  /* ---- "show me" fills in a real answer ---- */
  for (const m of ['shunt', 'series', 'qwt', 'lnet', 'dstub']){
    await begin(m);
    await p.click('#b-prac-show'); await p.waitForTimeout(600);
    const v = await verdict();
    s.check('"show me" produces a matched design for ' + m, v.ok, v.text);
  }

  /* ---- solving it entirely by dragging on the chart ----

     The construction is a sequence of moves along circles, and this is the
     point of the mode: travel rides the constant-SWR circle, and once the
     point is on the target circle the element rides that. Gamma is mapped to
     the screen through the disc radius the chart publishes as data-disc --
     measuring it from the pixels needs a colour to look for, and there isn't a
     safe one, since selecting a shunt stub switches the grid from teal to
     orange. */
  {
    /* getBoundingClientRect is viewport-relative, so this has to be read AFTER
       the page has been put where the drag will happen -- reading it first and
       then scrolling sends every click to empty space, and the symptom is a
       grab of null rather than anything that points at the cause. */
    const readMap = () => p.evaluate(() => {
      const el = document.getElementById('chart'), r = el.getBoundingClientRect();
      return { cx: r.x + r.width/2, cy: r.y + r.height/2,
               R: parseFloat(el.getAttribute('data-disc')) * (r.width / el._w) };
    });
    let map;
    const pt = (u, v) => ({ x: map.cx + u*map.R, y: map.cy - v*map.R });
    const drag = async (from, to, steps) => {
      await p.mouse.move(from.x, from.y); await p.mouse.down();
      await p.mouse.move(to.x, to.y, { steps: steps || 14 }); await p.mouse.up();
      await p.waitForTimeout(320);
    };
    const grabbed = () => p.evaluate(() =>
      document.getElementById('chart').getAttribute('data-grab'));

    await begin('shunt');
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(400);
    map = await readMap();

    const g0 = gamma(R, X), m = Math.hypot(g0[0], g0[1]);
    /* The reader has turned the point half a turn, so what is on SCREEN is
       -Gamma_z: the working point starts at the load's angle plus pi, and the
       circle the element rides is the r = 1 circle, centre +0.5, which is what
       g = 1 looks like once the point rather than the grid has been turned. */
    const rotated = await p.evaluate(() =>
      document.getElementById('b-rot').getAttribute('aria-pressed') === 'true');
    const sgn = rotated ? -1 : 1;
    const th = Math.atan2(sgn*g0[1], sgn*g0[0]);
    const elemCx = rotated ? 0.5 : -0.5;
    const design = stubDesigns(R, X, isOpen, false)
      .reduce((a, b2) => (Math.abs(b2.d - 0.185) < Math.abs(a.d - 0.185) ? b2 : a));
    const aim = th - 2*TAU*design.d;

    /* a grab on the SWR circle must take the travel handle, not the element */
    await p.mouse.move(pt(m*Math.cos(th), m*Math.sin(th)).x,
                       pt(m*Math.cos(th), m*Math.sin(th)).y);
    await p.mouse.down(); await p.waitForTimeout(120);
    const gr1 = await grabbed();
    await p.mouse.up(); await p.waitForTimeout(150);
    s.check('a drag on the SWR circle grabs travel', gr1 === 'travel', 'grabbed ' + gr1);

    await drag(pt(m*Math.cos(th), m*Math.sin(th)), pt(m*Math.cos(aim), m*Math.sin(aim)));
    const travelled = await p.evaluate(() => document.getElementById('i-d').value);
    s.check('dragging round the SWR circle sets the travel',
            Math.abs(parseFloat(travelled) - design.d) < 0.004,
            'got ' + travelled + ', wanted ' + design.d.toFixed(3));
    s.check('the load is untouched by a practice drag',
            await p.evaluate(() => document.getElementById('i-r').value) === '25.0');

    /* and a grab on the element's circle must take the element */
    await p.mouse.move(pt(elemCx + 0.5*Math.cos(1.6), 0.5*Math.sin(1.6)).x,
                       pt(elemCx + 0.5*Math.cos(1.6), 0.5*Math.sin(1.6)).y);
    await p.mouse.down(); await p.waitForTimeout(120);
    const gr2 = await grabbed();
    await p.mouse.up(); await p.waitForTimeout(150);
    s.check('a drag on the element circle grabs the stub', gr2 === 'stub', 'grabbed ' + gr2);

    await drag(pt(elemCx + 0.5*Math.cos(1.6), 0.5*Math.sin(1.6)), pt(0, 0), 16);
    const v = await verdict();
    s.check('dragging the stub to the centre matches it', v.ok, v.text);
  }

  /* ---- the two ways of reaching admittance must agree ----

     Turning the point and turning the grid are the same statement,
     Gamma_y = -Gamma_z, written two ways. They must therefore produce the same
     design, and picking a shunt method must leave the reader on the grid their
     convention says they are working on -- the impedance grid when the point
     is what turns, which is the whole reason for the setting. */
  {
    const setMode = (want) => p.evaluate(want => {
      const btn = document.getElementById('b-ymode');
      for (let i = 0; i < 3; i++){
        if (btn.textContent.indexOf(want) >= 0) return btn.textContent.trim();
        btn.click();
      }
      return btn.textContent.trim();
    }, want);

    const outcome = {};
    for (const [want, label] of [['impedance chart', 'point'], ['admittance chart', 'grid']]){
      await setMode(want);
      await p.waitForTimeout(200);
      await begin('shunt');
      const grid = await p.evaluate(() =>
        (document.querySelector('[data-grid][aria-pressed="true"]') || {}).textContent.trim());
      s.check('"' + label + '" works a shunt stub on the ' +
              (label === 'point' ? 'impedance' : 'admittance') + ' grid',
              grid === (label === 'point' ? 'impedance' : 'admittance'), 'on ' + grid);
      await p.click('#b-prac-show'); await p.waitForTimeout(600);
      outcome[label] = await p.evaluate(() => ({
        d: document.getElementById('i-d').value,
        l1: parseFloat(document.getElementById('p-l1').value).toFixed(4),
        ok: document.getElementById('prac-verdict').getAttribute('data-ok') === '1'
      }));
    }
    s.check('both conventions reach a matched design',
            outcome.point.ok && outcome.grid.ok);
    s.check('and it is the SAME design',
            outcome.point.d === outcome.grid.d && outcome.point.l1 === outcome.grid.l1,
            'point d=' + outcome.point.d + ' ls=' + outcome.point.l1 +
            '   grid d=' + outcome.grid.d + ' ls=' + outcome.grid.l1);

    await setMode('impedance chart');   /* leave it as the default */
    await p.waitForTimeout(200);
  }

  /* ---- practice does not draw the answer before it is asked for ---- */
  {
    await begin('shunt');
    const hidden = await H.canvasHash(p, 'chart');
    await p.click('#b-prac-show'); await p.waitForTimeout(700);
    const shown = await H.canvasHash(p, 'chart');
    s.check('the construction is drawn only after "show me"', hidden !== shown,
            hidden + ' -> ' + shown);
  }

  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' '));

  await b.close();
  await srv.close();
  s.done();
})();
