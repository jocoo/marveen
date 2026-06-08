// NABRawLoader.gs -- appends new rows to NAB_Raw (B..K), reads helpers used by
// the processor, and applies the post-import sort.
//
// NAB_Raw layout (B..K, A is a SEQUENCE formula and is never touched here):
//   B=Date | C=Amount | D=Account Number | E=Empty | F=Transaction Type |
//   G=Transaction Details | H=Balance | I=Category | J=Merchant Name | K=Processed

// Append normalised rows to NAB_Raw at the next empty row, starting at column B.
// Column A holds the SEQUENCE(COUNTA(B2:B)) ID formula and must NOT be written.
// Returns the count appended.
function appendToNabRaw_(rows) {
  if (rows.length === 0) return 0
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB_RAW)
  const startRow = Math.max(sheet.getLastRow() + 1, 2)
  // 10 cols at B..K. Each row must be exactly 10 cells in the agreed order.
  sheet.getRange(startRow, 2, rows.length, 10).setValues(rows)
  return rows.length
}

// Sort one batch of NORMALISED 10-col rows (B..K) in memory by Merchant Name
// (index 8 = col J) asc, then Processed (index 9 = col K) desc. Pending rows
// (empty Processed) sort to the bottom within each merchant. NAB_Raw itself is
// never re-sorted as a whole sheet -- Jocoo confirmed (2026-06-08 23:47 AEST)
// that the raw_Sort() macro in the manual flow sorted the Macro scratch sheet,
// NOT NAB_Raw. We just ensure each appended batch is internally ordered.
function sortNewRowsInMemory_(rows) {
  return rows.slice().sort((a, b) => {
    const ma = String(a[8] == null ? '' : a[8]).toLowerCase()
    const mb = String(b[8] == null ? '' : b[8]).toLowerCase()
    if (ma < mb) return -1
    if (ma > mb) return 1
    const pa = parseNabDateString_(a[9])
    const pb = parseNabDateString_(b[9])
    const ta = pa ? pa.getTime() : -Infinity
    const tb = pb ? pb.getTime() : -Infinity
    return tb - ta
  })
}

// Sweep every NAB_Raw row whose Processed (column K) is empty. These are stale
// pending rows from a previous import; the fresh CSV will reintroduce them
// (possibly as settled, with a different fingerprint). Must run BEFORE the
// fingerprint set is built, otherwise old pending fingerprints would block
// the now-settled rows from being imported. Returns the count deleted.
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
  // Bottom-up so indices stay valid while we delete.
  for (let i = pendingRows.length - 1; i >= 0; i--) {
    sheet.deleteRow(pendingRows[i])
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
