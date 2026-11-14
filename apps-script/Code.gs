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
const API_VERSION = 51;        // the app warns when the deployed web app is older than it expects
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

/** The settings every request looks at (paused? set up? the sign-in secret), read from Google once a request. */
let REQ_PROPS_ = null;
function reqProp_(k) {
  if (!REQ_PROPS_) REQ_PROPS_ = PropertiesService.getScriptProperties().getProperties() || {};
  const v = REQ_PROPS_[k];
  return v === undefined || v === null || v === "" ? null : String(v);
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e && e.postData ? e.postData.contents : "{}");
  } catch (err) {
    return json_({ ok: false, error: "bad_request" });
  }
  // After moveOut this copy is paused: phones keep their unsent changes and send them to the new home once they reopen.
  REQ_PROPS_ = null;
  if (reqProp_("MOVED")) return json_({ ok: false, error: "moved" });
  if (!reqProp_("ACCESS_CODE")) return json_({ ok: false, error: "not_set_up" });
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
        return json_(lbRead_(user, req.year, req.since));
      case "lbPut":
        if (!canLbReviews_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return lbPut_(req, !canLbEdit_(user), lbRvOnly_(user)); }));
      case "lbRename":
        if (!canLbEdit_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return lbRename_(req); }));
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
      case "hcpTest":
        return json_(hcpTest_(req));
      case "revenue":
        if (!canSee_(user, "revenue") && !canSee_(user, "marketing")) return json_({ ok: false, error: "not_allowed" });
        return json_(revPrivate_(revRead_(req.year), user));
      case "revSync":
        if (!canSee_(user, "revenue") && !canSee_(user, "marketing")) return json_({ ok: false, error: "not_allowed" });
        return json_(revPrivate_(revSync_(req), user));
      case "marketing":
        if (!canSee_(user, "marketing")) return json_({ ok: false, error: "not_allowed" });
        return json_(mktRead_());
      case "mktPut":
        if (!canSee_(user, "marketing")) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return mktPut_(req, user); }));
      case "mktImport":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return mktImport_(req, user); }));
      case "repairs":
        if (!canSee_(user, "repairs")) return json_({ ok: false, error: "not_allowed" });
        return json_(repRead_(req.year));
      case "repSync":
        if (!canSee_(user, "repairs")) return json_({ ok: false, error: "not_allowed" });
        return json_(repSync_(req));
      case "repPut":
        if (!canSee_(user, "repairs")) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return repPut_(req, user); }));
      case "repMonInv":
        if (!canSee_(user, "repairs")) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return repMonInv_(req, user); }));
      case "repClearPaid":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return repClearPaid_(user); }));
      case "repImport":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return repImport_(req, user); }));
      case "cpRead":
        if (!canCp_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(cpRead_());
      case "cpParties":
        if (!canCp_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return cpPartiesPut_(req); }));
      case "cpFile":
        if (!canCp_(user) || !canSee_(user, "repairs")) return json_({ ok: false, error: "not_allowed" });
        return json_(cpFile_(req));
      case "cpSend":
        if (!canCp_(user) || !canSee_(user, "repairs")) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return cpSend_(req, user); }));
      case "cpPay":
        if (!canCp_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return cpPay_(req, user); }));
      case "cpCancel":
        if (!canCp_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return cpCancel_(req, user); }));
      case "cpResend":
        if (!canCp_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return cpResend_(req); }));
      case "cpDelete":
        if (!canCp_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return cpDelete_(req); }));
      case "cpDoc":
        if (!canCp_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(cpDoc_(req));
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
const ADMIN_ACTIONS = ["hcpTest", "deleteTruck", "saveService", "deleteService", "users", "invite", "saveUser", "resetUser", "setPayroll", "setShop",
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
  const had = REQ_PROPS_ ? reqProp_("SESSION_SECRET") : null;   // already read with this request's settings
  if (had) return had;
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
// Users tab, column M (access): what a technician sees, comma-separated: "trucks", "leaderboard", "leaderboard-import",
// "leaderboard-reviews" (types the 5-star reviews and sees nothing else of the leaderboard), "office" and/or checklist IDs.
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
  return raw.map(String).filter(function (x, i, a) { return (x === "trucks" || x === "office" || x === "revenue" || x === "repairs" || x === "marketing" || x === "contractors" || LB_ACCESS.indexOf(x) !== -1 || lists.indexOf(x) !== -1) && a.indexOf(x) === i; });
}

/* ---------------- leaderboard ---------------- */
// The team standings (see LEADERBOARD at the top). Each day's numbers are typed into the app; this tab keeps them as one
// row per document, in JSON: "config" (the teams on the board, their unit and months, and the sales goal) and one row per
// month ("2026-11": each day's truck numbers and technician sales, and the month's 5-star reviews). The app adds them up
// and ranks the teams.

const LB_SHEET = "Leaderboard";
const LB_COLS = ["key", "json", "updatedAt", "by"];
const LB_ACCESS = ["leaderboard", "leaderboard-import", "leaderboard-reviews"];   // sees the standings; types the numbers and sets up the teams; types the 5-star reviews
const LB_UNITS = ["Cleaning", "Restoration"];
// What each person does (Employees): pay rates are set by role and person under Payroll
const LB_ROLES = ["assistant", "clean1", "clean2", "clean3", "rest1", "rest2", "rest3"];
const LB_PARTS = { t: 4, s: 5, r: 1 };   // a truck's day: jobs, work day, revenue, # of techs; a technician's day: up sale, add-on, rugs in plant, additional service, jobs; a team's 5-star reviews that day
// One cell holds 50,000 characters. A month typed as day totals is about 7,000; typed by job (each job's revenue,
// sales and crew) a busy month can pass 45,000, so the rest goes on in the cells after "by" (each starts with "~").
const LB_CELL = 45000, LB_MORE = 3;
const LB_MAX_JSON = LB_CELL * (1 + LB_MORE);
// A truck's jobs that day ("j": { "Aaron": [job, ...] }), each { v: revenue, s: [up sale, add-on, rugs in plant,
// additional service] (his sales on that job), w: [{ n: name, r: "tech" | "assistant", p, a, q, b }] (who worked with
// him), x: how its revenue is split ("e" equally, "p" by each helper's p %, "a" by each helper's a dollars; none: not
// split), y: how its sales are split ("e", "p" by each helper's q %, "a" by each helper's b dollars of each kind) }.
// The truck keeps what the helpers don't get. Jobs saved before the separate splits have e: 1 (equal), c: 1 (revenue
// split), d: 1 (sales split) and one p % for both; they're kept as they are and the app reads them the same way.
// Every change to a truck's jobs is kept on the "Job log" tab, so any job, person or split can be looked up later.
const LB_MAX_JOBS = 20, LB_MAX_CREW = 8;
const JOBLOG_SHEET = "Job log";
const JOBLOG_COLS = ["at", "by", "day", "truck", "jobs"];

function canLb_(user) { return canSee_(user, "leaderboard") || canSee_(user, "leaderboard-import") || canSee_(user, "leaderboard-reviews"); }
function canLbEdit_(user) { return canSee_(user, "leaderboard-import"); }
/** Types the 5-star reviews (and saves nothing else). */
function canLbReviews_(user) { return canLbEdit_(user) || canSee_(user, "leaderboard-reviews"); }
/** Sees only the reviews: no standings, no revenue, no sales. */
function lbRvOnly_(user) { return !canSee_(user, "leaderboard") && !canLbEdit_(user) && canSee_(user, "leaderboard-reviews"); }
/** A month as a reviews-only person gets it: each day's 5-star reviews and the month's typed totals, nothing else. */
function lbRvView_(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const out = { days: {}, reviews: doc.reviews || {} };
  Object.keys(doc.days || {}).forEach(function (day) { const d = doc.days[day]; if (d && d.r) out.days[day] = { r: d.r }; });
  if (doc.rat) out.rat = doc.rat;
  if (doc.rby) out.rby = doc.rby;
  return out;
}
/** What a reviews-only person may save: each day's 5-star reviews and the month's typed totals. Null: nothing. */
function lbRvPatch_(patch) {
  if (!patch || typeof patch !== "object") return null;
  const out = {};
  Object.keys(patch.days && typeof patch.days === "object" ? patch.days : {}).forEach(function (day) {
    const d = patch.days[day];
    if (d && typeof d === "object" && d.r && typeof d.r === "object") (out.days || (out.days = {}))[day] = { r: d.r };
  });
  if (patch.reviews && typeof patch.reviews === "object") out.reviews = patch.reviews;
  return Object.keys(out).length ? out : null;
}

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
  return s.getRange(2, 1, s.getLastRow() - 1, w).getValues().map(function (r, i) { return lbRowOf_(r, i + 2, w); });
}
/** One row of the tab as { row, key, json, long }: the month's text from its "json" cell and the cells after "by". */
function lbRowOf_(r, row, w) {
  const first = String(r[1] || "");
  let json = first, long = false;
  for (let c = LB_COLS.length; c < w; c++) { const t = String(r[c] || ""); if (t) { long = true; json += t.charAt(0) === "~" ? t.slice(1) : t; } }
  // cells left over from before (an older script saved this row in one cell): the first cell alone is the month
  if (long) { try { JSON.parse(json); } catch (e) { try { JSON.parse(first); json = first; } catch (e2) { /* keep it all: nothing better */ } } }
  return { row: row, key: String(r[0]).trim(), json: json, long: long };
}
/** Which row holds which key, from the narrow first column alone: [{ row, key }]. Null when there's no tab, or it
 *  isn't in this layout (its first cell isn't "key"). Reading a month's text is the slow part; this isn't. */
function lbKeys_(s) {
  if (!s) return null;
  const last = s.getLastRow();
  if (last < 1) return null;
  const col = s.getRange(1, 1, last, 1).getValues();
  if (String(col[0][0]) !== "key") return null;
  const out = [];
  for (let i = 1; i < col.length; i++) out.push({ row: i + 1, key: String(col[i][0]).trim() });
  return out;
}
/** Those rows read in full, as lbRows_ gives them. Rows next to each other come in one read; when they're scattered
 *  over more than a few places the whole tab is read once instead. */
