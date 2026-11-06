/**
 * VODA Fleet: Google Sheets backend for the VODA Fleet phone app.
 *
 * ONE-TIME SETUP
 * 1. In a new, empty Google Sheet: Extensions > Apps Script.
 *    Delete everything in Code.gs, paste this whole file, and click Save.
 * 2. In the function menu at the top, pick "setup" and click Run.
 *    Approve the permission screens (Advanced > Go to project if Google warns you).
 *    This creates the Trucks, Log and Setup tabs, loads your trucks,
 *    and writes the app's access code on the Setup tab.
 * 3. Deploy > New deployment > gear icon > Web app.
 *    Execute as: Me.   Who has access: Anyone.   Click Deploy.
 *    Copy the Web app URL (ends in /exec) into the app's config.js.
 *
 * AFTER CHANGING THIS SCRIPT: Deploy > Manage deployments > pencil > Version: New version > Deploy.
 * The URL stays the same.
 *
 * This file is kept in the voda-fleet GitHub repository (apps-script/Code.gs) so every change comes as a pull request.
 * After merging a change: open Apps Script, replace Code.gs with this file, Ctrl+S, then deploy a New version as above.
 *
 * In the Trucks tab, don't rename or move columns A to AE. You can add your own columns to the right.
 *
 * ONE STEP GPS MILEAGE (optional)
 * 1. Project Settings (gear, left side) > Script Properties > Add script property.
 *    Property: ONESTEP_API_KEY   Value: your One Step GPS API key.   Save script properties.
 * 2. Pick "gpsSetup" in the function menu and click Run. Approve the new permission.
 *    It creates the GPS tab, matches each GPS device to a truck, and pulls the miles every 15 minutes.
 * 3. Check the GPS tab. Fix any truck in column C, and tick "Use GPS miles" for each truck you want synced.
 * The sync also reads each truck's VIN, check-engine codes, fuel, status, location and van engine hours (shown only, never used for TM hours).
 * To see what your account sends: pick "gpsInspect" and click Run (it only reads).
 * To stop the sync: pick "gpsStop" and click Run.
 */

const TRUCK_COLS = ["id", "order", "unit", "driver", "vehicle", "year", "plate",
  "oilInterval", "milesAtOil", "milesNow", "tm", "cdsMilesPerHr", "hrsAtOil",
  "tmOilInterval", "tmOilHrs", "hrsNow", "tier100", "tier400", "tier500", "tier1000", "tier2000",
  "inspectionDue", "registrationDue", "insuranceUntil", "notes", "readingAt", "readingBy", "updatedAt", "division", "vin", "color"];
const ADDED_COLS_FROM = 28;   // columns after AB were added later (division, vin, color); older sheets get them automatically
const DIVISIONS = ["Cleaning", "Restoration"];
const NUM_COLS = ["order", "oilInterval", "milesAtOil", "milesNow", "cdsMilesPerHr", "hrsAtOil",
  "tmOilInterval", "tmOilHrs", "hrsNow", "tier100", "tier400", "tier500", "tier1000", "tier2000"];
const TIERS = ["100", "400", "500", "1000", "2000"];
const TM_KINDS = ["none", "cds", "legend", "apex"];
const LOG_COLS = ["at", "truckId", "unit", "kind", "miles", "hrs", "items", "note", "by"];

// setup() fills a brand-new Trucks tab from SEED. Left empty in this copy: your trucks are already in the Google Sheet,
// and this repository is public, so no truck data is kept here.
const SEED = [];

/* ---------------- setup ---------------- */

function setup() {
  const ss = SpreadsheetApp.getActive();
  const trucks = ss.getSheetByName("Trucks") || ss.insertSheet("Trucks");
  if (trucks.getLastRow() > 1) {
    throw new Error("The Trucks tab already has data, so setup stopped to protect it. To start over, delete the Trucks tab and run setup again.");
  }
  const maxRows = Math.max(trucks.getMaxRows(), 500);
  if (trucks.getMaxRows() < maxRows) trucks.insertRowsAfter(trucks.getMaxRows(), maxRows - trucks.getMaxRows());
  if (trucks.getMaxColumns() < TRUCK_COLS.length) trucks.insertColumnsAfter(trucks.getMaxColumns(), TRUCK_COLS.length - trucks.getMaxColumns());
  trucks.getRange(1, 1, 1, TRUCK_COLS.length).setValues([TRUCK_COLS]).setFontWeight("bold");
  TRUCK_COLS.forEach(function (c, i) {
    if (NUM_COLS.indexOf(c) === -1) trucks.getRange(2, i + 1, maxRows - 1, 1).setNumberFormat("@");
  });
  const now = new Date().toISOString();
  const rows = SEED.map(function (t) { const copy = clean_(t); copy.id = t.id; copy.updatedAt = now; return toRow_(copy); });
  trucks.getRange(2, 1, rows.length, TRUCK_COLS.length).setValues(rows);
  trucks.setFrozenRows(1);
  trucks.autoResizeColumns(1, TRUCK_COLS.length);

  const log = ss.getSheetByName("Log") || ss.insertSheet("Log");
  if (log.getLastRow() === 0) {
    log.getRange(1, 1, 1, LOG_COLS.length).setValues([LOG_COLS]).setFontWeight("bold");
    log.setFrozenRows(1);
  }

  const code = newCode_();
  PropertiesService.getScriptProperties().setProperty("ACCESS_CODE", code);
  writeSetupTab_(code);

  const blank = ss.getSheetByName("Sheet1");
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  Logger.log("Setup finished. Access code: " + code);
}

/** Run this to replace the access code. Everyone then enters the new code once. */
function newAccessCode() {
  const code = newCode_();
  PropertiesService.getScriptProperties().setProperty("ACCESS_CODE", code);
  writeSetupTab_(code);
  Logger.log("New access code: " + code);
}

function writeSetupTab_(code) {
  const ss = SpreadsheetApp.getActive();
  const s = ss.getSheetByName("Setup") || ss.insertSheet("Setup");
  s.clear();
  s.getRange(1, 1, 6, 2).setValues([
    ["Access code", code],
    ["", ""],
    ["The app asks for this code the first time it opens on each phone.", ""],
    ["To change it: Extensions > Apps Script, pick newAccessCode, click Run.", ""],
    ["Trucks tab: don't rename or move columns A to AE. You can add your own columns to the right.", ""],
    ["Log tab: every saved reading and service is added here.", ""]
  ]);
  s.getRange("A1:B1").setFontWeight("bold").setFontSize(14);
  s.setColumnWidth(1, 160);
}

function newCode_() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out.slice(0, 4) + "-" + out.slice(4);
}

/* ---------------- web app ---------------- */

function doGet() {
  return json_({ ok: true, app: "VODA Fleet backend", status: "running" });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e && e.postData ? e.postData.contents : "{}");
  } catch (err) {
    return json_({ ok: false, error: "bad_request" });
  }
  const saved = PropertiesService.getScriptProperties().getProperty("ACCESS_CODE");
  if (!saved) return json_({ ok: false, error: "not_set_up" });
  if (normCode_(req.code) !== normCode_(saved)) return json_({ ok: false, error: "bad_code" });
  try {
    switch (req.action) {
      case "list": {
        const trucks = readTrucks_().map(function (x) { return x.truck; });
        let gps = null;
        try { gps = gpsForApp_(trucks); } catch (e) { gps = null; }   // GPS details never stop the list from loading
        return json_({ ok: true, trucks: trucks, gps: gps, serverTime: new Date().toISOString() });
      }
      case "saveTruck":
        return json_(withLock_(function () { return saveTruck_(req); }));
      case "deleteTruck":
        return json_(withLock_(function () { return deleteTruck_(req); }));
      case "history":
        return json_({ ok: true, entries: history_(String(req.id || "")) });
      default:
        return json_({ ok: false, error: "bad_request" });
    }
  } catch (err) {
    return json_({ ok: false, error: "server", message: String(err && err.message ? err.message : err) });
  }
}

