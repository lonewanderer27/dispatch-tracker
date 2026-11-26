import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
}
const maybeSingle = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  },
}))

// Imported after the mock is registered.
const { authProvider } = await import('@/providers/authProvider')

describe('authProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('login returns success and redirects home on valid credentials', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
    const res = await authProvider.login({ email: 'a@b.co', password: 'secret-pass' })
    expect(res).toEqual({ success: true, redirectTo: '/' })
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'secret-pass',
    })
  })

  it('login surfaces the supabase error message', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    })
    const res = await authProvider.login({ email: 'a@b.co', password: 'wrong' })
    expect(res.success).toBe(false)
    expect(res.error?.message).toBe('Invalid login credentials')
  })

  it('register returns success with a session', async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null })
    const res = await authProvider.register({ email: 'n@b.co', password: 'long-enough-1' })
    expect(res).toEqual({ success: true, redirectTo: '/' })
  })

  it('register asks for email confirmation when there is no session', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
    const res = await authProvider.register({ email: 'n@b.co', password: 'long-enough-1' })
    expect(res.redirectTo).toBe('/login')
    expect(res.successNotification?.message).toContain('Check your email')
  })

  it('check reports unauthenticated when there is no session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    const res = await authProvider.check()
    expect(res.authenticated).toBe(false)
    expect(res.redirectTo).toBe('/login')
  })

  it('check reports authenticated when a session exists', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'x' } } })
    const res = await authProvider.check()
    expect(res).toEqual({ authenticated: true })
  })

  it('getIdentity merges the auth user with the profile row', async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'u@b.co' } },
    })
    maybeSingle.mockResolvedValue({ data: { display_name: 'Ada', role: 'admin' }, error: null })
    const id = await authProvider.getIdentity()
    expect(id).toEqual({ id: 'u1', email: 'u@b.co', name: 'Ada', role: 'admin' })
  })

  it('getIdentity returns null when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } })
    expect(await authProvider.getIdentity()).toBeNull()
  })

  it('logout returns success and redirects to /login', async () => {
    auth.signOut.mockResolvedValue({ error: null })
    expect(await authProvider.logout()).toEqual({ success: true, redirectTo: '/login' })
  })

  it('onError logs out on 401 and 403, and ignores other errors', async () => {
    expect(await authProvider.onError({ statusCode: 401 })).toEqual({
      logout: true,
      redirectTo: '/login',
    })
    expect(await authProvider.onError({ statusCode: '403' })).toEqual({
      logout: true,
      redirectTo: '/login',
    })
    expect(await authProvider.onError({ statusCode: 500 })).toEqual({})
  })
})
