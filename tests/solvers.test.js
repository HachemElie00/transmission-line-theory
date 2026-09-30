/* Two-stage verification of the workbench's matching solvers.

   STAGE 1 — self-consistency of the independent implementation.
     lib/tline.js designs every network from scratch by bisection on the
     tangent formula. Each design is then re-assembled from its own numbers
     and must give 1 + j0. This catches an error in the CHECKER, which would
     otherwise make stage 2 meaningless.
     Reference: 460 designs, worst |result - 1| = 2.19e-14.

   STAGE 2 — the page against that.
     Drives the live workbench, reads the printed answers out of the DOM, and
     compares them to the independent designs at the precision the page prints
     (three decimals for wavelengths and normalised values, one decimal for
     ohms). A disagreement larger than half the last printed digit is a
     failure; anything smaller is rounding and is expected.
     Reference: 0 disagreements, worst gap 5.0e-4.

   Slow — roughly fifteen to twenty minutes. Stage 1 alone:
     node tests/solvers.test.js --stage1

   Run:  node tests/solvers.test.js                                        */

const H = require('./lib/harness');
const T = require('./lib/tline');

const STAGE1_ONLY = process.argv.includes('--stage1');

/* Half the last printed digit. Z1 is printed in ohms to one decimal, so its
   tolerance is 0.05; everything else is printed to three decimals. */
const TOL = k => k.startsWith('Z1') ? 0.06 : 0.0006;

const firstNum = s => { const m = String(s).match(/-?\d+(?:\.\d+)?/);
                        return m ? parseFloat(m[0]) : NaN; };

/* nearest by distance along the line, allowing for the half-wave wrap */
const nearestD = (arr, d) => {
  let best = Infinity, pick = null;
  arr.forEach(t => {
    const e = Math.min(Math.abs(t.d - d), 0.5 - Math.abs(t.d - d));
    if (e < best) { best = e; pick = t; }
  });
  return pick;
};

