import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { BrandTitle } from '@/shared/brand/BrandTitle'

function renderTitle(collapsed: boolean) {
  return render(
    <MemoryRouter>
      <BrandTitle collapsed={collapsed} />
    </MemoryRouter>,
  )
}

describe('BrandTitle', () => {
  it('shows the sparkle and the name, linking to the dashboard', () => {
    renderTitle(false)
    const link = screen.getByRole('link', { name: 'The Tidy Team' })
    expect(link).toHaveAttribute('href', '/')
    expect(link).toHaveTextContent('The Tidy Team')
  })

  it('hides the name but keeps the accessible name when the sidebar is collapsed', () => {
    renderTitle(true)
    const link = screen.getByRole('link', { name: 'The Tidy Team' })
    expect(link).not.toHaveTextContent('The Tidy Team')
  })
})
