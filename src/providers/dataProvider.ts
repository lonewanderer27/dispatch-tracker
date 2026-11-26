import { dataProvider, liveProvider } from '@refinedev/supabase'
import { supabase } from '@/lib/supabase'

// @refinedev/supabase is loosely typed (SupabaseClient<any, any, any>).
// Cast once here at the provider boundary so the rest of the app stays typed.
type RefineSupabaseClient = Parameters<typeof dataProvider>[0]
const client = supabase as unknown as RefineSupabaseClient

export const refineDataProvider = dataProvider(client)
export const refineLiveProvider = liveProvider(client)
