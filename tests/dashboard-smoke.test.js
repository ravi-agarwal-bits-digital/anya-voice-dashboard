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
  'css/dashboard.css', 'js/workbook-worker.js'
]) {
  assert(fs.existsSync(path), `Missing dashboard asset: ${path}`);
}

for (const id of [
  'loginGate', 'dashboardContent', 'reportView', 'filterBar', 'directionSwitch',
  'campaignFilter', 'searchMobile', 'userSearchResult', 'explorerList', 'sec-brief',
  'btn-today', 'btn-yesterday', 'btn-week', 'btn-month', 'btn-all', 'btn-custom',
  'filterFromDate', 'filterToDate', 'openMgmtSummaryBtn', 'kpiPanelExport', 'profileExport',
  'kpiPanelLedger', 'profileLedger', 'publicationFreshness'
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
const loadingText = makeElement();
const getElement = id => {
  if (!elements.has(id)) elements.set(id, makeElement());
  return elements.get(id);
};
const document = {
  body: makeElement(), getElementById: getElement,
  querySelector: selector => selector === '#dataLoading p' ? loadingText : makeElement(), querySelectorAll: () => [],
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
  'recordDateBounds', 'preferLifecycleRow', 'esc', 'jsArg', 'sumBilledMinutes',
  'groupByPhone', 'runPaintChunks', 'resolveCallbackWindow', 'normalizeDisposition',
  'intentOf', 'paintIntentQuality', 'paintCallbacks', 'parseWorkbookBytes',
  'parseWorkbookInWorker', 'parseWorkbookOnMainThread', 'workbookWorkerTimeout',
  'chooseWorkbookCandidates', 'setDashboardLoadingMessage', 'processWorkbookBytes',
  'organizeDashboardWorkspaces', 'setDashboardWorkspaceTab', 'activateDashboardWorkspace',
  'handleWorkspaceTabKey', 'recordsToCSV', 'exportPanelCSV', 'exportProfileCSV',
  'updateWorkspaceOperationalState', 'openPanelInLedger', 'openProfileInLedger',
  'outboundGlanceStats', 'exportUnreachableCSV', 'resolveLeadSearch', 'percentOf'
]) {
  assert.equal(typeof context[fn], 'function', `Missing dashboard function: ${fn}`);
}

assert.equal(context.normalizeDirection('OUTBOUND'), 'outbound');
assert.equal(context.normalizeDirection('incoming call'), 'inbound');
assert.equal(context.resolveLeadPhone({ From: '918071436001', To: '919999999999' }, 'outbound'), '919999999999');
assert.equal(context.resolveLeadPhone({ From: '918888888888', To: '918062912051' }, 'inbound'), '918888888888');

assert.deepEqual(
  JSON.parse(JSON.stringify(context.parseDateFull('10 Jul 2026, 10:30:00 AM IST'))),
  { iso: '2026-07-10', h: 10, m: 30 },
  'Named-month IST timestamp parsing changed'
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.parseDateFull('07/10/2026 4:05 PM'))),
  { iso: '2026-10-07', h: 16, m: 5 },
  'Ambiguous numeric dates must remain day-first'
);

const tomorrowCallback = context.resolveCallbackWindow({}, 'Please call me tomorrow at 4 pm', '', '2026-07-10');
assert.equal(tomorrowCallback.label, '11 Jul 2026 · 4:00 PM', 'Relative callback date parsing changed');
const weekdayCallback = context.resolveCallbackWindow({}, 'Call me Monday morning', '', '2026-07-10');
assert.equal(weekdayCallback.label, '13 Jul 2026 · 09:00 AM - 12:00 PM', 'Weekday callback parsing changed');
const explicitCallback = context.resolveCallbackWindow({}, '', 'Preferred callback 15 July 2026 after 3 pm', '2026-07-10');
assert.equal(explicitCallback.label, '15 Jul 2026 · After 3:00 PM', 'Explicit callback window parsing changed');
assert.equal(context.resolveCallbackWindow({}, 'No follow-up requested', '', '2026-07-10').label, 'Not specified', 'Callback parser must not invent a window');

