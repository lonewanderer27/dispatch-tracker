import { SolutionOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { ClientList } from '@/features/clients/pages/ClientList'
import { ClientCreate } from '@/features/clients/pages/ClientCreate'
import { ClientEdit } from '@/features/clients/pages/ClientEdit'

export const clientsFeature: FeatureModule = {
  resource: {
    name: 'clients',
    list: '/clients',
    create: '/clients/create',
    edit: '/clients/edit/:id',
    meta: { label: 'Clients', icon: <SolutionOutlined /> },
  },
  routes: (
    <Route path="/clients">
      <Route index element={<ClientList />} />
      <Route path="create" element={<ClientCreate />} />
      <Route path="edit/:id" element={<ClientEdit />} />
    </Route>
  ),
}
