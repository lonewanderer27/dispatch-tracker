import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIME_ZONE,
  deviceTimeZone,
  formatSchedule,
  listTimeZones,
} from '@/features/cleaning-jobs/timeZone'

describe('formatSchedule', () => {
  it('shows the same instant in New York winter time (UTC-5)', () => {
    expect(formatSchedule('2026-12-01T09:00:00+00:00', 'America/New_York')).toBe(
      'Tue 1 Dec 2026, 4:00 AM',
    )
  })

  it('shows the same instant in New York summer time (UTC-4)', () => {
    expect(formatSchedule('2026-07-01T09:00:00+00:00', 'America/New_York')).toBe(
      'Wed 1 Jul 2026, 5:00 AM',
    )
  })

  it('shows the same instant in another zone', () => {
    expect(formatSchedule('2026-12-01T09:00:00+00:00', 'Australia/Sydney')).toBe(
      'Tue 1 Dec 2026, 8:00 PM',
    )
  })

  it('reads an offset in the input', () => {
    expect(formatSchedule('2026-12-01T02:00:00-07:00', 'UTC')).toBe('Tue 1 Dec 2026, 9:00 AM')
  })
})

describe('time zone lists', () => {
  it('defaults to Edmonton', () => {
    expect(DEFAULT_TIME_ZONE).toBe('America/Edmonton')
  })

  it('lists IANA names including the default and UTC', () => {
    const zones = listTimeZones()
    expect(zones).toContain('America/Edmonton')
    expect(zones).toContain('UTC')
  })

  it('reports a device zone', () => {
    expect(deviceTimeZone()).not.toBe('')
  })
})
