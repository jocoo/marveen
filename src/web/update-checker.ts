import { execFileSync } from 'node:child_process'
import { PROJECT_ROOT } from '../config.js'

export interface UpdateCommit {
  sha: string
  short: string
  message: string
  author: string
  date: string
}

export interface UpdateStatus {
  current: string
  latest: string
  behind: number
  commits: UpdateCommit[]
  remote: string
  lastChecked: number
  error?: string
  /** True when the local HEAD is not on the GitHub remote (a customised fork);
   * `behind`/`commits` are then computed from the upstream merge-base. */
  fork?: boolean
  // Set when the local HEAD has diverged from remote main: the closest
  // ancestor of HEAD that exists upstream. `behind` is then measured
  // baseSha..latest, and `localAhead` counts baseSha..HEAD.
  baseSha?: string
  localAhead?: number
}

export type GhCompare = {
  ahead_by?: number
  commits?: { sha: string; commit: { message: string; author: { name: string; date: string } } }[]
}

/**
 * I/O surface that the update-check logic consumes. Split from the pure
 * decision flow so tests can substitute stub fetchers/git callers without
 * spawning real git or hitting GitHub. `defaultUpdateCheckerIO()` wires the
 * production implementation (execFileSync + global fetch); production code
 * never has to think about this seam.
 */
export interface UpdateCheckerIO {
  /** Return the GitHub remote in `Owner/Repo` form, or the upstream default
   * (`Szotasz/marveen`) when origin.url is unparseable or absent. */
  parseGitHubRemote(): string
  /** SHA of local HEAD, or '' on any git failure (signals "not a checkout"). */
  currentGitHead(): string
  /** Merge-base of local HEAD with `origin/main`, or '' when no tracking ref
   * exists (e.g. a shallow clone, or a fork without `origin/main` configured). */
  upstreamMergeBase(): string
  /** Count of `baseSha..HEAD` commits, or 0 on any failure. */
  countCommitsAhead(baseSha: string): number
  /** Fetch the SHA of `remote`'s default branch (main). Throws on failure. */
  fetchLatestSha(remote: string): Promise<string>
  /** Fetch the GitHub compare of `base...head`. Returns parsed body on 2xx,
   * `{ notFound: true }` on 404 (base/head not on remote), `null` on any
   * other transport / parse failure. */
  fetchCompare(remote: string, base: string, head: string): Promise<GhCompare | { notFound: true } | null>
  /** Clock for the `lastChecked` field. Injectable so tests don't sleep. */
  now(): number
}

let updateStatusCache: UpdateStatus = {
  current: '',
  latest: '',
  behind: 0,
  commits: [],
  remote: 'Szotasz/marveen',
  lastChecked: 0,
}

export function getUpdateStatus(): UpdateStatus {
  return updateStatusCache
}

