import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CompanyTag } from '@/shared/company/CompanyTag'

describe('CompanyTag', () => {
  it('shows the company name in the company colour', () => {
    render(<CompanyTag company={{ name: 'The Tidy Team', color_motif: 'red' }} />)
    expect(screen.getByText('The Tidy Team')).toHaveClass('ant-tag', 'ant-tag-red')
  })

  it('shows a company without a colour as the grey default', () => {
    render(<CompanyTag company={{ name: 'Plain Co' }} />)
    expect(screen.getByText('Plain Co')).toHaveClass('ant-tag-default')
  })

  it('shows a missing company as an Unknown grey pill', () => {
    render(<CompanyTag company={null} />)
    expect(screen.getByText('Unknown')).toHaveClass('ant-tag-default')
  })

  it('can be removed when it is closable', async () => {
    const onClose = vi.fn()
    render(
      <CompanyTag
        company={{ name: 'The Tidy Team', color_motif: 'red' }}
        closable
        onClose={onClose}
      />,
    )
    await userEvent.click(screen.getByRole('img', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
