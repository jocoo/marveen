// Unit tests for `decideOrphanPollerAlive` -- the state-dir-scoped orphan-poller
// fallback added to close the fleet-wide idle-sub-agent restart churn observed
// after the 2026-08-23 agents/ relocation.
//
// A telegram poller that has reparented OUT of the claude process tree is missed
// by the tree-walk in decideHasPluginAlive, but it is still delivering via the
// inbox (delivery is inbox/DB + tmux-injection, parentage-independent). This
// fallback recognises such a poller as alive -- BUT scoped to THIS agent's state
// dir via the `<PROVIDER>_STATE_DIR=<stateDir>` env match, so it never credits
// another telegram sub-agent's poller (the multi-agent masking gap that kept
// telegram out of the slack/discord global cmd-scan; see #338).

import { describe, it, expect } from 'vitest'
import { decideOrphanPollerAlive } from '../channel-coordinator/liveness.js'

// `ps eww -e` rows: leading pid, then command, then the process environment
// inline. parsePollerPidsFromPs matches the `<envVar>=<value>` substring and
// extracts the leading pid, so the row only needs those two facts to be faithful.
const PS_HEADER = '  PID TTY      STAT   TIME COMMAND'

function psEnv(rows: Array<{ pid: number; command: string; env?: string }>): string {
  const body = rows
    .map(r => `${String(r.pid).padStart(5)} ?        S      0:00 ${r.command}${r.env ? ' ' + r.env : ''}`)
    .join('\n')
  return PS_HEADER + '\n' + body
}

const AGENT_DIR = '/home/jocoo/marveen/agents/yzma/.claude/channels/telegram'
const OTHER_AGENT_DIR = '/home/jocoo/marveen/agents/chicha/.claude/channels/telegram'
const BUN_CMD =
  'bun run --cwd /home/jocoo/.claude/plugins/cache/claude-plugins-official/telegram/0.0.7 --shell=bun --silent start'

const ALL_ALIVE = () => true
const NONE_ALIVE = () => false

describe('decideOrphanPollerAlive', () => {
  it('alive: a live poller carrying THIS agent state dir in its env (reparented orphan)', () => {
    const out = psEnv([{ pid: 4322, command: BUN_CMD, env: `TELEGRAM_STATE_DIR=${AGENT_DIR}` }])
    expect(decideOrphanPollerAlive(out, 'telegram', AGENT_DIR, ALL_ALIVE)).toBe(true)
  })

  it('down: a poller for ANOTHER agent state dir must NOT be credited (no cross-agent masking)', () => {
    const out = psEnv([{ pid: 4322, command: BUN_CMD, env: `TELEGRAM_STATE_DIR=${OTHER_AGENT_DIR}` }])
    expect(decideOrphanPollerAlive(out, 'telegram', AGENT_DIR, ALL_ALIVE)).toBe(false)
  })

  it('down: a matching pid that is no longer alive is not counted', () => {
    const out = psEnv([{ pid: 4322, command: BUN_CMD, env: `TELEGRAM_STATE_DIR=${AGENT_DIR}` }])
    expect(decideOrphanPollerAlive(out, 'telegram', AGENT_DIR, NONE_ALIVE)).toBe(false)
  })

  it('down: no poller bound to this state dir at all', () => {
    const out = psEnv([{ pid: 9, command: BUN_CMD, env: 'TELEGRAM_STATE_DIR=/somewhere/else' }])
    expect(decideOrphanPollerAlive(out, 'telegram', AGENT_DIR, ALL_ALIVE)).toBe(false)
  })

  it('alive: at least one of several matching pids is alive', () => {
    const out = psEnv([
      { pid: 4322, command: BUN_CMD, env: `TELEGRAM_STATE_DIR=${AGENT_DIR}` },
      { pid: 4940, command: BUN_CMD, env: `TELEGRAM_STATE_DIR=${AGENT_DIR}` },
    ])
    const onlySecondAlive = (pid: number) => pid === 4940
    expect(decideOrphanPollerAlive(out, 'telegram', AGENT_DIR, onlySecondAlive)).toBe(true)
  })
})
