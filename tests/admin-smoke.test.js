const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const XLSX = require('../assets/xlsx.full.min.js');

const html = fs.readFileSync('admin/index.html', 'utf8');
assert(html.includes('href="../css/admin.css"'), 'Admin stylesheet link is missing');
assert(!/<style(?:\s|>)/i.test(html), 'Admin must not contain embedded style blocks');
assert(fs.existsSync('css/admin.css'), 'Admin stylesheet file is missing');
assert(html.includes('src="../js/admin.js"'), 'Admin application script link is missing');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(script => script.trim());
assert.equal(inlineScripts.length, 0, 'Admin must not contain inline application scripts');
assert(fs.existsSync('js/admin.js'), 'Admin application script file is missing');
const scripts = [fs.readFileSync('js/admin.js', 'utf8')];
new Function(scripts[0]);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Admin contains duplicate HTML IDs');
assert(!html.includes('data:image'), 'Admin must use shared image assets');
assert(html.includes('../assets/favicon.ico'), 'Admin favicon is missing');
assert(html.includes('../assets/xlsx.full.min.js'), 'Admin must use local SheetJS');
assert(html.includes('id="reviewScopeNote"'), 'Admin review scope note is missing');
assert(html.includes('id="reviewStatusReconciliation"'), 'Admin status reconciliation is missing');
assert(html.includes('accept=".xlsx,.xls,.csv"'), 'Admin must accept CSV exports');
for (const id of ['owner', 'repo', 'branch', 'path']) {
  assert(new RegExp(`id="${id}"[^>]*readonly`).test(html), `${id} must be read-only`);
}

const noop = () => {};
const elements = new Map();
const element = id => {
  if (!elements.has(id)) {
    elements.set(id, {
      id, className: '', value: '', textContent: '', innerHTML: '',
      disabled: false, checked: false,
      classList: { add: noop, remove: noop, toggle: noop }
    });
  }
  return elements.get(id);
};
Object.entries({
  owner: 'ravi-agarwal-bits-digital', repo: 'anya-voice-dashboard',
  branch: 'main', path: 'data/voice_analytics.xlsx', token: 'test-token'
}).forEach(([id, value]) => { element(id).value = value; });

const memory = new Map();
const storage = {
  getItem: key => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key)
};

let uploaded;
let uploadedMetadata;
let fetchCalls = 0;
const fetchMock = async (url, options = {}) => {
  fetchCalls += 1;
  if (url.includes('.meta.json') && (!options.method || options.method === 'GET'))
    return { ok: false, status: 404 };
  if (url.includes('.meta.json') && options.method === 'PUT') {
    uploadedMetadata = JSON.parse(Buffer.from(JSON.parse(options.body).content, 'base64').toString());
    return { ok: true, status: 200, json: async () => ({ commit: { sha: 'meta' } }) };
  }
  if (options.method === 'PUT') {
    uploaded = Buffer.from(JSON.parse(options.body).content, 'base64');
    return { ok: true, status: 200, json: async () => ({ commit: { sha: 'new', html_url: 'https://example.test/commit' } }) };
  }
  if (url.includes('ref=new')) {
    return { ok: true, status: 200, arrayBuffer: async () => uploaded.buffer.slice(uploaded.byteOffset, uploaded.byteOffset + uploaded.byteLength) };
  }
  return { ok: true, status: 200, json: async () => ({ sha: 'old' }) };
};

const context = {
  console, XLSX, fetch: fetchMock, crypto: require('crypto').webcrypto, Blob, Response, CompressionStream, DecompressionStream,
  TextEncoder, TextDecoder, Uint8Array, Date, Map, Set, Number, String,
  Math, JSON, Array, Object, RegExp, Error, Intl,
  btoa: value => Buffer.from(value, 'binary').toString('base64'),
  atob: value => Buffer.from(value, 'base64').toString('binary'),
  setInterval: () => 0, clearInterval: noop,
  sessionStorage: storage, localStorage: storage,
  document: {
    addEventListener: noop, getElementById: element,
    querySelector: () => ({ value: 'never' }), querySelectorAll: () => []
  },
  window: {}
};
vm.createContext(context);
vm.runInContext(`${scripts[0]};globalThis.__adminTest={validateRows,encryptBytes,decryptBytes,equalBytes,publish,sha256Bytes,isSupportedExport,shouldCompressExport,gzipBytes,gunzipBytes,validationSheetName};`, context);

