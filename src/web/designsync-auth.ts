// DesignSync auth-status tracking for the dashboard (kanban #86c81120).
//
// The Claude Design sync tool ("DesignSync") is gated on Jocoo running
// /design-login inside the agent's session. That authorization is IN-PROCESS
// ONLY -- it is never persisted to disk, so EVERY restart (WSL shutdown, agent
// restart, fleet restart) silently drops it and DesignSync calls start failing
// until /design-login is run again. Upstream fix pending (#101); until then
// this surfaces a "DesignSync login needed" badge so Jocoo knows when to act.
//
// Detection has two layers:
//
//  1. DETERMINISTIC (the backbone): auth is bound to the session lifetime, so
//     if the last successful /design-login happened BEFORE the current session
//     started (runningSince), or never, the auth is missing. This does not
//     depend on scraping any particular error text -- a restart provably clears
//     the auth. The "last successful login" timestamp is recorded by the
//     dashboard's own /design-login button (authoritative) and, as a fallback,
//     by scraping a login-success marker from the pane.
//
//  2. BEST-EFFORT pane markers: a DesignSync auth ERROR seen in the live pane
//     both flips the badge on immediately AND marks the agent as
//     DesignSync-using (so the badge only ever shows for agents that actually
//     touch DesignSync, never the whole fleet). A login-SUCCESS marker clears
//     it. These regexes are best-effort until we capture real tool output; the
//     deterministic layer holds even if a marker misses. See MARKERS below.

import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { PROJECT_ROOT } from '../config.js'
import { atomicWriteFileSync } from './atomic-write.js'

const STORE_PATH = join(PROJECT_ROOT, 'store', 'designsync-auth.json')

// Per-agent tracked state. An agent only appears here once we have seen it use
// DesignSync (a login attempt or an auth error), so the badge never shows for
// agents that never touch the tool.
export interface DesignSyncEntry {
  /** Unix seconds of the last KNOWN-successful /design-login, or 0 if none. */
  lastLoginAt: number
  /** Unix seconds we last saw ANY DesignSync activity (login or auth error). */
  lastSeenAt: number
}

export interface DesignSyncAuthState {
  /** True when this agent uses DesignSync but its auth is currently missing. */
  authMissing: boolean
  /** True when we have ever seen this agent use DesignSync (drives visibility). */
  tracked: boolean
  reason?: string
}

// Distinctive markers. Kept multi-word / tool-scoped so ordinary chatter that
// merely mentions "design" or "/design-login" (e.g. an agent reading THIS file)
// does not trip them. Only the live tail of the pane is scanned (see TAIL_LINES).
const AUTH_ERROR_MARKERS: RegExp[] = [
  /DesignSync[^\n]*\b(not authenticated|unauthorized|not authorized|auth(?:orization)? (?:required|failed)|not logged in)/i,
  /\b(run|please run)\s+\/design-login\b/i,
  /DesignSync[^\n]*\b(401|403)\b/i,
  /design[- ]?sync[^\n]*login (?:required|needed)/i,
]

const LOGIN_SUCCESS_MARKERS: RegExp[] = [
  /\/design-login[^\n]*\b(success|succeeded|authenticated|logged in|complete)/i,
  /DesignSync[^\n]*\b(authenticated|logged in|ready|connected)\b/i,
  /(?:successfully )?(?:logged in|authenticated) to (?:claude )?design/i,
]

const TAIL_LINES = 20

function tailOf(pane: string, n: number): string {
  const lines = pane.split('\n')
  return lines.slice(Math.max(0, lines.length - n)).join('\n')
}

/** Pure: does the pane tail show a DesignSync auth error right now? */
export function paneShowsDesignSyncAuthError(pane: string | null | undefined): boolean {
  if (!pane) return false
  const tail = tailOf(pane, TAIL_LINES)
  return AUTH_ERROR_MARKERS.some((rx) => rx.test(tail))
}

/** Pure: does the pane tail show a successful /design-login right now? */
export function paneShowsDesignLoginSuccess(pane: string | null | undefined): boolean {
  if (!pane) return false
  const tail = tailOf(pane, TAIL_LINES)
  return LOGIN_SUCCESS_MARKERS.some((rx) => rx.test(tail))
}

/**
 * Pure decision function (unit-tested): given what we know about an agent,
 * decide whether its DesignSync auth is missing. Kept free of I/O so the store
 * and pane capture can be mocked in tests.
 */
export function evaluateDesignSyncAuth(input: {
  tracked: boolean
  running: boolean
  runningSince: number | null
  lastLoginAt: number
  paneAuthError: boolean
}): DesignSyncAuthState {
  const { tracked, running, runningSince, lastLoginAt, paneAuthError } = input
  if (!tracked || !running) return { authMissing: false, tracked }
  // A live auth error is proof, regardless of timestamps.
  if (paneAuthError) return { authMissing: true, tracked, reason: 'DesignSync call failed - run /design-login' }
  // Deterministic: a login that predates the current session was wiped by the
  // restart that started this session.
  if (lastLoginAt === 0) return { authMissing: true, tracked, reason: 'No DesignSync login since start' }
  if (runningSince != null && lastLoginAt < runningSince)
    return { authMissing: true, tracked, reason: 'DesignSync login lost on restart' }
  return { authMissing: false, tracked }
}

// ---- store ----

function readRaw(): Record<string, DesignSyncEntry> {
  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, 'utf-8'))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, DesignSyncEntry>) : {}
  } catch {
    return {}
  }
}

function writeRaw(raw: Record<string, DesignSyncEntry>): void {
  atomicWriteFileSync(STORE_PATH, JSON.stringify(raw, null, 2))
}

export function readDesignSyncEntry(name: string): DesignSyncEntry | null {
  const raw = readRaw()
  return raw[name] ?? null
}

/** Record a known-successful login (dashboard button, or scraped success). */
export function recordDesignLogin(name: string, atUnixSec: number): void {
  const raw = readRaw()
  const cur = raw[name] ?? { lastLoginAt: 0, lastSeenAt: 0 }
  raw[name] = { lastLoginAt: atUnixSec, lastSeenAt: atUnixSec }
  writeRaw(raw)
}

/** Mark that we saw DesignSync activity (starts tracking the agent). */
export function markDesignSyncSeen(name: string, atUnixSec: number): void {
  const raw = readRaw()
  const cur = raw[name] ?? { lastLoginAt: 0, lastSeenAt: 0 }
  if (cur.lastSeenAt >= atUnixSec) return
  raw[name] = { lastLoginAt: cur.lastLoginAt, lastSeenAt: atUnixSec }
  writeRaw(raw)
}

/**
 * Full evaluation for one agent, folding in the live pane. Updates the store as
 * a side effect (records login success / DesignSync activity seen in the pane),
 * then returns the badge state. `nowUnixSec` is injectable for tests.
 */
export function getDesignSyncAuthState(
  name: string,
  opts: { running: boolean; runningSince: number | null; pane: string | null | undefined; nowUnixSec: number },
): DesignSyncAuthState {
  const { running, runningSince, pane, nowUnixSec } = opts

  if (running && pane) {
    if (paneShowsDesignLoginSuccess(pane)) recordDesignLogin(name, nowUnixSec)
    else if (paneShowsDesignSyncAuthError(pane)) markDesignSyncSeen(name, nowUnixSec)
  }

  const entry = readDesignSyncEntry(name)
  return evaluateDesignSyncAuth({
    tracked: entry != null,
    running,
    runningSince,
    lastLoginAt: entry?.lastLoginAt ?? 0,
    paneAuthError: running ? paneShowsDesignSyncAuthError(pane) : false,
  })
}
