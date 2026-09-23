const categorySelect =
  document.getElementById(
    "scheduleCategory"
  );

const monthSelect =
  document.getElementById(
    "scheduleMonth"
  );

const yearSelect =
  document.getElementById(
    "scheduleYear"
  );

const matrixHead =
  document.getElementById(
    "scheduleMatrixHead"
  );

const matrixBody =
  document.getElementById(
    "scheduleMatrixBody"
  );

const matrixWrap =
  document.getElementById(
    "scheduleMatrixWrap"
  );

const emptyBox =
  document.getElementById(
    "scheduleEmpty"
  );

const summary =
  document.getElementById(
    "scheduleSummary"
  );

const title =
  document.getElementById(
    "scheduleTitle"
  );


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


function createPeriodOptions() {

  const now =
    new Date();

  const currentYear =
    now.getFullYear();

  const currentMonth =
    now.getMonth() + 1;


  monthSelect.innerHTML = "";

  monthNames.forEach(
    (monthName, index) => {

      const option =
        document.createElement(
          "option"
        );

      const monthNumber =
        index + 1;

      option.value =
        String(monthNumber)
          .padStart(2, "0");

      option.textContent =
        monthName;

      if (
        monthNumber === currentMonth
      ) {
        option.selected = true;
      }

      monthSelect.appendChild(
        option
      );
    }
  );


  yearSelect.innerHTML = "";

  for (
    let year = currentYear - 2;
    year <= currentYear + 2;
    year += 1
  ) {

    const option =
      document.createElement(
        "option"
      );

    option.value =
      String(year);

    option.textContent =
      String(year);

    if (year === currentYear) {
      option.selected = true;
    }

    yearSelect.appendChild(
      option
    );
  }
}


function getDayName(
  year,
  month,
  day
) {

  const names = [
    "Min",
    "Sen",
    "Sel",
    "Rab",
    "Kam",
    "Jum",
    "Sab",
  ];

  return names[
    new Date(
      year,
      month - 1,
      day
    ).getDay()
  ];
}


function renderCategories(
  categories,
  selectedCategoryId
) {

  const previousValue =
    categorySelect.value;

  categorySelect.innerHTML = "";

  if (!categories.length) {

    const option =
      document.createElement(
        "option"
      );

    option.value = "";
    option.textContent =
      "Belum ada kategori";

    categorySelect.appendChild(
      option
    );

    return;
  }


  for (
    const category
    of categories
  ) {

    const option =
      document.createElement(
        "option"
      );

    option.value =
      String(category.id);

    option.textContent =
      category.name;

    categorySelect.appendChild(
      option
    );
  }


  const targetValue =
    selectedCategoryId ??
    previousValue;

  if (targetValue) {
    categorySelect.value =
      String(targetValue);
  }
}


