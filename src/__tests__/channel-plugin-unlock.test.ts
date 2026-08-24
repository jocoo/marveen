import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Contract tests for the in-process post-respawn channel-plugin unlock helper.
//
// The unlock keystrokes (/mcp + Up + Enter + Enter) are only safe to deliver
// when (a) the bun poller is provably ABSENT under the new claude pid and
// (b) the pane is at the idle bypass-permissions footer. The 2026-06-01 18:55
// channel-disconnect incident was caused precisely by an unlock-while-already-
// running cycle that toggled the plugin to `◯ disabled`. These tests pin the
// safety gates so a future refactor cannot quietly drop them.

const REPO_ROOT = join(__dirname, '../..')
const HELPER_PATH = join(REPO_ROOT, 'src/web/channel-plugin-unlock.ts')
const MONITOR_PATH = join(REPO_ROOT, 'src/web/channel-monitor.ts')

const helper = readFileSync(HELPER_PATH, 'utf-8')
const monitor = readFileSync(MONITOR_PATH, 'utf-8')

describe('channel-plugin-unlock helper contract', () => {
  it('exports schedulePluginUnlockAfterRespawn for the channel-monitor respawn paths', () => {
    expect(helper).toMatch(/export\s+function\s+schedulePluginUnlockAfterRespawn\b/)
  })

  it('gates the keystrokes on the absence of a bun child under the claude pid', () => {
    // The bun-child probe is the single most important safety check: if a
    // bun poller is alive, the plugin is running and Up+Enter+Enter would
    // navigate to "Disable", killing a healthy channel.
    expect(helper).toMatch(/pgrep/)
    expect(helper).toMatch(/hasBunChild/)
    // The unlock keystrokes path must be reachable ONLY when hasBunChild is
    // false - assert by checking the early-return branch precedes the
    // keystroke call inside runUnlockProbe.
    const probeStart = helper.indexOf('function runUnlockProbe')
    expect(probeStart, 'runUnlockProbe not found').toBeGreaterThan(0)
    const probeEnd = helper.indexOf('\n}\n', probeStart)
    const probeBody = helper.slice(probeStart, probeEnd > probeStart ? probeEnd : undefined)
    const bunIdx = probeBody.indexOf('hasBunChild(')
    const sendIdx = probeBody.indexOf('sendUnlockKeystrokes(')
    expect(bunIdx).toBeGreaterThan(0)
    expect(sendIdx).toBeGreaterThan(bunIdx)
    // Ensure the hasBunChild branch returns before sendUnlockKeystrokes.
    const between = probeBody.slice(bunIdx, sendIdx)
    expect(between).toMatch(/return\b/)
  })

  it('refuses to send keystrokes if the pane shows a modal or non-idle state', () => {
    // isSessionReadyForUnlock must reject "Resume from summary" and the
    // macOS permissions dialog - those signatures mean the keystrokes
    // would land in the wrong context.
    expect(helper).toMatch(/Resume from summary/)
    expect(helper).toMatch(/Open System Settings/)
    // Idle footer requirement: bypass-permissions string must be present.
    expect(helper).toMatch(/bypass permissions on/)
  })

  it('delivers /mcp, Up, Enter, Enter then a VERIFIED dismiss-to-idle (card #382)', () => {
    // Pinning the revive sequence + the verified close:
    //   /mcp + Up + Enter + Enter    -> revive plugin (Enable / Reconnect)
    //   dismissMcpMenuUntilIdle(...)  -> Escape-until-paneLooksIdle, bounded
    // The old fixed "Esc, Esc" tail (#236) was not robust: under a multi-agent
    // cold-start a swallowed Escape left the /mcp modal open with the
    // channel-monitor Escape-observer as the ONLY recovery (card #382). The
    // opener must now own the close via the verified loop, so the observer is a
    // pure backstop. This test forbids a regression back to a blind fixed pair.
    const sendStart = helper.indexOf('function sendUnlockKeystrokes')
    expect(sendStart, 'sendUnlockKeystrokes not found').toBeGreaterThan(0)
    const sendEnd = helper.indexOf('\n}\n', sendStart)
    const sendBody = helper.slice(sendStart, sendEnd > sendStart ? sendEnd : undefined)
    expect(sendBody).toMatch(/'\/mcp',\s*'Enter'/)
    const upIdx = sendBody.indexOf("'Up'")
    expect(upIdx, "'Up' keystroke missing").toBeGreaterThan(0)
    const afterUp = sendBody.slice(upIdx)
    // Exactly two Enters after Up (the two-level revive: submenu open + action).
    const enterMatches = afterUp.match(/send-keys[^]*?'Enter'\]/g) ?? []
    expect(enterMatches.length).toBe(2)
    // The close is the verified dismiss helper, invoked after the last Enter --
    // NOT a fixed count of blind Escape send-keys in this function body.
    const lastEnterIdx = afterUp.lastIndexOf("'Enter'")
    const dismissIdx = afterUp.indexOf('dismissMcpMenuUntilIdle(session)')
    expect(dismissIdx, 'verified dismiss not called after the revive Enters').toBeGreaterThan(lastEnterIdx)
    // No raw Escape send-keys should remain in sendUnlockKeystrokes -- all
    // closing goes through the verified loop.
    expect(afterUp).not.toMatch(/send-keys[^]*?'Escape'\]/)
  })

  it('verified dismiss loop asserts the positive idle state and is bounded', () => {
    // dismissMcpMenuUntilIdle must (a) exist, (b) check paneLooksIdle (positive
    // idle, not merely "no menu" -- the deaf failure is a pane parked 'unknown'
    // which is not a blocking menu), and (c) be bounded by a max-escapes const.
    expect(helper).toMatch(/function\s+dismissMcpMenuUntilIdle\b/)
    const dStart = helper.indexOf('function dismissMcpMenuUntilIdle')
    const dEnd = helper.indexOf('\n}\n', dStart)
    const dBody = helper.slice(dStart, dEnd > dStart ? dEnd : undefined)
    expect(dBody).toMatch(/paneLooksIdle\(/)
    expect(dBody).toMatch(/UNLOCK_DISMISS_MAX_ESC/)
    expect(helper).toMatch(/const\s+UNLOCK_DISMISS_MAX_ESC\s*=\s*\d+/)
  })

  it('re-checks the bun poller after opening /mcp and skips navigation on late-attach (card #382)', () => {
    // Dominant spurious-open cause: bun-child absence at the fixed T+35s probe
    // deadline is a false negative when the poller attaches later during a
    // cold-start. After /mcp is open the code must re-check hasBunChild and, if
    // present, close WITHOUT pressing Up+Enter+Enter (which would hit "Disable"
    // on a now-healthy plugin). Assert the re-check sits AFTER the /mcp open and
    // BEFORE the Up navigation, and returns.
    const sendStart = helper.indexOf('function sendUnlockKeystrokes')
    const sendEnd = helper.indexOf('\n}\n', sendStart)
    const sendBody = helper.slice(sendStart, sendEnd > sendStart ? sendEnd : undefined)
    const openIdx = sendBody.indexOf("'/mcp', 'Enter'")
    const bunIdx = sendBody.indexOf('hasBunChild(claudePid)')
    const upIdx = sendBody.indexOf("'Up'")
    expect(openIdx, '/mcp open not found').toBeGreaterThan(0)
    expect(bunIdx, 'late-attach hasBunChild re-check not found').toBeGreaterThan(openIdx)
    expect(bunIdx, 'bun re-check must precede the Up navigation').toBeLessThan(upIdx)
    // The guard branch must return before navigating.
    const guardBody = sendBody.slice(bunIdx, upIdx)
    expect(guardBody).toMatch(/return\b/)
  })

  it('schedules the probe with a cold-start delay >= 25 seconds', () => {
    // The plugin handshake needs time to complete on cold start; firing
    // the probe too early would always see no bun and trigger a needless
    // unlock cycle. Stay >= 25s to comfortably cover the 8s modal +
    // 5s /name + plugin spawn window observed in channels.sh.
    const m = helper.match(/const\s+UNLOCK_PROBE_DELAY_MS\s*=\s*([\d_]+)/)
    expect(m, 'UNLOCK_PROBE_DELAY_MS constant not found').not.toBeNull()
    const value = parseInt((m![1] as string).replace(/_/g, ''), 10)
    expect(value).toBeGreaterThanOrEqual(25_000)
  })
})

