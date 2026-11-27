import { describe, expect, it, vi } from 'vitest'
import { ADMIN_ROLE_ID, SUPER_ADMIN_ROLE_ID, USER_ROLE_ID } from '@/features/users/roles'

const getIdentity = vi.fn<() => Promise<{ id: string; roleId: string } | null>>()

vi.mock('@/app/providers/authProvider', () => ({
  authProvider: { getIdentity: () => getIdentity() },
}))

// Imported after the mock is registered.
const { accessControlProvider } = await import('@/app/providers/accessControlProvider')

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

  it.each(['clients', 'contacts', 'cleaners', 'company_cleaners'])(
    'lets a User read %s without asking who they are',
    async (resource) => {
      getIdentity.mockClear()
      const res = await accessControlProvider.can({ resource, action: 'list' })
      expect(res).toEqual({ can: true })
      expect(getIdentity).not.toHaveBeenCalled()
    },
  )

  it.each(['clients', 'contacts', 'cleaners', 'company_cleaners'])(
    'lets an Admin change %s',
    async (resource) => {
      getIdentity.mockResolvedValue({ id: 'u3', roleId: ADMIN_ROLE_ID })
      for (const action of ['create', 'edit', 'delete']) {
        expect(await accessControlProvider.can({ resource, action })).toEqual({ can: true })
      }
    },
  )

  it.each(['clients', 'contacts', 'cleaners', 'company_cleaners'])(
    'denies a User changing %s',
    async (resource) => {
      getIdentity.mockResolvedValue({ id: 'u2', roleId: USER_ROLE_ID })
      for (const action of ['create', 'edit', 'delete']) {
        const res = await accessControlProvider.can({ resource, action })
        expect(res.can).toBe(false)
      }
    },
  )
})