function lbRowsAt_(s, list) {
  if (!list.length) return [];
  const rows = list.slice().sort(function (a, b) { return a.row - b.row; });
  const blocks = [];
  rows.forEach(function (r) {
    const b = blocks[blocks.length - 1];
    if (b && r.row - b.to <= 3) b.to = r.row; else blocks.push({ from: r.row, to: r.row });   // a row or two between is read along
  });
  if (blocks.length > 4) { const want = {}; rows.forEach(function (r) { want[r.row] = true; }); return lbRows_(s).filter(function (r) { return want[r.row]; }); }
  const w = Math.min(s.getMaxColumns(), LB_COLS.length + LB_MORE), out = [];
  blocks.forEach(function (b) {
    const vals = s.getRange(b.from, 1, b.to - b.from + 1, w).getValues();
    rows.forEach(function (r) { if (r.row >= b.from && r.row <= b.to) out.push(lbRowOf_(vals[r.row - b.from], r.row, w)); });
  });
  return out;
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
function lbDay_(v) { return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(v || "")) ? String(v) : ""; }
/** An email address or "" (plain enough that it can't turn into a formula or break a field). */
function lbEmail_(v) {
  const s = supText_(v, 100);
  return /^[^\s@<>"',;=]+@[^\s@<>"',;=]+\.[A-Za-z]{2,}$/.test(s) ? s : "";
}
/** A phone number or "": digits with spaces, dots, dashes, brackets and a leading +, at least 7 digits. */
function lbPhone_(v) {
  const s = supText_(v, 25);
  return /^\+?[0-9(][0-9 ().-]*$/.test(s) && s.replace(/\D/g, "").length >= 7 ? s : "";
}
/** A person's contact details and former names (Employees), cleaned onto `p`: email, phone, and aka: the names he had
 *  before a rename, so an Excel copy of the old sheets still counts for him. */
function lbPerson_(p, raw) {
  if (lbEmail_(raw && raw.email)) p.email = lbEmail_(raw.email);
  if (lbPhone_(raw && raw.phone)) p.phone = lbPhone_(raw.phone);
  const aka = [];
  ((raw && Array.isArray(raw.aka)) ? raw.aka : []).slice(0, 8).forEach(function (n) {
    const a = lbTeam_(n);
    if (a && a.toLowerCase() !== p.name.toLowerCase() && !aka.some(function (x) { return x.toLowerCase() === a.toLowerCase(); })) aka.push(a);
  });
  if (aka.length) p.aka = aka;
  return p;
}
/** The roster, cleaned: each team once, a unit, the months it's on the board, and the exact days set in Employees:
 *  on / off = his first / last day on the leaderboard, left = his last day with the company, was = earlier stretches
 *  on the leaderboard [[first day, last day], ...]. */
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
    if (lbDay_(t.on)) team.on = lbDay_(t.on);
    if (lbDay_(t.off)) team.off = lbDay_(t.off);
    if (lbDay_(t.left)) team.left = lbDay_(t.left);
    const was = [];
    (Array.isArray(t.was) ? t.was : []).slice(0, 8).forEach(function (w) {
      if (Array.isArray(w) && lbDay_(w[1])) was.push([lbDay_(w[0]), lbDay_(w[1])]);
    });
    if (was.length) team.was = was;
    if (t.noSale === true) team.noSale = true;   // not on the technician sales goal (an estimator)
    if (LB_ROLES.indexOf(t.role) !== -1) team.role = t.role;
    out.teams.push(lbPerson_(team, t));
  });
  // people on the reviews board only (helpers who get 5-star reviews but don't run a truck): never ranked
  const reviewers = [];
  ((c && Array.isArray(c.reviewers)) ? c.reviewers : []).slice(0, 30).forEach(function (r) {
    const name = lbTeam_(r && r.name);
    if (!name || seen[name.toLowerCase()]) return;
    seen[name.toLowerCase()] = true;
    const rv = { name: name, unit: LB_UNITS.indexOf(r.unit) !== -1 ? r.unit : LB_UNITS[0] };
    if (LB_ROLES.indexOf(r.role) !== -1) rv.role = r.role;
    reviewers.push(lbPerson_(rv, r));
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
    // who helped on a day total (a day typed as its number of jobs and revenue, not job by job)
    const hm = {};
    Object.keys(x.h && typeof x.h === "object" ? x.h : {}).forEach(function (team) {
      const name = lbTeam_(team), list = name ? lbDayHelp_(x.h[team], name) : null;
      if (list) hm[name] = list;
    });
    if (Object.keys(hm).length) y.h = hm;
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
 *  never himself) and how the revenue and the sales are split (today's marks and shares, or the older ones as they
 *  were sent). null when there are none. */
/** Who helped on a truck's day total, cleaned: [{ n, r, j, a, b }]: his name and role, the jobs he was on (0 to 99),
 *  his part of the day's revenue in dollars and of each kind of sale. Never the truck himself, nobody twice. Null
 *  when nobody's left. */
function lbDayHelp_(list, owner) {
  if (!Array.isArray(list)) return null;
  const money = function (v) { return typeof v === "number" && isFinite(v) && v >= 0 && v <= 1e6 ? Math.round(v * 100) / 100 : null; };
  const out = [];
  list.slice(0, LB_MAX_CREW).forEach(function (h) {
    const n = lbTeam_(h && h.n);
    if (!n || (owner && n.toLowerCase() === owner.toLowerCase()) || out.some(function (o) { return o.n.toLowerCase() === n.toLowerCase(); })) return;
    const e = { n: n };
    if (h.r === "tech" || h.r === "assistant") e.r = h.r;
    if (typeof h.j === "number" && isFinite(h.j) && h.j >= 0 && h.j <= 99) e.j = Math.round(h.j * 100) / 100;
    if (money(h.a) != null) e.a = money(h.a);
    if (Array.isArray(h.b)) { const b = [0, 1, 2, 3].map(function (k) { return money(h.b[k]); }); while (b.length && b[b.length - 1] == null) b.pop(); if (b.length) e.b = b; }
    out.push(e);
  });
  return out.length ? out : null;
}
/** A truck's day total as the job log keeps it: one line that stands for the day (k: "day"), with its revenue, its
 *  sales, and who helped with their dollars. [] when the day is typed by job or has no total. */
function lbDayJobLog_(d, name) {
  if (!d || typeof d !== "object" || (((d.j || {})[name]) || []).length) return [];
  const t = (d.t || {})[name], s = (d.s || {})[name], hl = (d.h || {})[name];
  if (!Array.isArray(t)) return [];
  const job = { v: typeof t[2] === "number" ? t[2] : null };
  const sales = Array.isArray(s) ? s.slice(0, 4).map(function (v) { return typeof v === "number" ? v : null; }) : [];
  while (sales.length && sales[sales.length - 1] == null) sales.pop();
  if (sales.length) job.s = sales;
  if (Array.isArray(hl) && hl.length) { job.w = hl; job.x = "a"; job.y = "a"; }
  job.k = "day";
  return [job];
}
function lbJobs_(list, owner) {
  if (!Array.isArray(list)) return null;
  const out = [];
  const money = function (v) { return typeof v === "number" && isFinite(v) && v >= 0 && v <= 1e6 ? Math.round(v * 100) / 100 : null; };
  const pct = function (v) { return typeof v === "number" && isFinite(v) && v >= 0 && v <= 100 ? Math.round(v * 100) / 100 : null; };
  const mode = function (v) { return v === "e" || v === "p" || v === "a" ? v : ""; };
  const trim = function (a) { while (a.length && a[a.length - 1] == null) a.pop(); return a; };
  list.slice(0, LB_MAX_JOBS).forEach(function (j) {
    if (!j || typeof j !== "object") return;
    const job = { v: money(j.v) };
    const sales = trim([0, 1, 2, 3].map(function (i) { return money(Array.isArray(j.s) ? j.s[i] : null); }));
    if (sales.length) job.s = sales;
    const x = mode(j.x), y = mode(j.y), now = !!(x || y);   // today's format; else the older marks (e, c, d, one p)
    const w = [];
    (Array.isArray(j.w) ? j.w : []).slice(0, LB_MAX_CREW).forEach(function (h) {
      const n = lbTeam_(h && h.n);
      if (!n || (owner && n.toLowerCase() === owner.toLowerCase()) || w.some(function (o) { return o.n.toLowerCase() === n.toLowerCase(); })) return;
      const e = { n: n };
      if (h.r === "tech" || h.r === "assistant") e.r = h.r;
      if ((!now || x === "p") && pct(h.p) != null) e.p = pct(h.p);
      if (x === "a" && money(h.a) != null) e.a = money(h.a);
      if (y === "p" && pct(h.q) != null) e.q = pct(h.q);
      if (y === "a" && Array.isArray(h.b)) { const b = trim([0, 1, 2, 3].map(function (k) { return money(h.b[k]); })); if (b.length) e.b = b; }
      w.push(e);
    });
    if (w.length) {
      job.w = w;
      if (now) { if (x) job.x = x; if (y) job.y = y; }
      else { if (j.e) job.e = 1; if (j.c) job.c = 1; if (j.d) job.d = 1; }
    }
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
/** The roster and one year's months. Only that year's rows are read, not every year's.
 *  since (the "stamp" of an earlier answer): only the rows saved after it come back, with since echoed, so an app that
 *  already has the numbers can ask often and gets a few bytes when nothing changed. stamp: the newest save on the tab. */
function lbRead_(user, year, since) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : String(new Date().getFullYear());
  const ask = typeof since === "string" && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(since) ? since : "";
  const out = { ok: true, config: { teams: [], goal: 3000 }, months: {}, canEdit: canLbEdit_(user), stamp: "" };
  if (ask) { out.since = ask; delete out.config; }
  const s = SpreadsheetApp.getActive().getSheetByName(LB_SHEET);
  const keys = lbKeys_(s);
  if (!keys || !keys.length) return out;
  const ats = s.getRange(2, 3, keys.length, 1).getValues();   // when each row was last saved
  keys.forEach(function (k, i) { k.at = isDate_(ats[i][0]) ? ats[i][0].toISOString() : String(ats[i][0] || ""); if (k.at > out.stamp) out.stamp = k.at; });
  const want = keys.filter(function (k) { return (k.key === "config" || (lbYm_(k.key) && k.key.indexOf(y + "-") === 0)) && (!ask || k.at > ask); });
  lbRowsAt_(s, want).forEach(function (r) {
    if (r.key === "config") out.config = lbParse_(r.json);
    else out.months[r.key] = lbParse_(r.json);
  });
  // someone who only types the reviews gets only the reviews
  if (lbRvOnly_(user)) Object.keys(out.months).forEach(function (k) { out.months[k] = lbRvView_(out.months[k]); });
  // emails and phone numbers go only to those who set up the people (admins, Leaderboard numbers)
  if (!out.canEdit && out.config) (out.config.teams || []).concat(out.config.reviewers || []).forEach(function (p) { if (p) { delete p.email; delete p.phone; } });
  return out;
}
/** A roster being saved keeps what the app that sent it doesn't know about: a person sent without an email, phone or
 *  former-names field at all (an app not refreshed yet) keeps the ones on file. Sent blank, they're cleared. */
function lbKeepPeople_(doc, raw, before) {
  const sent = {}, had = {};
  ((raw && Array.isArray(raw.teams)) ? raw.teams : []).concat((raw && Array.isArray(raw.reviewers)) ? raw.reviewers : []).forEach(function (p) { const n = lbTeam_(p && p.name).toLowerCase(); if (n && !sent[n]) sent[n] = p; });
  ((before && before.teams) || []).concat((before && before.reviewers) || []).forEach(function (p) { if (p && p.name) had[String(p.name).toLowerCase()] = p; });
  doc.teams.concat(doc.reviewers || []).forEach(function (p) {
    const s = sent[p.name.toLowerCase()] || {}, h = had[p.name.toLowerCase()];
    if (!h) return;
    ["email", "phone", "aka"].forEach(function (f) { if (s[f] === undefined && h[f] !== undefined && p[f] === undefined) p[f] = h[f]; });
  });
  return doc;
}
/** Renames a person everywhere, in one step: the roster (his old name is kept as a former name), every month of every
 *  year (his truck days, sales, reviews, jobs, and the jobs he helped on), the pay rates and the job log.
 *  { from, to } → { ok, config, months: how many months changed }. Refused when the new name is someone else's.
 *  The roster is saved first, so a rename cut off part way is finished by asking for it again. */
function lbRename_(req) {
  const from = lbTeam_(req.from), to = lbTeam_(req.to);
  if (!from || !to || from === to) return { ok: false, error: "bad_request" };
  const s = lbSheet_(false);
  if (!s) return { ok: false, error: "not_found" };
  const lf = from.toLowerCase(), lt = to.toLowerCase(), other = lf !== lt;
  const rows = lbRows_(s), byKey = {};
  rows.forEach(function (r) { byKey[r.key] = r; });
  const cfg = lbConfig_(lbParse_(byKey.config ? byKey.config.json : ""));
  const people = cfg.teams.concat(cfg.reviewers || []);
  let who = people.filter(function (p) { return p.name.toLowerCase() === lf; })[0];
  // a rename that was cut off part way (the roster already has the new name, some months still the old one) is
  // finished by asking for it again
  let resume = false;
  if (!who) {
    who = people.filter(function (p) { return p.name.toLowerCase() === lt && (p.aka || []).some(function (a) { return a.toLowerCase() === lf; }); })[0];
    if (!who) return { ok: false, error: "not_found" };
    resume = true;
  }
  if (!resume && other && people.some(function (p) { return p.name.toLowerCase() === lt; })) return { ok: false, error: "name_in_use" };
  // a name → the new one when it's his; `clash` when the new name is already on something (numbers left by someone
  // who isn't in Employees)
  let clash = false;
  const is = function (n) { return String(n).toLowerCase() === lf; };
  const taken = function (n) { return !resume && other && String(n).toLowerCase() === lt; };
  const keys = function (m) {   // an object keyed by name
    if (!m || typeof m !== "object" || Array.isArray(m)) return false;
    let changed = false;
    Object.keys(m).forEach(function (k) {
      if (taken(k)) clash = true;
      else if (is(k) && k !== to) { m[to] = m[k]; delete m[k]; changed = true; }
    });
    return changed;
  };
  const crew = function (jobs) {   // the helpers on a list of jobs
    let changed = false;
    (Array.isArray(jobs) ? jobs : []).forEach(function (j) {
      ((j && Array.isArray(j.w)) ? j.w : []).forEach(function (h) {
        if (!h) return;
        if (taken(h.n)) clash = true;
        else if (is(h.n) && h.n !== to) { h.n = to; changed = true; }
      });
    });
    return changed;
  };
  const docs = [];
  rows.forEach(function (r) {
    if (!lbYm_(r.key)) return;
    const doc = lbParse_(r.json);
    let changed = false;
    Object.keys(doc.days && typeof doc.days === "object" ? doc.days : {}).forEach(function (day) {
      const d = doc.days[day];
      if (!d || typeof d !== "object") return;
      ["t", "s", "r", "j", "h"].forEach(function (p) { if (keys(d[p])) changed = true; });
      Object.keys(d.j && typeof d.j === "object" ? d.j : {}).forEach(function (truck) { if (crew(d.j[truck])) changed = true; });
      Object.keys(d.h && typeof d.h === "object" ? d.h : {}).forEach(function (truck) { if (crew([{ w: d.h[truck] }])) changed = true; });
    });
    if (keys(doc.reviews)) changed = true;
    if (changed) docs.push({ key: r.key, doc: doc });
  });
  if (clash) return { ok: false, error: "name_in_use" };
  const now = new Date().toISOString();
  // the roster: his new name, the old one kept as a former name (so an Excel copy of the old sheets still counts for him)
  const aka = (who.aka || []).filter(function (n) { return n.toLowerCase() !== lt && n.toLowerCase() !== lf; });
  if (other) aka.push(from);
  who.name = to;
  if (aka.length) who.aka = aka.slice(-8); else delete who.aka;
  const roster = lbConfig_(cfg);
  roster.at = now; roster.by = req.by;
  lbSaveRow_(s, byKey, "config", JSON.stringify(roster), now, req.by);
  docs.forEach(function (d) { lbSaveRow_(s, byKey, d.key, JSON.stringify(lbMonth_(d.doc, d.key)), now, req.by); });
  // pay rates
  const ps = paySheet_(false);
  if (ps) lbRows_(ps).forEach(function (r) {
    if (r.key !== "rates") return;
    const rates = lbParse_(r.json);
    if (keys(rates.people)) ps.getRange(r.row, 2, 1, 3).setValues([[JSON.stringify(rates), now, req.by]]);
  });
  // the job log: the truck's name and the helpers in every saved version
  const js = jobLogSheet_(false);
  if (js && js.getLastRow() > 1) {
    const rng = js.getRange(2, 4, js.getLastRow() - 1, 2), vals = rng.getValues();
    let any = false;
    vals.forEach(function (v) {
      if (is(v[0]) && v[0] !== to) { v[0] = to; any = true; }
      if (String(v[1]).toLowerCase().indexOf(lf) === -1) return;
      let jobs;
      try { jobs = JSON.parse(String(v[1] || "[]")); } catch (e) { return; }
      const was = clash;
      if (crew(jobs)) { v[1] = JSON.stringify(jobs); any = true; }
      clash = was;   // an old version naming someone else with the new name isn't a reason to stop: the log is history
    });
    if (any) rng.setValues(vals);
  }
  return { ok: true, config: roster, months: docs.length };
}
/** Saves changes: { writes: [{ key: "2026-11", patch }] } merges a change into that month (a blank entry clears it);
 *  { key, data } replaces the month or the roster ("config") whole. Each day changed is stamped with who saved it. */
/** rvSave: saves only the 5-star reviews (someone ticked for Leaderboard reviews, not Leaderboard numbers): the
 *  roster, a whole month and anything else in a change are left out. rvRead: answers with only the reviews. */
function lbPut_(req, rvSave, rvRead) {
  let writes = (Array.isArray(req.writes) ? req.writes : []).slice(0, 14);
  if (rvSave) writes = writes.map(function (w) {
    const patch = w && lbYm_(w.key) && !(w.data && typeof w.data === "object") ? lbRvPatch_(w.patch) : null;
    return patch ? { key: w.key, patch: patch } : null;
  }).filter(Boolean);
  // only the rows being written are read (a typed number is one month's row, not every year's)
  let s = SpreadsheetApp.getActive().getSheetByName(LB_SHEET), keys = lbKeys_(s);
  if (!keys) { s = lbSheet_(true); keys = lbKeys_(s) || []; }   // no tab yet, or one from an older layout: a new one
  const wanted = {};
  writes.forEach(function (w) { wanted[String((w && w.key) || "")] = true; });
  const byKey = {};
  lbRowsAt_(s, keys.filter(function (k) { return wanted[k.key]; })).forEach(function (r) { byKey[r.key] = r; });
  const now = new Date().toISOString();
  const out = { ok: true, months: {} };
  const lean = req.lean === true;   // the app asks for the days it changed back, not the whole month
  const log = [];   // every truck-day whose jobs changed: [at, by, day, truck, jobs]
  writes.forEach(function (w) {
    const key = String((w && w.key) || "");
    const whole = w && w.data && typeof w.data === "object";
    const change = whole ? w.data : (w && w.patch && typeof w.patch === "object" ? w.patch : null);
    if (!change || (key !== "config" && !lbYm_(key))) return;
    let doc;
    if (key === "config") doc = lbKeepPeople_(lbConfig_(change), change, byKey.config ? lbConfig_(lbParse_(byKey.config.json)) : null);
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
      // ... and every truck-day whose day-total helpers changed: the day's line, with who helped and their dollars
      if (!whole) Object.keys(change.days && typeof change.days === "object" ? change.days : {}).forEach(function (day) {
        const ch = change.days[day] && change.days[day].h;
        if (!ch || typeof ch !== "object") return;
        Object.keys(ch).forEach(function (team) {
          const name = lbTeam_(team);
          if (!name || ((((doc.days[day] || {}).j || {})[name]) || []).length) return;   // typed by job now: its jobs are logged above
          const was = JSON.stringify(lbDayJobLog_(before.days[day], name)), now2 = JSON.stringify(lbDayJobLog_(doc.days[day], name));
          if (was !== now2) log.push([now, req.by, day, name, now2]);
        });
      });
    }
    if (key === "config") { doc.at = now; doc.by = req.by; }
    lbSaveRow_(s, byKey, key, JSON.stringify(doc), now, req.by);
    if (key === "config") out.config = doc;
    else if (lean && !whole) {
      // just what this save touched, as it stands now: each changed day whole (null: nothing left of it), and the
      // month's review totals when they were part of it
      const part = { days: {} };
      Object.keys(change.days && typeof change.days === "object" ? change.days : {}).forEach(function (day) { part.days[day] = (doc.days && doc.days[day]) || null; });
      if (change.reviews) { part.reviews = doc.reviews || {}; part.rat = doc.rat || ""; part.rby = doc.rby || ""; }
      out.months[key] = part;
      (out.part || (out.part = {}))[key] = true;
    }
    else out.months[key] = doc;
  });
  if (log.length) appendRows_(jobLogSheet_(true), JOBLOG_COLS.length, log);
  if (rvRead) Object.keys(out.months).forEach(function (k) {
    const m = out.months[k];
    if (!out.part || !out.part[k]) { out.months[k] = lbRvView_(m); return; }
    // just what this save touched: each day's reviews (null: none left)
    Object.keys(m.days || {}).forEach(function (day) { const d = m.days[day]; m.days[day] = d && d.r ? { r: d.r } : null; });
  });
  return out;
}

/* ---------------- Housecall Pro (read-only) ---------------- */
// An Admin saves the Housecall Pro API key in Apps Script > Project Settings > Script Properties as HCP_API_KEY. It is
// never in this file, on GitHub or in the app: the script reads Housecall Pro with it and the app only gets totals
// (no customer names, addresses or phone numbers). Housecall Pro's public API: https://api.housecallpro.com, with the
// header "Authorization: Token <key>". A read-only key can't change anything there.
const HCP_BASE = "https://api.housecallpro.com";
const HCP_MAX_DAYS = 31, HCP_PAGE = 100, HCP_MAX_PAGES = 30;
/** The key as saved (a key pasted with "Token " or "Bearer " in front still works). */
function hcpKey_() {
  return String(PropertiesService.getScriptProperties().getProperty("HCP_API_KEY") || "").replace(/^\s*(token|bearer)\s+/i, "").trim();
}
/** One read from Housecall Pro: { data } or { error } (no_key, needs_permission, hcp_key, hcp_forbidden, hcp_busy,
 *  hcp_http, hcp_unreachable, hcp_bad_answer). The key is never part of an answer. */
function hcpUrl_(path, query) {
  const qs = Object.keys(query || {}).filter(function (k) { return query[k] !== null && query[k] !== undefined && query[k] !== ""; })
    .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(query[k]); }).join("&");
  return HCP_BASE + path + (qs ? "?" + qs : "");
}
// the first time, Google has to be told the script may reach Housecall Pro (run connectHousecallPro once)
const hcpThrown_ = e => (/permission|authori[sz]/i.test(String(e && e.message ? e.message : e)) ? "needs_permission" : "hcp_unreachable");
function hcpGet_(path, query) {
  const key = hcpKey_();
  if (!key) return { error: "no_key" };
  let res;
  try {
    res = UrlFetchApp.fetch(hcpUrl_(path, query), { method: "get", muteHttpExceptions: true,
      headers: { Authorization: "Token " + key, Accept: "application/json" } });
  } catch (e) {
    return { error: hcpThrown_(e) };
  }
  return hcpAnswer_(res);
}
const HCP_PAR = 6;   // Housecall Pro reads sent together (a job's invoices and card fee: 3 jobs at a time)
/** Many reads at once, HCP_PAR together: [{ path, query }] → each as hcpGet_ answers it. One that comes back "too busy"
 *  is asked again by itself a moment later. */
