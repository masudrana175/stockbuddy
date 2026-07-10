/* ============================================================
   StockBuddy – main.js
   Dependencies : Plotly.js (loaded before this file)
   ============================================================ */

'use strict';

/* ============================================================
   UTILITY – Seeded pseudo-random (reproducible chart data)
   ============================================================ */
function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Build a noisy trend line that starts near `start` and ends at `end`.
 * @param {number} points  Total data points
 * @param {number} start   Starting value
 * @param {number} end     Ending value
 * @param {number} seed    PRNG seed (keeps chart stable on re-render)
 * @returns {number[]}
 */
function makeTrendData(points, start, end, seed) {
  const rand = seededRand(seed);
  const data = [start];
  for (let i = 1; i < points - 1; i++) {
    const trend  = start + (end - start) * (i / (points - 1));
    const noise  = (rand() - 0.48) * 2.8;
    data.push(+(trend + noise).toFixed(2));
  }
  data.push(end);
  return data;
}

/* ============================================================
   SPLIT SERIES AT ZERO
   Zerlegt eine Serie am Nulldurchgang in einen positiven und einen
   negativen Teil (jeweils null außerhalb), inkl. exakter
   Kreuzungspunkte bei y = 0. So kann der negative Abschnitt separat
   (gestrichelt) gezeichnet werden – in DERSELBEN Serienfarbe, damit
   die Linien unterscheidbar bleiben.
   ============================================================ */
function splitSeriesAtZero(xs, ys) {
  var posX = [], posY = [], negX = [], negY = [];
  for (var i = 0; i < ys.length; i++) {
    var x = xs[i], y = ys[i];
    if (i > 0) {
      var px = xs[i - 1], py = ys[i - 1];
      if ((py < 0) !== (y < 0) && py !== 0 && y !== 0) {
        var t  = (0 - py) / (y - py);          // Nulldurchgang interpolieren
        var cx = px + (x - px) * t;
        posX.push(cx); posY.push(0);
        negX.push(cx); negY.push(0);
      }
    }
    posX.push(x); posY.push(y >= 0 ? y : null);
    negX.push(x); negY.push(y <= 0 ? y : null);
  }
  return { posX: posX, posY: posY, negX: negX, negY: negY };
}

/* ============================================================
   SPARKLINE CHARTS (top performance cards)
   ============================================================ */

function drawSparkline(divId, color, data) {
  if (!document.getElementById(divId)) return;

  var dataMin = Math.min.apply(null, data);
  var hasNeg = dataMin < 0;
  var xs  = data.map(function (_, i) { return i; });
  var sp  = splitSeriesAtZero(xs, data);

  var traces = [{
    x: sp.posX, y: sp.posY,
    type: 'scatter', mode: 'lines',
    line: { color: color, width: 2.5, shape: 'spline', smoothing: 1.2 },
    fill: 'tozeroy', fillcolor: color + '18', connectgaps: false
  }];
  /* Negativer Abschnitt: gleiche Serienfarbe, aber gestrichelt (ohne Füllung) */
  if (hasNeg) {
    traces.push({
      x: sp.negX, y: sp.negY, type: 'scatter', mode: 'lines',
      line: { color: color, width: 2.5, shape: 'spline', smoothing: 1.2, dash: 'dot' },
      connectgaps: false, hoverinfo: 'skip', showlegend: false
    });
  }

  Plotly.newPlot(divId, traces, {
    font: { family: 'Barlow, sans-serif' },
    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
    margin: { t: 0, r: 0, b: 0, l: 0 },
    showlegend: false,
    hoverlabel: { bgcolor: '#ffffff', bordercolor: 'rgba(100,116,139,0.35)', font: { family: 'Barlow', size: 12, color: '#333333' } },
    xaxis: { visible: false },
    /* zeroline sichtbar, sonst Achse unsichtbar – markiert die Nulllinie
       neutral (Slate-Grau), damit negative Ausschläge lesbar sind */
    yaxis: {
      showgrid: false, showticklabels: false, showline: false,
      zeroline: hasNeg, zerolinecolor: 'rgba(100,116,139,0.55)', zerolinewidth: 1
    }
  }, { displayModeBar: false, responsive: true });
}

/* ============================================================
   PERFORMANCE COMPARISON CHART (bottom section)
   ============================================================ */

