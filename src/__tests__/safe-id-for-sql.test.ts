import { describe, it, expect } from 'vitest'
import { safeIdForSql } from '../db.js'

// Kanban #68bbe38f. The SQL DEFAULT clauses on memories.agent_id,
// memories_new.agent_id, and idea_box.source used to be the literal
// 'marveen', which silently broke on installs that ran with a different
// MAIN_AGENT_ID (e.g. 'cuzcoo'). The interpolated form pulls MAIN_AGENT_ID
// through safeIdForSql; the validator's job is to reject anything that
// could either corrupt the schema string or open a DEFAULT-clause sql
// injection if a malicious .env ever ships.

describe('safeIdForSql -- valid ids pass through unchanged', () => {
  it.each([
    'marveen',
    'cuzcoo',
    'GorcsevIvan',
    'agent-42',
    'agent_42',
    'A',
    'main-agent-v2',
    'a1B2c3',
  ])('%s', (id) => {
    expect(safeIdForSql(id)).toBe(id)
  })
})

describe('safeIdForSql -- rejects empty / nullish ids', () => {
  it('throws on empty string', () => {
    expect(() => safeIdForSql('')).toThrow(/Refusing to interpolate/)
  })

  it('throws on whitespace-only', () => {
    // Whitespace is not in [a-zA-Z0-9_-]; reject so we never get a DEFAULT
    // that resolves to a literal-space agent id.
    expect(() => safeIdForSql('   ')).toThrow()
    expect(() => safeIdForSql('\t')).toThrow()
  })
})

describe('safeIdForSql -- rejects ids that could escape the SQL literal', () => {
  it.each([
    "marveen'; DROP TABLE memories; --",  // closes the quote and tail-injects
    "marv'een",                            // embedded apostrophe
    'marv"een',                            // embedded double quote
    'marveen;',                            // sql statement terminator
    'marv\nveen',                          // newline injection
    'marv\x00een',                         // null byte
    'marveen `cmd`',                       // backtick
    'marveen $(cmd)',                      // dollar-paren
    'marveen ${cmd}',                      // dollar-brace
  ])('rejects %j', (id) => {
    expect(() => safeIdForSql(id)).toThrow(/Refusing to interpolate/)
  })
})

describe('safeIdForSql -- rejects non-id punctuation', () => {
  it.each([
    'agent.42',
    'agent/42',
    'agent@host',
    'agent+plus',
    'agent space',
    'agent#hash',
    'agent%percent',
  ])('rejects %j', (id) => {
    expect(() => safeIdForSql(id)).toThrow()
  })
})

describe('safeIdForSql -- error includes the offending value', () => {
  it('reflects the bad id back so logs are actionable', () => {
    try {
      safeIdForSql("bad'id")
      throw new Error('expected throw')
    } catch (err) {
      expect((err as Error).message).toContain(`"bad'id"`)
    }
  })
})
