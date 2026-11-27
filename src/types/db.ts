import type { Database } from './database.types'

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

export type Todo = Tables<'todos'>
export type Company = Tables<'companies'>
export type Profile = Tables<'profiles'>
export type UserRow = Profile & { roles: { name: string } | null }
export type TodoStats = PublicSchema['Functions']['todo_stats']['Returns'][number]