function hcpGetAll_(list) {
  if (!list.length) return [];
  const key = hcpKey_();
  if (!key) return list.map(function () { return { error: "no_key" }; });
  if (typeof UrlFetchApp.fetchAll !== "function") return list.map(function (x) { return hcpGet_(x.path, x.query); });
  const out = [];
  for (let i = 0; i < list.length; i += HCP_PAR) {
    const part = list.slice(i, i + HCP_PAR);
    let res;
    try {
      res = UrlFetchApp.fetchAll(part.map(function (x) {
        return { url: hcpUrl_(x.path, x.query), method: "get", muteHttpExceptions: true, headers: { Authorization: "Token " + key, Accept: "application/json" } };
      }));
    } catch (e) {
      const err = hcpThrown_(e);
      part.forEach(function () { out.push({ error: err }); });
      continue;
    }
    part.forEach(function (x, k) {
      let a = hcpAnswer_(res[k]);
      if (a.error === "hcp_busy") { Utilities.sleep(1500); a = hcpGet_(x.path, x.query); }
      out.push(a);
    });
  }
  return out;
}
/** Housecall Pro's answer: { data } or { error }. */
function hcpAnswer_(res) {
  const code = res.getResponseCode();
  if (code === 401) return { error: "hcp_key" };          // a wrong or deleted key (or no MAX plan)
  if (code === 403) return { error: "hcp_forbidden" };
  if (code === 429) return { error: "hcp_busy" };
  if (code < 200 || code >= 300) return { error: "hcp_http", status: code };
  try { return { data: JSON.parse(res.getContentText()) }; } catch (e) { return { error: "hcp_bad_answer" }; }
}
/** Midnight at the start of a day ("2026-11-02") in the script's time zone, as Housecall Pro takes it. */
function hcpDayStart_(day) {
  const off = Utilities.formatDate(new Date(day + "T12:00:00Z"), Session.getScriptTimeZone(), "XXX");
  return day + "T00:00:00" + off;
}
/** A job's department-sorting name: its Job type ("Restoration Residential"), or "" when it has none. */
function hcpJobType_(job) {
  const jf = job && job.job_fields && typeof job.job_fields === "object" ? job.job_fields : {};
  const t = jf.job_type || job.job_type || null;
  return String((t && typeof t === "object" ? (t.name || t.value || "") : t) || "").trim();
}
/** Where the client came from, as set on the job in Housecall Pro (its Lead source; the customer's when the job has none). */
function hcpLead_(job) {
  const pick = function (v) { return v && typeof v === "object" ? (v.name || v.value || "") : v; };
  return String(pick(job && job.lead_source) || pick(job && job.customer && job.customer.lead_source) || "").replace(/\s+/g, " ").trim().slice(0, 60);
}
/** "Cleaning Residential - REPEAT" → "repeat"; "… - REFERRAL" (or REFERAL) → "referral"; anything else → "". */
function mktKind_(type) {
  const t = String(type || "");
  return /\brepeat\b/i.test(t) ? "repeat" : /\bref+e?r+al\b/i.test(t) ? "referral" : "";
}
/** A job's first visit ("1234" or "1234-1"); its later visits ("1234-2") add money but aren't a new job. */
function hcpFirstVisit_(job) {
  const visit = /-(\d+)$/.exec(String((job && job.invoice_number) || ""));
  return !visit || visit[1] === "1";
}
/** Every job scheduled from..to (days in the script's time zone, up to 31 days), page by page: { jobs, pages, more }
 *  or { error, status }. */
function hcpJobsIn_(from, to) {
  const end = new Date(new Date(to + "T12:00:00Z").getTime() + 864e5).toISOString().slice(0, 10);
  const jobs = [];
  let pages = 0, more = false;
  for (let page = 1; page <= HCP_MAX_PAGES; page++) {
    const r = hcpGet_("/jobs", { scheduled_start_min: hcpDayStart_(from), scheduled_start_max: hcpDayStart_(end), page: page, page_size: HCP_PAGE });
    if (r.error) return { error: r.error, status: r.status || 0 };
    const got = Array.isArray(r.data && r.data.jobs) ? r.data.jobs : [];
    pages = page;
    for (let i = 0; i < got.length; i++) jobs.push(got[i]);
    const total = Number(r.data && r.data.total_pages) || 0;
    if (!got.length || page >= total) break;
    if (page === HCP_MAX_PAGES) more = true;
  }
  return { jobs: jobs, pages: pages, more: more };
}
/** Admin: is Housecall Pro connected, and what each job type adds up to on the days asked (their scheduled start,
 *  up to 31 days): visits, first visits (a job's later visits, "1234-2", aren't new jobs), the total of each, and
 *  what was canceled. Plus the names of the fields Housecall Pro sends (not their values), to build the rest on. */
function hcpTest_(req) {
  const day = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : ""; };
  const from = day(req.from), to = day(req.to);
  if (!from || !to || to < from) return { ok: false, error: "bad_request" };
  const days = Math.round((new Date(to + "T12:00:00Z") - new Date(from + "T12:00:00Z")) / 864e5) + 1;
  if (days > HCP_MAX_DAYS) return { ok: false, error: "too_long" };
  const co = hcpGet_("/company");
  if (co.error) return { ok: false, error: co.error, status: co.status || 0 };
  const company = String((co.data && (co.data.name || (co.data.company && co.data.company.name))) || "").slice(0, 120);
  const got = hcpJobsIn_(from, to);
  if (got.error) return { ok: false, error: got.error, status: got.status || 0, company: company };
  const byType = {}, statuses = {};
  let items = 0, canceled = 0, keys = [], fieldKeys = [];
  got.jobs.forEach(function (job) {
    if (!keys.length) { keys = Object.keys(job || {}).slice(0, 60); fieldKeys = Object.keys((job && job.job_fields) || {}).slice(0, 20); }
    const st = String(job.work_status || "");
    statuses[st] = (statuses[st] || 0) + 1;
    if (/cancel/i.test(st)) { canceled++; return; }
    items++;
    const type = hcpJobType_(job) || "(no job type)";
    const t = byType[type] || (byType[type] = { type: type, visits: 0, jobs: 0, cents: 0 });
    t.visits++;
    if (hcpFirstVisit_(job)) t.jobs++;
    t.cents += Number(job.total_amount) || 0;
  });
  const pages = got.pages, more = got.more;
  const types = Object.keys(byType).map(function (k) { return byType[k]; }).sort(function (a, b) { return b.cents - a.cents; });
  return { ok: true, company: company, from: from, to: to, items: items, canceled: canceled, pages: pages, more: more, types: types,
    statuses: statuses, keys: keys, fieldKeys: fieldKeys, tz: Session.getScriptTimeZone(), repairs: hcpRepairsLook_(got.jobs) };
}
/** For the Repairs split: the repair jobs (Job type starting with Repair) on those days, what they still say is owed,
 *  and what one job's invoices and payments look like: their field names and how many, never the values. Read-only. */
function hcpRepairsLook_(jobs) {
  const out = { jobs: 0, cents: 0, owed: 0, owedSent: false, invoices: { tried: [], path: "", count: 0, keys: [], payKeys: [], payments: 0, itemKeys: [] }, lines: { status: "", count: 0, keys: [], fee: 0 } };
  let sample = null;
  jobs.forEach(function (job) {
    if (!job || /cancel/i.test(String(job.work_status || "")) || revDept_(hcpJobType_(job)) !== "p") return;
    out.jobs++;
    out.cents += Number(job.total_amount) || 0;
    if (job.outstanding_balance !== undefined && job.outstanding_balance !== null) { out.owedSent = true; out.owed += Number(job.outstanding_balance) || 0; }
    if (!sample && (Number(job.total_amount) || 0) > 0 && job.id) sample = job;
  });
  if (!sample) return out;
  const tries = [["/jobs/" + encodeURIComponent(sample.id) + "/invoices", null], ["/invoices", { job_id: sample.id }]];
  for (let i = 0; i < tries.length; i++) {
    const r = hcpGet_(tries[i][0], tries[i][1]);
    const label = tries[i][1] ? tries[i][0] + "?job_id" : "/jobs/{id}/invoices";
    out.invoices.tried.push(label + " " + (r.error ? (r.status || r.error) : "ok"));
    if (r.error) continue;
    const d = r.data || {};
    const list = Array.isArray(d) ? d : Array.isArray(d.invoices) ? d.invoices : Array.isArray(d.data) ? d.data : [];
    out.invoices.path = label;
    out.invoices.count = list.length;
    if (list.length) {
      out.invoices.keys = Object.keys(list[0] || {}).slice(0, 60);
      for (let j = 0; j < list.length; j++) {
        const pays = Array.isArray(list[j] && list[j].payments) ? list[j].payments : [];
        out.invoices.payments += pays.length;
        if (pays.length && !out.invoices.payKeys.length) out.invoices.payKeys = Object.keys(pays[0] || {}).slice(0, 30);
        const its = Array.isArray(list[j] && list[j].items) ? list[j].items : [];
        if (its.length && !out.invoices.itemKeys.length) out.invoices.itemKeys = Object.keys(its[0] || {}).slice(0, 30);
      }
    }
    break;
  }
  // the job's line items (where a credit card fee shows)
  const li = hcpGet_("/jobs/" + encodeURIComponent(sample.id) + "/line_items");
  out.lines.status = li.error ? String(li.status || li.error) : "ok";
  if (!li.error) {
    const d = li.data || {}, list = Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : Array.isArray(d.line_items) ? d.line_items : [];
    out.lines.count = list.length; out.lines.keys = list.length ? Object.keys(list[0] || {}).slice(0, 40) : []; out.lines.fee = repFeeOf_(list);
  }
  return out;
}
/** Run this once from the Apps Script editor (choose it, then Run): Google asks to let the script reach Housecall Pro,
 *  and the log says whether the key works. Nothing in Housecall Pro is changed. */
function connectHousecallPro() {
  const r = hcpGet_("/company");
  Logger.log(r.error ? "Not connected: " + r.error + (r.status ? " (" + r.status + ")" : "") : "Connected to Housecall Pro: " + ((r.data && r.data.name) || "your company"));
}

