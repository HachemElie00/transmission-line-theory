/* Transmission-line mathematics written from the theory, deliberately NOT from
   the page's code.

   The point of a second implementation is that it can disagree. So nothing
   here uses a reflection coefficient: every impedance is transformed with the
   chapter-08 tangent formula, and every stub length is found by BISECTION
   rather than by an arctangent identity. A sign error in the page's
   Gamma-rotation route therefore cannot hide in both implementations at once.

   Everything is normalised to Z0 = 1 and lossless. Distances are wavelengths. */

const C    = (re, im) => ({ re, im });
const add  = (a, b) => C(a.re + b.re, a.im + b.im);
const mul  = (a, b) => C(a.re*b.re - a.im*b.im, a.re*b.im + a.im*b.re);
const div  = (a, b) => { const d = b.re*b.re + b.im*b.im;
  return C((a.re*b.re + a.im*b.im)/d, (a.im*b.re - a.re*b.im)/d); };
const invc  = a => div(C(1, 0), a);
const dist1 = z => Math.hypot(z.re - 1, z.im);   /* distance from a match */

/* impedance d wavelengths back from zL */
function zin(zL, d){
  const t = Math.tan(2*Math.PI*d);
  if (!isFinite(t)) return invc(zL);             /* quarter wave: the inverter */
  return div(add(zL, C(0, t)), add(C(1, 0), mul(C(0, t), zL)));
}
const yin   = (zL, d) => invc(zin(zL, d));
const stubY = (l, open) => { const b = 2*Math.PI*l;
  return open ? C(0, Math.tan(b)) : C(0, -1/Math.tan(b)); };
const stubZ = (l, open) => { const b = 2*Math.PI*l;
  return open ? C(0, -1/Math.tan(b)) : C(0, Math.tan(b)); };

/* ---- root finding ----------------------------------------------------- */

function bisect(f, a, b, it){
  let fa = f(a);
  for (let i = 0; i < (it || 200); i++){
    const m = (a + b)/2, fm = f(m);
    if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else { b = m; }
  }
  return (a + b)/2;
}

/* All sign-change roots of f on [lo,hi).

   Note the 0.37 offset in the sample position. Sampling on a round grid means
   a sample can land exactly on a root, and then NEITHER neighbouring interval
   shows a sign change — the root vanishes from the results. That cost real
   time once; do not "tidy" the offset away. */
function roots(f, lo, hi, n){
  n = n || 20000;
  const out = [];
  let px = lo, pf = f(lo);
  if (Math.abs(pf) < 1e-9) out.push(lo);
  for (let i = 1; i <= n; i++){
    const x = lo + (hi - lo)*(i - 0.37)/n, fx = f(x);
    if (isFinite(pf) && isFinite(fx) && pf !== 0 &&
        (pf < 0) !== (fx < 0) && Math.abs(fx - pf) < 1e3){
      out.push(bisect(f, px, x));
    }
    px = x; pf = fx;
  }
  out.sort((a, b) => a - b);
  return out.filter((v, i) => i === 0 || Math.abs(v - out[i-1]) > 1e-7);
}

/* Roots the curve touches without crossing. f has a double root there, so no
   bracket exists and `roots` above finds nothing. Locate local minima of |f|
   and refine each with a ternary search. The L-network has these. */
function touchRoots(f, lo, hi, n){
  n = n || 20000;
  const out = [];
  let a = Math.abs(f(lo)), b = Math.abs(f(lo + (hi - lo)/n));
  for (let i = 2; i <= n; i++){
    const x1 = lo + (hi - lo)*(i-2)/n, x3 = lo + (hi - lo)*i/n;
    const c = Math.abs(f(x3));
    if (b < a && b < c && b < 1e-3){
      let l = x1, r = x3;
      for (let k = 0; k < 200; k++){
        const m1 = l + (r - l)/3, m2 = r - (r - l)/3;
        if (Math.abs(f(m1)) < Math.abs(f(m2))) r = m2; else l = m1;
      }
      const x = (l + r)/2;
      if (Math.abs(f(x)) < 1e-9) out.push(x);
    }
    a = b; b = c;
  }
  return out;
}

const merge = (a, b) => {
  const all = a.concat(b).sort((x, y) => x - y);
  return all.filter((v, i) => i === 0 || Math.abs(v - all[i-1]) > 1e-5);
};

