// Exchange-rate edge function.
// - Gateway verifies the caller's JWT (verify_jwt = true in config.jsonc).
// - Accepts { base, symbol } as a JSON POST body (supabase-js invoke) or as ?base=&symbol= on GET.
// - Calls Frankfurter (or EXCHANGE_API_URL, which tests point at a stub).

const CODE_PATTERN = /^[A-Z]{3}$/
const UPSTREAM_TIMEOUT_MS = 5000
const DEFAULT_API_URL = 'https://api.frankfurter.dev'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export interface ExchangeRateResponse {
  base: string
  symbol: string
  rate: number
  date: string
  fetchedAt: string
  source: 'frankfurter'
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function readPair(req: Request): Promise<{ base: unknown; symbol: unknown }> {
  if (req.method === 'POST') {
    const body: unknown = await req.json().catch(() => null)
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>
      return { base: b.base, symbol: b.symbol }
    }
    return { base: undefined, symbol: undefined }
  }
  const url = new URL(req.url)
  return {
    base: url.searchParams.get('base') ?? undefined,
    symbol: url.searchParams.get('symbol') ?? undefined,
  }
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(405, { error: 'method not allowed' })
  }

  const { base, symbol } = await readPair(req)
  if (
    typeof base !== 'string' ||
    typeof symbol !== 'string' ||
    !CODE_PATTERN.test(base) ||
    !CODE_PATTERN.test(symbol)
  ) {
    return json(400, { error: 'base and symbol must be 3-letter uppercase ISO codes' })
  }

  const apiUrl = Deno.env.get('EXCHANGE_API_URL') ?? DEFAULT_API_URL
  const upstream = `${apiUrl}/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbol)}`

  let upstreamRes: Response
  try {
    upstreamRes = await fetch(upstream, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (err) {
    const reason = err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : 'network error'
    return json(502, { error: `upstream ${reason}` })
  }

  if (!upstreamRes.ok) {
    return json(502, { error: `upstream responded ${upstreamRes.status}` })
  }

  const payload = (await upstreamRes.json().catch(() => null)) as {
    date?: unknown
    rates?: Record<string, unknown>
  } | null
  const rate = payload?.rates?.[symbol]
  if (typeof rate !== 'number' || typeof payload?.date !== 'string') {
    return json(502, { error: 'upstream returned an unexpected payload' })
  }

  const body: ExchangeRateResponse = {
    base,
    symbol,
    rate,
    date: payload.date,
    fetchedAt: new Date().toISOString(),
    source: 'frankfurter',
  }
  return json(200, body)
}

if (import.meta.main) {
  Deno.serve(handler)
}
