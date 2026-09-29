/* Shared runtime for the electromagnetics site.
   Loaded BEFORE MathJax so the config below is in place when it boots. */

/* Land at the top of a chapter, not wherever the previous page was scrolled to.
   Runs early, gives up the moment the reader scrolls for themselves, and repeats
   a few times because the page grows as fonts and typeset math arrive. */
var SB_KEY = 'tlt-sidebar', TH_KEY = 'tlt-theme';
function thStored(){ try{ return localStorage.getItem(TH_KEY); }catch(e){ return null; } }
function sbStored(){ try{ return localStorage.getItem(SB_KEY); }catch(e){ return null; } }
(function(){
  var th = thStored();
  if(th === 'light' || th === 'dark') document.documentElement.setAttribute('data-theme', th);
  if(sbStored() === 'off') document.documentElement.classList.add('sb-off');
  try{ if('scrollRestoration' in history) history.scrollRestoration = 'manual'; }catch(e){}
  var moved = false;
  ['wheel','touchstart','keydown','pointerdown'].forEach(function(ev){
    try{ window.addEventListener(ev, function(){ moved = true; }, {passive:true, once:true}); }
    catch(e){ window.addEventListener(ev, function(){ moved = true; }); }
  });
  function toTop(){
    if(moved) return;
    try{ window.scrollTo(0,0); }catch(e){}
    try{ if(document.scrollingElement) document.scrollingElement.scrollTop = 0; }catch(e){}
    try{ document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }catch(e){}
  }
  toTop();
  window.addEventListener('load', toTop);
  [40, 160, 500, 1100, 2000].forEach(function(d){ setTimeout(toTop, d); });
})();

