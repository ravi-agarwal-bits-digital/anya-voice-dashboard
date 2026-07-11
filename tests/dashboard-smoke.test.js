const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const XLSX = require('../assets/xlsx.full.min.js');

const html = fs.readFileSync('index.html', 'utf8');
assert(html.includes('href="css/dashboard.css"'), 'Dashboard stylesheet link is missing');
assert(!/<style(?:\s|>)/i.test(html), 'Dashboard must not contain embedded style blocks');
assert(html.includes('src="js/auth.js"'), 'Dashboard authentication script link is missing');
assert(html.includes('src="js/dashboard.js"'), 'Dashboard application script link is missing');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(script => script.trim());
assert.equal(inlineScripts.length, 0, 'Dashboard must not contain inline application scripts');

const scripts = ['js/auth.js', 'js/dashboard.js'].map(path => {
  assert(fs.existsSync(path), `Missing dashboard script: ${path}`);
  return fs.readFileSync(path, 'utf8');
});
scripts.forEach(script => new Function(script));

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Dashboard contains duplicate HTML IDs');

const idSet = new Set(ids);
const hashLinks = [...html.matchAll(/href=["']#([^"']+)["']/g)].map(match => match[1]);
assert.deepEqual(hashLinks.filter(id => !idSet.has(id)), [], 'Dashboard contains broken hash links');

for (const path of [
  'assets/logo.jpg', 'assets/favicon.ico', 'assets/favicon-16.png',
  'assets/favicon-32.png', 'assets/apple-touch-icon.png', 'assets/xlsx.full.min.js',
  'css/dashboard.css'
]) {
  assert(fs.existsSync(path), `Missing dashboard asset: ${path}`);
}

for (const id of [
  'loginGate', 'dashboardContent', 'reportView', 'filterBar', 'directionSwitch',
  'campaignFilter', 'searchMobile', 'userSearchResult', 'explorerList', 'sec-brief'
]) {
  assert(idSet.has(id), `Missing required dashboard element: ${id}`);
}

const noop = () => {};
const makeElement = () => new Proxy({
  style: {}, value: '', innerHTML: '', textContent: '', offsetParent: null,
  offsetHeight: 0, scrollHeight: 0, clientHeight: 0,
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop, setAttribute: noop, removeAttribute: noop,
  querySelectorAll: () => [], querySelector: () => null,
  appendChild: noop, focus: noop, click: noop,
  getBoundingClientRect: () => ({ top: 0 })
}, {
  get: (target, property) => property in target ? target[property] : noop,
  set: (target, property, value) => { target[property] = value; return true; }
});

const elements = new Map();
const getElement = id => {
  if (!elements.has(id)) elements.set(id, makeElement());
  return elements.get(id);
};
const document = {
  body: makeElement(), getElementById: getElement,
  querySelector: () => makeElement(), querySelectorAll: () => [],
  createElement: () => makeElement(), addEventListener: noop
};
const storage = { getItem: () => null, setItem: noop, removeItem: noop, clear: noop };
const context = {
  console, XLSX, document, sessionStorage: storage, localStorage: storage,
  crypto: require('crypto').webcrypto, TextEncoder, TextDecoder, Uint8Array,
  Date, Map, Set, Math, Number, String, Array, Object, RegExp, JSON, Error, Intl,
  FileReader: function FileReader() {}, File: function File() {}, Blob: function Blob() {},
  URL: { createObjectURL: () => '', revokeObjectURL: noop },
  history: { replaceState: noop }, location: { pathname: '/', search: '', hash: '' },
  alert: noop, setTimeout: () => 0, clearTimeout: noop,
  setInterval: () => 0, clearInterval: noop,
  requestAnimationFrame: () => 0, getComputedStyle: () => ({ position: 'static' }),
  addEventListener: noop, innerWidth: 1200, scrollY: 0, pageYOffset: 0, scrollTo: noop
};
context.window = context;
vm.createContext(context);
scripts.forEach(script => vm.runInContext(script, context));

for (const fn of [
  'parseDateFull', 'normalizeDirection', 'resolveLeadPhone', 'dedupeRowsByCallId',
  'chooseWorkbookRows', 'rowToRecord', 'aggregate', 'applyFilters', 'pickField',
  'recordDateBounds', 'preferLifecycleRow'
]) {
  assert.equal(typeof context[fn], 'function', `Missing dashboard function: ${fn}`);
}

