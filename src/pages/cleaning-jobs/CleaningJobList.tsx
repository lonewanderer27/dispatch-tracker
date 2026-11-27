import { useState } from 'react'
import { List } from '@refinedev/antd'
import { Alert, Button, Empty, Rate, Space, Table, Tag, Typography, type TableProps } from 'antd'
import {
  DEFAULT_QUERY,
  EMPTY_FILTERS,
  hasActiveFilters,
  type CleaningJobFilters,
  type CleaningJobQuery,
  type CleaningJobSortKey,
} from '@/features/cleaning-jobs/api'
import { useCleaningJobs } from '@/features/cleaning-jobs/hooks'
import { formatSchedule } from '@/features/cleaning-jobs/timeZone'
import { usePreferredTimeZone } from '@/features/cleaning-jobs/usePreferredTimeZone'
import type { CleaningJobListRow } from '@/types/db'
import { CleaningJobFilterBar } from '@/components/cleaning-jobs/CleaningJobFilterBar'
import { FeedbackModal } from '@/components/cleaning-jobs/FeedbackModal'
import { TimeZonePicker } from '@/components/cleaning-jobs/TimeZonePicker'
import { ColorMotifTag } from '@/components/color-motif/ColorMotifTag'

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })
const SORT_KEYS: readonly CleaningJobSortKey[] = ['schedule', 'client', 'cleaning_type', 'rating']

function isSortKey(key: unknown): key is CleaningJobSortKey {
  return SORT_KEYS.some((sortKey) => sortKey === key)
}

export function CleaningJobList() {
  const { timeZone, isLoaded, save, isSaving } = usePreferredTimeZone()
  const [query, setQuery] = useState<CleaningJobQuery>(DEFAULT_QUERY)
  const [feedbackJob, setFeedbackJob] = useState<CleaningJobListRow | null>(null)
  const { data, isFetching, error } = useCleaningJobs(query, timeZone, isLoaded)

  const sortOrderFor = (key: CleaningJobSortKey) =>
    query.sortBy === key ? (query.sortDir === 'asc' ? 'ascend' : 'descend') : null

  const handleChange: TableProps<CleaningJobListRow>['onChange'] = (
    pagination,
    _filters,
    sorter,
    extra,
  ) => {
    if (extra.action === 'sort') {
      const single = Array.isArray(sorter) ? sorter[0] : sorter
      if (single?.order && isSortKey(single.columnKey)) {
        setQuery({
          ...query,
          sortBy: single.columnKey,
          sortDir: single.order === 'ascend' ? 'asc' : 'desc',
          page: 1,
        })
      } else {
        // Sorting was cleared: back to the default order.
        setQuery({
          ...query,
          sortBy: DEFAULT_QUERY.sortBy,
          sortDir: DEFAULT_QUERY.sortDir,
          page: 1,
        })
      }
      return
    }
    setQuery({
      ...query,
      page: pagination.current ?? 1,
      pageSize: pagination.pageSize ?? DEFAULT_QUERY.pageSize,
    })
  }

  const setFilters = (filters: CleaningJobFilters) => {
    setQuery({ ...query, filters, page: 1 })
  }

  // With filters on, an empty table offers to clear them; otherwise antd's default empty state.
  const tableLocale = hasActiveFilters(query.filters)
    ? {
        emptyText: (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No jobs match these filters">
            <Button
              onClick={() => {
                setFilters(EMPTY_FILTERS)
              }}
            >
              Clear filters
            </Button>
          </Empty>
        ),
      }
    : undefined

  return (
    <List canCreate={false}>
      <TimeZonePicker value={timeZone} saving={isSaving} onChange={save} />
      <CleaningJobFilterBar value={query.filters} onChange={setFilters} />
      {error && (
        <Alert type="error" showIcon message={error.message} style={{ marginBottom: 16 }} />
      )}
      <Table<CleaningJobListRow>
        rowKey="id"
        dataSource={data?.rows ?? []}
        loading={isFetching}
        scroll={{ x: 'max-content' }}
        onChange={handleChange}
        locale={tableLocale}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [10, 25, 50],
        }}
      >
        <Table.Column<CleaningJobListRow>
          title="Assignee"
          render={(_, record) =>
            record.cleaners.length === 0 ? (
              <Typography.Text type="secondary">Unassigned</Typography.Text>
            ) : (
              <Space wrap>
                {record.cleaners.map((cleaner) => (
                  <Tag key={cleaner.cleaner_id}>{cleaner.full_name}</Tag>
                ))}
              </Space>
            )
          }
        />
        <Table.Column<CleaningJobListRow>
          title="Company"
          render={(_, record) => (
            <ColorMotifTag motif={record.company_color}>{record.company_name}</ColorMotifTag>
          )}
        />
        <Table.Column<CleaningJobListRow>
          title="Status"
          render={(_, record) => (
            <ColorMotifTag motif={record.status_color}>{record.status_name}</ColorMotifTag>
          )}
        />
        <Table.Column<CleaningJobListRow>
          key="schedule"
          title="Scheduled Date"
          dataIndex="schedule"
          sorter
          // The list starts newest first, so a click must go to oldest first, and switching to this
          // column from another one starts newest first. The default order of the cycle is ascending.
          sortDirections={['descend', 'ascend']}
          sortOrder={sortOrderFor('schedule')}
          render={(value: string) => formatSchedule(value, timeZone)}
        />
        <Table.Column<CleaningJobListRow>
          key="client"
          title="Client Name"
          dataIndex="client_name"
          sorter
          sortOrder={sortOrderFor('client')}
        />
        <Table.Column<CleaningJobListRow>
          title="Address"
          dataIndex="address"
          render={(value: string | null) => value ?? '-'}
        />
        <Table.Column<CleaningJobListRow>
          key="cleaning_type"
          title="Cleaning Type"
          sorter
          sortOrder={sortOrderFor('cleaning_type')}
          render={(_, record) => (
            <Space wrap>
              {record.cleaning_types.map((type) => (
                <ColorMotifTag key={type.name} motif={type.color}>
                  {type.name}
                </ColorMotifTag>
              ))}
            </Space>
          )}
        />
        <Table.Column<CleaningJobListRow>
          title="Notes"
          dataIndex="description"
          render={(value: string | null) => value ?? '-'}
        />
        <Table.Column<CleaningJobListRow>
          title="Feedback"
          render={(_, record) => {
            if (record.feedbacks.length === 0) return '-'
            if (record.feedbacks.length === 1) return record.feedbacks[0]?.feedback ?? '-'
            return (
              <Button
                size="small"
                onClick={() => {
                  setFeedbackJob(record)
                }}
              >
                View all ({record.feedbacks.length})
              </Button>
            )
          }}
        />
        <Table.Column<CleaningJobListRow>
          key="rating"
          title="Rating"
          sorter
          sortOrder={sortOrderFor('rating')}
          render={(_, record) =>
            record.avg_rating === null ? (
              '-'
            ) : (
              <Space size={4}>
                <Rate disabled allowHalf value={Math.round(record.avg_rating * 2) / 2} />
                {record.feedbacks.length > 1 && (
                  <Typography.Text type="secondary">
                    avg of {record.feedbacks.length}
                  </Typography.Text>
                )}
              </Space>
            )
          }
        />
        <Table.Column<CleaningJobListRow>
          title="Rate (CAD)"
          dataIndex="rate"
          render={(value: number) => CAD.format(value)}
        />
      </Table>
      <FeedbackModal
        job={feedbackJob}
        timeZone={timeZone}
        onClose={() => {
          setFeedbackJob(null)
        }}
      />
    </List>
  )
}
