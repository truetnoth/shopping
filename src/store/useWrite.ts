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

  const run = useCallback(
    async (request: (creds: Credentials) => Promise<WriteResult>): Promise<WriteResult> => {
      setBusy(true)
      try {
        let creds = await ensure()
        try {
          const result = await request(creds)
          applyRow(result.category, result.row)
          return result
        } catch (err) {
          if (err instanceof ApiError && err.code === ERR_UNAUTHORIZED) {
            forget()
            creds = await ensure()
            const result = await request(creds)
            applyRow(result.category, result.row)
            return result
          }
          throw err
        }
      } finally {
        setBusy(false)
      }
    },
    [ensure, forget, applyRow],
  )

  return { run, busy }
}
