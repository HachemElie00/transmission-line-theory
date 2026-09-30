/* The problems, with every answer recomputed here from the theory.

   A problem set is the one part of a teaching site where being wrong is worse
   than being absent: a student who trusts a bad answer loses more than one who
   had no problem to attempt. So no answer in assets/problems.js is taken on
   trust. Each is recomputed below by an independent route -- a different
   formula, a different order of operations, or a check that the answer
   satisfies the condition it was supposed to produce -- and compared.

   Where a genuinely different route exists it is used. Where one does not, the
   answer is verified by its defining property instead, which is stronger than
   repeating the same arithmetic: a stub length is checked by confirming it
   actually cancels the susceptance, not by recomputing the arctangent.

   Run:  node tests/problems.test.js                                         */

const fs = require('fs');
const path = require('path');
const H = require('./lib/harness');

const s = H.suite('problems');
const TAU = Math.PI*2, C0 = 299792458;

/* load the data file the way the page does */
const src = fs.readFileSync(path.join(H.SITE, 'assets', 'problems.js'), 'utf8');
const win = {};
new Function('window', src)(win);
const P = win.TLT_PROBLEMS;

s.check('the problem file loads', !!P && Object.keys(P).length > 0,
        P ? Object.keys(P).length + ' pages' : 'nothing');

/* ---- shape ---- */
{
  const pages = H.pages();
  const bad = [];
  let count = 0, fields = 0;
  for (const pg of Object.keys(P)){
    if (!pages.includes(pg)) bad.push(pg + ' is not a page');
    const lv = P[pg].map(x => x.lvl);
    if (lv.join(',') !== 'easy,medium,hard') bad.push(pg + ' levels: ' + lv.join(','));
    for (const pr of P[pg]){
      count++;
      if (!pr.q || !pr.why || !pr.f || !pr.f.length) bad.push(pg + ' incomplete problem');
      for (const f of pr.f){
        fields++;
        const v = f.ans();
        if (!isFinite(v)) bad.push(pg + ' "' + f.lab + '" is not finite');
      }
    }
  }
  s.check('every problem is complete and every answer finite', bad.length === 0,
          bad.slice(0, 4).join('  '));
  s.check('three problems on each of the eleven chapters',
          count === 33 && Object.keys(P).length === 11,
          count + ' problems, ' + fields + ' answer fields');
}

/* ---- the answers, recomputed ---- */
const A = (pg, i, j) => P[pg][i].f[j].ans();
const near = (got, want, tol) =>
  Math.abs(got - want) <= (tol == null ? 1e-6 : tol)*Math.max(1, Math.abs(want));

function check(name, got, want, tol){
  s.check(name, near(got, want, tol),
          'page ' + (typeof got === 'number' ? got.toPrecision(6) : got) +
          '   here ' + (typeof want === 'number' ? want.toPrecision(6) : want));
}

/* 01 waves: lambda from u/f, beta from 2pi/lambda -- checked via period instead */
check('01 easy: lambda', A('waves-phasors.html',0,0), 2e8/8e8);
check('01 easy: beta = omega/u', A('waves-phasors.html',0,1), TAU*800e6/2e8);
/* the phasor at a quarter period: cos(90+30) = -sin(30) */
check('01 medium: v(t)', A('waves-phasors.html',1,0), -10*Math.sin(30*Math.PI/180), 1e-9);
/* two phasors by the cosine rule rather than by components */
check('01 hard: |V| by cosine rule', A('waves-phasors.html',2,0),
      Math.sqrt(36 + 16 + 2*6*4*Math.cos(120*Math.PI/180)), 1e-9);
check('01 hard: angle by sine rule', A('waves-phasors.html',2,1),
      Math.asin(4*Math.sin(120*Math.PI/180) /
        Math.sqrt(36 + 16 + 2*6*4*Math.cos(120*Math.PI/180)))*180/Math.PI, 1e-6);

