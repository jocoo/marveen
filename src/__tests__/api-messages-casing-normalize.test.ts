import { describe, it, expect, beforeAll } from 'vitest'
import { Readable } from 'node:stream'
import { initDatabase, getAgentConversation } from '../db.js'
import { tryHandleMessages } from '../web/routes/messages.js'

// Regression for #97 (2026-07-01): the POST /api/messages handler used to
// pass from/to through `.trim()` only, so a caller who wrote to="Kronk" (the
// kanban CLAUDE.md convention) persisted a mixed-case row. The message-router
// matches lowercase (agent dirs are lowercase), the row failed to deliver, and
// the dashboard distinct-by-name aggregation showed two "Kronk"s. Fix
// normalizes at this peremfelület.

beforeAll(() => {
  process.env.NODE_ENV = 'test'
  initDatabase(':memory:')
})

async function postMessage(from: string, to: string, content: string): Promise<{ status: number; body: any }> {
  const payload = JSON.stringify({ from, to, content })
  const req = Readable.from([Buffer.from(payload)]) as any
  let status = 200
  let body = ''
  const res = {
    writeHead(s: number) { status = s },
    end(b?: string) { body = b ?? '' },
  } as any
  const handled = await tryHandleMessages({
    req, res, path: '/api/messages', method: 'POST', url: new URL('http://x/api/messages'),
  } as any)
  expect(handled).toBe(true)
  return { status, body: body ? JSON.parse(body) : null }
}

describe('POST /api/messages -- from/to case normalization', () => {
  it('lowercases title-case "Kronk" on to (kanban CLAUDE.md convention)', async () => {
    const { status, body } = await postMessage('cuzcoo', 'Kronk', 'hi')
    expect(status).toBe(200)
    expect(body.to_agent).toBe('kronk')
    expect(body.from_agent).toBe('cuzcoo')
  })

  it('lowercases from too (a mixed-case sender name)', async () => {
    const { status, body } = await postMessage('Cuzcoo', 'yzma', 'ping')
    expect(status).toBe(200)
    expect(body.from_agent).toBe('cuzcoo')
    expect(body.to_agent).toBe('yzma')
  })

  it('surrounding whitespace + case both cleaned in one pass', async () => {
    const { status, body } = await postMessage('  KRONK ', ' Yzma  ', 'x')
    expect(status).toBe(200)
    expect(body.from_agent).toBe('kronk')
    expect(body.to_agent).toBe('yzma')
  })

  it('distinct-by-name aggregation sees a single Kronk after mixed-case POSTs', async () => {
    // Two POSTs, one lowercase, one title-case -- both must collapse to "kronk".
    await postMessage('cuzcoo', 'kronk', 'first')
    await postMessage('cuzcoo', 'Kronk', 'second')
    const conv = getAgentConversation('kronk', 50)
    const toAgents = new Set(conv.map(m => m.to_agent))
    expect(toAgents.has('Kronk')).toBe(false)
    expect(toAgents.has('kronk')).toBe(true)
  })
})
