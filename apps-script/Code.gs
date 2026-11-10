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
 * In the Trucks tab, don't rename or move columns A to AI. You can add your own columns to the right.
 *
 * ACCOUNTS
 * Everyone signs in to the app with their own username and passcode (4 to 6 characters, their choice).
 * The very first account is made with the access code on the Setup tab and becomes an Admin.
 * After that, an Admin invites each person from the app (Settings > Users) and gives them a one-time code.
 * Admins can do everything. Technicians see only what an Admin gives them (see WHO SEES WHAT): on trucks they update only
 * TM hours on truckmount trucks; on checklists they add missing items and send them, and see the order list, but can't
 * mark anything ordered or received, change a count, or remove anything already on it.
 * This script refuses anything else from a technician, whatever the app sends.
 * Locked out of the only Admin account? Pick "adminRecovery" in the function menu and click Run: the log shows a
 * one-time code; enter it in the app under "I have a code" to choose a new passcode.
 *
 * SERVICE HISTORY
 * Every service record lives in the Service tab (one row each). The app adds a row whenever an oil change or
 * service is logged, and can add, edit or delete any record. To bring in an old log, import a file whose tab is
 * named "Service import" (File > Import > Insert new sheet). It is merged in automatically the next time the app
 * opens a truck, then renamed "Service import (merged)" so it is kept as a backup and never merged twice.
 *
 * TUESDAY TM HOURS CHECK
 * Every Tuesday the technician enters (or confirms) TM hrs on each truckmount truck. The app shows what's left,
 * flags any truck that was missed, and a truck can be marked "Not available this week".
 * Reminder email (optional): pick "tmCheckEmailSetup" and click Run, then approve the permission.
 * Every morning between 7 and 8 AM: on Tuesday it lists the trucks to check that day; from Wednesday on it lists
 * the trucks still missing that week's TM hrs. Once every truck is done or marked not available, the emails stop
 * until the next Tuesday. It's sent from the Google account that ran the setup, to the
 * Script Property TM_CHECK_EMAIL (one or more addresses, separated by commas), or to that same account if it's
 * not set. To stop it: pick "tmCheckEmailStop" and click Run.
 *
 * PAPERWORK EMAIL (optional)
 * Every Monday between 7 and 8 AM: any truck whose safety inspection or registration is due within a month, or
 * already past due. Nothing is sent when nothing is due. To turn it on: pick "paperworkEmailSetup" and click Run
 * (it sends a test email right away). It's sent from the Google account that ran the setup, to the Script Property
 * PAPERWORK_EMAIL if you add one, otherwise to TM_CHECK_EMAIL, otherwise to that same account.
 * Once a truck is renewed, put the new date in the app (Edit truck) and it drops off the email.
 * To stop it: pick "paperworkEmailStop" and click Run.
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
 * Shop: in the app, open a truck parked at the shop > GPS > "Set as shop". Trucks parked there then show "At shop"
 *  instead of the street address. It's kept in the Script Property SHOP_AT; "Remove shop" in the app clears it.
 *
 * CHECKLISTS (cleaning supplies, products, equipment)
 * The app's Checklists section starts with the paper cleaning products checklist; Admins add more in the app
 * (Checklists > + New checklist) and change any of them (Edit). A technician taps what's missing, sets how many, and sends
 * it. Each item lands on the Supply orders tab as "To order"; an Admin marks it Ordered, then Received. Every check (with
 * any note) is kept on the Supply checks tab. The checklists are on the Checklists tab and their items on the Supplies tab;
 * change them in the app rather than in the sheet. The tabs are made the first time the app opens Checklists.
 * When anyone sends missing items (technicians and admins), an email goes to the Script Property SUPPLY_EMAIL if you add one (for example
 * info@dnaproclean.com; several addresses separated by commas), otherwise to TM_CHECK_EMAIL, otherwise to the Google
 * account that runs this script. Set SUPPLY_EMAIL to off to stop these emails. The subject starts with "For Mike to order"
 * (change it with the Script Property SUPPLY_SUBJECT), then the checklist, how many items, and who sent it.
 * To see one: pick "supplyEmailTest" and click Run.
 *
 * WEEKLY BACKUP (optional, recommended)
 * Pick "backupSetup" and click Run (approve the Google Drive permission). Every Sunday around 2 AM a full copy of this
 * sheet goes into a Drive folder named "VODA Prime backups"; the newest 12 are kept. "backupNow" makes one right away;
 * "backupStop" turns it off. To restore, open a backup and copy what you need back (or use it as the new sheet).
 *
 * MOVING TO ANOTHER GOOGLE ACCOUNT (for example the company Google Workspace account)
 * A copied sheet doesn't bring the script's settings (sign-in key, access code, GPS key, emails) or its automatic jobs,
 * so the move is done in two steps that carry them over. Everyone stays signed in; nothing typed during the move is lost.
 *  1. In this (old) sheet's Apps Script: pick "moveOut" and Run. It saves the settings and the list of automatic jobs in a
 *     tab named "Move settings", stops the jobs, and pauses this copy of the app (phones hold on to anything new).
 *  2. Share the sheet with the new account. Signed in as the new account: open it, File > Make a copy.
 *  3. In the copy: Extensions > Apps Script, pick "moveIn" and Run (approve the permissions). It loads the settings, turns
 *     the same jobs back on, and deletes the "Move settings" tab.
 *  4. Still in the copy: Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone. Put the new web app
 *     URL into config.js in GitHub. Phones switch over the next time the app opens.
 * Changed your mind before step 4? Run "moveCancel" in the old sheet: it un-pauses it and turns its jobs back on.
 *
 * LEADERBOARD (weekly team standings)
 * The app's Leaderboard section ranks the teams the same way the "5. REVENUE PER TRUCK" sheet does, from January 1 of this
 * year: inside Cleaning, inside Restoration and across the company, for the month and the year to date. Admins (or whoever
 * has "Leaderboard numbers" ticked) type each day's numbers in the app, as they did in the old sheets: each truck's jobs,
 * work day, revenue and # of techs, each technician's sales (up sale, add-on, rugs in plant, additional service, jobs) and
 * each day's 5-star reviews (older months may have one total for the month), and set up the teams (unit, and the months each team is on the board). The Leaderboard tab
 * keeps them, one row per month plus "config", in JSON. Don't edit that tab by hand.
 *
 * OFFICE (the office scorecards)
 * The app's Office section replaces "14. OFFICE SCORECARDS": each office person types her own day (her calls, by kind,
 * toward the 50 outgoing calls goal, and her other numbers); Admins set up the people and their numbers, link each one to
 * her login, and type the admin-only numbers (like Scheduled / Completed, checked in the CRM). Everyone with Office ticked
 * sees everyone. The Office tab keeps it, one row per month plus "config", in JSON. Don't edit that tab by hand.
 *
 * WHO SEES WHAT
 * Admins see everything. Each technician sees only what an Admin ticks for him in the app (Settings > Users and invites):
 * Trucks, any of the checklists, Leaderboard (sees the standings), Leaderboard numbers (types the numbers, sets up the
 * teams) and Office (sees the office scorecards and types her own day).
 * Technicians from before this choice keep Trucks only. This script refuses anything a technician isn't given, whatever the
 * app sends.
 */

const TRUCK_COLS = ["id", "order", "unit", "driver", "vehicle", "year", "plate",
  "oilInterval", "milesAtOil", "milesNow", "tm", "cdsMilesPerHr", "hrsAtOil",
  "tmOilInterval", "tmOilHrs", "hrsNow", "tier100", "tier400", "tier500", "tier1000", "tier2000",
  "inspectionDue", "registrationDue", "insuranceUntil", "notes", "readingAt", "readingBy", "updatedAt", "division", "vin", "color", "hrsAt", "hrsBy", "tmSkip", "tier200"];
// Set only by this script, never taken from what the app sends: when TM hrs were last entered by a person, by whom,
// and the Tuesday of a week the truck was marked "not available" for the TM hrs check.
const SERVER_OWNED = ["hrsAt", "hrsBy", "tmSkip"];
const API_VERSION = 30;        // the app warns when the deployed web app is older than it expects
const ADDED_COLS_FROM = 28;   // columns after AB were added later (division, vin, color, hrsAt, hrsBy, tmSkip, tier200); older sheets get them automatically
const CHECK_DAY = 2;          // TM hrs are checked every Tuesday (0 = Sunday)
const APP_URL = "https://mladja85-max.github.io/voda-fleet/";
const DIVISIONS = ["Cleaning", "Restoration"];
const NUM_COLS = ["order", "oilInterval", "milesAtOil", "milesNow", "cdsMilesPerHr", "hrsAtOil",
  "tmOilInterval", "tmOilHrs", "hrsNow", "tier100", "tier400", "tier500", "tier1000", "tier2000", "tier200"];
const TIERS = ["100", "200", "400", "500", "1000", "2000"];   // 200: the Apex 570's engine oil and filter (Sapphire manual)
const TM_KINDS = ["none", "cds", "legend", "apex"];
const LOG_COLS = ["at", "truckId", "unit", "kind", "miles", "hrs", "items", "note", "by", "milesWas", "hrsWas"];   // milesWas/hrsWas (J, K): the numbers before a reading

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
    ["Use this code once in the app (I have a code) to create the first account, which becomes the Admin.", ""],
    ["After that, people join with invite codes from Settings > Users in the app.", ""],
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
  // After moveOut this copy is paused: phones keep their unsent changes and send them to the new home once they reopen.
  if (PropertiesService.getScriptProperties().getProperty("MOVED")) return json_({ ok: false, error: "moved" });
  if (!PropertiesService.getScriptProperties().getProperty("ACCESS_CODE")) return json_({ ok: false, error: "not_set_up" });
  try {
    if (req.action === "signup") return json_(withLock_(function () { return signup_(req); }));
    if (req.action === "login") return json_(withLock_(function () { return login_(req); }));
    const user = authUser_(req.token);
    if (!user) return json_({ ok: false, error: "signed_out" });
    if (ADMIN_ACTIONS.indexOf(req.action) !== -1 && user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
    if (TRUCK_ACTIONS.indexOf(req.action) !== -1 && !canSee_(user, "trucks")) return json_({ ok: false, error: "not_allowed" });
    req.user = user;
    req.by = user.name;   // every change is stamped with the signed-in person, whatever the app sends
    switch (req.action) {
      case "me":
        return json_({ ok: true, user: publicUser_(user) });
      case "changePasscode":
        return json_(withLock_(function () { return changePasscode_(req); }));
      case "users":
        return json_({ ok: true, users: readUsers_(usersSheet_()).map(function (x) { return publicUser_(x.u); }) });
      case "invite":
        return json_(withLock_(function () { return invite_(req); }));
      case "saveUser":
        return json_(withLock_(function () { return saveUser_(req); }));
      case "resetUser":
        return json_(withLock_(function () { return resetUser_(req); }));
      case "setPayroll":
        return json_(withLock_(function () { return setPayroll_(req); }));
      case "list": {
        const seesTrucks = canSee_(user, "trucks");
        const trucks = seesTrucks ? readTrucks_().map(function (x) { return x.truck; }) : [];
        let gps = null;
        if (seesTrucks) { try { gps = gpsForApp_(trucks); } catch (e) { gps = null; } }   // GPS details never stop the list from loading
        let supplies = null;
        try { supplies = suppliesForApp_(false, user); } catch (e) { supplies = null; }   // nor do the checklists
        return json_({ ok: true, trucks: trucks, gps: gps, supplies: supplies, me: publicUser_(user), serverTime: new Date().toISOString() });
      }
      case "saveTruck":
        return json_(withLock_(function () { return saveTruck_(req); }));
      case "deleteTruck":
        return json_(withLock_(function () { return deleteTruck_(req); }));
      case "tmSkip":
        return json_(withLock_(function () { return tmSkip_(req); }));
      case "history":
        return json_({ ok: true, entries: history_(String(req.id || "")) });
      case "services":
        return json_(withLock_(function () { return { ok: true, services: svcList_(String(req.truckId || "")) }; }));
      case "saveService":
        return json_(withLock_(function () { return svcSave_(req); }));
      case "deleteService":
        return json_(withLock_(function () { return svcDelete_(req); }));
      case "setShop":
        return json_(setShop_(req));
      case "supplies":
        return json_({ ok: true, supplies: suppliesForApp_(false, user) });
      case "supplyReport":
        return json_(withLock_(function () { return supplyReport_(req); }));
      case "supplyStatus":
        return json_(withLock_(function () { return supplyStatus_(req); }));
      case "saveChecklist":
        return json_(withLock_(function () { return saveChecklist_(req); }));
      case "deleteChecklist":
        return json_(withLock_(function () { return deleteChecklist_(req); }));
      case "mergeChecklist":
        return json_(withLock_(function () { return mergeChecklist_(req); }));
      case "leaderboard":
        if (!canLb_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(lbRead_(user, req.year));
      case "lbPut":
        if (!canLbEdit_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return lbPut_(req); }));
      case "jobLog":
        if (!canLbEdit_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(jobLog_(req));
      case "office":
        if (!canSee_(user, "office")) return json_({ ok: false, error: "not_allowed" });
        return json_(ofRead_(user, req.year));
      case "payRead":
        if (!canPay_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(payRead_());
      case "payPut":
        if (!canPay_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return payPut_(req); }));
      case "ofPut":
        if (!canSee_(user, "office")) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return ofPut_(req); }));
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
  const all = readTrucks_();
  const found = all.filter(function (x) { return x.truck.id === id; })[0];
  const base = req.base || null;
  if (found && found.truck.updatedAt !== base) return { ok: false, error: "conflict", truck: found.truck };
  if (!found && base) return { ok: false, error: "gone" };
  if (req.user && req.user.role !== "admin") return techSaveHours_(req, found);
  const t = clean_(req.truck);
  t.id = id;
  const clash = all.filter(function (x) { return x.truck.id !== id && unitKey_(x.truck.unit) === unitKey_(t.unit) && unitKey_(t.unit) !== ""; })[0];
  if (clash) return { ok: false, error: "duplicate_unit", unit: clash.truck.unit };
  t.updatedAt = new Date().toISOString();
  // If One Step GPS has already moved this truck's miles forward, an app save never pulls them back.
  if (found && found.truck.readingBy === "GPS" && num_(found.truck.milesNow) !== null &&
      (t.milesNow === null || t.milesNow < found.truck.milesNow)) {
    t.milesNow = found.truck.milesNow;
  }
  if (t.readingAt === "now") t.readingAt = t.updatedAt;
  // A new reading carries the signed-in person's name (GPS keeps its own label).
  if (req.by && t.readingBy !== "GPS" && (!found || t.readingAt !== found.truck.readingAt)) t.readingBy = String(req.by).slice(0, 60);
  SERVER_OWNED.forEach(function (c) { t[c] = found ? found.truck[c] || "" : ""; });
  // TM hrs count as checked when they changed, or when someone confirmed the same number.
  const hrsChanged = t.hrsNow !== null && (!found || t.hrsNow !== found.truck.hrsNow);
  const confirmed = req.log && req.log.hrsChecked === true && t.hrsNow !== null;
  if (TM_KINDS.indexOf(t.tm) > 0 && (hrsChanged || confirmed)) { t.hrsAt = t.updatedAt; t.hrsBy = String(req.by || "").slice(0, 60); }
  const row = toRow_(t);
  const sheet = sheet_("Trucks");
  if (found) sheet.getRange(found.rowIndex, 1, 1, TRUCK_COLS.length).setValues([row]);
  else sheet.getRange(Math.max(sheet.getLastRow(), 1) + 1, 1, 1, TRUCK_COLS.length).setValues([row]);
  if (found && found.truck.unit !== t.unit) { gpsRenameTruck_(found.truck.unit, t.unit); svcRenameTruck_(id, t.unit); }
  if (req.log && typeof req.log === "object")
    appendLog_(t, req.log.kind === "reading" ? readingLog_(found ? found.truck : null, t, req.log.hrsChecked === true, req.log.note) : req.log, req.by);
  let service = null;
  if (req.log && req.log.kind === "service") service = svcFromLog_(t, req.log, req.by);   // logged services go in the service history too
  return { ok: true, truck: fromRow_(row), service: service };
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
  const width = Math.min(LOG_COLS.length, sheet.getMaxColumns());
  const values = sheet.getRange(2, 1, last - 1, width).getValues();
  const out = [];
  for (let i = values.length - 1; i >= 0 && out.length < 15; i--) {
    const r = values[i];
    if (String(r[1]) !== id) continue;
    out.push({
      at: r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), "MMM d, yyyy h:mm a") : String(r[0]),
      kind: String(r[3]), miles: num_(r[4]), hrs: num_(r[5]),
      items: r[6] ? String(r[6]).split(", ") : [], note: String(r[7] || ""), by: String(r[8] || ""),
      milesWas: width > 9 ? num_(r[9]) : null, hrsWas: width > 10 ? num_(r[10]) : null
    });
  }
  return out;
}

