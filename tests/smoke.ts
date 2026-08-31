/**
 * Проверки чистой логики поиска, фильтров и валидации — без браузера и без
 * обращения к Google. Фикстура повторяет реальную структуру и данные таблицы
 * редакции. Запуск: npm test
 */
import type { BrandRow, FieldDef } from '../src/api/types'
import { applyFilters, boolPair, collectOptions, splitMulti, validate } from '../src/lib/schema'
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
  f('Ценовой сегмент', { type: 'select', options: ['1', '2', '3', '4', '5'] }),
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
  row(['Ame', 'Российский бренд', 'Одежда, Верхняя одежда', '3', 'Для женщин', 'https://ame-store.ru', 'Кэжуал, Деловой стиль, Ледилайк', '', 'Москва']),
  row(['Anka', 'Российский бренд', 'Сумки', '3', 'Для женщин', 'http://ankabags.ru', 'Ледилайк', 'да', 'Петербург']),
  row(['Novaya', 'Российский бренд', 'Одежда, Верхняя одежда', '3', 'Для женщин, Для мужчин', 'https://novayawear.com', 'Аутдор', '', 'Петербург']),
  row(['May of May', 'Российский бренд', 'Одежда', '5', 'Для женщин', 'https://mayofmay.ru', 'Деловой стиль', '', 'Москва']),
  row(['Wysh', 'Российский бренд', 'Обувь', '1', 'Для женщин', 'https://wysh-brand.com', 'Ледилайк, Кэжуал', 'да', 'Петербург']),
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
check('фильтр по select', ids(applyFilters(rows, { 'Ценовой сегмент': ['3'] }, fields)), ['Ame', 'Anka', 'Novaya'])
check('булев фильтр', ids(applyFilters(rows, { 'Ручная работа': ['Да'] }, fields)), ['Anka', 'Wysh'])
check('разные поля — И', ids(applyFilters(rows, { 'Город': ['Петербург'], 'Ручная работа': ['Да'] }, fields)), ['Anka', 'Wysh'])
check('пустой фильтр не режет выдачу', applyFilters(rows, { 'Категория': [] }, fields).length, 5)

/* --------------------------------------------------------------- схема и формы */

check('опции = схема плюс факт из таблицы', collectOptions(fields[2], rows), ['Верхняя одежда', 'Обувь', 'Одежда', 'Сумки'])
check('теги собираются из данных', collectOptions(fields[6], rows), ['Аутдор', 'Деловой стиль', 'Кэжуал', 'Ледилайк'])
check('разбор мультизначения', splitMulti('Одежда,  Верхняя одежда ,,Сумки'), ['Одежда', 'Верхняя одежда', 'Сумки'])
check('булево пишется как в таблице', boolPair(fields[7]), ['да', ''])
check('булево по умолчанию', boolPair(fields[1]), ['TRUE', 'FALSE'])

check('обязательное поле', validate(fields, { 'Бренд': '' }).errors['Бренд'], 'Обязательное поле')
check('битая ссылка', validate(fields, { 'Бренд': 'X', 'Ссылка': 'ame-store.ru' }).errors['Ссылка'], 'Ссылка должна начинаться с http:// или https://')
check('валидная строка', validate(fields, { 'Бренд': 'X', 'Ссылка': 'https://ame-store.ru' }).ok, true)

if (failures) throw new Error(`${failures} проверок упало`)
console.log('\nвсе проверки прошли')
