import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";
import XLSX from "xlsx";

const root = process.cwd();

const dbPath =
  path.join(root, "data", "absensi.sqlite");

const excelPath =
  path.join(root, "SEPTEMBER 2026.xlsx");

if (!fs.existsSync(dbPath)) {
  throw new Error("Database tidak ditemukan.");
}

if (!fs.existsSync(excelPath)) {
  throw new Error(
    "SEPTEMBER 2026.xlsx tidak ditemukan di root project."
  );
}

/* =========================================================
   BACKUP DATABASE
========================================================= */

const backupPath =
  path.join(
    root,
    "data",
    `absensi-before-jadwal-${Date.now()}.sqlite`
  );

fs.copyFileSync(dbPath, backupPath);

console.log("Backup:");
console.log(backupPath);
console.log("");


/* =========================================================
   DATABASE
========================================================= */

const SQL =
  await initSqlJs({
    locateFile: (file) =>
      path.join(
        root,
        "node_modules",
        "sql.js",
        "dist",
        file
      ),
  });

const db =
  new SQL.Database(
    fs.readFileSync(dbPath)
  );


function esc(value) {
  return String(value)
    .replace(/'/g, "''");
}


function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bdrg?\./g, "")
    .replace(/[^a-z0-9]/g, "");
}


/* =========================================================
   ALIAS NAMA SUMBER -> MASTER ATTENDLY
========================================================= */

const aliases = {
  "arlichun m":
    "Arlichun Muslichun",

  "wiwit s":
    "Wiwit Sumartin",

  "enzilia d":
    "Enzillia Dewi",

  "nunung s":
    "Nunung Susanti",

  "ika ayu p":
    "Ika Ayu",

  "yayak m":
    "Yayak Munayadi",

  "sherlin":
    "Sherlin Reviana",

  "lala":
    "Lailatul Magfiroh",

  "eko":
    "Eko Wahyudi",

  "yani":
    "Yaniatul Afda",

  "sindy":
    "Sindy Maulanisa",

  "effendi agus":
    "Effendy Agus",

  "p.sudi":
    "Sudi Rohman",

  "p. sudi":
    "Sudi Rohman",

  "dwi fitriati nusantoro":
    "Dwi Fitriati",

  "virgin k":
    "Virgin",

  "widya":
    "Widya Khoirunnisa",

  "miga":
    "Migawati"
};


/* =========================================================
   CARI PEGAWAI
========================================================= */

function getEmployees() {

  const result =
    db.exec(`
      SELECT
        id,
        name,
        schedule_category_id
      FROM employees;
    `);

  if (!result.length) {
    return [];
  }

  return result[0].values.map(
    (row) => ({
      id: Number(row[0]),
      name: String(row[1]),
      categoryId:
        row[2] === null
          ? null
          : Number(row[2]),
    })
  );
}


function findEmployee(sourceName) {

  const employees =
    getEmployees();

  const alias =
    aliases[
      sourceName
        .toLowerCase()
        .trim()
    ];

  const target =
    alias || sourceName;

  const normalized =
    normalize(target);

  const exact =
    employees.filter(
      (employee) =>
        normalize(employee.name) ===
        normalized
    );

  if (exact.length === 1) {
    return exact[0];
  }

  /*
   * Nama satu kata hanya digunakan
   * jika menghasilkan tepat satu kandidat.
   */
  const partial =
    employees.filter(
      (employee) =>
        normalize(employee.name)
          .includes(normalized)
    );

  if (partial.length === 1) {
    return partial[0];
  }

  return null;
}


/* =========================================================
   KATEGORI
========================================================= */

const categoryMaster = [
  ["DOKTER", "Dokter", 1],
  ["VK", "VK", 2],
  ["KAMAR_BERSALIN", "Kamar Bersalin", 3],
  ["BIKEL", "BIKEL", 4],
  ["MAGANG", "Magang", 5],
  ["LINMAS", "Linmas", 6],
  ["NON_RANAP", "Non Ranap", 7],
  ["RANAP", "Ranap", 8],
  ["TGC", "TGC", 9],
  ["DRIVER", "Driver", 10],
];

