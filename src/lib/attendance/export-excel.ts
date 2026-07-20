import XLSX from "xlsx-js-style";
import { downloadBlob, openDownloadTab } from "../download";
import type { StoredSession, StudentRow } from "./types";
import { formatTime, formatDate } from "./normalize";
import { computeStats, reportDateRange } from "./combine";

type Cell = XLSX.CellObject;

const BLUE = "1E3A8A";
const LIGHT = "EFF6FF";
const WHITE = "FFFFFF";

const border = {
  top: { style: "thin", color: { rgb: "CBD5E1" } },
  bottom: { style: "thin", color: { rgb: "CBD5E1" } },
  left: { style: "thin", color: { rgb: "CBD5E1" } },
  right: { style: "thin", color: { rgb: "CBD5E1" } },
};

function titleCell(v: string): Cell {
  return {
    t: "s",
    v,
    s: {
      font: { bold: true, sz: 16, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: BLUE } },
      alignment: { horizontal: "center", vertical: "center" },
    },
  };
}

function subCell(v: string): Cell {
  return {
    t: "s",
    v,
    s: {
      font: { italic: true, sz: 10, color: { rgb: "334155" } },
      alignment: { horizontal: "center" },
    },
  };
}

function headerCell(v: string): Cell {
  return {
    t: "s",
    v,
    s: {
      font: { bold: true, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: BLUE } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border,
    },
  };
}

function textCell(v: string, altRow: boolean): Cell {
  return {
    t: "s",
    v,
    s: {
      fill: altRow ? { fgColor: { rgb: LIGHT } } : undefined,
      alignment: { horizontal: "left", vertical: "center" },
      border,
    },
  };
}

function pctCell(pct: number, altRow: boolean): Cell {
  const fg =
    pct >= 80 ? "16A34A" : pct >= 50 ? "CA8A04" : "DC2626";
  return {
    t: "n",
    v: pct,
    z: '0.0"%"',
    s: {
      fill: altRow ? { fgColor: { rgb: LIGHT } } : undefined,
      font: { bold: true, color: { rgb: fg } },
      alignment: { horizontal: "center" },
      border,
    },
  };
}

export function exportReportExcel(
  reportName: string,
  sessions: StoredSession[],
  students: StudentRow[],
  downloadTab?: Window | null,
) {
  const filename = `${reportName.replace(/[^\w\-]+/g, "_")}_attendance.xlsx`;
  const activeDownloadTab = downloadTab ?? openDownloadTab(filename);
  const stats = computeStats(students, sessions.length);
  const dateRange = reportDateRange(sessions);
  const generated = new Date().toLocaleString();

  const colCount = 1 + sessions.length * 2 + 2; // name + (join,leave)*n + attended + %
  const aoa: Cell[][] = [];

  // Title (row 0)
  const titleRow: Cell[] = [titleCell("NMU Business School — Attendance Report")];
  for (let i = 1; i < colCount; i++) titleRow.push({ t: "s", v: "", s: { fill: { fgColor: { rgb: BLUE } } } });
  aoa.push(titleRow);
  // Subtitle row (report name / date range / generated)
  const subVals = [`Report: ${reportName}`, `Date Range: ${dateRange}`, `Generated: ${generated}`];
  const subRow: Cell[] = subVals.map((v) => subCell(v));
  while (subRow.length < colCount) subRow.push({ t: "s", v: "" });
  aoa.push(subRow);
  // Spacer
  aoa.push(Array(colCount).fill({ t: "s", v: "" }));

  // Header row 1 (grouped)
  const grpRow: Cell[] = [headerCell("Full Name")];
  for (const s of sessions) {
    grpRow.push(headerCell(`${s.label} — ${formatDate(s.date)}`));
    grpRow.push({ t: "s", v: "", s: { fill: { fgColor: { rgb: BLUE } }, border } });
  }
  grpRow.push(headerCell("Total Present"));
  grpRow.push(headerCell("Attendance %"));
  aoa.push(grpRow);

  // Header row 2 (join/leave)
  const subHdr: Cell[] = [headerCell("")];
  for (let i = 0; i < sessions.length; i++) {
    subHdr.push(headerCell("Join"));
    subHdr.push(headerCell("Leave"));
  }
  subHdr.push(headerCell(""));
  subHdr.push(headerCell(""));
  aoa.push(subHdr);

  // Data rows
  students.forEach((row, i) => {
    const alt = i % 2 === 1;
    const line: Cell[] = [textCell(row.name, alt)];
    for (const p of row.perSession) {
      line.push(textCell(p.join ? formatTime(p.join) : "—", alt));
      line.push(textCell(p.leave ? formatTime(p.leave) : "—", alt));
    }
    line.push({
      t: "n",
      v: row.attended,
      s: {
        fill: alt ? { fgColor: { rgb: LIGHT } } : undefined,
        alignment: { horizontal: "center" },
        border,
      },
    });
    line.push(pctCell(row.attendancePct, alt));
    aoa.push(line);
  });

  // Blank + stats
  aoa.push(Array(colCount).fill({ t: "s", v: "" }));
  const statPairs: [string, string | number][] = [
    ["Total Students", stats.totalStudents],
    ["Total Sessions", stats.totalSessions],
    ["Average Attendance", `${stats.avg}%`],
    ["Highest Attendance", `${stats.highest}%`],
    ["Lowest Attendance", `${stats.lowest}%`],
    ["Perfect Attendance", stats.perfect],
    ["Absent (0 sessions)", stats.absent],
  ];
  for (const [k, v] of statPairs) {
    const rw: Cell[] = [
      { t: "s", v: k, s: { font: { bold: true }, border } },
      { t: "s", v: String(v), s: { border } },
    ];
    while (rw.length < colCount) rw.push({ t: "s", v: "" });
    aoa.push(rw);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa.map((r) => r.map((c) => c.v)));
  // Apply styled cells
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < aoa[r].length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = aoa[r][c];
    }
  }

  // Merges
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }, // title
    { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } }, // name
    { s: { r: 3, c: colCount - 2 }, e: { r: 4, c: colCount - 2 } }, // total
    { s: { r: 3, c: colCount - 1 }, e: { r: 4, c: colCount - 1 } }, // pct
  ];
  for (let i = 0; i < sessions.length; i++) {
    const c = 1 + i * 2;
    merges.push({ s: { r: 3, c }, e: { r: 3, c: c + 1 } });
  }
  ws["!merges"] = merges;

  // Column widths
  ws["!cols"] = [
    { wch: 30 },
    ...sessions.flatMap(() => [{ wch: 12 }, { wch: 12 }]),
    { wch: 14 },
    { wch: 16 },
  ];
  // Row heights
  ws["!rows"] = [{ hpt: 28 }, { hpt: 18 }, {}, { hpt: 26 }, { hpt: 22 }];
  // Freeze top rows
  ws["!freeze"] = { xSplit: 1, ySplit: 5 };
  (ws as XLSX.WorkSheet & { "!printSetup"?: unknown })["!printSetup"] = {
    orientation: "landscape",
    fitToPage: true,
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadBlob(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
    activeDownloadTab,
  );
}
