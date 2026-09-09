import type { Database } from "sql.js";

import {
    parseAttendanceMessage,
} from "./parser.js";

import {
    addLateAttendance,
} from "./attendance.js";

import {
    getEmployeeReport,
    getMonthlyReport,
    getDailyReport,
} from "./report.js";

import {
    saveDatabase,
} from "./database.js";

import {
    getTodayIndonesia,
    formatDateIndonesia,
    parseIndonesianDate,
} from "./date.js";


export async function handleCommand(
    db: Database,
    message: string
): Promise<string> {

    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();


    // ==================================================
    // /REKAP PEGAWAI
    // ==================================================

    if (lower.startsWith("/rekap pegawai")) {

        const content = trimmed
            .substring("/rekap pegawai".length)
            .trim();

        if (!content) {
            return [
                "❌ DATA REKAP",
                "",
                "Data rekap belum diberikan.",
                "",
                "Format:",
                "/rekap pegawai",
                "(31-08-2026)",
                "1. Nama Pegawai",
                "2. Nama Pegawai",
            ].join("\n");
        }

        try {

            const parsed = parseAttendanceMessage(content);

            let addedCount = 0;
            let duplicateCount = 0;

            for (const employeeName of parsed.employees) {

                const result = addLateAttendance(
                    db,
                    employeeName,
                    parsed.date
                );

                if (result.added) {
                    addedCount++;
                } else {
                    duplicateCount++;
                }
            }

            saveDatabase(db);

            return [
                "✅ REKAP BERHASIL",
                "",
                `Tanggal: ${formatDateIndonesia(parsed.date)}`,
                `Jumlah pegawai: ${parsed.employees.length}`,
                `Data baru: ${addedCount}`,
                `Sudah tercatat: ${duplicateCount}`,
            ].join("\n");

        } catch (error) {

            return [
                "❌ GAGAL MENYIMPAN REKAP",
                "",
                error instanceof Error
                    ? error.message
                    : "Terjadi kesalahan.",
            ].join("\n");
        }
    }


    // ==================================================
    // /REKAP
    // ==================================================

    if (lower === "/rekap") {

        const reports = getMonthlyReport(db);

        if (reports.length === 0) {

            return [
                "📊 REKAP KETERLAMBATAN",
                "",
                "Belum ada data keterlambatan",
                "pada bulan berjalan.",
            ].join("\n");
        }

        const lines = [
            "📊 REKAP KETERLAMBATAN",
            "",
            "Bulan berjalan",
            "",
        ];

        reports.forEach((report, index) => {

            lines.push(
                `${index + 1}. ${report.name} — ${report.total}x`
            );

        });

        lines.push("");
        lines.push(
            `Total pegawai terlambat: ${reports.length}`
        );

        return lines.join("\n");
    }


    // ==================================================
    // /EDIT REKAP
    // ==================================================

    if (lower.startsWith("/edit rekap")) {

        const inputDate = trimmed
            .substring("/edit rekap".length)
            .trim();

        if (!inputDate) {

            return [
                "✏️ EDIT REKAP",
                "",
                "Tanggal belum diberikan.",
                "",
                "Format:",
                "/edit rekap DD-MM-YYYY",
            ].join("\n");
        }

        const date = parseIndonesianDate(inputDate);

        if (!date) {

            return [
                "❌ FORMAT TANGGAL SALAH",
                "",
                "Gunakan:",
                "/edit rekap DD-MM-YYYY",
            ].join("\n");
        }

        const report = getDailyReport(db, date);

        if (report.names.length === 0) {

            return [
                "✏️ EDIT REKAP",
                "",
                formatDateIndonesia(date),
                "",
                "Tidak ada data keterlambatan",
                "pada tanggal tersebut.",
            ].join("\n");
        }

        const lines = [
            "✏️ EDIT REKAP",
            "",
            formatDateIndonesia(date),
            "",
        ];

        report.names.forEach((employeeName, index) => {

            lines.push(
                `${index + 1}. ${employeeName}`
            );

        });

        lines.push("");
        lines.push(
            `Total: ${report.names.length} pegawai`
        );

        return lines.join("\n");
    }


    // ==================================================
    // /HARI INI
    // ==================================================

    if (lower === "/hari ini") {

        const today = getTodayIndonesia();

        const report = getDailyReport(db, today);

        if (report.names.length === 0) {

            return [
                "📋 REKAP HARI INI",
                "",
                formatDateIndonesia(today),
                "",
                "Tidak ada pegawai yang",
                "tercatat terlambat.",
            ].join("\n");
        }

        const lines = [
            "📋 REKAP HARI INI",
            "",
            formatDateIndonesia(today),
            "",
        ];

        report.names.forEach((employeeName, index) => {

            lines.push(
                `${index + 1}. ${employeeName}`
            );

        });

        lines.push("");
        lines.push(
            `Total: ${report.names.length} pegawai`
        );

        return lines.join("\n");
    }


    // ==================================================
    // /TANGGAL
    // ==================================================

    if (lower.startsWith("/tanggal ")) {

        const inputDate = trimmed
            .substring("/tanggal".length)
            .trim();

        const date = parseIndonesianDate(inputDate);

        if (!date) {

            return [
                "❌ FORMAT TANGGAL SALAH",
                "",
                "Gunakan:",
                "/tanggal DD-MM-YYYY",
            ].join("\n");
        }

        const report = getDailyReport(db, date);

        if (report.names.length === 0) {

            return [
                "📋 REKAP TANGGAL",
                "",
                formatDateIndonesia(date),
                "",
                "Tidak ada data keterlambatan.",
            ].join("\n");
        }

        const lines = [
            "📋 REKAP TANGGAL",
            "",
            formatDateIndonesia(date),
            "",
        ];

        report.names.forEach((employeeName, index) => {

            lines.push(
                `${index + 1}. ${employeeName}`
            );

        });

        lines.push("");
        lines.push(
            `Total: ${report.names.length} pegawai`
        );

        return lines.join("\n");
    }


    // ==================================================
    // /NAMA
    // ==================================================

    if (lower.startsWith("/")) {

        const searchName = trimmed
            .substring(1)
            .trim();

        if (!searchName) {

            return [
                "❌ NAMA PEGAWAI",
                "",
                "Nama pegawai belum diberikan.",
                "",
                "Contoh:",
                "/Ahmad Fauzi",
            ].join("\n");
        }

        const reports = getEmployeeReport(
            db,
            searchName
        );

        if (reports.length === 0) {

            return [
                "❌ PEGAWAI TIDAK DITEMUKAN",
                "",
                `Pencarian: ${searchName}`,
            ].join("\n");
        }

        if (reports.length > 1) {

            return [
                "⚠️ DITEMUKAN BEBERAPA PEGAWAI",
                "",
                ...reports.map(
                    (report) => `• ${report.name}`
                ),
            ].join("\n");
        }

        const report = reports[0];

        const lines = [
            `👤 ${report.name}`,
            "",
            "REKAP KETERLAMBATAN",
            `Total bulan ini: ${report.total}x`,
            "",
        ];

        if (report.dates.length === 0) {

            lines.push(
                "Belum ada keterlambatan bulan ini."
            );

        } else {

            lines.push("Tanggal:");

            for (const date of report.dates) {

                lines.push(
                    `• ${formatDateIndonesia(date)}`
                );

            }
        }

        return lines.join("\n");
    }


    // ==================================================
    // COMMAND TIDAK DIKENALI
    // ==================================================

    return [
        "❌ COMMAND TIDAK DIKENALI",
        "",
        "Command yang tersedia:",
        "",
        "/nama",
        "/rekap pegawai",
        "/rekap",
        "/edit rekap DD-MM-YYYY",
        "/hari ini",
        "/tanggal DD-MM-YYYY",
    ].join("\n");
}