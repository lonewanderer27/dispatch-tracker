import { ToolOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { ItemList } from '@/features/items/pages/ItemList'
import { ItemCreate } from '@/features/items/pages/ItemCreate'
import { ItemEdit } from '@/features/items/pages/ItemEdit'

export const itemsFeature: FeatureModule = {
  resource: {
    name: 'items',
    list: '/items',
    create: '/items/create',
    edit: '/items/edit/:id',
    meta: { label: 'Items', icon: <ToolOutlined /> },
  },
  routes: (
    <Route path="/items">
      <Route index element={<ItemList />} />
      <Route path="create" element={<ItemCreate />} />
      <Route path="edit/:id" element={<ItemEdit />} />
    </Route>
  ),
}