function saveTruck_(req) {
  const id = String(req.id || "").trim();
  if (!/^[a-z0-9-]{1,60}$/.test(id) || !req.truck || typeof req.truck !== "object") return { ok: false, error: "bad_request" };
  const found = readTrucks_().filter(function (x) { return x.truck.id === id; })[0];
  const base = req.base || null;
  if (found && found.truck.updatedAt !== base) return { ok: false, error: "conflict", truck: found.truck };
  if (!found && base) return { ok: false, error: "gone" };
  const t = clean_(req.truck);
  t.id = id;
  const all = readTrucks_();
  const clash = all.filter(function (x) { return x.truck.id !== id && unitKey_(x.truck.unit) === unitKey_(t.unit) && unitKey_(t.unit) !== ""; })[0];
  if (clash) return { ok: false, error: "duplicate_unit", unit: clash.truck.unit };
  t.updatedAt = new Date().toISOString();
  // If One Step GPS has already moved this truck's miles forward, an app save never pulls them back.
  if (found && found.truck.readingBy === "GPS" && num_(found.truck.milesNow) !== null &&
      (t.milesNow === null || t.milesNow < found.truck.milesNow)) {
    t.milesNow = found.truck.milesNow;
  }
  if (t.readingAt === "now") t.readingAt = t.updatedAt;
  const row = toRow_(t);
  const sheet = sheet_("Trucks");
  if (found) sheet.getRange(found.rowIndex, 1, 1, TRUCK_COLS.length).setValues([row]);
  else sheet.getRange(Math.max(sheet.getLastRow(), 1) + 1, 1, 1, TRUCK_COLS.length).setValues([row]);
  if (found && found.truck.unit !== t.unit) gpsRenameTruck_(found.truck.unit, t.unit);
  if (req.log && typeof req.log === "object") appendLog_(t, req.log, req.by);
  return { ok: true, truck: fromRow_(row) };
}

function deleteTruck_(req) {
  const id = String(req.id || "");
  const found = readTrucks_().filter(function (x) { return x.truck.id === id; })[0];
  if (!found) return { ok: true };
  if (found.truck.updatedAt !== (req.base || null)) return { ok: false, error: "conflict", truck: found.truck };
  sheet_("Trucks").deleteRow(found.rowIndex);
  gpsRenameTruck_(found.truck.unit, "");
  appendLog_(found.truck, { kind: "deleted", items: ["Truck deleted"] }, req.by);
  return { ok: true };
}

function history_(id) {
  const sheet = sheet_("Log");
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, LOG_COLS.length).getValues();
  const out = [];
  for (let i = values.length - 1; i >= 0 && out.length < 15; i--) {
    const r = values[i];
    if (String(r[1]) !== id) continue;
    out.push({
      at: r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), "MMM d, yyyy h:mm a") : String(r[0]),
      kind: String(r[3]), miles: num_(r[4]), hrs: num_(r[5]),
      items: r[6] ? String(r[6]).split(", ") : [], note: String(r[7] || ""), by: String(r[8] || "")
    });
  }
  return out;
}

function appendLog_(t, log, by) {
  const sheet = sheet_("Log");
  const items = Array.isArray(log.items) ? log.items.map(String).join(", ").slice(0, 300) : "";
  const at = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM d, yyyy h:mm a");
  sheet.getRange(Math.max(sheet.getLastRow(), 1) + 1, 1, 1, LOG_COLS.length).setValues([[
    at, t.id, String(t.unit || ""), String(log.kind || "").slice(0, 20),
    num_(log.miles) === null ? "" : num_(log.miles), num_(log.hrs) === null ? "" : num_(log.hrs),
    items, String(log.note || "").slice(0, 500), String(by || "").slice(0, 60)
  ]]);
}

/* ---------------- rows ---------------- */

/** Sheets set up before a column was added get it here: header written, nothing of yours overwritten. */
function ensureTruckCols_(sheet) {
  const need = TRUCK_COLS.length;
  if (sheet.getMaxColumns() < need) sheet.insertColumnsAfter(sheet.getMaxColumns(), need - sheet.getMaxColumns());
  if (String(sheet.getRange(1, need).getValues()[0][0]) === TRUCK_COLS[need - 1]) return;
  for (let i = ADDED_COLS_FROM; i < need; i++) {
    const head = String(sheet.getRange(1, i + 1).getValues()[0][0]);
    if (head === TRUCK_COLS[i]) continue;
    if (head.trim() !== "") sheet.insertColumnBefore(i + 1);   // your own column there moves one to the right
    sheet.getRange(1, i + 1).setValue(TRUCK_COLS[i]).setFontWeight("bold");
    sheet.getRange(2, i + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  }
}

function readTrucks_() {
  const sheet = sheet_("Trucks");
  ensureTruckCols_(sheet);
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, TRUCK_COLS.length).getValues();
  const out = [];
  values.forEach(function (r, i) {
    if (String(r[0]).trim() === "") return;
    out.push({ rowIndex: i + 2, truck: fromRow_(r) });
  });
  return out;
}

function fromRow_(r) {
  const tz = Session.getScriptTimeZone();
  const t = { tiers: {} };
  TRUCK_COLS.forEach(function (c, i) {
    let v = r[i];
    if (c.indexOf("tier") === 0) {
      const n = num_(v);
      if (n !== null) t.tiers[c.slice(4)] = n;
      return;
    }
    if (NUM_COLS.indexOf(c) !== -1) { t[c] = num_(v); return; }
    if (v instanceof Date) {
      if (c === "registrationDue") v = Utilities.formatDate(v, tz, "yyyy-MM");
      else if (c === "inspectionDue" || c === "insuranceUntil") v = Utilities.formatDate(v, tz, "yyyy-MM-dd");
      else v = v.toISOString();
    }
    t[c] = v === null || v === undefined ? "" : String(v);
  });
  if (TM_KINDS.indexOf(t.tm) === -1) t.tm = "none";
  return t;
}

function toRow_(t) {
  return TRUCK_COLS.map(function (c) {
    if (c.indexOf("tier") === 0) {
      const n = t.tiers ? num_(t.tiers[c.slice(4)]) : null;
      return n === null ? "" : n;
    }
    if (NUM_COLS.indexOf(c) !== -1) { const n = num_(t[c]); return n === null ? "" : n; }
    const v = t[c];
    return v === null || v === undefined ? "" : String(v);
  });
}

function clean_(t) {
  const out = { tiers: {} };
  const limits = { unit: 60, driver: 60, vehicle: 80, year: 10, plate: 20, tm: 10, division: 20, vin: 17, color: 7,
    inspectionDue: 10, registrationDue: 7, insuranceUntil: 10, notes: 1000, readingAt: 40, readingBy: 60 };
  TRUCK_COLS.forEach(function (c) {
    if (c === "id" || c === "updatedAt" || c.indexOf("tier") === 0) return;
    if (NUM_COLS.indexOf(c) !== -1) { out[c] = num_(t[c]); return; }
    out[c] = t[c] === null || t[c] === undefined ? "" : String(t[c]).slice(0, limits[c] || 100);
  });
  if (TM_KINDS.indexOf(out.tm) === -1) out.tm = "none";
  if (DIVISIONS.indexOf(out.division) === -1) out.division = "";
  out.vin = normVin_(t.vin);
  if (!VIN_RE.test(out.vin)) out.vin = "";
  out.color = /^#[0-9a-f]{6}$/i.test(String(t.color || "").trim()) ? String(t.color).trim().toLowerCase() : "";
  if (t.tiers && typeof t.tiers === "object") {
    TIERS.forEach(function (k) { const n = num_(t.tiers[k]); if (n !== null) out.tiers[k] = n; });
  }
  return out;
}

/* ---------------- helpers ---------------- */

function num_(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, ""));
  return isFinite(n) ? n : null;
}
function unitKey_(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }
function normVin_(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17); }

/** A 17-character VIN. With checkDigit, also the North American check digit (filters out garbage some trackers send). */
function vinValid_(s, checkDigit) {
  const v = normVin_(s);
  if (!VIN_RE.test(v) || /^(.)\1+$/.test(v)) return false;
  if (!checkDigit) return true;
  const map = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
  const w = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 17; i++) { const c = v.charAt(i); sum += (/\d/.test(c) ? Number(c) : map[c]) * w[i]; }
  const r = sum % 11;
  return v.charAt(8) === (r === 10 ? "X" : String(r));
}

