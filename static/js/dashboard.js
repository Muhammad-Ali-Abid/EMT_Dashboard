/* ── Config ──────────────────────────────────────────────────────────────── */
const BASE = '';
const PALETTE = ['#C0A9BD','#94A7AE','#64766A','#B07080','#B09070',
                 '#7a9a8c','#a08090','#8a9aac','#906870','#9c9070',
                 '#7cb8a8','#c49870','#8090b8','#a07860','#90a070'];

/* ── Crosshair plugin ────────────────────────────────────────────────────── */
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    const type = chart.config.type;
    if (type === 'doughnut' || type === 'pie') return;
    if (!chart.tooltip._active || !chart.tooltip._active.length) return;

    const active  = chart.tooltip._active[0];
    const ctx     = chart.ctx;
    const area    = chart.chartArea;
    const isHoriz = chart.options.indexAxis === 'y';
    const color   = isDark ? 'rgba(255,255,255,.30)' : 'rgba(0,0,0,.28)';

    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.lineWidth    = 1.2;
    ctx.strokeStyle  = color;
    ctx.beginPath();

    if (isHoriz) {
      const y = active.element.y;
      ctx.moveTo(area.left,  y);
      ctx.lineTo(area.right, y);
    } else {
      const x = active.element.x;
      ctx.moveTo(x, area.top);
      ctx.lineTo(x, area.bottom);
    }

    ctx.stroke();
    ctx.restore();
  }
};
Chart.register(crosshairPlugin);

/* ── Theme ───────────────────────────────────────────────────────────────── */
let isDark = false;
function toggleTheme() {
  isDark = !isDark;
  document.body.classList.toggle('dark', isDark);
  document.getElementById('themeBtn').textContent = isDark ? '☀' : '☽';
  Object.values(chartInstances).forEach(c => { if (c) { applyChartTheme(c); c.update(); } });
}
function gridColor() { return isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'; }
function tickColor() { return isDark ? '#9c8a9a' : '#7a6878'; }

function applyChartTheme(chart) {
  const gc = gridColor(), tc = tickColor();
  (chart.options.scales?.x?.grid   || {}).color = gc;
  (chart.options.scales?.y?.grid   || {}).color = gc;
  (chart.options.scales?.x?.ticks  || {}).color = tc;
  (chart.options.scales?.y?.ticks  || {}).color = tc;
  if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = tc;
}

/* ── Page loader ─────────────────────────────────────────────────────────── */
function showLoader(msg = 'Fetching data…') {
  const el = document.getElementById('page-loader');
  const sub = document.getElementById('loader-sub');
  if (el) el.classList.remove('done');
  if (sub) sub.textContent = msg;
}
function hideLoader() {
  const el = document.getElementById('page-loader');
  if (el) el.classList.add('done');
}

/* ── Animated KPI counter ────────────────────────────────────────────────── */
function animateCounter(el, target, formatter, duration = 1100) {
  if (!el) return;
  const start    = performance.now();
  const from     = 0;
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);          // ease-out cubic
    el.textContent = formatter(Math.round(from + (target - from) * eased));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const api = (path, params = {}) => {
  const u = new URL(BASE + path, location.origin);
  Object.entries(params).forEach(([k,v]) => { if (v !== '' && v != null) u.searchParams.set(k, v); });
  return fetch(u).then(r => r.json());
};

function compact(n) {
  n = Math.abs(+n);
  if (n >= 1e12) return (n/1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3)  return (n/1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function chartOpts(extra = {}) {
  return {
    responsive: true,
    animation: false,
    plugins: {
      legend: { labels: { color: tickColor(), font: { size: 11 }, boxWidth: 12 } },
      tooltip: { mode: 'index', intersect: false },
    },
    ...extra
  };
}

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); chartInstances[id] = null; }
}

function downloadChart(id) {
  const c = chartInstances[id]; if (!c) return;
  const a = document.createElement('a');
  a.href = c.toBase64Image(); a.download = id + '.png'; a.click();
}

/* ── Chart registry ──────────────────────────────────────────────────────── */
const chartInstances = {};

/* ── Tabs ────────────────────────────────────────────────────────────────── */
function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'explorer') initExplorer();
  if (name === 'ai')       initAi();
}

/* ── Overview ────────────────────────────────────────────────────────────── */
let ovFilters = {};

function applyOverviewFilters() {
  ovFilters = {
    startYear: document.getElementById('ov-startYear').value,
    endYear:   document.getElementById('ov-endYear').value,
    disasterType: document.getElementById('ov-type').value,
    region: document.getElementById('ov-region').value,
  };
  loadOverview();
}

