import { Authenticated, Refine } from '@refinedev/core'
import { AuthPage, ThemedLayout, useNotificationProvider } from '@refinedev/antd'
import '@refinedev/antd/dist/reset.css'
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from '@refinedev/react-router'
import { ConfigProvider } from 'antd'
import { Fragment } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router'
import { features } from '@/app/features'
import { RoleOutlet } from '@/app/RoleGate'
import { accessControlProvider } from '@/app/providers/accessControlProvider'
import { authProvider } from '@/app/providers/authProvider'
import { refineDataProvider, refineLiveProvider } from '@/app/providers/dataProvider'
import { BrandTitle } from '@/shared/brand/BrandTitle'
import { brandTheme } from '@/shared/brand/theme'

const resources = features.map((feature) => feature.resource)

export default function App() {
  return (
    <ConfigProvider theme={brandTheme}>
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
                <ThemedLayout Title={BrandTitle}>
                  <div className="app-content">
                    <RoleOutlet />
                  </div>
                </ThemedLayout>
              </Authenticated>
            }
          >
            {features.map((feature) => (
              <Fragment key={feature.resource.name}>{feature.routes}</Fragment>
            ))}
          </Route>

          <Route
            element={
              <Authenticated key="authenticated-outer" fallback={<Outlet />}>
                <Navigate to="/" replace />
              </Authenticated>
            }
          >
            <Route
              path="/login"
              element={<AuthPage type="login" title={<BrandTitle collapsed={false} />} />}
            />
            <Route
              path="/register"
              element={<AuthPage type="register" title={<BrandTitle collapsed={false} />} />}
            />
          </Route>
        </Routes>
        <UnsavedChangesNotifier />
        <DocumentTitleHandler />
      </Refine>
    </ConfigProvider>
  )
}