/* ---------------- Revenue: each day's money and jobs, from Housecall Pro ---------------- */
// The Revenue tab: one row per day, read from Housecall Pro (nothing is typed). A job's department is the first word of
// its Job type (Restoration…, Cleaning…, Repair…); any other type counts as Other, and its name is kept so it can be fixed
// in Housecall Pro. Money counts on each visit's scheduled day (in the script's time zone); a job counts once, on its
// first visit; canceled jobs are left out. The app reads the tab, and asks for days to be read again from Housecall Pro
// when they're missing or may have changed (an invoice changed after the day).
const REV_SHEET = "Revenue";
const REV_COLS = ["Day", "Restoration $", "Restoration jobs", "Cleaning $", "Cleaning jobs", "Repairs $", "Repairs jobs", "Other $", "Other jobs", "Visits", "Read from Housecall Pro", "Other job types", "Sources", "Unpaid", "Jobs"];
// Sources (for Marketing): each kind of job and lead source that day, "repeat|Google": [Restoration ¢, jobs, Cleaning ¢,
// jobs, Repairs ¢, jobs, Other ¢, jobs]. The kind is REPEAT or REFERRAL from the Job type, else "" and the Lead source
// decides. Empty on days read before Marketing (they're read again when Marketing needs them).
// Unpaid (Operations): that day's visits whose client still owes (Housecall Pro's outstanding balance), done or under
// way (not still to come), [job id, invoice #, client, department, charged ¢, owes ¢, project (the job's description, else
// its Job type)]: Accounts receivable. Empty on days read before it.
// Jobs (Operations): every visit that day (canceled left out), [job id, invoice #, client, department, charged ¢, owes ¢,
// project, work status, 1 if the job's first visit else 0]: the list behind each department's tile, and what's been
// collected (charged less what's still owed, deposits on visits still to come included). Empty on days read before it.
const REV_DEPTS = ["r", "c", "p", "o"];   // Restoration, Cleaning, Repairs, Other: their $ and jobs columns in that order
const REV_FRESH_MS = 60 * 1000;           // days read this recently aren't read again (two phones opening the tab at once)
/** "Restoration Residential - REFERRAL" → "r"; "Cleaning…" → "c"; "Repair…" → "p"; anything else → "o". */
function revDept_(type) {
  const t = String(type || "").trim();
  return /^restor/i.test(t) ? "r" : /^clean/i.test(t) ? "c" : /^repair/i.test(t) ? "p" : "o";
}
function revSheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(REV_SHEET);
  if (!s && create) {
    s = ss.insertSheet(REV_SHEET);
    s.getRange(1, 1, 1, REV_COLS.length).setValues([REV_COLS]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange("A:A").setNumberFormat("@");   // plain text: a day like 2026-11-02 must not turn into a date
    ["B:B", "D:D", "F:F", "H:H"].forEach(function (c) { s.getRange(c).setNumberFormat("$#,##0.00"); });
  }
  return s;
}
/** Every day on the tab: { "2026-11-02": [day, r$, r jobs, c$, c jobs, p$, p jobs, o$, o jobs, visits, read at, other types] }. */
function revRows_(s) {
  const out = {};
  if (!s || s.getLastRow() < 2) return out;
  const tz = Session.getScriptTimeZone();
  s.getRange(2, 1, s.getLastRow() - 1, REV_COLS.length).getValues().forEach(function (r) {
    const day = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, "yyyy-MM-dd") : String(r[0] || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const at = r[10] instanceof Date ? r[10].toISOString() : String(r[10] || "");
    out[day] = [day].concat(r.slice(1, 10).map(function (v) { return Number(v) || 0; }), [at, String(r[11] || ""), String(r[12] || ""), String(r[13] || ""), String(r[14] || "")]);
  });
  return out;
}
/** A day as the app gets it: [r$, r jobs, c$, c jobs, p$, p jobs, o$, o jobs, visits, read at (ms), other types, sources,
 *  unpaid (each null when read before it was kept)]. */
function revOut_(row) {
  const parse = function (t) { if (!t) return null; try { return JSON.parse(t); } catch (e) { return null; } };
  const src = parse(row[12]), unpaid = parse(row[13]), jobs = parse(row[14]);
  return row.slice(1, 10).concat([Date.parse(row[10]) || 0, row[11], src && typeof src === "object" && !Array.isArray(src) ? src : null, Array.isArray(unpaid) ? unpaid : null,
    Array.isArray(jobs) ? jobs : null]);
}
/** Clients' names and projects in Unpaid go only to those who see Operations (Marketing alone gets the amounts). */
function revPrivate_(out, user) {
  if (out && out.days && !canSee_(user, "revenue")) Object.keys(out.days).forEach(function (d) {
    const u = out.days[d][12];
    if (Array.isArray(u)) out.days[d][12] = u.map(function (x) { return [x[0], x[1], "", x[3], x[4], x[5], ""]; });
    const js = out.days[d][13];
    if (Array.isArray(js)) out.days[d][13] = js.map(function (x) { return [x[0], x[1], "", x[3], x[4], x[5], "", x[7], x[8]]; });
  });
  return out;
}
/** A client's name as Housecall Pro has it: the company, else first and last name. */
function hcpClient_(job) {
  const cu = (job && job.customer) || {};
  return String(cu.company || [cu.first_name, cu.last_name].filter(Boolean).join(" ") || "").replace(/\s+/g, " ").trim().slice(0, 80);
}
/** Everyone with Revenue: a year's days from the tab, and which years have any. */
function revRead_(year) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : String(new Date().getFullYear());
  const rows = revRows_(revSheet_(false)), days = {}, years = {};
  Object.keys(rows).forEach(function (d) {
    years[d.slice(0, 4)] = true;
    if (d.indexOf(y + "-") === 0) days[d] = revOut_(rows[d]);
  });
  return { ok: true, year: Number(y), days: days, years: Object.keys(years).map(Number).sort(), connected: !!hcpKey_() };
}
/** Everyone with Revenue: reads from..to (up to 31 days) from Housecall Pro again and saves each day's totals. Days
 *  read in the last minute aren't asked for again (unless Read again was pressed: force). { ok, days } like revRead_, or { error } like the connection check. */
function revSync_(req) {
  const isDay = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : ""; };
  const from = isDay(req.from), to = isDay(req.to);
  if (!from || !to || to < from) return { ok: false, error: "bad_request" };
  const list = [];
  for (let d = from; d <= to && list.length <= HCP_MAX_DAYS; d = new Date(new Date(d + "T12:00:00Z").getTime() + 864e5).toISOString().slice(0, 10)) list.push(d);
  if (list.length > HCP_MAX_DAYS) return { ok: false, error: "too_long" };
  const have = revRows_(revSheet_(false)), now = Date.now();
  const pick = function (rows) { const out = {}; list.forEach(function (d) { if (rows[d]) out[d] = revOut_(rows[d]); }); return out; };
  if (!req.force && list.every(function (d) { return have[d] && now - (Date.parse(have[d][10]) || 0) < REV_FRESH_MS; })) return { ok: true, days: pick(have), fresh: true };
  const got = hcpJobsIn_(from, to);
  if (got.error) return { ok: false, error: got.error, status: got.status || 0 };
  if (got.more) return { ok: false, error: "too_many" };
  const tz = Session.getScriptTimeZone(), at = new Date().toISOString(), acc = {};
  list.forEach(function (d) { acc[d] = { r: [0, 0], c: [0, 0], p: [0, 0], o: [0, 0], visits: 0, other: {}, src: {}, unpaid: [], jobs: [] }; });
  got.jobs.forEach(function (job) {
    if (!job || /cancel/i.test(String(job.work_status || ""))) return;
    const start = new Date((job.schedule && job.schedule.scheduled_start) || "");
    if (isNaN(start.getTime())) return;
    const a = acc[Utilities.formatDate(start, tz, "yyyy-MM-dd")];
    if (!a) return;
    const type = hcpJobType_(job), k = revDept_(type), cents = Number(job.total_amount) || 0, first = hcpFirstVisit_(job);
    a[k][0] += cents;
    if (first) a[k][1]++;
    a.visits++;
    const key = mktKind_(type) + "|" + hcpLead_(job), i = REV_DEPTS.indexOf(k) * 2;
    const v = a.src[key] || (a.src[key] = [0, 0, 0, 0, 0, 0, 0, 0]);
    v[i] += Math.round(cents);
    if (first) v[i + 1]++;
    // still owed: done or under way (a visit still to come isn't owed yet)
    const owes = Math.round(Number(job.outstanding_balance) || 0);
    a.jobs.push([String(job.id || ""), String(job.invoice_number || ""), hcpClient_(job), k, Math.round(cents), owes,
      String(job.description || type || "").replace(/\s+/g, " ").trim().slice(0, 80), String(job.work_status || "").slice(0, 30), first ? 1 : 0]);
    if (owes > 0 && !/^(scheduled|unscheduled|needs scheduling)$/i.test(String(job.work_status || "").trim()))
      a.unpaid.push([String(job.id || ""), String(job.invoice_number || ""), hcpClient_(job), k, Math.round(cents), owes,
        String(job.description || type || "").replace(/\s+/g, " ").trim().slice(0, 80)]);
    if (k === "o") a.other[type || "(no job type)"] = true;
  });
  return withLock_(function () {
    const s = revSheet_(true), rows = revRows_(s);
    list.forEach(function (d) {
      const a = acc[d], row = [d];
      REV_DEPTS.forEach(function (k) { row.push(Math.round(a[k][0]) / 100, a[k][1]); });
      row.push(a.visits, at, Object.keys(a.other).sort().join("; "), JSON.stringify(a.src), JSON.stringify(a.unpaid), JSON.stringify(a.jobs));
      rows[d] = row;
    });
    const all = Object.keys(rows).sort().map(function (d) { return rows[d]; });
    if (String(s.getRange(1, REV_COLS.length).getValue()) !== REV_COLS[REV_COLS.length - 1]) s.getRange(1, 1, 1, REV_COLS.length).setValues([REV_COLS]).setFontWeight("bold");   // a tab made before Marketing, Unpaid or Jobs
    s.getRange(2, 1, all.length, 1).setNumberFormat("@");   // before the days go in, so none turns into a date
    s.getRange(2, 1, all.length, REV_COLS.length).setValues(all);
    return { ok: true, days: pick(rows) };
  });
}

/* ---------------- Marketing: where clients come from, what they bring in, and what the ads cost ---------------- */
// What each source brought in comes from Housecall Pro (the Sources column of the Revenue tab, above). Three tabs keep
// the rest, all typed or matched in the app:
//   Marketing spend    a month's ad spend for a source (typed in the app, or imported from Summary Advertising)
//   Marketing sources  which row each Lead source in Housecall Pro goes to (Google, Thumbtack, ...)
//   Marketing history  months before Housecall Pro, imported once from Clients Per Month and Summary Advertising
const MKT_SPEND = "Marketing spend", MKT_MAP = "Marketing sources", MKT_HIST = "Marketing history";
const MKT_SPEND_COLS = ["Month", "Source", "Spent $", "From", "Changed by", "Changed at"];
const MKT_MAP_COLS = ["Lead source in Housecall Pro", "Row in Marketing", "Changed by", "Changed at"];
const MKT_HIST_COLS = ["Month", "Source", "Department", "Revenue $", "Jobs", "From"];
const MKT_MAX_SPEND = 10000000, MKT_MAX_HIST = 6000;
function mktSheet_(name, cols, create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(name);
  if (!s && create) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange("A:A").setNumberFormat("@");   // a month like 2026-11 must stay text
  }
  return s;
}
function mktRows_(s, n) {
  return s && s.getLastRow() >= 2 ? s.getRange(2, 1, s.getLastRow() - 1, n).getValues() : [];
}
function mktWrite_(s, cols, rows) {
  if (s.getLastRow() >= 2) s.getRange(2, 1, s.getLastRow() - 1, cols.length).clearContent();
  if (!rows.length) return;
  s.getRange(2, 1, rows.length, 1).setNumberFormat("@");
  s.getRange(2, 1, rows.length, cols.length).setValues(rows);
}
const mktMonth_ = function (v, tz) { return v instanceof Date ? Utilities.formatDate(v, tz, "yyyy-MM") : /^\d{4}-\d{2}$/.test(String(v || "").trim()) ? String(v).trim() : ""; };
const mktName_ = function (v) { return String(v === null || v === undefined ? "" : v).replace(/\s+/g, " ").trim().slice(0, 60); };
const mktMoney_ = function (v) { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= MKT_MAX_SPEND ? Math.round(n * 100) / 100 : null; };
/** Everyone with Marketing: the spend, the Lead source matches and the imported months. */
function mktRead_() {
  const tz = Session.getScriptTimeZone(), spend = {}, from = {}, map = {}, hist = [];
  mktRows_(mktSheet_(MKT_SPEND, MKT_SPEND_COLS, false), MKT_SPEND_COLS.length).forEach(function (r) {
    const m = mktMonth_(r[0], tz), src = mktName_(r[1]), v = mktMoney_(r[2]);
    if (!m || !src || v === null || r[2] === "") return;
    (spend[m] || (spend[m] = {}))[src] = v;
    (from[m] || (from[m] = {}))[src] = String(r[3] || "");
  });
  mktRows_(mktSheet_(MKT_MAP, MKT_MAP_COLS, false), MKT_MAP_COLS.length).forEach(function (r) {
    const row = mktName_(r[1]);
    if (row) map[mktName_(r[0])] = row;
  });
  mktRows_(mktSheet_(MKT_HIST, MKT_HIST_COLS, false), MKT_HIST_COLS.length).forEach(function (r) {
    const m = mktMonth_(r[0], tz), src = mktName_(r[1]);
    if (m && src) hist.push([m, src, /^[rcpo]$/.test(String(r[2] || "")) ? String(r[2]) : "", Number(r[3]) || 0, Number(r[4]) || 0]);
  });
  return { ok: true, spend: spend, spendFrom: from, map: map, hist: hist };
}
/** Everyone with Marketing: a month's ad spend for sources ({ month, source, amount }; amount "" or null takes it off),
 *  and Lead sources matched to rows ({ "Google LSA": "Google Guaranteed" }; "" back to the app's guess). */
function mktPut_(req, user) {
  const spend = Array.isArray(req.spend) ? req.spend : [], map = req.map && typeof req.map === "object" ? req.map : {};
  if (spend.length > 200 || Object.keys(map).length > 200) return { ok: false, error: "bad_request" };
  const at = new Date().toISOString(), tz = Session.getScriptTimeZone();
  if (spend.length) {
    const s = mktSheet_(MKT_SPEND, MKT_SPEND_COLS, true), rows = mktRows_(s, MKT_SPEND_COLS.length);
    const idx = {};
    rows.forEach(function (r, i) { idx[mktMonth_(r[0], tz) + "\t" + mktName_(r[1])] = i; });
    for (let i = 0; i < spend.length; i++) {
      const x = spend[i] || {}, m = mktMonth_(x.month, tz), src = mktName_(x.source);
      const off = x.amount === "" || x.amount === null || x.amount === undefined, v = off ? null : mktMoney_(x.amount);
      if (!m || !src || (!off && v === null)) return { ok: false, error: "bad_request" };
      const k = m + "\t" + src, row = [m, src, off ? "" : v, "typed", user.name, at];
      if (idx[k] !== undefined) rows[idx[k]] = row;
      else if (!off) { idx[k] = rows.length; rows.push(row); }
    }
    mktWrite_(s, MKT_SPEND_COLS, rows.filter(function (r) { return r[2] !== "" && r[2] !== null; }));
  }
  if (Object.keys(map).length) {
    const s = mktSheet_(MKT_MAP, MKT_MAP_COLS, true), rows = mktRows_(s, MKT_MAP_COLS.length);
    const idx = {};
    rows.forEach(function (r, i) { idx[mktName_(r[0])] = i; });
    Object.keys(map).forEach(function (lead) {
      const l = mktName_(lead), row = mktName_(map[lead]);
      if (idx[l] !== undefined) rows[idx[l]] = [l, row, user.name, at];
      else if (row) { idx[l] = rows.length; rows.push([l, row, user.name, at]); }
    });
    mktWrite_(s, MKT_MAP_COLS, rows.filter(function (r) { return mktName_(r[1]); }));
  }
  return mktRead_();
}
/** Admin: the months from Clients Per Month and Summary Advertising, read in the app. hist: [month, source, department
 *  ("r", "c", "p" or ""), revenue $, jobs] replaces everything imported before; spend: [month, source, $] replaces the
 *  imported spend (spend typed in the app stays). */
