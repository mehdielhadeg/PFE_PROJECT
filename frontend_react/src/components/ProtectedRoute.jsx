import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { token, ready } = useAuth()
  if (!ready) return null
  if (!token) return <Navigate to="/login/employee" replace />
  return <Outlet />
}