/** Keeps the GPS tab in step when a truck is renamed (or deleted, newUnit ""), so GPS miles keep flowing. */
function gpsRenameTruck_(oldUnit, newUnit) {
  const s = SpreadsheetApp.getActive().getSheetByName("GPS");
  if (!s || s.getLastRow() < 2 || !oldUnit) return;
  const range = s.getRange(2, 3, s.getLastRow() - 1, 2);
  const vals = range.getValues();
  let changed = false;
  vals.forEach(function (v) {
    if (String(v[0]) === String(oldUnit)) { v[0] = newUnit; if (!newUnit) v[1] = false; changed = true; }
  });
  if (changed) range.setValues(vals);
}

function normCode_(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function sheet_(name) {
  const s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s) throw new Error("The " + name + " tab is missing. Run setup first.");
  return s;
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- One Step GPS ---------------- */

const GPS_URL = "https://track.onestepgps.com/v3/api/public/device?latest_point=true";
const GPS_GROUP_URLS = ["https://track.onestepgps.com/v3/api/public/device-group",
  "https://track.onestepgps.com/v3/api/public/device_group",
  "https://track.onestepgps.com/v3/api/public/group"];
const GPS_COLS = ["GPS device", "Device ID", "Truck", "Use GPS miles", "Adjust (mi)", "GPS miles", "Sheet miles",
  "Last GPS report", "Note", "Odometer from", "VIN", "Year / make / model", "Plate (GPS)", "Groups",
  "Check engine", "Fuel %", "Status", "Location", "Coordinates", "Status since", "Engine hrs (van)"];
const GPS_NCOLS = GPS_COLS.length;   // A to U
const GPS_STATUS_CELL = "W1";
const GPS_TEXT_COLS = [11, 12, 13, 14, 15, 17, 18, 19, 20];   // K..T except Fuel %, kept as plain text
const SRC_VEHICLE = "Vehicle computer";
const SRC_TRACKER = "GPS tracker";
const GPS_MAX_JUMP = 5000;      // a jump bigger than this between syncs is treated as a mistake and not saved
const GPS_OFFLINE_HRS = 72;     // no report for this long = "GPS offline" in the app
const GPS_MOVED_M = 150;        // the street address is looked up again only after the truck moves this far
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Run once to connect (or again any time): matches GPS devices to trucks, builds the GPS tab and starts the 15-minute sync. */
function gpsSetup() {
  const devices = gpsDevices_(gpsFetch_().json);
  Logger.log("Connected to One Step GPS. Devices found: " + devices.length);
  devices.forEach(function (d) {
    const v = d.odo.vehicle, t = d.odo.tracker;
    Logger.log(d.name + "  |  vehicle computer: " + (v ? Math.round(gpsMiles_(v, null)) + " mi" : "none") +
      "  |  GPS tracker: " + (t ? Math.round(gpsMiles_(t, null)) + " mi" : "none") + (d.info.vin ? "  |  VIN " + d.info.vin : ""));
  });
  if (!devices.length) throw new Error("Connected, but One Step GPS returned no devices. Send a screenshot of this log to Claude.");
  gpsGroupNames_(true);

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("GPS") || ss.insertSheet("GPS");
  if (sheet.getMaxColumns() < GPS_NCOLS + 2) sheet.insertColumnsAfter(sheet.getMaxColumns(), GPS_NCOLS + 2 - sheet.getMaxColumns());
  const prev = {};
  if (sheet.getLastRow() > 1) {
    const width = Math.min(GPS_NCOLS, sheet.getMaxColumns());
    sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues().forEach(function (row) {
      const id = String(row[1]).trim();
      if (id) prev[id] = { truck: String(row[2] || ""), use: row[3] === true, adjust: num_(row[4]) || 0,
        source: (row[9] === SRC_VEHICLE || row[9] === SRC_TRACKER) ? row[9] : "",
        extra: GPS_COLS.slice(10).map(function (c, i) { return row[10 + i] === undefined ? "" : row[10 + i]; }) };
    });
  }
  const trucks = readTrucks_().map(function (x) { return x.truck; });

  // Auto-match: a truck whose VIN the tracker reports first, then "VODA n" names, then unit or driver names.
  // Name matches are only made for devices that report an odometer.
  const taken = {};
  const live = {};
  devices.forEach(function (d) { live[d.id] = true; });
  Object.keys(prev).forEach(function (k) { if (prev[k].truck && live[k]) taken[prev[k].truck] = true; });   // devices gone from One Step GPS free their truck
  const auto = {};
  const newestFirst = devices.slice().sort(function (a, b) { return String(b.info.at).localeCompare(String(a.info.at)); });
  // Old trackers often still report the VIN of the truck they came out of, so only ones still reporting count, newest first.
  newestFirst.forEach(function (d) {
    if (prev[d.id] || !d.info.vin || gpsQuietDays_(d.info.at) !== null) return;
    const m = trucks.filter(function (t) { return t.vin === d.info.vin; })[0];
    if (m && !taken[m.unit]) { auto[d.id] = m.unit; taken[m.unit] = true; }
  });
  [true, false].forEach(function (vodaPass) {
    newestFirst.forEach(function (d) {
      if (prev[d.id] || auto[d.id] || (!d.odo.vehicle && !d.odo.tracker)) return;
      const hasVoda = /voda\s*-?\s*\d+/i.test(d.name);
      if (vodaPass !== hasVoda) return;
      const m = gpsMatch_(d.name, trucks);
      if (m && !taken[m.unit] && !(m.vin && d.info.vin && m.vin !== d.info.vin)) { auto[d.id] = m.unit; taken[m.unit] = true; }
    });
  });

  const rows = devices.map(function (d) {
    const p = prev[d.id];
    const unit = p ? p.truck : (auto[d.id] || "");
    const adjust = p ? p.adjust : 0;
    const t = trucks.filter(function (x) { return x.unit === unit; })[0] || null;
    const source = (p && p.source) ? p.source : gpsChooseSource_(d, t, adjust);
    const gm = gpsReading_(d, source, t, adjust);
    let use = p ? p.use : false;
    if (!p && t && gm !== null && t.milesNow !== null) {
      const diff = gm - t.milesNow;
      use = diff >= -300 && diff <= 3000;
    } else if (!p && t && gm !== null && t.milesNow === null) use = true;
    return [d.name, d.id, unit, use, adjust, gm === null ? "" : gm,
      t && t.milesNow !== null ? t.milesNow : "", d.info.at || "", "", source].concat(p ? p.extra : GPS_COLS.slice(10).map(function () { return ""; }));
  });

  sheet.clear();
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), GPS_NCOLS).clearDataValidations();
  sheet.getRange(1, 1, 1, GPS_NCOLS).setValues([GPS_COLS]).setFontWeight("bold");
  sheet.setFrozenRows(1);
  if (rows.length) {
    sheet.getRange(2, 2, rows.length, 1).setNumberFormat("@");
    gpsTextCols_(sheet, rows.length);
    sheet.getRange(2, 1, rows.length, GPS_NCOLS).setValues(rows);
    sheet.getRange(2, 4, rows.length, 1).insertCheckboxes();
    sheet.getRange(2, 3, rows.length, 1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(sheet_("Trucks").getRange("C2:C"), true).setAllowInvalid(false).build());
    sheet.getRange(2, 10, rows.length, 1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList([SRC_VEHICLE, SRC_TRACKER], true).setAllowInvalid(false).build());
  }
  sheet.autoResizeColumns(1, GPS_NCOLS);

  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "gpsSync") ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger("gpsSync").timeBased().everyMinutes(15).create();
  gpsSync();
  Logger.log("GPS setup finished. Check the GPS tab. Miles and truck status now update every 15 minutes.");
}

function gpsTextCols_(sheet, n) {
  GPS_TEXT_COLS.forEach(function (c) { sheet.getRange(2, c, Math.max(n, 1), 1).setNumberFormat("@"); });
}

/** Runs every 15 minutes: copies GPS miles into "Miles now" for trucks ticked "Use GPS miles",
 *  and refreshes VIN, check engine, fuel, status and location for every device on the GPS tab. */
