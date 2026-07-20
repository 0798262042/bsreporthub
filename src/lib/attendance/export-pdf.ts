import type { StoredSession, StudentRow } from "./types";
import { downloadBlob } from "../download";
import { formatTime } from "./normalize";
import { computeStats, reportDateRange } from "./combine";
import { buildExportFilename } from "./filename";

export async function exportReportPdf(
  reportName: string,
  sessions: StoredSession[],
  students: StudentRow[],
  filenameBase?: string,
) {
  const filename = buildExportFilename(filenameBase, reportName, "pdf");
  const [{ default: pdfMake }, vfsFonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pm = pdfMake as unknown as {
    vfs: Record<string, string>;
    addVirtualFileSystem?: (vfs: Record<string, string>) => void;
    createPdf: (dd: unknown) => {
      download: (n: string) => void;
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
    if (typeof pm.addVirtualFileSystem === "function") {
      pm.addVirtualFileSystem(vfs);
    } else {
      pm.vfs = vfs;
    }
  }

  const stats = computeStats(students, sessions.length);
  const dateRange = reportDateRange(sessions);
  const generated = new Date().toLocaleString();
  const subtitle = cleanSubtitle(reportName);

  // Two-row header matching the on-screen table:
  // Row 1: Full Name (rowSpan 2) | Session N + date (colSpan 2) ... | Present (rowSpan 2) | Attendance (rowSpan 2)
  // Row 2: '' | Join | Leave ... | '' | ''
  const thTop = (text: string, extra: Record<string, unknown> = {}) => ({
    text,
    style: "thTop",
    fillColor: "#1E3A8A",
    color: "white",
    alignment: "center",
    margin: [0, 4, 0, 4],
    border: [false, false, false, false],
    ...extra,
  });
  const thSub = (text: string) => ({
    text,
    style: "thSub",
    fillColor: "#2547A3",
    color: "white",
    alignment: "center",
    margin: [0, 3, 0, 3],
    border: [false, false, false, false],
  });

  const row1: unknown[] = [
    thTop("Full Name", { rowSpan: 2, alignment: "left", margin: [6, 10, 0, 10] }),
  ];
  for (const s of sessions) {
    row1.push(
      thTop(`${s.label}\n${formatSessionDate(s.date)}`, { colSpan: 2 }),
      "",
    );
  }
  row1.push(thTop("Present", { rowSpan: 2, margin: [0, 10, 0, 10] }));
  row1.push(thTop("Attendance", { rowSpan: 2, margin: [0, 10, 0, 10] }));

  const row2: unknown[] = [""];
  for (const _ of sessions) {
    row2.push(thSub("Join"), thSub("Leave"));
  }
  row2.push("", "");

  const body: unknown[][] = [row1, row2];

  students.forEach((row, i) => {
    const fill = i % 2 === 1 ? "#EFF6FF" : null;
    const line: unknown[] = [{ text: row.name, fillColor: fill, style: "td" }];
    for (const p of row.perSession) {
      line.push({
        text: p.join ? formatTime(p.join) : "—",
        fillColor: fill,
        style: "td",
        alignment: "center",
      });
      line.push({
        text: p.leave ? formatTime(p.leave) : "—",
        fillColor: fill,
        style: "td",
        alignment: "center",
      });
    }
    line.push({
      text: String(row.attended),
      fillColor: fill,
      style: "td",
      alignment: "center",
    });
    const pctColor =
      row.attendancePct >= 80
        ? "#16A34A"
        : row.attendancePct >= 50
          ? "#CA8A04"
          : "#DC2626";
    line.push({
      text: `${row.attendancePct}%`,
      fillColor: fill,
      color: pctColor,
      bold: true,
      style: "td",
      alignment: "center",
    });
    body.push(line);
  });

  const widths = [
    130,
    ...sessions.flatMap(() => ["auto", "auto"] as (number | string)[]),
    "auto",
    "auto",
  ];

  const dd = {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [24, 110, 24, 40],
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
                  text: subtitle,
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
        text: `Date Range: ${dateRange}    •    Total Students: ${stats.totalStudents}    •    Total Sessions: ${stats.totalSessions}    •    Generated: ${generated}`,
        style: "meta",
        alignment: "center",
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          headerRows: 1,
          widths,
          body,
        },
        layout: {
          hLineColor: () => "#CBD5E1",
          vLineColor: () => "#CBD5E1",
          hLineWidth: (i: number) => (i <= 2 ? 0 : 0.5),
          vLineWidth: (i: number, node: { table: { widths: unknown[] } }) => {
            if (i === 0 || i === node.table.widths.length) return 0;
            return 0.5;
          },
        },
      },
      { text: "Summary", style: "h2", margin: [0, 16, 0, 6] },
      {
        columns: [
          statBlock("Average Attendance", `${stats.avg}%`),
          statBlock("Highest", `${stats.highest}%`),
          statBlock("Lowest", `${stats.lowest}%`),
          statBlock("Perfect", stats.perfect),
        ],
      },
    ],
    styles: {
      brandTitle: { fontSize: 15, bold: true },
      brandSub: { fontSize: 11, bold: true },
      title: { fontSize: 16, bold: true, color: "#0F172A", margin: [0, 0, 0, 4] },
      meta: { fontSize: 9, color: "#475569" },
      h2: { fontSize: 11, bold: true, color: "#1E3A8A" },
      thTop: { bold: true, fontSize: 9 },
      thSub: { bold: true, fontSize: 8 },
      td: { fontSize: 8 },
    },
    defaultStyle: { fontSize: 8 },
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

function statBlock(label: string, value: string | number) {
  return {
    stack: [
      { text: label, fontSize: 8, color: "#64748B" },
      { text: String(value), fontSize: 14, bold: true, color: "#1E3A8A" },
    ],
    margin: [0, 0, 12, 0],
  };
}

function formatSessionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// Extract "MODULE – LECTURER" from a report name like
// "BS-15 July 2026 - MBA RESEARCH PROJECT PROPOSAL - DR MSUTHWANA".
function cleanSubtitle(name: string): string {
  let s = name.replace(/\s+\d{1,2}:\d{2}\s*(?:to|-|–|—)\s*\d{1,2}:\d{2}\s*/gi, " ").trim();
  const parts = s.split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);
  const dateLike = /\b(?:\d{1,2}\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{0,4}\b/i;
  const bsCode = /^bs[-\s]?\d*$/i;
  const kept = parts.filter((p) => !dateLike.test(p) && !bsCode.test(p));
  return (kept.length ? kept : parts).join(" – ");
}
