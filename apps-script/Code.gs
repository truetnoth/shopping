/**
 * База брендов — бэкенд поверх Google-таблицы.
 *
 * Деплоится как Web App: Deploy → New deployment → Web app,
 * "Execute as: Me", "Who has access: Anyone".
 *
 * ВАЖНО при обновлении кода: публикуйте новую версию через
 * Deploy → Manage deployments → (карандаш) → Version: New version.
 * Кнопка "New deployment" выдаёт ДРУГОЙ URL и ломает уже собранный фронт.
 *
 * Разовая настройка после первого деплоя — запустить в редакторе (кнопка Run,
 * функция выбирается в выпадающем списке рядом с ней):
 *   setupSheet()          // служебные колонки, лист _schema, id для строк
 *   setEditorPassword()   // пароль берётся из NEW_PASSWORD чуть ниже
 */

// ─────────────────────────────────────────────────────────────────────────────
// Впишите сюда пароль редакции, запустите функцию setEditorPassword,
// затем сотрите пароль обратно и сохраните файл: в свойствах скрипта остаётся
// только его SHA-256, восстановить пароль из него нельзя.
var NEW_PASSWORD = '';
// ─────────────────────────────────────────────────────────────────────────────

var SCHEMA_SHEET = '_schema';
var SYSTEM_FIELDS = ['id', 'updated_at', 'updated_by', 'archived'];
var PROP_PASSWORD = 'EDITOR_PASSWORD_SHA256';
var PROP_REVISION = 'REVISION';
var PROP_SHEET_NAME = 'SHEET_NAME';
var PROP_NAME_COLUMN = 'NAME_COLUMN';

// Apps Script всегда отвечает HTTP 200, поэтому статус едет в теле ответа.
var ERR_BAD_REQUEST = 400;
var ERR_UNAUTHORIZED = 401;
var ERR_NOT_FOUND = 404;
var ERR_CONFLICT = 409;
var ERR_DUPLICATE = 422;
var ERR_SERVER = 500;

/* ------------------------------------------------------------------ роутинг */

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'list';
    if (action === 'version') return ok({ revision: getRevision_() });
    if (action === 'list') return ok(listPayload_());
    if (action === 'schema') return ok({ fields: buildFields_(), revision: getRevision_() });
    return fail(ERR_BAD_REQUEST, 'Неизвестное действие: ' + action);
  } catch (err) {
    return fail(ERR_SERVER, String(err && err.message ? err.message : err));
  }
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return fail(ERR_BAD_REQUEST, 'Тело запроса не является JSON');
  }

  try {
    if (!checkAuth_(body.token)) return fail(ERR_UNAUTHORIZED, 'Неверный пароль');

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return fail(ERR_SERVER, 'Таблица занята другой правкой, попробуйте ещё раз');
    try {
      switch (body.action) {
        case 'create': return createBrand_(body);
        case 'update': return updateBrand_(body);
        case 'archive': return archiveBrand_(body);
        default: return fail(ERR_BAD_REQUEST, 'Неизвестное действие: ' + body.action);
      }
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return fail(ERR_SERVER, String(err && err.message ? err.message : err));
  }
}

/* ------------------------------------------------------------------ операции */

function createBrand_(body) {
  var values = body.values || {};
  var sheet = getSheet_();
  var headers = getHeaders_(sheet);
  var nameCol = getNameColumn_(headers);
  var name = String(values[nameCol] || '').trim();

  if (!name) return fail(ERR_BAD_REQUEST, 'Не заполнено название бренда («' + nameCol + '»)');

  if (!body.force) {
    var dupes = findDuplicates_(sheet, headers, nameCol, name, null);
    if (dupes.length) {
      return fail(ERR_DUPLICATE, 'Похожий бренд уже есть в базе', { duplicates: dupes });
    }
  }

  var now = new Date().toISOString();
  var row = headers.map(function (header) {
    if (header === 'id') return Utilities.getUuid();
    if (header === 'updated_at') return now;
    if (header === 'updated_by') return String(body.author || '').trim();
    if (header === 'archived') return false;
    return values.hasOwnProperty(header) ? serializeValue_(values[header]) : '';
  });

  sheet.appendRow(row);
  var revision = bumpRevision_();
  return ok({ row: rowToObject_(headers, row), revision: revision });
}

