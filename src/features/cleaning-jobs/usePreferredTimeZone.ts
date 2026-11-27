import { useGetIdentity, useOne, useUpdate } from '@refinedev/core'
import { DEFAULT_TIME_ZONE } from '@/features/cleaning-jobs/timeZone'
import type { Profile } from '@/types/db'

/** Reads and saves profiles.preferred_time_zone for the signed-in user. */
export function usePreferredTimeZone() {
  const { data: identity } = useGetIdentity<{ id: string }>()
  const userId = identity?.id
  const { result: profile } = useOne<Profile>({
    resource: 'profiles',
    id: userId,
    queryOptions: { enabled: userId !== undefined },
  })
  const { mutate, mutation } = useUpdate<Profile>()

  return {
    /** False until the saved zone has loaded, so the list does not fetch twice. */
    isLoaded: profile !== undefined,
    timeZone: profile?.preferred_time_zone ?? DEFAULT_TIME_ZONE,
    isSaving: mutation.isPending,
    save: (timeZone: string) => {
      if (userId === undefined) return
      mutate({
        resource: 'profiles',
        id: userId,
        values: { preferred_time_zone: timeZone },
        successNotification: { type: 'success', message: `Time zone set to ${timeZone}` },
      })
    },
  }
}
