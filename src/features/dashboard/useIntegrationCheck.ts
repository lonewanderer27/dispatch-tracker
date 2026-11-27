import { useCallback, useState } from 'react'
import { supabase } from '@/shared/supabase'
import {
  fetchExchangeRate,
  fetchTodoStats,
  type ExchangeRateResult,
} from '@/features/dashboard/api'
import type { TodoStats } from '@/types/db'

export type CheckStatus = 'idle' | 'loading' | 'success' | 'error'

export interface CheckState<T> {
  status: CheckStatus
  data?: T
  error?: string
  latencyMs?: number
}

/** Generic runner: tracks status, result, error message and latency for one async action. */
export function useIntegrationCheck<T>() {
  const [state, setState] = useState<CheckState<T>>({ status: 'idle' })

  const run = useCallback(async (action: () => Promise<T>) => {
    setState({ status: 'loading' })
    const started = performance.now()
    try {
      const data = await action()
      setState({ status: 'success', data, latencyMs: Math.round(performance.now() - started) })
    } catch (err) {
      setState({
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        latencyMs: Math.round(performance.now() - started),
      })
    }
  }, [])

  return { ...state, run }
}

/** Dashboard check 1: invoke the exchange-rate edge function (USD -> EUR). */
export function useExchangeRateCheck() {
  const { run: runCheck, ...rest } = useIntegrationCheck<ExchangeRateResult>()
  const run = useCallback(
    () => runCheck(() => fetchExchangeRate(supabase, 'USD', 'EUR')),
    [runCheck],
  )
  return { ...rest, run }
}

/** Dashboard check 2: call the todo_stats RPC. */
export function useTodoStatsCheck() {
  const { run: runCheck, ...rest } = useIntegrationCheck<TodoStats>()
  const run = useCallback(() => runCheck(() => fetchTodoStats(supabase)), [runCheck])
  return { ...rest, run }
}
