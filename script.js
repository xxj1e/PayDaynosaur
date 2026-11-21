/**
 * ============================================================
 *  Expense Analyzer — script.js
 *  Modular Vanilla JavaScript for a full financial dashboard.
 *  Sections:
 *   1. Constants & Config
 *   2. State
 *   3. Data Fetching
 *   4. Filtering
 *   5. KPI Calculation
 *   6. Chart Rendering
 *   7. Table Rendering
 *   8. Insight Generation
 *   9. UI Helpers (dark mode, sidebar, export)
 *  10. Event Listeners & Init
 * ============================================================
 */

'use strict';

/* ============================================================
   1. CONSTANTS & CONFIG
   ============================================================ */

// Category color palette — consistent across all charts
const CATEGORY_COLORS = {
  Makanan:      '#F59E0B',
  Transportasi: '#3B82F6',
  Belanja:      '#8B5CF6',
  Tagihan:      '#EF4444',
  Hiburan:      '#EC4899',
  Pendidikan:   '#10B981',
  Kesehatan:    '#0EA5E9',
};

const PAYMENT_COLORS = {
  Tunai:         '#6B7280',
  Debit:         '#3B82F6',
  'E-Wallet':    '#10B981',
  'Kartu Kredit':'#8B5CF6',
};

const DAYS_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

// Rows per page for history table
const PAGE_SIZE = 15;

/* ============================================================
   2. APPLICATION STATE
   ============================================================ */
const state = {
  allTransactions: [],  // Raw data from JSON
  budget: {},           // Budget per category
  filtered: [],         // Currently filtered transactions
  sortCol: 'tanggal',
  sortDir: 'desc',
  currentPage: 1,
  searchQuery: '',
  chartInstances: {},   // Map of chart id -> Chart.js instance
};

/* ============================================================
   3. DATA FETCHING
   ============================================================ */

/**
 * Fetches expense data from expenses.json and bootstraps the app.
 */
async function fetchData() {
  try {
    const response = await fetch('expenses.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    state.allTransactions = data.transactions || [];
    state.budget = data.budget || {};

    // Set default date filter to full data range
    const dates = state.allTransactions.map(t => t.tanggal).sort();
    if (dates.length) {
      document.getElementById('filterStartDate').value = dates[0];
      document.getElementById('filterEndDate').value   = dates[dates.length - 1];
    }

    // Apply initial filter (all data)
    applyFilters();

    // Hide loading overlay after a brief moment for UX
    setTimeout(hideLoadingOverlay, 600);

  } catch (err) {
    console.error('Gagal memuat data:', err);
    showErrorMessage();
  }
}

/** Hides the loading overlay with a fade transition. */
function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('fade-out');
  overlay.style.transition = 'opacity 0.5s';
  setTimeout(() => overlay.style.display = 'none', 500);
}

/** Renders a user-friendly error message when fetch fails. */
function showErrorMessage() {
  document.getElementById('loadingOverlay').innerHTML = `
    <div class="text-center px-6">
      <div class="text-5xl mb-4">⚠️</div>
      <h2 class="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Gagal Memuat Data</h2>
      <p class="text-gray-500 dark:text-gray-400 text-sm">Pastikan file <code class="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">expenses.json</code> tersedia dan server lokal berjalan.</p>
      <p class="text-gray-400 dark:text-gray-600 text-xs mt-2">Gunakan <code class="font-mono">Live Server</code> atau server HTTP lokal untuk membuka file ini.</p>
    </div>
  `;
}

/* ============================================================
   4. FILTERING
   ============================================================ */

/** Reads filter values from DOM and returns a filter config object. */
function getFilterConfig() {
  return {
    startDate: document.getElementById('filterStartDate').value,
    endDate:   document.getElementById('filterEndDate').value,
    kategori:  document.getElementById('filterKategori').value,
    metode:    document.getElementById('filterMetode').value,
    tipe:      document.getElementById('filterTipe').value,
    search:    state.searchQuery,
  };
}

/**
 * Filters state.allTransactions based on current filter config.
 * Updates state.filtered, then triggers all UI updates.
 */
function applyFilters() {
  const f = getFilterConfig();

  state.filtered = state.allTransactions.filter(t => {
    if (f.startDate && t.tanggal < f.startDate) return false;
    if (f.endDate   && t.tanggal > f.endDate)   return false;
    if (f.kategori  && t.kategori !== f.kategori) return false;
    if (f.metode    && t.metode_pembayaran !== f.metode) return false;
    if (f.tipe      && t.tipe !== f.tipe) return false;
    if (f.search    && !t.deskripsi.toLowerCase().includes(f.search.toLowerCase())) return false;
    return true;
  });

  state.currentPage = 1;
  updateDateRangeDisplay();
  renderKPIs();
  renderAllCharts();
  renderTop10Table();
  renderHistoryTable();
  renderInsights();
}

