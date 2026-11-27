import type { CleanerWithCompanies } from '@/types/db'

// Filter value for cleaners who work for no company at all. Company ids are uuids, so this cannot
// collide with one.
export const NO_COMPANY = 'none'

// An empty selection shows every cleaner. Otherwise a cleaner matches when they work for any
// selected company, or when NO_COMPANY is selected and they have no company links.
export function matchesCompanyFilter(cleaner: CleanerWithCompanies, selected: string[]): boolean {
  if (selected.length === 0) return true
  const companyIds = cleaner.company_cleaners.map((link) => link.company_id)
  if (companyIds.length === 0) return selected.includes(NO_COMPANY)
  return companyIds.some((id) => selected.includes(id))
}
