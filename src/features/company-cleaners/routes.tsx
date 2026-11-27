import { LinkOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CompanyCleanerList } from '@/features/company-cleaners/pages/CompanyCleanerList'
import { CompanyCleanerCreate } from '@/features/company-cleaners/pages/CompanyCleanerCreate'

export const companyCleanersFeature: FeatureModule = {
  resource: {
    name: 'company_cleaners',
    list: '/company-cleaners',
    create: '/company-cleaners/create',
    meta: { label: 'Company cleaners', icon: <LinkOutlined /> },
  },
  routes: (
    <Route path="/company-cleaners">
      <Route index element={<CompanyCleanerList />} />
      <Route path="create" element={<CompanyCleanerCreate />} />
    </Route>
  ),
}
