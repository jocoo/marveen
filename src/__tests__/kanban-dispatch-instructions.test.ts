import { describe, expect, it } from 'vitest'
import { kanbanMoveInstructions } from '../web/routes/kanban.js'
import { MAIN_AGENT_ID } from '../config.js'

// A sub-agent never closes its own card: it reports the finished work to the
// orchestrator (MAIN_AGENT_ID) via inter-agent message, leaves the card in
// in_progress, and the orchestrator verifies before flipping done. The waiting
// branch (blocked on external input) IS a self state change -- the agent posts
// a comment explaining what it's waiting for and moves the card to waiting.
describe('kanbanMoveInstructions', () => {
  it('routes the finished deliverable through /api/messages to the orchestrator', () => {
    const out = kanbanMoveInstructions('abc123', 'cody')
    expect(out).toContain('/api/messages')
    expect(out).toContain('"from":"cody"')
    expect(out).toContain(`"to":"${MAIN_AGENT_ID}"`)
    expect(out).toContain('#abc123 kész')
  })

  it('forbids the sub-agent from flipping the card to done itself', () => {
    const out = kanbanMoveInstructions('abc123', 'cody')
    expect(out).not.toContain('"status":"done"')
  })

  it('still exposes the waiting path (self state change for blocked work)', () => {
    const out = kanbanMoveInstructions('abc123', 'cody')
    expect(out).toContain('/api/kanban/abc123/move')
    expect(out).toContain('"status":"waiting"')
    expect(out).toContain('/api/kanban/abc123/comments')
    expect(out).toContain('"author":"cody"')
  })

  // Without an actor the board cannot tell a self-pickup from an assignment, so
  // every move curl the agent is handed names the agent as the mover -- including
  // the in_progress self-pickup, which is the one the dispatcher used to echo back.
  it('names the agent as the actor on every move it is told to make', () => {
    const out = kanbanMoveInstructions('abc123', 'cody')
    // Our fork never tells a sub-agent to self-close to done (notify-before-done),
    // so the actored moves it IS handed are the waiting branch and the in_progress
    // self-pickup -- both carry the actor (upstream #877, to stop the self-dispatch echo).
    expect(out).toContain('"status":"waiting","actor":"cody"')
    expect(out).toContain('"status":"in_progress","actor":"cody"')
  })

  it('keeps the bearer token out of the message (reads it at run time)', () => {
    const out = kanbanMoveInstructions('abc123', 'cody')
    expect(out).toContain('$(cat ')
    expect(out).toContain('.dashboard-token')
  })
})
