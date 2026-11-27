// Pure data-access for the dashboard integration checks.
// Takes the client as an argument so tests can pass a mock.
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { AppSupabaseClient } from '@/shared/supabase'

export interface ExchangeRateResult {
  base: string
  symbol: string
  rate: number
  date: string
  fetchedAt: string
  source: 'frankfurter'
}

async function readErrorDetail(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const context = error.context as Response
      const body = (await context.json()) as { error?: unknown }
      if (typeof body.error === 'string') return body.error
    } catch {
      // body was not JSON; fall through to the generic message
    }
  }
  return error instanceof Error ? error.message : 'Unknown error'
}

export async function fetchExchangeRate(
  client: AppSupabaseClient,
  base: string,
  symbol: string,
): Promise<ExchangeRateResult> {
  const result = await client.functions.invoke<ExchangeRateResult>('exchange-rate', {
    body: { base, symbol },
  })
  const error: unknown = result.error
  if (error) throw new Error(await readErrorDetail(error))
  const data = result.data
  if (!data) throw new Error('Empty response from exchange-rate')
  return data
}
