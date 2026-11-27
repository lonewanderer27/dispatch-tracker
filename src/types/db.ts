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
export type CleanerWithCompanies = Cleaner & { company_cleaners: CleanerCompanyLink[] }
export type TodoStats = PublicSchema['Functions']['todo_stats']['Returns'][number]
