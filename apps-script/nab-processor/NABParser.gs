// NABParser.gs -- CSV parsing, Step-4 Processed filter, and fingerprint dedup.
//
// NAB online export header (confirmed June 2026 via Jocoo's actual sheet):
//   Date, Amount, Account Number, [empty col 3], Transaction Type,
//   Transaction Details, Balance, Category, Merchant Name, Processed On
//
// NAB_Raw sheet layout (B..K paste target; A is the SEQUENCE ID formula):
//   B=Date | C=Amount | D=Account Number | E=Empty | F=Transaction Type |
//   G=Transaction Details | H=Balance | I=Category | J=Merchant Name | K=Processed
//
// Normalised rows are arrays of 10 cells in that exact column order so the
// loader can paste them directly into B..K with one setValues() call.

function parseCsvText_(text) {
  const rows = Utilities.parseCsv(text)
  if (rows.length === 0) return { headers: [], data: [] }
  const headers = rows[0].map(h => String(h).trim())
  return { headers: headers, data: rows.slice(1) }
}

// Returns an array of 10-element rows in NAB_Raw B..K order.
// Pending rows (empty Processed On) are INCLUDED so they show up in the sheet.
function normaliseNabRows_(parsed) {
  const findIdx = (re) => parsed.headers.findIndex(h => re.test(h))
  const required = (label, re) => {
    const i = findIdx(re)
    if (i < 0) throw new Error('NAB CSV missing column: ' + label)
    return i
  }
  const iDate = required('Date', /^date$/i)
  const iAmount = required('Amount', /^amount$/i)
  const iAccount = findIdx(/^account number$/i)
  const iType = findIdx(/^transaction type$/i)
  const iDesc = required('Transaction Details / Description', /transaction details|description/i)
  const iBalance = findIdx(/^balance$/i)
  const iCategory = findIdx(/^category$/i)
  const iMerchant = findIdx(/^merchant name$/i)
  const iProcessed = findIdx(/processed on/i)
  const pick = (row, i) => (i >= 0 && row[i] !== undefined) ? row[i] : ''
  const out = []
  for (const row of parsed.data) {
    if (!row[iDate] && !row[iAmount] && !row[iDesc]) continue
    out.push([
      row[iDate],
      row[iAmount],
      pick(row, iAccount),
      '',
      pick(row, iType),
      String(pick(row, iDesc)).trim(),
      pick(row, iBalance),
      pick(row, iCategory),
      pick(row, iMerchant),
      String(pick(row, iProcessed)).trim()
    ])
  }
  return out
}

// Parse NAB-style date strings ("1-Jul-25", "30-Jun-26") into a JS Date.
// Returns null for empty / unparseable input. Already-Date input passes through.
function parseNabDateString_(s) {
  if (s === null || s === undefined || s === '') return null
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s
  const str = String(s).trim()
  if (!str) return null
  const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/)
  if (m) {
    const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 }
    const day = parseInt(m[1], 10)
    const mon = months[m[2].toLowerCase()]
    if (mon === undefined) return null
    let year = parseInt(m[3], 10)
    if (year < 100) year += 2000
    return new Date(year, mon, day)
  }
  const fallback = new Date(str)
  return isNaN(fallback.getTime()) ? null : fallback
}

// Step 4 filter: keep CSV rows whose Processed date is strictly newer than the
// most recent Processed date already in NAB_Raw, OR is empty (= pending).
// `rows` are normalised 10-col arrays; Processed sits at index 9.
function filterByProcessedThreshold_(rows, lastProcessedDate) {
  if (!lastProcessedDate) return rows
  const cutoffMs = lastProcessedDate.getTime()
  const out = []
  for (const r of rows) {
    const procRaw = r[9]
    if (!procRaw) { out.push(r); continue }
    const d = parseNabDateString_(procRaw)
    if (!d || d.getTime() > cutoffMs) out.push(r)
  }
  return out
}

// Fingerprint = Date|Description|Amount. Stable across runs; tolerates
// whitespace drift in Description.
//
// Date MUST be normalised the same way regardless of input type, otherwise
// a string "1-Jul-25" from the CSV won't match the Date object stored in
// NAB_Raw B-column even though they represent the same day. The 2026-06-08
// 72-false-new-row incident was this: every CSV row looked new because the
// fingerprint set was built from Date objects while the CSV side trimmed
// strings. parseNabDateString_ handles both shapes.
function fingerprint_(date, description, amount) {
  const parsed = parseNabDateString_(date)
  const d = parsed
    ? Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd')
    : String(date == null ? '' : date).trim()
  const desc = String(description || '').trim().replace(/\s+/g, ' ').toLowerCase()
  const amt = Number(amount)
  return d + '|' + desc + '|' + (Number.isFinite(amt) ? amt.toFixed(2) : '')
}

function buildExistingFingerprints_() {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB_RAW)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return new Set()
  // Cols B(2)..G(7): Date, Amount, AcctNo, Empty, Type, Description.
  const values = sheet.getRange(2, 2, lastRow - 1, 6).getValues()
  const out = new Set()
  for (const v of values) {
    const date = v[0], amount = v[1], desc = v[5]
    if (!date && !desc && !amount) continue
    out.add(fingerprint_(date, desc, amount))
  }
  return out
}

// Deduplicate against existing fingerprints; mutates `existingFingerprints` to
// include the new rows it accepts so within-batch duplicates are also caught.
// Rows are 10-col arrays: Date(0), Amount(1), ..., Description(5), ...
function filterNewRowsByFingerprint_(rows, existingFingerprints) {
  const out = []
  for (const r of rows) {
    const fp = fingerprint_(r[0], r[5], r[1])
    if (existingFingerprints.has(fp)) continue
    existingFingerprints.add(fp)
    out.push(r)
  }
  return out
}
