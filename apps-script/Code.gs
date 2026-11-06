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
 * In the Trucks tab, don't rename or move columns A to AC. You can add your own columns to the right.
 *
 * ONE STEP GPS MILEAGE (optional)
 * 1. Project Settings (gear, left side) > Script Properties > Add script property.
 *    Property: ONESTEP_API_KEY   Value: your One Step GPS API key.   Save script properties.
 * 2. Pick "gpsSetup" in the function menu and click Run. Approve the new permission.
 *    It creates the GPS tab, matches each GPS device to a truck, and pulls the miles every 15 minutes.
 * 3. Check the GPS tab. Fix any truck in column C, and tick "Use GPS miles" for each truck you want synced.
 * To stop the sync: pick "gpsStop" and click Run.
 */

const TRUCK_COLS = ["id", "order", "unit", "driver", "vehicle", "year", "plate",
  "oilInterval", "milesAtOil", "milesNow", "tm", "cdsMilesPerHr", "hrsAtOil",
  "tmOilInterval", "tmOilHrs", "hrsNow", "tier100", "tier400", "tier500", "tier1000", "tier2000",
  "inspectionDue", "registrationDue", "insuranceUntil", "notes", "readingAt", "readingBy", "updatedAt", "division"];
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
    ["Trucks tab: don't rename or move columns A to AC. You can add your own columns to the right.", ""],
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
      case "list":
        return json_({ ok: true, trucks: readTrucks_().map(function (x) { return x.truck; }), serverTime: new Date().toISOString() });
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
  const head = String(sheet.getRange(1, need).getValues()[0][0]);
  if (head === TRUCK_COLS[need - 1]) return;
  if (head.trim() !== "") sheet.insertColumnBefore(need);   // your own column there moves one to the right
  sheet.getRange(1, need).setValue(TRUCK_COLS[need - 1]).setFontWeight("bold");
  sheet.getRange(2, need, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
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
  const limits = { unit: 60, driver: 60, vehicle: 80, year: 10, plate: 20, tm: 10, division: 20,
    inspectionDue: 10, registrationDue: 7, insuranceUntil: 10, notes: 1000, readingAt: 40, readingBy: 60 };
  TRUCK_COLS.forEach(function (c) {
    if (c === "id" || c === "updatedAt" || c.indexOf("tier") === 0) return;
    if (NUM_COLS.indexOf(c) !== -1) { out[c] = num_(t[c]); return; }
    out[c] = t[c] === null || t[c] === undefined ? "" : String(t[c]).slice(0, limits[c] || 100);
  });
  if (TM_KINDS.indexOf(out.tm) === -1) out.tm = "none";
  if (DIVISIONS.indexOf(out.division) === -1) out.division = "";
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

/* ---------------- One Step GPS mileage ---------------- */

const GPS_URL = "https://track.onestepgps.com/v3/api/public/device?latest_point=true";
const GPS_COLS = ["GPS device", "Device ID", "Truck", "Use GPS miles", "Adjust (mi)", "GPS miles", "Sheet miles", "Last GPS update", "Note", "Odometer from"];
const GPS_NCOLS = GPS_COLS.length;
const SRC_VEHICLE = "Vehicle computer";
const SRC_TRACKER = "GPS tracker";
const GPS_MAX_JUMP = 5000;   // a jump bigger than this between syncs is treated as a mistake and not saved

/** Run once to connect (or again any time): matches GPS devices to trucks, builds the GPS tab and starts the 15-minute sync. */
function gpsSetup() {
  const devices = gpsDevices_(gpsFetch_().json);
  Logger.log("Connected to One Step GPS. Devices found: " + devices.length);
  devices.forEach(function (d) {
    const v = d.odo.vehicle, t = d.odo.tracker;
    Logger.log(d.name + "  |  vehicle computer: " + (v ? Math.round(gpsMiles_(v, null)) + " mi" : "none") +
      "  |  GPS tracker: " + (t ? Math.round(gpsMiles_(t, null)) + " mi" : "none"));
  });
  if (!devices.length) throw new Error("Connected, but One Step GPS returned no devices. Send a screenshot of this log to Claude.");

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("GPS") || ss.insertSheet("GPS");
  if (sheet.getMaxColumns() < GPS_NCOLS + 1) sheet.insertColumnsAfter(sheet.getMaxColumns(), GPS_NCOLS + 1 - sheet.getMaxColumns());
  const prev = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, GPS_NCOLS).getValues().forEach(function (row) {
      const id = String(row[1]).trim();
      if (id) prev[id] = { truck: String(row[2] || ""), use: row[3] === true, adjust: num_(row[4]) || 0,
        source: (row[9] === SRC_VEHICLE || row[9] === SRC_TRACKER) ? row[9] : "" };
    });
  }
  const trucks = readTrucks_().map(function (x) { return x.truck; });

  // Auto-match only devices that report an odometer: "VODA n" names first, then unit or driver names.
  const taken = {};
  Object.keys(prev).forEach(function (k) { if (prev[k].truck) taken[prev[k].truck] = true; });
  const auto = {};
  [true, false].forEach(function (vodaPass) {
    devices.forEach(function (d) {
      if (prev[d.id] || auto[d.id] || (!d.odo.vehicle && !d.odo.tracker)) return;
      const hasVoda = /voda\s*-?\s*\d+/i.test(d.name);
      if (vodaPass !== hasVoda) return;
      const m = gpsMatch_(d.name, trucks);
      if (m && !taken[m.unit]) { auto[d.id] = m.unit; taken[m.unit] = true; }
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
      t && t.milesNow !== null ? t.milesNow : "", d.at || "", "", source];
  });

  sheet.clear();
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), GPS_NCOLS).clearDataValidations();
  sheet.getRange(1, 1, 1, GPS_NCOLS).setValues([GPS_COLS]).setFontWeight("bold");
  sheet.setFrozenRows(1);
  if (rows.length) {
    sheet.getRange(2, 2, rows.length, 1).setNumberFormat("@");
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
  Logger.log("GPS setup finished. Check the GPS tab. Miles now update every 15 minutes.");
}

