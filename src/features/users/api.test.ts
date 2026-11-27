import { describe, expect, it, vi } from 'vitest'
import type { AppSupabaseClient } from '@/shared/supabase'
import { updateUserProfile } from '@/features/users/api'

const input = {
  id: 'u1',
  displayName: 'Ada',
  roleId: '30000000-0000-0000-0000-000000000001',
}

describe('updateUserProfile', () => {
  it('calls the admin_update_profile function with the right arguments', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) }
    await updateUserProfile(client as unknown as AppSupabaseClient, input)
    expect(client.rpc).toHaveBeenCalledWith('admin_update_profile', {
      p_user_id: 'u1',
      p_display_name: 'Ada',
      p_role_id: '30000000-0000-0000-0000-000000000001',
    })
  })

  it('throws the database message when the call fails', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'only a Super Admin can update a user' },
      }),
    }
    await expect(updateUserProfile(client as unknown as AppSupabaseClient, input)).rejects.toThrow(
      'only a Super Admin can update a user',
    )
  })
})
