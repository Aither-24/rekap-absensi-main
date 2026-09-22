const CATEGORY_SELECT_ID =
  "employeeScheduleCategory";

let categories = [];
let employeeCategoryMap =
  new Map();

let tableObserver = null;


/* =========================================================
   HELPER
========================================================= */

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("id-ID");
}


async function requestJson(
  url,
  options = {}
) {
  const response =
    await fetch(url, {
      ...options,
      headers: {
        "Content-Type":
          "application/json",
        ...(options.headers || {}),
      },
    });

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Terjadi kesalahan pada server."
    );
  }

  return data;
}


/* =========================================================
   FORM KATEGORI
========================================================= */

function ensureCategoryField() {

  if (
    document.getElementById(
      CATEGORY_SELECT_ID
    )
  ) {
    return;
  }

  const roleSelect =
    document.getElementById(
      "employeeRole"
    );

  if (!roleSelect) {
    return;
  }

  const roleField =
    roleSelect.closest(".field");

  if (!roleField) {
    return;
  }

  const field =
    document.createElement("div");

  field.className = "field";
  field.style.marginTop = "14px";

  const label =
    document.createElement("label");

  label.htmlFor =
    CATEGORY_SELECT_ID;

  label.textContent =
    "Kategori Jadwal";

  const select =
    document.createElement(
      "select"
    );

  select.id =
    CATEGORY_SELECT_ID;

  select.className =
    "input";

  field.appendChild(label);
  field.appendChild(select);

  roleField.insertAdjacentElement(
    "afterend",
    field
  );

  renderCategoryOptions();
}


function renderCategoryOptions() {

  const select =
    document.getElementById(
      CATEGORY_SELECT_ID
    );

  if (!select) {
    return;
  }

  const selected =
    select.value;

  select.replaceChildren();

  const empty =
    document.createElement(
      "option"
    );

  empty.value = "";
  empty.textContent =
    "Belum diatur";

  select.appendChild(empty);

  for (const category of categories) {

    const option =
      document.createElement(
        "option"
      );

    option.value =
      String(category.id);

    option.textContent =
      category.name;

    select.appendChild(option);
  }

  if (
    Array.from(select.options)
      .some(
        (option) =>
          option.value === selected
      )
  ) {
    select.value = selected;
  }
}


/* =========================================================
   TABLE
========================================================= */

function renderCategoryCells() {

  const tbody =
    document.getElementById(
      "employeeTableBody"
    );

  if (!tbody) {
    return;
  }

  /*
   * Penting:
   * observer dihentikan sementara agar perubahan TD
   * yang kita buat tidak memanggil observer lagi.
   */
  if (tableObserver) {
    tableObserver.disconnect();
  }

  const rows =
    Array.from(
      tbody.querySelectorAll("tr")
    );

  for (const row of rows) {

    let cells =
      Array.from(row.children);

    /*
     * Renderer utama pegawai.js menghasilkan:
     *
     * 0 No
     * 1 Nama
     * 2 Role
     * 3 Total
     * 4 Aksi
     *
     * Kita sisipkan kategori tepat di index 3.
     */
    if (cells.length === 5) {

      const categoryCell =
        document.createElement("td");

      categoryCell.className =
        "schedule-category-cell";

      cells[2].insertAdjacentElement(
        "afterend",
        categoryCell
      );

      cells =
        Array.from(row.children);
    }

    /*
     * Jika patch lama sudah pernah membuat kolom,
     * gunakan kolom keempat tanpa menambah lagi.
     */
    if (cells.length < 6) {
      continue;
    }

    const name =
      cells[1]
        ?.textContent
        ?.trim();

    const record =
      employeeCategoryMap.get(
        normalizeName(name)
      );

    const categoryCell =
      cells[3];

    categoryCell.classList.add(
      "schedule-category-cell"
    );

    categoryCell.textContent =
      record?.scheduleCategoryName ||
      "Belum diatur";
  }

  if (tableObserver) {
    tableObserver.observe(
      tbody,
      {
        childList: true,
      }
    );
  }
}


/* =========================================================
   DATA
========================================================= */

async function loadCategoryData() {

  /*
   * Hanya dua request sekali saat halaman dibuka.
   * Tidak dilakukan lagi setiap baris/render.
   */
  const [
    categoryData,
    employeeData
  ] =
    await Promise.all([
      requestJson(
        "/api/schedule-categories"
      ),

      requestJson(
        "/api/employee-schedule-categories"
      ),
    ]);

  categories =
    Array.isArray(
      categoryData.categories
    )
      ? categoryData.categories
      : [];

  employeeCategoryMap =
    new Map();

  for (
    const employee
    of employeeData.employees || []
  ) {

    employeeCategoryMap.set(
      normalizeName(
        employee.employeeName
      ),
      employee
    );
  }

  renderCategoryOptions();
  renderCategoryCells();
}


