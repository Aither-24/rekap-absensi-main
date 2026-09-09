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

const errorBox =
  document.getElementById("editErrorBox");

const errorText =
  document.getElementById("editErrorText");

let employees = [];
const selectedIds = new Set();

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

    if (selectedIds.has(employee.id)) { button.classList.remove("present"); button.classList.add("selected"); }

    const name =
      document.createElement("span");

    name.className =
      "employee-select-name";

    name.textContent =
      employee.name;

    const unit =
      document.createElement("span");

    unit.className =
      "employee-select-unit";

    unit.textContent =
      employee.unit || "Pegawai";

    button.appendChild(name);
    button.appendChild(unit);

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

  const confirmed =
    await confirmDialog({
      title: "Pastikan perubahan sudah sesuai",
      message:
        names.length > 0
          ? `${names.length} pegawai akan tercatat absen pada ${formatDateIndonesia(dateInput.value)}. Apakah data sudah sesuai?`
          : `Seluruh data absen pada ${formatDateIndonesia(dateInput.value)} akan dihapus. Apakah Anda yakin?`,
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
          employeeNames: names,
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

saveButton.addEventListener(
  "click",
  saveData
);

loadData();