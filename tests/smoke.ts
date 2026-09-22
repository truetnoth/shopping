/**
 * Проверки чистой логики поиска, фильтров и валидации — без браузера и без
 * обращения к Google. Фикстура повторяет реальную структуру и данные таблицы
 * редакции. Запуск: npm test
 */
import type { BrandRow, FieldDef } from '../src/api/types'
import {
  applyFilters, boolPair, coreFields, filterGroups, findSimilar, normalizeOption,
  optionsWithOwn, splitFilters, splitMulti, urlField, validate,
} from '../src/lib/schema'
import { pageItems } from '../src/lib/paginate'
import { buildIndex, runSearch } from '../src/lib/search'
import { cyrToLat, phoneticKey } from '../src/lib/translit'
import { isClockSkew } from '../src/lib/clock'

const f = (column: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  column, label: column, type: 'text', options: [], required: false,
  searchable: true, showInCard: true, order: 1, isName: false, filterGroup: '', ...extra,
})

const fields: FieldDef[] = [
  f('Бренд', { isName: true, required: true }),
  f('Страна', { type: 'select' }),
  f('Категория', { type: 'multiselect', options: ['Одежда', 'Верхняя одежда', 'Сумки', 'Обувь'] }),
  f('Ценовой сегмент', { type: 'select', options: ['$', '$$', '$$$'] }),
  f('Для кого', { type: 'multiselect', options: ['Для женщин', 'Для мужчин'] }),
  f('Ссылка', { type: 'url' }),
  f('Теги', { type: 'multiselect' }),
  f('Ручная работа', { type: 'bool', options: ['да'] }),
  f('Город', { type: 'select' }),
]

const row = (values: string[]): BrandRow => {
  const out: BrandRow = { id: values[0], archived: 'FALSE' }
  fields.forEach((field, i) => { out[field.column] = values[i] })
  return out
}

