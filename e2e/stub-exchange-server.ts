// Tiny stub of the Frankfurter API so e2e runs are deterministic and offline.
// Point the edge function at it with EXCHANGE_API_URL=http://127.0.0.1:4010
// (see supabase/functions/.env.example).
import { createServer } from 'node:http'

const PORT = Number(process.env.EXCHANGE_STUB_PORT ?? 4010)

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
  if (url.pathname !== '/v1/latest') {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message: 'not found' }))
    return
  }
  const base = url.searchParams.get('base') ?? 'EUR'
  const symbol = url.searchParams.get('symbols') ?? 'USD'
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({
      amount: 1,
      base,
      date: '2026-01-01',
      rates: { [symbol]: 1.0842 },
    }),
  )
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`exchange stub listening on http://127.0.0.1:${PORT}`)
})
