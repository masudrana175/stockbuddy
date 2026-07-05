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
   SPARKLINE CHARTS (top performance cards)
   ============================================================ */

function drawSparkline(divId, color, data) {
  if (!document.getElementById(divId)) return;
  Plotly.newPlot(divId, [{
    y: data,
    type: 'scatter', mode: 'lines',
    line: { color: color, width: 2.5, shape: 'spline', smoothing: 1.2 },
    fill: 'tozeroy', fillcolor: color + '18'
  }], {
    font: { family: 'Barlow, sans-serif' },
    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
    margin: { t: 0, r: 0, b: 0, l: 0 },
    xaxis: { visible: false }, yaxis: { visible: false }
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

  Plotly.newPlot('perfChart', [
    { x: x, y: pinkData, name: 'StockBuddy Musterdepot',
      type: 'scatter', mode: 'lines',
      line: { color: '#D4387A', width: 2, shape: 'spline', smoothing: 1.2 } },
    { x: x, y: blueData, name: 'Mein Depot',
      type: 'scatter', mode: 'lines',
      line: { color: '#1B4FBF', width: 2, shape: 'spline', smoothing: 1.2 } }
  ], {
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
      ticksuffix: ' %'
    },
    hovermode: 'x unified', showlegend: false
  }, { displayModeBar: false, responsive: true });
}

/* ============================================================
   TIME-PERIOD SELECTOR BUTTONS
   ============================================================ */
function initTimeButtons() {
  var buttons = document.querySelectorAll('.time-btn');
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
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