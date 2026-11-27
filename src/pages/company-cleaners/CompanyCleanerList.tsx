import { useState } from 'react'
import { useDelete, useList } from '@refinedev/core'
import { List, useTable } from '@refinedev/antd'
import { Modal, Select, Space, Table, Typography } from 'antd'
import type { CleanerCompanyLink, CleanerWithCompanies, Company } from '@/types/db'
import { CompanyTag } from '@/components/company/CompanyTag'
import { matchesCompanyFilter, NO_COMPANY } from './companyFilter'

// One row per cleaner. Each company a cleaner works for is a tag, and removing the tag removes
// that link. New links are added on the create page.
export function CompanyCleanerList() {
  const [companyFilter, setCompanyFilter] = useState<string[]>([])
  const { tableProps } = useTable<CleanerWithCompanies>({
    resource: 'cleaners',
    pagination: { mode: 'off' },
    meta: { select: '*, company_cleaners(id, company_id, companies(name, color_motif))' },
    sorters: { initial: [{ field: 'last_name', order: 'asc' }] },
  })
  const { result: companies } = useList<Company>({
    resource: 'companies',
    pagination: { mode: 'off' },
    sorters: [{ field: 'name', order: 'asc' }],
  })
  const { mutate: removeLink } = useDelete()

  const filterOptions = [
    { label: 'No company', value: NO_COMPANY },
    ...companies.data.map((company) => ({ label: company.name, value: company.id })),
  ]
  const rows = (tableProps.dataSource ?? []).filter((cleaner) =>
    matchesCompanyFilter(cleaner, companyFilter),
  )

  const confirmRemove = (link: CleanerCompanyLink, cleanerName: string) => {
    Modal.confirm({
      title: `Remove ${link.companies?.name ?? 'this company'} from ${cleanerName}?`,
      okText: 'Remove',
      okButtonProps: { danger: true },
      onOk: () => {
        removeLink({ resource: 'company_cleaners', id: link.id, invalidates: ['all'] })
      },
    })
  }

  return (
    <List>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          mode="multiple"
          allowClear
          placeholder="Filter by company"
          style={{ minWidth: 320 }}
          value={companyFilter}
          onChange={setCompanyFilter}
          options={filterOptions}
        />
      </Space>
      <Table {...tableProps} dataSource={rows} pagination={false} rowKey="id">
        <Table.Column<CleanerWithCompanies>
          title="Name"
          render={(_, record) =>
            [record.first_name, record.middle_name, record.last_name].filter(Boolean).join(' ')
          }
        />
        <Table.Column<CleanerWithCompanies>
          title="Companies"
          render={(_, record) => {
            const name = [record.first_name, record.last_name].join(' ')
            if (record.company_cleaners.length === 0) {
              return <Typography.Text type="secondary">No company</Typography.Text>
            }
            return (
              <Space wrap>
                {record.company_cleaners.map((link) => (
                  <CompanyTag
                    key={link.id}
                    company={link.companies}
                    closable
                    onClose={(event) => {
                      event.preventDefault()
                      confirmRemove(link, name)
                    }}
                  />
                ))}
              </Space>
            )
          }}
        />
      </Table>
    </List>
  )
}
