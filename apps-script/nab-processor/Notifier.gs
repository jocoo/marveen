// Notifier.gs -- outbound Telegram notification via UrlFetchApp.
//
// sendMessage is multi-client safe: this Apps Script Notifier and the Yzma
// agent's local getUpdates poller can share the same bot token without
// conflict. Only inbound (getUpdates/webhook) is single-consumer.

function sendTelegram_(text) {
  const token = cfg_(PROP_KEYS.TELEGRAM_BOT_TOKEN)
  const chatId = cfg_(PROP_KEYS.TELEGRAM_CHAT_ID)
  const resp = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + token + '/sendMessage',
    {
      method: 'post',
      payload: { chat_id: chatId, text: text },
      muteHttpExceptions: true
    }
  )
  if (resp.getResponseCode() >= 300) {
    Logger.log('Telegram sendMessage failed: ' + resp.getResponseCode() + ' ' + resp.getContentText())
  }
}

// Telegram message templates (Yzma's wording, 2026-06-08; pending-import
// rotation update 2026-06-08 via Cuzcoo #97):
//   - new files, pending classification: "NAB YYYY-MM-DD -- N (settled S + pending P) betoltve, K regi pending felulirva. Y sor töltendő NAB_General-ban. Gift Card/Paypal: Z sor."
//   - new files, all classified: "NAB YYYY-MM-DD -- N (settled S + pending P) betoltve, K regi pending felulirva. Minden osztályozva."
//   - no new files: silent (formatRunSummary_ returns null)
function formatRunSummary_(result) {
  if (result.filesProcessed === 0) return null
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
  const giftPaypalCount = Math.max(0, (result.pushedToGeneral || 0) - (result.pendingClassification || 0))
  const loadBreakdown = '(settled ' + (result.settledLoaded || 0) + ' + pending ' + (result.pendingLoaded || 0) + ')'
  const overwriteNote = (result.pendingOverwritten || 0) > 0
    ? ', ' + result.pendingOverwritten + ' regi pending felulirva'
    : ''
  const head = 'NAB ' + today + ' -- ' + result.rowsLoaded + ' tranzakció ' + loadBreakdown + ' betöltve' + overwriteNote + '.'
  const backlogNote = (result.filesRemaining || 0) > 0
    ? ' Backlog: ' + result.filesRemaining + ' CSV hátra (auto-retrigger 1 perc múlva).'
    : ''
  if (result.pendingClassification > 0) {
    return head + ' ' + result.pendingClassification + ' sor töltendő NAB_General-ban. Gift Card/Paypal: ' + giftPaypalCount + ' sor.' + backlogNote
  }
  return head + ' Minden osztályozva.' + backlogNote
}

function notifyRunResult_(result) {
  const msg = formatRunSummary_(result)
  if (!msg) return
  sendTelegram_(msg)
}

function notifyError_(stage, err) {
  try {
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
    sendTelegram_('NAB HIBA ' + today + ' [' + stage + ']: ' + (err && err.message ? err.message : err))
  } catch (e) {
    Logger.log('Failed to notify error: ' + e)
  }
}