function updateBrand_(body) {
  var sheet = getSheet_();
  var headers = getHeaders_(sheet);
  var found = findRowById_(sheet, headers, body.id);
  if (!found) return fail(ERR_NOT_FOUND, 'Бренд не найден — возможно, строку удалили из таблицы');

  var current = rowToObject_(headers, found.values);

  // Оптимистичная блокировка: правим только если с момента открытия формы
  // строку никто не трогал.
  if (body.baseUpdatedAt !== undefined && String(current.updated_at || '') !== String(body.baseUpdatedAt || '')) {
    return fail(ERR_CONFLICT, 'Бренд уже изменили в таблице', { row: current, revision: getRevision_() });
  }

  var values = body.values || {};
  var nameCol = getNameColumn_(headers);
  if (values.hasOwnProperty(nameCol) && !String(values[nameCol] || '').trim()) {
    return fail(ERR_BAD_REQUEST, 'Не заполнено название бренда («' + nameCol + '»)');
  }

  var now = new Date().toISOString();
  var next = headers.map(function (header, i) {
    if (header === 'id') return current.id;
    if (header === 'updated_at') return now;
    if (header === 'updated_by') return String(body.author || current.updated_by || '').trim();
    // archived меняется только действием "в архив" — иначе форма записала бы
    // в ячейку-галочку строку 'TRUE' вместо булева значения.
    if (header === 'archived') return found.values[i];
    // Поля, которых нет в запросе, остаются как есть — фронт может знать
    // не про все колонки таблицы.
    return values.hasOwnProperty(header) ? serializeValue_(values[header]) : found.values[i];
  });

  sheet.getRange(found.rowIndex, 1, 1, headers.length).setValues([next]);
  var revision = bumpRevision_();
  return ok({ row: rowToObject_(headers, next), revision: revision });
}

function archiveBrand_(body) {
  var sheet = getSheet_();
  var headers = getHeaders_(sheet);
  var col = headers.indexOf('archived');
  if (col === -1) return fail(ERR_BAD_REQUEST, 'В таблице нет колонки archived');

  var found = findRowById_(sheet, headers, body.id);
  if (!found) return fail(ERR_NOT_FOUND, 'Бренд не найден');

  var archived = body.archived === undefined ? true : !!body.archived;
  sheet.getRange(found.rowIndex, col + 1).setValue(archived);

  var updatedAtCol = headers.indexOf('updated_at');
  if (updatedAtCol !== -1) sheet.getRange(found.rowIndex, updatedAtCol + 1).setValue(new Date().toISOString());

  var values = sheet.getRange(found.rowIndex, 1, 1, headers.length).getValues()[0];
  return ok({ row: rowToObject_(headers, values), revision: bumpRevision_() });
}

/* ------------------------------------------------------------------- чтение */

function listPayload_() {
  var sheet = getSheet_();
  var headers = getHeaders_(sheet);
  return {
    revision: getRevision_(),
    nameColumn: getNameColumn_(headers),
    fields: buildFields_(sheet, headers),
    rows: readRows_(sheet, headers)
  };
}

function readRows_(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var nameCol = getNameColumn_(headers);
  var rows = [];

  for (var i = 0; i < values.length; i++) {
    var obj = rowToObject_(headers, values[i]);
    // Пустые строки внутри листа пропускаем, чтобы они не всплывали в поиске.
    if (!obj.id && !String(obj[nameCol] || '').trim()) continue;
    rows.push(obj);
  }
  return rows;
}

