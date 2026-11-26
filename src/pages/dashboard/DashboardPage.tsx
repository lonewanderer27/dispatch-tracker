import { useGetIdentity } from '@refinedev/core'
import { Flex, Typography } from 'antd'
import { EdgeFunctionCard } from './EdgeFunctionCard'
import { RpcCard } from './RpcCard'

interface Identity {
  name?: string
}

export function DashboardPage() {
  const { data: identity } = useGetIdentity<Identity>()

  return (
    <Flex vertical gap="large">
      <Typography.Title level={3} style={{ margin: 0 }}>
        Welcome{identity?.name ? `, ${identity.name}` : ''}
      </Typography.Title>
      <Typography.Title level={5} style={{ margin: 0 }}>
        Integration checks
      </Typography.Title>
      <Flex gap="large" wrap>
        <EdgeFunctionCard />
        <RpcCard />
      </Flex>
    </Flex>
  )
}
