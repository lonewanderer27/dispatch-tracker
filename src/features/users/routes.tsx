import { TeamOutlined } from '@ant-design/icons'
import { CanAccess } from '@refinedev/core'
import { Navigate, Outlet, Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { UserEdit } from '@/features/users/pages/UserEdit'
import { UserList } from '@/features/users/pages/UserList'

export const usersFeature: FeatureModule = {
  resource: {
    name: 'profiles',
    list: '/users',
    edit: '/users/edit/:id',
    meta: { label: 'Users', icon: <TeamOutlined /> },
  },
  routes: (
    <Route
      path="/users"
      element={
        <CanAccess resource="profiles" action="list" fallback={<Navigate to="/" replace />}>
          <Outlet />
        </CanAccess>
      }
    >
      <Route index element={<UserList />} />
      <Route path="edit/:id" element={<UserEdit />} />
    </Route>
  ),
}