function appendLog_(t, log, by) {
  const sheet = sheet_("Log");
  logCols_(sheet);
  const items = Array.isArray(log.items) ? log.items.map(String).join(", ").slice(0, 300) : "";
  const at = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM d, yyyy h:mm a");
  const n = function (v) { return num_(v) === null ? "" : num_(v); };
  appendRows_(sheet, LOG_COLS.length, [[
    at, t.id, String(t.unit || ""), String(log.kind || "").slice(0, 20), n(log.miles), n(log.hrs),
    items, String(log.note || "").slice(0, 500), String(by || "").slice(0, 60), n(log.milesWas), n(log.hrsWas)
  ]]);
}

/** Older Log tabs end at "by" (I): adds the milesWas / hrsWas headings (J, K) once. */
function logCols_(sheet) {
  const need = LOG_COLS.length;
  if (sheet.getMaxColumns() < need) sheet.insertColumnsAfter(sheet.getMaxColumns(), need - sheet.getMaxColumns());
  if (String(sheet.getRange(1, need).getValues()[0][0]) === LOG_COLS[need - 1]) return;
  sheet.getRange(1, 10, 1, need - 9).setValues([LOG_COLS.slice(9)]).setFontWeight("bold");
}

/** A reading in the Log: the numbers as saved (after any GPS miles), what they were before, and what changed in words. */
function readingLog_(before, t, confirmed, note) {
  const tm = TM_KINDS.indexOf(t.tm) > 0;
  const miles = num_(t.milesNow), hrs = tm ? num_(t.hrsNow) : null;
  const milesWas = before ? num_(before.milesNow) : null, hrsWas = before && tm ? num_(before.hrsNow) : null;
  const items = [];
  if (hrs !== null && hrs !== hrsWas) items.push(hrsWas === null ? "TM hrs set to " + fmtNum_(hrs) : "TM hrs " + fmtNum_(hrsWas) + " → " + fmtNum_(hrs));
  else if (hrs !== null && confirmed) items.push("TM hrs confirmed at " + fmtNum_(hrs) + " (no change)");
  if (miles !== null && miles !== milesWas) items.push(milesWas === null ? "Miles set to " + fmtNum_(miles) : "Miles " + fmtNum_(milesWas) + " → " + fmtNum_(miles));
  if (!items.length) items.push("No change");
  return { kind: "reading", miles: miles, hrs: hrs, milesWas: milesWas, hrsWas: hrsWas, items: items, note: note || "" };
}

/** 2756 -> "2,756"; 1495.5 -> "1,495.5". */
function fmtNum_(n) {
  const p = String(Math.round(n * 10) / 10).split(".");
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return p.join(".");
}

/** Adds rows under the last one, growing the tab first when it's full (a new tab only has 1,000 rows). */
function appendRows_(sheet, width, rows) {
  if (!rows.length) return;
  const start = Math.max(sheet.getLastRow(), 1) + 1;
  const need = start + rows.length - 1;
  if (sheet.getMaxRows() < need) sheet.insertRowsAfter(sheet.getMaxRows(), need - sheet.getMaxRows() + 200);
  sheet.getRange(start, 1, rows.length, width).setValues(rows);
}

/* ---------------- accounts ---------------- */

const USER_CACHE_SEC = 300;
const USER_COLS = ["id", "username", "name", "role", "status", "salt", "hash", "ver", "inviteHash", "inviteUntil", "created", "lastLogin", "access"];
const ROLES = ["admin", "tech"];
const ADMIN_ACTIONS = ["deleteTruck", "saveService", "deleteService", "users", "invite", "saveUser", "resetUser", "setPayroll", "setShop",
  "supplyStatus", "saveChecklist", "deleteChecklist", "mergeChecklist"];
const TRUCK_ACTIONS = ["saveTruck", "tmSkip", "history", "services"];   // technicians need Trucks ticked for these
const SESSION_DAYS = 90;     // stays signed in on a phone this long
const INVITE_DAYS = 14;      // an invite or reset code works this long
const MAX_TRIES = 5;         // wrong passcodes in a row before a lock
const LOCK_MIN = 15;         // how long the lock lasts

function usersSheet_() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName("Users");
  if (!s) {
    s = ss.insertSheet("Users");
    if (s.getMaxColumns() < USER_COLS.length) s.insertColumnsAfter(s.getMaxColumns(), USER_COLS.length - s.getMaxColumns());
    s.getRange(1, 1, 1, USER_COLS.length).setValues([USER_COLS]).setFontWeight("bold");
    s.getRange(2, 1, Math.max(s.getMaxRows() - 1, 1), USER_COLS.length).setNumberFormat("@");
    s.setFrozenRows(1);
  } else if (String(s.getRange(1, USER_COLS.length).getValue()) !== USER_COLS[USER_COLS.length - 1]) {
    // Users tabs from before "who sees what" end at lastLogin: add the access heading (column M) once.
    if (s.getMaxColumns() < USER_COLS.length) s.insertColumnsAfter(s.getMaxColumns(), USER_COLS.length - s.getMaxColumns());
    s.getRange(1, USER_COLS.length).setValue(USER_COLS[USER_COLS.length - 1]).setFontWeight("bold");
    s.getRange(2, USER_COLS.length, Math.max(s.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  }
  return s;
}

function readUsers_(s) {
  const last = s.getLastRow();
  if (last < 2) return [];
  return s.getRange(2, 1, last - 1, USER_COLS.length).getValues().map(function (r, i) {
    const u = {};
    USER_COLS.forEach(function (c, k) { u[c] = isDate_(r[k]) ? r[k].toISOString() : String(r[k] === null || r[k] === undefined ? "" : r[k]); });
    u.ver = Number(u.ver) || 1;
    return { rowIndex: i + 2, u: u };
  }).filter(function (x) { return x.u.id; });
}

function writeUser_(s, rowIndex, u) {
  forgetUser_(u.id);
  const row = USER_COLS.map(function (c) { return u[c] === null || u[c] === undefined ? "" : String(u[c]); });
  if (rowIndex) s.getRange(rowIndex, 1, 1, USER_COLS.length).setValues([row]);
  else appendRows_(s, USER_COLS.length, [row]);
}

function publicUser_(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role, status: u.status, access: parseAccess_(u.access),
    created: u.created, lastLogin: u.lastLogin, inviteUntil: u.status === "invited" || u.inviteHash ? u.inviteUntil : "" };
}

function secret_() {
  const p = PropertiesService.getScriptProperties();
  let k = p.getProperty("SESSION_SECRET");
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); p.setProperty("SESSION_SECRET", k); }
  return k;
}

/** Passcodes are stored only as a salted, keyed hash (the key lives in Script Properties, not in the sheet). */
function hashPass_(salt, pass) {
  const key = secret_();
  let h = String(salt) + "|" + String(pass);
  for (let i = 0; i < 300; i++) h = Utilities.base64Encode(Utilities.computeHmacSha256Signature(h, key));
  return h;
}

function sign_(payload) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret_())).replace(/=+$/, "");
}

function makeToken_(u) {
  const payload = [u.id, u.ver, Date.now() + SESSION_DAYS * 864e5].join(".");
  return payload + "." + sign_(payload);
}

/** The signed-in person for a token, or null. Their role and status are read fresh every time. */
function authUser_(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 4) return null;
  const payload = parts.slice(0, 3).join(".");
  if (sign_(payload) !== parts[3] || !(Number(parts[2]) > Date.now())) return null;
  // The account is looked up in a short-lived cache so each save doesn't have to read the Users tab.
  // Any change made through the app clears it right away; a hand edit in the sheet shows within a few minutes.
  const cache = CacheService.getScriptCache();
  let u = null;
  try { u = JSON.parse(cache.get("user_" + parts[0]) || "null"); } catch (e) { u = null; }
  if (!u) {
    const x = readUsers_(usersSheet_()).filter(function (y) { return y.u.id === parts[0]; })[0];
    if (!x) return null;
    u = { id: x.u.id, username: x.u.username, name: x.u.name, role: x.u.role, status: x.u.status, ver: x.u.ver,
      inviteHash: x.u.inviteHash ? "1" : "", inviteUntil: x.u.inviteUntil, created: x.u.created, lastLogin: x.u.lastLogin, access: x.u.access };
    try { cache.put("user_" + u.id, JSON.stringify(u), USER_CACHE_SEC); } catch (e) { /* the cache is only a speed-up */ }
  }
  if (u.status !== "active" || String(u.ver) !== parts[1] || ROLES.indexOf(u.role) === -1) return null;
  return u;
}
function forgetUser_(id) {
  try { CacheService.getScriptCache().remove("user_" + id); } catch (e) { /* the cache is only a speed-up */ }
}

function checkName_(req) {
  const username = String(req.username || "").trim().toLowerCase();
  const name = String(req.name || "").trim().replace(/\s+/g, " ");
  const pass = String(req.passcode === undefined || req.passcode === null ? "" : req.passcode);
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return { error: "bad_username" };
  if (!name || name.length > 40) return { error: "bad_name" };
  if (pass.length < 4 || pass.length > 6 || /^\s|\s$/.test(pass)) return { error: "bad_passcode" };
  return { username: username, name: name, pass: pass };
}

function tooManyTries_(key) { return Number(CacheService.getScriptCache().get(key) || 0) >= MAX_TRIES; }
function failedTry_(key) {
  const c = CacheService.getScriptCache();
  c.put(key, String(Number(c.get(key) || 0) + 1), LOCK_MIN * 60);
}

/** Create an account with a code: the Setup tab's access code (first account only, becomes Admin), an invite, or a reset. */
function signup_(req) {
  if (tooManyTries_("fail_code")) return { ok: false, error: "locked" };
  const s = usersSheet_();
  const users = readUsers_(s);
  const code = normCode_(req.invite);
  const now = new Date();
  let target = null;
  if (!users.some(function (x) { return x.u.hash; })) {
    const saved = PropertiesService.getScriptProperties().getProperty("ACCESS_CODE");
    if (!code || code !== normCode_(saved)) { failedTry_("fail_code"); return { ok: false, error: "bad_invite" }; }
  } else {
    const h = code ? hashPass_("invite", code) : "";
    target = users.filter(function (x) { return h && x.u.inviteHash === h; })[0];
    if (!target || !(new Date(target.u.inviteUntil) > now)) { failedTry_("fail_code"); return { ok: false, error: "bad_invite" }; }
    if (target.u.status === "disabled") return { ok: false, error: "bad_invite" };
  }
  const c = checkName_(req);
  if (c.error) return { ok: false, error: c.error };
  const clash = users.filter(function (x) { return x.u.username === c.username && (!target || x.u.id !== target.u.id); })[0];
  if (clash) return { ok: false, error: "taken" };
  const u = target ? target.u : { id: "u-" + Utilities.getUuid().replace(/-/g, "").slice(0, 10), role: "admin", ver: 0, created: now.toISOString() };
  u.username = c.username;
  u.name = c.name;
  u.salt = Utilities.getUuid();
  u.hash = hashPass_(u.salt, c.pass);
  u.ver = (Number(u.ver) || 0) + 1;     // any older sessions stop working
  u.status = "active";
  u.inviteHash = "";
  u.inviteUntil = "";
  u.lastLogin = now.toISOString();
  writeUser_(s, target ? target.rowIndex : 0, u);
  return { ok: true, token: makeToken_(u), user: publicUser_(u) };
}

function login_(req) {
  const username = String(req.username || "").trim().toLowerCase();
  const key = "fail_" + username;
  if (tooManyTries_(key)) return { ok: false, error: "locked" };
  const s = usersSheet_();
  const x = readUsers_(s).filter(function (y) { return y.u.username === username && y.u.hash; })[0];
  if (!x || x.u.hash !== hashPass_(x.u.salt, String(req.passcode === undefined ? "" : req.passcode))) {
    failedTry_(key);
    return { ok: false, error: tooManyTries_(key) ? "locked" : "bad_login" };
  }
  if (x.u.status !== "active") return { ok: false, error: "disabled" };
  CacheService.getScriptCache().remove(key);
  x.u.lastLogin = new Date().toISOString();
  writeUser_(s, x.rowIndex, x.u);
  return { ok: true, token: makeToken_(x.u), user: publicUser_(x.u) };
}

function changePasscode_(req) {
  const s = usersSheet_();
  const x = readUsers_(s).filter(function (y) { return y.u.id === req.user.id; })[0];
  const key = "fail_" + x.u.username;
  if (tooManyTries_(key)) return { ok: false, error: "locked" };
  if (x.u.hash !== hashPass_(x.u.salt, String(req.old === undefined ? "" : req.old))) { failedTry_(key); return { ok: false, error: "bad_login" }; }
  const c = checkName_({ username: x.u.username, name: x.u.name, passcode: req.passcode });
  if (c.error) return { ok: false, error: c.error };
  x.u.salt = Utilities.getUuid();
  x.u.hash = hashPass_(x.u.salt, c.pass);
  x.u.ver = Number(x.u.ver) + 1;        // signs out this account's other phones
  writeUser_(s, x.rowIndex, x.u);
  return { ok: true, token: makeToken_(x.u), user: publicUser_(x.u) };
}

function newInvite_(u) {
  const code = newCode_();
  u.inviteHash = hashPass_("invite", normCode_(code));
  u.inviteUntil = new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
  return code;
}

