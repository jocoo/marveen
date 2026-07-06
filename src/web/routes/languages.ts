import { readBody, json, RequestBodyTooLargeError } from '../http-helpers.js'
import { logger } from '../../logger.js'
import { logConfigChange } from '../../db.js'
import {
  BUILTIN_LANGS,
  customLanguageExists,
  deleteCustomLanguage,
  isBuiltinLang,
  isValidLangCode,
  listCustomLanguages,
  readCustomLanguage,
  writeCustomLanguage,
} from '../languages-store.js'
import type { RouteContext } from './types.js'

// Admin language management (dashboard i18n). Built-ins (hu/en) ship in
// web/lang/ and are immutable here; custom languages live as JSON under
// store/lang/ and are served back as generated scripts by the static route.
// The whole surface sits behind the standard /api/* bearer gate.
const LANG_BODY_MAX_BYTES = 1024 * 1024

const CODE_PATH_RE = /^\/api\/languages\/([a-z]{2,3}(?:-[a-z0-9]{2,8})?)$/

export async function tryHandleLanguages(ctx: RouteContext): Promise<boolean> {
  const { req, res, path, method } = ctx

  if (path === '/api/languages' && method === 'GET') {
    const languages = [
      ...Object.entries(BUILTIN_LANGS).map(([code, name]) => ({ code, name, builtin: true, keyCount: null })),
      ...listCustomLanguages().map((l) => ({ code: l.code, name: l.name, builtin: false, keyCount: l.keyCount })),
    ]
    json(res, { languages })
    return true
  }

  if (path === '/api/languages' && method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req, { maxBytes: LANG_BODY_MAX_BYTES })).toString())
      const { code, name, strings, actor } = body ?? {}
      if (!isValidLangCode(code)) {
        json(res, { error: 'Invalid "code": expected a BCP47-ish tag like "de" or "pt-br"' }, 400)
        return true
      }
      if (isBuiltinLang(code)) {
        json(res, { error: `"${code}" is built in and cannot be replaced` }, 409)
        return true
      }
      if (customLanguageExists(code)) {
        json(res, { error: `Language "${code}" already exists; use PUT /api/languages/${code} to update it` }, 409)
        return true
      }
      const lang = writeCustomLanguage(code, name, strings)
      logConfigChange(`LANGUAGE:${code}`, null, `added (${Object.keys(lang.strings).length} keys)`, typeof actor === 'string' ? actor : 'dashboard')
      logger.info(`[languages] added custom language ${code} (${lang.name})`)
      json(res, { ok: true, language: { code: lang.code, name: lang.name, keyCount: Object.keys(lang.strings).length } }, 201)
    } catch (err) {
      const status = err instanceof RequestBodyTooLargeError ? 413 : 400
      json(res, { error: err instanceof Error ? err.message : 'Invalid request' }, status)
    }
    return true
  }

  const codeMatch = path.match(CODE_PATH_RE)
  if (codeMatch) {
    const code = codeMatch[1]

    if (method === 'GET') {
      const lang = readCustomLanguage(code)
      if (!lang) {
        json(res, { error: `No custom language "${code}"` }, 404)
        return true
      }
      json(res, { language: lang })
      return true
    }

    if (method === 'PUT') {
      try {
        const body = JSON.parse((await readBody(req, { maxBytes: LANG_BODY_MAX_BYTES })).toString())
        const existing = readCustomLanguage(code)
        // A corrupted/invalid stored file must stay repairable: PUT accepts any
        // code whose file exists on disk even when it no longer parses.
        if (!existing && !customLanguageExists(code)) {
          json(res, { error: `No custom language "${code}"; create it with POST /api/languages` }, 404)
          return true
        }
        const lang = writeCustomLanguage(code, body?.name ?? existing?.name, body?.strings ?? existing?.strings)
        logConfigChange(`LANGUAGE:${code}`, null, `updated (${Object.keys(lang.strings).length} keys)`, typeof body?.actor === 'string' ? body.actor : 'dashboard')
        json(res, { ok: true, language: { code: lang.code, name: lang.name, keyCount: Object.keys(lang.strings).length } })
      } catch (err) {
        const status = err instanceof RequestBodyTooLargeError ? 413 : 400
        json(res, { error: err instanceof Error ? err.message : 'Invalid request' }, status)
      }
      return true
    }

    if (method === 'DELETE') {
      if (isBuiltinLang(code)) {
        json(res, { error: `"${code}" is built in and cannot be deleted` }, 409)
        return true
      }
      const removed = deleteCustomLanguage(code)
      if (!removed) {
        json(res, { error: `No custom language "${code}"` }, 404)
        return true
      }
      logConfigChange(`LANGUAGE:${code}`, null, 'deleted', 'dashboard')
      logger.info(`[languages] deleted custom language ${code}`)
      json(res, { ok: true })
      return true
    }
  }

  return false
}