function gpsSync() {
  const sheet = SpreadsheetApp.getActive().getSheetByName("GPS");
  if (!sheet || sheet.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM d, yyyy h:mm a");
  let devices;
  try { devices = gpsDevices_(gpsFetch_().json); }
  catch (err) {
    const msg = String(err && err.message ? err.message : err);
    props.setProperties({ GPS_LAST_ERROR: msg.slice(0, 300), GPS_LAST_TRY: new Date().toISOString() });
    if (sheet.getMaxColumns() >= GPS_NCOLS + 2) sheet.getRange(GPS_STATUS_CELL).setValue("Last sync failed " + stamp + ": " + msg);
    return;
  }
  const groups = gpsGroupNames_(false);
  const byId = {};
  devices.forEach(function (d) { gpsApplyGroups_(d, groups); byId[d.id] = d; });

  // The tab gets the new columns the first time this version runs. Nothing you typed in A to E is touched.
  if (sheet.getMaxColumns() < GPS_NCOLS + 2) sheet.insertColumnsAfter(sheet.getMaxColumns(), GPS_NCOLS + 2 - sheet.getMaxColumns());
  const n = sheet.getLastRow() - 1;
  const head = sheet.getRange(1, 1, 1, GPS_NCOLS).getValues()[0];
  if (head.join("|") !== GPS_COLS.join("|")) {
    sheet.getRange(1, 1, 1, GPS_NCOLS).setValues([GPS_COLS]).setFontWeight("bold");
    gpsTextCols_(sheet, n);
  }

  // Slow lookups (VIN decoding, street addresses) run before the lock, so app saves never wait for them.
  const before = sheet.getRange(2, 1, n, GPS_NCOLS).getValues();
  const budget = { vin: 5, address: 10 };
  const extras = {};   // by device ID, so a re-sorted tab can't mix rows up
  before.forEach(function (row) {
    const id = String(row[1]).trim();
    const d = byId[id];
    if (!d || extras[id]) return;
    const info = d.info;
    let ymm = info.ymm;
    if (!ymm.year && !ymm.make && info.vin) ymm = gpsDecodeVin_(info.vin, budget) || ymm;
    let address = "";
    if (info.lat !== null && info.lng !== null && info.drive !== "Driving") {
      const old = gpsParseCoords_(row[18]);
      if (String(row[17] || "") && old && gpsDistM_(old.lat, old.lng, info.lat, info.lng) < GPS_MOVED_M) address = String(row[17]);
      else if (String(row[2] || "")) address = gpsAddress_(info.lat, info.lng, budget);
    }
    extras[id] = { ymm: ymm, address: address };
  });

  let updated = 0;
  withLock_(function () {
    const all = readTrucks_();
    const vals = sheet.getRange(2, 1, n, GPS_NCOLS).getValues();
    const outFT = [];
    const claimed = {};
    vals.forEach(function (row) {
      const out = [row[5], row[6], row[7], "", row[9]].concat(row.slice(10, GPS_NCOLS));   // F..U
      outFT.push(out);
      const id = String(row[1]).trim();
      if (!id) return;
      const d = byId[id];
      if (!d) { out[3] = "Not found in One Step GPS any more."; return; }
      const info = d.info;
      const ex = extras[id] || { ymm: info.ymm, address: "" };
      out[2] = info.at || "";
      out[5] = info.vin;
      out[6] = gpsYmmText_(ex.ymm);
      out[7] = info.plate;
      out[8] = info.groups.join(", ");
      out[9] = info.check.state === "on" ? "ON" + (info.check.codes.length ? ": " + info.check.codes.join(", ") : "") : info.check.state === "off" ? "Off" : info.check.state === "none" ? "None reported" : "";
      out[10] = info.fuel === null ? "" : info.fuel;
      out[11] = info.drive;
      out[12] = ex.address;
      out[13] = info.lat === null || info.lng === null ? "" : info.lat.toFixed(5) + ", " + info.lng.toFixed(5);
      out[14] = info.since;
      out[15] = info.engineHrs === null ? "" : info.engineHrs;   // shown for reference only; TM hours are never worked out from it

      const unit = String(row[2] || "");
      const found = unit ? all.filter(function (x) { return x.truck.unit === unit; })[0] : null;
      const adjust = num_(row[4]) || 0;
      const quietDays = gpsQuietDays_(info.at);
      if (!found) {
        const any = d.odo.vehicle || d.odo.tracker;
        const owner = info.vin ? all.filter(function (x) { return x.truck.vin === info.vin; })[0] : null;
        out[0] = any ? Math.round(gpsMiles_(d.odo.vehicle || d.odo.tracker, null) + adjust) : "";
        out[1] = "";
        out[3] = any ? "Not used. Pick a truck in column C to use this device." : "No odometer from this device.";
        if (quietDays !== null) out[3] = "Old or unplugged tracker: no report for " + quietDays + " days." + (owner ? " It reports " + owner.truck.unit + "'s VIN, so it was in that truck before." : "");
        else if (owner) out[3] = "Reports the VIN of " + owner.truck.unit + ". Pick " + owner.truck.unit + " in column C if this tracker is in that truck.";
        return;
      }
      const t = found.truck;
      out[1] = t.milesNow === null ? "" : t.milesNow;

      // A tracker moved into another truck keeps its old name and match. The VIN gives it away.
      if (info.vin && t.vin && info.vin !== t.vin) {
        const other = all.filter(function (x) { return x.truck.vin === info.vin; })[0];
        out[3] = "VIN doesn't match: the tracker reports " + info.vin + ", but " + t.unit + " has " + t.vin + "." +
          (other ? " That VIN belongs to " + other.truck.unit + "." : "") +
          " The tracker may have moved to another truck, so nothing is copied. If " + t.unit + "'s VIN is wrong, fix it in the app.";
        return;
      }

      let source = (row[9] === SRC_VEHICLE || row[9] === SRC_TRACKER) ? row[9] : "";
      if (!source) { source = gpsChooseSource_(d, t, adjust); out[4] = source; }
      const gm = gpsReading_(d, source, t, adjust);
      const cur = t.milesNow;
      out[0] = gm === null ? "" : gm;
      const ticked = row[3] === true;
      let changed = false;
      const notes = [];

      // Details One Step GPS knows fill only empty fields, and only once you've ticked the device as right for this truck.
      if (ticked && !claimed[t.id]) {
        const filled = [];
        const ymm = ex.ymm || {};
        if (!t.vin && info.vin) { t.vin = info.vin; filled.push("VIN"); }
        if (!t.plate && info.plate) { t.plate = info.plate; filled.push("plate"); }
        if (!t.year && ymm.year) { t.year = ymm.year; filled.push("year"); }
        if (!t.vehicle && (ymm.make || ymm.model)) { t.vehicle = [ymm.make, ymm.model].filter(Boolean).join(" ").slice(0, 80); filled.push("vehicle"); }
        if (!t.division && info.division) { t.division = info.division; filled.push("unit"); }
        if (filled.length) {
          t.updatedAt = new Date().toISOString();
          changed = true;
          appendLog_(t, { kind: "gps", items: ["Filled in from One Step GPS: " + filled.join(", ")] }, "GPS");
          notes.push("Filled in " + filled.join(", ") + ".");
        }
      }

      if (!source) out[3] = "Can't tell which odometer is right. Check the dashboard, put the difference in Adjust, and it will start.";
      else if (gm === null) out[3] = "No " + source.toLowerCase() + " odometer in the latest GPS update (truck may be off). It will try again.";
      else if (!ticked) out[3] = "Not syncing. GPS " + gm + " mi, sheet " + (cur === null ? "blank" : cur + " mi") + ". Tick Use GPS miles when GPS matches the dashboard.";
      else if (claimed[t.id]) out[3] = "Another ticked device already feeds " + t.unit + ". Untick one of them.";
      else if (cur !== null && gm - cur > GPS_MAX_JUMP) out[3] = "GPS jumped " + (gm - cur) + " mi since the last reading, so it wasn't saved. Check Adjust.";
      else if (cur !== null && gm < cur) out[3] = "GPS is " + (cur - gm) + " mi below the sheet. It updates once it passes that. If the dashboard matches GPS, fix Miles now in the Trucks tab.";
      else {
        if (cur === null || gm > cur) {
          t.milesNow = gm;
          t.readingAt = new Date().toISOString();
          t.readingBy = "GPS";
          out[1] = gm;
          updated++;
          changed = true;
        }
        out[3] = "OK";
      }
      if (ticked && source && gm !== null) claimed[t.id] = true;
      if (notes.length) out[3] = (out[3] === "OK" ? "OK. " : out[3] + " ") + notes.join(" ");
      if (quietDays !== null) out[3] = "Tracker hasn't reported for " + quietDays + " days. Check it's plugged in." + (out[3] === "OK" ? "" : " " + out[3]);
      if (changed) sheet_("Trucks").getRange(found.rowIndex, 1, 1, TRUCK_COLS.length).setValues([toRow_(t)]);
    });
    // Only columns F to U are written back, so edits to Truck, Use GPS miles and Adjust are never overwritten.
    sheet.getRange(2, 6, n, GPS_NCOLS - 5).setValues(outFT);
  });
  props.setProperties({ GPS_LAST_ERROR: "", GPS_LAST_TRY: new Date().toISOString(), GPS_LAST_OK: new Date().toISOString() });
  sheet.getRange(GPS_STATUS_CELL).setValue("Last sync " + stamp + ": " + updated + " truck" + (updated === 1 ? "" : "s") + " updated.");
}

/** Stops the 15-minute GPS sync. Miles go back to being typed in the app. */
function gpsStop() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "gpsSync") { ScriptApp.deleteTrigger(tr); n++; } });
  Logger.log(n ? "GPS sync stopped." : "GPS sync wasn't running.");
}

