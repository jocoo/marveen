import { describe, it, expect } from 'vitest'
import { buildFailureNotificationText, shouldEscalateFailure } from '../web/message-router.js'

// Coverage for the failed-message owner-escalation hook (kanban #32c93d8c).
// When the message-router truly cannot deliver an inter-agent message
// (target session absent for the entire retry window, or tmux injection
// fails), the owner gets pinged on Telegram so they can re-issue the work
// manually. Input-validation failures (empty/malformed from_agent) stay
// quiet -- they're a misconfig/attack signal, not a stuck user message.

describe('shouldEscalateFailure', () => {
  it('escalates the two genuine delivery failures', () => {
    expect(shouldEscalateFailure('abandoned')).toBe(true)
    expect(shouldEscalateFailure('inject-failed')).toBe(true)
  })

  it('does NOT escalate the input-validation failure', () => {
    // Empty / malformed from_agent never represented real intended traffic.
    // Surfacing it on Telegram would just add noise the owner can't act on.
    expect(shouldEscalateFailure('invalid-from')).toBe(false)
  })
})

describe('buildFailureNotificationText', () => {
  it('mentions sender, receiver, and a content preview', () => {
    const text = buildFailureNotificationText('kronk', 'yzma', 'PLAN.md push elkeszult, varom a review-t', 'Abandoned')
    expect(text).toContain('kronk')
    expect(text).toContain('-> yzma')
    expect(text).toContain('PLAN.md push elkeszult, varom a review-t')
    expect(text).toContain('Abandoned')
    expect(text).toMatch(/Kerlek ertesitsd ujra/)
  })

  it('uses the first non-empty line as the preview', () => {
    // A long multi-line agent message must not dump the whole body into the
    // Telegram alert -- just the first informative line is enough to point
    // the owner at the stuck card.
    const content = ['', '   ', 'First real line', 'Second line', 'Third line'].join('\n')
    const text = buildFailureNotificationText('kronk', 'yzma', content, 'Abandoned')
    expect(text).toContain('"First real line"')
    expect(text).not.toContain('Second line')
    expect(text).not.toContain('Third line')
  })

  it('truncates the preview at 120 characters with an ellipsis', () => {
    const longLine = 'x'.repeat(200)
    const text = buildFailureNotificationText('kronk', 'yzma', longLine, 'Abandoned')
    // Format: ...uzenete nem ert celba (-> yzma): "<preview>". Kerlek ...
    const match = text.match(/"([^"]*)"/)
    expect(match).not.toBeNull()
    const preview = match![1]
    expect(preview.length).toBeLessThanOrEqual(120)
    expect(preview.endsWith('...')).toBe(true)
  })

  it('handles short content without ellipsis', () => {
    const text = buildFailureNotificationText('kronk', 'yzma', 'short', 'Abandoned')
    expect(text).toContain('"short"')
    expect(text).not.toContain('...')
  })

  it('handles empty content gracefully (empty preview, still actionable)', () => {
    // The router shouldn't crash on a degenerate message body. The preview
    // becomes empty but the sender/receiver names still point the owner at
    // who to re-poke.
    const text = buildFailureNotificationText('kronk', 'yzma', '', 'Abandoned')
    expect(text).toContain('kronk')
    expect(text).toContain('-> yzma')
    expect(text).toContain('""')  // empty preview is fine
    expect(text).toContain('Abandoned')
  })

  it('includes the failure reason verbatim so logs and Telegram match', () => {
    const text = buildFailureNotificationText(
      'kronk', 'yzma', 'hello',
      'Abandoned: target session absent for full retry window',
    )
    expect(text).toContain('Abandoned: target session absent for full retry window')
  })
})
