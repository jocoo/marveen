// DriveWatcher.gs -- finds NAB CSV files in the watched folder that the
// pipeline hasn't yet processed.
//
// "New" means: file ID not in PROCESSED_FILE_IDS. We don't rely on
// LAST_RUN_TIMESTAMP alone because a file could land while a run is in
// flight and get skipped in the next window otherwise.

function findUnprocessedCsvFiles_() {
  const folder = DriveApp.getFolderById(cfg_(PROP_KEYS.NAB_FOLDER_ID))
  const seen = getProcessedFileIds_()
  const out = []
  const it = folder.getFilesByType(MimeType.CSV)
  while (it.hasNext()) {
    const f = it.next()
    if (seen.has(f.getId())) continue
    out.push({ id: f.getId(), name: f.getName(), modified: f.getLastUpdated().getTime() })
  }
  // Oldest first so chronological imports stay in order.
  out.sort((a, b) => a.modified - b.modified)
  return out
}

// Parse YY_MM_DD.csv filenames to a Date for downstream "Date" column
// reconciliation. Returns null if the filename doesn't match.
function parseStatementDateFromName_(name) {
  const m = String(name).match(/^(\d{2})_(\d{2})_(\d{2})\.csv$/i)
  if (!m) return null
  const year = 2000 + parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  const day = parseInt(m[3], 10)
  return new Date(year, month, day)
}
