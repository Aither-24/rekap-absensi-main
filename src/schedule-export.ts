import ExcelJS from "exceljs";
import type { Database } from "sql.js";

const MONTH_NAMES = [
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

const DAY_NAMES = [
  "MIN",
  "SEN",
  "SEL",
  "RAB",
  "KAM",
  "JUM",
  "SAB",
];

const CODE_STYLES: Record<
  string,
  {
    fill: string;
    font: string;
  }
> = {
  P: {
    fill: "DCFCE7",
    font: "166534",
  },

  M: {
    fill: "EDE9FE",
    font: "6D28D9",
  },

  L: {
    fill: "FEE2E2",
    font: "B91C1C",
  },

  S: {
    fill: "FFEDD5",
    font: "C2410C",
  },

  PS: {
    fill: "FEF3C7",
    font: "92400E",
  },

  PG: {
    fill: "CFFAFE",
    font: "0E7490",
  },

  SM: {
    fill: "CCFBF1",
    font: "0F766E",
  },

  PV: {
    fill: "FCE7F3",
    font: "BE185D",
  },

  PY: {
    fill: "ECFCCB",
    font: "4D7C0F",
  },

  PR: {
    fill: "FEF9C3",
    font: "854D0E",
  },

  PTU: {
    fill: "FDE68A",
    font: "78350F",
  },

  TGC: {
    fill: "DBEAFE",
    font: "1D4ED8",
  },

  C: {
    fill: "E5E7EB",
    font: "374151",
  },

  PLANSIA: {
    fill: "E2E8F0",
    font: "334155",
  },
};


function getCodeStyle(
  rawValue: string
) {
  const code =
    String(rawValue || "")
      .trim()
      .toUpperCase();

  if (!code) {
    return null;
  }

  if (code.includes("TGC")) {
    return CODE_STYLES.TGC;
  }

  return (
    CODE_STYLES[code] ?? {
      fill: "F3F4F6",
      font: "374151",
    }
  );
}


function createBorder() {
  const side = {
    style: "thin" as const,
    color: {
      argb: "FFE2E8F0",
    },
  };

  return {
    top: side,
    left: side,
    bottom: side,
    right: side,
  };
}


export async function createScheduleWorkbook(
  db: Database,
  month: string
): Promise<Buffer> {

  if (
    !/^\d{4}-\d{2}$/.test(month)
  ) {
    throw new Error(
      "Periode tidak valid."
    );
  }

  const [year, monthNumber] =
    month
      .split("-")
      .map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new Error(
      "Periode tidak valid."
    );
  }

  const daysInMonth =
    new Date(
      year,
      monthNumber,
      0
    ).getDate();


  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "Attendly";

  workbook.company =
    "Puskesmas Krembangan Selatan";

  workbook.title =
    `Jadwal Pegawai ${MONTH_NAMES[monthNumber - 1]} ${year}`;


  const categoryResult =
    db.exec(`
      SELECT
        id,
        name
      FROM schedule_categories
      ORDER BY
        sort_order ASC,
        name COLLATE NOCASE ASC;
    `);


  const categories =
    categoryResult.length === 0
      ? []
      : categoryResult[0].values.map(
          (row) => ({
            id: Number(row[0]),
            name: String(row[1]),
          })
        );


  for (
    const category
    of categories
  ) {

    let sheetName =
      category.name
        .replace(
          /[\\\/\?\*\[\]\:]/g,
          " "
        )
        .trim()
        .slice(0, 31);

    if (!sheetName) {
      sheetName =
        `Kategori ${category.id}`;
    }


    const worksheet =
      workbook.addWorksheet(
        sheetName,
        {
          views: [
            {
              state: "frozen",
              xSplit: 2,
              ySplit: 4,
            },
          ],
        }
      );


    const employeeResult =
      db.exec(`
        SELECT
          id,
          name,
          role
        FROM employees
        WHERE schedule_category_id =
          ${category.id}
        ORDER BY
          name COLLATE NOCASE ASC;
      `);


    const employees =
      employeeResult.length === 0
        ? []
        : employeeResult[0].values.map(
            (row) => ({
              id:
                Number(row[0]),

              name:
                String(row[1]),

              role:
                row[2] === null
                  ? ""
                  : String(row[2]),

              schedules:
                {} as Record<
                  string,
                  string
                >,
            })
          );


    if (
      employees.length > 0
    ) {

      const ids =
        employees
          .map(
            (employee) =>
              employee.id
          )
          .join(",");

      const startDate =
        `${month}-01`;

      const endDate =
        `${month}-${String(
          daysInMonth
        ).padStart(2, "0")}`;


      const scheduleResult =
        db.exec(`
          SELECT
            employee_id,
            schedule_date,
            schedule_code
          FROM work_schedules
          WHERE employee_id IN (${ids})
            AND schedule_date >=
              '${startDate}'
            AND schedule_date <=
              '${endDate}'
          ORDER BY
            employee_id,
            schedule_date;
        `);


      const employeeMap =
        new Map(
          employees.map(
            (employee) => [
              employee.id,
              employee,
            ]
          )
        );


      if (
        scheduleResult.length > 0
      ) {

        for (
          const row
          of scheduleResult[0].values
        ) {

          const employee =
            employeeMap.get(
              Number(row[0])
            );

          if (!employee) {
            continue;
          }

          const scheduleDate =
            String(row[1]);

          const day =
            String(
              Number(
                scheduleDate.slice(
                  8,
                  10
                )
              )
            );

          employee.schedules[day] =
            String(row[2]);
        }
      }
    }


    const lastColumn =
      daysInMonth + 2;


    // ====================================================
    // JUDUL
    // ====================================================

    worksheet.mergeCells(
      1,
      1,
      1,
      lastColumn
    );

    const title =
      worksheet.getCell(
        1,
        1
      );

    title.value =
      `JADWAL PEGAWAI - ${category.name.toUpperCase()}`;

    title.font = {
      name: "Arial",
      size: 16,
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };

    title.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF0F766E",
      },
    };

    title.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.getRow(1).height =
      30;


    // ====================================================
    // SUBTITLE
    // ====================================================

    worksheet.mergeCells(
      2,
      1,
      2,
      lastColumn
    );

    const subtitle =
      worksheet.getCell(
        2,
        1
      );

    subtitle.value =
      `Puskesmas Krembangan Selatan | ${MONTH_NAMES[monthNumber - 1]} ${year}`;

    subtitle.font = {
      name: "Arial",
      size: 10,
      italic: true,
      color: {
        argb: "FF475569",
      },
    };

    subtitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFF8FAFC",
      },
    };

    subtitle.alignment = {
      horizontal: "center",
      vertical: "middle",
    };


    // ====================================================
    // HEADER
    // ====================================================

    const header =
      worksheet.getRow(4);

    header.getCell(1).value =
      "NAMA PEGAWAI";

    header.getCell(2).value =
      "ROLE";


    for (
      let day = 1;
      day <= daysInMonth;
      day += 1
    ) {

      const date =
        new Date(
          year,
          monthNumber - 1,
          day
        );

      const cell =
        header.getCell(
          day + 2
        );

      cell.value =
        `${day}\n${DAY_NAMES[date.getDay()]}`;

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb:
            date.getDay() === 0
              ? "FFE5E7EB"
              : "FFF1F5F9",
        },
      };

      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    }


    for (
      let column = 1;
      column <= lastColumn;
      column += 1
    ) {

      const cell =
        header.getCell(
          column
        );

      if (
        column <= 2
      ) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFF1F5F9",
          },
        };

        cell.alignment = {
          horizontal: "left",
          vertical: "middle",
        };
      }

      cell.font = {
        name: "Arial",
        size: 9,
        bold: true,
        color: {
          argb: "FF334155",
        },
      };

      cell.border =
        createBorder();
    }

    header.height =
      34;


    // ====================================================
    // BODY
    // ====================================================

    let rowNumber =
      5;


    for (
      const employee
      of employees
    ) {

      const row =
        worksheet.getRow(
          rowNumber
        );

      row.getCell(1).value =
        employee.name;

      row.getCell(2).value =
        employee.role;


      row.getCell(1).font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: {
          argb: "FF0F172A",
        },
      };


      row.getCell(2).font = {
        name: "Arial",
        size: 9,
        color: {
          argb: "FF64748B",
        },
      };


      for (
        let day = 1;
        day <= daysInMonth;
        day += 1
      ) {

        const cell =
          row.getCell(
            day + 2
          );

        const code =
          employee.schedules[
            String(day)
          ] || "";

        cell.value =
          code;

        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };


        const codeStyle =
          getCodeStyle(
            code
          );


        if (codeStyle) {

          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb:
                `FF${codeStyle.fill}`,
            },
          };

          cell.font = {
            name: "Arial",
            size: 9,
            bold: true,
            color: {
              argb:
                `FF${codeStyle.font}`,
            },
          };
        }
        else {

          const date =
            new Date(
              year,
              monthNumber - 1,
              day
            );

          if (
            date.getDay() === 0
          ) {

            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb:
                  "FFF5F6F8",
              },
            };
          }

          cell.font = {
            name: "Arial",
            size: 9,
            color: {
              argb:
                "FF94A3B8",
            },
          };
        }
      }


      for (
        let column = 1;
        column <= lastColumn;
        column += 1
      ) {

        row.getCell(
          column
        ).border =
          createBorder();
      }


      row.height =
        25;

      rowNumber += 1;
    }


    // ====================================================
    // UKURAN
    // ====================================================

    worksheet.getColumn(1).width =
      28;

    worksheet.getColumn(2).width =
      12;


    for (
      let column = 3;
      column <= lastColumn;
      column += 1
    ) {

      worksheet.getColumn(
        column
      ).width =
        7;
    }


    // ====================================================
    // FILTER
    // ====================================================

    worksheet.autoFilter = {
      from: {
        row: 4,
        column: 1,
      },

      to: {
        row: 4,
        column: lastColumn,
      },
    };


    // ====================================================
    // CETAK
    // ====================================================

    worksheet.pageSetup = {
      orientation:
        "landscape",

      fitToPage:
        true,

      fitToWidth:
        1,

      fitToHeight:
        0,

      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    };


    worksheet.headerFooter.oddFooter =
      `Attendly - ${category.name} | Halaman &P dari &N`;
  }


  const output =
    await workbook.xlsx.writeBuffer();


  return Buffer.from(
    output
  );
}