import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router'
import { Toaster } from '@/components/ui/Toaster'
import { AuthProvider } from './auth-context'
import { VaultKeyProvider } from './vault-key-context'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <VaultKeyProvider>
          {children}
          <Toaster />
        </VaultKeyProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