const required = ['Created At (IST)', 'Call ID', 'Direction', 'Status', 'From', 'To', 'Duration (s)', 'Messages', 'Full Transcript'];
const baseRow = {
  'Created At (IST)': '10 Jul 2026, 10:30:00 AM IST', 'Call ID': 'call-1',
  Direction: 'outbound', Status: 'completed', From: '918071436001', To: '919999999999',
  'Duration (s)': 30, Messages: 4, 'Full Transcript': 'Synthetic test only'
};
const sheet = XLSX.utils.json_to_sheet([
  { ...baseRow, 'Future Vendor Column': 'accepted' },
  { ...baseRow, 'Call ID': 'call-2', To: '918888888888', 'Future Vendor Column': 'accepted' }
]);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, 'Voice Export');
const roundTripWorkbook = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(roundTripWorkbook.Sheets['Voice Export'], { defval: '', raw: false });

assert(context.__adminTest.isSupportedExport('voice_analytics.csv'), 'CSV exports should be accepted');
assert(!context.__adminTest.isSupportedExport('voice_analytics.txt'), 'Unsupported exports should be rejected');
assert(context.__adminTest.shouldCompressExport('voice_analytics.csv'), 'CSV exports should be compressed before publishing');
assert(!context.__adminTest.shouldCompressExport('voice_analytics.xlsx'), 'Excel exports must retain their existing publish format');
const csv = '\uFEFFCreated At (IST),Call ID,Direction,Status,From,To,Duration (s),Messages,Full Transcript\n"10 Jul 2026, 10:30:00 AM IST",csv-1,outbound,completed,918071436001,919999999999,30,4,"First line\nSecond line"\n"10 Jul 2026, 10:35:00 AM IST",csv-2,outbound,completed,918071436001,918888888888,45,5,"Second call"';
const csvWorkbook = XLSX.read(Buffer.from(csv), { type: 'buffer', cellDates: true });
const csvSheetName = context.__adminTest.validationSheetName(csvWorkbook, 'voice_analytics.csv');
assert.equal(csvSheetName, 'Sheet1', 'CSV should validate its parsed single sheet');
const csvRows = XLSX.utils.sheet_to_json(csvWorkbook.Sheets[csvSheetName], { defval: '', raw: false });
assert.equal(csvRows[0]['Full Transcript'], 'First line\nSecond line', 'Multiline CSV transcripts must be preserved');
assert.equal(context.__adminTest.validateRows(csvRows, Object.keys(csvRows[0])).errors.length, 0, 'Valid CSV rows should pass validation');
assert.equal(context.__adminTest.validationSheetName(roundTripWorkbook, 'voice_analytics.xlsx'), 'Voice Export', 'Excel exports must retain the canonical sheet requirement');

const valid = context.__adminTest.validateRows(rows, Object.keys(rows[0]));
assert.equal(valid.errors.length, 0, 'Synthetic workbook should pass');
assert(valid.warnings.some(item => item.includes('Future Vendor Column')), 'Extra columns should be reported');
assert.deepEqual(valid.metrics.rawStatusCounts, { completed: 2, failed: 0, initiated: 0, other: 0 }, 'Raw status counts changed');
assert.equal(valid.metrics.lifecycleDuplicateRows, 0, 'Unique synthetic Call IDs should have no lifecycle duplicates');
const duplicateValidation = context.__adminTest.validateRows([{ ...baseRow }, { ...baseRow, Status: 'failed' }], required);
assert.equal(duplicateValidation.metrics.lifecycleDuplicateRows, 1, 'Lifecycle duplicate rows should be surfaced');
assert.deepEqual(duplicateValidation.metrics.rawStatusCounts, { completed: 1, failed: 1, initiated: 0, other: 0 }, 'Raw duplicate status counts changed');
assert.equal(duplicateValidation.metrics.completed, 1, 'Final completed Call-ID count changed');
assert(duplicateValidation.warnings.some(item => item.includes('raw rows repeat')), 'Lifecycle duplicate warning is missing');
assert(context.__adminTest.validateRows(rows, required.filter(column => column !== 'Call ID')).errors.some(item => item.includes('Call ID')), 'Missing required columns should fail');
assert(context.__adminTest.validateRows([{ ...baseRow, Status: 'future-status' }], required).errors.some(item => item.includes('unsupported Status')), 'Unknown status should fail');

