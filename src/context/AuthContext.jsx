import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [authMessage, setAuthMessage] = useState(null)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  // Fetch profile for a given user id and verify approval
  const fetchAndVerifyProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user profile:', error)
        return { profile: null, error }
      }

      // If user row does not exist yet (e.g. trigger delay), treat gracefully
      if (!data) {
        return { profile: null, error: new Error('User profile record not found.') }
      }

      // Strict approval check: only is_approved === true is granted entry
      if (data.is_approved !== true) {
        // Immediately terminate session
        await supabase.auth.signOut()
        const pendingMsg =
          'Your account is awaiting admin approval. Access is restricted until an administrator activates your profile.'
        setAuthMessage(pendingMsg)
        setAuthError(pendingMsg)
        setUser(null)
        setProfile(null)
        return { profile: null, pending: true, message: pendingMsg }
      }

      return { profile: data, pending: false }
    } catch (err) {
      console.error('Unexpected error during profile verification:', err)
      return { profile: null, error: err }
    }
  }

  // Refresh current user's profile
  const refreshProfile = async () => {
    if (!user) return null
    const { profile: updatedProfile } = await fetchAndVerifyProfile(user.id)
    if (updatedProfile) {
      setProfile(updatedProfile)
    }
    return updatedProfile
  }

  // Initialize auth state
  useEffect(() => {
    let isMounted = true

    // Check if URL hash indicates a password recovery redirect
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
      setIsPasswordRecovery(true)
    }

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          // If in recovery mode, set user without kicking out
          if (window.location.hash && window.location.hash.includes('type=recovery')) {
            if (isMounted) {
              setUser(session.user)
              setIsPasswordRecovery(true)
            }
          } else {
            const result = await fetchAndVerifyProfile(session.user.id)
            if (isMounted) {
              if (result.profile && result.profile.is_approved === true) {
                setUser(session.user)
                setProfile(result.profile)
                setAuthError(null)
              }
            }
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          if (isMounted) {
            setIsPasswordRecovery(true)
            if (session?.user) setUser(session.user)
            setLoading(false)
          }
          return
        }

        if (event === 'SIGNED_OUT') {
          if (isMounted) {
            setUser(null)
            setProfile(null)
            setIsPasswordRecovery(false)
            setLoading(false)
          }
          return
        }

        if (session?.user) {
          // Check if password recovery mode is active
          if (window.location.hash && window.location.hash.includes('type=recovery')) {
            if (isMounted) {
              setUser(session.user)
              setIsPasswordRecovery(true)
              setLoading(false)
            }
            return
          }

          const result = await fetchAndVerifyProfile(session.user.id)
          if (isMounted) {
            if (result.profile && result.profile.is_approved === true) {
              setUser(session.user)
              setProfile(result.profile)
              setAuthError(null)
            }
            setLoading(false)
          }
        } else {
          if (isMounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
        }
      }
    )

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  // Sign In function with immediate approval validation
  const signIn = async (email, password) => {
    setAuthError(null)
    setAuthMessage(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setAuthError(error.message)
      return { error }
    }

    if (data?.user) {
      const result = await fetchAndVerifyProfile(data.user.id)
      if (result.pending) {
        return {
          error: new Error(result.message),
          pendingApproval: true,
        }
      }
      if (result.error) {
        await supabase.auth.signOut()
        const msg = result.error.message || 'Failed to verify profile status.'
        setAuthError(msg)
        return { error: new Error(msg) }
      }

      setUser(data.user)
      setProfile(result.profile)
      return { data }
    }

    return { data }
  }

  // Staff Sign Up function
  const signUp = async (email, password, { full_name, designation }) => {
    setAuthError(null)
    setAuthMessage(null)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: full_name.trim(),
          designation: designation.trim(),
        },
      },
    })

    if (error) {
      setAuthError(error.message)
      return { error }
    }

    // In case Supabase signs in automatically on signup
    if (data?.session) {
      await supabase.auth.signOut()
    }

    setUser(null)
    setProfile(null)
    const successMsg =
      'Registration submitted successfully! Your account is awaiting admin approval before you can access the system.'
    setAuthMessage(successMsg)

    return { data, message: successMsg }
  }

  // Request password reset email
  const resetPasswordForEmail = async (email) => {
    setAuthError(null)
    setAuthMessage(null)

    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })

    if (error) {
      setAuthError(error.message)
      return { error }
    }

    const successMsg =
      'A secure password reset link has been dispatched to your email address. Please follow the instructions to set a new password.'
    setAuthMessage(successMsg)
    return { data, message: successMsg }
  }

  // Update password after recovery link click
  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw error

    // Clear hash and recovery mode
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    setIsPasswordRecovery(false)
    return data
  }

  // Sign Out function
  const signOut = async () => {
    setAuthError(null)
    setAuthMessage(null)
    setIsPasswordRecovery(false)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Signout error:', err)
    } finally {
      setUser(null)
      setProfile(null)
    }
  }

  const value = {
    user,
    profile,
    loading,
    authError,
    setAuthError,
    authMessage,
    setAuthMessage,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    resetPasswordForEmail,
    updatePassword,
    isPasswordRecovery,
    setIsPasswordRecovery,
    isAdmin: profile?.role === 'admin' && profile?.is_approved === true,
    isApproved: profile?.is_approved === true,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
