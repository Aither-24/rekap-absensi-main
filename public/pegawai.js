import { apiFetch, confirmDialog, setButtonLoading, showToast } from "/common.js";

const tableBody = document.getElementById("employeeTableBody");
const tableWrap = document.getElementById("employeeTableWrap");
const empty = document.getElementById("employeeEmpty");
const summary = document.getElementById("employeeSummary");
const search = document.getElementById("employeeSearch");
const modal = document.getElementById("employeeModal");
const modalTitle = document.getElementById("employeeModalTitle");
const form = document.getElementById("employeeForm");
const employeeId = document.getElementById("employeeId");
const employeeName = document.getElementById("employeeName");
const employeeUnit = document.getElementById("employeeUnit");
const saveButton = document.getElementById("saveEmployeeButton");
const errorBox = document.getElementById("employeeErrorBox");
const errorText = document.getElementById("employeeErrorText");
let employees = [];

function openModal(employee = null) {
  employeeId.value = employee?.id || "";
  employeeName.value = employee?.name || "";
  employeeUnit.value = employee?.unit || "";
  modalTitle.textContent = employee ? "Edit Pegawai" : "Tambah Pegawai";
  errorBox.classList.add("hidden");
  modal.classList.remove("hidden");
  setTimeout(() => employeeName.focus(), 0);
}
function closeModal() { modal.classList.add("hidden"); }

function render() {
  const query = search.value.trim().toLocaleLowerCase("id-ID");
  const filtered = employees.filter((employee) =>
    employee.name.toLocaleLowerCase("id-ID").includes(query) ||
    (employee.unit || "").toLocaleLowerCase("id-ID").includes(query)
  );

  summary.textContent = `${employees.length} pegawai terdaftar`;
  tableBody.innerHTML = "";
  tableWrap.classList.toggle("hidden", filtered.length === 0);
  empty.classList.toggle("hidden", filtered.length !== 0);

  filtered.forEach((employee, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="cell-number">${index + 1}</td>
      <td><span class="employee-name"></span></td>
      <td class="unit"></td>
      <td><span class="count-badge">${employee.totalLate}</span></td>
      <td><div class="row-actions"><button class="btn btn-secondary btn-sm" data-edit>Edit</button><button class="btn btn-danger-soft btn-sm" data-delete>Hapus</button></div></td>`;
    row.querySelector(".employee-name").textContent = employee.name;
    row.querySelector(".unit").textContent = employee.unit || "-";
    row.querySelector("[data-edit]").addEventListener("click", () => openModal(employee));
    row.querySelector("[data-delete]").addEventListener("click", () => removeEmployee(employee));
    tableBody.appendChild(row);
  });
}

async function confirmSimilarEmployee(name, id = "") {
  const params = new URLSearchParams({
    name,
  });

  if (id) {
    params.set("excludeId", id);
  }

  const data = await apiFetch(`/api/employees/similar?${params.toString()}`);
  const matches = data.matches || [];

  if (matches.length === 0) {
    return true;
  }

  const exact = matches.find(
    (employee) =>
      employee.name.trim().toLocaleLowerCase("id-ID") ===
      name.trim().toLocaleLowerCase("id-ID")
  );

  if (exact) {
    errorText.textContent =
      `Pegawai dengan nama "${exact.name}" sudah terdaftar.`;

    errorBox.classList.remove("hidden");

    return false;
  }

  const names = matches
    .slice(0, 3)
    .map((employee) => employee.name)
    .join(", ");

  return confirmDialog({
    title: "Nama pegawai mirip ditemukan",
    message:
      `Nama "${name}" mirip dengan data yang sudah ada: ${names}. ` +
      "Pastikan ini benar-benar pegawai yang berbeda.",
    confirmText: "Tetap Tambahkan",
    danger: false,
  });
}
async function loadEmployees() {
  try {
    const data = await apiFetch("/api/employees");
    employees = data.employees || [];
    render();
  } catch (error) {
    showToast(error.message || "Gagal memuat pegawai.", "error");
  }
}

async function removeEmployee(employee) {
  const confirmed = await confirmDialog({
    title: "Hapus pegawai?",
    message: `${employee.name} akan dihapus bersama seluruh riwayat keterlambatannya (${employee.totalLate} catatan).`,
    confirmText: "Ya, hapus",
  });
  if (!confirmed) return;

  try {
    await apiFetch(`/api/employees/${employee.id}`, { method: "DELETE" });
    showToast("Pegawai berhasil dihapus.");
    await loadEmployees();
  } catch (error) {
    showToast(error.message || "Gagal menghapus pegawai.", "error");
  }
}

document.getElementById("backupButton").addEventListener("click", () => {
  window.location.href = "/api/backup";
  showToast("Backup database sedang diunduh.");
});

document.getElementById("addEmployeeButton").addEventListener("click", () => openModal());
document.getElementById("closeEmployeeModal").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
search.addEventListener("input", render);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorBox.classList.add("hidden");

  const id = employeeId.value;

  const payload = {
    name: employeeName.value.trim(),
    unit: employeeUnit.value.trim(),
  };

  if (!payload.name) {
    return;
  }

  setButtonLoading(saveButton, true, "Memeriksa...");

  try {
    const allowed = await confirmSimilarEmployee(payload.name, id);

    if (!allowed) {
      return;
    }

    setButtonLoading(saveButton, true, "Menyimpan...");

    await apiFetch(id ? `/api/employees/${id}` : "/api/employees", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });

    showToast(
      id
        ? "Data pegawai berhasil diperbarui."
        : "Pegawai berhasil ditambahkan."
    );

    closeModal();

    await loadEmployees();
  } catch (error) {
    errorText.textContent =
      error.message || "Gagal menyimpan pegawai.";

    errorBox.classList.remove("hidden");
  } finally {
    setButtonLoading(saveButton, false);
  }
});

loadEmployees();
