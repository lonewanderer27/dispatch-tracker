import { CreateButton, DeleteButton, EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table } from 'antd'
import type { CleaningStatus } from '@/types/db'
import { ColorMotifTag } from '@/shared/color-motif/ColorMotifTag'

// Statuses have no sort column; their ids are fixed in life-cycle order (see 0012_cleaning_statuses.sql).
export function CleaningStatusList() {
  const { tableProps } = useTable<CleaningStatus>({
    syncWithLocation: true,
    sorters: { initial: [{ field: 'id', order: 'asc' }] },
  })

  return (
    <List headerButtons={() => <CreateButton />}>
      <Table {...tableProps} rowKey="id">
        <Table.Column<CleaningStatus>
          dataIndex="name"
          title="Name"
          render={(name: string, record) => (
            <ColorMotifTag motif={record.color_motif}>{name}</ColorMotifTag>
          )}
        />
        <Table.Column<CleaningStatus>
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
