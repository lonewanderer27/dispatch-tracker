import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_QUERY } from '@/features/cleaning-jobs/api'
import {
  useCleanersForCleaningJob,
  useCleaningJobs,
  useClientFeedbacks,
  useCompleteAddress,
} from '@/features/cleaning-jobs/hooks'

const rpc = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock('@/shared/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}))

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return wrapper
}

describe('useCleaningJobs', () => {
  it('calls get_cleaning_jobs and returns the rows and the total', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'j1', total_count: 7 }], error: null })
    const { result } = renderHook(() => useCleaningJobs(DEFAULT_QUERY, 'UTC'), {
      wrapper: setup(),
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(rpc).toHaveBeenCalledWith(
      'get_cleaning_jobs',
      expect.objectContaining({ p_time_zone: 'UTC', p_sort_by: 'schedule' }),
    )
    expect(result.current.data?.total).toBe(7)
  })

  it('does not call the database while disabled', () => {
    renderHook(() => useCleaningJobs(DEFAULT_QUERY, 'UTC', false), { wrapper: setup() })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('asks again when the time zone changes', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const wrapper = setup()
    const { result, rerender } = renderHook(
      ({ zone }: { zone: string }) => useCleaningJobs(DEFAULT_QUERY, zone),
      { wrapper, initialProps: { zone: 'UTC' } },
    )
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    rerender({ zone: 'Australia/Sydney' })
    await waitFor(() => {
      expect(rpc).toHaveBeenCalledTimes(2)
    })
  })
})

describe('useCompleteAddress', () => {
  it('calls get_complete_address_for_property_id', async () => {
    rpc.mockResolvedValue({ data: '1 Test St', error: null })
    const { result } = renderHook(() => useCompleteAddress('p1'), { wrapper: setup() })
    await waitFor(() => {
      expect(result.current.data).toBe('1 Test St')
    })
    expect(rpc).toHaveBeenCalledWith('get_complete_address_for_property_id', {
      p_property_id: 'p1',
    })
  })

  it('does nothing without a property id', () => {
    renderHook(() => useCompleteAddress(undefined), { wrapper: setup() })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('shares one cached request between two components', async () => {
    rpc.mockResolvedValue({ data: '1 Test St', error: null })
    const wrapper = setup()
    const first = renderHook(() => useCompleteAddress('p1'), { wrapper })
    await waitFor(() => {
      expect(first.result.current.isSuccess).toBe(true)
    })
    const second = renderHook(() => useCompleteAddress('p1'), { wrapper })
    expect(second.result.current.data).toBe('1 Test St')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('useCleanersForCleaningJob', () => {
  it('calls get_cleaners_for_cleaning_job_id', async () => {
    const rows = [{ cleaner_id: 'c1', full_name: 'Zed Adams' }]
    rpc.mockResolvedValue({ data: rows, error: null })
    const { result } = renderHook(() => useCleanersForCleaningJob('j1'), { wrapper: setup() })
    await waitFor(() => {
      expect(result.current.data).toEqual(rows)
    })
    expect(rpc).toHaveBeenCalledWith('get_cleaners_for_cleaning_job_id', {
      p_cleaning_job_id: 'j1',
    })
  })

  it('does nothing without a job id', () => {
    renderHook(() => useCleanersForCleaningJob(undefined), { wrapper: setup() })
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('useClientFeedbacks', () => {
  it('calls get_client_feedbacks_for_cleaning_job_id', async () => {
    const rows = [
      { id: 'f1', rating: 5, feedback: 'Great', created_at: '2026-12-05T10:00:00+00:00' },
    ]
    rpc.mockResolvedValue({ data: rows, error: null })
    const { result } = renderHook(() => useClientFeedbacks('j1'), { wrapper: setup() })
    await waitFor(() => {
      expect(result.current.data).toEqual(rows)
    })
    expect(rpc).toHaveBeenCalledWith('get_client_feedbacks_for_cleaning_job_id', {
      p_cleaning_job_id: 'j1',
    })
  })

  it('does nothing without a job id and reports an error from the database', async () => {
    renderHook(() => useClientFeedbacks(undefined), { wrapper: setup() })
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValue({ data: null, error: { message: 'denied' } })
    const { result } = renderHook(() => useClientFeedbacks('j1'), { wrapper: setup() })
    await waitFor(() => {
      expect(result.current.error?.message).toBe('denied')
    })
  })
})
