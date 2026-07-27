const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const validationSource = fs.readFileSync("js/admin-validation.js", "utf8");
const workerSource = fs.readFileSync("js/admin-csv-worker.js", "utf8");
let posted;
let resolveResult;
const resultPromise = new Promise((resolve) => {
  resolveResult = resolve;
});
const context = {
  console,
  Uint8Array,
  TextDecoder,
  ReadableStream,
  Date,
  Map,
  Set,
  Math,
  Number,
  String,
  Array,
  Object,
  RegExp,
  Error,
  isNaN,
  self: {
    postMessage: (value) => {
      posted = value;
      if (value.type === "result" || value.type === "error") resolveResult(value);
    },
  },
  importScripts: (...paths) => {
    assert.deepEqual(paths, ["admin-validation.js"], "CSV worker must load shared validation code");
    vm.runInContext(validationSource, context);
    context.AdminValidation = context.self.AdminValidation;
  },
};
vm.createContext(context);
vm.runInContext(workerSource, context);

const csv =
  '\uFEFFCreated At (IST),Call ID,Direction,Status,From,To,Duration (s),Messages,Full Transcript\n"10 Jul 2026, 10:30:00 AM IST","csv,worker-1",outbound,completed,918071436001,919999999999,30,4,"First ""quoted"", line\nSecond line"\n"10 Jul 2026, 10:35:00 AM IST",csv-worker-2,outbound,failed,918071436001,918888888888,0,0,"No answer"';
(async () => {
  const bytes = new TextEncoder().encode(csv);
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 7)
    chunks.push(bytes.slice(offset, offset + 7));
  const file = {
    size: bytes.length,
    stream: () =>
      new ReadableStream({
        start(controller) {
          chunks.forEach((chunk) => controller.enqueue(chunk));
          controller.close();
        },
      }),
  };
  context.self.onmessage({ data: { file } });
  posted = await resultPromise;
  assert.equal(
    posted.type,
    "result",
    `CSV worker must return a validation result: ${posted.error || "unknown error"}`,
  );
  assert.equal(posted.validation.errors.length, 0, "Valid CSV must pass worker validation");
  assert.equal(posted.validation.metrics.raw, 2, "Worker must preserve raw row grain");
  assert.equal(posted.validation.metrics.unique, 2, "Worker must report unique Call-ID grain");
  assert.equal(posted.validation.metrics.outbound, 2, "Worker direction counts changed");
  assert(
    posted.validation.headers.includes("Full Transcript"),
    "Worker must preserve multiline transcript headers",
  );
  console.log("Admin CSV worker tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
