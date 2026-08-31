import type { BrandRow, ListPayload, WritePayload } from './types'

const API_URL = import.meta.env.VITE_API_URL as string | undefined

export const ERR_UNAUTHORIZED = 401
export const ERR_CONFLICT = 409
export const ERR_DUPLICATE = 422

/**
 * Apps Script всегда отвечает HTTP 200, поэтому код ошибки приходит в теле.
 * ApiError приводит это к привычному виду.
 */
export class ApiError extends Error {
  code: number
  details: Record<string, unknown>

  constructor(code: number, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

function apiUrl(): string {
  if (!API_URL) {
    throw new ApiError(500, 'Не задан VITE_API_URL — укажите адрес веб-приложения Apps Script')
  }
  return API_URL
}

async function unwrap<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, `Сервер ответил ${response.status}`)
  }

  const text = await response.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    // Обычно означает, что Apps Script вернул HTML-страницу входа:
    // деплой сделан не с доступом "Anyone".
    throw new ApiError(500, 'Сервер вернул не JSON. Проверьте, что веб-приложение опубликовано с доступом «Anyone».')
  }

  if (!data || data.ok !== true) {
    const err = (data && data.error) || {}
    const { code, message, ...rest } = err
    throw new ApiError(code || 500, message || 'Неизвестная ошибка сервера', rest)
  }

  return data as T
}

async function get<T>(params: Record<string, string>): Promise<T> {
  const url = `${apiUrl()}?${new URLSearchParams(params).toString()}`
  return unwrap<T>(await fetch(url, { method: 'GET', redirect: 'follow' }))
}

/**
 * POST намеренно уходит БЕЗ единого кастомного заголовка: Apps Script
 * не обрабатывает preflight-запрос OPTIONS, поэтому запрос должен остаться
 * «простым» (браузер сам поставит Content-Type: text/plain).
 * По этой же причине токен едет в теле, а не в Authorization.
 */
async function post<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(apiUrl(), {
    method: 'POST',
    body: JSON.stringify(body),
    redirect: 'follow',
  })
  return unwrap<T>(response)
}

export function fetchVersion(): Promise<{ revision: number }> {
  return get({ action: 'version' })
}

export function fetchList(): Promise<ListPayload> {
  return get({ action: 'list' })
}

export function createBrand(input: {
  token: string
  author: string
  values: BrandRow
  force?: boolean
}): Promise<WritePayload> {
  return post({ action: 'create', ...input })
}

export function updateBrand(input: {
  token: string
  author: string
  id: string
  baseUpdatedAt: string
  values: BrandRow
}): Promise<WritePayload> {
  return post({ action: 'update', ...input })
}

export function archiveBrand(input: {
  token: string
  author: string
  id: string
  archived: boolean
}): Promise<WritePayload> {
  return post({ action: 'archive', ...input })
}
