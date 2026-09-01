import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { useEditorAuth } from './components/PasswordGate'
import { BrandPage } from './pages/BrandPage'
import { EditPage } from './pages/EditPage'
import { NewPage } from './pages/NewPage'
import { SearchPage } from './pages/SearchPage'

export function App() {
  const { forget } = useEditorAuth()

  // HashRouter, а не BrowserRouter: GitHub Pages не умеет SPA-fallback и на
  // прямом заходе по /brand/<id> отдал бы 404.
  return (
    <HashRouter>
      <div className="layout">
        <header className="topbar">
          <Link className="topbar__logo" to="/">База брендов</Link>
          {/* Компьютер в редакции может быть общим — выход должен быть на виду. */}
          <button className="btn btn--ghost btn--small" onClick={forget}>Выйти</button>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/c/:category" element={<SearchPage />} />
            <Route path="/new" element={<NewPage />} />
            <Route path="/new/:category" element={<NewPage />} />
            <Route path="/brand/:category/:id" element={<BrandPage />} />
            <Route path="/brand/:category/:id/edit" element={<EditPage />} />
            <Route path="*" element={<SearchPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