/** Run once after an update: lists what your One Step GPS account actually sends, so missing pieces can be fixed.
 *  It only reads. Send Claude a screenshot of the log. */
function gpsInspect() {
  const json = gpsFetch_().json;
  const devices = gpsDevices_(json);
  const groups = gpsGroupNames_(true);
  devices.forEach(function (d) { gpsApplyGroups_(d, groups); });
  const count = function (fn) { return devices.filter(fn).length; };
  const total = devices.length;
  Logger.log("Devices: " + total + ". Group names " + (Object.keys(groups.names).length ? "found (" + Object.keys(groups.names).length + ")" : "not available") + ".");
  Logger.log("VIN: " + count(function (d) { return d.info.vin; }) + "/" + total +
    "  |  Check-engine data: " + count(function (d) { return d.info.check.state; }) + "/" + total +
    " (light ON: " + count(function (d) { return d.info.check.state === "on"; }) + ")" +
    "  |  Fuel: " + count(function (d) { return d.info.fuel !== null; }) + "/" + total +
    "  |  Status: " + count(function (d) { return d.info.drive; }) + "/" + total +
    "  |  Location: " + count(function (d) { return d.info.lat !== null; }) + "/" + total +
    "  |  Plate: " + count(function (d) { return d.info.plate; }) + "/" + total +
    "  |  Year/make/model: " + count(function (d) { return d.info.ymm.year || d.info.ymm.make; }) + "/" + total +
    "  |  Groups: " + count(function (d) { return d.info.groups.length; }) + "/" + total +
    "  |  Engine hrs: " + count(function (d) { return d.info.engineHrs !== null; }) + "/" + total);
  devices.forEach(function (d) {
    const i = d.info;
    const hrs = i.at ? Math.round((Date.now() - new Date(i.at).getTime()) / 36e5) : null;
    Logger.log(d.name + "  |  last report " + (hrs === null ? "unknown" : hrs + " h ago") + "  |  VIN " + (i.vin || "-") +
      "  |  engine " + (i.check.state || "no data") + (i.check.codes.length ? " " + i.check.codes.join(" ") : "") +
      "  |  fuel " + (i.fuel === null ? "-" : i.fuel + "%") + "  |  " + (i.drive || "-") +
      "  |  plate " + (i.plate || "-") + "  |  groups " + (i.groups.join("/") || "-") +
      "  |  engine hrs " + (i.engineHrs === null ? "-" : i.engineHrs));
  });
  // Engine-hour counters and fault-code fields per device, raw, to check against what One Step GPS shows.
  (gpsList_(json) || []).forEach(function (raw) {
    const pt = raw.latest_device_point || {}, st = pt.device_state || {}, dt = pt.device_point_detail || {};
    const counters = (Array.isArray(st.counter_list) ? st.counter_list : []).filter(function (c) { return c && /^eh/.test(String(c.key)); })
      .map(function (c) { return c.key + " " + (typeof c.val === "number" ? Math.round(c.val * 10) / 10 : c.val) + (c.offset ? " (+" + c.offset + ")" : ""); });
    const dtc = ["dtc_list", "vbus_dtc_count", "vbus_calamp_indicators_0", "vbus_calamp_indicators_1", "change_oil_lamp_on", "oil_pressure_lamp_on"]
      .filter(function (k) { return dt[k] !== undefined && dt[k] !== null; }).map(function (k) { return k + "=" + JSON.stringify(dt[k]).slice(0, 40); });
    Logger.log("  " + String(raw.display_name || raw.device_id) + "  |  activated " + String(raw.activated_at || raw.created_at || "?").slice(0, 10) +
      "  |  " + (counters.join(", ") || "no engine-hour counters") + "  |  " + (dtc.join(", ") || "no fault-code fields"));
  });
  const vinDevice = devices.filter(function (d) { return d.info.vin; })[0];
  if (vinDevice) {
    const y = gpsDecodeVin_(vinDevice.info.vin, { vin: 1, address: 0 });
    Logger.log("VIN decode test (" + vinDevice.name + "): " + (y ? gpsYmmText_(y) : "failed"));
  }
  // Every field name the account sends (raw protocol fields left out), with how many devices have a value in it.
  const seen = {};
  (gpsList_(json) || []).forEach(function (raw) {
    gpsPairs_(raw, "", [], 0).forEach(function (p) {
      if (p.value === null || p.value === "" || (Array.isArray(p.value) && !p.value.length)) return;
      const key = p.path.replace(/\[\d+\]/g, "[]");
      if (/\.(display|unit)$/.test(key)) return;
      if (!seen[key]) seen[key] = { n: 0, sample: p.value };
      seen[key].n++;
    });
  });
  const keys = Object.keys(seen).sort();
  Logger.log("Fields sent (" + keys.length + "):");
  for (let k = 0; k < keys.length; k += 6) {
    Logger.log(keys.slice(k, k + 6).map(function (key) {
      const s = seen[key].sample;
      const show = /(^|[._])(lat|lng)$/i.test(key) ? "" : "=" + String(Array.isArray(s) ? "[" + s.length + "]" : typeof s === "object" ? "{}" : s).slice(0, 18);
      return key + " (" + seen[key].n + ")" + show;
    }).join("   "));
  }
}

/** Which odometer to trust for a device: the vehicle computer when it reports one,
 *  otherwise the tracker's own distance, but only if it lines up with the sheet (after Adjust). */
function gpsChooseSource_(d, t, adjust) {
  if (d.odo.vehicle) return SRC_VEHICLE;
  if (!d.odo.tracker) return "";
  if (!t || t.milesNow === null) return "";
  const diff = gpsMiles_(d.odo.tracker, t.milesNow) + (adjust || 0) - t.milesNow;
  return (diff >= -300 && diff <= 3000) ? SRC_TRACKER : "";
}

function gpsReading_(d, source, t, adjust) {
  const c = source === SRC_VEHICLE ? d.odo.vehicle : source === SRC_TRACKER ? d.odo.tracker : null;
  if (!c) return null;
  return Math.round(gpsMiles_(c, t ? t.milesNow : null) + (adjust || 0));
}

