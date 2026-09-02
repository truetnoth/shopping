import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AuthGate, EditorAuthProvider } from './components/PasswordGate'
import { ToastProvider } from './components/Toast'
import { BrandsProvider } from './store/BrandsContext'
import { SearchStateProvider } from './store/SearchState'
import './styles.css'

// EditorAuthProvider снаружи BrandsProvider: база закрыта на чтение, поэтому
// загрузка вообще не начинается, пока не выполнен вход.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <EditorAuthProvider>
        <BrandsProvider>
          <AuthGate>
            {/* Внутри гейта: выход из системы уносит с собой и набранные фильтры. */}
            <SearchStateProvider>
              <App />
            </SearchStateProvider>
          </AuthGate>
        </BrandsProvider>
      </EditorAuthProvider>
    </ToastProvider>
  </StrictMode>,
)
