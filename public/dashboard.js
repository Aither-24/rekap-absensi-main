import { apiFetch, formatDateIndonesia, setButtonLoading, showToast } from "/common.js";

const monthTitle = document.getElementById("monthTitle");
const employeeCount = document.getElementById("employeeCount");
const lateEmployeeCount = document.getElementById("lateEmployeeCount");
const totalLate = document.getElementById("totalLate");
const tableBody = document.getElementById("dashboardTableBody");
const tableWrap = document.getElementById("dashboardTableWrap");
const empty = document.getElementById("dashboardEmpty");
const refreshButton = document.getElementById("refreshButton");
const recentDaysList = document.getElementById("recentDaysList");
const recentEmpty = document.getElementById("recentEmpty");
const chart = document.getElementById("lateChart");
const chartEmpty = document.getElementById("chartEmpty");
const viewAllDaysButton = document.getElementById("viewAllDaysButton");
const viewAllLateButton = document.getElementById("viewAllLateButton");
let dashboardData = null;

function openDaysModal() {
  if (!dashboardData?.dailySummaries?.length) return showToast("Belum ada data keterlambatan bulan ini.", "error");
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const modal = document.createElement("div");
  modal.className = "modal modal-wide";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `<div class="modal-header modal-title-row"><div><h3>Daftar Hari Keterlambatan</h3><p>${dashboardData.month}</p></div><button class="icon-action" data-close aria-label="Tutup">Ã—</button></div><div class="modal-body modal-scroll"><div class="day-detail-list"></div></div><div class="modal-actions"><a class="btn btn-secondary" href="/rekap-bulanan.html">Rekap Bulanan</a><button class="btn btn-primary" data-close>Tutup</button></div>`;
  const list = modal.querySelector(".day-detail-list");
  dashboardData.dailySummaries.forEach((item) => {
    const block = document.createElement("article");
    block.className = "day-detail-item";
    block.innerHTML = `<div><strong>${formatDateIndonesia(item.date, true)}</strong><span>${item.total} pegawai terlambat</span></div><div class="name-list"></div><a class="btn btn-secondary btn-sm" href="/rekap-harian.html?date=${encodeURIComponent(item.date)}">Buka Rekap Harian</a>`;
    const names = block.querySelector(".name-list");
    item.names.forEach((name) => { const span = document.createElement("span"); span.className = "chip"; span.textContent = name; names.appendChild(span); });
    list.appendChild(block);
  });
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
}

function renderChart(items, referenceDate) {
  chart.innerHTML = "";

  // Sumbu X selalu mewakili seluruh tanggal dalam bulan berjalan.
  // Contoh: Februari 28/29 titik, April 30 titik, Maret 31 titik.
  const reference = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate || "")
    ? referenceDate
    : new Date().toISOString().slice(0, 10);
  const [year, month] = reference.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalsByDate = new Map((items || []).map((item) => [item.date, Number(item.total) || 0]));
  const fullMonth = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { date, total: totalsByDate.get(date) || 0 };
  });

  chart.classList.remove("hidden");
  chartEmpty.classList.add("hidden");
  const max = Math.max(...fullMonth.map((item) => item.total), 1);

  fullMonth.forEach((item) => {
    const column = document.createElement("div");
    column.className = "chart-column";
    const day = Number(item.date.slice(-2));
    const height = item.total === 0 ? 0 : Math.max(10, (item.total / max) * 100);
    const zeroClass = item.total === 0 ? " is-zero" : "";
    column.innerHTML = `<div class="chart-value">${item.total}</div><div class="chart-bar-wrap"><div class="chart-bar${zeroClass}" style="height:${height}%"></div></div><div class="chart-label">${day}</div>`;
    column.title = `${formatDateIndonesia(item.date)}: ${item.total} pegawai`;
    chart.appendChild(column);
  });
}

