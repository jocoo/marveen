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
  // Set when the local HEAD has diverged from remote main: the closest
  // ancestor of HEAD that exists upstream. `behind` is then measured
  // baseSha..latest, and `localAhead` counts baseSha..HEAD.
  baseSha?: string
  localAhead?: number
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

// Walk parents of `localSha` and return the first SHA that exists on the
// remote. Returns null if none of the last `maxWalk` ancestors are found
// upstream, or on git/network failure. Each parent costs one GitHub API
// call (HEAD /commits/<sha>) -- caller bears the rate-limit budget.
async function findFirstUpstreamAncestor(
  localSha: string,
  remote: string,
  maxWalk = 20,
): Promise<string | null> {
  let ancestors: string[]
  try {
    const raw = execFileSync('/usr/bin/git', ['log', '--format=%H', `-n${maxWalk + 1}`, localSha], {
      cwd: PROJECT_ROOT, timeout: 3000, encoding: 'utf-8',
    })
    // Skip the first line: it is localSha itself, already known to 404.
    ancestors = raw.trim().split('\n').slice(1)
  } catch {
    return null
  }
  for (const sha of ancestors) {
    try {
      const res = await fetch(`https://api.github.com/repos/${remote}/commits/${sha}`, {
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'marveen-update-check' },
      })
      if (res.ok) return sha
      if (res.status !== 404 && res.status !== 422) return null
    } catch {
      return null
    }
  }
  return null
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

export async function refreshUpdateStatus(): Promise<UpdateStatus> {
  const current = currentGitHead()
  const remote = parseGitHubRemote()
  const status: UpdateStatus = {
    current,
    latest: '',
    behind: 0,
    commits: [],
    remote,
    lastChecked: Date.now(),
  }
  if (!current) {
    status.error = 'Not a git checkout'
    updateStatusCache = status
    return status
  }
  try {
    // 1) find HEAD of default branch (main) via the commits endpoint
    const latestRes = await fetch(`https://api.github.com/repos/${remote}/commits/main`, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'marveen-update-check' },
    })
    if (!latestRes.ok) throw new Error(`GitHub /commits/main -> ${latestRes.status}`)
    const latestJson = await latestRes.json() as { sha?: string }
    if (!latestJson.sha) throw new Error('No sha on commits/main response')
    status.latest = latestJson.sha

    if (status.latest === current) {
      updateStatusCache = status
      return status
    }

    // 2) list commits between current and latest via the compare endpoint
    const cmpRes = await fetch(`https://api.github.com/repos/${remote}/compare/${current}...${status.latest}`, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'marveen-update-check' },
    })
    if (cmpRes.ok) {
      const cmp = await cmpRes.json() as {
        ahead_by?: number
        commits?: { sha: string; commit: { message: string; author: { name: string; date: string } } }[]
      }
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
    } else if (cmpRes.status === 404) {
      // Local HEAD not on the remote. Walk parents to find the closest
      // ancestor that DOES exist upstream, then compare from there. This
      // surfaces the real "behind" count when the user has unpushed local
      // commits on top of an older upstream base.
      const baseSha = await findFirstUpstreamAncestor(current, remote)
      if (baseSha) {
        const baseCmpRes = await fetch(`https://api.github.com/repos/${remote}/compare/${baseSha}...${status.latest}`, {
          headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'marveen-update-check' },
        })
        if (baseCmpRes.ok) {
          const cmp = await baseCmpRes.json() as {
            ahead_by?: number
            commits?: { sha: string; commit: { message: string; author: { name: string; date: string } } }[]
          }
          status.behind = cmp.ahead_by ?? 0
          const raw = (cmp.commits ?? []).slice().reverse()
          status.commits = raw.map(c => ({
            sha: c.sha,
            short: c.sha.slice(0, 7),
            message: (c.commit.message || '').split('\n')[0],
            author: c.commit.author?.name || '',
            date: c.commit.author?.date || '',
          }))
          status.baseSha = baseSha
          status.localAhead = countCommitsAhead(baseSha)
        } else {
          status.error = 'Local HEAD not found on GitHub -- different fork or unpushed commits?'
        }
      } else {
        status.error = 'Local HEAD not found on GitHub -- different fork or unpushed commits?'
      }
    }
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err)
  }
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
