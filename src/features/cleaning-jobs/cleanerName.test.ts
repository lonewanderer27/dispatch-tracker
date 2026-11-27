import { describe, expect, it } from 'vitest'
import { firstName } from '@/features/cleaning-jobs/cleanerName'

describe('firstName', () => {
  it('takes the first word of a full name', () => {
    expect(firstName('Zed Adams')).toBe('Zed')
    expect(firstName('Amy Lee Brown')).toBe('Amy')
  })

  it('keeps a one word name and ignores extra spaces', () => {
    expect(firstName('Madonna')).toBe('Madonna')
    expect(firstName('  Zed   Adams ')).toBe('Zed')
  })
})
