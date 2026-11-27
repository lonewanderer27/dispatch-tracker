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
  LinkOutlined,
  TagsOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  ToolOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import { ConfigProvider, theme } from 'antd'
import { Navigate, Outlet, Route, Routes } from 'react-router'
import { authProvider } from '@/app/providers/authProvider'
import { accessControlProvider } from '@/app/providers/accessControlProvider'
import { refineDataProvider, refineLiveProvider } from '@/app/providers/dataProvider'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { TodoList } from '@/features/todos/pages/TodoList'
import { TodoCreate } from '@/features/todos/pages/TodoCreate'
import { TodoEdit } from '@/features/todos/pages/TodoEdit'
import { TodoShow } from '@/features/todos/pages/TodoShow'
import { CompanyList } from '@/features/companies/pages/CompanyList'
import { CompanyCreate } from '@/features/companies/pages/CompanyCreate'
import { CompanyEdit } from '@/features/companies/pages/CompanyEdit'
import { ClientList } from '@/features/clients/pages/ClientList'
import { ClientCreate } from '@/features/clients/pages/ClientCreate'
import { ClientEdit } from '@/features/clients/pages/ClientEdit'
import { ContactList } from '@/features/contacts/pages/ContactList'
import { ContactCreate } from '@/features/contacts/pages/ContactCreate'
import { ContactEdit } from '@/features/contacts/pages/ContactEdit'
import { CleanerList } from '@/features/cleaners/pages/CleanerList'
import { CleanerCreate } from '@/features/cleaners/pages/CleanerCreate'
import { CleanerEdit } from '@/features/cleaners/pages/CleanerEdit'
import { CompanyCleanerList } from '@/features/company-cleaners/pages/CompanyCleanerList'
import { CompanyCleanerCreate } from '@/features/company-cleaners/pages/CompanyCleanerCreate'
import { CleaningTypeList } from '@/features/cleaning-types/pages/CleaningTypeList'
import { CleaningTypeCreate } from '@/features/cleaning-types/pages/CleaningTypeCreate'
import { CleaningTypeEdit } from '@/features/cleaning-types/pages/CleaningTypeEdit'
import { CleaningStatusList } from '@/features/cleaning-statuses/pages/CleaningStatusList'
import { CleaningStatusCreate } from '@/features/cleaning-statuses/pages/CleaningStatusCreate'
import { CleaningStatusEdit } from '@/features/cleaning-statuses/pages/CleaningStatusEdit'
import { AreaList } from '@/features/areas/pages/AreaList'
import { AreaCreate } from '@/features/areas/pages/AreaCreate'
import { AreaEdit } from '@/features/areas/pages/AreaEdit'
import { ItemList } from '@/features/items/pages/ItemList'
import { ItemCreate } from '@/features/items/pages/ItemCreate'
import { ItemEdit } from '@/features/items/pages/ItemEdit'
import { CleaningJobList } from '@/features/cleaning-jobs/pages/CleaningJobList'
import { UserList } from '@/features/users/pages/UserList'
import { UserEdit } from '@/features/users/pages/UserEdit'

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
  {
    name: 'company_cleaners',
    list: '/company-cleaners',
    create: '/company-cleaners/create',
    meta: { label: 'Company cleaners', icon: <LinkOutlined /> },
  },
  {
    name: 'cleaning_types',
    list: '/cleaning-types',
    create: '/cleaning-types/create',
    edit: '/cleaning-types/edit/:id',
    meta: { label: 'Cleaning types', icon: <TagsOutlined /> },
  },
  {
    name: 'cleaning_statuses',
    list: '/cleaning-statuses',
    create: '/cleaning-statuses/create',
    edit: '/cleaning-statuses/edit/:id',
    meta: { label: 'Cleaning statuses', icon: <ClockCircleOutlined /> },
  },
  {
    name: 'areas',
    list: '/areas',
    create: '/areas/create',
    edit: '/areas/edit/:id',
    meta: { label: 'Areas', icon: <EnvironmentOutlined /> },
  },
  {
    name: 'items',
    list: '/items',
    create: '/items/create',
    edit: '/items/edit/:id',
    meta: { label: 'Items', icon: <ToolOutlined /> },
  },
  {
    name: 'cleaning_jobs',
    list: '/cleaning-jobs',
    meta: { label: 'Cleaning Jobs', icon: <CalendarOutlined /> },
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
            <Route path="/company-cleaners">
              <Route index element={<CompanyCleanerList />} />
              <Route path="create" element={<CompanyCleanerCreate />} />
            </Route>
            <Route path="/cleaning-types">
              <Route index element={<CleaningTypeList />} />
              <Route path="create" element={<CleaningTypeCreate />} />
              <Route path="edit/:id" element={<CleaningTypeEdit />} />
            </Route>
            <Route path="/cleaning-statuses">
              <Route index element={<CleaningStatusList />} />
              <Route path="create" element={<CleaningStatusCreate />} />
              <Route path="edit/:id" element={<CleaningStatusEdit />} />
            </Route>
            <Route path="/areas">
              <Route index element={<AreaList />} />
              <Route path="create" element={<AreaCreate />} />
              <Route path="edit/:id" element={<AreaEdit />} />
            </Route>
            <Route path="/items">
              <Route index element={<ItemList />} />
              <Route path="create" element={<ItemCreate />} />
              <Route path="edit/:id" element={<ItemEdit />} />
            </Route>
            <Route path="/cleaning-jobs">
              <Route index element={<CleaningJobList />} />
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