function initPerfChart() {
  if (!document.getElementById('perfChart')) return;

  var months        = ["Jan '24", "Feb '24", "Mär '24", "Apr '24", "Mai '24"];
  var ppm           = 10; // points per month
  var total         = (months.length - 1) * ppm + 1; // 41
  var pinkData      = makeTrendData(total, -3,    18.75, 7);
  var blueData      = makeTrendData(total, -1,     6.40, 3);
  var tickvals      = months.map(function (_, i) { return i * ppm; });
  var x             = Array.from({ length: total }, function (_, i) { return i; });
  var dataMin       = Math.min(Math.min.apply(null, pinkData), Math.min.apply(null, blueData));

  /* Je Serie: positiver Teil solide, negativer Teil gestrichelt –
     beide in DERSELBEN Serienfarbe, damit die Linien im negativen
     Bereich unterscheidbar bleiben. */
  var series = [
    { y: pinkData, c: '#D4387A', name: 'StockBuddy Musterdepot' },
    { y: blueData, c: '#1B4FBF', name: 'Mein Depot' }
  ];
  var traces = [];
  series.forEach(function (s) {
    var sp = splitSeriesAtZero(x, s.y);
    /* Unsichtbare Voll-Linie NUR für den Hover -> genau EIN sauberer Eintrag
       je Serie (keine Doppelungen durch die Split-Traces) und Hover rastet
       auf ganze x-Werte (kein krummer Header). */
    traces.push({
      x: x, y: s.y, name: s.name, type: 'scatter', mode: 'lines',
      line: { color: 'rgba(0,0,0,0)', width: 0 }, showlegend: false
    });
    /* Sichtbar: positiver Teil solide – ohne eigenen Hover */
    traces.push({
      x: sp.posX, y: sp.posY, type: 'scatter', mode: 'lines', connectgaps: false,
      line: { color: s.c, width: 2, shape: 'spline', smoothing: 1.2 },
      hoverinfo: 'skip', showlegend: false
    });
    /* Sichtbar: negativer Teil gestrichelt – ohne eigenen Hover */
    if (Math.min.apply(null, s.y) < 0) {
      traces.push({
        x: sp.negX, y: sp.negY, type: 'scatter', mode: 'lines', connectgaps: false,
        line: { color: s.c, width: 2, shape: 'spline', smoothing: 1.2, dash: 'dash' },
        hoverinfo: 'skip', showlegend: false
      });
    }
  });

  Plotly.newPlot('perfChart', traces, {
    font: { family: 'Barlow, sans-serif' },
    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
    margin: { t: 4, r: 8, b: 28, l: 36 },
    xaxis: {
      showgrid: false,
      tickvals: tickvals, ticktext: months,
      tickfont: { family: 'Barlow', size: 11, color: '#9ba3af' }
    },
    yaxis: {
      gridcolor: 'rgba(0,0,0,0.05)',
      tickfont: { family: 'Barlow', size: 11, color: '#9ba3af' },
      ticksuffix: ' %',
      /* neutrale Nulllinie (Slate), markiert die Grenze zu negativ */
      zeroline: true, zerolinecolor: 'rgba(100,116,139,0.6)', zerolinewidth: 1.5
    },
    /* deckend weißer Hover (Standard-Plotly-Hintergrund ist halbtransparent) */
    hoverlabel: {
      bgcolor: '#ffffff',
      bordercolor: 'rgba(100,116,139,0.35)',
      font: { family: 'Barlow', size: 12, color: '#333333' }
    },
    hovermode: 'x unified', showlegend: false
  }, { displayModeBar: false, responsive: true });
}

/* ============================================================
   TIME-PERIOD SELECTOR BUTTONS
   ============================================================ */
function initTimeButtons() {
  /* Each button group toggles independently (.time-btns and .perf-time-btns) */
  document.querySelectorAll('.time-btns, .perf-time-btns').forEach(function (group) {
    var buttons = group.querySelectorAll('.time-btn, .perf-time-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
      });
    });
  });
}

/* ============================================================
   NOTIFICATION DROPDOWN
   ============================================================ */
function initNotifications() {
  var btn     = document.getElementById('notifBtn');
  var panel   = document.getElementById('notifPanel');
  var closeBtn= document.getElementById('notifClose');
  var badge   = document.getElementById('notifCount');

  if (!btn || !panel) return;

  /* Toggle on bell click */
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var isOpen = !panel.hidden;
    panel.hidden = isOpen;
    btn.setAttribute('aria-expanded', String(!isOpen));

    /* Clear badge once panel is opened */
    if (!panel.hidden && badge) {
      badge.textContent = '';
      badge.style.display = 'none';
      /* Mark unread items read */
      document.querySelectorAll('.notif-item.unread').forEach(function (el) {
        el.classList.remove('unread');
      });
      document.querySelectorAll('.notif-dot').forEach(function (el) {
        el.style.opacity = '0';
      });
    }
  });

  /* Close button inside panel */
  if (closeBtn) {
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  /* Close on outside click */
  document.addEventListener('click', function (e) {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  /* Close on Escape key */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });
}

/* ============================================================
   BOOTSTRAP TOOLTIPS – info icons
   ============================================================ */
function initTooltips() {
  /* Requires Bootstrap JS to be loaded */
  if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) return;
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
    bootstrap.Tooltip.getOrCreateInstance(el, {
      trigger : 'hover focus',
      delay   : { show: 120, hide: 80 }
    });
  });
}

/* ============================================================
   MOBILE / TABLET SIDEBAR TOGGLE
   ============================================================ */
function initSidebarToggle() {
  var sidebar   = document.getElementById('sidebar');
  var overlay   = document.getElementById('overlay');
  var hamburger = document.getElementById('hamburger');

  if (!hamburger || !sidebar || !overlay) return;

  function openSidebar() {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('show');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Navigation schließen');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('show');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Navigation öffnen');
    document.body.style.overflow = '';
  }

  /* Hamburger: toggle open / closed */
  hamburger.addEventListener('click', function () {
    if (sidebar.classList.contains('mobile-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  /* Tap dim overlay to close */
  overlay.addEventListener('click', closeSidebar);

  /* Escape key closes drawer */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
      closeSidebar();
      hamburger.focus();
    }
  });

  /* Tapping a nav link also closes drawer on mobile */
  sidebar.querySelectorAll('.sb-nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.innerWidth < 768) { closeSidebar(); }
    });
  });
}

/* ============================================================
   INIT – run after DOM + Plotly are ready
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  /* Sparklines */
  drawSparkline('spark1', '#D4387A', makeTrendData(40, -2, 18.75, 42));
  drawSparkline('spark2', '#1B4FBF', makeTrendData(40, -1,  6.40, 99));

  /* Main performance chart */
  initPerfChart();

  /* UI behaviours */
  initTimeButtons();
  initSidebarToggle();
  initNotifications();
  initTooltips();
});