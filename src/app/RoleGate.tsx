import { useGetIdentity, useLogout } from '@refinedev/core'
import { Button, Result, Spin } from 'antd'
import { Outlet } from 'react-router'

interface Identity {
  roleId: string | null
}

// Replaces <Outlet /> in the signed-in layout. A user with no role (a new sign-up) sees one notice instead
// of any page. The database already shows them nothing; this explains why. It fails closed: if the
// identity is missing it shows the notice too.
export function RoleOutlet() {
  const { data: identity, isLoading } = useGetIdentity<Identity>()
  const { mutate: logout } = useLogout()

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!identity?.roleId) {
    return (
      <Result
        status="403"
        title="Your account has no access yet"
        subTitle="Ask an administrator to give you a role, then reload this page."
        extra={
          <Button
            onClick={() => {
              logout()
            }}
          >
            Sign out
          </Button>
        }
      />
    )
  }
  return <Outlet />
}
