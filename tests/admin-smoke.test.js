const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const XLSX = require('../assets/xlsx.full.min.js');

const html = fs.readFileSync('admin/index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(script => script.trim());

assert.equal(scripts.length, 1, 'Admin must contain one inline application script');
new Function(scripts[0]);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Admin contains duplicate HTML IDs');
assert(!html.includes('data:image'), 'Admin must use shared image assets');
assert(html.includes('../assets/favicon.ico'), 'Admin favicon is missing');
assert(html.includes('../assets/xlsx.full.min.js'), 'Admin must use local SheetJS');
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
let fetchCalls = 0;
const fetchMock = async (_url, options = {}) => {
  fetchCalls += 1;
  if (fetchCalls === 1) return { ok: true, status: 200, json: async () => ({ sha: 'old' }) };
  if (fetchCalls === 2) {
    uploaded = Buffer.from(JSON.parse(options.body).content, 'base64');
    return { ok: true, status: 200, json: async () => ({ commit: { sha: 'new', html_url: 'https://example.test/commit' } }) };
  }
  if (fetchCalls === 3) {
    return { ok: true, status: 200, arrayBuffer: async () => uploaded.buffer.slice(uploaded.byteOffset, uploaded.byteOffset + uploaded.byteLength) };
  }
  throw new Error('Unexpected fetch call');
};

const context = {
  console, XLSX, fetch: fetchMock, crypto: require('crypto').webcrypto,
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
vm.runInContext(`${scripts[0]};globalThis.__adminTest={validateRows,encryptBytes,decryptBytes,equalBytes,publish};`, context);

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

const valid = context.__adminTest.validateRows(rows, Object.keys(rows[0]));
assert.equal(valid.errors.length, 0, 'Synthetic workbook should pass');
assert(valid.warnings.some(item => item.includes('Future Vendor Column')), 'Extra columns should be reported');
assert(context.__adminTest.validateRows(rows, required.filter(column => column !== 'Call ID')).errors.some(item => item.includes('Call ID')), 'Missing required columns should fail');
assert(context.__adminTest.validateRows([{ ...baseRow, Status: 'future-status' }], required).errors.some(item => item.includes('unsupported Status')), 'Unknown status should fail');

(async () => {
  const source = new TextEncoder().encode('synthetic workbook bytes');
  const encrypted = await context.__adminTest.encryptBytes(source, 'test-passphrase', 'AANYAENC1');
  const decrypted = await context.__adminTest.decryptBytes(encrypted, 'test-passphrase', 'AANYAENC1');
  assert(context.__adminTest.equalBytes(source, decrypted), 'Encryption round-trip failed');

  element('publishConfirm').checked = true;
  vm.runInContext(`ADMIN_PASSPHRASE='test-passphrase';validation={errors:[],bytes:new TextEncoder().encode('synthetic workbook')};`, context);
  await context.__adminTest.publish();
  assert.equal(fetchCalls, 3, 'Publish should check, upload and verify');
  assert(element('publishStatus').innerHTML.includes('Published and verified successfully'), 'Success receipt missing');
  assert(element('publishStatus').innerHTML.includes('View previous versions'), 'History link missing');
  console.log('Admin smoke tests passed');
})().catch(error => { console.error(error); process.exit(1); });
