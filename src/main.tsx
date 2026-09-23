import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { Providers } from './app/providers'
import { useUIStore } from './store/ui.store'

const rootEl = document.getElementById('root')

if (!rootEl) {
  throw new Error('No se encontró el elemento #root en index.html')
}

// Aplica el tema guardado antes del primer pintado (evita flash de tema).
document.documentElement.classList.toggle(
  'dark',
  useUIStore.getState().theme === 'dark',
)

createRoot(rootEl).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
