import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  // Verify session on mount (persists session across page refresh)
  useEffect(() => {
    async function checkAuthSession() {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        })

        if (res.ok) {
          const data = await res.json()
          if (data.authenticated && data.user) {
            setUser(data.user)
          } else {
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } catch (err) {
        console.warn('Session verification check failed:', err.message)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuthSession()
  }, [])

  // Login handler
  const login = async (email, password) => {
    setAuthError(null)
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      const errorMsg = data.message || 'Login failed. Please check your credentials.'
      setAuthError(errorMsg)
      throw new Error(errorMsg)
    }

    setUser(data.user)
    return data.user
  }

  // Register handler
  const register = async (name, email, password, confirmPassword) => {
    setAuthError(null)
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        password,
        confirm_password: confirmPassword,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const errorMsg = data.message || 'Registration failed. Please check your inputs.'
      setAuthError(errorMsg)
      throw new Error(errorMsg)
    }

    setUser(data.user)
    return data.user
  }

  // Logout handler
  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (err) {
      console.warn('Logout API call failed:', err.message)
    } finally {
      setUser(null)
      setAuthError(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        setAuthError,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