/* Stub length that presents `target` (a susceptance for a shunt stub, a
   reactance for a series one), found by bisection. */
function findStub(target, open, series){
  const f = l => (series ? stubZ(l, open).im : stubY(l, open).im) - target;
  const r = roots(f, 1e-6, 0.5 - 1e-6, 60000);
  return r.length ? r[0] : null;
}

/* ---- independent designs ---------------------------------------------- */
/* Each returns designs carrying a `check` field: the whole network
   re-assembled from the design's own numbers. It must come out at 1 + j0. */

function shunt(zL, open){
  return roots(d => yin(zL, d).re - 1, 0, 0.5, 40000).map(d => {
    const b = yin(zL, d).im;
    const ls = findStub(-b, open, false);
    return { d, ls, need: -b, check: add(yin(zL, d), stubY(ls, open)) };
  }).sort((a, b) => a.d - b.d);
}

function series(zL, open){
  return roots(d => zin(zL, d).re - 1, 0, 0.5, 40000).map(d => {
    const x = zin(zL, d).im;
    const ls = findStub(-x, open, true);
    return { d, ls, need: -x, check: add(zin(zL, d), stubZ(ls, open)) };
  }).sort((a, b) => a.d - b.d);
}

function qwt(zL){
  return roots(d => zin(zL, d).im, 0, 0.5, 40000).map(d => {
    const zr = zin(zL, d);
    const z1 = Math.sqrt(zr.re);
    const zT = div(zr, C(z1, 0));
    return { d, z1, zr: zr.re, imres: Math.abs(zr.im),
             check: mul(invc(zT), C(z1, 0)) };
  }).sort((a, b) => a.d - b.d);
}

function lnet(zL){
  const out = [];
  /* series element first: Re(1/(zL + j xs)) = 1 */
  const fA = xs => invc(add(zL, C(0, xs))).re - 1;
  merge(roots(fA, -60, 60, 60000), touchRoots(fA, -60, 60, 60000)).forEach(xs => {
    const bp = -invc(add(zL, C(0, xs))).im;
    out.push({ order: 'series first', xs, bp,
               check: invc(add(invc(add(zL, C(0, xs))), C(0, bp))) });
  });
  /* shunt element first: Re(1/(yL + j bp)) = 1 */
  const yL = invc(zL);
  const fB = bp => invc(add(yL, C(0, bp))).re - 1;
  merge(roots(fB, -60, 60, 60000), touchRoots(fB, -60, 60, 60000)).forEach(bp => {
    const xs = -invc(add(yL, C(0, bp))).im;
    out.push({ order: 'shunt first', xs, bp,
               check: add(invc(add(yL, C(0, bp))), C(0, xs)) });
  });
  return out;
}

/* Double stub: stub 1 at the load, stub 2 a spacing dd away, both shunt.
   b1 is found by bisection on Re(y after the spacing) - 1, so the page's
   closed-form quadratic is never reused. The check re-assembles the network
   from the two LENGTHS alone, not from the susceptances. */
function dstub(zL, dd, open){
  const yL = invc(zL);
  const after = b1 => invc(zin(invc(add(yL, C(0, b1))), dd));
  return roots(b1 => after(b1).re - 1, -400, 400, 400000).map(b1 => {
    const b2 = -after(b1).im;
    const ls1 = findStub(b1, open, false), ls2 = findStub(b2, open, false);
    const yA  = add(yL, stubY(ls1, open));
    const yB  = invc(zin(invc(yA), dd));
    return { b1, b2, ls1, ls2, check: add(yB, stubY(ls2, open)) };
  });
}

/* A spread of loads: real, reactive, near the rim, near the centre, both
   half-planes, and two extreme mismatches. */
const LOADS = [
  [0.5,-0.6],[2,1.4],[0.2,0],[5,0],[1,2],[1,-2],[0.3,0.9],[3,-3],
  [0.8,0.2],[4,1],[0.1,-0.4],[2.5,2.5],[0.6,-1.8],[10,-5],
  [1.5,0],[0.7,0],[0.25,-0.25],[6,2],[0.4,1.3],[8,-2]
];

module.exports = { C, add, mul, div, invc, dist1, zin, yin, stubY, stubZ,
                   roots, touchRoots, findStub, shunt, series, qwt, lnet,
                   dstub, LOADS };
