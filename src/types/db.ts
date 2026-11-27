import type { Database } from './database.types'

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

export type Todo = Tables<'todos'>
export type Company = Tables<'companies'>
export type Client = Tables<'clients'>
export type Contact = Tables<'contacts'>
export type ClientRow = Client & { companies: { name: string } | null }
export type ContactRow = Contact & { clients: { name: string } | null }
export type Profile = Tables<'profiles'>
export type UserRow = Profile & { roles: { name: string } | null }
export type Cleaner = Tables<'cleaners'>
export type CompanyCleaner = Tables<'company_cleaners'>
export type CleanerCompanyLink = CompanyCleaner & { companies: { name: string } | null }
export type CleaningType = Tables<'cleaning_types'>
export type CleaningStatus = Tables<'cleaning_statuses'>
export type Area = Tables<'areas'>
export type Item = Tables<'items'>
type PublicFunctions = PublicSchema['Functions']
export type JobCleaner = PublicFunctions['get_cleaners_for_cleaning_job_id']['Returns'][number]
// The generated type says feedback is always text; the column is optional, so it can be null.
export type ClientFeedback = Omit<
  PublicFunctions['get_client_feedbacks_for_cleaning_job_id']['Returns'][number],
  'feedback'
> & { feedback: string | null }
type CleaningJobListReturn = PublicFunctions['get_cleaning_jobs']['Returns'][number]
// The function returns the nested lists as jsonb; these are the shapes it builds.
export type CleaningJobListRow = Omit<
  CleaningJobListReturn,
  'cleaners' | 'cleaning_types' | 'feedbacks' | 'avg_rating'
> & {
  avg_rating: number | null
  cleaners: { cleaner_id: string; full_name: string }[]
  cleaning_types: string[]
  feedbacks: { rating: number; feedback: string | null; created_at: string }[]
}
export type CleanerWithCompanies = Cleaner & { company_cleaners: CleanerCompanyLink[] }
export type TodoStats = PublicSchema['Functions']['todo_stats']['Returns'][number]
