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
 * MONDAY TM HOURS CHECK
 * Every Monday the technician enters (or confirms) TM hrs on each truckmount truck (Tuesday when the company is
 * closed that Monday). The app shows what's left, lists the trucks that missed it from the next day on (with a red
 * number on Warehouse and Trucks), and a truck can be marked "Not available this week".
 * Reminder email (optional): in the app, Settings › TM hrs email (Admins): on or off, who gets it, a test.
 * (Or from the editor: pick "tmCheckEmailSetup" and click Run.)
 * Every morning between 7 and 8 AM (not Sundays or closed days): on Monday it lists the trucks to check that day;
 * from Tuesday on it lists the trucks still missing that week's TM hrs. Once every truck is done or marked not
 * available, the emails stop until the next Monday. It's sent from the Google account that set up the script, to
 * the Script Property TM_CHECK_EMAIL (one or more addresses, separated by commas), or to that same account if it's
 * not set. To stop it: Settings › TM hrs email, or pick "tmCheckEmailStop" and click Run.
 *
 * PAPERWORK EMAIL (optional)
 * Every Monday between 7 and 8 AM: any truck whose safety inspection or registration is due within a month, or
 * already past due. Nothing is sent when nothing is due. To turn it on: pick "paperworkEmailSetup" and click Run
 * (it sends a test email right away). It's sent from the Google account that ran the setup, to the Script Property
 * PAPERWORK_EMAIL if you add one, otherwise to TM_CHECK_EMAIL, otherwise to that same account.
 * Once a truck is renewed, put the new date in the app (Edit truck) and it drops off the email.
 * To stop it: pick "paperworkEmailStop" and click Run.
 *
 * REBUILD CALENDAR (optional)
 * Every Repairs estimate approved in Housecall Pro goes on the vendors' Google calendar on the day it was approved,
 * 6 to 7 AM, in red: "APPROVED - NEED TO SCHEDULE - <city> - <client>", with its address, the client's phone, the
 * estimate's Private notes, and in bold "Approved is $x" and "Monumental 70% is $y" (REBUILD_VENDOR and REBUILD_SHARE
 * change the name and the %). Notes written later are added above the amounts (checked once an hour for a month). To turn it on:
 * 1. In Google Calendar, make a calendar called "VODA rebuilds" in this account (Settings > Add calendar > Create new
 *    calendar) and share it with the vendor. The setup finds it by that name and keeps its ID (REBUILD_CALENDAR_ID).
 *    Another calendar: put its Calendar ID (its Settings > Integrate calendar) in REBUILD_CALENDAR_ID instead; it must be
 *    this account's, or shared with it with "Make changes to events".
 * 2. Pick "rebuildCalendarSetup" and click Run. Approve the calendar permission. It checks every 15 minutes from then on,
 *    for estimates approved from that day (REBUILD_CALENDAR_FROM; change it to an earlier yyyy-MM-dd to add earlier ones).
 * The "Rebuild calendar" tab lists each one put on the calendar. Delete its trigger (Triggers, left side) to stop it.
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
 * it ("Something else" at the bottom takes one thing that isn't on the checklist, typed in; it shows as "other", section
 * "Not on the list"). Each item lands on the Supply orders tab as "To order"; an Admin marks it Ordered, then Received. Every check (with
 * any note) is kept on the Supply checks tab. The checklists are on the Checklists tab and their items on the Supplies tab;
 * change them in the app rather than in the sheet. The tabs are made the first time the app opens Checklists.
 * When anyone sends missing items (technicians and admins), an email goes to the Script Property SUPPLY_EMAIL if you add one (for example
 * info@dnaproclean.com; several addresses separated by commas), otherwise to TM_CHECK_EMAIL, otherwise to the Google
 * account that runs this script. Set SUPPLY_EMAIL to off to stop these emails. The subject starts with "For Mike to order"
 * (change it with the Script Property SUPPLY_SUBJECT), then the checklist, how many items, and who sent it.
 * To see one: pick "supplyEmailTest" and click Run.
 *
 * NIGHTLY BACKUP (optional, recommended)
 * Pick "backupSetup" and click Run (approve the Google Drive permission), or turn it on in the app (Settings › Backups).
 * Every night around 2 AM a full copy of this sheet goes into the Drive folder "VODA Hub › Backups"; the newest 30 are
 * kept. "backupNow" makes one right away; "backupStop" turns it off. To restore, open a backup and copy what you need
 * back (or use it as the new sheet). A second Google account can keep its own copies too: Settings › Backups.
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
 * sees everyone. Someone with Office types only today's numbers (her own); someone with "Office (any day)" ticked, like an
 * Admin, types anyone's numbers on any day (the admin-only ones too), but only Admins set up the people. The Office tab
 * keeps it, one row per month plus "config", in JSON. Don't edit that tab by hand.
 *
 * ATTENDANCE (employee tardiness)
 * The app's Attendance section replaces "7. EMPLOYEE TARDINESS": a month at a time, people across and days down, each
 * day what happened (late, left early, sick, vacation, off, no call / no show, company closed, or a note) with the
 * minutes, the time and the reason. Admins set up the people (the months each one is here) and can bring in the Excel's
 * history; everyone with Attendance ticked sees everyone and types the days. The Attendance tab keeps it, one row per month
 * plus "config", in JSON. Don't edit that tab by hand.
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
// and the Monday of a week the truck was marked "not available" for the TM hrs check (a Tuesday before the check moved).
const SERVER_OWNED = ["hrsAt", "hrsBy", "tmSkip"];
const API_VERSION = 146;        // the app warns when the deployed web app is older than it expects
const ADDED_COLS_FROM = 28;   // columns after AB were added later (division, vin, color, hrsAt, hrsBy, tmSkip, tier200); older sheets get them automatically
const CHECK_DAY = 1;          // TM hrs are checked every Monday (0 = Sunday); Tuesday when that Monday is a closed day
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

let REQ_T0_ = 0;   // when this request reached doPost (its answer says how long the script worked on it: Speed)
let REQ_HCP_MS_ = 0, REQ_LOCK_MS_ = 0;   // ...and how much of it was waiting on Housecall Pro, or for another save to finish
function doPost(e) {
  REQ_T0_ = Date.now(); REQ_HCP_MS_ = 0; REQ_LOCK_MS_ = 0;
  EST_SENT_ = null;
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
    if (SETTINGS_ACTIONS.indexOf(req.action) !== -1 ? !canChangeSettings_(user) : req.action === "users" ? user.role !== "admin" && !canChangeSettings_(user)
      : ADMIN_ACTIONS.indexOf(req.action) !== -1 && user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
    if (TRUCK_ACTIONS.indexOf(req.action) !== -1 && !canSee_(user, "trucks")) return json_({ ok: false, error: "not_allowed" });
    req.user = user;
    req.by = user.name;   // every change is stamped with the signed-in person, whatever the app sends
    switch (req.action) {
      case "speedPut":
        return json_(withTabLock_(function () { return speedPut_(req); }));
      case "speedRead":
        return json_(speedRead_(req));
      case "me":
        if (user.role === "admin") {
          try { hubTidyOnce_(); } catch (e) { /* the folders move in on their next use */ }
          try { backupDailyOnce_(); } catch (e) { /* weekly until the next time */ }
        }
        return json_({ ok: true, user: publicUser_(user), settings: canChangeSettings_(user), owner: settingsOwner_() });
      case "changePasscode":
        return json_(withLock_(function () { return changePasscode_(req); }));
      case "users":
        return json_({ ok: true, owner: settingsOwner_(), users: readUsers_(usersSheet_()).map(function (x) { return publicUser_(x.u); }) });
      case "settingsOwner":
        return json_(withLock_(function () { return settingsOwnerPut_(req); }));
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
        try { supplies = supCached_(user); } catch (e) { supplies = null; }   // nor do the checklists
        let docs;   // Admins: the documents expired or expiring soon (the Documents tab's count and the notice)
        if (user.role === "admin") { try { docs = docSummary_(); } catch (e) { docs = undefined; } }
        return json_({ ok: true, trucks: trucks, gps: gps, supplies: supplies, docs: docs, me: Object.assign(publicUser_(user), { owner: settingsOwner_() }), serverTime: new Date().toISOString() });
      }
      case "saveTruck":
        return json_(withLock_(function () { return saveTruck_(req); }));
      case "deleteTruck":
        return json_(withLock_(function () { return deleteTruck_(req); }));
      case "tmSkip":
        return json_(withLock_(function () { return tmSkip_(req); }));
      case "backupInfo":
        return json_(backupInfo_());
      case "backupSet":
        return json_(withLock_(function () { return backupSet_(req); }));
      case "tmMail":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return tmMail_(req); }));
      case "history":
        return json_({ ok: true, entries: history_(String(req.id || "")) });
      case "services":
        return json_(withLock_(function () { return { ok: true, services: svcList_(String(req.truckId || "")) }; }));
      case "saveService":
        return json_(withLock_(function () { return svcSave_(req); }));
      case "deleteService":
        return json_(withLock_(function () { return svcDelete_(req); }));
      case "receiptRead":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(rcptRead_(req));
      case "receiptFile":
        if (!canSee_(user, "trucks")) return json_({ ok: false, error: "not_allowed" });
        return json_(rcptFile_(req));
      case "setShop":
        return json_(setShop_(req));
      case "gpsStops":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(gpsStops_(req));
      case "gpsStopsSet":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return gpsStopsSet_(req); }));
      case "supplies":
        return json_({ ok: true, supplies: suppliesForApp_(false, user) });
      case "supplyReport":
        supTouch_(); return json_(withLock_(function () { return supplyReport_(req); }));
      case "supplyStatus":
        supTouch_(); return json_(withLock_(function () { return supplyStatus_(req); }));
      case "saveChecklist":
        supTouch_(); return json_(withLock_(function () { return saveChecklist_(req); }));
      case "deleteChecklist":
        supTouch_(); return json_(withLock_(function () { return deleteChecklist_(req); }));
      case "mergeChecklist":
        supTouch_(); return json_(withLock_(function () { return mergeChecklist_(req); }));
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
        if (!canOffice_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(ofRead_(user, req.year));
      case "payRead":
        if (!canPay_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(payRead_());
      case "payPut":
        if (!canPay_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return payPut_(req); }));
      case "ofPut":
        if (!canOffice_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return ofPut_(req); }));
      case "pcRead":
        if (!canOffice_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(pcRead_(req, user));
      case "comClients":
        if (!canOffice_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(comClients_(user));
      case "pcSync":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(pcSyncStep_(req));
      case "pcDayMarks":
        if (!canOffice_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(pcDayMarks_(req, user));
      case "pcMark":
        if (!canOffice_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return pcMark_(req, user); }));
      case "pcAssign":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return pcSetAssign_(req); }));
      case "pcMarks":
        if (!canOffice_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(pcMarks_(req));
      case "kpiRead":
        if (!canSee_(user, KPI)) return json_({ ok: false, error: "not_allowed" });
        return json_(kpiRead_(req, user));
      case "kpiPut":
        if (!canSee_(user, KPI)) return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return kpiPut_(req, user); }));
      case "kpiPeople":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return kpiSetPeople_(req); }));
      case "kpiImport":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return kpiImport_(req); }));
      case "attendance":
        if (!canSee_(user, "attendance")) return json_({ ok: false, error: "not_allowed" });
        return json_(atRead_(user, req.year));
      case "atPut":
        if (!canSee_(user, "attendance")) return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return atPut_(req); }));
      case "docList": case "docSave": case "docDelete": case "docFile":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        if (req.action === "docList") return json_(docList_());
        if (req.action === "docFile") return json_(docFile_(req));
        return json_(withTabLock_(function () { return req.action === "docSave" ? docSave_(req, user) : docDelete_(req); }));
      case "estMarkSent":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return estMarkSent_(req, user); }));
      case "estProbe":
        return json_(estProbe_(req));
      case "hcpTest":
        return json_(hcpTest_(req));
      case "revenue":
        if (!canSee_(user, "revenue") && !canSee_(user, "marketing")) return json_({ ok: false, error: "not_allowed" });
        return json_(revPrivate_(revRead_(req.year), user));
      case "revBooked":
        if (!canSee_(user, "revenue")) return json_({ ok: false, error: "not_allowed" });
        return json_(revBooked_(req));
      case "revSync":
        if (!canSee_(user, "revenue") && !canSee_(user, "marketing")) return json_({ ok: false, error: "not_allowed" });
        return json_(revPrivate_(revSync_(req), user));
      case "rpRead":
        if (!canCpm_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(rpRead_(req.force === true));
      case "rpRule":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return rpRule_(req, user); }));
      case "rpSent":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return rpSent_(req, user); }));
      case "rpImport":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return rpImport_(req); }));
      case "cpmRead":
        if (!canCpm_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(cpmRead_());
      case "cpmImport":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return cpmImport_(req, user); }));
      case "cashSync":
        if (!canSee_(user, "revenue")) return json_({ ok: false, error: "not_allowed" });
        return json_(cashSync_(req));   // the reading isn't locked (it takes a while); the writing is
      case "srvSync":
        if (!canSee_(user, "revenue")) return json_({ ok: false, error: "not_allowed" });
        return json_(srvSync_(req));
      case "srvRead":
        if (!canSee_(user, "revenue")) return json_({ ok: false, error: "not_allowed" });
        return json_(srvRead_(req));
      case "srvMapPut":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return srvMapPut_(req); }));
      case "cashRead":
        if (!canSee_(user, "revenue")) return json_({ ok: false, error: "not_allowed" });
        return json_(cashRead_(req));
      case "unsentRead":
        if (!canSee_(user, "revenue")) return json_({ ok: false, error: "not_allowed" });
        return json_(unsentRead_(req));
      case "priceList":
        if (user.role !== "admin" && !canPriceCheck_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(priceList_(user, false));
      case "priceScan":
        if (user.role !== "admin" && !canPriceCheck_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(priceList_(user, true));
      case "priceHistory":
        if (user.role !== "admin" && !canPriceCheck_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(priceHistory_(req));
      case "priceCheck":
        if (!canPriceCheck_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return priceCheck_(req, user); }));
      case "setPriceCheck":
        return json_(withLock_(function () { return setPriceCheck_(req); }));
      case "ofBooked":
        if (!ofEditor_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(ofBooked_(req));
      case "bkPick":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return bkPick_(req, user); }));
      case "estimates":
        if (!canEst_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(estRead_(req.year, user));
      case "estReportPdf":
        if (!estAll_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(estReportPdf_(req));
      case "estReportsPut":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return estReportsPut_(req); }));
      case "estSync":
        if (!canEst_(user) && !canOffice_(user)) return json_({ ok: false, error: "not_allowed" });
        // Office (Office › Estimates): what changed, never every estimate again
        return json_(estSync_(canEst_(user) ? req : Object.assign({}, req, { full: false }), user));
      case "ofEstimates": {
        if (!canOffice_(user) || !ofEstOk_(user)) return json_({ ok: false, error: "not_allowed" });
        const out = estReadDept_(req.year, "c");
        if (out.ok) ofEstMarksOn_(out.estimates);
        return json_(out);
      }
      case "ofEstMark":
        if (!canOffice_(user) || !ofEstOk_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return ofEstMark_(req, user); }));
      case "ofEstDayMarks":
        if (!canOffice_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(ofEstDayMarks_(req, user));
      case "estCall":
        if (!canEst_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return estCall_(req, user); }));
      case "estCallDays":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(estCallDaysPut_(req));
      case "ofEstWho":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return ofEstWhoPut_(req); }));
      case "trcDay":
        if (!trcOk_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(trcDay_(req));
      case "trcMark":
        if (!trcOk_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return trcMark_(req, user); }));
      case "trcReport":
        if (!trcOk_(user)) return json_({ ok: false, error: "not_allowed" });
        return json_(trcReport_(req));
      case "trcWho":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withTabLock_(function () { return trcWhoPut_(req); }));
      case "trcImport":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return trcImport_(req); }));
      case "goals":
        if (!canSee_(user, "revenue")) return json_({ ok: false, error: "not_allowed" });
        return json_(goalsRead_(req.year));
      case "goalsPut":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return goalsPut_(req); }));
      case "marketing":
        if (!canSee_(user, "marketing")) return json_({ ok: false, error: "not_allowed" });
        return json_(mktRead_());
      case "mktPut":
        if (!canSee_(user, "marketing")) return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return mktPut_(req, user); }));
      case "mktMove":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return mktMove_(req, user); }));
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
        return json_(withLock_(function () { return cpDelete_(req, user); }));
      case "cpBefore":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return cpBefore_(req, user); }));
      case "cpBeforeJobs":
        if (user.role !== "admin") return json_({ ok: false, error: "not_allowed" });
        return json_(withLock_(function () { return cpBeforeJobs_(req, user); }));
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
const ROLES = ["admin", "tech", "csr"];   // csr: a Non-admin in the office (sees what's ticked, like a Non-admin)
const ADMIN_ACTIONS = ["hcpTest", "estProbe", "deleteTruck", "saveService", "deleteService", "users", "invite", "saveUser", "resetUser", "setPayroll", "setPriceCheck", "setShop", "gpsStops", "gpsStopsSet",
  "supplyStatus", "saveChecklist", "deleteChecklist", "mergeChecklist", "backupInfo", "backupSet", "speedRead"];
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
    role: ROLES.indexOf(req.role) !== -1 ? req.role : "tech", status: "invited", salt: "", hash: "", ver: 1, created: new Date().toISOString(), lastLogin: "",
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
  // a new name ({ id, name }): anyone's (one's own too), but the owner of Settings' only by himself; the sign-in name,
  // passcode and what they see stay; past records keep the name they had, but Approved by on Contractor payroll's
  // batches (a pay stub's) follows it
  if (req.name !== undefined) {
    const nm = String(req.name || "").trim().replace(/\s+/g, " ");
    if (!nm || nm.length > 40) return { ok: false, error: "bad_name" };
    if (x.u.id === settingsOwner_() && req.user.id !== x.u.id) return { ok: false, error: "owner" };
    if (all.some(function (y) { return y.u.id !== x.u.id && y.u.status !== "disabled" && String(y.u.name || "").toLowerCase() === nm.toLowerCase(); })) return { ok: false, error: "name_taken" };
    const old = String(x.u.name || "");
    if (nm !== old) { x.u.name = nm; writeUser_(s, x.rowIndex, x.u); cpRenameApprover_(old, nm); }
    return { ok: true, user: publicUser_(x.u) };
  }
  if (x.u.id === req.user.id) return { ok: false, error: "self" };
  if (x.u.id === settingsOwner_()) return { ok: false, error: "owner" };
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
    if (parseAccess_(x.u.access).indexOf(PRICE_CHECK) !== -1) access.push(PRICE_CHECK);   // switched only with setPriceCheck
    if (parseAccess_(x.u.access).indexOf(SETTINGS) !== -1) access.push(SETTINGS);         // ... and Settings only by its owner
    if (accessText_(access) !== accessText_(parseAccess_(x.u.access))) { x.u.access = accessText_(access); writeUser_(s, x.rowIndex, x.u); }
  }
  if (x.u.role !== role || x.u.status !== status) {
    const sameRights = x.u.status === status && (x.u.role === "admin") === (role === "admin");   // Non-admin <-> CSR: what they see stays the ticks
    x.u.role = role;
    x.u.status = status;
    if (!sameRights) x.u.ver = Number(x.u.ver) + 1;      // takes effect on their phone straight away (Non-admin <-> CSR: they stay signed in)
    writeUser_(s, x.rowIndex, x.u);
  }
  return { ok: true, user: publicUser_(x.u) };
}

/** Admin: Payroll on or off for an admin ({ id, on }). Only an admin who sees Payroll can switch it, for himself or
 *  another admin; while no admin sees it yet, any admin can switch it on (the first time). Nobody switches himself off,
 *  so there's always someone who can. Technicians never see Payroll. */
function setPayroll_(req) { return setAdminFlag_(req, PAYROLL, true); }
/** A per-admin switch (VODA Payroll, checking price changes): an admin who has it switches it for the others; the first
 *  time, any admin can switch it on (for himself or another admin). */
function setAdminFlag_(req, FLAG, ownerAny) {
  const s = usersSheet_();
  const all = readUsers_(s);
  const x = all.filter(function (y) { return y.u.id === String(req.id || ""); })[0];
  if (!x) return { ok: false, error: "gone" };
  if (x.u.role !== "admin") return { ok: false, error: "bad_request" };
  const has = function (u) { return u.role === "admin" && u.status === "active" && parseAccess_(u.access).indexOf(FLAG) !== -1; };
  const anyone = all.some(function (y) { return has(y.u); });
  const me = all.filter(function (y) { return y.u.id === req.user.id; })[0];
  // the owner of Settings switches it for anyone, himself too (off and back on): there's always someone who can
  const owner = ownerAny && settingsOwner_() && req.user.id === settingsOwner_();
  if (!owner && (anyone ? !(me && has(me.u)) : !req.on)) return { ok: false, error: "not_allowed" };
  if (!owner && !req.on && x.u.id === req.user.id) return { ok: false, error: "self" };
  const access = parseAccess_(x.u.access).filter(function (a) { return a !== FLAG; });
  if (req.on) access.push(FLAG);
  if (accessText_(access) !== accessText_(parseAccess_(x.u.access))) { x.u.access = accessText_(access); writeUser_(s, x.rowIndex, x.u); }
  return { ok: true, user: publicUser_(x.u) };
}

/** Admin: a new one-time code so someone can choose a new passcode (or a fresh invite if the old one ran out). */
function resetUser_(req) {
  const s = usersSheet_();
  const x = readUsers_(s).filter(function (y) { return y.u.id === String(req.id || ""); })[0];
  if (!x) return { ok: false, error: "gone" };
  if (x.u.id === settingsOwner_() && req.user.id !== x.u.id) return { ok: false, error: "owner" };
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
const SVC_COLS = ["id", "truckId", "truck", "date", "type", "what", "miles", "tmHrs", "shop", "cost", "payment", "check", "source", "updatedAt", "by", "receipt"];
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
  // a tab made before receipts were kept: its heading for them
  if (s.getMaxColumns() < SVC_COLS.length) s.insertColumnsAfter(s.getMaxColumns(), SVC_COLS.length - s.getMaxColumns());
  if (String(s.getRange(1, SVC_COLS.length, 1, 1).getValues()[0][0]) !== "receipt") {
    s.getRange(1, SVC_COLS.length, 1, 1).setValues([["receipt"]]).setFontWeight("bold");
    s.getRange(2, SVC_COLS.length, Math.max(s.getMaxRows() - 1, 1), 1).setNumberFormat("@");
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
    check: "", source: "", updatedAt: "", by: "",
    receipt: /^[A-Za-z0-9_-]{10,200}$/.test(String(raw.receipt || "")) ? String(raw.receipt) : ""   // its receipt in the private Drive folder
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

/* ---- Receipts: a truck's service receipt (a PDF or a photo) read by Google's own text reading (the file is turned into
   a Google Doc for a moment, its text taken, the Doc thrown away), kept in a private Drive folder and linked to its
   service record. The app fills the service from the text; someone checks it and saves. ---- */
const RCPT_MAX = 10 * 1024 * 1024;
function rcptFolder_() { return hubSub_("RCPT_FOLDER_ID"); }   // VODA Hub › Receipts

/* ---- Drive: everything the app keeps sits in one private folder, "VODA Hub": Receipts, Contractor invoices and
   Backups inside it. A folder made before it (in My Drive, under its old name) is moved in and renamed once: the same
   folder, so its files and the app's links to them stay. One the owner moves out on purpose stays where he put it. ---- */
const HUB_FOLDER = "VODA Hub";
// each folder: its Script Property (its id) → [its old name in My Drive, its name inside VODA Hub]
const HUB_SUBS = { RCPT_FOLDER_ID: ["VODA Hub receipts", "Receipts"], CP_FOLDER_ID: ["VODA Hub - Contractor invoices", "Contractor invoices"], BACKUP_FOLDER_ID: ["VODA Prime backups", "Backups"],
  RB_FOLDER_ID: ["VODA Hub - Rebuild estimates", "Rebuild estimates"], DOC_FOLDER_ID: ["VODA Hub - Documentation", "Documentation"] };
function hubFolder_() {
  const P = PropertiesService.getScriptProperties(), id = P.getProperty("HUB_FOLDER_ID");
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* made again below */ } }
  const f = DriveApp.createFolder(HUB_FOLDER);
  P.setProperty("HUB_FOLDER_ID", f.getId());
  return f;
}
/** The app's folder kept in Script Property `prop`, or the one with its old name (backups: found by name before), or null. */
function hubFind_(prop) {
  const P = PropertiesService.getScriptProperties(), id = P.getProperty(prop);
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* gone: by name below */ } }
  const it = DriveApp.getFoldersByName(HUB_SUBS[prop][0]);
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}
/** Into VODA Hub with its new name, once (its id noted as moved: not again, even if he moves it out later). */
function hubMoveIn_(prop, f) {
  const P = PropertiesService.getScriptProperties();
  P.setProperty(prop, f.getId());
  if (P.getProperty(prop + "_IN") === f.getId()) return f;
  try {
    const hub = hubFolder_(), it = f.getParents();
    let inside = false;
    while (it.hasNext()) if (it.next().getId() === hub.getId()) inside = true;
    if (!inside) f.moveTo(hub);
    if (f.getName() === HUB_SUBS[prop][0]) f.setName(HUB_SUBS[prop][1]);
    P.setProperty(prop + "_IN", f.getId());
  } catch (e) { /* stays where it is (it still works); tried again next time */ }
  return f;
}
/** The app's folder for `prop` inside VODA Hub: the one it has (moved in once), else made there. */
function hubSub_(prop) {
  const f = hubFind_(prop);
  if (f) return hubMoveIn_(prop, f);
  const made = hubFolder_().createFolder(HUB_SUBS[prop][1]), P = PropertiesService.getScriptProperties();
  P.setProperty(prop, made.getId()); P.setProperty(prop + "_IN", made.getId());
  return made;
}
/** Once, when an admin opens the app: the folders made before VODA Hub moved into it now (not when each is next used). */
function hubTidyOnce_() {
  const P = PropertiesService.getScriptProperties();
  if (P.getProperty("HUB_TIDY") === "1") return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;   // busy (a long read): the next time the app opens
  try {
    if (P.getProperty("HUB_TIDY") === "1") return;
    Object.keys(HUB_SUBS).forEach(function (prop) { const f = hubFind_(prop); if (f) hubMoveIn_(prop, f); });   // none made yet: nothing made now
    P.setProperty("HUB_TIDY", "1");
  } finally { lock.releaseLock(); }
}
/** Run once from the editor, if wanted: the same, now. */
function hubTidy() {
  PropertiesService.getScriptProperties().deleteProperty("HUB_TIDY");
  hubTidyOnce_();
  Logger.log('The app\'s Drive folders are inside "' + HUB_FOLDER + '": ' + Object.keys(HUB_SUBS).map(function (k) { return HUB_SUBS[k][1]; }).join(", ") + ".");
}
/** A receipt this script put in that folder, or null: nothing else in the Drive can be opened through the app. */
function rcptFileOk_(id) {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(String(id || ""))) return null;
  try {
    const f = DriveApp.getFileById(String(id)), home = rcptFolder_().getId(), it = f.getParents();
    if (f.isTrashed()) return null;
    while (it.hasNext()) if (it.next().getId() === home) return f;
  } catch (e) { /* not there */ }
  return null;
}
/** What kind of file the bytes are: a PDF, a JPEG or a PNG photo (what Google can read), else "". */
function rcptKind_(b) {
  if (b[0] === 37 && b[1] === 80 && b[2] === 68 && b[3] === 70) return "application/pdf";   // %PDF
  if ((b[0] & 255) === 0xFF && (b[1] & 255) === 0xD8) return "image/jpeg";
  if ((b[0] & 255) === 0x89 && b[1] === 80 && b[2] === 78 && b[3] === 71) return "image/png";
  return "";
}
/** The text on a receipt: Drive turns the file into a Google Doc (reading the photo or PDF), the text is exported, and
 *  the Doc goes in the trash. */
function rcptOcr_(blob) {
  const token = ScriptApp.getOAuthToken(), auth = { Authorization: "Bearer " + token }, b = "voda" + Utilities.getUuid().replace(/-/g, "");
  const head = "--" + b + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify({ name: "VODA receipt (reading)", mimeType: "application/vnd.google-apps.document" }) +
    "\r\n--" + b + "\r\nContent-Type: " + blob.getContentType() + "\r\n\r\n";
  const payload = Utilities.newBlob(head).getBytes().concat(blob.getBytes(), Utilities.newBlob("\r\n--" + b + "--").getBytes());
  const up = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=en&fields=id",
    { method: "post", contentType: "multipart/related; boundary=" + b, payload: payload, headers: auth, muteHttpExceptions: true });
  if (up.getResponseCode() >= 300) throw new Error("Google couldn't read it (" + up.getResponseCode() + ")");
  const id = JSON.parse(up.getContentText()).id;
  try {
    const t = UrlFetchApp.fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "/export?mimeType=text%2Fplain", { headers: auth, muteHttpExceptions: true });
    if (t.getResponseCode() >= 300) throw new Error("Google couldn't read it (" + t.getResponseCode() + ")");
    return t.getContentText();
  } finally { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* gone already */ } }
}
/** A receipt from the app: { name, data (base64) } → { id (kept in the folder), text (what it says; "" if Google couldn't
 *  read it) }. */
function rcptRead_(req) {
  let bytes;
  try { bytes = Utilities.base64Decode(String(req.data || "")); } catch (e) { return { ok: false, error: "bad_request" }; }
  if (!bytes || !bytes.length) return { ok: false, error: "bad_request" };
  if (bytes.length > RCPT_MAX) return { ok: false, error: "too_big" };
  const kind = rcptKind_(bytes);
  if (!kind) return { ok: false, error: "not_receipt" };
  const ext = kind === "application/pdf" ? ".pdf" : kind === "image/png" ? ".png" : ".jpg";
  let name = String(req.name || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\.[A-Za-z0-9]{2,5}$/, "").trim().slice(0, 100) || "Receipt";
  name = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd") + " " + name + ext;
  const f = rcptFolder_().createFile(Utilities.newBlob(bytes, kind, name));
  let text = "", why = "";
  try { text = String(rcptOcr_(f.getBlob()) || ""); } catch (e) { why = String(e && e.message || e).slice(0, 200); }
  return { ok: true, id: f.getId(), name: name, text: text.replace(/﻿/g, "").slice(0, 20000), read: !why, why: why };
}
/** A receipt to look at: { name, mime, data (base64) }. */
function rcptFile_(req) {
  const f = rcptFileOk_(req.id);
  if (!f) return { ok: false, error: "gone" };
  const blob = f.getBlob();
  return { ok: true, name: f.getName(), mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
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
  // the day of the service: from its receipt when there is one (it may be logged days later), else today
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(log.date || "")) && String(log.date) <= today ? String(log.date) : today;
  const rec = svcClean_({
    date: day,
    truckId: t.id, type: types.join(", "), what: items.join(", ") + (note ? " - " + note : ""),
    miles: log.miles, tmHrs: log.hrs, shop: log.shop, cost: log.cost, receipt: log.receipt
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

/* ---------------- Monday TM hours check ---------------- */

function tmNow_() { return new Date(); }   // tests move the clock
/** yyyy-MM-dd plus n days. */
function tmAddDays_(day, n) { const p = day.split("-").map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10); }
/** A day the company is closed: New Year's Day, 4th of July, Thanksgiving, Christmas. */
function tmClosed_(day) {
  const md = day.slice(5), d = Number(day.slice(8));
  return md === "01-01" || md === "07-04" || md === "12-25" || (day.slice(5, 7) === "11" && d >= 22 && d <= 28 && new Date(day + "T12:00:00Z").getUTCDay() === 4);
}
/** The Monday that starts the check week holding `when`, as yyyy-MM-dd in the script's time zone. */
function checkWeek_(when) {
  const p = Utilities.formatDate(when, Session.getScriptTimeZone(), "yyyy-MM-dd").split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - CHECK_DAY + 7) % 7));
  return d.toISOString().slice(0, 10);
}
/** The day the week's check is due: its Monday, or Tuesday when the company is closed that Monday. */
function tmDueDay_(week) { return tmClosed_(week) ? tmAddDays_(week, 1) : week; }
/** A "not available" mark from the check week `week` (one saved on a Tuesday, before the check moved to Mondays, too). */
function tmInWeek_(day, week) { day = String(day || ""); return !!day && day >= week && day < tmAddDays_(week, 7); }
const TM_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TM_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Mon Nov 16" */
function tmDayText_(day) { const d = new Date(day + "T12:00:00Z"); return TM_DAYS[d.getUTCDay()].slice(0, 3) + " " + TM_MONTHS[d.getUTCMonth()] + " " + d.getUTCDate(); }
/** done, skipped or missed for the check week `week`. */
function checkState_(t, week) {
  if (t.hrsAt) {
    const at = new Date(t.hrsAt);
    if (!isNaN(at.getTime()) && Utilities.formatDate(at, Session.getScriptTimeZone(), "yyyy-MM-dd") >= week) return "done";
  }
  return tmInWeek_(t.tmSkip, week) ? "skipped" : "missed";
}

/** "Not available this week" for the TM hrs check (Admins and Technicians). Doesn't touch anything else on the truck. */
function tmSkip_(req) {
  const id = String(req.id || "");
  const found = readTrucks_().filter(function (x) { return x.truck.id === id; })[0];
  if (!found) return { ok: false, error: "gone" };
  if (TM_KINDS.indexOf(found.truck.tm) < 1) return { ok: false, error: "not_allowed" };
  const t = found.truck;
  const week = checkWeek_(tmNow_());
  const old = String(t.tmSkip || "");
  const on = req.on === true;
  const next = on ? week : (tmInWeek_(old, week) ? "" : old);
  if (next !== old) {
    t.tmSkip = next;
    sheet_("Trucks").getRange(found.rowIndex, TRUCK_COLS.indexOf("tmSkip") + 1).setValue(next);
    appendLog_(t, { kind: "skip", items: [on ? "Not available for the Monday TM hrs check" : "TM hrs check: not available undone"] }, req.by);
  }
  return { ok: true, truck: t, week: week };
}

/** Run once from the editor (or Settings › TM hrs email in the app): a Monday morning list of trucks to check, then
 *  every morning from Tuesday on the trucks still missing that week's TM hrs, until they're all done. Sends a test now. */
function tmCheckEmailSetup() {
  tmCheckSchedule_();
  const sent = tmCheckEmail(true);
  Logger.log("TM hrs check email is on: Monday morning, then every morning until every truck is done. Test email sent to " + sent + ".");
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
/** Who gets the TM hrs email (Script Property TM_CHECK_EMAIL); empty: the Google account that set up the script. */
function tmMailTo_() {
  return String(PropertiesService.getScriptProperties().getProperty("TM_CHECK_EMAIL") || "").split(/[,;\s]+/)
    .map(function (x) { return x.trim(); }).filter(Boolean);
}
/** Settings › TM hrs email (Admins): whether it's on and who gets it; with `set`: turn it on or off and change who
 *  (an empty list: the Google account that set up the script); with `test`: a test email now. */
function tmMail_(req) {
  const P = PropertiesService.getScriptProperties();
  let sent = false;
  if (req.set === true) {
    const raw = Array.isArray(req.to) ? req.to : [];
    const to = raw.length ? cpEmails_(raw) : { list: [] };   // none: the Google account that set up the script
    if (to.error) return { ok: false, error: to.error, email: to.email || "" };
    if (to.list.length) P.setProperty("TM_CHECK_EMAIL", to.list.join(", ")); else P.deleteProperty("TM_CHECK_EMAIL");
    if (req.on === true) tmCheckSchedule_();
    else if (req.on === false) tmCheckEmailStop();
    if (req.test === true) sent = !!tmCheckEmail(true);
  }
  const on = ScriptApp.getProjectTriggers().some(function (tr) { return tr.getHandlerFunction() === "tmCheckEmail"; });
  return { ok: true, on: on, to: tmMailTo_(), sent: sent };
}
/** Runs every morning (not Sundays or closed days). Monday: the trucks to check today. Later in the week: the trucks
 *  with no TM hrs since Monday that weren't marked not available. Sends nothing once they're all done. */
function tmCheckEmail(test) {
  const isTest = test === true;
  // A setup from before daily reminders ran only on Wednesdays: switch it over the first time it runs.
  if (!isTest && PropertiesService.getScriptProperties().getProperty("TM_CHECK_SCHEDULE") !== "daily") tmCheckSchedule_();
  const tz = Session.getScriptTimeZone();
  const now = tmNow_();
  const day = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  const week = checkWeek_(now), due = tmDueDay_(week), dueName = TM_DAYS[new Date(due + "T12:00:00Z").getUTCDay()];
  if (!isTest && (new Date(day + "T12:00:00Z").getUTCDay() === 0 || tmClosed_(day) || day < due)) { Logger.log("Closed today: no TM hrs email."); return ""; }
  const today = day <= due;   // the check day itself
  const daysLate = Math.round((Date.parse(day + "T12:00:00Z") - Date.parse(due + "T12:00:00Z")) / 864e5);
  const tm = readTrucks_().map(function (x) { return x.truck; }).filter(function (t) { return TM_KINDS.indexOf(t.tm) > 0; });
  const state = {};
  tm.forEach(function (t) { state[t.id] = checkState_(t, week); });
  const missed = tm.filter(function (t) { return state[t.id] === "missed"; });
  const skipped = tm.filter(function (t) { return state[t.id] === "skipped"; });
  const done = tm.filter(function (t) { return state[t.id] === "done"; });
  if (!missed.length && !isTest) { Logger.log("All " + tm.length + " truckmount trucks are done for this week. No email sent."); return ""; }
  const lastText = function (t) {
    if (!t.hrsAt) return "no TM hrs entered in the app yet";
    const at = new Date(t.hrsAt);
    if (isNaN(at.getTime())) return "no TM hrs entered in the app yet";
    const days = Math.floor((now.getTime() - at.getTime()) / 864e5);
    return "last entered " + tmDayText_(Utilities.formatDate(at, tz, "yyyy-MM-dd")).slice(4) + (t.hrsBy ? " by " + t.hrsBy : "") + " (" + days + " day" + (days === 1 ? "" : "s") + " ago, " + (t.hrsNow === null || t.hrsNow === "" || t.hrsNow === undefined ? "no hrs" : t.hrsNow + " hrs") + ")";
  };
  const name = function (t) { return t.unit + (t.driver ? " · " + t.driver : ""); };
  const lines = [];
  if (isTest) lines.push("TEST: this is what the reminder looks like. It comes Monday morning, then every morning (not Sundays or closed days) while a truck is still missing its TM hrs.", "");
  lines.push((today ? "Today's TM hrs check, " : dueName + "'s TM hrs check, ") + tmDayText_(due) + ": " + done.length + " of " + tm.length + " truckmount trucks done.", "");
  if (missed.length) { lines.push(today ? "To check today:" : "Missed (not checked):"); missed.forEach(function (t) { lines.push("• " + name(t) + ": " + lastText(t)); }); lines.push(""); }
  else lines.push(today ? "All done for today." : "Nothing missed so far this week.", "");
  if (skipped.length) { lines.push("Marked not available:"); skipped.forEach(function (t) { lines.push("• " + name(t)); }); lines.push(""); }
  if (missed.length && today) lines.push("Enter the TM hrs on each truck in the app, or tap Confirm if they haven't changed. Truck not there? Open it and tap Not available this week.", "");
  if (missed.length && !today) lines.push("This email comes every morning until each truck above has its TM hrs entered or is marked Not available this week. Then it stops until next " + dueName + "'s check.", "");
  lines.push("Open the app: " + APP_URL);
  const toList = tmMailTo_();
  const to = toList.length ? toList.join(",") : Session.getEffectiveUser().getEmail();
  const units = missed.map(function (t) { return t.unit; }).join(", ");
  const subject = (isTest ? "(Test) " : "") + (!missed.length ? dueName + " TM hrs check: all done"
    : today ? "Today's TM hrs check: " + missed.length + " truck" + (missed.length === 1 ? "" : "s") + " to do (" + units + ")"
    : daysLate > 1 ? "Still missing TM hrs (" + daysLate + " days since " + dueName + "): " + units : "Missed " + dueName + "'s TM hrs check: " + units);
  MailApp.sendEmail({ to: to, subject: subject.slice(0, 250), body: lines.join("\n") });
  return to;
}

/* ---- Documentation (Admins only): the company's and the people's certificates and licenses (IICRC, EPA, contractor
   licenses…), each with its file (a PDF or a photo, in VODA Hub › Documentation in this Google account's Drive: never
   shared) and the day it expires. Admins are warned in the app (a count on the Documents tab, a notice when the app
   opens) from its own number of days before (60 unless set) until it's renewed (a new expiry date), and once expired.
   One row a document on the "Documentation" tab. ---- */
const DOC_SHEET = "Documentation";
const DOC_COLS = ["Id", "Title", "Holder", "Kind", "Issued by", "Number", "Issued", "Expires", "Remind days", "File id", "File name", "File type", "Notes", "Added by", "Added at", "Changed by", "Changed at"];
const DOC_MAX = 10 * 1024 * 1024, DOC_REMIND = 60, DOC_KINDS = ["company", "person"];
const DOC_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function docFolder_() { return hubSub_("DOC_FOLDER_ID"); }
const docTxt_ = function (v, n) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n); };
/** Every document: { row (on the tab), id, title, holder, kind, issuer, num, issued, exp, remind, fileId, file, type, notes, by, at, chBy, chAt }. */
function docRows_() {
  const tz = Session.getScriptTimeZone(), iso = function (v) { return v instanceof Date ? v.toISOString() : String(v || ""); };
  return pcRows_(DOC_SHEET, DOC_COLS.length).map(function (r, i) {
    const rem = Number(r[8]);
    return { row: i + 2, id: String(r[0] || ""), title: String(r[1] || ""), holder: String(r[2] || ""), kind: DOC_KINDS.indexOf(String(r[3])) === -1 ? "company" : String(r[3]),
      issuer: String(r[4] || ""), num: String(r[5] || ""), issued: pcDay_(r[6], tz) || "", exp: pcDay_(r[7], tz) || "", remind: r[8] === "" || !isFinite(rem) ? DOC_REMIND : Math.max(0, Math.min(365, Math.round(rem))),
      fileId: String(r[9] || ""), file: String(r[10] || ""), type: String(r[11] || ""), notes: String(r[12] || ""), by: String(r[13] || ""), at: iso(r[14]), chBy: String(r[15] || ""), chAt: iso(r[16]) };
  }).filter(function (d) { return d.id; });
}
/** A document as the app gets it (no row, no Drive id: the file is fetched by the document's id). */
function docOut_(d) {
  return { id: d.id, title: d.title, holder: d.holder, kind: d.kind, issuer: d.issuer, num: d.num, issued: d.issued, exp: d.exp, remind: d.remind,
    file: d.fileId ? { name: d.file, type: d.type } : null, notes: d.notes, by: d.by, at: d.at, chBy: d.chBy, chAt: d.chAt };
}
/** Days from today to a day (yyyy-MM-dd), in the script's time zone. */
function docDays_(day, today) { return Math.round((Date.parse(day + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 864e5); }
/** What the app warns about: { expired, soon, today } (soon: within each one's own days before). */
function docSummary_() {
  const today = Utilities.formatDate(tmNow_(), Session.getScriptTimeZone(), "yyyy-MM-dd"), out = { expired: 0, soon: 0, today: today };
  docRows_().forEach(function (d) {
    if (!d.exp) return;
    const n = docDays_(d.exp, today);
    if (n < 0) out.expired++; else if (n <= d.remind) out.soon++;
  });
  return out;
}
function docList_() {
  const today = Utilities.formatDate(tmNow_(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  return { ok: true, today: today, docs: docRows_().map(docOut_) };
}
/** Adds a document, or changes one ({ id }): its details, and with { file: { name, data (base64) } } its file (a PDF or a
 *  photo; a new one replaces the old, which goes in Drive's trash). */
function docSave_(req, user) {
  const x = req.doc && typeof req.doc === "object" ? req.doc : {}, id = String(req.id || "");
  const title = docTxt_(x.title, 120), holder = docTxt_(x.holder, 120), kind = DOC_KINDS.indexOf(String(x.kind)) === -1 ? "company" : String(x.kind);
  const issued = String(x.issued || ""), exp = String(x.exp || ""), rem = x.remind === "" || x.remind == null ? DOC_REMIND : Number(x.remind);
  if (!title) return { ok: false, error: "bad_value", field: "title" };
  if ((issued && !DOC_DAY.test(issued)) || (exp && !DOC_DAY.test(exp))) return { ok: false, error: "bad_value", field: issued && !DOC_DAY.test(issued) ? "issued" : "exp" };
  if (!isFinite(rem) || rem < 0 || rem > 365) return { ok: false, error: "bad_value", field: "remind" };
  if (id && !/^d[a-z0-9]{6,40}$/.test(id)) return { ok: false, error: "bad_request" };
  const rows = docRows_(), was = id ? rows.filter(function (d) { return d.id === id; })[0] : null;
  if (id && !was) return { ok: false, error: "not_found" };
  let file = null;
  if (req.file && typeof req.file === "object") {
    let bytes;
    try { bytes = Utilities.base64Decode(String(req.file.data || "")); } catch (e) { return { ok: false, error: "bad_request" }; }
    if (!bytes || !bytes.length) return { ok: false, error: "bad_request" };
    if (bytes.length > DOC_MAX) return { ok: false, error: "too_big" };
    const type = rcptKind_(bytes);
    if (!type) return { ok: false, error: "not_file" };
    const ext = type === "application/pdf" ? ".pdf" : type === "image/png" ? ".png" : ".jpg";
    const name = (String(req.file.name || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\.[A-Za-z0-9]{2,5}$/, "").replace(/\s+/g, " ").trim().slice(0, 120) || title) + ext;
    const f = docFolder_().createFile(Utilities.newBlob(bytes, type, name));
    file = { id: f.getId(), name: name, type: type };
  }
  if (!id && !file) return { ok: false, error: "no_file" };
  const now = tmNow_().toISOString(), who = docTxt_(user.name || "Admin", 60);
  const d = { id: was ? was.id : "d" + Utilities.getUuid().replace(/-/g, "").slice(0, 12), title: title, holder: holder, kind: kind, issuer: docTxt_(x.issuer, 120), num: docTxt_(x.num, 60),
    issued: issued, exp: exp, remind: Math.round(rem), fileId: file ? file.id : was.fileId, file: file ? file.name : was.file, type: file ? file.type : was.type, notes: docTxt_(x.notes, 500),
    by: was ? was.by : who, at: was ? was.at : now, chBy: was ? who : "", chAt: was ? now : "" };
  const s = pcSheet_(DOC_SHEET, DOC_COLS), at = was ? was.row : Math.max(2, s.getLastRow() + 1);
  s.getRange(at, 1, 1, DOC_COLS.length).setNumberFormat("@").setValues([[d.id, d.title, d.holder, d.kind, d.issuer, d.num, d.issued, d.exp, String(d.remind), d.fileId, d.file, d.type, d.notes, d.by, d.at, d.chBy, d.chAt]]);
  if (file && was && was.fileId) { try { DriveApp.getFileById(was.fileId).setTrashed(true); } catch (e) { /* gone already */ } }
  return { ok: true, doc: docOut_(d) };
}
/** Takes a document off (its file goes in Drive's trash: back from there for 30 days). */
function docDelete_(req) {
  const id = String(req.id || ""), d = docRows_().filter(function (x) { return x.id === id; })[0];
  if (!d) return { ok: false, error: "not_found" };
  SpreadsheetApp.getActive().getSheetByName(DOC_SHEET).deleteRow(d.row);
  if (d.fileId) { try { DriveApp.getFileById(d.fileId).setTrashed(true); } catch (e) { /* gone already */ } }
  return { ok: true, id: id };
}
/** A document's file to look at: { name, mime, data (base64) }. */
function docFile_(req) {
  const id = String(req.id || ""), d = docRows_().filter(function (x) { return x.id === id; })[0];
  if (!d || !d.fileId) return { ok: false, error: "not_found" };
  let f = null;
  try { f = DriveApp.getFileById(d.fileId); if (f.isTrashed()) f = null; } catch (e) { f = null; }
  if (!f) return { ok: false, error: "file_gone" };
  const b = f.getBlob();
  return { ok: true, name: d.file, mime: d.type || b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
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
  const lock = LockService.getScriptLock(), t = Date.now();
  lock.waitLock(20000);
  REQ_LOCK_MS_ += Date.now() - t;
  try { return fn(); } finally { lock.releaseLock(); }
}
/** A save to a tab only its own section writes (Office, Attendance): the Sheet's lock, not the script's, so it doesn't wait
 *  behind a long read from Housecall Pro or the rebuild calendar's run (a day typed took 20 seconds and more). */
function withTabLock_(fn) {
  const lock = LockService.getDocumentLock() || LockService.getScriptLock(), t = Date.now();
  lock.waitLock(20000);
  REQ_LOCK_MS_ += Date.now() - t;
  try { return fn(); } finally { lock.releaseLock(); }
}
/* ---- Speed: each device times its requests (from sending one to its answer being in; the script's own part comes in
   every answer as _ms) and sends them every 10 minutes: one row a request on the Speed tab, two weeks kept. Admins see
   the slowest (Settings › Speed). Only request names, times and sizes: nothing about clients. ---- */
const SPEED_SHEET = "Speed", SPEED_COLS = ["When", "Person", "Device", "Request", "Total ms", "Script ms", "Size KB", "OK", "Housecall Pro ms", "Waiting ms"];
const SPEED_DAYS = 14, SPEED_PUT_MAX = 500;
function speedSheet_(create) {
  return create ? pcSheet_(SPEED_SHEET, SPEED_COLS) : SpreadsheetApp.getActive().getSheetByName(SPEED_SHEET);   // (made, or its newer columns added)
}
/** A device's requests since it last sent them: rows [age ms (how long ago, by its own clock), request, total ms, script
 *  ms (-1: none), bytes, ok, Housecall Pro ms, waiting ms (for another save; -1 or none: not known)]. When: the script's
 *  clock less the age (a phone's clock may be off). */
function speedPut_(req) {
  const rows = Array.isArray(req.rows) ? req.rows.slice(-SPEED_PUT_MAX) : [], now = Date.now(), out = [];
  const dev = /^(phone|tablet|computer)$/.test(String(req.device || "")) ? String(req.device) : "other";
  const num = function (v, max) { const n = Math.round(Number(v)); return isFinite(n) && n >= 0 ? Math.min(n, max) : -1; };
  rows.forEach(function (r) {
    if (!Array.isArray(r)) return;
    const age = num(r[0], SPEED_DAYS * 864e5), a = String(r[1] || "").replace(/[^A-Za-z0-9()_ -]/g, "").slice(0, 40), t = num(r[2], 600000);
    if (age < 0 || !a || t < 0) return;
    const sv = num(r[3], 600000), b = num(r[4], 50 * 1024 * 1024);
    const hp = num(r[6], 600000), lk = num(r[7], 600000);
    out.push([new Date(now - age), String(req.by || "").slice(0, 60), dev, a, t, sv < 0 ? "" : sv, b < 0 ? "" : Math.round(b / 102.4) / 10, r[5] ? 1 : 0, hp < 0 ? "" : hp, lk < 0 ? "" : lk]);
  });
  if (!out.length) return { ok: true, saved: 0 };
  out.sort(function (x, y) { return x[0] - y[0]; });
  const s = speedSheet_(true);
  appendRows_(s, SPEED_COLS.length, out);
  // two weeks kept: the older rows (the oldest are on top) taken off, once in a while
  const cache = CacheService.getScriptCache();
  if (!cache.get("SPEED_TRIM") && s.getLastRow() > 1) {
    cache.put("SPEED_TRIM", "1", 3600);
    const cut = now - SPEED_DAYS * 864e5, when = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
    let old = 0;
    while (old < when.length && speedTime_(when[old][0]) < cut) old++;
    if (old) s.deleteRows(2, old);
  }
  return { ok: true, saved: out.length };
}
function speedTime_(v) { return v instanceof Date ? v.getTime() : Date.parse(String(v || "")) || 0; }
/** p (0-1) of a list of numbers: the value that many of them are under. */
function speedPct_(list, p) {
  if (!list.length) return null;
  const a = list.slice().sort(function (x, y) { return x - y; });
  return a[Math.min(a.length - 1, Math.floor(p * a.length))];
}
/** Admins: the last `days` days (1, 7 or 14), on every device: each request's count, typical (half are faster), slow
 *  (1 in 10 slower) and slowest time, the script's typical part, the typical size, the failed ones; each person and
 *  device; the 15 slowest requests. */
function speedRead_(req) {
  const days = [1, 7, 14].indexOf(Number(req.days)) !== -1 ? Number(req.days) : 7, cut = Date.now() - days * 864e5;
  const s = speedSheet_(false), w = s ? Math.min(SPEED_COLS.length, Math.max(8, s.getLastColumn())) : 0, rows = s && s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, w).getValues() : [];
  const by = {}, who = {}, all = [], slow = [];
  rows.forEach(function (r) {
    const at = speedTime_(r[0]);
    if (at < cut || !r[3]) return;
    const t = Number(r[4]) || 0, sv = r[5] === "" ? null : Number(r[5]), kb = r[6] === "" ? null : Number(r[6]), a = String(r[3]), k = String(r[1]) + "|" + String(r[2]);
    const x = by[a] || (by[a] = { t: [], s: [], kb: [], h: [], l: [], f: 0 });
    x.t.push(t); if (sv !== null) x.s.push(sv); if (kb !== null) x.kb.push(kb); if (!Number(r[7])) x.f++;
    if (r[8] !== "" && r[8] !== undefined) x.h.push(Number(r[8]) || 0);
    if (r[9] !== "" && r[9] !== undefined) x.l.push(Number(r[9]) || 0);
    (who[k] || (who[k] = [])).push(t);
    all.push(t);
    slow.push([at, String(r[1]), String(r[2]), a, t, sv]);
  });
  slow.sort(function (p, q) { return q[4] - p[4]; });
  return { ok: true, days: days,
    total: { n: all.length, p50: speedPct_(all, 0.5), p90: speedPct_(all, 0.9), devices: Object.keys(who).length },
    actions: Object.keys(by).map(function (a) { const x = by[a]; return { a: a, n: x.t.length, p50: speedPct_(x.t, 0.5), p90: speedPct_(x.t, 0.9), max: speedPct_(x.t, 1), s50: speedPct_(x.s, 0.5), kb: speedPct_(x.kb, 0.5), f: x.f,
      h50: speedPct_(x.h, 0.5), l50: speedPct_(x.l, 0.5) }; }),
    people: Object.keys(who).map(function (k) { const p = k.split("|"); return { who: p[0], device: p[1], n: who[k].length, p50: speedPct_(who[k], 0.5), p90: speedPct_(who[k], 0.9) }; }),
    slowest: slow.slice(0, 15).map(function (x) { return { at: new Date(x[0]).toISOString(), who: x[1], device: x[2], a: x[3], t: x[4], s: x[5] }; }) };
}
function json_(obj) {
  if (obj && typeof obj === "object") { obj.api = API_VERSION; if (REQ_T0_) { obj._ms = Date.now() - REQ_T0_; obj._hcp = REQ_HCP_MS_; obj._lock = REQ_LOCK_MS_; } }
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

/* ---------------- GPS stops vs the schedule (Trucks › a truck › Stops, Admins) ----------------
 * Every stop a truck made (One Step GPS keeps them: route/drive-stop), laid next to that day's Housecall Pro jobs and
 * estimates of the person who drives it. Same street as one of his appointments (any house number), or within
 * STOP_NEAR_M of it, counts as that appointment; the shop and the places an Admin marks are never flagged; anything
 * else is flagged to ask about. Past days are kept in the "GPS stops" tab, so One Step is read once for them. */
const GPS_DS_URL = "https://track.onestepgps.com/v3/api/public/route/drive-stop";
const STOP_SHEET = "GPS stops";
const STOP_COLS = ["Truck id", "Day", "GPS device", "Read at", "Stops"];
const STOP_MIN = 5;            // One Step reports stops this many minutes and longer
const STOP_NEAR_M = 150;       // a stop this close to an appointment is that appointment
const STOP_TOWN_M = 3000;      // the same street name farther than this is another street (another town)
const STOP_GEO = 40;           // street lookups per read (the rest show the next time)
const STOP_PLACE_M = 150;
const STOP_SUF = { street: "st", st: "st", avenue: "ave", ave: "ave", av: "ave", road: "rd", rd: "rd", drive: "dr", dr: "dr", boulevard: "blvd", blvd: "blvd",
  lane: "ln", ln: "ln", court: "ct", ct: "ct", place: "pl", pl: "pl", circle: "cir", cir: "cir", parkway: "pkwy", pkwy: "pkwy", highway: "hwy", hwy: "hwy",
  terrace: "ter", ter: "ter", trail: "trl", trl: "trl", square: "sq", sq: "sq", way: "way", pike: "pike", turnpike: "tpke", tpke: "tpke", alley: "aly",
  expressway: "expy", freeway: "fwy", loop: "loop", run: "run", row: "row", crossing: "xing", xing: "xing", point: "pt", pt: "pt", ridge: "rdg", plaza: "plz" };
const STOP_DIR = { north: "n", n: "n", south: "s", s: "s", east: "e", e: "e", west: "w", w: "w", northeast: "ne", ne: "ne", northwest: "nw", nw: "nw",
  southeast: "se", se: "se", southwest: "sw", sw: "sw" };

/** "1200-1210 N. Main Street, Apt 4" → { n: "1200", s: "n main st", c: "main", z } (number, street, the street's own name, zip). */
function stopAddrKey_(street, zip) {
  let t = String(street || "").replace(/,.*$/, "").replace(/\./g, "").replace(/\s+/g, " ").trim();
  const m = /^(\d+[a-z]?)(?:\s*-\s*\d+[a-z]?)?\s+(.+)$/i.exec(t);
  const n = m ? m[1].toLowerCase() : "";
  if (m) t = m[2];
  t = t.replace(/\s*(?:#|\b(?:apt|apartment|unit|ste|suite|bldg|building|fl|floor|rm|room|lot|spc|space|trlr)\b)\s*[\w-]*\s*$/i, "").trim();
  const words = t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean)
    .map(function (w) { return STOP_SUF[w] || STOP_DIR[w] || w; });
  const isSuf = function (w) { return Object.prototype.hasOwnProperty.call(STOP_SUF, w) && STOP_SUF[w] === w; };
  const isDir = function (w) { return Object.prototype.hasOwnProperty.call(STOP_DIR, w) && STOP_DIR[w] === w; };
  let core = words.filter(function (w) { return !isSuf(w) && !isDir(w); });
  if (!core.length) core = words.filter(function (w) { return !isSuf(w); });
  if (!core.length) core = words;
  const z = /(\d{5})(?:-\d{4})?\s*$/.exec(String(zip || "").trim());
  return { n: n, s: words.join(" "), c: core.join(" "), z: z ? z[1] : "" };
}

/** How a stop at address key k (and lat/lng) sits with an appointment: "exact", "street", "near", "zip" or "". */
function stopFit_(k, lat, lng, ap) {
  const d = isFinite(ap.lat) && isFinite(ap.lng) && isFinite(lat) && isFinite(lng) ? gpsDistM_(lat, lng, ap.lat, ap.lng) : NaN;
  if (isFinite(d) && d <= STOP_NEAR_M) return k && k.c && k.c === ap.k.c && k.n && k.n === ap.k.n ? "exact" : "near";
  if (k && k.c && ap.k.c && k.c === ap.k.c && !(k.z && ap.k.z && k.z !== ap.k.z) && !(isFinite(d) && d > STOP_TOWN_M))
    return k.n && k.n === ap.k.n ? "exact" : "street";
  if (k && k.z && k.z === ap.k.z) return "zip";
  return "";
}

/** A latitude or longitude Housecall Pro sends ("38.9", 38.9), or NaN for none ("", null, 0). */
function stopCoord_(v) { const n = v === "" || v === null || v === undefined ? NaN : Number(v); return isFinite(n) && n !== 0 ? n : NaN; }

/** A name picked for the truck matches a Housecall Pro employee: the same name, or one starts the other (a first name alone). */
function stopNameHit_(emp, who) {
  const a = String(emp || "").toLowerCase().replace(/\s+/g, " ").trim(), b = String(who || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!a || !b) return false;
  return a === b || (b.length >= 3 && a.indexOf(b) === 0) || (a.length >= 3 && b.indexOf(a) === 0);
}

/** One Step's stops for a device from..to (Dates): [{ f, t, lat, lng, a }] (ms, ms, coords, its address if it sends one). */
function stopFetch_(device, from, to) {
  const iso = function (d) { return d.toISOString().replace(/\.\d{3}Z$/, "Z"); };
  const url = GPS_DS_URL + "?device_id=" + encodeURIComponent(device) + "&dt_tracker_from=" + encodeURIComponent(iso(from)) +
    "&dt_tracker_to=" + encodeURIComponent(iso(to)) + "&stop_duration=" + STOP_MIN + "m0s";
  const json = gpsFetch_(url).json;
  const list = json && Array.isArray(json.drive_stop_list) ? json.drive_stop_list : gpsList_(json);
  const pos = function (r) {
    const keys = ["lat_lng_best_first", "lat_lng_from", "first_valid_lat_lng", "lat_lng_best_last", "lat_lng_to", "last_valid_lat_lng", "location", "point"];
    for (let i = 0; i < keys.length; i++) {
      const p = r[keys[i]];
      if (p && typeof p === "object") {
        const lat = Number(p.lat !== undefined ? p.lat : p.latitude), lng = Number(p.lng !== undefined ? p.lng : p.lon !== undefined ? p.lon : p.longitude);
        if (isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lat, lng];
      }
    }
    const lat = Number(r.lat !== undefined ? r.lat : r.latitude), lng = Number(r.lng !== undefined ? r.lng : r.longitude);
    return isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0) ? [lat, lng] : null;
  };
  const out = [];
  list.forEach(function (r) {
    if (!r || typeof r !== "object") return;
    const type = String(r.type || r.event_type || "").toLowerCase();
    if (type && type.indexOf("stop") === -1 && type.indexOf("park") === -1) return;   // drives (and idles) aren't stops
    const f = new Date(r.time_from || r.dt_from || r.start_time || r.from || "").getTime(), t = new Date(r.time_to || r.dt_to || r.end_time || r.to || "").getTime();
    if (!isFinite(f) || !isFinite(t)) return;
    const p = pos(r);
    const a = typeof r.address === "string" ? r.address : typeof r.formatted_address === "string" ? r.formatted_address : "";
    out.push({ f: Math.min(f, t), t: Math.max(f, t), lat: p ? p[0] : NaN, lng: p ? p[1] : NaN, a: String(a || "").replace(/, USA$/, "").slice(0, 120) });
  });
  out.sort(function (x, y) { return x.f - y.f; });
  return { stops: out, shape: out.length ? null : { keys: Object.keys(json || {}).slice(0, 20), rows: list.length,
    first: list[0] && typeof list[0] === "object" ? Object.keys(list[0]).slice(0, 30) : [] } };
}

/** The street address at a stop, from Google's lookup (kept 6 hours): { a, n, s, z } or null when out of lookups. */
const stopGeoKey_ = function (lat, lng) { return "stopgeo:" + lat.toFixed(4) + "," + lng.toFixed(4); };
/** Many cached values in one ask ({ key: text }); {} when the cache can't answer. */
function stopCacheAll_(keys) {
  if (!keys.length) return {};
  try { const c = CacheService.getScriptCache(); return (typeof c.getAll === "function" ? c.getAll(keys) : null) || {}; } catch (e) { return {}; }
}
function stopGeo_(lat, lng, budget, hits) {
  if (!isFinite(lat) || !isFinite(lng)) return { a: "", n: "", s: "", z: "" };
  const key = stopGeoKey_(lat, lng), cache = CacheService.getScriptCache();
  const hit = hits ? hits[key] : cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* look it up again */ } }
  if (budget.geo <= 0) return null;
  budget.geo--;
  let out = { a: "", n: "", s: "", z: "" };
  try {
    const r = Maps.newGeocoder().reverseGeocode(lat, lng);
    const list = (r && r.results) || [];
    const best = list.filter(function (x) { return (x.types || []).some(function (t) { return t === "street_address" || t === "premise" || t === "subpremise"; }); })[0] || list[0];
    if (best) {
      const comp = function (type) { const c = (best.address_components || []).filter(function (x) { return (x.types || []).indexOf(type) !== -1; })[0]; return c ? String(c.short_name || c.long_name || "") : ""; };
      out = { a: String(best.formatted_address || "").replace(/, USA$/, "").slice(0, 120), n: comp("street_number"), s: comp("route"), z: comp("postal_code") };
    }
  } catch (e) { return null; }
  try { cache.put(key, JSON.stringify(out), 21600); } catch (e) { /* too big to keep */ }
  return out;
}

/** An appointment's spot from Google's lookup (kept 6 hours), for the ones Housecall Pro sends without one. */
const stopFwdKey_ = function (addr) { return "stopfwd:" + String(addr).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 200); };
function stopGeoFwd_(addr, budget, hits) {
  if (!addr) return null;
  const key = stopFwdKey_(addr), cache = CacheService.getScriptCache();
  const hit = hits ? hits[key] : cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* look it up again */ } }
  if (budget.geo <= 0) return null;
  budget.geo--;
  let out = { lat: NaN, lng: NaN };
  try {
    const r = Maps.newGeocoder().geocode(addr);
    const g = r && r.results && r.results[0] && r.results[0].geometry && r.results[0].geometry.location;
    if (g) out = { lat: Number(g.lat), lng: Number(g.lng) };
  } catch (e) { return null; }
  try { cache.put(key, JSON.stringify(out), 21600); } catch (e) { /* ignore */ }
  return out;
}

/** The Housecall Pro jobs that start on each day from..to, as Stops needs them: { day: [{ id, n, client, addr, who, time,
 *  st, lat, lng, street, zip, last }] }. Each day is kept a while (a past day 6 hours, today 5 minutes), so Housecall Pro
 *  is read only for the days not kept (all of them with force). */
function stopJobsByStart_(from, to, tz, note, force) {
  const today = Utilities.formatDate(tmNow_(), tz, "yyyy-MM-dd"), out = {}, all = [];
  for (let d = from; d <= to; d = tmAddDays_(d, 1)) all.push(d);
  const got = force ? {} : stopCacheAll_(all.map(function (d) { return "stopjobs:" + d; }));
  const miss = all.filter(function (d) {
    const v = got["stopjobs:" + d];
    if (v) { try { out[d] = JSON.parse(v); return false; } catch (e) { /* read it again */ } }
    return true;
  });
  if (!miss.length) return out;
  miss.forEach(function (d) { out[d] = []; });
  const r = hcpJobsIn_(miss[0], miss[miss.length - 1]);
  if (r.error) { note.push("Housecall Pro jobs couldn't be read right now (" + r.error + ")."); return out; }
  (r.jobs || []).forEach(function (j) {
    const sc = j.schedule || {}, s = new Date(sc.scheduled_start || ""), e = new Date(sc.scheduled_end || sc.scheduled_start || "");
    if (!isFinite(s.getTime())) return;
    const first = Utilities.formatDate(s, tz, "yyyy-MM-dd");
    if (miss.indexOf(first) === -1) return;   // a day kept already has it
    const a = j.address || {};
    let last = isFinite(e.getTime()) ? Utilities.formatDate(e, tz, "yyyy-MM-dd") : first;
    if (last < first || last > tmAddDays_(first, 13)) last = first;
    const who = (Array.isArray(j.assigned_employees) ? j.assigned_employees : [])
      .map(function (x) { return [x && x.first_name, x && x.last_name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(); }).filter(Boolean);
    const lat = stopCoord_(a.latitude), lng = stopCoord_(a.longitude);
    out[first].push({ id: String(j.id || ""), n: String(j.invoice_number || ""), client: hcpClient_(j), addr: estAddress_(a), who: who,
      time: Utilities.formatDate(s, tz, "HH:mm"), st: String(j.work_status || "").replace(/_/g, " ").slice(0, 30),
      lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null, street: String(a.street || ""), zip: String(a.zip || ""), last: last });
  });
  if (r.more) return out;   // more than Housecall Pro sends at once: not kept
  try {
    const c = CacheService.getScriptCache(), past = {}, now = {};
    miss.forEach(function (d) { const v = JSON.stringify(out[d]); if (v.length < 90000) (d < today ? past : now)["stopjobs:" + d] = v; });
    if (typeof c.putAll === "function") { if (Object.keys(past).length) c.putAll(past, 21600); if (Object.keys(now).length) c.putAll(now, 300); }
  } catch (e) { /* not kept: read again next time */ }
  return out;
}

/** The days from..to (yyyy-MM-dd) of jobs and estimates: { day: [{ kind, id, n, client, addr, who, time, st, lat, lng, k }] }. */
function stopAppts_(from, to, tz, rows, force) {
  const days = {}, note = [];
  const put = function (day, ap) { (days[day] = days[day] || []).push(ap); };
  if (hcpKey_()) {
    const byStart = stopJobsByStart_(tmAddDays_(from, -7), to, tz, note, force);   // a job that started up to a week before still counts on its later days
    Object.keys(byStart).sort().forEach(function (first) {
      byStart[first].forEach(function (c) {
        const ap = { kind: "job", id: c.id, n: c.n, client: c.client, addr: c.addr, who: c.who, time: c.time, st: c.st,
          lat: c.lat === null ? NaN : Number(c.lat), lng: c.lng === null ? NaN : Number(c.lng), k: stopAddrKey_(c.street, c.zip) };
        for (let d = first < from ? from : first; d <= c.last && d <= to; d = tmAddDays_(d, 1)) put(d, ap);
      });
    });
  } else note.push("Housecall Pro isn't connected, so only the estimates in the Estimates tab are compared.");
  Object.keys(rows).forEach(function (id) {
    const r = rows[id];
    const at = new Date(r[28] || "");
    if (!isFinite(at.getTime())) return;   // not scheduled: no visit to make
    const day = Utilities.formatDate(at, tz, "yyyy-MM-dd");
    if (day < from || day > to) return;
    const who = String(r[16] || "").split(/\s*,\s*/).concat([String(r[21] || "")]).map(function (x) { return x.trim(); })
      .filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    put(day, { kind: "est", id: id, n: String(r[1] || ""), client: String(r[4] || ""), addr: String(r[29] || r[5] || ""), who: who,
      time: Utilities.formatDate(at, tz, "HH:mm"), st: String(r[9] || "").slice(0, 30), lat: NaN, lng: NaN,
      k: stopAddrKey_(String(r[5] || ""), String(r[29] || "")) });
  });
  return { days: days, note: note };
}

function stopSheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(STOP_SHEET);
  if (!s && create) {
    s = ss.insertSheet(STOP_SHEET);
    s.getRange(1, 1, 1, STOP_COLS.length).setValues([STOP_COLS]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange("B:B").setNumberFormat("@");
  }
  return s;
}

/** The truck's people and places, as the app shows them. */
function stopPrefs_() {
  const p = PropertiesService.getScriptProperties();
  const parse = function (k, d) { try { const v = JSON.parse(p.getProperty(k) || ""); return v && typeof v === "object" ? v : d; } catch (e) { return d; } };
  return { person: parse("GPS_PERSON", {}), places: parse("GPS_PLACES", []).filter(function (x) { return x && isFinite(x.lat) && isFinite(x.lng); }) };
}

/** "Ft Belvoir" = "Fort Belvoir": a city to compare. */
function stopCity_(c) {
  return String(c || "").toLowerCase().replace(/^\s*ft\.?\s+/, "fort ").replace(/^\s*mt\.?\s+/, "mount ").replace(/^\s*st\.?\s+/, "saint ").replace(/[^a-z]/g, "");
}
/** A street address as house number | street name | city ("123 Main St, Apt 4, Fairfax" or Google's
 *  "123 Main St, Fairfax, VA 22030"), or "" without a house number. */
function stopExactKey_(addr) {
  const parts = String(addr || "").replace(/, USA$/, "").split(/\s*,\s*/).filter(Boolean);
  if (!parts.length) return "";
  const k = stopAddrKey_(parts[0], "");
  if (!k.n || !k.c) return "";
  const st = parts.findIndex(function (x, i) { return i > 0 && /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(x); });
  const city = st > 1 ? parts[st - 1] : st === -1 && parts.length > 1 ? parts[parts.length - 1] : "";
  return k.n + "|" + k.c + "|" + stopCity_(city);
}
/** The stops still flagged (or only the zip of his job) at the address of any VODA job (the Past client jobs tab, every
 *  year) or estimate (the Estimates tab), any day: "past", with the one closest to that day and how many there are. */
function stopPast_(days, note, estAll) {
  const want = {};
  days.forEach(function (d) { d.stops.forEach(function (s) {
    if (s.kind !== "flag" && s.kind !== "zip") return;
    const key = stopExactKey_(s.a);
    if (key) (want[key] = want[key] || []).push({ s: s, day: d.day });
  }); });
  if (!Object.keys(want).length) return;
  const ss = SpreadsheetApp.getActive(), found = {};
  const add = function (key, x) { if (want[key]) (found[key] = found[key] || []).push(x); };
  // a few rows of a tab: one by one when there are a few, else the whole block once
  const rowsAt = function (sh, at, width) {
    if (at.length <= 25) return at.map(function (i) { return sh.getRange(i + 2, 1, 1, width).getValues()[0]; });
    const all = sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues();
    return at.map(function (i) { return all[i]; });
  };
  const pj = ss.getSheetByName(PC_JOBS);
  if (!pj || pj.getLastRow() < 2) note.push("Stops aren't checked against past VODA job addresses yet: Office › Past clients hasn't read Housecall Pro.");
  else {
    const tz = Session.getScriptTimeZone(), cust = {}, at = [];
    pj.getRange(2, 8, pj.getLastRow() - 1, 1).getValues().forEach(function (r, i) { const key = stopExactKey_(r[0]); if (key && want[key]) at.push(i); });   // the addresses only
    rowsAt(pj, at, 8).forEach(function (r) {
      add(stopExactKey_(r[7]), { kind: "job", n: String(r[2] || ""), cid: String(r[1] || ""), day: repDay_(r[4], tz), st: String(r[3] || ""), addr: String(r[7] || "") });
      cust[String(r[1])] = "";
    });
    const pc = ss.getSheetByName(PC_CUST);
    if (Object.keys(cust).length && pc && pc.getLastRow() > 1) {
      const cat = [];
      pc.getRange(2, 1, pc.getLastRow() - 1, 1).getValues().forEach(function (r, i) { if (String(r[0]) in cust) cat.push(i); });
      rowsAt(pc, cat, 6).forEach(function (r) { cust[String(r[0])] = pcName_(r).name; });
    }
    Object.keys(found).forEach(function (k) { found[k].forEach(function (x) { x.client = cust[x.cid] || ""; delete x.cid; }); });
  }
  const rows = estAll;
  Object.keys(rows).forEach(function (id) {
    const r = rows[id], key = stopExactKey_(r[5]);
    if (key && want[key]) add(key, { kind: "est", n: String(r[1] || ""), client: String(r[4] || ""), day: String(r[2] || ""), st: String(r[9] || ""), addr: String(r[5] || "") });
  });
  const gap = function (a, b) { return a && b ? Math.abs(new Date(a + "T12:00:00Z") - new Date(b + "T12:00:00Z")) / 864e5 : 1e9; };
  Object.keys(found).forEach(function (key) {
    const list = found[key];
    want[key].forEach(function (w) {
      const top = list.slice().sort(function (x, y) { return gap(x.day, w.day) - gap(y.day, w.day) || (y.day > x.day ? 1 : -1); })[0];
      w.s.kind = "past";
      w.s.appt = { kind: top.kind, n: top.n, client: top.client, addr: top.addr, day: top.day, st: top.st.replace(/_/g, " ").slice(0, 30),
        jobs: list.filter(function (x) { return x.kind === "job"; }).length, ests: list.filter(function (x) { return x.kind === "est"; }).length };
    });
  });
}

/** Admin: a truck's stops on day..to (≤ 14 days), each laid next to the schedule of the person driving it.
 *  { truck, from, to, person, people, days: [{ day, stops: [...], missed: [...] }], places, note, left }. */
function gpsStops_(req) {
  const tz = Session.getScriptTimeZone();
  const isDay = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")); };
  const from = String(req.from || ""), to = String(req.to || req.from || "");
  if (!isDay(from) || !isDay(to) || to < from || tmAddDays_(from, 13) < to) return { ok: false, error: "bad_request" };
  const found = readTrucks_().filter(function (x) { return String(x.truck.id) === String(req.truck || ""); })[0];
  if (!found) return { ok: false, error: "not_found" };
  const t = found.truck;
  const gs = SpreadsheetApp.getActive().getSheetByName("GPS");
  let device = "";
  if (gs && gs.getLastRow() > 1) {
    const rows = gs.getRange(2, 1, gs.getLastRow() - 1, 4).getValues().filter(function (r) { return t.unit && String(r[2]) === String(t.unit) && String(r[1] || "").trim(); });
    rows.sort(function (a, b) { return (b[3] === true ? 1 : 0) - (a[3] === true ? 1 : 0); });
    device = rows[0] ? String(rows[0][1]).trim() : "";
  }
  if (!device) return { ok: false, error: "no_gps" };
  const prefs = stopPrefs_();
  const person = String(prefs.person[t.id] !== undefined ? prefs.person[t.id] : t.driver || "").trim();
  const today = Utilities.formatDate(tmNow_(), tz, "yyyy-MM-dd");
  const end = to > today ? today : to;
  const budget = { geo: STOP_GEO };
  const note = [];

  // 1. the stops, a day at a time: past days from the GPS stops tab, the rest from One Step in one read
  const sheet = stopSheet_(true), kept = {}, keptRow = {};
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, STOP_COLS.length).getValues().forEach(function (r, i) {
    const day = repDay_(r[1], tz);
    if (String(r[0]) !== String(t.id) || day < from || day > end || String(r[2]) !== device) return;
    keptRow[day] = i + 2;
    if (req.force === true) return;
    try { kept[day] = JSON.parse(String(r[4] || "[]")); } catch (e) { /* read it again */ }
  });
  const want = [];
  for (let d = from; d <= end; d = tmAddDays_(d, 1)) if (!kept[d]) want.push(d);
  const byDay = {};
  let shape = null;
  if (want.length) {
    // a minute more on each side: a stop One Step cuts at the edge still shows it went past midnight
    const a = new Date(new Date(hcpDayStart_(want[0])).getTime() - 60000), b = new Date(new Date(hcpDayStart_(tmAddDays_(want[want.length - 1], 1))).getTime() + 60000);
    let got;
    try { got = stopFetch_(device, a, b > tmNow_() ? tmNow_() : b); }
    catch (e) { return { ok: false, error: "gps", message: String(e && e.message || e).slice(0, 300) }; }
    shape = got.shape;
    want.forEach(function (d) { byDay[d] = []; });
    got.stops.forEach(function (s) {   // a stop over midnight is cut into each day's part
      for (let d = Utilities.formatDate(new Date(s.f), tz, "yyyy-MM-dd"); d <= want[want.length - 1]; d = tmAddDays_(d, 1)) {
        const ds = new Date(hcpDayStart_(d)).getTime(), de = new Date(hcpDayStart_(tmAddDays_(d, 1))).getTime();
        if (ds >= s.t) break;
        const f = Math.max(s.f, ds), u = Math.min(s.t, de);
        if (byDay[d] && u - f >= STOP_MIN * 60000) byDay[d].push({ f: f, t: u, lat: s.lat, lng: s.lng, a: s.a, cut: (s.f < ds ? "a" : "") + (s.t > de ? "b" : "") });
      }
    });
  }
  // 2. the street at each stop (Google's lookup for the ones One Step sends without it)
  let left = 0;
  const stopsOf = {};
  const geoHits = stopCacheAll_(Object.keys(byDay).reduce(function (a, d) {
    byDay[d].forEach(function (x) { if (!x.a && isFinite(x.lat) && isFinite(x.lng)) a.push(stopGeoKey_(x.lat, x.lng)); });
    return a;
  }, []).filter(function (k, i, a) { return a.indexOf(k) === i; }));
  for (let d = from; d <= end; d = tmAddDays_(d, 1)) {
    if (kept[d]) { stopsOf[d] = kept[d].map(function (x) { return { f: x[0], t: x[1], lat: x[2], lng: x[3], a: x[4], n: x[5], s: x[6], z: x[7], cut: x[8] || "" }; }); continue; }
    let all = true;
    stopsOf[d] = (byDay[d] || []).map(function (x) {
      const geo = stopGeo_(x.lat, x.lng, budget, geoHits);
      if (!geo) { all = false; left++; }
      const k = geo || {};
      const parsed = x.a ? stopAddrKey_(x.a, x.a) : null;
      return { f: x.f, t: x.t, lat: x.lat, lng: x.lng, a: x.a || k.a || "", n: k.n || (parsed ? parsed.n : ""), s: k.s || (x.a ? String(x.a).replace(/,.*$/, "").replace(/^\d+[a-z]?(?:-\d+[a-z]?)?\s+/i, "") : ""),
        z: k.z || (parsed ? parsed.z : ""), cut: x.cut, wait: !geo };
    });
    const doneAt = new Date(hcpDayStart_(tmAddDays_(d, 1))).getTime() + 2 * 3600000;   // One Step can report a little late
    if (all && tmNow_().getTime() > doneAt) {
      const json = JSON.stringify(stopsOf[d].map(function (x) { return [x.f, x.t, isFinite(x.lat) ? x.lat : null, isFinite(x.lng) ? x.lng : null, x.a, x.n, x.s, x.z, x.cut]; }));
      const row = [String(t.id), d, device, new Date().toISOString(), json.slice(0, 49000)];
      if (keptRow[d]) sheet.getRange(keptRow[d], 1, 1, STOP_COLS.length).setValues([row]);
      else { keptRow[d] = sheet.getLastRow() + 1; sheet.getRange(keptRow[d], 1, 1, STOP_COLS.length).setValues([row]); }
    }
  }
  // 3. the schedule, and how each stop sits with it
  const estAll = estRows_(estSheet_(false));
  const ap = stopAppts_(from, end, tz, estAll, req.force === true);
  ap.note.forEach(function (n) { note.push(n); });
  const shop = shopAt_(), people = {};
  const days = [];
  for (let d = from; d <= end; d = tmAddDays_(d, 1)) {
    const list = ap.days[d] || [];
    list.forEach(function (x) { x.who.forEach(function (w) { people[w] = true; }); });
    const mine = list.filter(function (x) { return person && x.who.some(function (w) { return stopNameHit_(w, person); }); });
    const fwdHits = stopCacheAll_(mine.filter(function (x) { return !isFinite(x.lat) && x.addr; }).map(function (x) { return stopFwdKey_(x.addr); }));
    mine.forEach(function (x) {
      if (!isFinite(x.lat) && x.addr) { const p = stopGeoFwd_(x.addr, budget, fwdHits); if (p) { x.lat = p.lat; x.lng = p.lng; } }
    });
    const seen = {};
    const stops = (stopsOf[d] || []).map(function (s) {
      const k = s.s || s.n || s.z ? stopAddrKey_((s.n ? s.n + " " : "") + s.s, s.z) : null;
      const out = { f: s.f, t: s.t, min: Math.round((s.t - s.f) / 60000), lat: isFinite(s.lat) ? s.lat : null, lng: isFinite(s.lng) ? s.lng : null,
        a: s.a || "", cut: s.cut || "", kind: "flag" };
      if (s.wait) out.wait = true;
      if (shop && isFinite(s.lat) && gpsDistM_(s.lat, s.lng, shop.lat, shop.lng) <= shop.radius) { out.kind = "shop"; return out; }
      const place = prefs.places.filter(function (p) { return isFinite(s.lat) && gpsDistM_(s.lat, s.lng, p.lat, p.lng) <= (Number(p.r) || STOP_PLACE_M); })[0];
      if (place) { out.kind = "place"; out.place = String(place.n || "Known place"); return out; }
      const rank = { exact: 4, street: 3, near: 2, zip: 1, "": 0 };
      const best = function (arr) {
        let top = null, how = "";
        const far = function (x) { return isFinite(x.lat) && isFinite(s.lat) ? gpsDistM_(s.lat, s.lng, x.lat, x.lng) : 1e9; };
        arr.forEach(function (x) {   // the best fit; the nearest of equal ones
          const f = stopFit_(k, s.lat, s.lng, x);
          if (rank[f] > rank[how] || (f && rank[f] === rank[how] && far(x) < far(top))) { top = x; how = f; }
        });
        return top ? { x: top, how: how } : null;
      };
      const appt = function (x) { return { kind: x.kind, n: x.n, client: x.client, addr: x.addr, who: x.who.join(", "), time: x.time, st: x.st }; };
      const m = best(mine);
      if (m && m.how !== "zip") { out.kind = "his"; out.how = m.how; out.appt = appt(m.x); seen[m.x.kind + m.x.id] = true; return out; }
      const o = best(list.filter(function (x) { return mine.indexOf(x) === -1; }));
      if (o && o.how !== "zip") { out.kind = "other"; out.how = o.how; out.appt = appt(o.x); return out; }
      if (m) { out.kind = "zip"; out.appt = appt(m.x); return out; }
      return out;
    });
    const missed = mine.filter(function (x) { return !seen[x.kind + x.id]; })
      .map(function (x) { return { kind: x.kind, n: x.n, client: x.client, addr: x.addr, time: x.time, st: x.st }; });
    days.push({ day: d, stops: stops, appts: mine.length, missed: missed });
  }
  stopPast_(days, note, estAll);
  if (to > today) note.push("Days after today have no stops yet.");
  const out = { ok: true, truck: String(t.id), unit: String(t.unit || ""), from: from, to: to, today: today, person: person, driver: String(t.driver || ""),
    people: Object.keys(people).sort(), places: prefs.places.map(function (p) { return { n: String(p.n || ""), a: String(p.a || ""), lat: p.lat, lng: p.lng }; }),
    days: days, note: note, left: left, shop: !!shop };
  if (shape && want.length) out.shape = shape;
  return out;
}

/** Admin: whose schedule a truck is compared with ({ truck, person }; "" goes back to the truck's driver), and the
 *  places never flagged ({ places: [{ n, a, lat?, lng? }] }, an address without a spot is looked up). */
function gpsStopsSet_(req) {
  const p = PropertiesService.getScriptProperties();
  const prefs = stopPrefs_();
  if (req.truck !== undefined) {
    const id = String(req.truck || "");
    if (!id || !readTrucks_().some(function (x) { return String(x.truck.id) === id; })) return { ok: false, error: "not_found" };
    const who = String(req.person || "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (req.person === null || req.person === undefined) delete prefs.person[id]; else prefs.person[id] = who;
    p.setProperty("GPS_PERSON", JSON.stringify(prefs.person));
  }
  if (Array.isArray(req.places)) {
    const budget = { geo: 10 }, out = [];
    for (let i = 0; i < req.places.length && out.length < 60; i++) {
      const x = req.places[i] || {};
      const n = String(x.n || "").replace(/\s+/g, " ").trim().slice(0, 40), a = String(x.a || "").replace(/\s+/g, " ").trim().slice(0, 120);
      const coord = function (v) { return v === null || v === undefined || v === "" ? NaN : Number(v); };
      let lat = coord(x.lat), lng = coord(x.lng);
      if ((!isFinite(lat) || !isFinite(lng)) && a) {
        const g = stopGeoFwd_(a, budget);
        if (!g || !isFinite(g.lat)) return { ok: false, error: "no_place", message: a };
        lat = g.lat; lng = g.lng;
      }
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: "bad_request" };
      out.push({ n: n || "Known place", a: a, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 });
    }
    const json = JSON.stringify(out);
    if (json.length > 8800) return { ok: false, error: "too_big" };
    p.setProperty("GPS_PLACES", json);
  }
  const now = stopPrefs_();
  return { ok: true, person: now.person, places: now.places };
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
  "reportedAt", "reportedBy", "orderedAt", "orderedBy", "closedAt", "closedBy", "updatedAt", "checkId", "list", "paid"];   // paid: what the order cost in all ($), typed by an admin
const CHK_SHEET = "Supply checks";
const CHK_COLS = ["id", "at", "by", "missing", "items", "note", "list"];
const REQ_STATUS = ["To order", "Ordered", "Received", "Removed"];
const SUP_SCHEMA = "4";      // bumped when the tabs above gain columns; older tabs are brought up to date once
const SUP_MAX_QTY = 999;
const SUP_KEEP_DAYS = 45;    // received or removed items stay in the app this long (they stay in the sheet for good)
const SUP_CHECKS_PER_LIST = 12;
// Something not on the checklist: one typed line per list sent ("other"), on the order list like any item.
const SUP_OTHER = "other", SUP_OTHER_SECTION = "Not on the list", SUP_OTHER_MAX = 120;
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
  const r = make(REQ_SHEET, REQ_COLS, ["qty", "paid"]);
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
  supTouch_();
  return v;
}
/* The checklists come with every refresh of the app (the trucks list): built from four tabs each time, they're kept 5
   minutes for each person, until any checklist is changed or reported in the app (supTouch_: kept ones aren't used
   again). The Warehouse's own read is always fresh; a change typed in the Sheet by hand shows within 5 minutes. */
function supTouch_() {
  try { CacheService.getScriptCache().put("sup_stamp", String(Date.now()) + Math.random().toString(36).slice(2, 6), 21600); } catch (e) { /* the 5 minutes then */ }
}
function supCached_(user) {
  let cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  const stamp = cache ? cache.get("sup_stamp") || "0" : "0", who = JSON.stringify([user.id, user.role, user.access || ""]);
  if (cache) { try { const c = JSON.parse(cache.get("sup_" + user.id) || "null"); if (c && c.stamp === stamp && c.who === who) return c.v; } catch (e) { /* built again */ } }
  const v = suppliesForApp_(false, user);
  if (cache) { try { cache.put("sup_" + user.id, JSON.stringify({ stamp: stamp, who: who, v: v }), 300); } catch (e) { /* too big to keep: built each time */ } }
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
  REQ_COLS.forEach(function (c, i) { o[c] = c === "qty" || c === "paid" ? num_(r[i]) : supIso_(r[i]); });
  if (REQ_STATUS.indexOf(o.status) === -1) o.status = "To order";
  o.list = supListOf_(o.list);
  return o;
}
function supReqRow_(o) {
  return REQ_COLS.map(function (c) {
    if (c === "qty" || c === "paid") { const n = num_(o[c]); return n === null ? "" : n; }
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
    if (!r.orderedAt || r.status === "Removed" || r.productId === SUP_OTHER) return;
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
 *  yet), plus one typed thing that isn't on the checklist (other: { text, qty }), or an empty list for "nothing
 *  missing". checkId comes from the phone, so a list sent twice counts once. */
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
  // something not on the checklist, typed in: always a line of its own (nobody's count is replaced)
  const o = req.other && typeof req.other === "object" ? req.other : null;
  if (o) {
    const text = String(o.text || "").replace(/\s+/g, " ").trim().slice(0, SUP_OTHER_MAX), qty = Math.round(Number(o.qty));
    if (!text || !(qty >= 1 && qty <= SUP_MAX_QTY)) skipped++;
    else {
      const row = supReqRow_({ id: supNewId_("r"), productId: SUP_OTHER, product: text, container: "", section: SUP_OTHER_SECTION, qty: qty,
        status: "To order", reportedAt: now, reportedBy: by, orderedAt: "", orderedBy: "", closedAt: "", closedBy: "", updatedAt: now, checkId: checkId, list: list.id });
      add.push(row); fresh.push(supReqFromRow_(row));
      lines.push({ name: text + " (not on the list)", container: "", qty: qty });
    }
  }
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
  // paid: what the order cost in all ($, up to two decimals); "" takes it away; left out: as it is
  const setPaid = req.paid !== undefined, paid = !setPaid || req.paid === "" || req.paid === null ? null : Math.round(Number(req.paid) * 100) / 100;
  if (setPaid && req.paid !== "" && req.paid !== null && !(isFinite(paid) && paid >= 0 && paid <= 1000000)) return { ok: false, error: "bad_request" };
  if (!ids.length || (status === null && qty === null && !setPaid)) return { ok: false, error: "bad_request" };
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
    if (setPaid) r.paid = paid;
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
const PRICE_CHECK = "pricecheck";   // an admin who marks Housecall Pro price changes checked (switched per admin, like Payroll)
const PAYROLL = "payroll";   // an admin who sees Leaderboard > Payroll (switched per admin, see setPayroll_)
// Settings (Users and invites: who signs in, roles, what each sees, invites, passcode resets, turning accounts off, and
// the VODA Payroll and price-change switches): its owner (Script Property SETTINGS_OWNER, a user id) and whoever he
// lets change them (SETTINGS in their access). Until someone owns them, every admin can, as before; the first admin to
// take them owns them (delete the property in Apps Script to start over).
const SETTINGS = "settings", SETTINGS_ACTIONS = ["invite", "saveUser", "resetUser", "setPayroll", "setPriceCheck"];   // the list itself: admins and them
function settingsOwner_() { return String(PropertiesService.getScriptProperties().getProperty("SETTINGS_OWNER") || ""); }
function canChangeSettings_(user) {
  if (!user) return false;
  const owner = settingsOwner_();
  if (!owner) return user.role === "admin";
  return user.id === owner || parseAccess_(user.access).indexOf(SETTINGS) !== -1;
}
/** { claim: true }: an admin takes Settings while nobody owns them. { id, on }: the owner lets someone change them (or
 *  not). Never the owner himself. */
function settingsOwnerPut_(req) {
  const P = PropertiesService.getScriptProperties(), owner = settingsOwner_();
  if (req.claim) {
    if (owner) return { ok: false, error: "taken" };
    if (req.user.role !== "admin") return { ok: false, error: "not_allowed" };
    P.setProperty("SETTINGS_OWNER", req.user.id);
    return { ok: true, owner: req.user.id };
  }
  if (!owner || req.user.id !== owner) return { ok: false, error: "not_allowed" };
  const s = usersSheet_(), x = readUsers_(s).filter(function (y) { return y.u.id === String(req.id || ""); })[0];
  if (!x) return { ok: false, error: "gone" };
  if (x.u.id === owner) return { ok: false, error: "self" };
  const access = parseAccess_(x.u.access).filter(function (a) { return a !== SETTINGS; });
  if (req.on) access.push(SETTINGS);
  if (accessText_(access) !== accessText_(parseAccess_(x.u.access))) { x.u.access = accessText_(access); writeUser_(s, x.rowIndex, x.u); }   // his phone picks it up at the next refresh
  return { ok: true, owner: owner, user: publicUser_(x.u) };
}
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
  return raw.map(String).filter(function (x, i, a) { return (x === "trucks" || x === "office" || x === OF_EDIT || x === "attendance" || x === "revenue" || x === "repairs" || x === "marketing" || x === "contractors" || x === KPI || EST_ACCESS.indexOf(x) !== -1 || LB_ACCESS.indexOf(x) !== -1 || lists.indexOf(x) !== -1) && a.indexOf(x) === i; });
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
const LB_ROLES = ["assistant", "clean1", "clean2", "clean3", "rest1", "rest2", "rest3", "estimator", "supervisor"];
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
  // left out of 5-star reviews / Production (Employees › Counts in): from a month on, or always
  ["noRv", "noProd"].forEach(function (k) { if (raw && raw[k] === true) { p[k] = true; if (lbYm_(raw[k + "From"])) p[k + "From"] = lbYm_(raw[k + "From"]); } });
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
    if (t.noSale === true) {   // not on the technician sales goal (an estimator): from a month on (noSaleFrom), or always
      team.noSale = true;
      if (lbYm_(t.noSaleFrom)) team.noSaleFrom = lbYm_(t.noSaleFrom);
    }
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
  const t = Date.now();
  try {
    res = UrlFetchApp.fetch(hcpUrl_(path, query), { method: "get", muteHttpExceptions: true,
      headers: { Authorization: "Token " + key, Accept: "application/json" } });
  } catch (e) {
    return { error: hcpThrown_(e) };
  } finally { REQ_HCP_MS_ += Date.now() - t; }
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
    const t = Date.now();
    try {
      res = UrlFetchApp.fetchAll(part.map(function (x) {
        return { url: hcpUrl_(x.path, x.query), method: "get", muteHttpExceptions: true, headers: { Authorization: "Token " + key, Accept: "application/json" } };
      }));
    } catch (e) {
      REQ_HCP_MS_ += Date.now() - t;
      const err = hcpThrown_(e);
      part.forEach(function () { out.push({ error: err }); });
      continue;
    }
    REQ_HCP_MS_ += Date.now() - t;
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
  const got = hcpPages_("/jobs", { scheduled_start_min: hcpDayStart_(from), scheduled_start_max: hcpDayStart_(end), page_size: HCP_PAGE },
    function (d) { return Array.isArray(d && d.jobs) ? d.jobs : []; }, HCP_MAX_PAGES);
  return got.error ? got : { jobs: got.items, pages: got.pages, more: got.more };
}
/** Every page of a Housecall Pro list, up to max: the first page (it says how many there are), then the rest HCP_PAR at a
 *  time (they were read one after another: a 20-page list waited 20 times). { items, pages, more (there were more than
 *  max) } or { error, status }. A list that doesn't say how many pages: its first page only (as before). */
function hcpPages_(path, query, listOf, max) {
  const at = function (page) { return Object.assign({}, query, { page: page }); };
  const first = hcpGet_(path, at(1));
  if (first.error) return { error: first.error, status: first.status || 0 };
  const items = listOf(first.data).slice(), total = Number(first.data && first.data.total_pages) || 0;
  if (!items.length || total <= 1) return { items: items, pages: 1, more: false };
  const last = Math.min(total, max), want = [];
  for (let p = 2; p <= last; p++) want.push({ path: path, query: at(p) });
  const rest = hcpGetAll_(want);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].error) return { error: rest[i].error, status: rest[i].status || 0 };
    Array.prototype.push.apply(items, listOf(rest[i].data));
  }
  return { items: items, pages: last, more: total > max };
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
const REV_COLS = ["Day", "Restoration $", "Restoration jobs", "Cleaning $", "Cleaning jobs", "Repairs $", "Repairs jobs", "Other $", "Other jobs", "Visits", "Read from Housecall Pro", "Other job types", "Sources", "Unpaid", "Jobs", "Clients"];
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
/** The Revenue tab's days with only their Jobs column (in its place, [14]): what Money in and Invoices not sent need,
 *  without reading every day's Sources, Unpaid and Clients too. */
function revJobCol_() {
  const s = revSheet_(false), out = {};
  if (!s || s.getLastRow() < 2) return out;
  const n = s.getLastRow() - 1, days = s.getRange(2, 1, n, 1).getValues(), jobs = s.getRange(2, REV_COLS.indexOf("Jobs") + 1, n, 1).getValues();
  days.forEach(function (r, i) { const d = revDayKey_(r[0]); if (!d) return; const row = []; row[14] = String(jobs[i][0] || ""); out[d] = row; });
  return out;
}
/** A day on the Revenue tab ("2026-11-02", or a date the sheet made of it), or "". */
function revDayKey_(v) {
  const day = v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(v || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}
function revRows_(s) {
  const out = {};
  if (!s || s.getLastRow() < 2) return out;
  s.getRange(2, 1, s.getLastRow() - 1, REV_COLS.length).getValues().forEach(function (r) {
    const day = revDayKey_(r[0]);
    if (!day) return;
    const at = r[10] instanceof Date ? r[10].toISOString() : String(r[10] || "");
    out[day] = [day].concat(r.slice(1, 10).map(function (v) { return Number(v) || 0; }), [at, String(r[11] || ""), String(r[12] || ""), String(r[13] || ""), String(r[14] || ""), String(r[15] || "")]);
  });
  return out;
}
/** A day as the app gets it: [r$, r jobs, c$, c jobs, p$, p jobs, o$, o jobs, visits, read at (ms), other types, sources,
 *  unpaid (each null when read before it was kept)]. */
function revOut_(row) {
  const parse = function (t) { if (!t) return null; try { return JSON.parse(t); } catch (e) { return null; } };
  const src = parse(row[12]), unpaid = parse(row[13]), jobs = parse(row[14]), cl = parse(row[15]);
  return row.slice(1, 10).concat([Date.parse(row[10]) || 0, row[11], src && typeof src === "object" && !Array.isArray(src) ? src : null, Array.isArray(unpaid) ? unpaid : null,
    Array.isArray(jobs) ? jobs : null, cl && typeof cl === "object" && !Array.isArray(cl) ? cl : null]);
}
// Invoices not sent (Operations): finished jobs whose invoice still owes and was never sent to the client, as Housecall
// Pro's Invoices › Unsent has them. Read when the app asks (kept 5 minutes, so phones opening Operations together read
// once): the invoices with something still due since January 1 of last year (/invoices), the ones with no "sent", each
// matched to its job for the department, client and day (the Revenue tab's jobs, else read from Housecall Pro); only
// finished jobs count. When /invoices can't be read, the Revenue tab's finished jobs that still owe have their invoices
// read one by one instead (/jobs/{id}/invoices).
/* ---- Money in: every payment on the day it came in, whatever the job's day (a balance from March paid on November 21
   counts on November 21). Each job's invoices are read from Housecall Pro (their payments: amount and day; deposits
   too) and kept on the "Payments" tab, one line a job. The jobs come from the Revenue tab (every day read). A job is
   read the first time, when its charged or owed changes there, and, while someone still owes, again after 20 hours
   (payments come in); a paid-up job stays as read. Read in turns (cashSync, newest jobs first), so the first time
   (every job) takes a few minutes in the background. ---- */
const CASH_SHEET = "Payments";
const CASH_COLS = ["Job id", "Job day", "Department", "Invoice #", "Client", "Charged (cents)", "Owed (cents)", "Read at", "Payments"];
const CASH_AGAIN = 20 * 3600e3, CASH_BUDGET = 22000, CASH_BATCH = 12;
function cashSheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(CASH_SHEET);
  if (!s && create) {
    s = ss.insertSheet(CASH_SHEET);
    if (s.getMaxColumns() < CASH_COLS.length) s.insertColumnsAfter(s.getMaxColumns(), CASH_COLS.length - s.getMaxColumns());
    s.getRange(1, 1, 1, CASH_COLS.length).setValues([CASH_COLS]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange(2, 1, Math.max(s.getMaxRows() - 1, 1), 5).setNumberFormat("@");   // ids, days and invoice numbers stay text
  }
  return s;
}
/** The Payments tab: { id: { row, day, dep, inv, client, c, owes, at (ms), pays: [[day, cents], …] } }. */
function cashRows_(s) {
  const out = {};
  if (!s || s.getLastRow() < 2) return out;
  const tz = Session.getScriptTimeZone();
  s.getRange(2, 1, s.getLastRow() - 1, CASH_COLS.length).getValues().forEach(function (r, i) {
    const id = String(r[0] || "");
    if (!id) return;
    let pays = [];
    try { pays = JSON.parse(String(r[8] || "[]")); } catch (e) { pays = []; }
    // the job's day stays text, but a row past the ones made as text can come back as a date: read it as yyyy-MM-dd
    out[id] = { row: i + 2, day: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, "yyyy-MM-dd") : String(r[1] || ""), dep: String(r[2] || "o"), inv: String(r[3] || ""), client: String(r[4] || ""), c: Number(r[5]) || 0, owes: Number(r[6]) || 0,
      at: r[7] ? new Date(r[7]).getTime() || 0 : 0, pays: Array.isArray(pays) ? pays : [] };
  });
  return out;
}
/** Every job on the Revenue tab: { id: { day, dep, inv, client, c, owes } } (a job on several days: its first). */
function cashJobs_(rows) {
  rows = rows || revJobCol_();
  const out = {};
  Object.keys(rows).sort().forEach(function (d) {
    let js = null;
    try { js = JSON.parse(rows[d][14] || "null"); } catch (e) { js = null; }
    if (!Array.isArray(js)) return;
    js.forEach(function (x) {
      const id = String(x[0] || "");
      if (!id || out[id]) return;
      out[id] = { day: d, dep: "rcp".indexOf(String(x[3] || "")) >= 0 && x[3] ? String(x[3]) : "o", inv: String(x[1] || ""), client: String(x[2] || ""), c: Number(x[4]) || 0, owes: Number(x[5]) || 0 };
    });
  });
  return out;
}
/** One job's payments from its invoices: [[day, cents], …], or null when Housecall Pro didn't answer. A payment that
 *  failed, was voided or refunded isn't counted; an invoice that's canceled isn't either. An invoice with no list of
 *  payments but paid: what's been paid on it, on its paid day. */
function cashPaysOf_(r, tz) {
  if (!r || r.error) return null;
  const d = r.data || {}, list = Array.isArray(d) ? d : Array.isArray(d.invoices) ? d.invoices : Array.isArray(d.data) ? d.data : [];
  const day = v => { const t = v ? new Date(v) : null; return t && !isNaN(t.getTime()) ? Utilities.formatDate(t, tz, "yyyy-MM-dd") : ""; };
  const out = [];
  list.forEach(function (i) {
    if (!i || /cancel|void/i.test(String(i.status || ""))) return;
    const pays = Array.isArray(i.payments) ? i.payments : null;
    if (pays && pays.length) {
      pays.forEach(function (p) {
        const a = Math.round(Number(p && p.amount) || 0), at = day(p && (p.paid_at || p.created_at || p.date));
        if (a > 0 && at && !/fail|void|declin|refund|cancel/i.test(String((p && p.status) || ""))) out.push([at, a]);
      });
    } else {
      const paid = Math.round((Number(i.amount) || 0) - (Number(i.due_amount) || 0)), at = day(i.paid_at);
      if (paid > 0 && at) out.push([at, paid]);
    }
  });
  return out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
}
/** The jobs to read (newest first): never read, charged or owed changed on the Revenue tab, or still owing and read
 *  more than 20 hours ago (force: still owing, now). A job with nothing charged has nothing to read. */
function cashToRead_(jobs, have, now, force) {
  return Object.keys(jobs).filter(function (id) {
    const j = jobs[id], h = have[id];
    if (!(j.c > 0)) return false;
    if (!h) return true;
    if (h.c !== j.c || h.owes !== j.owes) return true;
    return h.owes > 0 && (force || now - h.at > CASH_AGAIN);
  }).sort(function (a, b) { return jobs[a].day < jobs[b].day ? 1 : jobs[a].day > jobs[b].day ? -1 : 0; });
}
/** A turn of reading (about 20 seconds): { ok, read, left, done }. The app asks again until done. */
function cashSync_(req) {
  if (!hcpKey_()) return { ok: false, error: "no_key" };
  const tz = Session.getScriptTimeZone(), start = Date.now(), s = cashSheet_(true), have = cashRows_(s), jobs = cashJobs_();
  const todo = cashToRead_(jobs, have, start, !!req.force);
  let read = 0, failed = 0;
  const lines = [];
  for (let i = 0; i < todo.length && Date.now() - start < CASH_BUDGET; i += CASH_BATCH) {
    const part = todo.slice(i, i + CASH_BATCH);
    const res = hcpGetAll_(part.map(function (id) { return { path: "/jobs/" + encodeURIComponent(id) + "/invoices" }; }));
    let stop = false;
    part.forEach(function (id, k) {
      const pays = cashPaysOf_(res[k], tz);
      if (!pays) { failed++; if (res[k] && (res[k].error === "hcp_key" || res[k].error === "hcp_forbidden")) stop = res[k].error; return; }
      const j = jobs[id];
      lines.push([id, j.day, j.dep, j.inv, j.client, j.c, j.owes, new Date().toISOString(), JSON.stringify(pays)]);
      read++;
    });
    if (stop) return { ok: false, error: stop };
  }
  if (lines.length) withLock_(function () {   // written by job: its line again, else a new one (read again inside the lock)
    const now = cashRows_(s), adds = [];
    lines.forEach(function (l) { const h = now[l[0]]; if (h) s.getRange(h.row, 1, 1, CASH_COLS.length).setValues([l]); else { adds.push(l); now[l[0]] = { row: -1 }; } });
    if (adds.length) appendRows_(s, CASH_COLS.length, adds);
  });
  const left = Math.max(0, todo.length - read - failed);
  return { ok: true, read: read, failed: failed, left: left, done: left === 0 };
}
/** The payments that came in from..to (up to 2 years): items [day paid, cents, department, job day, invoice #, client,
 *  job id], oldest first; left: jobs still to read; at: when the newest was read. */
function cashRead_(req) {
  const ok = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  const from = String(req.from || ""), to = String(req.to || "");
  if (!ok(from) || !ok(to) || to < from) return { ok: false, error: "bad_request" };
  const jf = String(req.jf || ""), jt = String(req.jt || ""), cmp = ok(jf) && ok(jt) && jt >= jf;
  const have = cashRows_(cashSheet_(false)), rows = revJobCol_(), jobs = cashJobs_(rows), items = [];
  let at = 0;
  Object.keys(have).forEach(function (id) {
    const h = have[id], j = jobs[id] || h;   // the job as the Revenue tab has it now (its day, if it moved)
    if (h.at > at) at = h.at;
    h.pays.forEach(function (p) { if (p[0] >= from && p[0] <= to) items.push([p[0], p[1], j.dep, j.day, h.inv, h.client, id]); });
  });
  items.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : b[1] - a[1]; });
  const out = { ok: true, items: items, left: cashToRead_(jobs, have, Date.now(), false).length, at: at ? new Date(at).toISOString() : "" };
  if (cmp) out.cmp = cashCmp_(rows, have, items, from, to, jf, jt);
  return out;
}
/** Money in next to Collected, for the jobs dated jf..jt (the Revenue tab's days, counted as Collected counts them:
 *  each visit's charge less what's still owed). From Money in (paid from..to): less what came in for jobs dated before
 *  jf (older) and after jt (later) = what came in for these jobs (inside); plus what was paid for them before from and
 *  after to = every payment for them (paid); less what's above a job's charge (above: tips, card fees) and what's paid
 *  but still shown owed (stale: the day not read since), plus what Collected counts with no payment found (short) and
 *  for jobs not read yet (unread) = Collected (col). diff: the jobs where the two differ,
 *  [job id, job day, department, invoice #, client, charged ¢, collected ¢, payments found ¢ (-1: not read yet)]. */
function cashCmp_(rows, have, items, from, to, jf, jt) {
  const by = {};
  Object.keys(rows).forEach(function (d) {
    if (d < jf || d > jt) return;
    let js = null;
    try { js = JSON.parse(rows[d][14] || "null"); } catch (e) { js = null; }
    if (!Array.isArray(js)) return;
    js.forEach(function (x) {
      const id = String(x[0] || "");
      if (!id) return;
      const c = Number(x[4]) || 0, o = Number(x[5]) || 0;
      const b = by[id] || (by[id] = { day: d, dep: "rcp".indexOf(String(x[3] || "")) >= 0 && x[3] ? String(x[3]) : "o", inv: String(x[1] || ""), client: String(x[2] || ""), c: 0, col: 0 });
      b.c += c; b.col += Math.max(0, Math.min(c, c - o));
    });
  });
  const t = { jf: jf, jt: jt, jobs: 0, older: 0, later: 0, inside: 0, before: 0, after: 0, paid: 0, above: 0, stale: 0, short: 0, unread: 0, unreadN: 0, col: 0, diff: [] };
  items.forEach(function (x) { if (by[x[6]]) return; if (x[3] && x[3] < jf) t.older += x[1]; else t.later += x[1]; });
  Object.keys(by).forEach(function (id) {
    const b = by[id], h = have[id];
    t.jobs++; t.col += b.col;
    if (!h) {
      if (b.c > 0) { t.unreadN++; t.unread += b.col; if (b.col) t.diff.push([id, b.day, b.dep, b.inv, b.client, b.c, b.col, -1]); }
      return;
    }
    let all = 0;
    h.pays.forEach(function (p) { all += p[1]; if (p[0] < from) t.before += p[1]; else if (p[0] > to) t.after += p[1]; else t.inside += p[1]; });
    t.paid += all;
    const above = Math.max(0, all - b.c), stale = Math.max(0, Math.min(all, b.c) - b.col), short = Math.max(0, b.col - all);
    t.above += above; t.stale += stale; t.short += short;
    if (above || stale || short) t.diff.push([id, b.day, b.dep, b.inv, b.client, b.c, b.col, all]);
  });
  return t;
}

/* ---- Services: each job's service lines (its line items in Housecall Pro: Carpet cleaning, Stretching, Maxim, the
   card fee, discounts…), kept on the "Service lines" tab and read in turns like Money in. The app adds them up by
   service, day by day, as in the TOTAL SERVICES REVENUE workbook; which column a service name goes to is the
   service map (an admin picks it once; the app guesses the rest). ---- */
const SRV_SHEET = "Service lines";
const SRV_COLS = ["Job id", "Job day", "Department", "Invoice #", "Job type", "Charged (cents)", "Read at", "Lines"];
const SRV_MAP = "SRV_MAP";   // (before the tab) Script Property: { "service name, lower case": column key }
// each service name's column, on its own tab (a Script Property holds 9 KB: a year's names didn't fit)
const SRV_MAP_SHEET = "Service columns", SRV_MAP_COLS = ["Name in Housecall Pro", "Column"];
const SRV_KEYS = ["carpet", "comcarpet", "stretch", "rugin", "rugplant", "uph", "hfpolish", "hfsandless", "vct", "maid", "tile", "water", "mold", "duct", "repair",
  "maxcarpet", "maxrug", "maxuph", "sealer", "spots", "deodor", "ccfee", "disc", "sdisc", "skip", "job"];   // job: by the job's department
function srvSheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(SRV_SHEET);
  if (!s && create) {
    s = ss.insertSheet(SRV_SHEET);
    if (s.getMaxColumns() < SRV_COLS.length) s.insertColumnsAfter(s.getMaxColumns(), SRV_COLS.length - s.getMaxColumns());
    s.getRange(1, 1, 1, SRV_COLS.length).setValues([SRV_COLS]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange(2, 1, Math.max(s.getMaxRows() - 1, 1), 5).setNumberFormat("@");   // ids, days, invoice numbers stay text
  }
  return s;
}
function srvRows_(s) {
  const out = {};
  if (!s || s.getLastRow() < 2) return out;
  const tz = Session.getScriptTimeZone();
  s.getRange(2, 1, s.getLastRow() - 1, SRV_COLS.length).getValues().forEach(function (r, i) {
    const id = String(r[0] || "");
    if (!id) return;
    let lines = [];
    try { lines = JSON.parse(String(r[7] || "[]")); } catch (e) { lines = []; }
    out[id] = { row: i + 2, day: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, "yyyy-MM-dd") : String(r[1] || ""), dep: String(r[2] || "o"), inv: String(r[3] || ""), type: String(r[4] || ""),
      c: Number(r[5]) || 0, at: r[6] ? new Date(r[6]).getTime() || 0 : 0, lines: Array.isArray(lines) ? lines : [] };
  });
  return out;
}
/** The jobs (each visit) on the Revenue tab's days from..to: id → { day, dep, inv, type, c }. */
function srvJobs_(from, to, rows) {
  rows = rows || revRows_(revSheet_(false));
  const out = {};
  Object.keys(rows).sort().forEach(function (d) {
    if (d < from || d > to) return;
    let js = null;
    try { js = JSON.parse(rows[d][14] || "null"); } catch (e) { js = null; }
    if (!Array.isArray(js)) return;
    js.forEach(function (x) {
      const id = String(x[0] || "");
      if (!id || out[id]) return;
      out[id] = { day: d, dep: "rcp".indexOf(String(x[3] || "")) >= 0 && x[3] ? String(x[3]) : "o", inv: String(x[1] || ""), type: String(x[10] || ""), c: Number(x[4]) || 0 };
    });
  });
  return out;
}
/** A job's service lines: [[name, kind, cents]] (its amount, else its total price, else price × quantity), or null when
 *  Housecall Pro didn't answer. A line of $0 is left out. */
function srvLinesOf_(r) {
  if (!r || r.error) return null;
  const d = r.data || {}, list = Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : Array.isArray(d.line_items) ? d.line_items : [];
  const out = [];
  list.forEach(function (it) {
    if (!it) return;
    const name = String(it.name || it.service_name || it.title || it.description || "").replace(/\s+/g, " ").trim().slice(0, 80) || "(no name)";
    const amt = it.amount !== undefined && it.amount !== null ? Number(it.amount) : it.total_price !== undefined && it.total_price !== null ? Number(it.total_price)
      : (Number(it.unit_price) || 0) * (it.quantity !== undefined && it.quantity !== null ? Number(it.quantity) || 0 : 1);
    const c = Math.round(amt) || 0;
    if (c) out.push([name, String(it.kind || it.type || "").slice(0, 20), c]);
  });
  return out;
}
const SRV_BUDGET = 22000, SRV_BATCH = 12;
/** Reads the service lines of the jobs from..to (on the Revenue tab) not read yet, or whose amount changed (force: all
 *  of them again), the newest first, in turns. { ok, read, failed, left, done } */
function srvSync_(req) {
  if (!hcpKey_()) return { ok: false, error: "no_key" };
  const ok = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  const from = String(req.from || ""), to = String(req.to || "");
  if (!ok(from) || !ok(to) || to < from) return { ok: false, error: "bad_request" };
  const start = Date.now(), s = srvSheet_(true), have = srvRows_(s), jobs = srvJobs_(from, to);
  const todo = Object.keys(jobs).filter(function (id) { const j = jobs[id], h = have[id]; return j.c !== 0 && (!h || h.c !== j.c || (req.force && h.at < start - 60e3)); })
    .sort(function (a, b) { return jobs[a].day < jobs[b].day ? 1 : jobs[a].day > jobs[b].day ? -1 : 0; });
  let read = 0, failed = 0;
  const lines = [];
  for (let i = 0; i < todo.length && Date.now() - start < SRV_BUDGET; i += SRV_BATCH) {
    const part = todo.slice(i, i + SRV_BATCH);
    const res = hcpGetAll_(part.map(function (id) { return { path: "/jobs/" + encodeURIComponent(id) + "/line_items" }; }));
    let stop = false;
    part.forEach(function (id, k) {
      const ls = srvLinesOf_(res[k]);
      if (!ls) { failed++; if (res[k] && (res[k].error === "hcp_key" || res[k].error === "hcp_forbidden")) stop = res[k].error; return; }
      const j = jobs[id];
      lines.push([id, j.day, j.dep, j.inv, j.type, j.c, new Date().toISOString(), JSON.stringify(ls)]);
      read++;
    });
    if (stop) return { ok: false, error: stop };
  }
  if (lines.length) withLock_(function () {
    const now = srvRows_(s), adds = [];
    lines.forEach(function (l) { const h = now[l[0]]; if (h) s.getRange(h.row, 1, 1, SRV_COLS.length).setValues([l]); else { adds.push(l); now[l[0]] = { row: -1 }; } });
    if (adds.length) appendRows_(s, SRV_COLS.length, adds);
  });
  const left = Math.max(0, todo.length - read - failed);
  return { ok: true, read: read, failed: failed, left: left, done: left === 0 };
}
/** The jobs from..to (on the Revenue tab) with their service lines: items [[job id, day, department, invoice #, job
 *  type, charged ¢, lines]] (lines null: not read yet); left: still to read; map: the service map; at: newest read. */
function srvRead_(req) {
  const ok = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  const from = String(req.from || ""), to = String(req.to || "");
  if (!ok(from) || !ok(to) || to < from) return { ok: false, error: "bad_request" };
  const have = srvRows_(srvSheet_(false)), jobs = srvJobs_(from, to), items = [];
  let at = 0, left = 0;
  Object.keys(jobs).forEach(function (id) {
    const j = jobs[id], h = have[id], fresh = h && h.c === j.c;
    if (h && h.at > at) at = h.at;
    if (j.c !== 0 && !fresh) left++;
    items.push([id, j.day, j.dep, j.inv, j.type, j.c, h ? h.lines : null]);
  });
  items.sort(function (a, b) { return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; });
  // "By the job" only to an app that knows it (an older one guesses by the job anyway); fixJob: the one-time fix is done
  const map = srvMap_();
  if (!req.byJob) Object.keys(map).forEach(function (n) { if (map[n] === "job") delete map[n]; });
  return { ok: true, items: items, left: left, map: map, at: at ? new Date(at).toISOString() : "", fixJob: PropertiesService.getScriptProperties().getProperty("SRV_FIX") === "job1" };
}
function srvMap_() {
  const s = SpreadsheetApp.getActive().getSheetByName(SRV_MAP_SHEET);
  if (s) {
    const m = {};
    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 2).getValues().forEach(function (r) {
      const n = String(r[0] || "").replace(/^'/, "").replace(/\s+/g, " ").trim().toLowerCase(), k = String(r[1] || "").trim();
      if (n && SRV_KEYS.indexOf(k) !== -1) m[n] = k;
    });
    return m;
  }
  let m = {};   // not moved to the tab yet: the Script Property
  try { m = JSON.parse(PropertiesService.getScriptProperties().getProperty(SRV_MAP) || "{}") || {}; } catch (e) { m = {}; }
  return m && typeof m === "object" ? m : {};
}
/** Admins: the service map, { map: { name: key } } merged in (a key of "" takes a name off, back to the app's guess).
 *  fix "job1": the one-time fix (names saved as Water damage or Repair only because that was their guess on most of
 *  their jobs, made By the job) is done. */
function srvMapPut_(req) {
  const m = srvMap_(), add = req.map && typeof req.map === "object" ? req.map : null;
  if (!add) return { ok: false, error: "bad_request" };
  Object.keys(add).forEach(function (n) {
    const name = String(n).replace(/\s+/g, " ").trim().toLowerCase().slice(0, 80), k = String(add[n] || "");
    if (!name) return;
    if (!k) delete m[name]; else if (SRV_KEYS.indexOf(k) !== -1) m[name] = k;
  });
  // the whole list on the tab, A to Z (a name that starts like a formula kept as text); the old Script Property goes
  const names = Object.keys(m).sort(), s = pcSheet_(SRV_MAP_SHEET, SRV_MAP_COLS);
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 2).clearContent();
  if (names.length) {
    if (s.getMaxRows() < names.length + 1) s.insertRowsAfter(s.getMaxRows(), names.length + 1 - s.getMaxRows() + 50);
    s.getRange(2, 1, names.length, 2).setNumberFormat("@").setValues(names.map(function (n) { return [/^[=+\-@]/.test(n) ? "'" + n : n, m[n]]; }));
  }
  PropertiesService.getScriptProperties().deleteProperty(SRV_MAP);
  if (req.fix === "job1") PropertiesService.getScriptProperties().setProperty("SRV_FIX", "job1");
  return { ok: true, map: m };
}

const UNSENT_CACHE = "unsent_v1", UNSENT_PAGES = 20, UNSENT_JOBS = 80, UNSENT_ALT = 300;
/** The Revenue tab's jobs (every day read), by job id and by job #: the latest visit of each. */
function unsentJobs_() {
  const rows = revJobCol_(), byId = {}, byInv = {};
  Object.keys(rows).sort().forEach(function (d) {
    let js = null;
    try { js = JSON.parse(rows[d][14] || "null"); } catch (e) { js = null; }
    if (!Array.isArray(js)) return;
    js.forEach(function (x) {
      const j = { id: String(x[0] || ""), inv: String(x[1] || ""), client: String(x[2] || ""), dep: "rcp".indexOf(String(x[3] || "")) >= 0 && x[3] ? String(x[3]) : "o",
        c: Number(x[4]) || 0, owes: Number(x[5]) || 0, proj: String(x[6] || ""), ws: String(x[7] || ""), day: d };
      if (j.id) byId[j.id] = j;
      if (j.inv) byInv[j.inv] = j;
    });
  });
  return { byId: byId, byInv: byInv };
}
const unsentDone_ = ws => /^complete/i.test(String(ws || "").trim());   // finished (rated or not)
const unsentList_ = d => (Array.isArray(d) ? d : d && Array.isArray(d.invoices) ? d.invoices : d && Array.isArray(d.data) ? d.data : []);
/** An invoice that still owes, was never sent and isn't canceled. */
function unsentOpen_(i) {
  return !!i && (Number(i.due_amount) || 0) > 0 && !i.sent_at && !/cancel|void|paid/i.test(String(i.status || ""));
}
/** A job read from Housecall Pro, as the Revenue tab keeps one. */
function unsentJobFrom_(job, tz) {
  const t = hcpJobType_(job), at = new Date((job.work_timestamps && job.work_timestamps.completed_at) || (job.schedule && job.schedule.scheduled_start) || "");
  return { id: String(job.id || ""), inv: String(job.invoice_number || ""), client: hcpClient_(job), dep: revDept_(t), c: Number(job.total_amount) || 0,
    owes: Number(job.outstanding_balance) || 0, proj: String(job.description || t || "").replace(/\s+/g, " ").trim().slice(0, 80), ws: String(job.work_status || "").slice(0, 30),
    day: isNaN(at.getTime()) ? "" : Utilities.formatDate(at, tz, "yyyy-MM-dd") };
}
/** One line of the list: { id (job), inv (invoice #), client, dep, amt ¢, due ¢, proj, ws, day }. */
function unsentItem_(i, j) {
  return { id: j ? j.id : String(i.job_id || ""), inv: String(i.invoice_number || (j && j.inv) || ""), client: (j && j.client) || "", dep: j ? j.dep : "o",
    amt: Math.round(Number(i.amount) || 0), due: Math.round(Number(i.due_amount) || 0), proj: j ? j.proj : "", ws: j ? j.ws : "", day: (j && j.day) || "" };
}
function unsentRead_(req) {
  let cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  if (!req.force && cache) { try { const c = cache.get(UNSENT_CACHE); if (c) return Object.assign(JSON.parse(c), { cached: true }); } catch (e) { /* read it again */ } }
  if (!hcpKey_()) return { ok: false, error: "no_key" };
  const tz = Session.getScriptTimeZone(), J = unsentJobs_(), since = (new Date().getFullYear() - 1) + "-01-01";
  let items = [], src = "invoices", more = false;
  // the invoices with something still due, page by page
  const open = [];
  let failed = null;
  const inv = hcpPages_("/invoices", { amount_due_min: 1, created_at_min: hcpDayStart_(since), page_size: 100 }, unsentList_, UNSENT_PAGES);
  if (inv.error) failed = inv;
  else { inv.items.forEach(function (i) { if (unsentOpen_(i)) open.push(i); }); more = inv.more; }
  if (failed && failed.error !== "hcp_http") return { ok: false, error: failed.error, status: failed.status || 0 };
  if (!failed) {
    // each one's job: from the Revenue tab, else read from Housecall Pro (up to UNSENT_JOBS)
    const find = function (i) {
      const id = String(i.job_id || (i.job && i.job.id) || ""), n = String(i.invoice_number || "");
      return (id && J.byId[id]) || J.byInv[n] || J.byInv[n.replace(/-\d+$/, "")] || J.byInv[n.replace(/-\d+$/, "") + "-1"] || null;
    };
    const ask = [];
    open.forEach(function (i) { const id = String(i.job_id || (i.job && i.job.id) || ""); if (!find(i) && id && ask.indexOf(id) < 0 && ask.length < UNSENT_JOBS) ask.push(id); });
    hcpGetAll_(ask.map(function (id) { return { path: "/jobs/" + encodeURIComponent(id) }; })).forEach(function (r) {
      const job = r && !r.error && r.data ? (r.data.job || r.data) : null;
      if (job && job.id) J.byId[String(job.id)] = unsentJobFrom_(job, tz);
    });
    open.forEach(function (i) { const j = find(i); if (!j || unsentDone_(j.ws)) items.push(unsentItem_(i, j)); });
  } else {
    // /invoices can't be read: the finished jobs that still owe (Revenue tab), their invoices one by one
    src = "jobs";
    const cand = Object.keys(J.byId).map(function (k) { return J.byId[k]; }).filter(function (j) { return j.owes > 0 && unsentDone_(j.ws) && j.day >= since; })
      .sort(function (a, b) { return a.day < b.day ? 1 : -1; });
    if (cand.length > UNSENT_ALT) more = true;
    const list = cand.slice(0, UNSENT_ALT);
    hcpGetAll_(list.map(function (j) { return { path: "/jobs/" + encodeURIComponent(j.id) + "/invoices" }; })).forEach(function (r, k) {
      if (!r || r.error) return;
      unsentList_(r.data).forEach(function (i) { if (unsentOpen_(i)) items.push(unsentItem_(i, list[k])); });
    });
  }
  items.sort(function (a, b) { return (a.day || "9") < (b.day || "9") ? -1 : (a.day || "9") > (b.day || "9") ? 1 : b.due - a.due; });
  const out = { ok: true, at: new Date().toISOString(), src: src, more: more, items: items.slice(0, 500) };
  if (cache) { try { cache.put(UNSENT_CACHE, JSON.stringify(out), 21600); } catch (e) { /* too big to keep: read again next time */ } }
  return out;
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
/** Operations' Daily revenue and Future revenue: what's on the books in Housecall Pro now, by department. when "today":
 *  every visit scheduled today (done, under way or still to come); "future": every visit scheduled from tomorrow on, to
 *  the last one booked. The same rules as Revenue: money on each visit, a job counted once (its first visit), canceled
 *  left out; a job not scheduled yet has no day, so it isn't in either. */
const REV_BOOKED_MAX = 1500;   // visits listed (the totals count them all)
function revBooked_(req) {
  const tz = Session.getScriptTimeZone(), today = Utilities.formatDate(tmNow_(), tz, "yyyy-MM-dd");
  const future = req.when === "future", from = future ? tmAddDays_(today, 1) : today;
  let jobs = [], more = false;
  if (!future) {
    const got = hcpJobsIn_(today, today);
    if (got.error) return { ok: false, error: got.error, status: got.status || 0 };
    jobs = got.jobs; more = got.more;
  } else {
    const got = hcpPages_("/jobs", { scheduled_start_min: hcpDayStart_(from), page_size: HCP_PAGE }, function (d) { return Array.isArray(d && d.jobs) ? d.jobs : []; }, HCP_MAX_PAGES);
    if (got.error) return { ok: false, error: got.error, status: got.status || 0 };
    jobs = got.items; more = got.more;
  }
  const depts = {}, list = [];
  REV_DEPTS.forEach(function (k) { depts[k] = { cents: 0, jobs: 0, visits: 0 }; });
  let last = "", seen = {};
  jobs.forEach(function (job) {
    if (!job || /cancel/i.test(String(job.work_status || "")) || (job.id && seen[job.id])) return;
    if (job.id) seen[job.id] = true;
    const start = new Date((job.schedule && job.schedule.scheduled_start) || "");
    if (isNaN(start.getTime())) return;
    const d = Utilities.formatDate(start, tz, "yyyy-MM-dd");
    if (future ? d < from : d !== today) return;
    const k = revDept_(hcpJobType_(job)), a = depts[k], cents = Math.round(Number(job.total_amount) || 0), first = hcpFirstVisit_(job);
    a.cents += cents;
    a.visits++;
    if (first) a.jobs++;
    if (d > last) last = d;
    // each visit, to list and open in Housecall Pro: [job id, invoice #, client, department, cents, day, status, first visit]
    list.push([String(job.id || ""), String(job.invoice_number || ""), hcpClient_(job), k, cents, d, String(job.work_status || "").slice(0, 40), first ? 1 : 0]);
  });
  list.sort(function (a, b) { return a[5] < b[5] ? -1 : a[5] > b[5] ? 1 : b[4] - a[4]; });
  return { ok: true, when: future ? "future" : "today", from: from, to: future ? last : today, depts: depts, jobs: list.slice(0, REV_BOOKED_MAX), more: more || list.length > REV_BOOKED_MAX, at: new Date().toISOString() };
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
  list.forEach(function (d) { acc[d] = { r: [0, 0], c: [0, 0], p: [0, 0], o: [0, 0], visits: 0, other: {}, src: {}, unpaid: [], jobs: [], cl: {} }; });
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
    // Clients Per Month: the same, with Residential or Commercial (from the Job type: "Cleaning Commercial - REPEAT")
    const ck = mktKind_(type) + "|" + (/commercial/i.test(type) ? "com" : "res") + "|" + hcpLead_(job);
    const cv = a.cl[ck] || (a.cl[ck] = [0, 0, 0, 0, 0, 0, 0, 0]);
    cv[i] += Math.round(cents);
    if (first) cv[i + 1]++;
    // still owed: done or under way (a visit still to come isn't owed yet)
    const owes = Math.round(Number(job.outstanding_balance) || 0);
    // (then, for Clients Per Month's lists: its Clients key and its Job type)
    a.jobs.push([String(job.id || ""), String(job.invoice_number || ""), hcpClient_(job), k, Math.round(cents), owes,
      String(job.description || type || "").replace(/\s+/g, " ").trim().slice(0, 80), String(job.work_status || "").slice(0, 30), first ? 1 : 0, ck, type.slice(0, 80)]);
    if (owes > 0 && !/^(scheduled|unscheduled|needs scheduling)$/i.test(String(job.work_status || "").trim()))
      a.unpaid.push([String(job.id || ""), String(job.invoice_number || ""), hcpClient_(job), k, Math.round(cents), owes,
        String(job.description || type || "").replace(/\s+/g, " ").trim().slice(0, 80)]);
    if (k === "o") a.other[type || "(no job type)"] = true;
  });
  const fresh = {};
  list.forEach(function (d) {
    const a = acc[d], row = [d];
    REV_DEPTS.forEach(function (k) { row.push(Math.round(a[k][0]) / 100, a[k][1]); });
    row.push(a.visits, at, Object.keys(a.other).sort().join("; "), JSON.stringify(a.src), JSON.stringify(a.unpaid), JSON.stringify(a.jobs), JSON.stringify(a.cl));
    fresh[d] = row;
  });
  return withLock_(function () {
    // only the days read are written (the whole tab, every day of every year, was written again each time): each in its
    // row, a new day at the bottom (A to Z again if it isn't the last)
    const s = revSheet_(true);
    if (String(s.getRange(1, REV_COLS.length).getValue()) !== REV_COLS[REV_COLS.length - 1]) s.getRange(1, 1, 1, REV_COLS.length).setValues([REV_COLS]).setFontWeight("bold");   // a tab made before Marketing, Unpaid or Jobs
    const n = Math.max(0, s.getLastRow() - 1), rowOf = {};
    let lastDay = "";
    (n ? s.getRange(2, 1, n, 1).getValues() : []).forEach(function (r, i) { const d = revDayKey_(r[0]); if (d) { rowOf[d] = i + 2; if (d > lastDay) lastDay = d; } });
    const add = [];
    list.forEach(function (d) {
      if (rowOf[d]) { s.getRange(rowOf[d], 1, 1, 1).setNumberFormat("@"); s.getRange(rowOf[d], 1, 1, REV_COLS.length).setValues([fresh[d]]); }
      else add.push(fresh[d]);
    });
    if (add.length) {
      const first = n + 2;
      s.getRange(first, 1, add.length, 1).setNumberFormat("@");   // before the days go in, so none turns into a date
      appendRows_(s, REV_COLS.length, add);
      if (add.some(function (r) { return r[0] < lastDay; })) s.getRange(2, 1, n + add.length, REV_COLS.length).sort(1);
    }
    return { ok: true, days: pick(fresh) };
  });
}

/* ---- Clients Per Month (Office, admins and Revenue): each day's money and clients by where they came from, as the
   "4. Clients Per Month" Excel had it. From Housecall Pro: the Clients column of the Revenue tab (each day's jobs by
   Repeat / Referral from the Job type, Residential or Commercial, and the Lead source). Months before Housecall Pro:
   from the Excel, loaded by an admin (Office › Load from Excel on Clients Per Month), one row a month here: each day's
   [$, clients] by column. ---- */
const CPM_SHEET = "Clients per month", CPM_COLS = ["Month", "Days", "From", "Loaded at", "Loaded by"];
const CPM_MAX = 400;   // months
function canCpm_(user) { return !!user && (user.role === "admin" || canSee_(user, "revenue")); }
/** The Excel's months ({ "2019-04": { "1": { "Google": [cents, clients] } } }) and how Lead sources are matched (Marketing). */
function cpmRead_() {
  const s = SpreadsheetApp.getActive().getSheetByName(CPM_SHEET), tz = Session.getScriptTimeZone(), months = {};
  (s && s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, CPM_COLS.length).getValues() : []).forEach(function (r) {
    const m = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, "yyyy-MM") : String(r[0] || "").trim();
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    try { const d = JSON.parse(String(r[1] || "{}")); if (d && typeof d === "object") months[m] = d; } catch (e) { /* a broken row: left out */ }
  });
  const map = {};
  mktRows_(mktSheet_(MKT_MAP, MKT_MAP_COLS, false), MKT_MAP_COLS.length).forEach(function (r) { const row = mktName_(r[1]); if (row) map[mktName_(r[0])] = row; });
  return { ok: true, months: months, map: map };
}
/** Admin: the Excel's months ({ months: { "2019-04": days } }): each replaces that month; the others stay. */
function cpmImport_(req, user) {
  const got = req.months && typeof req.months === "object" && !Array.isArray(req.months) ? req.months : null;
  if (!got || Object.keys(got).length > CPM_MAX) return { ok: false, error: "bad_request" };
  const clean = {};
  Object.keys(got).forEach(function (m) {
    if (!/^\d{4}-\d{2}$/.test(m) || !got[m] || typeof got[m] !== "object") return;
    const days = {};
    Object.keys(got[m]).forEach(function (d) {
      const n = Number(d), x = got[m][d];
      if (!(n >= 1 && n <= 31) || !x || typeof x !== "object") return;
      const cols = {};
      Object.keys(x).slice(0, 60).forEach(function (k) {
        const name = String(k).replace(/\s+/g, " ").trim().slice(0, 60), v = x[k];
        if (!name || !Array.isArray(v)) return;
        const c = Math.round(Number(v[0]) || 0), j = Math.round(Number(v[1]) || 0);
        if ((c || j) && Math.abs(c) < 1e10 && j >= 0 && j < 1e5) cols[name] = [c, j];
      });
      if (Object.keys(cols).length) days[String(n)] = cols;
    });
    clean[m] = days;
  });
  const s = pcSheet_(CPM_SHEET, CPM_COLS), tz = Session.getScriptTimeZone(), at = new Date().toISOString(), rows = {};
  (s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, CPM_COLS.length).getValues() : []).forEach(function (r) {
    const m = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, "yyyy-MM") : String(r[0] || "").trim();
    if (/^\d{4}-\d{2}$/.test(m)) rows[m] = [m, String(r[1] || ""), String(r[2] || ""), r[3] instanceof Date ? r[3].toISOString() : String(r[3] || ""), String(r[4] || "")];
  });
  Object.keys(clean).forEach(function (m) { rows[m] = [m, JSON.stringify(clean[m]), "Excel", at, String(user.name || "").slice(0, 60)]; });
  const all = Object.keys(rows).sort().map(function (m) { return rows[m]; });
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, CPM_COLS.length).clearContent();
  if (all.length) {
    if (s.getMaxRows() < all.length + 1) s.insertRowsAfter(s.getMaxRows(), all.length + 1 - s.getMaxRows());
    s.getRange(2, 1, all.length, 1).setNumberFormat("@");
    s.getRange(2, 1, all.length, CPM_COLS.length).setValues(all);
  }
  return Object.assign(cpmRead_(), { saved: Object.keys(clean).length });
}

/* ---- Referral Partners (Office, admins and Revenue): who sends us clients, their jobs and money each month, and the
   rewards (a partner's rule: a % of the money, $ a job or $ a month; what's been sent, when and how). Who referred a
   client: the customer's tag in Housecall Pro ("Referral Client By Maple Ridge Realty, LLC"), kept with Past clients'
   customers (read again as they change). Each job's day, number and money come from the Revenue tab's jobs (the app
   reads those like Operations); a job → its customer from Past clients' jobs. Months before Housecall Pro: the
   "9. REFERRAL PARTNERS" Excel, loaded by an admin (each month's jobs, $, reward and gift card notes per partner). ---- */
const RP_RULES = "Referral partners", RP_RULE_COLS = ["Partner", "Reward", "Amount", "Note", "Changed by", "Changed at", "Starts"];
const RP_SENT = "Referral rewards", RP_SENT_COLS = ["Id", "Month", "Partner", "Amount $", "Sent on", "Note", "By", "At"];
const RP_HIST = "Referral history", RP_HIST_COLS = ["Month", "Partner", "Jobs", "Revenue $", "Reward $", "Note", "From"];
const RP_KINDS = ["none", "pct", "job", "month", "once"];   // no reward; a % of the money; $ a job; $ a month with a job (each from its
                                                             // Starts month on, "" from the start); once: $ for its month only
const rpName_ = function (v) { return String(v === null || v === undefined ? "" : v).replace(/\s+/g, " ").trim().slice(0, 80); };
const RP_YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const RP_TAG = /^\s*(?:referr?al|referred)\b[^,]*?\bby\b\s*[:\-–]?\s*(.+?)\s*$/i;
/** The partner on a customer's tags ("Referral Client By Maple Ridge Realty, LLC" → "Maple Ridge Realty, LLC"), or "". */
function rpOfTags_(list) {
  for (let i = 0; i < (list || []).length; i++) { const m = RP_TAG.exec(String(list[i] || "")); if (m && m[1]) return m[1].replace(/\s+/g, " ").slice(0, 80); }
  return "";
}
/** The same from a customer's tags kept as one text ("a, b, c"): a company ending after a comma stays with its name. */
function rpOfTagText_(text) {
  const out = [];
  String(text || "").split(/,\s*/).forEach(function (p) {
    const t = p.trim();
    if (!t) return;
    if (out.length && /^(l\.?l\.?c\.?|inc\.?|incorporated|corp\.?|co\.?|ltd\.?|l\.?p\.?|llp|pllc|p\.?c\.?)$/i.test(t)) out[out.length - 1] += ", " + t;
    else out.push(t);
  });
  return rpOfTags_(out);
}
function rpMonth_(v, tz) { return v instanceof Date ? Utilities.formatDate(v, tz, "yyyy-MM") : (RP_YM.test(String(v || "").trim()) ? String(v).trim() : ""); }
/** Everything the page needs: who referred each customer (cust: customer id → partner), the jobs of those customers
 *  (jobs: job id → customer id), each partner's reward rule, the rewards sent, and the Excel's months. Past clients'
 *  customers and jobs are read again from Housecall Pro first when they're 15 minutes old. */
function rpRead_(force) {
  const P = PropertiesService.getScriptProperties(), tz = Session.getScriptTimeZone(), now = tmNow_().getTime();
  const ready = P.getProperty(PC_DONE) === "yes";
  let sync = null, cur = {};
  try { cur = JSON.parse(P.getProperty(PC_CUR) || "{}") || {}; } catch (e) { cur = {}; }
  if (ready && hcpKey_() && cur.stage !== "back" && (force || now - (Number(P.getProperty(PC_AT)) || 0) > PC_STALE) && now - (Number(P.getProperty(PC_BUSY)) || 0) > 90e3) {
    P.setProperty(PC_BUSY, String(now));
    try { sync = pcSync_({}, PC_READ_PAGES); } catch (e) { sync = { ok: false, error: "server" }; }
    P.deleteProperty(PC_BUSY);
  }
  const cust = {}, names = {};
  pcRows_(PC_CUST, PC_CUST_COLS.length).forEach(function (r) {
    const by = String(r[8] || "") || rpOfTagText_(r[4]);
    if (by) { cust[String(r[0])] = by; names[by] = (names[by] || 0) + 1; }
  });
  const jobs = {};
  pcRows_(PC_JOBS, PC_JOB_COLS.length).forEach(function (r) { const c = String(r[1] || ""); if (cust[c]) jobs[String(r[0])] = c; });
  const rules = mktRows_(mktSheet_(RP_RULES, RP_RULE_COLS, false), RP_RULE_COLS.length).filter(function (r) { return rpName_(r[0]); })
    .map(function (r) { return { partner: rpName_(r[0]), kind: RP_KINDS.indexOf(String(r[1])) !== -1 ? String(r[1]) : "none", amount: Number(r[2]) || 0, note: String(r[3] || ""), by: String(r[4] || ""), from: rpMonth_(r[6], tz) }; })
    .filter(function (r) { return r.kind !== "once" || r.from; });
  const sent = mktRows_(mktSheet_(RP_SENT, RP_SENT_COLS, false), RP_SENT_COLS.length).filter(function (r) { return r[0]; }).map(function (r) {
    return { id: String(r[0]), month: rpMonth_(r[1], tz), partner: rpName_(r[2]), cents: Math.round((Number(r[3]) || 0) * 100), day: pcDay_(r[4], tz), note: String(r[5] || ""), by: String(r[6] || "") };
  });
  const hist = mktRows_(mktSheet_(RP_HIST, RP_HIST_COLS, false), RP_HIST_COLS.length).filter(function (r) { return rpMonth_(r[0], tz) && rpName_(r[1]); })
    .map(function (r) { return [rpMonth_(r[0], tz), rpName_(r[1]), Number(r[2]) || 0, Math.round((Number(r[3]) || 0) * 100), Math.round((Number(r[4]) || 0) * 100), String(r[5] || "")]; });
  return { ok: true, ready: ready, cust: cust, jobs: jobs, partners: names, rules: rules, sent: sent, hist: hist, at: Number(P.getProperty(PC_AT)) || 0,
    sync: sync && !sync.ok ? { error: sync.error } : null };
}
/** Admin: a partner's reward ({ partner, kind: none | pct | job | month | once, amount, from: yyyy-MM or "" (from the
 *  start), note }): a rule runs from its month until the partner's next one; "once" is $ for its month only (on top).
 *  The same partner and month (and once or not) replaces; { …, del: true } takes one away. */
function rpRule_(req, user) {
  const tz = Session.getScriptTimeZone(), partner = rpName_(req.partner), kind = String(req.kind || ""), amount = Number(req.amount);
  const from = req.from === undefined || req.from === null ? "" : String(req.from).trim(), once = kind === "once";
  if (!partner || RP_KINDS.indexOf(kind) === -1 || (from && !RP_YM.test(from)) || (once && !from)) return { ok: false, error: "bad_request" };
  if (!req.del && !(amount >= 0 && amount <= (kind === "pct" ? 100 : 100000))) return { ok: false, error: "bad_request" };
  const s = mktSheet_(RP_RULES, RP_RULE_COLS, true), rows = mktRows_(s, RP_RULE_COLS.length).filter(function (r) { return rpName_(r[0]); });
  const same = function (r) { return rpName_(r[0]).toLowerCase() === partner.toLowerCase() && rpMonth_(r[6], tz) === from && (String(r[1]) === "once") === once; };
  const i = rows.findIndex(same);
  if (req.del) {
    if (i === -1) return { ok: false, error: "gone" };
    rows.splice(i, 1);
  } else {
    const row = [partner, kind, kind === "none" ? 0 : Math.round(amount * 100) / 100, String(req.note || "").replace(/\s+/g, " ").trim().slice(0, 140), String(user.name || "").slice(0, 60), new Date().toISOString(), from];
    if (i === -1) rows.push(row); else rows[i] = row;
  }
  s.getRange(1, 1, 1, RP_RULE_COLS.length).setValues([RP_RULE_COLS]).setFontWeight("bold");   // the Starts column on a tab made before it
  s.getRange("G:G").setNumberFormat("@");   // a month like 2026-11 stays text
  mktWrite_(s, RP_RULE_COLS, rows);
  return rpRead_();
}
/** Admin: a reward sent ({ month, partner, amount, day, note }), or one taken back ({ id, del: true }). */
function rpSent_(req, user) {
  const s = mktSheet_(RP_SENT, RP_SENT_COLS, true), rows = mktRows_(s, RP_SENT_COLS.length).filter(function (r) { return r[0]; });
  if (req.del) {
    const id = String(req.id || ""), left = rows.filter(function (r) { return String(r[0]) !== id; });
    if (left.length === rows.length) return { ok: false, error: "gone" };
    mktWrite_(s, RP_SENT_COLS, left);
    return rpRead_();
  }
  const month = String(req.month || ""), partner = rpName_(req.partner), amount = Number(req.amount), day = String(req.day || "");
  if (!RP_YM.test(month) || !partner || !(amount > 0 && amount <= 100000) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "bad_request" };
  rows.push([Utilities.getUuid(), month, partner, Math.round(amount * 100) / 100, day, String(req.note || "").replace(/\s+/g, " ").trim().slice(0, 200), String(user.name || "").slice(0, 60), new Date().toISOString()]);
  mktWrite_(s, RP_SENT_COLS, rows);
  return rpRead_();
}
/** Admin: the Excel's months ({ rows: [[month, partner, jobs, $, reward $, note]] }): they replace what was loaded before. */
function rpImport_(req) {
  const rows = Array.isArray(req.rows) ? req.rows : null;
  if (!rows || rows.length > 20000) return { ok: false, error: "bad_request" };
  const out = [];
  rows.forEach(function (x) {
    if (!Array.isArray(x) || !RP_YM.test(String(x[0] || "")) || !rpName_(x[1])) return;
    const jobs = Math.round(Number(x[2]) || 0), v = Math.round((Number(x[3]) || 0) * 100) / 100, rw = Math.round((Number(x[4]) || 0) * 100) / 100, note = String(x[5] || "").replace(/\s+/g, " ").trim().slice(0, 300);
    if (!jobs && !v && !rw && !note) return;
    out.push([String(x[0]), rpName_(x[1]), Math.max(0, jobs), v, rw, note, "Excel"]);
  });
  out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1; });
  mktWrite_(mktSheet_(RP_HIST, RP_HIST_COLS, true), RP_HIST_COLS, out);
  return Object.assign(rpRead_(), { saved: out.length });
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
/** Admin: ad spend typed (or imported) under one line moved to another, months a..b ({ from, to, a, b }): added to
 *  what the other line has that month, taken off the first. Spend imported from the spreadsheets keeps saying so
 *  (importing them again puts it back where the spreadsheet has it). */
function mktMove_(req, user) {
  const tz = Session.getScriptTimeZone(), from = mktName_(req.from), to = mktName_(req.to), a = mktMonth_(req.a, tz), b = mktMonth_(req.b, tz);
  if (!from || !to || from.toLowerCase() === to.toLowerCase() || !a || !b || a > b) return { ok: false, error: "bad_request" };
  const s = mktSheet_(MKT_SPEND, MKT_SPEND_COLS, true), at = new Date().toISOString();
  const rows = mktRows_(s, MKT_SPEND_COLS.length).map(function (r) { return [mktMonth_(r[0], tz), mktName_(r[1]), r[2], String(r[3] || ""), r[4], r[5]]; })
    .filter(function (r) { return r[0] && r[1] && r[2] !== "" && r[2] !== null; });
  const idx = {};
  rows.forEach(function (r, i) { idx[r[0] + "	" + r[1]] = i; });
  let n = 0, cents = 0;
  const gone = {};
  rows.forEach(function (r, i) {
    if (r[1] !== from || r[0] < a || r[0] > b) return;
    const v = mktMoney_(r[2]);
    if (v === null) return;
    const k = r[0] + "	" + to;
    if (idx[k] !== undefined) {
      const t = rows[idx[k]], sum = Math.round(((mktMoney_(t[2]) || 0) + v) * 100) / 100;
      rows[idx[k]] = [t[0], to, sum, t[3] === "typed" || r[3] === "typed" ? "typed" : t[3], user.name, at];
    } else { idx[k] = rows.length; rows.push([r[0], to, v, r[3] || "typed", user.name, at]); }
    gone[i] = true; n++; cents += Math.round(v * 100);
  });
  if (!n) return { ok: false, error: "nothing" };
  const keep = rows.filter(function (r, i) { return !gone[i]; });
  keep.sort(function (x, y) { return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0; });
  mktWrite_(s, MKT_SPEND_COLS, keep);
  return Object.assign(mktRead_(), { moved: { months: n, cents: cents } });
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
    [18, 21].forEach(function (c) { r[c] = repDay_(r[c], tz); });
    r[25] = String(r[25]).trim() === "before" ? "before" : repDay_(r[25], tz);   // paid before the app: no day
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
/* ---- Estimates (a tab of its own): every estimate in Housecall Pro (Restoration: water damage or mold, Cleaning,
   Repairs), when it was created, what it's for, whether the client approved it (or the office did) and when, and the
   person in charge of following it up (picked in the app). One row an estimate on the Estimates tab. Housecall Pro
   can't list estimates by the day they were created, only sort them by it: the first time they're read newest first,
   page by page, back to January 1 of last year; after that only the ones changed since the last read. ---- */
const EST_SHEET = "Estimates";
const EST_COLS = ["Estimate id", "Estimate #", "Day (scheduled, else created)", "Created at", "Client", "Address", "Department", "Kind (read)", "Job type", "Status", "Approved by",
  "Decided at", "Estimate $", "Approved $", "Options", "Work status", "Housecall Pro employees", "Lead source", "Updated at", "Read at", "In charge (id)",
  "In charge", "Kind (typed)", "Typed by", "Typed at", "Text", "Tags", "Status in Housecall Pro", "Scheduled for", "Address", "State", "Phone"];
// a quick read also reads again the open estimates of the last 180 days: the newest 20 each time, and 40 more in turn
// (where the last read stopped), so every open one is read again within a few reads however many there are
const EST_RECHECK_DAYS = 180, EST_RECHECK_NEW = 20, EST_RECHECK_TURN = 40, EST_RECHECK_AT = "EST_RECHECK_AT";
const EST_ACCESS = ["estimates", "estimates-all"];   // sees every estimate he's assigned to; sees them all
const EST_PAGES = 6, EST_AT = "EST_SYNC_AT", EST_DONE = "EST_BACKFILL_DONE", EST_SCHEMA = "EST_SCHEMA", EST_V = "5";   // 2: water/mold from tags; 3: every estimate (not only from last year), read again once; 4: each option's id (Housecall Pro's page for an estimate is its option's), read again once; 5: the day it was scheduled for, read again once
function canEst_(user) { return canSee_(user, "estimates") || canSee_(user, "estimates-all"); }
function estAll_(user) { return !!user && (user.role === "admin" || canSee_(user, "estimates-all")); }
/** Estimates › a department's report as a PDF to download: the page the app makes of it (plain HTML, its styles inline)
 *  turned into a PDF here, in this Google account. Only text and tables: scripts, pictures, links to other files and
 *  anything fetched from elsewhere are taken out first. { name, data (base64) } */
function estReportPdf_(req) {
  let html = String(req.html || "");
  if (!html || html.length > 400000) return { ok: false, error: "bad_request" };
  html = html.replace(/<(script|style|iframe|object|svg|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(script|style|iframe|object|embed|svg|link|img|meta|base|frame|frameset|noscript|template|form|input)\b[^>]*>/gi, "")
    .replace(/\s(src|href|srcset|xlink:href|on\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/url\s*\([^)]*\)?/gi, "none");
  const name = (String(req.name || "Report").replace(/[^\w .,()&+\u2013-]/g, "").replace(/\s+/g, " ").trim().slice(0, 90) || "Report").replace(/\.pdf$/i, "") + ".pdf";
  const doc = '<html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#111827;margin:26px">' + html + "</body></html>";
  const pdf = Utilities.newBlob(doc, "text/html", "report.html").getAs("application/pdf").setName(name);
  return { ok: true, name: name, data: Utilities.base64Encode(pdf.getBytes()) };
}
function estSheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(EST_SHEET);
  if (!s && !create) return null;
  const fresh = !s;
  if (fresh) s = ss.insertSheet(EST_SHEET);
  // a new sheet has 26 columns (A to Z): room for every one
  if (s.getMaxColumns() < EST_COLS.length) s.insertColumnsAfter(s.getMaxColumns(), EST_COLS.length - s.getMaxColumns());
  if (fresh) {
    s.getRange(1, 1, 1, EST_COLS.length).setValues([EST_COLS]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange("A:C").setNumberFormat("@");
  }
  return s;
}
/** Every estimate on the tab by id; at (if given): each one's row number on the tab. */
function estRows_(s, at) {
  const out = {};
  if (!s || s.getLastRow() < 2) return out;
  const tz = Session.getScriptTimeZone();
  s.getRange(2, 1, s.getLastRow() - 1, EST_COLS.length).getValues().forEach(function (r, i) {
    const id = String(r[0] || "").trim();
    if (!id) return;
    r[2] = repDay_(r[2], tz);
    [3, 11, 18, 19, 24, 28].forEach(function (c) { if (r[c] instanceof Date) r[c] = r[c].toISOString(); });
    for (let c = 29; c < 32 && c < r.length; c++) r[c] = String(r[c] || "");
    out[id] = r;
    if (at) at[id] = i + 2;
  });
  return out;
}
/** Water damage or mold, from the estimate's tags in Housecall Pro (e.g. "Water Damage Cleanup", "Mold Remediation");
 *  "" when it has neither (or both). */
function estKind_(tags) {
  const has = function (re) { return tags.some(function (t) { return re.test(t); }); };
  const kinds = [has(/mou?ld/i) ? "mold" : "", has(/water|flood/i) ? "water" : "", has(/fire|smoke|soot/i) ? "fire" : ""].filter(Boolean);
  return kinds.length === 1 ? kinds[0] : "";   // two kinds of tag: not sorted (counted once)
}
/** The estimate's whole address, the way it's written on a calendar: "445 M St NW Unit 2 Washington, DC 20001". */
function estAddress_(a) {
  a = a || {};
  const t = function (v) { return String(v || "").replace(/\s+/g, " ").trim(); };
  const line = [t(a.street), t(a.street_line_2), t(a.city)].filter(Boolean).join(" "), stz = [t(a.state), t(a.zip)].filter(Boolean).join(" ");
  return [line, stz].filter(Boolean).join(", ").slice(0, 200);
}
/** The client's phone: mobile, else home, else work; "(843) 267-7909". */
function estPhone_(cu) {
  cu = cu || {};
  const raw = String(cu.mobile_number || cu.home_number || cu.work_number || "").trim();
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
  return d.length === 10 ? "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) : raw.slice(0, 30);
}
/** When an estimate was scheduled for in Housecall Pro (its Schedule: the visit), or "" when it has none: the
 *  estimate's own schedule, else the first of its options'. */
function estSched_(e) {
  const ok = function (v) { return v && !isNaN(Date.parse(v)) ? String(v) : ""; };
  const own = ok(e && e.schedule && e.schedule.scheduled_start);
  if (own) return own;
  return (Array.isArray(e && e.options) ? e.options : []).map(function (o) { return ok(o && o.schedule && o.schedule.scheduled_start); }).filter(Boolean).sort()[0] || "";
}
/** An estimate from Housecall Pro as a row (what was typed in the app for it kept). Its day: the day it was scheduled
 *  for (the visit), else the day it was made. */
function estRow_(e, old, tz, at) {
  const opts = Array.isArray(e.options) ? e.options : [];
  const stOf = function (o) { const v = String((o && (o.approval_status || o.status)) || "").toLowerCase(); return /approv/.test(v) ? "approved" : /declin|reject/.test(v) ? "declined" : ""; };
  const appr = opts.filter(function (o) { return stOf(o) === "approved"; }), decl = opts.filter(function (o) { return stOf(o) === "declined"; });
  const ws = String(e.work_status || "");
  const status = appr.length ? "approved" : /cancel/i.test(ws) ? "canceled" : opts.length && decl.length === opts.length ? "declined" : /copied|convert/i.test(ws) ? "approved" : "open";
  const deciders = status === "approved" ? appr : status === "declined" ? decl : [];
  const by = deciders.length ? (/^\s*pro\b/i.test(String(deciders[0].approval_status || "")) ? "office" : "client") : "";   // "pro approved": the office
  const decided = deciders.map(function (o) { return String(o.approval_status_updated_at || ""); }).filter(Boolean).sort().pop() || "";
  const cents = function (v) { return Math.round(Number(v) || 0); };
  const total = opts.length ? Math.max.apply(null, opts.map(function (o) { return cents(o.total_amount); })) : cents(e.total_amount);
  const approved = appr.reduce(function (n, o) { return n + cents(o.total_amount); }, 0) || (status === "approved" ? total : 0);
  const ef = e.estimate_fields && typeof e.estimate_fields === "object" ? e.estimate_fields : {}, jf = e.job_fields && typeof e.job_fields === "object" ? e.job_fields : {};
  const jt = ef.job_type || jf.job_type || null, type = String((jt && typeof jt === "object" ? jt.name : jt) || "").trim();
  const bu = ef.business_unit || jf.business_unit || null, unit = String((bu && typeof bu === "object" ? bu.name : bu) || "").trim();
  const names = opts.map(function (o) { return String(o.name || ""); }).join(" · ");
  const notes = [].concat(Array.isArray(e.notes) ? e.notes : [], ...opts.map(function (o) { return Array.isArray(o.notes) ? o.notes : []; }))
    .map(function (n) { return String((n && n.content) || n || ""); }).join(" ");
  // its tags (the estimate's and each option's), once each
  const tagList = [].concat(Array.isArray(e.tags) ? e.tags : [], ...opts.map(function (o) { return Array.isArray(o.tags) ? o.tags : []; }))
    .map(function (t) { return String((typeof t === "object" && t ? t.name : t) || "").trim(); }).filter(function (t, i, a) { return t && a.indexOf(t) === i; });
  const text = [String(e.description || ""), opts.map(function (o) { return String(o.message_from_pro || ""); }).join(" "), notes].join(" ").replace(/\s+/g, " ").trim().slice(0, 600);
  const kind = estKind_(tagList);
  let dept = revDept_(type) !== "o" ? revDept_(type) : revDept_(unit);   // no job type: its business unit
  if (dept === "o" && kind) dept = "r";   // a Water, Mold or Fire/Smoke tag: Restoration
  const sched = estSched_(e), when = new Date(sched || e.created_at || ""), day = isNaN(when.getTime()) ? "" : Utilities.formatDate(when, tz, "yyyy-MM-dd");
  const emps = (Array.isArray(e.assigned_employees) ? e.assigned_employees : []).map(function (x) { return [x.first_name, x.last_name].filter(Boolean).join(" "); }).filter(Boolean).join(", ");
  const a = e.address || {};
  const row = [String(e.id), String(e.estimate_number || ""), day, String(e.created_at || ""), hcpClient_(e), [a.street, a.city].filter(Boolean).join(", ").slice(0, 120), dept,
    dept === "r" ? kind : "", type, status, by, decided, total / 100, approved / 100,
    JSON.stringify(opts.map(function (o) { return [String(o.name || "").slice(0, 60), cents(o.total_amount), stOf(o), String(o.status || "").slice(0, 40), String(o.id || "").slice(0, 80)]; })), ws, emps, hcpLead_(e), String(e.updated_at || ""), at,
    "", "", "", "", "", text, tagList.join(", "), opts.map(function (o) { return String(o.status || ""); }).filter(Boolean).join(", "), sched,
    estAddress_(a), String(a.state || "").trim().slice(0, 20), estPhone_(e.customer)];
  return row;
}
/** Who's in charge of an estimate: of the people assigned to it in Housecall Pro, the one with the highest role in
 *  Employees (Supervisor, Estimator, tech 3, 2, 1, Assistant; anyone else last); of equals, the first assigned. */
const EST_RANK = { supervisor: 7, estimator: 6, clean3: 5, rest3: 5, clean2: 4, rest2: 4, clean1: 3, rest1: 3, assistant: 2 };
const estNorm_ = function (v) { return String(v || "").toLowerCase().replace(/[^a-z' -]/g, "").replace(/\s+/g, " ").trim(); };
/** Someone in Employees by his Housecall Pro name: the whole name (or a former name), else the first name when only
 *  one person has it. */
function estPerson_(name, roster) {
  const n = estNorm_(name), first = n.split(" ")[0];
  const names = function (p) { return [p.name].concat(p.aka || []).map(estNorm_); };
  const whole = roster.filter(function (p) { return names(p).indexOf(n) !== -1; });
  if (whole.length) return whole[0];
  const byFirst = roster.filter(function (p) { return names(p).some(function (x) { return x.split(" ")[0] === first; }); });
  return byFirst.length === 1 ? byFirst[0] : null;
}
/** Everyone in Employees (on the leaderboard or not). */
function estRoster_() {
  const s = SpreadsheetApp.getActive().getSheetByName(LB_SHEET), keys = lbKeys_(s);
  const want = (keys || []).filter(function (k) { return k.key === "config"; });
  if (!want.length) return [];
  const cfg = lbConfig_(lbParse_(lbRowsAt_(s, want)[0].json));
  return (cfg.teams || []).concat(cfg.reviewers || []);
}
function estLead_(emps, roster) {
  let best = null;
  String(emps || "").split(", ").filter(Boolean).forEach(function (n) {
    const p = estPerson_(n, roster), r = p ? (EST_RANK[p.role] || 1) : 0;
    if (!best || r > best.rank) best = { name: n, role: p && p.role ? p.role : "", rank: r };
  });
  return best;
}
/** Is the signed-in person this Housecall Pro name? His whole name, or his first name when the app has only that. */
function estIsMe_(user, name) {
  const u = estNorm_(user && user.name), n = estNorm_(name);
  return !!u && !!n && (u === n || (u.indexOf(" ") === -1 && n.split(" ")[0] === u));
}
/** An estimate as the app gets it (inc: who's in charge). */
function estOut_(r, lead) {
  let opts = [];
  try { opts = JSON.parse(String(r[14] || "[]")); } catch (e) { opts = []; }
  const tagKind = r[26] ? estKind_(String(r[26]).split(", ")) : "";
  const sb = estSentBy_(r);
  const dept = String(r[6]) === "o" && tagKind ? "r" : String(r[6] || "o"), kind = dept === "r" ? (r[26] ? tagKind : String(r[7] || "")) : "";
  return { id: String(r[0]), n: String(r[1] || ""), day: String(r[2] || ""), client: String(r[4] || ""), addr: String(r[5] || ""), dept: dept,
    kind: kind, type: String(r[8] || ""), st: String(r[9] || "open"), by: String(r[10] || ""), dec: String(r[11] || ""),
    est: Math.round((Number(r[12]) || 0) * 100), appr: Math.round((Number(r[13]) || 0) * 100), opts: opts, ws: String(r[15] || ""), emps: String(r[16] || ""), lead: String(r[17] || ""),
    inc: lead ? lead.name : "", incRole: lead ? lead.role : "", tags: String(r[26] || ""), hcpSt: String(r[27] || ""),
    // sent: decided, or Housecall Pro tried to send it (a failed email counts: the office sends from its own email), or
    // it's in a stage of your own in the Pipeline (Rebuild estimates, On hold…), which it moves to once it's sent
    sent: String(r[9]) !== "open" || estSentSt_(r[27]) || !!sb, sentBy: sb };
}

/* ---- Estimates: once sent, always sent. Housecall Pro's API gives an estimate's options one status, the last thing
   that happened to them: "sent" when it's sent, but "complete rated" once the client rates the visit afterwards, so a
   sent estimate went back to Not sent. The first time the app reads one as sent (still open), it's written on the
   "Estimate sent" tab, and it stays sent whatever Housecall Pro says later. One sent before this (and since rated):
   sending it again from Housecall Pro makes it sent here, or an Admin marks it sent in the app (Marked by). ---- */
const EST_SENT_TAB = "Estimate sent", EST_SENT_COLS = ["At", "Estimate id", "Number", "Status then", "Marked by"];
let EST_SENT_ = null;
/** { id: { at: when the app first read it as sent (or it was marked), by: the Admin who marked it, else "" } }, read
 *  once a request. */
function estSentMap_() {
  if (EST_SENT_) return EST_SENT_;
  const out = {};
  let first = "";
  pcRows_(EST_SENT_TAB, EST_SENT_COLS.length).forEach(function (r) {
    const id = String(r[1] || ""), at = r[0] instanceof Date ? r[0].toISOString() : String(r[0] || "");
    if (id && !out[id]) out[id] = { at: at, by: String(r[4] || "") };
    if (at && (!first || at < first)) first = at;
  });
  EST_SENT_FROM_ = first ? Utilities.formatDate(new Date(first), Session.getScriptTimeZone(), "yyyy-MM-dd") : "";
  return (EST_SENT_ = out);
}
let EST_SENT_FROM_ = "";
/** The day the app started keeping "sent" (the estimates read as sent that day were sent before it, on their own day). */
function estSentFrom_() { estSentMap_(); return EST_SENT_FROM_; }
/** Read as sent before: { how: "seen", at } (the first time), { how: "marked", at, by } (an Admin), or null. */
function estSentBy_(r) {
  const x = estSentMap_()[String(r[0])];
  return !x ? null : x.by ? { how: "marked", at: x.at, by: x.by } : { how: "seen", at: x.at };
}
/** Admins: an open estimate the app reads as not sent, marked sent (sent before the app kept "sent", and Housecall Pro
 *  shows something else now): on the Estimate sent tab with who marked it; sent from then on. { sentBy } */
function estMarkSent_(req, user) {
  const id = String(req.id || "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return { ok: false, error: "bad_request" };
  const r = estRows_(estSheet_(false))[id];
  if (!r) return { ok: false, error: "not_found" };
  if (String(r[9] || "open") !== "open") return { ok: false, error: "not_open" };
  const was = estSentBy_(r);
  if (was) return { ok: true, sentBy: was };   // sent already (two Admins at once): as it is
  const at = tmNow_().toISOString(), s = pcSheet_(EST_SENT_TAB, EST_SENT_COLS), first = Math.max(2, s.getLastRow() + 1);
  if (s.getMaxRows() < first) s.insertRowsAfter(s.getMaxRows(), 100);
  s.getRange(first, 1, 1, EST_SENT_COLS.length).setNumberFormat("@").setValues([[at, id, String(r[1] || ""), String(r[27] || "").slice(0, 80), String(user.name || "Admin").slice(0, 60)]]);
  EST_SENT_ = null;
  return { ok: true, sentBy: { how: "marked", at: at, by: String(user.name || "Admin").slice(0, 60) } };
}
/** Every open estimate read as sent now that isn't on the tab yet goes on it (rows: the Estimates tab, by id). */
function estSentKeep_(rows, at) {
  const M = estSentMap_(), add = [];
  Object.keys(rows).forEach(function (id) {
    const r = rows[id];
    if (!M[id] && String(r[9] || "open") === "open" && estSentSt_(r[27])) add.push([at, id, String(r[1] || ""), String(r[27] || "").slice(0, 80), ""]);
  });
  if (!add.length) return 0;
  const s = pcSheet_(EST_SENT_TAB, EST_SENT_COLS), first = Math.max(2, s.getLastRow() + 1);
  if (s.getMaxRows() < first + add.length - 1) s.insertRowsAfter(s.getMaxRows(), first + add.length + 100 - s.getMaxRows());
  s.getRange(first, 1, add.length, EST_SENT_COLS.length).setNumberFormat("@").setValues(add);
  EST_SENT_ = null;
  return add.length;
}

/** Admins (Settings › Housecall Pro, "For Claude"): what Housecall Pro sends for one estimate, by its number, to find
 *  where it keeps things the app needs (like "sent"). Field names everywhere; values only for status-like fields, times,
 *  numbers and ids; never the customer, the address, names, notes or descriptions. */
function estProbe_(req) {
  const n = String(req.n || "").replace(/^#/, "").trim();
  if (!/^[A-Za-z0-9-]{1,20}$/.test(n)) return { ok: false, error: "bad_request" };
  const rows = estRows_(estSheet_(false));
  const id = Object.keys(rows).filter(function (k) { return String(rows[k][1]) === n || String(rows[k][1]).split("-")[0] === n; })[0];
  if (!id) return { ok: false, error: "not_found" };
  const r = hcpGet_("/estimates/" + encodeURIComponent(id));
  if (r.error) return { ok: false, error: r.error, status: r.status || 0 };
  const e = (r.data && (r.data.estimate || r.data)) || {};
  const SHOW = /status|stage|state|sent|pipeline|approv|work|schedul|_at$|^id$|_id$|number|total|amount|count|kind|type|archived|copied|deleted|viewed|signed|expir/i;
  const HIDE = /^(customer|address|addresses|notes|line_items|attachments|description|message_from_pro|first_name|last_name|name|email|company|mobile_number|home_number|work_number|street|street_line_2|city|state|zip|country|lead_source|assigned_employees)$/i;
  const walk = function (v, depth, key) {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return depth > 3 ? "[" + v.length + "]" : v.slice(0, 6).map(function (x) { return walk(x, depth + 1, key); });
    if (typeof v === "object") {
      const o = {};
      Object.keys(v).slice(0, 60).forEach(function (k) {
        if (HIDE.test(k)) { o[k] = Array.isArray(v[k]) ? "[" + v[k].length + "]" : v[k] && typeof v[k] === "object" ? "{…}" : v[k] === null ? null : "…"; return; }
        o[k] = depth > 3 ? "…" : walk(v[k], depth + 1, k);
      });
      return o;
    }
    return SHOW.test(String(key || "")) || typeof v === "boolean" ? (typeof v === "string" ? v.slice(0, 80) : v) : "…";
  };
  // Housecall Pro's estimate stages (the company's own names), all pages
  const stages = [];
  let stagesErr = "";
  for (let p = 1; p <= 5; p++) {
    const g = hcpGet_("/pipeline/statuses", { resource_type: "estimate", page: p, page_size: 50 });
    if (g.error) { stagesErr = g.error + " " + (g.status || ""); break; }
    const d = g.data || {};
    (d.statuses || []).forEach(function (x) { stages.push({ id: x.id, name: String(x.name || "").slice(0, 60), type: String(x.status_type || "") }); });
    if (!d.total_pages || p >= d.total_pages) break;
  }
  // can the estimates list be narrowed to one stage? Try a few names for it: one that changes the count works
  const count = function (g) { return g.error ? "error " + (g.status || g.error) : g.data && g.data.total_items; };
  const all = count(hcpGet_("/estimates", { page_size: 1 }));
  const probeSt = stages.filter(function (x) { return x.type === "estimate_sent"; })[0] || stages[0];
  const PARAMS = ["pipeline_status_id", "pipeline_status_ids[]", "pipeline_status_ids", "pipeline_status", "status_id", "kanban_status_id"];
  const tried = {};
  let works = "";
  if (probeSt) {
    const got = hcpGetAll_(PARAMS.map(function (k) { const q = { page_size: 1 }; q[k] = probeSt.id; return { path: "/estimates", query: q }; }));
    PARAMS.forEach(function (k, i) { tried[k] = count(got[i]); if (!works && typeof tried[k] === "number" && tried[k] !== all) works = k; });
  }
  // if one works: how many estimates each stage holds, and which stage this estimate is in
  let inStage = null;
  if (works) {
    const per = hcpGetAll_(stages.map(function (x) { const q = { page_size: 100 }; q[works] = x.id; if (e.customer && e.customer.id) q.customer_id = e.customer.id; return { path: "/estimates", query: q }; }));
    const tot = hcpGetAll_(stages.map(function (x) { const q = { page_size: 1 }; q[works] = x.id; return { path: "/estimates", query: q }; }));
    stages.forEach(function (x, i) {
      x.estimates = count(tot[i]);
      const arr = (per[i].data && per[i].data.estimates) || [];
      if (arr.some(function (y) { return y && y.id === id; })) { x.thisOne = true; inStage = x.name; }
    });
  }
  // other places Housecall Pro might answer one estimate's stage (each just says what came back)
  const other = {};
  [["/estimates/" + id + "/pipeline_status", {}], ["/estimates/" + id + "/pipeline", {}], ["/pipeline/status", { resource_type: "estimate", resource_id: id }],
   ["/pipeline/statuses", { resource_type: "estimate", resource_id: id }]].forEach(function (t) {
    const g = hcpGet_(t[0], t[1]);
    const label = t[0].replace(id, "{id}") + (Object.keys(t[1]).length ? "?" + Object.keys(t[1]).join("&") : "");
    other[label] = g.error ? "error " + (g.status || g.error) : JSON.stringify(g.data).replace(/"(first_name|last_name|email|mobile_number|street|city|zip)":"[^"]*"/g, '"$1":"…"').slice(0, 300);
  });
  return { ok: true, n: n, id: id, stored: { status: String(rows[id][9] || ""), hcpSt: String(rows[id][27] || ""), work: String(rows[id][15] || ""), readAt: String(rows[id][19] || "") },
    estimate: walk(e, 0, ""),
    pipeline: { stagesError: stagesErr || undefined, allCount: all, filterTried: tried, filterThatWorks: works || "none", thisOneIsIn: inStage, stages: stages, other: other } };
}
/** Before it's sent, in Housecall Pro's own stages: Unscheduled, Scheduled, In progress (On my way), Completed (finished). */
const EST_PRESEND = /^(unscheduled|needs scheduling|scheduled|in progress|on my way|completed?|complete (un)?rated|finished)$/i;
/** Housecall Pro's status for an estimate's options ("Sent, Completed") says it was sent: Sent or a failed send, or a
 *  stage of your own. */
function estSentSt_(st) {
  return String(st || "").split(/\s*,\s*/).map(function (x) { return x.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(); }).filter(Boolean)
    .some(function (x) { return /sen[dt]|submit|fail/i.test(x) || !EST_PRESEND.test(x); });
}
/** A year's estimates (by the day each was scheduled for, else created): all of them for an admin or someone who sees them all, else
 *  every one he's assigned to in Housecall Pro (his whole part: a supervisor's tile on Estimates), whoever's in charge;
 *  and whether the first read from Housecall Pro is done. */
function estRead_(year, user) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : String(new Date().getFullYear());
  const rows = estRows_(estSheet_(false)), all = estAll_(user), years = {}, roster = estRoster_();
  const list = [];
  Object.keys(rows).forEach(function (id) {
    const r = rows[id];
    if (r[2]) years[r[2].slice(0, 4)] = true;
    if (String(r[2]).indexOf(y + "-") !== 0) return;
    const lead = estLead_(r[16], roster);
    if (!all && !String(r[16] || "").split(", ").some(function (n) { return estIsMe_(user, n); })) return;
    list.push(estOut_(r, lead));
  });
  const P = PropertiesService.getScriptProperties();
  estCallsOn_(list);
  return { ok: true, year: Number(y), estimates: list, years: Object.keys(years).map(Number).sort(), all: all, me: String(user.name || ""), reports: all ? estReports_() : {}, readAt: Number(P.getProperty(EST_AT)) || 0,
    done: P.getProperty(EST_DONE) === "yes" && P.getProperty(EST_SCHEMA) === EST_V, connected: !!hcpKey_(), sentFrom: estSentFrom_(), callDays: estCallDays_() };
}

/* ---- Estimates › Today's calls: whoever's in charge of an estimate calls the client after it's sent, on the call days
   (1, 2, 3, 7 and 14 days after, an admin can change them), and on the day a call back was asked for. Each call is a row
   on the "Estimate calls" tab (the same one Office › Estimates marks), in order: No answer, Voicemail, Spoke with (the
   client, the property manager, the adjuster or someone else; a note; a day to call again), Call back (a day, a note),
   Booked, Don't call again; a "clear" takes back that day's last one. ---- */
const EST_CALL_RESULTS = { nr: "No answer", vm: "Voicemail", sw: "Spoke with", cb: "Call back", booked: "Booked", dnc: "Don't call again", clear: "" };
const EST_CALL_WHO = { client: "Client", pm: "Property manager", adjuster: "Adjuster", other: "Someone else" };
const EST_CALL_DAYS = "EST_CALL_DAYS", EST_CALL_DAYS_DEF = [1, 2, 3, 7, 14];
function estCallDays_() {
  let v = null;
  try { v = JSON.parse(PropertiesService.getScriptProperties().getProperty(EST_CALL_DAYS) || "null"); } catch (e) { v = null; }
  return Array.isArray(v) && v.length ? v : EST_CALL_DAYS_DEF.slice();
}
function estCallDaysPut_(req) {
  const d = Array.isArray(req.days) ? req.days.map(Number) : [];
  if (!d.length || d.length > 8 || d.some(function (n) { return !Number.isInteger(n) || n < 1 || n > 90; })) return { ok: false, error: "bad_value" };
  const out = d.filter(function (n, i) { return d.indexOf(n) === i; }).sort(function (a, b) { return a - b; });
  PropertiesService.getScriptProperties().setProperty(EST_CALL_DAYS, JSON.stringify(out));
  return { ok: true, days: out };
}
/** Every estimate's calls, in order: { id: [{ d: day, r, w: who called, cb, n: note, s: spoke with, at }] }. */
function estCallsAll_() {
  const tz = Session.getScriptTimeZone(), out = {};
  pcRows_(OF_EST_CALLS, OF_EST_CALL_COLS.length).forEach(function (r) {
    const id = String(r[2] || "");
    if (!id) return;
    const m = { d: pcDay_(r[1], tz), r: String(r[3] || ""), w: String(r[4] || ""), at: r[0] instanceof Date ? r[0].toISOString() : String(r[0] || "") };
    if (r[5]) m.cb = pcDay_(r[5], tz);
    if (r[6]) m.n = String(r[6]);
    if (r[7]) m.s = String(r[7]);
    (out[id] || (out[id] = [])).push(m);
  });
  return out;
}
/** The open estimates get their calls (the last 20). */
function estCallsOn_(list) {
  const C = estCallsAll_();
  (list || []).forEach(function (e) { if (e.st === "open" && C[e.id]) e.calls = C[e.id].slice(-20); });
}
/** A call on an estimate: whoever's in charge of it (on it in Housecall Pro), or someone who sees them all. */
function estCall_(req, user) {
  const id = String(req.id || ""), r = String(req.r || "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !Object.prototype.hasOwnProperty.call(EST_CALL_RESULTS, r)) return { ok: false, error: "bad_request" };
  const row = estRows_(estSheet_(false))[id];
  if (!row) return { ok: false, error: "not_found" };
  if (!estAll_(user) && !String(row[16] || "").split(", ").some(function (n) { return estIsMe_(user, n); })) return { ok: false, error: "not_allowed" };
  const tz = Session.getScriptTimeZone(), when = tmNow_(), at = when.toISOString(), today = Utilities.formatDate(when, tz, "yyyy-MM-dd");
  if (r === "clear") {
    // takes back the last call, if it was made today (an admin: any day)
    const left = [];
    (estCallsAll_()[id] || []).forEach(function (m) { if (m.r) left.push(m); else left.pop(); });
    const last = left[left.length - 1];
    if (!last) return { ok: false, error: "gone" };
    if (last.d !== today && user.role !== "admin") return { ok: false, error: "locked" };
  }
  const cb = r === "cb" || r === "sw" ? String(req.cb || "") : "";
  if ((r === "cb" || cb) && (!/^\d{4}-\d{2}-\d{2}$/.test(cb) || cb <= today || cb > tmAddDays_(today, 366))) return { ok: false, error: "bad_value", field: "cb" };
  const sw = r === "sw" ? String(req.sw || "") : "";
  if (r === "sw" && !Object.prototype.hasOwnProperty.call(EST_CALL_WHO, sw)) return { ok: false, error: "bad_value", field: "sw" };
  const note = r === "cb" || r === "sw" ? String(req.note || "").replace(/\s+/g, " ").trim().slice(0, 140) : "";
  const s = pcSheet_(OF_EST_CALLS, OF_EST_CALL_COLS), first = Math.max(2, s.getLastRow() + 1);
  if (s.getMaxRows() < first) s.insertRowsAfter(s.getMaxRows(), 200);
  s.getRange(first, 1, 1, OF_EST_CALL_COLS.length).setNumberFormat("@").setValues([[at, today, id, r === "clear" ? "" : r, user.name, cb, note, sw]]);
  return { ok: true, calls: (estCallsAll_()[id] || []).slice(-20) };
}
/** Office › Estimates: a year's estimates of one department (Cleaning), every one of them, as on Estimates (who's in
 *  charge from Employees), and which years have any of it. */
function estReadDept_(year, dept) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : String(new Date().getFullYear());
  const rows = estRows_(estSheet_(false)), years = {}, roster = estRoster_(), list = [];
  Object.keys(rows).forEach(function (id) {
    const r = rows[id], e = estOut_(r, null);
    if (e.dept !== dept) return;
    if (r[2]) years[r[2].slice(0, 4)] = true;
    if (String(r[2]).indexOf(y + "-") !== 0) return;
    const lead = estLead_(r[16], roster);
    list.push(estOut_(r, lead));
  });
  const P = PropertiesService.getScriptProperties();
  return { ok: true, year: Number(y), dept: dept, estimates: list, years: Object.keys(years).map(Number).sort(), readAt: Number(P.getProperty(EST_AT)) || 0,
    done: P.getProperty(EST_DONE) === "yes" && P.getProperty(EST_SCHEMA) === EST_V, connected: !!hcpKey_() };
}
/** Estimates › Reports: who's in charge of each department's report (a name), and the people with him (supervisors):
 *  { p: { lead, team: [names] }, c: …, r: … }, kept in the script's settings. */
function estReports_() {
  let v = {};
  try { v = JSON.parse(PropertiesService.getScriptProperties().getProperty("EST_REPORTS") || "{}"); } catch (e) { v = {}; }
  const out = {};
  ["r", "c", "p"].forEach(function (d) {
    const x = v && v[d] && typeof v[d] === "object" ? v[d] : {};
    const name = function (n) { return String(n || "").replace(/[^\p{L}\p{N} .'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40); };
    const team = (Array.isArray(x.team) ? x.team : []).map(name).filter(function (n, i, a) { return n && a.indexOf(n) === i; }).slice(0, 40);
    // the ones with a tile on Estimates (everyone under With is in the report either way)
    const tiles = (Array.isArray(x.tiles) ? x.tiles : []).map(name).filter(function (n, i, a) { return n && a.indexOf(n) === i && team.indexOf(n) !== -1; });
    if (name(x.lead) || team.length) out[d] = { lead: name(x.lead), team: team, tiles: tiles };
  });
  return out;
}
function estReportsPut_(req) {
  const P = PropertiesService.getScriptProperties();
  let v = {};
  try { v = JSON.parse(P.getProperty("EST_REPORTS") || "{}"); } catch (e) { v = {}; }
  if (["r", "c", "p"].indexOf(String(req.dept)) === -1) return { ok: false, error: "bad_request" };
  const was = v[req.dept] && typeof v[req.dept] === "object" ? v[req.dept] : {};
  v[req.dept] = { lead: String(req.lead || ""), team: Array.isArray(req.team) ? req.team.map(String).slice(0, 40) : [],
    tiles: Array.isArray(req.tiles) ? req.tiles.map(String).slice(0, 40) : Array.isArray(was.tiles) ? was.tiles : [] };   // an older app sends no tiles: kept
  if (JSON.stringify(v).length > 8800) return { ok: false, error: "too_big" };
  P.setProperty("EST_REPORTS", JSON.stringify(v));
  return { ok: true, reports: estReports_() };
}
/** Reads estimates from Housecall Pro into the tab, EST_PAGES pages a call from req.page ({ next } is the page to ask
 *  for next, 0 when done; { by } goes back as sort). The first time (or full): newest first by the day created, every
 *  estimate Housecall Pro has. After that: the ones changed since the last read (a quarter hour's overlap), the most
 *  recently changed first; if Housecall Pro doesn't sort them that way, every estimate created in the last 120 days. */
function estSync_(req, user) {
  const P = PropertiesService.getScriptProperties(), tz = Session.getScriptTimeZone(), now = Date.now();
  if (!hcpKey_()) return { ok: false, error: "no_key" };
  const backfill = P.getProperty(EST_DONE) !== "yes" || P.getProperty(EST_SCHEMA) !== EST_V || req.full === true;
  const dayOf = function (v) { const d = new Date(v || 0); return isNaN(d.getTime()) ? "" : Utilities.formatDate(d, tz, "yyyy-MM-dd"); };
  const recent = dayOf(now - 120 * 864e5);
  const since = (Number(P.getProperty(EST_AT)) || 0) - 15 * 60e3;
  let by = backfill || req.sort === "created_at" ? "created_at" : "updated_at";   // (req.by is the signed-in person)
  let page = Math.max(1, Math.floor(Number(req.page) || 1)), next = 0;
  const got = [];
  for (let n = 0; n < EST_PAGES; n++, page++) {
    const r = hcpGet_("/estimates", { sort_by: by, sort_direction: "desc", page: page, page_size: 100 });
    if (r.error) return { ok: false, error: r.error, status: r.status || 0 };
    const list = Array.isArray(r.data && r.data.estimates) ? r.data.estimates : [];
    if (by === "updated_at" && page === 1 && !list.every(function (e, i) { return !i || (Date.parse(list[i - 1].updated_at) || 0) >= (Date.parse(e.updated_at) || 0); })) {
      by = "created_at"; page = 0; continue;   // not sorted by when they changed: the last 120 days instead
    }
    let older = false;
    for (let i = 0; i < list.length && !older; i++) {
      const e = list[i];
      older = by === "created_at" ? !backfill && dayOf(e.created_at) < recent : (Date.parse(e.updated_at) || 0) < since;
      if (!older) got.push(e);
    }
    next = older || !list.length || page >= (Number(r.data && r.data.total_pages) || 1) ? 0 : page + 1;
    if (!next) break;
  }
  // approving or sending an option in Housecall Pro doesn't always move the estimate's "changed" time, so a quick read
  // can miss it: on its last step, the estimates still open of the last EST_RECHECK_DAYS days are read again one by one
  // (the newest every time, the rest in turn), and the ones that changed are kept with the rest
  let rechecked = 0, had = null, hadAt = null, w0 = null;
  let cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  // (that check reads up to 60 estimates one by one, about 9 seconds: at most every 10 minutes, the 15-minute timer's
  // run included, not each time Estimates is opened)
  if (!backfill && !next && (!cache || req.recheck === true || !cache.get("EST_RECHECKED"))) {
    if (cache) { try { cache.put("EST_RECHECKED", "1", 600); w0 = cache.get("EST_W"); } catch (e) { /* every time then */ } }
    const seen = {};
    got.forEach(function (e) { if (e && e.id) seen[String(e.id)] = true; });
    const cut = dayOf(now - EST_RECHECK_DAYS * 864e5);
    hadAt = {}; had = estRows_(estSheet_(false), hadAt);
    const all = Object.keys(had).map(function (id) { return had[id]; })
      .filter(function (r) { return String(r[9] || "open") === "open" && String(r[2]) >= cut && !seen[String(r[0])]; })
      .sort(function (a, b) { return String(a[2]) < String(b[2]) ? 1 : String(a[2]) > String(b[2]) ? -1 : String(a[0]) < String(b[0]) ? 1 : -1; });
    const rest = all.slice(EST_RECHECK_NEW);
    let from = Number(P.getProperty(EST_RECHECK_AT)) || 0;
    if (from >= rest.length) from = 0;
    const turn = rest.slice(from, from + EST_RECHECK_TURN);
    if (turn.length < EST_RECHECK_TURN && from > 0) turn.push.apply(turn, rest.slice(0, Math.min(from, EST_RECHECK_TURN - turn.length)));   // round to the start
    if (rest.length) P.setProperty(EST_RECHECK_AT, String((from + EST_RECHECK_TURN) % rest.length));
    const open = all.slice(0, EST_RECHECK_NEW).concat(turn);
    hcpGetAll_(open.map(function (r) { return { path: "/estimates/" + encodeURIComponent(String(r[0])), query: {} }; })).forEach(function (a, i) {
      const e = a && !a.error && a.data ? (a.data.estimate || a.data) : null;
      if (!e || !e.id) return;
      rechecked++;
      const was = open[i], row = estRow_(e, was, tz, "");
      // what it is now: status, who decided and when, the amounts, its options, stage, people, tags, sent
      if ([9, 10, 11, 12, 13, 14, 15, 16, 26, 27].some(function (c) { return String(row[c]) !== String(was[c] == null ? "" : was[c]); })) got.push(e);
    });
  }
  return withLock_(function () {
    // only what changed is written: an estimate already on the tab in its own row, a new one added at the bottom; many
    // changed (Read all) or the first read finished: the whole tab, newest first
    // the tab as read for the check, unless something was written to it since (then read again)
    const s = estSheet_(true), reuse = had && cache && cache.get("EST_W") === w0, rowAt = reuse ? hadAt : {}, rows = reuse ? had : estRows_(s, rowAt), at = new Date(now).toISOString(), W = EST_COLS.length;
    const upd = {}, add = {};
    let changed = 0;
    got.forEach(function (e) {
      if (!e || !e.id) return;
      const id = String(e.id), row = estRow_(e, rows[id], tz, at);
      if (!row[2]) return;
      rows[id] = row; changed++;
      if (rowAt[id]) upd[id] = row; else add[id] = row;
    });
    const nUpd = Object.keys(upd).length, adds = Object.keys(add).map(function (id) { return add[id]; });
    if ((!next && backfill) || nUpd > 40) {
      const all = Object.keys(rows).map(function (id) { return rows[id]; })
        .sort(function (a, b) { return a[2] < b[2] ? 1 : a[2] > b[2] ? -1 : String(a[1]) < String(b[1]) ? 1 : -1; });
      if (all.length) {
        if (s.getMaxRows() < all.length + 1) s.insertRowsAfter(s.getMaxRows(), all.length + 101 - s.getMaxRows());
        s.getRange(2, 1, all.length, 3).setNumberFormat("@");
        s.getRange(2, 1, all.length, W).setValues(all);
      }
    } else {
      Object.keys(upd).forEach(function (id) { s.getRange(rowAt[id], 1, 1, W).setValues([upd[id]]); });
      if (adds.length) {
        const first = Math.max(2, s.getLastRow() + 1);
        if (s.getMaxRows() < first + adds.length - 1) s.insertRowsAfter(s.getMaxRows(), first + adds.length + 100 - s.getMaxRows());
        s.getRange(first, 1, adds.length, 3).setNumberFormat("@");
        s.getRange(first, 1, adds.length, W).setValues(adds);
        const all = s.getRange(2, 1, s.getLastRow() - 1, W);
        if (typeof all.sort === "function") all.sort([{ column: 3, ascending: false }, { column: 2, ascending: false }]);   // newest at the top again
      }
    }
    s.getRange(1, 1, 1, W).setValues([EST_COLS]).setFontWeight("bold");
    if (cache && changed) { try { cache.put("EST_W", String(now) + Math.random().toString(36).slice(2, 6), 21600); } catch (e) { /* read again next time */ } }
    estSentKeep_(rows, at);   // once read as sent, it stays sent (a client's rating afterwards changes Housecall Pro's status)
    if (!next) { if (backfill) { P.setProperty(EST_DONE, "yes"); P.setProperty(EST_SCHEMA, EST_V); } P.setProperty(EST_AT, String(now)); }
    return { ok: true, backfill: backfill, next: next, by: by, read: got.length, changed: changed, rechecked: rechecked, readAt: Number(P.getProperty(EST_AT)) || 0, done: P.getProperty(EST_DONE) === "yes" && P.getProperty(EST_SCHEMA) === EST_V };
  });
}
/* ---------------- Past clients to call (Office) ----------------
   The office calls past clients 6, 12, 18, 24 and 36 months after their last finished job (a finished job restarts the
   clock; an estimate doesn't). The day of a visit is its scheduled day (or the day it was finished). Left off the lists:
   a client with a job booked since their last one (scheduled, in progress or still to be scheduled); a "do not call" tag
   on the customer in Housecall Pro (or Housecall Pro's "do not service"); anyone marked "Don't call again" here.
   Commercial clients (a Commercial job type, or a commercial / property manager tag) are on the lists too, marked
   Commercial. A day that falls on a Sunday or a day the
   company is closed moves to the next working day. Each call is marked (No answer, Voicemail, Booked, Don't call again)
   with who and when. A client in a group whose day went by without a mark (since the lists started) stays in "Missed"
   until marked or the next group's day.
   Housecall Pro is read once (every job there is, newest first: the lists use the last 42 months, Commercial clients
   every year; a few pages a step: an admin's
   "Read from Housecall Pro"), then only what changed (jobs, then customers, by when they changed; when the lists are
   opened, at most every 15 minutes). It all stays in this Sheet: the "Past client jobs" and "Past clients" tabs, and
   the marks in "Past client calls". ---------------- */
const PC_JOBS = "Past client jobs", PC_CUST = "Past clients", PC_CALLS = "Past client calls";
const PC_JOB_COLS = ["Job id", "Customer id", "Invoice #", "Status", "Day", "Created", "Job type", "Address", "Changed", "Tags", "Amount (cents)"];
const PC_CUST_COLS = ["Customer id", "Name", "Phone", "Other phone", "Tags", "Company", "Do not service", "Changed", "Referred by"];
const PC_CALL_COLS = ["At", "Day", "Customer id", "Group", "Last service", "Result", "Who", "Call back on", "Note"];
const PC_GROUPS = [6, 12, 18, 24, 36], PC_BACK_MONTHS = 42, PC_PAGES = 15, PC_READ_PAGES = 5, PC_STALE = 15 * 60e3, PC_MISSED_MAX = 200;
const PC_ASSIGN = "PC_ASSIGN";   // who calls each group: { "6": [user ids], ... }; a group nobody has: Admins only
const PC_SCHEMA = "PC_SCHEMA", PC_V = "3";   // 2: the jobs' tags; 3: every year since the first and each job's amount (Commercial clients) (read all again once)
const PC_FROM = "2010-01-01";   // the first read (and all again) goes back to here: every job there is (the lists use the last 42 months)
const PC_DONE = "PC_BACKFILL_DONE", PC_AT = "PC_SYNC_AT", PC_START = "PC_START", PC_CUR = "PC_CURSOR", PC_SORTS = "PC_SORTS", PC_BUSY = "PC_BUSY";
const PC_RESULTS = { na: "Not now", vm: "Voicemail", booked: "Booked", dnc: "Don't call again", cb: "Call back", clear: "" };   // "na" was "No answer"
const PC_DNC = /do\s*n[o']?t\s*(call|contact|service)|\bdnc\b/i;   // "Do not call", "DNC" (not "No calls before 9")
const PC_COM = /commercial|property\s*manag/i;
// moved out of the area ("Moved to another state", "Out of state", "Left the area", "Moved away"); "Moved out" or
// "Move out" alone isn't: they may still be in the area
const PC_AWAY = /\bout\s*of\s*(the\s*)?(state|country|(service\s*)?area)\b|\b(an?other|other|different)\s*(state|country)\b|\bleft\s*the\s*(state|country|area)\b|\bmoved\s*away\b/i;

/** yyyy-MM-dd plus n months, on the same day of the month (or the month's last day: Aug 31 + 6 months is Feb 28). */
function pcAddMonths_(day, n) {
  const y = Number(day.slice(0, 4)), m = Number(day.slice(5, 7)) - 1 + n, d = Number(day.slice(8, 10));
  const Y = y + Math.floor(m / 12), M = ((m % 12) + 12) % 12;
  const end = new Date(Date.UTC(Y, M + 1, 0)).getUTCDate();
  return new Date(Date.UTC(Y, M, Math.min(d, end))).toISOString().slice(0, 10);
}
/** The day itself, or the next working day when it's a Sunday or a day the company is closed. */
function pcWorkDay_(day) {
  let d = day;
  for (let i = 0; i < 7 && (new Date(d + "T12:00:00Z").getUTCDay() === 0 || tmClosed_(d)); i++) d = tmAddDays_(d, 1);
  return d;
}
/** The day a client whose last finished job was on `last` is called for the n-month group. */
function pcDue_(last, n) { return pcWorkDay_(pcAddMonths_(last, n)); }
/** A cell as yyyy-MM-dd (a Sheet may have turned the text into a date), or "". */
function pcDay_(v, tz) {
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : Utilities.formatDate(v, tz, "yyyy-MM-dd");
  const s = String(v || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}
function pcPhone_(v) {
  const raw = String(v || "").trim();
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
  return d.length === 10 ? "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) : raw.slice(0, 30);
}
/** A job as the "Past client jobs" tab keeps it, or null (no customer). */
function pcJobRow_(job, tz) {
  const cu = (job && job.customer) || {};
  const cid = String(cu.id || job.customer_id || "");
  if (!job || !job.id || !cid) return null;
  const ws = String(job.work_status || "");
  const st = /^complete/i.test(ws) ? "done" : /cancel/i.test(ws) ? "canceled" : "open";
  const dayOf = function (v) { const d = new Date(v || ""); return v && !isNaN(d.getTime()) ? Utilities.formatDate(d, tz, "yyyy-MM-dd") : ""; };
  const sch = job.schedule && job.schedule.scheduled_start, fin = job.work_timestamps && job.work_timestamps.completed_at;
  const day = st === "done" ? dayOf(sch) || dayOf(fin) || dayOf(job.updated_at) : dayOf(sch);
  const a = job.address || {};
  const addr = [a.street, a.street_line_2, a.city].filter(Boolean).join(", ").replace(/\s+/g, " ").trim().slice(0, 120);
  const tags = Array.isArray(job.tags) ? job.tags.map(function (t) { return String((t && t.name) || t || "").trim(); }).filter(Boolean).join(", ").slice(0, 300) : "";
  return [String(job.id), cid, String(job.invoice_number || "").slice(0, 30), st, day, dayOf(job.created_at), hcpJobType_(job).slice(0, 80), addr, String(job.updated_at || "").slice(0, 40), tags,
    String(Math.round(Number(job.total_amount) || 0))];
}
/** A customer as the "Past clients" tab keeps one (what Housecall Pro didn't send stays as it was). */
function pcCustRow_(cu, old) {
  const ph = [cu.mobile_number, cu.home_number, cu.work_number].map(pcPhone_).filter(Boolean);
  const uniq = ph.filter(function (p, i) { return ph.indexOf(p) === i; });
  const name = [cu.first_name, cu.last_name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || String(cu.company || "").trim();
  const tags = Array.isArray(cu.tags) ? cu.tags.map(function (t) { return String((t && t.name) || t || "").trim(); }).filter(Boolean).join(", ").slice(0, 300) : old ? String(old[4] || "") : "";
  const dns = typeof cu.do_not_service === "boolean" ? (cu.do_not_service ? "yes" : "") : old ? String(old[6] || "") : "";
  // the referral partner from its tags ("Referral Client By Maple Ridge Realty, LLC"): Referral Partners
  const by = Array.isArray(cu.tags) ? rpOfTags_(cu.tags.map(function (t) { return String((t && t.name) || t || ""); })) : old ? String(old[8] || "") : "";
  return [String(cu.id), name.slice(0, 80), uniq[0] || "", uniq[1] || "", tags, String(cu.company || "").slice(0, 80), dns, String(cu.updated_at || "").slice(0, 40), by];
}
function pcSheet_(name, cols) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold");
    if (typeof s.setFrozenRows === "function") s.setFrozenRows(1);
  } else if (typeof s.getLastColumn === "function" && s.getLastColumn() < cols.length) s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold");   // a column added since
  return s;
}
function pcRows_(name, W) {
  const s = SpreadsheetApp.getActive().getSheetByName(name);
  const n = s ? s.getLastRow() - 1 : 0;
  return n > 0 ? s.getRange(2, 1, n, W).getValues() : [];
}
/** Each row in its own place on the tab (by the id in its first column), a new one at the bottom; all as text. */
function pcUpsert_(name, cols, rows, keep) {
  if (!rows.length) return 0;
  const s = pcSheet_(name, cols), W = cols.length, n = s.getLastRow() - 1;
  const old = n > 0 ? s.getRange(2, 1, n, W).getValues() : [], at = {};
  old.forEach(function (r, i) { at[String(r[0])] = i; });
  const changed = {}, add = [], seen = {};
  rows.forEach(function (row) {
    if (!row || seen[row[0]]) return;   // the first one of each (the newest read)
    seen[row[0]] = true;
    const i = at[row[0]];
    const next = keep ? keep(row, i === undefined ? null : old[i]) : row;
    if (i === undefined) { add.push(next); return; }
    if (next.some(function (v, k) { return String(v) !== String(old[i][k] instanceof Date ? pcDay_(old[i][k], Session.getScriptTimeZone()) : old[i][k]); })) { old[i] = next; changed[i] = true; }
  });
  const nChanged = Object.keys(changed).length;
  if (nChanged > 40) {
    const all = old.concat(add);
    if (s.getMaxRows() < all.length + 1) s.insertRowsAfter(s.getMaxRows(), all.length + 201 - s.getMaxRows());
    s.getRange(2, 1, all.length, W).setNumberFormat("@").setValues(all);
  } else {
    Object.keys(changed).forEach(function (i) { s.getRange(Number(i) + 2, 1, 1, W).setNumberFormat("@").setValues([old[i]]); });
    if (add.length) {
      const first = Math.max(2, s.getLastRow() + 1);
      if (s.getMaxRows() < first + add.length - 1) s.insertRowsAfter(s.getMaxRows(), first + add.length + 200 - s.getMaxRows());
      s.getRange(first, 1, add.length, W).setNumberFormat("@").setValues(add);
    }
  }
  return nChanged + add.length;
}
function pcSorted_(list, by) {
  for (let i = 1; i < list.length; i++) if ((Date.parse(list[i - 1][by]) || 0) < (Date.parse(list[i][by]) || 0)) return false;
  return true;
}
/** One step of reading Housecall Pro: the first read (every job created in the last 42 months, newest first) or, once
 *  that's done, what changed since the last read (jobs, then customers, by when they changed); `pages` pages at most.
 *  Where it got to is kept, so the next step goes on. { ok, done (the first read is finished), next (more to read),
 *  read, page, pages, at } */
function pcSync_(req, pages) {
  const P = PropertiesService.getScriptProperties(), tz = Session.getScriptTimeZone(), now = tmNow_().getTime();
  if (!hcpKey_()) return { ok: false, error: "no_key" };
  const done = P.getProperty(PC_DONE) === "yes";
  let cur = {};
  try { cur = JSON.parse(P.getProperty(PC_CUR) || "{}") || {}; } catch (e) { cur = {}; }
  // read it all again: the lists keep working meanwhile (from what's on the tabs)
  if (req.full === true) cur = { stage: "back", page: 1, by: "created_at", at: now, full: true };
  if (!cur.stage || (done && cur.stage === "back" && !cur.full) || (!done && cur.stage !== "back")) {
    cur = done ? { stage: "jobs", page: 1, by: "updated_at", at: now, since: (Number(P.getProperty(PC_AT)) || 0) - 15 * 60e3 } : { stage: "back", page: 1, by: "created_at", at: now };
  }
  let sorts = {};
  try { sorts = JSON.parse(P.getProperty(PC_SORTS) || "{}") || {}; } catch (e) { sorts = {}; }
  const today = Utilities.formatDate(new Date(now), tz, "yyyy-MM-dd");
  const cutoff = PC_FROM, recent = tmAddDays_(today, -60);   // (every year: Commercial clients look back to the first)
  const dayOf = function (v) { const d = new Date(v || ""); return v && !isNaN(d.getTime()) ? Utilities.formatDate(d, tz, "yyyy-MM-dd") : ""; };
  const jobs = [], custs = [];
  let n = 0, total = 0, backDone = false, passDone = false;
  while (n < pages && !backDone && !passDone) {
    const cust = cur.stage === "cust", key = cust ? "customers" : "jobs";
    const r = hcpGet_(cust ? "/customers" : "/jobs", { sort_by: cur.by, sort_direction: "desc", page: cur.page, page_size: HCP_PAGE });
    if (r.error) { P.setProperty(PC_CUR, JSON.stringify(cur)); return { ok: false, error: r.error, status: r.status || 0 }; }
    n++;
    const list = Array.isArray(r.data && r.data[key]) ? r.data[key] : [];
    total = Number(r.data && r.data.total_pages) || 1;
    if (cur.page === 1 && list.length > 1 && !pcSorted_(list, cur.by)) {
      // not sorted that way: the first read reads every page; what changed: jobs created in the last 60 days instead
      // (customers: not read; their tags still come with their jobs)
      if (cur.stage === "back") cur.unsorted = true;
      else if (!cust && cur.by === "updated_at") { cur.by = "created_at"; sorts.jobs = "created_at"; continue; }
      else { if (cust) sorts.cust = false; else sorts.jobs = "none"; list.length = 0; }
    } else if (cur.page === 1 && list.length > 1) { if (cust) sorts.cust = true; else if (cur.stage === "jobs") sorts.jobs = cur.by; else sorts.back = true; }
    let older = false;
    for (let i = 0; i < list.length && !older; i++) {
      const x = list[i] || {};
      if (cur.stage === "back") older = !cur.unsorted && dayOf(x.created_at) !== "" && dayOf(x.created_at) < cutoff;
      else if (cur.by === "created_at") older = dayOf(x.created_at) !== "" && dayOf(x.created_at) < recent;
      else older = (Date.parse(x.updated_at) || 0) < cur.since;
      if (older) break;
      if (cust) custs.push(x); else jobs.push(x);
    }
    const end = older || !list.length || cur.page >= total;
    if (!end) { cur.page++; continue; }
    if (cur.stage === "back") backDone = true;
    else if (cur.stage === "jobs") cur = { stage: "cust", page: 1, by: "updated_at", at: cur.at, since: cur.since };
    else passDone = true;
  }
  const out = withLock_(function () {
    const jr = [], cr = [];
    jobs.forEach(function (j) {
      const row = pcJobRow_(j, tz);
      if (!row) return;
      jr.push(row);
      if (j.customer && j.customer.id) cr.push(j.customer);
    });
    custs.forEach(function (c) { if (c && c.id) cr.push(c); });
    const wroteJobs = pcUpsert_(PC_JOBS, PC_JOB_COLS, jr);
    const wroteCust = pcUpsert_(PC_CUST, PC_CUST_COLS, cr.map(function (c) { return [String(c.id), c]; }), function (row, old) { return pcCustRow_(row[1], old); });
    return { jobs: wroteJobs, customers: wroteCust };
  });
  if (backDone) {
    P.setProperty(PC_DONE, "yes"); P.setProperty(PC_AT, String(cur.at)); P.deleteProperty(PC_CUR); P.setProperty(PC_SCHEMA, PC_V);
    if (!P.getProperty(PC_START)) P.setProperty(PC_START, today);
  } else if (passDone) { P.setProperty(PC_AT, String(cur.at)); P.deleteProperty(PC_CUR); }
  else P.setProperty(PC_CUR, JSON.stringify(cur));
  P.setProperty(PC_SORTS, JSON.stringify(sorts));
  return { ok: true, done: P.getProperty(PC_DONE) === "yes", full: !!cur.full && !backDone, next: !backDone && !passDone, read: jobs.length + custs.length, wrote: out,
    stage: cur.stage, page: cur.page, pages: total, at: Number(P.getProperty(PC_AT)) || 0, sorts: sorts };
}
/** Admin: a step of the first read (or all of it again: full), from the app's "Read from Housecall Pro". */
function pcSyncStep_(req) {
  const P = PropertiesService.getScriptProperties();
  const out = pcSync_(req, PC_PAGES);
  if (!out.ok) return out;
  out.start = P.getProperty(PC_START) || "";
  out.rows = { jobs: Math.max(0, pcCount_(PC_JOBS)), customers: Math.max(0, pcCount_(PC_CUST)) };
  return out;
}
function pcCount_(name) { const s = SpreadsheetApp.getActive().getSheetByName(name); return s ? s.getLastRow() - 1 : 0; }

/** What the tabs know: each client's jobs summed up (by: customer id → { last finished day, its type and address, jobs,
 *  first, com (a Commercial job type), open: [[day, created]] }), the customers (cust: id → row), the marks (key →
 *  latest) and who's marked Don't call again (never: id → that mark). */
function pcKnown_(tz) {
  const jr = pcRows_(PC_JOBS, PC_JOB_COLS.length), cr = pcRows_(PC_CUST, PC_CUST_COLS.length), mr = pcRows_(PC_CALLS, PC_CALL_COLS.length);
  const by = {};
  jr.forEach(function (r) {
    const c = String(r[1] || ""), st = String(r[3] || ""), d = pcDay_(r[4], tz), made = pcDay_(r[5], tz), type = String(r[6] || "");
    if (!c) return;
    const s = by[c] || (by[c] = { last: "", lastJob: "", lastInv: "", type: "", addr: "", jobs: 0, first: "", com: "", open: [], all: 0, tags: [] });
    s.all++;
    if (String(r[9] || "")) s.tags.push([d || made, String(r[9]), String(r[2] || "")]);
    if (PC_COM.test(type) && !s.com) s.com = type;
    if (st === "done" && d) {
      if (d > s.last || (d === s.last && !s.addr)) { s.last = d; s.lastJob = String(r[0] || ""); s.lastInv = String(r[2] || ""); s.type = type; s.addr = String(r[7] || ""); }
      if (!s.first || d < s.first) s.first = d;
      if (hcpFirstVisit_({ invoice_number: String(r[2] || "") })) s.jobs++;
    } else if (st === "open") s.open.push([d, made]);
  });
  const cust = {};
  cr.forEach(function (r) { cust[String(r[0])] = r; });
  const marks = {}, never = {};
  mr.forEach(function (r) {   // in the order made: the last one of each counts
    const k = String(r[2]) + "|" + Number(r[3]) + "|" + pcDay_(r[4], tz);
    marks[k] = { r: String(r[5] || ""), who: String(r[6] || ""), at: r[0] instanceof Date ? r[0].toISOString() : String(r[0] || "") };
    if (marks[k].r === "cb") { marks[k].cb = pcDay_(r[7], tz); marks[k].note = String(r[8] || ""); marks[k].day = pcDay_(r[1], tz); }
  });
  Object.keys(marks).forEach(function (k) { if (marks[k].r === "dnc") never[k.split("|")[0]] = marks[k]; });
  return { by: by, cust: cust, marks: marks, never: never };
}
/** A client's name as Housecall Pro shows it (the company when there is one: "Redfin"), and the person ("Amanda Maron"). */
function pcName_(cu) {
  const person = String(cu[1] || ""), co = String(cu[5] || "").trim();
  return co ? { name: co, contact: person && person !== co ? person : "" } : { name: person, contact: "" };
}
/** Why a client is left off the lists, or null: a job booked since their last one (booked), do not call (dnc: marked
 *  Don't call again here, a tag on the customer or on their last job, Housecall Pro's do not service), moved out of the
 *  area (away: a tag such as "Moved to another state"; not "Moved out"). Commercial clients aren't left off: they're
 *  called too (marked com on the list: pcCom_). */
function pcLeft_(c, s, cu, never) {
  const bk = s.open.filter(function (o) { return o[0] ? o[0] >= s.last : o[1] !== "" && o[1] >= s.last; });
  if (bk.length) return { why: "booked", day: bk.map(function (o) { return o[0]; }).filter(Boolean).sort()[0] || "" };
  if (never[c]) return { why: "dnc", who: never[c].who, at: never[c].at };
  const tags = String(cu[4] || "").split(/\s*,\s*/).filter(Boolean);
  // the tags on their last job and any since (an older job's tag may be out of date): [tag, job #]
  const jt = [];
  (s.tags || []).forEach(function (x) { if (x[0] && x[0] >= s.last) x[1].split(/\s*,\s*/).filter(Boolean).forEach(function (t) { jt.push([t, x[2]]); }); });
  const first = function (re) { const t = tags.filter(function (v) { return re.test(v); })[0]; if (t) return { tag: t }; const j = jt.filter(function (v) { return re.test(v[0]); })[0]; return j ? { tag: j[0], inv: j[1] } : null; };
  const dt = first(PC_DNC);
  if (dt) return Object.assign({ why: "dnc" }, dt);
  if (String(cu[6] || "") === "yes") return { why: "dnc", dns: true };
  const aw = first(PC_AWAY);
  return aw ? Object.assign({ why: "away" }, aw) : null;
}
/** A commercial client (a Commercial job type, or a commercial / property manager tag on the customer): on the lists,
 *  marked Commercial. */
function pcCom_(s, cu) {
  return !!s.com || String(cu[4] || "").split(/\s*,\s*/).some(function (t) { return PC_COM.test(t); });
}
/** Office › Estimates › Commercial clients: every commercial client (the last job done was a Commercial job type; an
 *  earlier Commercial job or a commercial / property manager tag isn't enough) with a job done before this year and
 *  nothing this year (no job done since January 1, none booked):
 *  who to win back, the last ones first. Left off: do not call (marked here, a tag, Housecall Pro's do not service) and
 *  moved away. From the Past clients tabs (read from Housecall Pro there). { ready, year, list: [{ id, name, contact,
 *  phone, phone2, addr, last, lastInv, lastJob, type, years, jobs, spent }], n: { com, back, dnc, away }, from, reread } */
function comClients_(user) {
  const P = PropertiesService.getScriptProperties(), tz = Session.getScriptTimeZone(), today = Utilities.formatDate(tmNow_(), tz, "yyyy-MM-dd");
  const year = today.slice(0, 4), y0 = year + "-01-01", admin = user.role === "admin";
  if (P.getProperty(PC_DONE) !== "yes") return { ok: true, ready: false, admin: admin, year: Number(year) };
  const K = pcKnown_(tz), jr = pcRows_(PC_JOBS, PC_JOB_COLS.length), ex = {};
  let from = "";
  jr.forEach(function (r) {   // each client's years with a job done, and what those jobs came to
    const c = String(r[1] || ""), d = pcDay_(r[4], tz);
    if (!c || String(r[3]) !== "done" || !d) return;
    const e = ex[c] || (ex[c] = { years: {}, spent: 0 });
    e.years[d.slice(0, 4)] = true; e.spent += Number(r[10]) || 0;
    if (!from || d < from) from = d;
  });
  const n = { com: 0, back: 0, dnc: 0, away: 0 }, list = [];
  Object.keys(K.by).forEach(function (c) {
    const s = K.by[c], cu = K.cust[c] || [];
    if (!s.last || !PC_COM.test(s.type)) return;   // the last job done: a Commercial job type
    n.com++;
    // this year: a job done since January 1, or one booked (on the schedule this year or later, or not scheduled yet)
    if (s.last >= y0 || s.open.some(function (o) { return o[0] ? o[0] >= y0 : o[1] >= y0 || !o[1]; })) { n.back++; return; }
    const left = pcLeft_(c, s, cu, K.never);
    if (left && left.why !== "booked") { n[left.why] = (n[left.why] || 0) + 1; return; }
    const nm = pcName_(cu), e = ex[c] || { years: {}, spent: 0 };
    list.push({ id: c, name: nm.name, contact: nm.contact, phone: String(cu[2] || ""), phone2: String(cu[3] || ""), addr: s.addr, last: s.last, lastInv: s.lastInv, lastJob: s.lastJob,
      type: s.type, years: Object.keys(e.years).sort().reverse().map(Number), jobs: s.jobs, spent: e.spent });
  });
  // the last ones first; then the ones with us the most years; then the most spent
  list.sort(function (a, b) { return a.last.slice(0, 4) < b.last.slice(0, 4) ? 1 : a.last.slice(0, 4) > b.last.slice(0, 4) ? -1 : b.years.length - a.years.length || b.spent - a.spent || (a.last < b.last ? 1 : -1); });
  return { ok: true, ready: true, admin: admin, year: Number(year), list: list, n: n, from: from, reread: P.getProperty(PC_SCHEMA) !== PC_V };
}
/** Who calls each group (Admins pick, under Past clients): { 6: [user ids], ... }, only the groups someone has. */
function pcAssign_() {
  let a = {};
  try { a = JSON.parse(PropertiesService.getScriptProperties().getProperty(PC_ASSIGN) || "{}") || {}; } catch (e) { a = {}; }
  const out = {};
  PC_GROUPS.forEach(function (g) { const ids = Array.isArray(a[g]) ? a[g].map(String).filter(Boolean) : []; if (ids.length) out[g] = ids; });
  return out;
}
/** The groups someone sees: Admins and Office (any day) all of them; anyone else only the ones they're picked for
 *  (none picked: no Past clients tab). */
function pcMine_(user, A) {
  if (ofEditor_(user)) return PC_GROUPS.slice();
  return PC_GROUPS.filter(function (g) { return !!A[g] && A[g].indexOf(String(user.id)) !== -1; });
}
/** For Admins: each group's people, with their names ({ 6: [{ id, name }] }). */
function pcAssignNames_(A) {
  const names = {};
  readUsers_(usersSheet_()).forEach(function (x) { names[x.u.id] = x.u.name; });
  const out = {};
  Object.keys(A).forEach(function (g) { out[g] = A[g].map(function (id) { return { id: id, name: names[id] || "(removed)" }; }); });
  return out;
}
/** Admins: who calls each group ({ assign: { 6: [user ids], ... } }; an empty list: everyone). Only active people. */
function pcSetAssign_(req) {
  const a = req.assign && typeof req.assign === "object" ? req.assign : null;
  if (!a) return { ok: false, error: "bad_request" };
  const ok = {};
  readUsers_(usersSheet_()).forEach(function (x) { if (x.u.status === "active") ok[x.u.id] = true; });
  const out = {};
  PC_GROUPS.forEach(function (g) {
    const ids = Array.isArray(a[g]) ? a[g].map(String).filter(function (id, i, all) { return ok[id] && all.indexOf(id) === i; }) : [];
    if (ids.length) out[g] = ids;
  });
  PropertiesService.getScriptProperties().setProperty(PC_ASSIGN, JSON.stringify(out));
  return { ok: true, assign: pcAssignNames_(out) };
}
/** Everyone with Office: who to call on a day (yyyy-MM-dd; today when none), each group's { due, missed, more, left (due
 *  that day and left off: booked, do not call, commercial; and who, with why: leftOff) }, after reading what changed in
 *  Housecall Pro (at most every 15 minutes; one person's read at a time). */
function pcRead_(req, user) {
  const P = PropertiesService.getScriptProperties(), tz = Session.getScriptTimeZone(), now = tmNow_().getTime();
  const today = Utilities.formatDate(new Date(now), tz, "yyyy-MM-dd");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.day || "")) ? String(req.day) : today;
  const admin = user.role === "admin";
  if (P.getProperty(PC_DONE) !== "yes") {
    let cur = {};
    try { cur = JSON.parse(P.getProperty(PC_CUR) || "{}") || {}; } catch (e) { cur = {}; }
    return { ok: true, ready: false, admin: admin, key: !!hcpKey_(), started: cur.stage === "back", rows: pcCount_(PC_JOBS) };
  }
  let sync = null;
  let cur = {};
  try { cur = JSON.parse(P.getProperty(PC_CUR) || "{}") || {}; } catch (e) { cur = {}; }
  if (req.sync !== false && cur.stage !== "back" && (req.force === true || now - (Number(P.getProperty(PC_AT)) || 0) > PC_STALE) && now - (Number(P.getProperty(PC_BUSY)) || 0) > 90e3) {
    P.setProperty(PC_BUSY, String(now));
    try { sync = pcSync_({}, PC_READ_PAGES); } catch (e) { sync = { ok: false, error: "server", message: String((e && e.message) || e).slice(0, 200) }; }
    P.deleteProperty(PC_BUSY);
  }
  const start = P.getProperty(PC_START) || today;
  const K = pcKnown_(tz), by = K.by, cust = K.cust, marks = K.marks;
  // the groups this person calls (Admins pick who calls which; a group nobody has: Admins and Office (any day) only)
  const A = pcAssign_(), mine = pcMine_(user, A), who = { mine: mine, assign: admin ? pcAssignNames_(A) : undefined };
  const only = function (G) { Object.keys(G).forEach(function (g) { if (mine.indexOf(Number(g)) === -1) delete G[g]; }); return G; };
  const isDay = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")); };
  if (["week", "month", "year", "dates"].indexOf(String(req.per)) !== -1 && isDay(req.from) && isDay(req.to) && req.from <= req.to && req.to <= tmAddDays_(req.from, 366)) {
    const pr = pcPeriod_(K, String(req.per), String(req.from), String(req.to), today, start);
    only(pr.groups);
    return Object.assign(pr, who, { ok: true, ready: true, admin: admin, day: day, today: today, start: start,
      at: Number(P.getProperty(PC_AT)) || 0, now: tmNow_().getTime(), sync: sync && !sync.ok ? { error: sync.error, status: sync.status || 0 } : null,
      reread: admin && P.getProperty(PC_SCHEMA) !== PC_V, rereading: cur.stage === "back" });
  }
  const groups = {};
  PC_GROUPS.forEach(function (g) { groups[g] = { due: [], missed: [], more: 0, left: { booked: 0, dnc: 0, away: 0, com: 0 }, leftOff: [], callbacks: [] }; });
  Object.keys(by).forEach(function (c) {
    const s = by[c];
    if (!s.last) return;
    let g = 0, due = "", missed = false;
    for (let i = 0; i < PC_GROUPS.length; i++) {
      const d = pcDue_(s.last, PC_GROUPS[i]);
      if (d > day) break;
      if (d === day) { g = PC_GROUPS[i]; due = d; break; }
      const next = pcDue_(s.last, i + 1 < PC_GROUPS.length ? PC_GROUPS[i + 1] : PC_GROUPS[i] + 6);
      if (d >= start && day < next) { g = PC_GROUPS[i]; due = d; missed = true; break; }
    }
    if (!g) return;
    const cu = cust[c] || [], nm = pcName_(cu);
    const left = pcLeft_(c, s, cu, K.never);
    if (left) {   // due that day, left off: counted, and listed with why
      if (!missed) { groups[g].left[left.why]++; groups[g].leftOff.push(Object.assign({ id: c, name: nm.name, contact: nm.contact, last: s.last, lastJob: s.lastJob, lastInv: s.lastInv, type: s.type }, left)); }
      return;
    }
    const m = marks[c + "|" + g + "|" + s.last] || null;
    if (missed && m && m.r) return;   // called on a day after it came up
    const list = groups[g][missed ? "missed" : "due"];
    list.push({ id: c, name: nm.name, contact: nm.contact, phone: String(cu[2] || ""), phone2: String(cu[3] || ""), addr: s.addr, last: s.last, lastJob: s.lastJob, lastInv: s.lastInv, type: s.type,
      dept: revDept_(s.type), jobs: s.jobs, first: s.first, due: due, m: m && m.r ? m : null, com: pcCom_(s, cu) });
  });
  // call-backs whose day has come (a Sunday or closed day: the next working day), not called back yet: in their own group,
  // day after day until marked (today and later only). Gone when a job was finished since (the clock started over) or
  // they're left off now (booked since, do not call, moved away)
  if (day >= today) Object.keys(marks).forEach(function (k) {
    const m = marks[k];
    if (m.r !== "cb" || !m.cb || pcWorkDay_(m.cb) > day) return;
    const p = k.split("|"), c = p[0], g = Number(p[1]), s = by[c];
    if (!s || s.last !== p[2] || !groups[g]) return;
    const cu = cust[c] || [];
    if (pcLeft_(c, s, cu, K.never)) return;
    const nm = pcName_(cu);
    groups[g].callbacks.push({ id: c, name: nm.name, contact: nm.contact, phone: String(cu[2] || ""), phone2: String(cu[3] || ""), addr: s.addr, last: s.last, lastJob: s.lastJob, lastInv: s.lastInv, type: s.type,
      dept: revDept_(s.type), jobs: s.jobs, first: s.first, due: pcWorkDay_(m.cb), m: m, com: pcCom_(s, cu) });
  });
  const byName = function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : a.id < b.id ? -1 : 1; };
  PC_GROUPS.forEach(function (g) {
    const G = groups[g];
    G.due.sort(byName); G.leftOff.sort(byName);
    G.callbacks.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : byName(a, b); });
    G.missed.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : byName(a, b); });
    if (G.missed.length > PC_MISSED_MAX) { G.more = G.missed.length - PC_MISSED_MAX; G.missed = G.missed.slice(0, PC_MISSED_MAX); }
  });
  let sorts = {};
  try { sorts = JSON.parse(P.getProperty(PC_SORTS) || "{}") || {}; } catch (e) { sorts = {}; }
  return Object.assign({ ok: true, ready: true, admin: admin, day: day, today: today, start: start, groups: only(groups), at: Number(P.getProperty(PC_AT)) || 0, now: tmNow_().getTime(),
    reread: admin && P.getProperty(PC_SCHEMA) !== PC_V, rereading: cur.stage === "back",
    sync: sync && !sync.ok ? { error: sync.error, status: sync.status || 0 } : null, sorts: admin ? sorts : undefined }, who);
}
/** A week, a month or a year (from..to): each group's clients whose day for it falls in the period (week and month: the
 *  list, by day, PC_PERIOD_MAX at most; year: counted by month, with what came of the calls), who's left off, and the
 *  results: called (booked, voicemail, no answer, don't call again), not called (their day went by without a mark), to
 *  call (today or later). Days before the lists started aren't in it (nobody marked calls then). */
const PC_PERIOD_MAX = 1500;
function pcPeriod_(K, per, from, to, today, start) {
  // a year, or Dates over 3 months: counted month by month
  const year = per === "year" || (per === "dates" && tmAddDays_(from, 92) <= to), groups = {};
  const res = function () { return { due: 0, booked: 0, vm: 0, na: 0, dnc: 0, cb: 0, not: 0, ahead: 0 }; };
  PC_GROUPS.forEach(function (g) { groups[g] = year ? { months: {}, tot: res(), left: { booked: 0, dnc: 0, away: 0, com: 0 } } : { due: [], missed: [], more: 0, left: { booked: 0, dnc: 0, away: 0, com: 0 }, leftOff: [], tot: res() }; });
  Object.keys(K.by).forEach(function (c) {
    const s = K.by[c];
    if (!s.last) return;
    let cu = null, nm = null, left;
    PC_GROUPS.forEach(function (g) {
      const d = pcDue_(s.last, g);
      if (d < from || d > to || d < start) return;   // days before the lists started: called by hand, if at all
      if (!cu) { cu = K.cust[c] || []; nm = pcName_(cu); left = pcLeft_(c, s, cu, K.never); }
      const G = groups[g];
      if (left) {
        G.left[left.why]++;
        if (!year && G.leftOff.length < 300) G.leftOff.push(Object.assign({ id: c, name: nm.name, contact: nm.contact, last: s.last, lastJob: s.lastJob, lastInv: s.lastInv, type: s.type, due: d }, left));
        return;
      }
      const m = K.marks[c + "|" + g + "|" + s.last] || null, r = m && m.r ? m.r : "";
      const add = function (t) { t.due++; if (r) t[r]++; else if (d < today) t.not++; else t.ahead++; };
      add(G.tot);
      if (year) { const k = d.slice(0, 7); add(G.months[k] || (G.months[k] = res())); return; }
      if (G.due.length >= PC_PERIOD_MAX) { G.more++; return; }
      G.due.push({ id: c, name: nm.name, contact: nm.contact, phone: String(cu[2] || ""), phone2: String(cu[3] || ""), addr: s.addr, last: s.last, lastJob: s.lastJob, lastInv: s.lastInv, type: s.type,
        dept: revDept_(s.type), jobs: s.jobs, first: s.first, due: d, m: m && m.r ? m : null, com: pcCom_(s, cu) });
    });
  });
  if (!year) PC_GROUPS.forEach(function (g) {
    const byDay = function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : a.id < b.id ? -1 : 1; };
    groups[g].due.sort(byDay); groups[g].leftOff.sort(byDay);
  });
  return { per: per, from: from, to: to, byMonth: year, groups: groups };
}
/** Everyone with Office: a call marked (not now, voicemail, booked, don't call again; clear takes it back). Kept for the
 *  client's group and last finished job, so the next group starts unmarked. A mark made on an earlier day can't be
 *  changed or taken back (locked), except by an Admin, or a call-back (cb: the day to call again, and a note of what the
 *  client said): it's marked again when they're called back. */
function pcMark_(req, user) {
  const c = String(req.id || ""), g = Number(req.g), last = String(req.last || ""), r = String(req.r || "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(c) || PC_GROUPS.indexOf(g) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(last) || !Object.prototype.hasOwnProperty.call(PC_RESULTS, r)) return { ok: false, error: "bad_request" };
  if (pcMine_(user, pcAssign_()).indexOf(g) === -1) return { ok: false, error: "not_yours" };   // another CSR's group
  const tz = Session.getScriptTimeZone(), when = tmNow_(), at = when.toISOString(), today = Utilities.formatDate(when, tz, "yyyy-MM-dd");
  const s = pcSheet_(PC_CALLS, PC_CALL_COLS);
  if (user.role !== "admin") {
    // once the day it was marked is over, a call's mark stays as it is (a client not marked carries over until marked)
    let last_ = null;
    pcRows_(PC_CALLS, PC_CALL_COLS.length).forEach(function (x) { if (String(x[2]) === c && Number(x[3]) === g && pcDay_(x[4], tz) === last) last_ = x; });
    if (last_ && String(last_[5] || "") && String(last_[5]) !== "cb" && pcDay_(last_[1], tz) < today) return { ok: false, error: "locked", m: { r: String(last_[5]), who: String(last_[6] || ""), at: last_[0] instanceof Date ? last_[0].toISOString() : String(last_[0] || "") } };
  }
  // a call-back: on a day after today (a year at most), with a short note of what the client said
  const cb = r === "cb" ? String(req.cb || "") : "", note = r === "cb" ? String(req.note || "").replace(/\s+/g, " ").trim().slice(0, 140) : "";
  if (r === "cb" && (!/^\d{4}-\d{2}-\d{2}$/.test(cb) || cb <= today || cb > tmAddDays_(today, 366))) return { ok: false, error: "bad_value", field: "cb" };
  const first = Math.max(2, s.getLastRow() + 1);
  if (s.getMaxRows() < first) s.insertRowsAfter(s.getMaxRows(), 200);
  s.getRange(first, 1, 1, PC_CALL_COLS.length).setNumberFormat("@").setValues([[at, today, c, String(g), last, r === "clear" ? "" : r, user.name, cb, note]]);
  const m = { r: r === "clear" ? "" : r, who: user.name, at: at };
  if (cb) { m.cb = cb; m.note = note; m.day = today; }
  // Office Calls: her Past clients numbers for today, counted again
  let of = null;
  try { of = ofPcSync_(today); } catch (e) { of = null; }
  return { ok: true, m: m, of: of };
}
/* ---- Past clients → Office Calls: each CSR's "Past clients (6M, 1Y, 18M, 2Y, 3Y)" and "Booked from past clients"
   aren't typed (from PC_AUTO_FROM on, the day this started; days before keep what was typed): they're the clients she
   marked on Past clients that day, whichever day's list the client was on (behind, today or ahead), and how many of them
   she marked Booked. A client marked more than once the same day counts once (the day's last mark, if not taken back);
   a call-back called back on a later day counts that day too. ---- */
const PC_AUTO = "PC_AUTO_FROM";
/** The first day the numbers are counted ("" before; set: start today, once the lists are running). */
function pcAutoFrom_(set) {
  const P = PropertiesService.getScriptProperties();
  let v = P.getProperty(PC_AUTO) || "";
  if (!v && set && P.getProperty(PC_DONE) === "yes") { v = Utilities.formatDate(tmNow_(), Session.getScriptTimeZone(), "yyyy-MM-dd"); P.setProperty(PC_AUTO, v); }
  return v;
}
/** A person's two Past clients numbers (ids), when she has them. */
function ofPcIds_(p) {
  const vis = (p.fields || []).filter(function (f) { return !f.hide; });
  const c = vis.filter(function (f) { return f.kind === "out" && /^past clients/i.test(f.label); })[0];
  const b = vis.filter(function (f) { return /^booked from past/i.test(f.label); })[0];
  return { c: c ? c.id : "", b: b ? b.id : "" };
}
/** The calls marked from..to (the day each was marked): { day: { who: { c: clients called, b: booked } } }. */
function pcCounts_(from, to) {
  const tz = Session.getScriptTimeZone(), last = {};
  pcRows_(PC_CALLS, PC_CALL_COLS.length).forEach(function (x) {
    const d = pcDay_(x[1], tz);
    if (!d || d < from || d > to) return;
    last[d + "|" + x[2] + "|" + x[3] + "|" + pcDay_(x[4], tz)] = x;   // in the order made: the day's last mark counts
  });
  const out = {};
  Object.keys(last).forEach(function (k) {
    const x = last[k], r = String(x[5] || ""), who = String(x[6] || ""), d = k.split("|")[0];
    if (!r || !who) return;
    const t = (out[d] || (out[d] = {}))[who] || (out[d][who] = { c: 0, b: 0 });
    t.c++;
    if (r === "booked") t.b++;
  });
  return out;
}
/** The clients one person marked on a day (what makes her Past clients number): each one's name, group, the day they
 *  came up on the list (pcDue_), the mark and when ({ day, uid: login id; only her own unless an admin or Office
 *  (any day) }). */
function pcDayMarks_(req, user) {
  const tz = Session.getScriptTimeZone(), day = String(req.day || ""), uid = String(req.uid || user.id);   // (req.user is the one asking)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "bad_request" };
  if (uid !== user.id && !ofEditor_(user)) return { ok: false, error: "not_allowed" };
  const who = ofUserNames_()[uid];
  if (!who) return { ok: false, error: "bad_request" };
  const last = {};
  pcRows_(PC_CALLS, PC_CALL_COLS.length).forEach(function (x) {
    if (pcDay_(x[1], tz) !== day) return;
    last[x[2] + "|" + x[3] + "|" + pcDay_(x[4], tz)] = x;   // in the order made: the day's last mark counts
  });
  const cust = {};
  pcRows_(PC_CUST, PC_CUST_COLS.length).forEach(function (r) { cust[String(r[0])] = r; });
  const list = [];
  Object.keys(last).forEach(function (k) {
    const x = last[k], r = String(x[5] || "");
    if (!r || String(x[6] || "") !== who) return;
    const g = Number(x[3]), lastDay = pcDay_(x[4], tz), nm = pcName_(cust[String(x[2])] || []);
    list.push({ id: String(x[2]), name: nm.name || "(no name)", g: g, last: lastDay, due: lastDay ? pcDue_(lastDay, g) : "", r: r,
      at: x[0] instanceof Date ? x[0].toISOString() : String(x[0] || "") });
  });
  list.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
  return { ok: true, day: day, who: who, list: list };
}
function ofUserNames_() { const out = {}; readUsers_(usersSheet_()).forEach(function (x) { out[x.u.id] = x.u.name; }); return out; }
/** Puts the counts into a month (from..to, its days only) for everyone linked to a login: what changed, by day and person.
 *  idsOf: a person's two numbers (Past clients': ofPcIds_; Office › Estimates': ofEstIds_). */
function ofPcApply_(doc, key, cfg, counts, names, from, to, idsOf) {
  const patch = {}, first = key + "-01", last = tmAddDays_(tmAddDays_(first, 31).slice(0, 8) + "01", -1);
  if (!doc.days || typeof doc.days !== "object") doc.days = {};
  for (let d = from > first ? from : first; d <= (to < last ? to : last); d = tmAddDays_(d, 1)) {
    cfg.people.forEach(function (p) {
      const who = p.user && names[p.user], ids = (idsOf || ofPcIds_)(p);
      if (!who || (!ids.c && !ids.b)) return;
      const t = (counts[d] && counts[d][who]) || { c: 0, b: 0 }, want = {};
      if (ids.c) want[ids.c] = t.c > 0 ? t.c : null;
      if (ids.b) want[ids.b] = t.c > 0 ? t.b : null;   // with calls: booked (0 too); none: blank
      const day = doc.days[d] || {}, e = day[p.name] || {};
      let diff = false;
      Object.keys(want).forEach(function (id) {
        const v = want[id];
        if ((v === null ? undefined : v) === e[id]) return;
        diff = true;
        if (v === null) delete e[id]; else e[id] = v;
      });
      if (!diff) return;
      (patch[d] || (patch[d] = {}))[p.name] = want;
      if (Object.keys(e).some(function (k) { return k !== "at" && k !== "by"; })) { day[p.name] = e; doc.days[d] = day; }
      else { delete day[p.name]; if (Object.keys(day).length) doc.days[d] = day; else delete doc.days[d]; }
    });
  }
  return patch;
}
/** A day's Past clients numbers counted again and saved (after a call is marked): what changed ({ key, days }), or null. */
function ofPcSync_(day) {
  const auto = pcAutoFrom_(true);
  if (!auto || day < auto) return null;
  return ofAutoSync_(day, pcCounts_(day, day), ofPcIds_, "Past clients");
}
/** A day's counted numbers saved into the office's month: what changed ({ key, days }), or null. */
function ofAutoSync_(day, counts, idsOf, by) {
  const s = ofSheet_(false);
  if (!s) return null;
  const byKey = {};
  lbRows_(s).forEach(function (r) { byKey[r.key] = r; });
  if (!byKey.config) return null;
  const cfg = ofConfig_(lbParse_(byKey.config.json)), key = day.slice(0, 7);
  const doc = ofMonth_(lbParse_(byKey[key] ? byKey[key].json : ""), key);
  const patch = ofPcApply_(doc, key, cfg, counts, ofUserNames_(), day, day, idsOf);
  if (Object.keys(patch).length) lbSaveRow_(s, byKey, key, JSON.stringify(ofMonth_(doc, key)), new Date().toISOString(), by);
  return { key: key, days: patch };
}

/** Everyone with Office: the marks made since `since` (ms), to show what the others marked. */
function pcMarks_(req) {
  const tz = Session.getScriptTimeZone(), since = Number(req.since) || 0;
  const out = [];
  pcRows_(PC_CALLS, PC_CALL_COLS.length).forEach(function (r) {
    const at = r[0] instanceof Date ? r[0].toISOString() : String(r[0] || "");
    if ((Date.parse(at) || 0) < since) return;   // one made in the same millisecond again (showing it twice changes nothing)
    const x = { id: String(r[2]), g: Number(r[3]), last: pcDay_(r[4], tz), r: String(r[5] || ""), who: String(r[6] || ""), at: at };
    if (x.r === "cb") { x.cb = pcDay_(r[7], tz); x.note = String(r[8] || ""); x.day = pcDay_(r[1], tz); }
    out.push(x);
  });
  return { ok: true, marks: out.slice(-500), now: tmNow_().getTime() };
}

/* ---- Office › Tech Report Cards: the CSRs call the client of each cleaning and restoration job (yesterday's, to
   start) and mark what the tech did, as the client tells it: on the way, called the client, brochure / business card,
   other services, fiber protector benefits, offered an estimate, asked for a review, photos, invoice complete; or
   Voicemail (couldn't reach the client). Each tech's report card adds them up (a week, month or year): of his jobs
   called, how many had each one, and the %. Admins pick the CSRs who do it (nobody picked: admins only). One row a job
   on the "Tech report cards" tab (a mark can be changed only the day it was made, except by an admin); months before
   the app: each tech's month from the "6. TECHS Weekly Report Cards" Excel (Load from Excel). ---- */
const TRC_SHEET = "Tech report cards", TRC_COLS = ["Job id", "Day", "Invoice #", "Client", "Techs", "Dept", "Voicemail", "Items", "By", "At", "Marked on"];
const TRC_HIST = "Tech report card history", TRC_HIST_COLS = ["Month", "Tech", "Jobs", "On the way", "Called client", "Brochure", "Other services", "Fiber protector", "Offer estimate", "Review", "Photos", "Invoice complete", "Voicemail", "From"];
const TRC_ITEMS = ["otw", "called", "bro", "other", "fiber", "est", "review", "photos", "inv"];
const TRC_WHO = "TRC_WHO";
const TRC_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function trcWho_() {
  let v = [];
  try { v = JSON.parse(PropertiesService.getScriptProperties().getProperty(TRC_WHO) || "[]") || []; } catch (e) { v = []; }
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}
/** Admins, and the CSRs picked. */
function trcOk_(user) { return !!user && (user.role === "admin" || trcWho_().indexOf(user.id) !== -1); }
function trcWhoPut_(req) {
  if (!Array.isArray(req.users) || req.users.length > 40) return { ok: false, error: "bad_request" };
  const ids = {};
  readUsers_(usersSheet_()).forEach(function (x) { ids[x.u.id] = true; });
  const out = req.users.map(String).filter(function (id, i, a) { return ids[id] && a.indexOf(id) === i; });
  PropertiesService.getScriptProperties().setProperty(TRC_WHO, JSON.stringify(out));
  return { ok: true, users: out };
}
function trcRows_() {
  const s = SpreadsheetApp.getActive().getSheetByName(TRC_SHEET);
  return s && s.getLastRow() >= 2 ? s.getRange(2, 1, s.getLastRow() - 1, TRC_COLS.length).getValues() : [];
}
function trcMarkOf_(r, tz) {
  const items = String(r[7] || "").split(",").filter(function (k) { return TRC_ITEMS.indexOf(k) !== -1; });
  return { vm: Number(r[6]) === 1, items: items, by: String(r[8] || ""), at: r[9] instanceof Date ? r[9].toISOString() : String(r[9] || ""), on: pcDay_(r[10], tz) };
}
/** A day's cleaning and restoration jobs (Housecall Pro: not canceled, on that day), each with its techs, client and
 *  phone, and its mark; jobs marked that day but not on it any more (moved) too. */
function trcDay_(req) {
  const tz = Session.getScriptTimeZone(), day = String(req.day || "");
  if (!TRC_DAY.test(day)) return { ok: false, error: "bad_request" };
  if (!hcpKey_()) return { ok: false, error: "no_key" };
  const got = hcpJobsIn_(day, day);
  if (got.error) return { ok: false, error: got.error, status: got.status || 0 };
  const marks = {};
  trcRows_().forEach(function (r) { if (String(r[0])) marks[String(r[0])] = r; });
  const jobs = [], seen = {};
  got.jobs.forEach(function (j) {
    if (!j || /cancel/i.test(String(j.work_status || ""))) return;
    const start = new Date((j.schedule && j.schedule.scheduled_start) || "");
    if (isNaN(start.getTime()) || Utilities.formatDate(start, tz, "yyyy-MM-dd") !== day) return;
    const type = hcpJobType_(j), dept = revDept_(type);
    if (dept !== "c" && dept !== "r") return;
    const id = String(j.id || "");
    if (!id || seen[id]) return;
    seen[id] = true;
    const cu = j.customer || {}, techs = (Array.isArray(j.assigned_employees) ? j.assigned_employees : [])
      .map(function (x) { return [x && x.first_name, x && x.last_name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(); }).filter(Boolean).slice(0, 6);
    const a = j.address || {};
    jobs.push({ id: id, inv: String(j.invoice_number || ""), client: hcpClient_(j), phone: pcPhone_(cu.mobile_number || cu.home_number || cu.work_number || ""),
      addr: [a.street, a.city].filter(Boolean).join(", ").slice(0, 80), type: type.slice(0, 60), dept: dept, techs: techs,
      time: (function (t) { const hh = Number(t.slice(0, 2)); return (hh % 12 || 12) + ":" + t.slice(3) + (hh < 12 ? " AM" : " PM"); })(Utilities.formatDate(start, tz, "HH:mm")), st: String(j.work_status || "").slice(0, 30), m: marks[id] ? trcMarkOf_(marks[id], tz) : null });
  });
  Object.keys(marks).forEach(function (id) {
    const r = marks[id];
    if (seen[id] || pcDay_(r[1], tz) !== day) return;
    jobs.push({ id: id, inv: String(r[2] || ""), client: String(r[3] || ""), phone: "", addr: "", type: "", dept: String(r[5] || ""), techs: String(r[4] || "").split(", ").filter(Boolean),
      time: "", st: "moved", gone: true, m: trcMarkOf_(r, tz) });
  });
  jobs.forEach(function (j) { const t = /^(\d+):(\d\d) (AM|PM)$/.exec(j.time); j.ts = t ? (Number(t[1]) % 12 + (t[3] === "PM" ? 12 : 0)) * 60 + Number(t[2]) : 9999; });
  jobs.sort(function (x, y) { return (x.techs[0] || "~") < (y.techs[0] || "~") ? -1 : (x.techs[0] || "~") > (y.techs[0] || "~") ? 1 : x.ts - y.ts; });
  jobs.forEach(function (j) { delete j.ts; });
  return { ok: true, day: day, jobs: jobs, today: Utilities.formatDate(tmNow_(), tz, "yyyy-MM-dd") };
}
/** A CSR's mark on a job ({ id, day, inv, client, techs, dept, vm, items } or { id, clear: true }): reached (the items
 *  the client said yes to, maybe none) or Voicemail. Changed only the day it was made, except by an admin. */
function trcMark_(req, user) {
  const tz = Session.getScriptTimeZone(), id = String(req.id || ""), today = Utilities.formatDate(tmNow_(), tz, "yyyy-MM-dd");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return { ok: false, error: "bad_request" };
  const s = pcSheet_(TRC_SHEET, TRC_COLS), rows = trcRows_();
  const i = rows.findIndex(function (r) { return String(r[0]) === id; });
  if (i !== -1 && user.role !== "admin" && pcDay_(rows[i][10], tz) < today) return { ok: false, error: "locked", m: trcMarkOf_(rows[i], tz) };
  if (req.clear === true) {
    if (i !== -1) s.deleteRow(i + 2);
    return { ok: true, m: null };
  }
  const day = String(req.day || ""), dept = String(req.dept || "");
  const items = Array.isArray(req.items) ? req.items.map(String).filter(function (k, n, a) { return TRC_ITEMS.indexOf(k) !== -1 && a.indexOf(k) === n; }) : [];
  const techs = Array.isArray(req.techs) ? req.techs.map(function (t) { return String(t || "").replace(/[,\s]+/g, " ").trim().slice(0, 60); }).filter(Boolean).slice(0, 6) : [];
  if (!TRC_DAY.test(day) || day > today || (dept && dept !== "c" && dept !== "r")) return { ok: false, error: "bad_request" };
  const vm = req.vm === true;
  const row = [id, day, String(req.inv || "").slice(0, 20), String(req.client || "").replace(/\s+/g, " ").trim().slice(0, 80), techs.join(", "), dept, vm ? 1 : 0, vm ? "" : items.join(","),
    user.name, new Date().toISOString(), today];
  if (i !== -1) s.getRange(i + 2, 1, 1, TRC_COLS.length).setNumberFormat("@").setValues([row]);
  else {
    const first = Math.max(2, s.getLastRow() + 1);
    if (s.getMaxRows() < first) s.insertRowsAfter(s.getMaxRows(), 200);
    s.getRange(first, 1, 1, TRC_COLS.length).setNumberFormat("@").setValues([row]);
  }
  return { ok: true, m: trcMarkOf_(row, tz) };
}
/** The marks from..to (by the job's day, a year at most), short: [day, techs, dept, vm, items, job id, invoice, client], and the Excel's months
 *  ([month, tech, jobs, each item, voicemail]) for the months the app has no marks in. */
function trcReport_(req) {
  const tz = Session.getScriptTimeZone(), from = String(req.from || ""), to = String(req.to || "");
  if (!TRC_DAY.test(from) || !TRC_DAY.test(to) || from > to || to > tmAddDays_(from, 370)) return { ok: false, error: "bad_request" };
  const marks = [], live = {};
  trcRows_().forEach(function (r) {
    const d = pcDay_(r[1], tz);
    if (!d) return;
    live[d.slice(0, 7)] = true;
    if (d < from || d > to) return;
    marks.push([d, String(r[4] || ""), String(r[5] || ""), Number(r[6]) === 1 ? 1 : 0, String(r[7] || ""), String(r[0] || ""), String(r[2] || ""), String(r[3] || "")]);
  });
  const hist = [];
  const hs = SpreadsheetApp.getActive().getSheetByName(TRC_HIST);
  if (hs && hs.getLastRow() >= 2) hs.getRange(2, 1, hs.getLastRow() - 1, TRC_HIST_COLS.length).getValues().forEach(function (r) {
    const m = rpMonth_(r[0], tz);
    if (!m || live[m] || m < from.slice(0, 7) || m > to.slice(0, 7)) return;
    hist.push([m, String(r[1] || "")].concat(r.slice(2, 13).map(function (v) { return Math.max(0, Math.round(Number(v) || 0)); })));
  });
  return { ok: true, from: from, to: to, marks: marks, hist: hist, first: Object.keys(live).sort()[0] || "" };
}
/** Admin: the Excel's months ({ rows: [[month, tech, jobs, 9 items, voicemail]] }): they replace what was loaded before. */
function trcImport_(req) {
  const rows = Array.isArray(req.rows) ? req.rows : null;
  if (!rows || rows.length > 3000) return { ok: false, error: "bad_request" };
  const out = [];
  rows.forEach(function (x) {
    if (!Array.isArray(x) || !RP_YM.test(String(x[0] || "")) || !rpName_(x[1])) return;
    const n = x.slice(2, 13).map(function (v) { return Math.max(0, Math.min(100000, Math.round(Number(v) || 0))); });
    while (n.length < 11) n.push(0);
    if (!n.some(Boolean)) return;
    out.push([String(x[0]), rpName_(x[1]).slice(0, 40)].concat(n).concat(["Excel"]));
  });
  out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1; });
  mktWrite_(mktSheet_(TRC_HIST, TRC_HIST_COLS, true), TRC_HIST_COLS, out);
  return { ok: true, saved: out.length };
}

/* ---- Office › Estimates: who follows them up (Admins pick; nobody picked: everyone with Office) and the call marks on
   each one, as on Past clients: Not now, Voicemail, Booked, Call back (a day and what the client said), Don't call again.
   One row a mark on the "Estimate calls" tab; the last one of each estimate counts. ---- */
const OF_EST_CALLS = "Estimate calls", OF_EST_CALL_COLS = ["At", "Day", "Estimate id", "Result", "Who", "Call back on", "Note", "Spoke with"];
function ofEstWho_() {
  let v = [];
  try { v = JSON.parse(PropertiesService.getScriptProperties().getProperty("OF_EST_WHO") || "[]") || []; } catch (e) { v = []; }
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}
function ofEstOk_(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const who = ofEstWho_();
  return !who.length || who.indexOf(user.id) !== -1;
}
function ofEstWhoPut_(req) {
  if (!Array.isArray(req.users) || req.users.length > 40) return { ok: false, error: "bad_request" };
  const ids = {};
  readUsers_(usersSheet_()).forEach(function (x) { ids[x.u.id] = true; });
  const out = req.users.map(String).filter(function (id, i, a) { return ids[id] && a.indexOf(id) === i; });
  PropertiesService.getScriptProperties().setProperty("OF_EST_WHO", JSON.stringify(out));
  return { ok: true, users: out };
}
/** Each estimate's last mark: { r, who, at, cb, note, day }. calls (if given): each one's last call made before today
 *  (a mark, not one taken back). */
function ofEstMarks_(calls) {
  const tz = Session.getScriptTimeZone(), out = {}, today = Utilities.formatDate(tmNow_(), tz, "yyyy-MM-dd");
  pcRows_(OF_EST_CALLS, OF_EST_CALL_COLS.length).forEach(function (r) {
    const id = String(r[2] || "");
    if (!id) return;
    const m = { r: String(r[3] || ""), who: String(r[4] || ""), at: r[0] instanceof Date ? r[0].toISOString() : String(r[0] || ""), day: pcDay_(r[1], tz) };
    if (m.r === "cb") { m.cb = pcDay_(r[5], tz); m.note = String(r[6] || ""); }
    out[id] = m;   // in the order made: the last one counts
    if (calls && m.r && m.day && m.day < today) calls[id] = m;
  });
  return out;
}
/** Each estimate's mark (m) and, when it isn't that one, its last call before today (lc): a new day the open ones get
 *  the buttons again, with the last call shown. */
function ofEstMarksOn_(list) {
  const calls = {}, M = ofEstMarks_(calls);
  (list || []).forEach(function (e) {
    const m = M[e.id], c = calls[e.id];
    if (m && m.r) e.m = m;
    if (c && c !== m) e.lc = c;
  });
}
/** A new day, the estimate can be called again: its last mark was Not now or Voicemail, or a call back (any day: the
 *  client may call first). Booked and Don't call again end it (an admin can change them). */
const OF_EST_AGAIN = { na: true, vm: true, cb: true };
function ofEstMark_(req, user) {
  const id = String(req.id || ""), r = String(req.r || "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !Object.prototype.hasOwnProperty.call(PC_RESULTS, r)) return { ok: false, error: "bad_request" };
  const tz = Session.getScriptTimeZone(), when = tmNow_(), at = when.toISOString(), today = Utilities.formatDate(when, tz, "yyyy-MM-dd");
  if (user.role !== "admin") {
    // a mark from an earlier day stays as it is, but a new day's call can be marked over Not now, Voicemail or a call
    // back (and a call back taken back: called back). Booked and Don't call again: locked.
    const last = ofEstMarks_()[id];
    if (last && last.r && last.day && last.day < today && (r === "clear" ? last.r !== "cb" : !OF_EST_AGAIN[last.r])) return { ok: false, error: "locked", m: last };
  }
  const cb = r === "cb" ? String(req.cb || "") : "", note = r === "cb" ? String(req.note || "").replace(/\s+/g, " ").trim().slice(0, 140) : "";
  if (r === "cb" && (!/^\d{4}-\d{2}-\d{2}$/.test(cb) || cb <= today || cb > tmAddDays_(today, 366))) return { ok: false, error: "bad_value", field: "cb" };
  const s = pcSheet_(OF_EST_CALLS, OF_EST_CALL_COLS), first = Math.max(2, s.getLastRow() + 1);
  if (s.getMaxRows() < first) s.insertRowsAfter(s.getMaxRows(), 200);
  s.getRange(first, 1, 1, OF_EST_CALL_COLS.length).setNumberFormat("@").setValues([[at, today, id, r === "clear" ? "" : r, user.name, cb, note, ""]]);
  const m = { r: r === "clear" ? "" : r, who: user.name, at: at, day: today };
  if (cb) { m.cb = cb; m.note = note; }
  let of = null;
  try { of = ofEstSync_(today); } catch (e) { of = null; }   // her Cleaning estimate follow-ups on Office Calls
  return { ok: true, m: m, of: of };
}
/* ---- Office › Estimates → Office Calls: a CSR's "Cleaning estimate follow-ups" and "Booked from estimates" aren't typed
   (from EST_AUTO_FROM on, the day this started; days before keep what was typed): they're the estimates she marked on
   Office › Estimates that day, and how many of them she marked Booked. An estimate she marked more than once the same
   day counts once (her last mark that day, if not taken back). ---- */
const EST_AUTO = "EST_AUTO_FROM";
/** The first day the numbers are counted ("" before; set: start today). */
function estAutoFrom_(set) {
  const P = PropertiesService.getScriptProperties();
  let v = P.getProperty(EST_AUTO) || "";
  if (!v && set) { v = Utilities.formatDate(tmNow_(), Session.getScriptTimeZone(), "yyyy-MM-dd"); P.setProperty(EST_AUTO, v); }
  return v;
}
/** A person's two estimate numbers (ids), when she has them. */
function ofEstIds_(p) {
  const vis = (p.fields || []).filter(function (f) { return !f.hide; });
  const c = vis.filter(function (f) { return f.kind === "out" && /^(cleaning )?estimates? follow/i.test(f.label); })[0];
  const b = vis.filter(function (f) { return /^booked from (cleaning )?estimates?\b/i.test(f.label); })[0];
  return { c: c ? c.id : "", b: b ? b.id : "" };
}
/** The estimates marked from..to (the day each was marked): { day: { who: { c: estimates called, b: booked } } }. */
function ofEstCounts_(from, to) {
  const tz = Session.getScriptTimeZone(), last = {};
  pcRows_(OF_EST_CALLS, OF_EST_CALL_COLS.length).forEach(function (x) {
    const d = pcDay_(x[1], tz), id = String(x[2] || ""), who = String(x[4] || "");
    if (!d || d < from || d > to || !id || !who) return;
    last[d + "|" + id + "|" + who] = x;   // in the order made: her last mark that day counts
  });
  const out = {};
  Object.keys(last).forEach(function (k) {
    const x = last[k], r = String(x[3] || ""), who = String(x[4] || ""), d = k.split("|")[0];
    if (!r) return;
    const t = (out[d] || (out[d] = {}))[who] || (out[d][who] = { c: 0, b: 0 });
    t.c++;
    if (r === "booked") t.b++;
  });
  return out;
}
/** A day's estimate numbers counted again and saved (after a mark): what changed ({ key, days }), or null. */
function ofEstSync_(day) {
  const auto = estAutoFrom_(true);
  if (!auto || day < auto) return null;
  return ofAutoSync_(day, ofEstCounts_(day, day), ofEstIds_, "Office › Estimates");
}
/** The estimates one person marked on a day (what makes her Cleaning estimate follow-ups): each one's number, client,
 *  the mark and when ({ day, uid: login id; only her own unless an admin or Office (any day) }). */
function ofEstDayMarks_(req, user) {
  const tz = Session.getScriptTimeZone(), day = String(req.day || ""), uid = String(req.uid || user.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "bad_request" };
  if (uid !== user.id && !ofEditor_(user)) return { ok: false, error: "not_allowed" };
  const who = ofUserNames_()[uid];
  if (!who) return { ok: false, error: "bad_request" };
  const last = {};
  pcRows_(OF_EST_CALLS, OF_EST_CALL_COLS.length).forEach(function (x) {
    if (pcDay_(x[1], tz) === day && String(x[4] || "") === who && String(x[2] || "")) last[String(x[2])] = x;
  });
  const er = estRows_(SpreadsheetApp.getActive().getSheetByName(EST_SHEET)), list = [];
  Object.keys(last).forEach(function (id) {
    const x = last[id], r = String(x[3] || ""), row = er[id];
    if (!r) return;
    list.push({ id: id, n: row ? String(row[1] || "") : "", client: row ? String(row[4] || "") : "", r: r, at: x[0] instanceof Date ? x[0].toISOString() : String(x[0] || "") });
  });
  list.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
  return { ok: true, day: day, who: who, list: list };
}

/* ---------------- KPI (Office › KPI) ----------------
   Each person's day as the KPI Excel kept it: six numbers (Estimates sent, Repair estimates sent, Invoices sent,
   Estimates to jobs, Collected balances, Xactimates made), each a list of lines (what it was: the client, the address,
   the amount) with a count. One row per line on the "KPI log" tab (in this Google Sheet only). The people (Script
   Property KPI_PEOPLE): each one's name, the login that types for him, and whether he's left. Someone with the KPI tick
   sees and types only his own; Admins see and type everyone's. */
const KPI = "kpi", KPI_SHEET = "KPI log", KPI_COLS = ["id", "person", "day", "kpi", "text", "count", "by", "at"];
const KPI_KEYS = ["est", "rep", "inv", "e2j", "coll", "xact"];
const KPI_TEXT = 300, KPI_MAX_N = 999, KPI_LINES_DAYS = 62;
const kpiColorOk_ = function (c) { return /^#[0-9a-f]{6}$/i.test(String(c || "")); };
function kpiPeople_() {
  let p = [];
  try { p = JSON.parse(PropertiesService.getScriptProperties().getProperty("KPI_PEOPLE") || "[]") || []; } catch (e) { p = []; }
  return Array.isArray(p) ? p.filter(function (x) { return x && x.name; }).map(function (x) {
    const o = { name: String(x.name), user: String(x.user || ""), off: !!x.off };
    if (kpiColorOk_(x.color)) o.color = String(x.color).toLowerCase();   // his color (the Excel's tab color, or picked)
    return o;
  }) : [];
}
/** The names this login types for: his own (Admins: everyone's). */
function kpiMine_(user, people) {
  if (user.role === "admin") return people.map(function (x) { return x.name; });
  return people.filter(function (x) { return x.user && x.user === user.id; }).map(function (x) { return x.name; });
}
function kpiLine_(r, tz) { return { id: String(r[0] || ""), p: String(r[1] || ""), d: pcDay_(r[2], tz), k: String(r[3] || ""), t: String(r[4] || ""), n: Number(r[5]) || 0 }; }
function kpiIsDay_(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")); }
/** { from, to }: each person's numbers by day (the six counts); { lf, lt } (62 days at most): the lines too. */
function kpiRead_(req, user) {
  const tz = Session.getScriptTimeZone(), people = kpiPeople_(), mine = kpiMine_(user, people), admin = user.role === "admin";
  const from = kpiIsDay_(req.from) ? String(req.from) : "", to = kpiIsDay_(req.to) ? String(req.to) : "";
  if (!from || !to || to < from) return { ok: false, error: "bad_request" };
  const lf = kpiIsDay_(req.lf) ? String(req.lf) : "", lt = kpiIsDay_(req.lt) ? String(req.lt) : "";
  const withLines = !!(lf && lt && lt >= lf && lt <= tmAddDays_(lf, KPI_LINES_DAYS));
  const tot = {}, lines = [];
  pcRows_(KPI_SHEET, KPI_COLS.length).forEach(function (r) {
    const x = kpiLine_(r, tz), k = KPI_KEYS.indexOf(x.k);
    if (!x.id || !x.d || k === -1 || mine.indexOf(x.p) === -1) return;
    if (x.d >= from && x.d <= to) { const P = tot[x.p] || (tot[x.p] = {}), D = P[x.d] || (P[x.d] = [0, 0, 0, 0, 0, 0]); D[k] += x.n; }
    if (withLines && x.d >= lf && x.d <= lt) lines.push(x);
  });
  return { ok: true, admin: admin, today: Utilities.formatDate(tmNow_(), tz, "yyyy-MM-dd"),
    people: people.filter(function (x) { return mine.indexOf(x.name) !== -1; }).map(function (x) { return admin ? x : { name: x.name, off: x.off }; }),
    tot: tot, lines: withLines ? lines : null };
}
/** A line: { person, day, kpi, text, n } adds one; { id, text, n } changes one; { id, remove: true } takes it off. */
function kpiPut_(req, user) {
  const tz = Session.getScriptTimeZone(), today = Utilities.formatDate(tmNow_(), tz, "yyyy-MM-dd"), mine = kpiMine_(user, kpiPeople_());
  const text = String(req.text === undefined || req.text === null ? "" : req.text).replace(/\s+/g, " ").trim().slice(0, KPI_TEXT);
  const n = req.n === undefined || req.n === null || req.n === "" ? 1 : Number(req.n);
  if (!req.remove && (!isFinite(n) || n < 0 || n > KPI_MAX_N || Math.floor(n) !== n)) return { ok: false, error: "bad_count" };
  if (!req.remove && !text && !n) return { ok: false, error: "empty" };
  const s = pcSheet_(KPI_SHEET, KPI_COLS), at = tmNow_().toISOString();
  if (req.id) {
    const rows = pcRows_(KPI_SHEET, KPI_COLS.length), id = String(req.id);
    let i = -1;
    for (let j = 0; j < rows.length; j++) if (String(rows[j][0]) === id) { i = j; break; }
    if (i === -1) return { ok: false, error: "gone" };
    const x = kpiLine_(rows[i], tz);
    if (mine.indexOf(x.p) === -1) return { ok: false, error: "not_allowed" };
    if (req.remove) { s.deleteRow(i + 2); return { ok: true, removed: id }; }
    s.getRange(i + 2, 5, 1, 4).setNumberFormat("@").setValues([[text, String(n), req.by || "", at]]);
    return { ok: true, line: { id: id, p: x.p, d: x.d, k: x.k, t: text, n: n } };
  }
  const p = String(req.person || ""), d = String(req.day || ""), k = String(req.kpi || "");
  if (mine.indexOf(p) === -1) return { ok: false, error: "not_allowed" };
  if (!kpiIsDay_(d) || d > today) return { ok: false, error: "bad_day" };
  if (KPI_KEYS.indexOf(k) === -1) return { ok: false, error: "bad_request" };
  const id = "k" + Utilities.getUuid().replace(/-/g, "").slice(0, 14);
  const row = [id, p, d, k, text, String(n), req.by || "", at];
  const first = Math.max(2, s.getLastRow() + 1);
  if (s.getMaxRows() < first) s.insertRowsAfter(s.getMaxRows(), 200);
  s.getRange(first, 1, 1, KPI_COLS.length).setNumberFormat("@").setValues([row]);
  return { ok: true, line: { id: id, p: p, d: d, k: k, t: text, n: n } };
}
/** Admins: who's on the KPI (name, the login that types for him, left), in order. A name already used stays the same
 *  (his lines go by it). */
function kpiSetPeople_(req) {
  if (!Array.isArray(req.people) || req.people.length > 40) return { ok: false, error: "bad_request" };
  const ids = {}, seen = {};
  readUsers_(usersSheet_()).forEach(function (x) { ids[x.u.id] = true; });
  const out = [];
  for (let i = 0; i < req.people.length; i++) {
    const x = req.people[i] || {}, name = String(x.name || "").replace(/\s+/g, " ").trim().slice(0, 40), user = String(x.user || "");
    if (!name) continue;
    if (seen[name.toLowerCase()]) return { ok: false, error: "twice", name: name };
    if (user && !ids[user]) return { ok: false, error: "no_user", name: name };
    seen[name.toLowerCase()] = true;
    const o = { name: name, user: user, off: !!x.off };
    if (kpiColorOk_(x.color)) o.color = String(x.color).toLowerCase();
    out.push(o);
  }
  PropertiesService.getScriptProperties().setProperty("KPI_PEOPLE", JSON.stringify(out));
  return { ok: true, people: out };
}
/** Admins, from the KPI Excel: { months: [{ p, m: "yyyy-mm", lines: [{ d, k, t, n }] }] } (a few at a time). Each
 *  person's month is replaced by the Excel's lines; a name not on the KPI yet is added (with the login of that first
 *  name, if exactly one has it; in the order of { order }), and someone whose last month is long gone is marked left. */
function kpiImport_(req) {
  if (!Array.isArray(req.months) || req.months.length > 40) return { ok: false, error: "bad_request" };
  if (!req.months.length) {   // just the people's colors (their tabs' colors in the Excel), no month replaced
    if (!req.colors || typeof req.colors !== "object") return { ok: false, error: "bad_request" };
    const ppl = kpiPeople_();
    ppl.forEach(function (x) {
      const k = Object.keys(req.colors).filter(function (n) { return String(n).toLowerCase() === x.name.toLowerCase(); })[0];
      if (k && kpiColorOk_(req.colors[k])) x.color = String(req.colors[k]).toLowerCase();
    });
    PropertiesService.getScriptProperties().setProperty("KPI_PEOPLE", JSON.stringify(ppl));
    return { ok: true, saved: 0, people: ppl };
  }
  const tz = Session.getScriptTimeZone(), at = tmNow_().toISOString(), drop = {}, add = [];
  let n = 0;
  for (let i = 0; i < req.months.length; i++) {
    const M = req.months[i] || {}, p = String(M.p || "").replace(/\s+/g, " ").trim().slice(0, 40), m = String(M.m || "");
    if (!p || !/^\d{4}-\d{2}$/.test(m) || !Array.isArray(M.lines)) return { ok: false, error: "bad_request" };
    drop[p + "|" + m] = true;
    M.lines.forEach(function (x) {
      const d = String((x && x.d) || ""), k = String((x && x.k) || ""), c = Number(x && x.n);
      if (!kpiIsDay_(d) || d.slice(0, 7) !== m || KPI_KEYS.indexOf(k) === -1) return;
      const cnt = isFinite(c) && c >= 0 && c <= KPI_MAX_N ? Math.round(c) : 1;
      const t = String((x && x.t) || "").replace(/\s+/g, " ").trim().slice(0, KPI_TEXT);
      if (!t && !cnt) return;
      add.push(["k" + Utilities.getUuid().replace(/-/g, "").slice(0, 14), p, d, k, t, String(cnt), "Excel", at]);
      n++;
    });
  }
  if (n > 3000) return { ok: false, error: "too_many" };
  const s = pcSheet_(KPI_SHEET, KPI_COLS), old = pcRows_(KPI_SHEET, KPI_COLS.length);
  const keep = old.filter(function (r) { const d = pcDay_(r[2], tz); return r[0] && !(d && drop[String(r[1]) + "|" + d.slice(0, 7)]); })
    .map(function (r) { return r.map(function (v, k) { return k === 2 ? pcDay_(v, tz) : String(v === null || v === undefined ? "" : v); }); });
  const all = keep.concat(add);
  if (old.length) s.getRange(2, 1, old.length, KPI_COLS.length).clearContent();
  if (all.length) {
    if (s.getMaxRows() < all.length + 1) s.insertRowsAfter(s.getMaxRows(), all.length + 201 - s.getMaxRows());
    s.getRange(2, 1, all.length, KPI_COLS.length).setNumberFormat("@").setValues(all);
  }
  // the people: anyone new is added (linked to the one login with his first name), and kept in the order they came
  const people = kpiPeople_(), users = readUsers_(usersSheet_()).map(function (x) { return x.u; }).filter(function (u) { return u.status !== "invited"; });
  const first = function (v) { return String(v || "").trim().split(/\s+/)[0].toLowerCase(); };
  const names = (Array.isArray(req.order) ? req.order : []).concat(req.months.map(function (M) { return M.p; }));   // as the Excel has them
  names.forEach(function (nm) {
    const p = String(nm || "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!p || people.some(function (x) { return x.name.toLowerCase() === p.toLowerCase(); })) return;
    const same = users.filter(function (u) { return first(u.name) === first(p); });
    const used = people.map(function (x) { return x.user; });
    people.push({ name: p, user: same.length === 1 && used.indexOf(same[0].id) === -1 ? same[0].id : "", off: !!req.left && req.left.indexOf(p) !== -1 });
  });
  if (Array.isArray(req.left)) people.forEach(function (x) { if (req.left.indexOf(x.name) !== -1 && !x.user) x.off = true; });
  // each person's color: his tabs' color in the Excel
  if (req.colors && typeof req.colors === "object") people.forEach(function (x) {
    const k = Object.keys(req.colors).filter(function (n) { return String(n).toLowerCase() === x.name.toLowerCase(); })[0];
    if (k && kpiColorOk_(req.colors[k])) x.color = String(req.colors[k]).toLowerCase();
  });
  PropertiesService.getScriptProperties().setProperty("KPI_PEOPLE", JSON.stringify(people));
  return { ok: true, saved: n, people: people };
}

/* ---- The rebuild calendar: every Repairs estimate approved in Housecall Pro (by the client or the office) goes on the
   vendors' calendar once, on the day it was approved, 6 to 7 AM, in red, titled "APPROVED - NEED TO SCHEDULE - <city> -
   <client>", at its address, with the client's phone, the estimate's Private notes (new ones added later: rbNotesLater_)
   and, in bold, what was approved and the vendor's share (Script
   Properties REBUILD_VENDOR, default Monumental, and REBUILD_SHARE, default 70%). The calendar: Script Property REBUILD_CALENDAR_ID (its Calendar ID, from the calendar's
   Settings > Integrate calendar; the "VODA rebuilds" calendar shared with the vendor). Only estimates approved on or after
   REBUILD_CALENDAR_FROM (yyyy-MM-dd; set to the day it's turned on). Turn it on once from the editor: Run >
   rebuildCalendarSetup (Google asks for the calendar permission; then every 15 minutes it reads what changed in Housecall
   Pro and books). No longer approved: its event's title gets "CANCELED - " in front (the vendor may have renamed it);
   approved again: taken off. The "Rebuild calendar" tab keeps each one booked.
   The estimate's PDF on the event: of the PDFs on the estimate in Housecall Pro, the one with the approved amount in it
   (its text read by Google, as a receipt's is), copied into VODA Hub › Rebuild estimates, shared view-only with the
   vendor's Google account (whoever the rebuild calendar is shared with, read from the calendar's sharing; Script
   Property REBUILD_VENDOR_EMAIL instead, if it's there; no "shared with you" email; never anyone with the link)
   and attached to the event. Looked for when it's booked, then with the notes once an hour for a month (a PDF added
   later), until one is on it. Several with that amount: the one whose biggest amount it is (its total), then the
   newest. Each PDF read once. 90 days after it was approved the PDF is taken off the event and its copy goes in Drive's
   trash (only PDFs, one an estimate: Drive doesn't fill up). ---- */
const RB_SHEET = "Rebuild calendar";
const RB_COLS = ["Estimate id", "Estimate #", "Client", "Approved on", "Event id", "Booked at", "Status", "Title", "Notes added", "Notes checked at", "PDF", "PDFs read", "PDF file"];
const RB_PDF_PER_RUN = 5, RB_PDF_MAX = 25 * 1024 * 1024, RB_PDF_ON = "attached: ";   // PDFs read a run (Google reads each one: seconds)
// the PDF's copy in Drive: taken off the event and put in Drive's trash this many days after it was approved (Drive
// empties its trash itself 30 days later), a few a run
const RB_PDF_DAYS = 90, RB_PDF_GONE = "removed after 90 days: ", RB_EXPIRE_PER_RUN = 10;
const RB_NOTES_EVERY = 60 * 60e3, RB_NOTES_DAYS = 30, RB_NOTES_PER_RUN = 20;   // new Private notes: each estimate looked at once an hour, for a month, 20 a run
const RB_TITLE = "APPROVED - NEED TO SCHEDULE - ", RB_CANCEL = "CANCELED - ", RB_HOUR = 6, RB_NAME = "VODA rebuilds";
function rbSheet_() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(RB_SHEET);
  if (!s) { s = ss.insertSheet(RB_SHEET); s.setFrozenRows(1); }
  s.getRange(1, 1, 1, RB_COLS.length).setValues([RB_COLS]).setFontWeight("bold");   // (newer columns added to an older tab)
  return s;
}
/** Each estimate booked: by estimate id, { row (its row on the tab), rec }. */
function rbRead_(s) {
  const out = {};
  if (s.getLastRow() < 2) return out;
  s.getRange(2, 1, s.getLastRow() - 1, RB_COLS.length).getValues().forEach(function (r, i) {
    const id = String(r[0] || "").trim();
    let keys = [], read = [];
    try { keys = JSON.parse(String(r[8] || "[]")); } catch (e) { keys = []; }
    try { read = JSON.parse(String(r[11] || "[]")); } catch (e) { read = []; }
    const at = r[9] instanceof Date ? r[9].getTime() : Date.parse(String(r[9] || "")) || 0;
    const day = r[3] instanceof Date ? Utilities.formatDate(r[3], Session.getScriptTimeZone(), "yyyy-MM-dd") : String(r[3] || "");
    if (id) out[id] = { row: i + 2, rec: { event: String(r[4] || ""), status: String(r[6] || ""), day: day, keys: Array.isArray(keys) ? keys.map(String) : [], checked: at,
      pdf: String(r[10] || ""), read: Array.isArray(read) ? read.map(String) : [], file: String(r[12] || "") } };
  });
  return out;
}
/** The city in the title: the estimate's city, "Washington DC" for DC (st: its state, when the tab has none). */
function rbPlace_(r, st) {
  const city = String(r[5] || "").split(", ").slice(1).pop() || "";
  st = String(st || r[30] || "").trim().toUpperCase();
  return st === "DC" && city && !/\bDC$/i.test(city) ? city + " DC" : city;
}
/** The estimate's Private notes (and its options'), in Housecall Pro's order, once each: [{ k (its id), c (its text) }]. */
function rbNotes_(e) {
  const out = [], seen = {};
  const all = [].concat(Array.isArray(e && e.notes) ? e.notes : []);
  (Array.isArray(e && e.options) ? e.options : []).forEach(function (o) { if (o && Array.isArray(o.notes)) Array.prototype.push.apply(all, o.notes); });
  all.forEach(function (n) {
    const c = String((n && typeof n === "object" ? n.content : n) || "").replace(/\r/g, "").trim(), k = String((n && typeof n === "object" && n.id) || c);
    if (c && !seen[k]) { seen[k] = true; out.push({ k: k, c: c }); }
  });
  return out;
}
/** A note as calendar text: its own line breaks kept. */
function rbNoteHtml_(c) { return String(c).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>"); }
/** What a description says, without its formatting (to tell whether a note is in it already). */
function rbPlain_(html) { return String(html || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim(); }
/** One estimate from Housecall Pro, or null. */
function rbEstimate_(eid) {
  try { const g = hcpGet_("/estimates/" + encodeURIComponent(eid), {}); return g && !g.error && g.data ? (g.data.estimate || g.data) : null; } catch (e) { return null; }
}
/** "$1,605.84" */
function rbMoney_(dollars) { const c = Math.round((Number(dollars) || 0) * 100); return "$" + String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + String(c % 100).padStart(2, "0"); }
/** Puts what's newly approved on the calendar, and marks what's no longer approved. */
function rebuildBook_() {
  const P = PropertiesService.getScriptProperties(), id = String(P.getProperty("REBUILD_CALENDAR_ID") || "").trim();
  if (!id) return { ok: false, error: "no_calendar" };
  const cal = CalendarApp.getCalendarById(id);
  if (!cal) return { ok: false, error: "no_access" };
  const tz = Session.getScriptTimeZone(), today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  let from = String(P.getProperty("REBUILD_CALENDAR_FROM") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) { from = today; P.setProperty("REBUILD_CALENDAR_FROM", from); }
  const rows = estRows_(estSheet_(false)), s = rbSheet_(), have = rbRead_(s), now = new Date().toISOString();
  const out = { ok: true, booked: 0, canceled: 0, back: 0, from: from };
  Object.keys(rows).forEach(function (eid) {
    const r = rows[eid], x = have[eid], approved = String(r[9]) === "approved";
    if (String(r[6]) !== "p") return;   // Repairs only
    if (!x) {
      if (!approved) return;
      const day = r[11] && !isNaN(Date.parse(r[11])) ? Utilities.formatDate(new Date(r[11]), tz, "yyyy-MM-dd") : today;
      if (day < from) return;
      // the estimate from Housecall Pro now: its Private notes, and the whole address, state and phone when the tab has
      // none (an estimate read before they were kept there)
      const e = rbEstimate_(eid), notes = e ? rbNotes_(e) : [];
      let addr = String(r[29] || ""), st = String(r[30] || ""), phone = String(r[31] || "");
      if (e) { addr = addr || estAddress_(e.address); st = st || String((e.address && e.address.state) || ""); phone = phone || estPhone_(e.customer); }
      addr = addr || String(r[5] || "");
      const title = (RB_TITLE + rbPlace_(r, st) + " - " + String(r[4] || "No name")).slice(0, 250);
      // the client's phone, its Private notes, then what was approved and the vendor's share, in bold (as typed by hand before)
      const amt = Number(r[13]) || Number(r[12]) || 0, vendor = String(P.getProperty("REBUILD_VENDOR") || "").trim() || "Monumental";
      const share = Number(P.getProperty("REBUILD_SHARE")) > 0 && Number(P.getProperty("REBUILD_SHARE")) <= 100 ? Number(P.getProperty("REBUILD_SHARE")) : 70;
      const desc = (phone ? phone + "<br><br>" : "") + notes.map(function (n) { return rbNoteHtml_(n.c) + "<br><br>"; }).join("") + "<b>Approved is " + rbMoney_(amt) + "</b><br><b>" + vendor + " " + share + "% is " + rbMoney_(amt * share / 100) + "</b>";
      const start = Utilities.parseDate(day + " " + String(RB_HOUR).padStart(2, "0") + ":00", tz, "yyyy-MM-dd HH:mm");
      const ev = cal.createEvent(title, start, new Date(start.getTime() + 3600e3), { location: addr, description: desc });
      try { ev.setColor(CalendarApp.EventColor.RED); } catch (e) { /* the color is a nicety */ }
      const pdf = rbPdf_(eid, amt, ev.getId(), [], out, id);
      appendRows_(s, RB_COLS.length, [[eid, String(r[1]), String(r[4] || ""), day, ev.getId(), now, "booked", title, JSON.stringify(notes.map(function (n) { return n.k; })), now, pdf.status, JSON.stringify(pdf.read), pdf.file || ""]]);
      out.booked++;
      return;
    }
    // booked before: no longer approved, or approved again
    const ev = x.rec.event ? cal.getEventById(x.rec.event) : null;
    if (x.rec.status === "booked" && !approved) {
      if (ev && ev.getTitle().indexOf(RB_CANCEL) !== 0) ev.setTitle((RB_CANCEL + ev.getTitle()).slice(0, 250));
      s.getRange(x.row, 7).setValues([["canceled"]]); out.canceled++;
    } else if (x.rec.status === "canceled" && approved) {
      if (ev && ev.getTitle().indexOf(RB_CANCEL) === 0) ev.setTitle(ev.getTitle().slice(RB_CANCEL.length));
      s.getRange(x.row, 7).setValues([["booked"]]); out.back++;
    } else if (x.rec.status === "booked" && approved) rbNotesLater_(x, r, eid, ev, s, out, today, id);
    rbPdfExpire_(x, s, out, today, id);
  });
  return out;
}
/** Private notes written after it went on the calendar (and, for one booked before the phone and the whole address were
 *  kept, those too): once an hour for a month after it was approved, Housecall Pro is asked for the estimate; each new
 *  note goes in above the amounts (at the end if they were taken out). Only adds: anything typed on the calendar stays;
 *  a note already in the description isn't added again. */
function rbNotesLater_(x, r, eid, ev, s, out, today, calId) {
  if (!ev || (out.checked || 0) >= RB_NOTES_PER_RUN || Date.now() - x.rec.checked < RB_NOTES_EVERY) return;
  const dayMs = Date.parse(x.rec.day + "T12:00:00Z");
  if (dayMs && Date.parse(today + "T12:00:00Z") - dayMs > RB_NOTES_DAYS * 864e5) return;
  out.checked = (out.checked || 0) + 1;
  const e = rbEstimate_(eid), now = new Date().toISOString();
  if (!e) return;
  const keys = x.rec.keys.slice(), fresh = rbNotes_(e).filter(function (n) { return keys.indexOf(n.k) === -1; });
  let desc = String(ev.getDescription() || ""), plain = rbPlain_(desc), changed = false;
  const add = [];
  fresh.forEach(function (n) { keys.push(n.k); if (plain.indexOf(rbPlain_(rbNoteHtml_(n.c))) === -1) add.push(rbNoteHtml_(n.c) + "<br><br>"); });
  if (add.length) {
    const at = desc.search(/(<b>)?\s*Approved is /i);
    desc = at === -1 ? desc + (desc ? "<br><br>" : "") + add.join("").replace(/<br><br>$/, "") : desc.slice(0, at) + add.join("") + desc.slice(at);
    changed = true;
  }
  // the phone and the whole address, when it was booked without them
  const phone = String(r[31] || "") || estPhone_(e.customer), addr = String(r[29] || "") || estAddress_(e.address);
  if (phone && rbPlain_(desc).indexOf(phone) === -1) { desc = phone + "<br><br>" + desc; changed = true; }
  if (changed) ev.setDescription(desc);
  if (addr && typeof ev.getLocation === "function" && ev.getLocation() === String(r[5] || "")) ev.setLocation(addr);
  s.getRange(x.row, 9, 1, 2).setValues([[JSON.stringify(keys), now]]);
  if (add.length) out.notes = (out.notes || 0) + add.length;
  // its PDF, when none is on it yet (one added in Housecall Pro since)
  if (x.rec.pdf.indexOf(RB_PDF_ON) !== 0) {
    const pdf = rbPdf_(eid, Number(r[13]) || Number(r[12]) || 0, ev.getId(), x.rec.read, out, calId);
    s.getRange(x.row, 11, 1, 3).setValues([[pdf.status, JSON.stringify(pdf.read), pdf.file || ""]]);
    x.rec.pdf = pdf.status; x.rec.file = pdf.file || "";
  }
}
/** A Drive file's id from a calendar attachment (its fileId, else its link). */
function rbFileId_(a) {
  if (a && a.fileId) return String(a.fileId);
  const m = /\/d\/([A-Za-z0-9_-]{10,})|[?&]id=([A-Za-z0-9_-]{10,})/.exec(String((a && a.fileUrl) || ""));
  return m ? m[1] || m[2] : "";
}
/** The app's own PDF copy (in VODA Hub › Rebuild estimates), or null: never anything else. */
function rbOwnFile_(id, folderId) {
  if (!id) return null;
  try {
    const f = DriveApp.getFileById(id), it = f.getParents();
    while (it.hasNext()) if (it.next().getId() === folderId) return f;
  } catch (e) { /* gone */ }
  return null;
}
/** 90 days after it was approved: its PDF off the event (what the vendor attached stays) and the copy in Drive's trash. */
function rbPdfExpire_(x, s, out, today, calId) {
  if (x.rec.pdf.indexOf(RB_PDF_ON) !== 0 || (out.expired || 0) >= RB_EXPIRE_PER_RUN) return;
  const dayMs = Date.parse(x.rec.day + "T12:00:00Z");
  if (!dayMs || Date.parse(today + "T12:00:00Z") - dayMs <= RB_PDF_DAYS * 864e5) return;
  const folder = hubSub_("RB_FOLDER_ID").getId(), name = x.rec.pdf.slice(RB_PDF_ON.length), ids = {};
  if (x.rec.file) ids[x.rec.file] = true;
  // the event: the app's PDF taken off it
  if (x.rec.event && calId) {
    const url = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calId) + "/events/" + encodeURIComponent(String(x.rec.event).replace(/@google\.com$/, ""));
    const cur = rbGoogle_("get", url + "?fields=attachments,status");
    if (cur.code < 300 && cur.data && cur.data.status !== "cancelled") {
      const all = Array.isArray(cur.data.attachments) ? cur.data.attachments : [], keep = [];
      all.forEach(function (a) { const id = rbFileId_(a); if (id && (ids[id] || rbOwnFile_(id, folder))) ids[id] = true; else keep.push({ fileUrl: a.fileUrl, title: a.title, mimeType: a.mimeType }); });
      if (keep.length !== all.length) {
        const put = rbGoogle_("patch", url + "?supportsAttachments=true&fields=id", { attachments: keep });
        if (put.code >= 300) return;   // tried again next time
      }
    } else if (cur.code !== 404 && cur.code !== 410 && !(cur.data && cur.data.status === "cancelled")) return;   // not reachable now: next time
  }
  // booked before the copy's id was kept, and no longer on an event: by its name in the folder
  if (!Object.keys(ids).length && name) {
    const it = DriveApp.getFolderById(folder).getFiles();
    while (it.hasNext()) { const f = it.next(); if (f.getName() === name) ids[f.getId()] = true; }
  }
  Object.keys(ids).forEach(function (id) { const f = rbOwnFile_(id, folder); if (f) try { f.setTrashed(true); } catch (e) { /* gone */ } });
  s.getRange(x.row, 11, 1, 3).setValues([[RB_PDF_GONE + name, s.getRange(x.row, 12, 1, 1).getValues()[0][0], ""]]);
  out.expired = (out.expired || 0) + 1;
}
/** "11,636.44" written anywhere in the text (with or without its commas): the amount in cents. */
function rbHasAmount_(text, cents) {
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",?"), part = String(cents % 100).padStart(2, "0");
  return new RegExp("(^|[^\\d.,])" + whole + "\\." + part + "(?!\\d)").test(String(text || ""));
}
/** The biggest amount (with cents) in the text, in cents: an estimate's total. */
function rbTopAmount_(text) {
  let top = 0;
  (String(text || "").match(/\d{1,3}(?:,\d{3})+\.\d{2}(?!\d)|\d+\.\d{2}(?!\d)/g) || []).forEach(function (m) { top = Math.max(top, Math.round(Number(m.replace(/,/g, "")) * 100)); });
  return top;
}
/** The estimate's attachments in Housecall Pro (its own and its options'): [{ id, file_name, url, file_type, at }]. */
function rbAttachments_(eid) {
  let g = hcpGet_("/estimates/" + encodeURIComponent(eid), { "expand[]": "attachments" });
  if (g.error && g.error !== "no_key") g = hcpGet_("/estimates/" + encodeURIComponent(eid), {});
  if (g.error) return { error: g.error };
  const e = g.data ? (g.data.estimate || g.data) : {}, all = [].concat(Array.isArray(e.attachments) ? e.attachments : []), seen = {};
  (Array.isArray(e.options) ? e.options : []).forEach(function (o) { if (o && Array.isArray(o.attachments)) Array.prototype.push.apply(all, o.attachments); });
  return { list: all.filter(function (a) {
    const k = String((a && (a.id || a.url)) || "");
    if (!k || seen[k] || !a.url) return false;
    seen[k] = true; return true;
  }).map(function (a) { return { id: String(a.id || a.url), name: String(a.file_name || "Estimate.pdf"), url: String(a.url), type: String(a.file_type || ""), at: String(a.created_at || a.updated_at || "") }; }) };
}
/** One attachment's bytes: its link as Housecall Pro gives it (a signed link), else with the Housecall Pro key. */
function rbDownload_(url) {
  let res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() >= 300 && /^https:\/\/[^/]*housecallpro\.com\//i.test(url) && hcpKey_()) res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Authorization: "Token " + hcpKey_() } });
  return res.getResponseCode() < 300 ? res.getBlob() : null;
}
/** Google's own calls (Drive sharing, the calendar's attachments) as this account. */
function rbGoogle_(method, url, body) {
  const o = { method: method, muteHttpExceptions: true, headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() } };
  if (body) { o.contentType = "application/json"; o.payload = JSON.stringify(body); }
  const res = UrlFetchApp.fetch(url, o);
  let data = null;
  try { data = JSON.parse(res.getContentText() || "null"); } catch (e) { data = null; }
  return { code: res.getResponseCode(), data: data };
}
/** Who the PDFs are shared with: Script Property REBUILD_VENDOR_EMAIL if it's there, else the people the rebuild calendar
 *  is shared with (people and groups who see its events, not this account and not the calendar itself): { list } or
 *  { error }. Once a run. */
function rbVendors_(calId, out, P) {
  if (out.vendors) return out.vendors;
  const ok = function (m) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m); };
  const set = String(P.getProperty("REBUILD_VENDOR_EMAIL") || "").split(/[\s,;]+/).filter(ok);
  if (set.length) return (out.vendors = { list: set });
  const g = rbGoogle_("get", "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calId) + "/acl?maxResults=100");
  if (g.code >= 300) return (out.vendors = { error: "couldn't see who the rebuild calendar is shared with (" + g.code + ")" });
  let me = "";
  try { me = String(Session.getEffectiveUser().getEmail() || "").toLowerCase(); } catch (e) { me = ""; }
  const list = [];
  ((g.data && g.data.items) || []).forEach(function (a) {
    const sc = (a && a.scope) || {}, v = String(sc.value || "").toLowerCase();
    if ((sc.type === "user" || sc.type === "group") && /^(reader|writer|owner)$/.test(String(a.role || "")) && ok(v) && v !== me && !/calendar\.google\.com$/.test(v) && list.indexOf(v) === -1) list.push(v);
  });
  return (out.vendors = list.length ? { list: list } : { error: "the rebuild calendar isn't shared with anyone yet" });
}
/** The estimate's PDF with the approved amount on its calendar event: { status (for the tab), read (the PDFs read that
 *  didn't have it, not read again) }. */
function rbPdf_(eid, amt, evId, read, out, calId) {
  read = (read || []).slice();
  const cents = Math.round((Number(amt) || 0) * 100), P = PropertiesService.getScriptProperties();
  if (!cents || !evId || !calId) return { status: "", read: read };
  const who = rbVendors_(calId, out, P);
  if (who.error) return { status: "waiting: " + who.error, read: read };
  const emails = who.list;
  const got = rbAttachments_(eid);
  if (got.error) return { status: "Housecall Pro: " + got.error, read: read };
  const pdfs = got.list.filter(function (a) { return /pdf/i.test(a.type) || /\.pdf$/i.test(a.name); });
  if (!pdfs.length) return { status: "no PDF on the estimate yet", read: read };
  const hits = [];
  let left = false, err = "";
  pdfs.forEach(function (a) {
    if (read.indexOf(a.id) !== -1) return;
    if ((out.pdfReads || 0) >= RB_PDF_PER_RUN) { left = true; return; }
    out.pdfReads = (out.pdfReads || 0) + 1;
    try {
      const blob = rbDownload_(a.url);
      if (!blob) { err = "couldn't download " + a.name; return; }
      const bytes = blob.getBytes();
      if (rcptKind_(bytes) !== "application/pdf" || bytes.length > RB_PDF_MAX) { read.push(a.id); return; }
      const text = rcptOcr_(Utilities.newBlob(bytes, "application/pdf", a.name));
      if (rbHasAmount_(text, cents)) hits.push({ a: a, bytes: bytes, top: rbTopAmount_(text) === cents });
      else read.push(a.id);
    } catch (e) { err = "couldn't read " + a.name; }
  });
  const money = rbMoney_(cents / 100);
  if (!hits.length) return { status: left ? "more PDFs to read" : err ? "error: " + err : "no PDF with " + money + " yet (" + read.length + " read)", read: read };
  hits.sort(function (p, q) { return (q.top - p.top) || String(q.a.at).localeCompare(String(p.a.at)); });
  const best = hits[0].a, file = hubSub_("RB_FOLDER_ID").createFile(Utilities.newBlob(hits[0].bytes, "application/pdf", best.name));
  const drop = function (why) { try { file.setTrashed(true); } catch (e) { /* gone */ } return { status: "error: " + why, read: read }; };
  // view-only for the vendor's account, without Drive's "shared with you" email
  for (let i = 0; i < emails.length; i++) {
    const sh = rbGoogle_("post", "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file.getId()) + "/permissions?sendNotificationEmail=false&fields=id",
      { type: "user", role: "reader", emailAddress: emails[i] });
    if (sh.code >= 300) return drop("couldn't share the PDF (" + sh.code + ")");
  }
  // on the event, after any attachments already on it
  const evUrl = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calId) + "/events/" + encodeURIComponent(String(evId).replace(/@google\.com$/, ""));
  const cur = rbGoogle_("get", evUrl + "?fields=attachments");
  if (cur.code >= 300) return drop("couldn't open the event (" + cur.code + ")");
  const list = (cur.data && Array.isArray(cur.data.attachments) ? cur.data.attachments : []).map(function (x) { return { fileUrl: x.fileUrl, title: x.title, mimeType: x.mimeType }; });
  list.push({ fileUrl: "https://drive.google.com/file/d/" + file.getId() + "/view?usp=drivesdk", title: best.name, mimeType: "application/pdf" });
  const put = rbGoogle_("patch", evUrl + "?supportsAttachments=true&fields=id", { attachments: list.slice(-25) });
  if (put.code >= 300) return drop("couldn't attach it to the event (" + put.code + ")");
  out.pdfs = (out.pdfs || 0) + 1;
  return { status: RB_PDF_ON + best.name, read: read, file: file.getId() };
}
/** Every 15 minutes (rebuildCalendarSetup turns it on): what changed in Housecall Pro, then the calendar. */
function rebuildCalendarTick() {
  try {
    const t0 = Date.now();
    let page = 1;
    for (let i = 0; i < 30 && Date.now() - t0 < 240e3; i++) { const r = estSync_({ page: page }, null); if (!r || !r.ok || !r.next) break; page = r.next; }
  } catch (e) { /* Housecall Pro not answering: book from what's on the tab */ }
  return withLock_(rebuildBook_);
}
/** Run once from the script editor (Run > rebuildCalendarSetup) after adding REBUILD_CALENDAR_ID in Project Settings >
 *  Script Properties: Google asks for the calendar permission, the 15-minute check is turned on, and it runs once now. */
function rebuildCalendarSetup() {
  const P = PropertiesService.getScriptProperties();
  let id = String(P.getProperty("REBUILD_CALENDAR_ID") || "").trim();
  if (!id) {
    // no ID typed in (Script Properties can't be added by hand past 50): the calendar called "VODA rebuilds"
    const name = String(P.getProperty("REBUILD_CALENDAR_NAME") || "").trim() || RB_NAME;
    const found = CalendarApp.getCalendarsByName(name) || [];
    if (found.length !== 1) { Logger.log(found.length ? "More than one calendar is called \"" + name + "\": rename the extra ones, then run this again." : "No calendar called \"" + name + "\" in this account: make it in Google Calendar (Settings > Add calendar > Create new calendar), then run this again."); return; }
    id = found[0].getId();
    P.setProperty("REBUILD_CALENDAR_ID", id);
  }
  const cal = CalendarApp.getCalendarById(id);
  if (!cal) { Logger.log("This Google account can't open that calendar. Check the ID, and that the calendar is this account's or shared with it (Make changes to events)."); return; }
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "rebuildCalendarTick") ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger("rebuildCalendarTick").timeBased().everyMinutes(15).create();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(P.getProperty("REBUILD_CALENDAR_FROM") || ""))) P.setProperty("REBUILD_CALENDAR_FROM", Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"));
  Logger.log("On: every 15 minutes, Repairs estimates approved from " + P.getProperty("REBUILD_CALENDAR_FROM") + " on go on \"" + cal.getName() + "\". " + JSON.stringify(rebuildCalendarTick()));
}

/* ---- Price changes: a job's amount changed in Housecall Pro after the app saw it (a discount, a reduction, more work,
   a job from months ago edited), on a later day than the job (see priceLastDay_). Every hour the script asks Housecall Pro for the jobs changed most recently and compares
   each one's amount with the last one the app saw (the Price watch tab, else the Revenue tab's day). A difference is a
   warning on the Price changes tab, with the job's Private notes (why it changed, if someone wrote it): admins see them
   on Operations; an admin switched on for it marks each one checked. Housecall Pro's API doesn't say who changed it (its
   Activity feed isn't in the API). ---- */
const PRICE_SHEET = "Price changes", WATCH_SHEET = "Price watch";
const PRICE_COLS = ["ID", "Noticed", "Last noticed", "Changes", "Job id", "Job #", "Client", "Visit day", "Department", "Job type", "Was $", "Now $",
  "Change $", "Was seen", "Private notes", "New note", "Status", "Checked by", "Checked at", "Check note", "Monumental", "Job status"];
const WATCH_COLS = ["Job id", "Job #", "Amount $", "Notes", "Seen"];
const PRICE_PAGES = 10, PRICE_AT = "PRICE_SCAN_AT", PRICE_ERR = "PRICE_SCAN_ERR";
// A job's amount settles at the end of the job's day (its start, end or when it was finished, whichever is latest): a
// change on that day or before it is the crew's sale on the day or the office's estimate before the job, kept as the
// amount without a warning; a change on any later day (yesterday's invoice edited this morning) is a price change to
// check. (Until API 122 it was 24 hours after the job, which let the next morning's edits through.)
// A finished job's change after it was finished is a price change too, even that day (an invoice edited minutes after
// "Job finished"). Housecall Pro says only when the job last changed, not when its amount did, so: after it was finished
// = the app saw the amount after the job was finished, or the job's last change is more than PRICE_DONE_GRACE after it
// was finished and isn't a payment taken then (paid after finishing: the amount may well be the crew's sale before).
const PRICE_DONE_GRACE = 2 * 60e3, PRICE_PAY_NEAR = 3 * 60e3, PRICE_PAY_READS = 30;
const priceDoneMs_ = job => Date.parse((job && job.work_timestamps && job.work_timestamps.completed_at) || "") || 0;
/** The job's last day, yyyy-MM-dd in the script's time zone: its start, end or when it was finished, whichever is
 *  latest; "" when it has none of them. */
function priceLastDay_(job, tz) {
  const ts = [job && job.schedule && job.schedule.scheduled_start, job && job.schedule && job.schedule.scheduled_end, job && job.work_timestamps && job.work_timestamps.completed_at]
    .map(function (v) { return Date.parse(v || "") || 0; });
  const last = Math.max.apply(null, ts);
  return last ? Utilities.formatDate(new Date(last), tz, "yyyy-MM-dd") : "";
}
/** Marks price changes checked (and sees them): anyone switched on for it, an admin or not. */
function canPriceCheck_(user) { return !!user && user.status !== "disabled" && parseAccess_(user.access).indexOf(PRICE_CHECK) !== -1; }
function priceSheet_(name, cols) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange("A:A").setNumberFormat("@");
  }
  return s;
}
const priceNotes_ = job => (Array.isArray(job && job.notes) ? job.notes : []).map(function (n) {
  return [String((n && n.id) || ""), String((n && n.content) || "").replace(/\s+/g, " ").trim().slice(0, 600)];
}).filter(function (n) { return n[1]; });
/** The hourly check (a time trigger; Check now in the app). Reads the jobs changed since the last check (the first time:
 *  the last day), newest first, up to PRICE_PAGES pages of 100. */
function priceScan(e) {
  const out = priceScan_();
  PropertiesService.getScriptProperties().setProperty(PRICE_ERR, out.ok ? "" : String(out.error || "error"));
  // the hourly run (a trigger: e is its event): Operations' invoices not sent read again too, so the app finds them ready
  if (e && e.triggerUid) { try { unsentRead_({ force: true }); } catch (err) { /* the app reads them itself then */ } }
  return out;
}
function priceScan_() {
  const P = PropertiesService.getScriptProperties(), now = Date.now(), last = Number(P.getProperty(PRICE_AT)) || 0;
  const since = last ? last - 15 * 60e3 : now - 24 * 3600e3;   // a quarter hour's overlap, so nothing slips between checks
  const got = [];
  for (let page = 1; page <= PRICE_PAGES; page++) {
    const r = hcpGet_("/jobs", { sort_by: "updated_at", sort_direction: "desc", page: page, page_size: 100 });
    if (r.error) return { ok: false, error: r.error, status: r.status || 0 };
    const list = Array.isArray(r.data && r.data.jobs) ? r.data.jobs : [];
    let older = false;
    for (let i = 0; i < list.length; i++) { if ((Date.parse(list[i].updated_at) || 0) < since) { older = true; break; } got.push(list[i]); }
    if (older || !list.length || page >= (Number(r.data && r.data.total_pages) || 1)) break;
  }
  // finished jobs whose last change came after they were finished, on their day: when each was paid (a payment then
  // explains the change), read before the lock
  const tz = Session.getScriptTimeZone(), paid = {};
  const late = got.filter(function (j) {
    const done = priceDoneMs_(j), upd = Date.parse(j.updated_at || "") || 0, lastDay = priceLastDay_(j, tz);
    return j && j.id && done && upd > done + PRICE_DONE_GRACE && lastDay && Utilities.formatDate(new Date(upd), tz, "yyyy-MM-dd") <= lastDay;
  }).filter(function (j, i, a) { return a.findIndex(function (x) { return x.id === j.id; }) === i; }).slice(0, PRICE_PAY_READS);
  if (late.length) hcpGetAll_(late.map(function (j) { return { path: "/jobs/" + encodeURIComponent(j.id) + "/invoices" }; })).forEach(function (r, k) {
    const d = (r && r.data) || {}, list = Array.isArray(d) ? d : Array.isArray(d.invoices) ? d.invoices : Array.isArray(d.data) ? d.data : null;
    if (!list) return;   // not read: as if paid then (no warning on a guess)
    const at = [];
    list.forEach(function (i) {
      (Array.isArray(i && i.payments) ? i.payments : []).forEach(function (p) { const t = Date.parse((p && (p.paid_at || p.created_at || p.date)) || ""); if (t) at.push(t); });
      const t = Date.parse((i && i.paid_at) || ""); if (t) at.push(t);
    });
    paid[String(late[k].id)] = at;
  });
  const out = withLock_(function () { return priceCompare_(got, now, paid); });
  // the jobs put on the schedule (Office Scorecard's booked jobs): never in the way of the price changes
  try { out.booked = bkStep_(got, now); P.setProperty(BK_ERR, ""); }
  catch (e) { out.booked = null; P.setProperty(BK_ERR, String((e && e.message) || e).slice(0, 200)); }
  return out;
}
/** Each job changed: its amount against the last one seen; a difference is a warning (one open warning a job: a later
 *  change updates it). Then what was seen is kept, and the day of a changed job is read again on Revenue. */
function priceCompare_(jobs, now, paid) {
  const P = PropertiesService.getScriptProperties(), tz = Session.getScriptTimeZone(), at = new Date(now).toISOString();
  const ws = priceSheet_(WATCH_SHEET, WATCH_COLS), wrows = ws.getLastRow() > 1 ? ws.getRange(2, 1, ws.getLastRow() - 1, WATCH_COLS.length).getValues() : [];
  const watch = {};
  wrows.forEach(function (r, i) { if (r[0]) watch[String(r[0])] = { i: i, inv: String(r[1] || ""), c: Math.round((Number(r[2]) || 0) * 100), notes: priceJson_(r[3]), at: r[4] instanceof Date ? r[4].toISOString() : String(r[4] || "") }; });
  let rev = null;   // the Revenue tab's visits (only read if a job isn't on Price watch yet): id → [cents, day, read at]
  const revOf = function (id) {
    if (!rev) {
      rev = {};
      const rows = revRows_(revSheet_(false));
      Object.keys(rows).forEach(function (d) { priceJson_(rows[d][14]).forEach(function (v) { if (v && v[0]) rev[String(v[0])] = [Math.round(Number(v[4]) || 0), d, rows[d][10]]; }); });
    }
    return rev[id] || null;
  };
  const ps = priceSheet_(PRICE_SHEET, PRICE_COLS), prows = ps.getLastRow() > 1 ? ps.getRange(2, 1, ps.getLastRow() - 1, PRICE_COLS.length).getValues() : [];
  const openOf = {};
  prows.forEach(function (r, i) { if (r[0] && String(r[16]) === "open") openOf[String(r[4])] = i; });
  const stale = {}, added = [];
  let found = 0;
  const seen = {};
  jobs.forEach(function (job) {
    const id = String((job && job.id) || "");
    if (!id || seen[id]) return;
    seen[id] = true;
    const cents = Math.round(Number(job.total_amount) || 0), notes = priceNotes_(job), w = watch[id];
    let was = null, wasAt = "", known = null;
    if (w) { was = w.c; wasAt = w.at; known = w.notes; }
    else { const v = revOf(id); if (v) { was = v[0]; wasAt = v[2]; } }
    // changed on the job's day or before it (a sale on the day, the estimate before): the amount it is now, no warning
    const lastDay = priceLastDay_(job, tz), changedDay = Utilities.formatDate(new Date(Date.parse(job.updated_at || "") || now), tz, "yyyy-MM-dd");
    // ... unless it was changed after the job was finished (see PRICE_DONE_GRACE)
    const done = priceDoneMs_(job), upd = Date.parse(job.updated_at || "") || 0, pays = paid && paid[id];
    const afterDone = !!done && ((w && (Date.parse(w.at) || 0) > done) ||
      (upd > done + PRICE_DONE_GRACE && Array.isArray(pays) && !pays.some(function (t) { return Math.abs(t - upd) <= PRICE_PAY_NEAR; })));
    if (was !== null && was !== cents && lastDay && changedDay <= lastDay && openOf[id] === undefined && !afterDone) {   // (no date at all: as before)
      const st0 = new Date((job.schedule && job.schedule.scheduled_start) || "");
      if (!isNaN(st0.getTime())) stale[Utilities.formatDate(st0, tz, "yyyy-MM-dd")] = true;   // its day's totals read again
    } else if (was !== null && was !== cents) {
      const start = new Date((job.schedule && job.schedule.scheduled_start) || ""), day = isNaN(start.getTime()) ? "" : Utilities.formatDate(start, tz, "yyyy-MM-dd");
      const type = hcpJobType_(job), tags = (Array.isArray(job.tags) ? job.tags : []).map(function (t) { return typeof t === "object" && t ? (t.name || "") : String(t); });
      const fresh = known ? notes.filter(function (n) { return !known.some(function (k) { return k[0] === n[0] && k[1] === n[1]; }); }).map(function (n) { return n[0]; }) : null;
      const shown = JSON.stringify(notes.map(function (n) { return { c: n[1], n: fresh && fresh.indexOf(n[0]) !== -1 ? 1 : 0 }; }));
      const i = openOf[id];
      if (i !== undefined) {
        // still open: the latest amount on it (the change from the amount first seen), its notes, one more change
        const r = prows[i];
        r[2] = at; r[3] = (Number(r[3]) || 1) + 1; r[11] = cents / 100; r[12] = Math.round(cents - Math.round((Number(r[10]) || 0) * 100)) / 100;
        r[14] = shown; const n0 = String(r[15] || "");
        r[15] = n0 === "yes" || (fresh && fresh.length) ? "yes" : n0;   // a note since the amount first seen: yes; else as it was r[21] = String(job.work_status || "");
      } else {
        const row = [Utilities.getUuid(), at, at, 1, id, String(job.invoice_number || ""), hcpClient_(job), day, revDept_(type), type, was / 100, cents / 100,
          (cents - was) / 100, wasAt, shown, fresh ? (fresh.length ? "yes" : "no") : "", "open", "", "", "", tags.some(function (t) { return REP_MON_TAG.test(t); }) ? "yes" : "", String(job.work_status || "")];
        openOf[id] = prows.length; prows.push(row); added.push(row);
      }
      found++;
      if (day) stale[day] = true;
    }
    const keep = [id, String(job.invoice_number || ""), cents / 100, JSON.stringify(notes), at];
    if (w) wrows[w.i] = keep; else { watch[id] = { i: wrows.length }; wrows.push(keep); }
  });
  if (wrows.length) { ws.getRange(2, 1, wrows.length, WATCH_COLS.length).setValues(wrows); ws.getRange(2, 1, wrows.length, 1).setNumberFormat("@"); }
  if (prows.length) { ps.getRange(2, 1, prows.length, PRICE_COLS.length).setValues(prows); ps.getRange(2, 1, prows.length, 1).setNumberFormat("@"); }
  // the days of changed jobs: read again on Revenue (and so on Operations' totals and the goal)
  const days = Object.keys(stale);
  if (days.length) {
    const rs = revSheet_(false);
    if (rs && rs.getLastRow() > 1) rs.getRange(2, 1, rs.getLastRow() - 1, 1).getValues().forEach(function (r, i) {
      const d = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, "yyyy-MM-dd") : String(r[0] || "").trim();
      if (stale[d]) rs.getRange(i + 2, 11).setValues([[""]]);
    });
  }
  P.setProperty(PRICE_AT, String(now));
  return { ok: true, read: jobs.length, found: found, added: added.length };
}
function priceJson_(v) { try { const x = JSON.parse(String(v || "[]")); return Array.isArray(x) ? x : []; } catch (e) { return []; } }
/** The warning as the app gets it. */
function priceOut_(r) {
  return { id: String(r[0]), noticed: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), last: r[2] instanceof Date ? r[2].toISOString() : String(r[2]),
    changes: Number(r[3]) || 1, job: String(r[4]), inv: String(r[5]), client: String(r[6]), day: r[7] instanceof Date ? Utilities.formatDate(r[7], Session.getScriptTimeZone(), "yyyy-MM-dd") : String(r[7] || ""),
    dept: String(r[8] || "o"), type: String(r[9] || ""), was: Math.round((Number(r[10]) || 0) * 100), now: Math.round((Number(r[11]) || 0) * 100),
    wasAt: r[13] instanceof Date ? r[13].toISOString() : String(r[13] || ""), notes: priceJson_(r[14]), newNote: String(r[15] || ""), status: String(r[16]),
    by: String(r[17] || ""), at: r[18] instanceof Date ? r[18].toISOString() : String(r[18] || ""), note: String(r[19] || ""), mon: String(r[20]) === "yes", ws: String(r[21] || "") };
}
/** An admin: the open warnings and the last 50 checked, when the last check ran and whether it runs by itself. Check now
 *  (scan), or no check for 2 hours: one now. The hourly check is set up the first time. */
/** The hourly check's time trigger, set up the first time: is it there? */
function priceTrigger_() {
  try {
    if (ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "priceScan"; })) return true;
    ScriptApp.newTrigger("priceScan").timeBased().everyHours(1).create();
    return true;
  } catch (e) { return false; }
}
function priceList_(user, scan) {
  const P = PropertiesService.getScriptProperties();
  const trigger = priceTrigger_();
  let err = String(P.getProperty(PRICE_ERR) || "");
  if (hcpKey_() && (scan || Date.now() - (Number(P.getProperty(PRICE_AT)) || 0) > 2 * 3600e3)) { const out = priceScan(); err = out.ok ? "" : String(out.error || "error"); }
  const s = SpreadsheetApp.getActive().getSheetByName(PRICE_SHEET), rows = s && s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, PRICE_COLS.length).getValues().filter(function (r) { return r[0]; }) : [];
  const all = rows.map(priceOut_);
  const open = all.filter(function (x) { return x.status === "open"; }).sort(function (a, b) { return a.last < b.last ? 1 : -1; });
  const checked = all.filter(function (x) { return x.status === "checked"; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 50);
  return { ok: true, open: open, checked: checked, scanAt: Number(P.getProperty(PRICE_AT)) || 0, err: err, trigger: trigger, connected: !!hcpKey_(), mayCheck: canPriceCheck_(user) };
}
/** History by dates ({ from, to }: yyyy-MM-dd, a year at most): every price change made in those days (the day it was
 *  noticed in Housecall Pro), checked or still to check, newest first; and the money: removed (cuts), added (raises),
 *  the net, how many of each, and how many still to check. */
const PRICE_HIST_MAX = 400;
function priceHistory_(req) {
  const isDay = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")); };
  const from = String(req.from || ""), to = String(req.to || "");
  if (!isDay(from) || !isDay(to) || from > to || to > tmAddDays_(from, 366)) return { ok: false, error: "bad_request" };
  const tz = Session.getScriptTimeZone(), s = SpreadsheetApp.getActive().getSheetByName(PRICE_SHEET);
  const rows = s && s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, PRICE_COLS.length).getValues().filter(function (r) { return r[0]; }) : [];
  const dayOf = function (v) { const d = v instanceof Date ? v : new Date(String(v || "")); return isNaN(d.getTime()) ? "" : Utilities.formatDate(d, tz, "yyyy-MM-dd"); };
  const list = rows.filter(function (r) { const d = dayOf(r[1]); return d && d >= from && d <= to && (String(r[16]) === "open" || String(r[16]) === "checked"); }).map(priceOut_)
    .sort(function (a, b) { return a.noticed < b.noticed ? 1 : a.noticed > b.noticed ? -1 : 0; });
  const t = { removed: 0, added: 0, cuts: 0, raises: 0, open: 0, openNet: 0 };
  list.forEach(function (w) {
    const d = w.now - w.was;
    if (d < 0) { t.removed += -d; t.cuts++; } else if (d > 0) { t.added += d; t.raises++; }
    if (w.status === "open") { t.open++; t.openNet += d; }
  });
  t.net = t.added - t.removed;
  return { ok: true, from: from, to: to, tot: t, n: list.length, list: list.slice(0, PRICE_HIST_MAX), more: Math.max(0, list.length - PRICE_HIST_MAX) };
}
/** An admin switched on for it: marks warnings checked ({ ids, note }), with his name and when. */
function priceCheck_(req, user) {
  const ids = (Array.isArray(req.ids) ? req.ids : []).map(String).filter(Boolean);
  if (!ids.length || ids.length > 500) return { ok: false, error: "bad_request" };
  const s = SpreadsheetApp.getActive().getSheetByName(PRICE_SHEET);
  if (!s || s.getLastRow() < 2) return { ok: false, error: "gone" };
  const rows = s.getRange(2, 1, s.getLastRow() - 1, PRICE_COLS.length).getValues(), at = new Date().toISOString(), note = String(req.note || "").replace(/\s+/g, " ").trim().slice(0, 300);
  let n = 0;
  rows.forEach(function (r) { if (ids.indexOf(String(r[0])) !== -1 && String(r[16]) === "open") { r[16] = "checked"; r[17] = String(user.name || "").slice(0, 60); r[18] = at; r[19] = note; n++; } });
  if (!n) return { ok: false, error: "gone" };
  s.getRange(2, 1, rows.length, PRICE_COLS.length).setValues(rows);
  return Object.assign(priceList_(user, false), { checkedNow: n });
}
/** Who marks price changes checked (and sees them): anyone, an admin or a technician; switched on or off by an admin who
 *  sees VODA Payroll or checks price changes himself (for anyone, himself too); the first time, by any admin. */
function setPriceCheck_(req) {
  const s = usersSheet_(), all = readUsers_(s);
  const x = all.filter(function (y) { return y.u.id === String(req.id || ""); })[0];
  if (!x) return { ok: false, error: "gone" };
  const has = function (u, F) { return u.role === "admin" && u.status === "active" && parseAccess_(u.access).indexOf(F) !== -1; };
  const me = all.filter(function (y) { return y.u.id === req.user.id; })[0];
  const anyone = all.some(function (y) { return y.u.status === "active" && parseAccess_(y.u.access).indexOf(PRICE_CHECK) !== -1; });
  if (anyone ? !(me && (has(me.u, PRICE_CHECK) || has(me.u, PAYROLL))) : !req.on) return { ok: false, error: "not_allowed" };
  const access = parseAccess_(x.u.access).filter(function (a) { return a !== PRICE_CHECK; });
  if (req.on) access.push(PRICE_CHECK);
  if (accessText_(access) !== accessText_(parseAccess_(x.u.access))) { x.u.access = accessText_(access); writeUser_(s, x.rowIndex, x.u); }
  return { ok: true, user: publicUser_(x.u) };
}
/** Run once from the script editor if the app says the hourly check isn't set up: Run > priceWatchSetup. */
function priceWatchSetup() {
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "priceScan") ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger("priceScan").timeBased().everyHours(1).create();
  Logger.log(JSON.stringify(priceScan()));
}

/* ---- Booked jobs (Office › Office Scorecard, Admins only): each office person's jobs on the schedule for a day (the day
   of their first visit), whenever she booked them: how many, their amount when booked (the booked revenue) and, once
   serviced, what they came to (the increase or decrease). The hourly check of Price changes reads the jobs changed most
   recently; once a day it also reads every job on the schedule from today on (BK_AHEAD_DAYS), so the ones booked before
   the app kept them, and not changed since, are there too (their amount: the one first seen). Who booked it: a tag on
   the job in Housecall Pro ("Booked: <name>"), else a Booked mark in the app for the same client (Past clients: the
   client, within BK_MARK_DAYS of the day it was booked; Office › Estimates and Today's calls: the job made from that
   estimate, else a job for the same client's name within BK_MARK_DAYS). Housecall Pro's API doesn't say who made a job
   (its Activity feed isn't in the API). Kept from the first check after this was added (BK_FROM): jobs made since, and
   jobs on the schedule from that day on. One row a visit on the Bookings tab; a job's visits ("1234-2") are one job. ---- */
const BK_SHEET = "Bookings";
const BK_COLS = ["Job id", "Job #", "Created at", "First seen", "Booked day", "Booked at", "Booked $", "Service day", "Tagged by", "Customer id", "Client",
  "From estimate", "Now $", "Job status", "Done at", "Last seen", "Card fee $", "Fee read at $", "Tags", "Job type", "Owes $"];
const BK = { day: 4, at: 5, bc: 6, svc: 7, tag: 8, cust: 9, client: 10, est: 11, now: 12, st: 13, done: 14, seen: 15, fee: 16, feeAt: 17, tags: 18, type: 19, owes: 20 };
const BK_FROM = "BK_FROM", BK_ERR = "BK_ERR", BK_AHEAD = "BK_AHEAD_DAY";
const BK_AHEAD_DAYS = 93;  // once a day: the jobs on the schedule for today and the next 3 months
const BK_BACK_DAYS = 14;   // ... and the last two weeks' (a job finished or paid since it last changed)
const BK_AHEAD_V = "|b";   // the daily read's version (a new one reads again the same day: after an update)
/** Done: finished in Housecall Pro, or its invoice paid in full (it came to something, nothing owed) once its day has
 *  gone by (a tech who didn't tap Finish). */
function bkPaid_(cents, owes, svcDay, today) { return cents > 0 && owes === 0 && !!svcDay && svcDay < today; }
const bkOwes_ = function (job) { return job.outstanding_balance === undefined || job.outstanding_balance === null || job.outstanding_balance === "" ? null : Math.round(Number(job.outstanding_balance) || 0); };
const BK_FEE_MAX = 25;     // serviced jobs' card fees read a check (their line items); the rest at the next one
const BK_MARK_DAYS = 3;    // a Booked mark counts for a job booked up to 3 days before or after it
/** The name on a "Booked: <name>" tag (also "Booked by <name>", "Booked - <name>"), or "". */
function bkTagWho_(tags) {
  const list = (Array.isArray(tags) ? tags : []).map(function (t) { return String((t && typeof t === "object" ? t.name : t) || "").trim(); });
  for (let i = 0; i < list.length; i++) {
    const m = /^booked\s*(?:by\b\s*[:\-–]?|[:\-–])\s*(.+)$/i.exec(list[i]);
    if (m && m[1].trim()) return m[1].replace(/\s+/g, " ").trim().slice(0, 40);
  }
  return "";
}
const bkNum_ = function (v) { return v === "" || v === null || v === undefined || !isFinite(Number(v)) ? null : Math.round(Number(v) * 100); };
const bkIso_ = function (v) { return v instanceof Date ? (isNaN(v.getTime()) ? "" : v.toISOString()) : String(v || ""); };
/** The day a job is on the schedule for (its scheduled start, in the script's time zone), or "". */
function bkSvcDay_(job, tz) {
  const d = new Date((job && job.schedule && job.schedule.scheduled_start) || "");
  return isNaN(d.getTime()) ? "" : Utilities.formatDate(d, tz, "yyyy-MM-dd");
}
function bkRows_() {
  const s = SpreadsheetApp.getActive().getSheetByName(BK_SHEET);
  return s && s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, BK_COLS.length).getValues().filter(function (r) { return r[0]; }) : [];
}
/** After each check: the jobs it read, and once a day every job on the schedule from today on, kept on the Bookings tab
 *  (those made since BK_FROM, and those on the schedule from its day on). A serviced job's card fee (a "Credit Card
 *  Service Charge" line) is read once for each amount it's serviced at, before the tab is locked. */
function bkStep_(jobs, now) {
  const P = PropertiesService.getScriptProperties(), tz = Session.getScriptTimeZone();
  let from = String(P.getProperty(BK_FROM) || "");
  if (!from) { from = new Date(now).toISOString(); P.setProperty(BK_FROM, from); }
  const fromMs = Date.parse(from) || now, fromDay = Utilities.formatDate(new Date(fromMs), tz, "yyyy-MM-dd");
  const today = Utilities.formatDate(new Date(now), tz, "yyyy-MM-dd");
  let list = (jobs || []).slice(), ahead = 0;
  if (String(P.getProperty(BK_AHEAD) || "") !== today + BK_AHEAD_V) {
    let ok = true;
    for (let k = -BK_BACK_DAYS; k < BK_AHEAD_DAYS && ok; k += HCP_MAX_DAYS) {   // the last two weeks, today and the next 3 months
      const to = Math.min(k + HCP_MAX_DAYS, k < 0 ? 0 : BK_AHEAD_DAYS) - 1;
      const got = hcpJobsIn_(tmAddDays_(today, k), tmAddDays_(today, to));
      if (got.error) ok = false;
      else { list = list.concat(got.jobs); ahead += got.jobs.length; }
      if (k < 0) k = -HCP_MAX_DAYS;   // then from today
    }
    if (ok) P.setProperty(BK_AHEAD, today + BK_AHEAD_V);
  }
  const once = {};
  const mine = list.filter(function (j) {
    if (!j || !j.id || once[j.id]) return false;
    once[j.id] = true;
    if ((Date.parse(j.created_at || "") || 0) >= fromMs) return true;
    const d = bkSvcDay_(j, tz);
    return !!d && d >= fromDay;
  });
  if (!mine.length) return { kept: 0, ahead: ahead };
  const had = {};
  bkRows_().forEach(function (r) { had[String(r[0])] = r; });
  const fee = {};
  let reads = 0;
  mine.forEach(function (j) {
    const cents = Math.round(Number(j.total_amount) || 0), r = had[String(j.id)];
    if (!/complete/i.test(String(j.work_status || "")) && !bkPaid_(cents, bkOwes_(j), bkSvcDay_(j, tz), today)) return;
    if (r && bkNum_(r[BK.feeAt]) === cents) return;   // read at this amount already
    if (!cents) { fee[j.id] = 0; return; }
    if (reads >= BK_FEE_MAX) return;
    reads++;
    const f = repJobFee_(j.id);
    if (f !== null) fee[j.id] = f;
  });
  const out = withLock_(function () { return bkKeep_(mine, now, fee); });
  out.ahead = ahead;
  return out;
}
function bkKeep_(jobs, now, fee) {
  const tz = Session.getScriptTimeZone(), at = new Date(now).toISOString();
  const s = priceSheet_(BK_SHEET, BK_COLS);
  if (typeof s.getLastColumn === "function" && s.getLastColumn() < BK_COLS.length) s.getRange(1, 1, 1, BK_COLS.length).setValues([BK_COLS]).setFontWeight("bold");   // a column added since (Job type)
  const rows = s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, BK_COLS.length).getValues() : [];
  const at_ = {};
  rows.forEach(function (r, i) { if (r[0]) at_[String(r[0])] = i; });
  const dayOf = function (v) { const d = new Date(v || ""); return isNaN(d.getTime()) ? "" : Utilities.formatDate(d, tz, "yyyy-MM-dd"); };
  let added = 0, booked = 0;
  jobs.forEach(function (job) {
    const id = String(job.id), cents = Math.round(Number(job.total_amount) || 0), st = String(job.work_status || "");
    const wt = job.work_timestamps || {}, sch = job.schedule || {};
    const started = !!(wt.on_my_way_at || wt.started_at || wt.completed_at) || /progress|complete/i.test(st);
    let i = at_[id];
    const first = i === undefined;
    if (first) {
      const r0 = [];
      for (let c = 0; c < BK_COLS.length; c++) r0.push("");
      r0[0] = id; r0[2] = String(job.created_at || ""); r0[3] = at;
      i = rows.length; at_[id] = i; rows.push(r0); added++;
    }
    const r = rows[i];
    if (!pcDay_(r[BK.day], tz) && (sch.scheduled_start || started) && !/cancel/i.test(st)) {
      // put on the schedule: when it was made (seen the first time), else the change that scheduled it. Its amount then
      // is the booked revenue; one first seen after the visit started: not known
      const when = (first ? String(job.created_at || "") : String(job.updated_at || "")) || at;
      r[BK.day] = dayOf(when) || dayOf(at); r[BK.at] = when; r[BK.bc] = started ? "" : cents / 100; booked++;
    } else if (pcDay_(r[BK.day], tz) && !started && bkNum_(r[BK.bc]) === 0 && cents > 0) r[BK.bc] = cents / 100;   // priced after it was made, before the visit
    const ests = [job.original_estimate_id].concat(Array.isArray(job.original_estimate_uuids) ? job.original_estimate_uuids : [])
      .map(function (x) { return String(x || "").trim(); }).filter(function (x, k, a) { return x && a.indexOf(x) === k; });
    const tags = (Array.isArray(job.tags) ? job.tags : []).map(function (t) { return String((t && typeof t === "object" ? t.name : t) || "").trim(); }).filter(Boolean);
    r[1] = String(job.invoice_number || ""); r[BK.svc] = bkSvcDay_(job, tz); r[BK.tag] = bkTagWho_(job.tags);
    r[BK.cust] = String((job.customer && job.customer.id) || job.customer_id || ""); r[BK.client] = hcpClient_(job); r[BK.est] = ests.join(",").slice(0, 400);
    r[BK.type] = hcpJobType_(job).slice(0, 80);
    const ow = bkOwes_(job); r[BK.owes] = ow === null ? "" : ow / 100;
    r[BK.now] = cents / 100; r[BK.st] = st; r[BK.done] = String(wt.completed_at || ""); r[BK.seen] = at;
    if (Object.prototype.hasOwnProperty.call(fee, id)) { r[BK.fee] = fee[id] / 100; r[BK.feeAt] = cents / 100; }
    r[BK.tags] = tags.join(", ").slice(0, 300);
  });
  if (rows.length) {
    s.getRange(2, 1, rows.length, BK_COLS.length).setValues(rows);
    s.getRange(2, 1, rows.length, 2).setNumberFormat("@");
  }
  return { kept: jobs.length, added: added, booked: booked, fees: Object.keys(fee).length };
}
/** A job's visits as one job: on the schedule for its first visit's day (day), booked the day its first visit was put on
 *  the schedule (bday); its booked $: the visits put on the schedule that same day (null when one isn't known); once
 *  every visit not canceled is serviced, what they came to (later visits too, less card fees). Booked before the app
 *  kept them (pre): its amount is the one first seen (seen: that day). */
function bkGroups_(rows, tz, fromMs) {
  const by = {}, today = Utilities.formatDate(tmNow_(), tz, "yyyy-MM-dd");
  rows.forEach(function (r) {
    const inv = String(r[1] || "").trim(), base = inv.replace(/-\d+$/, "");
    if (!base) return;
    const st = String(r[BK.st] || "");
    (by[base] || (by[base] = [])).push({ inv: inv, jid: String(r[0] || ""), type: String(r[BK.type] || ""), first: hcpFirstVisit_({ invoice_number: inv }), bday: pcDay_(r[BK.day], tz), sday: pcDay_(r[BK.svc], tz), bc: bkNum_(r[BK.bc]),
      owes: bkNum_(r[BK.owes]), tag: String(r[BK.tag] || ""), cust: String(r[BK.cust] || ""), client: String(r[BK.client] || ""), ests: String(r[BK.est] || "").split(",").filter(Boolean),
      now: bkNum_(r[BK.now]) || 0, can: /cancel/i.test(st), fin: /complete/i.test(st), fee: bkNum_(r[BK.fee]) || 0,
      pre: (Date.parse(bkIso_(r[2])) || 0) < fromMs, seen: pcDay_(r[3] instanceof Date ? r[3] : new Date(String(r[3] || "")), tz) });
  });
  const out = [];
  Object.keys(by).forEach(function (base) {
    const vs = by[base], first = vs.filter(function (v) { return v.first && v.bday && v.sday; })[0];
    vs.forEach(function (v) { v.done = v.fin || bkPaid_(v.now, v.owes, v.sday, today); });   // finished, or paid in full once its day went by
    if (!first) return;   // its first visit isn't on the schedule (or was made, and done, before the app kept them)
    const booking = vs.filter(function (v) { return v.bday === first.bday; }), live = vs.filter(function (v) { return !v.can; });
    let bc = 0;
    booking.forEach(function (v) { bc = bc === null || v.bc === null ? null : bc + v.bc; });
    const st = !live.length ? "x" : live.every(function (v) { return v.done; }) ? "d" : "o";
    const tagged = [first].concat(booking).filter(function (v) { return v.tag; })[0];
    const ests = [];
    vs.forEach(function (v) { v.ests.forEach(function (e) { if (ests.indexOf(e) === -1) ests.push(e); }); });
    const typed = [first].concat(vs).filter(function (v) { return v.type; })[0];
    out.push({ key: base, jid: first.jid, type: typed ? typed.type : "", pf: st === "d" && live.some(function (v) { return !v.fin; }), inv: first.inv, day: first.sday, bday: first.bday, bc: bc, fc: st === "d" ? live.reduce(function (n, v) { return n + v.now - v.fee; }, 0) : null, st: st, n: vs.length,
      tag: tagged ? tagged.tag : "", cust: first.cust, client: first.client, ests: ests, pre: first.pre, seen: first.pre ? first.seen : "" });
  });
  return out;
}
/** Who booked each one: an Admin's pick (Office Scorecard › Who booked each job: a person, or Not office), else its tag,
 *  else a Booked mark in the app (the last mark on an estimate or a past client), near the day it was booked. */
function bkCredit_(groups, tz) {
  const norm = function (v) { return String(v || "").toLowerCase().replace(/\s+/g, " ").trim(); };
  const gap = function (a, b) { return Math.abs(Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 864e5; };
  const picks = bkPicks_();
  groups.forEach(function (g) {
    const k = picks[g.key];
    if (k && k.who) { g.name = k.who === "-" ? "" : k.who; g.how = k.who === "-" ? "out" : "admin"; g.pickBy = k.by; g.pickAt = k.at; }
    else if (g.tag) { g.name = g.tag; g.how = "tag"; }
  });
  const pick = function (list, day) {   // the one booked closest to the mark
    return list.filter(function (g) { return !g.how && gap(g.bday, day) <= BK_MARK_DAYS; }).sort(function (a, b) { return gap(a.bday, day) - gap(b.bday, day); })[0];
  };
  // Office › Estimates and Today's calls: the job made from that estimate (any day), else one for the client's name
  const est = {};
  pcRows_(OF_EST_CALLS, OF_EST_CALL_COLS.length).forEach(function (r) { const id = String(r[2] || ""); if (id) est[id] = { r: String(r[3] || ""), who: String(r[4] || ""), day: pcDay_(r[1], tz) }; });
  const ids = Object.keys(est).filter(function (id) { return est[id].r === "booked" && est[id].who; });
  if (ids.length) {
    const er = estRows_(SpreadsheetApp.getActive().getSheetByName(EST_SHEET));
    ids.forEach(function (id) {
      const m = est[id], row = er[id], keys = [id].concat(row ? priceJson_(row[14]).map(function (o) { return String((o && o[4]) || ""); }).filter(Boolean) : []);
      let g = groups.filter(function (x) { return !x.how && x.ests.some(function (e) { return keys.indexOf(e) !== -1; }); })[0];
      const client = row ? norm(row[4]) : "";
      if (!g && client && m.day) g = pick(groups.filter(function (x) { return norm(x.client) === client; }), m.day);
      if (g) { g.name = m.who; g.how = "est"; }
    });
  }
  // Past clients: a job for that client
  const pc = {};
  pcRows_(PC_CALLS, PC_CALL_COLS.length).forEach(function (r) { const c = String(r[2] || ""); if (c) pc[c] = { r: String(r[5] || ""), who: String(r[6] || ""), day: pcDay_(r[1], tz) }; });
  Object.keys(pc).forEach(function (c) {
    const m = pc[c];
    if (m.r !== "booked" || !m.who || !m.day) return;
    const g = pick(groups.filter(function (x) { return x.cust === c; }), m.day);
    if (g) { g.name = m.who; g.how = "pc"; }
  });
  return groups;
}
/** Admins and Office (any day): the jobs on the schedule from..to (yyyy-MM-dd, a year at most: their first visit's day),
 *  each with who booked it (by: the office person on the scorecard; name: as the tag or the mark has it), the day it was
 *  booked, its booked $ and, once serviced, what it came to (cents). Runs the hourly check when it's 2 hours behind (and
 *  sets it up the first time). */
function ofBooked_(req) {
  const isDay = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")); };
  const from = String(req.from || ""), to = String(req.to || "");
  if (!isDay(from) || !isDay(to) || from > to || to > tmAddDays_(from, 366)) return { ok: false, error: "bad_request" };
  const P = PropertiesService.getScriptProperties(), tz = Session.getScriptTimeZone();
  const trigger = priceTrigger_();
  let err = String(P.getProperty(PRICE_ERR) || "");
  if (hcpKey_() && Date.now() - (Number(P.getProperty(PRICE_AT)) || 0) > 2 * 3600e3) { const o = priceScan(); err = o.ok ? "" : String(o.error || "error"); }
  const since = String(P.getProperty(BK_FROM) || "");
  // credited across every booking (a mark goes to the job closest to it), then the days asked
  const groups = bkCredit_(bkGroups_(bkRows_(), tz, Date.parse(since) || 0), tz).filter(function (g) { return g.day >= from && g.day <= to; });
  return { ok: true, from: from, to: to, since: since ? pcDay_(new Date(since), tz) : "", scanAt: Number(P.getProperty(PRICE_AT)) || 0, err: err,
    bkErr: String(P.getProperty(BK_ERR) || ""), trigger: trigger, connected: !!hcpKey_(), jobs: bkJobsOut_(groups) };
}
/** The booked jobs as the app gets them, each with the office person it's credited to (by). */
function bkJobsOut_(groups) {
  // the name on a tag or a mark → the office person: a mark's login (the person it's linked to in People), else the name
  let cfg = { people: [] };
  lbRows_(ofSheet_(false)).forEach(function (r) { if (r.key === "config") cfg = ofConfig_(lbParse_(r.json)); });
  const norm = function (v) { return String(v || "").toLowerCase().replace(/\s+/g, " ").trim(); };
  const users = groups.some(function (g) { return g.how === "pc" || g.how === "est"; }) ? readUsers_(usersSheet_()) : [];
  const person = function (name, how) {
    const n = norm(name);
    if (!n) return "";
    if (how === "pc" || how === "est") {   // a mark: the login that made it (an Admin's pick and a tag: the name)
      const u = users.filter(function (x) { return norm(x.u.name) === n; })[0], p = u ? cfg.people.filter(function (y) { return y.user && y.user === u.u.id; })[0] : null;
      if (p) return p.name;
    }
    const whole = cfg.people.filter(function (y) { return norm(y.name) === n; })[0];
    if (whole) return whole.name;
    const f = n.split(" ")[0], firsts = cfg.people.filter(function (y) { return norm(y.name).split(" ")[0] === f; });
    return firsts.length === 1 ? firsts[0].name : "";
  };
  let pcType = null;   // jobs kept before the Job type column: their type from the Past client jobs tab
  const typeOf = function (g) {
    if (g.type) return g.type;
    if (!pcType) { pcType = {}; pcRows_(PC_JOBS, PC_JOB_COLS.length).forEach(function (r) { if (r[0] && r[6]) pcType[String(r[0])] = String(r[6]); if (r[2] && r[6]) pcType["#" + String(r[2])] = String(r[6]); }); }
    return pcType[g.jid] || pcType["#" + g.inv] || "";
  };
  return groups.map(function (g) {
    const type = typeOf(g);
    const j = { key: g.key, jid: g.jid, type: type, dep: type ? revDept_(type) : "", inv: g.inv, day: g.day, bday: g.bday, by: person(g.name, g.how), name: String(g.name || ""), how: g.how || "", client: g.client, bc: g.bc, fc: g.fc, st: g.st, n: g.n,
      seen: g.seen || "" };
    if (g.pickBy) { j.pickBy = g.pickBy; j.pickAt = g.pickAt; }
    if (g.pf) j.pf = true;   // done by its invoice paid in full: not finished in Housecall Pro
    return j;
  }).sort(function (a, b) { return a.day < b.day ? 1 : a.day > b.day ? -1 : a.inv < b.inv ? 1 : -1; });
}
/* ---- Office Scorecard › Who booked each job (Admins only): the jobs on the schedule for the days on screen, each one's
   person picked by an Admin (one of the office, or Not office), over its tag or Booked mark; a pick taken back: its tag
   or mark again. One row a pick on the "Booked by" tab (the last one of each job counts). ---- */
const BK_PICKS = "Booked by", BK_PICK_COLS = ["At", "Job #", "Job id", "Booked by", "Picked by"];
/** { job #, without its visit ("1234"): { who: a person, "-" (Not office) or "" (taken back), by, at } } */
function bkPicks_() {
  const out = {};
  pcRows_(BK_PICKS, BK_PICK_COLS.length).forEach(function (r) {
    const k = String(r[1] || "").trim();
    if (k) out[k] = { who: String(r[3] || ""), by: String(r[4] || ""), at: r[0] instanceof Date ? r[0].toISOString() : String(r[0] || "") };
  });
  return out;
}
/** An Admin picks who booked a job ({ key: its number, who: a person on the office's People, "-" Not office, or "" to
 *  take the pick back }): the job as it's credited now. */
function bkPick_(req, user) {
  const key = String(req.key || "").trim(), who = String(req.who == null ? "" : req.who).trim();
  if (!/^[A-Za-z0-9]{1,20}$/.test(key)) return { ok: false, error: "bad_request" };
  let cfg = { people: [] };
  lbRows_(ofSheet_(false)).forEach(function (r) { if (r.key === "config") cfg = ofConfig_(lbParse_(r.json)); });
  const p = who && who !== "-" ? cfg.people.filter(function (x) { return x.name.toLowerCase() === who.toLowerCase(); })[0] : null;
  if (who && who !== "-" && !p) return { ok: false, error: "bad_value" };
  const tz = Session.getScriptTimeZone(), since = String(PropertiesService.getScriptProperties().getProperty(BK_FROM) || "");
  const g0 = bkGroups_(bkRows_(), tz, Date.parse(since) || 0).filter(function (g) { return g.key === key; })[0];
  if (!g0) return { ok: false, error: "not_found" };
  const s = pcSheet_(BK_PICKS, BK_PICK_COLS), first = Math.max(2, s.getLastRow() + 1), at = tmNow_().toISOString();
  if (s.getMaxRows() < first) s.insertRowsAfter(s.getMaxRows(), 200);
  s.getRange(first, 1, 1, BK_PICK_COLS.length).setNumberFormat("@").setValues([[at, key, g0.jid, p ? p.name : who, String(user.name || "Admin").slice(0, 60)]]);
  const g = bkCredit_(bkGroups_(bkRows_(), tz, Date.parse(since) || 0), tz).filter(function (x) { return x.key === key; });
  return { ok: true, job: bkJobsOut_(g)[0] || null };
}

/* ---- Company goal (Operations): each year's goal for each department and each month's Super, Minimum and Bonus goals,
   in cents, kept in Script Properties. Everyone who sees Revenue reads them; only an admin sets them. A month with no
   goals of its own uses the last month before it that has some (the app shows that). ---- */
const GOALS_KEY = "COMPANY_GOALS";
function goalsDoc_() {
  let d = {};
  try { d = JSON.parse(PropertiesService.getScriptProperties().getProperty(GOALS_KEY) || "{}") || {}; } catch (e) { d = {}; }
  return { years: d.years && typeof d.years === "object" ? d.years : {}, months: d.months && typeof d.months === "object" ? d.months : {} };
}
/** A goal in cents: a whole number from 0 to a billion dollars; blank is "no goal" (null); anything else is refused (undefined). */
function goalCents_(v) {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1e11 ? Math.round(n) : undefined;
}
/** The goals, and what each day of the year paid the repair contractors (Monumental's share and specialty contractors,
 *  from the Repairs tab): the Bonus goal counts the revenue without it. */
function goalsRead_(year) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : String(new Date().getFullYear());
  const rows = repRows_(repSheet_(false)), paid = {};
  Object.keys(rows).forEach(function (id) {
    const r = rows[id];
    if (String(r[1]).indexOf(y + "-") !== 0 || r[13]) return;   // another year, or gone from Housecall Pro
    const c = repCents_(r[16]) + repSplit_(r).mon;
    if (c) paid[r[1]] = (paid[r[1]] || 0) + c;
  });
  return { ok: true, year: Number(y), goals: goalsDoc_(), contractors: paid };
}
/** Sets a year's department goals ({ year, depts: { r, c, p } }) and/or a month's ({ month, goals: { sup, min, bon } }). */
function goalsPut_(req) {
  const doc = goalsDoc_(), y = String(req.year || ""), m = String(req.month || "");
  if (!y && !m) return { ok: false, error: "bad_request" };
  if (y) {
    if (!/^\d{4}$/.test(y) || !req.depts || typeof req.depts !== "object") return { ok: false, error: "bad_request" };
    const d = {};
    for (const k of ["r", "c", "p"]) { const v = goalCents_(req.depts[k]); if (v === undefined) return { ok: false, error: "bad_request" }; d[k] = v || 0; }
    doc.years[y] = d;
  }
  if (m) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m) || !req.goals || typeof req.goals !== "object") return { ok: false, error: "bad_request" };
    const g = {};
    for (const k of ["sup", "min", "bon"]) { const v = goalCents_(req.goals[k]); if (v === undefined) return { ok: false, error: "bad_request" }; g[k] = v; }
    doc.months[m] = g;
  }
  PropertiesService.getScriptProperties().setProperty(GOALS_KEY, JSON.stringify(doc));
  return { ok: true, goals: doc };
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
/** When each span of days was last read (for a minute: two phones opening it at once), all in one Script Property
 *  (REP_READ). It was one Script Property a span (REP_READ_<from>_<to>), which filled the Script Properties page past
 *  the 50 it lets anyone add to by hand: those are taken away here. */
function repReads_(props) {
  let m = {};
  try { m = JSON.parse(props.getProperty("REP_READ") || "{}") || {}; } catch (e) { m = {}; }
  return m;
}
function repReadNow_(props, key) {
  const now = Date.now(), m = repReads_(props), keep = {};
  Object.keys(m).forEach(function (k) { if (now - (Number(m[k]) || 0) < REV_FRESH_MS) keep[k] = m[k]; });
  keep[key] = now;
  props.setProperty("REP_READ", JSON.stringify(keep));
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) { if (k.indexOf("REP_READ_") === 0) props.deleteProperty(k); });
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
  const props = PropertiesService.getScriptProperties(), seenKey = from + "_" + to, seen = Number(repReads_(props)[seenKey]) || 0;
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
    repReadNow_(props, seenKey);
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
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v) && !(k === "mPaidAt" && v === "before")) return k;   // paid before the app: no day
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
/** How it was paid, with its number: "Check #1420", "ACH trace #88812", "Cash" ("" when neither is known). */
const CP_REF_WORD = { Check: "Check #", ACH: "ACH trace #", Wire: "Wire confirmation #", Zelle: "Zelle confirmation #", Card: "Card confirmation #" };
function cpPayRef_(how, ref) { return ref ? (CP_REF_WORD[how] ? CP_REF_WORD[how] + ref : (how ? how + " · " : "") + "Ref #" + ref) : String(how || ""); }
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
/** A person renamed in Settings: Approved by on the batches (what the pay stub says) follows the new name. */
function cpRenameApprover_(old, nm) {
  const s = SpreadsheetApp.getActive().getSheetByName(CP_SHEET), was = String(old || "").trim().toLowerCase();
  if (!s || s.getLastRow() < 2 || !was) return 0;
  const col = CP_COLS.indexOf("Approved by") + 1, r = s.getRange(2, col, s.getLastRow() - 1, 1), v = r.getValues();
  let n = 0;
  v.forEach(function (x) { if (String(x[0] || "").trim().toLowerCase() === was) { x[0] = nm; n++; } });
  if (n) r.setValues(v);
  return n;
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
function cpFolder_() { return hubSub_("CP_FOLDER_ID"); }   // VODA Hub › Contractor invoices
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
    items: b.items.map(function (i) { return { j: i.j, n: i.n, d: i.d, a: i.a, pay: i.pay, client: i.client, addr: i.addr, day: i.day, f: i.f, fn: i.fn, at: i.at || "", by: i.by || "" }; }) };
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
      (paid ? "PAID " + cpEsc_(cpDay_(b.paidOn)) + (cpPayRef_(b.how, b.ref) ? " · " + cpEsc_(cpPayRef_(b.how, b.ref)) : "") : "WAITING FOR APPROVAL") +
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
/** The pay stub's file name: "VODA Cleaning & Restoration - Payroll to Monumental Flooring - Nov 14, 2026.pdf" (the day it
 *  was paid; waiting: the day it was sent to accounting). */
function cpStubName_(b) {
  const day = b.status === "paid" ? cpDay_(b.paidOn) : cpDay_(cpAtDay_(b.at));
  return (CP_COMPANY + " - Payroll to " + b.vendor + (b.status === "paid" ? "" : " (for approval)") + (day ? " - " + day : "")).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150) + ".pdf";
}
function cpStubPdf_(b) {
  return Utilities.newBlob(cpStubHtml_(b), "text/html", "stub.html").getAs("application/pdf").setName(cpStubName_(b));
}
/** The invoices as a table in an email (fresh: the invoice #s just added, marked "new"). */
function cpMailTable_(b, paid, fresh) {
  const td = "padding:5px 8px;border-bottom:1px solid #eef0f4;font-size:13px", th = "padding:5px 8px;border-bottom:1px solid #dfe3ea;font-size:11px;text-align:left;color:#5b6474;text-transform:uppercase";
  const amt = function (i) { return paid ? i.pay : i.a; }, total = b.items.reduce(function (n, i) { return n + amt(i); }, 0);
  return '<table style="border-collapse:collapse;width:100%;max-width:760px"><tr><th style="' + th + '">Invoice</th><th style="' + th + '">Client</th>' + (paid ? '<th style="' + th + '">Address</th>' : "") +
    '<th style="' + th + ';text-align:right">' + (paid ? "Paid" : "Amount") + "</th></tr>" +
    b.items.map(function (i) {
      const isNew = fresh && fresh[i.n];
      return '<tr' + (isNew ? ' style="background:#fff7e0"' : "") + '><td style="' + td + ';font-family:monospace">' + cpEsc_(i.n) + (isNew ? ' <b style="font-family:Arial,sans-serif;color:#a15c07;font-size:11px">NEW</b>' : "") +
        '</td><td style="' + td + '">' + cpEsc_(i.client) + "</td>" + (paid ? '<td style="' + td + '">' + cpEsc_(i.addr) + "</td>" : "") +
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
/** The email to accounting when invoices join a batch still waiting: the new ones' PDFs and the pay stub as it is now. */
function cpMailAccountingAdded_(b, added, to, files) {
  const fresh = {};
  added.forEach(function (i) { fresh[i.n] = true; });
  const more = cpPlural_(added.length, "more invoice"), now = cpPlural_(b.items.length, "invoice");
  const subject = cpShort_(b.vendor) + " invoices: " + added.length + " added to batch " + b.id + " (now " + b.items.length + ")";
  const lines = ["Hi,", "", b.vendor + " sent " + more + " for batch " + b.id + ", still waiting for approval. It's now " + now + ", total " + cpMoney_(b.total) + ". The new " + (added.length === 1 ? "PDF" : "PDFs") + " and the updated pay stub are attached (the earlier PDFs came with the first email).", "", "Added:"]
    .concat(added.map(function (i) { return i.n + " · " + i.client + " · " + cpMoney_(i.a); }), ["", "Approve and record the payment in VODA Hub (Contractor Payroll): " + APP_URL + "#contractors"]);
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:14px;line-height:1.5"><p>Hi,</p><p>' + cpEsc_(b.vendor) + " sent <b>" + more + "</b> for batch <b>" + cpEsc_(b.id) +
    "</b>, still waiting for approval. It's now <b>" + now + "</b>, total <b>" + cpMoney_(b.total) + "</b>. The new " + (added.length === 1 ? "PDF" : "PDFs") + " and the updated pay stub are attached (the earlier PDFs came with the first email).</p>" +
    cpMailTable_(b, false, fresh) +
    '<p>Approve and record the payment in VODA Hub (Contractor Payroll).</p><p><a href="' + APP_URL + '#contractors" style="display:inline-block;background:#1f4fc7;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Open batch ' + cpEsc_(b.id) + "</a></p></div>";
  MailApp.sendEmail({ to: to.join(","), subject: subject, body: lines.join("\n"), htmlBody: html, name: "VODA Hub",
    attachments: files.map(function (f) { return f.getBlob(); }).concat([cpStubPdf_(b)]) });
}
/** The email to the contractor: what was paid, with the pay stub. */
function cpMailVendor_(b, to) {
  const subject = "VODA payment · " + cpPlural_(b.items.length, "invoice") + " · " + cpMoney_(b.paid);
  const how = b.ref ? " by " + (b.how === "Check" ? "check #" + b.ref : cpPayRef_(b.how, b.ref)) : b.how ? " by " + b.how : "";
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
/** Is this invoice paid already, or waiting in a batch? { why, on, b, ref } or null. With its amount (cents): the same
 *  number on a different amount is another invoice (Monumental used the number again): { why: "reused", st, on, b, a }
 *  (an admin can still send it once the other one is paid). */
function cpTaken_(n, batches, a) {
  let reused = null;
  for (let i = batches.length - 1; i >= 0; i--) {
    const b = batches[i].b;
    if (b.status !== "paid" && b.status !== "waiting") continue;
    const its = b.items.filter(function (x) { return String(x.n) === n; });
    if (!its.length) continue;
    const same = a === undefined || a === null || its.some(function (x) { return Math.abs((Number(x.a) || 0) - a) <= 1; });
    if (!same) { if (!reused) reused = { why: "reused", st: b.status, on: b.status === "paid" ? b.paidOn : cpAtDay_(b.at), b: b.id, a: Number(its[0].a) || 0 }; continue; }
    if (b.status === "paid") return { why: "paid", on: b.paidOn, b: b.id, ref: b.ref };
    return { why: "waiting", on: cpAtDay_(b.at), b: b.id };
  }
  return reused;
}
/** A batch of invoices paid before the app: paid, with no paid day. */
function cpIsBefore_(b) { return b.status === "paid" && !b.paidOn; }
/** Sends invoices already recorded on their jobs to accounting: { vendor, to, items: [{ id (job), n, f (file id) }] }. When a
 *  batch to the same contractor is still waiting for accounting they join it (one payment, one pay stub; accounting is
 *  emailed the new PDFs and the pay stub as it is now), else they're a new batch. Refused, with every reason, when one is
 *  paid already, waiting in a batch, on a job marked paid, or has no PDF. */
function cpSend_(req, user) {
  const to = cpEmails_(req.to);
  if (to.error) return { ok: false, error: to.error, email: to.email };
  const vendor = String(req.vendor || CP_VENDOR).trim().slice(0, 80) || CP_VENDOR;
  const list = Array.isArray(req.items) ? req.items : null;
  if (!list || !list.length || list.length > CP_MAX_ITEMS) return { ok: false, error: "bad_request" };
  const s = repSheet_(true), rows = repRows_(s), cs = cpSheet_(true), all = cpAll_(cs);
  const items = [], files = {}, seen = {}, problems = [];
  // the same number as a paid invoice for a different amount: sent only when an admin said it's another invoice
  const reuse = user.role === "admin" && Array.isArray(req.reuse) ? req.reuse.map(String) : [];
  list.forEach(function (x) {
    const id = String((x && x.id) || ""), n = String((x && x.n) || "").trim(), r = rows[id];
    if (!r || !n) { problems.push({ n: n, why: "gone" }); return; }
    if (seen[n]) { problems.push({ n: n, why: "twice" }); return; }
    seen[n] = true;
    const inv = repMonList_(r).filter(function (i) { return String(i.n) === n; })[0];
    if (!inv) { problems.push({ n: n, why: "not_saved" }); return; }
    const taken = inv.paid ? { why: "paid", on: inv.paid, b: inv.b || "", ref: inv.ref || "" } : cpTaken_(n, all, Number(inv.a) || 0);
    if (taken && !(taken.why === "reused" && taken.st === "paid" && reuse.indexOf(n) !== -1)) { taken.n = n; problems.push(taken); return; }
    if (r[25]) { problems.push({ n: n, why: "job_paid", on: r[25] }); return; }
    const f = files[x.f] || cpFileOk_(x.f);
    if (!f) { problems.push({ n: n, why: "no_pdf" }); return; }
    files[x.f] = f;
    items.push({ j: id, n: n, d: String(inv.d || ""), a: Number(inv.a) || 0, pay: Number(inv.a) || 0, client: String(r[35] || r[3] || ""), addr: String(r[4] || ""), day: r[1], f: f.getId(), fn: f.getName() });
  });
  if (problems.length) return { ok: false, error: "cant_send", problems: problems };
  const used = Object.keys(files).map(function (k) { return files[k]; });
  if (used.reduce(function (n, f) { return n + (Number(f.getSize()) || 0); }, 0) > CP_MAX_MAIL) return { ok: false, error: "too_big" };
  const day = cpToday_(), now = new Date().toISOString(), who = user.name || user.id;
  items.forEach(function (i) { i.at = now; i.by = who; });   // when each invoice was sent, and by whom
  // a batch to the same contractor still waiting for accounting: these join it
  const open = all.filter(function (x) { return x.b.status === "waiting" && x.b.vendor.toLowerCase() === vendor.toLowerCase(); }).pop();
  let b, row, added = 0;
  if (open && open.b.items.length + items.length <= CP_MAX_ITEMS) {
    b = Object.assign({}, open.b, { items: open.b.items.concat(items), to: to.list.join(", ") });
    b.total = b.items.reduce(function (n, i) { return n + i.a; }, 0);
    row = open.row; added = items.length;
    cpMailAccountingAdded_(b, items, to.list, used);   // first: when it can't go, nothing is marked
  } else {
    // a new batch, named for the contractor and today ("MON-2026-11-13"), then -2, -3 on the same day
    const pre = (vendor.replace(/[^A-Za-z]/g, "").slice(0, 3) || "CON").toUpperCase(), have = {};
    all.forEach(function (x) { have[x.b.id] = true; });
    let id = pre + "-" + day, k = 1;
    while (have[id]) id = pre + "-" + day + "-" + (++k);
    b = { id: id, vendor: vendor, status: "waiting", at: now, by: who, to: to.list.join(", "), items: items, total: items.reduce(function (n, i) { return n + i.a; }, 0), paid: 0 };
    row = Math.max(cs.getLastRow(), 1) + 1;
    cpMailAccounting_(b, to.list, used);   // first: when it can't go, nothing is marked
  }
  const id = b.id;
  items.forEach(function (i) {
    const r = rows[i.j], inv = repMonList_(r);
    inv.forEach(function (v) { if (String(v.n) === i.n) { v.sent = day; v.b = id; } });
    r[32] = JSON.stringify(inv).slice(0, 45000); r[27] = who; r[28] = now;
  });
  repWrite_(s, rows);
  cpPut_(cs, row, b);
  const ids = {};
  items.forEach(function (i) { ids[i.j] = true; });
  return { ok: true, batch: cpOut_(b), added: added, jobs: Object.keys(ids).map(function (k) { return repOut_(rows[k]); }) };
}
/** Invoices paid before the app (Admins): { vendor, items: [{ n, d, a ($), client, addr, fn }] } (up to 100 a time). Each is
 *  recorded as paid, with no paid day, in a batch of its own ("MON-PAID-BEFORE"; -2, -3 when one is full), so none of
 *  them can be sent for payment again. Left as it is: one already paid or waiting in a batch, or paid on its job (the same
 *  number and amount), and the same invoice twice in what's sent. One saved on its job and not sent yet is marked paid
 *  there too ("before"). → { ok, added: [n], skipped: [{ n, a, why, b, on }], batch } */
function cpBefore_(req, user) {
  const list = Array.isArray(req.items) ? req.items : null;
  if (!list || !list.length || list.length > CP_MAX_ITEMS) return { ok: false, error: "bad_request" };
  const vendor = String(req.vendor || CP_VENDOR).trim().slice(0, 80) || CP_VENDOR;
  const cs = cpSheet_(true), all = cpAll_(cs), s = repSheet_(true), rows = repRows_(s);
  const onJobs = {};
  Object.keys(rows).forEach(function (id) { repMonList_(rows[id]).forEach(function (v) { const k = String(v.n); (onJobs[k] || (onJobs[k] = [])).push({ id: id, v: v }); }); });
  const now = new Date().toISOString(), who = user.name || user.id, add = [], skipped = [], seen = {};
  list.forEach(function (x) {
    const n = String((x && x.n) || "").trim().slice(0, 60), a = Math.round(Number(x && x.a) * 100);
    if (!(a > 0 && a < 1e11)) { skipped.push({ n: n, why: "bad_amount" }); return; }
    const client = String(x.client || "").slice(0, 120), key = n + "|" + a + (n ? "" : "|" + client);
    if (seen[key]) { skipped.push({ n: n, a: a, why: "twice" }); return; }
    seen[key] = true;
    // no number on the PDF: the same amount and client already recorded before the app
    const was = n ? null : all.filter(function (y) { return cpIsBefore_(y.b) && y.b.items.some(function (i) { return !i.n && i.a === a && i.client === client; }); })[0];
    if (was) { skipped.push({ n: n, a: a, why: "paid", b: was.b.id, on: "" }); return; }
    let job = null;
    if (n) {
      const t = cpTaken_(n, all, a);
      if (t && t.why !== "reused") { skipped.push(Object.assign({ n: n, a: a }, t)); return; }
      const j = (onJobs[n] || []).filter(function (o) { return Math.abs((Number(o.v.a) || 0) - a) <= 1; })[0];
      if (j && (j.v.paid || j.v.b)) { skipped.push({ n: n, a: a, why: j.v.paid ? "paid" : "waiting", b: j.v.b || "", on: j.v.paid === "before" ? "" : String(j.v.paid || j.v.sent || "") }); return; }
      job = j || null;
    }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(x.d || "")) ? String(x.d) : "";
    add.push({ i: { j: job ? job.id : "", n: n, d: day, a: a, pay: a, client: client, addr: String(x.addr || "").slice(0, 160), day: "", f: "",
      fn: String(x.fn || "").slice(0, 160), at: now, by: who }, job: job });
  });
  if (!add.length) return { ok: true, added: [], skipped: skipped, batch: null };
  // into the batch paid before the app (a new one when it's full: the tab keeps a batch's invoices in one cell)
  const pre = (vendor.replace(/[^A-Za-z]/g, "").slice(0, 3) || "CON").toUpperCase() + "-PAID-BEFORE";
  let cur = all.filter(function (y) { return cpIsBefore_(y.b) && y.b.vendor.toLowerCase() === vendor.toLowerCase(); }).pop() || null, out = null;
  const have = {};
  all.forEach(function (y) { have[y.b.id] = true; });
  add.forEach(function (x) {
    if (!cur || JSON.stringify(cur.b.items).length + JSON.stringify(x.i).length > 40000) {
      if (cur && out === cur) cpPut_(cs, cur.row, cur.b);
      let id = pre, k = 1;
      while (have[id]) id = pre + "-" + (++k);
      have[id] = true;
      cur = { row: Math.max(cs.getLastRow(), 1) + 1, b: { id: id, vendor: vendor, status: "paid", at: now, by: who, to: "", items: [], total: 0, paid: 0, paidOn: "", how: "", ref: "",
        last4: "", appBy: who, appAt: now, vTo: "", vAt: "", cxBy: "", cxAt: "", out: "" } };
      cpPut_(cs, cur.row, cur.b);   // its row now, so the next one starts under it
    }
    cur.b.items.push(x.i);
    cur.b.total += x.i.a; cur.b.paid += x.i.pay;
    out = cur;
    if (x.job) {
      const r = rows[x.job.id], inv = repMonList_(r);
      inv.forEach(function (v) { if (String(v.n) === x.i.n && Math.abs((Number(v.a) || 0) - x.i.a) <= 1 && !v.paid && !v.b) { v.paid = "before"; v.pay = x.i.a; v.b = cur.b.id; } });
      r[32] = JSON.stringify(inv).slice(0, 45000); r[27] = who; r[28] = now;
    }
  });
  cpPut_(cs, cur.row, cur.b);
  if (add.some(function (x) { return x.job; })) repWrite_(s, rows);
  const ids = {};
  add.forEach(function (x) { if (x.job) ids[x.job.id] = true; });
  return { ok: true, added: add.map(function (x) { return x.i.n; }), skipped: skipped, batches: cpAll_(cs).filter(function (y) { return cpIsBefore_(y.b); }).map(function (y) { return cpOut_(y.b); }),
    jobs: Object.keys(ids).map(function (k) { return repOut_(rows[k]); }) };
}
/** A street the way the app keys it: "275 South Pickett Street, Alexandria" → "275 pickett"; "" when it has no number. */
const REP_ST_WORDS_ = { street: "st", avenue: "ave", av: "ave", boulevard: "blvd", drive: "dr", road: "rd", lane: "ln", court: "ct", place: "pl", terrace: "ter", circle: "cir", parkway: "pkwy", highway: "hwy", square: "sq", trail: "trl" };
const REP_DIRS_ = ["n", "s", "e", "w", "ne", "nw", "se", "sw", "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest"];
function repStreetKey_(addr) {
  const w = String(addr || "").split(",")[0].toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean)
    .map(function (x) { return REP_ST_WORDS_[x] || x; });
  let i = -1;
  for (let k = 0; k < w.length; k++) if (/^\d+[a-z]?$/.test(w[k])) { i = k; break; }
  if (i < 0) return "";
  let k = i + 1;
  while (k + 1 < w.length && REP_DIRS_.indexOf(w[k]) !== -1) k++;
  return w[k] ? w[i].replace(/[a-z]$/, "") + " " + w[k] : "";
}
function repWords_(addr) {
  return String(addr || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).map(function (x) { return REP_ST_WORDS_[x] || x; });
}
/** Is a street (as repStreetKey_ keys it: "15253 mimosa") in this address, anywhere in it ("Unit 2, 15253 Mimosa Trl")?
 *  null when the address has no house number to tell by. */
function repAtStreet_(addr, key) {
  const w = repWords_(addr), p = String(key || "").split(" ");
  if (p.length < 2 || !w.some(function (x) { return /^\d+[a-z]?$/.test(x); })) return null;
  return w.some(function (x) { return x.replace(/[a-z]$/, "") === p[0]; }) && w.indexOf(p[1]) !== -1;
}
/** Does an invoice number carry this address, the way Monumental writes them: its house number, then the street's first
 *  letters ("REB2-3511ANNANDALERD": 3511 Annandale Rd; "REB-5909-#102-FOUNDE": 5909 Founders Hill Dr, unit 102)? */
function repNoAt_(n, addr) {
  const k = repStreetKey_(addr).split(" ");
  if (k.length < 2 || k[0].length < 3) return false;
  const N = " " + String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
  return new RegExp("[^0-9]" + k[0] + "[a-z0-9 ]{0,8}?" + k[1].slice(0, 4)).test(N);
}
/** The invoice numbers written in a job's "Their invoice #" (the old Excel list: "59404326-2 - $45,715.61****59404326-3");
 *  a "#" inside one is part of it ("REB-5909-#102-FOUNDE", "V2#3817-3854BLENHEI"), one in front isn't ("#1010731026-1"). */
function repInvNos_(text) {
  return (String(text || "").match(/[A-Za-z0-9&#]+(?:-[A-Za-z0-9&#]+)+/g) || []).map(function (t) { return t.replace(/^#+/, ""); })
    .filter(function (t) { return t.length >= 6 && (t.match(/\d/g) || []).length >= 3; })   // REB-851NGLEBERD: a 3-digit house number
    .map(function (t) { return t.toUpperCase(); }).filter(function (t, i, a) { return a.indexOf(t) === i; });
}
/** The jobs Monumental is paid for by invoices paid before the app (Admins). Without ids, which: every invoice # on a job
 *  (its "Their invoice #" and the invoices saved on it) paid, or, a job with no invoice #, the only one at an invoice's
 *  street with Monumental's share within $1 of it; and those only partly paid. An invoice # typed in "Their invoice #" of a
 *  job at another street than the invoice's own (its PDF's address: typed on the wrong job) isn't that job's (one saved on
 *  the job from its PDF is, and so is one whose number carries the job's address: the PDF's house number mistyped): the
 *  job is listed to check (wrong; or marked, when it's already marked paid), and the invoice can still find its own job by
 *  its street (or the address its number carries).
 *  With ids: those jobs marked paid to Monumental with no day ("before"), and their invoices saved on them that are paid. */
function cpBeforeJobs_(req, user) {
  const cs = cpSheet_(false), all = cpAll_(cs), s = repSheet_(true), rows = repRows_(s);
  const paid = {}, before = [], where = {};
  all.forEach(function (y) {
    if (y.b.status !== "paid") return;
    // each number paid: its batch and what was paid on it (a number used on two invoices: both)
    y.b.items.forEach(function (i) { if (!i.n) return; const k = String(i.n).toUpperCase(), p = paid[k] || (paid[k] = { b: y.b.id, a: 0 }); p.a += Number(i.pay || i.a) || 0; });
    if (cpIsBefore_(y.b)) y.b.items.forEach(function (i) { before.push({ i: i, b: y.b.id }); });
  });
  // the street each paid invoice is for: its PDF's (paid before the app), else the job it was sent from
  [true, false].forEach(function (pdf) {
    all.forEach(function (y) {
      if (y.b.status !== "paid" || cpIsBefore_(y.b) !== pdf) return;
      y.b.items.forEach(function (i) {
        const k = String(i.n || "").toUpperCase(), st = repStreetKey_(i.addr);
        if (k && st && !where[k]) where[k] = { st: st, addr: String(i.addr || "").slice(0, 160), client: String(i.client || "").slice(0, 120) };
      });
    });
  });
  // typed in its "Their invoice #" (not saved on it from the PDF) at another street than the invoice's: another job's
  const away = function (r, n) {
    return !!where[n] && repAtStreet_(r[4], where[n].st) === false && !repNoAt_(n, r[4]) && !repMonList_(r).some(function (v) { return String(v.n).toUpperCase() === n; });
  };
  const mon = Object.keys(rows).map(function (id) { return rows[id]; }).filter(function (r) { return !r[13] && repIsMon_(r); });
  const open = mon.filter(function (r) { return !r[25]; });
  const nos = function (r) { return repInvNos_(r[24]).concat(repMonList_(r).map(function (v) { return String(v.n).toUpperCase(); })).filter(function (t, i, a) { return t && a.indexOf(t) === i; }); };
  const used = {}, num = [], partly = [], addr = [], short = [], wrong = [], marked = [];
  const out = function (r, extra) { return Object.assign({ id: String(r[0]), day: r[1], client: String(r[35] || r[3] || ""), addr: String(r[4] || ""), owed: repSplit_(r).owed }, extra); };
  const offOf = function (r) { return nos(r).filter(function (n) { return away(r, n); }).map(function (n) { return { n: n, addr: where[n].addr, client: where[n].client, paid: !!paid[n] }; }); };
  // a paid number on any job at its own street (marked paid already or not) is that job's: not matched again by street
  mon.forEach(function (r) { nos(r).forEach(function (n) { if (paid[n] && !away(r, n)) used[n] = true; }); });
  // already marked paid, with another street's invoice # on it: listed to check (its own invoice may not be paid)
  mon.forEach(function (r) { if (!r[25]) return; const off = offOf(r); if (off.length) marked.push(out(r, { inv: nos(r).filter(function (n) { return !away(r, n); }), off: off, paidAt: String(r[25]) })); });
  open.forEach(function (r) {
    const off = offOf(r), ns = nos(r).filter(function (n) { return !away(r, n); });
    if (off.length) {
      // not ticked: fix its "Their invoice #"; it can be marked when what's left on it is all paid
      const pa = ns.reduce(function (t, n) { return t + (paid[n] ? paid[n].a : 0); }, 0);
      wrong.push(out(r, { inv: ns, off: off, ok: ns.length > 0 && ns.every(function (n) { return paid[n]; }), paidA: pa, b: ns.filter(function (n) { return paid[n]; }).map(function (n) { return paid[n].b; }).filter(function (y, i, a) { return a.indexOf(y) === i; }) }));
      return;
    }
    if (!ns.length) return;
    const have = ns.filter(function (n) { return paid[n]; });
    if (have.length === ns.length) {
      // the invoices paid add up to less than Monumental's share still owed (more than $1): told apart, to check first
      const pa = have.reduce(function (t, n) { return t + paid[n].a; }, 0), x = out(r, { inv: ns, b: have.map(function (n) { return paid[n].b; }).filter(function (y, i, a) { return a.indexOf(y) === i; }), by: "number", paidA: pa });
      (x.owed > pa + 100 ? short : num).push(x);
    }
    else if (have.length) partly.push(out(r, { paid: have, open: ns.filter(function (n) { return !paid[n]; }) }));
  });
  // invoices on no job by their number: the one job at their street with no invoice # and Monumental's share within $1
  const taken = {};
  num.concat(short).forEach(function (x) { taken[x.id] = true; });
  before.forEach(function (x) {
    const n = String(x.i.n || "").toUpperCase(), jr = x.i.j ? rows[x.i.j] : null;
    if ((n && used[n]) || (x.i.j && !(jr && away(jr, n)))) return;   // saved on a job at another street: still its own job's
    // at its street: the PDF's address, or the one its number carries (a PDF with the house number mistyped)
    const k = repStreetKey_(x.i.addr);
    if (!k && !n) return;
    const at = function (r) { return (!!k && (repStreetKey_(r[4]) === k || repAtStreet_(r[4], k) === true)) || (!!n && repNoAt_(n, r[4])); };
    const c = open.filter(function (r) { return !taken[r[0]] && !nos(r).length && at(r) && Math.abs(repSplit_(r).owed - x.i.a) <= 100; });
    if (c.length !== 1) return;
    taken[c[0][0]] = true;
    addr.push(out(c[0], { inv: n ? [n] : [], b: [x.b], by: "address", a: x.i.a, invClient: String(x.i.client || "") }));
  });
  if (!Array.isArray(req.ids)) return { ok: true, num: num, short: short, addr: addr, partly: partly, wrong: wrong, marked: marked };
  // mark the ones picked
  const pick = {}, ok = num.concat(short, addr, wrong.filter(function (x) { return x.ok; }));
  req.ids.forEach(function (id) { pick[String(id)] = true; });
  const now = new Date().toISOString(), who = user.name || user.id, done = [];
  ok.forEach(function (x) {
    if (!pick[x.id]) return;
    const r = rows[x.id];
    r[25] = "before";
    const inv = repMonList_(r);
    inv.forEach(function (v) { const k = String(v.n).toUpperCase(), p = paid[k]; if (p && !v.paid && !away(r, k)) { v.paid = "before"; v.pay = Number(v.a) || 0; v.b = p.b; } });
    r[32] = JSON.stringify(inv).slice(0, 45000); r[27] = who; r[28] = now;
    done.push(x.id);
  });
  if (done.length) repWrite_(s, rows);
  return { ok: true, marked: done, jobs: done.map(function (id) { return repOut_(rows[id]); }) };
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
function cpDelete_(req, user) {
  const x = cpFind_(req.id);
  if (!x) return { ok: false, error: "gone" };
  if (cpIsBefore_(x.b)) {
    // invoices recorded as paid before the app, taken off again (Admins): those marked paid on their jobs by it are to pay again
    if (!user || user.role !== "admin") return { ok: false, error: "not_allowed" };
    const s = repSheet_(true), rows = repRows_(s), ids = {};
    Object.keys(rows).forEach(function (id) {
      const r = rows[id], inv = repMonList_(r);
      let hit = false;
      inv.forEach(function (v) { if (v.b === x.b.id && v.paid === "before") { delete v.paid; delete v.b; delete v.pay; hit = true; } });
      if (hit) r[32] = JSON.stringify(inv).slice(0, 45000);
      if (r[25] === "before") { r[25] = ""; hit = true; }   // jobs marked paid by invoices paid before the app: to pay again (Mark their jobs paid can run again)
      if (hit) ids[id] = true;
    });
    if (Object.keys(ids).length) repWrite_(s, rows);
    x.s.deleteRow(x.row);
    return { ok: true, id: x.b.id, jobs: Object.keys(ids).map(function (k) { return repOut_(rows[k]); }) };
  }
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
const OF_EDIT = "office-edit";   // Office (any day): types anyone's numbers on any day, like an Admin (not the people)
function canOffice_(user) { return canSee_(user, "office") || canSee_(user, OF_EDIT); }
/** Types anyone's numbers, any day, the admin-only ones too. */
function ofEditor_(user) { return !!user && (user.role === "admin" || parseAccess_(user.access).indexOf(OF_EDIT) !== -1); }
/** Today in the office (the script's time zone): the only day someone without "Office (any day)" types. */
// the office's day and hours: New York's (not the script's own time zone setting); CSRs type today's numbers until 6 PM
const OF_TZ = "America/New_York", OF_UNTIL = 18;
function ofToday_() { return Utilities.formatDate(tmNow_(), OF_TZ, "yyyy-MM-dd"); }
function ofLate_() { return Number(Utilities.formatDate(tmNow_(), OF_TZ, "HH")) >= OF_UNTIL; }
/** Once (Nov 2026), for everyone in the office now: Other outbound calls and Booked from other outbound calls (they
 *  show last in Outbound calls). */
const OF_OTHER = [{ id: "oth", label: "Other outbound calls", kind: "out", of: "" }, { id: "othb", label: "Booked from other outbound calls", kind: "num", of: "oth" }];
function ofAddOther_() {
  const P = PropertiesService.getScriptProperties();
  if (P.getProperty("OF_NOV24") === "1") return;
  withTabLock_(function () {
    if (P.getProperty("OF_NOV24") === "1") return;
    const s = ofSheet_(false), byKey = {};
    if (s) lbRows_(s).forEach(function (r) { byKey[r.key] = r; });
    if (byKey.config) {
      const cfg = ofConfig_(lbParse_(byKey.config.json)), ym = ofToday_().slice(0, 7);
      let changed = false;
      cfg.people.forEach(function (p) {
        if (p.to && p.to < ym) return;   // not in the office any more
        const has = function (id, re) { return p.fields.some(function (f) { return f.id === id || re.test(f.label); }); };
        if (!has("oth", /^other outbound/i) && !has("othb", /^booked from other outbound/i) && p.fields.length + 2 <= OF_MAX_FIELDS) {
          OF_OTHER.forEach(function (f) { p.fields.push({ id: f.id, label: f.label, kind: f.kind, of: f.of }); });
          changed = true;
        }
      });
      if (changed) {
        const now = new Date().toISOString(), doc = ofConfig_(cfg);
        doc.at = now; doc.by = "VODA Hub";
        lbSaveRow_(s, byKey, "config", JSON.stringify(doc), now, "VODA Hub");
      }
    }
    P.setProperty("OF_NOV24", "1");
  });
}
/** Once (Nov 2026): the admins' one box again. Where the first version of ofAddOther_ ran, Total daily booked is
 *  Scheduled / completed again (same box, history kept) and Completed by booked goes (past only if a day has a number
 *  in it, so nothing typed is lost). */
function ofOneBox_() {
  const P = PropertiesService.getScriptProperties();
  if (P.getProperty("OF_NOV24B") === "1") return;
  withTabLock_(function () {
    if (P.getProperty("OF_NOV24B") === "1") return;
    const s = ofSheet_(false), byKey = {};
    if (s) lbRows_(s).forEach(function (r) { byKey[r.key] = r; });
    if (byKey.config) {
      const cfg = ofConfig_(lbParse_(byKey.config.json));
      const typed = Object.keys(byKey).some(function (k) { return k !== "config" && String(byKey[k].json || "").indexOf('"compb"') !== -1; });
      let changed = false;
      cfg.people.forEach(function (p) {
        p.fields.forEach(function (f) {
          if (f.kind === "admin" && /^total daily booked$/i.test(f.label)) { f.label = "Scheduled / completed"; changed = true; }
        });
        const i = p.fields.findIndex(function (f) { return f.id === "compb" || /^completed by booked$/i.test(f.label); });
        if (i !== -1) {
          if (typed) { if (!p.fields[i].hide) { p.fields[i].hide = true; changed = true; } }
          else { p.fields.splice(i, 1); changed = true; }
        }
      });
      if (changed) {
        const now = new Date().toISOString(), doc = ofConfig_(cfg);
        doc.at = now; doc.by = "VODA Hub";
        lbSaveRow_(s, byKey, "config", JSON.stringify(doc), now, "VODA Hub");
      }
    }
    P.setProperty("OF_NOV24B", "1");
  });
}
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
  try { ofAddOther_(); ofOneBox_(); } catch (e) { /* the next read */ }
  let pcAuto = pcAutoFrom_(false);
  if (!pcAuto) { try { withTabLock_(function () { pcAuto = pcAutoFrom_(true); if (pcAuto) ofPcSync_(pcAuto); }); } catch (e) { pcAuto = pcAutoFrom_(false); } }
  let estAuto = estAutoFrom_(false);   // the first time: from today on, Office › Estimates' marks counted
  if (!estAuto) { try { withTabLock_(function () { estAuto = estAutoFrom_(true); ofEstSync_(estAuto); }); } catch (e) { estAuto = estAutoFrom_(false); } }
  const out = { ok: true, config: { people: [], goal: 50 }, months: {}, admin: user.role === "admin", editor: ofEditor_(user), me: user.id, today: ofToday_(),
    estOk: ofEstOk_(user), estWho: user.role === "admin" ? ofEstWho_() : undefined, pcAuto: pcAuto, estAuto: estAuto,
    trcOk: trcOk_(user), trcWho: user.role === "admin" ? trcWho_() : undefined,
    pcMine: pcMine_(user, pcAssign_()) };   // her Past clients groups: none, no Past clients tab
  lbRows_(ofSheet_(false)).forEach(function (r) {
    if (r.key === "config") out.config = lbParse_(r.json);
    else if (lbYm_(r.key) && r.key.indexOf(y + "-") === 0) out.months[r.key] = lbParse_(r.json);
  });
  return out;
}
/** Saves changes: { writes: [{ key: "2026-11", patch: { days: { day: { name: { field: n | null } } } } }] } merges into
 *  the month (null clears a box); Admins may also replace a month or the people ("config") whole ({ key, data }).
 *  Someone with "Office (any day)" changes anyone's numbers on any day, the admin-only ones too. Anyone else changes only
 *  her own numbers (the person linked to her login), only today's, and never an admin-only number: another day is refused
 *  whole ("only_today"), so nothing of it is half saved. */
function ofPut_(req) {
  const admin = req.user.role === "admin", editor = ofEditor_(req.user), today = ofToday_();
  const writes = (Array.isArray(req.writes) ? req.writes : []).slice(0, 14);
  if (!admin && writes.some(function (w) { return w && (w.key === "config" || (w.data && typeof w.data === "object")); })) return { ok: false, error: "not_allowed" };
  if (!editor && writes.some(function (w) { return w && w.patch && w.patch.days && typeof w.patch.days === "object" && Object.keys(w.patch.days).some(function (d) { return d !== today; }); }))
    return { ok: false, error: "only_today", today: today };
  if (!editor && ofLate_() && writes.some(function (w) { return w && w.patch && w.patch.days && typeof w.patch.days === "object" && Object.keys(w.patch.days).length; }))
    return { ok: false, error: "after_hours", today: today, until: OF_UNTIL };
  const s = ofSheet_(true);
  const byKey = {};
  lbRows_(s).forEach(function (r) { byKey[r.key] = r; });
  const cfg = ofConfig_(byKey.config ? lbParse_(byKey.config.json) : {});
  const now = new Date().toISOString();
  const out = { ok: true, months: {} };
  const pcAuto = pcAutoFrom_(false), pcToday = Utilities.formatDate(tmNow_(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const estAuto = estAutoFrom_(false);
  let pcCnt = null, pcNames = null, estCnt = null;
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
            if (!p || (!editor && p.user !== req.user.id) || !x[name] || typeof x[name] !== "object") return;
            const e = {};
            p.fields.forEach(function (f) {
              if (!(f.id in x[name]) || (f.kind === "admin" && !editor)) return;
              const v = x[name][f.id];
              e[f.id] = typeof v === "number" && isFinite(v) && v >= 0 && v <= 1e6 ? v : null;
            });
            // Booked jobs from the Excel's SCHEDULED / COMPLETED (Load from Excel › Only Booked jobs): admins' and Office (any day)'s
            if (editor && Object.prototype.hasOwnProperty.call(x[name], "bkx")) { const v = x[name].bkx; e.bkx = typeof v === "number" && isFinite(v) && v >= 0 && v <= 1e6 ? v : null; }
            if (!Object.keys(e).length) return;
            e.at = now; e.by = req.by;
            (days[day] || (days[day] = {}))[p.name] = e;
          });
        });
        change = { days: days };
      }
      doc = ofMonth_(lbMerge_(whole ? {} : lbParse_(byKey[key] ? byKey[key].json : ""), change), key);
      // Past clients' numbers: counted from the calls marked, not typed (whatever was sent for them)
      if (pcAuto && key >= pcAuto.slice(0, 7) && pcAuto <= pcToday) {
        if (!pcCnt) { pcCnt = pcCounts_(pcAuto, pcToday); pcNames = ofUserNames_(); }
        ofPcApply_(doc, key, cfg, pcCnt, pcNames, pcAuto, pcToday);
        doc = ofMonth_(doc, key);
      }
      // Office › Estimates' numbers too
      if (estAuto && key >= estAuto.slice(0, 7) && estAuto <= pcToday) {
        if (!estCnt) estCnt = ofEstCounts_(estAuto, pcToday);
        if (!pcNames) pcNames = ofUserNames_();
        ofPcApply_(doc, key, cfg, estCnt, pcNames, estAuto, pcToday, ofEstIds_);
        doc = ofMonth_(doc, key);
      }
    }
    lbSaveRow_(s, byKey, key, JSON.stringify(doc), now, req.by);
    if (key === "config") out.config = doc; else out.months[key] = doc;
  });
  return out;
}

/* ---------------- attendance ---------------- */
// One row per document, in JSON, like the Office tab: "config" (the people, in the grid's order, and the months each one
// is here) and one row per month ("2026-11": each day, each person's entry: { k: kind, m: minutes, t: "HH:MM", n: note,
// at, by }).

const AT_SHEET = "Attendance";
// late (m: minutes late, t: came in at), left early (t: left at), sick, vacation, off, no call / no show, company closed
// (snow), or just a note (started, last day...)
const AT_KINDS = ["late", "left", "sick", "vac", "off", "noshow", "closed", "note"];
const AT_MAX_PEOPLE = 80;

function atSheet_(create) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(AT_SHEET);
  if (!s && create) {
    s = ss.insertSheet(AT_SHEET);
    s.getRange(1, 1, 1, LB_COLS.length).setValues([LB_COLS]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.getRange("A:B").setNumberFormat("@");
  }
  return s;
}
/** The people, cleaned: a name each (once), in order, with the months they're here (blank: from the start / up to now). */
function atConfig_(c) {
  const out = { people: [] }, seen = {};
  ((c && Array.isArray(c.people)) ? c.people : []).slice(0, AT_MAX_PEOPLE).forEach(function (p) {
    const name = lbTeam_(p && p.name);
    if (!name || seen[name.toLowerCase()]) return;
    seen[name.toLowerCase()] = true;
    const spans = atSpans_(p);
    const person = { name: name, from: spans[0][0], to: spans[spans.length - 1][1] };
    if (spans.length > 1) person.spans = spans;
    out.people.push(person);
  });
  return out;
}
/** yyyy-MM plus one month. */
function atNextYm_(ym) { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5)); return m === 12 ? (y + 1) + "-01" : y + "-" + ("0" + (m + 1)).slice(-2); }
/** A person's times here (someone who left and came back has more than one): [[from, to], ...] oldest first, To not
 *  before From, times that overlap or follow on joined, only the last one open (to ""). A list from before: its From – To. */
function atSpans_(p) {
  const raw = Array.isArray(p.spans) && p.spans.length ? p.spans.slice(0, 60) : [[p.from, p.to]];
  const list = raw.map(function (x) {
    const f = lbYm_(x && x[0]);
    let t = lbYm_(x && x[1]);
    if (f && t && t < f) t = f;
    return [f, t];
  }).filter(function (x, i, all) { return x[0] || all.length === 1; })   // more than one time: each needs its From
    .sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  if (!list.length) list.push(["", ""]);
  const out = [];
  list.forEach(function (x) {
    const last = out[out.length - 1];
    if (!last) { out.push(x); return; }
    if (last[1] === "") return;   // still here: a later time is part of it
    if (x[0] === "" || x[0] <= atNextYm_(last[1])) { last[1] = x[1] === "" ? "" : (x[1] > last[1] ? x[1] : last[1]); return; }
    out.push(x);
  });
  return out;
}
/** One person's day, cleaned, or null: a kind, then minutes (1-1440), a time ("08:30") and a note, when there are. */
function atEntry_(x) {
  if (!x || typeof x !== "object" || AT_KINDS.indexOf(x.k) === -1) return null;
  const e = { k: x.k }, m = Number(x.m);
  if (x.m !== undefined && x.m !== null && x.m !== "" && isFinite(m) && m >= 1 && m <= 1440) e.m = Math.round(m);
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(x.t || ""))) e.t = String(x.t);
  const n = supText_(x.n, 160);
  if (n) e.n = n;
  if (x.at) e.at = supText_(x.at, 40);
  if (x.by) e.by = supText_(x.by, 40);
  return e;
}
/** A month, cleaned: only that month's days, a name and an entry each. */
function atMonth_(d, key) {
  const out = { days: {} };
  const days = d && d.days && typeof d.days === "object" ? d.days : {};
  Object.keys(days).forEach(function (day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.slice(0, 7) !== key) return;
    const x = days[day] && typeof days[day] === "object" ? days[day] : {};
    const y = {};
    Object.keys(x).forEach(function (name) {
      const n = lbTeam_(name), e = n ? atEntry_(x[name]) : null;
      if (e) y[n] = e;
    });
    if (Object.keys(y).length) out.days[day] = y;
  });
  return out;
}
/** The people and one year's months; which years have any. */
function atRead_(user, year) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : String(new Date().getFullYear());
  const out = { ok: true, config: { people: [] }, months: {}, years: [], admin: user.role === "admin" };
  const ys = {};
  lbRows_(atSheet_(false)).forEach(function (r) {
    if (r.key === "config") out.config = atConfig_(lbParse_(r.json));
    else if (lbYm_(r.key)) {
      ys[r.key.slice(0, 4)] = true;
      if (r.key.indexOf(y + "-") === 0) out.months[r.key] = atMonth_(lbParse_(r.json), r.key);
    }
  });
  out.years = Object.keys(ys).map(Number).sort();
  return out;
}
/** Saves changes: { writes: [{ key: "2026-11", patch: { days: { day: { name: entry | null } } } }] } puts each person's
 *  day in whole (null takes it off), stamped with who and when; Admins may also replace a month or the people ("config")
 *  whole ({ key, data }: the Excel's history, People). Up to 24 writes a call. */
function atPut_(req) {
  const admin = req.user.role === "admin";
  const writes = (Array.isArray(req.writes) ? req.writes : []).slice(0, 24);
  if (!admin && writes.some(function (w) { return w && (w.key === "config" || (w.data && typeof w.data === "object")); })) return { ok: false, error: "not_allowed" };
  const s = atSheet_(true);
  const byKey = {};
  lbRows_(s).forEach(function (r) { byKey[r.key] = r; });
  const now = new Date().toISOString();
  const out = { ok: true, months: {} };
  writes.forEach(function (w) {
    const key = String((w && w.key) || "");
    const whole = w && w.data && typeof w.data === "object";
    const change = whole ? w.data : (w && w.patch && typeof w.patch === "object" ? w.patch : null);
    if (!change || (key !== "config" && !lbYm_(key))) return;
    let doc;
    if (key === "config") { doc = atConfig_(change); doc.at = now; doc.by = req.by; }
    else if (whole) doc = atMonth_(change, key);
    else {
      doc = atMonth_(lbParse_(byKey[key] ? byKey[key].json : ""), key);
      const days = change.days && typeof change.days === "object" ? change.days : {};
      Object.keys(days).forEach(function (day) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.slice(0, 7) !== key) return;
        const x = days[day] && typeof days[day] === "object" ? days[day] : {};
        Object.keys(x).forEach(function (name) {
          const n = lbTeam_(name);
          if (!n) return;
          const e = x[name] === null ? null : atEntry_(Object.assign({}, x[name], { at: now, by: req.by }));
          if (x[name] !== null && !e) return;
          const dd = doc.days[day] || (doc.days[day] = {});
          if (e) dd[n] = e; else delete dd[n];
          if (!Object.keys(dd).length) delete doc.days[day];
        });
      });
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

/* ---------------- nightly backup ----------------
   Every night around 2 AM a full copy of this sheet in VODA Hub › Backups, the newest 30 kept. A second Google account
   (its email typed in Settings › Backups) can keep copies of its own: the sheet is shared with it, view only, and a
   small script in that account copies it every night into its own Drive. It owns those copies, so they stay even if
   this account has trouble. (Before: every Sunday, 12 kept; switched to nightly the first time an admin opens the app.) */

const BACKUP_KEEP = 30;
const BACKUP2 = "BACKUP2_EMAIL";   // Script Property: the second account's email (the sheet is shared with it, view only)

/** Run once: a full copy of this sheet every night around 2 AM, newest 30 kept. Makes the first one now. */
function backupSetup() {
  backupSchedule_();
  const name = backupNow();
  Logger.log('Nightly backup is on: every night around 2 AM into the Drive folder "' + HUB_FOLDER + ' › ' + HUB_SUBS.BACKUP_FOLDER_ID[1] + '" (newest ' + BACKUP_KEEP + ' kept). First backup made: ' + name);
}
function backupStop() {
  const n = backupOff_();
  Logger.log(n ? "Nightly backup stopped. The backups already made stay in Drive." : "Nightly backup wasn't on.");
}
function backupOff_() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "backupNow") { ScriptApp.deleteTrigger(tr); n++; } });
  PropertiesService.getScriptProperties().setProperty("BACKUP_SCHED", "daily");   // off on purpose: not switched back on
  return n;
}
function backupSchedule_() {
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === "backupNow") ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger("backupNow").timeBased().everyDays(1).atHour(2).create();
  PropertiesService.getScriptProperties().setProperty("BACKUP_SCHED", "daily");
}
const backupIsOn_ = () => ScriptApp.getProjectTriggers().some(function (tr) { return tr.getHandlerFunction() === "backupNow"; });
/** Once, when an admin opens the app: a weekly backup (from before) becomes nightly. One that's off stays off. */
function backupDailyOnce_() {
  const P = PropertiesService.getScriptProperties();
  if (P.getProperty("BACKUP_SCHED") === "daily") return;
  if (backupIsOn_()) backupSchedule_(); else P.setProperty("BACKUP_SCHED", "daily");
}
/** Settings › Backups: { on, last (the newest copy here), n (how many), keep, email2 (the second account), shared (the
 *  sheet shared with it), id and name (for its script), tz }. Admins. */
function backupInfo_() {
  const ss = SpreadsheetApp.getActive(), prefix = ss.getName() + " backup ", P = PropertiesService.getScriptProperties();
  let last = "", n = 0;
  const folder = hubFind_("BACKUP_FOLDER_ID");   // none yet: none made
  if (folder) {
    const fi = folder.getFiles();
    while (fi.hasNext()) { const f = fi.next(); if (f.isTrashed() || f.getName().indexOf(prefix) !== 0) continue; n++; const at = f.getDateCreated().toISOString(); if (at > last) last = at; }
  }
  const email2 = P.getProperty(BACKUP2) || "";
  return { ok: true, on: backupIsOn_(), last: last, n: n, keep: BACKUP_KEEP, email2: email2, shared: email2 ? backupShared_(email2) : false,
    id: ss.getId(), name: ss.getName(), tz: Session.getScriptTimeZone() };
}
/** Is the sheet shared with `email` (view or edit)? */
function backupShared_(email) {
  const f = DriveApp.getFileById(SpreadsheetApp.getActive().getId()), e = String(email).toLowerCase();
  return f.getViewers().concat(f.getEditors()).some(function (u) { return String(u.getEmail()).toLowerCase() === e; });
}
/** Settings › Backups: { on: true/false } turns the nightly backup on (the first copy made when there's none) or off;
 *  { now: true } makes a copy now; { email2 } sets the second account (the sheet shared with it, view only; the one
 *  before unshared, unless it can edit), "" takes it away. Admins. */
function backupSet_(req) {
  const P = PropertiesService.getScriptProperties();
  if (req.on === true) { backupSchedule_(); if (!backupInfo_().n) backupNow(); }
  if (req.on === false) backupOff_();
  if (req.now === true) backupNow();
  if (req.email2 !== undefined) {
    const e = String(req.email2 || "").trim().toLowerCase(), was = P.getProperty(BACKUP2) || "";
    if (e && !CP_EMAIL.test(e)) return { ok: false, error: "bad_email" };
    let me = "";
    try { me = String(Session.getEffectiveUser().getEmail() || "").toLowerCase(); } catch (x) { /* unknown */ }
    if (e && me && e === me) return { ok: false, error: "same_account" };
    const f = DriveApp.getFileById(SpreadsheetApp.getActive().getId());
    if (e && e !== was) {
      try { f.addViewer(e); } catch (x) { return { ok: false, error: "share_failed", why: String(x && x.message || x).slice(0, 200) }; }
    }
    if (was && was !== e) { try { f.removeViewer(was); } catch (x) { /* already gone, or it can edit: left as it is */ } }
    if (e) P.setProperty(BACKUP2, e); else P.deleteProperty(BACKUP2);
  }
  return backupInfo_();
}
/** A copy of the whole sheet in the backups folder; older ones beyond the newest 30 go to the Drive trash. */
function backupNow() {
  const ss = SpreadsheetApp.getActive();
  const folder = hubSub_("BACKUP_FOLDER_ID");   // VODA Hub › Backups (the old "VODA Prime backups" moved in)
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
const MOVE_JOBS = ["gpsSync", "tmCheckEmail", "paperworkEmail", "backupNow", "rebuildCalendarTick"];

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
  else if (name === "rebuildCalendarTick") ScriptApp.newTrigger("rebuildCalendarTick").timeBased().everyMinutes(15).create();
}
