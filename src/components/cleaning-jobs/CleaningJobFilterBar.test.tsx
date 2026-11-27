import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CleaningJobFilterBar } from '@/components/cleaning-jobs/CleaningJobFilterBar'
import { EMPTY_FILTERS, type CleaningJobFilters } from '@/features/cleaning-jobs/api'

const rowsByResource: Record<string, { id: string; [key: string]: string }[]> = {
  cleaners: [{ id: 'k1', first_name: 'Zed', middle_name: '', last_name: 'Adams' }],
  companies: [{ id: 'co1', name: 'The Tidy Team' }],
  clients: [{ id: 'c1', name: 'Xavier Ashby' }],
  cleaning_types: [{ id: 't1', name: 'Deep' }],
}

vi.mock('@refinedev/core', () => ({
  useList: ({ resource }: { resource: string }) => ({
    result: { data: rowsByResource[resource] ?? [] },
  }),
}))

function setup(value: CleaningJobFilters = EMPTY_FILTERS) {
  const onChange = vi.fn()
  render(<CleaningJobFilterBar value={value} onChange={onChange} />)
  return onChange
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CleaningJobFilterBar', () => {
  it('lists the date choices in order, starting with All dates and Next month', () => {
    setup()
    const labels = screen.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)
    expect(labels).toEqual([
      'All dates',
      'Next month',
      'Current week',
      'Current month',
      'Last 3 months',
      'Last 6 months',
      'Custom range',
    ])
  })

  it('picks a date range and clears any custom dates', async () => {
    const onChange = setup({
      ...EMPTY_FILTERS,
      dateRange: 'custom',
      dateFrom: '2026-12-01',
      dateTo: null,
    })
    await userEvent.click(screen.getByText('Last 3 months'))
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      dateRange: 'last_3_months',
      dateFrom: null,
      dateTo: null,
    })
  })

  it('shows the range picker only for the custom range', () => {
    setup()
    expect(screen.queryByPlaceholderText('From date')).not.toBeInTheDocument()
  })

  it('shows the range picker for the custom range', () => {
    setup({ ...EMPTY_FILTERS, dateRange: 'custom' })
    expect(screen.getByPlaceholderText('From date')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('To date')).toBeInTheDocument()
  })

  it('searches the feedback when Enter is pressed', async () => {
    const onChange = setup()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search feedback' }), 'oven{Enter}')
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, feedbackSearch: 'oven' })
  })

  it('opens and closes the filters panel', async () => {
    setup()
    expect(screen.queryByText('Any cleaner')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /filters/i }))
    expect(screen.getByText('Any cleaner')).toBeInTheDocument()
    expect(screen.getByText('Any company')).toBeInTheDocument()
    expect(screen.getByText('Any client')).toBeInTheDocument()
    expect(screen.getByText('Any cleaning type')).toBeInTheDocument()
    expect(screen.getByText('Any rating')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /hide filters/i }))
    expect(screen.queryByText('Any cleaner')).not.toBeInTheDocument()
  })

  it('shows no active filters when nothing is set', () => {
    setup()
    expect(screen.queryByRole('group', { name: 'Active filters' })).not.toBeInTheDocument()
  })

  it('shows each active filter as a tag that can be removed', async () => {
    const onChange = setup({ ...EMPTY_FILTERS, clientIds: ['c1'], ratings: [4] })
    expect(screen.getByText('Client: Xavier Ashby')).toBeInTheDocument()
    expect(screen.getByText('Rating: 4 stars')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Client: Xavier Ashby' }))
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, ratings: [4] })
  })

  it('clears every filter at once', async () => {
    const onChange = setup({ ...EMPTY_FILTERS, cleanerIds: ['k1'], dateRange: 'current_week' })
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS)
  })
})