const largeRows = Array.from({ length: 130000 }, (_, index) => ({
  ...baseRow,
  'Call ID': `scale-${index}`,
  To: `91${String(6000000000 + index)}`,
  'Created At (IST)': index % 2 ? '10 Jul 2026, 10:30:00 AM IST' : '11 Jul 2026, 10:30:00 AM IST'
}));
const largeValidation = context.__adminTest.validateRows(largeRows, required);
assert.equal(largeValidation.errors.length, 0, 'Large workbook validation should not overflow argument limits');
assert.equal(largeValidation.metrics.dateMin.getDate(), 10, 'Large workbook minimum date changed');
assert.equal(largeValidation.metrics.dateMax.getDate(), 11, 'Large workbook maximum date changed');

(async () => {
  const source = new TextEncoder().encode('synthetic workbook bytes');
  const encrypted = await context.__adminTest.encryptBytes(source, 'test-passphrase', 'AANYAENC1');
  const decrypted = await context.__adminTest.decryptBytes(encrypted, 'test-passphrase', 'AANYAENC1');
  assert(context.__adminTest.equalBytes(source, decrypted), 'Encryption round-trip failed');
  const repetitiveCsv = new TextEncoder().encode('Created At (IST),Call ID\n'.repeat(300));
  const compressedCsv = await context.__adminTest.gzipBytes(repetitiveCsv);
  assert(compressedCsv.length < repetitiveCsv.length, 'CSV compression should reduce repetitive exports');
  assert(context.__adminTest.equalBytes(repetitiveCsv, await context.__adminTest.gunzipBytes(compressedCsv)), 'Compressed CSV round-trip failed');

  element('publishConfirm').checked = true;
  vm.runInContext(`ADMIN_PASSPHRASE='test-passphrase';validation={errors:[],bytes:new TextEncoder().encode('synthetic workbook')};`, context);
  await context.__adminTest.publish();
  assert.equal(fetchCalls, 5, 'Publish should check metadata and production, upload, verify and save metadata');
  assert.match(uploadedMetadata.plaintextSha256, /^[a-f0-9]{64}$/, 'Plaintext fingerprint missing');
  assert.equal(uploadedMetadata.dataCommitSha, 'new', 'Metadata must identify the published data commit');
  assert.deepEqual(Object.keys(uploadedMetadata).sort(), ['dataCommitSha', 'plaintextSha256', 'publishedAt', 'schemaVersion'].sort(), 'Metadata must remain public-safe and minimal');
  assert(element('publishStatus').innerHTML.includes('Published and verified successfully'), 'Success receipt missing');
  assert(element('publishStatus').innerHTML.includes('View previous versions'), 'History link missing');

  const callsBeforeDuplicate = fetchCalls;
  const duplicateSource = new TextEncoder().encode('synthetic workbook');
  const duplicateHash = await context.__adminTest.sha256Bytes(duplicateSource);
  context.fetch = async url => {
    fetchCalls += 1;
    assert(url.includes('.meta.json'), 'Duplicate publication must stop before reading or writing the data file');
    return {
      ok: true, status: 200,
      json: async () => ({ sha: 'meta', content: Buffer.from(JSON.stringify({ plaintextSha256: duplicateHash })).toString('base64') })
    };
  };
  element('publishConfirm').checked = true;
  vm.runInContext(`validation={errors:[],bytes:new TextEncoder().encode('synthetic workbook')};`, context);
  await context.__adminTest.publish();
  assert.equal(fetchCalls, callsBeforeDuplicate + 1, 'Duplicate workbook should make only the metadata check');
  assert(element('publishStatus').textContent.includes('already published'), 'Duplicate block message missing');
  console.log('Admin smoke tests passed');
})().catch(error => { console.error(error); process.exit(1); });