function renderRecent(items) {
  recentDaysList.innerHTML = "";
  if (!items?.length) { recentDaysList.classList.add("hidden"); recentEmpty.classList.remove("hidden"); return; }
  recentDaysList.classList.remove("hidden"); recentEmpty.classList.add("hidden");
  items.forEach((item) => {
    const link = document.createElement("a");
    link.className = "recent-item";
    link.href = `/rekap-harian.html?date=${encodeURIComponent(item.date)}`;
    link.innerHTML = `<div><strong>${formatDateIndonesia(item.date, true)}</strong><span>${item.names.slice(0, 3).join(", ")}${item.names.length > 3 ? ` +${item.names.length - 3} lainnya` : ""}</span></div><div class="recent-count"><b>${item.total}</b><span>pegawai</span></div>`;
    recentDaysList.appendChild(link);
  });
}

function render(data) {
  dashboardData = data;
  monthTitle.textContent = data.month;
  employeeCount.textContent = data.employeeCount ?? 0;
  lateEmployeeCount.textContent = data.lateEmployeeCount ?? data.reports?.length ?? 0;
  totalLate.textContent = data.totalLate ?? 0;
  renderChart(data.dailySummaries, data.referenceDate);
  renderRecent(data.recentDays);
  tableBody.innerHTML = "";
  if (!data.reports?.length) { tableWrap.classList.add("hidden"); empty.classList.remove("hidden"); return; }
  tableWrap.classList.remove("hidden"); empty.classList.add("hidden");
  data.reports.forEach((report, index) => {
    const row = document.createElement("tr");
    const lastDates = [...report.dates].sort().reverse().slice(0, 3);
    row.innerHTML = `<td class="cell-number">${index + 1}</td><td><span class="employee-name"></span></td><td><span class="count-badge">${report.total}</span></td><td class="dates-cell"></td><td><button type="button" class="icon-action eye-action table-eye" title="Lihat semua tanggal" aria-label="Lihat semua tanggal">&#128065;</button></td>`;
    row.querySelector(".employee-name").textContent = report.name;
    const dates = document.createElement("div"); dates.className = "date-chips";
    lastDates.forEach((date) => { const chip = document.createElement("span"); chip.className = "chip"; chip.textContent = formatDateIndonesia(date); dates.appendChild(chip); });
    row.querySelector(".dates-cell").appendChild(dates);
    row.querySelector(".table-eye").addEventListener("click", () => openEmployeeDates(report));
    tableBody.appendChild(row);
  });
}

function openEmployeeDates(report) {
  const backdrop = document.createElement("div"); backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal"><div class="modal-header"><h3></h3></div><div class="modal-body"><p class="modal-summary"></p><div class="date-chips modal-chips"></div></div><div class="modal-actions"><button class="btn btn-primary" data-close>Tutup</button></div></div>`;
  backdrop.querySelector("h3").textContent = report.name;
  backdrop.querySelector(".modal-summary").textContent = `${report.total} kali terlambat pada ${dashboardData.month}.`;
  const chips = backdrop.querySelector(".modal-chips");
  report.dates.forEach((date) => { const a = document.createElement("a"); a.className = "chip chip-link"; a.href = `/rekap-harian.html?date=${encodeURIComponent(date)}`; a.textContent = formatDateIndonesia(date); chips.appendChild(a); });
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove(); backdrop.querySelector("[data-close]").addEventListener("click", close); backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
}

async function loadDashboard() {
  setButtonLoading(refreshButton, true, "Memuat...");
  try { render(await apiFetch("/api/dashboard")); }
  catch (error) { showToast(error.message || "Gagal memuat dashboard.", "error"); }
  finally { setButtonLoading(refreshButton, false); }
}

refreshButton?.addEventListener("click", loadDashboard);
viewAllDaysButton?.addEventListener("click", openDaysModal);
viewAllLateButton?.addEventListener("click", openDaysModal);
loadDashboard();
