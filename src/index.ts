import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { getDatabase, getDatabaseBuffer, runInTransaction, saveDatabase } from "./database.js";
import {
  addLateAttendance,
  deleteLateAttendance,
  replaceLateAttendance,
} from "./attendance.js";
import {
  createEmployee,
  deleteEmployee,
  findSimilarEmployees,
  getEmployees,
  updateEmployee,
} from "./employee.js";
import {
  getDailyReport,
  getEmployeeReport,
  getMonthlyReport,
  getMonthlyDailySummaries,
} from "./report.js";
import { isValidDate, isValidMonth } from "./date.js";
import { createMonthlyWorkbook } from "./xlsx.js";
import { getDayStatus, getDayStatuses, setDayStatus, type DayStatus } from "./day-status.js";
import { getCurrentMonthRange } from "./date.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  data: unknown,
): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function sendFile(
  res: http.ServerResponse,
  filePath: string,
  contentType: string,
): void {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 - File tidak ditemukan.");
    return;
  }

  res.writeHead(200, { "Content-Type": contentType });
  res.end(fs.readFileSync(filePath));
}

function getContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Format JSON tidak valid."));
      }
    });

    req.on("error", reject);
  });
}


function hasValidDate(value: unknown): value is string {
  return typeof value === "string" && isValidDate(value);
}

function hasValidMonth(value: unknown): value is string {
  return typeof value === "string" && isValidMonth(value);
}

function cleanNames(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const seen = new Set<string>();
  const names: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const name = item.trim();
    const key = name.toLocaleLowerCase("id-ID");

    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  }

  return names;
}

