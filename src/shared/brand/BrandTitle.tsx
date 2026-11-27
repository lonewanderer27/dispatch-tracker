import { Link } from 'react-router'
import { Sparkle } from '@/shared/brand/Sparkle'

const BRAND_NAME = 'The Tidy Team'

// Sidebar and auth-page title. The name is typed in sentence case; CSS (`.brand-title`) uppercases it.
// When the sidebar is collapsed only the sparkle shows, so the link carries an aria-label.
export function BrandTitle({ collapsed }: { collapsed: boolean }) {
  return (
    <Link to="/" className="brand-title" aria-label={BRAND_NAME}>
      <Sparkle />
      {collapsed ? null : <span>{BRAND_NAME}</span>}
    </Link>
  )
}
