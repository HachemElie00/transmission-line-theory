/* The palette, checked as numbers rather than by eye.

   Colour is the one part of this site where "it looks fine on my screen" is
   not evidence. Two failures are easy to introduce and hard to see: a colour
   that loses contrast against the figure background in one theme only, and
   two colours that read as distinct on a good monitor but collapse into each
   other in a figure where both appear.

   This parses assets/site.css directly. It needs no browser, so it runs in
   well under a second and is worth keeping in the default run.

   Run:  node tests/palette.test.js                                        */

const fs = require('fs');
const path = require('path');
const H = require('./lib/harness');

const CSS = fs.readFileSync(path.join(H.SITE, 'assets', 'site.css'), 'utf8');

/* Pull the custom properties out of one rule. Deliberately crude: it reads the
   first block after the selector, which is all these two rules are. */
function block(sel){
  const i = CSS.indexOf(sel);
  if (i < 0) return null;
  const j = CSS.indexOf('}', i);
  const out = {};
  const re = /--([a-z0-9]+)\s*:\s*(#[0-9a-fA-F]{6})/g;
  let m;
  const body = CSS.slice(i, j);
  while ((m = re.exec(body))) out[m[1]] = m[2];
  return out;
}

const hx = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
const lin = v => (v /= 255, v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const lum = c => { const [r, g, b] = hx(c).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
const ratio = (a, b) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/* CIE76. Good enough to catch "these two are basically the same colour",
   which is the only question being asked. */
function lab(c){
  const [r, g, b] = hx(c).map(lin);
  let X = (r*0.4124 + g*0.3576 + b*0.1805) / 0.95047;
  let Y =  r*0.2126 + g*0.7152 + b*0.0722;
  let Z = (r*0.0193 + g*0.1192 + b*0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787*t + 16/116;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116*fy - 16, 500*(fx - fy), 200*(fy - fz)];
}
const dE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

/* Colours that land in the same figure and must stay tellable apart.
   e/h is the field pair; z/h is the Smith chart's two grids; acc rides on top
   of both grids as a construction. */
const PAIRS = [['e','h'], ['e','acc'], ['h','acc'], ['z','h'], ['z','acc'], ['e','z']];
const INK = ['e','h','z','acc','ui','ok','warn'];

const MIN_CONTRAST = 3.0;   /* WCAG non-text minimum, against the figure bg */
const MIN_DE       = 25;    /* comfortable; below 18 is a failure           */

const s = H.suite('palette');

const themes = {
  'light (default)': block(':root{'),
  'dark'           : block(':root[data-theme="dark"]{')
};

for (const [name, t] of Object.entries(themes)){
  if (!t){ s.check(name + ': rule found', false, 'selector missing from site.css'); continue; }

  const missing = INK.filter(k => !t[k]);
  s.check(name + ': every colour token defined', missing.length === 0, missing.join(' '));
  if (missing.length) continue;

  let worstC = Infinity, worstCk = '';
  for (const k of INK){
    const r = ratio(t[k], t.sunk);
    if (r < worstC){ worstC = r; worstCk = k; }
    if (r < MIN_CONTRAST) s.note('LOW --' + k + ' ' + t[k] + ' vs --sunk = ' + r.toFixed(2));
  }
  s.check(name + ': all colours contrast with figure bg', worstC >= MIN_CONTRAST,
          'worst --' + worstCk + ' ' + worstC.toFixed(2));

  let worstD = Infinity, worstDk = '';
  for (const [a, b] of PAIRS){
    const d = dE(t[a], t[b]);
    if (d < worstD){ worstD = d; worstDk = a + '/' + b; }
    if (d < MIN_DE) s.note('TIGHT --' + a + ' vs --' + b + ' dE = ' + d.toFixed(1));
  }
  s.check(name + ': colours sharing a figure stay distinct', worstD >= 18,
          'worst ' + worstDk + ' dE ' + worstD.toFixed(1));
}

/* The teal is meant to survive in exactly one place. If --z ever turns up in a
   chapter, the split has been undone by accident. */
const chartFiles = ['smith-chart.html', 'smith-tool.html', 'matching.html'];
const strays = fs.readdirSync(H.SITE)
  .filter(f => f.endsWith('.html') && !chartFiles.includes(f))
  .filter(f => /\bC\.z\b/.test(fs.readFileSync(path.join(H.SITE, f), 'utf8')));
s.check('--z used only by the Smith chart figures', strays.length === 0, strays.join(' '));

/* And the inverse: the GRIDS must not have drifted back to --e.

   This used to forbid C.e anywhere in those files, which is a different and
   much stronger claim than the one the rule is about. It started failing the
   moment --e was legitimately used for something that is not a grid: the
   practice attempt marker, and the transmission-angle numbers on the rim.
   Test the grid calls themselves. */
const reverted = chartFiles
  .filter(f => fs.existsSync(path.join(H.SITE, f)))
  .filter(f => fs.readFileSync(path.join(H.SITE, f), 'utf8')
                 .split('\n')
                 .some(l => l.indexOf('drawGrid') >= 0 && /\bC\.e\b/.test(l)));
s.check('chart grids still use --z, not --e', reverted.length === 0, reverted.join(' '));

/* matching.html draws its faint orientation grid inline rather than through
   drawGrid, so it is checked on its own terms. */
const mg = fs.readFileSync(path.join(H.SITE, 'matching.html'), 'utf8');
s.check('the orientation grid in matching.html uses --z',
        /strokeStyle = C\.z/.test(mg));

/* Light must be the default: the base :root carries the light palette, and
   nothing may reintroduce an OS-preference branch for colour. (Dark was the
   default until 2026-10-06; Elie switched it.) */
s.check('base :root declares color-scheme: light',
        /:root\{[^}]*color-scheme:\s*light/.test(CSS));
s.check('no prefers-color-scheme colour rule',
        !/@media\s*\(prefers-color-scheme[^)]*\)\s*\{[^}]*--[a-z]/.test(CSS));

s.done();