async function loadOverview() {
  const f = ovFilters;
  const [summary, byYear, byType, byRegion, byCountry, deathsType,
         damageType, byMonth, affectedTrend, aidRegion] = await Promise.all([
    api('/api/disasters/summary', f),
    api('/api/disasters/by-year', f),
    api('/api/disasters/by-type', f),
    api('/api/disasters/by-region', f),
    api('/api/disasters/by-country', {...f, limit: 15}),
    api('/api/disasters/deaths-by-type', f),
    api('/api/disasters/damage-by-type', f),
    api('/api/disasters/by-month', f),
    api('/api/disasters/affected-trend', f),
    api('/api/disasters/aid-by-region', f),
  ]);

  // KPIs — animated count-up
  animateCounter(document.getElementById('kpi-events'),   summary.totalEvents    ?? 0, v => v.toLocaleString());
  animateCounter(document.getElementById('kpi-deaths'),   summary.totalDeaths    ?? 0, v => v.toLocaleString());
  animateCounter(document.getElementById('kpi-affected'), summary.totalAffected  ?? 0, v => v.toLocaleString());
  animateCounter(document.getElementById('kpi-damage'),   summary.totalDamageUsd ?? 0, v => '$' + compact(v));
  document.getElementById('subtitle').textContent =
    `Global Emergency Events Database · ${summary.totalEvents?.toLocaleString()} events · ${summary.yearsSpan}`;

  // ── By Year (combo: area events + line deaths) ──
  destroyChart('byYearChart');
  chartInstances['byYearChart'] = new Chart(document.getElementById('byYearChart'), {
    type: 'line',
    data: {
      labels: byYear.map(d => d.year),
      datasets: [
        {
          label: 'Events', data: byYear.map(d => d.count), yAxisID: 'y',
          borderColor: '#94A7AE', backgroundColor: 'rgba(148,167,174,.15)',
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
        },
        {
          label: 'Deaths', data: byYear.map(d => d.deaths), yAxisID: 'y2',
          borderColor: '#B07080', backgroundColor: 'transparent',
          tension: 0.3, pointRadius: 0, borderWidth: 1.5,
        }
      ]
    },
    options: chartOpts({
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), maxTicksLimit: 20 } },
        y: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: compact } },
        y2: { position: 'right', grid: { display: false }, ticks: { color: tickColor(), callback: compact } },
      }
    })
  });

  // ── By Type (donut) ──
  destroyChart('byTypeChart');
  chartInstances['byTypeChart'] = new Chart(document.getElementById('byTypeChart'), {
    type: 'doughnut',
    data: {
      labels: byType.map(d => d.category),
      datasets: [{ data: byType.map(d => d.count), backgroundColor: PALETTE, borderWidth: 1 }]
    },
    options: chartOpts({ cutout: '55%',
      plugins: { legend: { position: 'bottom', labels: { color: tickColor(), font: {size:11}, boxWidth:12 } } }
    })
  });

  // ── By Region (horizontal bar) ──
  destroyChart('byRegionChart');
  chartInstances['byRegionChart'] = new Chart(document.getElementById('byRegionChart'), {
    type: 'bar',
    data: {
      labels: byRegion.map(d => d.category),
      datasets: [{ label: 'Events', data: byRegion.map(d => d.count),
        backgroundColor: '#64766A', borderRadius: 3 }]
    },
    options: chartOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: compact } },
        y: { grid: { display: false }, ticks: { color: tickColor() } },
      }
    })
  });

  // ── By Country ──
  destroyChart('byCountryChart');
  chartInstances['byCountryChart'] = new Chart(document.getElementById('byCountryChart'), {
    type: 'bar',
    data: {
      labels: byCountry.map(d => d.country),
      datasets: [{ label: 'Events', data: byCountry.map(d => d.count),
        backgroundColor: '#94A7AE', borderRadius: 3 }]
    },
    options: chartOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: compact } },
        y: { grid: { display: false }, ticks: { color: tickColor(), font: {size: 10} } },
      }
    })
  });

  // ── Deaths by Type ──
  destroyChart('deathsTypeChart');
  chartInstances['deathsTypeChart'] = new Chart(document.getElementById('deathsTypeChart'), {
    type: 'bar',
    data: {
      labels: deathsType.map(d => d.category),
      datasets: [{ label: 'Deaths', data: deathsType.map(d => d.value),
        backgroundColor: '#B07080', borderRadius: 3 }]
    },
    options: chartOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: compact } },
        y: { grid: { display: false }, ticks: { color: tickColor() } },
      }
    })
  });

  // ── Damage by Type ──
  destroyChart('damageTypeChart');
  chartInstances['damageTypeChart'] = new Chart(document.getElementById('damageTypeChart'), {
    type: 'bar',
    data: {
      labels: damageType.map(d => d.category),
      datasets: [{ label: 'Damage (USD)', data: damageType.map(d => d.value),
        backgroundColor: '#B09070', borderRadius: 3 }]
    },
    options: chartOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: v => '$'+compact(v) } },
        y: { grid: { display: false }, ticks: { color: tickColor() } },
      }
    })
  });

  // ── By Month ──
  destroyChart('byMonthChart');
  chartInstances['byMonthChart'] = new Chart(document.getElementById('byMonthChart'), {
    type: 'bar',
    data: {
      labels: byMonth.map(d => d.monthName),
      datasets: [{ label: 'Events', data: byMonth.map(d => d.count),
        backgroundColor: '#C0A9BD', borderRadius: 3 }]
    },
    options: chartOpts({
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: tickColor() } },
        y: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: compact } },
      }
    })
  });

  // ── Affected Trend (bar affected + line deaths) ──
  destroyChart('affectedTrendChart');
  chartInstances['affectedTrendChart'] = new Chart(document.getElementById('affectedTrendChart'), {
    type: 'bar',
    data: {
      labels: affectedTrend.map(d => d.period),
      datasets: [
        { type: 'bar', label: 'Affected', data: affectedTrend.map(d => d.affected),
          backgroundColor: '#64766A', yAxisID: 'y', borderRadius: 3, order: 2 },
        { type: 'line', label: 'Deaths', data: affectedTrend.map(d => d.deaths),
          borderColor: '#B07080', backgroundColor: 'transparent',
          yAxisID: 'y2', tension: 0.3, pointRadius: 4, pointHoverRadius: 6,
          borderWidth: 2.5, order: 1, z: 10 }
      ]
    },
    options: chartOpts({
      scales: {
        x: { grid: { display: false }, ticks: { color: tickColor() } },
        y: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: compact } },
        y2: { position: 'right', grid: { display: false }, ticks: { color: tickColor(), callback: compact } },
      }
    })
  });

  // ── Aid by Region ──
  destroyChart('aidRegionChart');
  chartInstances['aidRegionChart'] = new Chart(document.getElementById('aidRegionChart'), {
    type: 'bar',
    data: {
      labels: aidRegion.map(d => d.category),
      datasets: [{ label: 'Aid (USD)', data: aidRegion.map(d => d.value),
        backgroundColor: '#7a9a8c', borderRadius: 3 }]
    },
    options: chartOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: v => '$'+compact(v) } },
        y: { grid: { display: false }, ticks: { color: tickColor() } },
      }
    })
  });

  // ── Deaths vs Affected ──
  destroyChart('deathsAffectedChart');
  chartInstances['deathsAffectedChart'] = new Chart(document.getElementById('deathsAffectedChart'), {
    type: 'line',
    data: {
      labels: byYear.map(d => d.year),
      datasets: [
        { label: 'Affected', data: byYear.map(d => d.affected), yAxisID: 'y',
          borderColor: '#64766A', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: 'Deaths', data: byYear.map(d => d.deaths), yAxisID: 'y2',
          borderColor: '#B07080', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5 }
      ]
    },
    options: chartOpts({
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), maxTicksLimit: 15 } },
        y: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: compact } },
        y2: { position: 'right', grid: { display: false }, ticks: { color: tickColor(), callback: compact } },
      }
    })
  });
}