/** Runs every 15 minutes: copies GPS miles into "Miles now" for trucks ticked "Use GPS miles". */
function gpsSync() {
  const sheet = SpreadsheetApp.getActive().getSheetByName("GPS");
  if (!sheet || sheet.getLastRow() < 2) return;
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM d, yyyy h:mm a");
  let devices;
  try { devices = gpsDevices_(gpsFetch_().json); }
  catch (err) { sheet.getRange("L1").setValue("Last sync failed " + stamp + ": " + String(err && err.message ? err.message : err)); return; }
  const byId = {};
  devices.forEach(function (d) { byId[d.id] = d; });
  let updated = 0;
  withLock_(function () {
    if (String(sheet.getRange(1, 10).getValues()[0][0]) !== GPS_COLS[9]) sheet.getRange(1, 10).setValue(GPS_COLS[9]);
    if (/^Last sync/.test(String(sheet.getRange("K1").getValues()[0][0]))) sheet.getRange("K1").setValue("");   // old status spot
    const all = readTrucks_();
    const n = sheet.getLastRow() - 1;
    const vals = sheet.getRange(2, 1, n, GPS_NCOLS).getValues();
    const outFJ = [];
    const claimed = {};
    vals.forEach(function (row) {
      const out = [row[5], row[6], row[7], "", row[9]];   // F, G, H, I (note), J
      outFJ.push(out);
      const id = String(row[1]).trim();
      if (!id) return;
      const d = byId[id];
      if (!d) { out[3] = "Not found in One Step GPS any more."; return; }
      out[2] = d.at || stamp;
      const unit = String(row[2] || "");
      const found = unit ? all.filter(function (x) { return x.truck.unit === unit; })[0] : null;
      const adjust = num_(row[4]) || 0;
      if (!found) {
        const any = d.odo.vehicle || d.odo.tracker;
        out[0] = any ? Math.round(gpsMiles_(d.odo.vehicle || d.odo.tracker, null) + adjust) : "";
        out[1] = "";
        out[3] = any ? "Not used. Pick a truck in column C to use this device." : "No odometer from this device.";
        return;
      }
      const t = found.truck;
      let source = (row[9] === SRC_VEHICLE || row[9] === SRC_TRACKER) ? row[9] : "";
      if (!source) { source = gpsChooseSource_(d, t, adjust); out[4] = source; }
      const gm = gpsReading_(d, source, t, adjust);
      const cur = t.milesNow;
      out[0] = gm === null ? "" : gm;
      out[1] = cur === null ? "" : cur;
      if (!source) { out[3] = "Can't tell which odometer is right. Check the dashboard, put the difference in Adjust, and it will start."; return; }
      if (gm === null) { out[3] = "No " + source.toLowerCase() + " odometer in the latest GPS update (truck may be off). It will try again."; return; }
      if (row[3] !== true) {
        out[3] = "Not syncing. GPS " + gm + " mi, sheet " + (cur === null ? "blank" : cur + " mi") + ". Tick Use GPS miles when GPS matches the dashboard.";
        return;
      }
      if (claimed[t.id]) { out[3] = "Another ticked device already feeds " + t.unit + ". Untick one of them."; return; }
      claimed[t.id] = true;
      if (cur !== null && gm - cur > GPS_MAX_JUMP) { out[3] = "GPS jumped " + (gm - cur) + " mi since the last reading, so it wasn't saved. Check Adjust."; return; }
      if (cur !== null && gm < cur) {
        out[3] = "GPS is " + (cur - gm) + " mi below the sheet. It updates once it passes that. If the dashboard matches GPS, fix Miles now in the Trucks tab.";
        return;
      }
      if (cur === null || gm > cur) {
        t.milesNow = gm;
        t.readingAt = new Date().toISOString();
        t.readingBy = "GPS";
        sheet_("Trucks").getRange(found.rowIndex, 1, 1, TRUCK_COLS.length).setValues([toRow_(t)]);
        out[1] = gm;
        updated++;
      }
      out[3] = "OK";
    });
    // Only columns F to J are written back, so edits to Truck, Use GPS miles and Adjust are never overwritten.
    sheet.getRange(2, 6, n, 5).setValues(outFJ);
  });
  sheet.getRange("L1").setValue("Last sync " + stamp + ": " + updated + " truck" + (updated === 1 ? "" : "s") + " updated.");
}

