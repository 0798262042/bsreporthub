export function openDownloadTab(_filename: string): Window | null {
  // Kept for API compatibility; we no longer open a helper tab.
  return null;
}

export function downloadBlob(blob: Blob, filename: string, _downloadTab?: Window | null) {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.position = "fixed";
  link.style.left = "-9999px";
  link.style.top = "0";
  document.body.appendChild(link);
  link.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    }),
  );
  link.remove();
}