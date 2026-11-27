import { describe, expect, it } from 'vitest'
import { matchesCompanyFilter, NO_COMPANY } from '@/pages/company-cleaners/companyFilter'
import type { CleanerWithCompanies } from '@/types/db'

const TIDY = 'a0000000-0000-0000-0000-000000000001'
const HOME = 'a0000000-0000-0000-0000-000000000002'

function cleaner(companyIds: string[]): CleanerWithCompanies {
  return {
    id: 'c1',
    first_name: 'Test',
    middle_name: null,
    last_name: 'Cleaner',
    company_cleaners: companyIds.map((company_id, i) => ({
      id: `link-${String(i)}`,
      cleaner_id: 'c1',
      company_id,
      companies: null,
    })),
  }
}

describe('matchesCompanyFilter', () => {
  it('shows every cleaner when nothing is selected', () => {
    expect(matchesCompanyFilter(cleaner([]), [])).toBe(true)
    expect(matchesCompanyFilter(cleaner([TIDY]), [])).toBe(true)
  })

  it('matches a cleaner who works for the one selected company', () => {
    expect(matchesCompanyFilter(cleaner([TIDY, HOME]), [TIDY])).toBe(true)
    expect(matchesCompanyFilter(cleaner([HOME]), [TIDY])).toBe(false)
  })

  it('matches a cleaner who works for any of two selected companies', () => {
    expect(matchesCompanyFilter(cleaner([HOME]), [TIDY, HOME])).toBe(true)
    expect(matchesCompanyFilter(cleaner([]), [TIDY, HOME])).toBe(false)
  })

  it('matches only cleaners with no company when NO_COMPANY is selected', () => {
    expect(matchesCompanyFilter(cleaner([]), [NO_COMPANY])).toBe(true)
    expect(matchesCompanyFilter(cleaner([TIDY]), [NO_COMPANY])).toBe(false)
  })

  it('combines NO_COMPANY with a company', () => {
    expect(matchesCompanyFilter(cleaner([]), [NO_COMPANY, TIDY])).toBe(true)
    expect(matchesCompanyFilter(cleaner([HOME]), [NO_COMPANY, TIDY])).toBe(false)
  })
})
