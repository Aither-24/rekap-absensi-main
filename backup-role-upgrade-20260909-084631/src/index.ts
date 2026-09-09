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
            typeof body.unit === "string" ? body.unit : null,
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
            typeof body.unit === "string" ? body.unit : null,
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
          report.dates.map((date) => ({ date, name: report.name, unit: report.unit })),
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
