const TIME_ZONE = "Asia/Jakarta";

export function getTodayIndonesia(): string {
    const now = new Date();

    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    if (!year || !month || !day) {
        throw new Error("Gagal mendapatkan tanggal Indonesia.");
    }

    return `${year}-${month}-${day}`;
}

export function getCurrentMonthRange(
    referenceDate: string = getTodayIndonesia()
): {
    start: string;
    end: string;
} {
    const [year, month] = referenceDate.split("-").map(Number);

    const lastDay = new Date(
        Date.UTC(year, month, 0)
    ).getUTCDate();

    return {
        start: `${year}-${String(month).padStart(2, "0")}-01`,
        end: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
}

export function isValidDate(date: string): boolean {
    const match = date.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1) {
        return false;
    }

    const lastDay = new Date(
        Date.UTC(year, month, 0)
    ).getUTCDate();

    return day <= lastDay;
}

export function isValidMonth(month: string): boolean {
    const match = month.match(/^(\d{4})-(\d{2})$/);

    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const monthNumber = Number(match[2]);

    return year >= 1900 && year <= 9999 && monthNumber >= 1 && monthNumber <= 12;
}

export function parseIndonesianDate(
    value: string
): string | null {
    const match = value.match(
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/
    );

    if (!match) {
        return null;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    return isValidDate(date) ? date : null;
}

export function formatDateIndonesia(
    date: string
): string {
    const [year, month, day] =
        date.split("-");

    const months = [
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

    return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}