const rows: BrandRow[] = [
  row(['Ame', 'Россия', 'Одежда, Верхняя одежда', '$$', 'Для женщин', 'https://ame-store.ru', 'Кэжуал, Деловой стиль, Ледилайк', '', 'Москва']),
  row(['Anka', 'Россия', 'Сумки', '$$', 'Для женщин', 'http://ankabags.ru', 'Ледилайк', 'да', 'Петербург']),
  row(['Novaya', 'Россия', 'Одежда, Верхняя одежда', '$$', 'Для женщин, Для мужчин', 'https://novayawear.com', 'Аутдор', '', 'Петербург']),
  row(['May of May', 'Россия', 'Одежда', '$$$', 'Для женщин', 'https://mayofmay.ru', 'Деловой стиль', '', 'Москва']),
  row(['Wysh', 'Россия', 'Обувь', '$', 'Для женщин', 'https://wysh-brand.com', 'Ледилайк, Кэжуал', 'да', 'Петербург']),
]

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `\n        получили ${a}, ждали ${e}`}`)
}

/* ------------------------------------------------------- поиск в двух раскладках */

check('транслитерация кириллицы', cyrToLat('Гуччи'), 'guchchi')
check('фонетический ключ: Gucci', phoneticKey('Gucci'), 'guki')
check('фонетический ключ: Гуччи', phoneticKey('Гуччи'), 'guki')
check('фонетический ключ: Wysh', phoneticKey('Wysh'), 'vis')
check('фонетический ключ: Выш', phoneticKey('Выш'), 'vis')

const index = buildIndex(fields, rows)
const names = (q: string) => runSearch(index, q).map((r) => r['Бренд']).sort()

check('точный латинский запрос', names('Novaya'), ['Novaya'])
check('префиксный запрос', names('Ank'), ['Anka'])
check('кириллицей по латинскому названию', names('Новая'), ['Novaya'])
check('кириллицей по латинскому названию (Выш)', names('Выш'), ['Wysh'])
check('опечатка в одну букву', names('Novaia'), ['Novaya'])
check('поиск по неосновному полю', names('Аутдор'), ['Novaya'])
check('поиск по городу', names('Москва'), ['Ame', 'May of May'])
check('запрос из двух слов', names('May of May'), ['May of May'])
check('пустой запрос отдаёт всё', runSearch(index, '   ').length, 5)
check('мусорный запрос', names('квщшгф'), [])

/* -------------------------------------------------------------------- фильтры */

const ids = (rs: BrandRow[]) => rs.map((r) => r.id).sort()

check('фильтр по multiselect', ids(applyFilters(rows, { 'Категория': ['Сумки'] }, fields)), ['Anka'])
check('multiselect ловит значение внутри списка', ids(applyFilters(rows, { 'Категория': ['Верхняя одежда'] }, fields)), ['Ame', 'Novaya'])
check('несколько значений одного поля — ИЛИ', ids(applyFilters(rows, { 'Категория': ['Сумки', 'Обувь'] }, fields)), ['Anka', 'Wysh'])
check('фильтр по select', ids(applyFilters(rows, { 'Ценовой сегмент': ['$$'] }, fields)), ['Ame', 'Anka', 'Novaya'])
check('булев фильтр', ids(applyFilters(rows, { 'Ручная работа': ['Да'] }, fields)), ['Anka', 'Wysh'])
check('разные поля — И', ids(applyFilters(rows, { 'Город': ['Петербург'], 'Ручная работа': ['Да'] }, fields)), ['Anka', 'Wysh'])
check('пустой фильтр не режет выдачу', applyFilters(rows, { 'Категория': [] }, fields).length, 5)

/* --------------------------------------------------------------- схема и формы */

// Справочники закрыты: варианты берутся только из схемы и в порядке базы.
check('варианты — из схемы, в порядке базы', optionsWithOwn(fields[2], 'Сумки'), ['Одежда', 'Верхняя одежда', 'Сумки', 'Обувь'])
check('своё значение вне справочника не теряется', optionsWithOwn(fields[2], 'Сумки, Нижнее бельё'), ['Одежда', 'Верхняя одежда', 'Сумки', 'Обувь', 'Нижнее бельё'])
check('то же для поля с одним значением', optionsWithOwn(fields[3], '4'), ['$', '$$', '$$$', '4'])
check('поле без вариантов в базе их и не получит', optionsWithOwn(fields[6], ''), [])
check('разбор мультизначения', splitMulti('Одежда,  Верхняя одежда ,,Сумки'), ['Одежда', 'Верхняя одежда', 'Сумки'])

// Открытый справочник — единственное исключение из закрытости: к вариантам из
// схемы он добавляет всё, что уже встречается в данных. Так вписанный из формы
// город становится кнопкой у всей редакции, без правки field_defs.
const cityOpen = f('Город', { type: 'openselect', options: ['Москва', 'Нижний Новгород'] })
check(
  'открытый справочник растёт из данных',
  optionsWithOwn(cityOpen, '', rows),
  ['Москва', 'Нижний Новгород', 'Петербург'],
)
check(
  'вписанное значение строки не дублируется',
  optionsWithOwn(cityOpen, 'Петербург', rows),
  ['Москва', 'Нижний Новгород', 'Петербург'],
)
check('закрытый справочник данные не подхватывает', optionsWithOwn(fields[8], '', rows), [])

// «Пометки» в красоте — тот же открытый справочник, но многозначный: у бренда
// их бывает несколько сразу, и вписанное из формы становится кнопкой у всех.
const marks = f('Пометки', { type: 'openmulti', options: ['не тестируется на животных'] })
const marked: BrandRow[] = [
  { id: 'm1', 'Пометки': 'веган, без отдушек' },
  { id: 'm2', 'Пометки': 'не тестируется на животных' },
  { id: 'm3', 'Пометки': '' },
]
check(
  'открытый многозначный справочник растёт из данных',
  optionsWithOwn(marks, '', marked),
  ['не тестируется на животных', 'без отдушек', 'веган'],
)
check(
  'выбранные пометки разбираются через запятую',
  optionsWithOwn(marks, 'веган, своё', marked),
  ['не тестируется на животных', 'без отдушек', 'веган', 'своё'],
)
check(
  'фильтр по пометкам ловит одну из нескольких',
  applyFilters(marked, { 'Пометки': ['веган'] }, [marks]).map((r) => r.id),
  ['m1'],
)
check(
  'несколько пометок в фильтре — это «или»',
  applyFilters(marked, { 'Пометки': ['веган', 'не тестируется на животных'] }, [marks]).map((r) => r.id),
  ['m1', 'm2'],
)
check('своё написание приводится к известному', normalizeOption(' казань ', ['Казань']), 'Казань')
check('новое значение только обрезается', normalizeOption('  Казань', ['Москва']), 'Казань')
check('пустой ввод ничего не задаёт', normalizeOption('   ', ['Москва']), '')
check('булево пишется как в таблице', boolPair(fields[7]), ['да', ''])
check('булево по умолчанию', boolPair(fields[1]), ['TRUE', 'FALSE'])

/* ------------------------------------------- главные и дополнительные фильтры */

// Порядок повторяет field_defs: категория (3), «Для кого» (4), цена (5) и
// мультибренд (6) видны сразу, всё, что дальше, уезжает под раскрывашку.
// Нефильтруемые поля (название, ссылка, год) не попадают никуда.
const ordered: FieldDef[] = [
  f('Бренд', { isName: true, order: 1 }),
  f('Ссылка', { type: 'url', order: 2 }),
  f('Категория', { type: 'multiselect', order: 3 }),
  f('Для кого', { type: 'multiselect', order: 4 }),
  f('Ценовой сегмент', { type: 'select', order: 5 }),
  f('Мультибренд', { type: 'bool', options: ['да'], order: 6 }),
  f('Теги', { type: 'multiselect', order: 7 }),
  f('Город', { type: 'openselect', order: 15 }),
  f('Год основания', { type: 'number', order: 17 }),
]

const columns = (list: FieldDef[]) => list.map((field) => field.column)

check('главные фильтры — начало схемы', columns(splitFilters(ordered).primary), ['Категория', 'Для кого', 'Ценовой сегмент', 'Мультибренд'])
check('остальные фильтры — под раскрывашкой', columns(splitFilters(ordered).extra), ['Теги', 'Город'])

/**
 * Галочка стоит отдельной строкой, если редакция не собрала её с другими через
 * filter_group. Умолчание такое намеренно: «Мультибренд», «Продается на
 * маркетплейсе» и «ЖП» редакция путала с остальными свойствами, пока они лежали
 * в общей куче «Особенности». Порядок как в лайфстайле после правок 22.09.
 */
const lifestyle: FieldDef[] = [
  f('Бренд', { isName: true, order: 1 }),
  f('Сайт', { type: 'url', order: 2 }),
  f('Категория', { type: 'multiselect', order: 3 }),
  f('Предназначение', { type: 'multiselect', order: 4 }),
  f('Ценовой сегмент', { type: 'select', order: 5 }),
  f('Мультибренд', { type: 'bool', options: ['да'], order: 6 }),
  f('Зоны', { type: 'multiselect', order: 7 }),
  f('Характеристика', { type: 'select', order: 8 }),
  f('Продается на маркетплейсе', { type: 'bool', options: ['да'], order: 9 }),
  f('ЖП', { type: 'bool', options: ['да'], order: 10 }),
  f('Есть своё производство', { type: 'bool', options: ['да'], order: 11, filterGroup: 'Особенности' }),
  f('Ручная работа', { type: 'bool', options: ['да'], order: 12, filterGroup: 'Особенности' }),
  f('Винтаж', { type: 'bool', options: ['да'], order: 13, filterGroup: 'Особенности' }),
  f('СТМ', { type: 'bool', options: ['да'], order: 14, filterGroup: 'Особенности' }),
]

// Группа без заголовка — это одна галочка, и подпись стоит на ней самой.
const groupNames = (list: FieldDef[]) =>
  filterGroups(list).map((group) =>
    group.kind === 'bools' ? group.label || columns(group.fields).join('+') : group.field.column,
  )

const boolsIn = (list: FieldDef[], label: string) =>
  filterGroups(list).flatMap((group) =>
    group.kind === 'bools' && group.label === label ? columns(group.fields) : [],
  )

check('видимые фильтры лайфстайла', columns(splitFilters(lifestyle).primary), ['Категория', 'Предназначение', 'Ценовой сегмент', 'Мультибренд'])
check(
  'мультибренд — отдельной строкой среди главных',
  groupNames(splitFilters(lifestyle).primary),
  ['Категория', 'Предназначение', 'Ценовой сегмент', 'Мультибренд'],
)
check(
  'маркетплейс и ЖП — тоже отдельно, «Особенности» под ними',
  groupNames(splitFilters(lifestyle).extra),
  ['Зоны', 'Характеристика', 'Продается на маркетплейсе', 'ЖП', 'Особенности'],
)
check(
  'в общую группу попали только галочки с filter_group',
  boolsIn(lifestyle, 'Особенности'),
  ['Есть своё производство', 'Ручная работа', 'Винтаж', 'СТМ'],
)
check('без галочек общей группы нет', groupNames([f('Зоны', { type: 'multiselect', order: 7 })]), ['Зоны'])
check('группы идут по порядку полей, а не по списку', groupNames([f('Город', { type: 'openselect', order: 15 }), f('Зоны', { type: 'multiselect', order: 7 })]), ['Зоны', 'Город'])

// Общая группа встаёт по своей первой галочке, а не в конец списка — иначе
// порядок полей для неё не решал бы ничего.
check(
  '«Особенности» встают по первой галочке',
  groupNames([
    f('Винтаж', { type: 'bool', options: ['да'], order: 13, filterGroup: 'Особенности' }),
    f('Город', { type: 'openselect', order: 15 }),
    f('Ручная работа', { type: 'bool', options: ['да'], order: 12, filterGroup: 'Особенности' }),
  ]),
  ['Особенности', 'Город'],
)

check('сайт бренда — первое поле типа url', urlField(fields)?.column, 'Ссылка')
check('без url-поля ссылки нет', urlField([f('Бренд')]), undefined)

check('обязательное поле', validate(fields, { 'Бренд': '' }).errors['Бренд'], 'Обязательное поле')
check('битая ссылка', validate(fields, { 'Бренд': 'X', 'Ссылка': 'ame-store.ru' }).errors['Ссылка'], 'Ссылка должна начинаться с http:// или https://')
check('валидная строка', validate(fields, { 'Бренд': 'X', 'Ссылка': 'https://ame-store.ru' }).ok, true)

// Сайт бренда стал обязательным — флаг приходит из field_defs, проверка общая.
const withRequiredUrl = fields.map((field) =>
  field.column === 'Ссылка' ? { ...field, required: true } : field,
)
check('сайт обязателен', validate(withRequiredUrl, { 'Бренд': 'X', 'Ссылка': '' }).errors['Ссылка'], 'Обязательное поле')
check('с сайтом сохраняется', validate(withRequiredUrl, { 'Бренд': 'X', 'Ссылка': 'https://ame-store.ru' }).ok, true)

/* ------------------------------------------- три категории: ядро и общий поиск */

// Схемы лайфстайла и красоты повторяют ядро моды, но со своими полями —
// пересечение по колонкам и есть то, по чему работает поиск в режиме «Все».
const core = ['Бренд', 'Страна', 'Ценовой сегмент', 'Для кого', 'Ссылка', 'Теги', 'Город']
const lifestyleFields: FieldDef[] = [
  ...fields.filter((field) => core.includes(field.column)),
  f('Тип', { type: 'multiselect', options: ['Мебель', 'Декор'] }),
]
const beautyFields: FieldDef[] = [
  ...fields.filter((field) => core.includes(field.column)),
  f('Тип', { type: 'multiselect', options: ['Макияж'] }),
]

check(
  'общее ядро — пересечение трёх схем',
  coreFields([fields, lifestyleFields, beautyFields]).map((field) => field.column),
  core,
)
check(
  'поле только одной категории в ядро не попадает',
  coreFields([fields, lifestyleFields, beautyFields]).some((field) => field.column === 'Тип'),
  false,
)
check('ядро из одной схемы — это она сама', coreFields([lifestyleFields]).length, lifestyleFields.length)
check('пустые схемы не ломают ядро', coreFields([]), [])

const lifestyleRow: BrandRow = {
  id: 'Nook', archived: 'FALSE', category: 'lifestyle',
  'Бренд': 'Nook', 'Страна': 'Россия', 'Ценовой сегмент': '$',
  'Для кого': '', 'Ссылка': 'https://nook.ru', 'Теги': 'Кэжуал', 'Город': 'Москва', 'Тип': 'Декор',
}

// В режиме «Все» индекс строится по ядру над строками всех категорий сразу.
const allRows = [...rows.map((r) => ({ ...r, category: 'fashion' })), lifestyleRow]
const allIndex = buildIndex(coreFields([fields, lifestyleFields, beautyFields]), allRows)
const allNames = (q: string) => runSearch(allIndex, q).map((r) => r['Бренд']).sort()

check('общий поиск находит бренд лайфстайла', allNames('Nook'), ['Nook'])
check('общий поиск находит бренд моды', allNames('Anka'), ['Anka'])
check('общий поиск в другой раскладке', allNames('Нук'), ['Nook'])
check('категория едет вместе со строкой', runSearch(allIndex, 'Nook')[0].category, 'lifestyle')

/* ------------------------------------------------------------ страницы списка */

check('страниц мало — показываем все', pageItems(1, 3), [1, 2, 3])
check('первая страница из многих', pageItems(1, 12), [1, 2, '…', 12])
check('середина списка', pageItems(6, 12), [1, '…', 5, 6, 7, '…', 12])
check('последняя страница', pageItems(12, 12), [1, '…', 11, 12])
check('пустая выдача не ломает переключатель', pageItems(1, 0), [])

/* -------------------------------------------------------------- поиск дубликатов */

const similar = (name: string, exceptId?: string) =>
  findSimilar(rows, fields, name, exceptId).map((r) => r.id)

check('дубль без учёта регистра', similar('anka'), ['Anka'])
check('дубль без учёта лишних пробелов', similar('  May   of May '), ['May of May'])
// Главное, ради чего проверка фонетическая: то же название в другой раскладке.
check('дубль в другой раскладке', similar('Выш'), ['Wysh'])
check('дубль в другой раскладке (Новая)', similar('Новая'), ['Novaya'])
check('нового бренда в базе нет', similar('Совсем новый'), [])
check('сама строка не считается своим дублем', similar('Anka', 'Anka'), [])
check('пустое имя дублей не ищет', similar('   '), [])

/* ------------------------------------------------- расхождение часов у серверов */

// Отдельного кода у этой ошибки нет, распознаём по тексту — значит, текст надо
// проверять. Первое сообщение — то самое, что ловила редакция при открытии сайта.
check('токен «из будущего»', isClockSkew('JWT issued at future'), true)
check('токен ещё не действует', isClockSkew('JWT not yet valid'), true)
check('вариант формулировки', isClockSkew('token used before issued'), true)
// А эти лечатся входом заново, повторять их бессмысленно.
check('протухший токен — не часы', isClockSkew('JWT expired'), false)
check('битая подпись — не часы', isClockSkew('JWT cryptographic operation failed'), false)
check('отказ RLS — не часы', isClockSkew('permission denied for view brand_fields'), false)

if (failures) throw new Error(`${failures} проверок упало`)
console.log('\nвсе проверки прошли')
