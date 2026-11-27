import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import { EdgeFunctionCard } from '@/features/dashboard/components/EdgeFunctionCard'

const invoke = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock('@/shared/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}))

function wrap(ui: ReactNode) {
  return <ConfigProvider>{ui}</ConfigProvider>
}

describe('EdgeFunctionCard', () => {
  it('shows loading, then the rate on success', async () => {
    let resolve: (v: unknown) => void = () => {
      /* replaced below */
    }
    invoke.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    render(wrap(<EdgeFunctionCard />))

    await userEvent.click(screen.getByTestId('btn-invoke-edge'))
    expect(screen.getByTestId('btn-invoke-edge')).toHaveClass('ant-btn-loading')

    resolve({
      data: {
        base: 'USD',
        symbol: 'EUR',
        rate: 0.92,
        date: '2026-11-24',
        fetchedAt: 'x',
        source: 'frankfurter',
      },
      error: null,
    })
    await waitFor(() => {
      expect(screen.getByTestId('result-edge')).toHaveTextContent('0.92')
    })
    expect(within(screen.getByTestId('result-edge')).getByText(/ms$/)).toBeInTheDocument()
    expect(invoke).toHaveBeenCalledWith('exchange-rate', { body: { base: 'USD', symbol: 'EUR' } })
  })

  it('shows an error alert when the function fails', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new Error('Edge Function returned a non-2xx status code'),
    })
    render(wrap(<EdgeFunctionCard />))
    await userEvent.click(screen.getByTestId('btn-invoke-edge'))
    await waitFor(() => {
      expect(screen.getByTestId('result-edge')).toHaveTextContent('non-2xx status code')
    })
  })
})
