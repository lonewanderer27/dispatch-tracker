import type { AccessControlProvider } from '@refinedev/core'
import { canChangeDispatchData, isSuperAdmin } from '@/features/users/roles'
import { authProvider } from '@/providers/authProvider'

// Resource names only a Super Admin may open. This only shapes the UI (hides the menu item and
// redirects); the database enforces the rule (see admin_update_profile in 0005_user_admin.sql).
const SUPER_ADMIN_ONLY = new Set(['profiles'])

// Resources every signed-in user may read but only an Admin or Super Admin may change. The
// database enforces this through app_permissions; this only hides the create, edit and delete UI.
const ADMIN_WRITE_ONLY = new Set(['clients'])
const READ_ACTIONS = new Set(['list', 'show'])

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    if (!resource) return { can: true }

    if (SUPER_ADMIN_ONLY.has(resource)) {
      const identity = await authProvider.getIdentity()
      if (identity && isSuperAdmin(identity.roleId)) return { can: true }
      return { can: false, reason: 'Only a Super Admin can manage users' }
    }

    if (ADMIN_WRITE_ONLY.has(resource) && !READ_ACTIONS.has(action)) {
      const identity = await authProvider.getIdentity()
      if (identity && canChangeDispatchData(identity.roleId)) return { can: true }
      return { can: false, reason: 'Only an Admin can change clients and contacts' }
    }

    return { can: true }
  },
}
