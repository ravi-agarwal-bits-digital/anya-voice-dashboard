const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { performance } = require('node:perf_hooks');
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
  'campaignFilter', 'searchMobile', 'userSearchResult', 'explorerList', 'sec-overview',
  'resetAllFilters', 'metricDefinitions',
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
  documentElement: { clientHeight: 0 },
  body: makeElement(), getElementById: getElement,
  querySelector: selector => selector === '#dataLoading p' ? loadingText : makeElement(), querySelectorAll: () => [],
  createElement: () => makeElement(), addEventListener: noop
};
const storage = { getItem: () => null, setItem: noop, removeItem: noop, clear: noop };
const context = {
  console, XLSX, document, sessionStorage: storage, localStorage: storage,
  crypto: require('crypto').webcrypto, TextEncoder, TextDecoder, Uint8Array, Blob, Response, CompressionStream, DecompressionStream,
  Date, Map, Set, Math, Number, String, Array, Object, RegExp, JSON, Error, Intl,
  FileReader: function FileReader() {}, File: function File() {},
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
  'recordDateBounds', 'preferLifecycleRow', 'esc', 'jsArg', 'sumBilledMinutes', 'sumTalkTimeMinutes', 'formatTalkMinutes',
  'groupByPhone', 'runPaintChunks', 'resolveCallbackWindow', 'normalizeDisposition',
  'intentOf', 'paintIntentQuality', 'paintCallbacks', 'parseWorkbookBytes', 'isMeaningfulConversation', 'setOutboundTimingMetric',
  'parseWorkbookInWorker', 'parseWorkbookOnMainThread', 'workbookWorkerTimeout',
  'isGzipData', 'unpackPublishedData',
  'chooseWorkbookCandidates', 'setDashboardLoadingMessage', 'processWorkbookBytes',
  'resolveLeadSearch', 'searchUserByMobile', 'percentOf', 'outboundGlanceStats', 'exportUnreachableCSV', 'paintDialHeatmap',
  'openPanelInLedger', 'openProfileInLedger', 'openRecordProfile', 'clearLedgerScope', 'resetAllFilters',
  'activeFilterScopeLabel', 'ledgerExportScope', 'metricDefinition', 'recordsToCSV', 'reducedAiViewEnabled', 'applyReducedAiControlVisibility', 'visibleCallbackGroups', 'callbackExportScope', 'callbackFilenameExtra', 'repeatedlyUnreachableGroups', 'retryPolicyStatus', 'csvFilename', 'escCSVText', 'updateExportButton',
  'exportGeo', 'exportExplorer', 'exportHottestLeads', 'exportSerialEngagers', 'exportCallbacks',
  'paintHottestLeads', 'paintSerialCallers', 'paintFailureBreakdown', 'ledgerCallCost', 'ledgerLeadCostMap', 'ledgerLeadCost', 'isLeadCostLedgerSort', 'latestLedgerRowPerLead', 'getExplorerRows', 'ledgerLeadDirectionMixMap', 'ledgerLeadDirectionMix'
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
assert(context.isMeaningfulConversation({ status: 'completed', dur: 60 }), 'A completed 60-second call must count as meaningful');
assert(!context.isMeaningfulConversation({ status: 'completed', dur: 59 }), 'Brief completed calls must not count as meaningful');
assert(!context.isMeaningfulConversation({ status: 'failed', dur: 120 }), 'Failed dials must not count as meaningful');

assert.equal(context.intentOf('I need help with programme eligibility criteria'), 'Eligibility');
assert.equal(context.intentOf('Please explain the course fee and EMI'), 'Payment');
assert.equal(context.intentOf('I have a portal login issue'), 'Support');
context.setDashboardLoadingMessage('Parsing workbook…');
assert.equal(loadingText.textContent, 'Parsing workbook…', 'Loading stage message changed');
assert(scripts[1].includes("fetchWithTimeout('data/voice_analytics.xlsx',{cache:'no-cache'}"), 'Workbook fetch must revalidate while allowing cached bytes');
assert(scripts[1].includes('DATA_FETCH_TIMEOUT_MS=180000'), 'Growing workbook download timeout changed');
assert(!scripts[1].includes("new File([fileBytes]"), 'Automatic loading must not copy decrypted bytes through File and FileReader');
assert(scripts[1].includes("const allCalls=await processWorkbookBytes(fileBytes,'voice_analytics.xlsx',meta?.plaintextSha256||meta?.dataCommitSha||'')"), 'Automatic loading must process decrypted bytes directly with the publication version');
assert(scripts[1].includes("const PREPARED_CACHE_DB='anya-dashboard-secure-cache'"), 'Encrypted prepared-data cache is missing');
assert(scripts[1].includes("crypto.subtle.encrypt({name:'AES-GCM'"), 'Prepared-data cache must remain encrypted at rest');
assert(scripts[1].includes('Opening saved secure data…'), 'Prepared-data cache load status is missing');
assert.equal(context.workbookWorkerTimeout({ byteLength: 14 * 1048576 }), 60000, 'Current-size workbook timeout changed');
assert.equal(context.workbookWorkerTimeout({ byteLength: 90 * 1048576 }), 270000, 'Growing workbook timeout must scale with size');
assert.equal(context.workbookWorkerTimeout({ byteLength: 200 * 1048576 }), 300000, 'Workbook timeout must remain bounded');
assert(context.isGzipData(Uint8Array.from([0x1f, 0x8b, 0x08])), 'Gzip payload detection is missing');
assert(!context.isGzipData(Uint8Array.from([0x50, 0x4b, 0x03, 0x04])), 'Excel workbooks must not be mistaken for gzip data');

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
assert.equal(context.sumTalkTimeMinutes([
  { status: 'completed', dur: 61, msg: 1, trans: 'connected' },
  { status: 'completed', dur: 3, msg: 1, trans: 'connected' },
  { status: 'failed', dur: 120, msg: 0, trans: '' }
]), 64 / 60, 'Talk-time minutes must retain connected-call seconds before per-call billing rounding');
assert.equal(context.formatTalkMinutes(64 / 60), '1.1', 'Talk-time display must retain one decimal place');
assert.equal(context.ledgerCallCost({ status: 'completed', dur: 61 }), 10, 'Ledger cost must use billed-minute rounding');
assert.equal(context.ledgerCallCost({ status: 'failed', dur: 120 }), 0, 'Unconnected calls must not contribute ledger cost');
const leadCostRows=[{ from: '+91 99999 99999', status: 'completed', dur: 61 },{ from: '919999999999', status: 'completed', dur: 3 }];
assert.equal(context.ledgerLeadCost(leadCostRows[0],leadCostRows), 15, 'Lead total cost must combine normalized phone-format variants');
context.__leadCostLedgerRows=[
  {from:'919999999999',status:'completed',dur:61,ts:10,direction:'outbound'},
  {from:'+91 99999 99999',status:'completed',dur:61,ts:20,direction:'outbound'},
  {from:'918888888888',status:'completed',dur:61,ts:30,direction:'outbound'}
];
vm.runInContext("RECORDS=__leadCostLedgerRows;LEDGER_SCOPE=null;LEDGER_STATE={search:'',filters:new Set(),sort:'lead_cost_desc',limit:50};", context);
const leadCostLedger=context.getExplorerRows();
assert.equal(leadCostLedger.length, 2, 'Lead total cost sorting must show one ledger row per normalized lead');
assert.equal(leadCostLedger[0].ts, 20, 'Lead total cost sorting must retain the latest call for a repeated lead');
assert.equal(leadCostLedger[1].ts, 30, 'Lead total cost sorting must still retain other leads');
vm.runInContext("LEDGER_STATE={search:'',filters:new Set(),sort:'repeat_desc',limit:50};", context);
assert.equal(context.getExplorerRows().length, 3, 'Call-level ledger sorts must retain every final Call-ID row');
assert(context.isLeadCostLedgerSort('lead_cost_asc') && !context.isLeadCostLedgerSort('cost_desc'), 'Only lead-total-cost sorts may switch the ledger to lead-level rows');
const leadMixRows=[{ from: '919999999999', direction: 'inbound' },{ from: '+91 99999 99999', direction: 'outbound' }];
assert.deepEqual(JSON.parse(JSON.stringify(context.ledgerLeadDirectionMix(leadMixRows[0],leadMixRows))), { inbound: 1, outbound: 1, unknown: 0 }, 'Lead direction mix must combine inbound and outbound history');
const normalizedLeadGroups = context.groupByPhone([
  { from: '+91 99999 99999', status: 'completed', dur: 60 },
  { from: '919999999999', status: 'completed', dur: 60 }
]);
assert.equal(Object.keys(normalizedLeadGroups).length, 1, 'Queue cards must group phone-format variants into one lead');
assert.equal(context.sumBilledMinutes(Object.values(normalizedLeadGroups)[0]), 2, 'Queue minutes must match the normalized lead profile');
assert(scripts[1].includes('id="cbShowMore" role="button" tabindex="0" onkeydown='), 'Callback pagination must be keyboard accessible');
assert(fs.existsSync('data/voice_analytics.xlsx'), 'Published workbook is missing');
assert(fs.existsSync('data/voice_analytics.xlsx.meta.json'), 'Published workbook metadata is missing');
assert(html.indexOf('src="js/auth.js"') < html.indexOf('src="js/dashboard.js"'), 'Authentication must load before dashboard logic');
assert(scripts[1].includes("data/voice_analytics.xlsx"), 'GitHub Pages workbook path changed');
assert(scripts[1].includes("fetchWithTimeout('data/voice_analytics.xlsx',{cache:'no-cache'}"), 'GitHub Pages loading must revalidate the workbook');
assert(scripts[1].includes('resetAllFilters'), 'Reset-all-filters control is not wired');
assert(scripts[1].includes('drawer-scope-note'), 'Drawer active-scope explanation is missing');
assert(!scripts[1].includes('Filter Scope'), 'CSV rows must not repeat filter scope metadata');
assert(scripts[1].includes('metricDefinition'), 'Management metric definitions are not wired to tooltips');
assert(!html.includes('id="timelinePanel"'), 'Superseded inline timeline panel must remain removed');
assert(!scripts[1].includes('timelinePanel'), 'Dashboard logic must use the profile drawer timeline');
assert(scripts[1].includes("voice_analytics.xlsx.meta.json"), 'Published-data freshness metadata is missing');
assert(scripts[1].includes("if(!recordMatchesCampaign(r))return false"), 'Management Summary must respect the active campaign');
assert(!scripts[1].includes("['Connected dials'"), 'Direction glance must not duplicate outbound connect performance');
assert(!scripts[1].includes("['Repeatedly unreachable'"), 'Direction glance must not duplicate outbound reach diagnostics');
assert(html.includes('<h4>Vendor retry-policy watchlist</h4>'), 'Vendor retry-policy watchlist must remain visible');
assert(!html.includes('<h4>Wasted-effort hit-list</h4>'), 'Removed hit-list wording must not return');
assert(!html.includes('<div class="panel" data-hide-in-reduced-view="true"><h4>Repeatedly unreachable</h4>'), 'Outbound retry-control list must not be hidden in the reduced view');
assert(!scripts[1].includes('Outbound operational context'), 'Direction glance must remain limited to inbound/outbound comparison');
assert(scripts[1].includes("if(SELECTED_DIRECTION==='all' && inbound && outbound)"), 'Combined direction view should avoid duplicate direction cards');
assert(html.includes('<h4>Outbound calling playbook</h4>'), 'Outbound timing must be presented as an operating playbook');
assert(html.includes('id="dialPlaybookCards"'), 'Outbound playbook action cards are missing');
assert(html.includes('best all-days 2-hour window'), 'Outbound playbook must explain the two-hour operating granularity');
assert(html.includes('Fresh lead: call immediately.'), 'Outbound playbook must preserve first-attempt lead freshness');
assert(html.includes('<summary>View day &amp; time detail</summary>'), 'Day and time timing detail must be positioned as supporting proof');
assert(html.includes('id="timingMetricControls"'), 'Outbound timing metric toggle is missing');
assert(html.includes('<body class="dashboard-reduced-ai-view">'), 'Reduced dashboard view toggle is missing');
assert(html.includes('<span>Demand</span>'), 'Reduced navigation should use the concise Demand label');
assert(html.includes('Follow-up &amp; repeat engagement'), 'Follow-up section heading is missing');
assert(html.includes('<h4>Follow-up queue</h4>'), 'Follow-up queue panel title is missing');
assert(html.includes('<h4 style="margin:0">Repeat engagement</h4>'), 'Repeat engagement panel title is missing');
assert(html.includes('<h2>Call ledger</h2>'), 'Call ledger title is missing');
assert(html.includes('Management readout'), 'Management readout must sit in the overview');
assert(!html.includes('id="sec-brief"'), 'Standalone executive summary must be merged into overview');
assert(!html.includes('id="kpis"'), 'Duplicate KPI strip must be merged into the management readout');
assert(!scripts[1].includes('paintHealth(o);paintKPIs(o);'), 'Initial dashboard render must not target the removed KPI strip');
assert(scripts[1].includes('paintHealth(o);paintManagementBrief();paintFunnel(o);'), 'Management readout must render with the top essentials');
assert(!scripts[1].includes('["Source",SRC]'), 'Header source chip must remain removed');
assert(scripts[1].includes('function renderHeaderMeta(records)'), 'First-load and filtered header chips must share one renderer');
assert(scripts[1].includes("['hot','Billable minutes','mins','minutes',()=>true]"), 'Management readout must retain billable minutes');
assert(scripts[1].includes("['neut','Talk-time minutes','talkMins','talkMinutes',()=>true]"), 'Management readout must show talk-time minutes beside billable minutes');
assert(scripts[1].includes('Billing clarity:'), 'Management readout must explain the impact of per-call billing rounding');
assert(scripts[1].includes("['hot','Estimated operating cost','cost','currency',()=>true]"), 'Management readout must retain operating cost');
assert(html.includes('class="side-group open" data-group="outbound"'), 'Outbound navigation should be expanded by default');
assert(html.includes('class="side-group open" data-group="leads"'), 'Leads navigation should be expanded by default');
assert(html.includes('<optgroup label="Cost exposure">'), 'Ledger needs a clear cost-exposure sort group');
assert(html.includes('<optgroup label="Follow-up &amp; repeat">'), 'Ledger follow-up sort group needs a factual label');
assert(!html.includes('value="priority_desc"'), 'Ledger must not expose the heuristic priority sort');
assert(!scripts[1].includes('ledgerPriorityScore'), 'Ledger must not retain the heuristic priority score');
assert(scripts[1].includes('cost_desc:(a,b)=>ledgerCallCost(b)-ledgerCallCost(a)'), 'Ledger must support highest-cost sorting');
assert(scripts[1].includes('cost_asc:(a,b)=>ledgerCallCost(a)-ledgerCallCost(b)'), 'Ledger must support lowest-cost sorting');
assert(scripts[1].includes('lead_cost_desc:(a,b)=>'), 'Ledger must support highest lead-total-cost sorting');
assert(scripts[1].includes('lead_cost_asc:(a,b)=>'), 'Ledger must support lowest lead-total-cost sorting');
assert(scripts[1].includes("leadView?'Export visible leads':'Export visible calls'"), 'Lead-cost mode must label its export as a lead view');
assert(scripts[1].includes('Cost ₹${billedCost} · ${billedMins} billed min'), 'Ledger must explain the billed cost behind cost sorting');
assert(scripts[1].includes('Lead total ₹${leadCost}'), 'Ledger must show cumulative lead cost behind lead-total sorting');
assert(scripts[1].includes('Lead mix: ${esc(leadMixLabel)}'), 'Ledger must show the inbound/outbound mix behind cumulative lead cost');
assert(!html.includes('data-f="has_transcript"'), 'Ledger must not expose transcript-completeness filters');
assert(!html.includes('data-f="no_transcript"'), 'Ledger must not expose transcript-completeness filters');
assert(html.includes('id="hottestExport"') && html.includes('Export lead summary'), 'Follow-up export label is missing');
assert(scripts[1].includes('reducedAiViewEnabled'), 'Dynamic reduced-view visibility contract is missing');
assert(scripts[1].includes('Opened from the Follow-up queue'), 'Follow-up queue profile source label is missing');
assert(!scripts[1].includes('<b style="color:var(--hot)">Attention</b>'), 'Profile timeline must not surface Attention labels in the reduced view');
assert(!scripts[1].includes('<b>Lead tier:</b>'), 'Profile drawer must not repeat lead-tier breakdowns');
assert(scripts[1].includes('profile-call-mix-list'), 'Profile drawer must show inbound/outbound call mix');
assert(!scripts[1].includes('<b>View:</b> Full history'), 'Profile drawer must not show redundant active-view count context');
assert(scripts[1].includes('const timelineLimit=5;'), 'Profile drawer timeline must limit its initial call history');
assert(scripts[1].includes('profile-history-more'), 'Profile drawer must disclose earlier calls on demand');
assert(!scripts[1].includes('if(r.frustrated)tags.push'), 'Ledger rows must not surface Attention tags in the reduced view');
assert(scripts[1].includes("openProfileForPhone(${jsArg(l.phone)},'priority',this)"), 'Follow-up cards must use the profile drawer handler');
assert(scripts[1].includes('csv+=[escCSVText(r.callId),escCSVText(fullPhone(r.from))'), 'Record exports must include stable Call IDs as text');
assert(!scripts[1].includes('Avg Confidence %,Avg Need Score'), 'Visible operational exports must not use AI score columns');
assert(fs.readFileSync('css/dashboard.css', 'utf8').includes('body.dashboard-reduced-ai-view [data-hide-in-reduced-view="true"]'), 'Reduced-view CSS contract is missing');
assert(fs.readFileSync('css/dashboard.css', 'utf8').includes('.repeat-engagement-panel{margin-top:24px!important;}'), 'Follow-up and repeat engagement panels need clear visual separation');
assert(fs.readFileSync('css/dashboard.css', 'utf8').includes('#cbReadiness .follow-up-readiness-chip[aria-pressed="true"]'), 'Requested follow-up filter needs an obvious active state');
assert(html.includes('value="need_desc" data-hide-in-reduced-view="true"'), 'Reduced Ledger need sort marker is missing');
assert(html.includes('data-f="low_conf" data-hide-in-reduced-view="true"'), 'Reduced Ledger confidence filter marker is missing');
assert(html.includes('label="Confidence" data-hide-in-reduced-view="true"'), 'Reduced Ledger confidence group marker is missing');
assert(html.includes('label="Reach" data-hide-in-reduced-view="true"'), 'Reduced Ledger reach group marker is missing');
assert(html.includes('data-f="frustrated" data-hide-in-reduced-view="true"'), 'Reduced Ledger attention filter marker is missing');
assert(html.includes('<h4>Why we never reached them</h4>'), 'Failure section should use the concise lost-reach title');
assert(scripts[1].includes('entries.slice(0,7)'), 'Failure reasons should be capped at the top seven');
assert(scripts[1].includes("Other reasons"), 'Failure reasons should group the long tail');
for (const marker of [
  'id="sec-quality" data-hide-in-reduced-view="true"',
  'id="sec-anomaly" data-hide-in-reduced-view="true"',
  'id="sec-perf" data-hide-in-reduced-view="true"',
  'id="sec-themes" data-hide-in-reduced-view="true"',
  'id="sec-outbound-cadence" data-hide-in-reduced-view="true"',
  'id="sec-friction" data-hide-in-reduced-view="true"'
]) assert(html.includes(marker), `Reduced-view marker missing: ${marker}`);

const searchRows = [
  { from: '+91 99999 99999', ts: 2, d: '2026-07-10', direction: 'inbound', campaign: '' },
  { from: '919999999999', ts: 1, d: '2026-06-01', direction: 'outbound', campaign: 'Older campaign' },
  { from: '918888888888', ts: 3, d: '2026-07-10', direction: 'inbound', campaign: '' }
];
assert.equal(context.resolveLeadSearch('99999-99999', searchRows).calls.length, 2, 'Phone search must normalize formatting and return full lead history');
assert.equal(context.resolveLeadSearch('+91 88888 88888', searchRows).calls.length, 1, 'Phone search must support country-code input');
assert.equal(context.percentOf(2, 5), 40, 'Applicable count percentages changed');
assert(context.metricDefinition('Enquiries').includes('Call-ID'), 'Enquiry definition must document final Call-ID grain');

const scopeRecord = {
  from: '919999999999', direction: 'inbound', d: '2026-07-10', h: 10, m: 30, dur: 75,
  leadTemp: 'Hot', band: 'Green', intent: 'Eligibility', conf: 90, need: 80,
  frustrated: false, callback: true, status: 'completed', summary: 'Synthetic export'
};
context.document.body.classList.contains = className => className === 'dashboard-reduced-ai-view';
assert.equal(context.reducedAiViewEnabled(), true, 'Reduced dashboard view should be enabled');
const reducedStats = context.defaultDrillStats([scopeRecord]).map(item => item[0]).join('|');
assert(!reducedStats.includes('confidence') && !reducedStats.includes('need'), 'Reduced drawer stats must hide AI/need fields');
assert(!context.recordListHtml([scopeRecord]).includes('Conf '), 'Reduced drawer rows must hide confidence');
assert(context.recordListHtml([scopeRecord]).includes('openRecordProfile(window.__drilldownRows[0]'), 'KPI drill-down records must use the shared record-to-profile handoff');
vm.runInContext("ALL_RECORDS_BACKUP=[{d:'2026-07-10',direction:'inbound',campaign:'',status:'completed',dur:30,msg:2,from:'919111111111'},{d:'2026-07-10',direction:'outbound',campaign:'',status:'completed',dur:30,msg:2,from:'919222222222'}];ALL_DIALS=ALL_RECORDS_BACKUP;SELECTED_DIRECTION='all';SELECTED_CAMPAIGN='all';", context);
context.paintDirectionCompare();
assert(!getElement('dirCompareTable').innerHTML.includes('Avg AI confidence'), 'Reduced direction comparison must hide AI confidence');
assert(!getElement('dirCompareTable').innerHTML.includes('Quality pass rate (Green)'), 'Reduced direction comparison must hide quality pass rate');
context.RECORDS = [scopeRecord];
context.paintKPIs(context.aggregate(context.RECORDS));
assert(!getElement('kpis').innerHTML.includes('Quality pass rate'), 'Reduced overview must hide quality pass rate');
const compactLeadRecords = [
  { from: '919111111111', direction: 'inbound', d: '2026-07-10', h: 10, m: 0, ts: 3, dur: 30, status: 'completed', leadTemp: 'Hot', conf: 90, need: 80, frustrated: false, intent: 'Payment', summary: 'Synthetic lead' },
  { from: '919111111111', direction: 'inbound', d: '2026-07-10', h: 11, m: 0, ts: 2, dur: 30, status: 'completed', leadTemp: 'Hot', conf: 90, need: 80, frustrated: false, intent: 'Payment', summary: 'Synthetic lead' },
  { from: '919111111111', direction: 'inbound', d: '2026-07-10', h: 12, m: 0, ts: 1, dur: 30, status: 'completed', leadTemp: 'Hot', conf: 90, need: 80, frustrated: true, intent: 'Payment', summary: 'Synthetic lead' }
];
context.paintHottestLeads(compactLeadRecords);
assert(getElement('hottestLeads').innerHTML.includes('<b>3</b><span>Calls</span>'), 'Reduced priority cards should retain the call count');
assert(!getElement('hottestLeads').innerHTML.includes('<b>Lead:</b>'), 'Reduced priority cards must hide lead breakdown');
assert(!getElement('hottestLeads').innerHTML.includes('attention'), 'Reduced priority cards must hide attention breakdown');
context.paintSerialCallers(compactLeadRecords);
assert(getElement('serialCallers').innerHTML.includes('3 calls'), 'Reduced repeat-caller cards should retain total calls');
assert(!getElement('serialCallers').innerHTML.includes('attention'), 'Reduced repeat-caller cards must hide attention breakdown');
assert(!getElement('serialCallers').innerHTML.includes('general'), 'Reduced repeat-caller cards must hide general breakdown');
const failureRows = Array.from({ length: 8 }, (_, index) => ({
  from: `91922222222${index}`, direction: 'outbound', d: '2026-07-10', h: 10, m: index,
  status: 'failed', dur: 0, msg: 0, failReason: `reason_${index}`, sipCode: ''
}));
context.__failureRows = failureRows;
vm.runInContext('ALL_DIALS=__failureRows; SELECTED_CAMPAIGN="all"; paintFailureBreakdown();', context);
assert(getElement('failureBreakdown').innerHTML.includes('Top reasons'), 'Failure section should show the concise top-reasons heading');
assert(getElement('failureBreakdown').innerHTML.includes('Other reasons'), 'Failure section should group lower-volume reasons');
vm.runInContext("ALL_RECORDS_BACKUP=[];ALL_DIALS=[];RECORDS=[];", context);
const dialOnlyRecord={...scopeRecord,from:'919333333333',status:'failed',dur:0,msg:0};
context.openRecordProfile(dialOnlyRecord,'drilldown');
assert.equal(vm.runInContext('LEDGER_SCOPE.rows.length', context), 1, 'Dial-only records must fall back to the ledger instead of opening a missing profile');
assert.equal(vm.runInContext('LEDGER_SCOPE.title', context), 'Selected dial record', 'Dial-only ledger fallback title changed');
const scopedCSV = context.recordsToCSV([scopeRecord], 'Inbound · Campaign A · 10 Jul 2026 to 10 Jul 2026');
assert(scopedCSV.startsWith('Call ID,Phone,Country,Direction,Call Date (IST),Call Time (IST)'), 'Drawer CSV header changed');
assert(scopedCSV.includes("'+919999999999,India,Inbound"), 'Drawer CSV record mapping changed');
assert(!scopedCSV.includes('Inbound · Campaign A'), 'Drawer CSV must not repeat filter scope metadata');
assert(scopedCSV.includes('Requested Time'), 'Standard CSV requested-time column is missing');
assert(scopedCSV.includes('Call Cost (Rs),Lead Total Calls,Lead Inbound Calls,Lead Outbound Calls,Lead Other Calls,Lead Total Cost (Rs)'), 'Standard CSV lead context columns are missing');
assert(scopedCSV.includes(',10,1,1,0,0,10,Hot,'), 'Standard CSV must include per-call cost plus lead call and direction totals');
const csvEscaped = context.recordsToCSV([{ ...scopeRecord, summary: 'Needs, "urgent"\nfollow-up' }], 'Demo scope');
assert(csvEscaped.includes('"Needs, ""urgent""\nfollow-up"'), 'CSV values with commas, quotes, and line breaks must remain valid');
assert.equal(context.escCSV('=2+2'), "'=2+2", 'CSV formula-like values must be protected for Excel');
assert.equal(context.escCSVText('919999999999'), "'919999999999", 'Call IDs and phone numbers must remain text in Excel');
vm.runInContext("$('filterFromDate').value='2026-07-10';$('filterToDate').value='2026-07-11';SELECTED_DIRECTION='outbound';SELECTED_CAMPAIGN='Campaign A';", context);
assert.equal(context.csvFilename('call ledger', 'calls'), `anya_call-ledger_calls_2026-07-10_to_2026-07-11_outbound_campaign-a_exported-${context.csvDateStamp()}.csv`, 'Export filename must identify its active scope');
assert(scripts[1].includes("recordsToCSV(intl.sort((a,b)=>b.ts-a.ts),scope,RECORDS)"), 'International export must use the standard CSV cost scope');
assert(scripts[1].includes("recordsToCSV(rows,ledgerExportScope(),LEDGER_SCOPE?.rows||RECORDS)"), 'Call ledger export must include active scope and lead totals');
assert(scripts[1].includes('Follow-up Rank,Phone,Lead Tier,Lead Total Calls,Lead Inbound Calls,Lead Outbound Calls'), 'Follow-up export must use the standard lead count columns');
assert(scripts[1].includes('Phone,Lead Total Calls,Lead Inbound Calls,Lead Outbound Calls'), 'Repeat engagement export must use the standard lead count columns');
assert(context.callbackHasRequestedTime([{ cbPreferred: 'Tomorrow, 2:00 PM' }]), 'Requested-time follow-up classification changed');
assert(!context.callbackHasRequestedTime([{ cbPreferred: 'Not specified' }]), 'Unscheduled follow-ups must remain identifiable');

context.__scopeRecord = scopeRecord;
vm.runInContext('ALL_RECORDS_BACKUP=[__scopeRecord]; RECORDS=[__scopeRecord];', context);
context.searchUserByMobile('919999999999', 'priority');
assert.equal(getElement('userSearchResult').style.display, 'block', 'Follow-up card click must open the profile drawer');
assert(getElement('profileSourceNote').textContent.includes('Follow-up queue'), 'Profile drawer must identify the follow-up source');

let exportCapture = null;
context.downloadCSV = (name, csv) => { exportCapture = { name, csv }; };
context.exportCallbacks();
assert(exportCapture && exportCapture.csv.startsWith('Call ID,Phone,Country,Direction'), 'Callback export must use the standard CSV schema');
assert(exportCapture.name.startsWith('anya_requested-followups_calls_'), 'Requested follow-up export filename is unclear');
assert(!exportCapture.csv.includes('Confidence %') && !exportCapture.csv.includes('Need Score'), 'Callback export must exclude hidden AI score fields');
context.__callbackExportRows = [
  { ...scopeRecord, callId: 'callback-timed-payment', from: '919999999991', intent: 'Payment', cbPreferred: '15 Jul 2026 · 3:00 PM' },
  { ...scopeRecord, callId: 'callback-timed-programme', from: '919999999992', intent: 'Programme', cbPreferred: '15 Jul 2026 · 4:00 PM' },
  { ...scopeRecord, callId: 'callback-unscheduled-payment', from: '919999999993', intent: 'Payment', cbPreferred: 'Not specified' }
];
vm.runInContext("RECORDS=__callbackExportRows; CB_TIME_FILTER='timed'; CB_FILTERS=new Set(['Payment']);", context);
context.exportCallbacks();
assert(exportCapture.csv.includes('callback-timed-payment'), 'Callback export must include the active topic and readiness selection');
assert(!exportCapture.csv.includes('callback-timed-programme') && !exportCapture.csv.includes('callback-unscheduled-payment'), 'Callback export must exclude requests hidden by local filters');
assert(exportCapture.name.includes('requested-time-topics-payment'), 'Callback export filename must state its local filter scope');
vm.runInContext("CB_TIME_FILTER='all'; CB_FILTERS.clear(); RECORDS=[__scopeRecord];", context);
context.exportHottestLeads();
assert(exportCapture.csv.startsWith('Follow-up Rank,Phone,Lead Tier'), 'Follow-up export must use an action-ready summary schema');
assert(!exportCapture.csv.includes('Frustrated') && !exportCapture.csv.includes('Avg Confidence'), 'Follow-up export must exclude hidden heuristic and AI fields');
context.__compactLeadRecords = compactLeadRecords;
vm.runInContext('RECORDS=__compactLeadRecords;', context);
context.exportSerialEngagers();
assert(exportCapture.csv.startsWith('Phone,Lead Total Calls,Lead Inbound Calls,Lead Outbound Calls'), 'Repeat engagement export must use the standardized action-ready summary schema');
assert(!exportCapture.csv.includes('Frustrated') && !exportCapture.csv.includes('General'), 'Repeat export must exclude hidden breakdown fields');

vm.runInContext("ALL_RECORDS_BACKUP=[{d:'2026-07-10',direction:'outbound',campaign:'Reset campaign'}];ALL_DIALS=ALL_RECORDS_BACKUP;SELECTED_DIRECTION='outbound';SELECTED_CAMPAIGN='Reset campaign';$('filterFromDate').value='2026-07-10';$('filterToDate').value='2026-07-10';resetAllFilters();", context);
assert.equal(context.currentViewDescription(), 'All Calls · 10 Jul 2026 to 10 Jul 2026', 'Reset-all-filters must restore the all-call scope');
vm.runInContext("ALL_RECORDS_BACKUP=[];ALL_DIALS=[];RECORDS=[];SELECTED_DIRECTION='all';SELECTED_CAMPAIGN='all';", context);

const customPanel = getElement('customFilterPanel');
customPanel.hidden = true;
customPanel.style.display = 'none';
context.toggleCustomFilter();
assert.equal(customPanel.hidden, false, 'Custom date range must open on first click');
assert.equal(customPanel.style.display, 'flex', 'Custom date range must render as a flex row when open');
let customApplyCount = 0;
context.applyFilters = () => { customApplyCount++; };
getElement('filterFromDate').value = '2026-07-12';
getElement('filterToDate').value = '2026-07-10';
context.applyCustomFilter();
assert.equal(customApplyCount, 0, 'An inverted custom range must not apply an empty filter');
assert.equal(getElement('customFilterError').hidden, false, 'An inverted custom range must explain the problem');
getElement('filterToDate').value = '2026-07-12';
context.applyCustomFilter();
assert.equal(customApplyCount, 1, 'A valid custom range must apply exactly once');
assert.equal(customPanel.hidden, true, 'A valid custom range must close after applying');

context.__campaignScopeRows = [
  { d: '2026-07-10', direction: 'outbound', campaign: 'Campaign A' },
  { d: '2026-07-10', direction: 'outbound', campaign: 'Campaign B' }
];
vm.runInContext("ALL_RECORDS_BACKUP=__campaignScopeRows;SELECTED_DIRECTION='all';SELECTED_CAMPAIGN='Campaign A';", context);
assert.equal(context.recordsInRange('2026-07-10', '2026-07-10').length, 1, 'Management Summary campaign scope changed');
vm.runInContext("ALL_RECORDS_BACKUP=[];SELECTED_CAMPAIGN='all';", context);

let unreachableDownload = null;
context.downloadCSV = (name, csv) => { unreachableDownload = { name, csv }; };
context.__unreachRows = [
  { from: '919999999999', d: '2026-07-09', ts: 1, h: 10, m: 0, direction: 'outbound', campaign: 'Retry A', status: 'failed' },
  { from: '919999999999', d: '2026-07-10', ts: 2, h: 11, m: 0, direction: 'outbound', campaign: 'Retry A', status: 'no_answer' },
  { from: '919999999999', d: '2026-07-11', ts: 3, h: 12, m: 0, direction: 'outbound', campaign: 'Retry B', status: 'failed' }
];
vm.runInContext("ALL_DIALS=__unreachRows; SELECTED_CAMPAIGN='all'; $('filterFromDate').value='2026-07-09'; $('filterToDate').value='2026-07-11';", context);
context.exportUnreachableCSV();
assert(unreachableDownload && unreachableDownload.csv.includes("'+919999999999,India,3,"), 'Unreachable CSV must aggregate the complete dial count per number');
assert(unreachableDownload.csv.includes('4-Call Cap Status,Retry Timing Status'), 'Retry-policy CSV must explain both vendor-policy checks');
assert(unreachableDownload.name.includes('retry-policy-watchlist'), 'Retry-policy CSV filename must be meaningful');
const tooSoonPolicy=context.retryPolicyStatus([{ts:0},{ts:5*3600},{ts:6*3600}]);
assert.equal(tooSoonPolicy.timingLabel, '1 retry under 4h', 'Retry-policy watchlist must flag retries made before the 4-hour lower bound');
const capPolicy=context.retryPolicyStatus([{ts:0},{ts:5*3600},{ts:10*3600},{ts:15*3600}]);
assert.equal(capPolicy.capLabel, 'Cap reached', 'Retry-policy watchlist must flag a lead at the four-attempt cap');

const performanceRows = Array.from({ length: 8000 }, (_, index) => ({
  'Created At (IST)': '10 Jul 2026, 10:30:00 AM IST',
  'Call ID': `performance-${index % 4000}`,
  Direction: index % 2 ? 'inbound' : 'outbound', Status: 'completed',
  From: `91${String(7000000000 + (index % 4000)).padStart(10, '0')}`,
  To: '919999999999', 'Duration (s)': 45, Messages: 6,
  'Full Transcript': 'Synthetic performance conversation',
  'Lead Temp.': index % 5 === 0 ? 'Hot' : 'Warm', 'Review Band': 'Green',
  'Bot Conf.': 90, 'Need Score': 80
}));
const performanceStart = performance.now();
const performanceDeduped = context.dedupeRowsByCallId(performanceRows);
const performanceRecords = performanceDeduped.map(row => context.rowToRecord(row)).filter(record => record && record.d);
const performanceAggregate = context.aggregate(performanceRecords);
const performanceElapsed = performance.now() - performanceStart;
assert.equal(performanceDeduped.length, 4000, 'Large-workbook Call-ID deduplication changed');
assert.equal(performanceAggregate.n, 4000, 'Large-workbook aggregation changed');
assert(performanceElapsed < 5000, `Large-workbook core processing is too slow (${Math.round(performanceElapsed)}ms)`);

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

const timingProofRows=[
  ...Array.from({length:10},(_,index)=>({from:`9191000000${index}`,d:'2026-07-13',h:16,status:index<5?'completed':'failed',dur:index<3?75:index<5?30:0})),
  ...Array.from({length:5},(_,index)=>({from:`9192000000${index}`,d:'2026-07-14',h:10,status:index===0?'completed':'failed',dur:index===0?75:0}))
];
context.paintDialHeatmap(timingProofRows);
assert(getElement('bestWindowNote').innerHTML.includes('Best retry time: 15-17 IST'), 'Timing recommendation must aggregate the best window across weekdays');
assert(getElement('bestWindowNote').innerHTML.includes('10 dials · 3 conversations'), 'Timing recommendation must show concise meaningful-conversation proof');
assert(getElement('dialHeatmap').innerHTML.includes('10 dials · 5 pickup · 3 meaningful'), 'Each timing cell must show its dial, pickup, and meaningful-conversation proof');
assert(getElement('dialHeatmap').innerHTML.includes('30% meaningful'), 'Timing cell must show meaningful conversation rate');
assert(getElement('timingMetricControls').innerHTML.includes('Meaningful · 60s+'), 'Meaningful timing toggle label is missing');
assert(getElement('timingMetricControls').innerHTML.includes('Pickup · any answer'), 'Pickup timing toggle label is missing');
assert(getElement('timingMetricControls').innerHTML.includes('Rank by'), 'Timing metric toggle must identify its single-select purpose');
assert(getElement('timingMetricControls').innerHTML.includes('aria-pressed="true"'), 'Timing metric toggle must visibly mark the active selection');
context.__timingProofRows=timingProofRows;
vm.runInContext('window.__obRecs=__timingProofRows; setOutboundTimingMetric("pickup");', context);
assert(getElement('bestWindowNote').innerHTML.includes('50% pickup'), 'Pickup mode must rank and label the timing recommendation by answered calls');
assert(getElement('dialHeatmap').innerHTML.includes('50% pickup'), 'Pickup mode must update the timing grid metric');
assert(getElement('timingMetricControls').innerHTML.includes('Pickup · any answer</button>'), 'Pickup mode must keep the selected option visible');
context.setOutboundTimingMetric('meaningful');
assert(getElement('dialPlaybookCards').innerHTML.includes('Campaign:</b>09:00–21:00 IST'), 'Timing playbook must keep campaign hours visible by default');
assert(getElement('dialPlaybookCards').innerHTML.includes('Retry:</b>3 max · ~5h apart'), 'Timing playbook must keep retry count and spacing visible by default');
assert(getElement('dialPlaybookCards').innerHTML.includes('<summary>Vendor configuration</summary>'), 'Vendor detail must stay available without crowding the default playbook');
assert(getElement('dialPlaybookCards').innerHTML.includes('Start 09:00 · stop 21:00 IST'), 'Vendor policy must expose the daily campaign start and stop');
assert(getElement('dialPlaybookCards').innerHTML.includes('15-17 IST'), 'Vendor policy must use the all-days preferred retry window');
assert(!context.paintDialHeatmap.toString().includes('[[8,10],[10,12]'), 'Timing windows must not extend outside the 09:00–21:00 campaign policy');
assert(getElement('dialPlaybookCards').innerHTML.includes('queue a new lead for the next 09:00 start'), 'Vendor policy must explain the outside-hours lead handling');

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
assert(getElement('cbList').innerHTML.includes('Show more — 1 more lead'), 'Requested follow-up rendering cap changed');

(async () => {
  const compressed = require('zlib').gzipSync(Buffer.from('CSV transcript\nwith a second line'));
  const unpacked = await context.unpackPublishedData(new Uint8Array(compressed));
  assert.equal(new TextDecoder().decode(unpacked), 'CSV transcript\nwith a second line', 'Dashboard must unpack compressed CSV exports');
  console.log('Dashboard smoke tests passed');
})().catch(error => { console.error(error); process.exit(1); });
