import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanyCleanerCreate } from '@/features/company-cleaners/pages/CompanyCleanerCreate'

const createLinks = vi.fn()
const navigate = vi.fn()
const useSelect = vi.fn()

vi.mock('@refinedev/antd', () => ({
  Create: ({
    children,
    saveButtonProps,
  }: {
    children: ReactNode
    saveButtonProps: { onClick: () => void }
  }) => (
    <div>
      {children}
      <button onClick={saveButtonProps.onClick}>Save</button>
    </div>
  ),
  useSelect: (options: { resource: string }) => useSelect(options) as unknown,
}))
vi.mock('@refinedev/core', () => ({
  useCreateMany: () => ({ mutate: createLinks, mutation: { isPending: false } }),
}))
vi.mock('react-router', () => ({ useNavigate: () => navigate }))

const options = {
  cleaners: [{ label: 'Tina Moran', value: 'k1' }],
  companies: [
    { label: 'The Tidy Team', value: 'co1' },
    { label: 'Total Home Care', value: 'co2' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  useSelect.mockImplementation((args: { resource: 'cleaners' | 'companies' }) => ({
    selectProps: { options: options[args.resource] },
  }))
})

describe('CompanyCleanerCreate', () => {
  it('searches cleaners by first, middle or last name', () => {
    render(<CompanyCleanerCreate />)
    const cleanerArgs = useSelect.mock.calls
      .map(([args]) => args as { resource: string; onSearch?: (value: string) => unknown })
      .find((args) => args.resource === 'cleaners')
    expect(cleanerArgs?.onSearch?.('')).toEqual([])
    expect(cleanerArgs?.onSearch?.('Moran')).toEqual([
      {
        operator: 'or',
        value: [
          { field: 'first_name', operator: 'contains', value: 'Moran' },
          { field: 'middle_name', operator: 'contains', value: 'Moran' },
          { field: 'last_name', operator: 'contains', value: 'Moran' },
        ],
      },
    ])
  })

  it('saves one link per chosen company in a single request, then returns to the list', async () => {
    render(<CompanyCleanerCreate />)

    await userEvent.click(screen.getByLabelText('Cleaner'))
    await userEvent.click(await screen.findByTitle('Tina Moran'))
    await userEvent.click(screen.getByLabelText('Companies'))
    await userEvent.click(await screen.findByTitle('The Tidy Team'))
    await userEvent.click(await screen.findByTitle('Total Home Care'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(createLinks).toHaveBeenCalledTimes(1)
    })
    const [request, callbacks] = createLinks.mock.calls[0] as [unknown, { onSuccess: () => void }]
    expect(request).toEqual({
      resource: 'company_cleaners',
      values: [
        { cleaner_id: 'k1', company_id: 'co1' },
        { cleaner_id: 'k1', company_id: 'co2' },
      ],
    })
    callbacks.onSuccess()
    expect(navigate).toHaveBeenCalledWith('/company-cleaners')
  })

  it('does not save until a company is chosen', async () => {
    render(<CompanyCleanerCreate />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Choose at least one company')).toBeInTheDocument()
    expect(createLinks).not.toHaveBeenCalled()
  })
})
