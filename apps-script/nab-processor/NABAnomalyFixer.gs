// NABAnomalyFixer.gs -- Step 9 self-healing pass for NAB_General and NAB_Rec
// (kanban #40 v6). Runs every pipeline iteration; resolves stale IDs / Dates
// that drift when a NAB_Raw transaction goes pending -> settled (SEQUENCE
// re-assignment shifts the stored ID).
//
// Detection is direct comparison against an in-memory NAB_Raw snapshot --
// equivalent to the sheets' Red conditional formatting, no getBackground()
// needed. Sequence:
//   buildNabRawIndexes_         -> rawById + rawByDescAmt over ALL rows
//                                  (settled AND pending; Jocoo wants pending
//                                  rows visible AND eligible as fix targets)
//   fixNabGeneralAnomalies_     -> apply updates to NAB_General
//   fixNabRecAnomalies_         -> apply updates to NAB_Rec (G is a VLOOKUP
//                                  formula, do not touch)
//   assertNabAnomaliesClean_    -> hard gate: throw if any reds remain;
//                                  pipeline halts before classifier

const ANOMALY_DATE_WINDOW_MS = 7 * 24 * 3600 * 1000

// Normalise an Amount value (number or "$1,234.56"-style string) to a comparable
// signed 2dp form. Empty / non-numeric -> ''.
function normAmount_(v) {
  if (v === '' || v == null) return ''
  const n = parseFloat(String(v).replace(/[$,]/g, ''))
  return isNaN(n) ? '' : n.toFixed(2)
}

// Build rawById + rawByDescAmt from ALL NAB_Raw rows (settled AND pending).
// Pending rows are valid resolution candidates per domain rule -- if the fix
// lands on a pending ID and that pending row later settles with a new ID, the
// next Step 9 run self-heals.
function buildNabRawIndexes_() {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB_RAW)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return { byId: new Map(), byDescAmt: new Map() }
  // A=ID, B=Date, C=Amount, G=Description, K=Processed -- read A..K once
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues()
  const byId = new Map()
  const byDescAmt = new Map()
  for (const r of data) {
    const id = r[0], date = r[1], amount = r[2], desc = r[6], processed = r[10]
    if (!id) continue
    const settled = processed !== '' && processed != null &&
      !(typeof processed === 'string' && processed.trim() === '')
    const entry = {
      date: date,
      description: String(desc).trim(),
      amount: normAmount_(amount),
      settled: settled
    }
    byId.set(id, entry)
    const key = entry.description + '|' + entry.amount
    if (!byDescAmt.has(key)) byDescAmt.set(key, [])
    byDescAmt.get(key).push({ id: id, date: date, settled: settled })
  }
  return { byId: byId, byDescAmt: byDescAmt }
}