function renderMatrix(data) {

  matrixHead.innerHTML = "";
  matrixBody.innerHTML = "";

  const [
    year,
    month
  ] =
    data.month
      .split("-")
      .map(Number);


  const headerRow =
    document.createElement(
      "tr"
    );

  const nameHeader =
    document.createElement(
      "th"
    );

  nameHeader.className =
    "schedule-name-column";

  nameHeader.textContent =
    "Nama Pegawai";

  headerRow.appendChild(
    nameHeader
  );


  for (
    let day = 1;
    day <= data.daysInMonth;
    day += 1
  ) {

    const th =
      document.createElement(
        "th"
      );

    const dayName =
      getDayName(
        year,
        month,
        day
      );

    th.className =
      "schedule-day-column";

    if (dayName === "Min") {
      th.classList.add(
        "schedule-sunday"
      );
    }

    const number =
      document.createElement(
        "span"
      );

    number.className =
      "schedule-day-number";

    number.textContent =
      String(day);

    const label =
      document.createElement(
        "span"
      );

    label.className =
      "schedule-day-name";

    label.textContent =
      dayName;

    th.appendChild(number);
    th.appendChild(label);

    headerRow.appendChild(th);
  }

  matrixHead.appendChild(
    headerRow
  );


  for (
    const employee
    of data.employees
  ) {

    const row =
      document.createElement(
        "tr"
      );

    const nameCell =
      document.createElement(
        "td"
      );

    nameCell.className =
      "schedule-name-column";


    const name =
      document.createElement(
        "strong"
      );

    name.textContent =
      employee.name;


    const role =
      document.createElement(
        "span"
      );

    role.className =
      "schedule-employee-role";

    role.textContent =
      employee.role || "";


    nameCell.appendChild(name);

    if (employee.role) {
      nameCell.appendChild(role);
    }

    row.appendChild(
      nameCell
    );


    for (
      let day = 1;
      day <= data.daysInMonth;
      day += 1
    ) {

      const cell =
        document.createElement(
          "td"
        );

      cell.className =
        "schedule-code-cell";

      cell.dataset.employeeId =
        String(employee.id);

      cell.dataset.day =
        String(day);

      cell.tabIndex = 0;

      const dayName =
        getDayName(
          year,
          month,
          day
        );

      if (dayName === "Min") {
        cell.classList.add(
          "schedule-sunday"
        );
      }

      const code =
        employee.schedules[
          String(day)
        ] || "";

      cell.dataset.originalCode =
        code;

      cell.dataset.currentCode =
        code;

      cell.textContent =
        code || "-";

      if (!code) {
        cell.classList.add(
          "schedule-empty-code"
        );
      }
      else {
        const normalizedCode =
          code.trim().toUpperCase();

        if (normalizedCode === "L") {
          cell.classList.add("schedule-code-l");
        }
        else if (normalizedCode === "P") {
          cell.classList.add("schedule-code-p");
        }
        else if (normalizedCode === "PS") {
          cell.classList.add("schedule-code-ps");
        }
        else if (normalizedCode === "M") {
          cell.classList.add("schedule-code-m");
        }
        else if (normalizedCode === "S") {
          cell.classList.add("schedule-code-s");
        }
        else if (normalizedCode === "PG") {
          cell.classList.add("schedule-code-pg");
        }
        else if (normalizedCode === "SM") {
          cell.classList.add("schedule-code-sm");
        }
        else if (normalizedCode === "PV") {
          cell.classList.add("schedule-code-pv");
        }
        else if (normalizedCode === "PY") {
          cell.classList.add("schedule-code-py");
        }
        else if (normalizedCode === "PR") {
          cell.classList.add("schedule-code-pr");
        }
        else if (normalizedCode === "PTU") {
          cell.classList.add("schedule-code-ptu");
        }
        else if (normalizedCode === "C") {
          cell.classList.add("schedule-code-c");
        }
        else if (normalizedCode === "PLANSIA") {
          cell.classList.add("schedule-code-plansia");
        }
        else if (normalizedCode.includes("TGC")) {
          cell.classList.add("schedule-code-tgc");
        }
        else {
          cell.classList.add("schedule-code-other");
        }
      }

      row.appendChild(
        cell
      );
    }

    matrixBody.appendChild(
      row
    );
  }


  const selectedOption =
    categorySelect
      .selectedOptions[0];

  const categoryName =
    selectedOption
      ?.textContent ||
    "Kategori";


  title.textContent =
    `Matriks Jadwal - ${categoryName}`;

  summary.textContent =
    `${data.employees.length} pegawai · ` +
    `${monthNames[month - 1]} ${year}`;


  if (
    data.employees.length === 0
  ) {

    matrixWrap.classList.add(
      "hidden"
    );

    emptyBox.classList.remove(
      "hidden"
    );

  }
  else {

    matrixWrap.classList.remove(
      "hidden"
    );

    emptyBox.classList.add(
      "hidden"
    );
  }
}


async function loadSchedule() {

  const month =
    `${yearSelect.value}-${monthSelect.value}`;

  const categoryId =
    categorySelect.value;

  summary.textContent =
    "Memuat data...";

  try {

    const params =
      new URLSearchParams();

    params.set(
      "month",
      month
    );

    if (categoryId) {
      params.set(
        "categoryId",
        categoryId
      );
    }


    const response =
      await fetch(
        `/api/schedule-matrix?${params.toString()}`,
        {
          cache: "no-store",
        }
      );


    const data =
      await response.json();


    if (!response.ok) {
      throw new Error(
        data.error ||
        "Gagal memuat jadwal."
      );
    }


    renderCategories(
      data.categories,
      data.selectedCategoryId
    );

    renderMatrix(data);

  }
  catch (error) {

    console.error(error);

    summary.textContent =
      error instanceof Error
        ? error.message
        : "Gagal memuat jadwal.";

    matrixHead.innerHTML = "";
    matrixBody.innerHTML = "";
  }
}


categorySelect.addEventListener(
  "change",
  loadSchedule
);

monthSelect.addEventListener(
  "change",
  loadSchedule
);

yearSelect.addEventListener(
  "change",
  loadSchedule
);


createPeriodOptions();
loadSchedule();


// ===== MATRIX MANUAL EDITOR =====

