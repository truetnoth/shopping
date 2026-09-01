import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Ключей может не быть — например, при первом запуске без .env. Падать при
 * загрузке модуля нельзя: пользователь увидел бы пустую страницу вместо
 * объяснения, поэтому клиент создаётся всегда, а отсутствие настроек
 * проверяется в момент первого запроса (см. fetchDataset).
 */
export const configured = Boolean(url && anonKey)

export const CONFIG_ERROR =
  'Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY — см. supabase/README.md'

/**
 * Anon-ключ публичный по замыслу: он лежит в собранном сайте и даёт только
 * чтение. Запись закрыта политиками RLS и требует входа в учётку редакции.
 */
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: { persistSession: true, autoRefreshToken: true },
})
