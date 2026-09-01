import { ApiError, ERR_UNAUTHORIZED } from '../api/client'
import { supabase } from './supabase'

/**
 * Вся редакция ходит под одной учёткой Supabase: редактор вводит только пароль,
 * почта — деталь реализации и в интерфейсе не появляется. Имя автора живёт
 * отдельно и попадает в updated_by.
 */
const EDITOR_EMAIL = 'editor@brands.local'

export async function signIn(password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: EDITOR_EMAIL,
    password,
  })
  if (error) {
    throw new ApiError(ERR_UNAUTHORIZED, 'Неверный пароль редакции')
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
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
    /* приватный режим — работаем без запоминания */
  }
}
