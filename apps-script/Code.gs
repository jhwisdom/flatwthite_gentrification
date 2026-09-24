/**
 * Google Apps Script backend for the gentrification map.
 *
 * The spreadsheet holds two sheets:
 *   indicators: id | created_at | indicator | approved
 *   pins:       id | created_at | lat | lng | indicator | comment | approved
 *
 * GET  ?action=indicators  -> { requireApproval, indicators: [text, ...] }  (unique)
 * GET  ?action=pins        -> { requireApproval, pins: [{ id, lat, lng, indicator, comment }] }
 * POST { type: "indicator", indicator }
 * POST { type: "pin", lat, lng, indicator, comment }
 */

// true  = new entries are hidden until you tick "approved" in the sheet.
// false = new entries appear immediately (no-approval version).
const REQUIRE_APPROVAL = true;

// Keep these in sync with config.js.
const MAX_INDICATOR_LENGTH = 60;
const MAX_COMMENT_LENGTH = 200;

// Seconds that GET responses are cached, to keep the sheet fast when many phones poll.
const CACHE_SECONDS = 5;

const SHEETS = {
  indicators: ["id", "created_at", "indicator", "approved"],
  pins: ["id", "created_at", "lat", "lng", "indicator", "comment", "approved"],
};

// ---------- One-time setup ----------

/** Run this once from the editor: creates both sheets with headers and checkboxes. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const [name, headers] of Object.entries(SHEETS)) {
    const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);
    // Checkbox column for approval.
    const approvedCol = headers.indexOf("approved") + 1;
    const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    sheet.getRange(2, approvedCol, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  }
}

// ---------- HTTP handlers ----------

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "";
  try {
    if (action === "indicators") return json(cached("indicators", () => ({ requireApproval: REQUIRE_APPROVAL, indicators: listIndicators() })));
    if (action === "pins") return json(cached("pins", () => ({ requireApproval: REQUIRE_APPROVAL, pins: listPins() })));
    return json({ error: "Unknown action" });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    lock.waitLock(10000); // one write at a time, so rows are never overwritten

    let item;
    if (data.type === "indicator") {
      const indicator = cleanText(data.indicator, MAX_INDICATOR_LENGTH, "Indicator");
      item = appendIndicator(indicator);
    } else if (data.type === "pin") {
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("Invalid coordinates");
      const indicator = cleanText(data.indicator, MAX_INDICATOR_LENGTH, "Indicator");
      const comment = cleanText(data.comment, MAX_COMMENT_LENGTH, "Comment");
      // A new indicator typed while pinning is also added to the indicator sheet.
      if (!indicatorExists(indicator)) appendIndicator(indicator);
      item = appendPin(lat, lng, indicator, comment);
    } else {
      throw new Error("Unknown type");
    }

    CacheService.getScriptCache().removeAll(["indicators", "pins"]);
    return json({ ok: true, requireApproval: REQUIRE_APPROVAL, item: item });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

// ---------- Reading ----------

function listIndicators() {
  const seen = {};
  const out = [];
  for (const row of readRows("indicators")) {
    if (!isVisible(row)) continue;
    const text = String(row.indicator).trim();
    const key = normalize(text);
    if (!key || seen[key]) continue;
    seen[key] = true;
    out.push(text);
  }
  return out;
}

function listPins() {
  return readRows("pins")
    .filter(isVisible)
    .map((row) => ({
      id: String(row.id),
      lat: Number(row.lat),
      lng: Number(row.lng),
      indicator: String(row.indicator),
      comment: String(row.comment),
    }))
    .filter((pin) => isFinite(pin.lat) && isFinite(pin.lng));
}

function indicatorExists(text) {
  const key = normalize(text);
  return readRows("indicators").some((row) => normalize(row.indicator) === key);
}

/** Returns the rows of a sheet as objects keyed by header name. */
function readRows(name) {
  const values = getSheet(name).getDataRange().getValues();
  const headers = values.shift() || [];
  return values
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      return obj;
    });
}

function isVisible(row) {
  if (!REQUIRE_APPROVAL) return true;
  return row.approved === true || String(row.approved).toUpperCase() === "TRUE";
}

// ---------- Writing ----------

function appendIndicator(indicator) {
  const item = { id: Utilities.getUuid(), created_at: new Date().toISOString(), indicator: indicator };
  appendRow("indicators", [item.id, item.created_at, safeCell(indicator), !REQUIRE_APPROVAL]);
  return item;
}

function appendPin(lat, lng, indicator, comment) {
  const item = { id: Utilities.getUuid(), created_at: new Date().toISOString(), lat: lat, lng: lng, indicator: indicator, comment: comment };
  appendRow("pins", [item.id, item.created_at, lat, lng, safeCell(indicator), safeCell(comment), !REQUIRE_APPROVAL]);
  return item;
}

function appendRow(name, values) {
  getSheet(name).appendRow(values);
}

// ---------- Helpers ----------

function getSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found. Run setup() once.`);
  return sheet;
}

/** Trims, collapses whitespace, removes control characters and checks the length. */
function cleanText(value, maxLength, label) {
  const text = String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) throw new Error(`${label} is required`);
  if (text.length > maxLength) throw new Error(`${label} is longer than ${maxLength} characters`);
  return text;
}

/** Stops user text from being run as a spreadsheet formula (e.g. "=IMPORTXML(...)"). */
function safeCell(text) {
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function normalize(text) {
  return String(text == null ? "" : text).normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

function cached(key, build) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const value = build();
  try { cache.put(key, JSON.stringify(value), CACHE_SECONDS); } catch (ignored) {} // value too large for cache
  return value;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
