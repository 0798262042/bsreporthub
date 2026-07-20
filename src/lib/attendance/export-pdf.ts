import type { StoredSession, StudentRow } from "./types";
import { formatDate, formatTime } from "./normalize";
import { computeStats, reportDateRange } from "./combine";

export async function exportReportPdf(
  reportName: string,
  sessions: StoredSession[],
  students: StudentRow[],
) {
  const [{ default: pdfMake }, vfsFonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pm = pdfMake as unknown as {
    vfs: Record<string, string>;
    addVirtualFileSystem?: (vfs: Record<string, string>) => void;
    createPdf: (dd: unknown) => { download: (n: string) => void };
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

  const header = ["Full Name"];
  for (const s of sessions) {
    header.push(`${s.label}\nJoin`);
    header.push(`Leave`);
  }
  header.push("Present");
  header.push("%");

  const body: unknown[][] = [
    header.map((h) => ({
      text: h,
      style: "th",
      fillColor: "#1E3A8A",
      color: "white",
    })),
  ];

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
    120,
    ...sessions.flatMap(() => ["auto", "auto"]),
    "auto",
    "auto",
  ];

  const sessionList = sessions
    .map((s) => `${s.label}: ${formatDate(s.date)}${s.topic ? ` — ${s.topic}` : ""}`)
    .join("\n");

  const dd = {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [24, 96, 24, 40],
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
                  margin: [0, 10, 0, 10],
                  border: [false, false, false, false],
                },
              ],
              [
                {
                  text: reportName,
                  style: "brandSub",
                  alignment: "center",
                  fillColor: "#1E3A8A",
                  color: "white",
                  margin: [0, 0, 0, 8],
                  border: [false, false, false, false],
                },
              ],
            ],
          },
          layout: "noBorders",
          margin: [24, 12, 24, 0],
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
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
      },
      { text: "Summary", style: "h2", margin: [0, 16, 0, 6] },
      {
        columns: [
          statBlock("Average Attendance", `${stats.avg}%`),
          statBlock("Highest", `${stats.highest}%`),
          statBlock("Lowest", `${stats.lowest}%`),
          statBlock("Perfect", stats.perfect),
          statBlock("Absent", stats.absent),
        ],
      },
      { text: "Sessions", style: "h2", margin: [0, 16, 0, 6] },
      { text: sessionList, fontSize: 9, color: "#334155" },
    ],
    styles: {
      brandTitle: { fontSize: 14, bold: true },
      brandSub: { fontSize: 11, bold: true },
      title: { fontSize: 16, bold: true, color: "#0F172A", margin: [0, 0, 0, 4] },
      meta: { fontSize: 9, color: "#475569" },
      h2: { fontSize: 11, bold: true, color: "#1E3A8A" },
      th: { bold: true, fontSize: 8, alignment: "center" },
      td: { fontSize: 8 },
    },
    defaultStyle: { fontSize: 8 },
  };

  const filename = `${reportName.replace(/[^\w\-]+/g, "_")}_attendance.pdf`;
  pm.createPdf(dd).download(filename);
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
