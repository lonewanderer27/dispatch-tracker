import type { ResourceProps } from '@refinedev/core'
import type { ReactElement } from 'react'

// What a feature hands to src/app/App.tsx: its sidebar resource and its <Route> tree.
// The app lists every feature once in src/app/features.ts; the sidebar follows that order.
export interface FeatureModule {
  resource: ResourceProps
  routes: ReactElement
}
