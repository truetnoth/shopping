import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { clearToken, getAuthor, getToken, hashPassword, setAuthor, setToken } from '../lib/auth'

export interface Credentials {
  token: string
  author: string
}

interface EditorAuth {
  /** Отдаёт пароль редакции, при необходимости спросив его модалкой. */
  ensure: () => Promise<Credentials>
  forget: () => void
  hasToken: boolean
}

const AuthContext = createContext<EditorAuth | null>(null)

export function EditorAuthProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [hasToken, setHasToken] = useState(() => Boolean(getToken()))
  const [password, setPassword] = useState('')
  const [author, setAuthorInput] = useState(() => getAuthor())
  const [busy, setBusy] = useState(false)
  const pending = useRef<{ resolve: (c: Credentials) => void; reject: (e: Error) => void } | null>(null)

  const ensure = useCallback(() => {
    const token = getToken()
    const savedAuthor = getAuthor()
    // Пароль спрашиваем только в момент первой записи — поиск остаётся открытым.
    if (token && savedAuthor) return Promise.resolve({ token, author: savedAuthor })

    setPassword('')
    setAuthorInput(savedAuthor)
    setOpen(true)
    return new Promise<Credentials>((resolve, reject) => {
      pending.current = { resolve, reject }
    })
  }, [])

  const forget = useCallback(() => {
    clearToken()
    setHasToken(false)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    pending.current?.reject(new Error('Отменено'))
    pending.current = null
  }, [])

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      const name = author.trim()
      if (!name) return

      setBusy(true)
      try {
        const existing = getToken()
        const token = password ? await hashPassword(password) : existing
        if (!token) return

        setToken(token)
        setAuthor(name)
        setHasToken(true)
        setOpen(false)
        pending.current?.resolve({ token, author: name })
        pending.current = null
      } finally {
        setBusy(false)
      }
    },
    [author, password],
  )

  const value = useMemo<EditorAuth>(() => ({ ensure, forget, hasToken }), [ensure, forget, hasToken])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {open && (
        <div className="modal-backdrop" onClick={close}>
          <form className="modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
            <h2>Вход для редакции</h2>
            <p className="muted">
              Пароль нужен только для добавления и правок. Он сохранится в этом браузере.
            </p>

            <label>
              Ваше имя
              <input
                value={author}
                onChange={(e) => setAuthorInput(e.target.value)}
                placeholder="Кто вносит правку"
                autoComplete="name"
                required
              />
            </label>

            <label>
              Пароль редакции
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                required={!getToken()}
              />
            </label>

            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={close}>
                Отмена
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? 'Проверяем…' : 'Войти'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export function useEditorAuth(): EditorAuth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useEditorAuth используется вне EditorAuthProvider')
  return ctx
}
