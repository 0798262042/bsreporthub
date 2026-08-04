import type { StoredSession, StudentRow } from "./types";
import { downloadBlob } from "../download";
import { formatTime } from "./normalize";
import { computeStats, reportDateRange } from "./combine";
import { buildExportFilename } from "./filename";

const BASE_PAGE = { w: 841.89, h: 595.28 }; // A4 landscape

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

  // ---------------------------------------------------------------
  // Dynamic layout maths — nothing about the page is hardcoded to a
  // fixed number of sessions or students.
  // ---------------------------------------------------------------
  const sessionCount = Math.max(sessions.length, 1);
  const sideMargin = 24;
  const topMargin = 104;
  const bottomMargin = 40;

  // Every session and the attendance % must sit on ONE row, so the paper
  // grows horizontally instead of splitting the table across pages.
  const fontSize = clamp(9 - Math.floor((sessionCount - 8) / 8), 6, 9);
  const timeColW = Math.max(30, Math.round(fontSize * 4.6));
  const nameColW = clamp(Math.round(fontSize * 13), 96, 140);
  const presentW = Math.max(34, fontSize * 5);
  const attendanceW = Math.max(46, fontSize * 7);
  const fixedW = nameColW + presentW + attendanceW;
  // pdfmake adds cell padding + border widths on top of the declared widths,
  // so include them or the last columns fall off the page edge.
  const cellPadX = 3;
  const colCount = 3 + sessionCount * 2;
  const tableWidth =
    fixedW + sessionCount * timeColW * 2 + colCount * (cellPadX * 2 + 1) + 4;
  const pageWidth = Math.max(BASE_PAGE.w, tableWidth + sideMargin * 2);
  const page = { w: pageWidth, h: BASE_PAGE.h };
  const pageSize = { width: page.w, height: page.h };
  const availHeight = page.h - topMargin - bottomMargin;
  const blocks: StoredSession[][] = [sessions.length ? sessions : []];

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

  const tableLayout = {
    hLineColor: () => "#CBD5E1",
    vLineColor: () => "#CBD5E1",
    hLineWidth: (i: number) => (i <= 2 ? 0 : 0.5),
    vLineWidth: (i: number, node: { table: { widths: unknown[] } }) => {
      if (i === 0 || i === node.table.widths.length) return 0;
      return 0.5;
    },
    paddingTop: () => 2,
    paddingBottom: () => 2,
    paddingLeft: () => cellPadX,
    paddingRight: () => cellPadX,
  };

  const buildBlock = (blockSessions: StoredSession[], blockIndex: number) => {
    const row1: unknown[] = [
      thTop("Full Name", {
        rowSpan: 2,
        alignment: "left",
        margin: [6, 10, 0, 10],
      }),
    ];
    for (const s of blockSessions) {
      row1.push(thTop(`${s.label}\n${formatSessionDate(s.date)}`, { colSpan: 2 }), "");
    }
    row1.push(thTop("Present", { rowSpan: 2, margin: [0, 10, 0, 10] }));
    row1.push(thTop("Attendance", { rowSpan: 2, margin: [0, 10, 0, 10] }));

    const row2: unknown[] = [""];
    for (let i = 0; i < blockSessions.length; i++) {
      row2.push(thSub("Join"), thSub("Leave"));
    }
    row2.push("", "");

    const body: unknown[][] = [row1, row2];
    const ids = blockSessions.map((s) => s.id);

    students.forEach((row, i) => {
      const fill = i % 2 === 1 ? "#EFF6FF" : null;
      const line: unknown[] = [{ text: row.name, fillColor: fill, style: "td" }];
      for (const id of ids) {
        const p = row.perSession.find((x) => x.sessionId === id);
        line.push({
          text: p?.join ? formatTime(p.join) : "—",
          fillColor: fill,
          style: "td",
          alignment: "center",
        });
        line.push({
          text: p?.leave ? formatTime(p.leave) : "—",
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

    const widths: (number | string)[] = [
      nameColW,
      ...blockSessions.flatMap(() => [timeColW, timeColW]),
      presentW,
      attendanceW,
    ];

    const parts: unknown[] = [];
    if (blocks.length > 1) {
      const first = blockSessions[0]?.label ?? "";
      const last = blockSessions[blockSessions.length - 1]?.label ?? first;
      parts.push({
        text: first === last ? first : `${first} – ${last}`,
        style: "h2",
        margin: [0, blockIndex === 0 ? 0 : 4, 0, 6],
        pageBreak: blockIndex === 0 ? undefined : "before",
      });
    }
    parts.push({
      table: { headerRows: 2, dontBreakRows: true, widths, body },
      layout: tableLayout,
    });
    return parts;
  };

  // Estimated height so small reports can be vertically centred instead of
  // hugging the top of the page.
  const rowHeight = fontSize + 6;
  const headerHeight = (fontSize + 8) * 3;
  const summaryHeight = 64;
  const metaHeight = 24;
  const estimated =
    metaHeight + headerHeight + students.length * rowHeight + summaryHeight;
  const singlePage = blocks.length === 1 && estimated < availHeight;
  const topPad = singlePage
    ? Math.max(0, Math.round((availHeight - estimated) / 2))
    : 0;

  const content: unknown[] = [];
  if (topPad > 0) content.push({ text: "", margin: [0, topPad / 2, 0, 0] });
  content.push({
    text: `Date Range: ${dateRange}    •    Total Students: ${stats.totalStudents}    •    Total Sessions: ${stats.totalSessions}    •    Generated: ${generated}`,
    style: "meta",
    alignment: "center",
    margin: [0, 0, 0, 12],
  });
  blocks.forEach((b, i) => content.push(...buildBlock(b, i)));
  content.push({
    unbreakable: true,
    stack: [
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
  });

  const dd = {
    pageOrientation: "landscape",
    pageSize,
    pageMargins: [sideMargin, topMargin, sideMargin, bottomMargin],
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
          margin: [sideMargin, 14, sideMargin, 0],
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
    content,
    styles: {
      brandTitle: { fontSize: 15, bold: true },
      brandSub: { fontSize: 11, bold: true },
      title: { fontSize: 16, bold: true, color: "#0F172A", margin: [0, 0, 0, 4] },
      meta: { fontSize: 9, color: "#475569" },
      h2: { fontSize: 11, bold: true, color: "#1E3A8A" },
      thTop: { bold: true, fontSize: Math.max(fontSize, 7) },
      thSub: { bold: true, fontSize: Math.max(fontSize - 1, 6) },
      td: { fontSize },
    },
    defaultStyle: { fontSize },
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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
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
