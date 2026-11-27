import { DeleteButton, EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table } from 'antd'
import type { Company } from '@/types/db'
import { CompanyTag } from '@/components/company/CompanyTag'

export function CompanyList() {
  const { tableProps } = useTable<Company>({
    syncWithLocation: true,
    sorters: { initial: [{ field: 'name', order: 'asc' }] },
  })

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column<Company>
          dataIndex="name"
          title="Name"
          sorter
          render={(_, record) => <CompanyTag company={record} />}
        />
        <Table.Column<Company>
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
