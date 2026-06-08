# NAB Processor (Apps Script standalone)

Phase 1 of the Financials Dashboard automation. Watches a Drive folder for new
NAB CSV exports, loads them into the `Financials FY26` spreadsheet, and pushes
unknown / Gift Card / Paypal transactions into `NAB_General` for manual
classification. Notifies via Telegram when work is pending.

Kanban: `2c5cc286`. Plan: see Yzma's solution doc (peer message thread, 2026-06-08).

## Architecture

Standalone clasp project (this folder). Bound script on the spreadsheet
(`Code.gs`, `DropDown.gs`) stays untouched -- it owns the cell formula
`FIND_ARRAY_PART_IN_TEXT`, the `onOpen` menu, and the cascading-dropdown
`onEdit` handler.

Modules:

| File | Purpose |
| --- | --- |
| `Config.gs` | ScriptProperties accessors + sheet name constants |
| `Setup.gs` | One-shot installers (`setupNAB`, `setupTelegram`, `setupTableIds`, `setupTrigger`, `setupAll`) |
| `DriveWatcher.gs` | Finds unprocessed NAB CSVs in the watched folder |
| `NABParser.gs` | CSV parse, dedup fingerprint, raw_Sort port |
| `NABRawLoader.gs` | Appends to `NAB_Raw` with auto-assigned IDs + FilterID |
| `NABProcessor.gs` | Pushes Blank-Purpose / Gift Card / Paypal rows into `NAB_General` |
| `TableManager.gs` | Resizes the NAB / Transactions / Everyday_Balances Table objects via Sheets Advanced Service |
| `Notifier.gs` | Telegram sendMessage via UrlFetchApp |
| `Main.gs` | Trigger entry point `checkForNewNABFiles()` |

## First install

```bash
npm install -g @google/clasp
clasp login   # authenticate as joseph.ferenczi@gmail.com
clasp create --type standalone --title "NAB Processor" --rootDir ./apps-script/nab-processor
clasp push
clasp open    # opens the project in the Apps Script editor
```

Then in the editor:

1. **Services** > **+** > **Google Sheets API v4** (advanced service)
2. Run `setupNAB` once. Stores `NAB_FOLDER_ID` + `SPREADSHEET_ID` and
   auto-discovers the existing Table IDs on `NAB`, `Transactions`,
   `Everyday_Balances`.
3. Run `setupTelegram` once. Prompts for bot token + chat ID. Token is
   YzmaBot's; chat ID is Jocoo's personal chat.
4. Run `setupTrigger` once. Installs the 2-hour time-driven trigger.
5. Run `runNow` to smoke-test against any already-pending CSVs.

## When the folder or spreadsheet changes

If Jocoo clones or moves the spreadsheet to a new file (e.g. FY27 rollover),
edit the IDs in `setupNAB` and re-run -- no other code changes needed.

## Dedup contract

Each appended row gets a fingerprint of `Date|Description|Amount` (description
whitespace-collapsed, amount fixed to 2dp). Re-running on the same CSV is a
no-op. The set of processed Drive file IDs is also persisted in
`PROCESSED_FILE_IDS` (capped at 500 most-recent) so the same file does not get
re-parsed.

### Pending rows: delete-and-append rotation

NAB exports include pending rows (`PURCHASE AUTHORISATION`, empty
`Processed On`) which then reappear 1-3 days later as settled rows with a
shifted date and a stripped description suffix. Their fingerprints differ, so
naive append-only import would duplicate.

The pipeline keeps pending rows visible in the spreadsheet but rotates them on
every run:

1. Sweep `NAB_Raw` for rows where `Processed` is empty and delete them.
2. Append the entire incoming CSV (settled + still-pending) below.

The settled forms of previously-pending transactions land cleanly in their
correct date row. Still-pending transactions get refreshed each cycle.

`NABProcessor` skips currently-pending rows (those whose ID maps to an empty
`Processed`) when pushing to `NAB_General` -- pending rows get classified once
they settle, otherwise the next rotation would orphan their `NAB_General`
entries.

## Tables API note

Google Sheets API gained programmatic Table support on 2025-04-29.
`SpreadsheetApp` still does not expose Table objects, but the Advanced Sheets
Service does -- see `TableManager.gs`. The `updateTable` request with
`fields: 'table.range'` is the programmatic equivalent of the manual
**Adjust Table Range** menu action.
