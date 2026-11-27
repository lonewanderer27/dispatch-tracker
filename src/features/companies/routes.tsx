import { ShopOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CompanyList } from '@/features/companies/pages/CompanyList'
import { CompanyCreate } from '@/features/companies/pages/CompanyCreate'
import { CompanyEdit } from '@/features/companies/pages/CompanyEdit'

export const companiesFeature: FeatureModule = {
  resource: {
    name: 'companies',
    list: '/companies',
    create: '/companies/create',
    edit: '/companies/edit/:id',
    meta: { label: 'Companies', icon: <ShopOutlined /> },
  },
  routes: (
    <Route path="/companies">
      <Route index element={<CompanyList />} />
      <Route path="create" element={<CompanyCreate />} />
      <Route path="edit/:id" element={<CompanyEdit />} />
    </Route>
  ),
}