/** Resets all filters to defaults and re-applies. */
function resetFilters() {
  const dates = state.allTransactions.map(t => t.tanggal).sort();
  document.getElementById('filterStartDate').value = dates[0]  || '';
  document.getElementById('filterEndDate').value   = dates[dates.length - 1] || '';
  document.getElementById('filterKategori').value  = '';
  document.getElementById('filterMetode').value    = '';
  document.getElementById('filterTipe').value      = '';
  document.getElementById('searchInput').value     = '';
  state.searchQuery = '';
  applyFilters();
}

/** Updates the header date range display label. */
function updateDateRangeDisplay() {
  const f = getFilterConfig();
  const start = f.startDate ? formatDate(f.startDate) : '—';
  const end   = f.endDate   ? formatDate(f.endDate)   : '—';
  document.getElementById('dateRangeDisplay').textContent = `${start} — ${end}`;
}

/* ============================================================
   5. KPI CALCULATION & RENDERING
   ============================================================ */

/** Computes and renders all 5 KPI cards from state.filtered. */
function renderKPIs() {
  const txs = state.filtered;

  // --- KPI 1: Total Pengeluaran ---
  const total = txs.reduce((s, t) => s + t.nominal, 0);
  document.getElementById('kpiTotal').textContent   = formatRupiah(total);
  document.getElementById('kpiTotalSub').textContent = `dari ${txs.length} transaksi`;

  // --- KPI 2: Jumlah Transaksi ---
  document.getElementById('kpiCount').textContent = txs.length.toLocaleString('id-ID');

  // --- KPI 3: Rata-rata per Hari ---
  const uniqueDays = new Set(txs.map(t => t.tanggal)).size || 1;
  document.getElementById('kpiAvg').textContent = formatRupiah(total / uniqueDays);

  // --- KPI 4: Kategori Terbesar ---
  const catTotals = groupSum(txs, 'kategori');
  const topCat    = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    document.getElementById('kpiTopCat').textContent    = topCat[0];
    document.getElementById('kpiTopCatSub').textContent = formatRupiah(topCat[1]);
  } else {
    document.getElementById('kpiTopCat').textContent    = '—';
    document.getElementById('kpiTopCatSub').textContent = '';
  }

  // --- KPI 5: Sisa Anggaran (total budget - total spent) ---
  const totalBudget = Object.values(state.budget).reduce((s, v) => s + v, 0);
  const remaining   = totalBudget - total;
  const pct         = totalBudget > 0 ? Math.min(100, Math.round((total / totalBudget) * 100)) : 0;

  document.getElementById('kpiBudgetLeft').textContent = formatRupiah(remaining);
  document.getElementById('kpiBudgetPct').textContent  = `${pct}% anggaran terpakai`;

  const bar   = document.getElementById('kpiBudgetBar');
  bar.style.width = pct + '%';
  bar.className   = `h-1.5 rounded-full transition-all duration-700 ${
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-teal-500'
  }`;

  // Remove skeleton class once data is loaded
  ['kpiTotal','kpiCount','kpiAvg','kpiTopCat','kpiBudgetLeft'].forEach(id => {
    document.getElementById(id).classList.remove('skeleton-box');
  });
}

/* ============================================================
   6. CHART RENDERING
   ============================================================ */

/**
 * Returns Chart.js default options for a consistent look.
 * Adapts colors based on current dark-mode state.
 */
function getChartDefaults() {
  const dark = document.documentElement.classList.contains('dark');
  return {
    textColor:    dark ? '#9ca3af' : '#6b7280',
    gridColor:    dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    bgPlugin:     dark ? '#111827' : '#ffffff',
  };
}

/**
 * Destroys an existing Chart instance by canvas id and creates a new one.
 * @param {string} id  - canvas element id
 * @param {object} cfg - Chart.js config object
 */
function createOrUpdateChart(id, cfg) {
  if (state.chartInstances[id]) {
    state.chartInstances[id].destroy();
  }
  const ctx = document.getElementById(id);
  if (!ctx) return;
  state.chartInstances[id] = new Chart(ctx.getContext('2d'), cfg);
}

