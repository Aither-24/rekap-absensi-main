import type { Database } from "sql.js";

export type DayStatus = "WORKDAY" | "HOLIDAY";

export interface DayStatusRecord {
  date: string;
  status: DayStatus;
}

export function getDayStatus(db: Database, date: string): DayStatus | null {
  const result = db.exec(`
    SELECT status
    FROM attendance_days
    WHERE attendance_date = '${escapeSql(date)}'
    LIMIT 1;
  `);

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const status = String(result[0].values[0][0]);
  return status === "HOLIDAY" ? "HOLIDAY" : "WORKDAY";
}

export function setDayStatus(db: Database, date: string, status: DayStatus): void {
  if (status === "HOLIDAY") {
    db.run(`
      DELETE FROM attendance
      WHERE attendance_date = '${escapeSql(date)}';
    `);
  }

  db.run(`
    INSERT INTO attendance_days (
      attendance_date,
      status,
      updated_at
    ) VALUES (
      '${escapeSql(date)}',
      '${status}',
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(attendance_date) DO UPDATE SET
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP;
  `);
}

export function getDayStatuses(
  db: Database,
  start: string,
  end: string,
): DayStatusRecord[] {
  const result = db.exec(`
    SELECT attendance_date, status
    FROM attendance_days
    WHERE attendance_date BETWEEN '${escapeSql(start)}' AND '${escapeSql(end)}'
    ORDER BY attendance_date ASC;
  `);

  if (result.length === 0) {
    return [];
  }

  return result[0].values.map((row) => ({
    date: String(row[0]),
    status: String(row[1]) === "HOLIDAY" ? "HOLIDAY" : "WORKDAY",
  }));
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}
