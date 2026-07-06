# Scouts Equipment Inventory & Lending System - Option Analysis

**Prepared by:** Yzma | **Date:** 2026-07-02  
**Context:** Northern Beaches Scout Group, Smithfield Cairns - QM onboarding  
**Criteria:** free/low-cost · mobile-friendly (phone in storage room) · volunteer-friendly UX · lending log · condition tracking

---

## Exec summary

1. Scoutbook (BSA) and PartKeepr eliminated: US-specific and component-tracking tool respectively, not applicable.
2. Snipe-IT eliminated: LAMP stack installation cannot be expected from volunteers, no dedicated mobile app.
3. Sortly Free eliminated: 100 item limit + 1 user, export and QR label printing are paid ($49/mo).
4. **Recommended: Google Forms + Google Sheets 'Checkout Station' pattern** - free, operable by QR code from phone, zero learning curve, full lending log + condition tracking.
5. Fallback: paper-based lending logbook remains in storage as offline backup.

---

## Options matrix

Score: 1 (poor) - 5 (excellent)

| Option | Free | Mobile UX | Volunteer UX | Lending log | Condition | Setup difficulty | **Total** |
|--------|------|----------|-------------|-------------|-----------|-----------------|----------|
| **Google Forms + Sheets** | 5 | 4 | 5 | 4 | 4 | 2 (one-off) | **24** |
| Sortly Free | 3* | 5 | 5 | 3 | 3 | 1 | **20** |
| Snipe-IT (self-hosted) | 5 | 2 | 2 | 5 | 5 | 5 (complex) | **24** |
| Paper-based (fallback) | 5 | 1 | 4 | 3 | 2 | 1 | **16** |

*Sortly: 100 item limit, 1 user, export+QR print are paid - mid-range score

**Setup difficulty: lower = better** (1 = 30 min, 5 = weeks)

---

## Detailed option evaluations

### Google Forms + Google Sheets (RECOMMENDED)

**How it works:**
- 2 Google Forms: 'Checkout' (who takes it) + 'Return' (who brings it back)
- QR code generated for each form (free: bitly.com/qr, qrlynx.com, etc.)
- QR codes printed and affixed to storage room door / shelves
- Google Sheets automatically aggregates submitted form data
- QM reviews weekly: who took what, whether it was returned

**Checkout Form fields:**
1. Name (short text)
2. Equipment name (dropdown - pre-populated list)
3. Quantity (number)
4. Condition at checkout (multiple choice: Excellent / Good / Worn / Damaged)
5. Expected return date (date picker)
6. Email (optional - for reminders)

**Return Form fields:**
1. Name
2. Equipment name (same dropdown)
3. Quantity returned
4. Condition on return (multiple choice: Excellent / Good / Worn / Damaged / Lost)
5. Notes (textarea - e.g. 'replacement needed')

**Google Sheets structure:**
- Tab 1: Checkout log (auto, form responses)
- Tab 2: Return log (auto, form responses)
- Tab 3: Active loans (=VLOOKUP/manual filter: checked out but not yet returned)
- Tab 4: Inventory master (manually maintained, all equipment + estimated value for insurance)

**Advantages:**
- Completely free (Google account)
- Any phone scans the QR code, no app download required
- All volunteers are familiar with Google Forms
- QM can receive email notification on every submission
- Sheets exportable as PDF for Treasurer/insurance

**Disadvantages:**
- Tab 3 (active loans) requires manual refresh or a QUERY formula
- No automatic reminder (does not email automatically on overdue loans)
- Does not work offline in storage (mobile signal generally available in Smithfield, Cairns)

**Estimated setup time:** 2-3 hours (form creation + QR generation + Sheets template + test)

---

### Sortly Free

**Key facts:**
- Free plan: max 100 items, 1 user
- Mobile app iOS + Android, QR code scanning on all plans
- QR label printing: Advanced plan only ($49/mo) - DISQUALIFYING
- Export (CSV/PDF): paid - DISQUALIFYING
- Condition tracking: not structured on free plan

**Verdict:** 100 item and 1 user limit likely insufficient for an active Scouts group store (tents, cooking gear, camping equipment, activity items = easily 100+ items). Paid plan disproportionately expensive for a volunteer group.

---

### Snipe-IT (self-hosted, open source)

**Key facts:**
- Unlimited assets + users, completely free
- Self-hosted: Ubuntu + MySQL + PHP + Nginx installation required
- Lending (check-in/check-out) built in natively, no add-ons
- Condition tracking built in
- No dedicated mobile app (third-party available with security concerns)
- Web-based, responsive design - accessible via phone browser

**Verdict:** Technically the strongest option, but a Scouts group's volunteers will not install and maintain a LAMP stack. If Jocoo has a personal VPS to host it - could be considered as a long-term option. Not realistic short-term.

---

### Paper-based (fallback)

**What the paper logbook should include:**
- A4 lending sheet on the storage room door (logbook style)
- Fields: date / equipment name / borrower name / phone / expected return / actual return / condition / signature
- QM photographs monthly (phone) and enters into Sheets

**Why keep it:** power outages, venues without mobile coverage, simple events where Forms is overkill.

---

## Recommended implementation plan: Google Forms + Sheets

### Phase 1: Base setup (2-3 hours, one-off)

1. Create Google Sheets: "NBSG Equipment" (4 tabs: Checkout log / Return log / Active loans / Inventory master)
2. Populate Inventory master tab: enter current equipment list (taken over from outgoing QM)
3. Create Checkout Form (Google Forms) - with equipment dropdown list
4. Create Return Form (Google Forms)
5. Both forms linked to Sheets (Form -> Responses -> Google Sheets)
6. Generate QR codes for both forms (qrlynx.com / bitly.com - free)
7. Print QR codes at A5, laminate (weather protection), affix to storage room door

### Phase 2: Refinement (after first month)

- QUERY formula for 'Active loans' tab (not yet returned)
- Enable Google Forms email notification (QM receives email on every checkout)
- Optional: Apps Script reminder (auto-email to borrower on overdue loan) - Kronk can assist if needed

### Phase 3: Event (40th anniversary, September)

- Separate temporary checkout log for the event (to keep the main log uncluttered)
- Event equipment pack list: what goes out, what comes back - checkbox format

---

## Inventory master template (Google Sheets Tab 4)

| Item ID | Category | Description | Qty | Condition | Replacement value (AUD) | Last checked | Notes |
|---------|----------|-------------|-----|-----------|------------------------|-------------|-------|
| T001 | Tent | Patrol tent 4-person | 3 | Good | 150 | 2026-07 | |
| C001 | Cooking | Camp kitchen set | 2 | Excellent | 80 | 2026-07 | |
| G001 | Games | Rope course set | 1 | Worn | 200 | 2026-07 | Top rope needs replacement |
| ... | | | | | | | |

Condition values: Excellent / Good / Worn / Needs repair / Scrap

**This Inventory master also serves as the insurance record** (based on replacement values).

---

## Links

| Source | Link |
|--------|------|
| Google Forms | https://forms.google.com |
| Free QR generator (for Forms) | https://qrlynx.com/blog/qr-code-for-google-forms-guide |
| Sortly (reference only, not recommended) | https://www.sortly.com/pricing/ |
| Snipe-IT (reference only, not recommended short-term) | https://snipeitapp.com/ |

---

*Yzma | 2026-07-02*
