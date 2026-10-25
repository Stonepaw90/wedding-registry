// Google Apps Script backend for the wedding registry.
// Deploy: Extensions > Apps Script in your Google Sheet, paste this, then Deploy > Web app
//   Execute as: Me, Who has access: Anyone.
// Sheets required: "Gifts", "Funds", "Reservations" (auto-created).

const SHEET_GIFTS = 'Gifts';
const SHEET_FUNDS = 'Funds';
const SHEET_RES = 'Reservations';
const ADMIN_TOKEN = ''; // optional fallback; prefer Script Properties 'ADMIN_TOKEN'

function getToken_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN') || ADMIN_TOKEN;
}

function authorized_(body) {
  const expected = getToken_();
  return !!expected && body.token === expected;
}

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function ensureSheets_() {
  const ss = ss_();
  if (!ss.getSheetByName(SHEET_GIFTS)) {
    const sh = ss.insertSheet(SHEET_GIFTS);
    sh.appendRow(['id','name','description','price','category','image','storeUrl','quantity','claimed','reservedBy','reservedAt','message','priority','active','note']);
  }
  if (!ss.getSheetByName(SHEET_FUNDS)) {
    const sh = ss.insertSheet(SHEET_FUNDS);
    sh.appendRow(['id','name','description','goal','raised','link','qrImage']);
  }
  if (!ss.getSheetByName(SHEET_RES)) {
    const sh = ss.insertSheet(SHEET_RES);
    sh.appendRow(['timestamp','giftId','name','message','status']);
  }
}

function sheetToObjects_(name) {
  ensureSheets_();
  const sh = ss_().getSheetByName(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    const o = {};
    headers.forEach((h, i) => { o[h] = row[i]; });
    return o;
  }).filter(o => o.id);
}

function findRow_(sh, id) {
  const values = sh.getDataRange().getValues();
  const idCol = values[0].indexOf('id');
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) return r + 1; // 1-based
  }
  return -1;
}

function objectsToRow_(headers, obj) {
  return headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
}

function doPost(e) {
  ensureSheets_();
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { body = e.parameter || {}; }
  const action = body.action || e.parameter.action;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (action === 'reserve') return handleReserve_(body);
    if (action === 'add') return handleAdd_(body);
    if (action === 'remove') return handleRemove_(body);
    if (action === 'unreserve') return handleUnreserve_(body);
    return json_({ ok: false, error: 'Unknown action' });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  ensureSheets_();
  const action = (e.parameter && e.parameter.action) || 'list';
  if (action === 'list') {
    const gifts = sheetToObjects_(SHEET_GIFTS);
    const funds = sheetToObjects_(SHEET_FUNDS);
    return json_({ gifts, funds });
  }
  return json_({ ok: false, error: 'Unknown action' });
}

function handleReserve_(body) {
  const id = body.id, name = String(body.name || '').trim(), message = String(body.message || '').trim();
  if (!id || !name) return json_({ ok: false, error: 'Missing id or name' });
  const sh = ss_().getSheetByName(SHEET_GIFTS);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const row = findRow_(sh, id);
  if (row < 0) return json_({ ok: false, error: 'Gift not found' });
  const idx = (h) => headers.indexOf(h) + 1;
  const claimed = Number(sh.getRange(row, idx('claimed')).getValue()) || 0;
  const quantity = Number(sh.getRange(row, idx('quantity')).getValue()) || 1;
  if (claimed >= quantity) return json_({ ok: false, error: 'Already reserved' });

  sh.getRange(row, idx('claimed')).setValue(claimed + 1);
  sh.getRange(row, idx('reservedBy')).setValue(name);
  sh.getRange(row, idx('reservedAt')).setValue(new Date().toISOString());
  sh.getRange(row, idx('message')).setValue(message);

  const log = ss_().getSheetByName(SHEET_RES);
  log.appendRow([new Date().toISOString(), id, name, message, 'reserved']);
  return json_({ ok: true });
}

function handleAdd_(body) {
  if (!authorized_(body)) return json_({ ok: false, error: 'Unauthorized' });
  const g = body.gift || {};
  if (!g.name) return json_({ ok: false, error: 'Name required' });
  const sh = ss_().getSheetByName(SHEET_GIFTS);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const id = g.id || ('g' + Date.now());
  const row = {
    id, name: g.name, description: g.description || '', price: g.price || 0, category: g.category || 'Other',
    image: g.image || '', storeUrl: g.storeUrl || '', quantity: g.quantity || 1, claimed: 0,
    reservedBy: '', reservedAt: '', message: '', priority: g.priority || 'medium', active: true, note: g.note || '',
  };
  sh.appendRow(objectsToRow_(headers, row));
  return json_({ ok: true, id });
}

function handleRemove_(body) {
  if (!authorized_(body)) return json_({ ok: false, error: 'Unauthorized' });
  const sh = ss_().getSheetByName(SHEET_GIFTS);
  const row = findRow_(sh, body.id);
  if (row < 0) return json_({ ok: false, error: 'Not found' });
  sh.deleteRow(row);
  return json_({ ok: true });
}

function handleUnreserve_(body) {
  if (!authorized_(body)) return json_({ ok: false, error: 'Unauthorized' });
  const sh = ss_().getSheetByName(SHEET_GIFTS);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const row = findRow_(sh, body.id);
  if (row < 0) return json_({ ok: false, error: 'Not found' });
  const idx = (h) => headers.indexOf(h) + 1;
  sh.getRange(row, idx('claimed')).setValue(0);
  sh.getRange(row, idx('reservedBy')).setValue('');
  sh.getRange(row, idx('reservedAt')).setValue('');
  sh.getRange(row, idx('message')).setValue('');
  return json_({ ok: true });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}