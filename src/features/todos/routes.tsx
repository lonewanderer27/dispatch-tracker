import { CheckSquareOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { TodoList } from '@/features/todos/pages/TodoList'
import { TodoCreate } from '@/features/todos/pages/TodoCreate'
import { TodoEdit } from '@/features/todos/pages/TodoEdit'
import { TodoShow } from '@/features/todos/pages/TodoShow'

export const todosFeature: FeatureModule = {
  resource: {
    name: 'todos',
    list: '/todos',
    create: '/todos/create',
    edit: '/todos/edit/:id',
    show: '/todos/show/:id',
    meta: { label: 'Todos', icon: <CheckSquareOutlined /> },
  },
  routes: (
    <Route path="/todos">
      <Route index element={<TodoList />} />
      <Route path="create" element={<TodoCreate />} />
      <Route path="edit/:id" element={<TodoEdit />} />
      <Route path="show/:id" element={<TodoShow />} />
    </Route>
  ),
}
