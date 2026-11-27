import { DeleteButton, EditButton, List, ShowButton, useTable } from '@refinedev/antd'
import { Space, Table, Tag } from 'antd'
import type { Todo } from '@/types/db'

export function TodoList() {
  const { tableProps } = useTable<Todo>({
    syncWithLocation: true,
    liveMode: 'auto',
    sorters: { initial: [{ field: 'created_at', order: 'desc' }] },
  })

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column<Todo> dataIndex="title" title="Title" />
        <Table.Column<Todo>
          dataIndex="done"
          title="Status"
          render={(done: boolean) => (
            <Tag color={done ? 'green' : 'orange'}>{done ? 'Done' : 'Pending'}</Tag>
          )}
        />
        <Table.Column<Todo>
          dataIndex="created_at"
          title="Created"
          render={(value: string) => new Date(value).toLocaleString()}
          sorter
        />
        <Table.Column<Todo>
          title="Actions"
          render={(_, record) => (
            <Space>
              <ShowButton hideText size="small" recordItemId={record.id} />
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  )
}
