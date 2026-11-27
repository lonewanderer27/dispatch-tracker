import { EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table, Tag } from 'antd'
import { SUPER_ADMIN_ROLE_ID } from '@/features/users/roles'
import type { UserRow } from '@/types/db'

export function UserList() {
  const { tableProps } = useTable<UserRow>({
    resource: 'profiles',
    syncWithLocation: true,
    meta: { select: '*, roles(name)' },
    sorters: { initial: [{ field: 'created_at', order: 'asc' }] },
  })

  return (
    <List canCreate={false}>
      <Table {...tableProps} rowKey="id">
        <Table.Column<UserRow>
          dataIndex="display_name"
          title="Display name"
          render={(value: string) => (value === '' ? '(none)' : value)}
        />
        <Table.Column<UserRow>
          title="Role"
          render={(_, record) => (
            <Tag color={record.role_id === SUPER_ADMIN_ROLE_ID ? 'red' : 'default'}>
              {record.role_id === null ? 'No role' : (record.roles?.name ?? 'Unknown')}
            </Tag>
          )}
        />
        <Table.Column<UserRow>
          dataIndex="created_at"
          title="Created"
          render={(value: string) => new Date(value).toLocaleString()}
          sorter
        />
        <Table.Column<UserRow>
          title="Actions"
          render={(_, record) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  )
}