// Generic fix pass shared by NAB_General and NAB_Rec.
//
// numCols controls the sort range width (post-fix the sheet is re-sorted by
// col A ascending). Both sheets store A=ID, B=Date, C=Description, D=Amount;
// only those four are inspected.
//
// indexes: { byId, byDescAmt } from buildNabRawIndexes_
// Returns { idUpdates, dateUpdates, skipped }.
function fixSheetAnomalies_(sheetName, numCols, indexes) {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(sheetName)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return { idUpdates: 0, dateUpdates: 0, skipped: 0 }

  const byId = indexes.byId
  const byDescAmt = indexes.byDescAmt
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues()
  const updates = []
  let idUpdates = 0
  let dateUpdates = 0
  let skipped = 0

  for (let i = 0; i < data.length; i++) {
    const id = data[i][0]
    const date = data[i][1]
    const description = data[i][2]
    const amount = data[i][3]
    if (!id || !description) { skipped++; continue }

    const normAmt = normAmount_(amount)
    const trimmedDesc = String(description).trim()
    const rawEntry = byId.get(id)
    const descMatch = rawEntry && rawEntry.description === trimmedDesc
    const amtMatch = rawEntry && rawEntry.amount === normAmt

    if (rawEntry && descMatch && amtMatch) {
      // Case D (full match) -- check date
      const sd = parseNabDateString_(date)
      const rd = parseNabDateString_(rawEntry.date)
      if (sd && rd && sd.getTime() === rd.getTime()) continue
      // Case C: date drift only
      updates.push({ sheetRow: i + 2, newId: null, newDate: rawEntry.date })
      dateUpdates++
      continue
    }

    // Case A/B: orphan ID or ID reassigned -- resolve by desc+amount lookup
    const key = trimmedDesc + '|' + normAmt
    const storedParsed = parseNabDateString_(date)
    const storedMs = storedParsed ? storedParsed.getTime() : null
    const candidates = (byDescAmt.get(key) || []).filter(function (c) {
      if (storedMs == null) return false
      const cd = parseNabDateString_(c.date)
      return cd && Math.abs(cd.getTime() - storedMs) <= ANOMALY_DATE_WINDOW_MS
    })
    if (candidates.length === 0) {
      Logger.log('[Step9] unresolved: ' + sheetName + ' row ' + (i + 2) + ' id=' + id)
      skipped++
      continue
    }
    // Sort: settled first, then smallest |delta|, then higher id (newer settlement)
    candidates.sort(function (a, b) {
      if (a.settled !== b.settled) return a.settled ? -1 : 1
      const da = Math.abs(parseNabDateString_(a.date).getTime() - storedMs)
      const db = Math.abs(parseNabDateString_(b.date).getTime() - storedMs)
      return da !== db ? da - db : b.id - a.id
    })
    const best = candidates[0]
    updates.push({ sheetRow: i + 2, newId: best.id, newDate: best.date })
    idUpdates++
  }

  if (updates.length > 0) {
    for (const u of updates) {
      if (u.newId !== null) sheet.getRange(u.sheetRow, 1).setValue(u.newId)
      sheet.getRange(u.sheetRow, 2).setValue(u.newDate)
      // NAB_Rec col G (Check_Date) is =VLOOKUP(<row>, NAB_Raw!A:B, 2) -- do NOT write
    }
    sheet.getRange(2, 1, lastRow - 1, numCols).sort({ column: 1, ascending: true })
  }

  return { idUpdates: idUpdates, dateUpdates: dateUpdates, skipped: skipped }
}

// Re-scan a target sheet against the same in-memory indexes used during the fix.
// Returns the count of rows still flagged (would render red in the sheet CF).
function countRemainingAnomalies_(sheetName, indexes) {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(sheetName)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return 0
  const byId = indexes.byId
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues()
  let red = 0
  for (const r of data) {
    const id = r[0], date = r[1], description = r[2], amount = r[3]
    if (!id || !description) { red++; continue }
    const e = byId.get(id)
    if (!e) { red++; continue }
    if (e.description !== String(description).trim() || e.amount !== normAmount_(amount)) {
      red++; continue
    }
    const sd = parseNabDateString_(date)
    const rd = parseNabDateString_(e.date)
    if (!sd || !rd || sd.getTime() !== rd.getTime()) red++
  }
  return red
}

function fixNabGeneralAnomalies_(indexes) {
  return fixSheetAnomalies_(SHEET_NAMES.NAB_GENERAL, 8, indexes)
}

function fixNabRecAnomalies_(indexes) {
  return fixSheetAnomalies_(SHEET_NAMES.NAB_REC, 7, indexes)
}

// Hard gate after both fix passes. The in-memory indexes are still valid
// because every setValue above writes to the same range we just read; we
// re-scan the sheet to catch anything fixSheetAnomalies_ could not resolve
// (no desc+amount candidate within the 7-day window, corrupt rows, etc.).
//
// On any remaining anomaly: notify Telegram and throw so checkForNewNABFilesInner_
// stops before the classifier runs. Jocoo fixes the reds manually and re-runs.
function assertNabAnomaliesClean_(indexes) {
  const genRed = countRemainingAnomalies_(SHEET_NAMES.NAB_GENERAL, indexes)
  const recRed = countRemainingAnomalies_(SHEET_NAMES.NAB_REC, indexes)
  if (genRed + recRed > 0) {
    const msg = 'Step 9: manual fix needed -- ' + genRed +
      ' red row(s) remain in NAB_General, ' + recRed +
      ' in NAB_Rec. Pipeline stopped before Blank check. Fix red rows and re-run.'
    notifyError_('step9-unresolved', new Error(msg))
    throw new Error(msg)
  }
}