for (
  const [code, name, sortOrder]
  of categoryMaster
) {

  db.run(`
    INSERT OR IGNORE INTO schedule_categories (
      code,
      name,
      sort_order
    )
    VALUES (
      '${esc(code)}',
      '${esc(name)}',
      ${sortOrder}
    );
  `);
}


function categoryId(code) {

  const result =
    db.exec(`
      SELECT id
      FROM schedule_categories
      WHERE code = '${esc(code)}'
      LIMIT 1;
    `);

  if (
    !result.length ||
    !result[0].values.length
  ) {
    throw new Error(
      `Kategori tidak ditemukan: ${code}`
    );
  }

  return Number(
    result[0].values[0][0]
  );
}


/* =========================================================
   PERIOD
========================================================= */

function periodId(year, month) {

  db.run(`
    INSERT OR IGNORE INTO schedule_periods (
      schedule_year,
      schedule_month,
      status
    )
    VALUES (
      ${year},
      ${month},
      'DRAFT'
    );
  `);

  const result =
    db.exec(`
      SELECT id
      FROM schedule_periods
      WHERE schedule_year = ${year}
        AND schedule_month = ${month}
      LIMIT 1;
    `);

  return Number(
    result[0].values[0][0]
  );
}


/* =========================================================
   IMPORT SATU PEGAWAI
========================================================= */

let saved = 0;
const unmatched = [];

function importEmployee({
  name,
  category,
  year,
  month,
  codes,
}) {

  const employee =
    findEmployee(name);

  if (!employee) {

    unmatched.push({
      name,
      category,
      year,
      month,
    });

    return;
  }

  const catId =
    categoryId(category);

  /*
   * Kategori diisi jika masih kosong.
   * Kategori yang sudah ada tidak ditimpa.
   */
  if (employee.categoryId === null) {

    db.run(`
      UPDATE employees
      SET schedule_category_id = ${catId}
      WHERE id = ${employee.id};
    `);
  }

  const pId =
    periodId(year, month);

  for (
    let index = 0;
    index < codes.length;
    index += 1
  ) {

    const code =
      String(codes[index] ?? "")
        .trim();

    /*
     * Kosong di sumber =
     * tidak membuat work_schedule.
     */
    if (!code) {
      continue;
    }

    const day =
      index + 1;

    const date =
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    db.run(`
      INSERT INTO work_schedules (
        period_id,
        employee_id,
        schedule_date,
        schedule_code,
        source,
        is_locked,
        notes
      )
      VALUES (
        ${pId},
        ${employee.id},
        '${date}',
        '${esc(code)}',
        'IMPORT',
        0,
        'Import sumber jadwal asli'
      )
      ON CONFLICT(
        employee_id,
        schedule_date
      )
      DO UPDATE SET
        period_id =
          excluded.period_id,

        schedule_code =
          excluded.schedule_code,

        source =
          'IMPORT',

        notes =
          'Import sumber jadwal asli',

        updated_at =
          CURRENT_TIMESTAMP;
    `);

    saved += 1;
  }
}


/* =========================================================
   1. DOKTER — BACA LANGSUNG EXCEL
   SUMBER ASLI = AGUSTUS 2026
========================================================= */

console.log(
  "Membaca jadwal dokter dari Excel..."
);

const workbook =
  XLSX.readFile(excelPath);

const sheet =
  workbook.Sheets[
    workbook.SheetNames[0]
  ];

const rows =
  XLSX.utils.sheet_to_json(
    sheet,
    {
      header: 1,
      defval: "",
    }
  );

/*
 * Pada sumber:
 * baris dokter bergantian dengan baris jumlah jam.
 *
 * Kolom:
 * A = nama
 * B:AF = tanggal 1-31
 */
for (const row of rows) {

  const rawName =
    String(row[0] || "")
      .trim();

  if (
    !rawName
      .toLowerCase()
      .startsWith("dr.")
  ) {
    continue;
  }

  const codes =
    row
      .slice(1, 32)
      .map(
        (value) =>
          String(value || "")
            .trim()
      );

  importEmployee({
    name: rawName,
    category: "DOKTER",
    year: 2026,
    month: 8,
    codes,
  });
}


