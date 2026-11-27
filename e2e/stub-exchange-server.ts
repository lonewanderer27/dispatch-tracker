// Tiny stub of the Frankfurter API so e2e runs are deterministic and offline.
// The edge function runs in a container, so it reaches the stub by container name
// (EXCHANGE_API_URL=http://exchange-stub:4010). See supabase/functions/.env.example.
import { createServer } from 'node:http'

const PORT = Number(process.env.EXCHANGE_STUB_PORT ?? 4010)
// 0.0.0.0 when the stub runs in a container, so other containers on its network can reach it.
const HOST = process.env.EXCHANGE_STUB_HOST ?? '127.0.0.1'

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

server.listen(PORT, HOST, () => {
  console.log(`exchange stub listening on http://${HOST}:${PORT}`)
})
