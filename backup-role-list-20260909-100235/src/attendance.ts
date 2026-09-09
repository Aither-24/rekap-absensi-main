import type { Database } from "sql.js";
import { findEmployee, findOrCreateEmployee } from "./employee.js";

export interface AttendanceResult {
  employee: string;
  date: string;
  added: boolean;
}

export function addLateAttendance(
  db: Database,
  name: string,
  date: string
): AttendanceResult {
  const employee = findOrCreateEmployee(db, name);

  const existing = db.exec(`
    SELECT id
    FROM attendance
    WHERE employee_id = ${employee.id}
      AND attendance_date = '${escapeSql(date)}';
  `);

  if (existing.length > 0 && existing[0].values.length > 0) {
    return {
      employee: employee.name,
      date,
      added: false,
    };
  }

  db.run(`
    INSERT INTO attendance (
      employee_id,
      attendance_date
    )
    VALUES (
      ${employee.id},
      '${escapeSql(date)}'
    );
  `);

  return {
    employee: employee.name,
    date,
    added: true,
  };
}

export function replaceLateAttendance(
  db: Database,
  date: string,
  names: string[],
): void {
  db.run(`
    DELETE FROM attendance
    WHERE attendance_date = '${escapeSql(date)}';
  `);

  for (const name of names) {
    addLateAttendance(db, name, date);
  }
}

export function deleteLateAttendance(
  db: Database,
  date: string,
  name: string,
): boolean {
  const employee = findEmployee(db, name);

  if (!employee) {
    return false;
  }

  const existing = db.exec(`
    SELECT id
    FROM attendance
    WHERE employee_id = ${employee.id}
      AND attendance_date = '${escapeSql(date)}'
    LIMIT 1;
  `);

  if (existing.length === 0 || existing[0].values.length === 0) {
    return false;
  }

  db.run(`
    DELETE FROM attendance
    WHERE employee_id = ${employee.id}
      AND attendance_date = '${escapeSql(date)}';
  `);

  return true;
}

export function getTotalLate(
  db: Database,
  name: string,
): number {
  const employee = findOrCreateEmployee(db, name);

  const result = db.exec(`
    SELECT COUNT(*)
    FROM attendance
    WHERE employee_id = ${employee.id};
  `);

  if (result.length === 0) {
    return 0;
  }

  return Number(result[0].values[0][0]);
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}
