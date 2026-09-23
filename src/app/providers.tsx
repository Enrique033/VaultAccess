import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router'
import { Toaster } from '@/components/ui/Toaster'
import { AuthProvider } from './auth-context'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <BrowserRouter>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}
