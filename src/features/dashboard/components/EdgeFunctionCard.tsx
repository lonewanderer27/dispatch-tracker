import { Alert, Button, Descriptions, Space, Typography } from 'antd'
import { Card } from '@/shared/ui/Card'
import { useExchangeRateCheck } from '@/features/dashboard/useIntegrationCheck'

export function EdgeFunctionCard() {
  const { status, data, error, latencyMs, run } = useExchangeRateCheck()

  return (
    <Card title="Invoke edge function" style={{ flex: 1, minWidth: 280 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          Calls <code>exchange-rate</code> with your JWT. Proves auth passes through, outbound
          network works, and env/secrets are wired.
        </Typography.Paragraph>
        <Button
          type="primary"
          data-testid="btn-invoke-edge"
          loading={status === 'loading'}
          onClick={() => void run()}
        >
          Invoke edge function
        </Button>
        <div data-testid="result-edge">
          {status === 'error' && (
            <Alert type="error" showIcon message={error ?? 'Request failed'} />
          )}
          {status === 'success' && data && (
            <>
              <Alert type="success" showIcon message="Rate fetched" style={{ marginBottom: 12 }} />
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="Pair">
                  {data.base} → {data.symbol}
                </Descriptions.Item>
                <Descriptions.Item label="Rate">{data.rate}</Descriptions.Item>
                <Descriptions.Item label="Date">{data.date}</Descriptions.Item>
                <Descriptions.Item label="Latency">{latencyMs} ms</Descriptions.Item>
              </Descriptions>
            </>
          )}
        </div>
      </Space>
    </Card>
  )
}
