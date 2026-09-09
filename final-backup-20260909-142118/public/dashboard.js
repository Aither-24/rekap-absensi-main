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
  modal.innerHTML = `<div class="modal-header modal-title-row"><div><h3>Daftar Status Hari</h3><p>${dashboardData.month}</p></div><button class="icon-action" data-close aria-label="Tutup">&#10005;</button></div><div class="modal-body modal-scroll"><div class="day-detail-list"></div></div><div class="modal-actions"><a class="btn btn-secondary" href="/rekap-bulanan.html">Rekap Bulanan</a><button class="btn btn-primary" data-close>Tutup</button></div>`;
  const list = modal.querySelector(".day-detail-list");
  dashboardData.dailySummaries.forEach((item) => {
    const block = document.createElement("article");
    block.className = `day-detail-item ${item.status === "HOLIDAY" ? "is-holiday" : ""}`;
    const description = item.status === "HOLIDAY"
      ? "Hari Libur"
      : `${item.total} pegawai absen`;
    block.innerHTML = `<div><strong>${formatDateIndonesia(item.date, true)}</strong><span>${description}</span></div><div class="name-list"></div><a class="btn btn-secondary btn-sm" href="/rekap-harian.html?date=${encodeURIComponent(item.date)}">Buka Rekap Harian</a>`;
    const names = block.querySelector(".name-list");
    if (item.status === "HOLIDAY") {
      names.textContent = "Tidak ada rekap pegawai pada hari libur.";
    } else {
      item.names.forEach((name) => { const span = document.createElement("span"); span.className = "chip"; span.textContent = name; names.appendChild(span); });
    }
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

  const reference = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate || "")
    ? referenceDate
    : new Date().toISOString().slice(0, 10);
  const [year, month] = reference.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDate = new Map((items || []).map((item) => [item.date, item]));
  const max = Math.max(...(items || []).map((item) => Number(item.total) || 0), 1);

  chart.classList.remove("hidden");
  chartEmpty.classList.add("hidden");
  chart.style.gridTemplateColumns = `repeat(${daysInMonth}, minmax(0, 1fr))`;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const item = byDate.get(date);
    const total = Number(item?.total) || 0;
    const status = item?.status || null;
    const height = total === 0 ? 0 : Math.max(10, (total / max) * 100);
    const column = document.createElement("div");
    column.className = "chart-column";

    let barClass = "chart-bar";
    let valueText = String(total);
    let title = `${formatDateIndonesia(date)}: belum direkap`;

    if (status === "HOLIDAY") {
      barClass += " is-holiday";
      valueText = "L";
      title = `${formatDateIndonesia(date)}: Hari Libur`;
    } else if (status === "WORKDAY" && total === 0) {
      barClass += " is-workday-zero";
      valueText = "0";
      title = `${formatDateIndonesia(date)}: sudah direkap, 0 pegawai absen`;
    } else if (status === "WORKDAY") {
      title = `${formatDateIndonesia(date)}: ${total} pegawai absen`;
    } else {
      barClass += " is-unprocessed";
      valueText = "-";
    }

    column.innerHTML = `<div class="chart-value">${valueText}</div><div class="chart-bar-wrap"><div class="${barClass}" style="height:${status === "HOLIDAY" ? 18 : height}%"></div></div><div class="chart-label">${day}</div>`;
    column.title = title;
    chart.appendChild(column);
  }
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

/* RECENT CARD FIRST NAME PATCH */

function getRecentCardFirstName(fullName) {
  const clean =
    String(fullName || "").trim();

  if (!clean) {
    return "";
  }

  const parts =
    clean.split(/\s+/);

  const titlePrefixes = [
    "dr",
    "dr.",
    "drg",
    "drg.",
    "ns",
    "ns.",
    "apt",
    "apt."
  ];

  const first =
    parts[0].toLocaleLowerCase("id-ID");

  if (
    parts.length >= 2 &&
    titlePrefixes.includes(first)
  ) {
    return `${parts[0]} ${parts[1]}`;
  }

  return parts[0];
}

function shortenRecentCardNamesLine(text) {
  const clean =
    String(text || "").trim();

  if (!clean) {
    return clean;
  }

  if (clean.includes("Hanya menampilkan")) {
    return clean;
  }

  if (clean === "PEGAWAI") {
    return clean;
  }

  if (
    /Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember/i
      .test(clean)
  ) {
    return clean;
  }

  if (!clean.includes(",") && !/\+\d+\s+lainnya/i.test(clean)) {
    return clean;
  }

  const match =
    clean.match(/^(.*?)(\s*\+\d+\s+lainnya)?$/i);

  if (!match) {
    return clean;
  }

  const namesPart =
    (match[1] || "").trim();

  const suffix =
    match[2] || "";

  const shortNames =
    namesPart
      .split(",")
      .map((name) => getRecentCardFirstName(name))
      .filter(Boolean)
      .join(", ");

  return `${shortNames}${suffix}`;
}

function applyRecentCardFirstNames() {
  const cards =
    Array.from(
      document.querySelectorAll(".card, section, .panel")
    );

  const recentCard =
    cards.find((card) =>
      /Keterlambatan Terbaru/i.test(card.textContent || "")
    );

  if (!recentCard) {
    return;
  }

  const candidates =
    recentCard.querySelectorAll("p, span, div");

  candidates.forEach((element) => {
    if (element.children.length > 0) {
      return;
    }

    const original =
      (element.textContent || "").trim();

    if (!original) {
      return;
    }

    const updated =
      shortenRecentCardNamesLine(original);

    if (updated !== original) {
      element.textContent = updated;
    }
  });
}

function watchRecentCardFirstNames() {
  applyRecentCardFirstNames();

  const cards =
    Array.from(
      document.querySelectorAll(".card, section, .panel")
    );

  const recentCard =
    cards.find((card) =>
      /Keterlambatan Terbaru/i.test(card.textContent || "")
    );

  if (!recentCard) {
    return;
  }

  if (recentCard.__firstNameObserverAttached) {
    return;
  }

  const observer =
    new MutationObserver(() => {
      applyRecentCardFirstNames();
    });

  observer.observe(recentCard, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  recentCard.__firstNameObserverAttached = true;
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(watchRecentCardFirstNames, 100);
});
setTimeout(watchRecentCardFirstNames, 300);
setTimeout(watchRecentCardFirstNames, 800);