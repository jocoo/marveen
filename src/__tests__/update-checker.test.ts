import { describe, it, expect } from 'vitest'
import { computeUpdateStatus, type GhCompare, type UpdateCheckerIO, type UpdateStatus } from '../web/update-checker.js'

// IO stub. Every method has a sensible default so individual tests only
// override what they care about. Counters track how often each method was
// called so we can pin behaviour expectations (e.g. "no compare call when
// the latest sha already matches HEAD").
interface StubState {
  parseGitHubRemoteCalls: number
  currentGitHeadCalls: number
  upstreamMergeBaseCalls: number
  countCommitsAheadCalls: Array<string>
  fetchLatestShaCalls: Array<string>
  fetchCompareCalls: Array<{ remote: string; base: string; head: string }>
  nowCalls: number
}

interface StubOverrides {
  remote?: string
  currentHead?: string
  mergeBase?: string
  countAhead?: (base: string) => number
  latestSha?: string | (() => Promise<string>)
  /** A queue of compare answers, each consumed by the next fetchCompare call.
   * If the queue is exhausted, returns null. */
  compares?: Array<GhCompare | { notFound: true } | null>
  now?: number
}

function buildIO(over: StubOverrides = {}): { io: UpdateCheckerIO; state: StubState } {
  const state: StubState = {
    parseGitHubRemoteCalls: 0,
    currentGitHeadCalls: 0,
    upstreamMergeBaseCalls: 0,
    countCommitsAheadCalls: [],
    fetchLatestShaCalls: [],
    fetchCompareCalls: [],
    nowCalls: 0,
  }
  const compares = over.compares ?? []
  let compareCursor = 0
  const io: UpdateCheckerIO = {
    parseGitHubRemote() {
      state.parseGitHubRemoteCalls++
      return over.remote ?? 'Szotasz/marveen'
    },
    currentGitHead() {
      state.currentGitHeadCalls++
      return over.currentHead ?? 'HEADSHA1234567'
    },
    upstreamMergeBase() {
      state.upstreamMergeBaseCalls++
      return over.mergeBase ?? ''
    },
    countCommitsAhead(base) {
      state.countCommitsAheadCalls.push(base)
      return over.countAhead ? over.countAhead(base) : 0
    },
    async fetchLatestSha(remote) {
      state.fetchLatestShaCalls.push(remote)
      if (typeof over.latestSha === 'function') return over.latestSha()
      return over.latestSha ?? 'LATESTSHA9876543'
    },
    async fetchCompare(remote, base, head) {
      state.fetchCompareCalls.push({ remote, base, head })
      return compares[compareCursor++] ?? null
    },
    now() {
      state.nowCalls++
      return over.now ?? 1_700_000_000_000
    },
  }
  return { io, state }
}

function makeCmp(ahead_by: number, shas: string[] = []): GhCompare {
  return {
    ahead_by,
    commits: shas.map((sha, i) => ({
      sha,
      commit: {
        message: `commit ${sha}\nbody line`,
        author: { name: 'tester', date: `2026-06-${10 + i}T00:00:00Z` },
      },
    })),
  }
}

describe('computeUpdateStatus -- not a checkout', () => {
  it('reports an error and skips all network calls when HEAD is empty', async () => {
    const { io, state } = buildIO({ currentHead: '' })
    const status = await computeUpdateStatus(io)
    expect(status.error).toBe('Not a git checkout')
    expect(status.current).toBe('')
    expect(state.fetchLatestShaCalls).toEqual([])
    expect(state.fetchCompareCalls).toEqual([])
    // Even in this branch we populate `remote` (for the UI) and `lastChecked`.
    expect(status.remote).toBe('Szotasz/marveen')
    expect(status.lastChecked).toBe(1_700_000_000_000)
  })
})

describe('computeUpdateStatus -- up-to-date', () => {
  it('skips the compare call when latest === current', async () => {
    const sha = 'SAME0000000000000'
    const { io, state } = buildIO({ currentHead: sha, latestSha: sha })
    const status = await computeUpdateStatus(io)
    expect(status.behind).toBe(0)
    expect(status.commits).toEqual([])
    expect(status.error).toBeUndefined()
    expect(state.fetchCompareCalls).toEqual([])
  })
})