/** Admin: make a one-time code for a new person (Technician unless chosen otherwise). */
function invite_(req) {
  const name = String(req.name || "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 40) return { ok: false, error: "bad_name" };
  const s = usersSheet_();
  const access = req.access === undefined ? ACCESS_DEFAULT.slice() : cleanAccess_(req.access);
  if (!access) return { ok: false, error: "bad_request" };
  const u = { id: "u-" + Utilities.getUuid().replace(/-/g, "").slice(0, 10), username: "", name: name,
    role: req.role === "admin" ? "admin" : "tech", status: "invited", salt: "", hash: "", ver: 1, created: new Date().toISOString(), lastLogin: "",
    access: accessText_(access) };
  const code = newInvite_(u);
  writeUser_(s, 0, u);
  return { ok: true, code: code, user: publicUser_(u) };
}

/** Admin: change someone's role, turn an account off or on, or cancel an unused invite. Never your own account. */
function saveUser_(req) {
  const s = usersSheet_();
  const all = readUsers_(s);
  const x = all.filter(function (y) { return y.u.id === String(req.id || ""); })[0];
  if (!x) return { ok: false, error: "gone" };
  if (x.u.id === req.user.id) return { ok: false, error: "self" };
  if (req.remove) {
    if (x.u.status !== "invited") return { ok: false, error: "bad_request" };
    s.deleteRow(x.rowIndex);
    forgetUser_(x.u.id);
    return { ok: true };
  }
  const role = req.role === undefined ? x.u.role : req.role;
  const status = req.status === undefined ? x.u.status : req.status;
  if (ROLES.indexOf(role) === -1 || ["active", "disabled", "invited"].indexOf(status) === -1) return { ok: false, error: "bad_request" };
  if (status === "invited" && x.u.status !== "invited") return { ok: false, error: "bad_request" };
  if (req.access !== undefined) {
    // What a technician sees: takes effect on his phone at the next refresh; he stays signed in.
    const access = cleanAccess_(req.access);
    if (!access) return { ok: false, error: "bad_request" };
    if (accessText_(access) !== accessText_(parseAccess_(x.u.access))) { x.u.access = accessText_(access); writeUser_(s, x.rowIndex, x.u); }
  }
  if (x.u.role !== role || x.u.status !== status) {
    x.u.role = role;
    x.u.status = status;
    x.u.ver = Number(x.u.ver) + 1;      // takes effect on their phone straight away
    writeUser_(s, x.rowIndex, x.u);
  }
  return { ok: true, user: publicUser_(x.u) };
}

/** Admin: Payroll on or off for an admin ({ id, on }). Only an admin who sees Payroll can switch it, for himself or
 *  another admin; while no admin sees it yet, any admin can switch it on (the first time). Nobody switches himself off,
 *  so there's always someone who can. Technicians never see Payroll. */
function setPayroll_(req) {
  const s = usersSheet_();
  const all = readUsers_(s);
  const x = all.filter(function (y) { return y.u.id === String(req.id || ""); })[0];
  if (!x) return { ok: false, error: "gone" };
  if (x.u.role !== "admin") return { ok: false, error: "bad_request" };
  const has = function (u) { return u.role === "admin" && u.status === "active" && parseAccess_(u.access).indexOf(PAYROLL) !== -1; };
  const anyone = all.some(function (y) { return has(y.u); });
  const me = all.filter(function (y) { return y.u.id === req.user.id; })[0];
  if (anyone ? !(me && has(me.u)) : !req.on) return { ok: false, error: "not_allowed" };
  if (!req.on && x.u.id === req.user.id) return { ok: false, error: "self" };
  const access = parseAccess_(x.u.access).filter(function (a) { return a !== PAYROLL; });
  if (req.on) access.push(PAYROLL);
  if (accessText_(access) !== accessText_(parseAccess_(x.u.access))) { x.u.access = accessText_(access); writeUser_(s, x.rowIndex, x.u); }
  return { ok: true, user: publicUser_(x.u) };
}

/** Admin: a new one-time code so someone can choose a new passcode (or a fresh invite if the old one ran out). */
function resetUser_(req) {
  const s = usersSheet_();
  const x = readUsers_(s).filter(function (y) { return y.u.id === String(req.id || ""); })[0];
  if (!x) return { ok: false, error: "gone" };
  if (x.u.status === "disabled") return { ok: false, error: "bad_request" };
  const code = newInvite_(x.u);
  writeUser_(s, x.rowIndex, x.u);
  return { ok: true, code: code, user: publicUser_(x.u) };
}

/** Run from the Apps Script editor if no Admin can sign in: logs a one-time code for each Admin. */
function adminRecovery() {
  const s = usersSheet_();
  const admins = readUsers_(s).filter(function (x) { return x.u.role === "admin" && x.u.status === "active"; });
  if (!admins.length) { Logger.log("No Admin accounts yet. Use the access code on the Setup tab in the app to create the first one."); return; }
  admins.forEach(function (x) {
    const code = newInvite_(x.u);
    writeUser_(s, x.rowIndex, x.u);
    Logger.log(x.u.name + " (" + x.u.username + "): " + code + "  (enter it in the app under I have a code; works for " + INVITE_DAYS + " days)");
  });
}

/** Technicians: only TM hours, only on truckmount trucks, only upward. Everything else on the truck stays as it is. */
function techSaveHours_(req, found) {
  if (!found) return { ok: false, error: "not_allowed" };
  if (req.log && req.log.kind !== "reading") return { ok: false, error: "not_allowed" };
  const cur = found.truck;
  if (TM_KINDS.indexOf(cur.tm) < 1) return { ok: false, error: "not_allowed" };
  const hrs = num_(req.truck.hrsNow);
  if (hrs === null || hrs < 0) return { ok: false, error: "bad_request" };
  if (cur.hrsNow !== null && hrs < cur.hrsNow) return { ok: false, error: "hrs_lower", hrs: cur.hrsNow };
  if (cur.hrsNow !== null && hrs - cur.hrsNow > 2000) return { ok: false, error: "hrs_jump", hrs: cur.hrsNow };
  const t = JSON.parse(JSON.stringify(cur));
  t.hrsNow = hrs;
  t.updatedAt = new Date().toISOString();
  t.readingAt = t.updatedAt;
  t.readingBy = String(req.by || "").slice(0, 60);
  t.hrsAt = t.updatedAt;
  t.hrsBy = t.readingBy;
  const row = toRow_(t);
  sheet_("Trucks").getRange(found.rowIndex, 1, 1, TRUCK_COLS.length).setValues([row]);
  appendLog_(t, readingLog_(cur, t, true), req.by);
  return { ok: true, truck: fromRow_(row) };
}

/* ---------------- Service history ---------------- */

const SVC_SHEET = "Service";
const SVC_IMPORT = "Service import";
const SVC_COLS = ["id", "truckId", "truck", "date", "type", "what", "miles", "tmHrs", "shop", "cost", "payment", "check", "source", "updatedAt", "by"];
const SVC_NUM = ["miles", "tmHrs", "cost"];
const SVC_TYPES = ["Oil change", "TM service", "TM repair", "Tires", "Brakes", "Inspection", "Repair", "Other"];

/** The Service tab, made the first time it's needed. Any "Service import" tab is merged in here. */
function svcSheet_() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(SVC_SHEET);
  if (!s) {
    s = ss.insertSheet(SVC_SHEET);
    if (s.getMaxColumns() < SVC_COLS.length) s.insertColumnsAfter(s.getMaxColumns(), SVC_COLS.length - s.getMaxColumns());
    s.getRange(1, 1, 1, SVC_COLS.length).setValues([SVC_COLS]).setFontWeight("bold");
    s.setFrozenRows(1);
    SVC_COLS.forEach(function (c, i) {
      if (SVC_NUM.indexOf(c) === -1) s.getRange(2, i + 1, Math.max(s.getMaxRows() - 1, 1), 1).setNumberFormat("@");
    });
  }
  svcMergeImport_(s);
  return s;
}

function svcMergeImport_(s) {
  const ss = SpreadsheetApp.getActive();
  const imp = ss.getSheetByName(SVC_IMPORT);
  if (!imp || imp.getLastRow() < 2 || imp.getLastColumn() < 2) return 0;
  const head = imp.getRange(1, 1, 1, imp.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  const at = {};
  head.forEach(function (h, i) { if (h) at[h] = i; });
  if (at.truckId === undefined || at.what === undefined) return 0;   // not a service import file
  const have = {};
  svcRead_(s).forEach(function (x) { have[x.rec.id] = true; });
  const names = {};
  readTrucks_().forEach(function (x) { names[x.truck.id] = x.truck.unit; });
  const now = new Date().toISOString();
  const add = [];
  imp.getRange(2, 1, imp.getLastRow() - 1, head.length).getValues().forEach(function (r) {
    const raw = {};
    SVC_COLS.forEach(function (c) { raw[c] = at[c] === undefined ? "" : r[at[c]]; });
    if (!String(raw.truckId).trim() || (!String(raw.what).trim() && !raw.date)) return;
    const rec = svcClean_(raw);
    if (have[rec.id]) return;
    rec.truck = names[rec.truckId] || String(raw.truck || "").slice(0, 60);
    rec.check = String(raw.check || "").slice(0, 400);
    rec.source = String(raw.source || "Import").slice(0, 30);
    rec.updatedAt = now;
    rec.by = String(raw.by || "Import").slice(0, 60);
    have[rec.id] = true;
    add.push(svcRow_(rec));
  });
  appendRows_(s, SVC_COLS.length, add);
  let name = SVC_IMPORT + " (merged)";
  for (let n = 2; ss.getSheetByName(name); n++) name = SVC_IMPORT + " (merged " + n + ")";
  imp.setName(name);   // kept as a backup; the new name means it's never merged twice
  return add.length;
}

function svcRead_(s) {
  const last = s.getLastRow();
  if (last < 2) return [];
  return s.getRange(2, 1, last - 1, SVC_COLS.length).getValues().map(function (r, i) {
    return { rowIndex: i + 2, rec: svcFromRow_(r) };
  }).filter(function (x) { return x.rec.id; });
}

function svcFromRow_(r) {
  const tz = Session.getScriptTimeZone();
  const o = {};
  SVC_COLS.forEach(function (c, i) {
    let v = r[i];
    if (SVC_NUM.indexOf(c) !== -1) { o[c] = num_(v); return; }
    if (isDate_(v)) v = c === "date" ? Utilities.formatDate(v, tz, "yyyy-MM-dd") : v.toISOString();
    o[c] = v === null || v === undefined ? "" : String(v);
  });
  return o;
}

function svcRow_(o) {
  return SVC_COLS.map(function (c) {
    if (SVC_NUM.indexOf(c) !== -1) { const n = num_(o[c]); return n === null ? "" : n; }
    return o[c] === null || o[c] === undefined ? "" : String(o[c]);
  });
}

/** Tidies a record: known types only, a real date or none, numbers as numbers, sensible lengths. */
function svcClean_(raw) {
  const tz = Session.getScriptTimeZone();
  let date = isDate_(raw.date) ? Utilities.formatDate(raw.date, tz, "yyyy-MM-dd") : String(raw.date || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = "";
  const types = String(raw.type || "").split(/\s*,\s*/).map(function (x) {
    return SVC_TYPES.filter(function (k) { return k.toLowerCase() === x.toLowerCase(); })[0];
  }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  const id = String(raw.id || "").trim();
  return {
    id: /^[A-Za-z0-9-]{3,40}$/.test(id) ? id : svcNewId_(),
    truckId: String(raw.truckId || "").trim().slice(0, 60),
    truck: String(raw.truck || "").slice(0, 60),
    date: date,
    type: (types.length ? types : ["Other"]).join(", "),
    what: String(raw.what || "").trim().slice(0, 2000),
    miles: num_(raw.miles), tmHrs: num_(raw.tmHrs), cost: num_(raw.cost),
    shop: String(raw.shop || "").trim().slice(0, 60),
    payment: String(raw.payment || "").trim().slice(0, 300),
    check: "", source: "", updatedAt: "", by: ""
  };
}

function isDate_(v) { return Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime()); }
function svcNewId_() { return "s-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12); }

function svcList_(truckId) {
  return svcRead_(svcSheet_()).map(function (x) { return x.rec; })
    .filter(function (r) { return !truckId || r.truckId === truckId; });
}

function svcSave_(req) {
  const body = req.service;
  if (!body || typeof body !== "object") return { ok: false, error: "bad_request" };
  const s = svcSheet_();
  const all = svcRead_(s);
  const found = body.id ? all.filter(function (x) { return x.rec.id === String(body.id); })[0] : null;
  if (found && found.rec.updatedAt !== (req.base || "")) return { ok: false, error: "conflict", service: found.rec };
  if (!found && req.base) return { ok: false, error: "gone" };
  const truck = readTrucks_().filter(function (x) { return x.truck.id === String(body.truckId || ""); })[0];
  if (!truck) return { ok: false, error: "bad_request" };
  const rec = svcClean_(body);
  if (!rec.what && !rec.date) return { ok: false, error: "bad_request" };
  if (found) rec.id = found.rec.id;
  rec.truck = truck.truck.unit;
  rec.check = "";   // saving from the app means someone has looked at it
  rec.source = found ? found.rec.source || "App" : "App";
  rec.updatedAt = new Date().toISOString();
  rec.by = String(req.by || "").slice(0, 60);
  if (found) s.getRange(found.rowIndex, 1, 1, SVC_COLS.length).setValues([svcRow_(rec)]);
  else appendRows_(s, SVC_COLS.length, [svcRow_(rec)]);
  return { ok: true, service: rec };
}

function svcDelete_(req) {
  const s = svcSheet_();
  const found = svcRead_(s).filter(function (x) { return x.rec.id === String(req.id || ""); })[0];
  if (!found) return { ok: true };
  if (found.rec.updatedAt !== (req.base || "")) return { ok: false, error: "conflict", service: found.rec };
  s.deleteRow(found.rowIndex);
  return { ok: true };
}

/** "Log oil change / service" in the app also writes a service record. */
function svcFromLog_(t, log, by) {
  const items = Array.isArray(log.items) ? log.items.map(String) : [];
  const types = [];
  items.forEach(function (x) {
    const k = /truck oil/i.test(x) ? "Oil change" : /^TM /i.test(x) ? "TM service" : "";
    if (k && types.indexOf(k) === -1) types.push(k);
  });
  const note = String(log.note || "").trim();
  const rec = svcClean_({
    date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    truckId: t.id, type: types.join(", "), what: items.join(", ") + (note ? " - " + note : ""),
    miles: log.miles, tmHrs: log.hrs, shop: log.shop, cost: log.cost
  });
  rec.truck = t.unit;
  rec.source = "Logged service";
  rec.updatedAt = new Date().toISOString();
  rec.by = String(by || "").slice(0, 60);
  appendRows_(svcSheet_(), SVC_COLS.length, [svcRow_(rec)]);
  return rec;
}

/** Keeps the truck name in the Service tab in step after a rename (the app goes by truck ID either way). */
function svcRenameTruck_(id, unit) {
  const s = SpreadsheetApp.getActive().getSheetByName(SVC_SHEET);
  if (!s || s.getLastRow() < 2) return;
  const range = s.getRange(2, 2, s.getLastRow() - 1, 2);
  const vals = range.getValues();
  let changed = false;
  vals.forEach(function (v) { if (String(v[0]) === id && v[1] !== unit) { v[1] = unit; changed = true; } });
  if (changed) range.setValues(vals);
}

/* ---------------- Tuesday TM hours check ---------------- */

/** The Tuesday that starts the check week holding `when`, as yyyy-MM-dd in the script's time zone. */
function checkWeek_(when) {
  const tz = Session.getScriptTimeZone();
  const day = Number(Utilities.formatDate(when, tz, "u")) % 7;   // 0 = Sunday ... 6 = Saturday
  const p = Utilities.formatDate(when, tz, "yyyy-MM-dd").split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] - ((day - CHECK_DAY + 7) % 7)));
  return Utilities.formatDate(d, "UTC", "yyyy-MM-dd");
}
/** done, skipped or missed for the check week `week`. */
function checkState_(t, week) {
  if (t.hrsAt) {
    const at = new Date(t.hrsAt);
    if (!isNaN(at.getTime()) && Utilities.formatDate(at, Session.getScriptTimeZone(), "yyyy-MM-dd") >= week) return "done";
  }
  return t.tmSkip === week ? "skipped" : "missed";
}

/** "Not available this week" for the TM hrs check (Admins and Technicians). Doesn't touch anything else on the truck. */
function tmSkip_(req) {
  const id = String(req.id || "");
  const found = readTrucks_().filter(function (x) { return x.truck.id === id; })[0];
  if (!found) return { ok: false, error: "gone" };
  if (TM_KINDS.indexOf(found.truck.tm) < 1) return { ok: false, error: "not_allowed" };
  const t = found.truck;
  const week = checkWeek_(new Date());
  const old = String(t.tmSkip || "");
  const on = req.on === true;
  const next = on ? week : (old === week ? "" : old);
  if (next !== old) {
    t.tmSkip = next;
    sheet_("Trucks").getRange(found.rowIndex, TRUCK_COLS.indexOf("tmSkip") + 1).setValue(next);
    appendLog_(t, { kind: "skip", items: [on ? "Not available for the Tuesday TM hrs check" : "TM hrs check: not available undone"] }, req.by);
  }
  return { ok: true, truck: t, week: week };
}

/** Run once from the editor: a Tuesday morning list of trucks to check, then every morning from Wednesday on the
 *  trucks still missing that week's TM hrs, until they're all done. Sends a test email now so you can see it. */
function tmCheckEmailSetup() {
  tmCheckSchedule_();
  const sent = tmCheckEmail(true);
  Logger.log("TM hrs check email is on: Tuesday morning, then every morning until every truck is done. Test email sent to " + sent + ".");
}
function tmCheckEmailStop() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "tmCheckEmail") { ScriptApp.deleteTrigger(tr); n++; } });
  PropertiesService.getScriptProperties().deleteProperty("TM_CHECK_SCHEDULE");
  Logger.log(n ? "TM hrs check email stopped." : "TM hrs check email wasn't on.");
}
/** One daily 7 AM run (replaces any earlier schedule, such as the old Wednesday-only one). */
function tmCheckSchedule_() {
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "tmCheckEmail") ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger("tmCheckEmail").timeBased().everyDays(1).atHour(7).create();
  PropertiesService.getScriptProperties().setProperty("TM_CHECK_SCHEDULE", "daily");
}
/** Runs every morning. Tuesday: the trucks to check today. Other days: the trucks with no TM hrs since Tuesday that
 *  weren't marked not available. Sends nothing once they're all done. */
