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
  editingId: null,      // ID of transaction being edited
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

    // Set default date filter to current month (1st to last day of this month)
    const now      = new Date();
    const y        = now.getFullYear();
    const m        = now.getMonth(); // 0-based
    const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDate = new Date(y, m + 1, 0); // last day of current month
    const lastDay  = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`;

    document.getElementById('filterStartDate').value = firstDay;
    document.getElementById('filterEndDate').value   = lastDay;

    // Refresh datepicker button labels after setting values
    ['filterStartDate','filterEndDate'].forEach(id =>
      document.getElementById(id).dispatchEvent(new Event('dp-refresh'))
    );

    // Load budget from localStorage (overrides JSON default if user has saved custom values)
    loadBudgetFromStorage();

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
}

/** Resets all filters to defaults (current month) and re-applies. */
function resetFilters() {
  const now      = new Date();
  const y        = now.getFullYear();
  const m        = now.getMonth();
  const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDate = new Date(y, m + 1, 0);
  const lastDay  = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`;

  document.getElementById('filterStartDate').value = firstDay;
  document.getElementById('filterEndDate').value   = lastDay;
  document.getElementById('filterKategori').value  = '';
  document.getElementById('filterMetode').value    = '';
  document.getElementById('filterTipe').value      = '';
  document.getElementById('searchInput').value     = '';
  state.searchQuery = '';
  // Notify custom datepicker buttons to refresh their labels
  ['filterStartDate','filterEndDate'].forEach(id =>
    document.getElementById(id).dispatchEvent(new Event('dp-refresh'))
  );
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

  // Update budget alert badge (count categories over 100% usage)
  updateBudgetAlertBadge(txs);
}

/**
 * Updates the red badge on the Anggaran button showing how many categories
 * have exceeded their budget based on the filtered transactions.
 * @param {Array} txs - filtered transactions
 */
