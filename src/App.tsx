import { Authenticated, Refine, type ResourceProps } from '@refinedev/core'
import { AuthPage, ThemedLayout, ThemedTitle, useNotificationProvider } from '@refinedev/antd'
import '@refinedev/antd/dist/reset.css'
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from '@refinedev/react-router'
import { DashboardOutlined, CheckSquareOutlined } from '@ant-design/icons'
import { ConfigProvider, theme } from 'antd'
import { Navigate, Outlet, Route, Routes } from 'react-router'
import { authProvider } from '@/providers/authProvider'
import { refineDataProvider, refineLiveProvider } from '@/providers/dataProvider'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { TodoList } from '@/pages/todos/TodoList'
import { TodoCreate } from '@/pages/todos/TodoCreate'
import { TodoEdit } from '@/pages/todos/TodoEdit'
import { TodoShow } from '@/pages/todos/TodoShow'

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
]

export default function App() {
  return (
    <ConfigProvider theme={{ algorithm: [theme.defaultAlgorithm] }}>
      <Refine
        dataProvider={{ default: refineDataProvider }}
        liveProvider={refineLiveProvider}
        authProvider={authProvider}
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
