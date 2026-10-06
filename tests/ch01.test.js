/* Chapter 01, waves and phasors: every computed figure against the theory.

   - the travelling wave: the drawn trace is cos(wt - beta z), the tracked
     crest sits where that is 1 and moves at the phase velocity, the bracket
     spans two minima exactly one wavelength apart;
   - the phasor: the tip is A e^{j(wt + phi)} and the trace starts at its
     projection;
   - power: the readouts against 1/2 |V||I| cos(theta) and sin(theta), the
     time p < 0 against |theta|/pi, and the drawn p(t) averaged here;
   - nepers and decibels: 20 log10(e) alpha, written as a logarithm here;
   - group velocity: the two tones and their envelope, the bar at the
     envelope's peak, the crest marker on a crest of the sum on every pass
     (it used to sit on a trough every other pass), never hidden, and both
     moving at the
     velocities the readouts state.

   Animated figures are driven by EM.seek, so a state a minute into the
   animation is tested as directly as the first frame.

   Run:  node tests/ch01.test.js                                            */

const H = require('./lib/harness');
const TAU = 2*Math.PI;

const printedOk = (v, t, nd) => Math.abs(v - t) <= 0.5*Math.pow(10, -nd) + 1e-9;
const num = s => parseFloat(String(s).replace(/−/g, '-'));
const wrap = (x, p) => ((x % p) + p) % p;