/** Reads from One Step GPS. With no url: the device list (finds and remembers how the key is accepted). */
function gpsFetch_(url) {
  const main = !url;
  url = url || GPS_URL;
  const props = PropertiesService.getScriptProperties();
  const key = String(props.getProperty("ONESTEP_API_KEY") || "").trim();
  if (!key) throw new Error("Add your One Step GPS API key first: Project Settings (gear) > Script Properties > Add script property, named ONESTEP_API_KEY.");
  const saved = props.getProperty("GPS_AUTH");
  const modes = saved ? [saved] : main ? ["query", "bearer", "header"] : ["query"];
  const tried = [];
  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    const opts = { muteHttpExceptions: true, followRedirects: true, headers: { Accept: "application/json" } };
    let u = url;
    if (mode === "query") u += (u.indexOf("?") === -1 ? "?" : "&") + "api-key=" + encodeURIComponent(key);
    if (mode === "bearer") opts.headers.Authorization = "Bearer " + key;
    if (mode === "header") opts.headers["x-api-key"] = key;
    const res = UrlFetchApp.fetch(u, opts);
    const code = res.getResponseCode();
    if (code === 429) throw new Error("One Step GPS says too many requests. Wait a few minutes and try again.");
    if (code >= 200 && code < 300) {
      let json = null;
      try { json = JSON.parse(res.getContentText()); } catch (e) { tried.push(mode + " (not JSON)"); continue; }
      if (main && !saved) props.setProperty("GPS_AUTH", mode);
      return { json: json, mode: mode };
    }
    tried.push(mode + " (HTTP " + code + ")");
  }
  if (main && saved) props.deleteProperty("GPS_AUTH");
  throw new Error("One Step GPS didn't accept the request: " + tried.join(", ") + ". Check the API key in Script Properties.");
}

function gpsList_(json) {
  let list = null;
  if (Array.isArray(json)) list = json;
  else if (json && typeof json === "object") {
    ["result_list", "devices", "device_list", "device_group_list", "data", "results", "items"].forEach(function (k) { if (!list && Array.isArray(json[k])) list = json[k]; });
    if (!list) Object.keys(json).forEach(function (k) {
      if (!list && Array.isArray(json[k]) && json[k].length && typeof json[k][0] === "object") list = json[k];
    });
  }
  return (list || []).filter(function (d) { return d && typeof d === "object" && !Array.isArray(d); });
}

function gpsDevices_(json) {
  return gpsList_(json).map(function (d) {
    const info = gpsInfo_(d);
    return {
      id: String(d.device_id || d.id || d.imei || d.factory_id || ""),
      name: String(d.display_name || d.name || d.device_name || d.label || d.device_id || "Unnamed device"),
      odo: gpsOdometer_(d),
      at: info.at,
      info: info
    };
  }).filter(function (d) { return d.id; });
}

function gpsWalk_(obj, path, out, depth) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || depth > 7) return;
  Object.keys(obj).forEach(function (k) {
    const v = obj[k];
    const p = path ? path + "." + k : k;
    out.push({ key: k, path: p, value: v });
    if (v && typeof v === "object" && !Array.isArray(v)) gpsWalk_(v, p, out, depth + 1);
  });
}

function gpsFind_(obj, re) {
  const nodes = [];
  gpsWalk_(obj, "", nodes, 0);
  for (let i = 0; i < nodes.length; i++) {
    if (re.test(nodes[i].key) && (typeof nodes[i].value === "string" || typeof nodes[i].value === "number")) return nodes[i].value;
  }
  return null;
}

/** Every field of a device as {key, path, value}, including name/value lists such as custom fields.
 *  Raw protocol fields (params) and the older "accurate" point are left out. */
function gpsPairs_(obj, path, out, depth) {
  if (!obj || typeof obj !== "object" || depth > 7) return out;
  if (Array.isArray(obj)) {
    obj.slice(0, 30).forEach(function (el, i) {
      if (!el || typeof el !== "object" || Array.isArray(el)) return;
      const name = el.name || el.label || el.field_name || el.title || el.key;
      const hasVal = el.value !== undefined || el.val !== undefined || el.text !== undefined;
      if (typeof name === "string" && hasVal && Object.keys(el).length <= 6) {
        const v = el.value !== undefined ? el.value : el.val !== undefined ? el.val : el.text;
        out.push({ key: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), path: path + "[" + name + "]", value: v, field: true });
      } else gpsPairs_(el, path + "[" + i + "]", out, depth + 1);
    });
    return out;
  }
  Object.keys(obj).forEach(function (k) {
    if (k === "params" || k === "conn_data" || k === "latest_accurate_device_point") return;
    const v = obj[k];
    const p = path ? path + "." + k : k;
    out.push({ key: k, path: p, value: v });
    if (v && typeof v === "object") gpsPairs_(v, p, out, depth + 1);
  });
  return out;
}

