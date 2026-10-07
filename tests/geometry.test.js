/* Geometry checks that sample RENDERED PIXELS rather than trusting the drawing
   code. Reading the source only proves what was intended; these prove what the
   canvas actually contains.

     1. The chart and the radially scaled parameters share a left edge, a right
        edge and a width, at four viewports. This is the check that would have
        caught the nomograph padding bug, where label padding quietly made the
        scale narrower than the chart's diameter.

     2. The shaded sweep between the two rim markers spans the arc it should.
        Travelling d wavelengths toward the generator rotates 2 x 360 x d
        degrees, so d = 0.17 must shade about 122 degrees. Measured by walking
        the ring band and looking for the accent colour.

   Run:  node tests/geometry.test.js                                       */

const H = require('./lib/harness');

const VIEWS = [[1500, 1150], [1280, 900], [900, 900], [390, 800]];

(async () => {
  const s = H.suite('geometry');
  const b = await H.launch();

  /* ---- 1. chart and nomograph share their edges ---- */
  for (const [vw, vh] of VIEWS){
    const ctx = await b.newContext({ viewport: { width: vw, height: vh } });
    const p = await ctx.newPage();
    await H.cutTheWire(p, 'file://');
    await p.goto(H.fileUrl('smith-tool.html'), { waitUntil: 'load' });
    await p.waitForTimeout(2600);

    /* Measure what is DRAWN, not where the two canvases sit.

       This compared the canvases' bounding boxes and called that "scales span
       the chart diameter". The boxes did line up, and it passed for a long
       time while the scales were 37% longer than the chart diameter at 1500px
       and 45% longer at 1100px -- the unit circle is inset from its canvas by
       the peripheral rings, the stub gap and the direction-arc band, and the
       scales ran the full canvas width. The proxy was true; the claim it was
       standing in for was false.

       The disc's edges come from the grid, which drawGrid clips to the unit
       circle exactly, so the outermost grid-coloured pixels on the centre row
       ARE the rim. The scale's extent is the widest horizontal run of drawn
       pixels in the nomograph. Both are converted to page coordinates, which
       is what a reader's eye actually compares. */
    const r = await p.evaluate(() => {
      const chEl = document.getElementById('chart'), noEl = document.getElementById('nomo');
      const ch = chEl.getBoundingClientRect(), no = noEl.getBoundingClientRect();
      const sx = ch.width / chEl._w, nx = no.width / noEl.width;

      /* The disc's radius is published by the chart as data-disc, in CSS px.
         Finding it from the pixels needs a colour to look for, and there is no
         safe one: the grid is teal on the impedance grid and orange on the
         admittance grid, so a teal test silently measures zero the moment a
         reader -- or a test -- switches grids. Scanning for "not the
         background" instead overshoots, because the outer rings lie beyond the
         unit circle. */
      const discR = parseFloat(chEl.getAttribute('data-disc'));
      const dl = chEl._w / 2 - discR, dr = chEl._w / 2 + discR;

      /* "Drawn" means different from the canvas's own background, found as
         its commonest colour. This used to be "brighter than 40", which is a
         description of a dark background: when light became the default every
         pixel qualified and the scale measured the full canvas width. */
      const ng = noEl.getContext('2d');
      const all = ng.getImageData(0, 0, noEl.width, noEl.height).data, cnt = {};
      for (let i = 0; i < all.length; i += 4*7){ const k = all[i] + ',' + all[i+1] + ',' + all[i+2]; cnt[k] = (cnt[k] || 0) + 1; }
      const bg = Object.keys(cnt).sort((u, v) => cnt[v] - cnt[u])[0].split(',').map(Number);
      let sl = Infinity, sr = -1;
      for (let y = 0; y < noEl.height; y++){
        const rr = ng.getImageData(0, y, noEl.width, 1).data;
        let a = -1, bx = -1, n = 0;
        for (let x = 0; x < noEl.width; x++){
          const i = x * 4;
          if (Math.abs(rr[i] - bg[0]) > 40 || Math.abs(rr[i + 1] - bg[1]) > 40 || Math.abs(rr[i + 2] - bg[2]) > 40){ if (a < 0) a = x; bx = x; n++; }
        }
        if (n > noEl.width * 0.5){ if (a < sl) sl = a; if (bx > sr) sr = bx; }
      }

      return {
        found: dl >= 0 && sr >= 0,
        discL: ch.left + dl * sx, discR: ch.left + dr * sx,
        scaleL: no.left + sl * nx, scaleR: no.left + sr * nx,
        ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });

    const dL = Math.abs(r.scaleL - r.discL), dR = Math.abs(r.scaleR - r.discR);
    s.check(vw + 'x' + vh + ': scales span the chart diameter',
            r.found && dL <= 4 && dR <= 4 && r.ovf <= 1,
            'disc ' + Math.round(r.discR - r.discL) + 'px  scale ' +
            Math.round(r.scaleR - r.scaleL) + 'px  ends off by ' +
            dL.toFixed(1) + '/' + dR.toFixed(1) + '  ovf ' + r.ovf);
    await ctx.close();
  }

  /* ---- 2. the rim sweep spans the right arc ---- */
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1100 } });
  const p = await ctx.newPage();
  await H.cutTheWire(p, 'file://');
  await p.goto(H.fileUrl('smith-tool.html'), { waitUntil: 'load' });
  await p.waitForTimeout(2600);
  await H.setInput(p, 'i-r', 25);
  await H.setInput(p, 'i-x', -30);

  /* Sample the ring band with no sweep drawn, then count how many of those
     same points changed. The probe here used to test `blue - red > 12`, which
     is not a description of the sweep but of the accent colour it happened to
     be drawn in. When the accent stopped being violet the test did not report
     a wrong angle -- it reported zero degrees at every distance, which reads
     as "the sweep is not drawn at all". Differencing against the page's own
     unswept render makes the measurement independent of the palette. */
  /* Where to look comes from the chart itself: data-drawn publishes the
     centre (geo) and the radius the sweep is drawn at, in CSS px. This used
     to be a fixed fraction of the canvas, 0.866 of its half-width. The rings
     have fixed pixel widths, so that fraction only hits them at one chart
     size: when the sidebar became hidden by default the chart grew from 778
     to 982px and the probe landed in the gap inside the ring, measuring a few
     degrees at every distance. */
  const RING = `(() => {
    const c = document.getElementById('chart'), g = c.getContext('2d');
    const D = JSON.parse(c.getAttribute('data-drawn')), k = c.width / c._w;
    const cx = D.geo[0]*k, cy = D.geo[1]*k, R = D.sweepR*k;
    const out = [];
    for (let a = 0; a < 360; a += 3){
      const th = a*Math.PI/180;
      const d = g.getImageData(Math.round(cx + R*Math.cos(th)),
                               Math.round(cy + R*Math.sin(th)), 1, 1).data;
      out.push([d[0], d[1], d[2]]);
    }
    return out;
  })()`;

  await H.setInput(p, 'i-d', 0);
  await p.waitForTimeout(450);
  const unswept = await p.evaluate(RING);

  for (const d of [0.05, 0.17, 0.30, 0.45]){
    await H.setInput(p, 'i-d', d);
    await p.waitForTimeout(450);

    const now = await p.evaluate(RING);
    let n = 0;
    for (let i = 0; i < now.length; i++){
      const a = now[i], b = unswept[i];
      if (Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]) > 24) n++;
    }
    const span = n*3;

    const want = Math.round(d*720);
    /* the sampling step is 3 degrees and the markers themselves have width, so
       allow a few steps either way */
    s.check('sweep at d=' + d + ' spans ~' + want + ' degrees',
            Math.abs(span - want) <= 12, 'measured ' + span + ' degrees');
  }

  /* ---- 3. no resampling fringe at fractional display scaling ----

     Windows at 125% gives devicePixelRatio 1.25, and an 878px element is then
     878 * 1.25 = 1097.5 device pixels. The bitmap has to be a whole number, so
     it is 1098 -- which is 878.4 CSS px, not 878. Painting only 878 of it left
     a sliver the browser resampled, and the dense grid near the open-circuit
     rim bled into a teal line down the right edge of the chart.

     It appeared at 1.25 and not at 1.0 or 1.5, so only a sweep of scalings
     finds it. The pixels are read from a screenshot rather than from the
     canvas, because the artefact does not exist in the canvas -- it is created
     when the browser scales the bitmap onto the screen. */
  for (const dpr of [1, 1.25, 1.5, 1.75]){
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 },
                                     deviceScaleFactor: dpr });
    const p2 = await ctx.newPage();
    await H.cutTheWire(p2, 'file://');
    await p2.goto(H.fileUrl('smith-tool.html'), { waitUntil: 'load' });
    await p2.waitForTimeout(2600);
    await p2.click('#z-in'); await p2.waitForTimeout(450);
    await p2.click('#z-rst'); await p2.waitForTimeout(800);

    const g = await p2.evaluate(() => {
      const r = document.getElementById('chart').getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, h: r.height };
    });
    const look = async (x) => {
      const shot = await p2.screenshot({
        clip: { x: Math.max(0, Math.floor(x) - 8), y: Math.round(g.top + g.h * 0.35),
                width: 16, height: 120 } });
      return p2.evaluate(async (b64) => {
        const img = new Image();
        await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b64; });
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height).data;
        let worst = 0;
        for (let x = 0; x < cv.width; x++){
          let n = 0;
          for (let y = 0; y < cv.height; y++){
            const i = (y * cv.width + x) * 4;
            if (d[i + 1] > d[i] + 12) n++;
          }
          if (n > worst) worst = n;
        }
        return worst;
      }, shot.toString('base64'));
    };
    const right = await look(g.right), left = await look(g.left);
    s.check('dpr ' + dpr + ': no grid fringe at the chart edges',
            right === 0 && left === 0, 'right ' + right + '  left ' + left);
    await ctx.close();
  }

  await b.close();
  s.done();
})();
