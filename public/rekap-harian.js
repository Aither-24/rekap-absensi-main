import { apiFetch, confirmDialog, formatDateIndonesia, setButtonLoading, showToast, todayLocal } from "/common.js";

const dateInput = document.getElementById("attendanceDate");
const showButton = document.getElementById("showReportButton");
const resultBox = document.getElementById("resultBox");
const resultDate = document.getElementById("resultDate");
const resultTotal = document.getElementById("resultTotal");
const tableBody = document.getElementById("dailyTableBody");
const emptyBox = document.getElementById("emptyBox");
const errorBox = document.getElementById("errorBox");
const errorText = document.getElementById("errorText");

const requestedDate = new URLSearchParams(window.location.search).get("date");
dateInput.value = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || "") ? requestedDate : todayLocal();

function showError(message) {
  errorText.textContent = message;
  errorBox.classList.remove("hidden");
}
function hideError() {
  errorText.textContent = "";
  errorBox.classList.add("hidden");
}

function render(data) {
  tableBody.innerHTML = "";
  resultDate.textContent = formatDateIndonesia(data.date, true);
  resultTotal.textContent = `${data.total} pegawai`;

  if (!data.names?.length) {
    resultBox.classList.add("hidden");
    emptyBox.classList.remove("hidden");
    return;
  }

  emptyBox.classList.add("hidden");
  resultBox.classList.remove("hidden");

  data.names.forEach((name, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="cell-number">${index + 1}</td>
      <td><span class="employee-name"></span></td>
      <td><div class="row-actions"><button type="button" class="btn btn-danger-soft btn-sm">Hapus</button></div></td>`;
    row.querySelector(".employee-name").textContent = name;
    row.querySelector("button").addEventListener("click", () => removeAttendance(name));
    tableBody.appendChild(row);
  });
}

async function loadDailyReport() {
  hideError();
  const date = dateInput.value;
  if (!date) return showError("Silakan pilih tanggal terlebih dahulu.");

  setButtonLoading(showButton, true, "Memuat...");
  try {
    render(await apiFetch(`/api/daily?date=${encodeURIComponent(date)}`));
  } catch (error) {
    resultBox.classList.add("hidden");
    emptyBox.classList.add("hidden");
    showError(error.message || "Gagal mengambil data rekap harian.");
  } finally {
    setButtonLoading(showButton, false);
  }
}

async function removeAttendance(name) {
  const date = dateInput.value;
  const confirmed = await confirmDialog({
    title: "Hapus data keterlambatan?",
    message: `Data ${name} pada ${formatDateIndonesia(date)} akan dihapus. Tindakan ini digunakan untuk koreksi data dan tidak dapat dibatalkan.`,
    confirmText: "Ya, hapus",
  });
  if (!confirmed) return;

  try {
    await apiFetch(`/api/attendance?date=${encodeURIComponent(date)}&name=${encodeURIComponent(name)}`, { method: "DELETE" });
    showToast(`Data ${name} berhasil dihapus.`);
    await loadDailyReport();
  } catch (error) {
    showToast(error.message || "Gagal menghapus data.", "error");
  }
}

showButton.addEventListener("click", loadDailyReport);
dateInput.addEventListener("change", loadDailyReport);
loadDailyReport();
