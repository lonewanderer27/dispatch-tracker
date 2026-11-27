import type { AuthProvider } from '@refinedev/core'
import { supabase } from '@/shared/supabase'

interface Credentials {
  email: string
  password: string
}

export const authProvider = {
  login: async ({ email, password }: Credentials) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { success: false, error: { name: 'Login failed', message: error.message } }
    }
    return { success: true, redirectTo: '/' }
  },

  register: async ({ email, password }: Credentials) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      return { success: false, error: { name: 'Registration failed', message: error.message } }
    }
    if (!data.session) {
      // Only reached when email confirmation is enabled in supabase/config.jsonc.
      return {
        success: true,
        successNotification: {
          message: 'Check your email to confirm your account',
          description: 'Then sign in.',
        },
        redirectTo: '/login',
      }
    }
    return { success: true, redirectTo: '/' }
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      return { success: false, error: { name: 'Logout failed', message: error.message } }
    }
    return { success: true, redirectTo: '/login' }
  },

  check: async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return { authenticated: true }
    return {
      authenticated: false,
      redirectTo: '/login',
      logout: true,
      error: { name: 'Unauthenticated', message: 'Please sign in to continue.' },
    }
  },

  getIdentity: async () => {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, role_id, roles(name)')
      .eq('id', user.id)
      .maybeSingle()

    const displayName = profile?.display_name.trim() ?? ''
    return {
      id: user.id,
      email: user.email,
      name: displayName === '' ? user.email : displayName,
      // No role (a new sign-up, or a profile that did not load) stays "no role": it never falls back to User.
      role: profile?.roles?.name ?? null,
      roleId: profile?.role_id ?? null,
    }
  },

  onError: (error) => {
    const raw = (error as { statusCode?: unknown }).statusCode
    const status = typeof raw === 'number' || typeof raw === 'string' ? String(raw) : ''
    if (status === '401' || status === '403') {
      return Promise.resolve({ logout: true, redirectTo: '/login' })
    }
    return Promise.resolve({})
  },
} satisfies AuthProvider
