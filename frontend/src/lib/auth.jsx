import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearToken, getToken, setToken } from './api'
import { disconnectSocket } from './socket'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: Boolean(getToken()),
    user: null,
    settings: null,
  })

  const load = useCallback(async () => {
    if (!getToken()) {
      setState({ loading: false, user: null, settings: null })
      return
    }
    try {
      const data = await api.get('/api/users/me')
      setState({ loading: false, user: data.user, settings: data.settings })
    } catch {
      clearToken()
      setState({ loading: false, user: null, settings: null })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onLogout = () =>
      setState({ loading: false, user: null, settings: null })
    window.addEventListener('mersal:logout', onLogout)
    return () => window.removeEventListener('mersal:logout', onLogout)
  }, [])

  const login = useCallback((token, user, settings) => {
    setToken(token)
    setState({ loading: false, user, settings })
  }, [])

  const logout = useCallback(() => {
    disconnectSocket()
    clearToken()
    setState({ loading: false, user: null, settings: null })
  }, [])

  const refresh = useCallback(async () => {
    const data = await api.get('/api/users/me')
    setState((prev) => ({ ...prev, user: data.user, settings: data.settings }))
    return data
  }, [])

  const updateSettings = useCallback(async (patch) => {
    const data = await api.patch('/api/settings', patch)
    setState((prev) => ({ ...prev, settings: data.settings }))
    return data.settings
  }, [])

  const setUser = useCallback((user) => {
    setState((prev) => ({ ...prev, user }))
  }, [])

  const value = useMemo(
    () => ({ ...state, login, logout, refresh, updateSettings, setUser }),
    [state, login, logout, refresh, updateSettings, setUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
