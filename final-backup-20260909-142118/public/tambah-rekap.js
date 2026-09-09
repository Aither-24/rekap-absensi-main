import {
  apiFetch,
  confirmDialog,
  formatDateIndonesia,
  setButtonLoading,
  showToast,
  todayLocal,
} from "/common.js";

const dateInput =
  document.getElementById("attendanceDate");

const grid =
  document.getElementById("employeeSelectionGrid");

const searchInput =
  document.getElementById("employeeSearch");

const selectedCount =
  document.getElementById("selectedCount");

const submitButton =
  document.getElementById("submitButton");

const clearButton =
  document.getElementById("clearSelectionButton");

const holidayButton =
  document.getElementById("holidayButton");

const emptyBox =
  document.getElementById("employeeEmpty");

const errorBox =
  document.getElementById("errorBox");

const errorText =
  document.getElementById("errorText");

let employees = [];
const selectedIds = new Set();

let dateAlreadyFilled = false;
let checkingDate = false;

dateInput.value = todayLocal();

function showError(message) {
  errorText.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorText.textContent = "";
  errorBox.classList.add("hidden");
}

function updateCount() {
  selectedCount.textContent =
    `${selectedIds.size} pegawai`;
}

function renderEmployees() {
  const query =
    searchInput.value
      .trim()
      .toLocaleLowerCase("id-ID");

  const filtered =
    employees.filter((employee) =>
      employee.name
        .toLocaleLowerCase("id-ID")
        .includes(query)
    );

  grid.innerHTML = "";

  emptyBox.classList.toggle(
    "hidden",
    filtered.length > 0
  );

  filtered.forEach((employee) => {

    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "employee-select-card";

    if (selectedIds.has(employee.id)) {
      button.classList.add("selected");
    }

    const name =
      document.createElement("span");

    name.className =
      "employee-select-name";

    name.textContent =
      employee.name;

    const role =
      document.createElement("span");

    role.className =
      "employee-select-unit";

    role.textContent =
      employee.role || "Belum diatur";

    button.appendChild(name);
    button.appendChild(role);

    button.addEventListener(
      "click",
      () => {

        if (selectedIds.has(employee.id)) {
          selectedIds.delete(employee.id);
        } else {
          selectedIds.add(employee.id);
        }

        updateCount();
        renderEmployees();
      }
    );

    grid.appendChild(button);
  });
}

async function loadEmployees() {
  hideError();

  try {
    const data =
      await apiFetch("/api/employees");

    employees =
      data.employees || [];

    renderEmployees();
    updateCount();

  } catch (error) {
    showError(
      error.message ||
      "Gagal memuat daftar pegawai."
    );
  }
}

async function checkDateAvailability() {
  hideError();

  const date =
    dateInput.value;

  dateAlreadyFilled = false;

  if (!date) {
    submitButton.disabled = true;
    return false;
  }

  checkingDate = true;
  submitButton.disabled = true;

  try {
    const data =
      await apiFetch(
        `/api/daily?date=${encodeURIComponent(date)}`
      );

    if (data.processed) {
      dateAlreadyFilled = true;

      selectedIds.clear();
      updateCount();
      renderEmployees();

      const label = data.status === "HOLIDAY" ? "hari libur" : "rekap hari kerja";
      showError(
        `Tanggal ini sudah tercatat sebagai ${label}. ` +
        "Gunakan menu Edit Rekap untuk melakukan perubahan."
      );

      submitButton.disabled = true;
      holidayButton.disabled = true;

      return false;
    }

    submitButton.disabled = false;
    holidayButton.disabled = false;

    return true;

  } catch (error) {
    showError(
      error.message ||
      "Gagal memeriksa status tanggal."
    );

    submitButton.disabled = true;
    holidayButton.disabled = true;

    return false;

  } finally {
    checkingDate = false;
  }
}

