import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ClientList } from '@/pages/clients/ClientList'
import type { ClientRow } from '@/types/db'

const useTable = vi.fn()

vi.mock('@refinedev/antd', () => ({
  List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  EditButton: () => <button type="button">edit</button>,
  DeleteButton: () => <button type="button">delete</button>,
  useTable: (options: unknown) => useTable(options) as unknown,
}))

const rows: ClientRow[] = [
  {
    id: 'c1',
    name: 'Xavier Ashby',
    company_id: 'co1',
    companies: { name: 'The Tidy Team', color_motif: 'red' },
  },
  {
    id: 'c2',
    name: 'Yara Bexley',
    company_id: 'co2',
    companies: { name: 'Total Home Care', color_motif: 'cyan' },
  },
]

describe('ClientList', () => {
  it('asks for the company name and colour with each client', () => {
    useTable.mockReturnValue({ tableProps: { dataSource: rows, pagination: false } })
    render(<ClientList />)
    expect(useTable).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { select: '*, companies(name, color_motif)' } }),
    )
  })

  it('shows each client company as a pill in the company colour', () => {
    useTable.mockReturnValue({ tableProps: { dataSource: rows, pagination: false } })
    render(<ClientList />)
    const first = screen.getByRole('row', { name: /Xavier Ashby/ })
    expect(within(first).getByText('The Tidy Team')).toHaveClass('ant-tag-red')
    const second = screen.getByRole('row', { name: /Yara Bexley/ })
    expect(within(second).getByText('Total Home Care')).toHaveClass('ant-tag-cyan')
  })
})
