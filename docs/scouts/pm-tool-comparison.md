# Scouts 40th Anniversary Event - PM Tool Comparison

**Period:** September 2026 (event)  
**Context:** Jocoo new Quartermaster, 40th anniversary event, volunteers without PM background  
**Criteria:** free/low-cost · simple UX · budget-tracking · multi-user · mobile

---

## Comparison matrix

Score: 1 (poor) - 5 (excellent)

| Tool | Free | Simple UX | Budget-tracking | Multi-user | Mobile | **Total** |
|------|------|-----------|-----------------|------------|--------|----------|
| **Trello** | 5 | 5 | 2* | 5 | 5 | **22** |
| ClickUp | 5 | 3 | 4 | 5 | 4 | **21** |
| Asana | 4 | 4 | 2 | 4 (15 users) | 4 | **18** |
| Notion | 3 | 3 | 4 | 4 | 3 | **17** |
| Airtable | 3 | 3 | 5 | 3 (5 editors) | 3 | **17** |
| Google Sheets + Calendar | 5 | 4 | 5 | 5 | 3 | **22** |

*Trello budget: no native feature, patchable via Google Drive Power-Up (free)

---

## Detailed evaluation

### Trello
- **Free tier:** unlimited cards, 10 boards/workspace, unlimited members
- **UX:** best in field - drag-and-drop kanban, understandable in 5 minutes by anyone
- **Budget:** no native feature, but a Google Sheets link can be pinned to the board (1 click)
- **Mobile:** excellent iOS/Android app
- **Risk:** if budget tracking is also needed inside Trello, not possible natively

### ClickUp
- **Free tier:** unlimited users, 100 MB storage, unlimited tasks
- **UX:** feature-rich, which may overwhelm volunteers; more setup time required
- **Budget:** solvable with custom fields, but requires configuration
- **Mobile:** app available, but on a more complex interface
- **Risk:** over-engineered for a one-off event

### Asana
- **Free tier:** max 15 members (may be sufficient for Scouts), no Gantt view on free
- **UX:** good, but switching between Kanban + List views has a learning curve
- **Budget:** no native feature, Google Sheets integration needed
- **Risk:** 15-member limit may be an issue before September if group grows

### Google Sheets + Calendar (fallback)
- **Free:** completely
- **UX:** universally familiar, but weak as a PM tool (no task status, dependency, drag-and-drop)
- **Budget:** excellent, full control
- **Risk:** task tracking fragments across email/chat, not aggregatable

---

## Top-1 recommendation: Trello + Google Sheets budget tab

**Why Trello?**

1. Zero learning curve - a volunteer is productive in 5 minutes
2. Unlimited free users (important: Scouts group could have 40+ people)
3. Best mobile experience - usable on-site
4. Sufficient for a one-off event PM setup; no complex project hierarchy needed

**Budget solution:** 1 Google Sheets file pinned to the Trello board top (Trello free Power-Up -> Google Drive). Live budget table there, editable by everyone.

---

## Event Workstream Template - Trello board config

**Board name:** `Scouts 40th Anniversary - Sept 2026`

### Lists (swimlanes left to right)
```
📋 Backlog  |  🔄 In Progress  |  ⏳ Waiting/Blocked  |  ✅ Done
```

### Card label system
| Colour | Category |
|--------|----------|
| 🟡 Yellow | Venue & Logistics |
| 🔵 Blue | Catering & Food |
| 🟢 Green | Activities & Program |
| 🔴 Red | Budget & Finance |
| 🟣 Purple | Communications & Invites |
| ⚫ Grey | Volunteers & Roles |

### Per-card fields
- **Due date** (on every card)
- **Assignee** (volunteer name)
- **Checklist** (sub-tasks)
- **Attachment** (e.g. quote PDF, booking confirmation)

### Starter card list (backlog)
- [ ] Venue booking confirmed (#Venue, due: Aug 1)
- [ ] Catering quote received (#Catering, due: Aug 15)
- [ ] Invites sent (#Communications, due: Aug 20)
- [ ] Volunteer roles assigned (#Volunteers, due: Aug 25)
- [ ] Budget final balance (#Budget, due: Sept 5 - event day)
- [ ] Equipment/props list complete (#Logistics, due: Aug 30)

### Budget Sheet structure (Google Sheets)
| Category | Planned (AUD) | Actual (AUD) | Difference | Notes |
|----------|--------------|-------------|------------|-------|
| Venue | | | | |
| Catering | | | | |
| Decoration | | | | |
| Equipment | | | | |
| Printing | | | | |
| **TOTAL** | | | | |

---

## Setup steps (estimated time: 45 min)

1. Create Trello workspace (5 min) - with Jocoo's Gmail account
2. Create board with the above structure (15 min)
3. Invite volunteers by email (5 min - they receive a link, no Google account required for Trello)
4. Create Google Sheets budget tab (15 min)
5. Pin budget sheet to Trello board (5 min)

---

*Yzma | 2026-07-02*