async function main() {
  const db = await getDatabase();

  console.log("================================");
  console.log("       REKAP ABSENSI WEB");
  console.log("================================");
  console.log(`Web: http://localhost:${PORT}`);
  console.log(`Public: ${PUBLIC_DIR}`);
  console.log("================================");

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(
        req.url ?? "/",
        `http://${req.headers.host ?? "localhost"}`,
      );

      // ==================================================
      // DASHBOARD
      // ==================================================
      if (req.method === "GET" && url.pathname === "/api/dashboard") {
        const reports = getEmployeeReport(db, "");
        const employees = getEmployees(db);
        const now = new Date();
        const monthNames = [
          "Januari",
          "Februari",
          "Maret",
          "April",
          "Mei",
          "Juni",
          "Juli",
          "Agustus",
          "September",
          "Oktober",
          "November",
          "Desember",
        ];

        const referenceDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const dailySummaries = getMonthlyDailySummaries(db, referenceDate);

        sendJson(res, 200, {
          success: true,
          month: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,
          referenceDate,
          employeeCount: employees.length,
          lateEmployeeCount: reports.length,
          totalLate: reports.reduce((sum, report) => sum + report.total, 0),
          reports,
          dailySummaries,
          recentDays: dailySummaries.filter((item) => item.status === "WORKDAY" && item.total > 0).slice(0, 3),
        });
        return;
      }

      // ==================================================
      // REKAP HARIAN
      // GET /api/daily?date=YYYY-MM-DD
      // PUT /api/daily { date, employeeNames }
      // ==================================================
      if (url.pathname === "/api/daily" && req.method === "GET") {
        const date = url.searchParams.get("date");

        if (!hasValidDate(date)) {
          sendJson(res, 400, {
            success: false,
            error: "Tanggal wajib diisi dengan format YYYY-MM-DD.",
          });
          return;
        }

        const report = getDailyReport(db, date);
        sendJson(res, 200, {
          success: true,
          date: report.date,
          names: report.names,
          total: report.names.length,
          status: report.status,
          processed: report.status !== null,
        });
        return;
      }

      if (url.pathname === "/api/daily" && req.method === "PUT") {
        const body = await parseJsonBody(req);
        const date = body.date;
        const employeeNames = cleanNames(body.employeeNames);

        if (!hasValidDate(date)) {
          sendJson(res, 400, {
            success: false,
            error: "Tanggal wajib diisi dengan format YYYY-MM-DD.",
          });
          return;
        }

        if (employeeNames === null) {
          sendJson(res, 400, {
            success: false,
            error: "Daftar pegawai tidak valid.",
          });
          return;
        }

        const requestedStatus: DayStatus = body.status === "HOLIDAY" ? "HOLIDAY" : "WORKDAY";

        runInTransaction(db, () => {
          if (requestedStatus === "HOLIDAY") {
            setDayStatus(db, date, "HOLIDAY");
          } else {
            replaceLateAttendance(db, date, employeeNames);
            setDayStatus(db, date, "WORKDAY");
          }
        });
        saveDatabase(db);

        sendJson(res, 200, {
          success: true,
          message: "Rekap harian berhasil diperbarui.",
          date,
          total: requestedStatus === "HOLIDAY" ? 0 : employeeNames.length,
          status: requestedStatus,
        });
        return;
      }

      // ==================================================
      // ABSENSI
      // POST /api/attendance
      // DELETE /api/attendance?date=YYYY-MM-DD&name=Nama
      // ==================================================
      if (url.pathname === "/api/attendance" && req.method === "POST") {
        const body = await parseJsonBody(req);
        const attendanceDate = body.attendanceDate;
        const employeeNames = cleanNames(body.employeeNames);

        if (!hasValidDate(attendanceDate)) {
          sendJson(res, 400, {
            success: false,
            error: "Tanggal keterlambatan wajib diisi dengan format YYYY-MM-DD.",
          });
          return;
        }

        if (employeeNames === null || employeeNames.length === 0) {
          sendJson(res, 400, {
            success: false,
            error: "Minimal satu nama pegawai harus diisi.",
          });
          return;
        }

        // Pengamanan:
        // Tambah Rekap hanya boleh digunakan untuk tanggal yang belum pernah diisi.
        // Koreksi tanggal yang sudah ada harus melalui PUT /api/daily (Edit Rekap).
        const existingStatus = getDayStatus(db, attendanceDate);

        if (existingStatus !== null) {
          sendJson(res, 409, {
            success: false,
            error:
              "Tanggal tersebut sudah memiliki rekap. Gunakan menu Edit Rekap untuk melakukan perubahan.",
          });
          return;
        }

        let addedCount = 0;
        let duplicateCount = 0;

        runInTransaction(db, () => {
          for (const employeeName of employeeNames) {
            const result = addLateAttendance(db, employeeName, attendanceDate);
            result.added ? addedCount++ : duplicateCount++;
          }
          setDayStatus(db, attendanceDate, "WORKDAY");
        });

        saveDatabase(db);
        sendJson(res, 200, {
          success: true,
          message: "Data berhasil disimpan.",
          date: attendanceDate,
          addedCount,
          duplicateCount,
          total: employeeNames.length,
        });
        return;
      }

      if (url.pathname === "/api/attendance" && req.method === "DELETE") {
        const date = url.searchParams.get("date");
        const name = url.searchParams.get("name")?.trim();

        if (!hasValidDate(date) || !name) {
          sendJson(res, 400, {
            success: false,
            error: "Tanggal dan nama pegawai wajib diisi.",
          });
          return;
        }

        const deleted = deleteLateAttendance(db, date, name);

        if (!deleted) {
          sendJson(res, 404, {
            success: false,
            error: "Data keterlambatan tidak ditemukan.",
          });
          return;
        }

        saveDatabase(db);
        sendJson(res, 200, {
          success: true,
          message: `Data ${name} pada ${date} berhasil dihapus.`,
        });
        return;
      }

      // ==================================================
      // STATUS HARI
      // POST /api/day-status { date, status }
      // ==================================================
      if (url.pathname === "/api/day-status" && req.method === "POST") {
        const body = await parseJsonBody(req);
        const date = body.date;
        const status = body.status;

        if (!hasValidDate(date)) {
          sendJson(res, 400, { success: false, error: "Tanggal tidak valid." });
          return;
        }

        if (status !== "WORKDAY" && status !== "HOLIDAY") {
          sendJson(res, 400, { success: false, error: "Status hari tidak valid." });
          return;
        }

        const existing = getDayStatus(db, date);
        if (existing !== null) {
          sendJson(res, 409, {
            success: false,
            error: "Tanggal tersebut sudah direkap. Gunakan menu Edit Rekap untuk mengubah status hari.",
          });
          return;
        }

        runInTransaction(db, () => {
          setDayStatus(db, date, status);
        });
        saveDatabase(db);

        sendJson(res, 201, { success: true, date, status });
        return;
      }

      // ==================================================
      // PEGAWAI
      // ==================================================
      if (url.pathname === "/api/employees" && req.method === "GET") {
        sendJson(res, 200, {
          success: true,
          employees: getEmployees(db),
        });
        return;
      }
      if (url.pathname === "/api/employees/similar" && req.method === "GET") {
        const name = url.searchParams.get("name")?.trim() ?? "";
        const excludeIdRaw = url.searchParams.get("excludeId");

        if (!name) {
          sendJson(res, 200, {
            success: true,
            matches: [],
          });
          return;
        }

        let excludeId: number | null = null;

        if (excludeIdRaw) {
          const parsedId = Number(excludeIdRaw);

          if (Number.isInteger(parsedId) && parsedId > 0) {
            excludeId = parsedId;
          }
        }

        sendJson(res, 200, {
          success: true,
          matches: findSimilarEmployees(db, name, excludeId),
        });
        return;
      }

      if (url.pathname === "/api/employees" && req.method === "POST") {
        const body = await parseJsonBody(req);

        if (typeof body.name !== "string" || !body.name.trim()) {
          sendJson(res, 400, { success: false, error: "Nama pegawai wajib diisi." });
          return;
        }

        try {
          const employee = createEmployee(
            db,
            body.name,
            body.role,
          );
          saveDatabase(db);
          sendJson(res, 201, {
            success: true,
            message: "Pegawai berhasil ditambahkan.",
            employee,
          });
        } catch (error) {
          sendJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : "Gagal menambah pegawai.",
          });
        }
        return;
      }

      
      // ==================================================
      // EMPLOYEE SCHEDULE CATEGORY API
      // ==================================================

      // GET /api/schedule-categories
      if (
        url.pathname === "/api/schedule-categories" &&
        req.method === "GET"
      ) {
        const result = db.exec(`
          SELECT
            id,
            code,
            name,
            sort_order
          FROM schedule_categories
          ORDER BY sort_order ASC, name ASC;
        `);

        const categories =
          result.length === 0
            ? []
            : result[0].values.map((row) => ({
                id: Number(row[0]),
                code: String(row[1]),
                name: String(row[2]),
                sortOrder: Number(row[3]),
              }));

        sendJson(res, 200, {
          success: true,
          categories,
        });

        return;
      }

      // GET /api/employee-schedule-categories
      if (
        url.pathname === "/api/employee-schedule-categories" &&
        req.method === "GET"
      ) {
        const result = db.exec(`
          SELECT
            e.id,
            e.name,
            e.schedule_category_id,
            sc.code,
            sc.name
          FROM employees e
          LEFT JOIN schedule_categories sc
            ON sc.id = e.schedule_category_id
          ORDER BY e.name COLLATE NOCASE ASC;
        `);

        const employees =
          result.length === 0
            ? []
            : result[0].values.map((row) => ({
                employeeId: Number(row[0]),
                employeeName: String(row[1]),
                scheduleCategoryId:
                  row[2] === null
                    ? null
                    : Number(row[2]),
                scheduleCategoryCode:
                  row[3] === null
                    ? null
                    : String(row[3]),
                scheduleCategoryName:
                  row[4] === null
                    ? null
                    : String(row[4]),
              }));

        sendJson(res, 200, {
          success: true,
          employees,
        });

        return;
      }

      // PUT /api/employees/:id/schedule-category
      const employeeScheduleCategoryMatch =
        url.pathname.match(
          /^\/api\/employees\/(\d+)\/schedule-category$/
        );

      if (
        employeeScheduleCategoryMatch &&
        req.method === "PUT"
      ) {
        const employeeId =
          Number(employeeScheduleCategoryMatch[1]);

        const body =
          await parseJsonBody(req);

        let categoryId: number | null = null;

        if (
          body.scheduleCategoryId !== null &&
          body.scheduleCategoryId !== "" &&
          body.scheduleCategoryId !== undefined
        ) {
          categoryId =
            Number(body.scheduleCategoryId);

          if (
            !Number.isInteger(categoryId) ||
            categoryId <= 0
          ) {
            sendJson(res, 400, {
              success: false,
              error:
                "Kategori jadwal tidak valid.",
            });

            return;
          }
        }

        const employeeCheck =
          db.exec(
            `
            SELECT id
            FROM employees
            WHERE id = ?;
            `,
            [employeeId]
          );

        if (
          employeeCheck.length === 0 ||
          employeeCheck[0].values.length === 0
        ) {
          sendJson(res, 404, {
            success: false,
            error: "Pegawai tidak ditemukan.",
          });

          return;
        }

        if (categoryId !== null) {
          const categoryCheck =
            db.exec(
              `
              SELECT id
              FROM schedule_categories
              WHERE id = ?;
              `,
              [categoryId]
            );

          if (
            categoryCheck.length === 0 ||
            categoryCheck[0].values.length === 0
          ) {
            sendJson(res, 400, {
              success: false,
              error:
                "Kategori jadwal tidak ditemukan.",
            });

            return;
          }
        }

        db.run(
          `
          UPDATE employees
          SET schedule_category_id = ?
          WHERE id = ?;
          `,
          [
            categoryId,
            employeeId,
          ]
        );

        sendJson(res, 200, {
          success: true,
          employeeId,
          scheduleCategoryId: categoryId,
        });

        return;
      }

      
      // ==================================================
      // SCHEDULE CATEGORY API FINAL
      // ==================================================

      if (
        url.pathname === "/api/schedule-categories" &&
        req.method === "GET"
      ) {
        const result = db.exec(`
          SELECT
            id,
            code,
            name,
            sort_order
          FROM schedule_categories
          ORDER BY sort_order ASC, name ASC;
        `);

        const categories =
          result.length === 0
            ? []
            : result[0].values.map((row) => ({
                id: Number(row[0]),
                code: String(row[1]),
                name: String(row[2]),
                sortOrder: Number(row[3]),
              }));

        sendJson(res, 200, {
          success: true,
          categories,
        });

        return;
      }

      if (
        url.pathname === "/api/employee-schedule-categories" &&
        req.method === "GET"
      ) {
        const result = db.exec(`
          SELECT
            e.id,
            e.name,
            e.schedule_category_id,
            sc.code,
            sc.name
          FROM employees e
          LEFT JOIN schedule_categories sc
            ON sc.id = e.schedule_category_id
          ORDER BY e.name COLLATE NOCASE ASC;
        `);

        const employees =
          result.length === 0
            ? []
            : result[0].values.map((row) => ({
                employeeId: Number(row[0]),
                employeeName: String(row[1]),
                scheduleCategoryId:
                  row[2] === null
                    ? null
                    : Number(row[2]),
                scheduleCategoryCode:
                  row[3] === null
                    ? null
                    : String(row[3]),
                scheduleCategoryName:
                  row[4] === null
                    ? null
                    : String(row[4]),
              }));

        sendJson(res, 200, {
          success: true,
          employees,
        });

        return;
      }

      const scheduleCategoryMatch =
        url.pathname.match(
          /^\/api\/employees\/(\d+)\/schedule-category$/
        );

      if (
        scheduleCategoryMatch &&
        req.method === "PUT"
      ) {
        const employeeId =
          Number(scheduleCategoryMatch[1]);

        const body =
          await parseJsonBody(req);

        let categoryId: number | null = null;

        if (
          body.scheduleCategoryId !== null &&
          body.scheduleCategoryId !== "" &&
          body.scheduleCategoryId !== undefined
        ) {
          categoryId =
            Number(body.scheduleCategoryId);

          if (
            !Number.isInteger(categoryId) ||
            categoryId <= 0
          ) {
            sendJson(res, 400, {
              success: false,
              error: "Kategori jadwal tidak valid.",
            });

            return;
          }
        }

        const employeeCheck =
          db.exec(`
            SELECT id
            FROM employees
            WHERE id = ${employeeId}
            LIMIT 1;
          `);

        if (
          employeeCheck.length === 0 ||
          employeeCheck[0].values.length === 0
        ) {
          sendJson(res, 404, {
            success: false,
            error: "Pegawai tidak ditemukan.",
          });

          return;
        }

        if (categoryId !== null) {
          const categoryCheck =
            db.exec(`
              SELECT id
              FROM schedule_categories
              WHERE id = ${categoryId}
              LIMIT 1;
            `);

          if (
            categoryCheck.length === 0 ||
            categoryCheck[0].values.length === 0
          ) {
            sendJson(res, 400, {
              success: false,
              error: "Kategori jadwal tidak ditemukan.",
            });

            return;
          }
        }

        db.run(`
          UPDATE employees
          SET schedule_category_id = ${
            categoryId === null
              ? "NULL"
              : categoryId
          }
          WHERE id = ${employeeId};
        `);

        saveDatabase(db);

        sendJson(res, 200, {
          success: true,
          employeeId,
          scheduleCategoryId: categoryId,
        });

        return;
      }

      const employeeMatch = url.pathname.match(/^\/api\/employees\/(\d+)$/);

      if (employeeMatch && req.method === "PUT") {
        const id = Number(employeeMatch[1]);
        const body = await parseJsonBody(req);

        if (typeof body.name !== "string" || !body.name.trim()) {
          sendJson(res, 400, { success: false, error: "Nama pegawai wajib diisi." });
          return;
        }

        try {
          const employee = updateEmployee(
            db,
            id,
            body.name,
            body.role,
          );
          saveDatabase(db);
          sendJson(res, 200, {
            success: true,
            message: "Data pegawai berhasil diperbarui.",
            employee,
          });
        } catch (error) {
          sendJson(res, 400, {
            success: false,
            error: error instanceof Error ? error.message : "Gagal memperbarui pegawai.",
          });
        }
        return;
      }

      if (employeeMatch && req.method === "DELETE") {
        const id = Number(employeeMatch[1]);

        try {
          deleteEmployee(db, id);
          saveDatabase(db);
          sendJson(res, 200, {
            success: true,
            message: "Pegawai dan seluruh riwayat keterlambatannya berhasil dihapus.",
          });
        } catch (error) {
          sendJson(res, 404, {
            success: false,
            error: error instanceof Error ? error.message : "Pegawai tidak ditemukan.",
          });
        }
        return;
      }

      // ==================================================
      // REKAP BULANAN
      // ==================================================
      if (url.pathname === "/api/monthly" && req.method === "GET") {
        const month = url.searchParams.get("month");
        if (month !== null && !hasValidMonth(month)) {
          sendJson(res, 400, { success: false, error: "Bulan tidak valid. Gunakan format YYYY-MM." });
          return;
        }
        const referenceDate = month ? `${month}-01` : undefined;
        const reports = getMonthlyReport(db, referenceDate);
        const dailySummaries = getMonthlyDailySummaries(db, referenceDate);
        const range = getCurrentMonthRange(referenceDate);
        const dayStatuses = getDayStatuses(db, range.start, range.end);
        sendJson(res, 200, {
          success: true,
          month: month ?? null,
          employeeCount: reports.length,
          lateEmployeeCount: reports.filter((report) => report.total > 0).length,
          totalLate: reports.reduce((sum, report) => sum + report.total, 0),
          workdayCount: dayStatuses.filter((item) => item.status === "WORKDAY").length,
          holidayCount: dayStatuses.filter((item) => item.status === "HOLIDAY").length,
          reports,
          dailySummaries,
          dayStatuses,
        });
        return;
      }

      if (url.pathname === "/api/monthly/export" && req.method === "GET") {
        const month = url.searchParams.get("month");
        if (!hasValidMonth(month)) {
          sendJson(res, 400, { success: false, error: "Bulan wajib diisi dengan format YYYY-MM yang valid." });
          return;
        }

        const reports = getMonthlyReport(db, `${month}-01`);
        const [year, monthNumber] = month.split("-").map(Number);
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const label = `${monthNames[monthNumber - 1]} ${year}`;
        const dailyRows = reports.flatMap((report) =>
          report.dates.map((date) => ({ date, name: report.name, role: report.role })),
        ).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "id-ID"));
        const range = getCurrentMonthRange(`${month}-01`);
        const dayStatuses = getDayStatuses(db, range.start, range.end);
        const dailySummaryMap = new Map(
          getMonthlyDailySummaries(db, `${month}-01`).map((item) => [item.date, item]),
        );
        const statusRows = dayStatuses.map((item) => ({
          date: item.date,
          status: item.status,
          total: dailySummaryMap.get(item.date)?.total ?? 0,
        }));
        const workbook = createMonthlyWorkbook(label, reports, dailyRows, statusRows);

        res.writeHead(200, {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="rekap-keterlambatan-${month}.xlsx"`,
          "Content-Length": workbook.length,
          "Cache-Control": "no-store",
        });
        res.end(workbook);
        return;
      }

      // ==================================================
      // BACKUP DATABASE
      // ==================================================
      if (url.pathname === "/api/backup" && req.method === "GET") {
        saveDatabase(db);
        const backup = getDatabaseBuffer(db);
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        res.writeHead(200, {
          "Content-Type": "application/vnd.sqlite3",
          "Content-Disposition": `attachment; filename="backup-absensi-${stamp}.sqlite"`,
          "Content-Length": backup.length,
          "Cache-Control": "no-store",
        });
        res.end(backup);
        return;
      }

      // ==================================================
      // JADWAL PEGAWAI MATRIX API
      // GET /api/schedule-matrix?month=YYYY-MM&categoryId=1
      // ==================================================
      if (
        url.pathname === "/api/schedule-matrix" &&
        req.method === "GET"
      ) {
        const month = url.searchParams.get("month");

        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
          sendJson(res, 400, {
            success: false,
            error: "Bulan wajib menggunakan format YYYY-MM.",
          });
          return;
        }

        const [year, monthNumber] =
          month.split("-").map(Number);

        if (monthNumber < 1 || monthNumber > 12) {
          sendJson(res, 400, {
            success: false,
            error: "Bulan tidak valid.",
          });
          return;
        }

        const categoryResult = db.exec(`
          SELECT
            id,
            code,
            name,
            sort_order
          FROM schedule_categories
          ORDER BY
            sort_order ASC,
            name COLLATE NOCASE ASC;
        `);

        const categories =
          categoryResult.length === 0
            ? []
            : categoryResult[0].values.map((row) => ({
                id: Number(row[0]),
                code: String(row[1]),
                name: String(row[2]),
                sortOrder: Number(row[3]),
              }));

        const categoryRaw =
          url.searchParams.get("categoryId");

        let categoryId =
          categoryRaw
            ? Number(categoryRaw)
            : null;

        if (
          categoryId !== null &&
          (
            !Number.isInteger(categoryId) ||
            categoryId <= 0
          )
        ) {
          sendJson(res, 400, {
            success: false,
            error: "Kategori tidak valid.",
          });
          return;
        }

        if (
          categoryId === null &&
          categories.length > 0
        ) {
          categoryId = categories[0].id;
        }

        const daysInMonth =
          new Date(
            year,
            monthNumber,
            0,
          ).getDate();

        if (categoryId === null) {
          sendJson(res, 200, {
            success: true,
            month,
            daysInMonth,
            categories,
            selectedCategoryId: null,
            employees: [],
          });
          return;
        }

        const employeeResult = db.exec(`
          SELECT
            id,
            name,
            role
          FROM employees
          WHERE schedule_category_id = ${categoryId}
          ORDER BY name COLLATE NOCASE ASC;
        `);

        const employees =
          employeeResult.length === 0
            ? []
            : employeeResult[0].values.map((row) => ({
                id: Number(row[0]),
                name: String(row[1]),
                role:
                  row[2] === null
                    ? ""
                    : String(row[2]),
                schedules: {} as Record<string, string>,
              }));

        const employeeMap =
          new Map(
            employees.map((employee) => [
              employee.id,
              employee,
            ]),
          );

        if (employees.length > 0) {
          const ids =
            employees
              .map((employee) => employee.id)
              .join(",");

          const startDate =
            `${month}-01`;

          const endDate =
            `${month}-${String(daysInMonth).padStart(2, "0")}`;

          const scheduleResult = db.exec(`
            SELECT
              employee_id,
              schedule_date,
              schedule_code
            FROM work_schedules
            WHERE employee_id IN (${ids})
              AND schedule_date >= '${startDate}'
              AND schedule_date <= '${endDate}'
            ORDER BY schedule_date ASC;
          `);

          if (scheduleResult.length > 0) {
            for (const row of scheduleResult[0].values) {
              const employeeId =
                Number(row[0]);

              const scheduleDate =
                String(row[1]);

              const scheduleCode =
                String(row[2]);

              const employee =
                employeeMap.get(employeeId);

              if (!employee) {
                continue;
              }

              const day =
                String(
                  Number(
                    scheduleDate.slice(8, 10),
                  ),
                );

              employee.schedules[day] =
                scheduleCode;
            }
          }
        }

        sendJson(res, 200, {
          success: true,
          month,
          daysInMonth,
          categories,
          selectedCategoryId: categoryId,
          employees,
        });

        return;
      }

      // ==================================================
      // ROOT & STATIC FILE
      // ==================================================
      if (req.method === "GET" && url.pathname === "/") {
        sendFile(res, path.join(PUBLIC_DIR, "index.html"), "text/html; charset=utf-8");
        return;
      }

      if (req.method === "GET") {
        const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
        const filePath = path.resolve(PUBLIC_DIR, relativePath);
        const publicRoot = path.resolve(PUBLIC_DIR);

        if (!filePath.startsWith(publicRoot + path.sep) && filePath !== publicRoot) {
          sendJson(res, 403, { success: false, error: "Akses ditolak." });
          return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          sendFile(res, filePath, getContentType(filePath));
          return;
        }
      }

      
      // ==================================================
      // JADWAL MATRIX API FINAL
      // ==================================================
      if (
        url.pathname === "/api/schedule-matrix" &&
        req.method === "GET"
      ) {
        const month =
          url.searchParams.get("month");

        if (
          !month ||
          !/^\d{4}-\d{2}$/.test(month)
        ) {
          sendJson(res, 400, {
            success: false,
            error: "Periode tidak valid.",
          });

          return;
        }

        const [year, monthNumber] =
          month.split("-").map(Number);

        const daysInMonth =
          new Date(
            year,
            monthNumber,
            0,
          ).getDate();

        // ==============================
        // KATEGORI
        // ==============================

        const categoryResult =
          db.exec(`
            SELECT
              id,
              code,
              name,
              sort_order
            FROM schedule_categories
            ORDER BY
              sort_order ASC,
              name COLLATE NOCASE ASC;
          `);

        const categories =
          categoryResult.length === 0
            ? []
            : categoryResult[0].values.map(
                (row) => ({
                  id: Number(row[0]),
                  code: String(row[1]),
                  name: String(row[2]),
                  sortOrder: Number(row[3]),
                }),
              );

        let categoryId: number | null =
          null;

        const categoryRaw =
          url.searchParams.get(
            "categoryId"
          );

        if (categoryRaw) {
          categoryId =
            Number(categoryRaw);
        }

        if (
          categoryId === null &&
          categories.length > 0
        ) {
          categoryId =
            categories[0].id;
        }

        if (
          categoryId !== null &&
          (
            !Number.isInteger(categoryId) ||
            categoryId <= 0
          )
        ) {
          sendJson(res, 400, {
            success: false,
            error:
              "Kategori tidak valid.",
          });

          return;
        }

        // ==============================
        // PEGAWAI
        // ==============================

        if (categoryId === null) {
          sendJson(res, 200, {
            success: true,
            month,
            daysInMonth,
            categories,
            selectedCategoryId: null,
            employees: [],
          });

          return;
        }

        const employeeResult =
          db.exec(`
            SELECT
              id,
              name,
              role
            FROM employees
            WHERE schedule_category_id =
              ${categoryId}
            ORDER BY
              name COLLATE NOCASE ASC;
          `);

        const employees:
          Array<{
            id: number;
            name: string;
            role: string;
            schedules:
              Record<string, string>;
          }> =
          employeeResult.length === 0
            ? []
            : employeeResult[0].values.map(
                (row) => ({
                  id: Number(row[0]),
                  name: String(row[1]),
                  role:
                    row[2] === null
                      ? ""
                      : String(row[2]),
                  schedules: {},
                }),
              );

        // ==============================
        // JADWAL
        // ==============================

        if (employees.length > 0) {

          const employeeIds =
            employees
              .map((employee) => employee.id)
              .join(",");

          const startDate =
            `${month}-01`;

          const endDate =
            `${month}-${String(
              daysInMonth,
            ).padStart(2, "0")}`;

          const scheduleResult =
            db.exec(`
              SELECT
                employee_id,
                schedule_date,
                schedule_code
              FROM work_schedules
              WHERE employee_id IN (
                ${employeeIds}
              )
                AND schedule_date >=
                  '${startDate}'
                AND schedule_date <=
                  '${endDate}'
              ORDER BY
                schedule_date ASC;
            `);

          const employeeMap =
            new Map(
              employees.map(
                (employee) => [
                  employee.id,
                  employee,
                ],
              ),
            );

          if (
            scheduleResult.length > 0
          ) {

            for (
              const row
              of scheduleResult[0].values
            ) {

              const employeeId =
                Number(row[0]);

              const scheduleDate =
                String(row[1]);

              const scheduleCode =
                String(row[2]);

              const employee =
                employeeMap.get(
                  employeeId
                );

              if (!employee) {
                continue;
              }

              const day =
                String(
                  Number(
                    scheduleDate.slice(
                      8,
                      10,
                    ),
                  ),
                );

              employee.schedules[day] =
                scheduleCode;
            }
          }
        }

        sendJson(res, 200, {
          success: true,
          month,
          daysInMonth,
          categories,
          selectedCategoryId:
            categoryId,
          employees,
        });

        return;
      }
sendJson(res, 404, {
        success: false,
        error: "Halaman atau endpoint tidak ditemukan.",
        path: url.pathname,
      });
    } catch (error) {
      console.error("Server error:", error);
      sendJson(res, 500, {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      });
    }
  });

  server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error("Terjadi error:", error);
  process.exit(1);
});
