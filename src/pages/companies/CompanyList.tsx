import { DeleteButton, EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table } from 'antd'
import type { Company } from '@/types/db'
import { ColorMotifTag } from '@/components/color-motif/ColorMotifTag'

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
          render={(name: string, record) => (
            <ColorMotifTag motif={record.color_motif}>{name}</ColorMotifTag>
          )}
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