/* 02 circuits vs lines */
check('02 easy: f at lambda/10', A('circuit-to-line.html',0,0), 400);
check('02 medium: electrical length', A('circuit-to-line.html',1,0),
      TAU*0.08/(C0/Math.sqrt(2.2)/1.5e9)*180/Math.PI, 1e-9);
check('02 hard: lumped limit', A('circuit-to-line.html',2,0),
      C0/Math.sqrt(3.2)/0.6/1e6, 1e-9);

/* 03 the line model: check by reconstruction rather than by the same formula */
{
  const z0 = A('telegraphers.html',0,0), up = A('telegraphers.html',0,1);
  check('03 easy: L\' recovered from Z0 and u', z0/up, 250e-9, 1e-9);
  check('03 easy: C\' recovered from Z0 and u', 1/(z0*up), 100e-12, 1e-9);
  const L = A('telegraphers.html',1,0)*1e-9, C = A('telegraphers.html',1,1)*1e-12;
  check('03 medium: gives back Z0 = 75', Math.sqrt(L/C), 75, 1e-9);
  check('03 medium: gives back u = 2e8', 1/Math.sqrt(L*C), 2e8, 1e-9);
  /* |Z0| and angle must reconstruct Z'/Y' */
  const w = TAU*500e6;
  const m = A('telegraphers.html',2,0), ang = A('telegraphers.html',2,1)*Math.PI/180;
  const zr = m*Math.cos(ang), zi = m*Math.sin(ang);          /* Z0 */
  /* Z0^2 * Y' should equal Z' */
  const sq = [zr*zr - zi*zi, 2*zr*zi], Y = [0, w*120e-12];
  const back = [sq[0]*Y[0] - sq[1]*Y[1], sq[0]*Y[1] + sq[1]*Y[0]];
  check('03 hard: Z0^2 Y\' gives back R\'', back[0], 4, 2e-3);
  check('03 hard: Z0^2 Y\' gives back wL\'', back[1], w*300e-9, 1e-6);
}

/* 04 propagation */
check('04 easy: beta', A('propagation.html',0,0), TAU*1e9/(1/Math.sqrt(400e-9*160e-12)), 1e-9);
check('04 easy: lambda in cm', A('propagation.html',0,1),
      (1/Math.sqrt(400e-9*160e-12))/1e9*100, 1e-9);
check('04 medium: Np/m', A('propagation.html',1,0), 0.02 + 0.01, 1e-9);
check('04 medium: dB/m', A('propagation.html',1,1),
      A('propagation.html',1,0)*20/Math.LN10, 1e-6);
{
  /* gamma^2 must equal Z'Y' */
  const w = TAU*300e6;
  const al = A('propagation.html',2,0), be = A('propagation.html',2,1);
  const g2 = [al*al - be*be, 2*al*be];
  const Z = [15, w*250e-9], Y = [2e-3, w*100e-12];
  const zy = [Z[0]*Y[0] - Z[1]*Y[1], Z[0]*Y[1] + Z[1]*Y[0]];
  check('04 hard: gamma^2 = Z\'Y\' (real)', g2[0], zy[0], 1e-6);
  check('04 hard: gamma^2 = Z\'Y\' (imag)', g2[1], zy[1], 1e-6);
}

/* 05 microstrip */
{
  const ee = A('microstrip.html',0,0);
  check('05 easy: eeff', ee, 2.7 + 1.7/Math.sqrt(7), 1e-9);
  const z = A('microstrip.html',1,0);
  check('05 medium: Z0', z,
        120*Math.PI/(Math.sqrt(ee)*(2 + 1.393 + 0.667*Math.log(3.444))), 1e-9);
  /* the synthesised W/h must reproduce 50 ohm -- the defining property */
  const wh = A('microstrip.html',2,0);
  const eeS = 2.7 + 1.7*Math.pow(1 + 12/wh, -0.5);
  const zS = 120*Math.PI/(Math.sqrt(eeS)*(wh + 1.393 + 0.667*Math.log(wh + 1.444)));
  check('05 hard: that W/h really gives 50 ohm', zS, 50, 1e-6);
}

