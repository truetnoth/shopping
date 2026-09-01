import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getAuthor, hasSession, setAuthor, signIn, signOut } from '../lib/auth'
import { clearCache } from '../lib/cache'

export interface Credentials {
  /** Кто вносит правку — уходит в updated_by. Сам доступ даёт сессия Supabase. */
  author: string
}

interface EditorAuth {
  /** Данные автора для записи. Без живой сессии не резолвится. */
  ensure: () => Promise<Credentials>
  login: (name: string, password: string) => Promise<void>
  forget: () => void
  signedIn: boolean
  /** Первая проверка сессии закончилась — до неё показывать нечего. */
  ready: boolean
}

const AuthContext = createContext<EditorAuth | null>(null)

export function EditorAuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void hasSession().then((ok) => {
      setSignedIn(ok)
      setReady(true)
    })
  }, [])

  const forget = useCallback(() => {
    void signOut()
    // База закрыта на чтение, поэтому её локальная копия не должна пережить
    // выход: иначе следующий человек за этим компьютером увидит её без пароля.
    clearCache()
    setSignedIn(false)
  }, [])

  const login = useCallback(async (name: string, password: string) => {
    await signIn(password)
    setAuthor(name.trim())
    setSignedIn(true)
  }, [])

  const ensure = useCallback(async (): Promise<Credentials> => {
    const name = getAuthor()
    if (name && (await hasSession())) return { author: name }
    // Сессия протухла на середине работы: возвращаем к экрану входа. Ошибку
    // «Отменено» вызывающие уже умеют глотать молча.
    forget()
    throw new Error('Отменено')
  }, [forget])

  const value = useMemo<EditorAuth>(
    () => ({ ensure, login, forget, signedIn, ready }),
    [ensure, login, forget, signedIn, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Пускает к сайту только после входа: база закрыта целиком, включая поиск. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { signedIn, ready } = useEditorAuth()

  if (!ready) return <p className="empty">Проверяем доступ…</p>
  if (!signedIn) return <LoginScreen />
  return <>{children}</>
}

function LoginScreen() {
  const { login } = useEditorAuth()
  const [author, setAuthorInput] = useState(() => getAuthor())
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = author.trim()
    if (!name || !password) return

    setBusy(true)
    setError(null)
    try {
      await login(name, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти')
      setBusy(false)
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1>База брендов</h1>
      <p className="muted">
        Доступ по паролю редакции. Вход сохранится в этом браузере.
      </p>

      <label>
        Ваше имя
        <input
          value={author}
          onChange={(e) => setAuthorInput(e.target.value)}
          placeholder="Кто вносит правки"
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
          required
        />
      </label>

      {error && <p className="banner banner--warn">{error}</p>}

      <button type="submit" className="btn btn--primary" disabled={busy}>
        {busy ? 'Проверяем…' : 'Войти'}
      </button>
    </form>
  )
}

export function useEditorAuth(): EditorAuth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useEditorAuth используется вне EditorAuthProvider')
  return ctx
}
