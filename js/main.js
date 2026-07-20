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
   ALLE BENACHRICHTIGUNGEN – shared modal (all pages)
   Injected from JS so every page gets the same popup without
   duplicating markup. Clicking a bell-dropdown item opens the
   modal with that message expanded.
   ============================================================ */
var NOTIF_MESSAGES = [
  { logo: 'img/nvidia.png',    title: 'NVIDIA Corporation',    teaser: 'Die NVIDIA-Aktie notierte im NASDAQ-Handel um 20:26 Uhr in Grün und gewann 4,0 Prozent auf 211,60 USD.', date: '22.05.2026' },
  { logo: 'img/microsoft.png', title: 'Microsoft Corporation', teaser: 'Die Microsoft-Aktie gab im NASDAQ-Handel um 20:26 Uhr um 1,1 Prozent auf 386,84 USD nach.', date: '12.04.2026' },
  { logo: 'img/asml.png',      title: 'ASML Holding N.V.',     teaser: 'Die Quartalssaison nimmt nach einem verhaltenen Start in der zurückliegenden Woche inzwischen mächtig an Fahrt auf.', date: '19.05.2024' },
  { logo: 'img/visa.png',      title: 'Visa Inc.',             teaser: 'Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.', date: '14.05.2024' },
  { logo: 'img/asml.png',      title: 'ASML Holding N.V.',     teaser: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna', date: '14.03.2024' },
  { logo: 'img/microsoft.png', title: 'Microsoft Corporation', teaser: 'Die Microsoft-Aktie gab im NASDAQ-Handel um 20:26 Uhr um 1,1 Prozent auf 386,84 USD nach.', date: '12.04.2026' }
];

function initAlleNotifModal() {
  if (typeof bootstrap === 'undefined') return;

  var lorem1 = 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum.';
  var lorem2 = 'Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.<br />Duis autem vel eum iriure dolor in hendrerit.';

  /* build the modal once per page */
  if (!document.getElementById('alleNotifModal')) {
    var rows = NOTIF_MESSAGES.map(function (msg, i) {
      return '<div class="an-item" data-an-index="' + i + '">' +
        '<button class="an-head" type="button" aria-expanded="false">' +
          '<div class="analysis-logo an-logo"><img src="' + msg.logo + '" alt="' + msg.title + '" /></div>' +
          '<div class="an-info">' +
            '<div class="an-title">' + msg.title + '</div>' +
            '<div class="an-desc">' + msg.teaser + '</div>' +
            '<div class="an-date">' + msg.date + '</div>' +
          '</div>' +
          '<i class="bi bi-chevron-down an-chevron"></i>' +
        '</button>' +
        '<div class="an-body"><p>' + lorem1 + '</p><p>' + lorem2 + '</p></div>' +
      '</div>';
    }).join('');

    document.body.insertAdjacentHTML('beforeend',
      '<div class="modal fade" id="alleNotifModal" tabindex="-1" aria-labelledby="alleNotifTitle" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered modal-lg">' +
          '<div class="modal-content analysen-modal">' +
            '<div class="modal-header analysen-modal-header">' +
              '<div class="analysen-modal-title" id="alleNotifTitle">' +
                '<img src="img/letzte_analysen.svg" alt="" style="width:24px;" /> Alle Benachrichtigungen' +
              '</div>' +
              '<button type="button" class="analysen-modal-close" data-bs-dismiss="modal" aria-label="Schließen"><i class="bi bi-x-lg"></i></button>' +
            '</div>' +
            '<div class="modal-body analysen-modal-body an-list">' + rows + '</div>' +
          '</div>' +
        '</div>' +
      '</div>');
  }

  var modalEl = document.getElementById('alleNotifModal');

  function setOpen(item, open) {
    item.classList.toggle('open', open);
    item.querySelector('.an-head').setAttribute('aria-expanded', String(open));
  }
  modalEl.querySelectorAll('.an-head').forEach(function (head) {
    head.addEventListener('click', function () {
      var item = this.closest('.an-item');
      var willOpen = !item.classList.contains('open');
      modalEl.querySelectorAll('.an-item').forEach(function (i) { setOpen(i, false); });
      setOpen(item, willOpen);
    });
  });

  function openModalAt(index) {
    modalEl.querySelectorAll('.an-item').forEach(function (i) { setOpen(i, false); });
    var target = index != null ? modalEl.querySelector('.an-item[data-an-index="' + index + '"]') : null;
    if (target) setOpen(target, true);
    var panel = document.getElementById('notifPanel');
    if (panel) panel.hidden = true;
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
    if (target) setTimeout(function () { target.scrollIntoView({ block: 'nearest' }); }, 250);
  }

  /* bell dropdown items open the modal with the clicked message expanded */
  document.querySelectorAll('#notifPanel .notif-item').forEach(function (item, idx) {
    item.style.cursor = 'pointer';
    item.addEventListener('click', function () { openModalAt(idx); });
  });
  /* footer link opens the modal without preselecting */
  var footerLink = document.querySelector('#notifPanel .notif-footer a');
  if (footerLink) footerLink.addEventListener('click', function (e) {
    e.preventDefault();
    openModalAt(null);
  });
  /* bells without their own dropdown (e.g. the mobile-only topbar bell on
     buddy.html) open the modal directly — previously they did nothing */
  document.querySelectorAll('.sb-notif:not(#notifBtn)').forEach(function (bell) {
    bell.addEventListener('click', function () { openModalAt(null); });
  });
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
  initAlleNotifModal();
  initTooltips();
});