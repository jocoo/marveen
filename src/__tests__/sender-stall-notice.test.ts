// Contract tests for the sender-stall heads-up (card 74d3ca3e).
//
// Root cause (2026-08-23 incident): Yzma's correction messages to Kronk sat
// pending behind a long turn. The router retried them silently ("target session
// busy, will retry") and told NOBODY -- not the receiver (mid-turn) and, the gap
// this closes, not the SENDER. Kronk reversed two domain decisions because it
// acted before the corrections landed, assuming hand-off meant delivery.
//
// The fix drops ONE soft heads-up into the sender's inbox once a still-pending
// message crosses the notice threshold. shouldNotifySenderOfStall is the pure
// gate; buildSenderStallNotice is the wording. Both are pinned here so the
// recursion guard (no notice about a notice) and the "do not assume it was read"
// framing cannot silently regress.

import { describe, it, expect } from 'vitest'
import {
  shouldNotifySenderOfStall,
  buildSenderStallNotice,
  SENDER_STALL_NOTICE_MS,
} from '../web/message-router.js'

const MIN = 60 * 1000
const OVER = SENDER_STALL_NOTICE_MS + MIN // comfortably past the threshold
const UNDER = SENDER_STALL_NOTICE_MS - MIN

describe('shouldNotifySenderOfStall: sender learns its message is still queued', () => {
  it('fires for a real agent->agent message once it passes the threshold', () => {
    expect(shouldNotifySenderOfStall(OVER, SENDER_STALL_NOTICE_MS, false, 'yzma', 'kronk', true)).toBe(true)
  })

  it('does NOT fire before the threshold (a busy agent working normally)', () => {
    expect(shouldNotifySenderOfStall(UNDER, SENDER_STALL_NOTICE_MS, false, 'yzma', 'kronk', true)).toBe(false)
  })

  it('fires exactly once -- an already-notified id stays quiet', () => {
    expect(shouldNotifySenderOfStall(OVER, SENDER_STALL_NOTICE_MS, true, 'yzma', 'kronk', true)).toBe(false)
  })

  it('never notifies a self-message (the sender already knows)', () => {
    expect(shouldNotifySenderOfStall(OVER, SENDER_STALL_NOTICE_MS, false, 'kronk', 'kronk', true)).toBe(false)
  })

  it('never notifies the synthetic system id (recursion guard)', () => {
    // The heads-up itself is a system -> sender row. If a stalled system notice
    // could spawn another notice, one busy sender would fan out an endless chain.
    expect(shouldNotifySenderOfStall(OVER, SENDER_STALL_NOTICE_MS, false, 'system', 'kronk', true)).toBe(false)
  })

  it('never notifies a non-addressable sender (e.g. a stalled channel-inbound row)', () => {
    // A user message arrives with a coordinator id as `from`, which is not a
    // known fleet agent -- there is no inbox to notify, so it must stay quiet.
    expect(shouldNotifySenderOfStall(OVER, SENDER_STALL_NOTICE_MS, false, 'telegram-coordinator', 'kronk', false)).toBe(false)
  })
})

describe('buildSenderStallNotice: the wording carries the whole point', () => {
  const notice = buildSenderStallNotice(4242, 'kronk', 7 * MIN, 'FONTOS: a második döntést vissza kell vonni\nrészletek lent')

  it('is tagged [message-pending] so the sender can key on it', () => {
    expect(notice).toContain('[message-pending]')
  })

  it('names the message id and the target', () => {
    expect(notice).toContain('#4242')
    expect(notice).toContain('kronk')
  })

  it('states the wait in whole minutes', () => {
    expect(notice).toContain('7 perce')
  })

  it('tells the sender NOT to assume delivery -- the incident framing', () => {
    expect(notice).toContain('ne feltételezd hogy megkapta')
  })

  it('previews the first non-empty line, not a blank one', () => {
    expect(notice).toContain('FONTOS: a második döntést vissza kell vonni')
    expect(notice).not.toContain('\nrészletek lent')
  })

  it('never reports less than a minute (a just-crossed threshold still reads sensibly)', () => {
    expect(buildSenderStallNotice(1, 'kronk', 5 * MIN + 20_000, 'x')).toContain('5 perce')
    // A pathological sub-minute age floors to 1, never "0 perce".
    expect(buildSenderStallNotice(1, 'kronk', 20_000, 'x')).toContain('1 perce')
  })
})
