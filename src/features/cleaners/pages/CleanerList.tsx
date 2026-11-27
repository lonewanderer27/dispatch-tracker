import { DeleteButton, EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table } from 'antd'
import type { Cleaner } from '@/types/db'

export function CleanerList() {
  const { tableProps } = useTable<Cleaner>({
    syncWithLocation: true,
    sorters: { initial: [{ field: 'last_name', order: 'asc' }] },
  })

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column<Cleaner>
          title="Name"
          render={(_, record) =>
            [record.first_name, record.middle_name, record.last_name].filter(Boolean).join(' ')
          }
        />
        <Table.Column<Cleaner> dataIndex="last_name" title="Last name" sorter />
        <Table.Column<Cleaner>
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
