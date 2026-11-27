import { useShow } from '@refinedev/core'
import { Show } from '@refinedev/antd'
import { Descriptions, Tag, Typography } from 'antd'
import type { Todo } from '@/types/db'

export function TodoShow() {
  const { query } = useShow<Todo>()
  const record = query.data?.data
  const isLoading = query.isLoading

  return (
    <Show isLoading={isLoading}>
      {record && (
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Title">
            <Typography.Text>{record.title}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={record.done ? 'green' : 'orange'}>{record.done ? 'Done' : 'Pending'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {new Date(record.created_at).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Show>
  )
}
