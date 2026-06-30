import { existsSync, unlinkSync, copyFileSync, writeFileSync } from 'node:fs'
import { join, extname } from 'node:path'
import {
  PROJECT_ROOT, OWNER_NAME, BOT_NAME, BRAND_NAME, MAIN_AGENT_ID, CHANNEL_PROVIDER,
  KANBAN_LABEL_COLORS,
} from '../../config.js'
import { getEffectiveSettingValue } from '../../settings-store.js'
import { readMarveenTelegramConfig, readMarveenDiscordConfig, readMarveenSlackConfig, readMarveenGooglechatConfig, readMarveenTeamsConfig, sendMarveenAvatarChange } from '../telegram.js'
import { hardRestartMarveenChannels } from '../channel-monitor.js'
import { readFileOr } from '../agent-config.js'
import { parseMultipart } from '../multipart.js'
import { readBody, json, serveFile } from '../http-helpers.js'
import { MAIN_CHANNELS_SESSION } from '../main-agent.js'
import { readActiveModelFromProjectDir, readContextTokensFromProjectDir } from '../active-model.js'
import { readAutoRestartConfig } from '../auto-restart-store.js'
import type { RouteContext } from './types.js'

function getActiveMarveenModel(): string {
  return readActiveModelFromProjectDir(PROJECT_ROOT) ?? 'unknown'
}

// File-name root for the main agent's avatar. Used to be hardcoded
// `marveen-avatar`, which leaked the upstream brand into a Cuzcoo-/Atlas-/
// whatever-branded install. Now derived from MAIN_AGENT_ID so a fresh
// install gets `<id>-avatar.<ext>` and the legacy `marveen-avatar.<ext>`
// is only consulted via the lazy migration below.
const MAIN_AGENT_AVATAR_BASENAME = `${MAIN_AGENT_ID}-avatar`
const LEGACY_AVATAR_BASENAME = 'marveen-avatar'
const AVATAR_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const

function mainAgentAvatarPath(ext: string): string {
  return join(PROJECT_ROOT, 'store', `${MAIN_AGENT_AVATAR_BASENAME}${ext}`)
}

function legacyAvatarPath(ext: string): string {
  return join(PROJECT_ROOT, 'store', `${LEGACY_AVATAR_BASENAME}${ext}`)
}

/**
 * Lazy migration: if MAIN_AGENT_ID isn't 'marveen' and the legacy
 * `marveen-avatar.<ext>` is the only file present, copy it to the new
 * `${MAIN_AGENT_ID}-avatar.<ext>` path so future reads land on the canonical
 * name. Done on the GET path rather than at boot so a degraded install
 * (e.g. read-only store) still serves the legacy file without erroring out
 * the dashboard's startup. Returns the absolute path of the file to serve,
 * or null if no avatar is configured.
 */
export function findMainAgentAvatar(opts?: { copyOnMigrate?: boolean }): string | null {
  const copyOnMigrate = opts?.copyOnMigrate ?? true
  for (const ext of AVATAR_EXTENSIONS) {
    const newP = mainAgentAvatarPath(ext)
    if (existsSync(newP)) return newP
  }
  for (const ext of AVATAR_EXTENSIONS) {
    const legacyP = legacyAvatarPath(ext)
    if (!existsSync(legacyP)) continue
    if (copyOnMigrate && MAIN_AGENT_ID !== 'marveen') {
      try {
        copyFileSync(legacyP, mainAgentAvatarPath(ext))
        return mainAgentAvatarPath(ext)
      } catch { /* fall through to legacy serve */ }
    }
    return legacyP
  }
  return null
}

// Clear BOTH naming patterns before a fresh upload, so a Cuzcoo install
// doesn't end up with a stale `marveen-avatar.png` shadowing the new
// `cuzcoo-avatar.png` on the next GET. Silent on missing files.
function clearAllAvatarFiles(): void {
  for (const ext of AVATAR_EXTENSIONS) {
    for (const p of [mainAgentAvatarPath(ext), legacyAvatarPath(ext)]) {
      if (existsSync(p)) {
        try { unlinkSync(p) } catch { /* best effort */ }
      }
    }
  }
}

