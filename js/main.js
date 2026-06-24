/* ============================================================
   StockBuddy – main.js
   Dependencies : Chart.js (loaded before this file)
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

/**
 * Draw a mini sparkline on a canvas element.
 * Uses fixed pixel dimensions (130 × 68) to avoid the offsetWidth=0
 * bug that occurs when the canvas is not yet laid out.
 *
 * @param {string}   canvasId  Element id
 * @param {string}   color     Hex / CSS color for line + gradient fill
 * @param {number[]} data      Values array
 */
function drawSparkline(canvasId, color, data) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;

  /* Destroy any previous Chart instance on this canvas */
  var existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  /* Hard-code canvas pixel size – never rely on offsetWidth during DOMContentLoaded */
  var W = 170, H = 95;
  canvas.width  = W;
  canvas.height = H;

  var ctx = canvas.getContext('2d');

  /* Build gradient fill once the context exists */
  var grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, color + '30');  /* ~19 % opacity at top */
  grad.addColorStop(1, color + '00');  /* fully transparent at bottom */

  new Chart(canvas, {
    type: 'line',
    data: {
      labels  : data.map(function (_, i) { return i; }),
      datasets: [{
        data           : data,
        borderColor    : color,
        borderWidth    : 2.5,
        pointRadius    : 0,
        tension        : 0.42,
        fill           : true,
        backgroundColor: grad
      }]
    },
    options: {
      responsive    : false,
      animation     : false,
      layout        : { padding: { top: 4, bottom: 2 } },
      plugins       : { legend: { display: false }, tooltip: { enabled: false } },
      scales        : { x: { display: false }, y: { display: false } }
    }
  });
}

/* ============================================================
   PERFORMANCE COMPARISON CHART (bottom section)
   ============================================================ */

/**
 * Build the x-axis label array (month label every 10 points, blank in between).
 * @param {string[]} monthNames
 * @param {number}   pointsPerMonth
 * @returns {string[]}
 */
function buildLabels(monthNames, pointsPerMonth) {
  const labels = [];
  monthNames.forEach(function (m, idx) {
    labels.push(m);
    if (idx < monthNames.length - 1) {
      for (let j = 1; j < pointsPerMonth; j++) {
        labels.push('');
      }
    }
  });
  return labels;
}

function initPerfChart() {
  const canvas = document.getElementById('perfChart');
  if (!canvas) return;

  const monthNames     = ["Jan '24", "Feb '24", "Mär '24", "Apr '24", "Mai '24"];
  const pointsPerMonth = 10;
  const totalPoints    = (monthNames.length - 1) * pointsPerMonth + 1;

  const labels   = buildLabels(monthNames, pointsPerMonth);
  const pinkData = makeTrendData(totalPoints, -3,    18.75, 7);
  const blueData = makeTrendData(totalPoints, -1,     6.40, 3);

  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label          : 'StockBuddy Musterdepot',
          data           : pinkData,
          borderColor    : '#D4387A',
          borderWidth    : 2,
          pointRadius    : 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#D4387A',
          tension        : 0.45,
          fill           : false
        },
        {
          label          : 'Mein Depot',
          data           : blueData,
          borderColor    : '#1B4FBF',
          borderWidth    : 2,
          pointRadius    : 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#1B4FBF',
          tension        : 0.45,
          fill           : false
        }
      ]
    },
    options: {
      responsive           : true,
      maintainAspectRatio  : false,
      interaction          : { mode: 'index', intersect: false },
      plugins: {
        legend : { display: false },
        tooltip: {
          backgroundColor: '#fff',
          titleColor     : '#1a1a2e',
          bodyColor      : '#6b7280',
          borderColor    : '#e5e7eb',
          borderWidth    : 1,
          padding        : 10,
          callbacks: {
            label: function (ctx) {
              return ctx.dataset.label + ': ' + ctx.raw.toFixed(2) + ' %';
            }
          }
        }
      },
      scales: {
        x: {
          grid  : { display: false },
          border: { display: false },
          ticks : {
            color      : '#9ba3af',
            font       : { size: 11 },
            maxRotation: 0,
            callback   : function (val, idx) { return labels[idx] || ''; }
          }
        },
        y: {
          grid  : { color: 'rgba(0,0,0,0.05)' },
          border: { display: false, dash: [4, 4] },
          ticks : {
            color   : '#9ba3af',
            font    : { size: 11 },
            callback: function (v) { return v.toFixed(0) + ' %'; }
          }
        }
      }
    }
  });
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
   INIT – run after DOM + Chart.js are ready
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