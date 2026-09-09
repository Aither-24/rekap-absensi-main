import {
  apiFetch,
  confirmDialog,
  formatDateIndonesia,
  setButtonLoading,
  showToast,
  todayLocal,
} from "/common.js";

const dateInput =
  document.getElementById("editDate");

const loadButton =
  document.getElementById("loadEditButton");

const editCard =
  document.getElementById("editCard");

const editTitle =
  document.getElementById("editTitle");

const editCount =
  document.getElementById("editCount");

const grid =
  document.getElementById("editEmployeeGrid");

const searchInput =
  document.getElementById("editEmployeeSearch");

const clearButton =
  document.getElementById("clearEditSelectionButton");

const saveButton =
  document.getElementById("saveEditButton");

const dayStatusLabel =
  document.getElementById("editDayStatusLabel");

const setWorkdayButton =
  document.getElementById("setWorkdayButton");

const setHolidayButton =
  document.getElementById("setHolidayButton");

const errorBox =
  document.getElementById("editErrorBox");

const errorText =
  document.getElementById("editErrorText");

const ROLE_LABELS = {
  PEGAWAI_TETAP: "Pegawai Tetap",
  PKWT: "PKWT",
  TENAGA_AHLI: "Tenaga Ahli",
  MAGANG: "Magang",
};

function roleLabel(role) {
  return ROLE_LABELS[role] || "Belum diatur";
}

let employees = [];
const selectedIds = new Set();
let currentDayStatus = null;

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
  editCount.textContent =
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

  filtered.forEach((employee) => {

    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "employee-select-card present";
    button.disabled = currentDayStatus === "HOLIDAY";

    if (selectedIds.has(employee.id)) { button.classList.remove("present"); button.classList.add("selected"); }

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
      roleLabel(employee.role);

    button.appendChild(name);
    button.appendChild(role);

    button.addEventListener(
      "click",
      () => {
        if (currentDayStatus === "HOLIDAY") return;

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

function getSelectedNames() {
  return employees
    .filter((employee) =>
      selectedIds.has(employee.id)
    )
    .map((employee) =>
      employee.name
    );
}

async function loadData() {
  if (!dateInput.value) {
    return;
  }

  hideError();

  setButtonLoading(
    loadButton,
    true,
    "Memuat..."
  );

  try {
    const [
      employeeData,
      dailyData,
    ] =
      await Promise.all([
        apiFetch("/api/employees"),
        apiFetch(
          `/api/daily?date=${encodeURIComponent(dateInput.value)}`
        ),
      ]);

    employees =
      employeeData.employees || [];

    selectedIds.clear();
    currentDayStatus = dailyData.status;

    const selectedNames =
      new Set(
        (dailyData.names || [])
          .map((name) =>
            name.toLocaleLowerCase("id-ID")
          )
      );

    employees.forEach((employee) => {
      if (
        selectedNames.has(
          employee.name.toLocaleLowerCase("id-ID")
        )
      ) {
        selectedIds.add(employee.id);
      }
    });

    editTitle.textContent =
      `Edit rekap ${formatDateIndonesia(dateInput.value)}`;

    dayStatusLabel.textContent =
      currentDayStatus === "HOLIDAY"
        ? "Hari Libur"
        : currentDayStatus === "WORKDAY"
          ? "Hari Kerja"
          : "Belum Direkap";

    setWorkdayButton.classList.toggle("active", currentDayStatus === "WORKDAY");
    setHolidayButton.classList.toggle("active", currentDayStatus === "HOLIDAY");

    updateCount();
    renderEmployees();

    editCard.classList.remove("hidden");

  } catch (error) {
    showError(
      error.message ||
      "Gagal mengambil data."
    );

  } finally {
    setButtonLoading(
      loadButton,
      false
    );
  }
}

async function saveData() {
  const names =
    getSelectedNames();

  const targetStatus = currentDayStatus === "HOLIDAY" ? "HOLIDAY" : "WORKDAY";

  const confirmed =
    await confirmDialog({
      title: "Pastikan perubahan sudah sesuai",
      message:
        targetStatus === "HOLIDAY"
          ? `${formatDateIndonesia(dateInput.value)} akan disimpan sebagai hari libur. Semua catatan absen pada tanggal ini akan dikosongkan.`
          : `${names.length} pegawai akan tercatat absen pada ${formatDateIndonesia(dateInput.value)}. Apakah data sudah sesuai?`,
      confirmText: "Ya, Simpan",
      danger: names.length === 0,
    });

  if (!confirmed) {
    return;
  }

  setButtonLoading(
    saveButton,
    true,
    "Menyimpan..."
  );

  try {
    await apiFetch(
      "/api/daily",
      {
        method: "PUT",
        body: JSON.stringify({
          date: dateInput.value,
          employeeNames: targetStatus === "HOLIDAY" ? [] : names,
          status: targetStatus,
        }),
      }
    );

    showToast(
      "Rekap harian berhasil diperbarui."
    );

    await loadData();

  } catch (error) {
    showError(
      error.message ||
      "Gagal menyimpan perubahan."
    );

  } finally {
    setButtonLoading(
      saveButton,
      false
    );
  }
}

loadButton.addEventListener(
  "click",
  loadData
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

setWorkdayButton.addEventListener("click", () => {
  currentDayStatus = "WORKDAY";
  dayStatusLabel.textContent = "Hari Kerja";
  setWorkdayButton.classList.add("active");
  setHolidayButton.classList.remove("active");
  renderEmployees();
});

setHolidayButton.addEventListener("click", async () => {
  const confirmed = await confirmDialog({
    title: "Ubah menjadi hari libur?",
    message: "Jika disimpan, seluruh catatan pegawai absen pada tanggal ini akan dihapus.",
    confirmText: "Tandai Libur",
    danger: true,
  });
  if (!confirmed) return;
  currentDayStatus = "HOLIDAY";
  selectedIds.clear();
  updateCount();
  dayStatusLabel.textContent = "Hari Libur";
  setHolidayButton.classList.add("active");
  setWorkdayButton.classList.remove("active");
  renderEmployees();
});

saveButton.addEventListener(
  "click",
  saveData
);

loadData();