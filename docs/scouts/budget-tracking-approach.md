# Scouts 40th Anniversary Event - Budget Tracking Approach

**Question:** PM tool integrated budget vs. Google Sheets vs. Xero (Treasurer-managed)?  
**Context:** Jocoo = Quartermaster (QM), responsible for expense logging and approval; Treasurer manages Xero; NFP Xero integration for Jocoo is planned elsewhere as a separate project  
**Source:** previous PM tool analysis (pm-tool-comparison.md), CLAUDE.md context

---

## Exec summary

1. The QM role is NOT accounting - Jocoo needs expense logging and approval, not bookkeeping.
2. Google Sheets (event-specific file) is the best QM tracking layer: free, universally familiar, pinnable to Trello.
3. Xero stays with the Treasurer: receives a simple summary from Sheets at month/quarter end.
4. PM tool integrated budget (ClickUp, Notion): overkill and weak on free tier - eliminated.
5. Two-layer architecture (QM Sheets + Treasurer Xero) is the lowest-friction solution.

---

## Options analysis

### Option A: PM tool integrated budget module (Notion / ClickUp)

| Criterion | Assessment |
|-----------|-----------|
| Free | Partial - Notion block limit, ClickUp custom fields require configuration |
| Simplicity | Poor - volunteers + budget tracking simultaneously = high learning curve |
| Treasurer access | Unlikely to replace Xero |
| Real-time editing | Yes |
| Verdict | **Eliminated** - Trello won the previous analysis (no budget module), and ClickUp/Notion is complex for this event scale |

### Option B: Google Sheets (separate file, pinned to Trello)

| Criterion | Assessment |
|-----------|-----------|
| Free | Yes (Google account) |
| Simplicity | High - everyone can use it |
| Flexibility | Full - Jocoo can customise freely |
| Treasurer access | Trivial via "View only" sharing |
| Xero integration | Manual summary handed over at month close |
| Offline | Poor (Sheets mobile app exists, but offline editing is limited) |
| Verdict | **Recommended QM tracking layer** |

### Option C: Xero (Treasurer-managed, with QM input)

| Criterion | Assessment |
|-----------|-----------|
| Access | Jocoo has none / not appropriate for QM role |
| Real-time event budget | Not Xero's strength (operates at invoice level) |
| Granularity | Accounting level, not task-level |
| Simplicity for volunteers | Zero - not self-service |
| Verdict | **Stays as Treasurer's tool** - Jocoo hands over a summary, does not work in Xero |

---

## Recommended architecture: 2 layers

```
QM layer (Jocoo + volunteers)
  └── Google Sheets "Event Budget" file
        ├── Pinned to Trello board (Power-Up, free)
        ├── Tab: Expenses (category, amount, date, approver)
        ├── Tab: Income (sponsor, ticket, donation)
        └── Tab: Summary (planned vs. actual)

Treasurer layer (NFP accounting)
  └── Xero
        └── Jocoo hands over: monthly/post-event summary from Sheets
              (simple PDF export or 'View' link)
```

**Data flow:**
1. Expense incurred -> Jocoo/volunteer logs in Google Sheets (category + amount + receipt link)
2. Jocoo approves (comment in Sheets)
3. Month end / post-event: Jocoo provides summary report to Treasurer
4. Treasurer books in Xero (not Jocoo's job)

---

## Google Sheets structure - starter template

### Tab 1: Expenses

| # | Date | Category | Description | Amount (AUD) | Status | Receipt | Approver |
|---|------|----------|-------------|-------------|--------|---------|---------|
| 1 | | Venue | | | Approved | | Jocoo |
| 2 | | Catering | | | Planned | | |
| 3 | | Decoration | | | Planned | | |
| 4 | | Marketing | | | Planned | | |
| 5 | | Gifts | | | Planned | | |
| 6 | | Other | | | | | |

Status values: Planned / Approved / Paid / Rejected

### Tab 2: Income

| # | Date | Type | Source | Amount (AUD) | Received | Notes |
|---|------|------|--------|-------------|---------|-------|
| 1 | | Sponsor | | | No | |
| 2 | | Ticket | | | No | |
| 3 | | Donation | | | No | |

### Tab 3: Summary (auto-calculated)

| | Planned (AUD) | Actual (AUD) | Difference |
|-|--------------|-------------|-----------|
| Total expenses | =SUM(...) | =SUM(...) | =B2-C2 |
| Total income | =SUM(...) | =SUM(...) | =B3-C3 |
| **Net** | | | |

---

## Decision matrix

| Criterion | GSheets + Trello | ClickUp budget | Xero direct |
|-----------|-----------------|----------------|------------|
| QM self-service | 5 | 3 | 1 |
| Free | 5 | 4 | 0 (Treasurer's tool) |
| Treasurer compatible | 4 (export) | 2 | 5 |
| Volunteer-managed | 5 | 3 | 1 |
| Mobile | 3 | 4 | 3 |
| Setup time | 30 min | 2-3 hrs | N/A |
| **Total** | **22** | **16** | **10** |

---

## Recommendation for Jocoo

**Steps (full setup ~30 min):**

1. New Sheets file in Google Drive: "Scouts 40th Anniversary - Budget 2026"
2. Create 3 tabs with the above template
3. Sharing: Treasurer gets "View" or "Comment" access (not Edit)
4. On Trello board: Add Power-Up -> Google Drive -> pin the Sheets file
5. Post-event: Sheets -> File -> Download as PDF -> hand to Treasurer

**No need for:** ClickUp/Notion budget configuration, requesting Xero access, learning a separate tool.

---

*Yzma | 2026-07-02*
