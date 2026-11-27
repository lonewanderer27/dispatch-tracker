import { CalendarOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CleaningJobList } from '@/features/cleaning-jobs/pages/CleaningJobList'

export const cleaningJobsFeature: FeatureModule = {
  resource: {
    name: 'cleaning_jobs',
    list: '/cleaning-jobs',
    meta: { label: 'Cleaning Jobs', icon: <CalendarOutlined /> },
  },
  routes: (
    <Route path="/cleaning-jobs">
      <Route index element={<CleaningJobList />} />
    </Route>
  ),
}