/** Renders all 7 charts from state.filtered. */
function renderAllCharts() {
  renderChartDaily();
  renderChartCategory();
  renderChartBudget();
  renderChartPayment();
  renderChartWeekday();
  renderChartNeedWant();
  renderChartAccumulated();
}

/* ---- 6a. Tren Pengeluaran Harian (Line) ---- */
function renderChartDaily() {
  const { textColor, gridColor } = getChartDefaults();
  const txs = state.filtered;

  // Group by date
  const byDate = {};
  txs.forEach(t => {
    byDate[t.tanggal] = (byDate[t.tanggal] || 0) + t.nominal;
  });
  const labels = Object.keys(byDate).sort();
  const data   = labels.map(d => byDate[d]);

  createOrUpdateChart('chartDaily', {
    type: 'line',
    data: {
      labels: labels.map(d => formatDateShort(d)),
      datasets: [{
        label: 'Pengeluaran (Rp)',
        data,
        borderColor: '#0A7C6E',
        backgroundColor: 'rgba(10,124,110,0.08)',
        borderWidth: 2,
        pointRadius: data.length <= 31 ? 3 : 0,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatRupiah(ctx.raw) }}},
      scales: {
        x: { ticks: { color: textColor, maxTicksLimit: 10, maxRotation: 45 }, grid: { color: gridColor }},
        y: { ticks: { color: textColor, callback: v => shortRupiah(v) }, grid: { color: gridColor }},
      }
    }
  });
}

/* ---- 6b. Pengeluaran per Kategori (Doughnut) ---- */
function renderChartCategory() {
  const catTotals = groupSum(state.filtered, 'kategori');
  const labels    = Object.keys(catTotals);
  const data      = Object.values(catTotals);
  const colors    = labels.map(l => CATEGORY_COLORS[l] || '#ccc');
  const { textColor } = getChartDefaults();

  createOrUpdateChart('chartCategory', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'transparent' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { color: textColor, padding: 10, boxWidth: 12, font: { size: 11 }}},
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatRupiah(ctx.raw)}` }}
      }
    }
  });
}

/* ---- 6c. Budget vs Realisasi (Grouped Bar) ---- */
function renderChartBudget() {
  const { textColor, gridColor } = getChartDefaults();
  const categories = Object.keys(state.budget);
  const catTotals  = groupSum(state.filtered, 'kategori');
  const budgetVals = categories.map(c => state.budget[c] || 0);
  const realVals   = categories.map(c => catTotals[c]    || 0);

  createOrUpdateChart('chartBudget', {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [
        { label: 'Anggaran', data: budgetVals, backgroundColor: 'rgba(10,124,110,0.25)', borderColor: '#0A7C6E', borderWidth: 2, borderRadius: 4 },
        { label: 'Realisasi', data: realVals, backgroundColor: categories.map(c => CATEGORY_COLORS[c] || '#ccc'), borderWidth: 0, borderRadius: 4 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { size: 11 }}},
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}` }}
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { display: false }},
        y: { ticks: { color: textColor, callback: v => shortRupiah(v) }, grid: { color: gridColor }},
      }
    }
  });
}

/* ---- 6d. Metode Pembayaran (Pie) ---- */
function renderChartPayment() {
  const payTotals = groupSum(state.filtered, 'metode_pembayaran');
  const labels    = Object.keys(payTotals);
  const data      = Object.values(payTotals);
  const colors    = labels.map(l => PAYMENT_COLORS[l] || '#ccc');
  const { textColor } = getChartDefaults();

  createOrUpdateChart('chartPayment', {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'transparent' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, padding: 10, boxWidth: 12, font: { size: 11 }}},
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatRupiah(ctx.raw)}` }}
      }
    }
  });
}

/* ---- 6e. Pola Pengeluaran per Hari Seminggu (Bar) ---- */
function renderChartWeekday() {
  const { textColor, gridColor } = getChartDefaults();
  const dayTotals = Array(7).fill(0);
  state.filtered.forEach(t => {
    // Parse as local date to avoid UTC timezone offset shifting the day
    const [ty, tm, td] = t.tanggal.split('-').map(Number);
    const dow = new Date(ty, tm - 1, td).getDay(); // 0=Sun
    dayTotals[dow] += t.nominal;
  });

  createOrUpdateChart('chartWeekday', {
    type: 'bar',
    data: {
      labels: DAYS_ID,
      datasets: [{
        label: 'Total (Rp)',
        data: dayTotals,
        backgroundColor: DAYS_ID.map((_, i) => i === 0 || i === 6 ? '#F59E0B' : '#0A7C6E'),
        borderRadius: 6,
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatRupiah(ctx.raw)}` }}
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { display: false }},
        y: { ticks: { color: textColor, callback: v => shortRupiah(v) }, grid: { color: gridColor }},
      }
    }
  });
}

