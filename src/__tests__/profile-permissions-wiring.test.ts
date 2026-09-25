import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildResolvedPermissions } from '../web/agent-scaffold.js'
import type { ProfileTemplate } from '../web/profiles.js'
import { PROFILES_DIR } from '../web/profiles.js'

// Guardrail against the #92-style regression: a profile template's
// permissions.allow entries have to end up in the resolved permissions
// object that the writer stamps into per-agent settings.json. Before the
// filesystem→permissions rename, the writer only read profile.filesystem.*,
// so any tool listed exclusively under profile.permissions.* was dead code
// (silent drop). These tests fail loudly if the wiring regresses again.

const CTX = { HOME: '/home/testuser', AGENT_DIR: '/srv/app/agents/nina' } as const

describe('buildResolvedPermissions', () => {
  it('propagates permissions.allow entries verbatim (identity tools)', () => {
    const profile: ProfileTemplate = {
      id: 'test',
      label: 'test',
      description: 'test',
      permissionMode: 'permissive',
      permissions: {
        allow: ['mcp__plugin_foo__bar', 'WebFetch(*)'],
        deny: [],
      },
    }
    const out = buildResolvedPermissions(profile, CTX, false)
    expect(out.allow).toEqual(['mcp__plugin_foo__bar', 'WebFetch(*)'])
    expect(out.deny).toEqual([])
  })

  // File rules come out '//'-prefixed: a single leading '/' is project-relative
  // in Claude Code rules (upstream TMPLPERM908).
  it('resolves ${AGENT_DIR} and ${HOME} placeholders in both allow and deny', () => {
    const profile: ProfileTemplate = {
      id: 'test',
      label: 'test',
      description: 'test',
      permissionMode: 'strict',
      permissions: {
        allow: ['Read(${AGENT_DIR}/**)', 'Write(${HOME}/Downloads/**)'],
        deny: ['Read(${HOME}/.ssh/**)'],
      },
    }
    const out = buildResolvedPermissions(profile, CTX, false)
    expect(out.allow).toContain('Read(//srv/app/agents/nina/**)')
    expect(out.allow).toContain('Write(//home/testuser/Downloads/**)')
    expect(out.deny).toContain('Read(//home/testuser/.ssh/**)')
  })

  it('appends self-pace tool-name deny when the governance flag is on', () => {
    const profile: ProfileTemplate = {
      id: 'test',
      label: 'test',
      description: 'test',
      permissionMode: 'permissive',
      permissions: { allow: [], deny: ['mcp__claude_ai_Supabase__*'] },
    }
    const gated = buildResolvedPermissions(profile, CTX, true)
    const ungated = buildResolvedPermissions(profile, CTX, false)
    // Baseline deny entry survives in both.
    expect(gated.deny).toContain('mcp__claude_ai_Supabase__*')
    expect(ungated.deny).toContain('mcp__claude_ai_Supabase__*')
    // Governance-only additions.
    expect(gated.deny).toEqual(expect.arrayContaining([
      'ScheduleWakeup', 'CronCreate', 'CronDelete', 'CronList', 'RemoteTrigger',
    ]))
    for (const t of ['ScheduleWakeup', 'CronCreate', 'CronDelete', 'CronList', 'RemoteTrigger']) {
      expect(ungated.deny).not.toContain(t)
    }
  })

  it('does not mutate the input profile arrays', () => {
    const allow = ['mcp__foo__bar']
    const deny = ['mcp__baz__*']
    const profile: ProfileTemplate = {
      id: 'test',
      label: 'test',
      description: 'test',
      permissionMode: 'permissive',
      permissions: { allow, deny },
    }
    buildResolvedPermissions(profile, CTX, true)
    // Original arrays must not have grown (self-pace deny was pushed onto a
    // fresh mapped copy, not the caller's slice).
    expect(allow).toEqual(['mcp__foo__bar'])
    expect(deny).toEqual(['mcp__baz__*'])
  })
})

// Regression: the 4 Telegram plugin tools have to land in every shipped
// profile's permissions.allow list (channel-plugin agents can't reply
// without them). The 2026-07 #92 incident was exactly this: the tools
// were added under the wrong JSON key and the writer silently dropped
// them. This test locks the ship-side of that contract.
const TELEGRAM_TOOLS = [
  'mcp__plugin_telegram_telegram__react',
  'mcp__plugin_telegram_telegram__reply',
  'mcp__plugin_telegram_telegram__edit_message',
  'mcp__plugin_telegram_telegram__download_attachment',
] as const

describe('shipped profile templates', () => {
  it('default profile carries the 4 telegram tools in permissions.allow', () => {
    const raw = readFileSync(join(PROFILES_DIR, 'default.json'), 'utf-8')
    const profile = JSON.parse(raw) as ProfileTemplate
    for (const t of TELEGRAM_TOOLS) {
      expect(profile.permissions.allow).toContain(t)
    }
  })

  it('every shipped profile uses the `permissions` key (no legacy `filesystem` key)', () => {
    for (const f of readdirSync(PROFILES_DIR)) {
      if (!f.endsWith('.json')) continue
      const parsed = JSON.parse(readFileSync(join(PROFILES_DIR, f), 'utf-8')) as Record<string, unknown>
      expect(parsed, `${f} must define permissions`).toHaveProperty('permissions')
      expect(parsed, `${f} still has legacy filesystem key`).not.toHaveProperty('filesystem')
    }
  })

  it('every shipped profile survives buildResolvedPermissions (no undefined-access crash)', () => {
    for (const f of readdirSync(PROFILES_DIR)) {
      if (!f.endsWith('.json')) continue
      const profile = JSON.parse(readFileSync(join(PROFILES_DIR, f), 'utf-8')) as ProfileTemplate
      expect(() => buildResolvedPermissions(profile, CTX, false)).not.toThrow()
      expect(() => buildResolvedPermissions(profile, CTX, true)).not.toThrow()
    }
  })
})
