"use strict";

// Shared by the Admin Console and its CSV worker so large-file validation uses exactly the
// same schema, lifecycle reconciliation and safety checks as ordinary workbook validation.
(function exposeAdminValidation(root) {
  const REQUIRED = [
    "Created At (IST)",
    "Call ID",
    "Direction",
    "Status",
    "From",
    "To",
    "Duration (s)",
    "Messages",
    "Full Transcript",
  ];
  const OPTIONAL = [
    "Created At (UTC)",
    "Campaign",
    "Campaign ID",
    "Failure Stage",
    "Failure Reason",
    "Failure Detail",
    "SIP / Hangup Code",
    "Hangup Cause",
    "Tokens Est.",
    "Lead Temp.",
    "Review Band",
    "Bot Conf.",
    "Need Score",
    "Summary",
  ];
  const KNOWN = [...REQUIRED, ...OPTIONAL];
  const STATUS_RANK = { completed: 3, failed: 2, initiated: 1 };

  function parseDate(v) {
    if (v instanceof Date && !isNaN(v)) return v;
    const s = String(v || "")
      .trim()
      .replace(/\s+IST$/i, "")
      .replace(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),/, "$2 $1 $3");
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function usablePhone(v) {
    const d = String(v || "").replace(/\D/g, "");
    return d.length >= 6 && !/^0+$/.test(d);
  }
  function completeScore(r) {
    return OPTIONAL.reduce(
      (n, key) => n + (String(r[key] ?? "").trim() ? 1 : 0),
      0,
    );
  }
  function createValidationAccumulator(headers) {
    const errors = [],
      warnings = [],
      missing = REQUIRED.filter((c) => !headers.includes(c)),
      missingOpt = OPTIONAL.filter((c) => !headers.includes(c)),
      extra = headers.filter((c) => !KNOWN.includes(c));
    if (missing.length)
      errors.push(`Missing required columns: ${missing.join(", ")}`);
    if (missingOpt.length)
      warnings.push(`Optional columns not present: ${missingOpt.join(", ")}`);
    if (extra.length)
      warnings.push(
        `New columns detected and safely ignored: ${extra.join(", ")}`,
      );
    let raw = 0,
      blankId = 0,
      badDate = 0,
      badDir = 0,
      badStatus = 0,
      badNumber = 0,
      badNumeric = 0,
      outbound = 0,
      inbound = 0,
      lifecycleDuplicateRows = 0,
      lifecycleDuplicateIds = 0,
      minDate = null,
      maxDate = null;
    const rawStatusCounts = {
      completed: 0,
      failed: 0,
      initiated: 0,
      other: 0,
    };
    const ids = new Map(),
      idOccurrences = new Map(),
      outFrom = new Set(),
      outTo = new Set(),
      inFrom = new Set();

    function addRow(r) {
      raw++;
      if (missing.length) return;
      const id = String(r["Call ID"] || "").trim(),
        dir = String(r.Direction || "").trim().toLowerCase(),
        st = String(r.Status || "").trim().toLowerCase(),
        dt = parseDate(r["Created At (IST)"]),
        dur = Number(r["Duration (s)"]),
        msg = Number(r.Messages);
      if (Object.prototype.hasOwnProperty.call(rawStatusCounts, st))
        rawStatusCounts[st]++;
      else rawStatusCounts.other++;
      if (!id) blankId++;
      if (!dt) badDate++;
      else {
        const time = dt.getTime();
        if (minDate === null || time < minDate) minDate = time;
        if (maxDate === null || time > maxDate) maxDate = time;
      }
      if (dir === "outbound") {
        outbound++;
        outFrom.add(String(r.From));
        outTo.add(String(r.To));
        if (!usablePhone(r.To)) badNumber++;
      } else if (dir === "inbound") {
        inbound++;
        inFrom.add(String(r.From));
        if (!usablePhone(r.From)) badNumber++;
      } else badDir++;
      if (!(st in STATUS_RANK)) badStatus++;
      if (!Number.isFinite(dur) || dur < 0 || !Number.isFinite(msg) || msg < 0)
        badNumeric++;
      if (id) {
        const occurrences = (idOccurrences.get(id) || 0) + 1;
        idOccurrences.set(id, occurrences);
        if (occurrences > 1) {
          lifecycleDuplicateRows++;
          if (occurrences === 2) lifecycleDuplicateIds++;
        }
        const candidate = {
            rank: STATUS_RANK[st] || 0,
            date: dt?.getTime() || 0,
            score: completeScore(r),
            status: st,
            missingLead:
              st === "completed" &&
              (!String(r["Lead Temp."] || "").trim() ||
                !String(r["Review Band"] || "").trim()),
          },
          prev = ids.get(id);
        if (
          !prev ||
          candidate.rank > prev.rank ||
          (candidate.rank === prev.rank &&
            (candidate.date > prev.date ||
              (candidate.date === prev.date && candidate.score > prev.score)))
        )
          ids.set(id, candidate);
      }
    }

    function finish() {
      if (missing.length)
        return { errors, warnings, metrics: { raw } };
      if (blankId)
        errors.push(`${blankId.toLocaleString()} rows have a blank Call ID.`);
      if (badDate)
        errors.push(
          `${badDate.toLocaleString()} rows have an invalid IST timestamp.`,
        );
      if (badDir)
        errors.push(
          `${badDir.toLocaleString()} rows have an unsupported Direction.`,
        );
      if (badStatus)
        errors.push(
          `${badStatus.toLocaleString()} rows have an unsupported Status.`,
        );
      if (badNumber)
        errors.push(
          `${badNumber.toLocaleString()} rows do not contain a usable learner phone in the direction-appropriate field.`,
        );
      if (badNumeric)
        errors.push(
          `${badNumeric.toLocaleString()} rows contain invalid duration or message values.`,
        );
      const counts = { completed: 0, failed: 0, initiated: 0 };
      let missingLead = 0;
      ids.forEach((candidate) => {
        if (Object.prototype.hasOwnProperty.call(counts, candidate.status))
          counts[candidate.status]++;
        if (candidate.missingLead) missingLead++;
      });
      if (lifecycleDuplicateRows)
        warnings.push(
          `${lifecycleDuplicateRows.toLocaleString()} raw rows repeat ${lifecycleDuplicateIds.toLocaleString()} Call IDs; status totals below use one final lifecycle row per Call ID.`,
        );
      if (outbound && outFrom.size > Math.max(20, Math.ceil(outbound * 0.02)))
        warnings.push(
          `Outbound From contains ${outFrom.size.toLocaleString()} unique numbers; confirm the vendor has not changed phone routing.`,
        );
      if (outbound && outTo.size < Math.max(2, Math.ceil(outbound * 0.001)))
        errors.push(
          "Outbound To has unexpectedly low learner-number diversity; phone routing may be reversed.",
        );
      if (missingLead)
        warnings.push(
          `${missingLead.toLocaleString()} completed calls are missing lead-quality fields and will appear as unknown where supported.`,
        );
      if (!errors.length)
        warnings.unshift(
          "All required columns and critical row-level checks passed.",
        );
      return {
        errors,
        warnings,
        metrics: {
          raw,
          rawStatusCounts,
          unique: ids.size,
          lifecycleDuplicateRows,
          lifecycleDuplicateIds,
          completed: counts.completed,
          failed: counts.failed,
          initiated: counts.initiated,
          inbound,
          outbound,
          dateMin: minDate === null ? null : new Date(minDate),
          dateMax: maxDate === null ? null : new Date(maxDate),
          outLearners: outTo.size,
          inLearners: inFrom.size,
          extra: extra.length,
        },
      };
    }
    return { addRow, finish };
  }
  function validateRows(rows, headers) {
    const accumulator = createValidationAccumulator(headers);
    rows.forEach(accumulator.addRow);
    return accumulator.finish();
  }

  root.AdminValidation = {
    REQUIRED,
    OPTIONAL,
    createValidationAccumulator,
    validateRows,
  };
})(typeof self !== "undefined" ? self : globalThis);
