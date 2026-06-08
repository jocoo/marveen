// NABProcessor.gs -- post-load classification: pushes Blank-Purpose,
// Gift Card, and Paypal rows into NAB_General for manual classification by
// Jocoo, then reports the pending count.
//
// NAB sheet layout (17 cols, derived from NAB_Raw via formula, confirmed
// 2026-06-08): A=ID | B=Date | C=Description | D=Amount | E=Credit | F=Debit |
// G=Balance | H=Status | I=Card | J=FilterID | K=Purpose | L=Account |
// M=Category | N=Subcategory | O=Reconciliation | P=Recon Date | Q=Bill Date
//
// NAB_General layout: A=ID | B=Date | C=Description | D=Amount | E=Purpose
// | F=Account | G=Category | H=Subcategory

const NAB_GENERAL_COLS = 8
const NAB_READ_COLS = 14 // A..N covers everything classification needs

function readNabSheet_() {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return []
  const values = sheet.getRange(2, 1, lastRow - 1, NAB_READ_COLS).getValues()
  return values.map(r => ({
    id: r[0], date: r[1], description: r[2], amount: r[3],
    // r[4..8] = Credit, Debit, Balance, Status, Card -- not used in classification
    filterId: r[9], purpose: r[10], account: r[11], category: r[12], subcategory: r[13]
  }))
}

function readExistingGeneralIds_() {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB_GENERAL)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return new Set()
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
  const out = new Set()
  for (const r of ids) if (r[0] !== '' && r[0] !== null) out.add(r[0])
  return out
}

function appendToNabGeneral_(rows) {
  if (rows.length === 0) return 0
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB_GENERAL)
  const startRow = Math.max(sheet.getLastRow() + 1, 2)
  // Pad to NAB_GENERAL_COLS so the existing column widths line up cleanly.
  const padded = rows.map(r => {
    const out = r.slice(0, NAB_GENERAL_COLS)
    while (out.length < NAB_GENERAL_COLS) out.push('')
    return out
  })
  sheet.getRange(startRow, 1, padded.length, NAB_GENERAL_COLS).setValues(padded)
  return padded.length
}

// Steps 12-13 + 18 in the manual flow, collapsed into one pass. Pending NAB
// rows (NAB_Raw.Processed empty) are skipped -- they get classified once they
// settle, otherwise the next delete-and-append cycle would orphan their
// NAB_General rows.
// Returns the count of unclassified-purpose rows pushed to NAB_General.
function classifyAndPushPending_() {
  const nabRows = readNabSheet_()
  const existingIds = readExistingGeneralIds_()
  const pendingIds = readPendingNabRawIds_()
  const toGeneral = []
  let pendingCount = 0
  for (const row of nabRows) {
    if (existingIds.has(row.id)) continue
    if (pendingIds.has(row.id)) continue
    const desc = String(row.description || '').toLowerCase()
    const isGiftCard = String(row.subcategory || '').toLowerCase() === 'gift card'
    const isPaypal = desc.indexOf('paypal') !== -1
    const isBlank = !row.purpose || String(row.purpose).trim() === ''
    if (isBlank || isGiftCard || isPaypal) {
      // ID, Date, Description, Amount, Purpose(blank), Account/Category/Subcategory
      // left blank for Jocoo to classify in NAB_General.
      toGeneral.push([row.id, row.date, row.description, row.amount, '', '', '', ''])
      existingIds.add(row.id)
      if (isBlank) pendingCount += 1
    }
  }
  appendToNabGeneral_(toGeneral)
  return { pushed: toGeneral.length, pending: pendingCount }
}

// Step 17: validate -- after Purpose is filled, Account/Category/Subcategory
// must all be set. Returns the count of NAB_General rows missing any of those
// three (excluding rows where Purpose itself is still blank, since those are
// the expected pending bucket).
function countNabGeneralValidationFailures_() {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB_GENERAL)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return 0
  const values = sheet.getRange(2, 5, lastRow - 1, 4).getValues()
  let failures = 0
  for (const r of values) {
    const [purpose, account, category, subcategory] = r
    if (!purpose) continue
    if (!account || !category || !subcategory) failures += 1
  }
  return failures
}
