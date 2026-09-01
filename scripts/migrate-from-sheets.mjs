#!/usr/bin/env node
// Одноразовый перенос текущей базы из Google-таблицы в Supabase.
//
//   node scripts/migrate-from-sheets.mjs > seed.sql
//
// Читает старый Apps Script (адрес берётся из .env как VITE_API_URL или из
// первого аргумента) и печатает готовый insert для SQL Editor. Исходные id,
// updated_at и updated_by сохраняются, поэтому ссылки на карточки не протухнут.

import { readFileSync } from 'node:fs'

const TABLE = 'public.brands_fashion'

/** Русские заголовки листа → латинские колонки Postgres. */
const COLUMNS = {
  'Бренд': 'name',
  'Ссылка': 'url',
  'Страна': 'country',
  'Город': 'city',
  'Год основания': 'founded_year',
  'Ценовой сегмент': 'price_tier',
  'Для кого': 'audience',
  'Теги': 'tags',
  'Есть свое производство': 'own_production',
  'Ручная работа': 'handmade',
  'Категория': 'fashion_kind',
  'Характеристика': 'style_role',
}

function apiUrl() {
  if (process.argv[2]) return process.argv[2]
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    const match = env.match(/^VITE_API_URL=(.+)$/m)
    if (match) return match[1].trim()
  } catch {
    /* .env может не быть — тогда адрес передают аргументом */
  }
  throw new Error('Укажите адрес Apps Script: node scripts/migrate-from-sheets.mjs <url>')
}

const quote = (value) => `'${String(value ?? '').replace(/'/g, "''")}'`

const isTruthy = (value) => {
  const s = String(value ?? '').trim().toLowerCase()
  return s === 'true' || s === 'да' || s === '1' || s === 'yes'
}

const response = await fetch(`${apiUrl()}?action=list`, { redirect: 'follow' })
const payload = await response.json()
if (!payload?.ok) throw new Error(`Apps Script ответил ошибкой: ${JSON.stringify(payload)}`)

const targets = ['id', 'updated_at', 'updated_by', 'archived', ...Object.values(COLUMNS)]

const values = payload.rows.map((row) => {
  const cells = targets.map((column) => {
    if (column === 'archived') return isTruthy(row.archived) ? 'true' : 'false'
    if (column === 'updated_at') return row.updated_at ? quote(row.updated_at) : 'now()'
    if (column === 'id') return `${quote(row.id)}::uuid`

    const source = Object.keys(COLUMNS).find((k) => COLUMNS[k] === column)
    return quote(source ? row[source] : '')
  })
  return `  (${cells.join(', ')})`
})

console.log(`-- Перенос ${values.length} брендов из Google-таблицы. Вставьте в SQL Editor Supabase.`)
console.log(`insert into ${TABLE} (${targets.join(', ')})`)
console.log('values')
console.log(values.join(',\n'))
console.log('on conflict (id) do nothing;')
