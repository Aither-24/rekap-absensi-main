import { parseIndonesianDate } from "./date.js";

export interface ParsedAttendance {
    date: string;
    employees: string[];
}

export function parseAttendanceMessage(
    message: string
): ParsedAttendance {
    const date = parseDate(message);

    if (!date) {
        throw new Error(
            "Tanggal rekap tidak ditemukan atau tidak valid."
        );
    }

    const employees = parseEmployees(message);

    if (employees.length === 0) {
        throw new Error(
            "Tidak ada nama pegawai yang ditemukan."
        );
    }

    return {
        date,
        employees,
    };
}

function parseDate(
    message: string
): string | null {
    const match = message.match(
        /\((\d{1,2})[-/](\d{1,2})[-/](\d{4})\)/
    );

    if (!match) {
        return null;
    }

    const normalized =
        `${match[1]}-${match[2]}-${match[3]}`;

    return parseIndonesianDate(normalized);
}

function parseEmployees(
    message: string
): string[] {
    const lines =
        message.split(/\r?\n/);

    const employees: string[] = [];

    for (const line of lines) {
        const match = line.match(
            /^\s*\d+\.\s*(.+?)\s*$/
        );

        if (match) {
            const name =
                match[1].trim();

            if (name.length > 0) {
                employees.push(name);
            }
        }
    }

    return employees;
}

export function parseEmployeeList(
    message: string
): string[] {
    return parseEmployees(message);
}