/* ── Custom Chart ────────────────────────────────────────────────────────── */
let lastCustomData = null;

async function buildCustomChart() {
  const xField    = document.getElementById('cc-x').value;
  const yField    = document.getElementById('cc-y').value;
  const chartType = document.getElementById('cc-chartType').value;
  const limit     = document.getElementById('cc-limit').value;
  const startYear = document.getElementById('cc-startYear').value;
  const endYear   = document.getElementById('cc-endYear').value;

  const res = await api('/api/disasters/custom-chart', { xField, yField, startYear, endYear, limit });
  lastCustomData = res;

  document.getElementById('cc-card').style.display = '';
  document.getElementById('cc-csvBtn').style.display = '';
  document.getElementById('cc-title').textContent = `${yField} by ${xField}`;

  const labels = res.data.map(d => d.label);
  const values = res.data.map(d => d.value);

  destroyChart('customChart');

  const canvas = document.getElementById('customChart');
  canvas.removeAttribute('style');
  canvas.height = chartType === 'Horizontal Bar' ? Math.max(260, labels.length * 22) : 320;

  const colors = PALETTE.slice(0, labels.length);

  if (chartType === 'Pie') {
    chartInstances['customChart'] = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 1 }] },
      options: chartOpts({ cutout: '50%',
        plugins: { legend: { position: 'bottom', labels: { color: tickColor(), font:{size:11}, boxWidth:12 } } }
      })
    });
  } else if (chartType === 'Line') {
    chartInstances['customChart'] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [{ label: yField, data: values,
        borderColor: '#64766A', backgroundColor: 'rgba(100,118,106,.12)',
        fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2 }] },
      options: chartOpts({
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor() }, ticks: { color: tickColor() } },
          y: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: compact } },
        }
      })
    });
  } else {
    const horiz = chartType === 'Horizontal Bar';
    chartInstances['customChart'] = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: yField, data: values,
        backgroundColor: '#64766A', borderRadius: 3 }] },
      options: chartOpts({
        indexAxis: horiz ? 'y' : 'x',
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: horiz ? gridColor() : 'transparent' },
               ticks: { color: tickColor(), callback: horiz ? compact : undefined } },
          y: { grid: { color: horiz ? 'transparent' : gridColor() },
               ticks: { color: tickColor(), callback: horiz ? undefined : compact } },
        }
      })
    });
  }

  setTimeout(() => {
    document.getElementById('cc-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}

function downloadCustomCsv() {
  if (!lastCustomData) return;
  const rows = [['Label', lastCustomData.yLabel], ...lastCustomData.data.map(d => [d.label, d.value])];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'custom-chart.csv'; a.click();
}

/* ── Data Explorer ───────────────────────────────────────────────────────── */
let exPage = 1, exSortBy = 'year', exSortDir = 'desc', exInitialized = false;

async function loadExplorer() {
  exPage = 1;
  const res = await api('/api/disasters/records', {
    search: document.getElementById('ex-search').value,
    disasterType: document.getElementById('ex-type').value,
    region: document.getElementById('ex-region').value,
    sortBy: exSortBy, sortDir: exSortDir, page: exPage, pageSize: 50,
  });
  renderTable(res);
}

async function explorerPage(delta) {
  exPage = Math.max(1, exPage + delta);
  const res = await api('/api/disasters/records', {
    search: document.getElementById('ex-search').value,
    disasterType: document.getElementById('ex-type').value,
    region: document.getElementById('ex-region').value,
    sortBy: exSortBy, sortDir: exSortDir, page: exPage, pageSize: 50,
  });
  renderTable(res);
}

function sortExplorer(col) {
  if (exSortBy === col) exSortDir = exSortDir === 'desc' ? 'asc' : 'desc';
  else { exSortBy = col; exSortDir = 'desc'; }
  ['year','type','country','region','deaths','affected','damage','aid'].forEach(c => {
    const el = document.getElementById('sort-' + c);
    if (el) el.textContent = c === exSortBy ? (exSortDir === 'desc' ? ' ▼' : ' ▲') : '';
  });
  document.querySelectorAll('th').forEach(th => th.classList.remove('sorted'));
  loadExplorer();
}

function renderTable(res) {
  const tbody = document.getElementById('ex-tbody');
  const fmtNull = v => v == null ? '—' : v.toLocaleString();
  tbody.innerHTML = res.data.map(r => `
    <tr>
      <td>${r.year || '—'}</td>
      <td>${r.type}</td>
      <td>${r.country}</td>
      <td>${r.region}</td>
      <td>${fmtNull(r.deaths)}</td>
      <td>${fmtNull(r.affected)}</td>
      <td>${r.damage != null ? '$'+compact(r.damage) : '—'}</td>
      <td>${r.aid    != null ? '$'+compact(r.aid)    : '—'}</td>
      <td>${r.subtype || '—'}</td>
    </tr>`).join('');

  const totalPages = Math.ceil(res.total / res.pageSize);
  document.getElementById('ex-page-info').textContent =
    `Page ${res.page} of ${totalPages} · ${res.total.toLocaleString()} records`;
  document.getElementById('ex-prev').disabled = res.page <= 1;
  document.getElementById('ex-next').disabled = res.page >= totalPages;
}

async function exportExplorerCsv() {
  const res = await api('/api/disasters/records', {
    search: document.getElementById('ex-search').value,
    disasterType: document.getElementById('ex-type').value,
    region: document.getElementById('ex-region').value,
    sortBy: exSortBy, sortDir: exSortDir, page: 1, pageSize: 200,
  });
  const headers = ['Year','Type','Country','Region','Deaths','Affected','Damage (USD)','Aid (USD)','Subtype'];
  const rows = res.data.map(r => [r.year,r.type,r.country,r.region,r.deaths,r.affected,r.damage,r.aid,r.subtype]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'disasters.csv'; a.click();
}

function initExplorer() {
  if (exInitialized) return;
  exInitialized = true;
  loadExplorer();
}

/* ── AI Assistant ─────────────────────────────────────────────────────────── */
const STARTERS = [
  'Which country has the most disaster events on record?',
  'Compare China, India, and USA by total deaths from disasters.',
  'Which disaster type occurred the most in Pakistan?',
  'What region has the highest number of disasters?',
  'How has disaster frequency changed across decades?',
  'Which year had the most disaster events recorded?',
  'What were the top 5 deadliest countries for floods?',
  'Which country suffered the most economic damage from disasters?',
];

let chatHistory = [];
let aiInitialized = false;
let aiThinking = false;

function initAi() {
  if (aiInitialized) return;
  aiInitialized = true;
  const sl = document.getElementById('starter-list');
  sl.innerHTML = STARTERS.map(q =>
    `<button class="starter-btn" onclick="sendChat('${q.replace(/'/g,"\\'")}', true)">${q}</button>`
  ).join('');
  addMsg('assistant', "Hello! I have access to the EM-DAT Global Disaster Database — 27,640 events from 1900 to 2026, spanning 200+ countries. Ask me about trends, country comparisons, death tolls, damage estimates, or any disaster statistics.");
}

function addMsg(role, content) {
  const msgs = document.getElementById('chat-messages');
  const isUser = role === 'user';
  const avatar = isUser ? 'U' : '🤖';
  const el = document.createElement('div');
  el.className = 'msg ' + role;
  el.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-bubble">${content}</div>`;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

async function sendChat(text, fromStarter) {
  const inputEl = document.getElementById('chat-input');
  const msg = text || inputEl.value.trim();
  if (!msg || aiThinking) return;
  if (!fromStarter) inputEl.value = '';
  aiThinking = true;

  addMsg('user', msg);
  chatHistory.push({ role: 'user', content: msg });

  const thinkEl = addMsg('assistant', '<em>Analyzing…</em>');
  thinkEl.classList.add('msg-thinking');

  const chatWindow = document.querySelector('.chat-window');
  chatWindow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('chat-messages').scrollTop = 99999;

  try {
    const res = await fetch(BASE + '/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: chatHistory.slice(-10) }),
    });
    const data = await res.json();
    thinkEl.remove();
    addMsg('assistant', data.answer);
    chatHistory.push({ role: 'assistant', content: data.answer });
  } catch {
    thinkEl.remove();
    addMsg('assistant', 'Sorry, I encountered an error. Please try again.');
  }
  aiThinking = false;
  const msgs = document.getElementById('chat-messages');
  msgs.scrollTop = msgs.scrollHeight;
  setTimeout(() => {
    msgs.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, 80);
}

/* ── Scroll-to-top button ────────────────────────────────────────────────── */
(function () {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 320);
  }, { passive: true });
})();

/* ── Refresh ─────────────────────────────────────────────────────────────── */
function refreshAll() { loadOverview(); }

/* ── Init ────────────────────────────────────────────────────────────────── */
async function init() {
  showLoader('Fetching data…');

  const filters = await api('/api/disasters/filters');

  // Populate filter dropdowns
  [['ov-type','ex-type'], ['ov-region','ex-region']].forEach(([aId, bId], i) => {
    const items = i === 0 ? filters.disasterTypes : filters.regions;
    [aId, bId].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const existing = sel.innerHTML;
      sel.innerHTML = existing + items.map(v => `<option value="${v}">${v}</option>`).join('');
    });
  });

  document.getElementById('ov-startYear').value = filters.minYear;
  document.getElementById('ov-endYear').value   = filters.maxYear;

  document.getElementById('loader-sub').textContent = 'Building charts…';
  await loadOverview();
  hideLoader();
}

document.addEventListener('DOMContentLoaded', init);
