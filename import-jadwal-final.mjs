import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";

const dbPath = path.join(
  process.cwd(),
  "data",
  "absensi.sqlite"
);

if (!fs.existsSync(dbPath)) {
  throw new Error("Database tidak ditemukan.");
}

const backup = path.join(
  process.cwd(),
  "data",
  `absensi-before-jadwal-${Date.now()}.sqlite`
);

fs.copyFileSync(dbPath, backup);

console.log("Backup:", backup);

const SQL = await initSqlJs({
  locateFile: (file) =>
    path.join(
      process.cwd(),
      "node_modules",
      "sql.js",
      "dist",
      file
    )
});

const db = new SQL.Database(
  fs.readFileSync(dbPath)
);

const esc = (v) =>
  String(v).replace(/'/g, "''");

const norm = (v) =>
  String(v || "")
    .toLowerCase()
    .replace(/\bdrg?\./g, "")
    .replace(/[^a-z0-9]/g, "");


// ======================================================
// SCHEMA
// ======================================================

db.run(`
  CREATE TABLE IF NOT EXISTS schedule_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 999
  );
`);

const columns =
  db.exec("PRAGMA table_info(employees);");

if (
  !columns[0].values.some(
    (row) =>
      row[1] === "schedule_category_id"
  )
) {
  db.run(`
    ALTER TABLE employees
    ADD COLUMN schedule_category_id INTEGER;
  `);
}

db.run(`
  CREATE TABLE IF NOT EXISTS schedule_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_year INTEGER NOT NULL,
    schedule_month INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    source_period_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_year, schedule_month)
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS work_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    schedule_date TEXT NOT NULL,
    schedule_code TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'IMPORT',
    is_locked INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, schedule_date)
  );
`);


// ======================================================
// CATEGORY MASTER
// ======================================================

const categoryMaster = [
  ["DOKTER","Dokter",1],
  ["VK","VK",2],
  ["KAMAR_BERSALIN","Kamar Bersalin",3],
  ["BIKEL","BIKEL",4],
  ["MAGANG","Magang",5],
  ["LINMAS","Linmas",6],
  ["NON_RANAP","Non Ranap",7],
  ["RANAP","Ranap",8],
  ["TGC","TGC",9],
  ["DRIVER","Driver",10]
];

for (const [code,name,order] of categoryMaster) {
  db.run(`
    INSERT OR IGNORE INTO schedule_categories
      (code,name,sort_order)
    VALUES
      ('${code}','${name}',${order});
  `);
}


// ======================================================
// ALIAS SUMBER -> MASTER PEGAWAI
// ======================================================

const aliases = {
  "dwi fitriati nusantoro": "Dwi Fitriati",
  "virgin k": "Virgin",
  "widya": "Widya Khoirunnisa",
  "miga": "Migawati",

  "arlichun m": "Arlichun Muslichun",
  "wiwit s": "Wiwit Sumartin",
  "enzilia d": "Enzillia Dewi",
  "nunung s": "Nunung Susanti",

  "ika ayu p": "Ika Ayu",
  "yayak m": "Yayak Munayadi",
  "sherlin": "Sherlin Reviana",
  "lala": "Lailatul Magfiroh",
  "eko": "Eko Wahyudi",
  "yani": "Yaniatul Afda",
  "sindy": "Sindy Maulanisa",

  "effendi agus": "Effendy Agus",
  "p.sudi": "Sudi Rohman"
};


function employees() {
  const result = db.exec(`
    SELECT id,name
    FROM employees;
  `);

  return result.length
    ? result[0].values.map((r) => ({
        id: Number(r[0]),
        name: String(r[1])
      }))
    : [];
}


function findEmployee(sourceName) {
  const all = employees();

  const alias =
    aliases[sourceName.toLowerCase().trim()];

  const target =
    alias || sourceName;

  const exact =
    all.filter(
      (e) =>
        norm(e.name) === norm(target)
    );

  if (exact.length === 1)
    return exact[0];

  const partial =
    all.filter(
      (e) =>
        norm(e.name).includes(norm(target)) ||
        norm(target).includes(norm(e.name))
    );

  return partial.length === 1
    ? partial[0]
    : null;
}


function getCategoryId(code) {
  return Number(
    db.exec(`
      SELECT id
      FROM schedule_categories
      WHERE code='${code}'
    `)[0].values[0][0]
  );
}


function getPeriod(year,month) {
  db.run(`
    INSERT OR IGNORE INTO schedule_periods
      (schedule_year,schedule_month,status)
    VALUES
      (${year},${month},'DRAFT');
  `);

  return Number(
    db.exec(`
      SELECT id
      FROM schedule_periods
      WHERE schedule_year=${year}
        AND schedule_month=${month}
    `)[0].values[0][0]
  );
}


let saved = 0;
const missing = [];


function add(
  category,
  year,
  month,
  name,
  text
) {
  const employee =
    findEmployee(name);

  if (!employee) {
    missing.push(
      `${category} | ${name}`
    );
    return;
  }

  const categoryId =
    getCategoryId(category);

  db.run(`
    UPDATE employees
    SET schedule_category_id=${categoryId}
    WHERE id=${employee.id};
  `);

  const periodId =
    getPeriod(year,month);

  const codes =
    text.split("|");

  const days =
    new Date(year,month,0)
      .getDate();

  if (codes.length !== days) {
    throw new Error(
      `${name}: ${codes.length} hari, seharusnya ${days}`
    );
  }

  for (
    let i=0;
    i<codes.length;
    i++
  ) {
    const code =
      codes[i].trim();

    if (!code)
      continue;

    const date =
      `${year}-${String(month).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`;

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
        ${periodId},
        ${employee.id},
        '${date}',
        '${esc(code)}',
        'IMPORT',
        0,
        'Sumber jadwal asli'
      )
      ON CONFLICT(employee_id,schedule_date)
      DO UPDATE SET
        period_id=excluded.period_id,
        schedule_code=excluded.schedule_code,
        source='IMPORT',
        notes='Sumber jadwal asli',
        updated_at=CURRENT_TIMESTAMP;
    `);

    saved++;
  }
}


// ======================================================
// DOKTER — AGUSTUS 2026 SAJA
// ======================================================

add("DOKTER",2026,8,"dr. Winto",
"M|L|TGC S|S|M|TGC M|L|S|M|L|P|S|M|L|P|S|M|L|P|S|M|L|P|S|M|L|TGC P|S|M|L|S");

add("DOKTER",2026,8,"dr. Dian",
"S|M|L|P|S|M|L|P|S|M|L|TGC S|S|M|TGC M|L|S|M|L|P|S|M|L|P|S|M|P|L|S|M|L");

add("DOKTER",2026,8,"dr. Agmi",
"P|S|M|L|P|S|M|L|TGC P|S|M|L|P|S|M|L|P|S|M|L|TGC S|S|M|TGC M|L|S|M|L|P|S|M");

add("DOKTER",2026,8,"dr. Firda",
"L|P|S|M|L|P|S|M|L|P|S|M|L|P|S|M|L|TGC P|S|M|L|P|S|M|L|P|S|M|L|TGC S|S");

add("DOKTER",2026,8,"dr. Amirah",
"P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P");

add("DOKTER",2026,8,"dr. Priscilla",
"P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P");

add("DOKTER",2026,8,"dr. Sukma",
"P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P");

add("DOKTER",2026,8,"dr. Reyhan",
"P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P");

add("DOKTER",2026,8,"dr. Satria",
"P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P");

add("DOKTER",2026,8,"dr. Dyana",
"P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P");


// ======================================================
// SEPTEMBER — VK
// ======================================================

add("VK",2026,9,"Fetty Trisnayanti",
"PV|P|P|P|P|L|P|P|PV|P|P|P|L|P|P|P|P|P|P|L|P|P|P|PV|P|PV|L|P|P|PV");

add("VK",2026,9,"Filderia Hutagalung",
"P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P");

add("VK",2026,9,"Dewi Diah Zakia",
"L|SM|L|SM|L|L|PV|SM|L|PY|P|PY|L|PY|L|PV|PV|SM|L|L|PTU|PTU|PTU|PTU|PTU|PTU|L|PTU|SM|L");

add("VK",2026,9,"Erni Kurniawati",
"SM|L|L|PV|P|P|PY|PY|PY|SM|L|P|L|PV|SM|L|L|PV|P|SM|L|PV|SM|L|L|P|L|P|L|P");

add("VK",2026,9,"Dwi Fitriati Nusantoro",
"PY|PY|SM|L|L|L|PY|PV|P PRA LOK MIN|SM|L|PV|SM|L|P LOK MIN|P|P|PV|P|L|SM|L|L|P|SM|L|L|L|PV|P");


// ======================================================
// KAMAR BERSALIN
// ======================================================

add("KAMAR_BERSALIN",2026,9,"Maretta",
"SM|L|L|PV|PY|L|L|SM|L|L|PY|PY|P|P|SM|L|L|P|PV|L|PV|SM|L|L|P|P|P|PV|SM|L");

add("KAMAR_BERSALIN",2026,9,"Ristiani",
"PV|PR|SM|L|PY|L|SM|L|PY|L|PV|PY|SM|L|L|PR|PV|P|L|L|C|C|PR|SM|L|L|P|SM|L|L");

add("KAMAR_BERSALIN",2026,9,"Virgin K",
"P|SM|L|L|PY|SM|L|L|L|PV|SM|L|L|PY|P|SM|L|L|P|L|SM|L|PV|P|SM|L|L|P|P|PV");

add("KAMAR_BERSALIN",2026,9,"Fatimatus Zahro",
"P|PR|PY|L|P|L|SM|L|PY|PV|L|P|P|SM|L|L|P|P|SM|L|PY|L|P|PV|L|SM|L|L|PY|SM");

add("KAMAR_BERSALIN",2026,9,"Erni Sundari",
"L|L|PY|P|PV|SM|L|L|L|PY|P|SM|L|P|PV|L|SM|L|PY|P|PV|P|SM|L|P|PV|L|SM|L|L");

add("KAMAR_BERSALIN",2026,9,"Widya",
"PY|PV|PY|L|L|P|PY|P|PV|P|PY|L|L|PV|P|PR|SM|L|L|P|P|P|PV|P|P|L|SM|L|P|P");

add("KAMAR_BERSALIN",2026,9,"Miga",
"P|PY|PV|SM|L|L|P|PV|SM|L|P|PY|L|SM|L|PV|P|P|P|L|L|PV|L|SM|L|P|SM|L|L|P");


// ======================================================
// BIKEL + MAGANG
// ======================================================

add("BIKEL",2026,9,"Febri Nuryaningsih",
"P|P|PV|P|SM|L|L|P|P|PY|PV|L|L|P|P|P|P|P|P|SM|L|L|P|P|P|P|L|P|P|P");

add("BIKEL",2026,9,"Wahdah",
"L|L|P|P|SM|L|PV|PY|P|PY|P|PV|L|P|P|P|P|P|L|SM|L|PY|P|P|P|P|L|P|P|SM");

add("BIKEL",2026,9,"Rima Sekar",
"P|P|P|P|PV|L|P|P|P|P|SM|L|L|L|P|P|P|SM|L|L|P|P|P|P|PV|P|L|P|P|P");

add("MAGANG",2026,9,"Ummu",
"L|PV|P|P|P|L|P|P|SM|L|L|SM|L|L|PV|SM|L|L|PV|L|P|SM|L|L|PV|SM|L|PV|P|P");


// ======================================================
// NON RANAP
// ======================================================

add("NON_RANAP",2026,9,"Arlichun M",
"|PG|PG|PG||L|PG||S/PG|M|L||L|||||||L||||M.TGC|L||L|||");

add("NON_RANAP",2026,9,"Wiwit S",
"|PG|||PG|L||||PG|PG||L|PG|S|M|L|||L|S.TGC||||||L|||");

add("NON_RANAP",2026,9,"Enzilia D",
"||PG||PG|L|PG|PG|||S|M/PG|L|L||||P.TGC||L|||||||L|||");

add("NON_RANAP",2026,9,"Nunung S",
"||PG||PG|L|||Plansia|||PG|L|PG||||||L||||||Plansia|L|||");


// ======================================================
// RANAP
// ======================================================

add("RANAP",2026,9,"Ika Ayu P",
"PG|||||L||PG||PG||S|M|L|L||||S|M|L|||S|M|L|L|||");

add("RANAP",2026,9,"Yayak M",
"L|||S|M|M.TGC|L|L|PG||PG||L||||||PG|L||S|M|L|||P|S|M|L");

add("RANAP",2026,9,"Sherlin",
"PG|S|M|L|L|P|PG||P.TGC|PG|||S|M|L|||C||L|||S|M|L||L|||");

add("RANAP",2026,9,"Lala",
"|PG|S|M|L|L||PG|PG|||S.TGC|L||||S|M|L|L|PG||||||L||S|M");

add("RANAP",2026,9,"Eko",
"PG||||PG|S|M|L||S|M|L|L||M.TGC|L|||PG|L|PG|||||S|M|L||");

add("RANAP",2026,9,"Yani",
"S|M|L|||L|S|M|L|PG|||P|PG||||L||S|M|L|||S|M|L|||S.TGC");

add("RANAP",2026,9,"Sindy",
"M|L||||L|S|M|L|||PG|L|||S|M|L|PG|P|S|M|L||||P.TGC|||S");

add("RANAP",2026,9,"Tiwi",
"||S.TGC|PG|S|M|L|L||||PG|L|S|M|L||S|M|L|||||||S|M|L|C");


// ======================================================
// TGC
// ======================================================

add("TGC",2026,9,"Iskandar",
"S|S|P|P|M|M|L|L|S|S|P|P|M|M|L|L|S|S|P|P|M|M|L|L|S|S|P|P|M|M");


// ======================================================
// DRIVER
// ======================================================

add("DRIVER",2026,9,"Agus Auliya",
"M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M");

add("DRIVER",2026,9,"Hanif Azhar",
"P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P");

add("DRIVER",2026,9,"Agus Widarso",
"P|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L");

add("DRIVER",2026,9,"Effendi Agus",
"PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS");


// ======================================================
// LINMAS
// ======================================================

add("LINMAS",2026,9,"Risdianto",
"P|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|L|PS|M|M|L|L|PS|PS|M|M|L");

add("LINMAS",2026,9,"Riyanto",
"L|P|P|P|P|L|P|P|P|P|P|P|L|P|P|P|P|P|P|PS|P|P|P|P|P|P|L|P|P|P");

add("LINMAS",2026,9,"Ari",
"M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M");

add("LINMAS",2026,9,"P.Sudi",
"PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS|PS|M|M|L|L|PS");


// ======================================================
// SAVE
// ======================================================

fs.writeFileSync(
  dbPath,
  Buffer.from(db.export())
);

console.log("");
console.log(`Tersimpan: ${saved} sel jadwal`);

if (missing.length) {
  console.log("");
  console.log("BELUM COCOK DENGAN MASTER:");
  for (const name of missing)
    console.log("- " + name);
}

console.log("");
console.log("Import selesai.");
console.log("Agustus tidak diteruskan ke September.");

db.close();