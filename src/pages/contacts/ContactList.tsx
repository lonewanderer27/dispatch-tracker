import { DeleteButton, EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table } from 'antd'
import type { ContactRow } from '@/types/db'

export function ContactList() {
  const { tableProps } = useTable<ContactRow>({
    syncWithLocation: true,
    meta: { select: '*, clients(name)' },
    sorters: { initial: [{ field: 'last_name', order: 'asc' }] },
  })

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column<ContactRow>
          title="Name"
          render={(_, record) => `${record.first_name} ${record.last_name}`}
        />
        <Table.Column<ContactRow> dataIndex="contact_no" title="Contact number" />
        <Table.Column<ContactRow>
          title="Client"
          render={(_, record) => record.clients?.name ?? 'Unknown'}
        />
        <Table.Column<ContactRow>
          title="Actions"
          render={(_, record) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  )
}
