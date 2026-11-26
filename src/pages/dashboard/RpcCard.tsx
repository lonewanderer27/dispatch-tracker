import { Alert, Button, Descriptions, Progress, Space, Typography } from 'antd'
import { Card } from '@/components/Card'
import { useTodoStatsCheck } from '@/features/integration/useIntegrationCheck'

export function RpcCard() {
  const { status, data, error, run } = useTodoStatsCheck()

  return (
    <Card title="Call RPC" style={{ flex: 1, minWidth: 280 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          Calls <code>todo_stats()</code>. Proves SQL logic runs, RLS applies to the RPC, and types
          flow end to end.
        </Typography.Paragraph>
        <Button
          type="primary"
          data-testid="btn-call-rpc"
          loading={status === 'loading'}
          onClick={() => void run()}
        >
          Call RPC
        </Button>
        <div data-testid="result-rpc">
          {status === 'error' && (
            <Alert type="error" showIcon message={error ?? 'Request failed'} />
          )}
          {status === 'success' && data && (
            <>
              <Descriptions size="small" column={3} bordered style={{ marginBottom: 12 }}>
                <Descriptions.Item label="Total">{data.total}</Descriptions.Item>
                <Descriptions.Item label="Done">{data.done}</Descriptions.Item>
                <Descriptions.Item label="Pending">{data.pending}</Descriptions.Item>
              </Descriptions>
              <Progress percent={data.pct_done} format={(p?: number) => `${String(p ?? 0)}%`} />
            </>
          )}
        </div>
      </Space>
    </Card>
  )
}
