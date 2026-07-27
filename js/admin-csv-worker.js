"use strict";
/* global AdminValidation */

importScripts("admin-validation.js");

async function validateCsv(file) {
  if (!file || typeof file.stream !== "function")
    throw Error("This browser cannot stream the selected CSV.");
  const reader = file.stream().getReader();
  const decoder = new TextDecoder("utf-8");
  let headers = null,
    accumulator = null,
    field = "",
    row = [],
    quoted = false,
    quotePending = false,
    bytesRead = 0,
    nextProgress = 8 * 1024 * 1024;

  function emitRow() {
    row.push(field);
    field = "";
    if (!headers) {
      headers = row.map((value, index) =>
        index === 0 ? String(value).replace(/^\uFEFF/, "") : String(value),
      );
      accumulator = AdminValidation.createValidationAccumulator(headers);
    } else if (row.length > 1 || String(row[0] || "").trim()) {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      accumulator.addRow(record);
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

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    parseText(decoder.decode(value, { stream: true }));
    if (bytesRead >= nextProgress) {
      const pct = file.size ? Math.min(99, Math.round((bytesRead / file.size) * 100)) : 0;
      self.postMessage({
        type: "progress",
        message: `Streaming CSV validation… ${pct}%`,
      });
      nextProgress += 8 * 1024 * 1024;
    }
  }
  parseText(decoder.decode());
  if (quotePending) {
    quotePending = false;
    quoted = false;
  }
  if (quoted) throw Error("The CSV ends inside an unclosed quoted field.");
  if (field || row.length) emitRow();
  if (!headers || !accumulator) throw Error("The CSV export is empty.");
  return { ...accumulator.finish(), headers };
}

self.onmessage = async (event) => {
  try {
    self.postMessage({
      type: "progress",
      message: "Starting streaming CSV validation…",
    });
    const validation = await validateCsv(event.data.file);
    self.postMessage({ type: "result", validation });
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error?.message || String(error),
    });
  }
};
