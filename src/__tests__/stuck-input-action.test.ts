import { describe, it, expect } from 'vitest'
import {
  decideStuckInputAction,
  submitLanded,
  enterVerifiedOutcome,
  parkedInputRowCount,
  stuckInputSignature,
  detectsPastePlaceholder,
  type StuckInputActionFacts,
} from '../pane-state.js'

// Delivery-reliability deep-fix (BA56A500): the I/O submit-escalation + post-
// submit verification path. These cover the pure decision (decideStuckInputAction)
// and the two submit predicates (parkedInputRowCount, submitLanded). The pre-
// existing recovery-stack tests (decideStuckInputRecovery et al.) are untouched.

// Realistic `tmux capture-pane -p` fixtures (same box-drawing bytes as
// pane-state.test.ts: U+2500 ─, U+276F ❯).
const SEP = '─'.repeat(80)
const FOOTER = '  ⏵⏵ bypass permissions on (shift+tab to cycle)'

// A single-row parked <channel> block (complete: header + chat_id + close tag).
const PARKED_CHANNEL_SINGLEROW = [
  '',
  SEP,
  '❯ <channel source="plugin:telegram" chat_id="123">rovid uzenet</channel>',
  SEP,
  FOOTER,
].join('\n')

// The same block wrapped across 3 visual rows of the live input box.
const PARKED_CHANNEL_MULTIROW = [
  '',
  SEP,
  '❯ <channel source="plugin:telegram" chat_id="123">Szia, ez egy jó',
  '  hosszú üzenet ami több sorba tördelődött a terminál szélén és',
  '  több vizuális sort foglal el a beviteli dobozban</channel>',
  SEP,
  FOOTER,
].join('\n')

// An idle pane: empty input box, nothing parked.
const IDLE = ['', SEP, '❯ ', SEP, FOOTER].join('\n')

function facts(over: Partial<StuckInputActionFacts>): StuckInputActionFacts {
  return {
    escalate: false,
    rowCount: 1,
    blockComplete: false,
    blockTruncated: false,
    truncatedPreamble: false,
    allowPlainReinject: false,
    hasPlainText: false,
    scheduledTaskBlock: false,
    machineOrigin: false,
    pastePlaceholder: false,
    ...over,
  }
}

