// NABRawLoader.gs -- appends new rows to NAB_Raw (B..L), reads helpers used by
// the processor, and applies the post-import sort.
//
// NAB_Raw layout (B..L, A is a SEQUENCE formula and is never touched here):
//   B=Date | C=Amount | D=Account Number | E=Empty | F=Transaction Type |
//   G=Transaction Details | H=Balance | I=Category | J=Merchant Name |
//   K=Processed | L=FilterID
// L is a formula =FIND_ARRAY_PART_IN_TEXT($G<row>) -- a custom function bound
// to the spreadsheet that resolves the FilterID via the Filter sheet lookup.
// We write a formula here (not the resolved integer) so that the sheet stays
// the single source of truth for FilterID resolution and Jocoo's manual
// overrides stay visible against the cell's auto-format.

// Append normalised rows to NAB_Raw at the next empty row.
// Columns B..K receive the parsed CSV values via setValues; column L receives
// the FilterID formula via setFormulas in a separate call (setValues would
// otherwise paste the formula string as literal text).
// Column A holds the SEQUENCE(COUNTA(B2:B)) ID formula and must NOT be written.
function appendToNabRaw_(rows) {
  if (rows.length === 0) return 0
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB_RAW)
  const startRow = Math.max(sheet.getLastRow() + 1, 2)
  // 10 cols at B..K. Each row must be exactly 10 cells in the agreed order.
  sheet.getRange(startRow, 2, rows.length, 10).setValues(rows)
  const filterFormulas = rows.map((_, i) => ['=FIND_ARRAY_PART_IN_TEXT($G' + (startRow + i) + ')'])
  sheet.getRange(startRow, 12, rows.length, 1).setFormulas(filterFormulas)
  return rows.length
}

// Sort one batch of NORMALISED 10-col rows (B..K) in memory by Processed
// (index 9 = col K) ASCENDING -- oldest settled first, pending rows (empty
// Processed) at the end. Single key per Jocoo (2026-06-09). The earlier
// Merchant-Name-then-Processed-desc scheme was a misread of the manual macro;
// the raw_Sort() macro acted on the Macro scratch sheet, NOT NAB_Raw, and
// NAB_Raw itself is never re-sorted as a whole sheet -- we just keep each
// appended batch internally ordered.
//
// Pending rows are mapped to +Infinity so they sort last; Infinity - Infinity
// = 0 keeps the pending bucket stable in insertion order.
function sortNewRowsInMemory_(rows) {
  return rows.slice().sort((a, b) => {
    const pa = parseNabDateString_(a[9])
    const pb = parseNabDateString_(b[9])
    const ta = pa ? pa.getTime() : Infinity
    const tb = pb ? pb.getTime() : Infinity
    return ta - tb
  })
}

// Sweep every NAB_Raw row whose Processed (column K) is empty. These are stale
// pending rows from a previous import; the fresh CSV will reintroduce them
// (possibly as settled, with a different fingerprint). Must run BEFORE the
// fingerprint set is built for the current file, otherwise old pending
// fingerprints would block the now-settled rows from being imported.
//
// Pending-row detection is structural (K empty), not semantic (F == "PURCHASE
// AUTHORISATION"). Jocoo confirmed (2026-06-09): K-empty is future-proof if
// NAB ever introduces a new pre-settlement state.
//
// Contiguous pending-row runs are batched into a single deleteRows(start,
// count) call. NAB_Raw is sorted such that pending rows cluster, so this is
// usually 1-2 API calls regardless of how many pending rows exist.
function deletePendingNabRawRows_() {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB_RAW)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return 0
  // Column K (11) = Processed
  const processedCol = sheet.getRange(2, 11, lastRow - 1, 1).getValues()
  const pendingRows = []
  for (let i = 0; i < processedCol.length; i++) {
    const v = processedCol[i][0]
    const isEmpty = (v === '' || v === null || v === undefined ||
      (typeof v === 'string' && v.trim() === ''))
    if (isEmpty) pendingRows.push(i + 2)
  }
  if (pendingRows.length === 0) return 0
  // Collapse into contiguous (start, count) groups so each run of adjacent
  // pending rows deletes in one API call instead of one per row.
  const groups = []
  let start = pendingRows[0]
  let count = 1
  for (let i = 1; i < pendingRows.length; i++) {
    if (pendingRows[i] === pendingRows[i - 1] + 1) {
      count++
    } else {
      groups.push([start, count])
      start = pendingRows[i]
      count = 1
    }
  }
  groups.push([start, count])
  // Delete bottom-up so earlier group start-rows stay valid as we shrink.
  for (let i = groups.length - 1; i >= 0; i--) {
    sheet.deleteRows(groups[i][0], groups[i][1])
  }
  return pendingRows.length
}

// Max Processed date currently in NAB_Raw (col K), or null if the sheet is
// empty. Used by Step-4 filter to skip CSV rows older than what we already have.
function getLastProcessedDate_() {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB_RAW)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null
  const values = sheet.getRange(2, 11, lastRow - 1, 1).getValues()
  let max = null
  for (const r of values) {
    const d = parseNabDateString_(r[0])
    if (d && (!max || d > max)) max = d
  }
  return max
}

// Set of NAB_Raw IDs whose Processed (K) is empty. Used by classifyAndPushPending_
// to skip pending rows during NAB_General classification.
function readPendingNabRawIds_() {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB_RAW)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return new Set()
  // A=ID (SEQUENCE result), K=Processed -- single 11-col read covers both.
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues()
  const out = new Set()
  for (const r of data) {
    const id = r[0]
    const processed = r[10]
    const isEmpty = (processed === '' || processed === null || processed === undefined ||
      (typeof processed === 'string' && processed.trim() === ''))
    if (isEmpty && id !== '' && id !== null) out.add(id)
  }
  return out
}
