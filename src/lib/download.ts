export function openDownloadTab(filename: string) {
  if (typeof window === "undefined") return null;
  try {
    const tab = window.open("", "_blank");
    if (!tab) return null;
    tab.document.title = `Preparing ${filename}`;
    tab.document.body.innerHTML = `
      <main style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a;">
        <h1 style="font-size: 18px; margin: 0 0 8px;">Preparing download…</h1>
        <p style="margin: 0; color: #475569;">Your file will open here shortly.</p>
      </main>
    `;
    return tab;
  } catch {
    return null;
  }
}

export function downloadBlob(blob: Blob, filename: string, downloadTab?: Window | null) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  if (downloadTab && !downloadTab.closed) {
    downloadTab.location.href = url;
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}