const saveScheduleButton =
  document.getElementById(
    "saveScheduleChanges"
  );

const cancelScheduleButton =
  document.getElementById(
    "cancelScheduleChanges"
  );

const scheduleChangeInfo =
  document.getElementById(
    "scheduleChangeInfo"
  );

const scheduleCodeButtons =
  document.getElementById(
    "scheduleCodeButtons"
  );


const selectedScheduleCells =
  new Set();

const pendingScheduleChanges =
  new Map();


const scheduleColorClasses = [
  "schedule-code-l",
  "schedule-code-p",
  "schedule-code-ps",
  "schedule-code-m",
  "schedule-code-s",
  "schedule-code-pg",
  "schedule-code-sm",
  "schedule-code-pv",
  "schedule-code-py",
  "schedule-code-pr",
  "schedule-code-ptu",
  "schedule-code-tgc",
  "schedule-code-c",
  "schedule-code-plansia",
  "schedule-code-other",
  "schedule-empty-code",
];


function clearScheduleColorClasses(
  cell
) {

  for (
    const className
    of scheduleColorClasses
  ) {
    cell.classList.remove(
      className
    );
  }
}


function applyScheduleCodeStyle(
  cell,
  code
) {

  clearScheduleColorClasses(
    cell
  );

  const value =
    String(code || "")
      .trim();

  const normalized =
    value.toUpperCase();


  if (!value) {

    cell.textContent = "-";

    cell.classList.add(
      "schedule-empty-code"
    );

    return;
  }


  cell.textContent =
    value;


  if (normalized === "L") {
    cell.classList.add(
      "schedule-code-l"
    );
  }
  else if (normalized === "P") {
    cell.classList.add(
      "schedule-code-p"
    );
  }
  else if (normalized === "M") {
    cell.classList.add(
      "schedule-code-m"
    );
  }
  else if (normalized === "S") {
    cell.classList.add(
      "schedule-code-s"
    );
  }
  else if (normalized === "PS") {
    cell.classList.add(
      "schedule-code-ps"
    );
  }
  else if (normalized === "PG") {
    cell.classList.add(
      "schedule-code-pg"
    );
  }
  else if (normalized === "SM") {
    cell.classList.add(
      "schedule-code-sm"
    );
  }
  else if (normalized === "PV") {
    cell.classList.add(
      "schedule-code-pv"
    );
  }
  else if (normalized === "PY") {
    cell.classList.add(
      "schedule-code-py"
    );
  }
  else if (normalized === "PR") {
    cell.classList.add(
      "schedule-code-pr"
    );
  }
  else if (normalized === "PTU") {
    cell.classList.add(
      "schedule-code-ptu"
    );
  }
  else if (
    normalized.includes("TGC")
  ) {
    cell.classList.add(
      "schedule-code-tgc"
    );
  }
  else if (normalized === "C") {
    cell.classList.add(
      "schedule-code-c"
    );
  }
  else if (
    normalized === "PLANSIA"
  ) {
    cell.classList.add(
      "schedule-code-plansia"
    );
  }
  else {
    cell.classList.add(
      "schedule-code-other"
    );
  }
}


function getScheduleChangeKey(
  employeeId,
  day
) {

  return `${employeeId}:${day}`;
}


function updateScheduleChangeInfo() {

  const count =
    pendingScheduleChanges.size;

  if (count === 0) {

    scheduleChangeInfo.textContent =
      "Belum ada perubahan";

    saveScheduleButton.disabled =
      true;

    cancelScheduleButton.disabled =
      true;

    return;
  }


  scheduleChangeInfo.textContent =
    `${count} perubahan belum disimpan`;

  saveScheduleButton.disabled =
    false;

  cancelScheduleButton.disabled =
    false;
}


function clearScheduleSelection() {

  for (
    const cell
    of selectedScheduleCells
  ) {

    cell.classList.remove(
      "schedule-cell-selected"
    );
  }

  selectedScheduleCells.clear();
}


function toggleScheduleCell(
  cell
) {

  if (
    selectedScheduleCells.has(
      cell
    )
  ) {

    selectedScheduleCells.delete(
      cell
    );

    cell.classList.remove(
      "schedule-cell-selected"
    );

    return;
  }


  selectedScheduleCells.add(
    cell
  );

  cell.classList.add(
    "schedule-cell-selected"
  );
}


