import {
  apiFetch,
  confirmDialog,
  setButtonLoading,
  showToast
} from "/common.js";

const tableBody =
  document.getElementById("employeeTableBody");

const tableWrap =
  document.getElementById("employeeTableWrap");

const empty =
  document.getElementById("employeeEmpty");

const summary =
  document.getElementById("employeeSummary");

const search =
  document.getElementById("employeeSearch");

const modal =
  document.getElementById("employeeModal");

const modalTitle =
  document.getElementById("employeeModalTitle");

const form =
  document.getElementById("employeeForm");

const employeeId =
  document.getElementById("employeeId");

const employeeName =
  document.getElementById("employeeName");

const employeeRole =
  document.getElementById("employeeRole");

const saveButton =
  document.getElementById("saveEmployeeButton");

const errorBox =
  document.getElementById("employeeErrorBox");

const errorText =
  document.getElementById("employeeErrorText");

const paginationInfo =
  document.getElementById("paginationInfo");

const paginationPages =
  document.getElementById("paginationPages");

const prevPageButton =
  document.getElementById("prevPageButton");

const nextPageButton =
  document.getElementById("nextPageButton");

const PAGE_SIZE = 10;

let currentPage = 1;
let employees = [];

function roleLabel(role) {
  switch (role) {
    case "PEGAWAI_TETAP": return "Pegawai Tetap";
    case "PKWT": return "PKWT";
    case "TENAGA_AHLI": return "Tenaga Ahli";
    case "MAGANG": return "Magang";
    default: return "Belum diatur";
  }
}


function openModal(employee = null) {
  employeeId.value =
    employee?.id || "";

  employeeName.value =
    employee?.name || "";

  employeeRole.value =
    employee && typeof employee.role === "string"
      ? employee.role
      : "";

  modalTitle.textContent =
    employee
      ? "Edit Pegawai"
      : "Tambah Pegawai";

  errorBox.classList.add("hidden");
  modal.classList.remove("hidden");

  setTimeout(
    () => employeeName.focus(),
    0
  );
}


function closeModal() {
  modal.classList.add("hidden");
}


function getFilteredEmployees() {
  const query =
    search.value
      .trim()
      .toLocaleLowerCase("id-ID");

  return employees.filter(
    (employee) =>
      employee.name
        .toLocaleLowerCase("id-ID")
        .includes(query) ||
      roleLabel(employee.role)
        .toLocaleLowerCase("id-ID")
        .includes(query)
  );
}


function renderPagination(totalItems) {
  const totalPages =
    Math.max(
      1,
      Math.ceil(totalItems / PAGE_SIZE)
    );

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const firstItem =
    totalItems === 0
      ? 0
      : ((currentPage - 1) * PAGE_SIZE) + 1;

  const lastItem =
    Math.min(
      currentPage * PAGE_SIZE,
      totalItems
    );

  paginationInfo.textContent =
    totalItems === 0
      ? "Menampilkan 0 pegawai"
      : `Menampilkan ${firstItem}-${lastItem} dari ${totalItems} pegawai`;

  paginationPages.innerHTML = "";

  /*
   * Maksimal 5 nomor halaman agar tetap ringkas.
   */
  let firstPage =
    Math.max(
      1,
      currentPage - 2
    );

  let lastPage =
    Math.min(
      totalPages,
      firstPage + 4
    );

  firstPage =
    Math.max(
      1,
      lastPage - 4
    );

  for (
    let page = firstPage;
    page <= lastPage;
    page += 1
  ) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className =
      "pagination-number";

    button.textContent =
      page;

    if (page === currentPage) {
      button.classList.add("active");
    }

    button.addEventListener(
      "click",
      () => {
        currentPage = page;
        render();
      }
    );

    paginationPages.appendChild(
      button
    );
  }

  prevPageButton.disabled =
    currentPage <= 1;

  nextPageButton.disabled =
    currentPage >= totalPages;

  const shouldHide =
    totalItems <= PAGE_SIZE;

  document
    .getElementById("employeePagination")
    .classList.toggle(
      "hidden",
      shouldHide
    );
}


function render() {
  const filtered =
    getFilteredEmployees();

  const totalPages =
    Math.max(
      1,
      Math.ceil(filtered.length / PAGE_SIZE)
    );

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const startIndex =
    (currentPage - 1) * PAGE_SIZE;

  const pageEmployees =
    filtered.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );

  summary.textContent =
    `${employees.length} pegawai terdaftar`;

  tableBody.innerHTML = "";

  tableWrap.classList.toggle(
    "hidden",
    filtered.length === 0
  );

  empty.classList.toggle(
    "hidden",
    filtered.length !== 0
  );

  pageEmployees.forEach(
    (employee, index) => {

      const row =
        document.createElement("tr");

      row.innerHTML = `
        <td class="cell-number">
          ${startIndex + index + 1}
        </td>

        <td>
          <span class="employee-name"></span>
        </td>

        <td class="role"></td>

        <td>
          <span class="count-badge">
            ${employee.totalLate}
          </span>
        </td>

        <td>
          <div class="row-actions">
            <button
              class="btn btn-secondary btn-sm"
              data-edit
            >
              Edit
            </button>

            <button
              class="btn btn-danger-soft btn-sm"
              data-delete
            >
              Hapus
            </button>
          </div>
        </td>
      `;

      row
        .querySelector(".employee-name")
        .textContent =
          employee.name;

      row
        .querySelector(".role")
        .textContent =
          roleLabel(employee.role);

      row
        .querySelector("[data-edit]")
        .addEventListener(
          "click",
          () => openModal(employee)
        );

      row
        .querySelector("[data-delete]")
        .addEventListener(
          "click",
          () => removeEmployee(employee)
        );

      tableBody.appendChild(row);
    }
  );

  renderPagination(
    filtered.length
  );
}


