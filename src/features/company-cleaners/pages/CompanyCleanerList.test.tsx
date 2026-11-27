import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from 'antd'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanyCleanerList } from '@/features/company-cleaners/pages/CompanyCleanerList'
import type { CleanerWithCompanies } from '@/types/db'

const useTable = vi.fn()
const removeLink = vi.fn()

vi.mock('@refinedev/antd', () => ({
  List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useTable: (options: unknown) => useTable(options) as unknown,
}))
vi.mock('@refinedev/core', () => ({
  useList: () => ({ result: { data: [{ id: 'co1', name: 'The Tidy Team' }] } }),
  useDelete: () => ({ mutate: removeLink }),
}))

const rows: CleanerWithCompanies[] = [
  {
    id: 'k1',
    first_name: 'Zed',
    middle_name: null,
    last_name: 'Adams',
    company_cleaners: [
      {
        id: 'l1',
        cleaner_id: 'k1',
        company_id: 'co1',
        companies: { name: 'The Tidy Team', color_motif: 'red' },
      },
      {
        id: 'l2',
        cleaner_id: 'k1',
        company_id: 'co2',
        companies: { name: 'Total Home Care', color_motif: 'cyan' },
      },
    ],
  },
  { id: 'k2', first_name: 'Amy', middle_name: null, last_name: 'Brown', company_cleaners: [] },
]

beforeEach(() => {
  useTable.mockReturnValue({ tableProps: { dataSource: rows, pagination: false } })
})

describe('CompanyCleanerList', () => {
  it('asks for the company name and colour with each link', () => {
    render(<CompanyCleanerList />)
    expect(useTable).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: { select: '*, company_cleaners(id, company_id, companies(name, color_motif))' },
      }),
    )
  })

  it('shows each company of a cleaner as a pill in its colour', () => {
    render(<CompanyCleanerList />)
    const row = screen.getByRole('row', { name: /Zed Adams/ })
    expect(within(row).getByText('The Tidy Team')).toHaveClass('ant-tag-red')
    expect(within(row).getByText('Total Home Care')).toHaveClass('ant-tag-cyan')
  })

  it('says so when a cleaner works for no company', () => {
    render(<CompanyCleanerList />)
    expect(
      within(screen.getByRole('row', { name: /Amy Brown/ })).getByText('No company'),
    ).toBeInTheDocument()
  })

  it('asks for confirmation before removing a company link, then removes it', async () => {
    // antd's static Modal.confirm does not render under React 19 in jsdom, so check what it is given.
    const confirm = vi.spyOn(Modal, 'confirm').mockReturnValue({
      destroy: vi.fn(),
      update: vi.fn(),
    })
    render(<CompanyCleanerList />)
    const row = screen.getByRole('row', { name: /Zed Adams/ })
    const pill = within(row).getByText('The Tidy Team').closest('.ant-tag')
    expect(pill).not.toBeNull()
    await userEvent.click(within(pill as HTMLElement).getByRole('img', { name: /close/i }))

    expect(removeLink).not.toHaveBeenCalled()
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Remove The Tidy Team from Zed Adams?', okText: 'Remove' }),
    )
    const options = confirm.mock.calls[0]?.[0]
    options?.onOk?.()
    expect(removeLink).toHaveBeenCalledWith({
      resource: 'company_cleaners',
      id: 'l1',
      invalidates: ['all'],
    })
  })
})