describe('computeUpdateStatus -- on-remote behind', () => {
  it('populates behind + commits (newest first) from the direct compare', async () => {
    const { io, state } = buildIO({
      currentHead: 'HEADOLD',
      latestSha: 'LATESTNEW',
      compares: [makeCmp(3, ['oldest', 'middle', 'newest'])],
    })
    const status = await computeUpdateStatus(io)
    expect(status.behind).toBe(3)
    // GitHub returns oldest-first; we flip to newest-first for the UI.
    expect(status.commits.map(c => c.sha)).toEqual(['newest', 'middle', 'oldest'])
    expect(status.commits[0].short).toBe('newest'.slice(0, 7))
    expect(status.commits[0].message).toBe('commit newest')
    expect(status.fork).toBeUndefined()
    expect(status.baseSha).toBeUndefined()
    expect(state.fetchCompareCalls).toEqual([
      { remote: 'Szotasz/marveen', base: 'HEADOLD', head: 'LATESTNEW' },
    ])
    expect(state.upstreamMergeBaseCalls).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Divergent HEAD: the customised-fork fallback that #362 added. These cover
// the four branches that were previously only smoke-checked manually.

describe('computeUpdateStatus -- divergent HEAD', () => {
  it('falls back to upstream merge-base and reports fork=true + baseSha + localAhead', async () => {
    const { io, state } = buildIO({
      currentHead: 'FORKHEAD',
      latestSha: 'UPSTREAMTIP',
      mergeBase: 'FORKPOINT',
      countAhead: (b) => b === 'FORKPOINT' ? 5 : -1,
      compares: [
        { notFound: true },                                  // direct HEAD compare 404
        makeCmp(7, ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']),  // base compare succeeds
      ],
    })
    const status = await computeUpdateStatus(io)
    expect(status.fork).toBe(true)
    expect(status.baseSha).toBe('FORKPOINT')
    expect(status.localAhead).toBe(5)
    expect(status.behind).toBe(7)
    expect(status.commits).toHaveLength(7)
    expect(status.error).toBeUndefined()
    expect(state.upstreamMergeBaseCalls).toBe(1)
    expect(state.fetchCompareCalls).toEqual([
      { remote: 'Szotasz/marveen', base: 'FORKHEAD', head: 'UPSTREAMTIP' },
      { remote: 'Szotasz/marveen', base: 'FORKPOINT', head: 'UPSTREAMTIP' },
    ])
  })

  it('reports fork=true with behind=0 when the fork point is already the upstream tip', async () => {
    // A fork that is purely ahead of upstream -- no upstream commits to pull.
    // Important: skip the second compare call entirely, because asking
    // GitHub compare(X...X) wastes a request and returns ahead_by 0 anyway.
    const { io, state } = buildIO({
      currentHead: 'FORKHEAD',
      latestSha: 'TIP',
      mergeBase: 'TIP',
      compares: [{ notFound: true }],
    })
    const status = await computeUpdateStatus(io)
    expect(status.fork).toBe(true)
    expect(status.behind).toBe(0)
    expect(status.commits).toEqual([])
    expect(status.baseSha).toBeUndefined()
    expect(status.error).toBeUndefined()
    // Only the initial HEAD compare ran; the base compare was elided.
    expect(state.fetchCompareCalls).toHaveLength(1)
  })

  it('reports fork=true with behind=0 when there is no upstream merge-base', async () => {
    // A shallow clone or a checkout without `origin/main` cannot produce a
    // merge-base. The status must still degrade cleanly -- a fork without an
    // upstream reference is not an error.
    const { io } = buildIO({
      currentHead: 'FORKHEAD',
      latestSha: 'TIP',
      mergeBase: '',
      compares: [{ notFound: true }],
    })
    const status = await computeUpdateStatus(io)
    expect(status.fork).toBe(true)
    expect(status.behind).toBe(0)
    expect(status.baseSha).toBeUndefined()
    expect(status.error).toBeUndefined()
  })

  it('sets a descriptive error when even the base compare 404s', async () => {
    // Pathological case: the merge-base sha is not on the remote either
    // (e.g. the fork rebased against an upstream that force-pushed history).
    // The dashboard should not silently report behind=0 -- the user needs to
    // know the compare is incomplete.
    const { io } = buildIO({
      currentHead: 'FORKHEAD',
      latestSha: 'TIP',
      mergeBase: 'ORPHANBASE',
      compares: [{ notFound: true }, { notFound: true }],
    })
    const status = await computeUpdateStatus(io)
    expect(status.fork).toBe(true)
    expect(status.error).toMatch(/Local HEAD not found on GitHub/)
    expect(status.baseSha).toBeUndefined()
  })

  it('sets a descriptive error when the base compare hits a transport failure', async () => {
    // null from fetchCompare maps to "transport / parse failure" (5xx, JSON
    // error, etc.). Same surface as the 404-on-base case: report it instead
    // of silently zeroing the badge.
    const { io } = buildIO({
      currentHead: 'FORKHEAD',
      latestSha: 'TIP',
      mergeBase: 'OK',
      compares: [{ notFound: true }, null],
    })
    const status = await computeUpdateStatus(io)
    expect(status.fork).toBe(true)
    expect(status.error).toMatch(/Local HEAD not found on GitHub/)
  })
})

describe('computeUpdateStatus -- latest fetch error', () => {
  it('surfaces the GitHub error message on `status.error`', async () => {
    const { io, state } = buildIO({
      currentHead: 'HEAD',
      latestSha: () => Promise.reject(new Error('GitHub /commits/main -> 503')),
    })
    const status = await computeUpdateStatus(io)
    expect(status.error).toBe('GitHub /commits/main -> 503')
    expect(status.latest).toBe('')
    expect(state.fetchCompareCalls).toEqual([])
  })
})

describe('computeUpdateStatus -- direct compare null (5xx)', () => {
  it('does not crash and leaves the status mostly empty (no fork fallback)', async () => {
    // null on the direct HEAD compare is a transport failure, NOT a fork
    // signal. We must not flip fork=true on it -- that would mark every
    // transient GitHub blip as a divergent HEAD.
    const { io, state } = buildIO({
      currentHead: 'HEAD',
      latestSha: 'TIP',
      compares: [null],
    })
    const status = await computeUpdateStatus(io)
    expect(status.fork).toBeUndefined()
    expect(status.behind).toBe(0)
    expect(status.commits).toEqual([])
    expect(status.error).toBeUndefined()  // soft-degrade: keep showing the last cache
    expect(state.upstreamMergeBaseCalls).toBe(0)
  })
})

describe('computeUpdateStatus -- lastChecked stamp', () => {
  it('uses io.now() so callers can mock the clock', async () => {
    const { io } = buildIO({ now: 42 })
    const status: UpdateStatus = await computeUpdateStatus(io)
    expect(status.lastChecked).toBe(42)
  })
})
