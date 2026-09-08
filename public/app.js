async function loadDashboard() {
    try {
        const response = await fetch("/api/dashboard");

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}: ${response.statusText}`
            );
        }

        const data = await response.json();

        renderDashboard(data);
    } catch (error) {
        console.error("Gagal memuat dashboard:", error);

        const tableBody =
            document.getElementById("attendanceTableBody");

        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-8 text-center text-sm text-red-500">
                        Gagal memuat data dashboard.
                    </td>
                </tr>
            `;
        }
    }
}


function renderDashboard(data) {
    // ==============================
    // HEADER / BULAN
    // ==============================

    const monthTitle =
        document.getElementById("monthTitle");

    const monthLabel =
        document.getElementById("monthLabel");

    if (monthTitle) {
        monthTitle.textContent = data.month;
    }

    if (monthLabel) {
        monthLabel.textContent = data.month;
    }


    // ==============================
    // HARI BERJALAN
    // ==============================

    const currentDay =
        document.getElementById("currentDay");

    if (currentDay) {
        currentDay.textContent =
            new Date().getDate();
    }


    // ==============================
    // STATISTIK
    // ==============================

    const employeeCount =
        document.getElementById("employeeCount");

    const totalLate =
        document.getElementById("totalLate");

    if (employeeCount) {
        employeeCount.textContent =
            data.employeeCount;
    }

    if (totalLate) {
        totalLate.textContent =
            data.totalLate;
    }


    // ==============================
    // TABLE
    // ==============================

    renderTable(data.reports || []);
}


function renderTable(reports) {
    const tableBody =
        document.getElementById("attendanceTableBody");

    const tableInfo =
        document.getElementById("tableInfo");

    const tableSubtitle =
        document.getElementById("tableSubtitle");

    if (!tableBody) {
        return;
    }

    if (reports.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="px-4 py-8 text-center text-sm text-slate-400"
                >
                    Belum ada data keterlambatan bulan ini.
                </td>
            </tr>
        `;

        if (tableInfo) {
            tableInfo.textContent =
                "Menampilkan 0 dari 0 pegawai";
        }

        if (tableSubtitle) {
            tableSubtitle.textContent =
                "Belum ada data keterlambatan.";
        }

        return;
    }


    tableBody.innerHTML =
        reports.map((report, index) => {

            const lastDate =
                report.dates &&
                report.dates.length > 0
                    ? report.dates[report.dates.length - 1]
                    : "-";

            return `
                <tr class="hover:bg-slate-50">
                    <td class="px-4 py-3 text-slate-500">
                        ${index + 1}
                    </td>

                    <td class="px-4 py-3">
                        <div class="font-medium text-slate-900">
                            ${escapeHtml(report.name)}
                        </div>
                    </td>

                    <td class="px-4 py-3 text-center">
                        <span
                            class="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                        >
                            ${report.total}x
                        </span>
                    </td>

                    <td class="px-4 py-3 text-slate-500">
                        ${escapeHtml(lastDate)}
                    </td>

                    <td class="px-4 py-3 text-right">
                        <button
                            type="button"
                            class="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50"
                            data-employee-id="${report.employeeId}"
                        >
                            Detail
                        </button>
                    </td>
                </tr>
            `;
        })
        .join("");


    if (tableInfo) {
        tableInfo.textContent =
            `Menampilkan ${reports.length} dari ${reports.length} pegawai`;
    }

    if (tableSubtitle) {
        tableSubtitle.textContent =
            `${reports.length} pegawai memiliki catatan keterlambatan bulan ini.`;
    }
}


function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ==============================
// SEARCH
// ==============================

let dashboardReports = [];

async function loadDashboardWithSearch() {
    try {
        const response = await fetch("/api/dashboard");

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const data = await response.json();

        dashboardReports = data.reports || [];

        renderDashboard(data);
    } catch (error) {
        console.error(error);
    }
}


document
    .getElementById("searchInput")
    ?.addEventListener("input", (event) => {

        const keyword =
            event.target.value
                .trim()
                .toLowerCase();

        const filtered =
            dashboardReports.filter((report) =>
                report.name
                    .toLowerCase()
                    .includes(keyword)
            );

        renderTable(filtered);
    });


// ==============================
// REFRESH
// ==============================

document
    .getElementById("refreshButton")
    ?.addEventListener("click", () => {
        loadDashboardWithSearch();
    });


// ==============================
// INITIAL LOAD
// ==============================

loadDashboardWithSearch();