// Same default as profiles.preferred_time_zone (supabase/migrations/0027_profiles_preferred_time_zone.sql).
export const DEFAULT_TIME_ZONE = 'America/Edmonton'

/** The time zone of the browser the user is on, as an IANA name. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Every IANA time zone the browser knows, plus UTC, sorted. */
export function listTimeZones(): string[] {
  return [...new Set([...Intl.supportedValuesOf('timeZone'), 'UTC'])].sort()
}

/** Formats a timestamptz string (any offset) as a wall-clock time in the given IANA zone. */
export function formatSchedule(schedule: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(schedule))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''
  return `${part('weekday')} ${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')} ${part('dayPeriod')}`
}
