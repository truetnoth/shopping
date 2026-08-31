import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { EditorAuthProvider } from './components/PasswordGate'
import { ToastProvider } from './components/Toast'
import { BrandsProvider } from './store/BrandsContext'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <BrandsProvider>
        <EditorAuthProvider>
          <App />
        </EditorAuthProvider>
      </BrandsProvider>
    </ToastProvider>
  </StrictMode>,
)
