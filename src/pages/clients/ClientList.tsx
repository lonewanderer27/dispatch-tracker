import { DeleteButton, EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table } from 'antd'
import type { ClientRow } from '@/types/db'

export function ClientList() {
  const { tableProps } = useTable<ClientRow>({
    syncWithLocation: true,
    meta: { select: '*, companies(name)' },
    sorters: { initial: [{ field: 'name', order: 'asc' }] },
  })

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column<ClientRow> dataIndex="name" title="Name" sorter />
        <Table.Column<ClientRow>
          title="Company"
          render={(_, record) => record.companies?.name ?? 'Unknown'}
        />
        <Table.Column<ClientRow>
          title="Actions"
          render={(_, record) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton
                hideText
                size="small"
                recordItemId={record.id}
                confirmTitle="Delete this client? Its contacts are deleted too."
              />
            </Space>
          )}
        />
      </Table>
    </List>
  )
}