/* 06 reflection */
check('06 easy: Gamma', A('reflection.html',0,0), 1/3, 1e-9);
check('06 easy: power %', A('reflection.html',0,1), 100/9, 1e-9);
{
  /* |Gamma| via |zL-1|/|zL+1| rather than by dividing the complex numbers */
  const zr = 0.6, zi = -0.8;
  check('06 medium: |Gamma| by magnitudes', A('reflection.html',1,0),
        Math.hypot(zr-1, zi)/Math.hypot(zr+1, zi), 1e-9);
  check('06 medium: angle by difference of arguments', A('reflection.html',1,1),
        (Math.atan2(zi, zr-1) - Math.atan2(zi, zr+1))*180/Math.PI, 1e-6);
  /* the recovered load must give back the stated Gamma */
  const R = A('reflection.html',2,0), X = A('reflection.html',2,1);
  const zr2 = R/50, zi2 = X/50;
  const gm = Math.hypot(zr2-1, zi2)/Math.hypot(zr2+1, zi2);
  check('06 hard: recovered load gives |Gamma| = 0.4', gm, 0.4, 1e-6);
}

/* 07 standing waves */
check('07 easy: SWR', A('standing-waves.html',0,0), 3, 1e-9);
check('07 easy: return loss', A('standing-waves.html',0,1), 20*Math.log10(2), 1e-9);
check('07 medium: |Gamma|', A('standing-waves.html',1,0), 1.5/3.5, 1e-9);
check('07 medium: power delivered', A('standing-waves.html',1,1),
      100*(1 - (1.5/3.5)*(1.5/3.5)), 1e-9);
{
  /* the recovered load must give SWR 3 and put a minimum at 0.2 lambda */
  const R = A('standing-waves.html',2,0), X = A('standing-waves.html',2,1);
  const zr = R/50, zi = X/50;
  const gm = Math.hypot(zr-1, zi)/Math.hypot(zr+1, zi);
  check('07 hard: load gives SWR 3', (1+gm)/(1-gm), 3, 1e-5);
  const th = Math.atan2(zi, zr-1) - Math.atan2(zi, zr+1);
  /* travelling 0.2 lambda toward the generator must land on 180 degrees */
  let at = (th - 2*TAU*0.2) % TAU; if (at < 0) at += TAU;
  check('07 hard: minimum really at 0.2 lambda', Math.cos(at), -1, 1e-5);
}

/* 08 input impedance */
check('08 easy: quarter wave', A('input-impedance.html',0,0), 70.7*70.7/100, 1e-9);
{
  /* the tangent formula, checked against a Gamma rotation instead */
  const zr = 0.5, zi = 0.6, d = 0.10;
  const gr = ((zr-1)*(zr+1) + zi*zi)/((zr+1)*(zr+1) + zi*zi);
  const gi = (zi*(zr+1) - (zr-1)*zi)/((zr+1)*(zr+1) + zi*zi);
  const m = Math.hypot(gr, gi), a = Math.atan2(gi, gr) - 2*TAU*d;
  const u = m*Math.cos(a), v = m*Math.sin(a);
  const den = (1-u)*(1-u) + v*v;
  /* z = (1+G)/(1-G) has real part (1 - u^2 - v^2)/|1-G|^2. Writing it as
     (1+u)(1-u) + v^2 is a different number, and it slips past unnoticed
     wherever v happens to be near zero -- which it is at a voltage maximum. */
  check('08 medium: R_in by rotation', A('input-impedance.html',1,0),
        50*(1 - u*u - v*v)/den, 1e-6);
  check('08 medium: X_in by rotation', A('input-impedance.html',1,1),
        50*(v*(1-u) + (1+u)*v)/den, 1e-6);
  /* the real-impedance point: R there times R at the other point must be Z0^2 */
  const Rthere = A('input-impedance.html',2,1);
  const gm = Math.hypot(gr, gi), swr = (1+gm)/(1-gm);
  const ok = near(Rthere, 50*swr, 1e-6) || near(Rthere, 50/swr, 1e-6);
  s.check('08 hard: R is Z0*SWR or Z0/SWR', ok, Rthere.toPrecision(6));
}

