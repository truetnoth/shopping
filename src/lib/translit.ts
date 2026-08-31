/**
 * Названия брендов в базе смешанные: часть латиницей, часть кириллицей.
 * Редактор ищет «Гуччи», а в таблице лежит «Gucci».
 *
 * Перебор вариантов написания здесь не работает: прямая транслитерация даёт
 * «guchchi», что с «gucci» не совпадает. Поэтому обе стороны приводятся к
 * одному огрублённому фонетическому ключу — и запрос, и значение в таблице.
 * Ключ намеренно грубый: он должен склеивать написания, а не различать их.
 */

const CYR_TO_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function cyrToLat(input: string): string {
  let out = ''
  for (const char of input.toLowerCase()) out += CYR_TO_LAT[char] ?? char
  return out
}

// Сначала диграфы (порядок важен: sch до sh, sh до ch), затем одиночные буквы.
const DIGRAPHS: [RegExp, string][] = [
  [/sch/g, 's'], [/sh/g, 's'], [/ch/g, 'c'], [/zh/g, 'j'],
  [/ts/g, 'c'], [/kh/g, 'h'], [/ph/g, 'f'], [/th/g, 't'],
]

const SINGLES: [RegExp, string][] = [
  [/c/g, 'k'], [/q/g, 'k'], [/x/g, 'ks'], [/w/g, 'v'], [/y/g, 'i'],
]

/**
 * «Gucci» и «Гуччи» дают один ключ «guki», «Krasniy» и «Красный» — «krasni».
 */
export function phoneticKey(input: string): string {
  let s = cyrToLat(input)
  for (const [from, to] of DIGRAPHS) s = s.replace(from, to)
  for (const [from, to] of SINGLES) s = s.replace(from, to)
  s = s.replace(/(.)\1+/g, '$1')          // двойные буквы: gucci → guci
  s = s.replace(/[^a-z0-9 ]+/g, ' ')      // апострофы, дефисы, иероглифы
  return s.replace(/\s+/g, ' ').trim()
}