assert.equal(context.normalizeDirection('OUTBOUND'), 'outbound');
assert.equal(context.normalizeDirection('incoming call'), 'inbound');
assert.equal(context.resolveLeadPhone({ From: '918071436001', To: '919999999999' }, 'outbound'), '919999999999');
assert.equal(context.resolveLeadPhone({ From: '918888888888', To: '918062912051' }, 'inbound'), '918888888888');

const overview = XLSX.utils.aoa_to_sheet([['Overview'], ['Not call data']]);
const voiceRows = [
  {
    'Created At (IST)': '10 Jul 2026, 10:30:00 AM IST', 'Call ID': 'call-1',
    Direction: 'outbound', Status: 'initiated', From: '918071436001', To: '919999999999',
    'Duration (s)': 0, Messages: 0, 'Full Transcript': ''
  },
  {
    'Created At (IST)': '10 Jul 2026, 10:31:00 AM IST', 'Call ID': 'call-1',
    Direction: 'outbound', Status: 'completed', From: '918071436001', To: '919999999999',
    'Duration (s)': 45, Messages: 6, 'Full Transcript': 'Synthetic test conversation',
    'Lead Temp.': 'Hot', 'Review Band': 'Green', 'Bot Conf.': 90, 'Need Score': 80
  },
  {
    'Created At (IST)': '10 Jul 2026, 11:00:00 AM IST', 'Call ID': 'call-2',
    Direction: 'inbound', Status: 'completed', From: '918888888888', To: '918062912051',
    'Duration (s)': 30, Messages: 4, 'Full Transcript': 'Synthetic inbound conversation',
    'Lead Temp.': 'Warm', 'Review Band': 'Amber', 'Bot Conf.': 75, 'Need Score': 60
  }
];
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, overview, 'Overview');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(voiceRows), 'Voice Export');
const reopened = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
const chosen = context.chooseWorkbookRows(reopened);
assert.equal(chosen.name, 'Voice Export', 'Dashboard should choose the call-data worksheet');

const deduped = context.dedupeRowsByCallId(chosen.rows);
assert.equal(deduped.length, 2, 'Lifecycle rows should deduplicate by Call ID');
assert.equal(deduped.find(row => row['Call ID'] === 'call-1').Status, 'completed', 'Completed lifecycle row should win');

const sameRankRows = [
  {
    'Created At (IST)': '10 Jul 2026, 12:00:00 PM IST', 'Call ID': 'call-3',
    Direction: 'outbound', Status: 'completed', From: '918071436001', To: '917777777777',
    'Duration (s)': 40, Messages: 4, 'Full Transcript': ''
  },
  {
    'Created At (IST)': '10 Jul 2026, 12:01:00 PM IST', 'Call ID': 'call-3',
    Direction: 'outbound', Status: 'completed', From: '918071436001', To: '917777777777',
    'Duration (s)': 45, Messages: 6, 'Full Transcript': 'More complete final conversation',
    'Lead Temp.': 'Hot', 'Review Band': 'Green', 'Bot Conf.': 92, 'Need Score': 85
  }
];
const preferred = context.dedupeRowsByCallId(sameRankRows)[0];
assert.equal(preferred['Created At (IST)'], '10 Jul 2026, 12:01:00 PM IST', 'Latest same-status lifecycle row should win');
assert.equal(preferred['Lead Temp.'], 'Hot', 'More complete same-status lifecycle row should be retained');

assert.equal(context.pickField({ call_direction: 'outbound' }, ['Call Direction']), 'outbound', 'Normalized column lookup changed');
assert.deepEqual(
  JSON.parse(JSON.stringify(context.recordDateBounds([{ d: '2026-07-10' }, { d: '2026-07-08' }, { d: '2026-07-12' }]))),
  { min: '2026-07-08', max: '2026-07-12' },
  'Date bounds should not require sorting the dataset'
);

const records = deduped.map(context.rowToRecord).filter(record => record && record.d);
assert.equal(records.find(record => record.callId === 'call-1').from, '919999999999', 'Outbound learner mapping changed');
assert.equal(records.find(record => record.callId === 'call-2').from, '918888888888', 'Inbound learner mapping changed');

console.log('Dashboard smoke tests passed');