function applyCodeToSelectedCells(
  code
) {

  if (
    selectedScheduleCells.size === 0
  ) {

    alert(
      "Pilih minimal satu sel jadwal terlebih dahulu."
    );

    return;
  }


  for (
    const cell
    of selectedScheduleCells
  ) {

    const employeeId =
      Number(
        cell.dataset.employeeId
      );

    const day =
      Number(
        cell.dataset.day
      );

    const originalCode =
      String(
        cell.dataset.originalCode || ""
      );

    const newCode =
      String(code || "");

    cell.dataset.currentCode =
      newCode;

    applyScheduleCodeStyle(
      cell,
      newCode
    );


    const key =
      getScheduleChangeKey(
        employeeId,
        day
      );


    if (
      originalCode === newCode
    ) {

      pendingScheduleChanges.delete(
        key
      );

      cell.classList.remove(
        "schedule-cell-changed"
      );

    }
    else {

      pendingScheduleChanges.set(
        key,
        {
          employeeId,
          day,
          code: newCode,
        }
      );

      cell.classList.add(
        "schedule-cell-changed"
      );
    }
  }


  clearScheduleSelection();

  updateScheduleChangeInfo();
}


function resetScheduleChanges() {

  const cells =
    document.querySelectorAll(
      ".schedule-code-cell"
    );


  for (
    const cell
    of cells
  ) {

    const originalCode =
      String(
        cell.dataset.originalCode || ""
      );

    cell.dataset.currentCode =
      originalCode;

    applyScheduleCodeStyle(
      cell,
      originalCode
    );

    cell.classList.remove(
      "schedule-cell-changed"
    );
  }


  pendingScheduleChanges.clear();

  clearScheduleSelection();

  updateScheduleChangeInfo();
}


async function saveScheduleChanges() {

  if (
    pendingScheduleChanges.size === 0
  ) {
    return;
  }


  const year =
    Number(
      yearSelect.value
    );

  const month =
    Number(
      monthSelect.value
    );


  const changes =
    Array.from(
      pendingScheduleChanges.values()
    );


  saveScheduleButton.disabled =
    true;

  cancelScheduleButton.disabled =
    true;

  scheduleChangeInfo.textContent =
    "Menyimpan...";


  try {

    const response =
      await fetch(
        "/api/schedule-batch",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            year,
            month,
            changes,
          }),
        }
      );


    const result =
      await response.json();


    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal menyimpan perubahan."
      );
    }


    /*
     * Jadikan nilai baru sebagai baseline
     * setelah server berhasil menyimpan.
     */
    const cells =
      document.querySelectorAll(
        ".schedule-code-cell"
      );


    for (
      const cell
      of cells
    ) {

      cell.dataset.originalCode =
        cell.dataset.currentCode ||
        "";

      cell.classList.remove(
        "schedule-cell-changed"
      );
    }


    pendingScheduleChanges.clear();

    clearScheduleSelection();

    updateScheduleChangeInfo();


    scheduleChangeInfo.textContent =
      `${result.saved} disimpan, ${result.deleted} dihapus`;


    setTimeout(
      () => {

        if (
          pendingScheduleChanges.size === 0
        ) {

          scheduleChangeInfo.textContent =
            "Semua perubahan tersimpan";
        }

      },
      1800
    );

  }
  catch (error) {

    console.error(error);

    scheduleChangeInfo.textContent =
      error instanceof Error
        ? error.message
        : "Gagal menyimpan.";

    saveScheduleButton.disabled =
      false;

    cancelScheduleButton.disabled =
      false;
  }
}


matrixBody.addEventListener(
  "click",
  (event) => {

    const cell =
      event.target.closest(
        ".schedule-code-cell"
      );

    if (!cell) {
      return;
    }

    if (!scheduleEditMode) {
      return;
    }

    toggleScheduleCell(
      cell
    );
  }
);


scheduleCodeButtons.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "[data-code]"
      );

    if (!button) {
      return;
    }

    applyCodeToSelectedCells(
      button.dataset.code || ""
    );
  }
);


saveScheduleButton.addEventListener(
  "click",
  saveScheduleChanges
);


cancelScheduleButton.addEventListener(
  "click",
  resetScheduleChanges
);


/*
 * Jika kategori/bulan/tahun diganti,
 * perubahan lokal dibuang setelah konfirmasi.
 */

function confirmDiscardScheduleChanges() {

  if (
    pendingScheduleChanges.size === 0
  ) {
    return true;
  }

  return confirm(
    "Ada perubahan jadwal yang belum disimpan. Buang perubahan?"
  );
}


categorySelect.addEventListener(
  "mousedown",
  (event) => {

    if (
      !confirmDiscardScheduleChanges()
    ) {

      event.preventDefault();
    }
  }
);