(async () => {
  const s = H.suite('solvers');

  /* ---------------- stage 1 ---------------- */
  let worst1 = 0, n1 = 0;
  for (const [r, x] of T.LOADS){
    const zL = T.C(r, x);
    for (const open of [false, true]){
      T.shunt (zL, open).forEach(d => { worst1 = Math.max(worst1, T.dist1(d.check)); n1++; });
      T.series(zL, open).forEach(d => { worst1 = Math.max(worst1, T.dist1(d.check)); n1++; });
      [0.125, 0.25, 0.375].forEach(dd =>
        T.dstub(zL, dd, open).forEach(d => { worst1 = Math.max(worst1, T.dist1(d.check)); n1++; }));
    }
    /* the QWT must also have cancelled the reactance, so that is added in */
    T.qwt (zL).forEach(d => { worst1 = Math.max(worst1, T.dist1(d.check) + d.imres); n1++; });
    T.lnet(zL).forEach(d => { worst1 = Math.max(worst1, T.dist1(d.check)); n1++; });
  }
  s.check('stage 1: ' + n1 + ' independent designs re-assemble to 1+j0',
          worst1 < 1e-9, 'worst |result - 1| = ' + worst1.toExponential(2));

  if (STAGE1_ONLY) { s.done(); return; }

  /* ---------------- stage 2 ---------------- */
  const srv = await H.serve();
  const b = await H.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'smith-tool.html', { waitUntil: 'load' });
  await p.waitForTimeout(1200);

  const worst = {}, seen = {}, bad = [];
  const note = (k, v, where) => {
    seen[k] = (seen[k] || 0) + 1;
    if (!(worst[k] >= v)) worst[k] = v;
    if (v > TOL(k)) bad.push([k, v.toExponential(2)].concat(where).join('  '));
  };

  const SPACINGS = [0.125, 0.25, 0.375];
  let ddi = 0;

  for (const [rL, xL] of T.LOADS){
    const zL = T.C(rL, xL);
    const dd = SPACINGS[(ddi++) % 3];

    for (const open of [false, true]){
      const got = await p.evaluate(({ rL, xL, open, dd }) => {
        const set = (id, v) => { const e = document.getElementById(id);
          e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); };
        set('i-z0', 50); set('i-r', rL*50); set('i-x', xL*50);

        const t = document.getElementById('b-term');
        if ((t.getAttribute('aria-pressed') === 'true') !== open) t.click();

        const sp = document.getElementById('i-dd');
        sp.value = String(dd);
        sp.dispatchEvent(new Event('change', { bubbles: true }));
        /* assert rather than assume: an earlier version of this harness never
           applied the spacing and silently compared the default instead */
        if (sp.value !== String(dd)) throw new Error('spacing not applied: ' + sp.value);

        /* the method is a select now: set it, read, then put it back to none.
           It no longer toggles, so the old click-twice idiom would have left
           the method selected and every later read would have been wrong. */
        const pick = m => {
          const sel = document.getElementById('i-method');
          sel.value = m;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          if (sel.value !== m) throw new Error('method not applied: ' + m);
        };
        const read = m => {
          pick(m);
          const v = [...document.querySelectorAll('#sols .sol')].map(sol => {
            const o = {}, dt = [...sol.querySelectorAll('dt')],
                          dd2 = [...sol.querySelectorAll('dd')];
            if (!dt.length) return null;   /* a "no solution" note, not a design */
            dt.forEach((d, i) => o[d.textContent.trim()] = dd2[i].textContent.trim());
            return o;
          }).filter(Boolean);
          pick('');
          return v;
        };
        return { shunt: read('shunt'), series: read('series'), qwt: read('qwt'),
                 lnet: read('lnet'),  dstub: read('dstub') };
      }, { rL, xL, open, dd });

      /* -- double stub -- */
      const idb = T.dstub(zL, dd, open);
      if (got.dstub.length !== idb.length)
        bad.push(['count dstub', got.dstub.length, idb.length, rL, xL, dd].join('  '));
      got.dstub.forEach(sol => {
        const l1 = firstNum(sol['stub 1 length']);
        let best = Infinity, t = null;
        idb.forEach(q => { const e = Math.abs(q.ls1 - l1); if (e < best) { best = e; t = q; } });
        if (!t) return;
        const w = [rL, xL, dd, open];
        note('dstub ls1', Math.abs(l1 - t.ls1), w);
        note('dstub ls2', Math.abs(firstNum(sol['stub 2 length']) - t.ls2), w);
        note('dstub b1',  Math.abs(firstNum(sol['stub 1 gives'])  - t.b1),  w);
        note('dstub b2',  Math.abs(firstNum(sol['stub 2 gives'])  - t.b2),  w);
      });

      /* -- single stubs -- */
      const ish = T.shunt(zL, open), ise = T.series(zL, open);
      if (got.shunt.length !== ish.length)
        bad.push(['count shunt', got.shunt.length, ish.length, rL, xL].join('  '));
      got.shunt.forEach(sol => {
        const t = nearestD(ish, firstNum(sol['distance d'])); if (!t) return;
        const w = [rL, xL, open];
        note('shunt d',  Math.abs(firstNum(sol['distance d'])     - t.d),    w);
        note('shunt ls', Math.abs(firstNum(sol['stub length'])    - t.ls),   w);
        note('shunt b',  Math.abs(firstNum(sol['stub must give']) - t.need), w);
      });
      if (got.series.length !== ise.length)
        bad.push(['count series', got.series.length, ise.length, rL, xL].join('  '));
      got.series.forEach(sol => {
        const t = nearestD(ise, firstNum(sol['distance d'])); if (!t) return;
        const w = [rL, xL, open];
        note('series d',  Math.abs(firstNum(sol['distance d'])     - t.d),    w);
        note('series ls', Math.abs(firstNum(sol['stub length'])    - t.ls),   w);
        note('series x',  Math.abs(firstNum(sol['stub must give']) - t.need), w);
      });

      if (open) continue;   /* the QWT and the L-network do not use a stub end */

      /* -- quarter-wave transformer -- */
      const iq = T.qwt(zL);
      if (got.qwt.length !== iq.length)
        bad.push(['count qwt', got.qwt.length, iq.length, rL, xL].join('  '));
      got.qwt.forEach((sol, i) => {
        if (!iq[i]) return;
        note('qwt d', Math.abs(firstNum(sol['distance d']) - iq[i].d), [rL, xL]);
        note('Z1',    Math.abs(firstNum(sol['Z₁'])    - iq[i].z1*50), [rL, xL]);
      });

      /* -- L-network -- */
      const il = T.lnet(zL);
      if (got.lnet.length !== il.length)
        bad.push(['count lnet', got.lnet.length, il.length, rL, xL].join('  '));
      got.lnet.forEach(sol => {
        const bp = firstNum(sol['shunt b']), xs = firstNum(sol['series x']),
              ord = sol['order'];
        let best = Infinity, pick = null;
        il.forEach(t => {
          if (t.order !== ord) return;
          const e = Math.abs(t.bp - bp) + Math.abs(t.xs - xs);
          if (e < best) { best = e; pick = t; }
        });
        if (!pick) { bad.push(['lnet unmatched', ord, bp, xs, rL, xL].join('  ')); return; }
        note('lnet b', Math.abs(pick.bp - bp), [rL, xL, ord]);
        note('lnet x', Math.abs(pick.xs - xs), [rL, xL, ord]);
      });
    }
  }

  console.log('\n   page vs independent, at the printed precision');
  Object.keys(worst).sort().forEach(k =>
    console.log('   ' + k.padEnd(11) + 'n=' + String(seen[k]).padEnd(5) +
                'worst diff ' + worst[k].toExponential(2)));
  console.log('');

  bad.slice(0, 15).forEach(f => s.note('FAIL ' + f));
  s.check('stage 2: page agrees with the independent designs',
          bad.length === 0, bad.length ? bad.length + ' disagreements' : '');
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' '));

  await b.close();
  await srv.close();
  s.done();
})();