(async () => {
  const s = H.suite('ch01');
  const srv = await H.serve();
  const b = await H.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = H.watchErrors(p);
  await p.goto(srv.url + 'waves-phasors.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);

  const drawn = id => p.evaluate(id => JSON.parse(document.getElementById(id).getAttribute('data-drawn') || 'null'), id);
  /* set the figure's clock and read what that frame drew, in one step */
  const at = (id, t) => p.evaluate(({ id, t }) => {
    const cv = document.getElementById(id); EM.seek(cv, t); return JSON.parse(cv.getAttribute('data-drawn'));
  }, { id, t });
  const text = id => p.evaluate(id => document.getElementById(id).textContent, id);
  const set = (id, v, ev) => p.evaluate(({ id, v, ev }) => {
    const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event(ev || 'input', { bubbles: true }));
  }, { id, v, ev });
  const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fails = {};
  const bad = (k, why) => (fails[k] = fails[k] || []).push(why);

  /* ================= the travelling wave ================= */
  for (const dir of [1, -1]) for (const be of [0.5, 0.75, 1.3, 2, 3]){
    await set('dir', dir, 'change'); await set('beta', be); await frame();
    const lam = TAU/be;
    for (const t of [0, 0.7, 2.2, 5, 13.3, 40.1, 97.6]){
      const D = await at('wavefig', t), tag = 'dir ' + dir + ' beta ' + be + ' t ' + t;
      if (D.be !== be || D.dir !== dir) { bad('wave: controls reach the figure', tag + ': ' + D.be + ' ' + D.dir); continue; }
      for (const [z, v] of D.samples) if (Math.abs(v - Math.cos(t - dir*be*z)) > 1e-9){ bad('wave: the trace is cos(wt - beta z)', tag); break; }
      /* a crest is a point of zero phase; one is shown whenever one is on the plot */
      const first = wrap(dir*t/be, lam);                       /* the crests are first + k lambda */
      if (D.crest === null){ if (first <= D.zmax) bad('wave: the crest marker', tag + ': none drawn, one at ' + first); }
      else if (Math.abs(Math.cos(t - dir*be*D.crest) - 1) > 1e-9 || D.crest < 0 || D.crest > D.zmax) bad('wave: the crest marker', tag + ': at ' + D.crest);
      /* it moves at the phase velocity, in the direction chosen */
      const E = await at('wavefig', t + 0.1);
      if (D.crest !== null && E.crest !== null){
        const mv = wrap(E.crest - D.crest + lam/2, lam) - lam/2;
        if (Math.abs(mv - dir*0.1/be) > 1e-7) bad('wave: the crest moves at omega/beta', tag + ': ' + mv);
      }
      /* the bracket: two minima, one wavelength apart, on the plot */
      if (D.bracket){
        const [a, c] = D.bracket;
        if (Math.abs(Math.cos(t - dir*be*a) + 1) > 1e-9 || Math.abs(Math.cos(t - dir*be*c) + 1) > 1e-9 ||
            Math.abs(c - a - lam) > 1e-9 || a < -1e-9 || c > D.zmax + 1e-9) bad('wave: the bracket spans two minima', tag + ': ' + D.bracket);
      } else if (D.zmax >= 2*lam + 1.2) bad('wave: the bracket is shown when two minima fit', tag);
    }
  }
  await set('dir', 1, 'change'); await set('beta', 1.3);

  /* ================= the phasor ================= */
  for (const A of [0.3, 0.8, 1]) for (const ph of [-180, -45, 0, 90, 180]){
    await set('amp', A); await set('phi', ph); await frame();
    for (const t of [0, 1.1, 4.4, 30.7]){
      const D = await at('phfig', t), tag = 'A ' + A + ' phi ' + ph + ' t ' + t, w = t + ph*Math.PI/180;
      if (Math.abs(D.tip[0] - A*Math.cos(w)) > 1e-9 || Math.abs(D.tip[1] - A*Math.sin(w)) > 1e-9) bad('phasor: the tip is A e^{j(wt + phi)}', tag);
      if (D.trace){
        if (Math.abs(D.trace[0][1] - D.tip[0]) > 1e-9) bad('phasor: the trace starts at the projection', tag);
        for (const [dt, v] of D.trace) if (Math.abs(v - A*Math.cos(w + dt)) > 1e-9){ bad('phasor: the trace is A cos(wt + phi)', tag); break; }
      } else bad('phasor: the trace is A cos(wt + phi)', tag + ': not drawn');
    }
    if (num(await text('ampv')) !== A) bad('phasor: readouts', 'amp ' + await text('ampv'));
    if (num(await text('phiv')) !== ph) bad('phasor: readouts', 'phi ' + await text('phiv'));
  }

  /* ================= power ================= */
  for (const deg of [-90, -60, -40, -1, 0, 1, 30, 40, 89, 90]){
    await set('pw-th', deg); await frame();
    const th = deg*Math.PI/180, tag = 'theta ' + deg;
    const P = 0.5*Math.cos(th), Q = 0.5*Math.sin(th);
    if (!printedOk(num(await text('pw-avg')), P, 3)) bad('power: integrated mean', tag + ': ' + await text('pw-avg') + ' vs ' + P);
    if (!printedOk(num(await text('pw-re')), P, 3)) bad('power: 1/2 Re{V I*}', tag);
    if (!printedOk(num(await text('pw-q')), Q, 3)) bad('power: Q', tag + ': ' + await text('pw-q') + ' vs ' + Q);
    /* p = cos(theta)/2 + cos(2wt + theta)/2 is negative a fraction |theta|/pi of the time */
    if (Math.abs(num(await text('pw-neg')) - 100*Math.abs(th)/Math.PI) > 1) bad('power: time p < 0', tag + ': ' + await text('pw-neg'));
    const D = await drawn('pwrfig');
    if (Math.abs(D.th - th) > 1e-8) { bad('power: the drawn curves', tag + ': theta ' + D.th); continue; }
    for (const [x, v, i, pp] of D.samples)
      if (Math.abs(v - Math.cos(x + D.ph + th)) > 1e-8 || Math.abs(i - Math.cos(x + D.ph)) > 1e-8 || Math.abs(pp - v*i) > 1e-8){ bad('power: the drawn curves', tag); break; }
    /* the drawn p(t), averaged over its two whole periods (evenly spaced
       samples of a low-order trigonometric polynomial: the mean is exact) */
    const ps = D.samples.slice(0, -1).map(q => q[3]), mean = ps.reduce((a, c) => a + c, 0)/ps.length;
    if (Math.abs(mean - P) > 1e-9) bad('power: the drawn p(t) averages to P', tag + ': ' + mean);
  }

  /* ================= nepers and decibels ================= */
  for (const al of [0.1, 0.5, 1, 1.15, 2, 3]){
    await set('np-a', al); await frame();
    const tag = 'alpha ' + al;
    const dB = 10*Math.log10(Math.exp(2*al));                    /* power ratio over one metre */
    if (!printedOk(num(await text('np-db')), dB, 2)) bad('Np: dB per metre', tag + ': ' + await text('np-db') + ' vs ' + dB);
    if (!printedOk(num(await text('np-v')), 100*Math.pow(10, -dB/20), 1)) bad('Np: amplitude after 1 m', tag);
    if (!printedOk(num(await text('np-p')), 100*Math.pow(10, -dB/10), 1)) bad('Np: power after 1 m', tag);
    const D = await drawn('npfig');
    if (D.al !== al) { bad('Np: the drawn curves', tag + ': alpha ' + D.al); continue; }
    for (const [z, amp] of D.samples)
      if (Math.abs(amp - Math.exp(-al*z)) > 1e-9){ bad('Np: the drawn curves', tag + ' at ' + z); break; }
    /* the loss line is straight, so its two ends say everything: -20 log10 of the amplitude there */
    for (const [z, db] of D.dbLine) if (Math.abs(db + 20*Math.log10(Math.exp(-al*z))) > 1e-8) bad('Np: the drawn curves', tag + ': loss line at ' + z);
  }

  /* ================= group velocity ================= */
  const WC = 1.2*TAU, BB = TAU, DB = TAU/8;
  for (const mode of [0, 1]){
    await set('gp-m', mode, 'change'); await frame();
    const w = q => mode ? Math.sqrt(WC*WC + q*q) : q, tag = 'mode ' + mode;
    /* readouts: u_p = w/beta and u_g = dw/dbeta (central difference here) */
    const up = w(BB)/BB, ug = (w(BB + 1e-5) - w(BB - 1e-5))/2e-5;
    if (!printedOk(num(await text('gp-up')), up, 3)) bad('group: u_p readout', tag + ': ' + await text('gp-up') + ' vs ' + up);
    if (!printedOk(num(await text('gp-ug')), ug, 3)) bad('group: u_g readout', tag + ': ' + await text('gp-ug') + ' vs ' + ug);
    if (!printedOk(num(await text('gp-pr')), up*ug, 3)) bad('group: u_p u_g readout', tag);
    if (Math.abs(up*ug - 1) > 1e-6) bad('group: u_p u_g = c^2 (as claimed)', tag + ': ' + up*ug);
    const b1 = BB - DB/2, b2 = BB + DB/2, w1 = w(b1), w2 = w(b2);
    const sum = (z, tau) => Math.cos(w1*tau - b1*z) + Math.cos(w2*tau - b2*z);
    const env = (z, tau) => 2*Math.abs(Math.cos((w2 - w1)/2*tau - (b2 - b1)/2*z));
    let hidden = 0, n = 0, prev = null;
    for (let t = 0; t < 450; t += 1.37){
      const D = await at('grpfig', t), tg = tag + ' t ' + t.toFixed(2), tau = D.tau;
      n++;
      if (Math.abs(D.w[0] - w1) > 1e-9 || Math.abs(D.w[1] - w2) > 1e-9) { bad('group: the two tones', tg); continue; }
      for (const [z, f, e] of D.samples)
        if (Math.abs(f - sum(z, tau)) > 1e-9 || Math.abs(e - env(z, tau)) > 1e-9 || Math.abs(f) > e + 1e-9){ bad('group: the sum and its envelope', tg + ' at ' + z); break; }
      /* the bar sits at a peak of the envelope */
      if (Math.abs(env(D.ze, tau) - 2) > 1e-9 || D.ze < 0 || D.ze > D.zw) bad('group: the bar is at the envelope peak', tg + ': ' + D.ze);
      /* the marker is on a crest of the sum: carrier at its maximum where the
         envelope is positive, so the sum equals the envelope there */
      if (D.zc === null) hidden++;
      else if (Math.abs(sum(D.zc, tau) - env(D.zc, tau)) > 1e-9 || D.zc < 0 || D.zc > D.zw)
        bad('group: the crest marker is on a crest', tg + ': at ' + D.zc + ', sum ' + sum(D.zc, tau).toFixed(3) + ', envelope ' + env(D.zc, tau).toFixed(3));
      /* without dispersion the crest rides the envelope's peak */
      if (mode === 0 && (D.zc === null || Math.abs(D.zc - D.ze) > 1e-9)) bad('group: no dispersion, crest rides the peak', tg + ': ' + D.zc + ' vs ' + D.ze);
      prev = D;
    }
    if (hidden > 0) bad('group: the crest marker is on a crest', tag + ': hidden in ' + hidden + ' of ' + n + ' frames');
    /* speeds, over a short step with no wrap: the bar at dw/dbeta, the crest at w/beta (two-tone forms) */
    let checked = 0;
    for (let t = 3; t < 400 && checked < 20; t += 11.3){
      const D = await at('grpfig', t), E = await at('grpfig', t + 0.2), dtau = E.tau - D.tau;
      const ve = (E.ze - D.ze)/dtau, vc = D.zc !== null && E.zc !== null ? (E.zc - D.zc)/dtau : null;
      if (Math.abs(E.ze - D.ze) < 1){
        checked++;
        if (Math.abs(ve - (w2 - w1)/(b2 - b1)) > 1e-6) bad('group: the bar moves at u_g', tag + ': ' + ve);
        if (vc !== null && Math.abs(E.zc - D.zc) < 0.4 && Math.abs(vc - (w1 + w2)/(b1 + b2)) > 1e-6) bad('group: the crest moves at u_p', tag + ': ' + vc);
      }
    }
    if (checked < 10) bad('group: the bar moves at u_g', tag + ': only ' + checked + ' steps checked');
  }

  const keys = ['wave: controls reach the figure', 'wave: the trace is cos(wt - beta z)', 'wave: the crest marker', 'wave: the crest moves at omega/beta',
    'wave: the bracket spans two minima', 'wave: the bracket is shown when two minima fit',
    'phasor: the tip is A e^{j(wt + phi)}', 'phasor: the trace starts at the projection', 'phasor: the trace is A cos(wt + phi)', 'phasor: readouts',
    'power: integrated mean', 'power: 1/2 Re{V I*}', 'power: Q', 'power: time p < 0', 'power: the drawn curves', 'power: the drawn p(t) averages to P',
    'Np: dB per metre', 'Np: amplitude after 1 m', 'Np: power after 1 m', 'Np: the drawn curves',
    'group: u_p readout', 'group: u_g readout', 'group: u_p u_g readout', 'group: u_p u_g = c^2 (as claimed)', 'group: the two tones',
    'group: the sum and its envelope', 'group: the bar is at the envelope peak', 'group: the crest marker is on a crest',
    'group: no dispersion, crest rides the peak', 'group: the bar moves at u_g', 'group: the crest moves at u_p'];
  for (const k of keys.concat(Object.keys(fails)).filter((k, i, a) => a.indexOf(k) === i)){
    const f = fails[k] || [];
    s.check(k, f.length === 0, f.length ? f.length + ' cases, e.g. ' + f.slice(0, 2).join('  |  ') : '');
  }
  s.check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); await srv.close();
  s.done();
})().catch(e => { console.error(e); process.exit(1); });
