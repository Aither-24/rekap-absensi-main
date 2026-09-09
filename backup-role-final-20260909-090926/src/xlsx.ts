import { deflateRawSync } from "zlib";

export interface MonthlyExportRow {
  name: string;
  role: string | null;
  total: number;
  dates: string[];
}

export interface DailyExportRow {
  date: string;
  name: string;
  role: string | null;
}

export interface DayStatusExportRow {
  date: string;
  status: "WORKDAY" | "HOLIDAY";
  total: number;
}

function roleLabel(role: string | null): string {
  switch (role) {
    case "PEGAWAI_TETAP": return "Pegawai Tetap";
    case "PKWT": return "PKWT";
    case "TENAGA_AHLI": return "Tenaga Ahli";
    case "MAGANG": return "Magang";
    default: return "Belum diatur";
  }
}

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let result = "";
  let current = index;
  while (current > 0) {
    current--;
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26);
  }
  return result;
}

function stringCell(row: number, col: number, value: unknown, style = 0): string {
  return `<c r="${columnName(col)}${row}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t>${xmlEscape(value)}</t></is></c>`;
}

function numberCell(row: number, col: number, value: number, style = 0): string {
  return `<c r="${columnName(col)}${row}"${style ? ` s="${style}"` : ""}><v>${Number(value)}</v></c>`;
}

function sheetXml(rows: Array<Array<{ value: string | number; numeric?: boolean; style?: number }>>, widths: number[]): string {
  const cols = widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join("");
  const body = rows.map((cells, rowIndex) => {
    const r = rowIndex + 1;
    return `<row r="${r}">${cells.map((cell, colIndex) => cell.numeric ? numberCell(r, colIndex + 1, Number(cell.value), cell.style) : stringCell(r, colIndex + 1, cell.value, cell.style)).join("")}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: Array<{ name: string; data: string | Buffer }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const source = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
    const compressed = deflateRawSync(source, { level: 6 });
    const crc = crc32(source);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(source.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(source.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}

export function createMonthlyWorkbook(
  label: string,
  reports: MonthlyExportRow[],
  dailyRows: DailyExportRow[],
  statusRows: DayStatusExportRow[] = [],
): Buffer {
  const summaryRows: Array<Array<{ value: string | number; numeric?: boolean; style?: number }>> = [
    [{ value: `Rekap Keterlambatan ${label}`, style: 2 }],
    [],
    ["No", "Nama Pegawai", "Role", "Jumlah Terlambat", "Tanggal Keterlambatan"].map((value) => ({ value, style: 1 })),
    ...reports.map((report, index) => [
      { value: index + 1, numeric: true },
      { value: report.name },
      { value: roleLabel(report.role) },
      { value: report.total, numeric: true },
      { value: report.dates.join(", ") || "-" },
    ]),
  ];
  const detailRows: Array<Array<{ value: string | number; numeric?: boolean; style?: number }>> = [
    [{ value: `Detail Harian ${label}`, style: 2 }],
    [],
    ["No", "Tanggal", "Nama Pegawai", "Role"].map((value) => ({ value, style: 1 })),
    ...dailyRows.map((item, index) => [
      { value: index + 1, numeric: true },
      { value: item.date },
      { value: item.name },
      { value: roleLabel(item.role) },
    ]),
  ];


  const statusSheetRows: Array<Array<{ value: string | number; numeric?: boolean; style?: number }>> = [
    [{ value: `Status Harian ${label}`, style: 2 }],
    [],
    ["No", "Tanggal", "Status", "Jumlah Absen"].map((value) => ({ value, style: 1 })),
    ...statusRows.map((item, index) => [
      { value: index + 1, numeric: true },
      { value: item.date },
      { value: item.status === "HOLIDAY" ? "Libur" : "Hari Kerja" },
      { value: item.total, numeric: true },
    ]),
  ];

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ringkasan Bulanan" sheetId="1" r:id="rId1"/><sheet name="Detail Harian" sheetId="2" r:id="rId2"/><sheet name="Status Harian" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;

  return zip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rootRels },
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
    { name: "xl/styles.xml", data: styles },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml(summaryRows, [7, 28, 22, 20, 55]) },
    { name: "xl/worksheets/sheet2.xml", data: sheetXml(detailRows, [7, 16, 28, 22]) },
    { name: "xl/worksheets/sheet3.xml", data: sheetXml(statusSheetRows, [7, 16, 18, 18]) },
  ]);
}
