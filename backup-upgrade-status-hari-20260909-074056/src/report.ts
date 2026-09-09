import type { Database } from "sql.js";
import { getTodayIndonesia, getCurrentMonthRange } from "./date.js";

export interface EmployeeReport {
  employeeId: number;
  name: string;
  total: number;
  dates: string[];
}

export function getEmployeeReport(
  db: Database,
  searchName: string,
  referenceDate: string = getTodayIndonesia(),
): EmployeeReport[] {
  const { start, end } = getCurrentMonthRange(referenceDate);
  const escapedName = escapeSql(searchName);
  const result = db.exec(`
    SELECT e.id, e.name, COUNT(a.id) AS total
    FROM employees e
    INNER JOIN attendance a
      ON a.employee_id = e.id
      AND a.attendance_date BETWEEN '${start}' AND '${end}'
    WHERE LOWER(e.name) LIKE LOWER('%${escapedName}%')
    GROUP BY e.id, e.name
    ORDER BY total DESC, e.name ASC;
  `);

  if (result.length === 0 || result[0].values.length === 0) return [];

  return result[0].values.map((row) => {
    const employeeId = Number(row[0]);
    const name = String(row[1]);
    const total = Number(row[2]);
    const dateResult = db.exec(`
      SELECT attendance_date FROM attendance
      WHERE employee_id = ${employeeId}
        AND attendance_date BETWEEN '${start}' AND '${end}'
      ORDER BY attendance_date ASC;
    `);
    return {
      employeeId,
      name,
      total,
      dates: dateResult.length > 0 ? dateResult[0].values.map((v) => String(v[0])) : [],
    };
  });
}

export interface MonthlyReport {
  employeeId: number;
  name: string;
  unit: string | null;
  total: number;
  dates: string[];
}

export function getMonthlyReport(
  db: Database,
  referenceDate: string = getTodayIndonesia(),
): MonthlyReport[] {
  const { start, end } = getCurrentMonthRange(referenceDate);
  const result = db.exec(`
    SELECT e.id, e.name, e.unit, COUNT(a.id) AS total
    FROM employees e
    LEFT JOIN attendance a
      ON a.employee_id = e.id
      AND a.attendance_date BETWEEN '${start}' AND '${end}'
    GROUP BY e.id, e.name, e.unit
    ORDER BY total DESC, e.name ASC;
  `);
  if (result.length === 0 || result[0].values.length === 0) return [];

  return result[0].values.map((row) => {
    const employeeId = Number(row[0]);
    const dateResult = db.exec(`
      SELECT attendance_date FROM attendance
      WHERE employee_id = ${employeeId}
        AND attendance_date BETWEEN '${start}' AND '${end}'
      ORDER BY attendance_date ASC;
    `);
    return {
      employeeId,
      name: String(row[1]),
      unit: row[2] == null ? null : String(row[2]),
      total: Number(row[3]),
      dates: dateResult.length > 0 ? dateResult[0].values.map((v) => String(v[0])) : [],
    };
  });
}

export interface DailySummary {
  date: string;
  total: number;
  names: string[];
}

export function getMonthlyDailySummaries(
  db: Database,
  referenceDate: string = getTodayIndonesia(),
): DailySummary[] {
  const { start, end } = getCurrentMonthRange(referenceDate);
  const result = db.exec(`
    SELECT a.attendance_date, COUNT(a.id) AS total
    FROM attendance a
    WHERE a.attendance_date BETWEEN '${start}' AND '${end}'
    GROUP BY a.attendance_date
    ORDER BY a.attendance_date DESC;
  `);
  if (result.length === 0 || result[0].values.length === 0) return [];

  return result[0].values.map((row) => {
    const date = String(row[0]);
    const namesResult = db.exec(`
      SELECT e.name
      FROM attendance a
      INNER JOIN employees e ON e.id = a.employee_id
      WHERE a.attendance_date = '${escapeSql(date)}'
      ORDER BY e.name ASC;
    `);
    return {
      date,
      total: Number(row[1]),
      names: namesResult.length > 0 ? namesResult[0].values.map((v) => String(v[0])) : [],
    };
  });
}

export interface DailyReport { date: string; names: string[]; }
export function getDailyReport(db: Database, date: string): DailyReport {
  const safeDate = escapeSql(date);
  const result = db.exec(`
    SELECT e.name
    FROM employees e
    INNER JOIN attendance a ON a.employee_id = e.id
    WHERE a.attendance_date = '${safeDate}'
    ORDER BY e.name ASC;
  `);
  return {
    date,
    names: result.length > 0 ? result[0].values.map((row) => String(row[0])) : [],
  };
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}
