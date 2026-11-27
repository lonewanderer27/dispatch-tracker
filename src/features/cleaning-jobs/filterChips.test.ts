import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS } from '@/features/cleaning-jobs/api'
import {
  buildFilterChips,
  countPanelFilters,
  ratingLabel,
  type FilterLookups,
} from '@/features/cleaning-jobs/filterChips'

const LOOKUPS: FilterLookups = {
  cleaners: new Map([['cl-1', 'Ana Cruz']]),
  companies: new Map([['co-1', 'Acme']]),
  clients: new Map([
    ['c-1', 'Xavier'],
    ['c-2', 'Yara'],
  ]),
  cleaningTypes: new Map([['t-1', 'Deep clean']]),
}

describe('buildFilterChips', () => {
  it('returns no chips for empty filters', () => {
    expect(buildFilterChips(EMPTY_FILTERS, LOOKUPS)).toEqual([])
  })

  it('labels every active value in page order', () => {
    const chips = buildFilterChips(
      {
        ...EMPTY_FILTERS,
        dateRange: 'last_3_months',
        feedbackSearch: '  late  ',
        cleanerIds: ['cl-1'],
        companyIds: ['co-1'],
        clientIds: ['c-1', 'c-2'],
        cleaningTypeIds: ['t-1'],
        ratings: [4, 1],
      },
      LOOKUPS,
    )
    expect(chips.map((chip) => chip.label)).toEqual([
      'Scheduled: Last 3 months',
      'Feedback: "late"',
      'Cleaner: Ana Cruz',
      'Company: Acme',
      'Client: Xavier',
      'Client: Yara',
      'Cleaning type: Deep clean',
      'Rating: 4 stars',
      'Rating: 1 star',
    ])
    expect(new Set(chips.map((chip) => chip.key)).size).toBe(chips.length)
  })

  it('removes only its own value', () => {
    const filters = { ...EMPTY_FILTERS, clientIds: ['c-1', 'c-2'], ratings: [0, 5] }
    const [xavier, , zero] = buildFilterChips(filters, LOOKUPS)
    expect(xavier?.next).toEqual({ ...filters, clientIds: ['c-2'] })
    expect(zero?.label).toBe('Rating: 0 stars')
    expect(zero?.next).toEqual({ ...filters, ratings: [5] })
  })

  it('shows an unknown id as Unknown', () => {
    const [chip] = buildFilterChips({ ...EMPTY_FILTERS, cleanerIds: ['missing'] }, LOOKUPS)
    expect(chip?.label).toBe('Cleaner: Unknown')
  })

  it('describes a custom range and resets it to all dates', () => {
    const base = { ...EMPTY_FILTERS, dateRange: 'custom' as const }
    const label = (dateFrom: string | null, dateTo: string | null) =>
      buildFilterChips({ ...base, dateFrom, dateTo }, LOOKUPS)[0]?.label
    expect(label('2026-01-01', '2026-01-31')).toBe('Scheduled: 2026-01-01 to 2026-01-31')
    expect(label('2026-01-01', null)).toBe('Scheduled: from 2026-01-01')
    expect(label(null, '2026-01-31')).toBe('Scheduled: until 2026-01-31')
    expect(label(null, null)).toBe('Scheduled: Custom range')
    const [chip] = buildFilterChips({ ...base, dateFrom: '2026-01-01', dateTo: null }, LOOKUPS)
    expect(chip?.next).toEqual(EMPTY_FILTERS)
  })

  it('ignores a blank feedback search', () => {
    expect(buildFilterChips({ ...EMPTY_FILTERS, feedbackSearch: '   ' }, LOOKUPS)).toEqual([])
  })
})

describe('countPanelFilters', () => {
  it('counts filters, not values, and skips date and feedback', () => {
    expect(countPanelFilters(EMPTY_FILTERS)).toBe(0)
    expect(
      countPanelFilters({
        ...EMPTY_FILTERS,
        clientIds: ['c-1', 'c-2'],
        ratings: [3],
        dateRange: 'current_week',
        feedbackSearch: 'late',
      }),
    ).toBe(2)
  })
})

describe('ratingLabel', () => {
  it('uses the singular only for one', () => {
    expect([0, 1, 2].map(ratingLabel)).toEqual(['0 stars', '1 star', '2 stars'])
  })
})