function tmCheckEmail(test) {
  const isTest = test === true;
  // A setup from before daily reminders ran only on Wednesdays: switch it over the first time it runs.
  if (!isTest && PropertiesService.getScriptProperties().getProperty("TM_CHECK_SCHEDULE") !== "daily") tmCheckSchedule_();
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const today = Number(Utilities.formatDate(now, tz, "u")) % 7 === CHECK_DAY;   // the check day itself
  const week = checkWeek_(now);
  const p = Utilities.formatDate(now, tz, "yyyy-MM-dd").split("-").map(Number), w = week.split("-").map(Number);
  const daysLate = Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(w[0], w[1] - 1, w[2])) / 864e5);
  const tm = readTrucks_().map(function (x) { return x.truck; }).filter(function (t) { return TM_KINDS.indexOf(t.tm) > 0; });
  const state = {};
  tm.forEach(function (t) { state[t.id] = checkState_(t, week); });
  const missed = tm.filter(function (t) { return state[t.id] === "missed"; });
  const skipped = tm.filter(function (t) { return state[t.id] === "skipped"; });
  const done = tm.filter(function (t) { return state[t.id] === "done"; });
  if (!missed.length && !isTest) { Logger.log("All " + tm.length + " truckmount trucks are done for this week. No email sent."); return ""; }
  const weekText = Utilities.formatDate(new Date(week + "T12:00:00Z"), "UTC", "EEE MMM d");
  const lastText = function (t) {
    if (!t.hrsAt) return "no TM hrs entered in the app yet";
    const at = new Date(t.hrsAt);
    if (isNaN(at.getTime())) return "no TM hrs entered in the app yet";
    const days = Math.floor((Date.now() - at.getTime()) / 864e5);
    return "last entered " + Utilities.formatDate(at, tz, "MMM d") + (t.hrsBy ? " by " + t.hrsBy : "") + " (" + days + " day" + (days === 1 ? "" : "s") + " ago, " + (t.hrsNow === null ? "no hrs" : t.hrsNow + " hrs") + ")";
  };
  const name = function (t) { return t.unit + (t.driver ? " · " + t.driver : ""); };
  const lines = [];
  if (isTest) lines.push("TEST: this is what the reminder looks like. It comes Tuesday morning, then every morning while a truck is still missing its TM hrs.", "");
  lines.push((today ? "Today's TM hrs check, " : "Tuesday TM hrs check, ") + weekText + ": " + done.length + " of " + tm.length + " truckmount trucks done.", "");
  if (missed.length) { lines.push(today ? "To check today:" : "Not checked:"); missed.forEach(function (t) { lines.push("• " + name(t) + ": " + lastText(t)); }); lines.push(""); }
  else lines.push(today ? "All done for today." : "Nothing missed so far this week.", "");
  if (skipped.length) { lines.push("Marked not available:"); skipped.forEach(function (t) { lines.push("• " + name(t)); }); lines.push(""); }
  if (missed.length && today) lines.push("Enter the TM hrs on each truck in the app, or tap Confirm if they haven't changed. Truck not there? Open it and tap Not available this week.", "");
  if (missed.length && !today) lines.push("This email comes every morning until each truck above has its TM hrs entered or is marked Not available this week. Then it stops until next week's check.", "");
  lines.push("Open the app: " + APP_URL);
  const to = String(PropertiesService.getScriptProperties().getProperty("TM_CHECK_EMAIL") || "").trim() || Session.getEffectiveUser().getEmail();
  const units = missed.map(function (t) { return t.unit; }).join(", ");
  const subject = (isTest ? "(Test) " : "") + (!missed.length ? "Tuesday TM hrs check: all done"
    : today ? "Today's TM hrs check: " + missed.length + " truck" + (missed.length === 1 ? "" : "s") + " to do (" + units + ")"
    : daysLate > 1 ? "Still missing TM hrs (" + daysLate + " days since Tuesday): " + units : "Missed Tuesday TM hrs: " + units);
  MailApp.sendEmail({ to: to, subject: subject.slice(0, 250), body: lines.join("\n") });
  return to;
}

/* ---------------- paperwork email ---------------- */

const PAPER_DAYS = 30;   // "due within a month", the same window the app uses for Due soon

/** Run once from the editor: every Monday morning, an email listing inspections and registrations due within a month
 *  or past due. Sends a test email now so you can see it. */
function paperworkEmailSetup() {
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "paperworkEmail") ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger("paperworkEmail").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  const sent = paperworkEmail(true);
  Logger.log("Paperwork email is on: every Monday between 7 and 8 AM, only when something is due within a month or past due. Test email sent to " + sent + ".");
}
function paperworkEmailStop() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "paperworkEmail") { ScriptApp.deleteTrigger(tr); n++; } });
  Logger.log(n ? "Paperwork email stopped." : "Paperwork email wasn't on.");
}
/** Safety inspections and registrations due within PAPER_DAYS (or past due), soonest first. */
function paperworkDue_(trucks, now) {
  const tz = Session.getScriptTimeZone();
  const p = Utilities.formatDate(now, tz, "yyyy-MM-dd").split("-").map(Number);
  const today = Date.UTC(p[0], p[1] - 1, p[2]);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const out = [];
  trucks.forEach(function (t) {
    const insp = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t.inspectionDue || ""));
    if (insp) out.push({ t: t, what: "Safety inspection", at: Date.UTC(+insp[1], +insp[2] - 1, +insp[3]), shown: MON[+insp[2] - 1] + " " + Number(insp[3]) + ", " + insp[1] });
    const reg = /^(\d{4})-(\d{2})$/.exec(String(t.registrationDue || ""));
    if (reg) out.push({ t: t, what: "Registration", at: Date.UTC(+reg[1], +reg[2], 0), shown: "end of " + MON[+reg[2] - 1] + " " + reg[1] });
  });
  return out.map(function (x) { x.days = Math.round((x.at - today) / 864e5); return x; })
    .filter(function (x) { return x.days <= PAPER_DAYS; })
    .sort(function (a, b) { return a.days - b.days; });
}
/** Runs every Monday morning. */
function paperworkEmail(test) {
  const isTest = test === true;
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const due = paperworkDue_(readTrucks_().map(function (x) { return x.truck; }), now);
  const past = due.filter(function (x) { return x.days < 0; });
  const soon = due.filter(function (x) { return x.days >= 0; });
  if (!due.length && !isTest) { Logger.log("No inspection or registration due within " + PAPER_DAYS + " days. No email sent."); return ""; }
  const name = function (t) { return t.unit + (t.driver ? " · " + t.driver : ""); };
  const plural = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };
  const line = function (x) {
    return "• " + name(x.t) + ": " + x.what + (x.days < 0 ? " was due " + x.shown + " (" + plural(-x.days, "day") + " ago)"
      : x.days === 0 ? " due today (" + x.shown + ")" : " due " + x.shown + " (in " + plural(x.days, "day") + ")");
  };
  const lines = [];
  if (isTest) lines.push("TEST: this is what the Monday paperwork email looks like. From now on it's only sent when something is due within a month or past due.", "");
  lines.push("Truck paperwork, " + Utilities.formatDate(now, tz, "EEE MMM d") + ":", "");
  if (past.length) { lines.push("Past due:"); past.forEach(function (x) { lines.push(line(x)); }); lines.push(""); }
  if (soon.length) { lines.push("Due within a month:"); soon.forEach(function (x) { lines.push(line(x)); }); lines.push(""); }
  if (!due.length) lines.push("Nothing due within a month.", "");
  if (due.length) lines.push("Renewed? Open the truck in the app, tap Edit truck and put in the new date. It drops off this email once it's more than a month away.",
    "This email comes every Monday while anything is due within a month or past due.", "");
  lines.push("Open the app: " + APP_URL);
  const props = PropertiesService.getScriptProperties();
  const to = String(props.getProperty("PAPERWORK_EMAIL") || "").trim() || String(props.getProperty("TM_CHECK_EMAIL") || "").trim() || Session.getEffectiveUser().getEmail();
  const parts = [];
  if (soon.length) parts.push(soon.length + " due within a month");
  if (past.length) parts.push(past.length + " past due");
  const subject = (isTest ? "(Test) " : "") + (due.length ? "Truck paperwork: " + parts.join(", ") : "Truck paperwork: nothing due");
  MailApp.sendEmail({ to: to, subject: subject, body: lines.join("\n") });
  return to;
}

/* ---------------- rows ---------------- */

/** Sheets set up before a column was added get it here: header written, nothing of yours overwritten. */
function ensureTruckCols_(sheet) {
  const need = TRUCK_COLS.length;
  if (sheet.getMaxColumns() < need) sheet.insertColumnsAfter(sheet.getMaxColumns(), need - sheet.getMaxColumns());
  if (String(sheet.getRange(1, need).getValues()[0][0]) === TRUCK_COLS[need - 1]) return;
  let addedHrsAt = false;
  for (let i = ADDED_COLS_FROM; i < need; i++) {
    const head = String(sheet.getRange(1, i + 1).getValues()[0][0]);
    if (head === TRUCK_COLS[i]) continue;
    if (head.trim() !== "") sheet.insertColumnBefore(i + 1);   // your own column there moves one to the right
    sheet.getRange(1, i + 1).setValue(TRUCK_COLS[i]).setFontWeight("bold");
    if (NUM_COLS.indexOf(TRUCK_COLS[i]) === -1) sheet.getRange(2, i + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
    if (TRUCK_COLS[i] === "hrsAt") addedHrsAt = true;
  }
  if (addedHrsAt) backfillHrsAt_(sheet);
}

/** When the hrsAt column is first added: fill it from the Log (the last time a person entered TM hrs on each truck),
 *  so trucks don't all show as "never entered". */
function backfillHrsAt_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return;
  const log = SpreadsheetApp.getActive().getSheetByName("Log");
  const latest = {};
  if (log && log.getLastRow() >= 2) {
    log.getRange(2, 1, log.getLastRow() - 1, 9).getValues().forEach(function (r) {
      const kind = String(r[3]), by = String(r[8] || "");
      if ((kind !== "reading" && kind !== "service") || num_(r[5]) === null || by === "GPS") return;
      const at = isDate_(r[0]) ? r[0] : new Date(String(r[0]));
      if (isNaN(at.getTime())) return;
      const id = String(r[1]);
      if (!latest[id] || at > latest[id].at) latest[id] = { at: at, by: by };
    });
  }
  const col = TRUCK_COLS.indexOf("hrsAt");
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  const vals = ids.map(function (r) { const x = latest[String(r[0])]; return x ? [x.at.toISOString(), x.by.slice(0, 60)] : ["", ""]; });
  sheet.getRange(2, col + 1, vals.length, 2).setValues(vals);
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
    if (c === "id" || c === "updatedAt" || c.indexOf("tier") === 0 || SERVER_OWNED.indexOf(c) !== -1) return;
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
  if (obj && typeof obj === "object") obj.api = API_VERSION;
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
    props.setProperties({ GPS_LAST_ERROR: msg.slice(0, 300) || "Unknown error", GPS_LAST_TRY: new Date().toISOString() });
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
  props.setProperties({ GPS_LAST_TRY: new Date().toISOString(), GPS_LAST_OK: new Date().toISOString() });
  props.deleteProperty("GPS_LAST_ERROR");   // removed, not left blank: the Script Properties page refuses to save a blank value
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
  return { lastOk: p.getProperty("GPS_LAST_OK") || "", lastTry: p.getProperty("GPS_LAST_TRY") || "", error: p.getProperty("GPS_LAST_ERROR") || "", shop: shopAt_() };
}

/* ---------------- shop location ---------------- */
// Trucks parked within SHOP_RADIUS_M of the shop show "At shop" in the app instead of the street address.
// Set from the app (a truck's GPS tab > "Set as shop"); kept in the Script Property SHOP_AT as "lat, lng".

const SHOP_RADIUS_M = 150;

function shopAt_() {
  const c = gpsParseCoords_(PropertiesService.getScriptProperties().getProperty("SHOP_AT"));
  return c ? { lat: c.lat, lng: c.lng, radius: SHOP_RADIUS_M } : null;
}

function setShop_(req) {
  const p = PropertiesService.getScriptProperties();
  if (req.clear === true) { p.deleteProperty("SHOP_AT"); return { ok: true, shop: null }; }
  const lat = Number(req.lat), lng = Number(req.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return { ok: false, error: "bad_request" };
  p.setProperty("SHOP_AT", lat.toFixed(5) + ", " + lng.toFixed(5));
  return { ok: true, shop: shopAt_() };
}

/* ---------------- checklists (cleaning supplies, products, equipment) ---------------- */
// Checklists: one row per checklist (Cleaning supplies first; Admins add more in the app).
// Supplies: every item on every checklist, one per row (column F says which checklist).
// Supply orders: one row per missing item: To order > Ordered > Received (or Removed).
// Supply checks: every list a person sends from the app, even "nothing missing".
// A technician sees only the checklists an Admin ticked for him (Settings > Users in the app); this script enforces it.

const LIST_SHEET = "Checklists";
const LIST_COLS = ["id", "order", "name", "createdAt", "note"];   // note: shown at the top of the checklist
const DEFAULT_LIST = "cleaning";
const DEFAULT_LIST_NAME = "Cleaning supplies";
const SUP_SHEET = "Supplies";
const SUP_COLS = ["id", "order", "section", "name", "container", "list"];
const REQ_SHEET = "Supply orders";
const REQ_COLS = ["id", "productId", "product", "container", "section", "qty", "status",
  "reportedAt", "reportedBy", "orderedAt", "orderedBy", "closedAt", "closedBy", "updatedAt", "checkId", "list"];
const CHK_SHEET = "Supply checks";
const CHK_COLS = ["id", "at", "by", "missing", "items", "note", "list"];
const REQ_STATUS = ["To order", "Ordered", "Received", "Removed"];
const SUP_SCHEMA = "3";      // bumped when the tabs above gain columns; older tabs are brought up to date once
const SUP_MAX_QTY = 999;
const SUP_KEEP_DAYS = 45;    // received or removed items stay in the app this long (they stay in the sheet for good)
const SUP_CHECKS_PER_LIST = 12;
// More checklists from VODA's paper sheets. Each is added once (the first time this script version runs) and never again,
// so renaming or deleting one in the app sticks. Assign them to technicians in the app (Settings > Users and invites).
const SUP_STARTERS = [
  { id: "mold", name: "Water/Mold remediation", note: "Warehouse in stock: mark what's missing or running low, and how many we need.", items: [
    ["Protective gear", "Booties", ""], ["Protective gear", "Masks", ""], ["Protective gear", "HEPA mask cartridges", ""],
    ["Protective gear", "Black gloves", ""], ["Protective gear", "Suits – coveralls", ""],
    ["Containment & covers", "Furniture plastic", ""], ["Containment & covers", "Containment plastic", ""], ["Containment & covers", "Painters tape", ""],
    ["Containment & covers", "Containment tape", ""], ["Containment & covers", "Floor paper", ""], ["Containment & covers", "Cloth – floor cover", ""],
    ["Cleaning & treatment", "Black trash bags", ""], ["Cleaning & treatment", "White towels", ""],
    ["Cleaning & treatment", "Disinfectant – Vital Oxide", ""], ["Cleaning & treatment", "Microbial paint", ""],
    ["Blades, cords & bags", "Blades serrated – hand cutter", ""], ["Blades, cords & bags", "Blades – drywall for Makita cutter", ""],
    ["Blades, cords & bags", "Extension cords", ""], ["Blades, cords & bags", "Vacuum bags – backpack", ""],
    ["Filters", "Filter 12x12x1", ""], ["Filters", "Filter 16x16x1", ""], ["Filters", "Filter 18x20x1", ""], ["Filters", "Filter 14x14x1", ""],
    ["Filters", "HEPA filter Dri-Eaz 500 (F321)", ""], ["Filters", "HEPA filter Dri-Eaz 700 – 19x21", ""], ["Filters", "Carbon filters", ""],
    ["PPE kit", "Carrying bag – Husky (kit: 1)", ""], ["PPE kit", "Coveralls (kit: 4)", ""], ["PPE kit", "Eyewear sets – safety goggles (kit: 2)", "set"],
    ["PPE kit", "Nitrile gloves (kit: 1 pack)", "pack"], ["PPE kit", "Waterproof boots (kit: 1 set)", "set"],
    ["PPE kit", "Half face respirator (kit: 1)", ""], ["PPE kit", "Full face respirator (kit: 1)", ""],
    ["PPE kit", "Mask filtration cartridges (kit: 2 sets, 4 total)", "set"], ["PPE kit", "Working gloves (kit: 4 pairs)", "pair"],
    ["PPE kit", "N95 masks (kit: 4)", ""], ["PPE kit", "Clean towels (kit: 2)", ""], ["PPE kit", "Cleaning wipes for respirator masks", ""],
    ["PPE kit", "Tape (kit: 1 roll)", "roll"], ["PPE kit", "White trash bags (kit: 2)", ""], ["PPE kit", "Booties (kit: 2 packs)", "pack"]] },
  { id: "hvac", name: "HVAC air-duct cleaning", note: "VODA technicians assume full responsibility for any loss or misuse of their assigned equipment.", items: [
    ["PPE", "Masks", ""], ["PPE", "Gloves", ""], ["PPE", "Booties", ""],
    ["Machines & hoses", "HVAC negative air machine – vacuum", ""], ["Machines & hoses", "Compressor", ""], ["Machines & hoses", "HVAC hoses", ""],
    ["Machines & hoses", "Plugs & connections", ""], ["Machines & hoses", "Medusa – return", ""],
    ["Tape & tools", "HVAC tape – blue", ""], ["Tape & tools", "HVAC tape – silver", ""], ["Tape & tools", "Duct cutters", ""],
    ["Tape & tools", "Drill", ""], ["Tape & tools", "Screws", ""],
    ["Site gear", "Gas can", ""], ["Site gear", "Vacuum – regular", ""], ["Site gear", "Door/wall corners", ""], ["Site gear", "Toolbox", ""],
    ["Site gear", "Extension cords", ""], ["Site gear", "Ladder", ""],
    ["Cleaning", "Towels", ""], ["Cleaning", "Disinfectant", ""], ["Cleaning", "Fogger", ""]] }
];
const SUP_SEED = [
  ["Carpet & upholstery", "Procyon Powder", "box"],
  ["Carpet & upholstery", "Procyon Liquid", "gallon"],
  ["Carpet & upholstery", "Urine Stain Remover (USOR)", ""],
  ["Carpet & upholstery", "Gel Break", "quart"],
  ["Carpet & upholstery", "Pet Zone", "jug"],
  ["Carpet & upholstery", "Stain 1", "quart"],
  ["Carpet & upholstery", "Red One", "quart"],
  ["Carpet & upholstery", "Perky", "gallon"],
  ["Carpet & upholstery", "T-Rust", "gallon"],
  ["Carpet & upholstery", "Avenge Pro", "gallon"],
  ["Carpet & upholstery", "Lemon Fresh", "gallon"],
  ["Carpet & upholstery", "Defoamer", "jug"],
  ["Carpet & upholstery", "Maxim Carpet", "gallon"],
  ["Carpet & upholstery", "Maxim Upholstery", "gallon"],
  ["Carpet & upholstery", "Liquid Browning", "gallon"],
  ["Carpet & upholstery", "Traffic Slam", ""],
  ["Carpet & upholstery", "Fab Set", ""],
  ["Hard floors", "Squeaky", "gallon"],
  ["Hard floors", "I.F.T.", "gallon"],
  ["Hard floors", "Refinisher", "quart"],
  ["Hard floors", "Disolver", "gallon"],
  ["Hard floors", "Microfiber mop pads", ""],
  ["Hard floors", "Polish pads", ""],
  ["Hard floors", "Maroon pads", ""],
  ["Tile & grout", "Grout Master", "pail"],
  ["Tile & grout", "Viper Grout Sealer", "gallon"],
  ["Job supplies", "Shoe covers", ""],
  ["Job supplies", "Furniture tape", ""],
  ["Job supplies", "Styrofoam blocks", ""],
  ["Job supplies", "Towels", ""],
  ["Job supplies", "Black pads", ""],
  ["Job supplies", "Green pads", ""],
  ["Job supplies", "Stripper", ""],
  ["Job supplies", "Wax VCT", ""],
  ["Job supplies", "Vacuum bags", ""],
  ["Job supplies", "White trash bags", ""]
];

function supNewId_(prefix) { return (prefix || "p") + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 10); }
function supText_(v, max) { return String(v === null || v === undefined ? "" : v).trim().replace(/\s+/g, " ").slice(0, max); }
function supIso_(v) { return isDate_(v) ? v.toISOString() : String(v === null || v === undefined ? "" : v); }
function supListOf_(v) { return supText_(v, 40) || DEFAULT_LIST; }   // rows from before there were several checklists