async function refreshEmployeeCategories() {

  const data =
    await requestJson(
      "/api/employee-schedule-categories"
    );

  employeeCategoryMap =
    new Map();

  for (
    const employee
    of data.employees || []
  ) {

    employeeCategoryMap.set(
      normalizeName(
        employee.employeeName
      ),
      employee
    );
  }

  renderCategoryCells();
}


/* =========================================================
   EDIT MODAL
========================================================= */

function setCategoryForEmployeeId(
  employeeId
) {

  const select =
    document.getElementById(
      CATEGORY_SELECT_ID
    );

  if (!select) {
    return;
  }

  if (!employeeId) {
    select.value = "";
    return;
  }

  const record =
    Array.from(
      employeeCategoryMap.values()
    ).find(
      (item) =>
        Number(item.employeeId) ===
        Number(employeeId)
    );

  select.value =
    record?.scheduleCategoryId
      ? String(
          record.scheduleCategoryId
        )
      : "";
}


/* =========================================================
   SAVE
========================================================= */

async function saveCategory(
  employeeId,
  categoryId
) {

  await requestJson(
    `/api/employees/${employeeId}/schedule-category`,
    {
      method: "PUT",

      body: JSON.stringify({
        scheduleCategoryId:
          categoryId || null,
      }),
    }
  );
}


async function findEmployeeByName(
  name
) {

  const data =
    await requestJson(
      "/api/employees"
    );

  const employees =
    data.employees ||
    data ||
    [];

  return employees.find(
    (employee) =>
      normalizeName(
        employee.name
      ) ===
      normalizeName(name)
  );
}


/* =========================================================
   EVENTS
========================================================= */

function installEvents() {

  const addButton =
    document.getElementById(
      "addEmployeeButton"
    );

  const tbody =
    document.getElementById(
      "employeeTableBody"
    );

  const form =
    document.getElementById(
      "employeeForm"
    );

  const idInput =
    document.getElementById(
      "employeeId"
    );

  const nameInput =
    document.getElementById(
      "employeeName"
    );


  if (addButton) {

    addButton.addEventListener(
      "click",
      () => {

        requestAnimationFrame(
          () => {
            setCategoryForEmployeeId(
              null
            );
          }
        );
      }
    );
  }


  if (tbody) {

    tbody.addEventListener(
      "click",
      (event) => {

        const button =
          event.target.closest(
            "button"
          );

        if (!button) {
          return;
        }

        if (
          button.textContent
            .trim()
            .toLowerCase() !==
          "edit"
        ) {
          return;
        }

        /*
         * pegawai.js mengisi employeeId
         * pada event yang sama.
         */
        setTimeout(
          () => {
            setCategoryForEmployeeId(
              idInput?.value
            );
          },
          0
        );
      }
    );
  }


  if (form) {

    form.addEventListener(
      "submit",
      () => {

        const selectedCategory =
          document.getElementById(
            CATEGORY_SELECT_ID
          )?.value || "";

        const originalId =
          idInput?.value || "";

        const originalName =
          nameInput?.value?.trim() ||
          "";

        /*
         * CRUD utama masih dikerjakan pegawai.js.
         * Tunggu sebentar sampai employee selesai disimpan.
         */
        setTimeout(
          async () => {

            try {

              let employeeId =
                originalId;

              if (!employeeId) {

                const employee =
                  await findEmployeeByName(
                    originalName
                  );

                employeeId =
                  employee?.id || "";
              }

              if (!employeeId) {
                return;
              }

              await saveCategory(
                employeeId,
                selectedCategory
              );

              await refreshEmployeeCategories();

            }
            catch (error) {

              console.error(
                "Gagal menyimpan kategori:",
                error
              );
            }

          },
          300
        );
      }
    );
  }
}


/* =========================================================
   OBSERVER RINGAN
========================================================= */

function installTableObserver() {

  const tbody =
    document.getElementById(
      "employeeTableBody"
    );

  if (!tbody) {
    return;
  }

  tableObserver =
    new MutationObserver(
      () => {

        /*
         * Hanya dipanggil kalau daftar TR diganti
         * oleh pagination/search pegawai.js.
         */
        requestAnimationFrame(
          renderCategoryCells
        );
      }
    );

  tableObserver.observe(
    tbody,
    {
      childList: true,
    }
  );
}


/* =========================================================
   INIT
========================================================= */

async function init() {

  ensureCategoryField();

  try {

    await loadCategoryData();

  }
  catch (error) {

    console.error(
      "Gagal memuat kategori jadwal:",
      error
    );
  }

  installEvents();
  installTableObserver();

  /*
   * pegawai.js mungkin baru selesai render
   * sesudah module ini dipanggil.
   */
  requestAnimationFrame(
    renderCategoryCells
  );
}


document.addEventListener(
  "DOMContentLoaded",
  init
);