/** Everything besides the odometer that the app shows, read from one device record. */
function gpsInfo_(d) {
  const pairs = gpsPairs_(d, "", [], 0);
  const scalar = function (v) { return typeof v === "string" || typeof v === "number" || typeof v === "boolean"; };
  const first = function (re, ok) {
    for (let i = 0; i < pairs.length; i++) if (re.test(pairs[i].key) && (!ok || ok(pairs[i]))) return pairs[i];
    return null;
  };
  const point = d.latest_device_point && typeof d.latest_device_point === "object" ? d.latest_device_point : {};
  const state = point.device_state && typeof point.device_state === "object" ? point.device_state : {};
  const detail = point.device_point_detail && typeof point.device_point_detail === "object" ? point.device_point_detail : {};

  // VIN: only a real 17-character VIN with a correct check digit counts.
  const vinPair = first(/^(vehicle_)?vin(_number|_no)?$/i, function (p) { return typeof p.value === "string" && vinValid_(p.value, true); });
  const vin = vinPair ? normVin_(vinPair.value) : "";

  const plateP = first(/(^|_)(license_?plate|plate|plate_?(no|num|number)|tag_?(no|number)|registration_?(no|number|plate))$/i,
    function (p) { return typeof p.value === "string" && /^[A-Za-z0-9 -]{2,12}$/.test(p.value.trim()); });
  // The device's own "make"/"model" are the tracker hardware (e.g. CalAmp), not the truck.
  const isVehicle = function (p) { return p.field || /vehicle/i.test(p.path) || /^vehicle_/i.test(p.key); };
  const yearP = first(/^(vehicle_)?(model_)?year$/i, function (p) { const y = Number(p.value); return scalar(p.value) && y >= 1980 && y <= 2040; });
  const makeP = first(/^(vehicle_)?make$/i, function (p) { return typeof p.value === "string" && p.value.trim() && isVehicle(p); });
  const modelP = first(/^(vehicle_)?model$/i, function (p) { return typeof p.value === "string" && p.value.trim() && isVehicle(p); });

  // Groups: names when the record has them, otherwise IDs (turned into names later if One Step GPS lists them).
  const groupIds = [], groupNames = [];
  pairs.forEach(function (p) {
    if (!/group/i.test(p.key)) return;
    const vals = Array.isArray(p.value) ? p.value : scalar(p.value) && p.value !== "" && typeof p.value !== "boolean" ? [p.value] : [];
    vals.forEach(function (v) {
      if (v && typeof v === "object") { const nm = v.display_name || v.name || v.title || v.group_name; if (nm) groupNames.push(String(nm)); }
      else if (/id/i.test(p.key)) groupIds.push(String(v));
      else groupNames.push(String(v));
    });
  });

  // Check engine: fault codes, a fault-code count, or a malfunction (MIL) light, from the latest point only.
  const codes = [];
  let known = false, on = false;
  pairs.forEach(function (p) {
    if (!/^latest_device_point\./.test(p.path) && !p.field) return;
    if (/dtc|fault|trouble_code/i.test(p.key) && Array.isArray(p.value)) {
      known = true;
      p.value.forEach(function (el) { const c = gpsCodeText_(el); if (c && codes.indexOf(c) === -1) codes.push(c); });
    } else if (/(dtc|fault)_?(count|num)|num_?(dtc|fault)/i.test(p.key) && typeof p.value === "number") {
      known = true;
      if (p.value > 0) on = true;
    } else if (/(^|_)mil(_on|_status|_lamp|_lamp_on|_light)?$|check_?engine|malfunction|engine_light/i.test(p.key) && scalar(p.value)) {
      known = true;
      if (p.value === true || p.value === 1 || /^(on|true|1|yes)$/i.test(String(p.value))) on = true;
    }
  });
  if (codes.length) on = true;

  // Fuel as a percentage only (a "fuel level" in gallons or liters is skipped).
  const fuelP = first(/^fuel_?(percent|pct|level_percent|level)$/i, function (p) {
    const m = gpsMeasure_(p.value, p.key);
    return m && m.n >= 0 && m.n <= 100 && (!/level$/i.test(p.key) || /%|percent|pct/i.test(String(m.unit || "") + (p.value && p.value.display || "")));
  });
  // Van engine hours, for reference only (never used for TM hours): the truck computer's count first, else One Step GPS's own.
  let engineHrs = null;
  const ehP = first(/^(vbus_)?(total_)?engine_?(run_?)?hours?$|^eng(ine)?_?hrs$/i, function (p) { const m = gpsMeasure_(p.value, p.key); return m && m.n > 0; });
  if (ehP) {
    const m = gpsMeasure_(ehP.value, ehP.key);
    engineHrs = /^s/i.test(m.unit) ? m.n / 3600 : /^min/i.test(m.unit) ? m.n / 60 : m.n;
  } else if (Array.isArray(state.counter_list)) {
    ["eh", "eh_lt", "eh_acc"].some(function (k) {
      const c = state.counter_list.filter(function (x) { return x && x.key === k && typeof x.val === "number"; })[0];
      if (!c) return false;
      engineHrs = c.val + (typeof c.offset === "number" ? c.offset : 0);   // same number One Step GPS shows as "Current engine hours"
      return true;
    });
  }
  if (engineHrs !== null && !(engineHrs > 0 && engineHrs < 200000)) engineHrs = null;
  const drive = String(state.drive_status || "").toLowerCase();
  const driveText = !drive ? "" : /driv|mov/.test(drive) ? "Driving" : /idl/.test(drive) ? "Idling" : /off|stop|park/.test(drive) ? "Parked"
    : (drive.charAt(0).toUpperCase() + drive.slice(1)).replace(/_/g, " ");
  const vbus = gpsMeasure_(detail.vbus_odometer, "vbus_odometer");

  let lat = num_(point.lat), lng = num_(point.lng);
  if ((lat === null || lng === null) && detail.lat_lng) { lat = num_(detail.lat_lng.lat); lng = num_(detail.lat_lng.lng); }
  const acc = d.latest_accurate_device_point;
  if ((lat === null || lng === null) && acc && typeof acc === "object") { lat = num_(acc.lat); lng = num_(acc.lng); }
  if (lat !== null && lng !== null && Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) { lat = null; lng = null; }

  // Last report: the newest time on the latest point.
  let at = null;
  [point.dt_server, point.dt_tracker, detail.transmit_time, detail.gps_time].forEach(function (s) {
    const t = s ? new Date(String(s)) : null;
    if (t && !isNaN(t.getTime()) && (!at || t > at)) at = t;
  });
  if (!at) { const f = gpsFind_(d, /^(dt_tracker|dt_server|updated_at|timestamp|dt)$/i); if (f) { const t = new Date(String(f)); if (!isNaN(t.getTime())) at = t; } }

  const names = groupNames.slice();
  return {
    vin: vin,
    plate: plateP ? String(plateP.value).trim().toUpperCase().slice(0, 20) : "",
    ymm: { year: yearP ? String(Math.round(Number(yearP.value))) : "", make: makeP ? gpsTitle_(makeP.value) : "", model: modelP ? String(modelP.value).trim() : "" },
    groupIds: groupIds, groups: names, division: gpsDivision_(names),
    // "none" = the tracker reads the truck's computer but sends no fault codes; "" = no link to the truck's computer.
    check: { state: on ? "on" : known ? "off" : vbus && vbus.n > 0 ? "none" : "", codes: codes.slice(0, 8) },
    fuel: fuelP ? Math.round(gpsMeasure_(fuelP.value, fuelP.key).n) : null,
    drive: driveText,
    since: state.drive_status_begin_time ? String(state.drive_status_begin_time) : "",
    lat: lat, lng: lng,
    engineHrs: engineHrs === null ? null : Math.round(engineHrs * 10) / 10,
    at: at ? at.toISOString() : "",
    online: typeof d.online === "boolean" ? d.online : null
  };
}

/** Whole days since the last report, or null if it reported within GPS_OFFLINE_HRS. */
function gpsQuietDays_(at) {
  const ms = at ? Date.now() - new Date(at).getTime() : NaN;
  return isFinite(ms) && ms > GPS_OFFLINE_HRS * 36e5 ? Math.floor(ms / 864e5) : null;
}

function gpsCodeText_(el) {
  if (el === null || el === undefined) return "";
  if (typeof el === "string" || typeof el === "number") {
    const s = String(el).trim();
    const m = /\b([PBCU][0-9A-F]{4})\b/i.exec(s);
    return (m ? m[1].toUpperCase() : s).slice(0, 30);
  }
  if (typeof el === "object") {
    const code = el.dtc_code || el.code || el.dtc || el.name || el.id;
    if (code !== undefined && code !== null && code !== "") return gpsCodeText_(code);
    if (el.spn !== undefined) return ("SPN " + el.spn + (el.fmi !== undefined ? " FMI " + el.fmi : "")).slice(0, 30);
  }
  return "";
}

function gpsDivision_(names) {
  const s = names.join(" ");
  const c = /clean/i.test(s), r = /resto/i.test(s);
  return c && !r ? "Cleaning" : r && !c ? "Restoration" : "";
}

function gpsApplyGroups_(d, groups) {
  const names = d.info.groups.slice();
  d.info.groupIds.forEach(function (id) { if (groups.names[id] && names.indexOf(groups.names[id]) === -1) names.push(groups.names[id]); });
  (groups.members[d.id] || []).forEach(function (nm) { if (names.indexOf(nm) === -1) names.push(nm); });
  d.info.groups = names;
  d.info.division = gpsDivision_(names);
}

/** Group names from One Step GPS, if the account offers them. Looked up once and remembered for 6 hours. */
function gpsGroupNames_(probe) {
  const empty = { names: {}, members: {} };
  const cache = CacheService.getScriptCache();
  const hit = cache.get("GPS_GROUPS");
  if (hit && !probe) { try { return JSON.parse(hit); } catch (e) { /* look up again */ } }
  const props = PropertiesService.getScriptProperties();
  const known = props.getProperty("GPS_GROUP_URL");
  if (known === "none" && !probe) return empty;
  const urls = known && known !== "none" ? [known] : GPS_GROUP_URLS;
  for (let i = 0; i < urls.length; i++) {
    let json;
    try { json = gpsFetch_(urls[i]).json; } catch (e) { continue; }
    const map = { names: {}, members: {} };
    gpsList_(json).forEach(function (g) {
      if (g.device_id !== undefined && g.device_group_id === undefined && g.group_id === undefined) return;   // a device, not a group
      const id = String(g.device_group_id || g.group_id || g.id || "");
      const name = String(g.display_name || g.name || g.title || g.group_name || "").trim();
      if (!name) return;
      if (id) map.names[id] = name;
      Object.keys(g).forEach(function (k) {
        if (!/device/i.test(k) || !Array.isArray(g[k])) return;
        g[k].forEach(function (x) {
          const did = x && typeof x === "object" ? String(x.device_id || x.id || "") : String(x);
          if (!did) return;
          (map.members[did] = map.members[did] || []).push(name);
        });
      });
    });
    if (Object.keys(map.names).length || Object.keys(map.members).length) {
      props.setProperty("GPS_GROUP_URL", urls[i]);
      cache.put("GPS_GROUPS", JSON.stringify(map).slice(0, 90000), 21600);
      return map;
    }
  }
  if (!known || probe) props.setProperty("GPS_GROUP_URL", "none");
  return empty;
}