window.MathJax = {
  tex: {
    inlineMath: [['\\(', '\\)'], ['$', '$']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    macros: {
      vE: '{\\mathbf{E}}', vH: '{\\mathbf{H}}', vB: '{\\mathbf{B}}',
      vD: '{\\mathbf{D}}', vJ: '{\\mathbf{J}}', vA: '{\\mathbf{A}}',
      curl: '{\\nabla\\times}', dive: '{\\nabla\\cdot}'
    }
  },
  svg: { fontCache: 'global', scale: 1.02 },
  options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
  startup: {
    ready: function(){
      window.MathJax.startup.defaultReady();
      window.MathJax.startup.promise.then(function(){
        document.documentElement.classList.add('tex-ok');
        /* the monospace fallback may already have fired on a slow load;
           typeset maths has arrived, so take it back off */
        document.documentElement.classList.remove('notex');
        window.dispatchEvent(new Event('resize'));
      });
    }
  }
};

/* If MathJax never arrives (blocked CDN, offline), fall back to a monospace
   presentation so the raw TeX at least reads as a formula block. */
setTimeout(function(){
  if(!document.documentElement.classList.contains('tex-ok')){
    document.documentElement.classList.add('notex');
  }
}, 6000);

/* ---------------------------------------------------------------
   Site menu. Built here rather than written into fifteen files, so
   the contents only ever have to be edited in one place.
   --------------------------------------------------------------- */
var SITE_PAGES = [
  ['Start',     'index.html',             '',          'Contents'],
  ['Tools',     'smith-tool.html',        '\u2699',    'Smith chart workbench'],
  ['Prologue',  'prologue-maxwell.html',  'P1',        "Maxwell's equations"],
  ['Prologue',  'prologue-helmholtz.html','P2',        'The wave equation and Helmholtz'],
  ['Chapters',  'waves-phasors.html',     '01',        'Waves, phasors and complex numbers'],
  ['Chapters',  'circuit-to-line.html',   '02',        'When a circuit becomes a line'],
  ['Chapters',  'telegraphers.html',      '03',        'The transmission line model'],
  ['Chapters',  'propagation.html',       '04',        'Propagation on a line'],
  ['Chapters',  'microstrip.html',        '05',        'Microstrip and real lines'],
  ['Chapters',  'reflection.html',        '06',        'Reflection at a load'],
  ['Chapters',  'standing-waves.html',    '07',        'Standing waves'],
  ['Chapters',  'input-impedance.html',   '08',        'Input impedance'],
  ['Chapters',  'line-lengths.html',      '09',        'Line lengths and transformers'],
  ['Chapters',  'smith-chart.html',       '10',        'The Smith chart'],
  ['Chapters',  'matching.html',          '11',        'Impedance matching']
];

var BOOK = '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"'
  + ' fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round">'
  + '<rect x="2" y="1.6" width="8" height="8.8" rx="1.1"/>'
  + '<path d="M4.4 1.6v8.8"/></svg>';

(function(){
  function here(){
    var p = location.pathname.split('/').pop();
    return (!p || p === '') ? 'index.html' : p;
  }
  /* On a wide screen the contents live permanently down the left instead of
     behind a button. Same list, same source. */
  function buildSidebar(cur){
    if(document.querySelector('.sidebar')) return;
    if(sbStored() === 'off') return;        /* nothing to build, so nothing flashes */
    var aside = document.createElement('aside');
    aside.className = 'sidebar';
    aside.setAttribute('aria-label', 'Contents');
    var html = '<a class="brand" href="index.html">'
             + (document.querySelector('.mast a.home') || {textContent: 'Contents'}).textContent
             + '</a>';
    var group = null;
    SITE_PAGES.forEach(function(p){
      if(p[0] !== group){ group = p[0]; html += '<div class="grp">' + group + '</div>'; }
      html += '<a href="' + p[1] + '"' + (p[1] === cur ? ' aria-current="page"' : '') + '>'
            + '<span class="n">' + (p[2] || BOOK) + '</span>'
            + '<span class="t">' + p[3] + '</span></a>';
    });
    aside.innerHTML = html;
    document.body.insertBefore(aside, document.body.firstChild);
  }

  function build(){
    var bar = document.querySelector('.mast .in');
    if(!bar || bar.querySelector('.menuwrap')) return;
    var cur = here();
    buildSidebar(cur);

    var wrap = document.createElement('div');
    wrap.className = 'menuwrap';

    var btn = document.createElement('button');
    btn.className = 'menubtn';
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'sitemenu');
    btn.setAttribute('aria-label', 'Open the contents menu');
    btn.innerHTML = '<svg viewBox="0 0 14 12" width="14" height="12" aria-hidden="true">'
      + '<rect x="0" y="1"   width="14" height="1.6" rx=".8" fill="currentColor"/>'
      + '<rect x="0" y="5.2" width="14" height="1.6" rx=".8" fill="currentColor"/>'
      + '<rect x="0" y="9.4" width="14" height="1.6" rx=".8" fill="currentColor"/></svg>';
    btn.title = 'Contents';

    var panel = document.createElement('nav');
    panel.id = 'sitemenu';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'All pages');

    var html = '', group = null;
    SITE_PAGES.forEach(function(p){
      if(p[0] !== group){ group = p[0]; html += '<div class="grp">' + group + '</div>'; }
      var on = (p[1] === cur);
      html += '<a href="' + p[1] + '"' + (on ? ' aria-current="page"' : '') + '>'
            + '<span class="n">' + (p[2] || BOOK) + '</span>'
            + '<span class="t">' + p[3] + '</span></a>';
    });
    panel.innerHTML = html;

    wrap.appendChild(btn); wrap.appendChild(panel);
    bar.insertBefore(wrap, bar.firstChild);

    /* the chapter rail: every page as a token, current one filled */
    var rail = document.createElement('nav');
    rail.className = 'chrail';
    rail.setAttribute('aria-label', 'Chapters');
    var rh = '', lastGroup = null;
    SITE_PAGES.forEach(function(pg){
      if(pg[0] === 'Start') return;                /* the wordmark already goes home */
      if(lastGroup && pg[0] !== lastGroup) rh += '<span class="gap"></span>';
      lastGroup = pg[0];
      rh += '<a href="' + pg[1] + '" title="' + pg[3].replace(/"/g, '&quot;') + '"'
          + (pg[1] === cur ? ' aria-current="page"' : '') + '>' + pg[2] + '</a>';
    });
    rail.innerHTML = rh;
    var SUN = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"'
      + ' fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">'
      + '<circle cx="8" cy="8" r="3.1"/><path d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6'
      + 'M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1"/></svg>';
    var MOON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">'
      + '<path d="M13.4 10.3A5.8 5.8 0 0 1 6 2.8a5.9 5.9 0 1 0 7.4 7.5z"'
      + ' fill="currentColor"/></svg>';
    /* Dark is the site default, so anything that is not an explicit "light"
       is dark. The OS preference is not consulted here, and must not be: the
       stylesheet does not consult it either, and a disagreement between the
       two would put the wrong icon on the button. */
    function isDark(){
      return document.documentElement.getAttribute('data-theme') !== 'light';
    }
    var tb = document.createElement('button');
    tb.type = 'button'; tb.className = 'themebtn';
    function syncTheme(){
      var d = isDark();
      tb.innerHTML = d ? SUN : MOON;
      tb.title = d ? 'Switch to light' : 'Switch to dark';
      tb.setAttribute('aria-label', tb.title);
    }
    tb.addEventListener('click', function(){
      var next = isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try{ localStorage.setItem(TH_KEY, next); }catch(e){}
      syncTheme();
    });
    syncTheme();
    /* No prefers-color-scheme listener: the OS no longer decides the theme,
       so there is nothing for it to resync. */
    var navEl = bar.querySelector('.nav');
    if(navEl) bar.insertBefore(tb, navEl);

    var sep = bar.querySelector('.sep');
    if(sep){
      bar.insertBefore(rail, sep.nextSibling);
      /* a matching spacer on the far side, so the rail sits centred rather
         than crowding the previous/next arrows */
      var sep2 = document.createElement('span');
      sep2.className = 'sep';
      bar.insertBefore(sep2, rail.nextSibling);
    }

    function open(v){
      panel.hidden = !v;
      btn.setAttribute('aria-expanded', v ? 'true' : 'false');
      if(v){ var a = panel.querySelector('a[aria-current], a'); if(a) a.focus(); }
    }
    function wide(){
      try{ return window.matchMedia('(min-width: 1180px)').matches; }
      catch(e){ return false; }
    }
    function syncBtn(){
      var off = document.documentElement.classList.contains('sb-off');
      if(wide()){
        btn.setAttribute('aria-expanded', off ? 'false' : 'true');
        btn.setAttribute('aria-label', off ? 'Show the contents sidebar'
                                           : 'Hide the contents sidebar');
      } else {
        btn.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
        btn.setAttribute('aria-label', 'Open the contents menu');
      }
    }
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      if(wide()){
        if(!panel.hidden) open(false);
        var de = document.documentElement;
        var off = de.classList.toggle('sb-off');
        try{ localStorage.setItem(SB_KEY, off ? 'off' : 'on'); }catch(err){}
        if(!off) buildSidebar(cur);
        syncBtn();
        window.dispatchEvent(new Event('resize'));   /* canvases re-measure */
      } else {
        open(panel.hidden);
      }
    });
    window.addEventListener('resize', syncBtn);
    syncBtn();

    /* the sidebar hangs below the bar, so it needs the bar's real height */
    function mastH(){
      var m = document.querySelector('.mast');
      if(!m) return;
      document.documentElement.style.setProperty(
        '--mast-h', Math.round(m.getBoundingClientRect().height) + 'px');
    }
    mastH();
    window.addEventListener('resize', mastH);
    [200, 900].forEach(function(d){ setTimeout(mastH, d); });
    document.addEventListener('click', function(e){
      if(!panel.hidden && !wrap.contains(e.target)) open(false);
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && !panel.hidden){ open(false); btn.focus(); }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();

var EM = (function(){
  var TAU = Math.PI*2, C = {}, drawers = [], running = true, active = null;
  var KEYS = ['ink','ink2','ink3','line','line2','e','h','z','acc','accfill','sunk','surface','ok','warn'];

  function readColors(){
    var s = getComputedStyle(document.documentElement);
    KEYS.forEach(function(k){ C[k] = s.getPropertyValue('--'+k).trim() || '#888'; });
  }

  /* Size a canvas from its LAID-OUT box, never from width/height attributes.
     Returns true when the box changed, so callers can reset any trail buffer. */
  function fit(cv){
    /* whichever drawer is running owns this canvas: recorded so the figure
       toolbar knows what to pause and what to export */
    if(active && active.cvs.indexOf(cv) < 0) active.cvs.push(cv);
    var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var w = Math.max(160, Math.round(r.width)), h = Math.max(80, Math.round(r.height));
    if(cv._w === w && cv._h === h && cv._dpr === dpr) return false;
    cv._w = w; cv._h = h; cv._dpr = dpr;
    cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
    cv.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
    return true;
  }

  /* register(fn, animated) - animated figures redraw every frame, static ones
     redraw on resize, theme change and font load. */
  function register(fn, animated){
    var d = { fn: fn, animated: !!animated, t: 0, paused: false, cvs: [] };
    drawers.push(d);
    if(!animated) requestAnimationFrame(function(){ safe(d); });
    return d;
  }
  function safe(d){
    active = d;
    try{ d.fn(C, d.t); }catch(e){ if(window.console) console.error(e); }
    active = null;
  }
  function redrawStatic(){ drawers.forEach(function(d){ if(!d.animated) safe(d); }); }

  var frame = 0;
  function loop(){
    if((frame++ % 60) === 0) readColors();
    drawers.forEach(function(d){
      if(!d.animated) return;
      if(running && !d.paused) d.t += 0.045;   /* a paused figure holds its own clock */
      safe(d);
    });
    requestAnimationFrame(loop);
  }

  /* Draw a schematic in fixed design coordinates (dw x dh), scaled and centred
     inside the canvas. Guarantees the layout can never clip or collide,
     whatever the viewport. Caller must c.restore() when finished. */
  function design(c, cv, dw, dh){
    var W = cv._w, H = cv._h, s = Math.min(W/dw, H/dh);
    c.save();
    c.translate((W - dw*s)/2, (H - dh*s)/2);
    c.scale(s, s);
    return s;
  }

  function arrow(c, x1, y1, x2, y2, head){
    head = head || 7;
    c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
    var a = Math.atan2(y2-y1, x2-x1);
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - head*Math.cos(a-0.42), y2 - head*Math.sin(a-0.42));
    c.lineTo(x2 - head*Math.cos(a+0.42), y2 - head*Math.sin(a+0.42));
    c.closePath(); c.fill();
  }

  /* click-to-answer self checks */
  function checks(){
    Array.prototype.forEach.call(document.querySelectorAll('.check .q'), function(q){
      var exp = q.querySelector('.exp');
      if(exp) exp.hidden = true;
      Array.prototype.forEach.call(q.querySelectorAll('.opt'), function(b){
        b.addEventListener('click', function(){
          var right = b.getAttribute('data-ok') === '1';
          Array.prototype.forEach.call(q.querySelectorAll('.opt'), function(o){
            if(o.getAttribute('data-ok') === '1') o.setAttribute('data-state','right');
            else if(o === b) o.setAttribute('data-state','wrong');
            else o.removeAttribute('data-state');
          });
          if(exp){
            exp.hidden = false;
            var v = exp.querySelector('.verdict');
            if(v) v.textContent = right ? 'That is right. ' : 'Not quite. ';
          }
        });
      });
    });
  }

  /* ---------------------------------------------------------------
     Figure toolbar. Playback and export are presentation controls, so
     they get their own strip rather than sitting among the buttons that
     change the physics.
     --------------------------------------------------------------- */
  var ICON = {
    play : '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">'
         + '<path d="M3 1.4 L10 6 L3 10.6 Z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">'
         + '<rect x="2.9" y="1.4" width="2.7" height="9.2" fill="currentColor"/>'
         + '<rect x="7.4" y="1.4" width="2.7" height="9.2" fill="currentColor"/></svg>',
    save : '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" fill="none"'
         + ' stroke="currentColor" stroke-width="1.35" stroke-linecap="round"'
         + ' stroke-linejoin="round"><path d="M6 1.2v5.6"/><path d="M3.4 4.9 6 7.5 8.6 4.9"/>'
         + '<path d="M2.1 10.3h7.8"/></svg>',
    rec  : '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">'
         + '<circle cx="6" cy="6" r="3.6" fill="currentColor"/></svg>'
  };

  function slug(s){
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '').slice(0, 48) || 'figure';
  }
  function pageName(){ return slug((document.title || 'figure').split('\u00b7')[0]); }

  function download(blob, name){
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  }

  /* Export a canvas on an opaque background, with the figure's readouts
     printed underneath so the picture carries its own numbers. */
  function exportPNG(cv, host, name){
    var dpr = cv._dpr || 1, W = cv.width, H = cv.height;
    var rows = [];
    if(host) Array.prototype.forEach.call(
      host.querySelectorAll('.rd, .big > div'), function(el){
        var dt = el.querySelector('dt'), dd = el.querySelector('dd');
        if(dt && dd) rows.push([dt.textContent.trim(), dd.textContent.trim()]);
      });

    var padX = 16, rowH = 42, gap = rows.length ? 10 : 0;
    var cols = Math.max(1, Math.min(rows.length, Math.floor((W/dpr - padX*2) / 150)));
    var lines = rows.length ? Math.ceil(rows.length / cols) : 0;
    var extra = rows.length ? (gap + lines*rowH + 12) : 0;

    var out = document.createElement('canvas');
    out.width = W; out.height = H + Math.round(extra*dpr);
    var c = out.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var Wc = W/dpr, Hc = H/dpr;

    c.fillStyle = C.sunk || '#fff';
    c.fillRect(0, 0, Wc, Hc + extra);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(cv, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    if(rows.length){
      c.strokeStyle = C.line || '#ccc'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, Hc + 0.5); c.lineTo(Wc, Hc + 0.5); c.stroke();
      var cw = (Wc - padX*2) / cols;
      rows.forEach(function(r, i){
        var x = padX + (i % cols)*cw, y = Hc + gap + Math.floor(i/cols)*rowH;
        c.textBaseline = 'top'; c.textAlign = 'left';
        c.font = '10.5px ui-monospace, "IBM Plex Mono", monospace';
        c.fillStyle = C.ink3 || '#888';
        c.fillText(r[0], x, y + 6);
        c.font = '15px ui-monospace, "IBM Plex Mono", monospace';
        c.fillStyle = C.ink || '#111';
        c.fillText(r[1], x, y + 20);
      });
    }
    out.toBlob(function(b){ if(b) download(b, name + '.png'); });
  }

  /* Record an animated figure to a video file. Feature-detected: the button
     is not created at all where the browser cannot do it. */
  var canRecord = (function(){
    try{
      return !!(window.MediaRecorder
        && HTMLCanvasElement.prototype.captureStream
        && (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
         || MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
         || MediaRecorder.isTypeSupported('video/webm')));
    }catch(e){ return false; }
  })();

  function recordCanvas(cv, name, btn, secs){
    var types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    var mt = null;
    for(var i = 0; i < types.length; i++){
      if(MediaRecorder.isTypeSupported(types[i])){ mt = types[i]; break; }
    }
    if(!mt) return;
    var stream, mr;
    try{
      stream = cv.captureStream(30);
      mr = new MediaRecorder(stream, { mimeType: mt, videoBitsPerSecond: 6000000 });
    }catch(e){ return; }
    var chunks = [], left = secs;
    var lab = btn.querySelector('.lab');
    btn.disabled = true;
    function tick(){ if(lab) lab.textContent = left + 's'; }
    tick();
    var iv = setInterval(function(){ left--; tick(); if(left <= 0) clearInterval(iv); }, 1000);
    mr.ondataavailable = function(e){ if(e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = function(){
      clearInterval(iv);
      btn.disabled = false;
      if(lab) lab.textContent = 'REC';
      if(chunks.length) download(new Blob(chunks, {type: mt}), name + '.webm');
    };
    mr.start();
    setTimeout(function(){ if(mr.state !== 'inactive') mr.stop(); }, secs*1000);
  }

  function ownersOf(cv){
    return drawers.filter(function(d){ return d.cvs.indexOf(cv) >= 0; });
  }
  function syncBars(){
    Array.prototype.forEach.call(document.querySelectorAll('.figbar [data-play]'),
      function(b){
        var paused = b._owners.every(function(d){ return d.paused; });
        b.innerHTML = paused ? ICON.play : ICON.pause;
        var t = paused ? 'Play the animation' : 'Pause the animation';
        b.setAttribute('aria-label', t);
        b.title = t;
      });
  }

  function buildBars(){
    var seen = 0;
    drawers.forEach(function(d){
      d.cvs.forEach(function(cv){
        if(cv._bar) return;
        cv._bar = true;
        seen++;
        var owners = ownersOf(cv);
        var animated = owners.some(function(o){ return o.animated; });
        /* .wb is the workbench, whose readouts sit outside the canvas's own box */
        var host = cv.closest ? (cv.closest('.fig, .wb') || cv.parentNode) : cv.parentNode;
        var name = pageName() + (cv.id ? '-' + slug(cv.id) : '-figure-' + seen);

        var bar = document.createElement('div');
        bar.className = 'figbar';

        if(animated){
          var pb = document.createElement('button');
          pb.type = 'button';
          pb.setAttribute('data-play', '1');
          pb._owners = owners;
          pb.addEventListener('click', function(){
            var paused = owners.every(function(o){ return o.paused; });
            owners.forEach(function(o){ o.paused = !paused; });
            syncBars();
          });
          bar.appendChild(pb);
        }

        var sp = document.createElement('span');
        sp.className = 'spacer';
        bar.appendChild(sp);

        if(animated && canRecord){
          var rb = document.createElement('button');
          rb.type = 'button';
          rb.title = 'Record six seconds of this animation as a video file';
          rb.setAttribute('aria-label', 'Record this animation');
          rb.innerHTML = ICON.rec + '<span class="lab">REC</span>';
          rb.addEventListener('click', function(){ recordCanvas(cv, name, rb, 6); });
          bar.appendChild(rb);
        }

        var sb = document.createElement('button');
        sb.type = 'button';
        sb.title = 'Save this figure as a PNG image';
        sb.setAttribute('aria-label', 'Save this figure as a PNG image');
        sb.innerHTML = ICON.save + '<span class="lab">PNG</span>';
        sb.addEventListener('click', function(){ exportPNG(cv, host, name); });
        bar.appendChild(sb);

        if(cv.nextSibling) cv.parentNode.insertBefore(bar, cv.nextSibling);
        else cv.parentNode.appendChild(bar);
      });
    });
    syncBars();
  }

  function boot(){
    readColors();
    checks();
    var rt;
    window.addEventListener('resize', function(){
      clearTimeout(rt); rt = setTimeout(function(){ readColors(); redrawStatic(); }, 90);
    });
    try{
      /* data-theme is now the only thing that changes the palette, so the
         observer below is the only trigger a figure needs. */
      new MutationObserver(function(){ readColors(); redrawStatic(); })
        .observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
    }catch(e){}
    if(window.ResizeObserver){
      var ro = new ResizeObserver(function(){
        clearTimeout(rt); rt = setTimeout(redrawStatic, 70);
      });
      Array.prototype.forEach.call(document.querySelectorAll('canvas.static'), function(c){
        try{ ro.observe(c); }catch(e){}
      });
    }
    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(redrawStatic).catch(function(){});
    }
    [120, 500, 1400].forEach(function(d){ setTimeout(redrawStatic, d); });
    loop();
    /* the drawers claim their canvases on the first frame, so the toolbars
       are built just after that, and again in case a figure drew late */
    [90, 700, 1800].forEach(function(d){ setTimeout(buildBars, d); });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return {
    TAU: TAU, fit: fit, register: register, arrow: arrow, design: design,
    colors: function(){ return C; },
    redrawStatic: redrawStatic,
    setRunning: function(v){ running = v; },
    isRunning: function(){ return running; },
    exportPNG: exportPNG
  };
})();
