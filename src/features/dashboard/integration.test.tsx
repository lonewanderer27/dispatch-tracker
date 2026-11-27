import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import { EdgeFunctionCard } from '@/features/dashboard/components/EdgeFunctionCard'
import { RpcCard } from '@/features/dashboard/components/RpcCard'
import { fetchTodoStats } from '@/features/dashboard/api'
import type { AppSupabaseClient } from '@/shared/supabase'

const invoke = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const rpc = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock('@/shared/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}))

function wrap(ui: ReactNode) {
  return <ConfigProvider>{ui}</ConfigProvider>
}

describe('fetchTodoStats', () => {
  it('returns the first row from the RPC', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ total: 3, done: 1, pending: 2, pct_done: 33.3 }],
        error: null,
      }),
    }
    const stats = await fetchTodoStats(client as unknown as AppSupabaseClient)
    expect(stats).toEqual({ total: 3, done: 1, pending: 2, pct_done: 33.3 })
    expect(client.rpc).toHaveBeenCalledWith('todo_stats')
  })

  it('returns zeros when the caller has no todos', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }
    expect(await fetchTodoStats(client as unknown as AppSupabaseClient)).toEqual({
      total: 0,
      done: 0,
      pending: 0,
      pct_done: 0,
    })
  })
})

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

describe('RpcCard', () => {
  it('renders the pct_done progress as 33.3%', async () => {
    rpc.mockResolvedValue({
      data: [{ total: 3, done: 1, pending: 2, pct_done: 33.3 }],
      error: null,
    })
    render(wrap(<RpcCard />))
    await userEvent.click(screen.getByTestId('btn-call-rpc'))
    await waitFor(() => {
      expect(screen.getByTestId('result-rpc')).toHaveTextContent('33.3%')
    })
    const result = screen.getByTestId('result-rpc')
    expect(result).toHaveTextContent('Total')
    expect(result).toHaveTextContent('Pending')
  })

  it('shows an error alert when the RPC fails', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for function todo_stats' },
    })
    render(wrap(<RpcCard />))
    await userEvent.click(screen.getByTestId('btn-call-rpc'))
    await waitFor(() => {
      expect(screen.getByTestId('result-rpc')).toHaveTextContent('permission denied')
    })
  })
})