assert.equal(context.normalizeDisposition({ status: 'completed', dur: 30, msg: 2 }), 'connected');
assert.equal(context.normalizeDisposition({ status: 'failed', dur: 30, msg: 0 }), 'failed');
assert.equal(context.normalizeDisposition({ status: '', dur: 20, msg: 2, trans: 'hello' }), 'connected');
assert.equal(context.normalizeDisposition({ status: '', dur: 0, msg: 0, trans: '' }), 'no_answer');

assert.equal(context.intentOf('I need help with programme eligibility criteria'), 'Eligibility');
assert.equal(context.intentOf('Please explain the course fee and EMI'), 'Payment');
assert.equal(context.intentOf('I have a portal login issue'), 'Support');
context.setDashboardLoadingMessage('Parsing workbook…');
assert.equal(loadingText.textContent, 'Parsing workbook…', 'Loading stage message changed');
assert(scripts[1].includes("fetchWithTimeout('data/voice_analytics.xlsx',{cache:'no-cache'}"), 'Workbook fetch must revalidate while allowing cached bytes');
assert(scripts[1].includes('DATA_FETCH_TIMEOUT_MS=180000'), 'Growing workbook download timeout changed');
assert(!scripts[1].includes("new File([fileBytes]"), 'Automatic loading must not copy decrypted bytes through File and FileReader');
assert(scripts[1].includes("await processWorkbookBytes(fileBytes,'voice_analytics.xlsx')"), 'Automatic loading must process decrypted bytes directly');
assert.equal(context.workbookWorkerTimeout({ byteLength: 14 * 1048576 }), 60000, 'Current-size workbook timeout changed');
assert.equal(context.workbookWorkerTimeout({ byteLength: 90 * 1048576 }), 270000, 'Growing workbook timeout must scale with size');
assert.equal(context.workbookWorkerTimeout({ byteLength: 200 * 1048576 }), 300000, 'Workbook timeout must remain bounded');

const hostileValue = `91'\"><img src=x onerror=alert(1)>\\line`;
const encodedArgument = context.jsArg(hostileValue);
assert(!encodedArgument.includes('<img'), 'JavaScript argument must be HTML escaped');
const decodedArgument = encodedArgument
  .replaceAll('&quot;', '"').replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
let capturedArgument = null;
new Function('capture', `capture(${decodedArgument})`)(value => { capturedArgument = value; });
assert.equal(capturedArgument, hostileValue, 'Workbook value must remain a single inert JavaScript argument');
assert(!context.esc(hostileValue).includes('<img'), 'Workbook text must be escaped before HTML rendering');