async function confirmSimilarEmployee(
  name,
  id = ""
) {
  const params =
    new URLSearchParams({
      name,
    });

  if (id) {
    params.set(
      "excludeId",
      id
    );
  }

  const data =
    await apiFetch(
      `/api/employees/similar?${params.toString()}`
    );

  const matches =
    data.matches || [];

  if (matches.length === 0) {
    return true;
  }

  const exact =
    matches.find(
      (employee) =>
        employee.name
          .trim()
          .toLocaleLowerCase("id-ID") ===
        name
          .trim()
          .toLocaleLowerCase("id-ID")
    );

  if (exact) {
    errorText.textContent =
      `Pegawai dengan nama "${exact.name}" sudah terdaftar.`;

    errorBox.classList.remove(
      "hidden"
    );

    return false;
  }

  const names =
    matches
      .slice(0, 3)
      .map(
        (employee) =>
          employee.name
      )
      .join(", ");

  return confirmDialog({
    title:
      "Nama pegawai mirip ditemukan",

    message:
      `Nama "${name}" mirip dengan data yang sudah ada: ${names}. ` +
      "Pastikan ini benar-benar pegawai yang berbeda.",

    confirmText:
      "Tetap Tambahkan",

    danger: false,
  });
}


async function loadEmployees() {
  try {
    const data =
      await apiFetch(
        "/api/employees"
      );

    employees =
      data.employees || [];

    /*
     * Jika setelah hapus jumlah halaman berkurang,
     * render akan menyesuaikan halaman aktif.
     */
    render();

  } catch (error) {
    showToast(
      error.message ||
        "Gagal memuat pegawai.",
      "error"
    );
  }
}


async function removeEmployee(employee) {
  const confirmed =
    await confirmDialog({
      title:
        "Hapus pegawai?",

      message:
        `${employee.name} akan dihapus bersama seluruh riwayat keterlambatannya (${employee.totalLate} catatan).`,

      confirmText:
        "Ya, hapus",
    });

  if (!confirmed) {
    return;
  }

  try {
    await apiFetch(
      `/api/employees/${employee.id}`,
      {
        method: "DELETE",
      }
    );

    showToast(
      "Pegawai berhasil dihapus."
    );

    await loadEmployees();

  } catch (error) {
    showToast(
      error.message ||
        "Gagal menghapus pegawai.",
      "error"
    );
  }
}


/*
 * PAGINATION
 */

prevPageButton.addEventListener(
  "click",
  () => {
    if (currentPage > 1) {
      currentPage -= 1;
      render();
    }
  }
);


nextPageButton.addEventListener(
  "click",
  () => {
    const filtered =
      getFilteredEmployees();

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          filtered.length /
          PAGE_SIZE
        )
      );

    if (currentPage < totalPages) {
      currentPage += 1;
      render();
    }
  }
);


/*
 * PENCARIAN
 */

search.addEventListener(
  "input",
  () => {
    currentPage = 1;
    render();
  }
);


/*
 * BACKUP
 */

document
  .getElementById("backupButton")
  .addEventListener(
    "click",
    () => {
      window.location.href =
        "/api/backup";

      showToast(
        "Backup database sedang diunduh."
      );
    }
  );


/*
 * MODAL
 */

document
  .getElementById("addEmployeeButton")
  .addEventListener(
    "click",
    () => openModal()
  );


document
  .getElementById("closeEmployeeModal")
  .addEventListener(
    "click",
    closeModal
  );


modal.addEventListener(
  "click",
  (event) => {
    if (event.target === modal) {
      closeModal();
    }
  }
);


/*
 * SIMPAN PEGAWAI
 */

form.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    errorBox.classList.add(
      "hidden"
    );

    const id =
      employeeId.value;

    const payload = {
      name:
        employeeName.value.trim(),

      role:
        employeeRole.value,
    };

    if (!payload.name) {
      errorText.textContent =
        "Nama pegawai wajib diisi.";

      errorBox.classList.remove(
        "hidden"
      );

      return;
    }

    if (!payload.role) {
      errorText.textContent =
        "Role wajib dipilih.";

      errorBox.classList.remove(
        "hidden"
      );

      employeeRole.focus();

      return;
    }

    setButtonLoading(
      saveButton,
      true,
      "Memeriksa..."
    );

    try {
      const allowed =
        await confirmSimilarEmployee(
          payload.name,
          id
        );

      if (!allowed) {
        return;
      }

      setButtonLoading(
        saveButton,
        true,
        "Menyimpan..."
      );

      await apiFetch(
          id
            ? `/api/employees/${id}`
            : "/api/employees",
          {
            method:
              id ? "PUT" : "POST",

            body:
              JSON.stringify(payload),
          }
        );

      /*
       * Pastikan respons backend memang membawa role.
       */
      if (
        !savedData.employee ||
        savedData.employee.role !== payload.role
      ) {
        throw new Error(
          "Role pegawai tidak tersimpan dengan benar."
        );
      }

      showToast(
        id
          ? "Data pegawai berhasil diperbarui."
          : "Pegawai berhasil ditambahkan."
      );

      closeModal();

      /*
       * Pegawai baru diarahkan ke halaman terakhir.
       */
      if (!id) {
        const totalAfterAdd =
          employees.length + 1;

        currentPage =
          Math.ceil(
            totalAfterAdd /
            PAGE_SIZE
          );
      }

      await loadEmployees();

    } catch (error) {
      errorText.textContent =
        error.message ||
        "Gagal menyimpan pegawai.";

      errorBox.classList.remove(
        "hidden"
      );

    } finally {
      setButtonLoading(
        saveButton,
        false
      );
    }
  }
);


loadEmployees();