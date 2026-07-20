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

  triggerDownload(url, filename);

  if (downloadTab && !downloadTab.closed) {
    writeDownloadFallback(downloadTab, url, filename);
  } else {
    window.setTimeout(() => {
      try {
        const tab = window.open("", "_blank");
        if (tab) writeDownloadFallback(tab, url, filename);
      } catch {
        // The hidden anchor above is still the primary download path.
      }
    }, 0);
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.target = "_blank";
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

function writeDownloadFallback(tab: Window, url: string, filename: string) {
  const safeFilename = escapeHtml(filename);
  try {
    tab.document.open();
    tab.document.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <title>${safeFilename}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body style="margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;">
          <main style="min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;">
            <section style="width:min(460px,100%);background:white;border:1px solid #cbd5e1;border-radius:12px;padding:24px;text-align:center;box-shadow:0 16px 40px rgba(15,23,42,.12);">
              <h1 style="font-size:20px;margin:0 0 8px;">Download ready</h1>
              <p style="font-size:14px;color:#475569;margin:0 0 18px;line-height:1.5;">If the download did not start automatically, click the button below.</p>
              <a id="download-file" href="${url}" download="${safeFilename}" style="display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 18px;border-radius:8px;background:#1E3A8A;color:white;text-decoration:none;font-weight:700;">Download report</a>
            </section>
          </main>
        </body>
      </html>
    `);
    tab.document.close();
    tab.focus();
    window.setTimeout(() => {
      const link = tab.document.getElementById("download-file") as HTMLAnchorElement | null;
      link?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: tab,
        }),
      );
    }, 50);
  } catch {
    try {
      tab.location.href = url;
    } catch {
      // Nothing else to do; the primary hidden anchor has already run.
    }
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}