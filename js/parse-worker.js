// Off-main-thread workbook parser for the dashboard.
//
// Receives  { buf: ArrayBuffer }  (decrypted .xlsx bytes)
// Returns   { ok: true, sheets: [{ name, rows }] }   on success
//           { ok: false, error: string }             on failure
//
// The heavy XLSX.read (~5s on a 60k-row export) runs here instead of on the main thread, so the
// dashboard stays interactive and its loading spinner keeps animating during load. Sheet selection,
// Call-ID dedupe and record mapping stay on the main thread (they depend on the app's own logic),
// so this worker only does the raw parse. If anything here fails, dashboard.js falls back to an
// inline main-thread parse, so behaviour degrades gracefully rather than breaking.
try { importScripts('../assets/xlsx.full.min.js'); } catch (e) { /* reported on first message */ }

self.onmessage = function (e) {
  try {
    if (typeof XLSX === 'undefined') throw new Error('spreadsheet engine unavailable in worker');
    const buf = e.data && e.data.buf;
    if (!buf) throw new Error('no data received');
    // dense:true — faster parse on large sheets; raw:false — match the main-thread ingest exactly.
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true, dense: true });
    const sheets = (wb.SheetNames || []).map(name => ({
      name,
      rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: false })
    }));
    self.postMessage({ ok: true, sheets });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
