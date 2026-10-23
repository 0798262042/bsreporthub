import XLSX from "xlsx-js-style";
import { downloadBlob } from "../download";
import { formatTime, formatDate } from "./normalize";
import type { StudentRecord, StudentSummary } from "./student-search";

const BLUE = "1E3A8A";
const LIGHT = "EFF6FF";
const WHITE = "FFFFFF";

const border = {
  top: { style: "thin", color: { rgb: "CBD5E1" } },
  bottom: { style: "thin", color: { rgb: "CBD5E1" } },
  left: { style: "thin", color: { rgb: "CBD5E1" } },
  right: { style: "thin", color: { rgb: "CBD5E1" } },
};

type Cell = XLSX.CellObject;

function titleCell(v: string): Cell {
  return {
    t: "s",
    v,
    s: {
      font: { bold: true, sz: 16, color: { rgb: WHITE } },
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

function textCell(v: string, altRow: boolean, center = false): Cell {
  return {
    t: "s",
    v,
    s: {
      fill: altRow ? { fgColor: { rgb: LIGHT } } : undefined,
      alignment: { horizontal: center ? "center" : "left", vertical: "center" },
      border,
    },
  };
}

function statusCell(status: string, altRow: boolean): Cell {
  const fg = status === "Present" ? "16A34A" : "DC2626";
  return {
    t: "s",
    v: status,
    s: {
      fill: altRow ? { fgColor: { rgb: LIGHT } } : undefined,
      font: { bold: true, color: { rgb: fg } },
      alignment: { horizontal: "center" },
      border,
    },
  };
}

function safeFilename(name: string, ext: "pdf" | "xlsx"): string {
  const base = name.replace(/[^\w\-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${base || "student"}_Attendance.${ext}`;
}

const HEADERS = [
  "Module",
  "Lecturer",
  "Session",
  "Date",
  "Join",
  "Leave",
  "Duration",
  "Status",
];

export function exportStudentExcel(
  summary: StudentSummary,
  records: StudentRecord[],
) {
  const colCount = HEADERS.length;
  const aoa: Cell[][] = [];

  const titleRow: Cell[] = [titleCell("NMU Business School — Attendance Report")];
  for (let i = 1; i < colCount; i++)
    titleRow.push({ t: "s", v: "", s: { fill: { fgColor: { rgb: BLUE } } } });
  aoa.push(titleRow);

  const subRow: Cell[] = [titleCell(`Student: ${summary.name}`)];
  for (let i = 1; i < colCount; i++)
    subRow.push({ t: "s", v: "", s: { fill: { fgColor: { rgb: BLUE } } } });
  aoa.push(subRow);

  aoa.push(Array(colCount).fill({ t: "s", v: "" }));
  aoa.push(HEADERS.map(headerCell));

  records.forEach((r, i) => {
    const alt = i % 2 === 1;
    aoa.push([
      textCell(r.module, alt),
      textCell(r.lecturer, alt),
      textCell(r.sessionLabel, alt, true),
      textCell(formatDate(r.sessionDate), alt, true),
      textCell(r.join ? formatTime(r.join) : "—", alt, true),
      textCell(r.leave ? formatTime(r.leave) : "—", alt, true),
      textCell(r.durationMin != null ? `${r.durationMin} min` : "—", alt, true),
      statusCell(r.status, alt),
    ]);
  });

  // Summary block
  aoa.push(Array(colCount).fill({ t: "s", v: "" }));
  const summaryPairs: Array<[string, string]> = [
    ["Total Sessions Recorded", String(summary.totalSessions)],
    ["Sessions Attended", String(summary.attended)],
    [
      "Average Attendance",
      summary.avgPct != null ? `${summary.avgPct}%` : "—",
    ],
    [
      "Most Recent Attendance",
      summary.lastAttended ? formatDate(summary.lastAttended) : "—",
    ],
  ];
  for (const [label, value] of summaryPairs) {
    const row: Cell[] = [
      {
        t: "s",
        v: label,
        s: { font: { bold: true, color: { rgb: "1E3A8A" } }, border },
      },
      textCell(value, false, true),
    ];
    for (let i = 2; i < colCount; i++) row.push({ t: "s", v: "" });
    aoa.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 34 },
    { wch: 22 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
  ];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
  ];
  ws["!rows"] = [{ hpt: 30 }, { hpt: 24 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Student Attendance");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    safeFilename(summary.name, "xlsx"),
  );
}

export async function exportStudentPdf(
  summary: StudentSummary,
  records: StudentRecord[],
) {
  const filename = safeFilename(summary.name, "pdf");
  const [{ default: pdfMake }, vfsFonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pm = pdfMake as unknown as {
    vfs: Record<string, string>;
    addVirtualFileSystem?: (vfs: Record<string, string>) => void;
    createPdf: (dd: unknown) => {
      getBlob: (cb?: (b: Blob) => void) => void | Promise<Blob>;
    };
  };
  const vfsMod = vfsFonts as unknown as {
    default?: { vfs?: Record<string, string> } | Record<string, string>;
    vfs?: Record<string, string>;
    pdfMake?: { vfs: Record<string, string> };
  };
  const vfs =
    vfsMod.vfs ||
    (vfsMod.default && (vfsMod.default as { vfs?: Record<string, string> }).vfs) ||
    (vfsMod.default as Record<string, string>) ||
    vfsMod.pdfMake?.vfs;
  if (vfs) {
    if (typeof pm.addVirtualFileSystem === "function") pm.addVirtualFileSystem(vfs);
    else pm.vfs = vfs;
  }

  const body: unknown[][] = [
    HEADERS.map((h) => ({
      text: h,
      style: "th",
      fillColor: "#1E3A8A",
      color: "white",
      alignment: "center",
      border: [false, false, false, false],
    })),
  ];
  records.forEach((r, i) => {
    const fill = i % 2 === 1 ? "#EFF6FF" : null;
    body.push([
      { text: r.module, fillColor: fill, style: "td" },
      { text: r.lecturer, fillColor: fill, style: "td" },
      { text: r.sessionLabel, fillColor: fill, style: "td", alignment: "center" },
      { text: formatDate(r.sessionDate), fillColor: fill, style: "td", alignment: "center" },
      { text: r.join ? formatTime(r.join) : "—", fillColor: fill, style: "td", alignment: "center" },
      { text: r.leave ? formatTime(r.leave) : "—", fillColor: fill, style: "td", alignment: "center" },
      {
        text: r.durationMin != null ? `${r.durationMin} min` : "—",
        fillColor: fill,
        style: "td",
        alignment: "center",
      },
      {
        text: r.status,
        fillColor: fill,
        style: "td",
        alignment: "center",
        bold: true,
        color: r.status === "Present" ? "#16A34A" : "#DC2626",
      },
    ]);
  });

  const statBlock = (label: string, value: string) => ({
    stack: [
      { text: label, fontSize: 8, color: "#64748B" },
      { text: value, fontSize: 14, bold: true, color: "#1E3A8A" },
    ],
    margin: [0, 0, 12, 0],
  });

  const dd = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [24, 104, 24, 40],
    header: () => ({
      stack: [
        {
          table: {
            widths: ["*"],
            body: [
              [
                {
                  text: "NMU Business School — Attendance Report",
                  style: "brandTitle",
                  alignment: "center",
                  fillColor: "#1E3A8A",
                  color: "white",
                  margin: [0, 14, 0, 6],
                  border: [false, false, false, false],
                },
              ],
              [
                {
                  text: `Student: ${summary.name}`,
                  style: "brandSub",
                  alignment: "center",
                  fillColor: "#1E3A8A",
                  color: "white",
                  margin: [0, 0, 0, 14],
                  border: [false, false, false, false],
                },
              ],
            ],
          },
          layout: "noBorders",
          margin: [24, 14, 24, 0],
        },
      ],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "center",
      margin: [0, 10, 0, 0],
      fontSize: 8,
      color: "#64748B",
    }),
    content: [
      {
        text: `Generated: ${new Date().toLocaleString()}`,
        style: "meta",
        alignment: "center",
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: ["*", "auto", "auto", "auto", "auto", "auto", "auto", "auto"],
          body,
        },
        layout: {
          hLineColor: () => "#CBD5E1",
          vLineColor: () => "#CBD5E1",
          hLineWidth: (i: number) => (i <= 1 ? 0 : 0.5),
          vLineWidth: (i: number, node: { table: { widths: unknown[] } }) =>
            i === 0 || i === node.table.widths.length ? 0 : 0.5,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
      {
        unbreakable: true,
        stack: [
          { text: "Summary", style: "h2", margin: [0, 16, 0, 6] },
          {
            columns: [
              statBlock("Total Sessions", String(summary.totalSessions)),
              statBlock("Attended", String(summary.attended)),
              statBlock(
                "Average Attendance",
                summary.avgPct != null ? `${summary.avgPct}%` : "—",
              ),
              statBlock(
                "Most Recent",
                summary.lastAttended ? formatDate(summary.lastAttended) : "—",
              ),
            ],
          },
        ],
      },
    ],
    styles: {
      brandTitle: { fontSize: 15, bold: true },
      brandSub: { fontSize: 11, bold: true },
      meta: { fontSize: 9, color: "#475569" },
      h2: { fontSize: 11, bold: true, color: "#1E3A8A" },
      th: { bold: true, fontSize: 9 },
      td: { fontSize: 9 },
    },
    defaultStyle: { fontSize: 9 },
  };

  await new Promise<void>((resolve, reject) => {
    let completed = false;
    const save = (blob: Blob) => {
      if (completed) return;
      completed = true;
      downloadBlob(blob, filename);
      resolve();
    };
    try {
      const result = pm.createPdf(dd).getBlob(save);
      if (result && typeof result.then === "function") {
        result.then(save).catch(reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}