/** Stops the 15-minute GPS sync. Miles go back to being typed in the app. */
function gpsStop() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "gpsSync") { ScriptApp.deleteTrigger(tr); n++; } });
  Logger.log(n ? "GPS sync stopped." : "GPS sync wasn't running.");
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

function gpsFetch_() {
  const props = PropertiesService.getScriptProperties();
  const key = String(props.getProperty("ONESTEP_API_KEY") || "").trim();
  if (!key) throw new Error("Add your One Step GPS API key first: Project Settings (gear) > Script Properties > Add script property, named ONESTEP_API_KEY.");
  const saved = props.getProperty("GPS_AUTH");
  const modes = saved ? [saved] : ["query", "bearer", "header"];
  const tried = [];
  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    const opts = { muteHttpExceptions: true, followRedirects: true, headers: { Accept: "application/json" } };
    let url = GPS_URL;
    if (mode === "query") url += "&api-key=" + encodeURIComponent(key);
    if (mode === "bearer") opts.headers.Authorization = "Bearer " + key;
    if (mode === "header") opts.headers["x-api-key"] = key;
    const res = UrlFetchApp.fetch(url, opts);
    const code = res.getResponseCode();
    if (code === 429) throw new Error("One Step GPS says too many requests. Wait a few minutes and try again.");
    if (code >= 200 && code < 300) {
      let json = null;
      try { json = JSON.parse(res.getContentText()); } catch (e) { tried.push(mode + " (not JSON)"); continue; }
      if (!saved) props.setProperty("GPS_AUTH", mode);
      return { json: json, mode: mode };
    }
    tried.push(mode + " (HTTP " + code + ")");
  }
  if (saved) props.deleteProperty("GPS_AUTH");
  throw new Error("One Step GPS didn't accept the request: " + tried.join(", ") + ". Check the API key in Script Properties.");
}

function gpsDevices_(json) {
  let list = null;
  if (Array.isArray(json)) list = json;
  else if (json && typeof json === "object") {
    ["result_list", "devices", "device_list", "data", "results", "items"].forEach(function (k) { if (!list && Array.isArray(json[k])) list = json[k]; });
    if (!list) Object.keys(json).forEach(function (k) {
      if (!list && Array.isArray(json[k]) && json[k].length && typeof json[k][0] === "object") list = json[k];
    });
  }
  return (list || []).filter(function (d) { return d && typeof d === "object"; }).map(function (d) {
    const at = gpsFind_(d, /^(dt_tracker|dt_server|updated_at|timestamp|dt)$/i);
    return {
      id: String(d.device_id || d.id || d.imei || d.factory_id || ""),
      name: String(d.display_name || d.name || d.device_name || d.label || d.device_id || "Unnamed device"),
      odo: gpsOdometer_(d),
      at: at ? String(at) : ""
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
