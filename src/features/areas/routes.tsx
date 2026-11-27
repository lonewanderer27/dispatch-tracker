import { EnvironmentOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { AreaList } from '@/features/areas/pages/AreaList'
import { AreaCreate } from '@/features/areas/pages/AreaCreate'
import { AreaEdit } from '@/features/areas/pages/AreaEdit'

export const areasFeature: FeatureModule = {
  resource: {
    name: 'areas',
    list: '/areas',
    create: '/areas/create',
    edit: '/areas/edit/:id',
    meta: { label: 'Areas', icon: <EnvironmentOutlined /> },
  },
  routes: (
    <Route path="/areas">
      <Route index element={<AreaList />} />
      <Route path="create" element={<AreaCreate />} />
      <Route path="edit/:id" element={<AreaEdit />} />
    </Route>
  ),
}
