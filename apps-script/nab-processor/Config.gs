// Config.gs -- ScriptProperties accessor and constants.
//
// Standalone project. All runtime config lives in ScriptProperties so the
// same code can be reused against a cloned spreadsheet or moved folder by
// running setupNAB() with new values.

const PROP = PropertiesService.getScriptProperties()

const PROP_KEYS = {
  NAB_FOLDER_ID: 'NAB_FOLDER_ID',
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  TELEGRAM_BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',
  TELEGRAM_CHAT_ID: 'TELEGRAM_CHAT_ID',
  LAST_RUN_TIMESTAMP: 'LAST_RUN_TIMESTAMP',
  PROCESSED_FILE_IDS: 'PROCESSED_FILE_IDS',
  NAB_TABLE_ID: 'NAB_TABLE_ID',
  TRANSACTIONS_TABLE_ID: 'TRANSACTIONS_TABLE_ID',
  EVERYDAY_BALANCES_TABLE_ID: 'EVERYDAY_BALANCES_TABLE_ID'
}

const SHEET_NAMES = {
  NAB_RAW: 'NAB_Raw',
  NAB: 'NAB',
  NAB_GENERAL: 'NAB_General',
  NAB_REC: 'NAB_Rec',
  FILTER: 'Filter',
  MACRO: 'Macro',
  TRANSACTIONS: 'Transactions',
  EVERYDAY_BALANCES: 'Everyday_Balances'
}

function cfg_(key) {
  const v = PROP.getProperty(key)
  if (!v) throw new Error('Missing ScriptProperty: ' + key + ' (run setupNAB or setupTelegram)')
  return v
}

function cfgOptional_(key) {
  return PROP.getProperty(key)
}

function setCfg_(key, value) {
  PROP.setProperty(key, value)
}

function getProcessedFileIds_() {
  const raw = PROP.getProperty(PROP_KEYS.PROCESSED_FILE_IDS)
  if (!raw) return new Set()
  try { return new Set(JSON.parse(raw)) } catch (e) { return new Set() }
}

function addProcessedFileId_(fileId) {
  const ids = getProcessedFileIds_()
  ids.add(fileId)
  // Cap at 500 most-recent to bound the property size (Apps Script 9KB limit).
  const arr = Array.from(ids).slice(-500)
  PROP.setProperty(PROP_KEYS.PROCESSED_FILE_IDS, JSON.stringify(arr))
}
