import { PhoneOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { ContactList } from '@/features/contacts/pages/ContactList'
import { ContactCreate } from '@/features/contacts/pages/ContactCreate'
import { ContactEdit } from '@/features/contacts/pages/ContactEdit'

export const contactsFeature: FeatureModule = {
  resource: {
    name: 'contacts',
    list: '/contacts',
    create: '/contacts/create',
    edit: '/contacts/edit/:id',
    meta: { label: 'Contacts', icon: <PhoneOutlined /> },
  },
  routes: (
    <Route path="/contacts">
      <Route index element={<ContactList />} />
      <Route path="create" element={<ContactCreate />} />
      <Route path="edit/:id" element={<ContactEdit />} />
    </Route>
  ),
}
