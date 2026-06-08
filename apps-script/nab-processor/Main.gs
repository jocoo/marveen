// Main.gs -- trigger entry point. checkForNewNABFiles() is what the
// 2-hour time-driven trigger invokes; everything else is private.

// Cap per run so the 6-minute Apps Script timeout is never hit on a large
// backlog. If more files remain, a one-shot retrigger fires ~1 min later
// and drains the rest sequentially.
const MAX_FILES_PER_RUN = 25
const RETRIGGER_DELAY_MS = 60 * 1000
const ONE_SHOT_TRIGGER_ID_KEY = 'ONE_SHOT_RETRIGGER_ID'

function checkForNewNABFiles() {
  // Concurrency guard -- if a previous run (or one-shot retrigger overlap) is
  // still in flight, exit silently. tryLock(0) = non-blocking.
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(0)) {
    Logger.log('checkForNewNABFiles skipped: previous run still holds the lock')
    return null
  }
  try {
    return checkForNewNABFilesInner_()
  } finally {
    lock.releaseLock()
  }
}

function checkForNewNABFilesInner_() {
  const result = {
    filesProcessed: 0,
    filesRemaining: 0,
    pendingOverwritten: 0,
    rowsLoaded: 0,
    settledLoaded: 0,
    pendingLoaded: 0,
    pushedToGeneral: 0,
    pendingClassification: 0,
    validationFailures: 0
  }
  const t0 = Date.now()
  const tick = (label) => Logger.log('[+' + ((Date.now() - t0) / 1000).toFixed(1) + 's] ' + label)
  try {
    tick('listing Drive folder')
    const allFiles = findUnprocessedCsvFiles_()
    tick('listing done, found ' + allFiles.length + ' unprocessed CSVs')
    if (allFiles.length === 0) {
      setCfg_(PROP_KEYS.LAST_RUN_TIMESTAMP, new Date().toISOString())
      return result
    }
    const files = allFiles.slice(0, MAX_FILES_PER_RUN)
    result.filesRemaining = Math.max(0, allFiles.length - files.length)
    // Sweep stale pending FIRST. Order matters: the fingerprint set built
    // below would otherwise still contain the old pending fingerprints and
    // block the now-settled rows in this CSV from being imported. Also makes
    // getLastProcessedDate_ honest (pending rows have empty Processed and
    // would not affect MAX, but the sheet stays smaller for the read).
    tick('deletePendingNabRawRows_ start')
    result.pendingOverwritten = deletePendingNabRawRows_()
    tick('deletePendingNabRawRows_ done, removed ' + result.pendingOverwritten)
    tick('getLastProcessedDate_ start')
    const lastProcessedDate = getLastProcessedDate_()
    tick('getLastProcessedDate_ done: ' + (lastProcessedDate
      ? Utilities.formatDate(lastProcessedDate, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : 'null'))
    tick('buildExistingFingerprints_ start')
    const existingFingerprints = buildExistingFingerprints_()
    tick('buildExistingFingerprints_ done, size ' + existingFingerprints.size)
    // Per-file processing: parse -> Step-4 filter -> fingerprint dedup ->
    // in-memory sort -> append. Per Jocoo (2026-06-08 23:47 AEST), batching
    // across files duplicates rows because the rolling 30-tx snapshots
    // overlap by ~90% and we'd lose per-file dedup boundaries.
    for (const f of files) {
      try {
        tick('processing ' + f.name)
        const text = DriveApp.getFileById(f.id).getBlob().getDataAsString()
        const parsed = parseCsvText_(text)
        const normalised = normaliseNabRows_(parsed)
        const stepFiltered = filterByProcessedThreshold_(normalised, lastProcessedDate)
        const deduped = filterNewRowsByFingerprint_(stepFiltered, existingFingerprints)
        if (deduped.length > 0) {
          const sorted = sortNewRowsInMemory_(deduped)
          const loaded = appendToNabRaw_(sorted)
          result.rowsLoaded += loaded
          for (const r of sorted) {
            // r[9] = Processed (K). Non-empty = settled, empty = pending.
            if (r[9]) result.settledLoaded += 1
            else result.pendingLoaded += 1
          }
        }
        addProcessedFileId_(f.id)
        result.filesProcessed += 1
      } catch (err) {
        notifyError_('parse:' + f.name, err)
        // Skip this file but keep processing the rest.
      }
    }
    tick('per-file loop done, ' + result.rowsLoaded + ' new rows loaded')
    // Table resizes -- NAB picks up the new NAB_Raw rows via its A2 formula,
    // so the NAB table needs its range extended even when we didn't write
    // directly to it. Same for Transactions + Everyday_Balances. Resize also
    // when only pending rows were deleted, since the Table range must shrink
    // to match the NAB_Raw row count.
    try {
      if (result.rowsLoaded > 0 || result.pendingOverwritten > 0) {
        tick('SpreadsheetApp.flush + resize tables')
        SpreadsheetApp.flush()
        resizeNabTable_()
        resizeTransactionsTable_()
        resizeEverydayBalancesTable_()
        tick('resize done')
      }
    } catch (err) {
      notifyError_('table-resize', err)
    }
    tick('classifyAndPushPending_ start')
    const classify = classifyAndPushPending_()
    tick('classifyAndPushPending_ done, pushed ' + classify.pushed)
    result.pushedToGeneral = classify.pushed
    result.pendingClassification = classify.pending
    tick('countNabGeneralValidationFailures_ start')
    result.validationFailures = countNabGeneralValidationFailures_()
    tick('validation done')
    setCfg_(PROP_KEYS.LAST_RUN_TIMESTAMP, new Date().toISOString())
    notifyRunResult_(result)
    if (result.filesRemaining > 0) scheduleOneShotRetrigger_()
    tick('checkForNewNABFiles complete')
    return result
  } catch (err) {
    notifyError_('main', err)
    Logger.log('checkForNewNABFiles fatal: ' + err)
    throw err
  }
}

// Install a one-shot trigger to re-run checkForNewNABFiles after
// RETRIGGER_DELAY_MS. Prior pending one-shot is removed so the trigger list
// stays bounded; the recurring 2h trigger is left alone.
function scheduleOneShotRetrigger_() {
  const prevId = PROP.getProperty(ONE_SHOT_TRIGGER_ID_KEY)
  if (prevId) {
    for (const t of ScriptApp.getProjectTriggers()) {
      if (t.getUniqueId() === prevId) {
        try { ScriptApp.deleteTrigger(t) } catch (e) { Logger.log('cleanup prev one-shot: ' + e) }
        break
      }
    }
  }
  const t = ScriptApp.newTrigger('checkForNewNABFiles')
    .timeBased()
    .after(RETRIGGER_DELAY_MS)
    .create()
  PROP.setProperty(ONE_SHOT_TRIGGER_ID_KEY, t.getUniqueId())
  Logger.log('Scheduled one-shot retrigger in ' + (RETRIGGER_DELAY_MS / 1000) + 's')
}

// Manual smoke-test entry. Run from the Apps Script editor to process any
// pending files immediately, regardless of the trigger schedule.
function runNow() {
  return checkForNewNABFiles()
}