assert.equal(context.sumBilledMinutes([
  { status: 'completed', dur: 61, msg: 1, trans: 'connected' },
  { status: 'failed', dur: 120, msg: 0, trans: '' },
  { status: 'initiated', dur: 60, msg: 0, trans: '' }
]), 2, 'Only connected calls should contribute billed minutes');
assert(scripts[1].includes('id="cbShowMore" role="button" tabindex="0" onkeydown='), 'Callback pagination must be keyboard accessible');
for (const workspace of ['overview', 'action', 'intelligence', 'outbound', 'records']) {
  assert(scripts[1].includes(`${workspace}:{label:`), `Missing ${workspace} workspace navigation definition`);
  assert(scripts[1].includes(`workspaceTemplate('${workspace}'`), `Missing ${workspace} workspace layout`);
}
assert(html.includes('id="kpiPanelExport" onclick="exportPanelCSV()"'), 'Drill-down drawer CSV action is missing');
assert(html.includes('id="profileExport" onclick="exportProfileCSV()"'), 'Profile drawer CSV action is missing');
assert(html.includes('id="kpiPanelLedger" onclick="openPanelInLedger()"'), 'Drill-down to ledger action is missing');
assert(html.includes('id="profileLedger" onclick="openProfileInLedger()"'), 'Profile to ledger action is missing');
assert(scripts[1].includes("voice_analytics.xlsx.meta.json"), 'Published-data freshness metadata is missing');
assert(scripts[1].includes('workspace-tab-count'), 'Action Center live tab counts are missing');
const drawerCSV = context.recordsToCSV([{
  from: '919999999999', direction: 'inbound', d: '2026-07-10', h: 10, m: 30, dur: 75,
  leadTemp: 'Hot', band: 'Green', intent: 'Eligibility', conf: 90, need: 80,
  frustrated: false, callback: true, status: 'completed', summary: 'Synthetic export'
}]);
assert(drawerCSV.startsWith('Phone,Country,Direction,Call Time'), 'Drawer CSV header changed');
assert(drawerCSV.includes('+919999999999,India,Inbound'), 'Drawer CSV record mapping changed');
assert(scripts[1].includes("appendWorkspaceSections(overview,'summary',['sec-brief','sec-anomaly','sec-direction'])"), 'Overview must not duplicate summary layers');
assert(scripts[1].includes("hero.classList.add('summary-source-only')"), 'Large duplicate quality block must be suppressed below Management Summary');
assert(scripts[1].includes("['Unique people'"), 'Direction comparison must include unique people');
assert(scripts[1].includes("['Callback requests'"), 'Direction comparison must include callbacks');
assert(scripts[1].includes("if(!recordMatchesCampaign(r))return false"), 'Management Summary must respect the active campaign');
assert(scripts[1].includes("['Connected dials'"), 'Direction glance must include outbound connect performance');
assert(scripts[1].includes("['Repeatedly unreachable'"), 'Direction glance must include wasted outbound effort');
assert(scripts[1].includes("'Phone,Country,Dial Count,First Tried,Last Tried,Campaigns,Latest Status"), 'Unreachable export must include full number-level dial counts');
assert(scripts[1].includes("['hot','Hot leads','hot','ratio'"), 'Management Summary must show Hot leads with a rate');
context.__campaignScopeRows = [
  { d: '2026-07-10', direction: 'outbound', campaign: 'Campaign A' },
  { d: '2026-07-10', direction: 'outbound', campaign: 'Campaign B' }
];
vm.runInContext("ALL_RECORDS_BACKUP=__campaignScopeRows;SELECTED_DIRECTION='all';SELECTED_CAMPAIGN='Campaign A';", context);
assert.equal(context.recordsInRange('2026-07-10', '2026-07-10').length, 1, 'Management Summary campaign scope changed');

let unreachableDownload = null;
context.downloadCSV = (name, csv) => { unreachableDownload = { name, csv }; };
context.__unreachGroups = [[
  { from: '919999999999', d: '2026-07-09', ts: 1, h: 10, m: 0, campaign: 'Retry A', status: 'failed' },
  { from: '919999999999', d: '2026-07-10', ts: 2, h: 11, m: 0, campaign: 'Retry A', status: 'no_answer' },
  { from: '919999999999', d: '2026-07-11', ts: 3, h: 12, m: 0, campaign: 'Retry B', status: 'failed' }
]];
context.exportUnreachableCSV();
assert(unreachableDownload.csv.includes('+919999999999,India,3,'), 'Unreachable CSV must aggregate the complete dial count per number');

const searchRows = [
  { from: '+91 99999 99999', ts: 2, d: '2026-07-10', direction: 'inbound', campaign: '' },
  { from: '919999999999', ts: 1, d: '2026-06-01', direction: 'outbound', campaign: 'Older campaign' },
  { from: '918888888888', ts: 3, d: '2026-07-10', direction: 'inbound', campaign: '' }
];
assert.equal(context.resolveLeadSearch('99999-99999', searchRows).calls.length, 2, 'Phone search must normalize formatting and return full lead history');
assert.equal(context.resolveLeadSearch('+91 88888 88888', searchRows).calls.length, 1, 'Phone search must support country-code input');
assert.equal(context.percentOf(2, 5), 40, 'Applicable count percentages changed');
assert(scripts[1].includes('Full call history is shown'), 'Profile search must explain global history versus active filters');
assert(scripts[1].includes('visibleCallbackCount') && scripts[1].includes('% of calls'), 'Callback count must include its applicable rate');
assert(!scripts[1].includes('["neut",o.n,"Total enquiries","all"]'), 'Total enquiries must not be repeated below Management Summary');
assert(scripts[1].includes('role="tab"') && scripts[1].includes('aria-selected='), 'Workspace tabs must expose accessible state');

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
const workbookBytes = Uint8Array.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
const reopened = XLSX.read(workbookBytes, { type: 'array', dense: true });
const chosen = context.chooseWorkbookRows(reopened);
assert.equal(chosen.name, 'Voice Export', 'Dashboard should choose the call-data worksheet');
assert.equal(context.parseWorkbookOnMainThread(workbookBytes).name, 'Voice Export', 'Main-thread workbook fallback changed');

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
assert.strictEqual(context.groupByPhone(records), context.groupByPhone(records), 'Phone grouping cache should reuse the same grouping');

