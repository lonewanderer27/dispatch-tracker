import { describe, expect, it, vi } from 'vitest'
import { SUPER_ADMIN_ROLE_ID, USER_ROLE_ID } from '@/features/users/roles'

const getIdentity = vi.fn<() => Promise<{ id: string; roleId: string } | null>>()

vi.mock('@/providers/authProvider', () => ({
  authProvider: { getIdentity: () => getIdentity() },
}))

// Imported after the mock is registered.
const { accessControlProvider } = await import('@/providers/accessControlProvider')

describe('accessControlProvider', () => {
  it('allows resources that are not restricted without asking who the user is', async () => {
    const res = await accessControlProvider.can({ resource: 'todos', action: 'list' })
    expect(res).toEqual({ can: true })
    expect(getIdentity).not.toHaveBeenCalled()
  })

  it('allows a Super Admin to open the users resource', async () => {
    getIdentity.mockResolvedValue({ id: 'u1', roleId: SUPER_ADMIN_ROLE_ID })
    const res = await accessControlProvider.can({ resource: 'profiles', action: 'list' })
    expect(res).toEqual({ can: true })
  })

  it('denies a User and a signed-out visitor', async () => {
    getIdentity.mockResolvedValue({ id: 'u2', roleId: USER_ROLE_ID })
    const asUser = await accessControlProvider.can({ resource: 'profiles', action: 'list' })
    expect(asUser.can).toBe(false)
    getIdentity.mockResolvedValue(null)
    const signedOut = await accessControlProvider.can({ resource: 'profiles', action: 'list' })
    expect(signedOut.can).toBe(false)
  })
})