/** The four tabs when they're already set up for this version of the script, or null. No heading checks: fast. */
function supTabsIfReady_() {
  if (PropertiesService.getScriptProperties().getProperty("SUP_SCHEMA") !== SUP_SCHEMA) return null;
  const ss = SpreadsheetApp.getActive();
  const t = { l: ss.getSheetByName(LIST_SHEET), p: ss.getSheetByName(SUP_SHEET), r: ss.getSheetByName(REQ_SHEET), c: ss.getSheetByName(CHK_SHEET) };
  return t.l && t.p && t.r && t.c ? t : null;
}

/** The four checklist tabs, made the first time they're needed (Cleaning supplies starts with the paper list), and
 *  older tabs given any new heading. Call inside the lock. */
function supSheets_() {
  const ready = supTabsIfReady_();
  if (ready) return ready;
  const ss = SpreadsheetApp.getActive();
  const make = function (name, cols, numCols) {
    let s = ss.getSheetByName(name);
    if (s) {
      if (s.getMaxColumns() < cols.length) s.insertColumnsAfter(s.getMaxColumns(), cols.length - s.getMaxColumns());
      const head = s.getRange(1, 1, 1, cols.length).getValues()[0];
      if (head.some(function (h, i) { return String(h) !== cols[i]; })) s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold");
      return { s: s, isNew: false };
    }
    s = ss.insertSheet(name);
    if (s.getMaxColumns() < cols.length) s.insertColumnsAfter(s.getMaxColumns(), cols.length - s.getMaxColumns());
    s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold");
    s.setFrozenRows(1);
    cols.forEach(function (c, i) {
      if (numCols.indexOf(c) === -1) s.getRange(2, i + 1, Math.max(s.getMaxRows() - 1, 1), 1).setNumberFormat("@");
    });
    return { s: s, isNew: true };
  };
  const l = make(LIST_SHEET, LIST_COLS, ["order"]);
  if (l.isNew) appendRows_(l.s, LIST_COLS.length, [[DEFAULT_LIST, 1, DEFAULT_LIST_NAME, new Date().toISOString(), ""]]);
  const p = make(SUP_SHEET, SUP_COLS, ["order"]);
  if (p.isNew) {
    appendRows_(p.s, SUP_COLS.length, SUP_SEED.map(function (x, i) { return [supNewId_(), i + 1, x[0], x[1], x[2], DEFAULT_LIST]; }));
    p.s.autoResizeColumns(1, SUP_COLS.length);
    supBump_();
  }
  const r = make(REQ_SHEET, REQ_COLS, ["qty"]);
  const c = make(CHK_SHEET, CHK_COLS, ["missing"]);
  supAddStarters_(l.s, p.s);
  PropertiesService.getScriptProperties().setProperty("SUP_SCHEMA", SUP_SCHEMA);
  return { l: l.s, p: p.s, r: r.s, c: c.s };
}

/** Adds each starter checklist once. One with the same ID or name already there counts as added. */
function supAddStarters_(ls, ps) {
  const props = PropertiesService.getScriptProperties();
  const done = String(props.getProperty("SUP_STARTERS") || "").split(",").filter(Boolean);
  const todo = SUP_STARTERS.filter(function (x) { return done.indexOf(x.id) === -1; });
  if (!todo.length) return;
  const lists = supLists_(ls);
  let order = lists.reduce(function (m, l) { return Math.max(m, l.order || 0); }, 0);
  let itemOrder = supProducts_(ps, false).list.reduce(function (m, p) { return Math.max(m, p.order || 0); }, 0);
  const now = new Date().toISOString();
  const listRows = [], itemRows = [];
  todo.forEach(function (x) {
    done.push(x.id);
    if (lists.some(function (l) { return l.id === x.id || l.name.toLowerCase() === x.name.toLowerCase(); })) return;
    listRows.push([x.id, ++order, x.name, now, x.note || ""]);
    x.items.forEach(function (it) { itemRows.push([supNewId_(), ++itemOrder, it[0], it[1], it[2], x.id]); });
  });
  appendRows_(ls, LIST_COLS.length, listRows);
  appendRows_(ps, SUP_COLS.length, itemRows);
  props.setProperty("SUP_STARTERS", done.join(","));
  if (listRows.length) supBump_();
}

/** Changes whenever a checklist is saved from the app, so two people editing can't overwrite each other. */
function supVer_() {
  const p = PropertiesService.getScriptProperties();
  return p.getProperty("SUPPLIES_VER") || supBump_();
}
function supBump_() {
  const v = new Date().toISOString();
  PropertiesService.getScriptProperties().setProperty("SUPPLIES_VER", v);
  return v;
}

/** Checklists in the order they show in the app. */
function supLists_(s) {
  const last = s.getLastRow();
  if (last < 2) return [];
  const seen = {};
  return s.getRange(2, 1, last - 1, LIST_COLS.length).getValues().map(function (r, i) {
    return { id: String(r[0] || "").trim(), order: num_(r[1]), name: supText_(r[2], 40), createdAt: supIso_(r[3]),
      note: String(r[4] === null || r[4] === undefined ? "" : r[4]).trim().slice(0, 300), row: i + 2 };
  }).filter(function (x) {
    if (!/^[A-Za-z0-9-]{1,40}$/.test(x.id) || seen[x.id]) return false;
    seen[x.id] = true;
    if (!x.name) x.name = x.id === DEFAULT_LIST ? DEFAULT_LIST_NAME : "Checklist";
    return true;
  }).sort(function (a, b) {
    const ao = a.order === null ? 1e9 : a.order, bo = b.order === null ? 1e9 : b.order;
    return ao - bo || a.row - b.row;
  });
}

/** Items in checklist order. A row typed straight into the sheet gets an ID when `fix` is true (inside the lock). */
function supProducts_(s, fix) {
  const last = s.getLastRow();
  if (last < 2) return { list: [], missingIds: false };
  const vals = s.getRange(2, 1, last - 1, SUP_COLS.length).getValues();
  const out = [];
  let missingIds = false;
  const seen = {};
  vals.forEach(function (r, i) {
    const name = supText_(r[3], 60);
    if (!name) return;
    let id = String(r[0] || "").trim();
    if (!/^[A-Za-z0-9-]{3,40}$/.test(id) || seen[id]) {
      missingIds = true;
      if (!fix) return;
      id = supNewId_();
      s.getRange(i + 2, 1).setValue(id);
    }
    seen[id] = true;
    out.push({ id: id, order: num_(r[1]), section: supText_(r[2], 40) || "Other", name: name, container: supText_(r[4], 20), list: supListOf_(r[5]), row: i + 2 });
  });
  out.sort(function (a, b) {
    const ao = a.order === null ? 1e9 : a.order, bo = b.order === null ? 1e9 : b.order;
    return ao - bo || a.row - b.row;
  });
  return { list: out, missingIds: missingIds };
}

function supReqFromRow_(r) {
  const o = {};
  REQ_COLS.forEach(function (c, i) { o[c] = c === "qty" ? num_(r[i]) : supIso_(r[i]); });
  if (REQ_STATUS.indexOf(o.status) === -1) o.status = "To order";
  o.list = supListOf_(o.list);
  return o;
}
function supReqRow_(o) {
  return REQ_COLS.map(function (c) {
    if (c === "qty") { const n = num_(o.qty); return n === null ? "" : n; }
    return o[c] === null || o[c] === undefined ? "" : String(o[c]);
  });
}
function supRequests_(s) {
  const last = s.getLastRow();
  if (last < 2) return [];
  return s.getRange(2, 1, last - 1, REQ_COLS.length).getValues().map(function (r, i) {
    return { rowIndex: i + 2, rec: supReqFromRow_(r) };
  }).filter(function (x) { return x.rec.id && x.rec.productId; });
}
/** The newest checks, up to `perList` for each checklist, newest first. */
/** The newest 500 checks, oldest first (one read: enough to spot a list sent twice and to show the latest ones). */
function supReadChecks_(s) {
  const last = s.getLastRow();
  if (last < 2) return [];
  const from = Math.max(2, last - 499);
  return s.getRange(from, 1, last - from + 1, CHK_COLS.length).getValues().map(function (r) {
    return { id: String(r[0] || ""), at: supIso_(r[1]), by: String(r[2] || ""), missing: num_(r[3]) || 0, items: String(r[4] || ""), note: String(r[5] || ""), list: supListOf_(r[6]) };
  }).filter(function (c) { return c.id; });
}
/** Up to `perList` checks for each checklist, newest first. */
function supRecentChecks_(rows, perList) {
  const count = {};
  return rows.slice().reverse().filter(function (c) {
    count[c.list] = (count[c.list] || 0) + 1;
    return count[c.list] <= perList;
  });
}
/** Writes changed order rows, one call for each run of rows next to each other ("All ordered" is usually one call). */
function supWriteReqRows_(s, changed) {
  changed.sort(function (a, b) { return a.rowIndex - b.rowIndex; });
  for (let i = 0; i < changed.length;) {
    let j = i;
    while (j + 1 < changed.length && changed[j + 1].rowIndex === changed[j].rowIndex + 1) j++;
    s.getRange(changed[i].rowIndex, 1, j - i + 1, REQ_COLS.length).setValues(changed.slice(i, j + 1).map(function (x) { return supReqRow_(x.rec); }));
    i = j + 1;
  }
}

/** What the app shows this person: the checklists they may see, with their items, everything still to order or on its
 *  way, what closed lately, and the last checks. */
function suppliesForApp_(inLock, user, pre) {
  // pre: what a save already read and changed (tabs, lists, products, reqs, checks), so it isn't read twice.
  pre = pre || {};
  const lockIf = function (fn) { return inLock ? fn() : withLock_(fn); };
  const t = pre.tabs || supTabsIfReady_() || lockIf(supSheets_);
  let products = pre.products;
  if (!products) {
    let prod = supProducts_(t.p, false);
    if (prod.missingIds) prod = lockIf(function () { return supProducts_(t.p, true); });
    products = prod.list;
  }
  const lists = (pre.lists || supLists_(t.l)).filter(function (l) { return canSee_(user, l.id); });
  const mine = {};
  lists.forEach(function (l) { mine[l.id] = true; });
  const cutoff = new Date(Date.now() - SUP_KEEP_DAYS * 864e5).toISOString();
  const allReqs = (pre.reqs || supRequests_(t.r).map(function (x) { return x.rec; })).filter(function (r) { return mine[r.list]; });
  // When each item was last ordered, from the whole history (not only the last few weeks), so everyone can see it.
  const lastOrdered = {};
  allReqs.forEach(function (r) {
    if (!r.orderedAt || r.status === "Removed") return;
    const cur = lastOrdered[r.productId];
    if (cur && cur.at >= r.orderedAt) return;
    lastOrdered[r.productId] = { at: r.orderedAt, qty: r.qty, by: r.orderedBy, status: r.status, receivedAt: r.status === "Received" ? r.closedAt : "" };
  });
  const reqs = allReqs.filter(function (r) { return r.status === "To order" || r.status === "Ordered" || String(r.closedAt || r.updatedAt) >= cutoff; });
  const closed = reqs.filter(function (r) { return r.status === "Received" || r.status === "Removed"; })
    .sort(function (a, b) { return String(b.closedAt).localeCompare(String(a.closedAt)); }).slice(0, 150);
  const open = reqs.filter(function (r) { return r.status === "To order" || r.status === "Ordered"; });
  return {
    ver: supVer_(),
    lists: lists.map(function (l) { return { id: l.id, name: l.name, note: l.note }; }),
    products: products.filter(function (p) { return mine[p.list]; })
      .map(function (p) { return { id: p.id, list: p.list, section: p.section, name: p.name, container: p.container }; }),
    requests: open.concat(closed),
    lastOrdered: lastOrdered,
    checks: supRecentChecks_(pre.checks || supReadChecks_(t.c), SUP_CHECKS_PER_LIST).filter(function (c) { return mine[c.list]; })
  };
}

/** Anyone with that checklist: the items that are missing and how many (the newest count wins for an item not ordered
 *  yet), or an empty list for "nothing missing". checkId comes from the phone, so a list sent twice counts once. */