function mktImport_(req, user) {
  const hist = Array.isArray(req.hist) ? req.hist : null, spend = Array.isArray(req.spend) ? req.spend : [];
  if (!hist || hist.length > MKT_MAX_HIST || spend.length > MKT_MAX_HIST) return { ok: false, error: "bad_request" };
  const tz = Session.getScriptTimeZone(), label = mktName_(req.from) || "imported", at = new Date().toISOString();
  const H = [];
  for (let i = 0; i < hist.length; i++) {
    const x = Array.isArray(hist[i]) ? hist[i] : [], m = mktMonth_(x[0], tz), src = mktName_(x[1]), d = /^[rcpo]$/.test(String(x[2] || "")) ? String(x[2]) : "";
    const v = Number(x[3]), n = Number(x[4]);
    if (!m || !src || !Number.isFinite(v) || Math.abs(v) > 1e8 || !Number.isFinite(n) || n < 0 || n > 1e5) return { ok: false, error: "bad_request" };
    H.push([m, src, d, Math.round(v * 100) / 100, Math.round(n)]);
  }
  const S = [];
  for (let i = 0; i < spend.length; i++) {
    const x = Array.isArray(spend[i]) ? spend[i] : [], m = mktMonth_(x[0], tz), src = mktName_(x[1]), v = mktMoney_(x[2]);
    if (!m || !src || v === null) return { ok: false, error: "bad_request" };
    S.push([m, src, v]);
  }
  mktWrite_(mktSheet_(MKT_HIST, MKT_HIST_COLS, true), MKT_HIST_COLS, H.map(function (r) { return r.concat([label]); }));
  const s = mktSheet_(MKT_SPEND, MKT_SPEND_COLS, true), rows = mktRows_(s, MKT_SPEND_COLS.length);
  const typed = rows.filter(function (r) { return String(r[3]) === "typed"; }), have = {};
  typed.forEach(function (r) { have[mktMonth_(r[0], tz) + "\t" + mktName_(r[1])] = true; });
  const keep = typed.map(function (r) { return [mktMonth_(r[0], tz), mktName_(r[1]), r[2], r[3], r[4], r[5]]; });
  S.forEach(function (r) { if (!have[r[0] + "\t" + r[1]]) keep.push([r[0], r[1], r[2], "imported", user.name, at]); });
  keep.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; });
  mktWrite_(s, MKT_SPEND_COLS, keep);
  const out = mktRead_();
  out.saved = { hist: H.length, spend: S.length };
  return out;
}

/* ---------------- Repairs split: each repair job, what the client paid, and Monumental's and VODA's share ---------------- */
// The Repairs tab: one row per repair job (a Job type starting with Repair), read from Housecall Pro by its scheduled day:
// the client, what was charged, what the client paid and still owes (its invoices). Next to that, what's typed in the app
// (never overwritten by Housecall Pro): a specialty contractor VODA pays, Monumental's materials, deposits paid to
// Monumental, extra pay to Monumental, Monumental's invoice and the day VODA paid them. And the split, worked out:
//   specialty (paid by VODA) comes off the top; Monumental's materials go back to Monumental and VODA adds 30% on them
//   (materials / 0.7 x 0.3); what's left is 70% Monumental, 30% VODA; extra pay moves money from VODA to Monumental.
// A job tagged "repair - Monumental Flooring" is Monumental's; any other repair job is VODA's own (no split) unless
// it's switched in the app.
const REP_SHEET = "Repairs";
const REP_COLS = ["Job id", "Day", "Invoice #", "Client", "Address", "Job type", "Tags", "Work status", "Charged $", "Client paid $", "Client owes $",
  "Invoices", "Read from Housecall Pro", "Not in Housecall Pro since",
  "Split", "Specialty contractor", "Specialty $", "Specialty deposit $", "Specialty deposit date", "Monumental materials $", "Monumental deposit $",
  "Monumental deposit date", "Extra to Monumental $", "Extra reason", "Monumental invoice #", "Date VODA paid Monumental", "Note", "Typed by", "Typed at",
  "Monumental $", "Monumental still owed $", "VODA $", "Monumental invoices", "Monumental invoiced $", "Monumental invoices to pay $",
  "Client name (typed)", "Card fee $", "Card fee in the split"];
// what's typed in the app: [key, column, kind]
const REP_TYPED = [["split", 14, "split"], ["sName", 15, "text"], ["sAmt", 16, "money"], ["sDep", 17, "money"], ["sDepAt", 18, "day"], ["mat", 19, "money"],
  ["mDep", 20, "money"], ["mDepAt", 21, "day"], ["extra", 22, "money"], ["extraWhy", 23, "text"], ["mInv", 24, "text"], ["mPaidAt", 25, "day"], ["note", 26, "text"], ["cName", 35, "text"]];
