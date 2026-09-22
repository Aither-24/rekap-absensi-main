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

    ensureEmployeeRoleSchema(db);
    ensureAttendanceDaySchema(db);
    ensureScheduleSchema(db);

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


function ensureEmployeeRoleSchema(db: Database): void {
    const employeeTable = db.exec(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = 'employees'
      LIMIT 1;
    `);

    if (employeeTable.length === 0 || employeeTable[0].values.length === 0) {
        return;
    }

    const columns = db.exec(`PRAGMA table_info(employees);`);
    const hasRole = columns.length > 0 && columns[0].values.some((row) => String(row[1]) === "role");

    if (!hasRole) {
        db.run(`ALTER TABLE employees ADD COLUMN role TEXT;`);
    }
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


function ensureScheduleSchema(db: Database): void {

    // =====================================================
    // MASTER KATEGORI JADWAL
    // =====================================================

    db.run(`
      CREATE TABLE IF NOT EXISTS schedule_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 999,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // =====================================================
    // TAMBAHKAN schedule_category_id KE employees
    // =====================================================

    const employeeColumns = db.exec(`
      PRAGMA table_info(employees);
    `);

    const hasScheduleCategory =
      employeeColumns.length > 0 &&
      employeeColumns[0].values.some(
        (row) => row[1] === "schedule_category_id"
      );

    if (!hasScheduleCategory) {
      db.run(`
        ALTER TABLE employees
        ADD COLUMN schedule_category_id INTEGER;
      `);
    }

    // =====================================================
    // PERIODE JADWAL
    // =====================================================

    db.run(`
      CREATE TABLE IF NOT EXISTS schedule_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        schedule_year INTEGER NOT NULL,

        schedule_month INTEGER NOT NULL
          CHECK(schedule_month BETWEEN 1 AND 12),

        status TEXT NOT NULL DEFAULT 'DRAFT'
          CHECK(status IN ('DRAFT', 'FINAL')),

        source_period_id INTEGER,

        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(schedule_year, schedule_month),

        FOREIGN KEY(source_period_id)
          REFERENCES schedule_periods(id)
      );
    `);

    // =====================================================
    // JADWAL HARIAN PEGAWAI
    // =====================================================

    db.run(`
      CREATE TABLE IF NOT EXISTS work_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        period_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,

        schedule_date TEXT NOT NULL,

        /*
         * Kode disimpan mentah.
         * Belum ada interpretasi arti shift.
         */
        schedule_code TEXT NOT NULL,

        source TEXT NOT NULL DEFAULT 'MANUAL'
          CHECK(source IN (
            'MANUAL',
            'IMPORT',
            'GENERATED'
          )),

        is_locked INTEGER NOT NULL DEFAULT 0
          CHECK(is_locked IN (0, 1)),

        notes TEXT,

        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY(period_id)
          REFERENCES schedule_periods(id),

        FOREIGN KEY(employee_id)
          REFERENCES employees(id),

        UNIQUE(employee_id, schedule_date)
      );
    `);

    // =====================================================
    // INDEX
    // =====================================================

    db.run(`
      CREATE INDEX IF NOT EXISTS
        idx_employees_schedule_category
      ON employees(schedule_category_id);
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS
        idx_work_schedules_date
      ON work_schedules(schedule_date);
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS
        idx_work_schedules_employee
      ON work_schedules(employee_id);
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS
        idx_work_schedules_period
      ON work_schedules(period_id);
    `);

    // =====================================================
    // KATEGORI AWAL
    // =====================================================

    const categories = [
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
    ] as const;

    for (const [code, name, sortOrder] of categories) {
      db.run(
        `
        INSERT OR IGNORE INTO schedule_categories (
          code,
          name,
          sort_order
        )
        VALUES (?, ?, ?);
        `,
        [
          code,
          name,
          sortOrder,
        ]
      );
    }

    // =====================================================
    // BERSIHKAN TABEL PROFIL LAMA JIKA PERNAH TERBUAT
    // =====================================================

    db.run(`
      DROP TABLE IF EXISTS employee_schedule_profiles;
    `);

    // shift_codes sengaja tidak dibuat / dihapus
    db.run(`
      DROP TABLE IF EXISTS shift_codes;
    `);
}
