import { describe, expect, it } from 'vitest'
import { shouldDispatchOnPut } from '../web/routes/kanban.js'

// Regression coverage for kanban #186ed044.
//
// The PUT /api/kanban/{id} endpoint used to call updateKanbanCard(id, fields)
// and nothing else, so a script / sub-agent that flipped a card to
// in_progress via PUT updated the row but never fired the dispatch hook
// that wakes the assignee. POST /api/kanban/{id}/move always fired -- but
// since the dashboard UI used /move, the bug only surfaced for non-UI
// callers (incident 2026-06-18, #59).
//
// `shouldDispatchOnPut` is the pure gate the PUT handler now consults; the
// kanban_cards.dispatched_at column is a second once-only guard inside
// fireKanbanDispatch itself, so a stale PUT cannot double-fire even if
// this returns true.

describe('shouldDispatchOnPut', () => {
  it('fires when the PUT body flips a planned card to in_progress', () => {
    expect(shouldDispatchOnPut('planned', 'in_progress')).toBe(true)
  })

  it('fires for any non-in_progress prior status', () => {
    expect(shouldDispatchOnPut('waiting', 'in_progress')).toBe(true)
    expect(shouldDispatchOnPut('done', 'in_progress')).toBe(true)
    expect(shouldDispatchOnPut(undefined, 'in_progress')).toBe(true)
    expect(shouldDispatchOnPut(null, 'in_progress')).toBe(true)
  })

  it('does NOT fire when the body omits the status field', () => {
    // The PUT handler calls this with `data.status`, which is undefined for
    // bodies like {priority: 'high'} / {assignee: 'kronk'} / {title: '...'}.
    expect(shouldDispatchOnPut('planned', undefined)).toBe(false)
    expect(shouldDispatchOnPut('in_progress', undefined)).toBe(false)
  })

  it('does NOT fire when the status field is not in_progress', () => {
    expect(shouldDispatchOnPut('in_progress', 'done')).toBe(false)
    expect(shouldDispatchOnPut('planned', 'waiting')).toBe(false)
    expect(shouldDispatchOnPut('waiting', 'planned')).toBe(false)
  })

  it('does NOT fire when status=in_progress is a no-op (already in_progress)', () => {
    // Idempotent re-PUT must not re-wake the assignee. The first transition
    // already armed the dispatched_at guard; the gate prevents even calling
    // fireKanbanDispatch in the no-op case so the logs stay quiet.
    expect(shouldDispatchOnPut('in_progress', 'in_progress')).toBe(false)
  })

  it('ignores non-string status values defensively', () => {
    // JSON bodies can carry whatever shape; the gate must not coerce.
    expect(shouldDispatchOnPut('planned', 42 as unknown)).toBe(false)
    expect(shouldDispatchOnPut('planned', true as unknown)).toBe(false)
    expect(shouldDispatchOnPut('planned', { status: 'in_progress' } as unknown)).toBe(false)
    expect(shouldDispatchOnPut('planned', null as unknown)).toBe(false)
  })
})
