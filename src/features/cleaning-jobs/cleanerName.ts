/**
 * The first name out of a cleaner's full name ("first middle last", as the database function builds
 * it). A one word name is returned as it is.
 */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}
