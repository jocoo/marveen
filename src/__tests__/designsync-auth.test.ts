import { describe, it, expect } from 'vitest'
import {
  paneShowsDesignSyncAuthError,
  paneShowsDesignLoginSuccess,
  evaluateDesignSyncAuth,
} from '../web/designsync-auth.js'

// DesignSync auth badge (kanban #86c81120). The deterministic evaluate() is the
// backbone; the pane markers are best-effort. Both are pure, so tested directly.

describe('paneShowsDesignSyncAuthError', () => {
  it('null/empty -> false', () => {
    expect(paneShowsDesignSyncAuthError(null)).toBe(false)
    expect(paneShowsDesignSyncAuthError('')).toBe(false)
  })
  it('fires on a DesignSync auth failure line', () => {
    expect(paneShowsDesignSyncAuthError('DesignSync: not authenticated')).toBe(true)
    expect(paneShowsDesignSyncAuthError('please run /design-login to continue')).toBe(true)
    expect(paneShowsDesignSyncAuthError('DesignSync request failed: 401')).toBe(true)
  })
  it('does NOT fire on ordinary chatter mentioning design', () => {
    expect(paneShowsDesignSyncAuthError('I updated the design of the login page')).toBe(false)
    expect(paneShowsDesignSyncAuthError('the DesignSync tool synced 4 frames')).toBe(false)
  })
})

describe('paneShowsDesignLoginSuccess', () => {
  it('fires on a successful login line', () => {
    expect(paneShowsDesignLoginSuccess('/design-login succeeded')).toBe(true)
    expect(paneShowsDesignLoginSuccess('DesignSync authenticated and ready')).toBe(true)
  })
  it('null/empty -> false', () => {
    expect(paneShowsDesignLoginSuccess(null)).toBe(false)
  })
})

describe('evaluateDesignSyncAuth', () => {
  const base = { tracked: true, running: true, runningSince: 1000, lastLoginAt: 2000, paneAuthError: false }

  it('untracked agent -> never flagged', () => {
    expect(evaluateDesignSyncAuth({ ...base, tracked: false }).authMissing).toBe(false)
  })
  it('stopped agent -> never flagged', () => {
    expect(evaluateDesignSyncAuth({ ...base, running: false }).authMissing).toBe(false)
  })
  it('login after session start -> auth present', () => {
    expect(evaluateDesignSyncAuth({ ...base, runningSince: 1000, lastLoginAt: 2000 }).authMissing).toBe(false)
  })
  it('login predates the current session (restart wiped it) -> missing', () => {
    const r = evaluateDesignSyncAuth({ ...base, runningSince: 3000, lastLoginAt: 2000 })
    expect(r.authMissing).toBe(true)
    expect(r.reason).toMatch(/restart/i)
  })
  it('never logged in -> missing', () => {
    const r = evaluateDesignSyncAuth({ ...base, lastLoginAt: 0 })
    expect(r.authMissing).toBe(true)
    expect(r.reason).toMatch(/no designsync login/i)
  })
  it('live auth error overrides a fresh login timestamp', () => {
    const r = evaluateDesignSyncAuth({ ...base, lastLoginAt: 9999, runningSince: 1000, paneAuthError: true })
    expect(r.authMissing).toBe(true)
    expect(r.reason).toMatch(/design-login/i)
  })
})