/* 09 stubs: checked by what the length actually presents */
check('09 easy: quarter-wave Z1', A('line-lengths.html',0,0), Math.sqrt(10000), 1e-9);
{
  const l = A('line-lengths.html',1,0);
  check('09 medium: shorted stub really gives +j75', 50*Math.tan(TAU*l), 75, 1e-6);
  const l2 = A('line-lengths.html',2,0);
  check('09 hard: open stub really gives -j40', -50/Math.tan(TAU*l2), -40, 1e-6);
}

/* 10 the chart */
check('10 easy: r', A('smith-chart.html',0,0), 1.5, 1e-12);
check('10 easy: x', A('smith-chart.html',0,1), 1, 1e-12);
check('10 easy: |Gamma|', A('smith-chart.html',0,2),
      Math.hypot(0.5, 1)/Math.hypot(2.5, 1), 1e-9);
{
  /* y = 1/z checked by multiplying back to 1 */
  const g = A('smith-chart.html',1,0), b = A('smith-chart.html',1,1);
  check('10 medium: z*y = 1 (real)', 1.5*g - 1*b, 1, 1e-9);
  check('10 medium: z*y = 1 (imag)', 1.5*b + 1*g, 0, 1e-9);
  /* travel preserves |Gamma| */
  const r2 = A('smith-chart.html',2,0), x2 = A('smith-chart.html',2,1);
  const m2 = Math.hypot(r2-1, x2)/Math.hypot(r2+1, x2);
  check('10 hard: travel preserves |Gamma|', m2,
        Math.hypot(0.5, 1)/Math.hypot(2.5, 1), 1e-5);
}

/* 11 matching: every design is checked by assembling it and demanding y = 1 */
{
  const zr = 0.5, zi = -0.6;
  check('11 easy: quarter-wave Z1', A('matching.html',0,0), Math.sqrt(5000), 1e-9);
  for (const [i, name] of [[1, 'medium'], [2, 'hard']]){
    const d = A('matching.html', i, 0), ls = A('matching.html', i, 1);
    /* travel d, then add the stub, and the result must be 1 + j0 */
    const gr = ((zr-1)*(zr+1) + zi*zi)/((zr+1)*(zr+1) + zi*zi);
    const gi = (zi*(zr+1) - (zr-1)*zi)/((zr+1)*(zr+1) + zi*zi);
    const m = Math.hypot(gr, gi), a = Math.atan2(gi, gr) - 2*TAU*d;
    const u = m*Math.cos(a), v = m*Math.sin(a);
    const den = (1-u)*(1-u) + v*v;
    const z = [(1 - u*u - v*v)/den, 2*v/den];
    const dz = z[0]*z[0] + z[1]*z[1];
    const y = [z[0]/dz, -z[1]/dz];
    const yt = [y[0], y[1] - 1/Math.tan(TAU*ls)];      /* shorted shunt stub */
    s.check('11 ' + name + ': the design really matches',
            Math.abs(yt[0] - 1) < 3e-3 && Math.abs(yt[1]) < 3e-3,
            'y = ' + yt[0].toFixed(4) + (yt[1] < 0 ? ' - j' : ' + j') + Math.abs(yt[1]).toFixed(4));
  }
  s.check('11: the two solutions are different',
          Math.abs(A('matching.html',1,0) - A('matching.html',2,0)) > 0.02);
}

s.done();
