import { useCallback, useState } from 'react'
import { ApiError, ERR_UNAUTHORIZED } from '../api/client'
import type { WriteResult } from '../api/types'
import type { Credentials } from '../components/PasswordGate'
import { useEditorAuth } from '../components/PasswordGate'
import { useBrands } from './BrandsContext'

/**
 * Общая обвязка записи: спросить пароль, выполнить запрос, обновить локальные
 * данные. Протухшая сессия сбрасывается и пароль спрашивается заново ровно один
 * раз — редактор не видит непонятной ошибки, а просто вводит пароль ещё раз.
 */
export function useWrite() {
  const { ensure, forget } = useEditorAuth()
  const { applyRow } = useBrands()
  const [busy, setBusy] = useState(false)

  // Удаление строки не возвращает — отсюда WriteResult | void.
  const apply = useCallback(
    (result: WriteResult | void) => {
      if (result) applyRow(result.category, result.row)
    },
    [applyRow],
  )

  const run = useCallback(
    async <T extends WriteResult | void>(
      request: (creds: Credentials) => Promise<T>,
    ): Promise<T> => {
      setBusy(true)
      try {
        let creds = await ensure()
        try {
          const result = await request(creds)
          apply(result)
          return result
        } catch (err) {
          if (err instanceof ApiError && err.code === ERR_UNAUTHORIZED) {
            forget()
            creds = await ensure()
            const result = await request(creds)
            apply(result)
            return result
          }
          throw err
        }
      } finally {
        setBusy(false)
      }
    },
    [ensure, forget, apply],
  )

  return { run, busy }
}
