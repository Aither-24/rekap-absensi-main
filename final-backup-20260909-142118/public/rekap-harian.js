import {
  apiFetch,
  setButtonLoading,
  showToast,
  todayLocal,
} from "/common.js";

const dateInput =
  document.getElementById("attendanceDate");

const showButton =
  document.getElementById("showReportButton");

const resultBox =
  document.getElementById("resultBox");

const resultSummary =
  document.getElementById("resultSummary");

const reportText =
  document.getElementById("dailyReportText");

const copyButton =
  document.getElementById("copyReportButton");

const emptyBox =
  document.getElementById("emptyBox");

const errorBox =
  document.getElementById("errorBox");

const errorText =
  document.getElementById("errorText");

const requestedDate =
  new URLSearchParams(
    window.location.search
  ).get("date");

dateInput.value =
  /^\d{4}-\d{2}-\d{2}$/.test(
    requestedDate || ""
  )
    ? requestedDate
    : todayLocal();

function showError(message) {
  errorText.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorText.textContent = "";
  errorBox.classList.add("hidden");
}

function formatShortDate(date) {
  const [year, month, day] = date.split("-");

  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  return `${Number(day)} ${monthNames[Number(month) - 1]} ${year}`;
}

function createReportText(
  date,
  names
) {
  const header =
    `Rekap pegawai absen >7.00 (${formatShortDate(date)}):`;

  const rows =
    names.map(
      (name, index) =>
        `${index + 1}. ${name}`
    );

  return [
    header,
    ...rows,
  ].join("\n");
}

async function loadDailyReport() {
  hideError();

  const date =
    dateInput.value;

  if (!date) {
    showError(
      "Silakan pilih tanggal."
    );
    return;
  }

  setButtonLoading(
    showButton,
    true,
    "Memuat..."
  );

  try {
    const data =
      await apiFetch(
        `/api/daily?date=${encodeURIComponent(date)}`
      );

    if (data.status === "HOLIDAY") {
      emptyBox.classList.add("hidden");
      resultBox.classList.remove("hidden");
      resultSummary.textContent = "Hari Libur";
      reportText.value = `Hari Libur (${formatShortDate(data.date)})`;
      reportText.style.height = "220px";
      return;
    }

    if (!data.names?.length) {
      resultBox.classList.add("hidden");
      emptyBox.classList.remove("hidden");
      reportText.value = "";
      return;
    }

    emptyBox.classList.add(
      "hidden"
    );

    resultBox.classList.remove(
      "hidden"
    );

    resultSummary.textContent =
      `${data.total} pegawai tercatat`;

    reportText.value =
      createReportText(
        data.date,
        data.names
      );

    reportText.style.height = "auto";

    reportText.style.height =
      `${Math.max(
        220,
        reportText.scrollHeight + 4
      )}px`;

  } catch (error) {

    resultBox.classList.add(
      "hidden"
    );

    emptyBox.classList.add(
      "hidden"
    );

    showError(
      error.message ||
      "Gagal mengambil rekap harian."
    );

  } finally {

    setButtonLoading(
      showButton,
      false
    );
  }
}

async function copyReport() {
  if (!reportText.value) {
    return;
  }

  try {

    await navigator.clipboard.writeText(
      reportText.value
    );

    showToast(
      "Teks rekap berhasil disalin."
    );

  } catch {

    reportText.select();

    document.execCommand(
      "copy"
    );

    showToast(
      "Teks rekap berhasil disalin."
    );
  }
}

showButton.addEventListener(
  "click",
  loadDailyReport
);

dateInput.addEventListener(
  "change",
  loadDailyReport
);

copyButton.addEventListener(
  "click",
  copyReport
);

loadDailyReport();