function updateBudgetAlertBadge() {
  // Badge dinonaktifkan sesuai permintaan pengguna
  const badge = document.getElementById('budgetAlertBadge');
  if (badge) badge.classList.add('hidden');
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
    <tr class="table-row-hover border-b border-gray-100 dark:border-gray-800 group">
      <td class="py-2.5 px-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">${formatDate(t.tanggal)}</td>
      <td class="py-2.5 px-3 text-gray-800 dark:text-gray-200 max-w-[200px] truncate" title="${escapeHtml(t.deskripsi)}">${escapeHtml(t.deskripsi)}</td>
      <td class="py-2.5 px-3"><span class="badge badge-${t.kategori}">${t.kategori}</span></td>
      <td class="py-2.5 px-3"><span class="badge ${methodBadgeClass(t.metode_pembayaran)}">${t.metode_pembayaran}</span></td>
      <td class="py-2.5 px-3"><span class="badge badge-${t.tipe}">${t.tipe}</span></td>
      <td class="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">${formatRupiah(t.nominal)}</td>
      <td class="py-2.5 px-3 text-center">
        <div class="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button class="action-edit-btn w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-900/40 hover:bg-teal-100 dark:hover:bg-teal-900/70 text-teal-600 dark:text-teal-400 flex items-center justify-center transition-colors" data-id="${t.id}" aria-label="Edit transaksi ${escapeHtml(t.deskripsi)}" title="Edit">
            <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="action-delete-btn w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-500 dark:text-red-400 flex items-center justify-center transition-colors" data-id="${t.id}" aria-label="Hapus transaksi ${escapeHtml(t.deskripsi)}" title="Hapus">
            <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
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
   7b. EDIT & DELETE TRANSACTION
   ============================================================ */

/**
 * Opens the edit modal pre-filled with the transaction data for the given id.
 * @param {number} id - transaction id
 */
function openEditModal(id) {
  const tx = state.allTransactions.find(t => t.id === id);
  if (!tx) return;

  state.editingId = id;

  // Pre-fill form fields
  document.getElementById('editTanggal').value  = tx.tanggal;
  document.getElementById('editDeskripsi').value = tx.deskripsi;
  document.getElementById('editNominal').value   = tx.nominal;
  document.getElementById('editKategori').value  = tx.kategori;
  document.getElementById('editMetode').value    = tx.metode_pembayaran;

  const tipeRadio = document.querySelector(`input[name="editTipe"][value="${tx.tipe}"]`);
  if (tipeRadio) tipeRadio.checked = true;

  // Clear any previous errors
  ['editErrTanggal','editErrDeskripsi','editErrNominal','editErrKategori','editErrMetode','editErrTipe'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });

  const modal = document.getElementById('editModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('editDeskripsi').focus(), 100);
}

/** Closes the edit modal. */
function closeEditModal() {
  const modal = document.getElementById('editModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
  state.editingId = null;
}

/** Validates and saves changes from the edit modal. */
function saveEditModal() {
  const tanggal   = document.getElementById('editTanggal').value.trim();
  const deskripsi = document.getElementById('editDeskripsi').value.trim();
  const nominal   = parseFloat(document.getElementById('editNominal').value);
  const kategori  = document.getElementById('editKategori').value;
  const metode    = document.getElementById('editMetode').value;
  const tipeEl    = document.querySelector('input[name="editTipe"]:checked');

  let valid = true;
  const setErr = (id, show) => { document.getElementById(id).classList.toggle('hidden', !show); if (show) valid = false; };
  setErr('editErrTanggal',  !tanggal);
  setErr('editErrDeskripsi', !deskripsi);
  setErr('editErrNominal',   isNaN(nominal) || nominal <= 0);
  setErr('editErrKategori',  !kategori);
  setErr('editErrMetode',    !metode);
  setErr('editErrTipe',      !tipeEl);
  if (!valid) return;

  // Update the transaction in state
  const idx = state.allTransactions.findIndex(t => t.id === state.editingId);
  if (idx === -1) return;
  state.allTransactions[idx] = {
    ...state.allTransactions[idx],
    tanggal,
    deskripsi,
    nominal,
    kategori,
    metode_pembayaran: metode,
    tipe: tipeEl.value,
  };

  closeEditModal();
  applyFilters();
  showToast('Transaksi berhasil diperbarui', 'success');
}

/**
 * Shows a custom confirm dialog and resolves a Promise<boolean>.
 * @param {string} message - message to display
 * @returns {Promise<boolean>}
 */
function showConfirm(message) {
  return new Promise(resolve => {
    const dialog  = document.getElementById('confirmDialog');
    const msgEl   = document.getElementById('confirmMessage');
    const okBtn   = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    msgEl.textContent = message;
    dialog.classList.remove('hidden');
    dialog.classList.add('flex');
    document.body.style.overflow = 'hidden';
    okBtn.focus();

    function cleanup(result) {
      dialog.classList.add('hidden');
      dialog.classList.remove('flex');
      document.body.style.overflow = '';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    }
    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click', onOk, { once: true });
    cancelBtn.addEventListener('click', onCancel, { once: true });
  });
}

/**
 * Prompts the user to confirm, then deletes the transaction.
 * @param {number} id - transaction id to delete
 */
async function deleteTransaction(id) {
  const tx = state.allTransactions.find(t => t.id === id);
  if (!tx) return;

  const confirmed = await showConfirm(`Hapus "${tx.deskripsi}" sebesar ${formatRupiah(tx.nominal)}?`);
  if (!confirmed) return;

  state.allTransactions = state.allTransactions.filter(t => t.id !== id);
  applyFilters();
  showToast('Transaksi berhasil dihapus', 'danger');
}

/* ============================================================
   8. INSIGHT GENERATION
   ============================================================ */

/**
 * Generates automatic insights comparing filtered data to previous period.
 * Renders insight cards with status icons.
 */
/* ============================================================
   9. BUDGET MANAGER
   ============================================================ */

const BUDGET_STORAGE_KEY = 'paydaynosaur_budget';

/** Default budget loaded from expenses.json — stored separately so we can reset to it. */
let defaultBudget = {};

/**
 * Loads budget from localStorage if available, otherwise uses the JSON default.
 * Called once after fetchData sets state.budget from JSON.
 */
function loadBudgetFromStorage() {
  const saved = localStorage.getItem(BUDGET_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Merge: keep any categories from JSON that aren't saved yet
      state.budget = { ...state.budget, ...parsed };
    } catch (e) { /* ignore corrupt storage */ }
  }
  defaultBudget = { ...state.budget };
}

/**
 * Persists current state.budget to localStorage.
 */
function saveBudgetToStorage() {
  localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(state.budget));
}

/**
 * Opens the budget edit modal, rendering one input row per category.
 */
