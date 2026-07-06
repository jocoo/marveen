import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { PROJECT_ROOT } from '../config.js'
import { atomicWriteFileSync } from './atomic-write.js'

// Admin-managed dashboard languages beyond the built-in hu/en pair.
//
// SECURITY: custom languages are persisted as JSON (flat key->string maps),
// NEVER as admin-supplied JavaScript. The /lang/<code>.js the browser loads is
// generated server-side via JSON.stringify (buildLangScript), so an uploaded
// translation can not smuggle script into the dashboard origin (where the
// bearer token lives in localStorage). The language code doubles as the file
// name, so it is regex-locked before any path join (no traversal).
const LANG_DIR = join(PROJECT_ROOT, 'store', 'lang')

export const LANG_CODE_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/
export const BUILTIN_LANGS: Record<string, string> = { hu: 'Magyar', en: 'English' }

const MAX_KEYS = 8000
const MAX_KEY_LEN = 200
const MAX_VALUE_LEN = 4000
const MAX_NAME_LEN = 64
// Keys that would tamper with the object graph instead of adding a translation.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export interface CustomLanguage {
  code: string
  name: string
  strings: Record<string, string>
}

export interface CustomLanguageInfo {
  code: string
  name: string
  keyCount: number
}

export function isValidLangCode(code: unknown): code is string {
  return typeof code === 'string' && LANG_CODE_RE.test(code)
}

export function isBuiltinLang(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILTIN_LANGS, code)
}

/** Throws with a human-readable reason when the payload is not a safe flat string map. */
export function validateLanguagePayload(name: unknown, strings: unknown): { name: string; strings: Record<string, string> } {
  if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LEN) {
    throw new Error(`"name" must be a non-empty string of at most ${MAX_NAME_LEN} characters`)
  }
  if (typeof strings !== 'object' || strings === null || Array.isArray(strings)) {
    throw new Error('"strings" must be a flat object of key -> translated string')
  }
  const entries = Object.entries(strings as Record<string, unknown>)
  if (entries.length === 0) throw new Error('"strings" must not be empty')
  if (entries.length > MAX_KEYS) throw new Error(`"strings" has ${entries.length} keys; the limit is ${MAX_KEYS}`)
  const out: Record<string, string> = {}
  for (const [k, v] of entries) {
    if (k.length > MAX_KEY_LEN) throw new Error(`key too long: ${k.slice(0, 40)}...`)
    if (FORBIDDEN_KEYS.has(k)) throw new Error(`key "${k}" is not allowed`)
    if (typeof v !== 'string') throw new Error(`value for "${k}" is not a string`)
    if (v.length > MAX_VALUE_LEN) throw new Error(`value for "${k}" exceeds ${MAX_VALUE_LEN} characters`)
    // Custom translations are plain text ONLY. Some values are rendered via
    // innerHTML (data-i18n-html and template literals), so an uploaded value
    // with markup would be stored XSS in the origin that holds the dashboard
    // token. Built-in hu/en files never pass through here and may keep their
    // intentional markup.
    if (v.includes('<')) throw new Error(`value for "${k}" contains "<"; custom translations must be plain text`)
    out[k] = v
  }
  return { name: name.trim(), strings: out }
}

function langPath(code: string): string {
  if (!isValidLangCode(code)) throw new Error(`invalid language code: ${String(code)}`)
  return join(LANG_DIR, `${code}.json`)
}

export function listCustomLanguages(): CustomLanguageInfo[] {
  let files: string[]
  try {
    files = readdirSync(LANG_DIR)
  } catch {
    return []
  }
  const out: CustomLanguageInfo[] = []
  for (const f of files.sort()) {
    const m = f.match(/^([a-z]{2,3}(?:-[a-z0-9]{2,8})?)\.json$/)
    if (!m || isBuiltinLang(m[1])) continue
    const lang = readCustomLanguage(m[1])
    if (lang) out.push({ code: lang.code, name: lang.name, keyCount: Object.keys(lang.strings).length })
  }
  return out
}

export function readCustomLanguage(code: string): CustomLanguage | null {
  if (!isValidLangCode(code) || isBuiltinLang(code)) return null
  try {
    const parsed = JSON.parse(readFileSync(langPath(code), 'utf-8'))
    const { name, strings } = validateLanguagePayload(parsed?.name, parsed?.strings)
    return { code, name, strings }
  } catch {
    return null
  }
}

export function customLanguageExists(code: string): boolean {
  return isValidLangCode(code) && !isBuiltinLang(code) && existsSync(langPath(code))
}

export function writeCustomLanguage(code: string, name: unknown, strings: unknown): CustomLanguage {
  if (!isValidLangCode(code)) throw new Error(`invalid language code: ${String(code)} (expected e.g. "de" or "pt-br")`)
  if (isBuiltinLang(code)) throw new Error(`"${code}" is a built-in language and cannot be overridden`)
  const valid = validateLanguagePayload(name, strings)
  mkdirSync(LANG_DIR, { recursive: true })
  atomicWriteFileSync(langPath(code), JSON.stringify({ name: valid.name, strings: valid.strings }, null, 1))
  return { code, ...valid }
}

export function deleteCustomLanguage(code: string): boolean {
  if (!customLanguageExists(code)) return false
  rmSync(langPath(code))
  return true
}

/** The browser-facing script for a custom language; pure JSON.stringify output. */
export function buildLangScript(code: string, strings: Record<string, string>): string {
  return (
    '// Generated by the dashboard from store/lang/' + code + '.json -- do not edit.\n' +
    'window._i18n = window._i18n || {}\n' +
    `window._i18n[${JSON.stringify(code)}] = ${JSON.stringify(strings)}\n`
  )
}

/**
 * Cache-busting token for the set of custom languages: changes when any
 * language file is added, removed or modified. Folded into the index.html
 * ETag so a 304-revalidated index can never miss a newly added language's
 * script tag.
 */
export function customLanguagesVersion(): string {
  try {
    // Same regex lock as listCustomLanguages: a rogue file dropped into
    // store/lang (weird bytes in its name) must not reach an HTTP header.
    const files = readdirSync(LANG_DIR)
      .filter((f) => /^[a-z]{2,3}(-[a-z0-9]{2,8})?\.json$/.test(f))
      .sort()
    return files
      .map((f) => {
        try {
          const s = statSync(join(LANG_DIR, f))
          return `${f}:${s.mtimeMs.toString(36)}:${s.size.toString(36)}`
        } catch {
          return f
        }
      })
      .join('|') || '0'
  } catch {
    return '0'
  }
}
