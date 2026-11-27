import { Authenticated, CanAccess, Refine, type ResourceProps } from '@refinedev/core'
import { AuthPage, ThemedLayout, ThemedTitle, useNotificationProvider } from '@refinedev/antd'
import '@refinedev/antd/dist/reset.css'
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from '@refinedev/react-router'
import {
  DashboardOutlined,
  CheckSquareOutlined,
  TeamOutlined,
  ShopOutlined,
  SolutionOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { ConfigProvider, theme } from 'antd'
import { Navigate, Outlet, Route, Routes } from 'react-router'
import { authProvider } from '@/providers/authProvider'
import { accessControlProvider } from '@/providers/accessControlProvider'
import { refineDataProvider, refineLiveProvider } from '@/providers/dataProvider'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { TodoList } from '@/pages/todos/TodoList'
import { TodoCreate } from '@/pages/todos/TodoCreate'
import { TodoEdit } from '@/pages/todos/TodoEdit'
import { TodoShow } from '@/pages/todos/TodoShow'
import { CompanyList } from '@/pages/companies/CompanyList'
import { CompanyCreate } from '@/pages/companies/CompanyCreate'
import { CompanyEdit } from '@/pages/companies/CompanyEdit'
import { ClientList } from '@/pages/clients/ClientList'
import { ClientCreate } from '@/pages/clients/ClientCreate'
import { ClientEdit } from '@/pages/clients/ClientEdit'
import { ContactList } from '@/pages/contacts/ContactList'
import { ContactCreate } from '@/pages/contacts/ContactCreate'
import { ContactEdit } from '@/pages/contacts/ContactEdit'
import { CleanerList } from '@/pages/cleaners/CleanerList'
import { CleanerCreate } from '@/pages/cleaners/CleanerCreate'
import { CleanerEdit } from '@/pages/cleaners/CleanerEdit'
import { UserList } from '@/pages/users/UserList'
import { UserEdit } from '@/pages/users/UserEdit'

const resources: ResourceProps[] = [
  {
    name: 'dashboard',
    list: '/',
    meta: { label: 'Dashboard', icon: <DashboardOutlined /> },
  },
  {
    name: 'todos',
    list: '/todos',
    create: '/todos/create',
    edit: '/todos/edit/:id',
    show: '/todos/show/:id',
    meta: { label: 'Todos', icon: <CheckSquareOutlined /> },
  },
  {
    name: 'profiles',
    list: '/users',
    edit: '/users/edit/:id',
    meta: { label: 'Users', icon: <TeamOutlined /> },
  },
  {
    name: 'companies',
    list: '/companies',
    create: '/companies/create',
    edit: '/companies/edit/:id',
    meta: { label: 'Companies', icon: <ShopOutlined /> },
  },
  {
    name: 'clients',
    list: '/clients',
    create: '/clients/create',
    edit: '/clients/edit/:id',
    meta: { label: 'Clients', icon: <SolutionOutlined /> },
  },
  {
    name: 'contacts',
    list: '/contacts',
    create: '/contacts/create',
    edit: '/contacts/edit/:id',
    meta: { label: 'Contacts', icon: <PhoneOutlined /> },
  },
  {
    name: 'cleaners',
    list: '/cleaners',
    create: '/cleaners/create',
    edit: '/cleaners/edit/:id',
    meta: { label: 'Cleaners', icon: <UserOutlined /> },
  },
]

export default function App() {
  return (
    <ConfigProvider theme={{ algorithm: [theme.defaultAlgorithm] }}>
      <Refine
        dataProvider={{ default: refineDataProvider }}
        liveProvider={refineLiveProvider}
        authProvider={authProvider}
        accessControlProvider={accessControlProvider}
        routerProvider={routerProvider}
        notificationProvider={useNotificationProvider}
        resources={resources}
        options={{
          liveMode: 'auto',
          syncWithLocation: true,
          disableTelemetry: true,
          projectId: 'dispatch-tracker',
        }}
      >
        <Routes>
          <Route
            element={
              <Authenticated key="authenticated-inner" fallback={<CatchAllNavigate to="/login" />}>
                <ThemedLayout Title={ThemedTitle}>
                  <div className="app-content">
                    <Outlet />
                  </div>
                </ThemedLayout>
              </Authenticated>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="/todos">
              <Route index element={<TodoList />} />
              <Route path="create" element={<TodoCreate />} />
              <Route path="edit/:id" element={<TodoEdit />} />
              <Route path="show/:id" element={<TodoShow />} />
            </Route>
            <Route path="/companies">
              <Route index element={<CompanyList />} />
              <Route path="create" element={<CompanyCreate />} />
              <Route path="edit/:id" element={<CompanyEdit />} />
            </Route>
            <Route path="/clients">
              <Route index element={<ClientList />} />
              <Route path="create" element={<ClientCreate />} />
              <Route path="edit/:id" element={<ClientEdit />} />
            </Route>
            <Route path="/contacts">
              <Route index element={<ContactList />} />
              <Route path="create" element={<ContactCreate />} />
              <Route path="edit/:id" element={<ContactEdit />} />
            </Route>
            <Route path="/cleaners">
              <Route index element={<CleanerList />} />
              <Route path="create" element={<CleanerCreate />} />
              <Route path="edit/:id" element={<CleanerEdit />} />
            </Route>
            <Route
              path="/users"
              element={
                <CanAccess resource="profiles" action="list" fallback={<Navigate to="/" replace />}>
                  <Outlet />
                </CanAccess>
              }
            >
              <Route index element={<UserList />} />
              <Route path="edit/:id" element={<UserEdit />} />
            </Route>
          </Route>

          <Route
            element={
              <Authenticated key="authenticated-outer" fallback={<Outlet />}>
                <Navigate to="/" replace />
              </Authenticated>
            }
          >
            <Route path="/login" element={<AuthPage type="login" />} />
            <Route path="/register" element={<AuthPage type="register" />} />
          </Route>
        </Routes>
        <UnsavedChangesNotifier />
        <DocumentTitleHandler />
      </Refine>
    </ConfigProvider>
  )
}
