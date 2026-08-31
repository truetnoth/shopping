const STORAGE_KEY = 'brands.editorToken'

/**
 * Пароль редакции никогда не покидает браузер в открытом виде: наружу уходит
 * только SHA-256, и он же лежит в Script Properties на стороне Apps Script.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Браузер не поддерживает WebCrypto — откройте сайт по https')
  }
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token)
  } catch {
    /* приватный режим — работаем без запоминания */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* см. выше */
  }
}

const AUTHOR_KEY = 'brands.author'

export function getAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setAuthor(name: string): void {
  try {
    localStorage.setItem(AUTHOR_KEY, name)
  } catch {
    /* см. выше */
  }
}
