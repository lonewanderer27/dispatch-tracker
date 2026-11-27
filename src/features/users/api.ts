// Data access for the Users page. Takes the client as an argument so tests can pass a mock.
import type { AppSupabaseClient } from '@/features/integration/api'

export interface UpdateUserInput {
  id: string
  displayName: string
  roleId: string
}

/** Calls the admin_update_profile function. The database rejects anyone who is not a Super Admin. */
export async function updateUserProfile(
  client: AppSupabaseClient,
  input: UpdateUserInput,
): Promise<void> {
  const { error } = await client.rpc('admin_update_profile', {
    p_user_id: input.id,
    p_display_name: input.displayName,
    p_role_id: input.roleId,
  })
  if (error) throw new Error(error.message)
}
