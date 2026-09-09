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

    if (fs.existsSync(DB_FILE)) {
        const fileBuffer = fs.readFileSync(DB_FILE);
        return new SQL.Database(fileBuffer);
    }

    return new SQL.Database();
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