/* ---- 6f. Kebutuhan vs Keinginan per Bulan (Stacked Bar) ---- */
function renderChartNeedWant() {
  const { textColor, gridColor } = getChartDefaults();

  // Group by month
  const months = {};
  state.filtered.forEach(t => {
    const m = t.tanggal.slice(0, 7); // YYYY-MM
    if (!months[m]) months[m] = { Kebutuhan: 0, Keinginan: 0 };
    months[m][t.tipe] += t.nominal;
  });
  const sortedMonths = Object.keys(months).sort();
  const kebutuhan = sortedMonths.map(m => months[m].Kebutuhan);
  const keinginan = sortedMonths.map(m => months[m].Keinginan);

  createOrUpdateChart('chartNeedWant', {
    type: 'bar',
    data: {
      labels: sortedMonths.map(m => formatMonthLabel(m)),
      datasets: [
        { label: 'Kebutuhan', data: kebutuhan, backgroundColor: '#10B981', borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 6, bottomRight: 6 }, stack: 'nw' },
        { label: 'Keinginan', data: keinginan, backgroundColor: '#EC4899', borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 }, stack: 'nw' },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { size: 11 }}},
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}` }}
      },
      scales: {
        x: { stacked: true, ticks: { color: textColor }, grid: { display: false }},
        y: { stacked: true, ticks: { color: textColor, callback: v => shortRupiah(v) }, grid: { color: gridColor }},
      }
    }
  });
}

/* ---- 6g. Akumulasi Pengeluaran Bulan Ini vs Batas Anggaran (Line) ---- */
function renderChartAccumulated() {
  const { textColor, gridColor } = getChartDefaults();

  // Get current month from the latest filtered transaction or today
  const today = new Date().toISOString().slice(0, 10);
  const latestDate = state.filtered.map(t => t.tanggal).sort().pop() || today;
  const currentMonth = latestDate.slice(0, 7);

  // Filter to current month only
  const thisMonthTxs = state.filtered.filter(t => t.tanggal.startsWith(currentMonth));

  // Sort by date and accumulate
  const byDate = {};
  thisMonthTxs.forEach(t => {
    byDate[t.tanggal] = (byDate[t.tanggal] || 0) + t.nominal;
  });
  const sortedDates = Object.keys(byDate).sort();
  let acc = 0;
  const accData = sortedDates.map(d => { acc += byDate[d]; return acc; });

  // Total budget line (flat)
  const totalBudget = Object.values(state.budget).reduce((s, v) => s + v, 0);
  const budgetLine  = sortedDates.map(() => totalBudget);

  createOrUpdateChart('chartAccumulated', {
    type: 'line',
    data: {
      labels: sortedDates.map(d => formatDateShort(d)),
      datasets: [
        {
          label: 'Akumulasi Pengeluaran',
          data: accData,
          borderColor: '#0A7C6E',
          backgroundColor: 'rgba(10,124,110,0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: 'Batas Anggaran',
          data: budgetLine,
          borderColor: '#EF4444',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { size: 11 }}},
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}` }}
      },
      scales: {
        x: { ticks: { color: textColor, maxTicksLimit: 15 }, grid: { color: gridColor }},
        y: { ticks: { color: textColor, callback: v => shortRupiah(v) }, grid: { color: gridColor }},
      }
    }
  });
}

/* ============================================================
   7. TABLE RENDERING
   ============================================================ */

/** Renders the Top 10 largest transactions table. */
function renderTop10Table() {
  const top10 = [...state.filtered]
    .sort((a, b) => b.nominal - a.nominal)
    .slice(0, 10);

  const tbody = document.getElementById('top10TableBody');
  if (!top10.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-400 text-sm">Tidak ada data.</td></tr>`;
    return;
  }

  tbody.innerHTML = top10.map((t, i) => `
    <tr class="border-b border-gray-100 dark:border-gray-800">
      <td class="py-2.5 px-3 text-gray-400 font-medium">${i + 1}</td>
      <td class="py-2.5 px-3 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">${formatDate(t.tanggal)}</td>
      <td class="py-2.5 px-3 text-gray-800 dark:text-gray-200 max-w-[200px] truncate">${escapeHtml(t.deskripsi)}</td>
      <td class="py-2.5 px-3"><span class="badge badge-${t.kategori}">${t.kategori}</span></td>
      <td class="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">${formatRupiah(t.nominal)}</td>
    </tr>
  `).join('');
}

