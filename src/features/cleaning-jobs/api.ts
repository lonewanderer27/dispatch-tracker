// Data access for the Cleaning Jobs list. Takes the client as an argument so tests can pass a mock.
import type { AppSupabaseClient } from '@/shared/supabase'
import type { CleaningJobListRow, ClientFeedback, JobCleaner } from '@/types/db'

export type CleaningJobSortKey = 'schedule' | 'client' | 'cleaning_type' | 'rating'
type SortDirection = 'asc' | 'desc'
export type DateRangeKey =
  | 'all'
  | 'next_month'
  | 'current_week'
  | 'current_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'custom'

export const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  all: 'All dates',
  next_month: 'Next month',
  current_week: 'Current week',
  current_month: 'Current month',
  last_3_months: 'Last 3 months',
  last_6_months: 'Last 6 months',
  custom: 'Custom range',
}

export interface CleaningJobFilters {
  cleanerIds: string[]
  companyIds: string[]
  clientIds: string[]
  cleaningTypeIds: string[]
  feedbackSearch: string
  ratings: number[]
  dateRange: DateRangeKey
  /** Custom range only. Calendar days as YYYY-MM-DD, read in the user's time zone. */
  dateFrom: string | null
  dateTo: string | null
}

export interface CleaningJobQuery {
  filters: CleaningJobFilters
  sortBy: CleaningJobSortKey
  sortDir: SortDirection
  page: number
  pageSize: number
}

export const EMPTY_FILTERS: CleaningJobFilters = {
  cleanerIds: [],
  companyIds: [],
  clientIds: [],
  cleaningTypeIds: [],
  feedbackSearch: '',
  ratings: [],
  dateRange: 'all',
  dateFrom: null,
  dateTo: null,
}

export const DEFAULT_QUERY: CleaningJobQuery = {
  filters: EMPTY_FILTERS,
  sortBy: 'schedule',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
}

/** True when any filter is set. A feedback search of only spaces does not count. */
export function hasActiveFilters(filters: CleaningJobFilters): boolean {
  return (
    filters.cleanerIds.length > 0 ||
    filters.companyIds.length > 0 ||
    filters.clientIds.length > 0 ||
    filters.cleaningTypeIds.length > 0 ||
    filters.feedbackSearch.trim() !== '' ||
    filters.ratings.length > 0 ||
    filters.dateRange !== 'all'
  )
}

interface CleaningJobPage {
  rows: CleaningJobListRow[]
  total: number
}

/**
 * Calls get_cleaning_jobs: one page of jobs, filtered and sorted in the database. The time zone is
 * the one the user sees dates in, so "current week" and custom days match the Scheduled Date column.
 */
export async function fetchCleaningJobs(
  client: AppSupabaseClient,
  query: CleaningJobQuery,
  timeZone: string,
): Promise<CleaningJobPage> {
  const { filters } = query
  const { data, error } = await client.rpc('get_cleaning_jobs', {
    p_cleaner_ids: filters.cleanerIds.length > 0 ? filters.cleanerIds : undefined,
    p_company_ids: filters.companyIds.length > 0 ? filters.companyIds : undefined,
    p_client_ids: filters.clientIds.length > 0 ? filters.clientIds : undefined,
    p_cleaning_type_ids: filters.cleaningTypeIds.length > 0 ? filters.cleaningTypeIds : undefined,
    p_feedback_search: filters.feedbackSearch.trim() === '' ? undefined : filters.feedbackSearch,
    p_ratings: filters.ratings.length > 0 ? filters.ratings : undefined,
    p_date_range: filters.dateRange === 'all' ? undefined : filters.dateRange,
    p_date_from: filters.dateRange === 'custom' ? (filters.dateFrom ?? undefined) : undefined,
    p_date_to: filters.dateRange === 'custom' ? (filters.dateTo ?? undefined) : undefined,
    p_time_zone: timeZone,
    p_sort_by: query.sortBy,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })
  if (error) throw new Error(error.message)
  const rows = data as unknown as CleaningJobListRow[]
  return { rows, total: rows[0]?.total_count ?? 0 }
}

/** Calls get_complete_address_for_property_id. Null when the property is missing or not visible. */
export async function fetchCompleteAddress(
  client: AppSupabaseClient,
  propertyId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc('get_complete_address_for_property_id', {
    p_property_id: propertyId,
  })
  if (error) throw new Error(error.message)
  return data
}

/** Calls get_cleaners_for_cleaning_job_id. Empty array when nobody is assigned. */
export async function fetchCleanersForCleaningJob(
  client: AppSupabaseClient,
  cleaningJobId: string,
): Promise<JobCleaner[]> {
  const { data, error } = await client.rpc('get_cleaners_for_cleaning_job_id', {
    p_cleaning_job_id: cleaningJobId,
  })
  if (error) throw new Error(error.message)
  return data
}

/** Calls get_client_feedbacks_for_cleaning_job_id. Newest first; empty array when none. */
export async function fetchClientFeedbacks(
  client: AppSupabaseClient,
  cleaningJobId: string,
): Promise<ClientFeedback[]> {
  const { data, error } = await client.rpc('get_client_feedbacks_for_cleaning_job_id', {
    p_cleaning_job_id: cleaningJobId,
  })
  if (error) throw new Error(error.message)
  return data
}
