/* Problems: three easy, three medium, three hard and one stretch problem for
   each of the eleven chapters.

   PURE ASCII. This file is served with no charset declaration, exactly like
   site.js and search-index.js, so Greek and symbols are written as HTML
   entities (&lambda;, &Omega;, &deg;) or as TeX, both of which are ASCII.

   No answer is written down. Every one is computed from the numbers in its own
   question, by the same physics the chapters derive -- so a problem cannot
   drift away from its answer, and tests/problems.test.js recomputes each one by
   an independent route and refuses to let a wrong one ship.

   Each field's `ans` returns the value in the unit its label names. `tol` is a
   relative tolerance; the default of 2% is what a careful hand calculation off
   a chart should manage.

   The `stretch` problem in each chapter is the one that reaches past the
   chapter: it either needs a result from an earlier one, or it is the question
   the chapter was building toward but stopped short of. It is a separate level
   rather than a fourth hard problem so that nobody feels obliged to finish it. */

(function(){
  var TAU = Math.PI*2, C0 = 299792458, MU0 = 4e-7*Math.PI, EPS0 = 1/(MU0*C0*C0);

  /* ---- shared physics, written once ---- */
  function gam(r, x){                       /* normalised z -> Gamma */
    var dr = r+1, di = x, d = dr*dr + di*di;
    return [((r-1)*dr + x*di)/d, (x*dr - (r-1)*di)/d];
  }
  function zOf(u, v){                       /* Gamma -> normalised z */
    var dr = 1-u, di = -v, d = dr*dr + di*di;
    return [((1+u)*dr + v*di)/d, (v*dr - (1+u)*di)/d];
  }
  function mag(g){ return Math.hypot(g[0], g[1]); }
  function swrOf(m){ return (1+m)/(1-m); }
  function wrapHalf(d){ d = d % 0.5; if(d < 0) d += 0.5; return d; }
  /* a normalised impedance (or admittance) moved d wavelengths toward the
     source; the two obey the same transform, which is why one function serves */
  function move(r, x, d){
    var t = Math.tan(TAU*d);
    var nr = r, ni = x + t, dr = 1 - x*t, di = r*t;
    var q = dr*dr + di*di;
    return [(nr*dr + ni*di)/q, (ni*dr - nr*di)/q];
  }
  function inv(r, x){                       /* 1/(r+jx) */
    var d = r*r + x*x;
    return [r/d, -x/d];
  }
  /* the length, in wavelengths, of a stub that must present `val`: a
     susceptance if the stub is in shunt, a reactance if it is in series. The
     two cases differ only by swapping open for shorted, because a shunt stub
     contributes tan for an open and -cot for a short while a series stub does
     the reverse -- so `series()` below passes !isOpen and reuses this. */
  function stubLen(val, isOpen){
    var a = isOpen ? Math.atan(val) : Math.atan2(-1, val);
    while(a < 0) a += Math.PI;
    while(a >= Math.PI) a -= Math.PI;
    return a/TAU;
  }
  /* the two single-shunt-stub designs for a normalised load */
  function stubs(r, x, isOpen){
    var g = gam(r, x), m = mag(g), th = Math.atan2(g[1], g[0]), out = [];
    [1, -1].forEach(function(sg){
      var u = -m*m, v = sg*m*Math.sqrt(Math.max(0, 1 - m*m));
      var d = wrapHalf((th - Math.atan2(v, u))/(2*TAU));
      var b = -2*v/(1 - m*m);
      out.push({ d: d, ls: stubLen(-b, isOpen), b: b });
    });
    out.sort(function(a, b2){ return a.d - b2.d; });
    return out;
  }
  /* the two series-stub designs: the r = 1 circle instead of the g = 1 circle */
  function series(r, x, isOpen){
    var g = gam(r, x), m = mag(g), th = Math.atan2(g[1], g[0]), out = [];
    [1, -1].forEach(function(sg){
      var u = m*m, v = sg*m*Math.sqrt(Math.max(0, 1 - m*m));
      var d = wrapHalf((th - Math.atan2(v, u))/(2*TAU));
      var xr = zOf(u, v)[1];                /* the reactance sitting on r = 1 */
      out.push({ d: d, ls: stubLen(-xr, !isOpen), x: xr });
    });
    out.sort(function(a, b2){ return a.d - b2.d; });
    return out;
  }
  /* double stub, the first at the load and the second dd wavelengths along */
  function doubleStub(r, x, dd, isOpen){
    var y = inv(r, x), g = y[0], bL = y[1];
    var t = Math.tan(TAU*dd), out = [];
    var disc = g*(1 + t*t) - g*g*t*t;       /* from Re(y2) = 1 */
    if(disc < 0) return out;
    [1, -1].forEach(function(sg){
      var b = (1 + sg*Math.sqrt(disc))/t;
      var b1 = b - bL, y2 = move(g, b, dd);
      out.push({ l1: stubLen(b1, isOpen), l2: stubLen(-y2[1], isOpen),
                 b1: b1, b2: -y2[1] });
    });
    out.sort(function(a, b2){ return a.l1 - b2.l1; });
    return out;
  }
  /* microstrip, Hammerstad, for W/h >= 1 */
  function eeff(er, wh){
    return (er+1)/2 + (er-1)/2*Math.pow(1 + 12/wh, -0.5);
  }
  function z0ms(er, wh){
    var ee = eeff(er, wh);
    return 120*Math.PI/(Math.sqrt(ee)*(wh + 1.393 + 0.667*Math.log(wh + 1.444)));
  }
  function whFor(er, z){                    /* invert z0ms by bisection */
    var lo = 0.3, hi = 25;
    for(var i = 0; i < 90; i++){
      var mid = (lo + hi)/2;
      if(z0ms(er, mid) > z) lo = mid; else hi = mid;
    }
    return (lo + hi)/2;
  }

  window.TLT_PROBLEMS = {

  /* ================= P1 Maxwell's equations ================= */
  'prologue-maxwell.html': [
    { lvl: 'easy',
      q: 'A 100 pF capacitor is charged so its voltage rises at $dV/dt = 2\\times10^6$ V/s. Give the displacement current.',
      f: [ { lab: 'I_d (mA)', ans: function(){ return 100e-12*2e6*1e3; } } ],
      why: 'A capacitor\'s current is $I = C\\,dV/dt$ by definition, and this is exactly the displacement current that keeps Amp&egrave;re\'s law consistent whichever surface you choose through the loop -- the flat one sees it as conduction current in the lead, the bulging one sees it as $\\partial\\vD/\\partial t$ in the gap.' },

    { lvl: 'easy',
      q: 'A parallel-plate capacitor with plate area $4\\ \\text{cm}^2$ carries charge $2$ nC. Give $D$ between the plates, ignoring fringing.',
      f: [ { lab: 'D (&mu;C/m&sup2;)', ans: function(){ return (2e-9/4e-4)*1e6; } } ],
      why: 'A Gaussian pillbox enclosing one plate gives $D = \\rho_s = Q/A$ directly -- the field between the plates depends only on the charge already there, not on how fast it arrived.' },

    { lvl: 'easy',
      q: 'A time-harmonic electric field in vacuum has $E(t) = 50\\cos(\\omega t)$ V/m at $f = 300$ MHz. Give the peak displacement current density.',
      f: [ { lab: 'J_d,max (mA/m&sup2;)', ans: function(){ return EPS0*50*TAU*300e6*1e3; } } ],
      why: '$\\vJ_d = \\varepsilon_0\\,\\partial\\vE/\\partial t$, and differentiating a cosine peaks at amplitude times $\\omega$, so $J_{d,\\max} = \\varepsilon_0 E_0 \\omega$. No charge moves anywhere in this calculation -- the vacuum itself is "conducting" in Maxwell\'s sense.' },

    { lvl: 'medium',
      q: 'A capacitor with plate area $10\\ \\text{cm}^2$ charges at a constant current of $8$ mA. Give the rate of change of $D$ between the plates.',
      f: [ { lab: 'dD/dt (C/(m&sup2;&middot;s))', ans: function(){ return 8e-3/1e-3; } } ],
      why: 'Since $D = Q/A$ at every instant, differentiating in time gives $dD/dt = (dQ/dt)/A$ directly -- and that is the integrand that makes the displacement current through the gap equal the conduction current in the wire.' },

    { lvl: 'medium',
      q: 'A straight wire carries $120$ mA toward a capacitor it is charging. On an Amp&egrave;rian loop of radius $4$ cm centred on the wire, give $H$.',
      f: [ { lab: 'H (mA/m)', ans: function(){ return (0.120/(TAU*0.04))*1000; } } ],
      why: 'Whichever surface spans the loop -- flat through the wire, or bulging through the gap between the plates -- Amp&egrave;re&ndash;Maxwell must enclose the same current, so $H$ cannot depend on that choice. The flat surface is easiest: it sees only the conduction current $I$, giving the ordinary $H = I/2\\pi r$ of a wire.' },

    { lvl: 'medium',
      q: 'A uniform $dB/dt = 0.8$ T/s threads a flat circular loop of radius $5$ cm. Give the magnitude of the circulation of $\\vE$ around the loop.',
      f: [ { lab: 'EMF (mV)', ans: function(){ return Math.PI*0.05*0.05*0.8*1000; } } ],
      why: 'Faraday\'s law in integral form is $\\oint\\vE\\cdot d\\mathbf{l} = -d\\Phi_B/dt$, and with $dB/dt$ uniform over a flat loop the flux is simply area times $dB/dt$.' },

    { lvl: 'hard',
      q: 'A circular parallel-plate capacitor of radius $1$ cm and gap $1$ mm, vacuum dielectric, is driven at $f = 500$ MHz with a $10$ V peak across the gap. Give the peak displacement current through it.',
      f: [ { lab: 'I_d (mA)', ans: function(){
               var a = 0.01, d = 1e-3, V0 = 10, w = TAU*500e6;
               var C = EPS0*Math.PI*a*a/d;
               return C*V0*w*1000; } } ],
      why: 'Between the plates $E = V/d$ and $D = \\varepsilon_0 E$, so $I_d = A\\,dD/dt = (\\varepsilon_0 A/d)\\,dV/dt$ -- which is exactly $C\\,dV/dt$ with $C = \\varepsilon_0 A/d$. Field and lumped-circuit pictures of the same capacitor have to agree, and this is the arithmetic that shows it.' },

    { lvl: 'hard',
      q: 'A medium has conductivity $\\sigma = 0.02$ S/m and $\\varepsilon_r = 4$. At $f = 1$ GHz, give the ratio of conduction to displacement current density.',
      f: [ { lab: 'J_c/J_d', ans: function(){ return 0.02/(TAU*1e9*4*EPS0); } } ],
      why: 'Amp&egrave;re&ndash;Maxwell\'s right side is $\\vJ + \\partial\\vD/\\partial t$; with $\\vJ = \\sigma\\vE$ and $\\vD = \\varepsilon\\vE$ the two terms have ratio $\\sigma/\\omega\\varepsilon$, the loss tangent. Below 1 the medium behaves mostly like a capacitor; above 1, mostly like a resistor.' },

    { lvl: 'hard',
      q: 'In a region, $\\vJ = 2x\\,\\hat x - 3y\\,\\hat y + 5z\\,\\hat z$ A/m$^2$ (coefficients in A/m$^3$). Give the rate of change of volume charge density at any point there.',
      f: [ { lab: 'd&rho;_v/dt (C/(m&sup3;&middot;s))', ans: function(){ return -(2 - 3 + 5); } } ],
      why: 'Taking the divergence of the corrected Amp&egrave;re law gives the continuity equation $\\dive\\vJ + \\partial\\rho_v/\\partial t = 0$. The divergence of a linear field is just the sum of the three coefficients, $2 - 3 + 5 = 4$ A/m$^3$, so charge drains from every point in this region at that rate.' },

    { lvl: 'stretch',
      q: 'Maxwell\'s equations fix two constants from completely unrelated experiments: $\\mu_0$ from the force between current-carrying wires, $\\varepsilon_0$ from the force between charged plates. Combine them into a quantity with units of velocity, and give it alongside its ratio to $c = 299{,}792{,}458$ m/s.',
      f: [ { lab: 'u (&times;10&#8312; m/s)', ans: function(){ return 1/Math.sqrt(MU0*EPS0)/1e8; } },
           { lab: 'u / c',                    ans: function(){ return 1/Math.sqrt(MU0*EPS0)/C0; } } ],
      why: 'This is the calculation the chapter sets up and stops short of: $u = 1/\\sqrt{\\mu_0\\varepsilon_0}$ comes out equal, to measurement precision, to the speed of light -- two benchtop constants from electrostatics and magnetostatics, with no optics anywhere in their derivation, predicting exactly how fast light travels. That coincidence is what told Maxwell light itself is an electromagnetic wave, and the next chapter derives why.' }
  ],

  /* ================= P2 the wave equation and Helmholtz ================= */
  'prologue-helmholtz.html': [
    { lvl: 'easy',
      q: 'Polyethylene has $\\varepsilon_r = 2.1$, $\\mu_r = 1$. Give the propagation speed of a wave inside it.',
      f: [ { lab: 'u (&times;10&#8312; m/s)', ans: function(){ return C0/Math.sqrt(2.1)/1e8; } } ],
      why: '$u = 1/\\sqrt{\\mu\\varepsilon} = c/\\sqrt{\\varepsilon_r\\mu_r}$ -- a dielectric with no magnetic response simply divides the free-space speed by $\\sqrt{\\varepsilon_r}$.' },

    { lvl: 'easy',
      q: 'A lossless medium has $\\varepsilon_r = 4$, $\\mu_r = 1$. Give its intrinsic impedance.',
      f: [ { lab: '&eta; (&Omega;)', ans: function(){ return Math.sqrt(MU0/EPS0)/Math.sqrt(4); } } ],
      why: '$\\eta = \\sqrt{\\mu/\\varepsilon}$; with $\\mu_r = 1$ only $\\varepsilon_r$ moves it, and only by $\\sqrt{\\varepsilon_r}$ -- which is why doubling a dielectric\'s permittivity does not halve $\\eta$.' },

    { lvl: 'easy',
      q: 'A wave has propagation constant $\\gamma = 0.1 + j12$ per metre. Give $\\alpha$ and $\\beta$.',
      f: [ { lab: '&alpha; (Np/m)', ans: function(){ return 0.1; } },
           { lab: '&beta; (rad/m)', ans: function(){ return 12; } } ],
      why: '$\\gamma = \\alpha + j\\beta$ by definition -- the real part decays the amplitude, the imaginary part advances the phase. Nothing to compute, only to recognise which is which.' },

    { lvl: 'medium',
      q: 'A lossy dielectric has $\\sigma = 1$ mS/m, $\\varepsilon_r = 2.5$, $\\mu_r = 1$, at $f = 500$ MHz. Give $\\alpha$ and $\\beta$.',
      f: [ { lab: '&alpha; (Np/m)', ans: function(){
               var sigma = 0.001, eps = 2.5*EPS0, mu = MU0, w = TAU*500e6;
               var lt = sigma/(w*eps), k = w*Math.sqrt(mu*eps/2);
               return k*Math.sqrt(Math.sqrt(1+lt*lt) - 1); } },
           { lab: '&beta; (rad/m)', ans: function(){
               var sigma = 0.001, eps = 2.5*EPS0, mu = MU0, w = TAU*500e6;
               var lt = sigma/(w*eps), k = w*Math.sqrt(mu*eps/2);
               return k*Math.sqrt(Math.sqrt(1+lt*lt) + 1); } } ],
      why: 'The general lossy-medium solution of $\\gamma^2 = j\\omega\\mu(\\sigma+j\\omega\\varepsilon)$ is $\\alpha,\\beta = \\omega\\sqrt{\\mu\\varepsilon/2}\\,\\sqrt{\\sqrt{1+(\\sigma/\\omega\\varepsilon)^2}\\mp1}$. The loss tangent here is small, so $\\beta$ comes out close to the lossless $\\omega\\sqrt{\\mu\\varepsilon}$ and $\\alpha$ stays small -- a low-loss dielectric, not a conductor.' },

    { lvl: 'medium',
      q: 'A plane wave in free space has peak $E_0 = 120$ V/m. Give the peak magnetic field.',
      f: [ { lab: 'H_0 (A/m)', ans: function(){ return 120/Math.sqrt(MU0/EPS0); } } ],
      why: '$\\eta$ is defined as the ratio $\\tilde E_x/\\tilde H_y$, and in a lossless medium it is real, so the peak fields divide by it directly: $H_0 = E_0/\\eta_0$.' },

    { lvl: 'medium',
      q: 'A medium has $\\varepsilon_r = 9$, $\\mu_r = 1$. At $f = 3$ GHz, give $\\beta$ and $\\lambda$.',
      f: [ { lab: '&beta; (rad/m)', ans: function(){ return TAU*3e9/(C0/3); } },
           { lab: '&lambda; (mm)',  ans: function(){ return (C0/3)/3e9*1000; } } ],
      why: '$u = c/\\sqrt{\\varepsilon_r} = c/3$ here, then $\\beta = \\omega/u$ and $\\lambda = u/f$ as usual. Loading a line with a higher-permittivity dielectric is exactly how microstrip in chapter 05 packs a given electrical length into a shorter physical one.' },

    { lvl: 'hard',
      q: 'A medium has $\\sigma = 0.01$ S/m, $\\varepsilon_r = 4$, $\\mu_r = 1$, at $f = 1$ GHz. Give $|\\eta|$ and its angle.',
      f: [ { lab: '|&eta;| (&Omega;)', ans: function(){
               var sigma = 0.01, eps = 4*EPS0, mu = MU0, w = TAU*1e9;
               var denRe = sigma, denIm = w*eps, dd = denRe*denRe + denIm*denIm;
               var qRe = (w*mu*denIm)/dd, qIm = (w*mu*denRe)/dd;
               var m = Math.hypot(qRe, qIm);
               return Math.sqrt(m); } },
           { lab: 'angle (&deg;)', ans: function(){
               var sigma = 0.01, eps = 4*EPS0, mu = MU0, w = TAU*1e9;
               var denRe = sigma, denIm = w*eps, dd = denRe*denRe + denIm*denIm;
               var qRe = (w*mu*denIm)/dd, qIm = (w*mu*denRe)/dd;
               var a = Math.atan2(qIm, qRe);
               return (a/2)*180/Math.PI; } } ],
      why: 'In a lossy medium $\\eta = \\sqrt{j\\omega\\mu/(\\sigma+j\\omega\\varepsilon)}$ is complex: take the quotient, then the square root by halving the angle and rooting the magnitude. The small nonzero angle means $E$ and $H$ no longer peak at the same instant -- the signature of a medium that dissipates some of what it carries.' },

    { lvl: 'hard',
      q: 'For the lossy dielectric above ($\\sigma = 1$ mS/m, $\\varepsilon_r = 2.5$, $\\mu_r = 1$, $f = 500$ MHz), give the attenuation per wavelength.',
      f: [ { lab: 'loss (dB per &lambda;)', ans: function(){
               var sigma = 0.001, eps = 2.5*EPS0, mu = MU0, w = TAU*500e6;
               var lt = sigma/(w*eps), k = w*Math.sqrt(mu*eps/2);
               var alpha = k*Math.sqrt(Math.sqrt(1+lt*lt) - 1);
               var beta  = k*Math.sqrt(Math.sqrt(1+lt*lt) + 1);
               return alpha*8.685889638*(TAU/beta); } } ],
      why: 'One wavelength of travel multiplies the amplitude by $e^{-\\alpha\\lambda}$, and converting $\\alpha$ (Np/m) to dB and multiplying by $\\lambda$ gives the loss per cycle directly. Under half a decibel here -- which is why a low-loss dielectric can be treated as lossless over any one wavelength of a circuit.' },

    { lvl: 'hard',
      q: 'For that same lossy dielectric, the low-loss approximation gives $\\alpha \\approx (\\sigma/2)\\sqrt{\\mu/\\varepsilon}$. Compare it against the exact $\\alpha$ from the full complex $\\gamma$, as a percentage.',
      f: [ { lab: 'error (%)', ans: function(){
               var sigma = 0.001, eps = 2.5*EPS0, mu = MU0, w = TAU*500e6;
               var lt = sigma/(w*eps), k = w*Math.sqrt(mu*eps/2);
               var exact = k*Math.sqrt(Math.sqrt(1+lt*lt) - 1);
               var approx = (sigma/2)*Math.sqrt(mu/eps);
               return 100*(approx - exact)/exact; }, tol: 0.1 } ],
      why: 'Expanding $\\sqrt{1+(\\sigma/\\omega\\varepsilon)^2} \\approx 1 + \\tfrac12(\\sigma/\\omega\\varepsilon)^2$ for a small loss tangent collapses the exact formula to $\\alpha \\approx (\\sigma/2)\\sqrt{\\mu/\\varepsilon} = \\sigma\\eta/2$. The two agree to a few thousandths of a percent here, which is why nearly every textbook table of dielectric loss quotes this approximation rather than the exact root.' },

    { lvl: 'stretch',
      q: 'Everything on this page stopped at the ratio of fields. The time-average power a plane wave carries is $S_{avg} = E_0^2/(2\\eta)$. For free space with $E_0 = 100$ V/m peak, give it.',
      f: [ { lab: 'S_avg (W/m&sup2;)', ans: function(){ var eta0 = Math.sqrt(MU0/EPS0); return 1e4/(2*eta0); } } ],
      why: '$\\eta$ was introduced purely as a field ratio, but once you have it, the power follows the same shape as $|V|^2/2Z_0$ on a line -- which is exactly the quantity chapter 07 onward will care about, just not yet in field form.' }
  ],

  /* ================= 01 waves, phasors, complex numbers ================= */
  'waves-phasors.html': [
    { lvl: 'easy',
      q: 'A wave on a line travels at $u_p = 2\\times10^{8}$ m/s at $f = 800$ MHz.',
      f: [ { lab: '&lambda; (m)',   ans: function(){ return 2e8/800e6; } },
           { lab: '&beta; (rad/m)', ans: function(){ return TAU/(2e8/800e6); } } ],
      why: 'A wavelength is the distance one cycle occupies, so $\\lambda = u_p/f = 0.25$ m. The phase constant counts radians per metre: $\\beta = 2\\pi/\\lambda$.' },

    { lvl: 'easy',
      q: 'On a line with $\\lambda = 12$ cm, how far apart are two points whose phases differ by $90^\\circ$?',
      f: [ { lab: 'distance (cm)', ans: function(){ return 12/4; } } ],
      why: 'Phase accumulates as $\\beta z$, and one full cycle of $360^\\circ$ is one wavelength, so $90^\\circ$ is a quarter of it. Nothing about the line enters except its wavelength.' },

    { lvl: 'easy',
      q: 'Write $\\tilde V = 3 + j4$ V in polar form.',
      f: [ { lab: '|V| (V)',       ans: function(){ return 5; } },
           { lab: 'angle (&deg;)', ans: function(){ return Math.atan2(4, 3)*180/Math.PI; }, tol: 0.03 } ],
      why: 'Magnitude by Pythagoras, angle by $\\arctan(4/3)$. The 3-4-5 triangle is worth recognising on sight, because normalised impedances land on it constantly.' },

    { lvl: 'medium',
      q: 'A voltage phasor is $\\tilde V = 10\\angle 30^\\circ$ V at $f = 1$ GHz. What is the instantaneous voltage at $t = 0.25$ ns?',
      f: [ { lab: 'v (V)', ans: function(){
               return 10*Math.cos(TAU*1e9*0.25e-9 + 30*Math.PI/180); }, tol: 0.03 } ],
      why: 'The phasor is shorthand for $v(t) = |\\tilde V|\\cos(\\omega t + \\phi)$. At $t = 0.25$ ns, $\\omega t = 2\\pi(10^{9})(0.25\\times10^{-9}) = \\pi/2$, so $v = 10\\cos(90^\\circ + 30^\\circ)$.' },

    { lvl: 'medium',
      q: 'A voltage is $v(z,t) = 8\\cos(6\\pi\\times10^{9}t + 40\\pi z)$ V. Give $u_p$, and the direction of travel as a sign ($+1$ for $+z$, $-1$ for $-z$).',
      f: [ { lab: 'u_p (m/s)', ans: function(){ return 6*Math.PI*1e9/(40*Math.PI); } },
           { lab: 'direction', ans: function(){ return -1; }, tol: 0.001 } ],
      why: '$u_p = \\omega/\\beta$, here $3\\times10^{9}\\pi / 40\\pi$. The sign between $\\omega t$ and $\\beta z$ gives the direction: with a plus sign, holding the phase constant as $t$ rises requires $z$ to fall, so the wave moves toward $-z$.' },

    { lvl: 'medium',
      q: 'Divide $\\tilde V_1 = 12\\angle 70^\\circ$ by $\\tilde V_2 = 3\\angle 25^\\circ$.',
      f: [ { lab: 'magnitude',     ans: function(){ return 12/3; } },
           { lab: 'angle (&deg;)', ans: function(){ return 70 - 25; } } ],
      why: 'Dividing phasors divides magnitudes and subtracts angles. This is why every ratio in the subject -- $\\Gamma$, $\\tau$, $Z_{\\text{in}}/Z_0$ -- is easiest in polar form and clumsy in rectangular.' },

    { lvl: 'hard',
      q: 'Two waves of the same frequency add: $\\tilde V_1 = 6\\angle 0^\\circ$ and $\\tilde V_2 = 4\\angle 120^\\circ$ volts.',
      f: [ { lab: '|V| (V)', ans: function(){
               var re = 6 + 4*Math.cos(120*Math.PI/180), im = 4*Math.sin(120*Math.PI/180);
               return Math.hypot(re, im); } },
           { lab: 'angle (&deg;)', ans: function(){
               var re = 6 + 4*Math.cos(120*Math.PI/180), im = 4*Math.sin(120*Math.PI/180);
               return Math.atan2(im, re)*180/Math.PI; }, tol: 0.05 } ],
      why: 'Phasors add as vectors, which is the whole reason for using them. In rectangular form $6 + 4(\\cos 120^\\circ + j\\sin 120^\\circ) = 4 + j3.46$, and its magnitude and angle follow.' },

    { lvl: 'hard',
      q: 'A forward wave of amplitude 10 V and a backward wave of 4 V travel on the same lossless line. Give the largest and smallest total amplitude found anywhere along it.',
      f: [ { lab: 'max (V)', ans: function(){ return 14; } },
           { lab: 'min (V)', ans: function(){ return 6; } } ],
      why: 'The two waves slide in and out of step as $z$ changes, because their phases run in opposite directions. They can only ever add or subtract, so the envelope lies between $|V^+| + |V^-|$ and $|V^+| - |V^-|$. That is the standing wave of chapter 07, met here before it has a name.' },

    { lvl: 'hard',
      q: 'Express $\\tilde V = 5\\angle 143^\\circ$ V in rectangular form.',
      f: [ { lab: 'real (V)', ans: function(){ return 5*Math.cos(143*Math.PI/180); }, tol: 0.03 },
           { lab: 'imag (V)', ans: function(){ return 5*Math.sin(143*Math.PI/180); }, tol: 0.03 } ],
      why: 'Straight from the definition: $5(\\cos 143^\\circ + j\\sin 143^\\circ)$. The real part is negative because the angle is in the second quadrant -- worth predicting before reaching for a calculator, since a sign error here propagates through everything after it.' },

    { lvl: 'stretch',
      q: 'A lossless line carries $v(z,t) = 8\\cos(\\omega t - \\beta z) + 3\\cos(\\omega t + \\beta z + 60^\\circ)$ volts. Give the largest and smallest amplitude of the total, and the distance in wavelengths from $z = 0$ to the first maximum at positive $z$.',
      f: [ { lab: 'max (V)', ans: function(){ return 11; } },
           { lab: 'min (V)', ans: function(){ return 5; } },
           { lab: 'first max (&lambda;)', ans: function(){
               return (TAU - 60*Math.PI/180)/2/TAU; }, tol: 0.03 } ],
      why: 'As phasors the total is $8e^{-j\\beta z} + 3e^{j(\\beta z + 60^\\circ)}$, so the phase between them is $2\\beta z + 60^\\circ$. They add in step when that is a multiple of $2\\pi$: the first such $z > 0$ has $2\\beta z = 300^\\circ$, giving $z = 5\\lambda/12$. The extremes are $8 \\pm 3$. Note the pattern repeats every $\\lambda/2$, not every $\\lambda$ -- that doubling is what makes the Smith chart a half-wavelength device.' }
  ],

  /* ================= 02 when a circuit becomes a line ================= */
  'circuit-to-line.html': [
    { lvl: 'easy',
      q: 'A connection is 5 cm long and signals travel along it at $2\\times10^{8}$ m/s. At what frequency is it one tenth of a wavelength?',
      f: [ { lab: 'f (MHz)', ans: function(){ return 2e8/(10*0.05)/1e6; } } ],
      why: 'One tenth of a wavelength means $\\lambda = 10\\times0.05 = 0.5$ m, and $f = u_p/\\lambda$.' },

    { lvl: 'easy',
      q: 'A 2 m cable carries 60 Hz mains, travelling at $2\\times10^{8}$ m/s. How long is it in wavelengths?',
      f: [ { lab: 'length (&lambda;)', ans: function(){ return 2/(2e8/60); }, tol: 0.03 } ],
      why: 'At 60 Hz the wavelength is over 3000 km, so 2 m is about $6\\times10^{-7}\\lambda$ -- utterly lumped. This is why nobody models house wiring as a transmission line, and why the same copper at 3 GHz must be.' },

    { lvl: 'easy',
      q: 'A signal takes 0.4 ns to cross a board trace. At 1 GHz, what fraction of one period is that?',
      f: [ { lab: 'fraction of a period', ans: function(){ return 0.4e-9/(1/1e9); } } ],
      why: 'One period at 1 GHz is 1 ns, so the delay is 0.4 of it. Delay compared with period is the whole question: a node is a node only when every part of it agrees on the voltage, and 40% of a cycle out of step is nowhere near agreement.' },

    { lvl: 'medium',
      q: 'A trace is 8 cm long on a board with $\\varepsilon_{\\text{eff}} = 2.2$, carrying 1.5 GHz. Give its electrical length.',
      f: [ { lab: 'length (&deg;)', ans: function(){
               var up = C0/Math.sqrt(2.2), lam = up/1.5e9;
               return 360*0.08/lam; }, tol: 0.03 } ],
      why: 'Electrical length is physical length in wavelengths, times $360^\\circ$. Here $u_p = c/\\sqrt{\\varepsilon_{\\text{eff}}}$ and $\\lambda = u_p/f$, so the trace is well over half a wavelength -- long past the point where it can be treated as a node.' },

    { lvl: 'medium',
      q: 'The end-to-end discrepancy of a lumped model is $2|\\sin(\\beta\\ell/2)|$. Give it as a percentage for $\\ell = 0.05\\lambda$.',
      f: [ { lab: 'error (%)', ans: function(){
               return 200*Math.abs(Math.sin(Math.PI*0.05)); }, tol: 0.03 } ],
      why: 'With $\\beta\\ell = 2\\pi(0.05)$ the half-angle is $9^\\circ$, giving about 31%. That is at the length many textbooks quote as the boundary, so the boundary is a convention about tolerable error rather than a physical edge.' },

    { lvl: 'medium',
      q: 'Using the same $2|\\sin(\\beta\\ell/2)|$, what is the longest line, in wavelengths, that keeps a lumped model under 10% error?',
      f: [ { lab: 'length (&lambda;)', ans: function(){
               return Math.asin(0.05)/Math.PI; }, tol: 0.03 } ],
      why: 'Set $2\\sin(\\pi\\ell/\\lambda) = 0.1$, so $\\ell/\\lambda = \\arcsin(0.05)/\\pi \\approx 0.016$. Rather stricter than the $\\lambda/10$ that everyone actually uses -- worth knowing what the convenient rule costs.' },

    { lvl: 'hard',
      q: 'A lumped model is taken as valid up to $\\ell = \\lambda/20$. For a 3 cm trace with $\\varepsilon_{\\text{eff}} = 3.2$, above what frequency does it fail?',
      f: [ { lab: 'f (MHz)', ans: function(){
               var up = C0/Math.sqrt(3.2);
               return up/(20*0.03)/1e6; }, tol: 0.03 } ],
      why: 'The limit is $\\lambda = 20\\ell = 0.6$ m, and $f = u_p/\\lambda$ with $u_p = c/\\sqrt{3.2}$. The answer is as much a property of the board as of the trace.' },

    { lvl: 'hard',
      q: 'The same 2 cm trace is laid on two boards, one with $\\varepsilon_{\\text{eff}} = 2.0$ and one with $\\varepsilon_{\\text{eff}} = 9.0$, both at 3 GHz. Give the electrical length on each.',
      f: [ { lab: 'on 2.0 (&deg;)', ans: function(){
               return 360*0.02/((C0/Math.sqrt(2))/3e9); }, tol: 0.03 },
           { lab: 'on 9.0 (&deg;)', ans: function(){
               return 360*0.02/((C0/Math.sqrt(9))/3e9); }, tol: 0.03 } ],
      why: 'Electrical length scales as $\\sqrt{\\varepsilon_{\\text{eff}}}$, so the high-permittivity board makes the same copper more than twice as long electrically. This is why ceramic substrates shrink circuits, and why they are less forgiving to lay out.' },

    { lvl: 'hard',
      q: 'A clock edge has a 100 ps rise time. Interconnect is usually treated as a line once its one-way delay exceeds about a fifth of the rise time. At $2\\times10^{8}$ m/s, what length is that?',
      f: [ { lab: 'length (cm)', ans: function(){ return 2e8*(100e-12/5)*100; }, tol: 0.03 } ],
      why: 'The critical delay is 20 ps and length is delay times velocity, so 0.4 cm. Digital design meets this limit long before the clock frequency alone would suggest, because the edge contains frequencies far above the clock.' },

    { lvl: 'stretch',
      q: 'A 10 cm, $50\\ \\Omega$ trace on a board with $\\varepsilon_{\\text{eff}} = 4.0$ feeds a $200\\ \\Omega$ resistive load at 500 MHz. Give the true $|Z_{\\text{in}}|$, and the error of the lumped answer $Z_{\\text{in}} = Z_L$ as a percentage of it.',
      f: [ { lab: '|Z_in| (&Omega;)', ans: function(){
               var lam = (C0/2)/500e6, z = move(4, 0, 0.1/lam);
               return 50*Math.hypot(z[0], z[1]); }, tol: 0.04 },
           { lab: 'error (%)', ans: function(){
               var lam = (C0/2)/500e6, z = move(4, 0, 0.1/lam);
               var m = 50*Math.hypot(z[0], z[1]);
               return 100*(200 - m)/m; }, tol: 0.06 } ],
      why: 'First the electrical length: $u_p = c/2$, so $\\lambda = 30$ cm and the trace is $0.333\\lambda$ -- a third of a turn on the chart. Then $z_{\\text{in}} = (z_L + j\\tan\\beta\\ell)/(1 + jz_L\\tan\\beta\\ell)$ with $z_L = 4$. The lumped answer is not slightly wrong, it is wrong by a factor, and it also predicts no reactance at all where there is a great deal.' }
  ],

  /* ================= 03 the transmission line model ================= */
  'telegraphers.html': [
    { lvl: 'easy',
      q: 'A lossless line has $L\' = 250$ nH/m and $C\' = 100$ pF/m.',
      f: [ { lab: 'Z&#8320; (&Omega;)', ans: function(){ return Math.sqrt(250e-9/100e-12); } },
           { lab: 'u_p (m/s)',         ans: function(){ return 1/Math.sqrt(250e-9*100e-12); } } ],
      why: 'For a lossless line $Z_0 = \\sqrt{L\'/C\'}$ and $u_p = 1/\\sqrt{L\'C\'}$. Note $Z_0$ depends on their ratio and $u_p$ on their product, so the two can be set independently.' },

    { lvl: 'easy',
      q: 'Another lossless line has $L\' = 500$ nH/m and $C\' = 200$ pF/m. Give $Z_0$ and $u_p$.',
      f: [ { lab: 'Z&#8320; (&Omega;)', ans: function(){ return Math.sqrt(500e-9/200e-12); } },
           { lab: 'u_p (m/s)',         ans: function(){ return 1/Math.sqrt(500e-9*200e-12); } } ],
      why: 'Both parameters doubled from the previous problem, so the ratio is unchanged and $Z_0$ is the same 50 ohm -- while the product quadrupled, halving $u_p$. Two independent knobs, demonstrated.' },

    { lvl: 'easy',
      q: 'A line has $R\' = 0$ and $G\' = 0$. What is the real part of its propagation constant?',
      f: [ { lab: '&alpha; (Np/m)', ans: function(){ return 0; } } ],
      why: 'With no series resistance and no shunt leakage there is nothing to dissipate power, so $\\gamma = \\sqrt{(j\\omega L\')(j\\omega C\')} = j\\omega\\sqrt{L\'C\'}$ is purely imaginary and $\\alpha = 0$. The wave travels forever at constant amplitude.' },

    { lvl: 'medium',
      q: 'A lossless line is to have $Z_0 = 75\\ \\Omega$ and $u_p = 2\\times10^{8}$ m/s.',
      f: [ { lab: 'L\' (nH/m)', ans: function(){ return 75/2e8*1e9; } },
           { lab: 'C\' (pF/m)', ans: function(){ return 1/(75*2e8)*1e12; } } ],
      why: 'Invert the pair: $L\' = Z_0/u_p$ and $C\' = 1/(Z_0 u_p)$. Two numbers in, two out -- the model has exactly as many degrees of freedom as the measurements.' },

    { lvl: 'medium',
      q: 'A coaxial cable has $C\' = 100$ pF/m and a velocity factor of 0.66, so $u_p = 0.66c$.',
      f: [ { lab: 'Z&#8320; (&Omega;)', ans: function(){ return 1/(100e-12*0.66*C0); }, tol: 0.03 },
           { lab: 'L\' (nH/m)',        ans: function(){
               return (1/(100e-12*0.66*C0))/(0.66*C0)*1e9; }, tol: 0.03 } ],
      why: 'Combining the two lossless relations gives $Z_0 = 1/(C\'u_p)$, which is the useful form: capacitance per metre and velocity factor are exactly what a cable datasheet prints. Then $L\' = Z_0/u_p$.' },

    { lvl: 'medium',
      q: 'A line has $L\' = 300$ nH/m and $C\' = 120$ pF/m with $R\' = 4\\ \\Omega$/m, at 500 MHz. Give $\\omega L\'$ and the ratio $R\'/\\omega L\'$.',
      f: [ { lab: '&omega;L\' (&Omega;/m)', ans: function(){ return TAU*500e6*300e-9; }, tol: 0.03 },
           { lab: 'R\'/&omega;L\'',         ans: function(){ return 4/(TAU*500e6*300e-9); }, tol: 0.03 } ],
      why: 'About 942 ohm per metre of reactance against 4 ohm of resistance, a ratio of 0.0042. That smallness is precisely what "low loss" means, and it is why the lossless formulas survive at microwave frequencies while failing badly for an audio cable.' },

    { lvl: 'hard',
      q: 'A line has $R\' = 4\\ \\Omega$/m, $L\' = 300$ nH/m, $G\' = 0$, $C\' = 120$ pF/m at 500 MHz. Give $|Z_0|$ and its angle.',
      f: [ { lab: '|Z&#8320;| (&Omega;)', ans: function(){
               var w = TAU*500e6, Z = [4, w*300e-9], Y = [0, w*120e-12];
               var d = Y[0]*Y[0] + Y[1]*Y[1];
               var q = [(Z[0]*Y[0] + Z[1]*Y[1])/d, (Z[1]*Y[0] - Z[0]*Y[1])/d];
               return Math.sqrt(Math.hypot(q[0], q[1])); } },
           { lab: 'angle (&deg;)', ans: function(){
               var w = TAU*500e6, Z = [4, w*300e-9], Y = [0, w*120e-12];
               var d = Y[0]*Y[0] + Y[1]*Y[1];
               var q = [(Z[0]*Y[0] + Z[1]*Y[1])/d, (Z[1]*Y[0] - Z[0]*Y[1])/d];
               return Math.atan2(q[1], q[0])/2*180/Math.PI; }, tol: 0.06 } ],
      why: '$Z_0 = \\sqrt{Z\'/Y\'}$ with $Z\' = R\' + j\\omega L\'$ and $Y\' = G\' + j\\omega C\'$; the square root halves the angle. With $\\omega L\' \\approx 942\\ \\Omega$/m against $R\' = 4$, the line is nearly lossless and the angle is small -- but not zero, and that is what makes $Z_0$ complex.' },

    { lvl: 'hard',
      q: 'For that same line, by what percentage does $|Z_0|$ differ from the lossless $\\sqrt{L\'/C\'}$?',
      f: [ { lab: 'difference (%)', ans: function(){
               var w = TAU*500e6, Z = [4, w*300e-9], Y = [0, w*120e-12];
               var d = Y[0]*Y[0] + Y[1]*Y[1];
               var q = [(Z[0]*Y[0] + Z[1]*Y[1])/d, (Z[1]*Y[0] - Z[0]*Y[1])/d];
               var ex = Math.sqrt(Math.hypot(q[0], q[1])), ll = Math.sqrt(300e-9/120e-12);
               return 100*(ex - ll)/ll; }, tol: 0.15 } ],
      why: 'A few hundredths of a percent. The magnitude is second order in the loss while the angle is first order, so a low-loss line has essentially the textbook $Z_0$ -- just rotated very slightly into the complex plane. Worth knowing which quantities the loss reaches first.' },

    { lvl: 'hard',
      q: 'A distortionless line satisfies $R\'/L\' = G\'/C\'$. With $R\' = 5\\ \\Omega$/m, $L\' = 250$ nH/m and $C\' = 100$ pF/m, what $G\'$ is needed, and what is $\\alpha$?',
      f: [ { lab: 'G\' (mS/m)',     ans: function(){ return 5/250e-9*100e-12*1e3; }, tol: 0.03 },
           { lab: '&alpha; (Np/m)', ans: function(){ return 5*Math.sqrt(100e-12/250e-9); }, tol: 0.03 } ],
      why: 'The condition makes $\\gamma = \\sqrt{R\'G\'} + j\\omega\\sqrt{L\'C\'}$ exactly, so $\\alpha = R\'\\sqrt{C\'/L\'} = R\'/Z_0$ and does not depend on frequency: every component of a pulse is attenuated equally and the shape survives. Heaviside got long telegraph cables working by deliberately adding series inductance to approach this.' },

    { lvl: 'stretch',
      q: 'An air-filled coaxial line has $L\' = (\\mu_0/2\\pi)\\ln(b/a)$ and $C\' = 2\\pi\\varepsilon_0/\\ln(b/a)$. Design it for $Z_0 = 50\\ \\Omega$.',
      f: [ { lab: 'b/a', ans: function(){
               return Math.exp(50*TAU/(MU0*C0)); }, tol: 0.03 },
           { lab: 'L\' (nH/m)', ans: function(){
               return (MU0/TAU)*(50*TAU/(MU0*C0))*1e9; }, tol: 0.03 },
           { lab: 'C\' (pF/m)', ans: function(){
               return TAU*(1/(MU0*C0*C0))/(50*TAU/(MU0*C0))*1e12; }, tol: 0.03 } ],
      why: 'Their ratio gives $Z_0 = \\dfrac{1}{2\\pi}\\sqrt{\\mu_0/\\varepsilon_0}\\,\\ln(b/a) = 59.96\\ln(b/a)$, so $\\ln(b/a) = 0.834$ and $b/a = 2.30$. Their product gives $u_p = 1/\\sqrt{\\mu_0\\varepsilon_0} = c$ whatever the geometry -- as it must be for a line whose field is entirely in air. This is where the per-metre parameters stop being fitted numbers and become geometry.' }
  ],

  /* ================= 04 propagation ================= */
  'propagation.html': [
    { lvl: 'easy',
      q: 'A lossless line has $L\' = 400$ nH/m and $C\' = 160$ pF/m, at 1 GHz.',
      f: [ { lab: '&beta; (rad/m)', ans: function(){ return TAU*1e9*Math.sqrt(400e-9*160e-12); } },
           { lab: '&lambda; (cm)',  ans: function(){
               return TAU/(TAU*1e9*Math.sqrt(400e-9*160e-12))*100; } } ],
      why: 'On a lossless line $\\beta = \\omega\\sqrt{L\'C\'}$ and $\\lambda = 2\\pi/\\beta$. Only the product appears, so the wavelength says nothing about $Z_0$.' },

    { lvl: 'easy',
      q: 'An attenuation is quoted as 0.05 Np/m. Give it in dB/m.',
      f: [ { lab: '&alpha; (dB/m)', ans: function(){ return 0.05*8.685889638; }, tol: 0.03 } ],
      why: 'One neper is $20\\log_{10}e = 8.686$ dB. Nepers come from the natural exponential in $e^{-\\alpha z}$ and decibels from the convention -- the same physics in two costumes, and mixing them is a reliable source of factor-of-nine errors.' },

    { lvl: 'easy',
      q: 'A wave falls to $1/e$ of its amplitude over 20 m. Give $\\alpha$.',
      f: [ { lab: '&alpha; (Np/m)', ans: function(){ return 1/20; } } ],
      why: 'The envelope is $e^{-\\alpha z}$, so it falls by a factor $e$ in exactly $1/\\alpha$ metres. That is what a neper per metre means, and it is why nepers are the natural unit even though nobody quotes cables in them.' },

    { lvl: 'medium',
      q: 'A low-loss line with $Z_0 = 50\\ \\Omega$ has $R\' = 2\\ \\Omega$/m and $G\' = 0.4$ mS/m. Give the attenuation in Np/m and dB/m.',
      f: [ { lab: '&alpha; (Np/m)', ans: function(){ return 2/(2*50) + 0.4e-3*50/2; } },
           { lab: '&alpha; (dB/m)', ans: function(){
               return (2/(2*50) + 0.4e-3*50/2)*8.685889638; } } ],
      why: 'For a low-loss line the two mechanisms add: $\\alpha \\approx R\'/(2Z_0) + G\'Z_0/2$, the first from the conductors and the second from the dielectric. One neper is $20\\log_{10}e = 8.686$ dB.' },

    { lvl: 'medium',
      q: 'A cable is rated 0.3 dB/m at 2 GHz. What percentage of the input power survives 12 m?',
      f: [ { lab: 'power left (%)', ans: function(){
               return 100*Math.pow(10, -0.3*12/10); }, tol: 0.03 } ],
      why: 'Loss in decibels adds along the line: $0.3\\times12 = 3.6$ dB, and $10^{-3.6/10} \\approx 0.44$. The divisor is 10 because this is a power ratio, not 20 as it would be for an amplitude -- the commonest slip in the chapter.' },

    { lvl: 'medium',
      q: 'A lossless line has $u_p = 2\\times10^{8}$ m/s. Give $\\beta$ at 2.4 GHz, and the length in centimetres that gives $90^\\circ$ of phase.',
      f: [ { lab: '&beta; (rad/m)', ans: function(){ return TAU*2.4e9/2e8; }, tol: 0.03 },
           { lab: 'length (cm)',    ans: function(){ return (2e8/2.4e9)/4*100; }, tol: 0.03 } ],
      why: '$\\beta = \\omega/u_p$, and $90^\\circ$ of phase is a quarter wavelength. That quarter-wave length is what every transformer and stub in chapters 09 and 11 is measured against, so it is worth being able to produce in one step.' },

    { lvl: 'hard',
      q: 'A line has $R\' = 15\\ \\Omega$/m, $L\' = 250$ nH/m, $G\' = 2$ mS/m, $C\' = 100$ pF/m at 300 MHz. Give $\\alpha$ and $\\beta$ from the exact $\\gamma = \\sqrt{Z\'Y\'}$.',
      f: [ { lab: '&alpha; (Np/m)', ans: function(){
               var w = TAU*300e6, Z = [15, w*250e-9], Y = [2e-3, w*100e-12];
               var p = [Z[0]*Y[0] - Z[1]*Y[1], Z[0]*Y[1] + Z[1]*Y[0]];
               var m = Math.hypot(p[0], p[1]), a = Math.atan2(p[1], p[0]);
               return Math.sqrt(m)*Math.cos(a/2); }, tol: 0.04 },
           { lab: '&beta; (rad/m)', ans: function(){
               var w = TAU*300e6, Z = [15, w*250e-9], Y = [2e-3, w*100e-12];
               var p = [Z[0]*Y[0] - Z[1]*Y[1], Z[0]*Y[1] + Z[1]*Y[0]];
               var m = Math.hypot(p[0], p[1]), a = Math.atan2(p[1], p[0]);
               return Math.sqrt(m)*Math.sin(a/2); }, tol: 0.02 } ],
      why: 'Multiply the two complex numbers, take the square root by halving the angle and rooting the magnitude, then read off the parts. Compare $\\beta$ with the lossless $\\omega\\sqrt{L\'C\'}$: the loss barely moves it, which is why the lossless value is such a good approximation for the wavelength.' },

    { lvl: 'hard',
      q: 'For that same line, by what percentage does the exact $\\beta$ exceed the lossless $\\omega\\sqrt{L\'C\'}$?',
      f: [ { lab: 'excess (%)', ans: function(){
               var w = TAU*300e6, Z = [15, w*250e-9], Y = [2e-3, w*100e-12];
               var p = [Z[0]*Y[0] - Z[1]*Y[1], Z[0]*Y[1] + Z[1]*Y[0]];
               var m = Math.hypot(p[0], p[1]), a = Math.atan2(p[1], p[0]);
               var be = Math.sqrt(m)*Math.sin(a/2), ll = w*Math.sqrt(250e-9*100e-12);
               return 100*(be - ll)/ll; }, tol: 0.15 } ],
      why: 'A fraction of a percent. Loss enters $\\beta$ only at second order, which is why wavelength calculations almost never bother with it -- and why the figure in this chapter needs two decimal places before the loss sliders appear to do anything at all to $\\lambda$.' },

    { lvl: 'hard',
      q: 'A $50\\ \\Omega$ line with $\\alpha = 0.02$ Np/m is 15 m long and terminated in a short. A wave leaves the input, reflects, and returns. What fraction of its original amplitude comes back?',
      f: [ { lab: 'fraction', ans: function(){ return Math.exp(-2*0.02*15); }, tol: 0.03 } ],
      why: 'The round trip is 30 m of attenuation, so the amplitude carries a factor $e^{-\\alpha(2\\ell)}$; the short itself reflects with $|\\Gamma| = 1$ and takes nothing. This is why a long lossy cable looks well matched at its input no matter how badly it is terminated -- the mismatch is hidden by the loss, not fixed by it.' },

    { lvl: 'stretch',
      q: 'A $50\\ \\Omega$ line with $\\alpha = 0.03$ Np/m is 25 m long, feeding a load with $|\\Gamma_L| = 0.6$. Give $|\\Gamma|$, the SWR and the return loss seen at the input.',
      f: [ { lab: '|&Gamma;| at input', ans: function(){ return 0.6*Math.exp(-2*0.03*25); }, tol: 0.03 },
           { lab: 'SWR at input',       ans: function(){
               var m = 0.6*Math.exp(-2*0.03*25); return (1+m)/(1-m); }, tol: 0.03 },
           { lab: 'return loss (dB)',   ans: function(){
               return -20*Math.log10(0.6*Math.exp(-2*0.03*25)); }, tol: 0.03 } ],
      why: 'On a lossy line the reflection coefficient spirals inward: $\\Gamma(\\ell) = \\Gamma_L e^{-2\\gamma\\ell}$, so its magnitude is multiplied by $e^{-2\\alpha\\ell} = e^{-1.5} = 0.223$. An SWR of 4 at the load reads 1.31 at the input, and the return loss improves by 13 dB. A tempting way to make a bad antenna pass a specification, and a good reason to distrust an SWR measured at the far end of a long feed.' }
  ],

  /* ================= 05 microstrip ================= */
  'microstrip.html': [
    { lvl: 'easy',
      q: 'A microstrip has $W/h = 2$ on a substrate with $\\varepsilon_r = 4.4$.',
      f: [ { lab: '&epsilon;_eff', ans: function(){ return eeff(4.4, 2); } } ],
      why: 'Some of the field is in the board and some in the air above it, so the wave sees a weighted average: $\\varepsilon_{\\text{eff}} = \\frac{\\varepsilon_r+1}{2} + \\frac{\\varepsilon_r-1}{2}(1 + 12h/W)^{-1/2}$. It always lies between 1 and $\\varepsilon_r$.' },

    { lvl: 'easy',
      q: 'A line has $\\varepsilon_{\\text{eff}} = 3.0$. Give its phase velocity as a fraction of $c$.',
      f: [ { lab: 'u_p / c', ans: function(){ return 1/Math.sqrt(3); }, tol: 0.03 } ],
      why: '$u_p = c/\\sqrt{\\varepsilon_{\\text{eff}}}$, so about $0.577c$. Everything on a board is slower than light by this factor and by nothing else -- the copper geometry has already been absorbed into $\\varepsilon_{\\text{eff}}$.' },

    { lvl: 'easy',
      q: 'On a board with $\\varepsilon_{\\text{eff}} = 3.5$, give the guided wavelength at 2 GHz.',
      f: [ { lab: '&lambda; (mm)', ans: function(){
               return (C0/Math.sqrt(3.5))/2e9*1000; }, tol: 0.03 } ],
      why: '$\\lambda = u_p/f$ with $u_p = c/\\sqrt{\\varepsilon_{\\text{eff}}}$: about 80 mm, against 150 mm in free space. Every stub and transformer length shrinks by the same factor, which is the practical reason $\\varepsilon_{\\text{eff}}$ has to be found before any length can be.' },

    { lvl: 'medium',
      q: 'The same line: $W/h = 2$, $\\varepsilon_r = 4.4$. Give its characteristic impedance.',
      f: [ { lab: 'Z&#8320; (&Omega;)', ans: function(){ return z0ms(4.4, 2); }, tol: 0.03 } ],
      why: 'With $\\varepsilon_{\\text{eff}}$ known, $Z_0 = \\dfrac{120\\pi}{\\sqrt{\\varepsilon_{\\text{eff}}}\\left[W/h + 1.393 + 0.667\\ln(W/h + 1.444)\\right]}$ for $W/h \\ge 1$. Wider track, lower impedance -- more capacitance per metre.' },

    { lvl: 'medium',
      q: 'On $\\varepsilon_r = 4.4$, give $Z_0$ for $W/h = 1$ and for $W/h = 4$.',
      f: [ { lab: 'at W/h = 1 (&Omega;)', ans: function(){ return z0ms(4.4, 1); }, tol: 0.03 },
           { lab: 'at W/h = 4 (&Omega;)', ans: function(){ return z0ms(4.4, 4); }, tol: 0.03 } ],
      why: 'Four times the width does not quarter the impedance: the logarithm in the denominator flattens the dependence, so the ratio is closer to two. This is why very low impedances need impractically wide tracks, and why the useful range of microstrip is roughly 20 to 120 ohm.' },

    { lvl: 'medium',
      q: 'A $50\\ \\Omega$ line on $\\varepsilon_r = 4.4$ has $W/h = 1.85$. On a 1.6 mm board, how wide is the track?',
      f: [ { lab: 'W (mm)', ans: function(){ return 1.85*1.6; } } ],
      why: 'The formulas are written entirely in $W/h$, so the physical width follows from the board thickness alone: about 3 mm, the familiar figure for 50 ohm on 1.6 mm FR4. Change the thickness and the width changes with it, while the impedance does not.' },

    { lvl: 'hard',
      q: 'On the same substrate ($\\varepsilon_r = 4.4$), what $W/h$ gives $Z_0 = 50\\ \\Omega$?',
      f: [ { lab: 'W/h', ans: function(){ return whFor(4.4, 50); }, tol: 0.04 } ],
      why: 'There is no clean inversion, so bisect: $Z_0$ falls as $W/h$ rises, so halve the interval according to whether the trial impedance is above or below 50. A synthesis formula is a closed-form approximation to exactly this.' },

    { lvl: 'hard',
      q: 'A quarter-wave transformer of $Z_1 = 70.7\\ \\Omega$ is wanted at 2 GHz on $\\varepsilon_r = 4.4$. Give the required $W/h$ and the length of the section.',
      f: [ { lab: 'W/h', ans: function(){ return whFor(4.4, 70.7); }, tol: 0.05 },
           { lab: 'length (mm)', ans: function(){
               var wh = whFor(4.4, 70.7);
               return (C0/Math.sqrt(eeff(4.4, wh)))/2e9/4*1000; }, tol: 0.05 } ],
      why: 'Two steps that have to be taken in this order: the width sets $\\varepsilon_{\\text{eff}}$, and $\\varepsilon_{\\text{eff}}$ sets the wavelength, so the length cannot be worked out until the width is. A narrower, higher-impedance line keeps more of its field in the air, giving a lower $\\varepsilon_{\\text{eff}}$ and therefore a longer quarter wave than the 50 ohm feed it joins. Note where $W/h$ lands: the textbook $70.7\\ \\Omega$ transformer on FR4 sits almost exactly at $W/h = 1$, the boundary of the wide-strip formula, so anything much above $70\\ \\Omega$ needs the narrow-strip one instead.' },

    { lvl: 'hard',
      q: 'Two boards, $\\varepsilon_r = 2.2$ and $\\varepsilon_r = 6.15$, both need a $50\\ \\Omega$ line. Give $W/h$ for each.',
      f: [ { lab: 'on 2.2',  ans: function(){ return whFor(2.2, 50); }, tol: 0.05 },
           { lab: 'on 6.15', ans: function(){ return whFor(6.15, 50); }, tol: 0.05 } ],
      why: 'Higher permittivity means more capacitance per unit width, so the same impedance needs a narrower track: $3.11$ against $1.48$. This is the trade behind ceramic substrates -- smaller circuits, but finer lithography and tighter tolerances, since a fixed etching error is a larger fraction of a narrow track. Push further, to $\\varepsilon_r = 10.2$, and $50\\ \\Omega$ falls below $W/h = 1$, where the formula used here stops being the right one.' },

    { lvl: 'stretch',
      q: 'An open-circuit shunt stub must present a normalised susceptance $b = -0.8$ on a $50\\ \\Omega$ system at 2.5 GHz, etched on $\\varepsilon_r = 4.4$ with $W/h = 1.85$. Give its physical length.',
      f: [ { lab: 'length (mm)', ans: function(){
               var l = (Math.PI - Math.atan(0.8))/TAU;
               return l*(C0/Math.sqrt(eeff(4.4, 1.85)))/2.5e9*1000; }, tol: 0.04 } ],
      why: 'An open stub has $y = j\\tan\\beta\\ell$, so $\\tan\\beta\\ell = -0.8$ and the branch that gives a positive length under $\\lambda/2$ is $\\beta\\ell = \\pi - \\arctan 0.8$, or $0.393\\lambda$. Then convert: $\\varepsilon_{\\text{eff}} = 3.32$ at $W/h = 1.85$, so $\\lambda = 65.8$ mm and the stub is about 25.8 mm. Note it is more than $\\lambda/4$: a short open stub is capacitive, and a capacitive $b$ is positive, so a negative $b$ from an open stub demands the far branch. Getting this wrong by $\\lambda/4$ is the usual way a first board fails.' }
  ],

  /* ================= 06 reflection ================= */
  'reflection.html': [
    { lvl: 'easy',
      q: 'A $100\\ \\Omega$ resistor terminates a $50\\ \\Omega$ line.',
      f: [ { lab: '&Gamma;', ans: function(){ return (100-50)/(100+50); } },
           { lab: 'power reflected (%)', ans: function(){
               var g = (100-50)/(100+50); return 100*g*g; } } ],
      why: '$\\Gamma = (Z_L - Z_0)/(Z_L + Z_0) = 50/150 = 1/3$, real and positive because the load is larger than the line. Power goes as the square, so a ninth of it comes back.' },

    { lvl: 'easy',
      q: 'A $25\\ \\Omega$ resistor terminates the same $50\\ \\Omega$ line.',
      f: [ { lab: '&Gamma;', ans: function(){ return (25-50)/(25+50); } },
           { lab: 'power reflected (%)', ans: function(){
               var g = (25-50)/(25+50); return 100*g*g; } } ],
      why: '$\\Gamma = -25/75 = -1/3$: negative now, because a load below $Z_0$ reflects with a sign reversal. The reflected power is the same as for the $100\\ \\Omega$ load, since power only sees $|\\Gamma|$.' },

    { lvl: 'easy',
      q: 'A load reflects with $|\\Gamma| = 0.2$.',
      f: [ { lab: 'return loss (dB)',     ans: function(){ return -20*Math.log10(0.2); }, tol: 0.03 },
           { lab: 'power reflected (%)',  ans: function(){ return 100*0.04; } } ],
      why: 'Return loss is $-20\\log_{10}|\\Gamma| = 14$ dB, and the reflected power fraction is $|\\Gamma|^2 = 4\\%$. Both say the same thing; the decibel form is what a network analyser plots.' },

    { lvl: 'medium',
      q: 'A load $Z_L = 30 - j40\\ \\Omega$ sits on a $50\\ \\Omega$ line.',
      f: [ { lab: '|&Gamma;|', ans: function(){ return mag(gam(30/50, -40/50)); } },
           { lab: 'angle (&deg;)', ans: function(){
               var g = gam(30/50, -40/50);
               return Math.atan2(g[1], g[0])*180/Math.PI; }, tol: 0.04 } ],
      why: 'Normalise first: $z_L = 0.6 - j0.8$. Then $\\Gamma = (z_L-1)/(z_L+1)$, a complex division. The magnitude alone fixes the SWR; the angle fixes where the pattern sits along the line.' },

    { lvl: 'medium',
      q: 'A purely reactive load $Z_L = j50\\ \\Omega$ terminates a $50\\ \\Omega$ line.',
      f: [ { lab: '|&Gamma;|',      ans: function(){ return mag(gam(0, 1)); } },
           { lab: 'angle (&deg;)', ans: function(){
               var g = gam(0, 1); return Math.atan2(g[1], g[0])*180/Math.PI; }, tol: 0.04 } ],
      why: '$\\Gamma = (j1-1)/(j1+1)$, whose numerator and denominator have equal magnitude, so $|\\Gamma| = 1$ exactly. Every lossless load reflects everything and can only change the phase -- which is why the whole rim of the chart is reactance and why a stub can move a point without adding loss.' },

    { lvl: 'medium',
      q: 'A measurement gives $\\Gamma = 0.3$ on a $50\\ \\Omega$ line.',
      f: [ { lab: 'power reflected (%)',  ans: function(){ return 9; } },
           { lab: 'power delivered (%)',  ans: function(){ return 91; } },
           { lab: 'mismatch loss (dB)',   ans: function(){ return -10*Math.log10(0.91); }, tol: 0.04 } ],
      why: 'A ninth of the amplitude is under a tenth of the power: $|\\Gamma|^2 = 0.09$, so 91% is delivered. Mismatch loss is that fraction in decibels, $-10\\log_{10}(1-|\\Gamma|^2) = 0.41$ dB -- small enough that a 1.9 SWR is often left alone, which is worth knowing before redesigning anything.' },

    { lvl: 'hard',
      q: 'A measurement gives $\\Gamma = 0.4\\angle 60^\\circ$ on a $50\\ \\Omega$ line. Recover the load.',
      f: [ { lab: 'R (&Omega;)', ans: function(){
               return 50*zOf(0.4*Math.cos(60*Math.PI/180), 0.4*Math.sin(60*Math.PI/180))[0];
             }, tol: 0.03 },
           { lab: 'X (&Omega;)', ans: function(){
               return 50*zOf(0.4*Math.cos(60*Math.PI/180), 0.4*Math.sin(60*Math.PI/180))[1];
             }, tol: 0.03 } ],
      why: 'The map is invertible: $z_L = (1+\\Gamma)/(1-\\Gamma)$, then multiply by $Z_0$. Every reflection coefficient inside the unit circle corresponds to exactly one passive load, which is what makes the Smith chart a chart rather than a table.' },

    { lvl: 'hard',
      q: 'A load $Z_L = 25 - j40\\ \\Omega$ terminates a $50\\ \\Omega$ line. Give $|\\Gamma|$, and the voltage at the load as a multiple of the incident wave amplitude.',
      f: [ { lab: '|&Gamma;|',       ans: function(){ return mag(gam(0.5, -0.8)); } },
           { lab: '|1 + &Gamma;|',   ans: function(){
               var g = gam(0.5, -0.8); return Math.hypot(1+g[0], g[1]); }, tol: 0.03 } ],
      why: 'The total voltage at the load is incident plus reflected, so $V_L = V^+(1+\\Gamma)$ and the multiplier is $|1+\\Gamma| = 1.11$. It is above one: the reflection adds at the load rather than subtracting. A voltage larger than the incident wave is not a paradox -- current is correspondingly smaller, and no power is created.' },

    { lvl: 'hard',
      q: 'Two loads sit on a $50\\ \\Omega$ line: $20\\ \\Omega$ and $125\\ \\Omega$. Give $|\\Gamma|$ for each.',
      f: [ { lab: 'for 20 &Omega;',  ans: function(){ return Math.abs((20-50)/(20+50)); } },
           { lab: 'for 125 &Omega;', ans: function(){ return Math.abs((125-50)/(125+50)); } } ],
      why: 'They are equal, to three figures and in fact exactly: $3/7$ both times. Normalised, the loads are $0.4$ and $2.5$, reciprocals of each other, and $|\\Gamma|$ is unchanged by $z \\to 1/z$ because that is a half turn about the centre of the chart. Any pair of reciprocal normalised loads is equally badly matched.' },

    { lvl: 'stretch',
      q: 'A $50\\ \\Omega$ line joins a $75\\ \\Omega$ line long enough that nothing returns from its far end. At the junction, give $\\Gamma$, the transmission coefficient $|\\tau| = |1+\\Gamma|$, and the percentage of incident power that continues into the second line.',
      f: [ { lab: '&Gamma;',                 ans: function(){ return (75-50)/(75+50); } },
           { lab: '|&tau;|',                 ans: function(){ return 1 + (75-50)/(75+50); } },
           { lab: 'power transmitted (%)',   ans: function(){
               var g = (75-50)/(75+50); return 100*(1 - g*g); } } ],
      why: 'A semi-infinite line behaves exactly as a resistor of its own $Z_0$, so $\\Gamma = 25/125 = 0.2$ and $|\\tau| = 1.2$: the voltage on the far side is larger than the incident wave. Energy still balances, because power is $|V|^2/(2Z_0)$ and the far line has the larger $Z_0$: $\\dfrac{|\\tau|^2/75}{1/50} = \\dfrac{1.44}{1.5} = 0.96 = 1 - |\\Gamma|^2$. A transmission coefficient above one is a sign that voltage ratios and power ratios must not be confused.' }
  ],

  /* ================= 07 standing waves ================= */
  'standing-waves.html': [
    { lvl: 'easy',
      q: 'A line carries a reflection of magnitude $|\\Gamma| = 0.5$.',
      f: [ { lab: 'SWR', ans: function(){ return swrOf(0.5); } },
           { lab: 'return loss (dB)', ans: function(){ return -20*Math.log10(0.5); }, tol: 0.03 } ],
      why: 'The envelope runs between $1+|\\Gamma|$ and $1-|\\Gamma|$, so SWR $= (1+|\\Gamma|)/(1-|\\Gamma|) = 3$. Return loss is the same fact in decibels: $-20\\log_{10}|\\Gamma|$.' },

    { lvl: 'easy',
      q: 'A system reads SWR $= 1.5$.',
      f: [ { lab: '|&Gamma;|',              ans: function(){ return (1.5-1)/(1.5+1); } },
           { lab: 'power reflected (%)',    ans: function(){
               var m = (1.5-1)/(1.5+1); return 100*m*m; } } ],
      why: '$|\\Gamma| = 0.5/2.5 = 0.2$, so 4% of the power comes back. An SWR of 1.5 sounds like a mismatch and is barely one -- the number is a poor guide to severity because it grows without bound while the reflected power cannot exceed 1.' },

    { lvl: 'easy',
      q: 'A standing wave sits on a line with $\\lambda = 20$ cm. Give the distance between adjacent minima, and from a minimum to the next maximum.',
      f: [ { lab: 'minimum to minimum (cm)', ans: function(){ return 10; } },
           { lab: 'minimum to maximum (cm)', ans: function(){ return 5; } } ],
      why: 'The pattern depends on $2\\beta z$, so it repeats every $\\lambda/2$ and the extremes alternate every $\\lambda/4$. This is the measurement that gives $\\lambda$ on a slotted line, and the factor of two catches people every time.' },

    { lvl: 'medium',
      q: 'A slotted line on a $50\\ \\Omega$ system reads SWR $= 2.5$.',
      f: [ { lab: '|&Gamma;|', ans: function(){ return (2.5-1)/(2.5+1); } },
           { lab: 'power delivered (%)', ans: function(){
               var m = (2.5-1)/(2.5+1); return 100*(1 - m*m); } } ],
      why: 'Invert the definition: $|\\Gamma| = (\\text{SWR}-1)/(\\text{SWR}+1)$. What is not reflected is delivered, so the fraction is $1 - |\\Gamma|^2$.' },

    { lvl: 'medium',
      q: 'A probe finds $|V|_{\\max} = 6$ V and $|V|_{\\min} = 2$ V on a line. Give the SWR and the amplitude of the forward wave.',
      f: [ { lab: 'SWR',       ans: function(){ return 6/2; } },
           { lab: '|V+| (V)',  ans: function(){ return (6+2)/2; } } ],
      why: 'SWR is the ratio of the extremes, 3. Since the extremes are $|V^+| \\pm |V^-|$, their half-sum is $|V^+| = 4$ V and their half-difference is $|V^-| = 2$ V. Two probe readings recover both travelling waves separately, which is the entire idea behind the instrument.' },

    { lvl: 'medium',
      q: 'Adjacent minima on a line are 12 cm apart, and $u_p = 2\\times10^{8}$ m/s. Give $\\lambda$ and the frequency.',
      f: [ { lab: '&lambda; (cm)', ans: function(){ return 24; } },
           { lab: 'f (MHz)',       ans: function(){ return 2e8/0.24/1e6; }, tol: 0.03 } ],
      why: 'Minima repeat every half wavelength, so $\\lambda = 24$ cm, and $f = u_p/\\lambda$. A slotted line measures frequency this way without a frequency meter, which was how it was done before counters were cheap.' },

    { lvl: 'hard',
      q: 'A slotted line gives SWR $= 3$ with the first voltage minimum $0.2\\lambda$ from the load, on $50\\ \\Omega$. Find the load.',
      f: [ { lab: 'R (&Omega;)', ans: function(){
               var m = 0.5, th = Math.PI + 2*TAU*0.2;
               return 50*zOf(m*Math.cos(th), m*Math.sin(th))[0]; }, tol: 0.04 },
           { lab: 'X (&Omega;)', ans: function(){
               var m = 0.5, th = Math.PI + 2*TAU*0.2;
               return 50*zOf(m*Math.cos(th), m*Math.sin(th))[1]; }, tol: 0.04 } ],
      why: 'SWR $= 3$ gives $|\\Gamma| = 0.5$. A minimum is where the reflected wave opposes the incident one, so $\\Gamma$ points at $180^\\circ$ there; travelling back toward the load rotates counter-clockwise by $2\\beta d = 4\\pi(0.2)$. That fixes the angle, and $z_L = (1+\\Gamma)/(1-\\Gamma)$ finishes it. This is how an unknown load is measured with a detector and a ruler.' },

    { lvl: 'hard',
      q: 'Another measurement gives SWR $= 2$ with the first voltage <i>maximum</i> $0.15\\lambda$ from the load, on $50\\ \\Omega$. Find the load.',
      f: [ { lab: 'R (&Omega;)', ans: function(){
               var m = 1/3, th = 2*TAU*0.15;
               return 50*zOf(m*Math.cos(th), m*Math.sin(th))[0]; }, tol: 0.04 },
           { lab: 'X (&Omega;)', ans: function(){
               var m = 1/3, th = 2*TAU*0.15;
               return 50*zOf(m*Math.cos(th), m*Math.sin(th))[1]; }, tol: 0.04 } ],
      why: 'Same method, different reference: at a maximum the two waves are in step, so $\\Gamma$ lies on the positive real axis and its angle there is $0$, not $180^\\circ$. Rotating back to the load by $0.15\\lambda$ gives $\\theta_L = 4\\pi(0.15) = 108^\\circ$. A maximum is the easier landmark to reason about and the harder one to locate, since the pattern is flat near a peak and sharp near a null -- which is why instruments are built to find minima.' },

    { lvl: 'hard',
      q: 'A load produces SWR $= 4$. Give the return loss and the mismatch loss.',
      f: [ { lab: 'return loss (dB)',   ans: function(){ return -20*Math.log10(0.6); }, tol: 0.03 },
           { lab: 'mismatch loss (dB)', ans: function(){ return -10*Math.log10(1 - 0.36); }, tol: 0.04 } ],
      why: '$|\\Gamma| = 3/5$, so 4.4 dB of return loss and 1.9 dB of mismatch loss. The two are different questions: return loss is how much comes back, mismatch loss is how much never gets through. A badly matched antenna with 4.4 dB return loss still delivers 64% of the power, which is often the reason nothing gets fixed.' },

    { lvl: 'stretch',
      q: 'A slotted line on $50\\ \\Omega$ reads SWR $= 2$ with the first minimum $0.35\\lambda$ from the load. Give the load, and the distance from the load to the first point where the impedance is purely resistive and above $Z_0$.',
      f: [ { lab: 'R (&Omega;)', ans: function(){
               var m = 1/3, th = Math.PI + 2*TAU*0.35;
               return 50*zOf(m*Math.cos(th), m*Math.sin(th))[0]; }, tol: 0.04 },
           { lab: 'X (&Omega;)', ans: function(){
               var m = 1/3, th = Math.PI + 2*TAU*0.35;
               return 50*zOf(m*Math.cos(th), m*Math.sin(th))[1]; }, tol: 0.04 },
           { lab: 'to the maximum (&lambda;)', ans: function(){
               var th = (Math.PI + 2*TAU*0.35) % TAU;
               return wrapHalf(th/(2*TAU)); }, tol: 0.04 } ],
      why: 'The minimum at $0.35\\lambda$ fixes $\\theta_L = 180^\\circ + 4\\pi(0.35) = 432^\\circ$, or $72^\\circ$, and $|\\Gamma| = 1/3$ gives $z_L = 0.98 + j0.70$ -- a load whose resistance is almost exactly $Z_0$ and which is mismatched almost entirely by its reactance. The impedance is real and above $Z_0$ at a voltage maximum, where $\\theta = 0$; travelling toward the generator turns the angle down from $72^\\circ$, so that is $0.1\\lambda$ away. A quarter wave further on is the minimum, at $0.35\\lambda$ -- which closes the loop back to the reading you started from.' }
  ],

  /* ================= 08 input impedance ================= */
  'input-impedance.html': [
    { lvl: 'easy',
      q: 'A quarter-wave section of $70.7\\ \\Omega$ line is terminated in $100\\ \\Omega$.',
      f: [ { lab: 'Z_in (&Omega;)', ans: function(){ return 70.7*70.7/100; }, tol: 0.02 } ],
      why: 'A quarter wave inverts: $Z_{\\text{in}} = Z_1^2/Z_L$. It is the one length whose effect can be written down without a tangent.' },

    { lvl: 'easy',
      q: 'A half-wave section of $50\\ \\Omega$ line is terminated in $30 + j40\\ \\Omega$.',
      f: [ { lab: 'R_in (&Omega;)', ans: function(){ return 30; } },
           { lab: 'X_in (&Omega;)', ans: function(){ return 40; } } ],
      why: 'A half wave is a full turn on the chart, $2\\beta\\ell = 2\\pi$, so it returns the load unchanged whatever the load and whatever $Z_0$. This is why a half-wave section is used to move a connector without disturbing a design -- and why it only works at one frequency.' },

    { lvl: 'easy',
      q: 'A shorted $50\\ \\Omega$ line is $\\lambda/8$ long.',
      f: [ { lab: 'X_in (&Omega;)', ans: function(){ return 50*Math.tan(Math.PI/4); }, tol: 0.02 } ],
      why: '$Z_{\\text{in}} = jZ_0\\tan\\beta\\ell$ and $\\beta\\ell = 45^\\circ$, so the reactance is $+j50$: a shorted eighth-wave line is an inductor of exactly $Z_0$. The $\\lambda/8$ point is worth memorising, because it is where $\\tan$ is 1 and the arithmetic disappears.' },

    { lvl: 'medium',
      q: 'A $50\\ \\Omega$ line of length $0.10\\lambda$ is terminated in $Z_L = 25 + j30\\ \\Omega$.',
      f: [ { lab: 'R_in (&Omega;)', ans: function(){ return 50*move(0.5, 0.6, 0.10)[0]; }, tol: 0.03 },
           { lab: 'X_in (&Omega;)', ans: function(){ return 50*move(0.5, 0.6, 0.10)[1]; }, tol: 0.03 } ],
      why: 'Normalise, then $z_{\\text{in}} = \\dfrac{z_L + j\\tan\\beta\\ell}{1 + jz_L\\tan\\beta\\ell}$ with $\\beta\\ell = 2\\pi(0.10)$, and multiply back by $Z_0$. On the chart this is one rotation of $2\\beta\\ell$ about the centre.' },

    { lvl: 'medium',
      q: 'A $50\\ \\Omega$ line of length $0.3\\lambda$ is terminated in $100\\ \\Omega$.',
      f: [ { lab: 'R_in (&Omega;)', ans: function(){ return 50*move(2, 0, 0.3)[0]; }, tol: 0.03 },
           { lab: 'X_in (&Omega;)', ans: function(){ return 50*move(2, 0, 0.3)[1]; }, tol: 0.03 } ],
      why: 'A real load does not stay real: $0.3\\lambda$ is $216^\\circ$ of rotation, which lands well off the real axis. Only multiples of $\\lambda/4$ return a real impedance, which is the whole reason quarter-wave sections are singled out.' },

    { lvl: 'medium',
      q: 'A shorted $50\\ \\Omega$ line is used at two lengths, $0.125\\lambda$ and $0.375\\lambda$. Give the reactance at each.',
      f: [ { lab: 'at 0.125&lambda; (&Omega;)', ans: function(){ return 50*Math.tan(TAU*0.125); }, tol: 0.03 },
           { lab: 'at 0.375&lambda; (&Omega;)', ans: function(){ return 50*Math.tan(TAU*0.375); }, tol: 0.03 } ],
      why: 'The tangent changes sign through $\\lambda/4$, so the same short looks like $+j50$ at an eighth of a wavelength and $-j50$ at three eighths: an inductor becomes a capacitor. Whether a shorted stub is inductive or capacitive is a statement about its length, not about the short.' },

    { lvl: 'hard',
      q: 'For $Z_L = 25 + j30\\ \\Omega$ on $50\\ \\Omega$, how far toward the generator must you travel for the impedance to be purely real, and what is it there? Take whichever comes first.',
      f: [ { lab: 'd (&lambda;)', ans: function(){
               var g = gam(0.5, 0.6), th = Math.atan2(g[1], g[0]);
               var a = wrapHalf(th/(2*TAU)), b = wrapHalf((th - Math.PI)/(2*TAU));
               return Math.min(a, b); }, tol: 0.04 },
           { lab: 'R there (&Omega;)', ans: function(){
               var g = gam(0.5, 0.6), m = mag(g), th = Math.atan2(g[1], g[0]);
               var a = wrapHalf(th/(2*TAU)), b = wrapHalf((th - Math.PI)/(2*TAU));
               var swr = swrOf(m);
               return 50*((a < b) ? swr : 1/swr); }, tol: 0.04 } ],
      why: 'The impedance is real exactly at a voltage maximum or minimum, where $\\Gamma$ lies on the real axis. Travelling toward the generator rotates clockwise, so work out how far it is to angle $0$ (a maximum, $z = $ SWR) and to $180^\\circ$ (a minimum, $z = 1/$SWR), and take the nearer.' },

    { lvl: 'hard',
      q: 'A line of unknown $Z_0$ and length is measured at one frequency: shorted it presents $+j60\\ \\Omega$, and open it presents $-j41.67\\ \\Omega$. Give $Z_0$ and the electrical length.',
      f: [ { lab: 'Z&#8320; (&Omega;)',  ans: function(){ return Math.sqrt(60*41.67); }, tol: 0.03 },
           { lab: '&beta;&#8467; (&deg;)', ans: function(){
               return Math.atan(Math.sqrt(60/41.67))*180/Math.PI; }, tol: 0.03 } ],
      why: '$Z_{sc} = jZ_0\\tan\\beta\\ell$ and $Z_{oc} = -jZ_0\\cot\\beta\\ell$, so their product is $Z_0^2$ and their ratio is $-\\tan^2\\beta\\ell$. Hence $Z_0 = \\sqrt{Z_{sc}Z_{oc}}$ in magnitude and $\\tan\\beta\\ell = \\sqrt{60/41.67} = 1.2$. Two measurements on a line you cannot see inside recover both of its properties -- the standard way a cable of unknown type is characterised.' },

    { lvl: 'hard',
      q: 'A $50\\ \\Omega$ line of length $0.2\\lambda$ feeds $Z_L = 100 - j50\\ \\Omega$. Give $|Z_{\\text{in}}|$ and its angle.',
      f: [ { lab: '|Z_in| (&Omega;)', ans: function(){
               var z = move(2, -1, 0.2); return 50*Math.hypot(z[0], z[1]); }, tol: 0.03 },
           { lab: 'angle (&deg;)', ans: function(){
               var z = move(2, -1, 0.2);
               return Math.atan2(z[1], z[0])*180/Math.PI; }, tol: 0.05 } ],
      why: 'Normalise to $z_L = 2 - j1$, rotate by $2\\beta\\ell = 144^\\circ$, convert back. $|\\Gamma|$ is unchanged by the travel -- only the angle moves -- so the SWR at the input is the same as at the load even though the impedance is completely different. Keeping those two facts separate is most of what chapter 08 is for.' },

    { lvl: 'stretch',
      q: 'A generator of source impedance $50\\ \\Omega$ drives $0.15\\lambda$ of $50\\ \\Omega$ line into $Z_L = 20 + j35\\ \\Omega$. Give $R_{\\text{in}}$ and the fraction of the generator\'s available power that reaches the load.',
      f: [ { lab: 'R_in (&Omega;)', ans: function(){ return 50*move(0.4, 0.7, 0.15)[0]; }, tol: 0.04 },
           { lab: 'fraction delivered', ans: function(){
               var z = move(0.4, 0.7, 0.15), R = 50*z[0], X = 50*z[1];
               return 4*50*R/((50 + R)*(50 + R) + X*X); }, tol: 0.05 } ],
      why: 'Transform the load through the line first: $z_{\\text{in}} = 3.80 - j0.47$, so $Z_{\\text{in}} = 190 - j24\\ \\Omega$. The generator delivers $\\frac{1}{2}|I|^2R_{\\text{in}}$ with $I = V_g/(Z_s + Z_{\\text{in}})$, and the most it could ever deliver is $|V_g|^2/(8R_s)$ into a conjugate match, so the ratio is $4R_sR_{\\text{in}}/|Z_s + Z_{\\text{in}}|^2 = 0.65$. The line is lossless and still a third of the available power never leaves the generator -- lost to mismatch, not to heat. This is the quantity matching networks exist to raise, and it is worth computing once before trusting SWR as a proxy for it.' }
  ],

  /* ================= 09 line lengths and transformers ================= */
  'line-lengths.html': [
    { lvl: 'easy',
      q: 'A quarter-wave transformer is to match a $200\\ \\Omega$ resistive load to a $50\\ \\Omega$ line.',
      f: [ { lab: 'Z&#8321; (&Omega;)', ans: function(){ return Math.sqrt(50*200); } } ],
      why: 'Setting $Z_1^2/Z_L = Z_0$ gives $Z_1 = \\sqrt{Z_0 Z_L}$ -- the geometric mean, not the average.' },

    { lvl: 'easy',
      q: 'A shorted $50\\ \\Omega$ stub must present $+j50\\ \\Omega$. Give its shortest length.',
      f: [ { lab: 'length (&lambda;)', ans: function(){ return Math.atan(1)/TAU; }, tol: 0.03 } ],
      why: '$jZ_0\\tan\\beta\\ell = +j50$ needs $\\tan\\beta\\ell = 1$, so $\\beta\\ell = 45^\\circ$ and $\\ell = \\lambda/8$. When the wanted reactance equals $Z_0$ the answer is always an eighth of a wavelength, which makes it a useful sanity check.' },

    { lvl: 'easy',
      q: 'An open $50\\ \\Omega$ stub is $\\lambda/8$ long. What reactance does it present?',
      f: [ { lab: 'X (&Omega;)', ans: function(){ return -50/Math.tan(Math.PI/4); }, tol: 0.03 } ],
      why: '$Z = -jZ_0\\cot\\beta\\ell$ with $\\beta\\ell = 45^\\circ$, so $X = -50\\ \\Omega$: capacitive. The same eighth of a wavelength gives $+j50$ shorted and $-j50$ open -- the two stubs are a quarter wave apart in behaviour, which is exactly what replacing a short by an open does.' },

    { lvl: 'medium',
      q: 'A shorted $50\\ \\Omega$ stub is to present $+j75\\ \\Omega$. Give its shortest length.',
      f: [ { lab: 'length (&lambda;)', ans: function(){
               var a = Math.atan(75/50);
               while(a < 0) a += Math.PI;
               return a/TAU; }, tol: 0.03 } ],
      why: 'A shorted stub shows $Z = jZ_0\\tan\\beta\\ell$, so $\\tan\\beta\\ell = 1.5$ and $\\beta\\ell = \\arctan 1.5$; divide by $2\\pi$ for wavelengths. A shorted stub is inductive below $\\lambda/4$ and capacitive above it.' },

    { lvl: 'medium',
      q: 'A shorted stub must add a normalised susceptance $b = +1.2$ in parallel with a line. Give its length.',
      f: [ { lab: 'length (&lambda;)', ans: function(){ return stubLen(1.2, false); }, tol: 0.03 } ],
      why: 'A shorted stub has $y = -j\\cot\\beta\\ell$, so $-\\cot\\beta\\ell = 1.2$ and $\\beta\\ell = \\pi - \\arctan(1/1.2)$, giving $0.389\\lambda$. Positive $b$ is capacitive, and a shorted stub only becomes capacitive past $\\lambda/4$ -- so this length being over a quarter wave is a check on the branch, not a surprise.' },

    { lvl: 'medium',
      q: 'A stub is $0.32\\lambda$ long at 3 GHz on a line with $\\varepsilon_{\\text{eff}} = 2.5$. Give its physical length.',
      f: [ { lab: 'length (mm)', ans: function(){
               return 0.32*(C0/Math.sqrt(2.5))/3e9*1000; }, tol: 0.03 } ],
      why: '$\\lambda = c/(f\\sqrt{\\varepsilon_{\\text{eff}}}) = 63.2$ mm, so the stub is 20.2 mm. Designs are done in wavelengths and built in millimetres, and the conversion is the last step -- which is also where a wrong $\\varepsilon_{\\text{eff}}$ does its damage invisibly.' },

    { lvl: 'hard',
      q: 'An open $50\\ \\Omega$ stub must present $-j40\\ \\Omega$. Give its shortest length.',
      f: [ { lab: 'length (&lambda;)', ans: function(){
               var a = Math.atan2(-1, -40/50);
               while(a < 0) a += Math.PI;
               while(a >= Math.PI) a -= Math.PI;
               return a/TAU; }, tol: 0.03 } ],
      why: 'An open stub shows $Z = -jZ_0\\cot\\beta\\ell$, so $\\cot\\beta\\ell = 0.8$. Watch the branch: the length must land in $(0, \\lambda/2)$, and an open stub is capacitive below $\\lambda/4$ -- the opposite way round from a shorted one.' },

    { lvl: 'hard',
      q: 'A shorted stub is 15 mm long on a $50\\ \\Omega$ line with $\\varepsilon_{\\text{eff}} = 2.2$, at 2 GHz. What reactance does it present?',
      f: [ { lab: 'X (&Omega;)', ans: function(){
               var lam = (C0/Math.sqrt(2.2))/2e9;
               return 50*Math.tan(TAU*0.015/lam); }, tol: 0.04 } ],
      why: 'The reverse of the usual question, and the one a measurement actually asks. $\\lambda = 101$ mm, so the stub is $0.1485\\lambda$, just under an eighth of a wavelength; $X = 50\\tan(53.5^\\circ) = +67\\ \\Omega$. Inductive, as any shorted stub under $\\lambda/4$ must be.' },

    { lvl: 'hard',
      q: 'Two cascaded quarter-wave sections match $200\\ \\Omega$ to $50\\ \\Omega$, with the binomial split $\\ln(Z_1/Z_0) = \\tfrac14\\ln(Z_L/Z_0)$ and $\\ln(Z_2/Z_0) = \\tfrac34\\ln(Z_L/Z_0)$. Give both impedances, $Z_1$ nearest the line.',
      f: [ { lab: 'Z&#8321; (&Omega;)', ans: function(){ return 50*Math.pow(4, 0.25); }, tol: 0.03 },
           { lab: 'Z&#8322; (&Omega;)', ans: function(){ return 50*Math.pow(4, 0.75); }, tol: 0.03 } ],
      why: '$Z_1 = 50(4)^{1/4} = 70.7\\ \\Omega$ and $Z_2 = 50(4)^{3/4} = 141.4\\ \\Omega$. Check it closes: the section nearest the load turns $200$ into $Z_2^2/200 = 100$, and the next turns that into $Z_1^2/100 = 50$. Two sections buy a much wider band than one, and this is the split that makes the response maximally flat rather than equal-ripple.' },

    { lvl: 'stretch',
      q: 'A single quarter-wave transformer matches $100\\ \\Omega$ to $50\\ \\Omega$. Using $\\dfrac{\\Delta f}{f_0} = 2 - \\dfrac{4}{\\pi}\\cos^{-1}\\!\\left[\\dfrac{\\Gamma_m}{\\sqrt{1-\\Gamma_m^2}}\\dfrac{2\\sqrt{Z_0Z_L}}{|Z_L-Z_0|}\\right]$, give the fractional bandwidth over which $|\\Gamma| \\le 0.1$.',
      f: [ { lab: 'bandwidth (%)', ans: function(){
               var gm = 0.1, k = gm/Math.sqrt(1 - gm*gm)*2*Math.sqrt(50*100)/Math.abs(100-50);
               return 100*(2 - 4/Math.PI*Math.acos(Math.min(1, k))); }, tol: 0.03 } ],
      why: 'About 37% -- so a transformer designed at 1 GHz holds $|\\Gamma| \\le 0.1$ from roughly 0.82 to 1.18 GHz. The bracket contains $2\\sqrt{Z_0Z_L}/|Z_L-Z_0|$, which grows as the mismatch shrinks, so a mild mismatch is matched over a wide band and a severe one over a narrow band. That is the fundamental trade, and no amount of cleverness with a single section escapes it: the way out is more sections, which is the previous problem. Put the same load in the workbench and read the bandwidth off the response plot.' }
  ],

  /* ================= 10 the Smith chart ================= */
  'smith-chart.html': [
    { lvl: 'easy',
      q: 'A load $Z_L = 75 + j50\\ \\Omega$ is to be plotted on a $50\\ \\Omega$ chart.',
      f: [ { lab: 'r', ans: function(){ return 75/50; } },
           { lab: 'x', ans: function(){ return 50/50; } },
           { lab: '|&Gamma;|', ans: function(){ return mag(gam(1.5, 1)); } } ],
      why: 'The chart is drawn in normalised impedance, so divide by $Z_0$ first: $z_L = 1.5 + j1$. Its radius from the centre is $|\\Gamma|$, which is what every radially scaled parameter is a function of.' },

    { lvl: 'easy',
      q: 'A constant-SWR circle is drawn for SWR $= 2$. Give its radius, and the value of $r$ where it crosses the positive real axis.',
      f: [ { lab: '|&Gamma;|', ans: function(){ return (2-1)/(2+1); } },
           { lab: 'r there',   ans: function(){ return 2; } } ],
      why: 'The radius is $|\\Gamma| = 1/3$. On the positive real axis $\\Gamma$ is real and positive, so $z = (1+|\\Gamma|)/(1-|\\Gamma|) = $ SWR exactly. That is the trick for reading SWR off a paper chart without any scale: swing the compass round to the real axis and read $r$.' },

    { lvl: 'easy',
      q: 'Give $|\\Gamma|$ for a matched load $z = 1$, and for a short $z = 0$.',
      f: [ { lab: 'at z = 1', ans: function(){ return mag(gam(1, 0)); } },
           { lab: 'at z = 0', ans: function(){ return mag(gam(0, 0)); } } ],
      why: 'Zero and one: the centre of the chart and the left-hand edge of the rim. Those two points anchor everything else, and knowing which end is the short saves a great deal of confusion later -- it is the end where $z$ is small, not large.' },

    { lvl: 'medium',
      q: 'For the same load $z_L = 1.5 + j1$, give the normalised admittance.',
      f: [ { lab: 'g', ans: function(){ return inv(1.5, 1)[0]; } },
           { lab: 'b', ans: function(){ return inv(1.5, 1)[1]; } } ],
      why: 'Algebraically $y = 1/z$, a complex reciprocal. On the chart it is the same point turned half a turn about the centre, because $\\Gamma_y = -\\Gamma_z$ -- the whole content of the admittance overlay.' },

    { lvl: 'medium',
      q: 'A load is $z_L = 0.4$, purely real. Travel a quarter wavelength toward the generator.',
      f: [ { lab: 'r there', ans: function(){ return move(0.4, 0, 0.25)[0]; }, tol: 0.03 },
           { lab: 'x there', ans: function(){ return move(0.4, 0, 0.25)[1]; }, tol: 0.03 } ],
      why: 'A quarter wave is half a turn, which takes a point on the real axis to the reciprocal point: $z = 1/0.4 = 2.5$, still real. Every quarter-wave transformer is this one move, which is why the chart makes the $Z_1 = \\sqrt{Z_0Z_L}$ result look obvious rather than clever.' },

    { lvl: 'medium',
      q: 'A point sits at $|\\Gamma| = 0.45$ at an angle of $130^\\circ$. Give $r$ and $x$ there.',
      f: [ { lab: 'r', ans: function(){
               return zOf(0.45*Math.cos(130*Math.PI/180), 0.45*Math.sin(130*Math.PI/180))[0];
             }, tol: 0.04 },
           { lab: 'x', ans: function(){
               return zOf(0.45*Math.cos(130*Math.PI/180), 0.45*Math.sin(130*Math.PI/180))[1];
             }, tol: 0.04 } ],
      why: 'Convert to rectangular, $\\Gamma = -0.289 + j0.345$, then $z = (1+\\Gamma)/(1-\\Gamma)$. On paper you would read this straight off the grid; the point of doing it algebraically once is to see that the grid is not an approximation to anything.' },

    { lvl: 'hard',
      q: 'From $z_L = 1.5 + j1$, travel $0.1\\lambda$ toward the generator.',
      f: [ { lab: 'r there', ans: function(){ return move(1.5, 1, 0.1)[0]; }, tol: 0.04 },
           { lab: 'x there', ans: function(){ return move(1.5, 1, 0.1)[1]; }, tol: 0.04 } ],
      why: 'Travel is a rotation of $2\\beta d = 0.4\\pi$, clockwise toward the generator, at constant radius. Rotate, then convert $\\Gamma$ back to $z$. On paper this is a compass and the wavelengths-toward-generator ring.' },

    { lvl: 'hard',
      q: 'From $z_L = 0.3 + j0.5$, travel toward the generator until $r = 1$. Give the distance and the reactance there, taking the nearer crossing.',
      f: [ { lab: 'd (&lambda;)', ans: function(){ return series(0.3, 0.5, false)[0].d; }, tol: 0.05 },
           { lab: 'x there',      ans: function(){ return series(0.3, 0.5, false)[0].x; }, tol: 0.05 } ],
      why: 'The $r = 1$ circle in the $\\Gamma$ plane is centred at $0.5$ with radius $0.5$, so it satisfies $u^2 - u + v^2 = 0$. A constant-radius path $|\\Gamma| = m$ meets it where $u = m^2$, giving $v = \\pm m\\sqrt{1-m^2}$; the nearer crossing going clockwise is the one you want. The reactance left over at that point is what a series stub has to cancel, which is what makes this the first step of a series-stub match.' },

    { lvl: 'hard',
      q: 'From $z_L = 2 - j1.4$, travel toward the generator until $g = 1$. Give the distance and the susceptance there, taking the nearer crossing.',
      f: [ { lab: 'd (&lambda;)', ans: function(){ return stubs(2, -1.4, false)[0].d; }, tol: 0.05 },
           { lab: 'b there',      ans: function(){ return stubs(2, -1.4, false)[0].b; }, tol: 0.05 } ],
      why: 'The same construction reflected: the $g = 1$ circle sits at $u = -m^2$ instead of $u = +m^2$, because $\\Gamma_y = -\\Gamma_z$ turns the $r = 1$ circle into the $g = 1$ circle. Everything else is identical, and the susceptance left over is what a shunt stub cancels. Worth doing both this and the previous problem, since which circle you aim at is the only difference between a series and a shunt design.' },

    { lvl: 'stretch',
      q: 'A slotted line on $50\\ \\Omega$ gives SWR $= 2.4$ with the first minimum $0.185\\lambda$ from the load. Give $z_L$, then the normalised input impedance $0.4\\lambda$ from the load.',
      f: [ { lab: 'r', ans: function(){
               var m = 1.4/3.4, th = Math.PI + 2*TAU*0.185;
               return zOf(m*Math.cos(th), m*Math.sin(th))[0]; }, tol: 0.05 },
           { lab: 'x', ans: function(){
               var m = 1.4/3.4, th = Math.PI + 2*TAU*0.185;
               return zOf(m*Math.cos(th), m*Math.sin(th))[1]; }, tol: 0.05 },
           { lab: 'r at 0.4&lambda;', ans: function(){
               var m = 1.4/3.4, th = Math.PI + 2*TAU*0.185;
               var z = zOf(m*Math.cos(th), m*Math.sin(th));
               return move(z[0], z[1], 0.4)[0]; }, tol: 0.06 },
           { lab: 'x at 0.4&lambda;', ans: function(){
               var m = 1.4/3.4, th = Math.PI + 2*TAU*0.185;
               var z = zOf(m*Math.cos(th), m*Math.sin(th));
               return move(z[0], z[1], 0.4)[1]; }, tol: 0.06 } ],
      why: 'Three chart operations in a row, and the reason a chart beats a calculator for this. The SWR fixes the radius, $|\\Gamma| = 1.4/3.4 = 0.412$; the minimum fixes the angle, $\\theta_L = 180^\\circ + 4\\pi(0.185)$; then the travel is a further clockwise rotation of $2\\beta(0.4\\lambda) = 288^\\circ$. On paper: one compass setting, two marks on the wavelengths ring, and no arithmetic at all. Note the total rotation exceeds a full turn, so the wavelengths scale has to be allowed to wrap -- the one place where the chart\'s half-wavelength period has to be used deliberately rather than ignored.' }
  ],

  /* ================= 11 matching ================= */
  'matching.html': [
    { lvl: 'easy',
      q: 'A resistive load $Z_L = 100\\ \\Omega$ is matched to $50\\ \\Omega$ with a quarter-wave transformer.',
      f: [ { lab: 'Z&#8321; (&Omega;)', ans: function(){ return Math.sqrt(50*100); }, tol: 0.02 } ],
      why: 'A real load needs no travel: $Z_1 = \\sqrt{Z_0 Z_L} = 70.7\\ \\Omega$. The section is a quarter wave at the design frequency and only there, which is where its bandwidth limit comes from.' },

    { lvl: 'easy',
      q: 'At the chosen stub position the normalised admittance is $y = 1 + j0.7$. What susceptance must a shunt stub add?',
      f: [ { lab: 'b of the stub', ans: function(){ return -0.7; }, tol: 0.02 } ],
      why: 'Admittances in parallel add, so the stub must supply $-j0.7$ to leave $y = 1$. That is the entire idea of a shunt stub: travel until the real part is right, then cancel what is left. The stub can only add susceptance, which is why the travel has to come first.' },

    { lvl: 'easy',
      q: 'An L-network matches a resistive $25\\ \\Omega$ load to $50\\ \\Omega$. Give its $Q$, from $Q = \\sqrt{Z_0/R_L - 1}$.',
      f: [ { lab: 'Q', ans: function(){ return Math.sqrt(50/25 - 1); }, tol: 0.02 } ],
      why: '$Q = \\sqrt{2-1} = 1$. An L-network has no free parameters once the two resistances are fixed, so its $Q$ -- and therefore its bandwidth -- is decided by the mismatch alone. Wanting a different bandwidth means wanting a different topology, not different component values.' },

    { lvl: 'medium',
      q: 'A load $Z_L = 25 - j30\\ \\Omega$ on $50\\ \\Omega$ is matched with a single shorted shunt stub. Give the nearer position and its length.',
      f: [ { lab: 'd (&lambda;)',    ans: function(){ return stubs(0.5, -0.6, false)[0].d; },  tol: 0.05 },
           { lab: 'stub (&lambda;)', ans: function(){ return stubs(0.5, -0.6, false)[0].ls; }, tol: 0.05 } ],
      why: 'Work in admittance, because the stub is in parallel. Travel until $g = 1$; the leftover susceptance is what the stub must cancel, and a shorted stub of length $\\ell$ gives $b = -\\cot(2\\pi\\ell)$. The constant-SWR circle crosses $g = 1$ twice, so there are two answers -- this is the nearer.' },

    { lvl: 'medium',
      q: 'Same load and line, but with an <i>open</i> shunt stub. Give the nearer position and its length.',
      f: [ { lab: 'd (&lambda;)',    ans: function(){ return stubs(0.5, -0.6, true)[0].d; },  tol: 0.05 },
           { lab: 'stub (&lambda;)', ans: function(){ return stubs(0.5, -0.6, true)[0].ls; }, tol: 0.05 } ],
      why: 'The position is identical -- it depends only on the load, not on how the stub is built. Only the length changes, by exactly a quarter wavelength modulo a half, since an open stub is a shorted one shifted by $\\lambda/4$. Which to build is a fabrication question: an open stub needs no via, a shorted one is shorter here and radiates less from its end.' },

    { lvl: 'medium',
      q: 'A load $Z_L = 100 + j75\\ \\Omega$ on $50\\ \\Omega$ is matched by travelling to the nearest point where the impedance is real, then fitting a quarter-wave transformer. Give the travel and $Z_1$.',
      f: [ { lab: 'd (&lambda;)', ans: function(){
               var g = gam(2, 1.5), th = Math.atan2(g[1], g[0]);
               return wrapHalf(th/(2*TAU)); }, tol: 0.05 },
           { lab: 'Z&#8321; (&Omega;)', ans: function(){
               var g = gam(2, 1.5), m = mag(g), th = Math.atan2(g[1], g[0]);
               var a = wrapHalf(th/(2*TAU)), b = wrapHalf((th - Math.PI)/(2*TAU));
               var r = (a < b) ? swrOf(m) : 1/swrOf(m);
               return Math.sqrt(50*50*r); }, tol: 0.05 } ],
      why: 'A transformer needs a real load, so first rotate to the real axis. The load is above the axis, so the nearer landmark clockwise is the voltage maximum at $\\theta = 0$, only $0.041\\lambda$ away, where $r = $ SWR $= 3.32$. Then $Z_1 = \\sqrt{50 \\times 166} = 91\\ \\Omega$. Going the other way to the minimum would need $0.29\\lambda$ of line and a $27\\ \\Omega$ section -- correct, wider, and usually worse to build.' },

    { lvl: 'hard',
      q: 'Same load $Z_L = 25 - j30\\ \\Omega$ and shorted shunt stub. Give the <i>other</i> solution.',
      f: [ { lab: 'd (&lambda;)',    ans: function(){ return stubs(0.5, -0.6, false)[1].d; },  tol: 0.05 },
           { lab: 'stub (&lambda;)', ans: function(){ return stubs(0.5, -0.6, false)[1].ls; }, tol: 0.05 } ],
      why: 'The second crossing of the $g = 1$ circle. Both match perfectly at the design frequency; they differ in how far you travel, in the sign of the susceptance left to cancel, and therefore in stub length -- and usually in bandwidth, which is the practical reason to work out both. Put this load into the workbench and compare the two response curves.' },

    { lvl: 'hard',
      q: 'The same load, matched with a shorted <i>series</i> stub instead. Give the nearer position and its length.',
      f: [ { lab: 'd (&lambda;)',    ans: function(){ return series(0.5, -0.6, false)[0].d; },  tol: 0.05 },
           { lab: 'stub (&lambda;)', ans: function(){ return series(0.5, -0.6, false)[0].ls; }, tol: 0.05 } ],
      why: 'A series stub adds reactance, so the target is the $r = 1$ circle rather than $g = 1$, and the whole design is done in impedance with no admittance step at all. The stub itself changes character too: in series, a shorted stub contributes $x = \\tan\\beta\\ell$ where in shunt it contributed $b = -\\cot\\beta\\ell$, so the length formula is the one that belonged to the open shunt stub. Series stubs are rare in microstrip, because breaking the track is awkward, and normal in coax. If the stub length looks familiar, compare it with the open shunt stub two problems back: it is the same number, and not by accident. A point on $r = 1$ at radius $m$ is $1 + jx$ with $|x| = 2m/\\sqrt{1-m^2}$, and a point on $g = 1$ at the same radius is $1 + jb$ with the same $|b|$ -- so the value a stub has to cancel has the same magnitude either way. The positions differ, which is what makes them different designs.' },

    { lvl: 'hard',
      q: 'An L-network matches $Z_L = 20 + j15\\ \\Omega$ to $50\\ \\Omega$: a series reactance at the load, then a shunt susceptance across the $50\\ \\Omega$ side. Give both, taking the positive-$Q$ solution.',
      f: [ { lab: 'X series (&Omega;)', ans: function(){
               return Math.sqrt(50/20 - 1)*20 - 15; }, tol: 0.03 },
           { lab: 'B shunt (mS)', ans: function(){
               return Math.sqrt(50/20 - 1)/50*1e3; }, tol: 0.03 } ],
      why: 'With $R_L < Z_0$ the series element comes first. $Q = \\sqrt{50/20 - 1} = 1.225$, so the total series reactance must be $QR_L = 24.5\\ \\Omega$; the load already supplies $15$, so the component adds $9.5\\ \\Omega$. That leaves $20 + j24.5\\ \\Omega$, whose admittance is $0.02 - j0.0245$ S -- real part already $1/50$, so the shunt need only cancel the imaginary part with $B = +24.5$ mS. Lumped elements, no line at all: the right answer below about 1 GHz, where a quarter wave is longer than the board.' },

    { lvl: 'stretch',
      q: 'A double-stub tuner matches $Z_L = 30 + j40\\ \\Omega$ on $50\\ \\Omega$. The first shorted stub is at the load and the second is $0.125\\lambda$ toward the generator. Give both stub lengths, taking the solution with the shorter first stub.',
      f: [ { lab: 'first stub (&lambda;)',  ans: function(){
               return doubleStub(0.6, 0.8, 0.125, false)[0].l1; }, tol: 0.05 },
           { lab: 'second stub (&lambda;)', ans: function(){
               return doubleStub(0.6, 0.8, 0.125, false)[0].l2; }, tol: 0.05 } ],
      why: 'The stub positions are fixed, so the travel is no longer a free parameter and the two lengths have to do all the work. Normalise and invert: $y_L = 0.6 - j0.8$. The first stub can only change the susceptance, so it must land the point somewhere on the circle that maps to $g = 1$ after $0.125\\lambda$ of line. Writing $\\mathrm{Re}\\,y_2 = \\dfrac{g(1+t^2)}{(1-tb)^2 + t^2g^2} = 1$ with $t = \\tan(2\\pi \\times 0.125) = 1$ gives $(1-b)^2 = 2g - g^2$, so $b = 1 \\pm 0.917$ and the first stub supplies $b - b_L$. Then transform to the second plane and cancel what is there. Notice the condition needs $2g \\ge g^2$, that is $g \\le 2$: a double-stub tuner with fixed spacing has loads it cannot match at all, and that forbidden region is drawn in the workbench. A tuner you can adjust by hand is not a tuner that can match anything.' }
  ]

  };
})();
