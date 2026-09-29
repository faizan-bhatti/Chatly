import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingScreen } from './LoadingScreen'
import { useAuthStore } from '../stores/auth-store'

export function ProtectedRoute() {
  const location = useLocation()
  const { initialized, user } = useAuthStore((state) => state)

  if (!initialized) return <LoadingScreen />
  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />

  return <Outlet />
}

export function ProfileReadyRoute() {
  const { profile, profileLoading } = useAuthStore((state) => state)

  if (profileLoading) return <LoadingScreen label="Loading your profile" />
  if (!profile || !profile.profile_setup_completed_at) {
    return <Navigate to="/setup" replace />
  }

  return <Outlet />
}