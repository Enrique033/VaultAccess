import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { Credentials } from '@/pages/Credentials'
import { Links } from '@/pages/Links'
import { Notes } from '@/pages/Notes'
import { Workspaces } from '@/pages/Workspaces'
import { Login } from '@/pages/Login'
import { ResetPassword } from '@/pages/ResetPassword'
import { RequireAuth } from './RequireAuth'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/credentials" replace />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/links" element={<Links />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="*" element={<Navigate to="/credentials" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

