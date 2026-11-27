import { CreateButton, DeleteButton, EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table } from 'antd'
import type { CleaningType } from '@/types/db'
import { ColorMotifTag } from '@/shared/color-motif/ColorMotifTag'

export function CleaningTypeList() {
  const { tableProps } = useTable<CleaningType>({
    syncWithLocation: true,
    sorters: { initial: [{ field: 'name', order: 'asc' }] },
  })

  return (
    <List headerButtons={() => <CreateButton />}>
      <Table {...tableProps} rowKey="id">
        <Table.Column<CleaningType>
          dataIndex="name"
          title="Name"
          sorter
          render={(name: string, record) => (
            <ColorMotifTag motif={record.color_motif}>{name}</ColorMotifTag>
          )}
        />
        <Table.Column<CleaningType>
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
