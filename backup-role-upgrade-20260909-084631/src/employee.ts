import type { Database } from "sql.js";
import { runInTransaction } from "./database.js";

export interface Employee {
  id: number;
  name: string;
  unit: string | null;
}

export interface EmployeeListItem extends Employee {
  totalLate: number;
}
export interface SimilarEmployee extends Employee {
  similarity: number;
}

function normalizeEmployeeName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("id-ID")
    .replace(/\s+/g, " ");
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;

  const matrix: number[][] = Array.from(
    { length: rows },
    () => Array(cols).fill(0),
  );

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function calculateNameSimilarity(a: string, b: string): number {
  const left = normalizeEmployeeName(a);
  const right = normalizeEmployeeName(b);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;

  if (
    shorter.length >= 4 &&
    (
      longer.startsWith(`${shorter} `) ||
      longer.endsWith(` ${shorter}`) ||
      longer.includes(` ${shorter} `)
    )
  ) {
    return 0.95;
  }

  const distance = levenshteinDistance(left, right);
  const maxLength = Math.max(left.length, right.length);

  if (maxLength === 0) {
    return 1;
  }

  return 1 - distance / maxLength;
}

export function findSimilarEmployees(
  db: Database,
  name: string,
  excludeId: number | null = null,
): SimilarEmployee[] {
  const cleanName = name.trim();

  if (!cleanName) {
    return [];
  }

  const employees = getEmployees(db);

  return employees
    .filter((employee) => excludeId === null || employee.id !== excludeId)
    .map((employee) => ({
      id: employee.id,
      name: employee.name,
      unit: employee.unit,
      similarity: calculateNameSimilarity(cleanName, employee.name),
    }))
    .filter((employee) => employee.similarity >= 0.85)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

export function findEmployee(
  db: Database,
  name: string,
): Employee | null {
  const result = db.exec(`
    SELECT id, name, unit
    FROM employees
    WHERE LOWER(name) = LOWER('${escapeSql(name)}')
    LIMIT 1;
  `);

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const row = result[0].values[0];

  return {
    id: Number(row[0]),
    name: String(row[1]),
    unit: row[2] === null ? null : String(row[2]),
  };
}

export function findEmployeeById(
  db: Database,
  id: number,
): Employee | null {
  const result = db.exec(`
    SELECT id, name, unit
    FROM employees
    WHERE id = ${Number(id)}
    LIMIT 1;
  `);

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const row = result[0].values[0];

  return {
    id: Number(row[0]),
    name: String(row[1]),
    unit: row[2] === null ? null : String(row[2]),
  };
}

export function getEmployees(db: Database): EmployeeListItem[] {
  const result = db.exec(`
    SELECT
      e.id,
      e.name,
      e.unit,
      COUNT(a.id) AS total_late
    FROM employees e
    LEFT JOIN attendance a ON a.employee_id = e.id
    GROUP BY e.id, e.name, e.unit
    ORDER BY e.name ASC;
  `);

  if (result.length === 0) {
    return [];
  }

  return result[0].values.map((row) => ({
    id: Number(row[0]),
    name: String(row[1]),
    unit: row[2] === null ? null : String(row[2]),
    totalLate: Number(row[3]),
  }));
}

export function createEmployee(
  db: Database,
  name: string,
  unit: string | null = null,
): Employee {
  const cleanName = name.trim();
  const cleanUnit = unit?.trim() || null;

  if (!cleanName) {
    throw new Error("Nama pegawai wajib diisi.");
  }

  if (findEmployee(db, cleanName)) {
    throw new Error("Pegawai dengan nama tersebut sudah ada.");
  }

  db.run(`
    INSERT INTO employees (name, unit)
    VALUES (
      '${escapeSql(cleanName)}',
      ${cleanUnit === null ? "NULL" : `'${escapeSql(cleanUnit)}'`}
    );
  `);

  const employee = findEmployee(db, cleanName);

  if (!employee) {
    throw new Error(`Gagal membuat pegawai: ${cleanName}`);
  }

  return employee;
}

export function updateEmployee(
  db: Database,
  id: number,
  name: string,
  unit: string | null = null,
): Employee {
  const existing = findEmployeeById(db, id);

  if (!existing) {
    throw new Error("Pegawai tidak ditemukan.");
  }

  const cleanName = name.trim();
  const cleanUnit = unit?.trim() || null;

  if (!cleanName) {
    throw new Error("Nama pegawai wajib diisi.");
  }

  const duplicate = findEmployee(db, cleanName);
  if (duplicate && duplicate.id !== id) {
    throw new Error("Pegawai dengan nama tersebut sudah ada.");
  }

  db.run(`
    UPDATE employees
    SET
      name = '${escapeSql(cleanName)}',
      unit = ${cleanUnit === null ? "NULL" : `'${escapeSql(cleanUnit)}'`}
    WHERE id = ${Number(id)};
  `);

  const updated = findEmployeeById(db, id);

  if (!updated) {
    throw new Error("Gagal memperbarui data pegawai.");
  }

  return updated;
}

export function deleteEmployee(db: Database, id: number): void {
  const employee = findEmployeeById(db, id);

  if (!employee) {
    throw new Error("Pegawai tidak ditemukan.");
  }

  runInTransaction(db, () => {
    db.run(`DELETE FROM attendance WHERE employee_id = ${Number(id)};`);
    db.run(`DELETE FROM employees WHERE id = ${Number(id)};`);
  });
}

export function findOrCreateEmployee(
  db: Database,
  name: string,
  unit: string | null = null,
): Employee {
  const existing = findEmployee(db, name);

  if (existing) {
    return existing;
  }

  return createEmployee(db, name, unit);
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}
