import type { FeatureModule } from '@/shared/featureModule'
import { areasFeature } from '@/features/areas/routes'
import { cleanersFeature } from '@/features/cleaners/routes'
import { cleaningJobsFeature } from '@/features/cleaning-jobs/routes'
import { cleaningStatusesFeature } from '@/features/cleaning-statuses/routes'
import { cleaningTypesFeature } from '@/features/cleaning-types/routes'
import { clientsFeature } from '@/features/clients/routes'
import { companiesFeature } from '@/features/companies/routes'
import { companyCleanersFeature } from '@/features/company-cleaners/routes'
import { contactsFeature } from '@/features/contacts/routes'
import { dashboardFeature } from '@/features/dashboard/routes'
import { itemsFeature } from '@/features/items/routes'
import { todosFeature } from '@/features/todos/routes'
import { usersFeature } from '@/features/users/routes'

// Every feature the app mounts. The sidebar shows them in this order.
export const features: FeatureModule[] = [
  dashboardFeature,
  todosFeature,
  usersFeature,
  companiesFeature,
  clientsFeature,
  contactsFeature,
  cleanersFeature,
  companyCleanersFeature,
  cleaningTypesFeature,
  cleaningStatusesFeature,
  areasFeature,
  itemsFeature,
  cleaningJobsFeature,
]
