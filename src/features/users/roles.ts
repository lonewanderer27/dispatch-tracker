// Fixed role ids, created in supabase/migrations/0003_roles.sql and 0004_app_permissions.sql.
export const ADMIN_ROLE_ID = '30000000-0000-0000-0000-000000000001'
export const USER_ROLE_ID = '30000000-0000-0000-0000-000000000002'
export const SUPER_ADMIN_ROLE_ID = '30000000-0000-0000-0000-000000000003'

export function isSuperAdmin(roleId: string | undefined): boolean {
  return roleId === SUPER_ADMIN_ROLE_ID
}

// Admin and Super Admin may change dispatch data (clients, contacts). A User only reads it.
export function canChangeDispatchData(roleId: string | undefined): boolean {
  return roleId === ADMIN_ROLE_ID || isSuperAdmin(roleId)
}