/** Year, make and model from a VIN (US government decoder, free). Each VIN is looked up once and remembered. */
function gpsDecodeVin_(vin, budget) {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty("VIN_" + vin);
  if (saved) { try { return JSON.parse(saved); } catch (e) { return null; } }
  const cache = CacheService.getScriptCache();
  if (cache.get("VINTRY_" + vin) || budget.vin <= 0) return null;
  budget.vin--;
  cache.put("VINTRY_" + vin, "1", 21600);
  try {
    const res = UrlFetchApp.fetch("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/" + vin + "?format=json", { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    const r = (JSON.parse(res.getContentText()).Results || [])[0] || {};
    const out = { year: /^\d{4}$/.test(String(r.ModelYear || "")) ? String(r.ModelYear) : "", make: gpsTitle_(r.Make), model: String(r.Model || "").trim().slice(0, 40) };
    if (!out.year && !out.make) return null;
    props.setProperty("VIN_" + vin, JSON.stringify(out));
    return out;
  } catch (e) { return null; }
}

function gpsYmmText_(y) { return y ? [y.year, y.make, y.model].filter(Boolean).join(" ") : ""; }

function gpsTitle_(s) {
  return String(s || "").trim().toLowerCase().replace(/[a-z]+/g, function (w) {
    return w.length <= 3 && /^(gmc|bmw|ram|mini)$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1);
  }).slice(0, 40);
}

/** Street address for a parked truck. Uses Google's free lookup; at most 10 per sync. */
function gpsAddress_(lat, lng, budget) {
  if (budget.address <= 0) return "";
  budget.address--;
  try {
    const r = Maps.newGeocoder().reverseGeocode(lat, lng);
    const a = r && r.results && r.results[0] ? String(r.results[0].formatted_address || "") : "";
    return a.replace(/, USA$/, "").slice(0, 120);
  } catch (e) { return ""; }
}

function gpsParseCoords_(s) {
  const m = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(String(s || ""));
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

function gpsDistM_(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180;
  const a = Math.pow(Math.sin((lat2 - lat1) * r / 2), 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.pow(Math.sin((lng2 - lng1) * r / 2), 2);
  return 12742000 * Math.asin(Math.sqrt(a));
}

/** Finds the two kinds of odometer One Step GPS can report:
 *  vehicle = read from the truck's computer (e.g. vbus_odometer); tracker = the GPS unit's own distance count (hardware_odometer). */
function gpsOdometer_(d) {
  const nodes = [];
  gpsWalk_(d, "", nodes, 0);
  const vehicle = [], tracker = [];
  nodes.forEach(function (nd) {
    if (!/odo|mileage/i.test(nd.key) || /offset|adjust|display|unit|alert|reminder|service/i.test(nd.key)) return;
    const m = gpsMeasure_(nd.value, nd.key);
    if (!m || !(m.n > 0)) return;
    const c = { path: nd.path, n: m.n, unit: m.unit, rank: (/latest/i.test(nd.path) ? 2 : 0) + (m.unit ? 1 : 0) + (/vbus|obd|ecu|vehicle/i.test(nd.key) ? 4 : 0) };
    if (/hardware|tracker|gps_|tracked|device_odo/i.test(nd.key)) tracker.push(c); else vehicle.push(c);
  });
  const best = function (list) { list.sort(function (a, b) { return b.rank - a.rank; }); return list[0] || null; };
  return { vehicle: best(vehicle), tracker: best(tracker) };
}

function gpsMeasure_(v, key) {
  if (typeof v === "number" && isFinite(v)) return { n: v, unit: gpsUnitFromKey_(key) };
  if (typeof v === "string") {
    const m = /^\s*(-?[\d,]+(?:\.\d+)?)\s*([a-zA-Z]*)/.exec(v);
    return m ? { n: Number(m[1].replace(/,/g, "")), unit: m[2] || gpsUnitFromKey_(key) } : null;
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const unit = String(v.unit || v.units || v.uom || v.unit_name || "");
    const val = v.value !== undefined ? v.value : (v.val !== undefined ? v.val : v.amount);
    if (val !== undefined) { const inner = gpsMeasure_(val, key); if (inner) return { n: inner.n, unit: unit || inner.unit }; }
    if (typeof v.display === "string") return gpsMeasure_(v.display, key);
  }
  return null;
}

function gpsUnitFromKey_(key) {
  const k = String(key).toLowerCase();
  if (/(^|_)(mi|miles?)$/.test(k)) return "mi";
  if (/(^|_)(km|kilometers?|kilometres?)$/.test(k)) return "km";
  if (/(^|_)(m|meters?|metres?)$/.test(k)) return "m";
  return "";
}

/** Converts a GPS odometer reading to miles. With no unit given, picks the reading closest to the sheet's miles. */
function gpsMiles_(c, ref) {
  const u = String(c.unit || "").toLowerCase();
  if (/^mi/.test(u)) return c.n;
  if (/^(km|kilo)/.test(u)) return c.n * 0.621371;
  if (/^(m|meters?|metres?)$/.test(u)) return c.n / 1609.344;
  const opts = [c.n, c.n * 0.621371, c.n / 1609.344];
  if (ref !== null && ref !== undefined && isFinite(ref) && ref > 0) {
    opts.sort(function (a, b) { return Math.abs(a - ref) - Math.abs(b - ref); });
    return opts[0];
  }
  return c.n > 5000000 ? c.n / 1609.344 : c.n;
}

/** Matches a GPS device name to a truck: "VODA 4" first, then the unit name, then a driver who has only one truck. */
function gpsMatch_(name, trucks) {
  const n = String(name).toLowerCase();
  const voda = /voda\s*-?\s*(\d+)/i.exec(name);
  if (voda) {
    const hit = trucks.filter(function (t) { return new RegExp("^voda\\s*" + voda[1] + "$", "i").test(String(t.unit).trim()); })[0];
    if (hit) return hit;
  }
  const byUnit = trucks.filter(function (t) { return t.unit && n.indexOf(String(t.unit).toLowerCase()) !== -1; });
  if (byUnit.length === 1) return byUnit[0];
  const byDriver = trucks.filter(function (t) {
    if (!t.driver) return false;
    const dn = String(t.driver).toLowerCase().replace(/[^a-z]/g, "");
    return dn.length > 2 && new RegExp("\\b" + dn + "\\b").test(n);
  });
  return byDriver.length === 1 ? byDriver[0] : null;
}

/* ---------------- GPS details for the app ---------------- */

/** Adds each truck's GPS details (from the GPS tab, so opening the app never calls One Step GPS) and the sync health. */
function gpsForApp_(trucks) {
  const s = SpreadsheetApp.getActive().getSheetByName("GPS");
  if (!s || s.getLastRow() < 2) return null;
  const width = Math.min(GPS_NCOLS, s.getMaxColumns());
  const rows = s.getRange(2, 1, s.getLastRow() - 1, width).getValues();
  const iso = function (v) { return v instanceof Date ? v.toISOString() : String(v || ""); };
  const now = Date.now();
  trucks.forEach(function (t) {
    const mine = rows.filter(function (r) { return t.unit && String(r[2]) === t.unit; });
    mine.sort(function (a, b) { return (b[3] === true ? 1 : 0) - (a[3] === true ? 1 : 0); });
    const r = mine[0];
    if (!r) return;
    const at = iso(r[7]);
    const atMs = at ? new Date(at).getTime() : NaN;
    const coords = gpsParseCoords_(r[18]);
    const check = String(r[14] || "");
    const vin = String(r[10] || "");
    t.gps = {
      device: String(r[0] || ""),
      syncing: r[3] === true,
      note: String(r[8] || ""),
      at: at,
      offline: isFinite(atMs) && now - atMs > GPS_OFFLINE_HRS * 36e5,
      vin: vin,
      vinMismatch: !!(vin && t.vin && vin !== t.vin),
      ymm: String(r[11] || ""),
      check: /^ON/.test(check) ? "on" : check === "Off" ? "off" : check === "None reported" ? "none" : "",
      codes: /^ON: /.test(check) ? check.slice(4).split(", ") : [],
      fuel: num_(r[15]),
      status: String(r[16] || ""),
      since: iso(r[19]),
      address: String(r[17] || ""),
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null,
      engineHrs: width > 20 ? num_(r[20]) : null
    };
  });
  const p = PropertiesService.getScriptProperties();
  return { lastOk: p.getProperty("GPS_LAST_OK") || "", lastTry: p.getProperty("GPS_LAST_TRY") || "", error: p.getProperty("GPS_LAST_ERROR") || "" };
}