function supplyReport_(req) {
  const sh = supSheets_();
  const checkId = String(req.checkId || "");
  const items = Array.isArray(req.items) ? req.items : null;
  const listId = String(req.list || DEFAULT_LIST);
  if (!/^[A-Za-z0-9-]{6,40}$/.test(checkId) || !items || items.length > 300) return { ok: false, error: "bad_request" };
  const allLists = supLists_(sh.l);
  const list = allLists.filter(function (l) { return l.id === listId; })[0];
  if (!list) return { ok: false, error: "gone" };
  if (!canSee_(req.user, list.id)) return { ok: false, error: "not_allowed" };
  const checks = supReadChecks_(sh.c);
  const prodList = supProducts_(sh.p, true).list;
  const all = supRequests_(sh.r);
  const answer = function (fresh) {   // everything the app needs, from what's already in hand (no second read)
    return suppliesForApp_(true, req.user, { tabs: sh, lists: allLists, products: prodList, checks: checks,
      reqs: all.map(function (x) { return x.rec; }).concat(fresh || []) });
  };
  // Sent twice (an answer lost on a bad signal)? The first one already counts.
  if (checks.some(function (c) { return c.id === checkId; })) return { ok: true, repeat: true, supplies: answer() };
  const products = {};
  prodList.forEach(function (p) { if (p.list === list.id) products[p.id] = p; });
  const now = new Date().toISOString();
  const by = String(req.by || "").slice(0, 60);
  const note = String(req.note || "").trim().slice(0, 500);
  const lines = [], add = [], fresh = [], updated = [], seen = {};
  let skipped = 0;
  const already = [];
  const admin = !!(req.user && req.user.role === "admin");
  items.forEach(function (it) {
    const p = it && products[String(it.productId || "")];
    const qty = Math.round(Number(it && it.qty));
    if (!p || seen[p.id] || !(qty >= 1 && qty <= SUP_MAX_QTY)) { skipped++; return; }
    seen[p.id] = true;
    const open = all.filter(function (x) { return x.rec.productId === p.id && x.rec.status === "To order"; })[0];
    // Technicians add to the order list but never change what's on it: an item already there waiting to be ordered
    // stays exactly as it is (only an Admin changes or removes it). An Admin's newer count replaces the old one.
    if (open && !admin) { already.push(p.name); return; }
    const rec = open ? open.rec : { id: supNewId_("r"), productId: p.id, status: "To order", orderedAt: "", orderedBy: "", closedAt: "", closedBy: "" };
    rec.product = p.name; rec.container = p.container; rec.section = p.section; rec.list = list.id;
    rec.qty = qty;
    rec.reportedAt = now; rec.reportedBy = by;
    rec.updatedAt = now; rec.checkId = checkId;
    if (open) updated.push(open);
    else { const row = supReqRow_(rec); add.push(row); fresh.push(supReqFromRow_(row)); }   // the same shape a fresh read gives
    lines.push({ name: p.name, container: p.container, qty: qty });
  });
  supWriteReqRows_(sh.r, updated);
  appendRows_(sh.r, REQ_COLS.length, add);
  const text = lines.map(function (l) { return l.name + " x" + l.qty; }).join(", ");
  const chk = { id: checkId, at: now, by: by, missing: lines.length, items: text.slice(0, 2000) || "Nothing missing", note: note, list: list.id };
  appendRows_(sh.c, CHK_COLS.length, [[chk.id, chk.at, chk.by, chk.missing, chk.items, chk.note, chk.list]]);
  checks.push(chk);
  if (lines.length) {   // technicians and admins alike, so an admin can leave a reminder in the inbox
    try { supplyEmail_(by, list, lines, note, false); } catch (e) { /* an email problem never stops the list from saving */ }
  }
  return { ok: true, skipped: skipped, already: already, supplies: answer(fresh) };
}

/** Admin: mark items Ordered / Received / back to To order / Removed, and/or change how many. */
function supplyStatus_(req) {
  const sh = supSheets_();
  const ids = (Array.isArray(req.ids) ? req.ids : [req.id]).map(function (x) { return String(x || ""); }).filter(Boolean).slice(0, 500);
  const status = req.status === undefined || req.status === null ? null : String(req.status);
  const qty = req.qty === undefined || req.qty === null ? null : Math.round(Number(req.qty));
  if (!ids.length || (status === null && qty === null)) return { ok: false, error: "bad_request" };
  if (status !== null && REQ_STATUS.indexOf(status) === -1) return { ok: false, error: "bad_request" };
  if (qty !== null && !(qty >= 1 && qty <= SUP_MAX_QTY)) return { ok: false, error: "bad_request" };
  const all = supRequests_(sh.r);
  const now = new Date().toISOString();
  const by = String(req.by || "").slice(0, 60);
  const byId = {};
  all.forEach(function (y) { byId[y.rec.id] = y; });
  const done = [];
  let gone = 0;
  ids.forEach(function (id) {
    const x = byId[id];
    if (!x) { gone++; return; }
    if (done.indexOf(x) !== -1) return;
    const r = x.rec;
    if (qty !== null) r.qty = qty;
    if (status !== null && status !== r.status) supSetStatus_(r, status, now, by);
    r.updatedAt = now;
    done.push(x);
  });
  supWriteReqRows_(sh.r, done);
  return { ok: true, changed: done.length, gone: gone,
    supplies: suppliesForApp_(true, req.user, { tabs: sh, reqs: all.map(function (y) { return y.rec; }) }) };
}
function supSetStatus_(r, status, now, by) {
  if (status === "To order") { r.orderedAt = ""; r.orderedBy = ""; r.closedAt = ""; r.closedBy = ""; }
  else if (status === "Ordered") { r.orderedAt = now; r.orderedBy = by; r.closedAt = ""; r.closedBy = ""; }
  else {
    if (status === "Received" && !r.orderedAt) { r.orderedAt = now; r.orderedBy = by; }
    r.closedAt = now; r.closedBy = by;
  }
  r.status = status;
}

/** Rewrites the Supplies tab: every checklist's items, checklist by checklist, in order. */
function supWriteProducts_(s, byList, lists) {
  const rows = [];
  const ids = lists.map(function (l) { return l.id; });
  Object.keys(byList).forEach(function (k) { if (ids.indexOf(k) === -1) ids.push(k); });   // items of a checklist row someone deleted by hand
  ids.forEach(function (k) {
    (byList[k] || []).forEach(function (p) { rows.push([p.id, rows.length + 1, p.section, p.name, p.container, k]); });
  });
  const last = s.getLastRow();
  if (last > 1) s.getRange(2, 1, last - 1, SUP_COLS.length).clearContent();
  if (!rows.length) return;
  if (s.getMaxRows() < rows.length + 1) s.insertRowsAfter(s.getMaxRows(), rows.length + 1 - s.getMaxRows() + 50);
  s.getRange(2, 1, rows.length, SUP_COLS.length).setValues(rows);
}

/** Admin: one checklist from the app's editor: its name and all its items (names, containers, sections, order).
 *  No id = a new checklist. Items already on the order list keep showing, and pick up an item's new name. */
function saveChecklist_(req) {
  const sh = supSheets_();
  if (String(req.base || "") !== supVer_()) return { ok: false, error: "conflict", supplies: suppliesForApp_(true, req.user) };
  const body = req.list && typeof req.list === "object" ? req.list : null;
  const items = Array.isArray(req.products) ? req.products : null;
  if (!body || !items || items.length > 500) return { ok: false, error: "bad_request" };
  const name = supText_(body.name, 40);
  if (!name) return { ok: false, error: "bad_list_name" };
  const note = body.note === undefined ? null : String(body.note || "").trim().replace(/[ \t]+/g, " ").slice(0, 300);   // left alone when the app doesn't send one
  const lists = supLists_(sh.l);
  let list = body.id ? lists.filter(function (l) { return l.id === String(body.id); })[0] : null;
  if (body.id && !list) return { ok: false, error: "gone" };
  const clash = lists.filter(function (l) { return (!list || l.id !== list.id) && l.name.toLowerCase() === name.toLowerCase(); })[0];
  if (clash) return { ok: false, error: "duplicate_list", name: clash.name };
  const all = supProducts_(sh.p, true).list;
  const cur = {};
  all.forEach(function (p) { cur[p.id] = p; });
  const out = [], used = {}, byId = {};
  items.forEach(function (x) {
    if (!x || typeof x !== "object") return;
    const pname = supText_(x.name, 60);
    if (!pname) return;
    let id = String(x.id || "");
    if (!cur[id] || used[id] || (list && cur[id].list !== list.id) || !list) id = supNewId_();
    used[id] = true;
    const p = { id: id, section: supText_(x.section, 40) || "Other", name: pname, container: supText_(x.container, 20) };
    byId[id] = p;
    out.push(p);
  });
  if (!out.length) return { ok: false, error: "empty_list" };   // a checklist needs at least one item
  const now = new Date().toISOString();
  if (!list) {
    const maxOrder = lists.reduce(function (m, l) { return Math.max(m, l.order || 0); }, 0);
    list = { id: supNewId_("l"), order: maxOrder + 1, name: name };
    appendRows_(sh.l, LIST_COLS.length, [[list.id, list.order, name, now, note || ""]]);
  } else {
    if (list.name !== name) sh.l.getRange(list.row, 3).setValue(name);
    if (note !== null && note !== list.note) sh.l.getRange(list.row, 5).setValue(note);
  }
  const byList = {};
  all.forEach(function (p) { if (p.list !== list.id) (byList[p.list] = byList[p.list] || []).push(p); });
  byList[list.id] = out;
  supWriteProducts_(sh.p, byList, supLists_(sh.l));
  supRequests_(sh.r).forEach(function (x) {
    const r = x.rec, p = byId[r.productId];
    if (!p || (r.status !== "To order" && r.status !== "Ordered")) return;
    if (r.product === p.name && r.container === p.container && r.section === p.section) return;
    r.product = p.name; r.container = p.container; r.section = p.section; r.updatedAt = now;
    sh.r.getRange(x.rowIndex, 1, 1, REQ_COLS.length).setValues([supReqRow_(r)]);
  });
  supBump_();
  return { ok: true, list: { id: list.id, name: name, note: note === null ? list.note || "" : note }, supplies: suppliesForApp_(true, req.user) };
}

/** Admin: deletes a checklist and its items. Anything of it still on the order list is marked Removed (kept in the
 *  sheet), and it's taken off everyone's access. */
function deleteChecklist_(req) {
  const sh = supSheets_();
  if (String(req.base || "") !== supVer_()) return { ok: false, error: "conflict", supplies: suppliesForApp_(true, req.user) };
  const id = String(req.id || "");
  const lists = supLists_(sh.l);
  const list = lists.filter(function (l) { return l.id === id; })[0];
  if (!list) return { ok: false, error: "gone" };
  sh.l.deleteRow(list.row);
  const byList = {};
  supProducts_(sh.p, true).list.forEach(function (p) { if (p.list !== id) (byList[p.list] = byList[p.list] || []).push(p); });
  supWriteProducts_(sh.p, byList, supLists_(sh.l));
  const now = new Date().toISOString(), by = String(req.by || "").slice(0, 60);
  supRequests_(sh.r).forEach(function (x) {
    const r = x.rec;
    if (r.list !== id || (r.status !== "To order" && r.status !== "Ordered")) return;
    supSetStatus_(r, "Removed", now, by);
    r.updatedAt = now;
    sh.r.getRange(x.rowIndex, 1, 1, REQ_COLS.length).setValues([supReqRow_(r)]);
  });
  const us = usersSheet_();
  readUsers_(us).forEach(function (x) {
    const a = parseAccess_(x.u.access);
    if (a.indexOf(id) === -1) return;
    x.u.access = accessText_(a.filter(function (k) { return k !== id; }));
    writeUser_(us, x.rowIndex, x.u);
  });
  supBump_();
  return { ok: true, supplies: suppliesForApp_(true, req.user) };
}

/** Admin: puts one checklist inside another. Its items go to the end, their sections tagged with the first word of its
 *  name ("HVAC · PPE"); its order list, history and checks come along; its note is added below the other one; everyone
 *  who had it gets the other one instead. Then it's removed. */
function mergeChecklist_(req) {
  const sh = supSheets_();
  if (String(req.base || "") !== supVer_()) return { ok: false, error: "conflict", supplies: suppliesForApp_(true, req.user) };
  const fromId = String(req.from || ""), intoId = String(req.into || "");
  if (!fromId || !intoId || fromId === intoId) return { ok: false, error: "bad_request" };
  const lists = supLists_(sh.l);
  const from = lists.filter(function (l) { return l.id === fromId; })[0], into = lists.filter(function (l) { return l.id === intoId; })[0];
  if (!from || !into) return { ok: false, error: "gone" };
  const tag = supText_(from.name.split(" ")[0], 20) || "Merged";
  const all = supProducts_(sh.p, true).list;
  const byList = {};
  let moved = 0;
  all.forEach(function (p) {
    if (p.list === fromId) {
      const sec = p.section.toLowerCase().indexOf(tag.toLowerCase()) === 0 ? p.section : supText_(tag + " · " + p.section, 40);
      p = { id: p.id, section: sec, name: p.name, container: p.container };
      (byList[intoId] = byList[intoId] || []).push(Object.assign(p, { tail: true }));
      moved++;
    } else (byList[p.list] = byList[p.list] || []).push(p);
  });
  // its items after the other checklist's own
  if (byList[intoId]) byList[intoId].sort(function (a, b) { return (a.tail ? 1 : 0) - (b.tail ? 1 : 0); });
  const now = new Date().toISOString();
  // its order list and history
  const reqs = supRequests_(sh.r), changed = [];
  reqs.forEach(function (x) {
    if (x.rec.list !== fromId) return;
    x.rec.list = intoId;
    if (OPEN_STATUS_(x.rec.status)) { const p = (byList[intoId] || []).filter(function (q) { return q.id === x.rec.productId; })[0]; if (p) x.rec.section = p.section; }
    x.rec.updatedAt = now;
    changed.push(x);
  });
  supWriteReqRows_(sh.r, changed);
  // its checks
  const lastC = sh.c.getLastRow();
  if (lastC > 1) {
    const col = CHK_COLS.indexOf("list") + 1;
    const rng = sh.c.getRange(2, col, lastC - 1, 1);
    const vals = rng.getValues();
    let hit = false;
    vals.forEach(function (r) { if (supListOf_(r[0]) === fromId) { r[0] = intoId; hit = true; } });
    if (hit) rng.setValues(vals);
  }
  // note: the other one's, then this one's
  const note = [into.note, from.note].filter(Boolean).join("\n").slice(0, 300);
  if (note !== into.note) sh.l.getRange(into.row, 5).setValue(note);
  sh.l.deleteRow(from.row);
  supWriteProducts_(sh.p, byList, supLists_(sh.l));
  // people who had it now have the other one
  const us = usersSheet_();
  readUsers_(us).forEach(function (x) {
    const a = parseAccess_(x.u.access);
    if (a.indexOf(fromId) === -1) return;
    const next = a.map(function (k) { return k === fromId ? intoId : k; }).filter(function (k, i, arr) { return arr.indexOf(k) === i; });
    x.u.access = accessText_(next);
    writeUser_(us, x.rowIndex, x.u);
  });
  supBump_();
  return { ok: true, moved: moved, list: { id: into.id, name: into.name }, supplies: suppliesForApp_(true, req.user) };
}
function OPEN_STATUS_(st) { return st === "To order" || st === "Ordered"; }

/** "2 gallons", "1 box", or just "3" for an item with no container. */
function supQty_(qty, container) {
  if (!container) return String(qty);
  if (qty === 1) return "1 " + container;
  const w = /(s|x|z|ch|sh)$/i.test(container) ? container + "es" : /[^aeiou]y$/i.test(container) ? container.slice(0, -1) + "ies" : container + "s";
  return qty + " " + w;
}

/** The email when a technician sends missing items. */
function supplyEmail_(by, list, lines, note, isTest) {
  const props = PropertiesService.getScriptProperties();
  const set = String(props.getProperty("SUPPLY_EMAIL") || "").trim();
  if (/^off$/i.test(set) && !isTest) return "";
  const to = (/^off$/i.test(set) ? "" : set) || String(props.getProperty("TM_CHECK_EMAIL") || "").trim() || Session.getEffectiveUser().getEmail();
  if (!to) return "";
  const n = lines.length;
  const body = [];
  if (isTest) body.push("TEST: this is what the email looks like when a technician sends missing items.", "");
  body.push(by + " checked " + list.name + ". Missing (" + n + "):", "");
  lines.forEach(function (l) { body.push("• " + l.name + ": " + supQty_(l.qty, l.container)); });
  if (note) body.push("", "Note: " + note);
  body.push("", "The full list to order is in the app under Checklists > " + list.name + " > Order list: " + APP_URL + "#order-list/" + list.id);
  // Subject starts with SUPPLY_SUBJECT ("For Mike to order" unless you set another); the checklist and count follow so
  // Gmail keeps each list as its own email instead of piling them all into one conversation.
  const lead = String(props.getProperty("SUPPLY_SUBJECT") || "").trim() || "For Mike to order";
  const subject = (isTest ? "(Test) " : "") + lead + ": " + list.name + ", " + n + " item" + (n === 1 ? "" : "s") + " from " + by;
  MailApp.sendEmail({ to: to, subject: subject.slice(0, 250), body: body.join("\n") });
  return to;
}

