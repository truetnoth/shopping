/**
 * Проверки чистой логики поиска, фильтров и валидации — без браузера и без
 * обращения к Google. Фикстура повторяет реальную структуру и данные таблицы
 * редакции. Запуск: npm test
 */
import type { BrandRow, FieldDef } from '../src/api/types'
import {
  applyFilters, boolPair, coreFields, findSimilar, optionsWithOwn,
  splitFilters, splitMulti, urlField, validate,
} from '../src/lib/schema'
import { pageItems } from '../src/lib/paginate'
import { buildIndex, runSearch } from '../src/lib/search'
import { cyrToLat, phoneticKey } from '../src/lib/translit'

const f = (column: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  column, label: column, type: 'text', options: [], required: false,
  searchable: true, showInCard: true, order: 1, isName: false, ...extra,
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
check('булево пишется как в таблице', boolPair(fields[7]), ['да', ''])
check('булево по умолчанию', boolPair(fields[1]), ['TRUE', 'FALSE'])

/* ------------------------------------------- главные и дополнительные фильтры */

// Порядок повторяет field_defs: категория (3), «Для кого» (4) и цена (5) видны
// сразу, всё, что дальше, уезжает под раскрывашку. Нефильтруемые поля
// (название, ссылка, год) не попадают никуда.
const ordered: FieldDef[] = [
  f('Бренд', { isName: true, order: 1 }),
  f('Ссылка', { type: 'url', order: 2 }),
  f('Категория', { type: 'multiselect', order: 3 }),
  f('Для кого', { type: 'multiselect', order: 4 }),
  f('Ценовой сегмент', { type: 'select', order: 5 }),
  f('Теги', { type: 'multiselect', order: 6 }),
  f('Город', { type: 'select', order: 8 }),
  f('Ручная работа', { type: 'bool', order: 11 }),
  f('Год основания', { type: 'number', order: 12 }),
]

const columns = (list: FieldDef[]) => list.map((field) => field.column)

check('главные фильтры — начало схемы', columns(splitFilters(ordered).primary), ['Категория', 'Для кого', 'Ценовой сегмент'])
check('остальные фильтры — под раскрывашкой', columns(splitFilters(ordered).extra), ['Теги', 'Город', 'Ручная работа'])

check('сайт бренда — первое поле типа url', urlField(fields)?.column, 'Ссылка')
check('без url-поля ссылки нет', urlField([f('Бренд')]), undefined)

check('обязательное поле', validate(fields, { 'Бренд': '' }).errors['Бренд'], 'Обязательное поле')
check('битая ссылка', validate(fields, { 'Бренд': 'X', 'Ссылка': 'ame-store.ru' }).errors['Ссылка'], 'Ссылка должна начинаться с http:// или https://')
check('валидная строка', validate(fields, { 'Бренд': 'X', 'Ссылка': 'https://ame-store.ru' }).ok, true)

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

if (failures) throw new Error(`${failures} проверок упало`)
console.log('\nвсе проверки прошли')