export function currentGitHead(): string {
  try {
    return execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT, timeout: 3000, encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

// Count commits on `baseSha..HEAD` (i.e. local commits that aren't on the
// shared upstream ancestor). Returns 0 on any failure rather than throwing.
function countCommitsAhead(baseSha: string): number {
  try {
    const raw = execFileSync('/usr/bin/git', ['rev-list', '--count', `${baseSha}..HEAD`], {
      cwd: PROJECT_ROOT, timeout: 3000, encoding: 'utf-8',
    }).trim()
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function parseGitHubRemote(): string {
  try {
    const url = execFileSync('/usr/bin/git', ['config', '--get', 'remote.origin.url'], { cwd: PROJECT_ROOT, timeout: 3000, encoding: 'utf-8' }).trim()
    // Normalize "git@github.com:Owner/Repo.git" or "https://github.com/Owner/Repo.git" to "Owner/Repo"
    const m = url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i)
    if (m) return m[1]
  } catch { /* fall through */ }
  return 'Szotasz/marveen'
}

const GH_HEADERS = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'marveen-update-check' }

// Fetch the GitHub compare of base...head. Returns the parsed body, the
// sentinel { notFound: true } on a 404 (base or head not on the remote), or
// null on any other failure.
async function fetchCompare(remote: string, base: string, head: string): Promise<GhCompare | { notFound: true } | null> {
  const res = await fetch(`https://api.github.com/repos/${remote}/compare/${base}...${head}`, { headers: GH_HEADERS })
  if (res.ok) return await res.json() as GhCompare
  if (res.status === 404) return { notFound: true }
  return null
}

async function fetchLatestSha(remote: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${remote}/commits/main`, { headers: GH_HEADERS })
  if (!res.ok) throw new Error(`GitHub /commits/main -> ${res.status}`)
  const body = await res.json() as { sha?: string }
  if (!body.sha) throw new Error('No sha on commits/main response')
  return body.sha
}

// Merge-base of local HEAD with the upstream tracking ref (origin/main, which
// parseGitHubRemote maps to the GitHub remote). For a customised fork this is
// the fork point -- an actual upstream commit -- so it can be compared on
// GitHub even though the local HEAD itself never landed there. Empty string
// when there is no local upstream ref.
function upstreamMergeBase(): string {
  try {
    return execFileSync('/usr/bin/git', ['merge-base', 'HEAD', 'origin/main'], { cwd: PROJECT_ROOT, timeout: 3000, encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

/** Production IO bundle: wires execFileSync git + global fetch + Date.now. */
export function defaultUpdateCheckerIO(): UpdateCheckerIO {
  return {
    parseGitHubRemote,
    currentGitHead,
    upstreamMergeBase,
    countCommitsAhead,
    fetchLatestSha,
    fetchCompare,
    now: () => Date.now(),
  }
}

// Map a GitHub compare body onto the status (behind count + newest-first commit
// list).
function applyCompare(status: UpdateStatus, cmp: GhCompare): void {
  status.behind = cmp.ahead_by ?? 0
  // GitHub returns commits oldest-first; flip to newest-first for the UI.
  const raw = (cmp.commits ?? []).slice().reverse()
  status.commits = raw.map(c => ({
    sha: c.sha,
    short: c.sha.slice(0, 7),
    message: (c.commit.message || '').split('\n')[0],
    author: c.commit.author?.name || '',
    date: c.commit.author?.date || '',
  }))
}

/**
 * Pure update-check decision flow. Given an IO bundle, produce the status
 * the dashboard renders. Three main branches:
 *
 *   1. Not a git checkout (head '') -> error 'Not a git checkout'.
 *   2. Latest sha matches HEAD -> behind 0, no compare call.
 *   3. HEAD differs from latest -> try direct compare(HEAD, latest). If
 *      404, the HEAD isn't on the remote (customised fork); fall back to
 *      compare(mergeBase, latest) and report fork=true + baseSha + localAhead.
 *
 * Errors anywhere in the network path are surfaced on `status.error` instead
 * of thrown -- the dashboard renders a degraded badge but keeps running.
 */
export async function computeUpdateStatus(io: UpdateCheckerIO): Promise<UpdateStatus> {
  const current = io.currentGitHead()
  const remote = io.parseGitHubRemote()
  const status: UpdateStatus = {
    current,
    latest: '',
    behind: 0,
    commits: [],
    remote,
    lastChecked: io.now(),
  }
  if (!current) {
    status.error = 'Not a git checkout'
    return status
  }
  try {
    status.latest = await io.fetchLatestSha(remote)

    if (status.latest === current) return status

    const cmp = await io.fetchCompare(remote, current, status.latest)
    if (cmp && !('notFound' in cmp)) {
      applyCompare(status, cmp)
    } else if (cmp && 'notFound' in cmp) {
      // Local HEAD is not a commit on the GitHub remote -- the normal state of a
      // customised fork carrying local commits on top of upstream. Comparing the
      // raw HEAD 404s forever, surfacing as a permanent scary error. Fall back to
      // the upstream merge-base (our fork point, which IS an upstream commit) so
      // `behind`/`commits` reflect genuinely new upstream commits rather than the
      // fork divergence.
      status.fork = true
      const base = io.upstreamMergeBase()
      if (!base || base === status.latest) {
        // No local upstream ref, or the fork point already is the upstream tip:
        // nothing new upstream. A fork being ahead of upstream is expected, not
        // an error.
        status.behind = 0
      } else {
        const baseCmp = await io.fetchCompare(remote, base, status.latest)
        if (baseCmp && !('notFound' in baseCmp)) {
          applyCompare(status, baseCmp)
          status.baseSha = base
          status.localAhead = io.countCommitsAhead(base)
        } else {
          status.error = 'Local HEAD not found on GitHub -- different fork or unpushed commits?'
        }
      }
    }
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err)
  }
  return status
}

export async function refreshUpdateStatus(): Promise<UpdateStatus> {
  const status = await computeUpdateStatus(defaultUpdateCheckerIO())
  updateStatusCache = status
  return status
}

// Polls the GitHub repo's main branch for new commits and compares to the
// local HEAD. Lets the dashboard show a "new version available" badge
// without anyone having to SSH in and run update.sh.
export function startUpdateChecker(): NodeJS.Timeout {
  // First check shortly after startup; then every 15 minutes.
  setTimeout(() => { refreshUpdateStatus().catch(() => {}) }, 10_000)
  return setInterval(() => { refreshUpdateStatus().catch(() => {}) }, 15 * 60_000)
}
