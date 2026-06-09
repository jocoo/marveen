// TableManager.gs -- thin wrapper over the Sheets API v4 Table operations.
//
// Apps Script's SpreadsheetApp does NOT expose Table objects directly. We use
// the Advanced Sheets Service (Sheets.Spreadsheets.batchUpdate) instead.
// updateTable with a FieldMask of 'table.range' is the programmatic equivalent
// of the manual 'Adjust Table Range' menu action.
//
// API gained Table support 2025-04-29. Confirmed working in 2026.

function resizeTable_(spreadsheetId, tableId, sheetId, rowCount, columnCount) {
  const req = {
    requests: [{
      updateTable: {
        table: {
          tableId: tableId,
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: rowCount,
            startColumnIndex: 0,
            endColumnIndex: columnCount
          }
        },
        fields: 'table.range'
      }
    }]
  }
  Sheets.Spreadsheets.batchUpdate(req, spreadsheetId)
}

function getSheetMetadata_(spreadsheetId, sheetName) {
  const resp = Sheets.Spreadsheets.get(spreadsheetId)
  for (const sheet of (resp.sheets || [])) {
    if (sheet.properties.title === sheetName) {
      return {
        sheetId: sheet.properties.sheetId,
        rowCount: sheet.properties.gridProperties.rowCount,
        columnCount: sheet.properties.gridProperties.columnCount,
        tables: sheet.tables || []
      }
    }
  }
  throw new Error('Sheet not found: ' + sheetName)
}

// Resize the NAB table to cover all data rows. Each per-table wrapper
// null-guards its own Table ID so that one missing config (e.g.
// EVERYDAY_BALANCES_TABLE_ID never set) surfaces as its own Telegram alert
// instead of swallowing all three resizes via Main.gs's outer try/catch.
function resizeNabTable_() {
  const tableId = cfgOptional_(PROP_KEYS.NAB_TABLE_ID)
  if (!tableId) {
    notifyError_('resize-nab', new Error('NAB_TABLE_ID not configured -- run setupTableIds()'))
    return
  }
  const sid = cfg_(PROP_KEYS.SPREADSHEET_ID)
  const ss = SpreadsheetApp.openById(sid)
  const sheet = ss.getSheetByName(SHEET_NAMES.NAB)
  const lastRow = sheet.getLastRow()
  const lastCol = sheet.getLastColumn()
  const meta = getSheetMetadata_(sid, SHEET_NAMES.NAB)
  resizeTable_(sid, tableId, meta.sheetId, lastRow, lastCol)
}

function resizeTransactionsTable_() {
  const tableId = cfgOptional_(PROP_KEYS.TRANSACTIONS_TABLE_ID)
  if (!tableId) {
    notifyError_('resize-transactions', new Error('TRANSACTIONS_TABLE_ID not configured -- run setupTableIds()'))
    return
  }
  const sid = cfg_(PROP_KEYS.SPREADSHEET_ID)
  const ss = SpreadsheetApp.openById(sid)
  const sheet = ss.getSheetByName(SHEET_NAMES.TRANSACTIONS)
  const lastRow = sheet.getLastRow()
  const lastCol = sheet.getLastColumn()
  const meta = getSheetMetadata_(sid, SHEET_NAMES.TRANSACTIONS)
  resizeTable_(sid, tableId, meta.sheetId, lastRow, lastCol)
}

function resizeEverydayBalancesTable_() {
  const tableId = cfgOptional_(PROP_KEYS.EVERYDAY_BALANCES_TABLE_ID)
  if (!tableId) {
    notifyError_('resize-everyday-balances', new Error('EVERYDAY_BALANCES_TABLE_ID not configured -- run setupTableIds()'))
    return
  }
  const sid = cfg_(PROP_KEYS.SPREADSHEET_ID)
  const ss = SpreadsheetApp.openById(sid)
  const sheet = ss.getSheetByName(SHEET_NAMES.EVERYDAY_BALANCES)
  const lastRow = sheet.getLastRow()
  const lastCol = sheet.getLastColumn()
  const meta = getSheetMetadata_(sid, SHEET_NAMES.EVERYDAY_BALANCES)
  resizeTable_(sid, tableId, meta.sheetId, lastRow, lastCol)
}
