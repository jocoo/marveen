# NAB Processor — Implementation Plan

> Living doc. Sections added per feature. Historical phases reconstructed from
> kanban #27 and Yzma/Cuzcoo message threads. Kronk implements after Jocoo
> sign-off; Yzma owns spec and review.

---

## Phase 1 — NAB Transaction Load Auto (kanban #27)

Delivered. See `f21c331` and prior commits. Pipeline summary:

1. Find unprocessed NAB CSVs in the watched Drive folder
2. Sweep NAB_Raw pending rows (K empty) before each file
3. Parse CSV → normalise → filter by last-processed date → fingerprint dedup
4. Sort in-memory: settled oldest-first, pending at tail
5. Append to NAB_Raw (B..K) + write FilterID formula (L)
6. Flush + bake settled FilterIDs (static integer, not formula)
7. Resize NAB / Transactions / Everyday_Balances tables
8. `classifyAndPushPending_`: push Blank-Purpose / Gift Card / PayPal rows to NAB_General
9. Count NAB_General validation failures (Purpose set but Account/Category/Subcategory missing)
10. Telegram notification with run summary

---

## v6 — #39 fix: classifier backfill leak (batch-scoping)

**Date added:** 2026-06-10  
**Status:** Spec — awaiting Jocoo sign-off  
**Assignee:** Kronk implements, Yzma spec/review  
**Kanban:** #39

### Root cause (Kronk diagnosis)

`classifyAndPushPending_()` reads the **entire** NAB sheet on every run and
deduplicates against the **live** content of NAB_General (column A IDs). This
conflates two distinct concepts:

- **OUTBOX**: rows currently waiting for manual classification in NAB_General
- **LEDGER**: rows the classifier has ever offered for classification

If NAB_General entries disappear (Jocoo classifies and moves them out, manual
cleanup, or any out-of-band edit), the next run re-adds them — the dedup check
passes because the ID is gone from the OUTBOX.

The bug was latent since the PayPal/GiftCard/Blank push was introduced (v4).
It fired when NAB_General content diverged from the full NAB history.

### Fix: Option A — scope classifier to current batch

Change `classifyAndPushPending_` to accept the already-computed `batches` array
from `checkForNewNABFilesInner_` and only classify rows that were just loaded.

**Contract after fix**: "classify rows from THIS run's imports only". If
`rowsLoaded === 0` the classifier writes nothing. Historical rows already in NAB
are never re-evaluated.

This is idempotent: running on the same CSV twice is blocked by `PROCESSED_FILE_IDS`;
running with no new CSV means no new rows to classify.

**What it does NOT fix**: if a row was classifed and INTENTIONALLY deleted from
NAB_General by Jocoo (e.g., he wants to re-classify it), it will not be re-added.
This is the DESIRED behaviour — re-addition is a manual operation.

