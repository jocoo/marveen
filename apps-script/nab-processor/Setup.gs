// Setup.gs -- one-shot admin functions, manually run from the Apps Script
// editor on first install (and again if a folder/spreadsheet changes).

// One-time: store the NAB folder + spreadsheet IDs and auto-discover the
// existing Table IDs on NAB / Transactions / Everyday_Balances. Folder ID is
// the public resource ID from the Drive URL; it does not grant access on its
// own.
function setupNAB() {
  setCfg_(PROP_KEYS.NAB_FOLDER_ID, '1KC15lTngs4UKqy9CTI0Mk1J9xygSip36')
  setCfg_(PROP_KEYS.SPREADSHEET_ID, '1fDPeAD_Koos6Ur1S5_fc5tx1J9Oinuo1dk1sBWHAqio')
  setupTableIds()
  Logger.log('NAB folder + spreadsheet + table IDs stored.')
}

// One-time: verify Telegram bot token + chat ID are present in Script
// Properties. Set them manually via Project Settings -> Script Properties
// (Browser.inputBox is blocked in standalone scripts).
function setupTelegram() {
  const token = cfg_(PROP_KEYS.TELEGRAM_BOT_TOKEN)
  const chatId = cfg_(PROP_KEYS.TELEGRAM_CHAT_ID)
  if (!token || !chatId) {
    throw new Error('Missing Script Properties. Add ' +
      PROP_KEYS.TELEGRAM_BOT_TOKEN + ' and ' + PROP_KEYS.TELEGRAM_CHAT_ID +
      ' via Project Settings -> Script Properties, then re-run.')
  }
  Logger.log('Telegram token + chat ID present (token len=' + token.length +
    ', chat=' + chatId + ').')
}

// One-time: look up the existing Table IDs in the spreadsheet (NAB,
// Transactions, Everyday_Balances) and store them in ScriptProperties. Tables
// already exist in Jocoo's sheet; this just discovers their IDs.
function setupTableIds() {
  const sid = cfg_(PROP_KEYS.SPREADSHEET_ID)
  const sheetsResp = Sheets.Spreadsheets.get(sid)
  const wanted = {
    [SHEET_NAMES.NAB]: PROP_KEYS.NAB_TABLE_ID,
    [SHEET_NAMES.TRANSACTIONS]: PROP_KEYS.TRANSACTIONS_TABLE_ID,
    [SHEET_NAMES.EVERYDAY_BALANCES]: PROP_KEYS.EVERYDAY_BALANCES_TABLE_ID
  }
  const found = {}
  for (const sheet of (sheetsResp.sheets || [])) {
    const sheetName = sheet.properties.title
    const propKey = wanted[sheetName]
    if (!propKey) continue
    const tables = sheet.tables || []
    if (tables.length === 0) {
      Logger.log('No Table object found on sheet ' + sheetName + ' -- skipping')
      continue
    }
    setCfg_(propKey, tables[0].tableId)
    found[sheetName] = tables[0].tableId
  }
  Logger.log('Table IDs stored: ' + JSON.stringify(found))
}

// One-time: install the 2-hour time-driven trigger. Idempotent -- removes any
// existing trigger for checkForNewNABFiles before creating a fresh one.
function setupTrigger() {
  const existing = ScriptApp.getProjectTriggers()
  for (const t of existing) {
    if (t.getHandlerFunction() === 'checkForNewNABFiles') ScriptApp.deleteTrigger(t)
  }
  ScriptApp.newTrigger('checkForNewNABFiles')
    .timeBased()
    .everyHours(2)
    .create()
  Logger.log('Trigger installed: checkForNewNABFiles every 2h')
}

// Convenience: full first-time setup. Run after setupTelegram() (which is
// interactive and cannot be chained from this entry).
function setupAll() {
  setupNAB()
  setupTrigger()
  Logger.log('Setup complete. Telegram still requires setupTelegram() if not already run.')
}