describe('decideStuckInputAction (recovery-decision unit)', () => {
  it('NEVER bare-Enters a multi-row box: complete block -> re-inject, not enter', () => {
    // The core of the fix: a plain Enter on a multi-row parked message inserts a
    // newline (corrupt). Multi-row escalates straight to the chat_id-safe
    // re-inject even before the Enter-first budget is spent.
    const a = decideStuckInputAction(facts({ rowCount: 3, blockComplete: true, escalate: false }))
    expect(a).toBe('reinject-block')
    expect(a).not.toBe('enter')
  })

  it('multi-row truncated <channel> block -> hold (no Enter, no wrong-chat_id re-inject)', () => {
    const a = decideStuckInputAction(facts({ rowCount: 2, blockTruncated: true, escalate: true }))
    expect(a).toBe('hold')
  })

  it('multi-row sub-agent MACHINE-marked plain text -> re-inject plain, never enter', () => {
    const a = decideStuckInputAction(
      facts({ rowCount: 2, allowPlainReinject: true, hasPlainText: true, machineOrigin: true }),
    )
    expect(a).toBe('reinject-plain')
  })

  // -------------------------------------------------------------------------
  // STUCKINPUT805: the lossy-rescue regression measured live on 2026-08-05.
  // The visible-box scrape drops the HEAD rows of an overfull box, so a
  // re-inject of it is deterministic corruption (10,509-char prompt delivered
  // as its last ~400 chars, byte-identically at 15:06 and 16:00).
  // -------------------------------------------------------------------------

  it('STUCKINPUT805: a parked scheduled tick on a SUB-AGENT is clear-only, never reinject-plain', () => {
    // The old branch order routed this into reinject-plain (the sub-agent
    // check sat above the scheduled check) -- the exact bug. The scheduler
    // re-fires the tick whole; the scrape never contains the whole prompt.
    const a = decideStuckInputAction(facts({
      rowCount: 5, allowPlainReinject: true, hasPlainText: true,
      scheduledTaskBlock: true, machineOrigin: true, escalate: true,
    }))
    expect(a).toBe('clear-scheduled')
  })

  it('STUCKINPUT805: uncertain-origin park on a sub-agent -> hold, never clear or re-inject', () => {
    // "Sub-agent means no human draft" is false: agent-terminal types into
    // sub-agent panes too. A human's text has no re-delivery; destroying it is
    // strictly worse than a wedged box. Simulates the human-typed overflow:
    // long multi-row text, no machine marker anywhere.
    const a = decideStuckInputAction(facts({
      rowCount: 8, allowPlainReinject: true, hasPlainText: true,
      machineOrigin: false, escalate: true,
    }))
    expect(a).toBe('hold')
  })

  it('STUCKINPUT805: box so short even the tail marker is cut -> no machine evidence -> default path', () => {
    // scheduledTaskBlock and machineOrigin both read false when every marker
    // is outside the visible box. Multi-row holds; single-row keeps the
    // harmless legacy Enter. Neither destroys anything.
    expect(decideStuckInputAction(facts({
      rowCount: 3, allowPlainReinject: true, hasPlainText: true, escalate: true,
    }))).toBe('hold')
    expect(decideStuckInputAction(facts({
      rowCount: 1, allowPlainReinject: true, hasPlainText: true, escalate: true,
    }))).toBe('enter')
  })

  it('multi-row with nothing safely re-injectable -> hold (never corrupt via Enter)', () => {
    const a = decideStuckInputAction(facts({ rowCount: 4 }))
    expect(a).toBe('hold')
  })

  it('single-row complete block, pre-escalation -> bare Enter (may submit on its own)', () => {
    expect(decideStuckInputAction(facts({ rowCount: 1, blockComplete: true, escalate: false }))).toBe('enter')
  })

  it('single-row complete block, escalated -> clear + verbatim re-inject', () => {
    expect(decideStuckInputAction(facts({ rowCount: 1, blockComplete: true, escalate: true }))).toBe('reinject-block')
  })

  it('truncation-guard preserved: escalated truncated preamble -> clear only', () => {
    expect(decideStuckInputAction(facts({ rowCount: 1, truncatedPreamble: true, escalate: true }))).toBe('clear-preamble')
  })

  it('single-row truncated block keeps the harmless legacy Enter', () => {
    expect(decideStuckInputAction(facts({ rowCount: 1, blockTruncated: true, escalate: true }))).toBe('enter')
  })

  it('single-row default (swallowed Enter) -> bare Enter', () => {
    expect(decideStuckInputAction(facts({ rowCount: 1, escalate: true }))).toBe('enter')
  })

  // 2026-07-25 hermes incident: a multi-row scheduled-task tick parked on the
  // MAIN session (no plain re-inject) used to fall into the no-remedy 'hold'
  // branch forever -> channel permanently mute. Clear-only is the safe move:
  // the next schedule fire re-delivers, while re-injecting risks TUI mid-text
  // truncation corrupting the instruction.
  it('multi-row parked scheduled-task tick on main -> clear-scheduled, not hold', () => {
    const a = decideStuckInputAction(facts({ rowCount: 6, scheduledTaskBlock: true }))
    expect(a).toBe('clear-scheduled')
  })

  it('escalated single-row scheduled-task tick -> clear-scheduled', () => {
    expect(decideStuckInputAction(facts({ rowCount: 1, scheduledTaskBlock: true, escalate: true }))).toBe('clear-scheduled')
  })

  it('single-row scheduled-task tick pre-escalation still tries the harmless Enter', () => {
    expect(decideStuckInputAction(facts({ rowCount: 1, scheduledTaskBlock: true, escalate: false }))).toBe('enter')
  })

  it('STUCKINPUT805 precedence FLIP: clear-scheduled beats plain re-inject on sub-agents too', () => {
    // The previous version of this test pinned the OPPOSITE ("existing path
    // preserved") -- and that precedence WAS the bug: on a sub-agent pane a
    // parked scheduled tick took the reinject-plain branch, whose payload is a
    // scrape of the VISIBLE box. The TUI drops the head rows of an overfull
    // box, so the scrape was the tail fragment -- re-injected byte-identically
    // at 15:06 and 16:00 on 2026-08-05 (10,509-char prompt as its last ~400
    // chars). clear-scheduled is strictly better on every session: the next
    // schedule fire re-delivers the WHOLE prompt.
    const a = decideStuckInputAction(
      facts({ rowCount: 3, scheduledTaskBlock: true, allowPlainReinject: true, hasPlainText: true, machineOrigin: true }),
    )
    expect(a).toBe('clear-scheduled')
  })
})

