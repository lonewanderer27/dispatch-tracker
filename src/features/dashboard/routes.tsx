import { DashboardOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'

export const dashboardFeature: FeatureModule = {
  resource: {
    name: 'dashboard',
    list: '/',
    meta: { label: 'Dashboard', icon: <DashboardOutlined /> },
  },
  routes: <Route index element={<DashboardPage />} />,
}
