import type { Database } from "sql.js";
import { getTodayIndonesia, getCurrentMonthRange } from "./date.js";
import { getDayStatus, getDayStatuses, type DayStatus } from "./day-status.js";
import type { EmployeeRole } from "./employee.js";

const ROLE_ORDER = `CASE e.role
  WHEN 'PEGAWAI_TETAP' THEN 1
  WHEN 'PKWT' THEN 2
  WHEN 'TENAGA_AHLI' THEN 3
  WHEN 'MAGANG' THEN 4
  ELSE 5
END`;

export interface EmployeeReport {
  employeeId: number;
  name: string;
  role: EmployeeRole | null;
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
    SELECT e.id, e.name, e.role, COUNT(a.id) AS total
    FROM employees e
    INNER JOIN attendance a
      ON a.employee_id = e.id
      AND a.attendance_date BETWEEN '${start}' AND '${end}'
    WHERE LOWER(e.name) LIKE LOWER('%${escapedName}%')
    GROUP BY e.id, e.name, e.role
    ORDER BY ${ROLE_ORDER} ASC, e.name COLLATE NOCASE ASC;
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
      role: row[2] == null ? null : (String(row[2]) as EmployeeRole),
      total: Number(row[3]),
      dates: dateResult.length > 0 ? dateResult[0].values.map((v) => String(v[0])) : [],
    };
  });
}

export interface MonthlyReport {
  employeeId: number;
  name: string;
  role: EmployeeRole | null;
  total: number;
  dates: string[];
}

export function getMonthlyReport(
  db: Database,
  referenceDate: string = getTodayIndonesia(),
): MonthlyReport[] {
  const { start, end } = getCurrentMonthRange(referenceDate);
  const result = db.exec(`
    SELECT e.id, e.name, e.role, COUNT(a.id) AS total
    FROM employees e
    LEFT JOIN attendance a
      ON a.employee_id = e.id
      AND a.attendance_date BETWEEN '${start}' AND '${end}'
    GROUP BY e.id, e.name, e.role
    ORDER BY ${ROLE_ORDER} ASC, e.name COLLATE NOCASE ASC;
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
      role: row[2] == null ? null : (String(row[2]) as EmployeeRole),
      total: Number(row[3]),
      dates: dateResult.length > 0 ? dateResult[0].values.map((v) => String(v[0])) : [],
    };
  });
}

export interface DailySummary {
  date: string;
  total: number;
  names: string[];
  status: DayStatus | null;
}

export function getMonthlyDailySummaries(
  db: Database,
  referenceDate: string = getTodayIndonesia(),
): DailySummary[] {
  const { start, end } = getCurrentMonthRange(referenceDate);
  const statuses = getDayStatuses(db, start, end);

  return statuses
    .map(({ date, status }) => {
      const namesResult = db.exec(`
        SELECT e.name
        FROM attendance a
        INNER JOIN employees e ON e.id = a.employee_id
        WHERE a.attendance_date = '${escapeSql(date)}'
        ORDER BY ${ROLE_ORDER} ASC, e.name COLLATE NOCASE ASC;
      `);

      const names = namesResult.length > 0
        ? namesResult[0].values.map((v) => String(v[0]))
        : [];

      return {
        date,
        total: status === "HOLIDAY" ? 0 : names.length,
        names: status === "HOLIDAY" ? [] : names,
        status,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface DailyReport {
  date: string;
  names: string[];
  status: DayStatus | null;
}

export function getDailyReport(db: Database, date: string): DailyReport {
  const safeDate = escapeSql(date);
  const result = db.exec(`
    SELECT e.name
    FROM employees e
    INNER JOIN attendance a ON a.employee_id = e.id
    WHERE a.attendance_date = '${safeDate}'
    ORDER BY ${ROLE_ORDER} ASC, e.name COLLATE NOCASE ASC;
  `);
  return {
    date,
    names: result.length > 0 ? result[0].values.map((row) => String(row[0])) : [],
    status: getDayStatus(db, date),
  };
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}