describe('submitLanded (post-submit verification)', () => {
  it('verified-landed -> stop: the parked signature cleared after submit', () => {
    const prev = stuckInputSignature(PARKED_CHANNEL_SINGLEROW)
    expect(prev).not.toBeNull()
    expect(submitLanded(prev!, IDLE)).toBe(true)
  })

  it('not-landed -> escalate: the same text is still parked after the attempt', () => {
    const prev = stuckInputSignature(PARKED_CHANNEL_SINGLEROW)
    expect(submitLanded(prev!, PARKED_CHANNEL_SINGLEROW)).toBe(false)
  })

  it('null capture after submit -> not landed (cannot confirm -> escalate)', () => {
    const prev = stuckInputSignature(PARKED_CHANNEL_SINGLEROW)
    expect(submitLanded(prev!, null)).toBe(false)
  })
})

describe('parkedInputRowCount', () => {
  it('single-row parked input -> 1', () => {
    expect(parkedInputRowCount(PARKED_CHANNEL_SINGLEROW)).toBe(1)
  })

  it('wrapped multi-row parked input -> >1', () => {
    expect(parkedInputRowCount(PARKED_CHANNEL_MULTIROW)).toBe(3)
  })

  it('idle / empty box -> 0', () => {
    expect(parkedInputRowCount(IDLE)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// STUCKENTER384: verified Enter on a multi-row park with no paste placeholder.
// ---------------------------------------------------------------------------

// A parked `[Pasted text #N]` stub: the ONE state where a bare Enter is proven
// not to submit (it expands the stub instead).
const PARKED_PASTE_PLACEHOLDER = [
  '',
  SEP,
  '❯ [Pasted text #3 +412 lines]',
  SEP,
  FOOTER,
].join('\n')

// The multi-row park AFTER an Enter that inserted a newline instead of
// submitting: same text, one row more (the buffer grew, the box did not clear).
const PARKED_CHANNEL_MULTIROW_PLUS_NEWLINE = [
  '',
  SEP,
  '❯ <channel source="plugin:telegram" chat_id="123">Szia, ez egy jó',
  '  hosszú üzenet ami több sorba tördelődött a terminál szélén és',
  '  több vizuális sort foglal el a beviteli dobozban</channel>',
  '  .',
  SEP,
  FOOTER,
].join('\n')

describe('decideStuckInputAction: multi-row verbatim park (STUCKENTER384)', () => {
  it('multi-row, no placeholder, no safe re-inject -> verified Enter instead of hold', () => {
    // The measured case (card #384, 2026-08-27): a 9-row wrap-only verbatim
    // park with placeholder=false SUBMITTED on a bare Enter. Before this fix
    // the same facts returned 'hold' and every occurrence needed a human.
    expect(decideStuckInputAction(facts({ rowCount: 9 }))).toBe('enter-verified')
  })

  it('a parked paste placeholder still holds: Enter only EXPANDS the stub', () => {
    // The unmeasured half (case C of the probe): after the stub expands, the
    // upstream invariant may well hold on the expanded buffer. Not measured ->
    // not permitted.
    expect(decideStuckInputAction(facts({ rowCount: 9, pastePlaceholder: true }))).toBe('hold')
  })

  it('truncated <channel> block goes to verified Enter -- the buffer is intact, only the DISPLAY is cut', () => {
    // Re-injecting it would answer the wrong chat_id (the id is off-screen);
    // the Enter submits the real buffer, id included.
    expect(decideStuckInputAction(facts({ rowCount: 5, blockTruncated: true }))).toBe('enter-verified')
    expect(decideStuckInputAction(facts({ rowCount: 5, blockTruncated: true, pastePlaceholder: true }))).toBe('hold')
  })

  it('a truncated safety preamble still holds -- clear-preamble is the right move next tick', () => {
    expect(decideStuckInputAction(facts({ rowCount: 5, truncatedPreamble: true, escalate: false }))).toBe('hold')
    expect(decideStuckInputAction(facts({ rowCount: 5, truncatedPreamble: true, escalate: true }))).toBe('clear-preamble')
  })

  it('single-row is unchanged: the plain legacy Enter, not the verified one', () => {
    expect(decideStuckInputAction(facts({ rowCount: 1 }))).toBe('enter')
  })

  it('the safe re-inject paths still win over the verified Enter', () => {
    expect(decideStuckInputAction(facts({ rowCount: 4, blockComplete: true }))).toBe('reinject-block')
    expect(decideStuckInputAction(facts({ rowCount: 4, scheduledTaskBlock: true }))).toBe('clear-scheduled')
    expect(decideStuckInputAction(facts({
      rowCount: 4, allowPlainReinject: true, hasPlainText: true, machineOrigin: true,
    }))).toBe('reinject-plain')
  })

  it('the discriminator reads the real fixtures the way the decision assumes', () => {
    expect(detectsPastePlaceholder(PARKED_PASTE_PLACEHOLDER)).toBe(true)
    expect(detectsPastePlaceholder(PARKED_CHANNEL_MULTIROW)).toBe(false)
  })
})

describe('enterVerifiedOutcome (strict post-Enter check)', () => {
  it('box left the parked state -> landed', () => {
    expect(enterVerifiedOutcome(PARKED_CHANNEL_MULTIROW, IDLE)).toBe('landed')
  })

  it('still parked and one row longer -> newline-inserted (caller rolls it back)', () => {
    expect(enterVerifiedOutcome(PARKED_CHANNEL_MULTIROW, PARKED_CHANNEL_MULTIROW_PLUS_NEWLINE))
      .toBe('newline-inserted')
  })

  it('still parked, same size -> unconfirmed (swallowed Enter, nothing to undo)', () => {
    expect(enterVerifiedOutcome(PARKED_CHANNEL_MULTIROW, PARKED_CHANNEL_MULTIROW)).toBe('unconfirmed')
  })

  it('no capture -> unconfirmed, never assumed landed', () => {
    expect(enterVerifiedOutcome(PARKED_CHANNEL_MULTIROW, null)).toBe('unconfirmed')
  })

  it('submitLanded() would MISREAD the newline case -- which is why this exists', () => {
    // The whole reason for a second predicate: an inserted newline changes the
    // parked signature, so the signature-based check reports a false "landed"
    // on the exact failure the verified-Enter branch must survive.
    const prev = stuckInputSignature(PARKED_CHANNEL_MULTIROW)
    expect(prev).not.toBeNull()
    expect(submitLanded(prev!, PARKED_CHANNEL_MULTIROW_PLUS_NEWLINE)).toBe(true)
    expect(enterVerifiedOutcome(PARKED_CHANNEL_MULTIROW, PARKED_CHANNEL_MULTIROW_PLUS_NEWLINE))
      .toBe('newline-inserted')
  })
})
