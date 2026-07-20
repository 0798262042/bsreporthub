export function buildExportFilename(
  filenameBase: string | undefined,
  reportName: string,
  ext: "pdf" | "xlsx",
): string {
  const base = (filenameBase || reportName)
    .replace(/[^\w\-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || "attendance"}.${ext}`;
}