import XLSX from "xlsx-js-style";
import { downloadBlob } from "../download";
import type { Report } from "./types";
import { formatTime, formatDate, stripDates } from "./normalize";
import { combineReport, computeStats } from "./combine";

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

function bannerCell(v: string): Cell {
  return {
    t: "s",
    v,
    s: {
      font: { bold: true, sz: 14, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: BLUE } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
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

function textCell(v: string, alt: boolean, center = false): Cell {
  return {
    t: "s",
    v,
    s: {
      fill: alt ? { fgColor: { rgb: LIGHT } } : undefined,
      alignment: { horizontal: center ? "center" : "left", vertical: "center" },
      border,
    },
  };
}

function pctCell(pct: number, alt: boolean): Cell {
  const fg = pct >= 80 ? "16A34A" : pct >= 50 ? "CA8A04" : "DC2626";
  return {
    t: "n",
    v: pct,
    z: '0.0"%"',
    s: {
      fill: alt ? { fgColor: { rgb: LIGHT } } : undefined,
      font: { bold: true, color: { rgb: fg } },
      alignment: { horizontal: "center" },
      border,
    },
  };
}

/** Excel-safe, unique worksheet name (max 31 chars). */
function sheetName(raw: string, used: Set<string>): string {
  let base = (stripDates(raw) || raw || "Report")
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  if (!base) base = "Report";
  let name = base;
  let i = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${i++})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

function buildSheet(report: Report) {
  const hidden = new Set(
    (report.hiddenNames ?? []).map((n) => n.toLowerCase()),
  );
  const combined = combineReport(report.sessions);
  const sessions = combined.sessions;
  const students = combined.students.filter(
    (s) => !hidden.has(s.name.toLowerCase()),
  );
  const stats = computeStats(students, sessions.length);

  const colCount = 1 + sessions.length * 2 + 2;
  const aoa: Cell[][] = [];

  const fill = (first: Cell) => {
    const row: Cell[] = [first];
    for (let i = 1; i < colCount; i++)
      row.push({ t: "s", v: "", s: { fill: { fgColor: { rgb: BLUE } } } });
    return row;
  };

  aoa.push(fill(bannerCell("NMU Business School — Attendance Report")));
  aoa.push(fill(bannerCell(report.sessions[0]?.topic ?? report.name)));
  aoa.push(Array(colCount).fill({ t: "s", v: "" }));

  const grpRow: Cell[] = [headerCell("Full Name")];
  for (const s of sessions) {
    grpRow.push(headerCell(`${s.label} — ${formatDate(s.date)}`));
    grpRow.push({ t: "s", v: "", s: { fill: { fgColor: { rgb: BLUE } }, border } });
  }
  grpRow.push(headerCell("Total Present"));
  grpRow.push(headerCell("Attendance %"));
  aoa.push(grpRow);

  const subHdr: Cell[] = [headerCell("")];
  for (let i = 0; i < sessions.length; i++) {
    subHdr.push(headerCell("Join"));
    subHdr.push(headerCell("Leave"));
  }
  subHdr.push(headerCell(""));
  subHdr.push(headerCell(""));
  aoa.push(subHdr);

  students.forEach((row, i) => {
    const alt = i % 2 === 1;
    const line: Cell[] = [textCell(row.name, alt)];
    for (const p of row.perSession) {
      line.push(textCell(p.join ? formatTime(p.join) : "—", alt, true));
      line.push(textCell(p.leave ? formatTime(p.leave) : "—", alt, true));
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

  aoa.push(Array(colCount).fill({ t: "s", v: "" }));
  const statPairs: [string, string | number][] = [
    ["Total Students", stats.totalStudents],
    ["Total Sessions", stats.totalSessions],
    ["Average Attendance", `${stats.avg}%`],
    ["Highest Attendance", `${stats.highest}%`],
    ["Lowest Attendance", `${stats.lowest}%`],
    ["Perfect Attendance", stats.perfect],
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
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < aoa[r].length; c++) {
      ws[XLSX.utils.encode_cell({ r, c })] = aoa[r][c];
    }
  }

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
    { s: { r: 3, c: colCount - 2 }, e: { r: 4, c: colCount - 2 } },
    { s: { r: 3, c: colCount - 1 }, e: { r: 4, c: colCount - 1 } },
  ];
  for (let i = 0; i < sessions.length; i++) {
    const c = 1 + i * 2;
    merges.push({ s: { r: 3, c }, e: { r: 3, c: c + 1 } });
  }
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 26 },
    ...sessions.flatMap(() => [{ wch: 9 }, { wch: 9 }]),
    { wch: 13 },
    { wch: 13 },
  ];
  ws["!rows"] = [{ hpt: 26 }, { hpt: 34 }, {}, { hpt: 26 }, { hpt: 22 }];
  ws["!freeze"] = { xSplit: 1, ySplit: 5 };
  return ws;
}

/**
 * One workbook, one worksheet per report/module, using the existing
 * attendance report layout on every tab.
 */
export function exportAllReportsExcel(reports: Report[]) {
  const withData = reports.filter((r) => r.sessions.length > 0);
  if (withData.length === 0) {
    throw new Error("No reports are available to export.");
  }

  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  // Group by programme category, then by report, so tabs stay ordered.
  const sorted = [...withData].sort(
    (a, b) =>
      String(a.category).localeCompare(String(b.category)) ||
      a.name.localeCompare(b.name),
  );
  for (const report of sorted) {
    XLSX.utils.book_append_sheet(wb, buildSheet(report), sheetName(report.name, used));
  }

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadBlob(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `All_Attendance_Reports_${new Date().getFullYear()}.xlsx`,
  );
  return { sheets: sorted.length };
}
