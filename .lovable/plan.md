## NMU Business School Attendance Report Generator

A single-page app that turns Zoom attendance exports into a clean, combined attendance report. Everything runs in the browser — no login, no server, no database. Reports persist in `localStorage` so you can revisit them.

### Core workflow

1. Create a new Report (give it a name, e.g. "PDBA MBA Management Accounting").
2. Upload one Zoom export per session. Each file = one session. Sessions are numbered in the order you upload (rename/reorder allowed).
3. The app cleans, merges, and combines all uploaded sessions into one master table.
4. View the dashboard, filter/search, and export to Excel or PDF.
5. Report is auto-saved to browser storage under "Recent Reports".

### Data cleaning rules (per uploaded file)

- Skip the top metadata block (Topic / ID / Host / Start / End).
- Capture session metadata: **Topic**, **Date** (from Start time), **Start**, **End**, **Host email**.
- Read the attendee block starting at the "Name (original name), Email, Join time, Leave time…" header.
- Drop the **Email** column from the output.
- **Exclude the Host row** (match by host email or host display name).
- **Normalize names**: trim, collapse spaces, strip parenthetical aliases like "Nomkhosi Mhlahlo (Nunu Mhlahlo)" → "Nomkhosi Mhlahlo", convert "Doe, John" → "John Doe", title-case ("JOHN DOE" / "john doe" → "John Doe"). Concatenated names like "NombusoJobela" left as-is (safer than guessing splits).
- **Merge duplicate rows for the same person in the same session**: keep earliest Join, latest Leave.
- Format times as `HH:MM AM/PM`.
- **Attendance rule (per your answer)**: any join at all = Present for that session.

### Combining across sessions

- Union of all normalized names across every uploaded session.
- For each student × session: show Join / Leave, or "—" if absent.
- Totals: **Sessions Attended**, **Attendance %** = attended ÷ total sessions × 100.
- Sort alphabetically by full name.

### UI / Pages

- `/` — Landing + Recent Reports list with "New Report" and drag-and-drop.
- `/report/$id` — Report workspace:
  - **Header**: report name (editable), date range (auto from sessions), generated-on.
  - **Session strip**: cards for each uploaded session (Session 1, 2, 3… with date + attendee count + rename/delete/reorder). Big "Add Session" drop zone.
  - **Dashboard cards**: Total Students, Total Sessions, Average Attendance, Highest, Lowest, Perfect Attendance count, Absent Students count.
  - **Filters bar**: search by name, min/max attendance %, date range (filters which sessions are included), session multi-select.
  - **Attendance table**: sticky first column (Name), grouped session columns (Join / Leave), Total Present, Attendance % with color chip (green ≥ 80, amber 50–79, red < 50). Virtualized via TanStack Table for large rosters.
  - **Export**: "Download Excel" and "Download PDF" buttons.

### Excel export

Uses SheetJS + a light styling pass (`xlsx-js-style`):
- Merged title row "NMU Business School — Attendance Report".
- Subtitle: report name, date range, generated on.
- Bold header row with grouped session columns, blue fill, white text, borders.
- Alternating row shading, frozen top rows, auto column widths.
- Attendance % as a percentage cell with conditional color.
- Landscape print layout.

### PDF export

Uses `pdfmake` (better tables than jsPDF, works fully in browser):
- Landscape A4.
- Header: "NMU Business School" + report title + date range + generated-on.
- Wide attendance table with repeating header row.
- Summary block at the end (same cards as dashboard).
- Page numbers "Page X of Y".

### Storage

- All reports stored in `localStorage` under `nmu-attendance-reports-v1` (JSON: name, sessions[], created/updated).
- Delete + rename report from Recent Reports.
- No file re-upload needed to view a saved report — parsed data is cached.

### Error handling

Toasts for: invalid file type (not .xls/.xlsx/.csv), missing attendee header block, empty sheet, duplicate session upload (same Topic + Start time — asks to confirm), file too large.

### Design

Blue + white university theme, rounded cards, soft shadows, subtle motion on card/row mount, responsive down to mobile (table becomes horizontally scrollable with sticky name column). Toast notifications via shadcn/sonner.

### Technical section

- **Stack**: TanStack Start (already set up) + React 19 + TypeScript + Tailwind v4 + shadcn/ui.
- **Excel parsing**: `xlsx` (SheetJS) — reads .xls and .xlsx.
- **Excel export styling**: `xlsx-js-style` (fork of SheetJS with cell styles).
- **PDF export**: `pdfmake` with `vfs_fonts`.
- **Table**: `@tanstack/react-table` + `@tanstack/react-virtual` for large rosters.
- **State**: local component state + a small `useReports()` hook backed by `localStorage`. No TanStack Query needed (no server).
- **Routes** (file-based under `src/routes/`):
  - `index.tsx` — landing + recent reports.
  - `report.$id.tsx` — report workspace.
  - `__root.tsx` — updated head metadata ("NMU Business School Attendance Report Generator").
- **Modules**:
  - `src/lib/attendance/parse.ts` — parse one Zoom export → `SessionData`.
  - `src/lib/attendance/normalize.ts` — name normalization + merging.
  - `src/lib/attendance/combine.ts` — combine sessions → master table.
  - `src/lib/attendance/export-excel.ts` — Excel export.
  - `src/lib/attendance/export-pdf.ts` — PDF export.
  - `src/lib/attendance/storage.ts` — localStorage CRUD.
  - `src/components/attendance/*` — SessionCard, DashboardCards, AttendanceTable, FiltersBar, UploadDropzone, ReportHeader.
- **No backend, no Lovable Cloud, no auth.**

### Out of scope (can be added later)

- Multi-device sync / cross-browser reports (would need Lovable Cloud).
- Auto-splitting concatenated names ("NombusoJobela").
- Manual "merge these two students" UI (v2 if fuzzy matching misses cases).
- NMU logo — placeholder used unless you upload one; happy to swap in.
