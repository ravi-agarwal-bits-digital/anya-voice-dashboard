"use strict";
const ADMIN_PASSWORD_HASH =
  "7c1466118dea24f6b18e2df487245b062b86232bff0ab6d978e8a46f9e36855a";
const DATA_MAGIC = "AANYAENC1",
  TOKEN_MAGIC = "ANYATOKEN1";
const SESSION = {
  auth: "anya_admin_auth_v2",
  started: "anya_admin_started_v2",
  activity: "anya_admin_activity_v2",
  pass: "anya_admin_passphrase_v2",
  token: "anya_admin_github_token_v2",
};
const STORE = {
  vault: "anya_admin_token_vault_v2",
  repo: "anya_admin_repo_settings_v2",
};
const IDLE_MINS = 60,
  MAX_SESSION_MINS = 720;
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
const KNOWN = [...REQUIRED, ...OPTIONAL],
  STATUS_RANK = { completed: 3, failed: 2, initiated: 1 },
  MAX_FILE_BYTES = 90 * 1024 * 1024;
let ADMIN_PASSPHRASE = "",
  selectedFile = null,
  validation = null,
  sessionTimer = null,
  publishing = false;
const $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
function show(id, msg, type = "info") {
  const el = $(id);
  el.className = "status " + type;
  el.textContent = msg;
  el.classList.remove("hidden");
}
function showHtml(id, msg, type = "info") {
  const el = $(id);
  el.className = "status " + type;
  el.innerHTML = msg;
  el.classList.remove("hidden");
}
function hide(id) {
  $(id).classList.add("hidden");
}
function formatSize(n) {
  return n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(2)} MB`;
}
async function sha256(text) {
  return sha256Bytes(new TextEncoder().encode(text));
}
async function sha256Bytes(bytes) {
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function touchSession() {
  if (!sessionStorage.getItem(SESSION.auth)) return;
  sessionStorage.setItem(SESSION.activity, String(Date.now()));
}
function validSession() {
  const now = Date.now(),
    start = Number(sessionStorage.getItem(SESSION.started) || 0),
    active = Number(sessionStorage.getItem(SESSION.activity) || 0);
  return (
    sessionStorage.getItem(SESSION.auth) === "1" &&
    start &&
    active &&
    now - start < MAX_SESSION_MINS * 60000 &&
    now - active < IDLE_MINS * 60000
  );
}
function startSession() {
  clearInterval(sessionTimer);
  sessionTimer = setInterval(() => {
    if (!validSession())
      logout("Session expired after inactivity. Please sign in again.");
  }, 30000);
}
function showApp() {
  hide("adminGate");
  $("adminApp").classList.remove("hidden");
  loadSettings();
  loadSessionToken();
  refreshVault();
  startSession();
}
async function unlock() {
  const pwd = $("adminPassword").value;
  if (!pwd) return show("gateStatus", "Enter the admin password.", "err");
  if ((await sha256(pwd)) !== ADMIN_PASSWORD_HASH) {
    $("adminPassword").value = "";
    return show("gateStatus", "Incorrect password.", "err");
  }
  const now = Date.now();
  ADMIN_PASSPHRASE = pwd;
  sessionStorage.setItem(SESSION.auth, "1");
  sessionStorage.setItem(SESSION.started, String(now));
  sessionStorage.setItem(SESSION.activity, String(now));
  sessionStorage.setItem(SESSION.pass, pwd);
  showApp();
}
function logout(message = "Signed out safely.") {
  clearInterval(sessionTimer);
  Object.values(SESSION).forEach((k) => sessionStorage.removeItem(k));
  ADMIN_PASSPHRASE = "";
  selectedFile = null;
  validation = null;
  publishing = false;
  $("adminApp").classList.add("hidden");
  $("adminGate").classList.remove("hidden");
  $("adminPassword").value = "";
  show("gateStatus", message, "info");
}
function restoreSession() {
  if (!validSession()) return false;
  ADMIN_PASSPHRASE = sessionStorage.getItem(SESSION.pass) || "";
  if (!ADMIN_PASSPHRASE) return false;
  showApp();
  return true;
}
function currentMode() {
  return (
    document.querySelector('input[name="tokenMode"]:checked')?.value ||
    "session"
  );
}
function settings() {
  return {
    owner: $("owner").value.trim(),
    repo: $("repo").value.trim(),
    branch: $("branch").value.trim() || "main",
    path: $("path").value.trim() || "data/voice_analytics.xlsx",
  };
}
function saveSettings() {
  const s = settings();
  if ($("rememberRepo").checked)
    localStorage.setItem(STORE.repo, JSON.stringify(s));
  else localStorage.removeItem(STORE.repo);
  const token = $("token").value.trim(),
    mode = currentMode();
  if (mode === "session" && token) {
    sessionStorage.setItem(SESSION.token, token);
    show(
      "tokenStatus",
      "Settings saved. Token remembered for this session.",
      "ok",
    );
  } else if (mode === "encrypted" && token) {
    saveVault(token);
  } else if (mode === "never") {
    sessionStorage.removeItem(SESSION.token);
    show("tokenStatus", "Settings saved. Token will not be remembered.", "ok");
  } else show("tokenStatus", "Repository settings saved.", "ok");
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE.repo) || "null");
    if (s) {
      ["owner", "repo", "branch", "path"].forEach((k) => {
        if (s[k]) $(k).value = s[k];
      });
    }
  } catch (e) {
    localStorage.removeItem(STORE.repo);
  }
}
function loadSessionToken() {
  const t = sessionStorage.getItem(SESSION.token);
  if (t) $("token").value = t;
}
function clearSessionToken() {
  $("token").value = "";
  sessionStorage.removeItem(SESSION.token);
  show("tokenStatus", "Session token cleared.", "ok");
}
function bytesToBase64(bytes) {
  let b = "",
    n = 0x8000;
  for (let i = 0; i < bytes.length; i += n)
    b += String.fromCharCode(...bytes.subarray(i, i + n));
  return btoa(b);
}
function base64ToBytes(s) {
  const b = atob(s.replace(/\s/g, "")),
    out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
async function derive(pass, salt, usage) {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pass),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    usage,
  );
}
async function encryptBytes(bytes, pass, magic = DATA_MAGIC) {
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    key = await derive(pass, salt, ["encrypt"]),
    ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes),
    ),
    head = new TextEncoder().encode(magic),
    out = new Uint8Array(head.length + 28 + ct.length);
  out.set(head);
  out.set(salt, head.length);
  out.set(iv, head.length + 16);
  out.set(ct, head.length + 28);
  return out;
}
async function decryptBytes(bytes, pass, magic) {
  const head = new TextEncoder().encode(magic);
  if (bytes.length < head.length + 29 || !head.every((v, i) => bytes[i] === v))
    throw Error("Encrypted payload signature mismatch.");
  const salt = bytes.slice(head.length, head.length + 16),
    iv = bytes.slice(head.length + 16, head.length + 28),
    ct = bytes.slice(head.length + 28),
    key = await derive(pass, salt, ["decrypt"]);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct),
  );
}
async function saveVault(token) {
  const p = $("vaultPass").value;
  if (!p)
    return show("tokenStatus", "Enter a token vault phrase first.", "err");
  const enc = await encryptBytes(
    new TextEncoder().encode(token),
    p,
    TOKEN_MAGIC,
  );
  localStorage.setItem(STORE.vault, bytesToBase64(enc));
  sessionStorage.setItem(SESSION.token, token);
  refreshVault();
  show(
    "tokenStatus",
    "Token encrypted on this device and loaded for this session.",
    "ok",
  );
}
async function unlockVault() {
  try {
    const s = localStorage.getItem(STORE.vault),
      p = $("vaultPass").value;
    if (!s) throw Error("No encrypted token is saved.");
    if (!p) throw Error("Enter the token vault phrase.");
    const plain = await decryptBytes(base64ToBytes(s), p, TOKEN_MAGIC),
      token = new TextDecoder().decode(plain);
    $("token").value = token;
    sessionStorage.setItem(SESSION.token, token);
    show("tokenStatus", "Saved token unlocked for this session.", "ok");
  } catch (e) {
    show("tokenStatus", e.message, "err");
  }
}
function forgetVault() {
  localStorage.removeItem(STORE.vault);
  refreshVault();
  show("tokenStatus", "Encrypted token removed from this device.", "ok");
}
function refreshVault() {
  $("savedBadge").classList.toggle(
    "hidden",
    !localStorage.getItem(STORE.vault),
  );
}
function chooseFile(file) {
  clearValidation();
  if (!file) return;
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    show("validationStatus", "Select an .xlsx or .xls workbook.", "err");
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    show(
      "validationStatus",
      `This workbook is ${formatSize(file.size)}. GitHub's file API supports a maximum of 100 MB; publication is blocked above 90 MB to leave safe request overhead.`,
      "err",
    );
    return;
  }
  selectedFile = file;
  $("fileName").textContent = file.name;
  $("fileSize").textContent = formatSize(file.size);
  $("fileLine").classList.remove("hidden");
  $("validateBtn").disabled = false;
  $("clearFileBtn").disabled = false;
  if (file.size > 70 * 1024 * 1024)
    show(
      "validationStatus",
      "Large workbook: validation, encryption and publishing may take several minutes. Keep this tab open.",
      "warn",
    );
  else hide("validationStatus");
}
function clearValidation() {
  validation = null;
  $("reviewCard").classList.add("hidden");
  $("publishConfirm").checked = false;
  $("publishConfirm").disabled = true;
  $("publishBtn").disabled = true;
  hide("publishStatus");
}
function clearFile() {
  selectedFile = null;
  $("fileInput").value = "";
  $("fileLine").classList.add("hidden");
  $("validateBtn").disabled = true;
  $("clearFileBtn").disabled = true;
  clearValidation();
  hide("validationStatus");
}
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
  return OPTIONAL.reduce((n, k) => n + (String(r[k] ?? "").trim() ? 1 : 0), 0);
}
function validateRows(rows, headers) {
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
  if (missing.length)
    return { errors, warnings, metrics: { raw: rows.length } };
  let blankId = 0,
    badDate = 0,
    badDir = 0,
    badStatus = 0,
    badNumber = 0,
    badNumeric = 0,
    outbound = 0,
    inbound = 0;
  const rawStatusCounts = { completed: 0, failed: 0, initiated: 0, other: 0 };
  const dates = [],
    ids = new Map(),
    idOccurrences = new Map(),
    outFrom = new Set(),
    outTo = new Set(),
    inFrom = new Set();
  rows.forEach((r, i) => {
    const id = String(r["Call ID"] || "").trim(),
      dir = String(r.Direction || "")
        .trim()
        .toLowerCase(),
      st = String(r.Status || "")
        .trim()
        .toLowerCase(),
      dt = parseDate(r["Created At (IST)"]),
      dur = Number(r["Duration (s)"]),
      msg = Number(r.Messages);
    if (Object.prototype.hasOwnProperty.call(rawStatusCounts, st)) rawStatusCounts[st]++;
    else rawStatusCounts.other++;
    if (!id) blankId++;
    if (!dt) badDate++;
    else dates.push(dt);
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
      idOccurrences.set(id, (idOccurrences.get(id) || 0) + 1);
      const candidate = {
          row: r,
          status: st,
          rank: STATUS_RANK[st] || 0,
          date: dt?.getTime() || 0,
          score: completeScore(r),
          i,
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
  });
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
  const final = [...ids.values()].map((x) => x.row),
    counts = { completed: 0, failed: 0, initiated: 0 };
  const lifecycleDuplicateRows = [...idOccurrences.values()].reduce((n, count) => n + Math.max(0, count - 1), 0);
  const lifecycleDuplicateIds = [...idOccurrences.values()].filter((count) => count > 1).length;
  final.forEach((r) => {
    const status = String(r.Status).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status]++;
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
  const missingLead = final.filter(
    (r) =>
      String(r.Status).toLowerCase() === "completed" &&
      (!String(r["Lead Temp."] || "").trim() ||
        !String(r["Review Band"] || "").trim()),
  ).length;
  if (missingLead)
    warnings.push(
      `${missingLead.toLocaleString()} completed calls are missing lead-quality fields and will appear as unknown where supported.`,
    );
  if (!errors.length)
    warnings.unshift(
      "All required columns and critical row-level checks passed.",
    );
  let minDate = null;
  let maxDate = null;
  for (const date of dates) {
    const time = date.getTime();
    if (minDate === null || time < minDate) minDate = time;
    if (maxDate === null || time > maxDate) maxDate = time;
  }
  return {
    errors,
    warnings,
    metrics: {
      raw: rows.length,
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
function fmtDate(d) {
  return d
    ? d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}
function renderReview(v) {
  const m = v.metrics,
    items = [
      ["Raw worksheet rows", m.raw],
      ["Unique Call IDs", m.unique],
      ["Completed Call IDs", m.completed],
      ["Failed Call IDs", m.failed],
      ["Initiated Call IDs", m.initiated],
      ["Lifecycle duplicate rows", m.lifecycleDuplicateRows],
      ["Raw inbound rows", m.inbound],
      ["Raw outbound rows", m.outbound],
      ["Unique outbound learners", m.outLearners],
    ];
  $("summaryGrid").innerHTML = items
    .map(
      ([l, n]) =>
        `<div class="metric"><b>${Number(n || 0).toLocaleString()}</b><span>${esc(l)}</span></div>`,
    )
    .join("");
  $("reviewLead").textContent =
    `${selectedFile.name} · ${formatSize(selectedFile.size)} · ${fmtDate(m.dateMin)} to ${fmtDate(m.dateMax)}`;
  const scopeNote = $("reviewScopeNote");
  if (scopeNote)
    scopeNote.textContent =
      "Admin validation checks workbook structure and publish safety only. Raw worksheet and deduplicated Call-ID counts are intentionally shown separately; no business-intelligence or lead-quality scoring is performed here.";
  const reconciliation = $("reviewStatusReconciliation");
  if (reconciliation) {
    const raw = m.rawStatusCounts || { completed: 0, failed: 0, initiated: 0, other: 0 };
    reconciliation.innerHTML = `<div class="recon-col"><strong>Raw worksheet status rows</strong><span>Completed <b>${raw.completed.toLocaleString()}</b></span><span>Failed <b>${raw.failed.toLocaleString()}</b></span><span>Initiated <b>${raw.initiated.toLocaleString()}</b></span>${raw.other ? `<span>Other / invalid <b>${raw.other.toLocaleString()}</b></span>` : ""}</div><div class="recon-col"><strong>Final unique Call-ID statuses</strong><span>Completed <b>${m.completed.toLocaleString()}</b></span><span>Failed <b>${m.failed.toLocaleString()}</b></span><span>Initiated <b>${m.initiated.toLocaleString()}</b></span></div><div class="recon-foot">Raw status rows: <b>${(raw.completed + raw.failed + raw.initiated + raw.other).toLocaleString()}</b> · Final unique Call IDs: <b>${m.unique.toLocaleString()}</b> · Lifecycle rows are reconciled by keeping the most advanced status per Call ID.</div>`;
  }
  $("errorList").innerHTML = v.errors.length
    ? v.errors.map((x) => `<li>${esc(x)}</li>`).join("")
    : "<li>None</li>";
  $("warningList").innerHTML =
    v.warnings.map((x) => `<li>${esc(x)}</li>`).join("") || "<li>None</li>";
  $("reviewCard").classList.remove("hidden");
  const ok = !v.errors.length;
  $("publishConfirm").disabled = !ok;
  $("publishConfirm").checked = false;
  $("publishBtn").disabled = true;
  show(
    "validationStatus",
    ok
      ? "Validation passed. Review the summary before publishing."
      : `Validation blocked publication with ${v.errors.length} error(s).`,
    ok ? "ok" : "err",
  );
}
async function validateWorkbook() {
  if (!selectedFile) return;
  try {
    $("validateBtn").disabled = true;
    show("validationStatus", "Reading and validating workbook…", "info");
    if (typeof XLSX === "undefined")
      throw Error("Spreadsheet parser is unavailable. Refresh and try again.");
    const bytes = new Uint8Array(await selectedFile.arrayBuffer()),
      wb = XLSX.read(bytes, { type: "array", cellDates: true });
    if (!wb.SheetNames.includes("Voice Export")) {
      validation = {
        errors: ["Required worksheet “Voice Export” was not found."],
        warnings: [`Worksheets found: ${wb.SheetNames.join(", ") || "none"}`],
        metrics: { raw: 0 },
      };
      return renderReview(validation);
    }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Voice Export"], {
      defval: "",
      raw: false,
    });
    if (!rows.length) {
      validation = {
        errors: ["The Voice Export worksheet is empty."],
        warnings: [],
        metrics: { raw: 0 },
      };
      return renderReview(validation);
    }
    const headers = Object.keys(rows[0]);
    validation = { ...validateRows(rows, headers), bytes, headers };
    renderReview(validation);
  } catch (e) {
    validation = null;
    show(
      "validationStatus",
      `Could not validate workbook: ${e.message}`,
      "err",
    );
  } finally {
    $("validateBtn").disabled = !selectedFile;
  }
}
function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function apiUrl(s, path = s.path) {
  return `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
}
function publicationMetadataPath(s) {
  return `${s.path}.meta.json`;
}
async function readPublicationMetadata(s, headers) {
  const response = await fetch(
    `${apiUrl(s, publicationMetadataPath(s))}?ref=${encodeURIComponent(s.branch)}&t=${Date.now()}`,
    { cache: "no-store", headers },
  );
  if (response.status === 404) return { sha: null, value: null };
  if (!response.ok)
    throw Error(`Could not check duplicate-publication metadata (${response.status}).`);
  const file = await response.json();
  try {
    return {
      sha: file.sha || null,
      value: JSON.parse(new TextDecoder().decode(base64ToBytes(file.content || ""))),
    };
  } catch {
    throw Error("Duplicate-publication metadata is invalid. Repair it before publishing.");
  }
}
async function publish() {
  if (
    publishing ||
    !validation ||
    validation.errors.length ||
    !$("publishConfirm").checked
  )
    return;
  const s = settings(),
    token =
      $("token").value.trim() || sessionStorage.getItem(SESSION.token) || "";
  if (!s.owner || !s.repo || !s.branch || !s.path)
    return show("publishStatus", "Complete all repository settings.", "err");
  if (!token)
    return show(
      "publishStatus",
      "Enter or unlock a fine-grained GitHub token.",
      "err",
    );
  try {
    publishing = true;
    $("publishBtn").disabled = true;
    saveSettings();
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      plaintextSha256 = await sha256Bytes(validation.bytes);
    show("publishStatus", "Checking whether this workbook is already published…", "info");
    const publicationMetadata = await readPublicationMetadata(s, headers);
    if (publicationMetadata.value?.plaintextSha256 === plaintextSha256)
      throw Error(
        "This exact workbook is already published. No new encrypted copy was created.",
      );
    show("publishStatus", "Encrypting workbook locally…", "info");
    const encrypted = await encryptBytes(
      validation.bytes,
      ADMIN_PASSPHRASE,
      DATA_MAGIC,
    );
    show("publishStatus", "Running encryption self-test…", "info");
    const roundTrip = await decryptBytes(
      encrypted,
      ADMIN_PASSPHRASE,
      DATA_MAGIC,
    );
    if (!equalBytes(roundTrip, validation.bytes))
      throw Error("Encryption self-test failed; nothing was published.");
    const base = apiUrl(s);
    show("publishStatus", "Checking the current production file…", "info");
    const current = await fetch(
      `${base}?ref=${encodeURIComponent(s.branch)}&t=${Date.now()}`,
      { cache: "no-store", headers },
    );
    let sha = null;
    if (current.ok) sha = (await current.json()).sha || null;
    else if (current.status !== 404)
      throw Error(`Could not read the current file (${current.status}).`);
    const body = {
      message: "Update Anya voice analytics data",
      content: bytesToBase64(encrypted),
      branch: s.branch,
    };
    if (sha) body.sha = sha;
    show("publishStatus", "Publishing encrypted workbook…", "info");
    const put = await fetch(base, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!put.ok) {
      const e = await put.json().catch(() => ({}));
      throw Error(e.message || `GitHub publish failed (${put.status}).`);
    }
    const result = await put.json(),
      commitSha = result.commit?.sha;
    if (!commitSha)
      throw Error(
        "GitHub accepted the file but did not return a commit identifier.",
      );
    show("publishStatus", "Verifying the published file…", "info");
    const verify = await fetch(
      `${base}?ref=${encodeURIComponent(commitSha)}&t=${Date.now()}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.raw+json",
        },
      },
    );
    if (!verify.ok)
      throw Error(
        "Published commit succeeded, but verification could not fetch the new file.",
      );
    const remote = new Uint8Array(await verify.arrayBuffer());
    if (!equalBytes(remote, encrypted))
      throw Error(
        "Published file verification mismatch. Review the latest GitHub commit before using the dashboard.",
      );
    show("publishStatus", "Saving duplicate-publication protection…", "info");
    const metadataBody = {
      message: "Record Anya data publication fingerprint",
      content: bytesToBase64(
        new TextEncoder().encode(
          `${JSON.stringify(
            {
              schemaVersion: 1,
              plaintextSha256,
              dataCommitSha: commitSha,
              publishedAt: new Date().toISOString(),
            },
            null,
            2,
          )}\n`,
        ),
      ),
      branch: s.branch,
    };
    if (publicationMetadata.sha) metadataBody.sha = publicationMetadata.sha;
    const metadataPut = await fetch(apiUrl(s, publicationMetadataPath(s)), {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(metadataBody),
    });
    let metadataWarning = "";
    if (!metadataPut.ok)
      metadataWarning =
        " The data is live, but duplicate protection metadata could not be saved; do not republish this same workbook.";
    const url = result.commit?.html_url || result.content?.html_url || "",
      historyUrl = `https://github.com/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/commits/${encodeURIComponent(s.branch)}/${s.path.split("/").map(encodeURIComponent).join("/")}`;
    selectedFile = null;
    validation = null;
    $("fileInput").value = "";
    $("fileLine").classList.add("hidden");
    $("validateBtn").disabled = true;
    $("clearFileBtn").disabled = true;
    $("publishConfirm").checked = false;
    $("publishConfirm").disabled = true;
    $("publishBtn").disabled = true;
    showHtml(
      "publishStatus",
      `Published and verified successfully.${esc(metadataWarning)}${url ? ` <a class="commitLink" href="${esc(url)}" target="_blank" rel="noopener">View commit</a>` : ""} <a class="commitLink" href="${esc(historyUrl)}" target="_blank" rel="noopener">View previous versions</a>`,
      metadataWarning ? "warn" : "ok",
    );
  } catch (e) {
    show("publishStatus", e.message || String(e), "err");
  } finally {
    publishing = false;
    $("publishBtn").disabled =
      !validation || validation.errors.length || !$("publishConfirm").checked;
  }
}
function bind() {
  $("unlockBtn").onclick = unlock;
  $("adminPassword").onkeydown = (e) => {
    if (e.key === "Enter") unlock();
  };
  $("logoutBtn").onclick = () => logout();
  $("dropZone").onclick = () => $("fileInput").click();
  $("dropZone").onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      $("fileInput").click();
    }
  };
  $("fileInput").onchange = (e) => chooseFile(e.target.files[0]);
  ["dragenter", "dragover"].forEach((n) =>
    $("dropZone").addEventListener(n, (e) => {
      e.preventDefault();
      $("dropZone").classList.add("over");
    }),
  );
  ["dragleave", "drop"].forEach((n) =>
    $("dropZone").addEventListener(n, (e) => {
      e.preventDefault();
      $("dropZone").classList.remove("over");
    }),
  );
  $("dropZone").addEventListener("drop", (e) =>
    chooseFile(e.dataTransfer.files[0]),
  );
  $("validateBtn").onclick = validateWorkbook;
  $("clearFileBtn").onclick = clearFile;
  $("publishConfirm").onchange = () => {
    $("publishBtn").disabled =
      !$("publishConfirm").checked || !validation || validation.errors.length;
  };
  $("publishBtn").onclick = publish;
  $("saveSettingsBtn").onclick = saveSettings;
  $("clearTokenBtn").onclick = clearSessionToken;
  $("unlockVaultBtn").onclick = unlockVault;
  $("forgetVaultBtn").onclick = forgetVault;
  document.querySelectorAll('input[name="tokenMode"]').forEach(
    (r) =>
      (r.onchange = () => {
        $("vaultFields").classList.toggle(
          "hidden",
          currentMode() !== "encrypted",
        );
      }),
  );
  ["click", "keydown", "scroll", "mousemove", "touchstart"].forEach((e) =>
    document.addEventListener(e, touchSession, { passive: true }),
  );
}
document.addEventListener("DOMContentLoaded", () => {
  bind();
  restoreSession();
});
