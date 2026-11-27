import { UserOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CleanerList } from '@/features/cleaners/pages/CleanerList'
import { CleanerCreate } from '@/features/cleaners/pages/CleanerCreate'
import { CleanerEdit } from '@/features/cleaners/pages/CleanerEdit'

export const cleanersFeature: FeatureModule = {
  resource: {
    name: 'cleaners',
    list: '/cleaners',
    create: '/cleaners/create',
    edit: '/cleaners/edit/:id',
    meta: { label: 'Cleaners', icon: <UserOutlined /> },
  },
  routes: (
    <Route path="/cleaners">
      <Route index element={<CleanerList />} />
      <Route path="create" element={<CleanerCreate />} />
      <Route path="edit/:id" element={<CleanerEdit />} />
    </Route>
  ),
}