// Pure identity-core of the /api/marveen payload: the brand-relevant fields the
// dashboard chrome + agent routing depend on. Extracted so the mapping (display
// name -> name, product brand -> brandName, canonical id -> agentId) is provable
// for any non-default identity, independent of the route's file I/O.
export interface MarveenIdentityCore {
  name: string
  brandName: string
  agentId: string
  autoRestartId: string
  role: 'main'
}
export function buildMarveenIdentityCore(
  botName: string,
  brandName: string,
  mainAgentId: string,
): MarveenIdentityCore {
  return {
    name: botName,
    brandName,
    agentId: mainAgentId,
    autoRestartId: mainAgentId,
    role: 'main',
  }
}

export async function tryHandleMarveen(ctx: RouteContext, webDir: string): Promise<boolean> {
  const { req, res, path, method } = ctx

  if (path === '/api/marveen' && method === 'GET') {
    const claudeMd = readFileOr(join(PROJECT_ROOT, 'CLAUDE.md'), '')
    const soulMd = readFileOr(join(PROJECT_ROOT, 'SOUL.md'), '')
    const mcpJson = readFileOr(join(PROJECT_ROOT, '.mcp.json'), '')
    const soulSection = claudeMd.match(/## Személyiség\n\n([\s\S]*?)(?=\n## )/)?.[1]?.trim()
      || claudeMd.match(/## Szemelyiseg\n\n([\s\S]*?)(?=\n## )/)?.[1]?.trim()
      || ''
    const firstLine = claudeMd.match(/^Te .+$/m)?.[0]?.trim() || ''
    const descFromPersonality = soulSection.split('\n').filter(l => l.trim()).slice(0, 2).join(' ').slice(0, 200)
    const description = firstLine || descFromPersonality || `${OWNER_NAME} AI asszisztense`
    const tg = readMarveenTelegramConfig()
    const dc = readMarveenDiscordConfig()
    const sl = readMarveenSlackConfig()
    const gc = readMarveenGooglechatConfig()
    const tc = readMarveenTeamsConfig()
    // Brand-relevant identity core. `name` = main agent display name (BOT_NAME),
    // `brandName` = product brand for the dashboard chrome (defaults to BOT_NAME;
    // the client falls back to its own HTML default "Marveen" if absent on a
    // legacy backend), `agentId` = canonical MAIN_AGENT_ID so the dashboard can
    // hit /api/agents/<id>/skills for the main agent.
    const idCore = buildMarveenIdentityCore(BOT_NAME, BRAND_NAME, MAIN_AGENT_ID)
    json(res, {
      ...idCore,
      // Configured owner display name (OWNER_NAME). The dashboard chat view uses
      // this to pin/label the owner's own message thread instead of a hardcoded
      // literal, so a renamed install recognizes its real owner.
      ownerName: OWNER_NAME,
      description,
      model: getActiveMarveenModel(),
      tmuxSession: MAIN_CHANNELS_SESSION,
      running: true,
      // Auto-restart applies to the main channels session too; key it by the
      // orchestrator id (autoRestartId, part of idCore) so the UI PUTs to the
      // right store entry.
      autoRestart: readAutoRestartConfig(MAIN_AGENT_ID),
      contextTokens: readContextTokensFromProjectDir(PROJECT_ROOT),
      hasTelegram: tg.hasTelegram,
      hasDiscord: dc.hasDiscord,
      hasSlack: sl.hasSlack,
      hasGooglechat: gc.hasGooglechat,
      hasTeams: tc.hasTeams,
      telegramBotUsername: tg.botUsername,
      personality: soulSection,
      claudeMd,
      soulMd,
      mcpJson,
      readonly: true,
      // Dashboard kliens defaultja a provider-dropdown-hoz: a backend
      // CHANNEL_PROVIDER env-jébe pinneljük, hogy a UI ne hardcode-olt
      // 'telegram'-mal induljon.
      channelProvider: CHANNEL_PROVIDER,
      // Resolved through the settings overrides layer so the UI hot-reloads.
      kanbanAging: {
        warnH: getEffectiveSettingValue('KANBAN_AGING_WARN_H'),
        cautionH: getEffectiveSettingValue('KANBAN_AGING_CAUTION_H'),
        criticalH: getEffectiveSettingValue('KANBAN_AGING_CRITICAL_H'),
        warnColor: getEffectiveSettingValue('KANBAN_AGING_WARN_COLOR'),
        cautionColor: getEffectiveSettingValue('KANBAN_AGING_CAUTION_COLOR'),
        criticalColor: getEffectiveSettingValue('KANBAN_AGING_CRITICAL_COLOR'),
      },
      // Resolved through the settings overrides layer (override > .env >
      // registry default) instead of the boot-time config.ts constants, so a
      // value saved on the Settings page takes effect immediately -- no
      // process restart needed for these 9 keys.
      kanbanWip: {
        limits: {
          planned: getEffectiveSettingValue('KANBAN_WIP_PLANNED'),
          in_progress: getEffectiveSettingValue('KANBAN_WIP_IN_PROGRESS'),
          waiting: getEffectiveSettingValue('KANBAN_WIP_WAITING'),
          done: getEffectiveSettingValue('KANBAN_WIP_DONE'),
        },
        warnPct: getEffectiveSettingValue('KANBAN_WIP_WARN_PCT'),
        okColor: getEffectiveSettingValue('KANBAN_WIP_OK_COLOR'),
        warnColor: getEffectiveSettingValue('KANBAN_WIP_WARN_COLOR'),
        fullColor: getEffectiveSettingValue('KANBAN_WIP_FULL_COLOR'),
        overColor: getEffectiveSettingValue('KANBAN_WIP_OVER_COLOR'),
      },
      kanbanSwimlanes: {
        defaultGroup: getEffectiveSettingValue('KANBAN_SWIMLANE_DEFAULT_GROUP'),
        separatorColor: getEffectiveSettingValue('KANBAN_SWIMLANE_SEPARATOR_COLOR') || null,
      },
      kanbanLabels: {
        colors: KANBAN_LABEL_COLORS,
      },
    })
    return true
  }

  // Intentionally read-only: Marveen's CLAUDE.md / SOUL.md / .mcp.json must be
  // edited from the filesystem or via a Telegram request to Marveen herself,
  // not through the dashboard. A leaked dashboard token would otherwise allow
  // remote identity rewrite of the live agent.
  if (path === '/api/marveen' && method === 'PUT') {
    json(res, { ok: true, readonly: true })
    return true
  }

  if (path === '/api/marveen/restart' && method === 'POST') {
    const result = hardRestartMarveenChannels()
    if (!result.ok) { json(res, { error: result.error || 'Restart failed' }, 500); return true }
    json(res, { ok: true })
    return true
  }

  // Canonical (new) and legacy (brand-leaked) avatar GET. Both URLs serve
  // the same file -- the canonical path is `/api/main-agent/avatar`, but
  // bookmarks / external links / older dashboard builds still hit the
  // legacy `/api/marveen/avatar`. Backwards-compat is intentional and
  // open-ended (no plan to remove the legacy alias).
  const isAvatarGet = (path === '/api/main-agent/avatar' || path === '/api/marveen/avatar') && method === 'GET'
  if (isAvatarGet) {
    const p = findMainAgentAvatar()
    if (p) { serveFile(req, res, p); return true }
    const fallback = join(webDir, 'avatars', '01_robot.png')
    if (existsSync(fallback)) { serveFile(req, res, fallback); return true }
    res.writeHead(404); res.end()
    return true
  }

  const isAvatarPost = (path === '/api/main-agent/avatar' || path === '/api/marveen/avatar') && method === 'POST'
  if (isAvatarPost) {
    const body = await readBody(req)
    const contentType = req.headers['content-type'] || ''

    // Clear both naming patterns so a re-upload on a Cuzcoo install doesn't
    // leave the legacy `marveen-avatar.png` behind to shadow the new file.
    clearAllAvatarFiles()

    if (contentType.includes('application/json')) {
      const { galleryAvatar } = JSON.parse(body.toString()) as { galleryAvatar: string }
      if (!galleryAvatar) { json(res, { error: 'No avatar specified' }, 400); return true }
      if (galleryAvatar.includes('..') || galleryAvatar.includes('/') || galleryAvatar.includes('\\')) {
        json(res, { error: 'Invalid avatar name' }, 400)
        return true
      }
      const srcPath = join(webDir, 'avatars', galleryAvatar)
      if (!existsSync(srcPath)) { json(res, { error: 'Avatar not found' }, 404); return true }
      const destPath = mainAgentAvatarPath(extname(galleryAvatar) || '.png')
      copyFileSync(srcPath, destPath)
      sendMarveenAvatarChange(destPath).catch(() => {})
    } else {
      const { file } = parseMultipart(body, contentType)
      if (!file) { json(res, { error: 'No file uploaded' }, 400); return true }
      const destPath = mainAgentAvatarPath(extname(file.name) || '.png')
      writeFileSync(destPath, file.data)
      sendMarveenAvatarChange(destPath).catch(() => {})
    }
    json(res, { ok: true })
    return true
  }

  return false
}
