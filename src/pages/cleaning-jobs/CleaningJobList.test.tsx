import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CleaningJobQuery } from '@/features/cleaning-jobs/api'
import { CleaningJobList } from '@/pages/cleaning-jobs/CleaningJobList'
import type { CleaningJobListRow } from '@/types/db'

const useCleaningJobs = vi.fn()
const save = vi.fn()

vi.mock('@refinedev/antd', () => ({
  List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@refinedev/core', () => ({ useList: () => ({ result: { data: [] } }) }))
vi.mock('@/features/cleaning-jobs/hooks', () => ({
  useCleaningJobs: (...args: unknown[]) => useCleaningJobs(...args) as unknown,
  useClientFeedbacks: () => ({
    data: [
      { id: 'f2', rating: 3, feedback: 'Missed the oven', created_at: '2026-12-06T10:00:00+00:00' },
      { id: 'f1', rating: 5, feedback: 'Great clean', created_at: '2026-12-05T10:00:00+00:00' },
    ],
    isLoading: false,
    error: null,
  }),
}))
// CI runs in UTC; pin the device zone so the "use my device time zone" button is enabled there too.
vi.mock('@/features/cleaning-jobs/timeZone', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/cleaning-jobs/timeZone')>()),
  deviceTimeZone: () => 'Australia/Sydney',
}))
vi.mock('@/features/cleaning-jobs/usePreferredTimeZone', () => ({
  usePreferredTimeZone: () => ({ timeZone: 'UTC', isLoaded: true, save, isSaving: false }),
}))

function job(overrides: Partial<CleaningJobListRow> = {}): CleaningJobListRow {
  return {
    id: 'j1',
    schedule: '2026-12-01T09:00:00+00:00',
    rate: 150,
    description: '6 hr deep clean: oven',
    status_name: 'Booked',
    client_id: 'c1',
    client_name: 'Xavier Ashby',
    company_name: 'The Tidy Team',
    company_color: 'geekblue',
    status_color: 'blue',
    address: '12 Maple Ridge Crescent, Edmonton, AB, T5J 0N3, CA',
    cleaners: [{ cleaner_id: 'k1', full_name: 'Zed Adams' }],
    cleaning_types: [
      { name: 'Deep', color: 'purple' },
      { name: 'Move-Out', color: 'orange' },
    ],
    feedbacks: [],
    avg_rating: null,
    total_count: 1,
    ...overrides,
  }
}

function lastQuery(): CleaningJobQuery {
  const call = useCleaningJobs.mock.calls.at(-1) as [CleaningJobQuery, string, boolean]
  return call[0]
}

beforeEach(() => {
  useCleaningJobs.mockReturnValue({
    data: { rows: [job()], total: 1 },
    isFetching: false,
    error: null,
  })
})

describe('CleaningJobList', () => {
  it('shows every column, in order', () => {
    render(<CleaningJobList />)
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers).toEqual([
      'Assignee',
      'Company',
      'Status',
      'Scheduled Date',
      'Client Name',
      'Address',
      'Cleaning Type',
      'Notes',
      'Feedback',
      'Rating',
      'Rate (CAD)',
    ])
  })

  it('shows a job with its cleaners, types, date in the chosen zone and rate in CAD', () => {
    render(<CleaningJobList />)
    const row = screen.getByRole('row', { name: /Xavier Ashby/ })
    expect(within(row).getByText('Zed Adams')).toBeInTheDocument()
    expect(within(row).getByText('Deep')).toBeInTheDocument()
    expect(within(row).getByText('Move-Out')).toBeInTheDocument()
    expect(within(row).getByText('The Tidy Team')).toBeInTheDocument()
    expect(within(row).getByText('Booked')).toBeInTheDocument()
    expect(within(row).getByText('Tue 1 Dec 2026, 9:00 AM')).toBeInTheDocument()
    expect(within(row).getByText('$150.00')).toBeInTheDocument()
    expect(within(row).getByText('6 hr deep clean: oven')).toBeInTheDocument()
  })

  it('shows Company, Status and each Cleaning Type as a pill in its colour, text kept', () => {
    render(<CleaningJobList />)
    const row = screen.getByRole('row', { name: /Xavier Ashby/ })
    expect(within(row).getByText('The Tidy Team')).toHaveClass('ant-tag', 'ant-tag-geekblue')
    expect(within(row).getByText('Booked')).toHaveClass('ant-tag', 'ant-tag-blue')
    expect(within(row).getByText('Deep')).toHaveClass('ant-tag', 'ant-tag-purple')
    expect(within(row).getByText('Move-Out')).toHaveClass('ant-tag', 'ant-tag-orange')
  })

  it('shows a colour the palette does not know as the grey default pill', () => {
    useCleaningJobs.mockReturnValue({
      data: {
        rows: [
          job({
            company_color: 'pink',
            status_color: 'default',
            cleaning_types: [{ name: 'Deep', color: '#ff0000' }],
          }),
        ],
        total: 1,
      },
      isFetching: false,
      error: null,
    })
    render(<CleaningJobList />)
    const row = screen.getByRole('row', { name: /Xavier Ashby/ })
    expect(within(row).getByText('The Tidy Team')).toHaveClass('ant-tag-default')
    expect(within(row).getByText('The Tidy Team')).not.toHaveClass('ant-tag-pink')
    expect(within(row).getByText('Booked')).toHaveClass('ant-tag-default')
    expect(within(row).getByText('Deep')).toHaveClass('ant-tag-default')
  })

  it('marks an unassigned job and a job without feedback', () => {
    useCleaningJobs.mockReturnValue({
      data: { rows: [job({ cleaners: [] })], total: 1 },
      isFetching: false,
      error: null,
    })
    render(<CleaningJobList />)
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('shows one feedback inline with its stars and the average for several', () => {
    useCleaningJobs.mockReturnValue({
      data: {
        rows: [
          job({
            id: 'j1',
            client_name: 'Single Feedback',
            feedbacks: [
              { rating: 4, feedback: 'Very good', created_at: '2026-12-02T10:00:00+00:00' },
            ],
            avg_rating: 4,
          }),
        ],
        total: 1,
      },
      isFetching: false,
      error: null,
    })
    render(<CleaningJobList />)
    const row = screen.getByRole('row', { name: /Single Feedback/ })
    expect(within(row).getByText('Very good')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: /view all/i })).not.toBeInTheDocument()
  })

  it('opens every feedback of a job with several in a modal', async () => {
    useCleaningJobs.mockReturnValue({
      data: {
        rows: [
          job({
            feedbacks: [
              { rating: 3, feedback: 'Missed the oven', created_at: '2026-12-06T10:00:00+00:00' },
              { rating: 5, feedback: 'Great clean', created_at: '2026-12-05T10:00:00+00:00' },
            ],
            avg_rating: 4,
          }),
        ],
        total: 1,
      },
      isFetching: false,
      error: null,
    })
    render(<CleaningJobList />)
    expect(screen.getByText('avg of 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'View all (2)' }))
    expect(screen.getByText('Feedback for Xavier Ashby')).toBeInTheDocument()
    expect(screen.getByText('Missed the oven')).toBeInTheDocument()
    expect(screen.getByText('Great clean')).toBeInTheDocument()
  })

  it('asks for the newest jobs first with the default query and the saved time zone', () => {
    render(<CleaningJobList />)
    expect(lastQuery()).toMatchObject({
      sortBy: 'schedule',
      sortDir: 'desc',
      page: 1,
      pageSize: 10,
    })
    const call = useCleaningJobs.mock.calls.at(-1) as [CleaningJobQuery, string, boolean]
    expect(call[1]).toBe('UTC')
    expect(call[2]).toBe(true)
  })

  it('sorts by a column and returns to page 1', async () => {
    render(<CleaningJobList />)
    await userEvent.click(screen.getByRole('columnheader', { name: 'Client Name' }))
    expect(lastQuery()).toMatchObject({ sortBy: 'client', sortDir: 'asc', page: 1 })
    await userEvent.click(screen.getByRole('columnheader', { name: 'Client Name' }))
    expect(lastQuery()).toMatchObject({ sortBy: 'client', sortDir: 'desc' })
    await userEvent.click(screen.getByRole('columnheader', { name: 'Client Name' }))
    expect(lastQuery()).toMatchObject({ sortBy: 'schedule', sortDir: 'desc' })
  })

  it('does not offer sorting on feedback', () => {
    render(<CleaningJobList />)
    expect(screen.getByRole('columnheader', { name: 'Feedback' })).not.toHaveClass(
      'ant-table-column-has-sorters',
    )
  })

  it('filters by a date range and shows the empty state with a way back', async () => {
    useCleaningJobs.mockImplementation((query: CleaningJobQuery) => ({
      data:
        query.filters.dateRange === 'all' ? { rows: [job()], total: 1 } : { rows: [], total: 0 },
      isFetching: false,
      error: null,
    }))
    render(<CleaningJobList />)
    await userEvent.click(screen.getByText('Next month'))
    expect(lastQuery().filters.dateRange).toBe('next_month')
    expect(screen.getByText('No jobs match these filters')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(lastQuery().filters.dateRange).toBe('all')
    expect(screen.getByText('Xavier Ashby')).toBeInTheDocument()
  })

  it('shows the database error', () => {
    useCleaningJobs.mockReturnValue({
      data: undefined,
      isFetching: false,
      error: new Error('denied'),
    })
    render(<CleaningJobList />)
    expect(screen.getByText('denied')).toBeInTheDocument()
  })

  it('saves a new time zone from the picker', async () => {
    render(<CleaningJobList />)
    await userEvent.click(screen.getByRole('button', { name: /use my device time zone/i }))
    expect(save).toHaveBeenCalledWith('Australia/Sydney')
  })
})
