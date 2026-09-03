import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mkdtempSync, mkdirSync, symlinkSync, rmSync, existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// PROJECTS_DIR and PROJECT_ROOT are resolved at module load, so the fixture
// has to be in place before token-usage.js is imported.
const HOME = mkdtempSync(join(tmpdir(), 'tu-home-'))
const ROOT = mkdtempSync(join(tmpdir(), 'tu-root-'))
const SHARED = join(HOME, '.claude', 'projects')

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return { ...actual, homedir: () => HOME }
})
vi.mock('../config.js', () => ({ MAIN_AGENT_ID: 'cuzcoo', PROJECT_ROOT: ROOT }))
vi.mock('../logger.js', () => ({ logger: { info() {}, warn() {}, error() {}, debug() {} } }))
vi.mock('../db.js', () => ({ getDb: () => { throw new Error('db not used in this test') } }))
vi.mock('../web/agent-config.js', () => ({ listAgentNames: () => ['kronk', 'chicha', 'yzma'] }))
vi.mock('../web/claude-plans.js', () => ({
  resolveAgentConfigDirForRead: (name: string) => join(ROOT, 'agents', name, '.claude-config'),
}))

let discoverAgentSources: typeof import('../web/token-usage.js').discoverAgentSources

beforeAll(async () => {
  mkdirSync(SHARED, { recursive: true })
  // Shared root: each agent's own project dir, plus the main agent's.
  mkdirSync(join(SHARED, '-home-x-agents-kronk'))
  mkdirSync(join(SHARED, '-home-x-agents-chicha'))
  mkdirSync(join(SHARED, ROOT.replace(/[^a-zA-Z0-9-]/g, '-')))

  // kronk + chicha: "isolated" config dir whose projects/ is really a SYMLINK
  // back onto the shared root -- the fleet's actual provisioning.
  for (const name of ['kronk', 'chicha']) {
    const cfg = join(ROOT, 'agents', name, '.claude-config')
    mkdirSync(cfg, { recursive: true })
    symlinkSync(SHARED, join(cfg, 'projects'))
  }
  // yzma: a genuinely separate isolated root.
  mkdirSync(join(ROOT, 'agents', 'yzma', '.claude-config', 'projects', '-home-x-agents-yzma'), { recursive: true })
  ;({ discoverAgentSources } = await import('../web/token-usage.js'))
})

afterAll(() => {
  for (const d of [HOME, ROOT]) if (existsSync(d)) rmSync(d, { recursive: true, force: true })
})

describe('discoverAgentSources', () => {
  it('never attributes one real project dir to two agents', () => {
    const sources = discoverAgentSources(ROOT)
    // Keyed by REAL path: two agents reaching one directory through different
    // symlinks are still two claims on the same transcripts.
    const byDir = new Map<string, string[]>()
    for (const s of sources) {
      const real = realpathSync(s.projectDir)
      if (!byDir.has(real)) byDir.set(real, [])
      byDir.get(real)!.push(s.agent)
    }
    for (const [dir, agents] of byDir) {
      expect(agents, `${dir} claimed by ${agents.join(', ')}`).toHaveLength(1)
    }
  })

  it('ignores an isolated projects dir that is a symlink to the shared root', () => {
    const sources = discoverAgentSources(ROOT)
    // kronk keeps exactly its own shared-root dir, found by encoded name -- not
    // one source per entry in the shared root (which is what produced
    // near-identical fleet-wide totals on 2026-09-03).
    const kronk = sources.filter((s) => s.agent === 'kronk')
    expect(kronk).toHaveLength(1)
    expect(kronk[0].projectDir).toBe(join(SHARED, '-home-x-agents-kronk'))
    // Nothing claims another agent's dir.
    expect(sources.some((s) => s.agent === 'kronk' && s.projectDir.endsWith('-agents-chicha'))).toBe(false)
  })

  it('still reads a genuinely isolated config dir', () => {
    const sources = discoverAgentSources(ROOT)
    const yzma = sources.filter((s) => s.agent === 'yzma')
    expect(yzma).toHaveLength(1)
    expect(yzma[0].projectDir).toBe(join(ROOT, 'agents', 'yzma', '.claude-config', 'projects', '-home-x-agents-yzma'))
  })

  it('attributes the main agent its own project dir', () => {
    const sources = discoverAgentSources(ROOT)
    const main = sources.filter((s) => s.agent === 'cuzcoo')
    expect(main).toHaveLength(1)
  })
})