const REP_MON_TAG = /monumental/i;
const REP_DATA_VER = 1;   // raise when what's kept for a job changes: the app then reads every month from Housecall Pro again
function repSheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(REP_SHEET);
  if (!s && !create) return null;
  if (!s) { s = ss.insertSheet(REP_SHEET); s.setFrozenRows(1); }
  // a new tab is 26 columns wide and the Repairs tab needs more; the headings go in once (again if a column is added)
  if (s.getMaxColumns() < REP_COLS.length) s.insertColumnsAfter(s.getMaxColumns(), REP_COLS.length - s.getMaxColumns());
  const head = s.getRange(1, 1, 1, REP_COLS.length).getValues()[0];
  if (String(head[0]) !== REP_COLS[0] || String(head[REP_COLS.length - 1]) !== REP_COLS[REP_COLS.length - 1]) {
    s.getRange(1, 1, 1, REP_COLS.length).setValues([REP_COLS]).setFontWeight("bold");
    s.getRange("A:C").setNumberFormat("@");   // the job id, the day and the invoice number stay text
  }
  return s;
}
const repCents_ = v => Math.round((Number(v) || 0) * 100);
const repDay_ = (v, tz) => (v instanceof Date ? Utilities.formatDate(v, tz, "yyyy-MM-dd") : /^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : "");
/** Every row of the tab: { id: row as an array of REP_COLS.length }. */
function repRows_(s) {
  const out = {};
  if (!s || s.getLastRow() < 2) return out;
  const tz = Session.getScriptTimeZone();
  s.getRange(2, 1, s.getLastRow() - 1, REP_COLS.length).getValues().forEach(function (r) {
    const id = String(r[0] || "").trim();
    if (!id) return;
    r[1] = repDay_(r[1], tz);
    [18, 21, 25].forEach(function (c) { r[c] = repDay_(r[c], tz); });
    [12, 13, 28].forEach(function (c) { if (r[c] instanceof Date) r[c] = r[c].toISOString(); });
    out[id] = r;
  });
  return out;
}
/** Is this job Monumental's (70/30), from the switch typed in the app or else its tag? */
function repIsMon_(row) {
  const sp = String(row[14] || "auto");
  return sp === "mon" || (sp !== "none" && REP_MON_TAG.test(String(row[6] || "")));
}
/** The split of a job, in cents: { mon, owed, voda }. */
function repSplit_(row) {
  // a credit card fee isn't shared with Monumental, unless the job was paid to them with it in (the old list)
  const c = repCents_(row[8]) - (String(row[37]) === "yes" ? 0 : repCents_(row[36])), f = repCents_(row[16]);
  if (!repIsMon_(row)) return { mon: 0, owed: 0, voda: c - f };
  const j = repCents_(row[19]), x = repCents_(row[22]), k = repCents_(row[20]);
  const n = Math.round(j * 0.3 / 0.7), o = c - f - j - n;
  const mon = Math.round(o * 0.7) + j + x, voda = c - f - mon;
  return { mon: mon, owed: row[25] ? 0 : Math.max(0, mon - k), voda: voda };
}
/** A row as the app gets it. */
function repOut_(r) {
  let inv = [];
  try { inv = JSON.parse(String(r[11] || "[]")); } catch (e) { inv = []; }
  const t = {};
  REP_TYPED.forEach(function (d) { t[d[0]] = d[2] === "money" ? (r[d[1]] === "" || r[d[1]] === null ? "" : Number(r[d[1]]) || 0) : String(r[d[1]] || ""); });
  return { id: String(r[0]), day: r[1], inv: String(r[2] || ""), client: String(r[35] || r[3] || ""), hcpClient: String(r[3] || ""), addr: String(r[4] || ""), type: String(r[5] || ""), tags: String(r[6] || ""),
    ws: String(r[7] || ""), c: repCents_(r[8]), paid: repCents_(r[9]), owes: repCents_(r[10]), invoices: inv, at: Date.parse(r[12]) || 0, gone: String(r[13] || ""),
    t: t, by: String(r[27] || ""), tat: String(r[28] || ""), mon: repMonList_(r), fee: repCents_(r[36]), feeIn: String(r[37]) === "yes" };
}
/** The Monumental invoices recorded on a job: [{ n, d, a (cents), k, f, by, at, paid }]. */
function repMonList_(r) {
  try { const v = JSON.parse(String(r[32] || "[]")); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
/** Writes every row back, by day, with the split worked out. */
function repWrite_(s, rows) {
  const all = Object.keys(rows).map(function (id) { return rows[id]; }).sort(function (a, b) { return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : String(a[2]) < String(b[2]) ? -1 : String(a[2]) > String(b[2]) ? 1 : 0; });
  all.forEach(function (r) {
    const x = repSplit_(r), inv = repMonList_(r);
    r[29] = x.mon / 100; r[30] = x.owed / 100; r[31] = x.voda / 100;
    r[33] = inv.reduce(function (n, i) { return n + (Number(i.a) || 0); }, 0) / 100;
    r[34] = r[25] ? 0 : inv.reduce(function (n, i) { return n + (i.paid ? 0 : Number(i.a) || 0); }, 0) / 100;
  });
  if (!all.length) return;
  if (s.getMaxRows() < all.length + 1) s.insertRowsAfter(s.getMaxRows(), all.length + 101 - s.getMaxRows());
  s.getRange(2, 1, all.length, 3).setNumberFormat("@");
  s.getRange(2, 1, all.length, REP_COLS.length).setValues(all);
}
/** Everyone with Repairs split: a year's jobs and which years have any. */
function repRead_(year) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : String(new Date().getFullYear());
  const rows = repRows_(repSheet_(false)), jobs = [], years = {};
  Object.keys(rows).forEach(function (id) {
    const r = rows[id];
    if (r[1]) years[r[1].slice(0, 4)] = true;
    if (String(r[1]).indexOf(y + "-") === 0) jobs.push(repOut_(r));
  });
  return { ok: true, year: Number(y), jobs: jobs, years: Object.keys(years).map(Number).sort(), dv: REP_DATA_VER };
}
/** The credit card fee in a list of line items (cents): lines named like "VODA - Credit Card Service Charge". */
function repFeeOf_(items) {
  return (Array.isArray(items) ? items : []).reduce(function (n, it) {
    const name = String((it && (it.name || it.service_name || it.title)) || "");
    if (!/credit\s*card/i.test(name)) return n;
    const amt = it.amount !== undefined && it.amount !== null ? Number(it.amount) : it.total_price !== undefined && it.total_price !== null ? Number(it.total_price)
      : (Number(it.unit_price) || 0) * (Number(it.quantity) || 0);
    return n + (Math.round(amt) || 0);
  }, 0);
}
/** A job's credit card fee (cents) from its line items, or null when they can't be read. */
function repJobFee_(jobId) { return repFeeFrom_(hcpGet_("/jobs/" + encodeURIComponent(jobId) + "/line_items")); }
function repFeeFrom_(r) {
  if (r.error) return null;
  const d = r.data || {};
  return repFeeOf_(Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : Array.isArray(d.line_items) ? d.line_items : []);
}
/** One job's invoices from Housecall Pro, kept short: number, amount, still due, paid day, status (cents). */
function repInvoices_(jobId, tz) { return repInvoicesFrom_(hcpGet_("/jobs/" + encodeURIComponent(jobId) + "/invoices"), tz); }
function repInvoicesFrom_(r, tz) {
  if (r.error) return { error: r.error, status: r.status || 0 };
  const d = r.data || {};
  const list = Array.isArray(d) ? d : Array.isArray(d.invoices) ? d.invoices : Array.isArray(d.data) ? d.data : [];
  return { fee: list.reduce(function (n, i) { return n + repFeeOf_(i && i.items); }, 0), list: list.map(function (i) {
    const paidAt = i && i.paid_at ? new Date(i.paid_at) : null;
    return { n: String((i && i.invoice_number) || ""), a: Number(i && i.amount) || 0, due: Number(i && i.due_amount) || 0, st: String((i && i.status) || ""),
      at: paidAt && !isNaN(paidAt.getTime()) ? Utilities.formatDate(paidAt, tz, "yyyy-MM-dd") : "", dc: String((i && i.due_concept) || "") };
  }) };
}
/** Has this job stayed as it was read (charged, still owed, status, invoice #), with its invoices and card fee kept? */
function repSame_(r, job) {
  if (!r || r[13] || !String(r[11] || "") || r[36] === "" || r[36] === null) return false;
  if (repCents_(r[8]) !== Math.round(Number(job.total_amount) || 0)) return false;
  if (job.outstanding_balance !== undefined && job.outstanding_balance !== null && repCents_(r[10]) !== Math.round(Number(job.outstanding_balance) || 0)) return false;
  return String(r[2] || "") === String(job.invoice_number || "") && String(r[7] || "") === String(job.work_status || "");
}
/** Reads from..to (up to 31 days) from Housecall Pro again: the repair jobs scheduled on those days and their invoices.
 *  What's typed in the app stays. A job that isn't there any more is dropped, or kept (and marked) when something was
 *  typed for it. Days read in the last minute aren't asked again unless Read again was pressed. */
function repSync_(req) {
  const isDay = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : ""; };
  const from = isDay(req.from), to = isDay(req.to);
  if (!from || !to || to < from) return { ok: false, error: "bad_request" };
  const days = Math.round((new Date(to + "T12:00:00Z") - new Date(from + "T12:00:00Z")) / 864e5) + 1;
  if (days > HCP_MAX_DAYS) return { ok: false, error: "too_long" };
  const pick = function (rows) { return Object.keys(rows).filter(function (id) { const d = rows[id][1]; return d >= from && d <= to; }).map(function (id) { return repOut_(rows[id]); }); };
  const have = repRows_(repSheet_(false)), now = Date.now();
  const inRange = Object.keys(have).filter(function (id) { return have[id][1] >= from && have[id][1] <= to && !have[id][13]; });
  const props = PropertiesService.getScriptProperties(), seenKey = "REP_READ_" + from + "_" + to, seen = Number(props.getProperty(seenKey)) || 0;
  if (!req.force && now - seen < REV_FRESH_MS && inRange.every(function (id) { return now - (Date.parse(have[id][12]) || 0) < REV_FRESH_MS; })) return { ok: true, jobs: pick(have), fresh: true };
  const got = hcpJobsIn_(from, to);
  if (got.error) return { ok: false, error: got.error, status: got.status || 0 };
  if (got.more) return { ok: false, error: "too_many" };
  const tz = Session.getScriptTimeZone(), at = new Date().toISOString(), fresh = {}, picked = [];
  for (let i = 0; i < got.jobs.length; i++) {
    const job = got.jobs[i];
    if (!job || !job.id || /cancel/i.test(String(job.work_status || ""))) continue;
    // Monumental's projects: tagged in Housecall Pro (any job type), or set to Monumental's split in the app (the old list)
    const tagList = (Array.isArray(job.tags) ? job.tags : []).map(function (t) { return typeof t === "object" && t ? (t.name || "") : String(t); }).filter(Boolean);
    const known = have[String(job.id)];
    if (!tagList.some(function (t) { return REP_MON_TAG.test(t); }) && !(known && String(known[14]) === "mon")) continue;
    if (!hcpFirstVisit_(job) && !(Number(job.total_amount) > 0)) continue;   // a later visit with nothing charged is another day of the same job
    const start = new Date((job.schedule && job.schedule.scheduled_start) || "");
    if (isNaN(start.getTime())) continue;
    const day = Utilities.formatDate(start, tz, "yyyy-MM-dd");
    if (day < from || day > to) continue;
    picked.push({ job: job, known: known, tags: tagList, day: day });
  }
  // each job's invoices and card fee: read again only when the job changed (charged, still owed, status, invoice #) or
  // Read again was pressed; a payment changes what's still owed, a card fee what's charged. Several are read at once.
  const need = picked.filter(function (x) { return req.force || !repSame_(x.known, x.job); });
  const answers = hcpGetAll_([].concat.apply([], need.map(function (x) {
    const p = "/jobs/" + encodeURIComponent(x.job.id);
    return [{ path: p + "/invoices" }, { path: p + "/line_items" }];
  })));
  need.forEach(function (x, k) { x.inv = repInvoicesFrom_(answers[2 * k], tz); x.fee = repFeeFrom_(answers[2 * k + 1]); });
  for (let i = 0; i < picked.length; i++) {
    const x = picked[i], job = x.job, inv = x.inv || null;
    if (inv && inv.error && inv.error !== "hcp_http") return { ok: false, error: inv.error, status: inv.status || 0 };
    let fee = inv ? x.fee : null;
    if (inv && fee === null) fee = inv.error ? null : inv.fee;
    const cu = job.customer || {}, ad = job.address || {};
    const name = String(cu.company || [cu.first_name, cu.last_name].filter(Boolean).join(" ") || "").trim().slice(0, 120);
    const total = Number(job.total_amount) || 0, owed = job.outstanding_balance === undefined || job.outstanding_balance === null ? null : Number(job.outstanding_balance) || 0;
    const tags = x.tags.join("; ").slice(0, 300);
    // a job that didn't change keeps the invoices and card fee read before (null: not touched)
    fresh[String(job.id)] = { day: x.day, inv: String(job.invoice_number || ""), client: name, addr: [ad.street, ad.street_line_2, ad.city, [ad.state, ad.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ").slice(0, 200),
      type: hcpJobType_(job).slice(0, 80), tags: tags, ws: String(job.work_status || ""), c: total, owed: owed, invoices: inv && !inv.error ? inv.list : null, fee: fee };
  }
  return withLock_(function () {
    const s = repSheet_(true), rows = repRows_(s);
    Object.keys(fresh).forEach(function (id) {
      const f = fresh[id], r = rows[id] || new Array(REP_COLS.length).fill("");
      const paidByInvoices = f.invoices ? f.invoices.reduce(function (n, i) { return n + Math.max(0, i.a - i.due); }, 0) : 0;
      const owes = f.owed !== null ? f.owed : f.invoices ? Math.max(0, f.c - paidByInvoices) : repCents_(r[10]);
      r[0] = id; r[1] = f.day; r[2] = f.inv; r[3] = f.client; r[4] = f.addr; r[5] = f.type; r[6] = f.tags; r[7] = f.ws;
      r[8] = f.c / 100; r[9] = Math.max(0, f.c - owes) / 100; r[10] = owes / 100;
      if (f.invoices) r[11] = JSON.stringify(f.invoices).slice(0, 4000);
      if (f.fee !== null) {
        r[36] = f.fee / 100;
        // the first time a fee is seen: a job already paid to Monumental was paid with it in, and stays that way
        if (f.fee > 0 && r[37] !== "yes" && r[37] !== "no") r[37] = r[25] ? "yes" : "no";
      }
      r[12] = at; r[13] = "";
      rows[id] = r;
    });
    // jobs on those days that Housecall Pro didn't send this time (canceled, moved to other days)
    Object.keys(rows).forEach(function (id) {
      const r = rows[id];
      if (fresh[id] || r[1] < from || r[1] > to) return;
      const typed = REP_TYPED.some(function (d) { return d[0] !== "split" && r[d[1]] !== "" && r[d[1]] !== null && r[d[1]] !== 0; });
      if (typed) { if (!r[13]) r[13] = at; } else delete rows[id];
    });
    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, REP_COLS.length).clearContent();
    repWrite_(s, rows);
    props.setProperty(seenKey, String(Date.now()));
    return { ok: true, jobs: pick(rows) };
  });
}
/** What's typed for one job: { id, t: { split, sName, sAmt, sDep, sDepAt, mat, mDep, mDepAt, extra, extraWhy, mInv, mPaidAt, note } }.
 *  Amounts in dollars (0 to 10,000,000, or "" for none), days as 2026-11-05, words up to 200 letters. */
/** Puts what's typed (t) into a row: the name of the first wrong field, or "" when all is well. */
function repTyped_(r, t) {
  for (let i = 0; i < REP_TYPED.length; i++) {
    const d = REP_TYPED[i], k = d[0];
    if (!(k in t)) continue;
    let v = t[k];
    if (d[2] === "money") {
      if (v === "" || v === null) v = "";
      else { v = Math.round(Number(v) * 100) / 100; if (!isFinite(v) || v < 0 || v > 1e7) return k; }
    } else if (d[2] === "day") {
      v = String(v || "");
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return k;
    } else if (d[2] === "split") {
      v = ["auto", "mon", "none"].indexOf(String(v)) === -1 ? "auto" : String(v);
    } else v = String(v || "").slice(0, 200);
    r[d[1]] = v;
  }
  return "";
}
function repPut_(req, user) {
  const id = String(req.id || ""), t = req.t && typeof req.t === "object" ? req.t : null;
  if (!id || !t) return { ok: false, error: "bad_request" };
  const s = repSheet_(true), rows = repRows_(s), r = rows[id];
  if (!r) return { ok: false, error: "gone" };
  const bad = repTyped_(r, t);
  if (bad) return { ok: false, error: "bad_value", field: bad };
  r[27] = user.name || user.id; r[28] = new Date().toISOString();
  repWrite_(s, rows);
  return { ok: true, job: repOut_(rows[id]) };
}
/** A Monumental invoice (read from their PDF in the app) recorded on a job: { id, inv: { n, d, a ($), k, f }, extra ($, optional),
 *  move (take it off another job) } or { id, del: n }. The same invoice number on another job is refused unless moved. */
function repMonInv_(req, user) {
  const id = String(req.id || "");
  const s = repSheet_(true), rows = repRows_(s), r = rows[id];
  if (!id || !r) return { ok: false, error: id ? "gone" : "bad_request" };
  const at = new Date().toISOString(), who = user.name || user.id;
  let list = repMonList_(r);
  if (req.del) {
    // one sent to accounting can't come off its job until that batch is canceled
    const sent = list.filter(function (i) { return String(i.n) === String(req.del) && i.b && !i.paid; })[0];
    if (sent) return { ok: false, error: "in_batch", b: sent.b };
    list = list.filter(function (i) { return String(i.n) !== String(req.del); });
  } else {
    const v = req.inv && typeof req.inv === "object" ? req.inv : null;
    if (!v) return { ok: false, error: "bad_request" };
    const n = String(v.n || "").trim().slice(0, 60), d = String(v.d || ""), a = Math.round(Number(v.a) * 100);
    if (!n || (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) || !isFinite(a) || a < 0 || a > 1e9) return { ok: false, error: "bad_value" };
    const other = Object.keys(rows).filter(function (k) { return k !== id && repMonList_(rows[k]).some(function (i) { return String(i.n) === n; }); })[0];
    if (other && !req.move) return { ok: false, error: "on_other", other: { id: other, client: String(rows[other][3] || ""), day: rows[other][1] } };
    const inB = other && repMonList_(rows[other]).filter(function (i) { return String(i.n) === n && i.b; })[0];
    if (inB) return { ok: false, error: "in_batch", b: inB.b };
    if (other) { rows[other][32] = JSON.stringify(repMonList_(rows[other]).filter(function (i) { return String(i.n) !== n; })); rows[other][27] = who; rows[other][28] = at; }
    const was = list.filter(function (i) { return String(i.n) === n; })[0];
    list = list.filter(function (i) { return String(i.n) !== n; });
    const keep = { n: n, d: d, a: a, k: String(v.k || "").slice(0, 60), f: String(v.f || "").slice(0, 120), by: who, at: at, paid: was ? String(was.paid || "") : "" };
    if (was) ["sent", "b", "pay", "ref"].forEach(function (k) { if (was[k]) keep[k] = was[k]; });   // sent to accounting / paid in a batch: still so
    list.push(keep);
    const mi = String(r[24] || "");
    if (mi.split(/\s*\/\s*/).indexOf(n) === -1) r[24] = (mi ? mi + " / " + n : n).slice(0, 200);
    if (req.extra !== undefined && req.extra !== null && req.extra !== "") {
      const x = Math.round(Number(req.extra) * 100) / 100;
      if (!isFinite(x) || x < 0 || x > 1e7) return { ok: false, error: "bad_value" };
      r[22] = x;
      if (!r[23]) r[23] = "Monumental invoice " + n;
    }
  }
  r[32] = JSON.stringify(list).slice(0, 45000);
  r[27] = who; r[28] = at;
  repWrite_(s, rows);
  return { ok: true, job: repOut_(rows[id]) };
}
/** Nobody has been paid yet (admins): "Date VODA paid Monumental" cleared on every job, and its invoices back to "to pay".
 *  A card fee kept in a job's split because the job looked paid comes out of the split again. */
function repClearPaid_(user) {
  const s = repSheet_(false);
  if (!s) return { ok: true, cleared: 0 };
  const rows = repRows_(s), at = new Date().toISOString(), who = user.name || user.id;
  let n = 0;
  Object.keys(rows).forEach(function (id) {
    const r = rows[id], inv = repMonList_(r);
    let changed = false;
    if (r[25]) { r[25] = ""; changed = true; }
    if (String(r[37]) === "yes") { r[37] = "no"; changed = true; }
    if (inv.some(function (i) { return i.paid; })) { r[32] = JSON.stringify(inv.map(function (i) { const c = JSON.parse(JSON.stringify(i)); c.paid = ""; return c; })); changed = true; }
    if (changed) { n++; r[27] = who; r[28] = at; }
  });
  if (n) repWrite_(s, rows);
  return { ok: true, cleared: n };
}
/** The old Excel list matched to the jobs in the app (admins only): { jobs: [{ id, t }] }. All of it is checked first and
 *  then written at once; jobs that aren't on the tab are counted and skipped. */
function repImport_(req, user) {
  const list = Array.isArray(req.jobs) ? req.jobs : null;
  if (!list || !list.length || list.length > 3000) return { ok: false, error: "bad_request" };
  const s = repSheet_(true), rows = repRows_(s), at = new Date().toISOString(), who = user.name || user.id, done = {};
  let missing = 0;
  for (let i = 0; i < list.length; i++) {
    const x = list[i] || {}, id = String(x.id || ""), t = x.t && typeof x.t === "object" ? x.t : null;
    if (!t) return { ok: false, error: "bad_request" };
    if (!rows[id]) { missing++; continue; }
    const r = (done[id] || rows[id]).slice(), bad = repTyped_(r, t);
    if (bad) return { ok: false, error: "bad_value", field: bad, id: id };
    r[27] = who; r[28] = at;
    done[id] = r;
  }
  Object.keys(done).forEach(function (id) { rows[id] = done[id]; });
  if (Object.keys(done).length) repWrite_(s, rows);
  return { ok: true, saved: Object.keys(done).length, missing: missing };
}

/* ---------------- contractor payroll ---------------- */
// A contractor's invoices (Monumental's, for now) sent to accounting from Repairs Payroll as one batch: a row per batch on
// the "Contractor payroll" tab. Their PDFs go in a private folder in the Drive of this script's owner. Accounting checks
// the batch, records the payment, and the contractor gets the pay stub by email; each invoice is then marked paid on its
// job (Repairs tab), so it can't be sent or paid again. The email addresses ("Payroll emails" tab) are typed in Settings.
const CP_SHEET = "Contractor payroll";
const CP_COLS = ["Batch", "Vendor", "Status", "Sent at", "Sent by", "Sent to", "Invoices", "Count", "Total $", "Paid $", "Paid on", "How",
  "Reference #", "From account (last 4)", "Approved by", "Approved at", "Vendor emailed to", "Vendor emailed at", "Canceled by", "Canceled at", "Left out"];
const CP_PARTY_SHEET = "Payroll emails";
const CP_PARTY_COLS = ["Name", "Email", "Kind"];
const CP_KINDS = ["accounting", "vendor"];
const CP_HOW = ["ACH", "Check", "Zelle", "Wire", "Cash", "Card", "Other"];
const CP_FOLDER = "VODA Hub - Contractor invoices";
const CP_VENDOR = "Monumental Flooring";
const CP_COMPANY = "VODA Cleaning & Restoration";
const CP_EMAIL = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[A-Za-z]{2,}$/;
const CP_MAX_FILE = 8 * 1024 * 1024, CP_MAX_MAIL = 22 * 1024 * 1024, CP_MAX_ITEMS = 100;
const CP_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function canCp_(user) { return canSee_(user, "contractors"); }
/** Where the contractor's questions go (typed in Settings › Payroll emails): the pay stub says so, and their replies go there. */
function cpReplyTo_() { const v = String(PropertiesService.getScriptProperties().getProperty("CP_REPLY_TO") || "").trim(); return CP_EMAIL.test(v) ? v : ""; }
function cpSheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(CP_SHEET);
  if (!s && !create) return null;
  if (!s) { s = ss.insertSheet(CP_SHEET); s.setFrozenRows(1); }
  const head = s.getRange(1, 1, 1, CP_COLS.length).getValues()[0];
  if (String(head[0]) !== CP_COLS[0] || String(head[CP_COLS.length - 1]) !== CP_COLS[CP_COLS.length - 1]) {
    s.getRange(1, 1, 1, CP_COLS.length).setValues([CP_COLS]).setFontWeight("bold");
    s.getRange("A:A").setNumberFormat("@");
    s.getRange("K:N").setNumberFormat("@");   // the paid day, how, the reference # and the account's last 4 stay as typed
  }
  return s;
}
/** Every batch: [{ row, b }] in the tab's order (oldest first). */
function cpAll_(s) {
  const out = [];
  if (!s || s.getLastRow() < 2) return out;
  const tz = Session.getScriptTimeZone(), iso = function (v) { return v instanceof Date ? v.toISOString() : String(v || ""); };
  s.getRange(2, 1, s.getLastRow() - 1, CP_COLS.length).getValues().forEach(function (r, i) {
    if (!String(r[0] || "").trim()) return;
    let items = [];
    try { items = JSON.parse(String(r[6] || "[]")); } catch (e) { items = []; }
    out.push({ row: i + 2, b: { id: String(r[0]).trim(), vendor: String(r[1] || ""), status: String(r[2] || ""), at: iso(r[3]), by: String(r[4] || ""), to: String(r[5] || ""),
      items: Array.isArray(items) ? items : [], total: repCents_(r[8]), paid: repCents_(r[9]), paidOn: repDay_(r[10], tz), how: String(r[11] || ""), ref: String(r[12] || ""),
      last4: String(r[13] || ""), appBy: String(r[14] || ""), appAt: iso(r[15]), vTo: String(r[16] || ""), vAt: iso(r[17]), cxBy: String(r[18] || ""), cxAt: iso(r[19]), out: String(r[20] || "") } });
  });
  return out;
}
function cpRow_(b) {
  return [b.id, b.vendor, b.status, b.at, b.by, b.to, JSON.stringify(b.items), b.items.length, b.total / 100, b.paid / 100, b.paidOn || "", b.how || "", b.ref || "",
    b.last4 || "", b.appBy || "", b.appAt || "", b.vTo || "", b.vAt || "", b.cxBy || "", b.cxAt || "", b.out || ""];
}
function cpPut_(s, row, b) {
  s.getRange(row, 1, 1, 1).setNumberFormat("@");
  s.getRange(row, 11, 1, 4).setNumberFormat("@");
  s.getRange(row, 1, 1, CP_COLS.length).setValues([cpRow_(b)]);
}
/** The addresses typed in Settings: [{ name, email, kind }]. */
function cpParties_() {
  const s = SpreadsheetApp.getActive().getSheetByName(CP_PARTY_SHEET);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, CP_PARTY_COLS.length).getValues().map(function (r) {
    return { name: String(r[0] || "").trim(), email: String(r[1] || "").trim(), kind: CP_KINDS.indexOf(String(r[2] || "").trim().toLowerCase()) === -1 ? "accounting" : String(r[2]).trim().toLowerCase() };
  }).filter(function (p) { return p.email; });
}
function cpPartiesPut_(req) {
  const list = Array.isArray(req.parties) ? req.parties : null;
  if (!list || list.length > 50) return { ok: false, error: "bad_request" };
  const reply = req.replyTo === undefined ? null : String(req.replyTo || "").trim();
  if (reply && (reply.length > 120 || !CP_EMAIL.test(reply))) return { ok: false, error: "bad_value", field: "replyTo" };
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const x = list[i] || {}, name = String(x.name || "").trim().slice(0, 80), email = String(x.email || "").trim().slice(0, 120), kind = String(x.kind || "");
    if (!name || !CP_EMAIL.test(email) || CP_KINDS.indexOf(kind) === -1) return { ok: false, error: "bad_value", at: i };
    out.push([name, email, kind]);
  }
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(CP_PARTY_SHEET);
  if (!s) { s = ss.insertSheet(CP_PARTY_SHEET); s.setFrozenRows(1); }
  s.getRange(1, 1, 1, CP_PARTY_COLS.length).setValues([CP_PARTY_COLS]).setFontWeight("bold");
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, CP_PARTY_COLS.length).clearContent();
  if (out.length) s.getRange(2, 1, out.length, CP_PARTY_COLS.length).setValues(out);
  if (reply !== null) { const P = PropertiesService.getScriptProperties(); if (reply) P.setProperty("CP_REPLY_TO", reply); else P.deleteProperty("CP_REPLY_TO"); }
  return { ok: true, parties: cpParties_(), replyTo: cpReplyTo_() };
}
/** Who an email goes to: up to 10 addresses (a list or "a@x.com, b@y.com"). */
function cpEmails_(v) {
  const all = (Array.isArray(v) ? v : String(v || "").split(/[,;\s]+/)).map(function (x) { return String(x || "").trim(); }).filter(Boolean);
  const out = [], seen = {};
  for (let i = 0; i < all.length; i++) {
    if (!CP_EMAIL.test(all[i])) return { error: "bad_email", email: all[i].slice(0, 120) };
    const k = all[i].toLowerCase();
    if (!seen[k]) { seen[k] = true; out.push(all[i]); }
  }
  if (!out.length) return { error: "no_to" };
  if (out.length > 10) return { error: "too_many_to" };
  return { list: out };
}
/** The private Drive folder for the invoices' PDFs (made the first time). */
function cpFolder_() {
  const P = PropertiesService.getScriptProperties(), id = P.getProperty("CP_FOLDER_ID");
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* made again below */ } }
  const f = DriveApp.createFolder(CP_FOLDER);
  P.setProperty("CP_FOLDER_ID", f.getId());
  return f;
}
/** A file this script put in that folder, or null: nothing else in the Drive can be read or emailed through the app. */
function cpFileOk_(id) {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(String(id || ""))) return null;
  try {
    const f = DriveApp.getFileById(String(id)), home = cpFolder_().getId(), it = f.getParents();
    if (f.isTrashed()) return null;
    while (it.hasNext()) if (it.next().getId() === home) return f;
  } catch (e) { /* not there */ }
  return null;
}
/** One invoice PDF from the app: { name, data (base64) } → { id }. */
function cpFile_(req) {
  const name = String(req.name || "").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 120) || "invoice.pdf";
  let bytes;
  try { bytes = Utilities.base64Decode(String(req.data || "")); } catch (e) { return { ok: false, error: "bad_request" }; }
  if (!bytes || !bytes.length) return { ok: false, error: "bad_request" };
  if (bytes.length > CP_MAX_FILE) return { ok: false, error: "too_big" };
  if (!(bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70)) return { ok: false, error: "not_pdf" };   // %PDF
  const f = cpFolder_().createFile(Utilities.newBlob(bytes, "application/pdf", /\.pdf$/i.test(name) ? name : name + ".pdf"));
  return { ok: true, id: f.getId() };
}
const cpEsc_ = v => String(v === null || v === undefined ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function cpMoney_(c) {
  const n = Math.round(Number(c) || 0), neg = n < 0, a = Math.abs(n), d = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-$" : "$") + d + "." + String(a % 100).padStart(2, "0");
}
function cpDay_(d) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || "")); return m ? CP_MONTHS[Number(m[2]) - 1] + " " + Number(m[3]) + ", " + m[1] : ""; }
function cpToday_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"); }
function cpAtDay_(iso) { const t = Date.parse(iso || ""); return isNaN(t) ? "" : Utilities.formatDate(new Date(t), Session.getScriptTimeZone(), "yyyy-MM-dd"); }
const cpShort_ = v => String(v || "").trim().split(/\s+/)[0] || "Contractor";
const cpPlural_ = (n, w) => n + " " + w + (n === 1 ? "" : "s");
/** A batch as the app gets it. */
function cpOut_(b) {
  return { id: b.id, vendor: b.vendor, status: b.status, at: b.at, by: b.by, to: b.to, total: b.total, paid: b.paid, paidOn: b.paidOn, how: b.how, ref: b.ref, last4: b.last4,
    appBy: b.appBy, appAt: b.appAt, vTo: b.vTo, vAt: b.vAt, cxBy: b.cxBy, cxAt: b.cxAt, out: b.out,
    items: b.items.map(function (i) { return { j: i.j, n: i.n, d: i.d, a: i.a, pay: i.pay, client: i.client, addr: i.addr, day: i.day, f: i.f, fn: i.fn }; }) };
}
/** The pay stub, as a page: the paid one (what the contractor gets) or the one waiting for approval (accounting's). */
function cpStubHtml_(b) {
  const paid = b.status === "paid", amt = function (i) { return paid ? i.pay : i.a; };
  const total = b.items.reduce(function (n, i) { return n + amt(i); }, 0);
  const th = "text-align:left;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:#5b6474;padding:6px 6px;border-bottom:1px solid #dfe3ea";
  const td = "padding:6px 6px;border-bottom:1px solid #eef0f4;font-size:11px;vertical-align:top";
  const meta = function (k, v) { return '<td style="padding:0 18px 0 0;vertical-align:top"><div style="font-size:9px;font-weight:bold;color:#5b6474;letter-spacing:.06em;text-transform:uppercase">' + k + '</div><div style="font-size:12px">' + cpEsc_(v) + "</div></td>"; };
  return '<html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#111827;margin:28px">' +
    '<table style="width:100%;border-collapse:collapse;border-bottom:3px solid #1f4fc7"><tr><td style="padding-bottom:10px"><div style="font-size:20px;font-weight:bold">' + cpEsc_(CP_COMPANY) + '</div><div style="font-size:11px;color:#5b6474">Contractor pay stub</div></td>' +
    '<td style="padding-bottom:10px;text-align:right"><div style="font-size:20px;font-weight:bold">' + cpEsc_(b.id) + '</div><div style="font-size:11px;color:#5b6474">Batch</div></td></tr></table>' +
    '<table style="border-collapse:collapse;margin:14px 0"><tr>' + meta("Paid to", b.vendor) + meta("Sent to accounting", cpDay_(cpAtDay_(b.at))) + meta("Approved by", paid ? b.appBy : "Waiting for approval") + meta("Invoices", String(b.items.length)) + "</tr></table>" +
    '<table style="width:100%;border-collapse:collapse;border:2px solid ' + (paid ? "#1d7a3e" : "#a15c07") + ';margin-bottom:14px"><tr><td style="padding:8px 10px;font-weight:bold;font-size:13px;color:' + (paid ? "#17602f" : "#7a4a0c") + '">' +
      (paid ? "PAID " + cpEsc_(cpDay_(b.paidOn)) + (b.how ? " · " + cpEsc_(b.how) : "") + (b.ref ? " · Ref " + cpEsc_(b.ref) : "") : "WAITING FOR APPROVAL") +
      '</td><td style="padding:8px 10px;font-weight:bold;font-size:13px;text-align:right;color:' + (paid ? "#17602f" : "#7a4a0c") + '">' + cpMoney_(total) + "</td></tr></table>" +
    '<table style="width:100%;border-collapse:collapse"><tr><th style="' + th + '">Invoice</th><th style="' + th + '">Client</th><th style="' + th + '">Job address</th><th style="' + th + '">Job date</th><th style="' + th + ';text-align:right">Amount</th></tr>' +
    b.items.map(function (i) {
      return "<tr><td style=\"" + td + ";font-family:'Courier New',monospace\">" + cpEsc_(i.n) + '</td><td style="' + td + '">' + cpEsc_(i.client) + '</td><td style="' + td + '">' + cpEsc_(i.addr) +
        '</td><td style="' + td + ';white-space:nowrap">' + cpEsc_(cpDay_(i.day)) + '</td><td style="' + td + ';text-align:right;white-space:nowrap">' + cpMoney_(amt(i)) + "</td></tr>";
    }).join("") +
    '<tr><td colspan="4" style="padding:8px 6px;font-weight:bold;font-size:12px;border-top:2px solid #111827">' + (paid ? "Total paid · " : "Total · ") + cpPlural_(b.items.length, "invoice") +
      '</td><td style="padding:8px 6px;font-weight:bold;font-size:12px;text-align:right;border-top:2px solid #111827">' + cpMoney_(total) + "</td></tr></table>" +
    '<p style="font-size:10px;color:#5b6474;border-top:1px solid #dfe3ea;padding-top:8px;margin-top:18px">Questions about this payment? Reply to ' +
      (cpReplyTo_() ? '<b style="color:#111827">' + cpEsc_(cpReplyTo_()) + "</b>" : "the email it came with") + ".</p></body></html>";
}
function cpStubPdf_(b) {
  return Utilities.newBlob(cpStubHtml_(b), "text/html", "stub.html").getAs("application/pdf").setName("Pay stub " + b.id + ".pdf");
}
/** The invoices as a table in an email. */
function cpMailTable_(b, paid) {
  const td = "padding:5px 8px;border-bottom:1px solid #eef0f4;font-size:13px", th = "padding:5px 8px;border-bottom:1px solid #dfe3ea;font-size:11px;text-align:left;color:#5b6474;text-transform:uppercase";
  const amt = function (i) { return paid ? i.pay : i.a; }, total = b.items.reduce(function (n, i) { return n + amt(i); }, 0);
  return '<table style="border-collapse:collapse;width:100%;max-width:760px"><tr><th style="' + th + '">Invoice</th><th style="' + th + '">Client</th>' + (paid ? '<th style="' + th + '">Address</th>' : "") +
    '<th style="' + th + ';text-align:right">' + (paid ? "Paid" : "Amount") + "</th></tr>" +
    b.items.map(function (i) {
      return '<tr><td style="' + td + ';font-family:monospace">' + cpEsc_(i.n) + '</td><td style="' + td + '">' + cpEsc_(i.client) + "</td>" + (paid ? '<td style="' + td + '">' + cpEsc_(i.addr) + "</td>" : "") +
        '<td style="' + td + ';text-align:right">' + cpMoney_(amt(i)) + "</td></tr>";
    }).join("") +
    '<tr><td style="padding:6px 8px;font-weight:bold;border-top:2px solid #111">' + cpPlural_(b.items.length, "invoice") + '</td><td></td>' + (paid ? "<td></td>" : "") +
    '<td style="padding:6px 8px;font-weight:bold;border-top:2px solid #111;text-align:right">' + cpMoney_(total) + "</td></tr></table>";
}
/** The email to accounting: the invoices' PDFs and the pay stub. */
function cpMailAccounting_(b, to, files) {
  const subject = cpShort_(b.vendor) + " invoices " + b.items.length;
  const lines = ["Hi,", "", b.vendor + " sent " + cpPlural_(b.items.length, "invoice") + " for payroll, batch " + b.id + ", total " + cpMoney_(b.total) + ". The PDFs and the pay stub are attached.", ""]
    .concat(b.items.map(function (i) { return i.n + " · " + i.client + " · " + cpMoney_(i.a); }), ["", "Approve and record the payment in VODA Hub (Contractor Payroll): " + APP_URL + "#contractors"]);
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:14px;line-height:1.5"><p>Hi,</p><p>' + cpEsc_(b.vendor) + " sent <b>" + cpPlural_(b.items.length, "invoice") +
    "</b> for payroll, batch <b>" + cpEsc_(b.id) + "</b>, total <b>" + cpMoney_(b.total) + "</b>. The PDFs and the pay stub are attached.</p>" + cpMailTable_(b, false) +
    '<p>Approve and record the payment in VODA Hub (Contractor Payroll).</p><p><a href="' + APP_URL + '#contractors" style="display:inline-block;background:#1f4fc7;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Open batch ' + cpEsc_(b.id) + "</a></p></div>";
  MailApp.sendEmail({ to: to.join(","), subject: subject, body: lines.join("\n"), htmlBody: html, name: "VODA Hub",
    attachments: files.map(function (f) { return f.getBlob(); }).concat([cpStubPdf_(b)]) });
}
/** The email to the contractor: what was paid, with the pay stub. */
function cpMailVendor_(b, to) {
  const subject = "VODA payment · " + cpPlural_(b.items.length, "invoice") + " · " + cpMoney_(b.paid);
  const how = (b.how ? " by " + b.how : "") + (b.ref ? ", reference " + b.ref : "");
  const lines = ["Hi " + cpShort_(b.vendor) + " team,", "", "We paid " + cpPlural_(b.items.length, "invoice") + " on " + cpDay_(b.paidOn) + how + ". Total " + cpMoney_(b.paid) + ". The pay stub is attached.", ""]
    .concat(b.items.map(function (i) { return i.n + " · " + i.client + " · " + i.addr + " · " + cpMoney_(i.pay); }), ["", "Questions about this payment? Reply to " + (cpReplyTo_() || "this email") + ".", "", "Thank you,", CP_COMPANY]);
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:14px;line-height:1.5"><p>Hi ' + cpEsc_(cpShort_(b.vendor)) + " team,</p><p>We paid <b>" + cpPlural_(b.items.length, "invoice") +
    "</b> on <b>" + cpEsc_(cpDay_(b.paidOn)) + "</b>" + cpEsc_(how) + ". Total <b>" + cpMoney_(b.paid) + "</b>. The pay stub is attached.</p>" + cpMailTable_(b, true) +
    "<p>Questions about this payment? Reply to " + (cpReplyTo_() ? "<b>" + cpEsc_(cpReplyTo_()) + "</b>" : "this email") + ".</p><p>Thank you,<br>" + cpEsc_(CP_COMPANY) + "</p></div>";
  const mail = { to: to.join(","), subject: subject, body: lines.join("\n"), htmlBody: html, name: CP_COMPANY, attachments: [cpStubPdf_(b)] };
  if (cpReplyTo_()) mail.replyTo = cpReplyTo_();   // their reply goes there, not to the account the app sends from
  MailApp.sendEmail(mail);
}
/** Everything on the Contractor Payroll page: the batches (newest first) and the addresses. */
function cpRead_() {
  return { ok: true, batches: cpAll_(cpSheet_(false)).map(function (x) { return cpOut_(x.b); }).reverse(), parties: cpParties_(), replyTo: cpReplyTo_() };
}
/** Is this invoice paid already, or waiting in a batch? { why, on, b, ref } or null. */
function cpTaken_(n, batches) {
  for (let i = batches.length - 1; i >= 0; i--) {
    const b = batches[i].b, it = b.items.filter(function (x) { return String(x.n) === n; })[0];
    if (!it) continue;
    if (b.status === "paid") return { why: "paid", on: b.paidOn, b: b.id, ref: b.ref };
    if (b.status === "waiting") return { why: "waiting", on: cpAtDay_(b.at), b: b.id };
  }
  return null;
}
/** Sends invoices already recorded on their jobs to accounting as a new batch: { vendor, to, items: [{ id (job), n, f (file id) }] }.
 *  Refused, with every reason, when one is paid already, waiting in another batch, on a job marked paid, or has no PDF. */
