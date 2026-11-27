// One React Query hook per database function. Each hook calls the matching fetcher in api.ts, so
// results are cached by query key and shared by every component that asks for the same thing.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  fetchCleanersForCleaningJob,
  fetchCleaningJobs,
  fetchClientFeedbacks,
  fetchCompleteAddress,
  type CleaningJobQuery,
} from '@/features/cleaning-jobs/api'
import { supabase } from '@/lib/supabase'

/** Cached results stay fresh for 30 seconds, then refresh in the background when used again. */
const STALE_TIME_MS = 30_000

const cleaningJobKeys = {
  all: ['cleaning-jobs'] as const,
  list: (query: CleaningJobQuery, timeZone: string) =>
    [...cleaningJobKeys.all, 'list', query, timeZone] as const,
  address: (propertyId: string | undefined) =>
    [...cleaningJobKeys.all, 'address', propertyId] as const,
  cleaners: (cleaningJobId: string | undefined) =>
    [...cleaningJobKeys.all, 'cleaners', cleaningJobId] as const,
  feedbacks: (cleaningJobId: string | undefined) =>
    [...cleaningJobKeys.all, 'feedbacks', cleaningJobId] as const,
}

/** get_cleaning_jobs. Keeps the previous page on screen while the next one loads. */
export function useCleaningJobs(query: CleaningJobQuery, timeZone: string, enabled = true) {
  return useQuery({
    queryKey: cleaningJobKeys.list(query, timeZone),
    queryFn: () => fetchCleaningJobs(supabase, query, timeZone),
    enabled,
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
  })
}

/** get_complete_address_for_property_id. Does nothing until a property id is given. */
export function useCompleteAddress(propertyId: string | undefined) {
  return useQuery({
    queryKey: cleaningJobKeys.address(propertyId),
    queryFn: () => fetchCompleteAddress(supabase, propertyId ?? ''),
    enabled: propertyId !== undefined,
    staleTime: STALE_TIME_MS,
  })
}

/** get_cleaners_for_cleaning_job_id. Does nothing until a job id is given. */
export function useCleanersForCleaningJob(cleaningJobId: string | undefined) {
  return useQuery({
    queryKey: cleaningJobKeys.cleaners(cleaningJobId),
    queryFn: () => fetchCleanersForCleaningJob(supabase, cleaningJobId ?? ''),
    enabled: cleaningJobId !== undefined,
    staleTime: STALE_TIME_MS,
  })
}

/** get_client_feedbacks_for_cleaning_job_id. Does nothing until a job id is given. */
export function useClientFeedbacks(cleaningJobId: string | undefined) {
  return useQuery({
    queryKey: cleaningJobKeys.feedbacks(cleaningJobId),
    queryFn: () => fetchClientFeedbacks(supabase, cleaningJobId ?? ''),
    enabled: cleaningJobId !== undefined,
    staleTime: STALE_TIME_MS,
  })
}
