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