function cpSend_(req, user) {
  const to = cpEmails_(req.to);
  if (to.error) return { ok: false, error: to.error, email: to.email };
  const vendor = String(req.vendor || CP_VENDOR).trim().slice(0, 80) || CP_VENDOR;
  const list = Array.isArray(req.items) ? req.items : null;
  if (!list || !list.length || list.length > CP_MAX_ITEMS) return { ok: false, error: "bad_request" };
  const s = repSheet_(true), rows = repRows_(s), cs = cpSheet_(true), all = cpAll_(cs);
  const items = [], files = {}, seen = {}, problems = [];
  list.forEach(function (x) {
    const id = String((x && x.id) || ""), n = String((x && x.n) || "").trim(), r = rows[id];
    if (!r || !n) { problems.push({ n: n, why: "gone" }); return; }
    if (seen[n]) { problems.push({ n: n, why: "twice" }); return; }
    seen[n] = true;
    const inv = repMonList_(r).filter(function (i) { return String(i.n) === n; })[0];
    if (!inv) { problems.push({ n: n, why: "not_saved" }); return; }
    const taken = inv.paid ? { why: "paid", on: inv.paid, b: inv.b || "", ref: inv.ref || "" } : cpTaken_(n, all);
    if (taken) { taken.n = n; problems.push(taken); return; }
    if (r[25]) { problems.push({ n: n, why: "job_paid", on: r[25] }); return; }
    const f = files[x.f] || cpFileOk_(x.f);
    if (!f) { problems.push({ n: n, why: "no_pdf" }); return; }
    files[x.f] = f;
    items.push({ j: id, n: n, d: String(inv.d || ""), a: Number(inv.a) || 0, pay: Number(inv.a) || 0, client: String(r[35] || r[3] || ""), addr: String(r[4] || ""), day: r[1], f: f.getId(), fn: f.getName() });
  });
  if (problems.length) return { ok: false, error: "cant_send", problems: problems };
  const used = Object.keys(files).map(function (k) { return files[k]; });
  if (used.reduce(function (n, f) { return n + (Number(f.getSize()) || 0); }, 0) > CP_MAX_MAIL) return { ok: false, error: "too_big" };
  // the batch's name: the contractor and today ("MON-2026-11-13"), then -2, -3 on the same day
  const pre = (vendor.replace(/[^A-Za-z]/g, "").slice(0, 3) || "CON").toUpperCase(), day = cpToday_(), have = {};
  all.forEach(function (x) { have[x.b.id] = true; });
  let id = pre + "-" + day, k = 1;
  while (have[id]) id = pre + "-" + day + "-" + (++k);
  const now = new Date().toISOString(), who = user.name || user.id;
  const b = { id: id, vendor: vendor, status: "waiting", at: now, by: who, to: to.list.join(", "), items: items, total: items.reduce(function (n, i) { return n + i.a; }, 0), paid: 0 };
  cpMailAccounting_(b, to.list, used);   // first: when it can't go, nothing is marked
  items.forEach(function (i) {
    const r = rows[i.j], inv = repMonList_(r);
    inv.forEach(function (v) { if (String(v.n) === i.n) { v.sent = day; v.b = id; } });
    r[32] = JSON.stringify(inv).slice(0, 45000); r[27] = who; r[28] = now;
  });
  repWrite_(s, rows);
  cpPut_(cs, Math.max(cs.getLastRow(), 1) + 1, b);
  const ids = {};
  items.forEach(function (i) { ids[i.j] = true; });
  return { ok: true, batch: cpOut_(b), jobs: Object.keys(ids).map(function (k) { return repOut_(rows[k]); }) };
}
/** Finds a batch: { s, row, b } or null. */
function cpFind_(id) {
  const s = cpSheet_(false), x = cpAll_(s).filter(function (y) { return y.b.id === String(id || ""); })[0];
  return x ? { s: s, row: x.row, b: x.b } : null;
}
/** Takes invoices off a batch on their jobs (canceled, or left out when paying): they can be sent again. */
function cpFree_(rows, items, b) {
  items.forEach(function (i) {
    const r = rows[i.j];
    if (!r) return;
    const inv = repMonList_(r);
    inv.forEach(function (v) { if (String(v.n) === i.n && v.b === b.id && !v.paid) { delete v.sent; delete v.b; } });
    r[32] = JSON.stringify(inv).slice(0, 45000);
  });
}
/** Accounting approves a batch and records the payment: { id, items: [{ n, ok, pay ($) }], paidOn, how, ref, last4, approvedBy, to }.
 *  The invoices not ticked OK go back to "not sent"; the rest are marked paid on their jobs (a job whose invoices are all
 *  paid gets "Date VODA paid Monumental"), and the contractor is emailed the pay stub. */