function openBudgetModal() {
  const modal = document.getElementById('budgetModal');
  const list  = document.getElementById('budgetInputList');

  // Build input rows
  list.innerHTML = Object.entries(state.budget).map(([cat, val]) => `
    <div class="flex items-center gap-3">
      <span class="badge badge-${cat} flex-shrink-0 w-28 justify-center text-center">${cat}</span>
      <div class="relative flex-1">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium pointer-events-none">Rp</span>
        <input
          type="number"
          id="budgetInput_${cat}"
          value="${val}"
          min="0"
          step="10000"
          class="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2
                 focus:ring-teal-400 dark:focus:ring-teal-600 transition text-right font-medium"
          aria-label="Anggaran ${cat}"
        />
      </div>
    </div>
  `).join('');

  // Update total on any input change
  list.querySelectorAll('input').forEach(inp =>
    inp.addEventListener('input', updateBudgetModalTotal)
  );
  updateBudgetModalTotal();

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

/** Closes the budget modal. */
function closeBudgetModal() {
  const modal = document.getElementById('budgetModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
}

/** Recalculates and displays the total budget sum inside the modal. */
function updateBudgetModalTotal() {
  let total = 0;
  document.querySelectorAll('#budgetInputList input').forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });
  document.getElementById('budgetModalTotal').textContent = formatRupiah(total);
}

/**
 * Reads all modal inputs, updates state.budget, saves to localStorage,
 * then re-renders the entire dashboard.
 */
function saveBudgetFromModal() {
  Object.keys(state.budget).forEach(cat => {
    const inp = document.getElementById(`budgetInput_${cat}`);
    if (inp) {
      const val = parseFloat(inp.value);
      state.budget[cat] = isNaN(val) || val < 0 ? 0 : val;
    }
  });
  saveBudgetToStorage();
  closeBudgetModal();
  // Refresh all UI with new budget
  applyFilters();
  showToast('Anggaran berhasil disimpan', 'info');
}

/**
 * Resets budget to the JSON defaults, clears localStorage entry,
 * and refreshes the dashboard.
 */
function resetBudgetToDefault() {
  state.budget = { ...defaultBudget };
  localStorage.removeItem(BUDGET_STORAGE_KEY);
  closeBudgetModal();
  applyFilters();
  showToast('Anggaran direset ke nilai default', 'info');
}

/* ============================================================
   9. UI HELPERS
   ============================================================ */

/**
 * Shows a toast notification at the bottom-right.
 * @param {string} message - text to display
 * @param {'success'|'danger'|'info'} type - visual style
 * @param {number} duration - ms before auto-dismiss (default 3500)
 */
function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toastContainer');
  const id = `toast-${Date.now()}`;

  const styles = {
    success: 'bg-green-500 text-white',
    danger:  'bg-red-500 text-white',
    info:    'bg-teal-500 text-white',
  };
  const icons = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>',
    danger:  '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6"/>',
    info:    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  };

  const toast = document.createElement('div');
  toast.id = id;
  toast.className = `toast-enter pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium min-w-[220px] max-w-xs ${styles[type] || styles.info}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icons[type] || icons.info}</svg>
    <span class="flex-1">${escapeHtml(message)}</span>
    <button class="ml-1 opacity-70 hover:opacity-100 transition-opacity" onclick="this.closest('[id]').remove()" aria-label="Tutup notifikasi">✕</button>
  `;
  container.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}


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

/**
 * Switches between Top 10 and History tabs in the transaction card.
 * @param {'top10'|'history'} tab
 */
