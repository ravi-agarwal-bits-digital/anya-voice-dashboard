"use strict";

// Parse cumulative CSV exports without constructing a SheetJS workbook. Lifecycle rows are
// reconciled here, then emitted in small batches so the page can normalize them without receiving
// or cloning the entire raw export at once.
const CHUNK_BYTES = 1024 * 1024;
const OUTPUT_ROWS = 250;
const COMPLETENESS_FIELDS = [
  "Lead Temp.",
  "Review Band",
  "Bot Conf.",
  "Need Score",
  "Summary",
  "Full Transcript",
  "Campaign",
  "Campaign ID",
  "Failure Stage",
  "Failure Reason",
  "Failure Detail",
  "SIP / Hangup Code",
  "Hangup Cause",
];
let outputIterator = null,
  outputHeaders = null,
  outputTotal = 0,
  outputSent = 0;

function normFieldName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function findColumn(headers, aliases) {
  const normalized = headers.map(normFieldName);
  for (const alias of aliases) {
    const exact = headers.indexOf(alias);
    if (exact >= 0) return exact;
  }
  for (const alias of aliases) {
    const key = normFieldName(alias);
    const found = normalized.findIndex(
      (column) => column === key || column.includes(key) || key.includes(column),
    );
    if (found >= 0) return found;
  }
  return -1;
}
function lifecycleTime(value) {
  const text = String(value || "")
    .trim()
    .replace(/\s+IST$/i, "")
    .replace(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),/, "$2 $1 $3");
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}
function rowObject(headers, row) {
  const record = {};
  headers.forEach((header, index) => {
    record[header] = row[index] ?? "";
  });
  return record;
}

function parseAndDedupe(bytes) {
  const decoder = new TextDecoder("utf-8");
  let headers = null,
    field = "",
    row = [],
    quoted = false,
    quotePending = false,
    rawRows = 0,
    callIdIndex = -1,
    statusIndex = -1,
    dateIndex = -1,
    completenessIndexes = [],
    byCallId = new Map(),
    noCallId = [];

  function emitRow() {
    row.push(field);
    field = "";
    if (!headers) {
      headers = row.map((value, index) =>
        index === 0 ? String(value).replace(/^\uFEFF/, "") : String(value),
      );
      callIdIndex = findColumn(headers, [
        "Call ID",
        "CallId",
        "ID",
        "Conversation ID",
        "Session ID",
      ]);
      statusIndex = findColumn(headers, ["Status", "Call Status"]);
      dateIndex = findColumn(headers, [
        "Created At (IST)",
        "Created At",
        "Timestamp",
        "Call Time",
        "Call Date",
        "Date",
        "Started At",
        "Start Time",
        "created_at",
        "createdAt",
      ]);
      completenessIndexes = COMPLETENESS_FIELDS.map((name) =>
        findColumn(headers, [name]),
      ).filter((index) => index >= 0);
    } else if (row.length > 1 || String(row[0] || "").trim()) {
      rawRows++;
      const callId =
        callIdIndex >= 0 ? String(row[callIdIndex] || "").trim() : "";
      if (!callId) {
        noCallId.push(row);
      } else {
        const status =
          statusIndex >= 0
            ? String(row[statusIndex] || "").trim().toLowerCase()
            : "";
        const candidate = {
          row,
          rank:
            status === "completed"
              ? 3
              : status === "failed"
                ? 2
                : status === "initiated"
                  ? 1
                  : 0,
          time: dateIndex >= 0 ? lifecycleTime(row[dateIndex]) : 0,
          score: completenessIndexes.reduce(
            (count, index) =>
              count + (String(row[index] ?? "").trim() ? 1 : 0),
            0,
          ),
        };
        const previous = byCallId.get(callId);
        if (
          !previous ||
          candidate.rank > previous.rank ||
          (candidate.rank === previous.rank &&
            (candidate.time > previous.time ||
              (candidate.time === previous.time &&
                candidate.score >= previous.score)))
        )
          byCallId.set(callId, candidate);
      }
    }
    row = [];
  }

  function parseText(text) {
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (quotePending) {
          if (char === '"') {
            field += '"';
            quotePending = false;
            continue;
          }
          quoted = false;
          quotePending = false;
        } else if (char === '"') {
          quotePending = true;
          continue;
        } else {
          field += char;
          continue;
        }
      }
      if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        emitRow();
      } else if (char !== "\r") {
        if (char === '"' && field === "") quoted = true;
        else field += char;
      }
    }
  }

  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    parseText(
      decoder.decode(bytes.subarray(offset, offset + CHUNK_BYTES), {
        stream: offset + CHUNK_BYTES < bytes.length,
      }),
    );
    if (offset && offset % (8 * CHUNK_BYTES) === 0)
      self.postMessage({
        type: "progress",
        phase: "parse",
        percent: Math.min(99, Math.round((offset / bytes.length) * 100)),
      });
  }
  parseText(decoder.decode());
  if (quotePending) {
    quotePending = false;
    quoted = false;
  }
  if (quoted) throw Error("The CSV ends inside an unclosed quoted field.");
  if (field || row.length) emitRow();
  if (!headers) throw Error("The CSV export is empty.");
  outputIterator = (function* finalRows() {
    for (const [callId,candidate] of byCallId){
      byCallId.delete(callId);
      yield candidate.row;
    }
    for (let index=0;index<noCallId.length;index++){
      const candidate=noCallId[index];
      noCallId[index]=null;
      yield candidate;
    }
  })();
  outputHeaders = headers;
  outputTotal = byCallId.size + noCallId.length;
  outputSent = 0;
  return { headers, rawRows, finalRows: outputTotal };
}

function sendNextRows() {
  if (!outputIterator) return;
  const rows = [];
  while (rows.length < OUTPUT_ROWS) {
    const next = outputIterator.next();
    if (next.done) break;
    rows.push(rowObject(outputHeaders, next.value));
  }
  if (!rows.length) {
    outputIterator = null;
    self.postMessage({ type: "complete", total: outputTotal });
    return;
  }
  outputSent += rows.length;
  self.postMessage({
    type: "rows",
    rows,
    processed: outputSent,
    total: outputTotal,
  });
}

self.onmessage = (event) => {
  try {
    if (event.data?.type === "next") {
      sendNextRows();
      return;
    }
    const bytes = new Uint8Array(event.data.bytes);
    const summary = parseAndDedupe(bytes);
    self.postMessage({ type: "ready", ...summary });
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error?.message || String(error),
    });
  }
};
