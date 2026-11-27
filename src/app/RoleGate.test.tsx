import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const identity = vi.hoisted(() => {
  const value: { data: unknown; isLoading: boolean } = { data: undefined, isLoading: false }
  return { value }
})

vi.mock('@refinedev/core', () => ({
  useGetIdentity: () => identity.value,
  useLogout: () => ({ mutate: vi.fn() }),
}))
vi.mock('react-router', () => ({ Outlet: () => 'page content' }))

const { RoleOutlet } = await import('@/app/RoleGate')

describe('RoleOutlet', () => {
  it('shows the page for a user with a role', () => {
    identity.value = { data: { roleId: '30000000-0000-0000-0000-000000000002' }, isLoading: false }
    render(<RoleOutlet />)
    expect(screen.getByText('page content')).toBeInTheDocument()
  })

  it('shows only the notice for a user with no role', () => {
    identity.value = { data: { roleId: null }, isLoading: false }
    render(<RoleOutlet />)
    expect(screen.getByText('Your account has no access yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByText('page content')).not.toBeInTheDocument()
  })

  it('fails closed when there is no identity', () => {
    identity.value = { data: undefined, isLoading: false }
    render(<RoleOutlet />)
    expect(screen.getByText('Your account has no access yet')).toBeInTheDocument()
  })
})
