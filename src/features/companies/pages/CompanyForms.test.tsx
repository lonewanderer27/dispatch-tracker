import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CompanyCreate } from '@/features/companies/pages/CompanyCreate'
import { CompanyEdit } from '@/features/companies/pages/CompanyEdit'

const onFinish = vi.fn()
const loaded = vi.hoisted((): { values: Record<string, unknown> } => ({ values: {} }))

// Refine's useForm, reduced to a real antd form: Save submits it and onFinish receives the values
// Refine would send. For the Edit page the loaded record is the form's initial values.
vi.mock('@refinedev/antd', () => {
  function useForm() {
    const [form] = Form.useForm()
    return {
      formProps: { form, onFinish, initialValues: loaded.values },
      saveButtonProps: {
        onClick: () => {
          form.submit()
        },
      },
      query: { isLoading: false },
    }
  }
  function Page({ children, saveButtonProps }: { children: ReactNode; saveButtonProps: object }) {
    return (
      <div>
        {children}
        <button type="button" {...saveButtonProps}>
          Save
        </button>
      </div>
    )
  }
  return { useForm, Create: Page, Edit: Page }
})

function dropdown() {
  const element = document.querySelector<HTMLElement>(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
  )
  if (!element) throw new Error('the dropdown is not open')
  return element
}

describe('CompanyCreate', () => {
  it('sends the grey default colour when none is picked', async () => {
    loaded.values = {}
    render(<CompanyCreate />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Sparkle Co')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'Sparkle Co', color_motif: 'default' })
    })
  })

  it('sends the picked colour', async () => {
    loaded.values = {}
    render(<CompanyCreate />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Sparkle Co')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    await userEvent.click(within(dropdown()).getByText('Lime'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'Sparkle Co', color_motif: 'lime' })
    })
  })
})

describe('CompanyEdit', () => {
  it('shows the stored colour and sends the new one', async () => {
    loaded.values = { name: 'The Tidy Team', color_motif: 'geekblue' }
    render(<CompanyEdit />)
    expect(screen.getByText('Geek blue')).toHaveClass('ant-tag-geekblue')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    await userEvent.click(within(dropdown()).getByText('Red'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'The Tidy Team', color_motif: 'red' })
    })
  })
})
