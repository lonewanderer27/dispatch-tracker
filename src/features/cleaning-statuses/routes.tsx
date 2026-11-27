import { ClockCircleOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CleaningStatusList } from '@/features/cleaning-statuses/pages/CleaningStatusList'
import { CleaningStatusCreate } from '@/features/cleaning-statuses/pages/CleaningStatusCreate'
import { CleaningStatusEdit } from '@/features/cleaning-statuses/pages/CleaningStatusEdit'

export const cleaningStatusesFeature: FeatureModule = {
  resource: {
    name: 'cleaning_statuses',
    list: '/cleaning-statuses',
    create: '/cleaning-statuses/create',
    edit: '/cleaning-statuses/edit/:id',
    meta: { label: 'Cleaning statuses', icon: <ClockCircleOutlined /> },
  },
  routes: (
    <Route path="/cleaning-statuses">
      <Route index element={<CleaningStatusList />} />
      <Route path="create" element={<CleaningStatusCreate />} />
      <Route path="edit/:id" element={<CleaningStatusEdit />} />
    </Route>
  ),
}