/**
 * Схема выводится из шапки листа; лист _schema только уточняет типы и подписи.
 * Новая колонка в таблице появляется на сайте сама, без правки кода.
 */
function buildFields_(sheet, headers) {
  sheet = sheet || getSheet_();
  headers = headers || getHeaders_(sheet);

  var overrides = readSchemaSheet_();
  var nameCol = getNameColumn_(headers);

  var fields = headers
    .filter(function (h) { return h && SYSTEM_FIELDS.indexOf(h) === -1; })
    .map(function (h, i) {
      var o = overrides[h] || {};
      return {
        column: h,
        label: o.label || h,
        type: o.type || 'text',
        options: o.options || [],
        required: o.required === undefined ? h === nameCol : o.required,
        searchable: o.searchable === undefined ? true : o.searchable,
        showInCard: o.showInCard === undefined ? true : o.showInCard,
        order: o.order === undefined ? 100 + i : o.order,
        isName: h === nameCol
      };
    });

  fields.sort(function (a, b) { return a.order - b.order; });
  return fields;
}

function readSchemaSheet_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SCHEMA_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return {};

  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var idx = {};
  headers.forEach(function (h, i) { idx[h] = i; });
  if (idx.column === undefined) return {};

  var out = {};
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var column = String(row[idx.column] || '').trim();
    if (!column) continue;

    out[column] = {
      label: pick_(row, idx.label) ? String(row[idx.label]).trim() : undefined,
      type: pick_(row, idx.type) ? String(row[idx.type]).trim().toLowerCase() : undefined,
      options: pick_(row, idx.options)
        ? String(row[idx.options]).split(',').map(function (s) { return s.trim(); }).filter(String)
        : undefined,
      required: pick_(row, idx.required) ? toBool_(row[idx.required]) : undefined,
      searchable: pick_(row, idx.searchable) ? toBool_(row[idx.searchable]) : undefined,
      showInCard: pick_(row, idx.showInCard) ? toBool_(row[idx.showInCard]) : undefined,
      order: pick_(row, idx.order) && row[idx.order] !== '' ? Number(row[idx.order]) : undefined
    };
  }
  return out;
}

/* ----------------------------------------------------------------- утилиты */

function getSheet_() {
  var ss = SpreadsheetApp.getActive();
  var name = PropertiesService.getScriptProperties().getProperty(PROP_SHEET_NAME);
  var sheet = name ? ss.getSheetByName(name) : ss.getSheets()[0];
  if (!sheet) throw new Error('Не найден лист с данными: ' + name);
  return sheet;
}

function getHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('В листе нет колонок');
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
}

function getNameColumn_(headers) {
  var configured = PropertiesService.getScriptProperties().getProperty(PROP_NAME_COLUMN);
  if (configured && headers.indexOf(configured) !== -1) return configured;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] && SYSTEM_FIELDS.indexOf(headers[i]) === -1) return headers[i];
  }
  throw new Error('Не удалось определить колонку с названием бренда');
}

function rowToObject_(headers, values) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    if (!headers[i]) continue;
    var v = values[i];
    if (v instanceof Date) v = v.toISOString();
    else if (typeof v === 'boolean') v = v ? 'TRUE' : 'FALSE';
    else v = String(v === null || v === undefined ? '' : v);
    obj[headers[i]] = v;
  }
  return obj;
}

function findRowById_(sheet, headers, id) {
  id = String(id || '').trim();
  if (!id) return null;

  var col = headers.indexOf('id');
  if (col === -1) throw new Error('В таблице нет колонки id — выполните backfillIds()');

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var ids = sheet.getRange(2, col + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) {
      var rowIndex = i + 2;
      return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0] };
    }
  }
  return null;
}

