import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

/**
 * SheetJS does not emit print settings, so patch the generated workbook zip:
 * landscape, all columns on a single page width, narrow centred margins and
 * repeating header rows — so "Save as PDF" from Excel looks like our PDF export.
 */
export function applyPrintSetup(
  buf: ArrayBuffer,
  opts: { sheetName: string; titleRows: [number, number] },
): ArrayBuffer {
  try {
    const files = unzipSync(new Uint8Array(buf));
    const sheetPath = Object.keys(files).find((k) =>
      /^xl\/worksheets\/sheet1\.xml$/.test(k),
    );
    if (sheetPath) {
      let xml = strFromU8(files[sheetPath]);
      xml = xml
        .replace(/<pageMargins[^>]*\/>/g, "")
        .replace(/<pageSetup[^>]*\/>/g, "")
        .replace(/<sheetPr[^>]*\/>/g, "");
      // <ignoredErrors> must come AFTER printOptions/pageMargins/pageSetup in
      // the OOXML schema; pull it out and re-append it in the right order,
      // otherwise Excel treats the sheet as corrupt and opens it empty.
      let ignored = "";
      xml = xml.replace(
        /<ignoredErrors>[\s\S]*?<\/ignoredErrors>|<ignoredErrors[^>]*\/>/,
        (m) => {
          ignored = m;
          return "";
        },
      );
      xml = xml.replace(
        /(<worksheet[^>]*>)/,
        `$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`,
      );
      xml = xml.replace(
        /<\/worksheet>/,
        `<printOptions horizontalCentered="1"/>` +
          `<pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>` +
          `<pageSetup paperSize="9" orientation="landscape" scale="100" fitToWidth="1" fitToHeight="0" horizontalDpi="300" verticalDpi="300"/>` +
          ignored +
          `</worksheet>`,
      );
      files[sheetPath] = strToU8(xml);
    }

    const wbPath = "xl/workbook.xml";
    if (files[wbPath]) {
      let wb = strFromU8(files[wbPath]);
      if (!/Print_Titles/.test(wb)) {
        const ref = `'${opts.sheetName.replace(/'/g, "''")}'!$${opts.titleRows[0]}:$${opts.titleRows[1]}`;
        const dn = `<definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">${ref}</definedName></definedNames>`;
        wb = /<definedNames>/.test(wb)
          ? wb
          : wb.replace(/<\/sheets>/, `</sheets>${dn}`);
        files[wbPath] = strToU8(wb);
      }
    }

    // Keep [Content_Types].xml as the first entry in the archive.
    const ordered: Record<string, Uint8Array> = {};
    if (files["[Content_Types].xml"])
      ordered["[Content_Types].xml"] = files["[Content_Types].xml"];
    for (const k of Object.keys(files))
      if (k !== "[Content_Types].xml") ordered[k] = files[k];

    const out = zipSync(ordered, { level: 6 });
    return out.buffer.slice(
      out.byteOffset,
      out.byteOffset + out.byteLength,
    ) as ArrayBuffer;
  } catch {
    return buf;
  }
}