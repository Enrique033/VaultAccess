import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { Providers } from './app/providers'

const rootEl = document.getElementById('root')

if (!rootEl) {
  throw new Error('No se encontró el elemento #root en index.html')
}

// WorkVault comienza siempre en claro para evitar un primer paint oscuro.
// El usuario puede activar el tema oscuro desde el control de la interfaz.
document.documentElement.classList.remove('dark')

createRoot(rootEl).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
