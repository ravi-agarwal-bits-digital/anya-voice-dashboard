const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const XLSX = require('../assets/xlsx.full.min.js');

const source = fs.readFileSync('js/workbook-worker.js', 'utf8');
new Function(source);

let posted = null;
const context = {
  console,
  Uint8Array,
  String,
  Error,
  importScripts: path => {
    assert.equal(path, '../assets/xlsx.full.min.js', 'Worker must load the local SheetJS asset');
    context.XLSX = XLSX;
  },
  self: {
    postMessage: message => { posted = message; }
  }
};
vm.createContext(context);
vm.runInContext(source, context);

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Overview'], ['Not call data']]), 'Overview');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
  {
    'Created At (IST)': '10 Jul 2026, 10:30:00 AM IST',
    'Call ID': 'worker-1', Direction: 'outbound', Status: 'completed',
    From: '918071436001', To: '919999999999', 'Duration (s)': 30,
    Messages: 4, 'Full Transcript': 'Synthetic worker test'
  }
]), 'Voice Export');

const bytes = Uint8Array.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
context.self.onmessage({ data: { bytes: bytes.buffer } });

assert(posted?.ok, `Worker parse failed: ${posted?.error || 'no response'}`);
assert.equal(posted.sheets.length, 1, 'Worker should return only the canonical Voice Export sheet');
assert.equal(posted.sheets[0].name, 'Voice Export');
assert.equal(posted.sheets[0].rows.length, 1);
assert.equal(posted.sheets[0].rows[0]['Call ID'], 'worker-1');

console.log('Workbook worker tests passed');
