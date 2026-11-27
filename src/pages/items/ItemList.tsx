import { CreateButton, DeleteButton, EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table } from 'antd'
import type { Item } from '@/types/db'

export function ItemList() {
  const { tableProps } = useTable<Item>({
    syncWithLocation: true,
    sorters: { initial: [{ field: 'name', order: 'asc' }] },
  })

  return (
    <List headerButtons={() => <CreateButton />}>
      <Table
        {...tableProps}
        rowKey="id"
        pagination={{
          ...tableProps.pagination,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
        }}
      >
        <Table.Column<Item> dataIndex="name" title="Name" sorter />
        <Table.Column<Item> dataIndex="description" title="Description" />
        <Table.Column<Item>
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
