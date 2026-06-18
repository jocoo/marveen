import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Kanban #a2932839. The /api/marveen/avatar endpoint used to serve
// `store/marveen-avatar.<ext>` regardless of MAIN_AGENT_ID, leaking the
// upstream brand into installs that ran under a different id. Avatar
// resolution now prefers `${MAIN_AGENT_ID}-avatar.<ext>` and lazily
// migrates the legacy file on first read.

// findMainAgentAvatar reads PROJECT_ROOT + MAIN_AGENT_ID from the config
// module at import time, so we have to mock that before importing the
// route module.

let tmpRoot: string

function mountFakeRoot(mainAgentId: string): string {
  const root = mkdtempSync(join(tmpdir(), 'avatar-test-'))
  require('node:fs').mkdirSync(join(root, 'store'), { recursive: true })
  vi.resetModules()
  vi.doMock('../config.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../config.js')>()
    return {
      ...actual,
      PROJECT_ROOT: root,
      STORE_DIR: join(root, 'store'),
      MAIN_AGENT_ID: mainAgentId,
    }
  })
  return root
}

beforeEach(() => {
  tmpRoot = mountFakeRoot('cuzcoo')
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
  vi.resetModules()
  vi.doUnmock('../config.js')
})

describe('findMainAgentAvatar', () => {
  it('returns null when neither new nor legacy avatar exists', async () => {
    const mod = await import('../web/routes/marveen.js')
    expect(mod.findMainAgentAvatar()).toBeNull()
  })

  it('prefers the MAIN_AGENT_ID-named file over the legacy file', async () => {
    writeFileSync(join(tmpRoot, 'store', 'cuzcoo-avatar.png'), 'new')
    writeFileSync(join(tmpRoot, 'store', 'marveen-avatar.png'), 'legacy')
    const mod = await import('../web/routes/marveen.js')
    const p = mod.findMainAgentAvatar()
    expect(p).not.toBeNull()
    expect(readFileSync(p!, 'utf-8')).toBe('new')
  })

  it('walks the extension list in the documented order: png > jpg > jpeg > webp', async () => {
    // Both a webp (new) and a png (new) live in store. PNG wins because it
    // comes first in AVATAR_EXTENSIONS and the resolver short-circuits on
    // the first existing file.
    writeFileSync(join(tmpRoot, 'store', 'cuzcoo-avatar.webp'), 'webp')
    writeFileSync(join(tmpRoot, 'store', 'cuzcoo-avatar.png'), 'png')
    const mod = await import('../web/routes/marveen.js')
    const p = mod.findMainAgentAvatar()
    expect(p!.endsWith('.png')).toBe(true)
  })

  it('falls back to the legacy marveen-avatar file when the new name is missing', async () => {
    writeFileSync(join(tmpRoot, 'store', 'marveen-avatar.png'), 'legacy')
    const mod = await import('../web/routes/marveen.js')
    const p = mod.findMainAgentAvatar({ copyOnMigrate: false })
    expect(p).not.toBeNull()
    expect(readFileSync(p!, 'utf-8')).toBe('legacy')
    // Without copyOnMigrate the new file should NOT be created.
    expect(existsSync(join(tmpRoot, 'store', 'cuzcoo-avatar.png'))).toBe(false)
  })

  it('lazily migrates legacy -> new file on first read when copyOnMigrate is on', async () => {
    writeFileSync(join(tmpRoot, 'store', 'marveen-avatar.png'), 'legacy')
    const mod = await import('../web/routes/marveen.js')
    const p = mod.findMainAgentAvatar({ copyOnMigrate: true })
    expect(p).not.toBeNull()
    // After migration the resolver should return the NEW path so subsequent
    // reads skip the legacy lookup.
    expect(p!.endsWith('cuzcoo-avatar.png')).toBe(true)
    expect(existsSync(join(tmpRoot, 'store', 'cuzcoo-avatar.png'))).toBe(true)
    // And both files now exist (we copy, not move); a subsequent POST will
    // clear both via clearAllAvatarFiles().
    expect(existsSync(join(tmpRoot, 'store', 'marveen-avatar.png'))).toBe(true)
    expect(readFileSync(p!, 'utf-8')).toBe('legacy')
  })
})

describe('findMainAgentAvatar -- marveen-branded install (MAIN_AGENT_ID=marveen)', () => {
  beforeEach(() => {
    // Re-mount the same fake root but switch the configured id, so the
    // resolver looks for `marveen-avatar.<ext>` instead of `cuzcoo-avatar.<ext>`.
    tmpRoot = mountFakeRoot('marveen')
  })

  it('does NOT redundantly self-copy when the canonical name IS marveen-avatar', async () => {
    // For a vanilla marveen install, `<id>-avatar` and `legacy-avatar`
    // happen to be the same path. The new-path resolver finds it on the
    // first pass and the legacy branch is never entered, so we never try
    // to copyFileSync(marveen-avatar.png, marveen-avatar.png) (which would
    // be a no-op but a wasted syscall and a misleading log).
    writeFileSync(join(tmpRoot, 'store', 'marveen-avatar.png'), 'legacy')
    const mod = await import('../web/routes/marveen.js')
    const p = mod.findMainAgentAvatar({ copyOnMigrate: true })
    expect(p).not.toBeNull()
    expect(p!.endsWith('marveen-avatar.png')).toBe(true)
    expect(readFileSync(p!, 'utf-8')).toBe('legacy')
  })
})
