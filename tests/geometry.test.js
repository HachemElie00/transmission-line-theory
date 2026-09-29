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

    const r = await p.evaluate(() => {
      const ch = document.getElementById('chart').getBoundingClientRect();
      const no = document.getElementById('nomo').getBoundingClientRect();
      return {
        chart: [Math.round(ch.left), Math.round(ch.right), Math.round(ch.width)],
        nomo : [Math.round(no.left), Math.round(no.right), Math.round(no.width)],
        dl: Math.abs(ch.left - no.left), dr: Math.abs(ch.right - no.right),
        ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });

    s.check(vw + 'x' + vh + ': scales span the chart diameter',
            r.dl < 1.5 && r.dr < 1.5 && r.ovf <= 1,
            'chart ' + r.chart.join('/') + '  nomo ' + r.nomo.join('/') + '  ovf ' + r.ovf);
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
  const RING = `(() => {
    const c = document.getElementById('chart'), g = c.getContext('2d');
    const cx = c.width/2, cy = c.height/2, R = cx*0.866;
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

  await b.close();
  s.done();
})();