/** Run from the editor to see the email (it goes where the real ones would). */
function supplyEmailTest() {
  const to = supplyEmail_("Your technician", { id: DEFAULT_LIST, name: DEFAULT_LIST_NAME },
    [{ name: "Procyon Powder", container: "box", qty: 2 }, { name: "Pet Zone", container: "jug", qty: 1 }, { name: "Shoe covers", container: "", qty: 3 }],
    "Pet Zone is almost empty too.", true);
  Logger.log(to ? "Test email sent to " + to + "." : "No email address found.");
}

/* ---------------- who sees what ---------------- */
// Users tab, column M (access): what a technician sees, comma-separated: "trucks", "leaderboard", "leaderboard-import"
// and/or checklist IDs.
// Empty means Trucks only (how every technician worked before checklists). "-" means nothing yet. Admins see everything.

const ACCESS_DEFAULT = ["trucks"];
const PAYROLL = "payroll";   // an admin who sees Leaderboard > Payroll (switched per admin, see setPayroll_)
function parseAccess_(s) {
  s = String(s === null || s === undefined ? "" : s).trim();
  if (!s) return ACCESS_DEFAULT.slice();
  if (s === "-") return [];
  return s.split(",").map(function (x) { return x.trim(); }).filter(function (x, i, a) { return /^[A-Za-z0-9-]{1,40}$/.test(x) && a.indexOf(x) === i; });
}
function accessText_(arr) { return arr && arr.length ? arr.join(",") : "-"; }
function canSee_(user, section) { return !!user && (user.role === "admin" || parseAccess_(user.access).indexOf(section) !== -1); }
/** Only "trucks", the leaderboard and checklists that exist. */
function cleanAccess_(raw) {
  if (!Array.isArray(raw)) return null;
  const lists = supLists_(supSheets_().l).map(function (l) { return l.id; });
  return raw.map(String).filter(function (x, i, a) { return (x === "trucks" || x === "office" || LB_ACCESS.indexOf(x) !== -1 || lists.indexOf(x) !== -1) && a.indexOf(x) === i; });
}

/* ---------------- leaderboard ---------------- */
// The team standings (see LEADERBOARD at the top). Each day's numbers are typed into the app; this tab keeps them as one
// row per document, in JSON: "config" (the teams on the board, their unit and months, and the sales goal) and one row per
// month ("2026-11": each day's truck numbers and technician sales, and the month's 5-star reviews). The app adds them up
// and ranks the teams.

const LB_SHEET = "Leaderboard";
const LB_COLS = ["key", "json", "updatedAt", "by"];
const LB_ACCESS = ["leaderboard", "leaderboard-import"];   // sees the standings; types the numbers and sets up the teams
const LB_UNITS = ["Cleaning", "Restoration"];
// What each person does (Employees): pay rates are set by role and person under Payroll
const LB_ROLES = ["assistant", "clean1", "clean2", "clean3", "rest1", "rest2", "rest3"];
const LB_PARTS = { t: 4, s: 5, r: 1 };   // a truck's day: jobs, work day, revenue, # of techs; a technician's day: up sale, add-on, rugs in plant, additional service, jobs; a team's 5-star reviews that day
// One cell holds 50,000 characters. A month typed as day totals is about 7,000; typed by job (each job's revenue,
// sales and crew) a busy month can pass 45,000, so the rest goes on in the cells after "by" (each starts with "~").
const LB_CELL = 45000, LB_MORE = 3;
const LB_MAX_JSON = LB_CELL * (1 + LB_MORE);
// A truck's jobs that day ("j": { "Aaron": [job, ...] }), each { v: revenue, s: [up sale, add-on, rugs in plant,
// additional service] (his sales on that job), w: [{ n: name, r: "tech" | "assistant", p: share % }] (who worked with
// him), e: 1 (equal split), c: 1 (the revenue credit is split too) }; his own share is 100 - the others'. Every change
// to a truck's jobs is kept on the "Job log" tab, so any job, person or split can be looked up later.
const LB_MAX_JOBS = 20, LB_MAX_CREW = 8;
const JOBLOG_SHEET = "Job log";
const JOBLOG_COLS = ["at", "by", "day", "truck", "jobs"];

function canLb_(user) { return canSee_(user, "leaderboard") || canSee_(user, "leaderboard-import"); }
function canLbEdit_(user) { return canSee_(user, "leaderboard-import"); }

/** The Leaderboard tab (made the first time something is saved). A tab of that name from an older layout is kept as
 *  "Leaderboard (old)". */
function lbSheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(LB_SHEET);
  if (s && String(s.getRange(1, 1).getValue()) !== "key") {
    if (!create) return null;
    s.setName(LB_SHEET + " (old " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HHmm") + ")");
    s = null;
  }
  if (!s && create) {
    s = ss.insertSheet(LB_SHEET);
    s.getRange(1, 1, 1, LB_COLS.length).setValues([LB_COLS]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange("A:B").setNumberFormat("@");   // plain text: a key like 2026-11 must not turn into a date
  }
  return s;
}
function lbRows_(s) {
  if (!s || s.getLastRow() < 2) return [];
  const w = Math.min(s.getMaxColumns(), LB_COLS.length + LB_MORE);
  return s.getRange(2, 1, s.getLastRow() - 1, w).getValues().map(function (r, i) {
    const first = String(r[1] || "");
    let json = first, long = false;
    for (let c = LB_COLS.length; c < w; c++) { const t = String(r[c] || ""); if (t) { long = true; json += t.charAt(0) === "~" ? t.slice(1) : t; } }
    // cells left over from before (an older script saved this row in one cell): the first cell alone is the month
    if (long) { try { JSON.parse(json); } catch (e) { try { JSON.parse(first); json = first; } catch (e2) { /* keep it all: nothing better */ } } }
    return { row: i + 2, key: String(r[0]).trim(), json: json, long: long };
  });
}
/** Saves a month (or the roster) in its row: the first 45,000 characters in "json", the rest in the cells after "by". */
function lbSaveRow_(s, byKey, key, text, now, by) {
  if (text.length > LB_MAX_JSON) throw new Error("The " + key + " numbers are too long to save.");
  const parts = [];
  for (let i = 0; i < text.length; i += LB_CELL) parts.push(text.slice(i, i + LB_CELL));
  if (!parts.length) parts.push("");
  if (byKey[key]) s.getRange(byKey[key].row, 2, 1, 3).setValues([[parts[0], now, by]]);
  else { appendRows_(s, LB_COLS.length, [[key, parts[0], now, by]]); byKey[key] = { row: s.getLastRow(), key: key }; }
  if (parts.length > 1 || byKey[key].long) {
    const more = [];
    for (let i = 1; i <= LB_MORE; i++) more.push(parts[i] ? "~" + parts[i] : "");
    if (s.getMaxColumns() < LB_COLS.length + LB_MORE) s.insertColumnsAfter(s.getMaxColumns(), LB_COLS.length + LB_MORE - s.getMaxColumns());
    s.getRange(byKey[key].row, LB_COLS.length + 1, 1, LB_MORE).setNumberFormat("@").setValues([more]);
  }
  byKey[key].long = parts.length > 1;
  byKey[key].json = text;
}
function lbParse_(text) {
  try { const o = JSON.parse(text || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch (e) { return {}; }
}
/** A team name: letters, spaces, apostrophes and dashes only (nothing can turn into a formula or split a field name). */
function lbTeam_(v) {
  const t = supText_(v, 30);
  return /^[A-Za-z][A-Za-z '-]*$/.test(t) ? t : "";
}
function lbYm_(v) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || "")) ? String(v) : ""; }
/** Deep merge, the way the app saves a change: objects merge, everything else (lists, numbers, null) replaces. */
function lbMerge_(a, b) {
  Object.keys(b || {}).forEach(function (k) {
    const v = b[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!a[k] || typeof a[k] !== "object" || Array.isArray(a[k])) a[k] = {};
      lbMerge_(a[k], v);
    } else a[k] = v;
  });
  return a;
}
function lbNums_(a, n) {
  if (!Array.isArray(a)) return null;
  const out = [];
  let any = false;
  for (let i = 0; i < n; i++) { const v = typeof a[i] === "number" && isFinite(a[i]) ? a[i] : null; out.push(v); if (v !== null) any = true; }
  return any ? out : null;
}
/** The roster, cleaned: each team once, a unit, the months it's on the board. */
function lbConfig_(c) {
  const out = { teams: [], goal: 3000 };
  const g = c && Number(c.goal);
  if (g > 0 && g < 1e7) out.goal = g;
  const seen = {};
  ((c && Array.isArray(c.teams)) ? c.teams : []).slice(0, 60).forEach(function (t) {
    const name = lbTeam_(t && t.name);
    if (!name || seen[name.toLowerCase()]) return;
    seen[name.toLowerCase()] = true;
    let from = lbYm_(t.from), to = lbYm_(t.to);
    if (from && to && to < from) to = from;
    const team = { name: name, unit: LB_UNITS.indexOf(t.unit) !== -1 ? t.unit : LB_UNITS[0], from: from, to: to };
    if (t.noSale === true) team.noSale = true;   // not on the technician sales goal (an estimator)
    if (LB_ROLES.indexOf(t.role) !== -1) team.role = t.role;
    out.teams.push(team);
  });
  // people on the reviews board only (helpers who get 5-star reviews but don't run a truck): never ranked
  const reviewers = [];
  ((c && Array.isArray(c.reviewers)) ? c.reviewers : []).slice(0, 30).forEach(function (r) {
    const name = lbTeam_(r && r.name);
    if (!name || seen[name.toLowerCase()]) return;
    seen[name.toLowerCase()] = true;
    const rv = { name: name, unit: LB_UNITS.indexOf(r.unit) !== -1 ? r.unit : LB_UNITS[0] };
    if (LB_ROLES.indexOf(r.role) !== -1) rv.role = r.role;
    reviewers.push(rv);
  });
  if (reviewers.length) out.reviewers = reviewers;
  return out;
}
/** A month, cleaned: only that month's days, team names, numbers, and who saved each day. */
function lbMonth_(d, key) {
  const out = { days: {}, reviews: {} };
  const days = d && d.days && typeof d.days === "object" ? d.days : {};
  Object.keys(days).forEach(function (day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.slice(0, 7) !== key) return;
    const x = days[day] && typeof days[day] === "object" ? days[day] : {};
    const y = {};
    Object.keys(LB_PARTS).forEach(function (p) {
      const m = {};
      Object.keys(x[p] && typeof x[p] === "object" ? x[p] : {}).forEach(function (team) {
        const name = lbTeam_(team), nums = lbNums_(x[p][team], LB_PARTS[p]);
        if (name && nums) m[name] = nums;
      });
      if (Object.keys(m).length) y[p] = m;
    });
    const jm = {};
    Object.keys(x.j && typeof x.j === "object" ? x.j : {}).forEach(function (team) {
      const name = lbTeam_(team), list = name ? lbJobs_(x.j[team], name) : null;
      if (list) jm[name] = list;
    });
    if (Object.keys(jm).length) y.j = jm;
    if (!y.t && !y.s && !y.r && !y.j) return;
    if (x.at) y.at = supText_(x.at, 30);
    if (x.by) y.by = supText_(x.by, 60);
    out.days[day] = y;
  });
  const rv = d && d.reviews && typeof d.reviews === "object" ? d.reviews : {};
  Object.keys(rv).forEach(function (team) {
    const name = lbTeam_(team);
    if (name && typeof rv[team] === "number" && isFinite(rv[team])) out.reviews[name] = rv[team];
  });
  if (d && d.rat) out.rat = supText_(d.rat, 30);
  if (d && d.rby) out.rby = supText_(d.rby, 60);
  return out;
}
/** A truck's jobs that day, cleaned: up to 20 jobs, each with its revenue (or blank), who worked with him (up to 8,
 *  never himself), their shares, the equal-split and revenue-credit marks. null when there are none. */
function lbJobs_(list, owner) {
  if (!Array.isArray(list)) return null;
  const out = [];
  list.slice(0, LB_MAX_JOBS).forEach(function (j) {
    if (!j || typeof j !== "object") return;
    const money = function (v) { return typeof v === "number" && isFinite(v) && v >= 0 && v <= 1e6 ? Math.round(v * 100) / 100 : null; };
    const job = { v: money(j.v) };
    const sales = [0, 1, 2, 3].map(function (i) { return money(Array.isArray(j.s) ? j.s[i] : null); });
    while (sales.length && sales[sales.length - 1] == null) sales.pop();
    if (sales.length) job.s = sales;
    const w = [];
    (Array.isArray(j.w) ? j.w : []).slice(0, LB_MAX_CREW).forEach(function (x) {
      const n = lbTeam_(x && x.n);
      if (!n || (owner && n.toLowerCase() === owner.toLowerCase()) || w.some(function (y) { return y.n.toLowerCase() === n.toLowerCase(); })) return;
      const e = { n: n };
      if (x.r === "tech" || x.r === "assistant") e.r = x.r;
      if (typeof x.p === "number" && isFinite(x.p) && x.p >= 0 && x.p <= 100) e.p = Math.round(x.p * 100) / 100;
      w.push(e);
    });
    if (w.length) { job.w = w; if (j.e) job.e = 1; if (j.c) job.c = 1; }
    out.push(job);
  });
  return out.length ? out : null;
}
function jobLogSheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(JOBLOG_SHEET);
  if (!s && create) {
    s = ss.insertSheet(JOBLOG_SHEET);
    s.getRange(1, 1, 1, JOBLOG_COLS.length).setValues([JOBLOG_COLS]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange("A:E").setNumberFormat("@");
  }
  return s;
}
/** The job log from day `from` to day `to`: every saved version of every truck's jobs, oldest first. */
function jobLog_(req) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.from || "")) ? String(req.from) : "0000-00-00";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.to || "")) ? String(req.to) : "9999-99-99";
  const s = jobLogSheet_(false);
  const rows = [];
  if (s && s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, JOBLOG_COLS.length).getValues().forEach(function (r) {
    const day = String(r[2]);
    if (day < from || day > to || rows.length >= 8000) return;
    let jobs = [];
    try { jobs = JSON.parse(String(r[4] || "[]")); } catch (e) { jobs = []; }
    rows.push({ at: String(r[0]), by: String(r[1]), day: day, truck: String(r[3]), jobs: Array.isArray(jobs) ? jobs : [] });
  });
  return { ok: true, rows: rows };
}
/** Everything for one year: the roster and that year's months. */
function lbRead_(user, year) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : String(new Date().getFullYear());
  const out = { ok: true, config: { teams: [], goal: 3000 }, months: {}, canEdit: canLbEdit_(user) };
  lbRows_(lbSheet_(false)).forEach(function (r) {
    if (r.key === "config") out.config = lbParse_(r.json);
    else if (lbYm_(r.key) && r.key.indexOf(y + "-") === 0) out.months[r.key] = lbParse_(r.json);
  });
  return out;
}
/** Saves changes: { writes: [{ key: "2026-11", patch }] } merges a change into that month (a blank entry clears it);
 *  { key, data } replaces the month or the roster ("config") whole. Each day changed is stamped with who saved it. */
function lbPut_(req) {
  const writes = (Array.isArray(req.writes) ? req.writes : []).slice(0, 14);
  const s = lbSheet_(true);
  const byKey = {};
  lbRows_(s).forEach(function (r) { byKey[r.key] = r; });
  const now = new Date().toISOString();
  const out = { ok: true, months: {} };
  const log = [];   // every truck-day whose jobs changed: [at, by, day, truck, jobs]
  writes.forEach(function (w) {
    const key = String((w && w.key) || "");
    const whole = w && w.data && typeof w.data === "object";
    const change = whole ? w.data : (w && w.patch && typeof w.patch === "object" ? w.patch : null);
    if (!change || (key !== "config" && !lbYm_(key))) return;
    let doc;
    if (key === "config") doc = lbConfig_(change);
    else {
      const before = byKey[key] ? lbMonth_(lbParse_(byKey[key].json), key) : { days: {} };
      doc = lbMerge_(whole ? {} : lbParse_(byKey[key] ? byKey[key].json : ""), change);
      if (!whole) {
        Object.keys(change.days && typeof change.days === "object" ? change.days : {}).forEach(function (day) {
          if (doc.days && doc.days[day] && typeof doc.days[day] === "object") { doc.days[day].at = now; doc.days[day].by = req.by; }
        });
        if (change.reviews) { doc.rat = now; doc.rby = req.by; }
      }
      doc = lbMonth_(doc, key);
      if (!whole) Object.keys(change.days && typeof change.days === "object" ? change.days : {}).forEach(function (day) {
        const cj = change.days[day] && change.days[day].j;
        if (!cj || typeof cj !== "object") return;
        Object.keys(cj).forEach(function (team) {
          const name = lbTeam_(team);
          if (!name) return;
          const was = JSON.stringify(((before.days[day] || {}).j || {})[name] || []), now2 = JSON.stringify(((doc.days[day] || {}).j || {})[name] || []);
          if (was !== now2) log.push([now, req.by, day, name, now2]);
        });
      });
    }
    if (key === "config") { doc.at = now; doc.by = req.by; }
    lbSaveRow_(s, byKey, key, JSON.stringify(doc), now, req.by);
    if (key === "config") out.config = doc; else out.months[key] = doc;
  });
  if (log.length) appendRows_(jobLogSheet_(true), JOBLOG_COLS.length, log);
  return out;
}

