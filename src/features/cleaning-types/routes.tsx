import { TagsOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CleaningTypeList } from '@/features/cleaning-types/pages/CleaningTypeList'
import { CleaningTypeCreate } from '@/features/cleaning-types/pages/CleaningTypeCreate'
import { CleaningTypeEdit } from '@/features/cleaning-types/pages/CleaningTypeEdit'

export const cleaningTypesFeature: FeatureModule = {
  resource: {
    name: 'cleaning_types',
    list: '/cleaning-types',
    create: '/cleaning-types/create',
    edit: '/cleaning-types/edit/:id',
    meta: { label: 'Cleaning types', icon: <TagsOutlined /> },
  },
  routes: (
    <Route path="/cleaning-types">
      <Route index element={<CleaningTypeList />} />
      <Route path="create" element={<CleaningTypeCreate />} />
      <Route path="edit/:id" element={<CleaningTypeEdit />} />
    </Route>
  ),
}
