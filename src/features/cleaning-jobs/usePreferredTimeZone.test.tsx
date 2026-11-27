import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePreferredTimeZone } from '@/features/cleaning-jobs/usePreferredTimeZone'

const useGetIdentity = vi.fn()
const useOne = vi.fn()
const useUpdate = vi.fn()
const mutate = vi.fn()

vi.mock('@refinedev/core', () => ({
  useGetIdentity: () => useGetIdentity() as unknown,
  useOne: (options: unknown) => useOne(options) as unknown,
  useUpdate: () => useUpdate() as unknown,
}))

beforeEach(() => {
  useGetIdentity.mockReturnValue({ data: { id: 'u1' } })
  useOne.mockReturnValue({ result: { preferred_time_zone: 'Australia/Sydney' } })
  useUpdate.mockReturnValue({ mutate, mutation: { isPending: false } })
})

describe('usePreferredTimeZone', () => {
  it('returns the saved zone once the profile has loaded', () => {
    const { result } = renderHook(() => usePreferredTimeZone())
    expect(result.current.timeZone).toBe('Australia/Sydney')
    expect(result.current.isLoaded).toBe(true)
    expect(useOne).toHaveBeenCalledWith(expect.objectContaining({ resource: 'profiles', id: 'u1' }))
  })

  it('falls back to Edmonton and reports not loaded before the profile arrives', () => {
    useOne.mockReturnValue({ result: undefined })
    const { result } = renderHook(() => usePreferredTimeZone())
    expect(result.current.timeZone).toBe('America/Edmonton')
    expect(result.current.isLoaded).toBe(false)
  })

  it('saves the new zone on the signed-in user profile', () => {
    const { result } = renderHook(() => usePreferredTimeZone())
    result.current.save('UTC')
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'profiles',
        id: 'u1',
        values: { preferred_time_zone: 'UTC' },
      }),
    )
  })

  it('does not save before the user is known', () => {
    useGetIdentity.mockReturnValue({ data: undefined })
    const { result } = renderHook(() => usePreferredTimeZone())
    result.current.save('UTC')
    expect(mutate).not.toHaveBeenCalled()
  })

  it('reports saving while the update is running', () => {
    useUpdate.mockReturnValue({ mutate, mutation: { isPending: true } })
    const { result } = renderHook(() => usePreferredTimeZone())
    expect(result.current.isSaving).toBe(true)
  })
})