function switchTab(tab) {
  const isTop10 = tab === 'top10';
  document.getElementById('panelTop10').classList.toggle('hidden', !isTop10);
  document.getElementById('panelHistory').classList.toggle('hidden', isTop10);
  document.getElementById('searchWrap').classList.toggle('hidden', isTop10);

  const btnTop10   = document.getElementById('tabTop10');
  const btnHistory = document.getElementById('tabHistory');
  btnTop10.classList.toggle('active-tab', isTop10);
  btnTop10.classList.toggle('text-gray-500', !isTop10);
  btnHistory.classList.toggle('active-tab', !isTop10);
  btnHistory.classList.toggle('text-gray-500', isTop10);
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
 * Triggers the browser print dialog for a print-optimized PDF/paper output.
 * Temporarily switches to light mode so print colors are always readable,
 * restores theme after the dialog closes.
 */
function exportPDF() {
  // Briefly force light mode for print (print stylesheet also handles this)
  window.print();
}

/**
 * Exports currently filtered transactions as a CSV file download.
 */
function exportCSV() {
  /**
   * Wraps a cell value in double-quotes and escapes internal quotes + newlines.
   * Required for RFC 4180 CSV compliance so Excel/Sheets don't break on
   * commas, newlines, or quote chars inside field values.
   */
  const csvCell = val => {
    const str = String(val ?? '');
    // Always wrap in quotes; escape internal double-quotes by doubling them
    return `"${str.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  };

  const headers = ['ID','Tanggal','Deskripsi','Kategori','Metode Pembayaran','Tipe','Nominal'];
  const rows    = state.filtered.map(t => [
    csvCell(t.id),
    csvCell(t.tanggal),
    csvCell(t.deskripsi),
    csvCell(t.kategori),
    csvCell(t.metode_pembayaran),
    csvCell(t.tipe),
    csvCell(t.nominal),
  ]);

  // BOM (\uFEFF) makes Excel open UTF-8 CSV correctly on Windows
  const csvContent = '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob   = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url    = URL.createObjectURL(blob);
  const link   = document.createElement('a');
  link.href    = url;
  link.download = `paydaynosaur-${new Date().toISOString().slice(0,10)}.csv`;
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
   10. CUSTOM DATEPICKER
   ============================================================ */

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember'];
const DAYS_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

/**
 * Builds and mounts an interactive calendar popup.
 * @param {string} btnId     - trigger button id
 * @param {string} popId     - popup container id
 * @param {string} inputId   - hidden date input id
 * @param {string} labelId   - display label span id
 */
function initDatepicker(btnId, popId, inputId, labelId) {
  const btn   = document.getElementById(btnId);
  const pop   = document.getElementById(popId);
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);

  // Track which month/year is currently displayed in the popup
  const view = { year: new Date().getFullYear(), month: new Date().getMonth() };

  /** Formats YYYY-MM-DD for the button label */
  function updateLabel(val) {
    if (!val) { label.textContent = 'Pilih tanggal'; return; }
    const [y, m, d] = val.split('-');
    label.textContent = `${parseInt(d)} ${MONTHS_ID[parseInt(m)-1].slice(0,3)} ${y}`;
  }

  /** Renders calendar grid into the popup for view.year / view.month */
  function renderCalendar() {
    const dark      = document.documentElement.classList.contains('dark');
    const today     = new Date().toISOString().slice(0,10);
    const selected  = input.value;
    const firstDay  = new Date(view.year, view.month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

    // Day headers starting Sunday
    const headerCells = DAYS_SHORT.map(d =>
      `<div class="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-1">${d}</div>`
    ).join('');

    // Leading empty cells
    let dayCells = Array(firstDay).fill('<div></div>').join('');

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${view.year}-${String(view.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const isToday    = dateStr === today;
      const isSelected = dateStr === selected;

      let cls = 'w-9 h-9 mx-auto flex items-center justify-center rounded-full text-sm cursor-pointer transition-all select-none ';
      if (isSelected) {
        cls += 'bg-teal-500 text-white font-bold shadow';
      } else if (isToday) {
        cls += 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-semibold';
      } else {
        cls += 'text-gray-700 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-900/40 hover:text-teal-600';
      }

      dayCells += `<div class="dp-day" data-date="${dateStr}">
        <div class="${cls}">${day}</div>
      </div>`;
    }

    pop.innerHTML = `
      <!-- Month navigation header -->
      <div class="flex items-center justify-between mb-3">
        <button class="dp-prev w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500" aria-label="Bulan sebelumnya">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span class="text-sm font-bold text-gray-800 dark:text-gray-100">${MONTHS_ID[view.month]} ${view.year}</span>
        <button class="dp-next w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500" aria-label="Bulan berikutnya">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <!-- Day-of-week headers -->
      <div class="grid grid-cols-7 mb-1">${headerCells}</div>
      <!-- Day cells -->
      <div class="grid grid-cols-7 gap-y-1">${dayCells}</div>
      <!-- Clear button -->
      <div class="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-center">
        <button class="dp-clear text-xs text-gray-400 hover:text-red-500 transition">Hapus pilihan</button>
      </div>
    `;

    // Prev month
    pop.querySelector('.dp-prev').addEventListener('click', e => {
      e.stopPropagation();
      view.month--;
      if (view.month < 0) { view.month = 11; view.year--; }
      renderCalendar();
    });

    // Next month
    pop.querySelector('.dp-next').addEventListener('click', e => {
      e.stopPropagation();
      view.month++;
      if (view.month > 11) { view.month = 0; view.year++; }
      renderCalendar();
    });

    // Day click
    pop.querySelectorAll('.dp-day').forEach(cell => {
      cell.addEventListener('click', e => {
        e.stopPropagation();
        const date = cell.dataset.date;
        input.value = date;
        updateLabel(date);
        pop.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        // Dispatch change so filter logic picks it up on next Terapkan click
        input.dispatchEvent(new Event('change'));
      });
    });

    // Clear
    pop.querySelector('.dp-clear').addEventListener('click', e => {
      e.stopPropagation();
      input.value = '';
      updateLabel('');
      renderCalendar();
    });
  }

  // Toggle popup on button click
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = !pop.classList.contains('hidden');
    // Close all other popups first
    document.querySelectorAll('.dp-popup').forEach(p => p.classList.add('hidden'));
    if (!isOpen) {
      // Sync view to current selected date if any
      if (input.value) {
        const [y, m] = input.value.split('-').map(Number);
        view.year  = y;
        view.month = m - 1;
      }
      renderCalendar();
      pop.classList.remove('hidden');
      btn.setAttribute('aria-expanded', 'true');
    } else {
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Init label from pre-filled value (set by fetchData)
  updateLabel(input.value);

  // Watch for programmatic changes (e.g. resetFilters sets input.value directly)
  const observer = new MutationObserver(() => updateLabel(input.value));
  observer.observe(input, { attributes: true, attributeFilter: ['value'] });

  // Also patch resetFilters to update labels — hook via custom event
  input.addEventListener('dp-refresh', () => updateLabel(input.value));
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

  // Show success badge and toast notification
  const badge = document.getElementById('formSuccessBadge');
  badge.classList.remove('hidden');
  badge.classList.add('inline-flex');
  setTimeout(() => {
    badge.classList.add('hidden');
    badge.classList.remove('inline-flex');
  }, 3000);
  showToast('Transaksi baru berhasil ditambahkan', 'success');
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

  // Export CSV & Print/PDF
  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
  document.getElementById('exportPdfBtn').addEventListener('click', exportPDF);

  // --- Budget modal ---
  const openModal = openBudgetModal;
  document.getElementById('editBudgetBtn').addEventListener('click', openModal);
  document.getElementById('kpiBudgetEditBtn').addEventListener('click', openModal);
  document.getElementById('budgetModalClose').addEventListener('click', closeBudgetModal);
  document.getElementById('budgetModalBackdrop').addEventListener('click', closeBudgetModal);
  document.getElementById('budgetSaveBtn').addEventListener('click', saveBudgetFromModal);
  document.getElementById('budgetResetBtn').addEventListener('click', resetBudgetToDefault);
  // Close on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeBudgetModal();
      closeEditModal();
    }
  });

  // --- Confirm dialog backdrop ---
  document.getElementById('confirmBackdrop').addEventListener('click', () => {
    document.getElementById('confirmDialog').classList.add('hidden');
    document.getElementById('confirmDialog').classList.remove('flex');
    document.body.style.overflow = '';
  });

  // --- Edit modal ---
  document.getElementById('editModalClose').addEventListener('click', closeEditModal);
  document.getElementById('editModalBackdrop').addEventListener('click', closeEditModal);
  document.getElementById('editSaveBtn').addEventListener('click', saveEditModal);
  document.getElementById('editCancelBtn').addEventListener('click', closeEditModal);

  // --- Edit & Delete via event delegation on the history table ---
  document.getElementById('historyTableBody').addEventListener('click', e => {
    const editBtn   = e.target.closest('.action-edit-btn');
    const deleteBtn = e.target.closest('.action-delete-btn');
    if (editBtn)   openEditModal(parseInt(editBtn.dataset.id, 10));
    if (deleteBtn) deleteTransaction(parseInt(deleteBtn.dataset.id, 10));
  });

  // Custom datepicker for filter date range
  initDatepicker('dpStartBtn', 'dpStartPop', 'filterStartDate', 'dpStartLabel');
  initDatepicker('dpEndBtn',   'dpEndPop',   'filterEndDate',   'dpEndLabel');

  // Close all datepicker popups when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.dp-popup') && !e.target.closest('.dp-trigger')) {
      document.querySelectorAll('.dp-popup').forEach(p => p.classList.add('hidden'));
    }
  });

  // --- Transaction tabs ---
  document.getElementById('tabTop10').addEventListener('click', () => switchTab('top10'));
  document.getElementById('tabHistory').addEventListener('click', () => switchTab('history'));

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