monthSelect.addEventListener(
  "mousedown",
  (event) => {

    if (
      !confirmDiscardScheduleChanges()
    ) {

      event.preventDefault();
    }
  }
);


yearSelect.addEventListener(
  "mousedown",
  (event) => {

    if (
      !confirmDiscardScheduleChanges()
    ) {

      event.preventDefault();
    }
  }
);


updateScheduleChangeInfo();



// ===== SCHEDULE EDIT MODE =====

const editScheduleButton =
  document.getElementById(
    "editScheduleButton"
  );

let scheduleEditMode =
  false;


function setScheduleEditMode(
  enabled
) {

  scheduleEditMode =
    enabled;

  document.body.classList.toggle(
    "schedule-edit-mode",
    enabled
  );


  if (editScheduleButton) {

    editScheduleButton.classList.toggle(
      "hidden",
      enabled
    );
  }


  if (saveScheduleButton) {

    saveScheduleButton.classList.toggle(
      "hidden",
      !enabled
    );
  }


  if (cancelScheduleButton) {

    cancelScheduleButton.classList.toggle(
      "hidden",
      !enabled
    );
  }


  if (scheduleCodeButtons) {

    const buttons =
      scheduleCodeButtons.querySelectorAll(
        "button"
      );

    buttons.forEach(
      (button) => {
        button.disabled =
          !enabled;
      }
    );
  }


  if (!enabled) {

    clearScheduleSelection();

    const cells =
      document.querySelectorAll(
        ".schedule-code-cell"
      );

    cells.forEach(
      (cell) => {

        cell.classList.remove(
          "schedule-cell-selected"
        );

      }
    );
  }
}


if (editScheduleButton) {

  editScheduleButton.addEventListener(
    "click",
    () => {

      setScheduleEditMode(
        true
      );

    }
  );
}


/*
 * Override interaksi cell:
 * kalau belum masuk Edit Mode,
 * klik matriks tidak melakukan apa pun.
 */

matrixBody.addEventListener(
  "click",
  (event) => {

    if (!scheduleEditMode) {
      return;
    }

  },
  true
);


/*
 * Setelah simpan berhasil,
 * kembali ke read-only.
 */

if (saveScheduleButton) {

  saveScheduleButton.addEventListener(
    "click",
    () => {

      setTimeout(
        () => {

          if (
            pendingScheduleChanges.size === 0
          ) {

            setScheduleEditMode(
              false
            );
          }

        },
        400
      );

    }
  );
}


/*
 * Batalkan = reset + keluar edit mode.
 */

if (cancelScheduleButton) {

  cancelScheduleButton.addEventListener(
    "click",
    () => {

      setTimeout(
        () => {

          setScheduleEditMode(
            false
          );

        },
        0
      );

    }
  );
}


/*
 * Default halaman = read only.
 */

setScheduleEditMode(
  false
);


// ===== EXPORT EXCEL VIA BACKEND =====

const exportScheduleExcelButton =
  document.getElementById(
    "exportScheduleExcel"
  );


async function exportScheduleExcel() {

  const year =
    Number(yearSelect.value);

  const month =
    Number(monthSelect.value);

  const period =
    `${year}-${String(month).padStart(2, "0")}`;


  exportScheduleExcelButton.disabled =
    true;

  exportScheduleExcelButton.textContent =
    "Membuat Excel...";


  try {

    const response =
      await fetch(
        `/api/schedule-export-v2?month=${period}`
      );


    if (!response.ok) {

      let message =
        "Gagal membuat Excel.";

      try {
        const data =
          await response.json();

        message =
          data.error || message;
      }
      catch {
      }

      throw new Error(message);
    }


    const blob =
      await response.blob();


    const disposition =
      response.headers.get(
        "Content-Disposition"
      ) || "";


    const match =
      disposition.match(
        /filename="?([^"]+)"?/
      );


    const fileName =
      match?.[1] ||
      `Jadwal-Pegawai-${period}.xlsx`;


    const url =
      URL.createObjectURL(blob);


    const link =
      document.createElement("a");

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);

    link.click();
    link.remove();

    URL.revokeObjectURL(url);

  }
  catch (error) {

    console.error(error);

    alert(
      error instanceof Error
        ? error.message
        : "Gagal membuat Excel."
    );

  }
  finally {

    exportScheduleExcelButton.disabled =
      false;

    exportScheduleExcelButton.textContent =
      "Export Excel";
  }
}


if (exportScheduleExcelButton) {

  exportScheduleExcelButton.addEventListener(
    "click",
    exportScheduleExcel
  );
}