/* =========================================================
   2. SEPTEMBER — VK
========================================================= */

const september = [

  {
    category: "VK",
    name: "Fetty Trisnayanti",
    codes: [
      "PV","P","P","P","P","L","P","P","PV","P",
      "P","P","L","P","P","P","P","P","P","L",
      "P","P","P","PV","P","PV","L","P","P","PV"
    ]
  },

  {
    category: "VK",
    name: "Filderia Hutagalung",
    codes: [
      "P","P","P","P","P","L","P","P","P","P",
      "P","P","L","P","P","P","P","P","P","L",
      "P","P","P","P","P","P","L","P","P","P"
    ]
  },

  {
    category: "VK",
    name: "Dewi Diah Zakia",
    codes: [
      "L","SM","L","SM","L","L","PV","SM","L","PY",
      "P","PY","L","PY","L","PV","PV","SM","L","L",
      "PTU","PTU","PTU","PTU","PTU","PTU","L","PTU","SM","L"
    ]
  },

  {
    category: "VK",
    name: "Erni Kurniawati",
    codes: [
      "SM","L","L","PV","P","P","PY","PY","PY","SM",
      "L","P","L","PV","SM","L","L","PV","P","SM",
      "L","PV","SM","L","L","P","L","P","L","P"
    ]
  },

  {
    category: "VK",
    name: "Dwi Fitriati Nusantoro",
    codes: [
      "PY","PY","SM","L","L","L","PY","PV","P PRA LOK MIN","SM",
      "L","PV","SM","L","P LOK MIN","P","P","PV","P","L",
      "SM","L","L","P","SM","L","L","L","PV","P"
    ]
  },


/* =========================================================
   KAMAR BERSALIN
========================================================= */

  {
    category: "KAMAR_BERSALIN",
    name: "Maretta",
    codes: [
      "SM","L","L","PV","PY","L","L","SM","L","L",
      "PY","PY","P","P","SM","L","L","P","PV","L",
      "PV","SM","L","L","P","P","P","PV","SM","L"
    ]
  },

  {
    category: "KAMAR_BERSALIN",
    name: "Ristiani",
    codes: [
      "PV","PR","SM","L","PY","L","SM","L","PY","L",
      "PV","PY","SM","L","L","PR","PV","P","L","L",
      "C","C","PR","SM","L","L","P","SM","L","L"
    ]
  },

  {
    category: "KAMAR_BERSALIN",
    name: "Virgin K",
    codes: [
      "P","SM","L","L","PY","SM","L","L","L","PV",
      "SM","L","L","PY","P","SM","L","L","P","L",
      "SM","L","PV","P","SM","L","L","P","P","PV"
    ]
  },

  {
    category: "KAMAR_BERSALIN",
    name: "Fatimatus Zahro",
    codes: [
      "P","PR","PY","L","P","L","SM","L","PY","PV",
      "L","P","P","SM","L","L","P","P","SM","L",
      "PY","L","P","PV","L","SM","L","L","PY","SM"
    ]
  },

  {
    category: "KAMAR_BERSALIN",
    name: "Erni Sundari",
    codes: [
      "L","L","PY","P","PV","SM","L","L","L","PY",
      "P","SM","L","P","PV","L","SM","L","PY","P",
      "PV","P","SM","L","P","PV","L","SM","L","L"
    ]
  },

  {
    category: "KAMAR_BERSALIN",
    name: "Widya",
    codes: [
      "PY","PV","PY","L","L","P","PY","P","PV","P",
      "PY","L","L","PV","P","PR","SM","L","L","P",
      "P","P","PV","P","P","L","SM","L","P","P"
    ]
  },

  {
    category: "KAMAR_BERSALIN",
    name: "Miga",
    codes: [
      "P","PY","PV","SM","L","L","P","PV","SM","L",
      "P","PY","L","SM","L","PV","P","P","P","L",
      "L","PV","L","SM","L","P","SM","L","L","P"
    ]
  },


/* =========================================================
   BIKEL
========================================================= */

  {
    category: "BIKEL",
    name: "Febri Nuryaningsih",
    codes: [
      "P","P","PV","P","SM","L","L","P","P","PY",
      "PV","L","L","P","P","P","P","P","P","SM",
      "L","L","P","P","P","P","L","P","P","P"
    ]
  },


/* =========================================================
   MAGANG
========================================================= */

  {
    category: "MAGANG",
    name: "Ummu",
    codes: [
      "L","PV","P","P","P","L","P","P","SM","L",
      "L","SM","L","L","PV","SM","L","L","PV","L",
      "P","SM","L","L","PV","SM","L","PV","P","P"
    ]
  },


/* =========================================================
   DRIVER
========================================================= */

  {
    category: "DRIVER",
    name: "Agus Auliya",
    codes: [
      "M","L","L","PS","PS","M","M","L","L","PS",
      "PS","M","M","L","L","PS","PS","M","M","L",
      "L","PS","PS","M","M","L","L","PS","PS","M"
    ]
  },

  {
    category: "DRIVER",
    name: "Hanif Azhar",
    codes: [
      "P","P","P","P","P","L","P","P","P","P",
      "P","P","L","P","P","P","P","P","P","L",
      "P","P","P","P","P","P","L","P","P","P"
    ]
  },

  {
    category: "DRIVER",
    name: "Agus Widarso",
    codes: [
      "P","PS","PS","M","M","L","L","PS","PS","M",
      "M","L","L","PS","PS","M","M","L","L","PS",
      "PS","M","M","L","L","PS","PS","M","M","L"
    ]
  },

  {
    category: "DRIVER",
    name: "Effendi Agus",
    codes: [
      "PS","M","M","L","L","PS","PS","M","M","L",
      "L","PS","PS","M","M","L","L","PS","PS","M",
      "M","L","L","PS","PS","M","M","L","L","PS"
    ]
  },


/* =========================================================
   LINMAS
========================================================= */

  {
    category: "LINMAS",
    name: "Risdianto",
    codes: [
      "P","PS","PS","M","M","L","L","PS","PS","M",
      "M","L","L","PS","PS","M","M","L","L","L",
      "PS","M","M","L","L","PS","PS","M","M","L"
    ]
  },

  {
    category: "LINMAS",
    name: "Riyanto",
    codes: [
      "L","P","P","P","P","L","P","P","P","P",
      "P","P","L","P","P","P","P","P","P","PS",
      "P","P","P","P","P","P","L","P","P","P"
    ]
  },

  {
    category: "LINMAS",
    name: "Ari",
    codes: [
      "M","L","L","PS","PS","M","M","L","L","PS",
      "PS","M","M","L","L","PS","PS","M","M","L",
      "L","PS","PS","M","M","L","L","PS","PS","M"
    ]
  },

  {
    category: "LINMAS",
    name: "P.Sudi",
    codes: [
      "PS","M","M","L","L","PS","PS","M","M","L",
      "L","PS","PS","M","M","L","L","PS","PS","M",
      "M","L","L","PS","PS","M","M","L","L","PS"
    ]
  }

];


/* =========================================================
   IMPORT SEPTEMBER
========================================================= */

for (const item of september) {

  importEmployee({
    ...item,
    year: 2026,
    month: 9,
  });
}


/* =========================================================
   SIMPAN
========================================================= */

fs.writeFileSync(
  dbPath,
  Buffer.from(
    db.export()
  )
);


console.log("");
console.log(
  `Jadwal tersimpan: ${saved} sel`
);


if (unmatched.length) {

  console.log("");
  console.log(
    "NAMA YANG BELUM DITEMUKAN:"
  );

  for (const item of unmatched) {

    console.log(
      `- ${item.name} [${item.category}]`
    );
  }
}


console.log("");
console.log(
  "Import tahap 1 selesai."
);

console.log(
  "Dokter hanya masuk Agustus 2026."
);

console.log(
  "Tidak ada generate otomatis ke bulan berikutnya."
);

db.close();