import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getAuthor, hasSession, setAuthor, signIn, signOut } from '../lib/auth'

export interface Credentials {
  /** Кто вносит правку — уходит в updated_by. Сам доступ даёт сессия Supabase. */
  author: string
}

interface EditorAuth {
  /** Отдаёт данные автора, при необходимости спросив пароль модалкой. */
  ensure: () => Promise<Credentials>
  forget: () => void
  signedIn: boolean
}

const AuthContext = createContext<EditorAuth | null>(null)

export function EditorAuthProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [author, setAuthorInput] = useState(() => getAuthor())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<{ resolve: (c: Credentials) => void; reject: (e: Error) => void } | null>(null)

  useEffect(() => {
    void hasSession().then(setSignedIn)
  }, [])

  const ensure = useCallback(async (): Promise<Credentials> => {
    const savedAuthor = getAuthor()
    // Пароль спрашиваем только в момент первой записи — поиск остаётся открытым.
    if (savedAuthor && (await hasSession())) return { author: savedAuthor }

    setPassword('')
    setAuthorInput(savedAuthor)
    setError(null)
    setOpen(true)
    return new Promise<Credentials>((resolve, reject) => {
      pending.current = { resolve, reject }
    })
  }, [])

  const forget = useCallback(() => {
    void signOut()
    setSignedIn(false)
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
      setError(null)
      try {
        // Пустой пароль при живой сессии — редактор просто уточняет своё имя.
        if (password) await signIn(password)
        else if (!(await hasSession())) {
          setError('Введите пароль редакции')
          return
        }

        setAuthor(name)
        setSignedIn(true)
        setOpen(false)
        pending.current?.resolve({ author: name })
        pending.current = null
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось войти')
      } finally {
        setBusy(false)
      }
    },
    [author, password],
  )

  const value = useMemo<EditorAuth>(() => ({ ensure, forget, signedIn }), [ensure, forget, signedIn])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {open && (
        <div className="modal-backdrop" onClick={close}>
          <form className="modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
            <h2>Вход для редакции</h2>
            <p className="muted">
              Пароль нужен только для добавления и правок. Вход сохранится в этом браузере.
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
                required={!signedIn}
              />
            </label>

            {error && <p className="banner banner--warn">{error}</p>}

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