function findDuplicates_(sheet, headers, nameCol, name, exceptId) {
  var needle = normalizeName_(name);
  return readRows_(sheet, headers)
    .filter(function (row) {
      if (exceptId && row.id === exceptId) return false;
      return normalizeName_(row[nameCol]) === needle;
    })
    .slice(0, 5);
}

function normalizeName_(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function serializeValue_(v) {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v === null || v === undefined ? '' : String(v);
}

function toBool_(v) {
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'да' || s === '1' || s === 'yes' || v === true;
}

function pick_(row, idx) {
  return idx !== undefined && row[idx] !== '' && row[idx] !== null && row[idx] !== undefined;
}

function getRevision_() {
  return Number(PropertiesService.getScriptProperties().getProperty(PROP_REVISION) || 0);
}

function bumpRevision_() {
  var next = getRevision_() + 1;
  PropertiesService.getScriptProperties().setProperty(PROP_REVISION, String(next));
  return next;
}

function checkAuth_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty(PROP_PASSWORD);
  if (!expected) throw new Error('Пароль не настроен: выполните setEditorPassword(...) в редакторе скрипта');
  return constantTimeEquals_(String(token || '').toLowerCase(), expected.toLowerCase());
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sha256Hex_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function ok(payload) {
  payload = payload || {};
  payload.ok = true;
  return json_(payload);
}

function fail(code, message, extra) {
  var payload = { ok: false, error: { code: code, message: message } };
  if (extra) for (var k in extra) payload.error[k] = extra[k];
  return json_(payload);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

/* --------------------------------------------- ручные операции из редактора */

/**
 * Разово: задать общий пароль редакции. В свойствах хранится только хэш.
 * Кнопка Run в редакторе Apps Script не умеет передавать аргументы, поэтому
 * пароль берётся из NEW_PASSWORD вверху файла.
 */
function setEditorPassword(password) {
  var value = password || NEW_PASSWORD;
  if (!value) {
    throw new Error('Впишите пароль в NEW_PASSWORD вверху файла и запустите setEditorPassword ещё раз');
  }
  PropertiesService.getScriptProperties().setProperty(PROP_PASSWORD, sha256Hex_(value));
  return 'Пароль сохранён (хэш). Теперь сотрите его из NEW_PASSWORD и сохраните файл.';
}

/** Разово: проставить UUID строкам, у которых id пустой. */
function backfillIds() {
  var sheet = getSheet_();
  var headers = getHeaders_(sheet);
  var col = headers.indexOf('id');
  if (col === -1) throw new Error('Добавьте в шапку колонку id');

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Нет строк с данными.';

  var range = sheet.getRange(2, col + 1, lastRow - 1, 1);
  var ids = range.getValues();
  var filled = 0;
  for (var i = 0; i < ids.length; i++) {
    if (!String(ids[i][0]).trim()) {
      ids[i][0] = Utilities.getUuid();
      filled++;
    }
  }
  range.setValues(ids);
  bumpRevision_();
  return 'Заполнено id: ' + filled;
}

/** Разово: создать недостающие служебные колонки и лист _schema. */
function setupSheet() {
  var sheet = getSheet_();
  var headers = getHeaders_(sheet);
  var added = [];

  SYSTEM_FIELDS.forEach(function (field) {
    if (headers.indexOf(field) === -1) {
      sheet.insertColumnAfter(sheet.getLastColumn());
      sheet.getRange(1, sheet.getLastColumn()).setValue(field);
      added.push(field);
    }
  });

  var ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(SCHEMA_SHEET)) {
    var schema = ss.insertSheet(SCHEMA_SHEET);
    schema.getRange(1, 1, 1, 8).setValues([[
      'column', 'label', 'type', 'options', 'required', 'searchable', 'showInCard', 'order'
    ]]);
    schema.setFrozenRows(1);
    added.push('лист ' + SCHEMA_SHEET);
  }

  backfillIds();
  return added.length ? 'Добавлено: ' + added.join(', ') : 'Всё уже на месте.';
}
