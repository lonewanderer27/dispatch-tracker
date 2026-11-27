import { describe, expect, it, vi } from 'vitest'
import type { AppSupabaseClient } from '@/shared/supabase'
import {
  DEFAULT_QUERY,
  EMPTY_FILTERS,
  fetchCleanersForCleaningJob,
  fetchCleaningJobs,
  fetchClientFeedbacks,
  fetchCompleteAddress,
  hasActiveFilters,
} from '@/features/cleaning-jobs/api'

describe('fetchCleaningJobs', () => {
  it('sends no filters, the default sort and the page for an empty query', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }
    const result = await fetchCleaningJobs(
      client as unknown as AppSupabaseClient,
      DEFAULT_QUERY,
      'America/Edmonton',
    )
    expect(client.rpc).toHaveBeenCalledWith('get_cleaning_jobs', {
      p_cleaner_ids: undefined,
      p_company_ids: undefined,
      p_client_ids: undefined,
      p_cleaning_type_ids: undefined,
      p_feedback_search: undefined,
      p_ratings: undefined,
      p_date_range: undefined,
      p_date_from: undefined,
      p_date_to: undefined,
      p_time_zone: 'America/Edmonton',
      p_sort_by: 'schedule',
      p_sort_dir: 'desc',
      p_page: 1,
      p_page_size: 10,
    })
    expect(result).toEqual({ rows: [], total: 0 })
  })

  it('sends the chosen filters and sort and reads the total from the first row', async () => {
    const rows = [{ id: 'j1', total_count: 42 }]
    const client = { rpc: vi.fn().mockResolvedValue({ data: rows, error: null }) }
    const result = await fetchCleaningJobs(
      client as unknown as AppSupabaseClient,
      {
        filters: {
          cleanerIds: ['k1'],
          companyIds: ['co1'],
          clientIds: ['c1'],
          cleaningTypeIds: ['t1'],
          feedbackSearch: ' oven ',
          ratings: [3, 4],
          dateRange: 'custom',
          dateFrom: '2026-12-01',
          dateTo: '2026-12-31',
        },
        sortBy: 'rating',
        sortDir: 'asc',
        page: 2,
        pageSize: 25,
      },
      'Australia/Sydney',
    )
    expect(client.rpc).toHaveBeenCalledWith('get_cleaning_jobs', {
      p_cleaner_ids: ['k1'],
      p_company_ids: ['co1'],
      p_client_ids: ['c1'],
      p_cleaning_type_ids: ['t1'],
      p_feedback_search: ' oven ',
      p_ratings: [3, 4],
      p_date_range: 'custom',
      p_date_from: '2026-12-01',
      p_date_to: '2026-12-31',
      p_time_zone: 'Australia/Sydney',
      p_sort_by: 'rating',
      p_sort_dir: 'asc',
      p_page: 2,
      p_page_size: 25,
    })
    expect(result).toEqual({ rows, total: 42 })
  })

  it('throws the database message when the call fails', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }) }
    await expect(
      fetchCleaningJobs(client as unknown as AppSupabaseClient, DEFAULT_QUERY, 'UTC'),
    ).rejects.toThrow('denied')
  })

  it('sends a named range without custom dates and ignores stale custom dates', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }
    await fetchCleaningJobs(
      client as unknown as AppSupabaseClient,
      {
        ...DEFAULT_QUERY,
        filters: {
          ...EMPTY_FILTERS,
          dateRange: 'last_3_months',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
        },
      },
      'UTC',
    )
    expect(client.rpc).toHaveBeenCalledWith(
      'get_cleaning_jobs',
      expect.objectContaining({
        p_date_range: 'last_3_months',
        p_date_from: undefined,
        p_date_to: undefined,
        p_time_zone: 'UTC',
      }),
    )
  })
})

describe('hasActiveFilters', () => {
  it('is false for the empty filters and for a blank search', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, feedbackSearch: '   ' })).toBe(false)
  })

  it('is true when any filter is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, ratings: [5] })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, cleanerIds: ['k1'] })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, feedbackSearch: 'oven' })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, dateRange: 'current_week' })).toBe(true)
  })
})

describe('fetchCompleteAddress', () => {
  it('calls the function with the property id and returns the text', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: '1 Test St, Edmonton', error: null }) }
    const result = await fetchCompleteAddress(client as unknown as AppSupabaseClient, 'p1')
    expect(client.rpc).toHaveBeenCalledWith('get_complete_address_for_property_id', {
      p_property_id: 'p1',
    })
    expect(result).toBe('1 Test St, Edmonton')
  })

  it('throws the database message when the call fails', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }) }
    await expect(
      fetchCompleteAddress(client as unknown as AppSupabaseClient, 'p1'),
    ).rejects.toThrow('denied')
  })
})

describe('fetchCleanersForCleaningJob', () => {
  it('calls the function with the job id and returns the rows', async () => {
    const rows = [{ cleaner_id: 'c1', full_name: 'Zed Adams' }]
    const client = { rpc: vi.fn().mockResolvedValue({ data: rows, error: null }) }
    const result = await fetchCleanersForCleaningJob(client as unknown as AppSupabaseClient, 'j1')
    expect(client.rpc).toHaveBeenCalledWith('get_cleaners_for_cleaning_job_id', {
      p_cleaning_job_id: 'j1',
    })
    expect(result).toEqual(rows)
  })

  it('throws the database message when the call fails', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }) }
    await expect(
      fetchCleanersForCleaningJob(client as unknown as AppSupabaseClient, 'j1'),
    ).rejects.toThrow('denied')
  })
})

describe('fetchClientFeedbacks', () => {
  it('calls the function with the job id and returns the rows', async () => {
    const rows = [
      { id: 'f1', rating: 5, feedback: 'Great', created_at: '2026-12-05T10:00:00+00:00' },
    ]
    const client = { rpc: vi.fn().mockResolvedValue({ data: rows, error: null }) }
    const result = await fetchClientFeedbacks(client as unknown as AppSupabaseClient, 'j1')
    expect(client.rpc).toHaveBeenCalledWith('get_client_feedbacks_for_cleaning_job_id', {
      p_cleaning_job_id: 'j1',
    })
    expect(result).toEqual(rows)
  })

  it('throws the database message when the call fails', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }) }
    await expect(
      fetchClientFeedbacks(client as unknown as AppSupabaseClient, 'j1'),
    ).rejects.toThrow('denied')
  })
})
