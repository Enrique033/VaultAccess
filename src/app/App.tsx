import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { Credentials } from '@/pages/Credentials'
import { Login } from '@/pages/Login'
import { ResetPassword } from '@/pages/ResetPassword'
import { RequireAuth } from './RequireAuth'

function Placeholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-5xl space-y-2">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="text-sm text-muted">Sección en construcción.</p>
    </div>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/credentials" replace />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/links" element={<Placeholder title="Links" />} />
          <Route path="/notes" element={<Placeholder title="Notas" />} />
          <Route path="*" element={<Navigate to="/credentials" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