**What it does NOT fix**: historical drift already in NAB_General (rows that
shouldn't be there from prior bug runs). Those need a one-time purge by Jocoo +
Step 9 anomaly-fix to validate remaining entries.

### Code change

**Signature change** (`NABProcessor.gs`):
```javascript
// Before:
function classifyAndPushPending_()

// After:
function classifyAndPushPending_(loadedRows)
// loadedRows: flat Array of 10-element rows matching NAB_Raw B..K layout
//             (same elements as what appendToNabRaw_ received per batch)
//             Pass [] when called from a reconcile-only run.
```

**Internal change**: replace `readNabSheet_()` call with a filtered read using
the incoming `loadedRows`. Build `existingIds` as before (NAB_General current
state) to avoid duplicate push within the same run if the classifier is called
multiple times.

The `readNabSheet_()` function itself is kept; it may be used in future
reconciliation pass logic. Just not called from the main classifier loop.

**Main.gs integration**: flatten `batches` into a single rows array before calling:
```javascript
const allLoadedRows = batches.flatMap(b => b.rows)
const classify = classifyAndPushPending_(allLoadedRows)
```

**Mapping from NAB_Raw layout to classifier needs**: the loaded rows are in
NAB_Raw B..K order (indices 0..9):
```
[0]=Date [1]=Amount [2]=AccountNum [3]=Empty [4]=TxType [5]=TxDetails
[6]=Balance [7]=Category [8]=MerchantName [9]=Processed
```
The classifier needs: id (from NAB, not in loaded rows), date, description, amount.

**Why not pass batches directly to the classifier**: The loaded rows (NAB_Raw B..K
layout) do NOT contain `purpose` (NAB.K is a formula column on the NAB sheet, not
in the raw CSV). The classifier needs `purpose` to detect blank-purpose rows. So
`readNabSheet_()` stays; we just add an ID-set filter to limit which rows it acts on.

**Confirmed**: `(b.startRow - 1) + i` is the correct ID formula. Sheet row 2 = ID 1,
so `id = sheetRow - 1`. startRow is post-sweep lastRow+1 (Kronk confirmed:
`deletePendingNabRawRows_` runs at line 68, `appendToNabRaw_` at line 94 in
Main.gs, within the same per-file iteration). Formula holds.

**Multi-file edge case** (Kronk analysis): when file N appends pending rows (IDs
105-109) and file N+1 sweeps them, the re-used IDs 105-109 appear in BOTH batches'
ID sets. The union Set is a superset of the true new-row IDs, but this is harmless:
the `has()` check runs against NAB's current content, so it can only pass for rows
that actually exist in NAB at classification time. No false positives, no false
negatives.

**Idempotent edge cases**:
- Empty run (no files): `batches` empty → Set empty → classifier writes nothing. ✓
- Sweep-only (pending overwritten, rowsLoaded=0): `batches` empty → same. ✓
- Parse error on one file: `batches.push` only happens after `appendToNabRaw_`
  succeeds, so failed files never contribute IDs. ✓

**Finalized code (Main.gs)**:
```javascript
// Build after all file iterations complete (before resize try-block ends).
const currentBatchIds = new Set()
for (const b of batches) {
  for (let i = 0; i < b.rows.length; i++) currentBatchIds.add(b.startRow - 1 + i)
}
const classify = classifyAndPushPending_(currentBatchIds)
```

This is the minimum-invasive Option A: one extra `continue` guard + one Set arg.
`readNabSheet_` still reads all of NAB but the loop skips anything not in the
current batch. Correct because: new rows are always at the end of NAB (appended),
and SEQUENCE IDs match their positions.

### Note on Option B (persistent ledger)

Option B (track all-time pushed IDs in a `_Classified` sheet or ScriptProperties)
is the correct long-term invariant but adds complexity (ledger maintenance,
reconcile path, 9KB ScriptProperties cap risk with ~2500+ IDs). Defer to v7
unless Jocoo requests it. Option A is sufficient for the #39 bug.

---

## v6 — Step 9: NAB_General / NAB_Rec anomaly-fix (kanban #40)

**Date added:** 2026-06-10  
**Status:** Spec — awaiting Jocoo sign-off  
**Assignee:** Kronk implements, Yzma spec/review

### Background

When a NAB transaction goes from pending to settled, the Apps Script pipeline
deletes the pending row from NAB_Raw and re-appends the settled version. Because
NAB_Raw column A uses `=SEQUENCE(COUNTA(B2:B))` (sequential ID by row position),
the new settled row may get a different SEQUENCE ID than the original pending row.
If NAB_General or NAB_Rec stored the old pending ID (e.g., a manually reconciled
row in NAB_Rec, or a legacy row added before the pending-skip guard was in place),
those stored IDs become stale.

The NAB_General sheet has conditional formatting that flags:
- **Whole row red** — stored ID doesn't correspond to the same transaction in
  NAB_Raw (ID mismatch: the ID now belongs to a different transaction, or is
  orphaned entirely)
- **Date cell (B) red** — stored ID is correct but the stored Date doesn't match
  NAB_Raw's current Date for that ID

Same CF logic applies to NAB_Rec.

**Current data state (2026-06-10):** verified clean — 2565 rows in NAB_Raw
(IDs 1..2565, no gaps), all 648 NAB_General entries valid with matching dates.
Step 9 is therefore a no-op on first run; it activates reactively on future
pending→settled cycles.

### Q1 / Q2 resolved (2026-06-10)

**Q1 — CF formula**: Nincs szükség a pontos CF formulára. A kód direkt
összehasonlítást végez NAB_Raw-val (lásd az algoritmus lentebb). A CF vizuális
jelzés; a kód ugyanazt a logikát számítja ki függetlenül. `getBackground()` nem kell.

**Q2 — NAB_Rec Check_Date (G)**: Formula — `=VLOOKUP(<row number>, NAB_Raw!A:B, 2)`.
Automatikusan újraszámít ha a Date (B) változik. A kód NEM nyúl a G oszlophoz.

**Domain note (Jocoo explicit)**: A pending NAB_Raw sorok szándékosan vannak bent
a rendszerben — Jocoo látni akarja őket. Ezért a candidate resolution-be a pending
sorok is bekerülnek (nem csak settled). Self-healing: ha a pending később settled-re
vált új ID-vel, Step 9 következő futása újra-detektál és javít.

### Placement in the pipeline

Step 9 runs **before** the existing Blank fields check, with a hard gate between
them. Updated order in `checkForNewNABFilesInner_`:

```
... (flush + bake + resize)
→ fixNabGeneralAnomalies_()          // NEW: Step 9a — fix stale IDs/Dates
→ fixNabRecAnomalies_()              // NEW: Step 9b — same for NAB_Rec
→ assertNabAnomaliesClean_()         // NEW: hard gate — stop if any reds remain
→ classifyAndPushPending_()          // existing Step 12-13+18
→ countNabGeneralValidationFailures_()  // existing Step 17
```

Both `fix*` functions run every time (not gated on `rowsLoaded`), so they catch
anomalies introduced by manual edits or prior bug runs, not just the current
run's imports.

### Algorithm — `fixNabGeneralAnomalies_()` / `fixNabRecAnomalies_()`

Shared implementation via `fixSheetAnomalies_(sheetName, numCols)`.

**Inputs:**
- NAB_Raw: A=ID, B=Date, G=Transaction Details (= Description in target sheets),
  C=Amount, K=Processed
- Target sheet (NAB_General or NAB_Rec): A=ID, B=Date, C=Description, D=Amount

**Detection logic** (replaces CF formula, equivalent result):
- **Stale ID**: `rawById.get(storedId)` returns no entry OR entry whose Description/Amount
  doesn't match → the stored ID is orphaned or has been reassigned to a different transaction
- **Stale Date**: `rawById.get(storedId)` exists, Description/Amount match, but stored
  Date ≠ NAB_Raw Date

**Step-by-step:**

```
1. Build two indexes from NAB_Raw (ALL rows, both settled and pending):

     rawById      : Map<id, {date, description, amount, settled}>
     rawByDescAmt : Map<desc+"|"+normAmt, Array<{id, date, settled}>>

   "normAmt" = parseFloat(strip "$,").toFixed(2)
   Both maps include pending (K empty) rows — Jocoo intentionally keeps them
   visible and wants them as valid resolution candidates.

2. Read all target sheet rows:
     rows = [{sheetRow, id, date, description, amount}]

3. For each row — classify and collect update:

   CASE D (clean): rawById has id, desc+amt match, date matches → skip

   CASE C (date only): rawById has id, desc+amt match, date differs
     → update = {sheetRow, newId: null, newDate: rawEntry.date}
     → dateUpdates++

   CASE A/B (orphan or ID reassigned): rawById missing id OR desc/amt mismatch
     → candidates = rawByDescAmt[desc+"|"+normAmt]
          filtered: |candidate.date − stored_date| ≤ 7 days
          sorted:   settled first; within same tier: smallest |delta|;
                    tie-break: higher id (more recent)
     → if 0 candidates:
          LOG orphan-unresolved (sheetName, sheetRow, id)
          skipped++
     → if 1+ candidates:
          best = candidates[0]
          update = {sheetRow, newId: best.id, newDate: best.date}
          idUpdates++
          NOTE: if best.settled === false, the ID is still pending and will
          change again when it settles. Step 9 will self-heal on next run.

4. Apply all updates in one pass (individual setValues per cell, or batch).
   Write newId to col A, newDate to col B. Never touch other columns.
   (NAB_Rec G=Check_Date is a VLOOKUP formula, auto-recalculates — do NOT write.)

5. If any updates: sort target sheet by col A ascending (single .sort() call).

6. Return {idUpdates, dateUpdates, skipped}
```

### Hard gate — `assertNabAnomaliesClean_()`

Runs after both fix functions. Re-scans NAB_General and NAB_Rec using the same
`rawById` index. Counts any rows that are STILL anomalous (i.e., fixSheetAnomalies_
could not resolve them).

If `generalStillRed + recStillRed > 0`:
- Call `notifyError_('step9-unresolved', ...)` with message:
  `"Step 9: manual fix needed — N red rows remain in NAB_General, M in NAB_Rec.
   Pipeline stopped before Blank check. Fix red rows and re-run."`
- **Throw** to halt `checkForNewNABFilesInner_`. The outer try-catch in Main.gs
  calls `notifyError_('main', err)` which sends the error to Telegram.

If 0 remaining anomalies: return silently, pipeline continues.

**Note**: this scan uses the same `buildNabRawIndexes_()` data. It is NOT a fresh
sheet read — the fix functions already flushed their writes so the in-memory indexes
are sufficient to verify the result.

### Edge cases

| Case | Handling |
|------|----------|
| ID not in NAB_Raw, no matching desc+amt within 7 days | LOG orphan-unresolved, skipped++ → hard gate fires if unresolved |
| Same desc+amt, multiple candidates within 7 days | Pick settled-first, then smallest delta, then higher ID |
| Same desc+amt, no candidates within 7 days but pending exists outside window | Still skipped (7-day rule is strict) |
| Candidate is pending (K empty) | Allowed as fix target; will self-heal when it settles next run |
| Empty description or amount in target row | Skip (corrupt data), skipped++ |
| Empty ID in target row | Skip, skipped++ |
| All rows clean | No sheet writes, assertClean passes immediately |

### Relationship to #39 (PayPal backfill bug)

**Separate issues. Do not merge.**

| | #39 | Step 9 (v6) |
|--|-----|-------------|
| Problem | Extra rows in NAB_General that should not exist (past PayPal txns) | Stale ID/Date in LEGITIMATE rows |
| Fix | Delete erroneous rows | Update ID/Date, sort |
| Trigger | One-time bug in prior run | Reactive: any pending→settled cycle |
| Scope | NAB_General only | NAB_General + NAB_Rec |
| Status | in_progress at Kronk | Awaiting spec sign-off |

**Execution order:** #39 fix runs as part of its own PR. After that lands, Step 9
runs cleanly against the corrected data. If #39 hasn't landed yet when Step 9 is
released, Step 9 is still safe: it only touches ID and Date columns (never deletes
rows), so erroneous extra rows remain (waiting for #39 fix) and are just sorted.

### Code sketch (for Kronk)

New file: `NABAnomalyFixer.gs`.

```javascript
// Normalise an amount string: strip $, commas → sign + 2dp, e.g. "-111.90"
function normAmount_(v) {
  if (v === '' || v == null) return ''
  const n = parseFloat(String(v).replace(/[$,]/g, ''))
  return isNaN(n) ? '' : n.toFixed(2)
}

// Build rawById + rawByDescAmt from ALL NAB_Raw rows (settled AND pending).
// Pending rows are valid resolution candidates (Jocoo domain rule).
function buildNabRawIndexes_() {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB_RAW)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return { byId: new Map(), byDescAmt: new Map() }
  // Cols A=1, B=2, C=3, G=7, K=11
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues()
  const byId = new Map()
  const byDescAmt = new Map()
  for (const r of data) {
    const id = r[0], date = r[1], amount = r[2], desc = r[6], processed = r[10]
    if (!id) continue
    const settled = processed !== '' && processed != null &&
      !(typeof processed === 'string' && processed.trim() === '')
    const entry = { date, description: String(desc).trim(), amount: normAmount_(amount), settled }
    byId.set(id, entry)
    const key = entry.description + '|' + entry.amount
    if (!byDescAmt.has(key)) byDescAmt.set(key, [])
    byDescAmt.get(key).push({ id, date, settled })
  }
  return { byId, byDescAmt }
}

const ANOMALY_DATE_WINDOW_MS = 7 * 24 * 3600 * 1000

function fixSheetAnomalies_(sheetName, numCols, indexes) {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(sheetName)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return { idUpdates: 0, dateUpdates: 0, skipped: 0 }

  const { byId, byDescAmt } = indexes
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues()
  const updates = []
  let idUpdates = 0, dateUpdates = 0, skipped = 0

  for (let i = 0; i < data.length; i++) {
    const [id, date, description, amount] = data[i]
    if (!id || !description) { skipped++; continue }

    const normAmt = normAmount_(amount)
    const rawEntry = byId.get(id)
    const descMatch = rawEntry && rawEntry.description === String(description).trim()
    const amtMatch  = rawEntry && rawEntry.amount === normAmt

    if (rawEntry && descMatch && amtMatch) {
      // Case D: full match — check date
      const sd = parseNabDateString_(date), rd = parseNabDateString_(rawEntry.date)
      if (sd && rd && sd.getTime() === rd.getTime()) continue
      // Case C: date mismatch only
      updates.push({ sheetRow: i + 2, newId: null, newDate: rawEntry.date })
      dateUpdates++
      continue
    }

    // Case A/B: orphan or ID reassigned — resolve via desc+amount lookup
    const key = String(description).trim() + '|' + normAmt
    const storedMs = parseNabDateString_(date) ? parseNabDateString_(date).getTime() : null
    const candidates = (byDescAmt.get(key) || []).filter(c => {
      if (!storedMs) return false
      const cd = parseNabDateString_(c.date)
      return cd && Math.abs(cd.getTime() - storedMs) <= ANOMALY_DATE_WINDOW_MS
    })
    if (candidates.length === 0) {
      Logger.log('[Step9] unresolved: ' + sheetName + ' row ' + (i + 2) + ' id=' + id)
      skipped++
      continue
    }
    // Sort: settled first, then smallest |delta|, then higher id
    candidates.sort((a, b) => {
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
      // NAB_Rec col G (Check_Date) is =VLOOKUP formula — do NOT write
    }
    sheet.getRange(2, 1, lastRow - 1, numCols).sort({ column: 1, ascending: true })
  }

  return { idUpdates, dateUpdates, skipped }
}

// Re-scan a sheet for remaining anomalies after fixes. Returns count of still-red rows.
function countRemainingAnomalies_(sheetName, indexes) {
  const ss = SpreadsheetApp.openById(cfg_(PROP_KEYS.SPREADSHEET_ID))
  const sheet = ss.getSheetByName(sheetName)
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return 0
  const { byId } = indexes
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues()
  let red = 0
  for (const [id, date, description, amount] of data) {
    if (!id || !description) { red++; continue }
    const e = byId.get(id)
    if (!e) { red++; continue }
    if (e.description !== String(description).trim() || e.amount !== normAmount_(amount)) { red++; continue }
    const sd = parseNabDateString_(date), rd = parseNabDateString_(e.date)
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

function assertNabAnomaliesClean_(indexes) {
  const genRed = countRemainingAnomalies_(SHEET_NAMES.NAB_GENERAL, indexes)
  const recRed = countRemainingAnomalies_(SHEET_NAMES.NAB_REC, indexes)
  if (genRed + recRed > 0) {
    const msg = 'Step 9: manual fix needed -- ' + genRed + ' red row(s) remain in NAB_General, ' +
      recRed + ' in NAB_Rec. Pipeline stopped before Blank check. Fix red rows and re-run.'
    notifyError_('step9-unresolved', new Error(msg))
    throw new Error(msg)
  }
}
```

### Integration in `Main.gs`

Add to `result` object:
```javascript
generalIdFixes: 0, generalDateFixes: 0, generalSkipped: 0,
recIdFixes: 0, recDateFixes: 0, recSkipped: 0
```

Add after `resizeEverydayBalancesTable_()` block, before `classifyAndPushPending_`:
```javascript
tick('Step 9: anomaly fix start')
const nabIndexes = buildNabRawIndexes_()
const genFix = fixNabGeneralAnomalies_(nabIndexes)
result.generalIdFixes  = genFix.idUpdates
result.generalDateFixes = genFix.dateUpdates
result.generalSkipped  = genFix.skipped
const recFix = fixNabRecAnomalies_(nabIndexes)
result.recIdFixes   = recFix.idUpdates
result.recDateFixes = recFix.dateUpdates
result.recSkipped   = recFix.skipped
assertNabAnomaliesClean_(nabIndexes)   // throws + notifies if reds remain
tick('Step 9: done')
```

### Telegram notification additions

In `notifyRunResult_`, append if non-zero:
```
🔧 NAB_General: {n} ID fix, {n} date fix, {n} unresolved
🔧 NAB_Rec:     {n} ID fix, {n} date fix, {n} unresolved
```
Unresolved lines are urgent — they indicate the hard gate would have fired on the
next run if assertNabAnomaliesClean_ hadn't already halted it.

---

## Backlog / planned

- **#35**: Balance table resize (TableManager)
- **#36**: Rename to Financials Processor (multi-bank scope)
- **Phase 2**: ING import
- **Phase 3**: NAB Reconciliation
- **Phase 4**: NAB Bank Statement
