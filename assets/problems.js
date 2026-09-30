/* Problems, three per chapter, at three levels.

   PURE ASCII. This file is served with no charset declaration, exactly like
   site.js and search-index.js, so Greek and symbols are written as HTML
   entities (&lambda;, &Omega;, &deg;) or as TeX, both of which are ASCII.

   No answer is written down. Every one is computed from the numbers in its own
   question, by the same physics the chapters derive -- so a problem cannot
   drift away from its answer, and tests/problems.test.js recomputes each one by
   an independent route and refuses to let a wrong one ship.

   Each field's `ans` returns the value in the unit its label names. `tol` is a
   relative tolerance; the default of 2% is what a careful hand calculation off
   a chart should manage. */

(function(){
  var TAU = Math.PI*2, C0 = 299792458;

  /* ---- shared physics, written once ---- */
  function gam(r, x){                       /* normalised z -> Gamma */
    var dr = r+1, di = x, d = dr*dr + di*di;
    return [((r-1)*dr + x*di)/d, (x*dr - (r-1)*di)/d];
  }
  function mag(g){ return Math.hypot(g[0], g[1]); }
  function swrOf(m){ return (1+m)/(1-m); }
  function wrapHalf(d){ d = d % 0.5; if(d < 0) d += 0.5; return d; }
  function stubLen(val, isOpen){            /* shunt stub, wavelengths */
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
  /* microstrip, Hammerstad, for W/h >= 1 */
  function eeff(er, wh){
    return (er+1)/2 + (er-1)/2*Math.pow(1 + 12/wh, -0.5);
  }
  function z0ms(er, wh){
    var ee = eeff(er, wh);
    return 120*Math.PI/(Math.sqrt(ee)*(wh + 1.393 + 0.667*Math.log(wh + 1.444)));
  }

  window.TLT_PROBLEMS = {

  /* ================= 01 waves, phasors, complex numbers ================= */
  'waves-phasors.html': [
    { lvl: 'easy',
      q: 'A wave on a line travels at $u_p = 2\\times10^{8}$ m/s at $f = 800$ MHz.',
      f: [ { lab: '&lambda; (m)',   ans: function(){ return 2e8/800e6; } },
           { lab: '&beta; (rad/m)', ans: function(){ return TAU/(2e8/800e6); } } ],
      why: 'A wavelength is the distance one cycle occupies, so $\\lambda = u_p/f = 0.25$ m. The phase constant counts radians per metre: $\\beta = 2\\pi/\\lambda$.' },

    { lvl: 'medium',
      q: 'A voltage phasor is $\\tilde V = 10\\angle 30^\\circ$ V at $f = 1$ GHz. What is the instantaneous voltage at $t = 0.25$ ns?',
      f: [ { lab: 'v (V)', ans: function(){
               return 10*Math.cos(TAU*1e9*0.25e-9 + 30*Math.PI/180); }, tol: 0.03 } ],
      why: 'The phasor is shorthand for $v(t) = |\\tilde V|\\cos(\\omega t + \\phi)$. At $t = 0.25$ ns, $\\omega t = 2\\pi(10^{9})(0.25\\times10^{-9}) = \\pi/2$, so $v = 10\\cos(90^\\circ + 30^\\circ)$.' },

    { lvl: 'hard',
      q: 'Two waves of the same frequency add: $\\tilde V_1 = 6\\angle 0^\\circ$ and $\\tilde V_2 = 4\\angle 120^\\circ$ volts.',
      f: [ { lab: '|V| (V)', ans: function(){
               var re = 6 + 4*Math.cos(120*Math.PI/180), im = 4*Math.sin(120*Math.PI/180);
               return Math.hypot(re, im); } },
           { lab: 'angle (&deg;)', ans: function(){
               var re = 6 + 4*Math.cos(120*Math.PI/180), im = 4*Math.sin(120*Math.PI/180);
               return Math.atan2(im, re)*180/Math.PI; }, tol: 0.05 } ],
      why: 'Phasors add as vectors, which is the whole reason for using them. In rectangular form $6 + 4(\\cos 120^\\circ + j\\sin 120^\\circ) = 4 + j3.46$, and its magnitude and angle follow.' }
  ],

  /* ================= 02 when a circuit becomes a line ================= */
  'circuit-to-line.html': [
    { lvl: 'easy',
      q: 'A connection is 5 cm long and signals travel along it at $2\\times10^{8}$ m/s. At what frequency is it one tenth of a wavelength?',
      f: [ { lab: 'f (MHz)', ans: function(){ return 2e8/(10*0.05)/1e6; } } ],
      why: 'One tenth of a wavelength means $\\lambda = 10\\times0.05 = 0.5$ m, and $f = u_p/\\lambda$.' },

    { lvl: 'medium',
      q: 'A trace is 8 cm long on a board with $\\varepsilon_{\\text{eff}} = 2.2$, carrying 1.5 GHz. Give its electrical length.',
      f: [ { lab: 'length (&deg;)', ans: function(){
               var up = C0/Math.sqrt(2.2), lam = up/1.5e9;
               return 360*0.08/lam; }, tol: 0.03 } ],
      why: 'Electrical length is physical length in wavelengths, times $360^\\circ$. Here $u_p = c/\\sqrt{\\varepsilon_{\\text{eff}}}$ and $\\lambda = u_p/f$, so the trace is well over half a wavelength -- long past the point where it can be treated as a node.' },

    { lvl: 'hard',
      q: 'A lumped model is taken as valid up to $\\ell = \\lambda/20$. For a 3 cm trace with $\\varepsilon_{\\text{eff}} = 3.2$, above what frequency does it fail?',
      f: [ { lab: 'f (MHz)', ans: function(){
               var up = C0/Math.sqrt(3.2);
               return up/(20*0.03)/1e6; }, tol: 0.03 } ],
      why: 'The limit is $\\lambda = 20\\ell = 0.6$ m, and $f = u_p/\\lambda$ with $u_p = c/\\sqrt{3.2}$. The answer is as much a property of the board as of the trace.' }
  ],

  /* ================= 03 the transmission line model ================= */
  'telegraphers.html': [
    { lvl: 'easy',
      q: 'A lossless line has $L\' = 250$ nH/m and $C\' = 100$ pF/m.',
      f: [ { lab: 'Z&#8320; (&Omega;)', ans: function(){ return Math.sqrt(250e-9/100e-12); } },
           { lab: 'u_p (m/s)',         ans: function(){ return 1/Math.sqrt(250e-9*100e-12); } } ],
      why: 'For a lossless line $Z_0 = \\sqrt{L\'/C\'}$ and $u_p = 1/\\sqrt{L\'C\'}$. Note $Z_0$ depends on their ratio and $u_p$ on their product, so the two can be set independently.' },

    { lvl: 'medium',
      q: 'A lossless line is to have $Z_0 = 75\\ \\Omega$ and $u_p = 2\\times10^{8}$ m/s.',
      f: [ { lab: 'L\' (nH/m)', ans: function(){ return 75/2e8*1e9; } },
           { lab: 'C\' (pF/m)', ans: function(){ return 1/(75*2e8)*1e12; } } ],
      why: 'Invert the pair: $L\' = Z_0/u_p$ and $C\' = 1/(Z_0 u_p)$. Two numbers in, two out -- the model has exactly as many degrees of freedom as the measurements.' },

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
      why: '$Z_0 = \\sqrt{Z\'/Y\'}$ with $Z\' = R\' + j\\omega L\'$ and $Y\' = G\' + j\\omega C\'$; the square root halves the angle. With $\\omega L\' \\approx 942\\ \\Omega$/m against $R\' = 4$, the line is nearly lossless and the angle is small -- but not zero, and that is what makes $Z_0$ complex.' }
  ],

  /* ================= 04 propagation ================= */
  'propagation.html': [
    { lvl: 'easy',
      q: 'A lossless line has $L\' = 400$ nH/m and $C\' = 160$ pF/m, at 1 GHz.',
      f: [ { lab: '&beta; (rad/m)', ans: function(){ return TAU*1e9*Math.sqrt(400e-9*160e-12); } },
           { lab: '&lambda; (cm)',  ans: function(){
               return TAU/(TAU*1e9*Math.sqrt(400e-9*160e-12))*100; } } ],
      why: 'On a lossless line $\\beta = \\omega\\sqrt{L\'C\'}$ and $\\lambda = 2\\pi/\\beta$. Only the product appears, so the wavelength says nothing about $Z_0$.' },

    { lvl: 'medium',
      q: 'A low-loss line with $Z_0 = 50\\ \\Omega$ has $R\' = 2\\ \\Omega$/m and $G\' = 0.4$ mS/m. Give the attenuation in Np/m and dB/m.',
      f: [ { lab: '&alpha; (Np/m)', ans: function(){ return 2/(2*50) + 0.4e-3*50/2; } },
           { lab: '&alpha; (dB/m)', ans: function(){
               return (2/(2*50) + 0.4e-3*50/2)*8.685889638; } } ],
      why: 'For a low-loss line the two mechanisms add: $\\alpha \\approx R\'/(2Z_0) + G\'Z_0/2$, the first from the conductors and the second from the dielectric. One neper is $20\\log_{10}e = 8.686$ dB.' },

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
      why: 'Multiply the two complex numbers, take the square root by halving the angle and rooting the magnitude, then read off the parts. Compare $\\beta$ with the lossless $\\omega\\sqrt{L\'C\'}$: the loss barely moves it, which is why the lossless value is such a good approximation for the wavelength.' }
  ],

  /* ================= 05 microstrip ================= */
  'microstrip.html': [
    { lvl: 'easy',
      q: 'A microstrip has $W/h = 2$ on a substrate with $\\varepsilon_r = 4.4$.',
      f: [ { lab: '&epsilon;_eff', ans: function(){ return eeff(4.4, 2); } } ],
      why: 'Some of the field is in the board and some in the air above it, so the wave sees a weighted average: $\\varepsilon_{\\text{eff}} = \\frac{\\varepsilon_r+1}{2} + \\frac{\\varepsilon_r-1}{2}(1 + 12h/W)^{-1/2}$. It always lies between 1 and $\\varepsilon_r$.' },

    { lvl: 'medium',
      q: 'The same line: $W/h = 2$, $\\varepsilon_r = 4.4$. Give its characteristic impedance.',
      f: [ { lab: 'Z&#8320; (&Omega;)', ans: function(){ return z0ms(4.4, 2); }, tol: 0.03 } ],
      why: 'With $\\varepsilon_{\\text{eff}}$ known, $Z_0 = \\dfrac{120\\pi}{\\sqrt{\\varepsilon_{\\text{eff}}}\\left[W/h + 1.393 + 0.667\\ln(W/h + 1.444)\\right]}$ for $W/h \\ge 1$. Wider track, lower impedance -- more capacitance per metre.' },

    { lvl: 'hard',
      q: 'On the same substrate ($\\varepsilon_r = 4.4$), what $W/h$ gives $Z_0 = 50\\ \\Omega$?',
      f: [ { lab: 'W/h', ans: function(){
               var lo = 1, hi = 10;
               for(var i = 0; i < 80; i++){
                 var mid = (lo + hi)/2;
                 if(z0ms(4.4, mid) > 50) lo = mid; else hi = mid;
               }
               return (lo + hi)/2; }, tol: 0.04 } ],
      why: 'There is no clean inversion, so bisect: $Z_0$ falls as $W/h$ rises, so halve the interval according to whether the trial impedance is above or below 50. A synthesis formula is a closed-form approximation to exactly this.' }
  ],

  /* ================= 06 reflection ================= */
  'reflection.html': [
    { lvl: 'easy',
      q: 'A $100\\ \\Omega$ resistor terminates a $50\\ \\Omega$ line.',
      f: [ { lab: '&Gamma;', ans: function(){ return (100-50)/(100+50); } },
           { lab: 'power reflected (%)', ans: function(){
               var g = (100-50)/(100+50); return 100*g*g; } } ],
      why: '$\\Gamma = (Z_L - Z_0)/(Z_L + Z_0) = 50/150 = 1/3$, real and positive because the load is larger than the line. Power goes as the square, so a ninth of it comes back.' },

    { lvl: 'medium',
      q: 'A load $Z_L = 30 - j40\\ \\Omega$ sits on a $50\\ \\Omega$ line.',
      f: [ { lab: '|&Gamma;|', ans: function(){ return mag(gam(30/50, -40/50)); } },
           { lab: 'angle (&deg;)', ans: function(){
               var g = gam(30/50, -40/50);
               return Math.atan2(g[1], g[0])*180/Math.PI; }, tol: 0.04 } ],
      why: 'Normalise first: $z_L = 0.6 - j0.8$. Then $\\Gamma = (z_L-1)/(z_L+1)$, a complex division. The magnitude alone fixes the SWR; the angle fixes where the pattern sits along the line.' },

    { lvl: 'hard',
      q: 'A measurement gives $\\Gamma = 0.4\\angle 60^\\circ$ on a $50\\ \\Omega$ line. Recover the load.',
      f: [ { lab: 'R (&Omega;)', ans: function(){
               var u = 0.4*Math.cos(60*Math.PI/180), v = 0.4*Math.sin(60*Math.PI/180);
               var dr = 1-u, di = -v, d = dr*dr + di*di;
               return 50*((1+u)*dr + v*di)/d; }, tol: 0.03 },
           { lab: 'X (&Omega;)', ans: function(){
               var u = 0.4*Math.cos(60*Math.PI/180), v = 0.4*Math.sin(60*Math.PI/180);
               var dr = 1-u, di = -v, d = dr*dr + di*di;
               return 50*(v*dr - (1+u)*di)/d; }, tol: 0.03 } ],
      why: 'The map is invertible: $z_L = (1+\\Gamma)/(1-\\Gamma)$, then multiply by $Z_0$. Every reflection coefficient inside the unit circle corresponds to exactly one passive load, which is what makes the Smith chart a chart rather than a table.' }
  ],

  /* ================= 07 standing waves ================= */
  'standing-waves.html': [
    { lvl: 'easy',
      q: 'A line carries a reflection of magnitude $|\\Gamma| = 0.5$.',
      f: [ { lab: 'SWR', ans: function(){ return swrOf(0.5); } },
           { lab: 'return loss (dB)', ans: function(){ return -20*Math.log10(0.5); }, tol: 0.03 } ],
      why: 'The envelope runs between $1+|\\Gamma|$ and $1-|\\Gamma|$, so SWR $= (1+|\\Gamma|)/(1-|\\Gamma|) = 3$. Return loss is the same fact in decibels: $-20\\log_{10}|\\Gamma|$.' },

    { lvl: 'medium',
      q: 'A slotted line on a $50\\ \\Omega$ system reads SWR $= 2.5$.',
      f: [ { lab: '|&Gamma;|', ans: function(){ return (2.5-1)/(2.5+1); } },
           { lab: 'power delivered (%)', ans: function(){
               var m = (2.5-1)/(2.5+1); return 100*(1 - m*m); } } ],
      why: 'Invert the definition: $|\\Gamma| = (\\text{SWR}-1)/(\\text{SWR}+1)$. What is not reflected is delivered, so the fraction is $1 - |\\Gamma|^2$.' },

    { lvl: 'hard',
      q: 'A slotted line gives SWR $= 3$ with the first voltage minimum $0.2\\lambda$ from the load, on $50\\ \\Omega$. Find the load.',
      f: [ { lab: 'R (&Omega;)', ans: function(){
               var m = 0.5, th = Math.PI + 2*TAU*0.2;
               var u = m*Math.cos(th), v = m*Math.sin(th);
               var dr = 1-u, di = -v, d = dr*dr + di*di;
               return 50*((1+u)*dr + v*di)/d; }, tol: 0.04 },
           { lab: 'X (&Omega;)', ans: function(){
               var m = 0.5, th = Math.PI + 2*TAU*0.2;
               var u = m*Math.cos(th), v = m*Math.sin(th);
               var dr = 1-u, di = -v, d = dr*dr + di*di;
               return 50*(v*dr - (1+u)*di)/d; }, tol: 0.04 } ],
      why: 'SWR $= 3$ gives $|\\Gamma| = 0.5$. A minimum is where the reflected wave opposes the incident one, so $\\Gamma$ points at $180^\\circ$ there; travelling back toward the load rotates counter-clockwise by $2\\beta d = 4\\pi(0.2)$. That fixes the angle, and $z_L = (1+\\Gamma)/(1-\\Gamma)$ finishes it. This is how an unknown load is measured with a detector and a ruler.' }
  ],

  /* ================= 08 input impedance ================= */
  'input-impedance.html': [
    { lvl: 'easy',
      q: 'A quarter-wave section of $70.7\\ \\Omega$ line is terminated in $100\\ \\Omega$.',
      f: [ { lab: 'Z_in (&Omega;)', ans: function(){ return 70.7*70.7/100; }, tol: 0.02 } ],
      why: 'A quarter wave inverts: $Z_{\\text{in}} = Z_1^2/Z_L$. It is the one length whose effect can be written down without a tangent.' },

    { lvl: 'medium',
      q: 'A $50\\ \\Omega$ line of length $0.10\\lambda$ is terminated in $Z_L = 25 + j30\\ \\Omega$.',
      f: [ { lab: 'R_in (&Omega;)', ans: function(){
               var t = Math.tan(TAU*0.10), zr = 0.5, zi = 0.6;
               var nr = zr, ni = zi + t, dr = 1 - zi*t, di = zr*t;
               var d = dr*dr + di*di;
               return 50*(nr*dr + ni*di)/d; }, tol: 0.03 },
           { lab: 'X_in (&Omega;)', ans: function(){
               var t = Math.tan(TAU*0.10), zr = 0.5, zi = 0.6;
               var nr = zr, ni = zi + t, dr = 1 - zi*t, di = zr*t;
               var d = dr*dr + di*di;
               return 50*(ni*dr - nr*di)/d; }, tol: 0.03 } ],
      why: 'Normalise, then $z_{\\text{in}} = \\dfrac{z_L + j\\tan\\beta\\ell}{1 + jz_L\\tan\\beta\\ell}$ with $\\beta\\ell = 2\\pi(0.10)$, and multiply back by $Z_0$. On the chart this is one rotation of $2\\beta\\ell$ about the centre.' },

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
      why: 'The impedance is real exactly at a voltage maximum or minimum, where $\\Gamma$ lies on the real axis. Travelling toward the generator rotates clockwise, so work out how far it is to angle $0$ (a maximum, $z = $ SWR) and to $180^\\circ$ (a minimum, $z = 1/$SWR), and take the nearer.' }
  ],

  /* ================= 09 line lengths and transformers ================= */
  'line-lengths.html': [
    { lvl: 'easy',
      q: 'A quarter-wave transformer is to match a $200\\ \\Omega$ resistive load to a $50\\ \\Omega$ line.',
      f: [ { lab: 'Z&#8321; (&Omega;)', ans: function(){ return Math.sqrt(50*200); } } ],
      why: 'Setting $Z_1^2/Z_L = Z_0$ gives $Z_1 = \\sqrt{Z_0 Z_L}$ -- the geometric mean, not the average.' },

    { lvl: 'medium',
      q: 'A shorted $50\\ \\Omega$ stub is to present $+j75\\ \\Omega$. Give its shortest length.',
      f: [ { lab: 'length (&lambda;)', ans: function(){
               var a = Math.atan(75/50);
               while(a < 0) a += Math.PI;
               return a/TAU; }, tol: 0.03 } ],
      why: 'A shorted stub shows $Z = jZ_0\\tan\\beta\\ell$, so $\\tan\\beta\\ell = 1.5$ and $\\beta\\ell = \\arctan 1.5$; divide by $2\\pi$ for wavelengths. A shorted stub is inductive below $\\lambda/4$ and capacitive above it.' },

    { lvl: 'hard',
      q: 'An open $50\\ \\Omega$ stub must present $-j40\\ \\Omega$. Give its shortest length.',
      f: [ { lab: 'length (&lambda;)', ans: function(){
               var a = Math.atan2(-1, -40/50);
               while(a < 0) a += Math.PI;
               while(a >= Math.PI) a -= Math.PI;
               return a/TAU; }, tol: 0.03 } ],
      why: 'An open stub shows $Z = -jZ_0\\cot\\beta\\ell$, so $\\cot\\beta\\ell = 0.8$. Watch the branch: the length must land in $(0, \\lambda/2)$, and an open stub is capacitive below $\\lambda/4$ -- the opposite way round from a shorted one.' }
  ],

  /* ================= 10 the Smith chart ================= */
  'smith-chart.html': [
    { lvl: 'easy',
      q: 'A load $Z_L = 75 + j50\\ \\Omega$ is to be plotted on a $50\\ \\Omega$ chart.',
      f: [ { lab: 'r', ans: function(){ return 75/50; } },
           { lab: 'x', ans: function(){ return 50/50; } },
           { lab: '|&Gamma;|', ans: function(){ return mag(gam(1.5, 1)); } } ],
      why: 'The chart is drawn in normalised impedance, so divide by $Z_0$ first: $z_L = 1.5 + j1$. Its radius from the centre is $|\\Gamma|$, which is what every radially scaled parameter is a function of.' },

    { lvl: 'medium',
      q: 'For the same load $z_L = 1.5 + j1$, give the normalised admittance.',
      f: [ { lab: 'g', ans: function(){ var d = 1.5*1.5 + 1; return 1.5/d; } },
           { lab: 'b', ans: function(){ var d = 1.5*1.5 + 1; return -1/d; } } ],
      why: 'Algebraically $y = 1/z$, a complex reciprocal. On the chart it is the same point turned half a turn about the centre, because $\\Gamma_y = -\\Gamma_z$ -- the whole content of the admittance overlay.' },

    { lvl: 'hard',
      q: 'From $z_L = 1.5 + j1$, travel $0.1\\lambda$ toward the generator.',
      f: [ { lab: 'r there', ans: function(){
               var g = gam(1.5, 1), m = mag(g), th = Math.atan2(g[1], g[0]) - 2*TAU*0.1;
               var u = m*Math.cos(th), v = m*Math.sin(th);
               var dr = 1-u, di = -v, d = dr*dr + di*di;
               return ((1+u)*dr + v*di)/d; }, tol: 0.04 },
           { lab: 'x there', ans: function(){
               var g = gam(1.5, 1), m = mag(g), th = Math.atan2(g[1], g[0]) - 2*TAU*0.1;
               var u = m*Math.cos(th), v = m*Math.sin(th);
               var dr = 1-u, di = -v, d = dr*dr + di*di;
               return (v*dr - (1+u)*di)/d; }, tol: 0.04 } ],
      why: 'Travel is a rotation of $2\\beta d = 0.4\\pi$, clockwise toward the generator, at constant radius. Rotate, then convert $\\Gamma$ back to $z$. On paper this is a compass and the wavelengths-toward-generator ring.' }
  ],

  /* ================= 11 matching ================= */
  'matching.html': [
    { lvl: 'easy',
      q: 'A resistive load $Z_L = 100\\ \\Omega$ is matched to $50\\ \\Omega$ with a quarter-wave transformer.',
      f: [ { lab: 'Z&#8321; (&Omega;)', ans: function(){ return Math.sqrt(50*100); }, tol: 0.02 } ],
      why: 'A real load needs no travel: $Z_1 = \\sqrt{Z_0 Z_L} = 70.7\\ \\Omega$. The section is a quarter wave at the design frequency and only there, which is where its bandwidth limit comes from.' },

    { lvl: 'medium',
      q: 'A load $Z_L = 25 - j30\\ \\Omega$ on $50\\ \\Omega$ is matched with a single shorted shunt stub. Give the nearer position and its length.',
      f: [ { lab: 'd (&lambda;)',    ans: function(){ return stubs(0.5, -0.6, false)[0].d; },  tol: 0.05 },
           { lab: 'stub (&lambda;)', ans: function(){ return stubs(0.5, -0.6, false)[0].ls; }, tol: 0.05 } ],
      why: 'Work in admittance, because the stub is in parallel. Travel until $g = 1$; the leftover susceptance is what the stub must cancel, and a shorted stub of length $\\ell$ gives $b = -\\cot(2\\pi\\ell)$. The constant-SWR circle crosses $g = 1$ twice, so there are two answers -- this is the nearer.' },

    { lvl: 'hard',
      q: 'Same load and line, shorted shunt stub. Give the <i>other</i> solution.',
      f: [ { lab: 'd (&lambda;)',    ans: function(){ return stubs(0.5, -0.6, false)[1].d; },  tol: 0.05 },
           { lab: 'stub (&lambda;)', ans: function(){ return stubs(0.5, -0.6, false)[1].ls; }, tol: 0.05 } ],
      why: 'The second crossing of the $g = 1$ circle. Both match perfectly at the design frequency; they differ in how far you travel, in the sign of the susceptance left to cancel, and therefore in stub length -- and usually in bandwidth, which is the practical reason to work out both. Put this load into the workbench and compare the two response curves.' }
  ]

  };
})();