function cpPay_(req, user) {
  const x = cpFind_(req.id);
  if (!x) return { ok: false, error: "gone" };
  if (x.b.status !== "waiting") return { ok: false, error: "not_waiting", batch: cpOut_(x.b) };
  const day = String(req.paidOn || ""), how = String(req.how || ""), ref = String(req.ref || "").trim().slice(0, 60), last4 = String(req.last4 || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "bad_value", field: "paidOn" };
  if (CP_HOW.indexOf(how) === -1) return { ok: false, error: "bad_value", field: "how" };
  if (last4 && !/^\d{4}$/.test(last4)) return { ok: false, error: "bad_value", field: "last4" };
  const to = cpEmails_(req.to);
  if (to.error) return { ok: false, error: to.error, email: to.email };
  const pick = {};
  (Array.isArray(req.items) ? req.items : []).forEach(function (i) { if (i && i.n) pick[String(i.n)] = i; });
  const keep = [], out = [];
  for (let k = 0; k < x.b.items.length; k++) {
    const i = x.b.items[k], p = pick[i.n];
    if (!p || p.ok === false) { out.push(i); continue; }
    const pay = Math.round(Number(p.pay) * 100);
    if (!isFinite(pay) || pay <= 0 || pay > 1e9) return { ok: false, error: "bad_value", field: "pay", n: i.n };
    keep.push(Object.assign({}, i, { pay: pay }));
  }
  if (!keep.length) return { ok: false, error: "none_ok" };
  const now = new Date().toISOString(), who = user.name || user.id;
  const b = Object.assign({}, x.b, { status: "paid", items: keep, total: keep.reduce(function (n, i) { return n + i.a; }, 0), paid: keep.reduce(function (n, i) { return n + i.pay; }, 0),
    paidOn: day, how: how, ref: ref, last4: last4, appBy: String(req.approvedBy || "").trim().slice(0, 60) || who, appAt: now, vTo: to.list.join(", "), vAt: now,
    out: out.map(function (i) { return i.n; }).join(", ").slice(0, 2000) });
  cpMailVendor_(b, to.list);   // first: when it can't go, nothing is marked paid
  const s = repSheet_(true), rows = repRows_(s);
  keep.forEach(function (i) {
    const r = rows[i.j];
    if (!r) return;
    const inv = repMonList_(r);
    let hit = false;
    inv.forEach(function (v) { if (String(v.n) === i.n) { v.paid = day; v.pay = i.pay; v.b = b.id; v.ref = ref; hit = true; } });
    if (!hit) inv.push({ n: i.n, d: i.d, a: i.a, k: "", f: i.fn, by: who, at: now, paid: day, pay: i.pay, b: b.id, ref: ref });
    if (!r[25] && inv.every(function (v) { return v.paid; })) r[25] = day;
    r[32] = JSON.stringify(inv).slice(0, 45000); r[27] = who; r[28] = now;
  });
  cpFree_(rows, out, b);
  repWrite_(s, rows);
  cpPut_(x.s, x.row, b);
  const ids = {};
  keep.concat(out).forEach(function (i) { if (rows[i.j]) ids[i.j] = true; });
  return { ok: true, batch: cpOut_(b), jobs: Object.keys(ids).map(function (k) { return repOut_(rows[k]); }) };
}
/** A batch still waiting, called off: its invoices go back to "not sent". */
function cpCancel_(req, user) {
  const x = cpFind_(req.id);
  if (!x) return { ok: false, error: "gone" };
  if (x.b.status !== "waiting") return { ok: false, error: "not_waiting", batch: cpOut_(x.b) };
  const s = repSheet_(true), rows = repRows_(s);
  cpFree_(rows, x.b.items, x.b);
  repWrite_(s, rows);
  const b = Object.assign({}, x.b, { status: "canceled", cxBy: user.name || user.id, cxAt: new Date().toISOString() });
  cpPut_(x.s, x.row, b);
  const ids = {};
  b.items.forEach(function (i) { if (rows[i.j]) ids[i.j] = true; });
  return { ok: true, batch: cpOut_(b), jobs: Object.keys(ids).map(function (k) { return repOut_(rows[k]); }) };
}
/** The email again: to accounting while the batch waits, to the contractor once it's paid ({ id, to }). */
function cpResend_(req) {
  const x = cpFind_(req.id);
  if (!x) return { ok: false, error: "gone" };
  const to = cpEmails_(req.to);
  if (to.error) return { ok: false, error: to.error, email: to.email };
  const b = x.b, now = new Date().toISOString();
  if (b.status === "waiting") {
    const files = {};
    b.items.forEach(function (i) { if (!files[i.f]) files[i.f] = cpFileOk_(i.f); });
    if (Object.keys(files).some(function (k) { return !files[k]; })) return { ok: false, error: "no_pdf" };
    cpMailAccounting_(b, to.list, Object.keys(files).map(function (k) { return files[k]; }));
    b.to = to.list.join(", ");
  } else if (b.status === "paid") {
    cpMailVendor_(b, to.list);
    b.vTo = to.list.join(", "); b.vAt = now;
  } else return { ok: false, error: "not_waiting", batch: cpOut_(b) };
  cpPut_(x.s, x.row, b);
  return { ok: true, batch: cpOut_(b) };
}
/** A canceled batch taken off the list ({ id }): its row goes, and its PDFs go to the Drive's trash unless another
 *  batch has them. Only a canceled one: waiting and paid batches are the record. */
function cpDelete_(req) {
  const x = cpFind_(req.id);
  if (!x) return { ok: false, error: "gone" };
  if (x.b.status !== "canceled") return { ok: false, error: "not_canceled", batch: cpOut_(x.b) };
  const others = {};
  cpAll_(x.s).forEach(function (y) { if (y.b.id !== x.b.id) y.b.items.forEach(function (i) { others[i.f] = true; }); });
  x.s.deleteRow(x.row);
  const files = {};
  x.b.items.forEach(function (i) { if (i.f && !others[i.f]) files[i.f] = true; });
  Object.keys(files).forEach(function (id) { const f = cpFileOk_(id); if (f) { try { f.setTrashed(true); } catch (e) { /* stays in the folder */ } } });
  return { ok: true, id: x.b.id };
}
/** A file to open in the app: the pay stub ({ id }) or one of the batch's invoices ({ id, f }). */
function cpDoc_(req) {
  const x = cpFind_(req.id);
  if (!x) return { ok: false, error: "gone" };
  if (!req.f) { const p = cpStubPdf_(x.b); return { ok: true, name: p.getName(), data: Utilities.base64Encode(p.getBytes()) }; }
  if (!x.b.items.some(function (i) { return i.f === String(req.f); })) return { ok: false, error: "gone" };
  const f = cpFileOk_(req.f);
  if (!f) return { ok: false, error: "no_pdf" };
  return { ok: true, name: f.getName(), data: Utilities.base64Encode(f.getBlob().getBytes()) };
}

/* ---------------- office scorecards ---------------- */
// One row per document, in JSON, like the Leaderboard tab: "config" (the office people, which login each one is, the
// months she's in the office, her own list of numbers and the daily goal) and one row per month ("2026-11": each day,
// each person's numbers by field, and who saved them when).

const OF_SHEET = "Office";
const OF_KINDS = ["out", "num", "admin"];   // counts toward the outgoing calls goal; any other number; typed by Admins only
const OF_MAX_FIELDS = 40;   // numbers a person can have (past-only ones included)

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
    (Array.isArray(p.fields) ? p.fields : []).slice(0, OF_MAX_FIELDS).forEach(function (f) {
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
