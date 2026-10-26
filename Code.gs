// Google Apps Script backend for the wedding registry.
// Deploy: Extensions > Apps Script in your Google Sheet, paste this, then Deploy > Web app
//   Execute as: Me, Who has access: Anyone.
// Sheets required: "Gifts", "Funds", "Reservations" (auto-created).

const SHEET_GIFTS = 'Gifts';
const SHEET_FUNDS = 'Funds';
const SHEET_RES = 'Reservations';
const ADMIN_TOKEN = ''; // optional fallback; prefer Script Properties 'ADMIN_TOKEN'

const GIFT_COLUMNS = [
  'id', 'name', 'description', 'price', 'category', 'image', 'storeUrl',
  'quantity', 'claimed', 'reservedBy', 'reservedAt', 'message', 'priority',
  'active', 'note'
];

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
    sh.appendRow(GIFT_COLUMNS);
  }
  if (!ss.getSheetByName(SHEET_FUNDS)) {
    const sh = ss.insertSheet(SHEET_FUNDS);
    sh.appendRow(['id','name','description','goal','raised','link','qrImage']);
  }
  if (!ss.getSheetByName(SHEET_RES)) {
    const sh = ss.insertSheet(SHEET_RES);
    sh.appendRow(['timestamp','giftId','name','message','status']);
  }
  // Older sheets may predate a column. Add any missing ones at the end so
  // reservations and notes keep working without a manual re-import.
  ensureColumns_(ss.getSheetByName(SHEET_GIFTS), GIFT_COLUMNS);
}

function ensureColumns_(sh, required) {
  const lastCol = sh.getLastColumn();
  const headers = lastCol > 0
    ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String)
    : [];
  const missing = required.filter(h => headers.indexOf(h) === -1);
  if (missing.length) {
    sh.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
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
    if (action === 'cancel') return handleCancel_(body);
    if (action === 'adminList') return handleAdminList_(body);
    if (action === 'add') return handleAdd_(body);
    if (action === 'update') return handleUpdate_(body);
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
    const gifts = sheetToObjects_(SHEET_GIFTS).map(publicGift_);
    const funds = sheetToObjects_(SHEET_FUNDS);
    return json_({ gifts, funds });
  }
  return json_({ ok: false, error: 'Unknown action' });
}

// The public endpoint must never reveal who reserved an item or their note to
// the couple.
function publicGift_(g) {
  const copy = Object.assign({}, g);
  delete copy.reservedBy;
  delete copy.reservedAt;
  delete copy.message;
  return copy;
}

function handleAdminList_(body) {
  if (!authorized_(body)) return json_({ ok: false, error: 'Unauthorized' });
  return json_({ ok: true, gifts: sheetToObjects_(SHEET_GIFTS) });
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

// Cancelling only requires the gift id and an explicit confirmation in the UI.
// The couple has chosen to trust guests, so there is no identity check.
function handleCancel_(body) {
  const id = body.id;
  if (!id) return json_({ ok: false, error: 'Missing gift id' });
  const sh = ss_().getSheetByName(SHEET_GIFTS);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const row = findRow_(sh, id);
  if (row < 0) return json_({ ok: false, error: 'Gift not found' });
  const idx = (h) => headers.indexOf(h) + 1;

  const claimed = Number(sh.getRange(row, idx('claimed')).getValue()) || 0;
  if (claimed <= 0) return json_({ ok: false, error: 'This gift is not currently reserved.' });
  const name = String(sh.getRange(row, idx('reservedBy')).getValue() || '');
  const remaining = Math.max(0, claimed - 1);
  sh.getRange(row, idx('claimed')).setValue(remaining);
  if (remaining === 0) {
    sh.getRange(row, idx('reservedBy')).setValue('');
    sh.getRange(row, idx('reservedAt')).setValue('');
    sh.getRange(row, idx('message')).setValue('');
  }

  const log = ss_().getSheetByName(SHEET_RES);
  log.appendRow([new Date().toISOString(), id, name, '', 'cancelled']);
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
    reservedBy: '', reservedAt: '', message: '', priority: g.priority || 'medium', active: true,
    note: g.note || '',
  };
  sh.appendRow(objectsToRow_(headers, row));
  return json_({ ok: true, id });
}

function handleUpdate_(body) {
  if (!authorized_(body)) return json_({ ok: false, error: 'Unauthorized' });
  const g = body.gift || {};
  if (!g.id || !g.name) return json_({ ok: false, error: 'Name required' });
  const sh = ss_().getSheetByName(SHEET_GIFTS);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const row = findRow_(sh, g.id);
  if (row < 0) return json_({ ok: false, error: 'Not found' });
  const idx = (h) => headers.indexOf(h) + 1;

  const quantity = Math.max(1, parseInt(g.quantity, 10) || 1);
  const claimed = Number(sh.getRange(row, idx('claimed')).getValue()) || 0;
  sh.getRange(row, idx('name')).setValue(g.name);
  sh.getRange(row, idx('description')).setValue(g.description || '');
  sh.getRange(row, idx('price')).setValue(g.price || 0);
  sh.getRange(row, idx('category')).setValue(g.category || 'Other');
  sh.getRange(row, idx('image')).setValue(g.image || '');
  sh.getRange(row, idx('storeUrl')).setValue(g.storeUrl || '');
  sh.getRange(row, idx('quantity')).setValue(quantity);
  sh.getRange(row, idx('priority')).setValue(g.priority || 'medium');
  sh.getRange(row, idx('note')).setValue(g.note || '');
  // Keep existing reservations, but never leave more claimed than the new quantity.
  if (claimed > quantity) sh.getRange(row, idx('claimed')).setValue(quantity);
  return json_({ ok: true });
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