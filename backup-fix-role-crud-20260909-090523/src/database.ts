import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "absensi.sqlite");

export async function getDatabase(): Promise<Database> {
    const SQL = await initSqlJs({
        locateFile: (file) =>
            path.join(process.cwd(), "node_modules/sql.js/dist", file),
    });

    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }

    let db: Database;

    if (fs.existsSync(DB_FILE)) {
        const fileBuffer = fs.readFileSync(DB_FILE);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    ensureAttendanceDaySchema(db);
    ensureEmployeeRoleSchema(db);

    if (fs.existsSync(DB_FILE)) {
        saveDatabase(db);
    }

    return db;
}

export function saveDatabase(db: Database): void {
    const data = db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
}

export function runInTransaction<T>(db: Database, operation: () => T): T {
    db.run("BEGIN TRANSACTION;");
    try {
        const result = operation();
        db.run("COMMIT;");
        return result;
    } catch (error) {
        try {
            db.run("ROLLBACK;");
        } catch {
            // Abaikan error rollback agar error utama tetap diteruskan.
        }
        throw error;
    }
}

export function getDatabaseBuffer(db: Database): Buffer {
    return Buffer.from(db.export());
}


function ensureAttendanceDaySchema(db: Database): void {
    db.run(`
      CREATE TABLE IF NOT EXISTS attendance_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attendance_date TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK(status IN ('WORKDAY', 'HOLIDAY')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Backfill seluruh tanggal rekap lama sebagai hari kerja jika tabel attendance tersedia.
    const attendanceTable = db.exec(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = 'attendance'
      LIMIT 1;
    `);

    if (attendanceTable.length > 0 && attendanceTable[0].values.length > 0) {
        db.run(`
          INSERT OR IGNORE INTO attendance_days (attendance_date, status)
          SELECT DISTINCT attendance_date, 'WORKDAY'
          FROM attendance;
        `);
    }

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_attendance_days_date
      ON attendance_days(attendance_date);
    `);
}


function ensureEmployeeRoleSchema(db: Database): void {
    const tableInfo = db.exec("PRAGMA table_info(employees);");

    if (tableInfo.length === 0) {
        return;
    }

    const columns = tableInfo[0].values.map((row) => String(row[1]));

    if (!columns.includes("role")) {
        db.run("ALTER TABLE employees ADD COLUMN role TEXT;");
    }
}
