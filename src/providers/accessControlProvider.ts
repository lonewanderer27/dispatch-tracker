import type { AccessControlProvider } from '@refinedev/core'
import { isSuperAdmin } from '@/features/users/roles'
import { authProvider } from '@/providers/authProvider'

// Resource names only a Super Admin may open. This only shapes the UI (hides the menu item and
// redirects); the database enforces the rule (see admin_update_profile in 0005_user_admin.sql).
const SUPER_ADMIN_ONLY = new Set(['profiles'])

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource }) => {
    if (!resource || !SUPER_ADMIN_ONLY.has(resource)) return { can: true }
    const identity = await authProvider.getIdentity()
    if (identity && isSuperAdmin(identity.roleId)) return { can: true }
    return { can: false, reason: 'Only a Super Admin can manage users' }
  },
}