describe('channel-monitor wires the unlock probe into both in-process respawn paths', () => {
  // The 2026-06-01 18:55 root cause was that channels.sh's post-init unlock
  // probe (#231/#232) only runs on the launchd start path - the JS respawn
  // paths (resumeMarveenSession and respawnMarveenSessionFresh) call tmux
  // respawn-pane directly and skipped channels.sh entirely. Both JS paths
  // must now call schedulePluginUnlockAfterRespawn after scheduleIdentitySetup
  // or a Failed/disabled plugin will stay offline indefinitely.

  it('imports schedulePluginUnlockAfterRespawn from channel-plugin-unlock', () => {
    expect(monitor).toMatch(/from\s+'\.\/channel-plugin-unlock\.js'/)
    expect(monitor).toMatch(/schedulePluginUnlockAfterRespawn/)
  })

  function bodyOf(fnName: string): string {
    const start = monitor.indexOf(`function ${fnName}`)
    expect(start, `${fnName} not found`).toBeGreaterThan(0)
    const end = monitor.indexOf('\nfunction ', start + 1)
    return monitor.slice(start, end > start ? end : undefined)
  }

  it('resumeMarveenSession schedules the unlock probe after the respawn', () => {
    const body = bodyOf('resumeMarveenSession')
    expect(body).toMatch(/schedulePluginUnlockAfterRespawn\(MAIN_CHANNELS_SESSION/)
  })

  it('respawnMarveenSessionFresh schedules the unlock probe after the respawn', () => {
    const body = bodyOf('respawnMarveenSessionFresh')
    expect(body).toMatch(/schedulePluginUnlockAfterRespawn\(MAIN_CHANNELS_SESSION/)
  })
})

describe('absent-plugin verdict feeds the down-cascade restart budget', () => {
  // 2026-07-01: rocket + mantis fresh-restarted 5x each on a plugin that was
  // ABSENT from /mcp (never loaded, distinct from Failed/disabled). Fresh
  // restarts cannot reload an absent plugin and each one wipes the agent's
  // session context. The probe records the absent verdict; the monitor caps the
  // restart budget at one for that case. These pin the wiring end to end.

  it('records the absent verdict in the "plugin absent from /mcp list" branch', () => {
    // The absent branch must call markPluginAbsent so the monitor can react;
    // and it must be gated to the absent (not the slow/Failed) case.
    expect(helper).toMatch(/provider plugin absent from \/mcp list/)
    const sendStart = helper.indexOf('function sendUnlockKeystrokes')
    const sendEnd = helper.indexOf('\n}\n', sendStart)
    const sendBody = helper.slice(sendStart, sendEnd > sendStart ? sendEnd : undefined)
    const absentLogIdx = sendBody.indexOf('provider plugin absent from /mcp list')
    const markIdx = sendBody.indexOf('markPluginAbsent(')
    expect(markIdx, 'markPluginAbsent not called in the absent branch').toBeGreaterThan(absentLogIdx)
  })

  it('exports the accessors the monitor reads and clears', () => {
    expect(helper).toMatch(/export\s+function\s+wasPluginConfirmedAbsent\b/)
    expect(helper).toMatch(/export\s+function\s+clearPluginAbsent\b/)
  })

  it('retires the absent verdict once the probe sees the plugin healthy', () => {
    const probeStart = helper.indexOf('function runUnlockProbe')
    const probeEnd = helper.indexOf('\n}\n', probeStart)
    const probeBody = helper.slice(probeStart, probeEnd > probeStart ? probeEnd : undefined)
    const healthyIdx = probeBody.indexOf('plugin healthy')
    const clearIdx = probeBody.indexOf('clearPluginAbsent(')
    expect(clearIdx, 'clearPluginAbsent not called in the healthy branch').toBeGreaterThan(0)
    expect(clearIdx).toBeLessThan(healthyIdx)
  })

  it('monitor caps the restart budget at one attempt when absent-confirmed', () => {
    expect(monitor).toMatch(/wasPluginConfirmedAbsent/)
    expect(monitor).toMatch(/const\s+PLUGIN_ABSENT_MAX_RESTART_ATTEMPTS\s*=\s*1\b/)
    // The absent verdict must select the reduced cap, not the full one.
    expect(monitor).toMatch(/absentConfirmed\s*\n?\s*\?\s*PLUGIN_ABSENT_MAX_RESTART_ATTEMPTS/)
    // And the chosen cap must be what decideDownAgentAction receives.
    expect(monitor).toMatch(/\}\s*,\s*maxRestartAttempts\)/)
  })

  it('monitor clears the absent verdict on a healthy sweep', () => {
    expect(monitor).toMatch(/clearPluginAbsent\(t\.session\)/)
  })
})
