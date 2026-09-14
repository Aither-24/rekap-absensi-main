import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";

const dbFile = path.join(
  process.cwd(),
  "data",
  "absensi.sqlite"
);

const SQL = await initSqlJs({
  locateFile: (file) =>
    path.join(
      process.cwd(),
      "node_modules",
      "sql.js",
      "dist",
      file
    ),
});

const db = new SQL.Database(
  fs.readFileSync(dbFile)
);

const recap = {
  "2026-09-09": [
    "Erni Kurniawati",
    "Dwi Fitriati",
    "Nur Aini (Promkes)",
    "drg. Rendi",
    "dr. Dyana",
    "Ristiani",
    "Febri Nuryaningsih",
    "Audya Arum Sari",
    "Widya Khoirunnisa",
    "Fatimatus Zahro",
    "Jatu Dwi Cahyanti",
    "Suyitno",
    "Rima Sekar",
    "Amelia Dewi",
    "Tri Setianingsih",
    "Imroatu Sholikhati",
    "Nanda Rizky",
    "Irma Miftahulami",
    "Hanif Azhar",
    "Agus Widarso",
    "Firiesta Nur Rachmi",
    "Endang Elok",
    "Aditya",
    "Riska Dwi Lestari"
  ],

  "2026-09-10": [
    "Filderia Hutagalung",
    "Dewi Diah Zakia",
    "Nur Aini (Promkes)",
    "drg. Rendi",
    "Diah Herlina",
    "Ika Ayu",
    "dr. Dyana",
    "Yayak Munayadi",
    "Audya Arum Sari",
    "Wahdah",
    "Widya Khoirunnisa",
    "Fatimatus Zahro",
    "Sherlin Reviana",
    "Ninik Hatijah",
    "Jatu Dwi Cahyanti",
    "Suyitno",
    "Rima Sekar",
    "Amelia Dewi",
    "Imroatu Sholikhati",
    "Irma Miftahulami",
    "Risky Adika",
    "Endang Elok",
    "dr. Firda",
    "Aditya",
    "Riska Dwi Lestari",
    "drg. Virna"
  ],

  "2026-09-11": [
    "Dewi Diah Zakia",
    "Wiwit Sumartin",
    "Nur Aini (Promkes)",
    "drg. Rendi",
    "Ika Ayu",
    "dr. Dyana",
    "Nur Aini (Loket)",
    "Ristiani",
    "Febri Nuryaningsih",
    "Wahdah",
    "Widya Khoirunnisa",
    "Ninik Hatijah",
    "Jatu Dwi Cahyanti",
    "Suyitno",
    "Amelia Dewi",
    "Imroatu Sholikhati",
    "Irma Miftahulami",
    "Risky Adika",
    "Firiesta Nur Rachmi",
    "Endang Elok",
    "Migawati",
    "Sindy Maulanisa"
  ],

  "2026-09-12": [
    "Erni Kurniawati",
    "Fetty Trisnayanti",
    "Nur Aini (Promkes)",
    "drg. Rendi",
    "Revina Dyah",
    "Ristiani",
    "Audya Arum Sari",
    "Wahdah",
    "Jatu Dwi Cahyanti",
    "Amelia Dewi",
    "Imroatu Sholikhati",
    "Irma Miftahulami",
    "Risky Adika",
    "Firiesta Nur Rachmi",
    "Endang Elok",
    "Dian Ika Pratiwi",
    "Sindy Maulanisa",
    "Purwo Febri Yanto"
  ]
};

function getEmployeeId(name) {
  const result = db.exec(
    `
    SELECT id
    FROM employees
    WHERE name = ?
    `,
    [name]
  );

  if (
    !result.length ||
    !result[0].values.length
  ) {
    throw new Error(
      `Pegawai tidak ditemukan: ${name}`
    );
  }

  return result[0].values[0][0];
}

/*
 * Validasi semua nama terlebih dahulu.
 * Database belum diubah pada tahap ini.
 */
for (const [date, names] of Object.entries(recap)) {
  const seen = new Set();

  for (const name of names) {
    if (seen.has(name)) {
      throw new Error(
        `Nama ganda pada ${date}: ${name}`
      );
    }

    seen.add(name);

    getEmployeeId(name);
  }
}

db.run("BEGIN TRANSACTION");

try {
  for (const [date, names] of Object.entries(recap)) {

    /*
     * Jadikan tanggal sebagai hari kerja yang sudah direkap.
     */
    db.run(
      `
      INSERT INTO attendance_days (
        attendance_date,
        status
      )
      VALUES (?, 'WORKDAY')
      ON CONFLICT(attendance_date)
      DO UPDATE SET
        status = 'WORKDAY',
        updated_at = CURRENT_TIMESTAMP
      `,
      [date]
    );

    /*
     * Replace isi tanggal ini agar script idempotent.
     */
    db.run(
      `
      DELETE FROM attendance
      WHERE attendance_date = ?
      `,
      [date]
    );

    for (const name of names) {
      const employeeId =
        getEmployeeId(name);

      db.run(
        `
        INSERT INTO attendance (
          employee_id,
          attendance_date
        )
        VALUES (?, ?)
        `,
        [
          employeeId,
          date
        ]
      );
    }
  }

  db.run("COMMIT");
}
catch (error) {
  db.run("ROLLBACK");
  throw error;
}

/*
 * Verifikasi hasil.
 */
console.log("");
console.log("Hasil import:");

for (const date of Object.keys(recap)) {
  const result = db.exec(
    `
    SELECT COUNT(*)
    FROM attendance
    WHERE attendance_date = ?
    `,
    [date]
  );

  const count =
    result[0].values[0][0];

  console.log(
    `${date}: ${count} pegawai`
  );
}

const binary = db.export();

fs.writeFileSync(
  dbFile,
  Buffer.from(binary)
);

db.close();

console.log("");
console.log("Database berhasil diperbarui.");