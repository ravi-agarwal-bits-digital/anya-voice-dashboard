/* global XLSX */

// Parse large workbooks away from the UI thread. The dashboard still owns worksheet scoring,
// lifecycle deduplication and record normalization so business logic remains in one place.
importScripts('../assets/xlsx.full.min.js');

self.onmessage = event => {
  try {
    const bytes = new Uint8Array(event.data.bytes);
    const workbook = XLSX.read(bytes, { type: 'array', cellDates: true, dense: true });
    const names = workbook.SheetNames || [];
    const preferred = names.includes('Voice Export') ? ['Voice Export'] : names;
    let sheets = preferred.map(name => ({
      name,
      rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '', raw: false })
    })).filter(sheet => sheet.rows.length);

    // Preserve compatibility with older workbooks whose active data sheet had another name.
    if (!sheets.length && preferred.length !== names.length) {
      sheets = names.filter(name => name !== 'Voice Export').map(name => ({
        name,
        rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '', raw: false })
      })).filter(sheet => sheet.rows.length);
    }

    self.postMessage({ ok: true, sheets });
  } catch (error) {
    self.postMessage({ ok: false, error: error?.message || String(error) });
  }
};