function getSelectedNames() {
  return employees
    .filter((employee) =>
      selectedIds.has(employee.id)
    )
    .map((employee) =>
      employee.name
    );
}

async function saveAttendance() {
  hideError();

  const date =
    dateInput.value;

  const names =
    getSelectedNames();

  if (!date) {
    showError(
      "Tanggal wajib dipilih."
    );
    return;
  }

  /*
   * Cek ulang sebelum menyimpan.
   * Ini mencegah kondisi ketika tanggal telah diisi
   * oleh proses lain setelah halaman dibuka.
   */
  const dateAvailable =
    await checkDateAvailability();

  if (!dateAvailable) {
    return;
  }

  const confirmed =
    await confirmDialog({
      title: "Pastikan data sudah sesuai",
      message:
        names.length > 0
          ? `${names.length} pegawai akan dicatat absen pada ${formatDateIndonesia(date)}. Apakah data sudah sesuai?`
          : `${formatDateIndonesia(date)} akan disimpan sebagai hari kerja dengan 0 pegawai absen. Apakah data sudah sesuai?`,
      confirmText: "Ya, Simpan",
      danger: false,
    });

  if (!confirmed) {
    return;
  }

  setButtonLoading(
    submitButton,
    true,
    "Menyimpan..."
  );

  try {
    if (names.length === 0) {
      await apiFetch("/api/day-status", {
        method: "POST",
        body: JSON.stringify({ date, status: "WORKDAY" }),
      });
      showToast("Hari kerja berhasil direkap dengan 0 pegawai absen.");
    } else {
      const result =
        await apiFetch(
          "/api/attendance",
          {
            method: "POST",
            body: JSON.stringify({
              attendanceDate: date,
              employeeNames: names,
            }),
          }
        );

      const duplicateText =
        result.duplicateCount
          ? ` ${result.duplicateCount} data sebelumnya dilewati.`
          : "";

      showToast(
        `${result.addedCount} data berhasil disimpan.${duplicateText}`
      );
    }

    selectedIds.clear();
    updateCount();
    renderEmployees();
    await checkDateAvailability();

  } catch (error) {
    showError(
      error.message ||
      "Gagal menyimpan rekap."
    );

  } finally {
    setButtonLoading(
      submitButton,
      false
    );
  }
}

async function markHoliday() {
  hideError();

  const date = dateInput.value;
  if (!date) {
    showError("Tanggal wajib dipilih.");
    return;
  }

  const available = await checkDateAvailability();
  if (!available) return;

  const confirmed = await confirmDialog({
    title: "Tandai hari libur?",
    message: `${formatDateIndonesia(date)} akan ditandai sebagai hari libur. Tidak ada data pegawai absen yang dicatat pada tanggal ini.`,
    confirmText: "Ya, Tandai Libur",
    danger: false,
  });

  if (!confirmed) return;

  setButtonLoading(holidayButton, true, "Menyimpan...");
  try {
    await apiFetch("/api/day-status", {
      method: "POST",
      body: JSON.stringify({ date, status: "HOLIDAY" }),
    });
    selectedIds.clear();
    updateCount();
    renderEmployees();
    showToast("Tanggal berhasil ditandai sebagai hari libur.");
    await checkDateAvailability();
  } catch (error) {
    showError(error.message || "Gagal menandai hari libur.");
  } finally {
    setButtonLoading(holidayButton, false);
  }
}

holidayButton.addEventListener("click", markHoliday);

dateInput.addEventListener(
  "change",
  async () => {
    selectedIds.clear();
    updateCount();
    renderEmployees();

    await checkDateAvailability();
  }
);

searchInput.addEventListener(
  "input",
  renderEmployees
);

clearButton.addEventListener(
  "click",
  () => {
    selectedIds.clear();
    updateCount();
    renderEmployees();
  }
);

submitButton.addEventListener(
  "click",
  saveAttendance
);

async function initializePage() {
  await loadEmployees();
  await checkDateAvailability();
}

initializePage();