/* ---------------- office scorecards ---------------- */
// One row per document, in JSON, like the Leaderboard tab: "config" (the office people, which login each one is, the
// months she's in the office, her own list of numbers and the daily goal) and one row per month ("2026-11": each day,
// each person's numbers by field, and who saved them when).

const OF_SHEET = "Office";
const OF_KINDS = ["out", "num", "admin"];   // counts toward the outgoing calls goal; any other number; typed by Admins only

function ofSheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(OF_SHEET);
  if (!s && create) {
    s = ss.insertSheet(OF_SHEET);
    s.getRange(1, 1, 1, LB_COLS.length).setValues([LB_COLS]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange("A:B").setNumberFormat("@");
  }
  return s;
}
/** The people and their numbers, cleaned. */
function ofConfig_(c) {
  const out = { people: [], goal: 50 };
  const g = c && Number(c.goal);
  if (g > 0 && g <= 1000) out.goal = Math.round(g);
  const seen = {};
  ((c && Array.isArray(c.people)) ? c.people : []).slice(0, 40).forEach(function (p) {
    const name = lbTeam_(p && p.name);
    if (!name || seen[name.toLowerCase()]) return;
    seen[name.toLowerCase()] = true;
    let from = lbYm_(p.from), to = lbYm_(p.to);
    if (from && to && to < from) to = from;
    const user = /^[A-Za-z0-9_-]{1,64}$/.test(String(p.user || "")) ? String(p.user) : "";
    const ids = {}, fields = [];
    (Array.isArray(p.fields) ? p.fields : []).slice(0, 20).forEach(function (f) {
      const id = String((f && f.id) || "");
      if (!/^[a-z][a-z0-9]{0,15}$/.test(id) || id === "at" || id === "by" || ids[id]) return;
      const label = supText_(f.label, 40);
      if (!label) return;
      ids[id] = true;
      const field = { id: id, label: label, kind: OF_KINDS.indexOf(f.kind) !== -1 ? f.kind : "num", of: String(f.of || "") };
      if (f.hide === true) field.hide = true;   // past only: kept for the history, not typed any more
      fields.push(field);
    });
    fields.forEach(function (f) { if (!ids[f.of] || f.of === f.id) f.of = ""; });
    out.people.push({ name: name, user: user, from: from, to: to, fields: fields });
  });
  return out;
}
/** A month, cleaned: only that month's days, people, numbers (or blank), and who saved each person's day when. */
function ofMonth_(d, key) {
  const out = { days: {} };
  const days = d && d.days && typeof d.days === "object" ? d.days : {};
  Object.keys(days).forEach(function (day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.slice(0, 7) !== key) return;
    const x = days[day] && typeof days[day] === "object" ? days[day] : {};
    const y = {};
    Object.keys(x).forEach(function (name) {
      if (!lbTeam_(name) || !x[name] || typeof x[name] !== "object") return;
      const e = {};
      let any = false;
      Object.keys(x[name]).forEach(function (k) {
        const v = x[name][k];
        if (k === "at" || k === "by") { if (v) e[k] = supText_(v, 40); return; }
        if (/^[a-z][a-z0-9]{0,15}$/.test(k) && typeof v === "number" && isFinite(v) && v >= 0 && v <= 1e6) { e[k] = v; any = true; }
      });
      if (any) y[name] = e;
    });
    if (Object.keys(y).length) out.days[day] = y;
  });
  return out;
}
function ofRead_(user, year) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : String(new Date().getFullYear());
  const out = { ok: true, config: { people: [], goal: 50 }, months: {}, admin: user.role === "admin", me: user.id };
  lbRows_(ofSheet_(false)).forEach(function (r) {
    if (r.key === "config") out.config = lbParse_(r.json);
    else if (lbYm_(r.key) && r.key.indexOf(y + "-") === 0) out.months[r.key] = lbParse_(r.json);
  });
  return out;
}
/** Saves changes: { writes: [{ key: "2026-11", patch: { days: { day: { name: { field: n | null } } } } }] } merges into
 *  the month (null clears a box); Admins may also replace a month or the people ("config") whole ({ key, data }).
 *  Someone who isn't an Admin can change only her own day (the person linked to her login) and never an admin-only number. */
function ofPut_(req) {
  const admin = req.user.role === "admin";
  const writes = (Array.isArray(req.writes) ? req.writes : []).slice(0, 14);
  if (!admin && writes.some(function (w) { return w && (w.key === "config" || (w.data && typeof w.data === "object")); })) return { ok: false, error: "not_allowed" };
  const s = ofSheet_(true);
  const byKey = {};
  lbRows_(s).forEach(function (r) { byKey[r.key] = r; });
  const cfg = ofConfig_(byKey.config ? lbParse_(byKey.config.json) : {});
  const now = new Date().toISOString();
  const out = { ok: true, months: {} };
  writes.forEach(function (w) {
    const key = String((w && w.key) || "");
    const whole = w && w.data && typeof w.data === "object";
    let change = whole ? w.data : (w && w.patch && typeof w.patch === "object" ? w.patch : null);
    if (!change || (key !== "config" && !lbYm_(key))) return;
    let doc;
    if (key === "config") { doc = ofConfig_(change); doc.at = now; doc.by = req.by; }
    else {
      if (!whole) {
        // only her own person and fields she may type; every person's day changed is stamped
        const days = {};
        Object.keys(change.days && typeof change.days === "object" ? change.days : {}).forEach(function (day) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.slice(0, 7) !== key) return;
          const x = change.days[day] && typeof change.days[day] === "object" ? change.days[day] : {};
          Object.keys(x).forEach(function (name) {
            const p = cfg.people.filter(function (q) { return q.name.toLowerCase() === String(name).toLowerCase(); })[0];
            if (!p || (!admin && p.user !== req.user.id) || !x[name] || typeof x[name] !== "object") return;
            const e = {};
            p.fields.forEach(function (f) {
              if (!(f.id in x[name]) || (f.kind === "admin" && !admin)) return;
              const v = x[name][f.id];
              e[f.id] = typeof v === "number" && isFinite(v) && v >= 0 && v <= 1e6 ? v : null;
            });
            if (!Object.keys(e).length) return;
            e.at = now; e.by = req.by;
            (days[day] || (days[day] = {}))[p.name] = e;
          });
        });
        change = { days: days };
      }
      doc = ofMonth_(lbMerge_(whole ? {} : lbParse_(byKey[key] ? byKey[key].json : ""), change), key);
    }
    lbSaveRow_(s, byKey, key, JSON.stringify(doc), now, req.by);
    if (key === "config") out.config = doc; else out.months[key] = doc;
  });
  return out;
}

/* ---------------- payroll ---------------- */
// Pay is kept on its own tab, read and written only by admins switched on for Payroll (see setPayroll_): the
// technicians' and the numbers typers' app never loads it. "rates": each person's pay: day rate, commission % on
// revenue and on each kind of sale, and his share of a shared job (%).
const PAY_SHEET = "Payroll";
const PAY_FIELDS = ["day", "rev", "up", "addon", "rugs", "extra", "share"];
function canPay_(user) { return !!user && user.role === "admin" && parseAccess_(user.access).indexOf(PAYROLL) !== -1; }
function paySheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(PAY_SHEET);
  if (!s && create) {
    s = ss.insertSheet(PAY_SHEET);
    s.getRange(1, 1, 1, LB_COLS.length).setValues([LB_COLS]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange("A:B").setNumberFormat("@");
  }
  return s;
}
/** Each person's pay, cleaned: a day rate up to $10,000 and percentages 0-100, blank when not set. */
function payRates_(r) {
  const out = { people: {} };
  const people = r && r.people && typeof r.people === "object" ? r.people : {};
  Object.keys(people).slice(0, 80).forEach(function (n) {
    const name = lbTeam_(n), x = people[n];
    if (!name || !x || typeof x !== "object") return;
    const e = {};
    PAY_FIELDS.forEach(function (f) {
      const v = x[f];
      if (typeof v === "number" && isFinite(v) && v >= 0 && v <= (f === "day" ? 10000 : 100)) e[f] = Math.round(v * 100) / 100;
    });
    if (Object.keys(e).length) out.people[name] = e;
  });
  return out;
}
function payRead_() {
  const out = { ok: true, rates: { people: {} } };
  lbRows_(paySheet_(false)).forEach(function (r) { if (r.key === "rates") out.rates = lbParse_(r.json); });
  return out;
}
/** { rates: { people: { "Aaron": { day: 120, up: 25, ... } } } } replaces the pay rates whole. */
function payPut_(req) {
  const s = paySheet_(true);
  const doc = payRates_(req.rates);
  const now = new Date().toISOString();
  doc.at = now; doc.by = req.by;
  const text = JSON.stringify(doc);
  const row = lbRows_(s).filter(function (r) { return r.key === "rates"; })[0];
  if (row) s.getRange(row.row, 2, 1, 3).setValues([[text, now, req.by]]);
  else appendRows_(s, LB_COLS.length, [["rates", text, now, req.by]]);
  return { ok: true, rates: doc };
}

/* ---------------- weekly backup ---------------- */

const BACKUP_FOLDER = "VODA Prime backups";
const BACKUP_KEEP = 12;

/** Run once: a full copy of this sheet every Sunday around 2 AM, newest 12 kept. Makes the first one now. */
function backupSetup() {
  backupSchedule_();
  const name = backupNow();
  Logger.log('Weekly backup is on: every Sunday around 2 AM into the Drive folder "' + BACKUP_FOLDER + '" (newest ' + BACKUP_KEEP + ' kept). First backup made: ' + name);
}
function backupStop() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "backupNow") { ScriptApp.deleteTrigger(tr); n++; } });
  Logger.log(n ? "Weekly backup stopped. The backups already made stay in Drive." : "Weekly backup wasn't on.");
}
function backupSchedule_() {
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "backupNow") ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger("backupNow").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).create();
}
/** A copy of the whole sheet in the backups folder; older ones beyond the newest 12 go to the Drive trash. */
function backupNow() {
  const ss = SpreadsheetApp.getActive();
  const it = DriveApp.getFoldersByName(BACKUP_FOLDER);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER);
  const prefix = ss.getName() + " backup ";
  const name = prefix + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  DriveApp.getFileById(ss.getId()).makeCopy(name, folder);
  const files = [];
  const fi = folder.getFiles();
  while (fi.hasNext()) { const f = fi.next(); if (f.getName().indexOf(prefix) === 0) files.push(f); }
  files.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  files.slice(BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });
  return name;
}

/* ---------------- moving to another Google account ---------------- */
// See MOVING TO ANOTHER GOOGLE ACCOUNT at the top. Settings travel in the "Move settings" tab, each value stored as JSON
// text so nothing in it can turn into a formula.

const MOVE_TAB = "Move settings";
const MOVE_JOBS = ["gpsSync", "tmCheckEmail", "paperworkEmail", "backupNow"];

/** Old sheet: save the settings and jobs, stop the jobs, and pause this copy of the app. */
function moveOut() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty("MOVED")) throw new Error('This sheet was already moved out. To undo, run "moveCancel".');
  const props = p.getProperties();
  const jobs = moveJobsOn_();
  const ss = SpreadsheetApp.getActive();
  const old = ss.getSheetByName(MOVE_TAB);
  if (old) ss.deleteSheet(old);
  const s = ss.insertSheet(MOVE_TAB);
  const rows = [["Setting", "Value (don't edit)"]].concat(Object.keys(props).sort().map(function (k) { return [k, JSON.stringify(props[k])]; }),
    [["__JOBS__", JSON.stringify(jobs.join(","))], ["__FROM__", JSON.stringify(Session.getEffectiveUser().getEmail())], ["__AT__", JSON.stringify(new Date().toISOString())]]);
  if (s.getMaxColumns() < 2) s.insertColumnsAfter(s.getMaxColumns(), 2 - s.getMaxColumns());
  appendRows_(s, 2, rows);
  s.getRange(1, 1, 1, 2).setFontWeight("bold");
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (MOVE_JOBS.indexOf(tr.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(tr); });
  p.setProperty("MOVED", new Date().toISOString());
  Logger.log("Ready to move: " + Object.keys(props).length + " settings and " + (jobs.length ? "these automatic jobs: " + jobs.join(", ") : "no automatic jobs") +
    ' are saved in the "' + MOVE_TAB + '" tab. This copy of the app is paused. Next: as the new account, File > Make a copy, then run moveIn in the copy.');
}

/** The copy, as the new account: load the settings, turn the same jobs on, delete the move tab. */
function moveIn() {
  const ss = SpreadsheetApp.getActive();
  const s = ss.getSheetByName(MOVE_TAB);
  if (!s || s.getLastRow() < 2) throw new Error('No "' + MOVE_TAB + '" tab here. Run moveOut in the old sheet first, then make the copy and run moveIn in the copy.');
  const saved = moveRead_(s);
  if (!saved.props.SESSION_SECRET || !saved.props.ACCESS_CODE) throw new Error('The "' + MOVE_TAB + '" tab is missing the sign-in settings, so nothing was changed. Run moveOut in the old sheet again and make a new copy.');
  const p = PropertiesService.getScriptProperties();
  p.setProperties(saved.props, false);
  p.deleteProperty("MOVED");
  saved.jobs.forEach(moveJob_);
  ss.deleteSheet(s);
  Logger.log("Moved in from " + (saved.from || "the old account") + ": " + Object.keys(saved.props).length + " settings loaded" +
    (saved.jobs.length ? ", automatic jobs back on: " + saved.jobs.join(", ") : "") +
    ". Next: Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone) and put the new URL in config.js.");
}

/** Old sheet, if you change your mind before switching the app over: un-pause it and turn its jobs back on. */
function moveCancel() {
  const ss = SpreadsheetApp.getActive();
  const s = ss.getSheetByName(MOVE_TAB);
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty("MOVED")) { Logger.log("This sheet isn't paused; nothing to undo."); return; }
  const jobs = s ? moveRead_(s).jobs : [];
  p.deleteProperty("MOVED");
  jobs.forEach(moveJob_);
  if (s) ss.deleteSheet(s);
  Logger.log("Move cancelled: this sheet is live again" + (jobs.length ? " and these jobs are back on: " + jobs.join(", ") : "") + ".");
}

function moveJobsOn_() {
  return ScriptApp.getProjectTriggers().map(function (tr) { return tr.getHandlerFunction(); })
    .filter(function (x, i, a) { return MOVE_JOBS.indexOf(x) !== -1 && a.indexOf(x) === i; });
}
function moveRead_(s) {
  const out = { props: {}, jobs: [], from: "" };
  s.getRange(2, 1, s.getLastRow() - 1, 2).getValues().forEach(function (r) {
    const k = String(r[0] || "").trim();
    if (!k) return;
    let v;
    try { v = JSON.parse(String(r[1])); } catch (e) { v = String(r[1]); }
    if (k === "__JOBS__") out.jobs = String(v || "").split(",").filter(function (j) { return MOVE_JOBS.indexOf(j) !== -1; });
    else if (k === "__FROM__") out.from = String(v || "");
    else if (k.indexOf("__") !== 0 && k !== "MOVED") out.props[k] = String(v === null || v === undefined ? "" : v);
  });
  return out;
}
/** Turns one automatic job on with the same schedule its own setup uses. */
function moveJob_(name) {
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === name) ScriptApp.deleteTrigger(tr); });
  if (name === "gpsSync") ScriptApp.newTrigger("gpsSync").timeBased().everyMinutes(15).create();
  else if (name === "tmCheckEmail") tmCheckSchedule_();
  else if (name === "paperworkEmail") ScriptApp.newTrigger("paperworkEmail").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  else if (name === "backupNow") backupSchedule_();
}