/**
 * Renders the history table with search, sort, and pagination.
 * Uses state.filtered, state.sortCol, state.sortDir, state.currentPage.
 */
function renderHistoryTable() {
  // 1. Apply search
  const q = state.searchQuery.toLowerCase();
  let data = q
    ? state.filtered.filter(t => t.deskripsi.toLowerCase().includes(q))
    : [...state.filtered];

  // 2. Sort
  data.sort((a, b) => {
    let va = a[state.sortCol];
    let vb = b[state.sortCol];
    if (typeof va === 'number') {
      return state.sortDir === 'asc' ? va - vb : vb - va;
    }
    va = String(va || '').toLowerCase();
    vb = String(vb || '').toLowerCase();
    if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
    if (va > vb) return state.sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  // 3. Paginate
  const total  = data.length;
  const pages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  state.currentPage = Math.min(state.currentPage, pages);
  const start  = (state.currentPage - 1) * PAGE_SIZE;
  const slice  = data.slice(start, start + PAGE_SIZE);

  // 4. Update table count & pagination
  document.getElementById('tableCount').textContent = `${total.toLocaleString('id-ID')} transaksi`;
  document.getElementById('pageIndicator').textContent = `Hal ${state.currentPage} / ${pages}`;
  document.getElementById('prevPage').disabled = state.currentPage <= 1;
  document.getElementById('nextPage').disabled = state.currentPage >= pages;

  // 5. Show empty state
  const emptyDiv = document.getElementById('tableEmpty');
  if (!slice.length) {
    document.getElementById('historyTableBody').innerHTML = '';
    emptyDiv.classList.remove('hidden');
    return;
  }
  emptyDiv.classList.add('hidden');

  // 6. Render rows
  const methodBadgeClass = m => `badge-${m.replace(' ', '')}`;
  document.getElementById('historyTableBody').innerHTML = slice.map(t => `
    <tr class="border-b border-gray-100 dark:border-gray-800">
      <td class="py-2.5 px-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">${formatDate(t.tanggal)}</td>
      <td class="py-2.5 px-3 text-gray-800 dark:text-gray-200 max-w-[200px] truncate" title="${escapeHtml(t.deskripsi)}">${escapeHtml(t.deskripsi)}</td>
      <td class="py-2.5 px-3"><span class="badge badge-${t.kategori}">${t.kategori}</span></td>
      <td class="py-2.5 px-3"><span class="badge ${methodBadgeClass(t.metode_pembayaran)}">${t.metode_pembayaran}</span></td>
      <td class="py-2.5 px-3"><span class="badge badge-${t.tipe}">${t.tipe}</span></td>
      <td class="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">${formatRupiah(t.nominal)}</td>
    </tr>
  `).join('');

  // 7. Update sort header icons
  document.querySelectorAll('.sortable').forEach(th => {
    const col = th.dataset.col;
    const icon = th.querySelector('.sort-icon');
    th.classList.remove('asc', 'desc');
    icon.textContent = '↕';
    if (col === state.sortCol) {
      th.classList.add(state.sortDir);
      icon.textContent = state.sortDir === 'asc' ? '↑' : '↓';
    }
  });
}

/* ============================================================
   8. INSIGHT GENERATION
   ============================================================ */

/**
 * Generates automatic insights comparing filtered data to previous period.
 * Renders insight cards with status icons.
 */
function renderInsights() {
  const container = document.getElementById('insightList');
  const insights  = computeInsights();
  
  if (!insights.length) {
    container.innerHTML = `<p class="text-gray-400 text-sm col-span-3">Tidak cukup data untuk menghasilkan insight.</p>`;
    return;
  }

  container.innerHTML = insights.map(ins => `
    <div class="insight-${ins.status} rounded-xl p-4 flex items-start gap-3">
      <span class="text-xl flex-shrink-0 mt-0.5">${statusIcon(ins.status)}</span>
      <div>
        <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">${ins.title}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${ins.detail}</p>
      </div>
    </div>
  `).join('');
}

/** Returns the emoji icon for a given insight status. */
function statusIcon(status) {
  return { safe: '✅', warning: '⚠️', danger: '🚨' }[status] || '💡';
}

/**
 * Computes a list of insight objects from state.filtered and state.allTransactions.
 * @returns {Array<{title, detail, status}>}
 */
function computeInsights() {
  const insights = [];
  const txs      = state.filtered;
  if (!txs.length) return insights;

  // Helper: transactions by month
  const byMonth = {};
  state.allTransactions.forEach(t => {
    const m = t.tanggal.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(t);
  });
  const sortedMonths = Object.keys(byMonth).sort();
  const latestMonth  = sortedMonths[sortedMonths.length - 1];
  const prevMonth    = sortedMonths[sortedMonths.length - 2];

  // 1. Category budget utilisation
  const catTotals   = groupSum(txs, 'kategori');
  const latestTxs   = byMonth[latestMonth] || [];
  const latestCatT  = groupSum(latestTxs, 'kategori');

  Object.entries(state.budget).forEach(([cat, budget]) => {
    const spent = latestCatT[cat] || 0;
    const pct   = budget > 0 ? Math.round((spent / budget) * 100) : 0;
    if (pct >= 100) {
      insights.push({
        title: `Anggaran ${cat} Melebihi Batas`,
        detail: `Terpakai ${formatRupiah(spent)} dari anggaran ${formatRupiah(budget)} (${pct}%).`,
        status: 'danger',
      });
    } else if (pct >= 80) {
      insights.push({
        title: `Anggaran ${cat} Hampir Habis`,
        detail: `Sudah terpakai ${pct}% — ${formatRupiah(budget - spent)} tersisa.`,
        status: 'warning',
      });
    } else if (pct > 0) {
      insights.push({
        title: `Anggaran ${cat} Aman`,
        detail: `Baru terpakai ${pct}% dari ${formatRupiah(budget)}.`,
        status: 'safe',
      });
    }
  });

  // 2. Month-over-month category comparison
  if (prevMonth && latestMonth) {
    const prevCatT = groupSum(byMonth[prevMonth] || [], 'kategori');
    Object.keys(latestCatT).forEach(cat => {
      const curr = latestCatT[cat] || 0;
      const prev = prevCatT[cat]   || 0;
      if (prev > 0 && curr > 0) {
        const change = Math.round(((curr - prev) / prev) * 100);
        if (Math.abs(change) >= 15) {
          insights.push({
            title: `Pengeluaran ${cat} ${change > 0 ? 'Naik' : 'Turun'} ${Math.abs(change)}%`,
            detail: `${formatMonthLabel(prevMonth)}: ${formatRupiah(prev)} → ${formatMonthLabel(latestMonth)}: ${formatRupiah(curr)}.`,
            status: change >= 30 ? 'danger' : change > 0 ? 'warning' : 'safe',
          });
        }
      }
    });
  }

  // 3. Needs vs wants ratio
  const kebutuhan = txs.filter(t => t.tipe === 'Kebutuhan').reduce((s, t) => s + t.nominal, 0);
  const keinginan = txs.filter(t => t.tipe === 'Keinginan').reduce((s, t) => s + t.nominal, 0);
  const total     = kebutuhan + keinginan;
  if (total > 0) {
    const wantPct = Math.round((keinginan / total) * 100);
    insights.push({
      title: `Rasio Keinginan: ${wantPct}%`,
      detail: `Pengeluaran Keinginan ${formatRupiah(keinginan)} dari total ${formatRupiah(total)}.`,
      status: wantPct >= 50 ? 'danger' : wantPct >= 35 ? 'warning' : 'safe',
    });
  }

  // 4. Highest single transaction
  const maxTx = [...txs].sort((a, b) => b.nominal - a.nominal)[0];
  if (maxTx) {
    insights.push({
      title: 'Transaksi Terbesar',
      detail: `${escapeHtml(maxTx.deskripsi)} pada ${formatDate(maxTx.tanggal)} — ${formatRupiah(maxTx.nominal)}.`,
      status: 'warning',
    });
  }

  // 5. Most active day
  const dayCount = {};
  txs.forEach(t => { dayCount[t.tanggal] = (dayCount[t.tanggal] || 0) + 1; });
  const mostActiveDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];
  if (mostActiveDay) {
    insights.push({
      title: 'Hari Paling Aktif',
      detail: `${formatDate(mostActiveDay[0])} dengan ${mostActiveDay[1]} transaksi.`,
      status: 'safe',
    });
  }

  return insights.slice(0, 9); // Limit to 9 insight cards
}

/* ============================================================
   9. UI HELPERS
   ============================================================ */

/** Toggles dark mode and persists preference in localStorage. */
function toggleDarkMode() {
  const html = document.documentElement;
  html.classList.toggle('dark');
  localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
  // Re-render charts to update colors
  renderAllCharts();
}

/** Applies saved theme on page load. */
function applySavedTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
}

