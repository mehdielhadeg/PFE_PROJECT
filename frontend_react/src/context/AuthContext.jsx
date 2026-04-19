import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

const AuthContext = createContext(null)

const TOKEN_KEY = 'rag_token'
const ROLE_KEY = 'rag_role'
const USERNAME_KEY = 'rag_username'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '')
  const [role, setRole] = useState(localStorage.getItem(ROLE_KEY) || '')
  const [username, setUsername] = useState(localStorage.getItem(USERNAME_KEY) || '')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setReady(true)
        return
      }
      try {
        const me = await api.me(token)
        setRole(me.role)
        setUsername(me.username)
      } catch {
        logout()
      } finally {
        setReady(true)
      }
    }
    verify()
  }, [])

  const persist = (nextToken, nextRole, nextUsername) => {
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(ROLE_KEY, nextRole)
    localStorage.setItem(USERNAME_KEY, nextUsername)
    setToken(nextToken)
    setRole(nextRole)
    setUsername(nextUsername)
  }

  const loginAdmin = async (u, p) => {
    const data = await api.loginAdmin(u, p)
    persist(data.token, data.role, data.username)
  }

  const loginEmployee = async (u, p) => {
    const data = await api.loginEmployee(u, p)
    persist(data.token, data.role, data.username)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(USERNAME_KEY)
    setToken('')
    setRole('')
    setUsername('')
  }

  const value = useMemo(() => ({ token, role, username, ready, loginAdmin, loginEmployee, logout }), [token, role, username, ready])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