const outcomeAggregate = context.aggregate([
  { leadTemp: 'Hot', callback: true, dur: 20, from: '919111111111', d: '2026-07-10', h: 10, intent: 'Payment', conf: 90, need: 80, band: 'Green', msg: 5 },
  { leadTemp: 'Warm', callback: false, dur: 45, from: '919222222222', d: '2026-07-10', h: 11, intent: 'Eligibility', conf: 70, need: 60, band: 'Amber', msg: 8 },
  { leadTemp: 'Cold', callback: true, dur: 90, from: '919333333333', d: '2026-07-10', h: 12, intent: 'Support', conf: 50, need: 40, band: 'Red', msg: 3 },
  { leadTemp: 'Hot', callback: false, dur: 150, from: '919444444444', d: '2026-07-10', h: 13, intent: 'Programme', conf: 85, need: 75, band: 'Green', msg: 10 },
  { leadTemp: 'Warm', callback: false, dur: 240, from: '919555555555', d: '2026-07-10', h: 14, intent: 'Other', conf: 65, need: 55, band: 'Green', msg: 12 }
]);
assert.equal(outcomeAggregate.callbacks, 2, 'Demand outcomes must count callback requests');
assert.deepEqual(JSON.parse(JSON.stringify(outcomeAggregate.durBands)), { '<30s': 1, '30-60s': 1, '1-2m': 1, '2-3m': 1, '3m+': 1 }, 'Duration bands changed');
assert(html.includes('id="durBands"'), 'Duration mix panel is missing');
assert(scripts[1].includes('paintDurBands(o)'), 'Duration mix must be painted during dashboard rendering');

const intentRecords = [
  { from: '911111111111', intent: 'Payment', leadTemp: 'Warm', band: 'Amber', frustrated: false, conf: 70, need: 60 },
  { from: '911111111111', intent: 'Payment', leadTemp: 'Hot', band: 'Green', frustrated: false, conf: 90, need: 85 },
  { from: '922222222222', intent: 'Payment', leadTemp: 'Cold', band: 'Red', frustrated: true, conf: 40, need: 30 }
];
context.paintIntentQuality(intentRecords);
assert(getElement('intentQuality').innerHTML.includes('<td class="num">2<div class="iq-sub">100% of all leads'), 'Intent conversion must count unique leads, not repeated calls');
assert(getElement('intentQuality').innerHTML.includes('50%'), 'Per-lead hot conversion rate changed');

const callbackRecords = Array.from({ length: 51 }, (_, index) => ({
  from: `91${String(7000000000 + index)}`,
  callback: true,
  intent: 'Payment',
  d: '2026-07-10', ts: 1000 + index, dur: 30,
  status: 'completed', direction: 'outbound',
  conf: 80, need: 70, cbReason: 'Payment clarification',
  cbPreferred: 'Not specified', cbPreferredDate: null,
  summary: 'Synthetic callback'
}));
context.__callbackRecords = callbackRecords;
vm.runInContext('ALL_RECORDS_BACKUP=__callbackRecords; CB_RENDER_LIMIT=50; paintCallbacks(__callbackRecords);', context);
assert(getElement('cbList').innerHTML.includes('Show more — 1 more callback number'), 'Callback rendering cap changed');

console.log('Dashboard smoke tests passed');
