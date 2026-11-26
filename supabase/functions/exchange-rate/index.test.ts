// Run with: deno test --allow-env --allow-net supabase/functions/exchange-rate/index.test.ts
// No network: globalThis.fetch is stubbed for every test.
import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { handler } from './index.ts'

const realFetch = globalThis.fetch

function stubFetch(impl: (url: string) => Response | Promise<Response>) {
  const calls: string[] = []
  globalThis.fetch = (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push(url)
    return Promise.resolve(impl(url))
  }
  return calls
}

function post(body: unknown): Request {
  return new Request('http://localhost/exchange-rate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

Deno.test({
  name: 'happy path returns the shaped response',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const calls = stubFetch(
      () =>
        new Response(
          JSON.stringify({ amount: 1, base: 'USD', date: '2026-11-24', rates: { EUR: 0.92 } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    )
    try {
      const res = await handler(post({ base: 'USD', symbol: 'EUR' }))
      assertEquals(res.status, 200)
      const body = await res.json()
      assertEquals(body.base, 'USD')
      assertEquals(body.symbol, 'EUR')
      assertEquals(body.rate, 0.92)
      assertEquals(body.date, '2026-11-24')
      assertEquals(body.source, 'frankfurter')
      assertStringIncludes(body.fetchedAt, 'T')
      assertStringIncludes(calls[0] ?? '', 'symbols=EUR')
    } finally {
      globalThis.fetch = realFetch
    }
  },
})

Deno.test({
  name: 'invalid symbol returns 400 and never calls upstream',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const calls = stubFetch(() => new Response('should not be called'))
    try {
      const res = await handler(post({ base: 'USD', symbol: 'eur' }))
      assertEquals(res.status, 400)
      assertEquals(calls.length, 0)
    } finally {
      globalThis.fetch = realFetch
    }
  },
})

Deno.test({
  name: 'injection attempt in symbol is rejected with 400',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const calls = stubFetch(() => new Response('should not be called'))
    try {
      const res = await handler(post({ base: 'USD', symbol: 'EUR&foo=bar' }))
      assertEquals(res.status, 400)
      assertEquals(calls.length, 0)
    } finally {
      globalThis.fetch = realFetch
    }
  },
})

Deno.test({
  name: 'upstream 500 returns 502',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    stubFetch(() => new Response('boom', { status: 500 }))
    try {
      const res = await handler(post({ base: 'USD', symbol: 'EUR' }))
      assertEquals(res.status, 502)
      assertStringIncludes((await res.json()).error, '500')
    } finally {
      globalThis.fetch = realFetch
    }
  },
})

Deno.test({
  name: 'timeout returns 502',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    stubFetch(() => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    })
    try {
      const res = await handler(post({ base: 'USD', symbol: 'EUR' }))
      assertEquals(res.status, 502)
      assertStringIncludes((await res.json()).error, 'timeout')
    } finally {
      globalThis.fetch = realFetch
    }
  },
})

Deno.test({
  name: 'OPTIONS preflight returns CORS headers',
  fn: async () => {
    const res = await handler(new Request('http://localhost/', { method: 'OPTIONS' }))
    assertEquals(res.status, 204)
    assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*')
  },
})