/** Toggles sidebar collapsed state on desktop. */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('sidebar-collapsed');
}

/** Opens/closes mobile sidebar. */
function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const isOpen  = sidebar.classList.contains('sidebar-open');
  sidebar.classList.toggle('sidebar-open', !isOpen);
  overlay.classList.toggle('hidden', isOpen);
}

/**
 * Exports currently filtered transactions as a CSV file download.
 */
function exportCSV() {
  const headers = ['ID','Tanggal','Deskripsi','Kategori','Metode Pembayaran','Tipe','Nominal'];
  const rows    = state.filtered.map(t => [
    t.id,
    t.tanggal,
    `"${t.deskripsi.replace(/"/g, '""')}"`,
    t.kategori,
    t.metode_pembayaran,
    t.tipe,
    t.nominal,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob   = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url    = URL.createObjectURL(blob);
  const link   = document.createElement('a');
  link.href    = url;
  link.download = `expense-analyzer-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

/**
 * Groups transactions and sums nominal by a given field key.
 * @param {Array} txs
 * @param {string} key - field name to group by
 * @returns {Object} key -> sum
 */
function groupSum(txs, key) {
  return txs.reduce((acc, t) => {
    acc[t[key]] = (acc[t[key]] || 0) + t.nominal;
    return acc;
  }, {});
}

/** Formats a number as Indonesian Rupiah. */
function formatRupiah(val) {
  return 'Rp\u00A0' + Math.round(val).toLocaleString('id-ID');
}

/** Short Rupiah for chart axis labels (e.g. 1.5jt). */
function shortRupiah(val) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}jt`;
  if (val >= 1_000)     return `${(val / 1_000).toFixed(0)}rb`;
  return String(val);
}

/** Formats YYYY-MM-DD to DD MMM YYYY (Indonesian). */
function formatDate(dateStr) {
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

/** Short date for chart labels: DD/MM. */
function formatDateShort(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

/** Formats YYYY-MM to "MMM YYYY". */
function formatMonthLabel(ym) {
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const [y, m] = ym.split('-');
  return `${months[parseInt(m) - 1]} ${y}`;
}

/** Basic HTML escape to prevent XSS in table rendering. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   10. MANUAL EXPENSE INPUT
   ============================================================ */

/**
 * Scrolls to the input form section and focuses the date field.
 * Called by the "+ Tambah" header button and sidebar link.
 */
function scrollToInputForm() {
  const section = document.getElementById('inputForm');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Brief delay to let scroll finish before focusing
  setTimeout(() => document.getElementById('inputTanggal').focus(), 350);
}

/**
 * Validates all fields in the add-expense form.
 * Shows/hides inline error messages.
 * @returns {boolean} true if the form is valid
 */
function validateExpenseForm() {
  let valid = true;

  // Helper: show or hide a field's error message
  const setError = (id, show) => {
    const el = document.getElementById(id);
    el.classList.toggle('hidden', !show);
    if (show) valid = false;
  };

  const tanggal  = document.getElementById('inputTanggal').value.trim();
  const deskripsi = document.getElementById('inputDeskripsi').value.trim();
  const nominal  = parseFloat(document.getElementById('inputNominal').value);
  const kategori = document.getElementById('inputKategori').value;
  const metode   = document.getElementById('inputMetode').value;
  const tipe     = document.querySelector('input[name="tipe"]:checked');

  setError('errTanggal',  !tanggal);
  setError('errDeskripsi', !deskripsi);
  setError('errNominal',   isNaN(nominal) || nominal <= 0);
  setError('errKategori',  !kategori);
  setError('errMetode',    !metode);
  setError('errTipe',      !tipe);

  return valid;
}

/**
 * Handles form submission: validates, creates a new transaction object,
 * pushes it into state.allTransactions, re-applies filters, and refreshes UI.
 * @param {Event} e - submit event
 */
function handleExpenseSubmit(e) {
  e.preventDefault();

  if (!validateExpenseForm()) return;

  // Build the new transaction
  const newId = state.allTransactions.length
    ? Math.max(...state.allTransactions.map(t => t.id)) + 1
    : 1;

  const newTx = {
    id:                newId,
    tanggal:           document.getElementById('inputTanggal').value,
    deskripsi:         document.getElementById('inputDeskripsi').value.trim(),
    nominal:           parseFloat(document.getElementById('inputNominal').value),
    kategori:          document.getElementById('inputKategori').value,
    metode_pembayaran: document.getElementById('inputMetode').value,
    tipe:              document.querySelector('input[name="tipe"]:checked').value,
  };

  // Add to in-memory dataset
  state.allTransactions.push(newTx);

  // Update date filter bounds to include the new date if outside range
  const startInput = document.getElementById('filterStartDate');
  const endInput   = document.getElementById('filterEndDate');
  if (!startInput.value || newTx.tanggal < startInput.value) startInput.value = newTx.tanggal;
  if (!endInput.value   || newTx.tanggal > endInput.value)   endInput.value   = newTx.tanggal;

  // Re-apply filters and refresh all UI
  applyFilters();

  // Clear the form
  clearExpenseForm();

  // Show success badge for 3 seconds
  const badge = document.getElementById('formSuccessBadge');
  badge.classList.remove('hidden');
  badge.classList.add('inline-flex');
  setTimeout(() => {
    badge.classList.add('hidden');
    badge.classList.remove('inline-flex');
  }, 3000);
}

/** Resets all input form fields and clears validation errors. */
function clearExpenseForm() {
  document.getElementById('addExpenseForm').reset();
  ['errTanggal','errDeskripsi','errNominal','errKategori','errMetode','errTipe'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  // Reset invalid border styling on inputs
  document.querySelectorAll('#addExpenseForm .form-input').forEach(el => {
    el.classList.remove('border-red-400');
  });
}

/** Pre-fills the date field with today's date when the form section is loaded. */
function prefillTodayDate() {
  const dateInput = document.getElementById('inputTanggal');
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
}

/* ============================================================
   11. EVENT LISTENERS & INITIALIZATION
   ============================================================ */

function initEventListeners() {
  // Filter apply & reset
  document.getElementById('applyFilter').addEventListener('click', applyFilters);
  document.getElementById('resetFilter').addEventListener('click', resetFilters);

  // Also apply on Enter keypress in any filter field
  document.querySelectorAll('.filter-input').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') applyFilters(); });
  });

  // Search input (live)
  document.getElementById('searchInput').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    state.currentPage = 1;
    renderHistoryTable();
  });

  // Dark mode toggle
  document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

  // Sidebar toggles
  document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
  document.getElementById('mobileSidebarToggle').addEventListener('click', toggleMobileSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', toggleMobileSidebar);

  // Export CSV
  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);

  // --- Add Expense shortcuts ---
  document.getElementById('headerAddBtn').addEventListener('click', scrollToInputForm);
  document.getElementById('sidebarAddBtn').addEventListener('click', scrollToInputForm);

  // Form submit & clear
  document.getElementById('addExpenseForm').addEventListener('submit', handleExpenseSubmit);
  document.getElementById('clearFormBtn').addEventListener('click', clearExpenseForm);

  // Live clear errors as user fixes fields
  document.getElementById('inputTanggal').addEventListener('change', () =>
    document.getElementById('errTanggal').classList.add('hidden'));
  document.getElementById('inputDeskripsi').addEventListener('input', () =>
    document.getElementById('errDeskripsi').classList.add('hidden'));
  document.getElementById('inputNominal').addEventListener('input', () =>
    document.getElementById('errNominal').classList.add('hidden'));
  document.getElementById('inputKategori').addEventListener('change', () =>
    document.getElementById('errKategori').classList.add('hidden'));
  document.getElementById('inputMetode').addEventListener('change', () =>
    document.getElementById('errMetode').classList.add('hidden'));
  document.querySelectorAll('input[name="tipe"]').forEach(r =>
    r.addEventListener('change', () => document.getElementById('errTipe').classList.add('hidden')));

  // Table column sorting
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sortCol === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortCol = col;
        state.sortDir = 'asc';
      }
      renderHistoryTable();
    });
  });

  // Pagination
  document.getElementById('prevPage').addEventListener('click', () => {
    if (state.currentPage > 1) { state.currentPage--; renderHistoryTable(); }
  });
  document.getElementById('nextPage').addEventListener('click', () => {
    state.currentPage++;
    renderHistoryTable();
  });
}

/** Entry point — applies theme, sets up events, fetches data. */
function init() {
  applySavedTheme();
  prefillTodayDate();
  initEventListeners();
  fetchData();
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
