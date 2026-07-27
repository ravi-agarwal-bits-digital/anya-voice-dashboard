const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const source = fs.readFileSync("js/dashboard-csv-worker.js", "utf8");
new Function(source);
const messages = [];
const context = {
  console,
  Uint8Array,
  TextDecoder,
  Date,
  Map,
  Math,
  Number,
  String,
  Array,
  Object,
  RegExp,
  Error,
  self: {
    postMessage: (message) => messages.push(message),
  },
};
vm.createContext(context);
vm.runInContext(source, context);

const padding = "x".repeat(1024 * 1024 + 23);
const csv =
  '\uFEFFCreated At (IST),Call ID,Direction,Status,From,To,Duration (s),Messages,Full Transcript,Summary\n' +
  `"10 Jul 2026, 10:20:00 AM IST",same-call,outbound,initiated,918071436001,919999999999,0,0,"${padding}",""\n` +
  '"10 Jul 2026, 10:30:00 AM IST",same-call,outbound,completed,918071436001,919999999999,30,4,"First ""quoted"", line\nSecond line","Complete"\n' +
  '"10 Jul 2026, 10:35:00 AM IST",unique-call,inbound,completed,918888888888,918062912051,45,5,"Inbound","Complete"';
const bytes = new TextEncoder().encode(csv);
context.self.onmessage({
  data: {
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  },
});

const ready = messages.find((message) => message.type === "ready");
assert(ready, "CSV worker must report readiness before emitting rows");
assert.equal(ready.rawRows, 3, "CSV worker must retain the raw worksheet grain");
assert.equal(ready.finalRows, 2, "CSV worker must reconcile duplicate Call IDs");
assert(ready.headers.includes("Full Transcript"), "CSV headers were not preserved");

const outputRows = [];
while (!messages.some((message) => message.type === "complete")) {
  const before = messages.length;
  context.self.onmessage({ data: { type: "next" } });
  messages
    .slice(before)
    .filter((message) => message.type === "rows")
    .forEach((message) => outputRows.push(...message.rows));
}
assert.equal(outputRows.length, 2, "CSV worker emitted an unexpected row count");
const completed = outputRows.find((row) => row["Call ID"] === "same-call");
assert.equal(completed.Status, "completed", "Lifecycle deduplication must retain the terminal row");
assert.equal(
  completed["Full Transcript"],
  'First "quoted", line\nSecond line',
  "Quoted commas, escaped quotes, multiline fields or chunk boundaries changed",
);

console.log("Dashboard CSV worker tests passed");
