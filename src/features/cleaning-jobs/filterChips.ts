// Turns the Cleaning Jobs filters into removable chips ("Client: Xavier"). Pure, so it is easy to test.
import { DATE_RANGE_LABELS, type CleaningJobFilters } from '@/features/cleaning-jobs/api'

interface FilterChip {
  /** Stable React key, unique within one list of chips. */
  key: string
  label: string
  /** The filters after this chip is removed. */
  next: CleaningJobFilters
}

/** Id to display name, one map per option list. A missing id shows as "Unknown". */
export interface FilterLookups {
  cleaners: ReadonlyMap<string, string>
  companies: ReadonlyMap<string, string>
  clients: ReadonlyMap<string, string>
  cleaningTypes: ReadonlyMap<string, string>
}

type IdFilterKey = 'cleanerIds' | 'companyIds' | 'clientIds' | 'cleaningTypeIds'

const ID_FILTERS: { field: IdFilterKey; title: string; lookup: keyof FilterLookups }[] = [
  { field: 'cleanerIds', title: 'Cleaner', lookup: 'cleaners' },
  { field: 'companyIds', title: 'Company', lookup: 'companies' },
  { field: 'clientIds', title: 'Client', lookup: 'clients' },
  { field: 'cleaningTypeIds', title: 'Cleaning type', lookup: 'cleaningTypes' },
]

/** "1 star", "2 stars"; also used for the Rating filter options. */
export function ratingLabel(rating: number): string {
  return rating === 1 ? '1 star' : `${String(rating)} stars`
}

function dateRangeLabel(filters: CleaningJobFilters): string {
  if (filters.dateRange !== 'custom') return DATE_RANGE_LABELS[filters.dateRange]
  const { dateFrom, dateTo } = filters
  if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`
  if (dateFrom) return `from ${dateFrom}`
  if (dateTo) return `until ${dateTo}`
  return DATE_RANGE_LABELS.custom
}

/** One chip per active value, in the order the filters appear on the page. */
export function buildFilterChips(
  filters: CleaningJobFilters,
  lookups: FilterLookups,
): FilterChip[] {
  const chips: FilterChip[] = []
  if (filters.dateRange !== 'all') {
    chips.push({
      key: 'dateRange',
      label: `Scheduled: ${dateRangeLabel(filters)}`,
      next: { ...filters, dateRange: 'all', dateFrom: null, dateTo: null },
    })
  }
  if (filters.feedbackSearch.trim() !== '') {
    chips.push({
      key: 'feedbackSearch',
      label: `Feedback: "${filters.feedbackSearch.trim()}"`,
      next: { ...filters, feedbackSearch: '' },
    })
  }
  for (const { field, title, lookup } of ID_FILTERS) {
    for (const id of filters[field]) {
      chips.push({
        key: `${field}:${id}`,
        label: `${title}: ${lookups[lookup].get(id) ?? 'Unknown'}`,
        next: { ...filters, [field]: filters[field].filter((other) => other !== id) },
      })
    }
  }
  for (const rating of filters.ratings) {
    chips.push({
      key: `ratings:${String(rating)}`,
      label: `Rating: ${ratingLabel(rating)}`,
      next: { ...filters, ratings: filters.ratings.filter((other) => other !== rating) },
    })
  }
  return chips
}

/** How many of the filters behind the "Filters" button are in use (one per filter, not per value). */
export function countPanelFilters(filters: CleaningJobFilters): number {
  return [
    filters.cleanerIds,
    filters.companyIds,
    filters.clientIds,
    filters.cleaningTypeIds,
    filters.ratings,
  ].filter((values) => values.length > 0).length
}
