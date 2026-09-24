import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth } from './RequireAuth'

const Credentials = lazy(() =>
  import('@/pages/Credentials').then((module) => ({
    default: module.Credentials,
  })),
)
const Links = lazy(() =>
  import('@/pages/Links').then((module) => ({ default: module.Links })),
)
const Notes = lazy(() =>
  import('@/pages/Notes').then((module) => ({ default: module.Notes })),
)
const Workspaces = lazy(() =>
  import('@/pages/Workspaces').then((module) => ({
    default: module.Workspaces,
  })),
)
const Login = lazy(() =>
  import('@/pages/Login').then((module) => ({ default: module.Login })),
)
const ResetPassword = lazy(() =>
  import('@/pages/ResetPassword').then((module) => ({
    default: module.ResetPassword,
  })),
)

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-background text-sm text-muted">
      Cargando…
    </div>
  )
}

export function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Suspense fallback={<RouteFallback />}>
            <Login />
          </Suspense>
        }
      />
      <Route
        path="/reset-password"
        element={
          <Suspense fallback={<RouteFallback />}>
            <ResetPassword />
          </Suspense>
        }
      />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/credentials" replace />} />
          <Route
            path="/credentials"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Credentials />
              </Suspense>
            }
          />
          <Route
            path="/links"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Links />
              </Suspense>
            }
          />
          <Route
            path="/notes"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Notes />
              </Suspense>
            }
          />
          <Route
            path="/workspaces"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Workspaces />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/credentials" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
