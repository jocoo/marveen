# Offsider: Industry Admin Burden + Vertical AI Competitor Research

> Scope: input for Offsider, a new, from-scratch product concept — a personal AI agent fleet sold to Australian SMBs instead of built for a single individual. At install, the customer picks their industry and the system auto-configures a team of role-specific agents for that vertical. This is NOT a fork of Marveen (the existing internal system) — it is a separate product idea informed by the same architecture pattern.
>
> This document covers the four launch verticals for the Australian market: **automotive repair shops**, **small law firms**, **small accounting/bookkeeping firms**, and **cafes/restaurants**.
>
> This research builds on [`docs/marveen-landscape/COMPARISON.md`](../marveen-landscape/COMPARISON.md), which already covers *general-purpose* open-source AI agent frameworks (LangGraph, CrewAI, AutoGen, etc.). That ground is not repeated here — this document is scoped strictly to **industry-specific (vertical) AI products and automation burdens**.

---

## Cross-industry pattern

Four things are true across all four verticals:

1. **Compliance is fragmented, not federal.** Every vertical researched has state-based (not national) rules for at least one major obligation — motor vehicle repairer licensing and roadworthy schemes (auto), Law Society/regulator per state (legal), food safety licensing regimes (hospitality). A single hardcoded rule set per industry will be wrong for at least one Australian state. The product needs a jurisdiction dimension, not just an industry dimension.
2. **AML/CTF "Tranche 2" is a live, shared deadline right now.** Law firms and (some) accounting/bookkeeping services both become newly regulated "designated services" under Australia's AML/CTF reform, with AUSTRAC enrolment due **29 July 2026** and compliance required from **1 July 2026**. Given today's date (2026-07-06), this is inside the compliance window for both verticals simultaneously — a strong, time-sensitive wedge for an early product pitch to legal and accounting customers.
3. **Every vertical AI competitor found is a point solution.** Diagnostic AI, quoting AI, drafting AI, bookkeeping AI, rostering AI — each covers one narrow slice. Nobody found combines genuine AI with *ongoing regulatory-obligation orchestration* across a small business's full admin surface. That gap is consistent across all four industries and is the core differentiation opportunity for an agent-fleet product (many named agents, one shared memory/kanban, proactive nudging) rather than another single-purpose SaaS app.
4. **AU-native players tend to be workflow SaaS with shallow AI; AI-forward players tend to be global/US-built with no AU compliance awareness.** The overlap of "AU-specific" and "genuinely AI-driven" is thin in every vertical. A product that is both AU-compliance-aware and agent-driven from day one has no direct incumbent in any of the four segments researched.

---

## 1. Automotive repair shops

### 1.1 Administrative / compliance burden (Australia)

- **State-based motor vehicle repairer licensing (no national scheme).** NSW requires a Motor Vehicle Repairer Licence under the Motor Dealers and Repairers Regulation 2025 (Source: NSW Government). WA runs its own regime via Consumer Protection WA. VIC, SA, and QLD are mid-remake of their repairer regulations as of 2024–2025, so rules a fleet configures for today may shift within the year (Source: MTA NSW submission, June 2024).
- **Job card / record-keeping, with real penalties.** NSW licensed repairers must keep a prescribed register (including second-hand parts detail); failing to keep proper records can draw a $1,100 on-the-spot fine or prosecution up to $5,500 (Source: NSW Fair Trading).
- **Itemised invoices/receipts on request** under Australian Consumer Law, with penalties for non-compliance (Source: NSW Fair Trading).
- **Quote vs. estimate — a real legal distinction workshops mishandle.** A "quote" is binding once part of the contract; an "estimate" has more latitude but final cost still "should not be too much more," and customers can dispute/refuse to pay the excess (Source: NT Government; WA Consumer Protection).
- **ACL consumer guarantees apply independently of any warranty** and survive warranty expiry; if a repairer fails to fix a problem in reasonable time, the customer can get it repaired elsewhere and recover reasonable costs (Source: ACCC industry guide).
- **Roadworthy/safety certificate schemes are state-specific, non-transferable, different names/validity/price**: VIC Roadworthy Certificate (30 days, ~$150–200), NSW Pink Slip/eSafety Check (42 days, ~$80–120), QLD Safety Certificate (2–3 months, ~$120–180). A NSW pink slip is not valid for a QLD transaction (Source: SimplyFleet; Toros Roadworthy; Mr Roadworthy).
- **WHS obligations**: hoists/compressors/jacks serviced per Australian Standards (e.g. AS 2550), trained-staff-only operation; hazardous substances (oils, fuels, coolants, degreasers) require bunded, labelled, ventilated storage (Source: Safe Work Australia; SafetyDocs).
- **Asbestos in pre-2004 vehicles.** Asbestos-containing brake pads/shoes/clutch plates banned nationally from 31 Dec 2003 — any older vehicle serviced today may carry legacy asbestos parts, a specific hazard-ID duty (Source: asbestos.sa.gov.au; SafeWork NSW).
- **Environmental/EPA waste rules.** Waste oil is classified as prescribed/hazardous industrial waste requiring licensed collection; stormwater contamination is a specific offence; tyre storage above ~5 tonnes/500 tyres requires an EPA licence and council consent (Source: NSW EPA; VIC EPA).
- **No uniform statutory cooling-off period for repairs** — cooling-off rights that exist are mostly tied to vehicle *sales*, not repairs, and vary by state (Source: ACCC industry guide PDF).

Net: this vertical's compliance burden is the most **state-fragmented** of the four — licensing, roadworthy schemes, and EPA rules all differ by jurisdiction.

### 1.2 Existing vertical AI/automation competitors

| Product | Automates | AI or just SaaS | Gap |
|---|---|---|---|
| **Tekmetric** (US) | RO workflow, estimates, customer comms | SaaS workflow; AI via add-ons | No AU compliance/record-keeping layer |
| **AutoLeap** (US/Canada) | Shop management + "AutoLeap AIR" AI phone/scheduling agent | Meaningful AI (voice agent) | No AU localisation; no roadworthy/licensing awareness |
| **Shop-Ware / Bolt On Technology** | Inspections, comms, workflow, payments | Mostly automation/SaaS | US-centric parts catalogs/warranty norms |
| **AutoQuoteIQ / AutoTechIQ** (Mar 2026) | AI repair estimates from historical work-order data | Genuine AI | Quoting-only; not AU-specific; no compliance |
| **MECH AI / Bosch "Super Technician"** | AI diagnostic assistant (fault codes, repair guides) | Meaningful AI | Technician-facing only; no admin/compliance |
| **MechanicDesk** (AU-built) | Booking, invoicing, stock, job diary, SMS reminders | SaaS, not meaningfully AI | AU-native but no AI diagnostics/quoting/compliance — the clearest "local player with an AI gap" |
| **Auxo Workshop** (AU, MTA-affiliated) | Booking, job tracking, invoicing, analytics | Borderline AI (unclear ML claims) | Same as MechanicDesk |
| **Workshop Mate** (AU) | Booking/diary, job/parts management | SaaS, not AI | No AI, no compliance |
| **ARI (Auto Repair Software)** | Digital inspections with AI annotations, AI labor-guide estimating | Meaningful AI | Global, not AU-tuned; no compliance layer |

**Gap**: AI-forward players (AutoQuoteIQ, MECH AI, Bosch) are narrow US/global point-tools with zero AU regulatory awareness. AU-native players (MechanicDesk, Auxo, Workshop Mate) are workflow SaaS with weak-to-no real AI. Nobody combines AU-specific compliance automation with genuine AI.

### 1.3 Recommended agent roles

- **Compliance Agent** — tracks state-specific licensing renewal dates, roadworthy/safety certificate validity windows, EPA waste-tyre/oil thresholds; answers the state-fragmentation problem no competitor models.
- **Quote & Estimate Agent** — drafts ACL-compliant quotes/estimates, distinguishes binding "quote" from variable "estimate" language, flags cost overruns before they become ACCC disputes.
- **Job Card / Register Agent** — maintains the prescribed job-card/register record (incl. second-hand parts) per state rules; NSW alone fines up to $5,500 for defective record-keeping.
- **Diagnostic Assist Agent** — technician-facing AI helper for fault-code interpretation and repair-guide lookup, competing with MECH AI/Bosch but bundled with compliance/quoting rather than sold standalone.
- **Workshop Safety Agent** — tracks WHS/asbestos/hazardous-substance obligations (hoist service schedules, storage checks, pre-2004 asbestos flags) and EPA reporting thresholds; no competitor addresses WHS or environmental compliance at all.

---

## 2. Small law firms

### 2.1 Administrative / compliance burden (Australia)

- **Trust accounting.** Any practice holding trust money — sole practitioners included — needs external examination of trust records every trust year (1 Apr–31 Mar). NSW: Part A due 30 Apr, External Examiner's Report by 31 May, via the Law Society's Trust Lodgement Portal; up to 50 penalty units (~$10,176 for 2025-26) for failing to have records examined (Source: Law Society of NSW). QLD trust year also ends 31 Mar, Form 5 due within 60 days (30 May) (Source: QLS Proctor). Monthly three-way reconciliation window differs by state: 5 business days in QLD vs. 15 working days in VIC/ACT/NSW/NT/SA/WA/TAS (Source: Xero AU trust accounting guide). WA runs its own regime via the Legal Practice Board of WA.
- **Practising certificate renewal / CPD.** 10 CPD units per CPD year (1 Apr–31 Mar), including compulsory fields (ethics, practice management, professional skills, substantive law); up to 3 units can be carried over if completed Jan–Mar (Source: Law Society of NSW CPD).
- **Costs disclosure.** Under s.174 of the Uniform Law, written costs disclosure required as soon as practicable where costs are likely to exceed $750 (excl. GST/disbursements), with updated disclosure required on material scope/cost change (Source: Law Society of NSW Costs Guidebook; AustLII).
- **Professional indemnity insurance.** Compulsory in every state as a condition of practising certificate (Lawcover NSW, LPLC VIC, Lexon QLD), Uniform Rules minimum $2m per claim including defence costs (Source: Law Council of Australia).
- **File/matter retention.** Conduct Rule 14 sets 7-year minimum retention for client documents not returned at matter completion, with carve-outs (wills kept indefinitely, family law financial agreements often longer) (Source: LIV retention guidelines; LPLC).
- **Conflict-of-interest checking.** ASCR Rules 10–12 impose a continuing duty to avoid conflicts; firms expected to run a documented conflict-check procedure at intake with retained records of searches/decisions/consents (Source: Law Society Journal; ASCR Rule 12).
- **AML/CTF "Tranche 2" — live now.** Lawyers are newly captured reporting entities. AUSTRAC enrolment opened 31 Mar 2026; newly regulated entities must enrol by **29 July 2026** and comply from **1 July 2026**. New obligations: AUSTRAC enrolment, documented AML/CTF programme, customer due diligence, sanctions/PEP screening, suspicious matter reporting, 7-year record-keeping (Source: Zyphe; First AML). Given today's date, small firms are inside this compliance window right now — the single most urgent new admin burden in the vertical.
- **State variance**: separate regulators/portals per state (Law Society NSW, VLSB+C VIC, QLS, LPBWA, Law Society SA, ACT Law Society) and separate PII scheme administrators — a multi-state firm faces duplicated compliance calendars, not one national one.

### 2.2 Existing vertical AI/automation competitors

| Product | What it automates | AI depth | Gap |
|---|---|---|---|
| **LEAP** (AU) | Practice management, trust accounting, billing, precedents; "LawY" AI research assistant, "MatterAI" matter chronologies, background AI time-recording | Meaningful AI bolted onto mature PMS | AI is drafting/research/time-capture facing, not compliance-facing (no CPD tracking, trust-audit prep, AML/CTF program mgmt) |
| **Smokeball** (AU) | Practice/matter mgmt, intake, auto time capture; "Archie" matter assistant | Real, iterating AI | Same pattern — no statutory compliance monitoring across trust/CPD/PII/AML |
| **Actionstep** (AU/NZ, global) | Practice/document mgmt; AI Legal Assistant integration (Nov 2025) for agentic drafting | AI via third-party integration | Drafting-centric; no compliance-calendar automation |
| **CoCounsel** (Thomson Reuters/ex-Casetext) | Document review/summarisation, contract extraction, drafting | Strong genAI | Optimised for US law; AU case law needs Westlaw Precision add-on; not a small-firm compliance layer |
| **Harvey** | Enterprise legal AI copilot | Deep AI | Explicitly BigLaw/AmLaw-200 priced ($1,200–2,000+/seat/month) — structurally excludes solo/small AU firms |
| **Spellbook** | Word-native contract drafting/review | Real AI, small-firm priced | Purely drafting — no practice management or trust/CPD/AML compliance surface |
| **Josef** (AU) | No-code legal workflow/chatbot builder; "Josef Q" Q&A; Rapid Ingestion Engine (Apr 2026) | Meaningful, AU-founded | Built for in-house/compliance teams and larger firms' self-service tooling, not solo/small-firm statutory compliance out of the box |
| **TrustSoft** | Trust accounting + AML/CTF compliance automation (CDD, risk assessments, reporting), beta AML/CTF module ~$1,200/yr | Workflow/rules automation | Currently targets real estate agents/conveyancers/motor dealers/auctioneers — **not yet law firms**, despite lawyers facing the identical Tranche 2 deadline. Live, unclaimed niche. |

**Gap**: every competitor clusters around drafting, research, matter management, and intake. None productise the recurring statutory compliance calendar — trust-year exam prep, CPD tracking, costs-disclosure hygiene, and (most urgently) AML/CTF Tranche 2 stand-up — as an always-on agent function for solo/small firms.

### 2.3 Recommended agent roles

- **Trust & Compliance Agent** — tracks the trust year, enforces state-correct reconciliation windows, assembles External Examiner packs ahead of deadlines, flags AUSTRAC Tranche 2 enrolment/AML-programme milestones. The single most under-served, time-critical burden found, and one no vertical competitor covers.
- **Deadline Agent** — unified compliance calendar across CPD renewal, practising certificate renewal, PII policy renewal (all on different clocks from the trust year).
- **Costs & Engagement Agent** — generates/updates s.174-compliant costs disclosures and flags when scope change legally requires re-disclosure; untouched by LEAP/Smokeball/Actionstep's drafting-focused AI.
- **Conflict & Intake Agent** — runs documented conflict-checks at intake against current/former clients, logs searches/decisions/consents per ASCR Rules 10–12.
- **Records Agent** — enforces the 7-year (or longer, matter-type-specific) retention rule, flags destruction-eligible files vs. indefinite-retention files, preserves native-format email metadata.

---

## 3. Small accounting / bookkeeping firms

### 3.1 Administrative / compliance burden (Australia)

- **BAS lodgment cycles.** Quarterly if turnover <$20m (unless directed otherwise), monthly if $20m+ or by choice, annual if voluntarily registered under $75,000 turnover. Quarterly 2025-26 due dates: 28 Oct 2025, 28 Feb 2026, 28 Apr 2026, 28 Jul 2026; monthly due 21st of following month (Source: ato.gov.au).
- **Registered agent lodgment extensions.** Formally engaging a registered BAS/tax agent typically grants ~4 extra weeks on quarters 1, 3, 4. Extensions only apply if the client is formally on the agent's client list before the original due date — a recurring practical trap (Source: ato.gov.au; bishopcollins.com.au).
- **ATO Registered Agent Lodgment Program 2025-26.** Differentiated due dates by client type and lodgment-date band, including staggered payment dates tied to when the return was actually lodged. New-registrant SMSFs: 31 Oct 2025 (self-prepared) or 28 Feb 2026 (via tax agent).
- **TPB registration renewal & CPE.** Registered tax agents need 120 CPE hours over 3 years, BAS agents 90 hours, minimum 20 hours/year for both — a precondition for registration renewal (Source: tpb.gov.au).
- **Professional indemnity insurance.** Mandatory for any fee-charging tax/BAS agent; minimum $1,000,000 aggregate cover for practices with turnover over $500,000; lapse is a Code of Professional Conduct breach that can trigger deregistration (Source: tpb.gov.au; TPB(GS) 06/2010).
- **STP obligations.** Any firm lodging STP on a client's behalf is providing a payroll service and must itself be TPB-registered (BAS agent minimum). STP Phase 2 increases compliance surface; closely-held-payee quarterly concessions are under tightening ATO review.
- **AML/CTF "Tranche 2."** From 1 July 2026, some accounting/bookkeeping services become "designated services," triggering AUSTRAC enrolment (due 29 July 2026) and a mandatory AML/CTF program by 1 July 2026. Not all firms are captured — routine bookkeeping/BAS payment-processing under client authority is not automatically designated — but firms must actively assess exposure (Source: austrac.gov.au; xero.com).
- **Client engagement letters and record-keeping.** TPB Code requires clear engagement terms and retained evidence of advice/lodgment basis (typically 5-year retention).
- **Trust account handling.** Firms holding client money attract additional trust-accounting/reconciliation obligations, a common focus of TPB Code investigations when commingled with practice funds.

### 3.2 Existing vertical AI/automation competitors

| Product | What it automates | Meaningful AI? | Gap |
|---|---|---|---|
| **Xero + "Just Ask Xero" (JAX)** | Conversational financial Q&A, auto reconciliation, invoicing, predictive payment forecasting/reminders | Yes, genuinely agentic | Built around bookkeeping/cashflow, not the ATO/TPB regulatory calendar — no BAS/tax due-date awareness, no CPE tracking, no PII/AML program management |
| **MYOB "AI BAS"** | Auto-imports/categorises bank feeds, calculates GST, flags missing receipts, prepares lodgment-ready BAS | Yes, narrowly | Solves BAS prep only; no multi-client deadline orchestration or the agent's own TPB/PII/CPE obligations |
| **Karbon** | AI email triage/categorisation, drafted replies, capacity planning, automated extension tracking, workflow suggestions | Yes — strongest deadline/workflow AI of the group | Global generic tool, not AU-lodgment-native out of the box; skews toward mid-size firms |
| **FYI (Docs)** (AU/NZ) | Document/practice management, auto-filing, workflow automation | Limited/emerging | Strong on documents, weak on proactive compliance-deadline intelligence |
| **Ignition (+ FYI)** | Proposal/engagement-letter automation, e-signature, billing automation | Automation-first | Covers engagement-letter obligation well; nothing on ongoing lodgment/CPE/PII tracking |
| **Dext / Hubdoc** | AI receipt/invoice/bank-statement extraction and categorisation | Yes, for OCR/extraction | Pure data-capture layer; zero compliance-calendar awareness |
| **Truewind / Docyt / Botkeeper** (global) | End-to-end bookkeeping automation, reconciliation, month-end close acceleration | Yes, meaningful reconciliation AI | US-centric; no ATO/TPB/AUSTRAC awareness |

**Gap**: every serious AI player optimises bookkeeping/reconciliation automation or generic practice workflow. None combine AI with a first-class AU-specific regulatory-obligation engine tracking the firm's own compliance load (TPB renewal, CPE hours, PII currency, per-client lodgment due dates with extension logic, AML/CTF Tranche 2) tied to proactive multi-client deadline sequencing.

### 3.3 Recommended agent roles

- **Deadline & Lodgment Agent** — owns the ATO Registered Agent Lodgment Program and BAS calendars per client, including agent-extension eligibility rules; the biggest gap found, since no competitor tracks the firm's multi-client regulatory calendar end-to-end.
- **Document & Reconciliation Agent** — ingests receipts/invoices/bank feeds for AI-assisted categorisation/reconciliation (commodity space Dext/Hubdoc/MYOB/Xero JAX already cover), freeing the fleet's differentiation for compliance orchestration.
- **Practice Compliance Agent** — tracks the firm's own TPB registration renewal, CPE hours vs. 90/120-hour targets, PII currency — none of which any reviewed competitor addresses.
- **AML/CTF Readiness Agent** — screens which client engagements constitute "designated services" ahead of the 1 July 2026 deadline, flags AUSTRAC enrolment/program milestones, maintains risk-assessment/CDD record trail — essentially no incumbent tooling yet.
- **Client Query & Engagement Agent** — handles routine client-facing questions and engagement-letter e-signature flows, closing the gap between Karbon's generic triage AI and an AU compliance-literate client assistant.

---

## 4. Cafes / small restaurants

### 4.1 Administrative / compliance burden (Australia)

- **Food safety supervision, state-inconsistent.** NSW requires a certified Food Safety Supervisor (FSS, SITSS00069 skill set) for premises serving unpackaged, potentially hazardous food, renewed every 5 years (Source: NSW Food Authority). VIC classifies premises into 4 risk classes under the Food Act 1984; Class 1 and most Class 2 need a written Food Safety Program; mobile/temporary premises register via FoodTrader (Source: health.vic.gov.au). QLD food licensing is administered by **local councils**, not the state — renewal/inspection terms vary per council. A multi-site operator faces three non-harmonised state regimes for the same activity.
- **Local council registration/renewal**, separate from state food-safety regimes, creating a second renewal calendar per venue (especially QLD).
- **Award and roster compliance — highest-risk area.** Cafes/restaurants sit under the Hospitality Industry (General) Award (MA000009) or Restaurant Industry Award (MA000119) — easily confused; Fair Work's PACT tool is recommended to determine which applies. Casual loading 25%; 2025/26 penalty rates (effective first pay period on/after 1 July 2025): Saturday +25%, Sunday +50%, public holiday +125%, plus late-night/early-morning loadings. FWO named fast food/restaurants/cafes an explicit enforcement priority for 2025-26 after recovering $358m for 249,000+ underpaid workers in 2024-25; FWO doesn't need a complaint to investigate. Since 1 Jan 2025, intentional wage theft is a criminal offence (up to $7.8m fines or 10 years' imprisonment) — Carlucci's (VIC) signed an enforceable undertaking in Apr 2026 over $194,011 underpaid to 38 staff (Source: fairwork.gov.au).
- **Payroll and superannuation.** STP mandatory, with ATO now cross-matching STP data against super fund contributions in near real time. SG is 12% of OTE (effective 1 July 2025), applies to casuals same as any employee. "Payday Super" commences **1 July 2026**: SG must be paid same-day as wages, every pay cycle, no small-business exemption — a hard operational shift for venues running informal/end-of-month super runs today.
- **Liquor licensing (if licensed).** NSW: annual risk-based licence fee (e.g. +$5,000/yr for trade past 1:30am); 2026 cycle notices early April, due 29 May, late fee after 26 June, automatic suspension if unpaid by 27 June. VIC: risk fee only if trading past 1am or holding a demerit point in 3 years; renewal deadline 31 December.
- **Allergen labelling (FSANZ Standard 1.2.3).** Plain English Allergen Labelling (PEAL) transition ended **25 February 2026** — generic terms ("tree nuts", "seafood") no longer permitted; specific names required, bolded with distinct contrast. For a cafe this means maintaining an accurate, current allergen matrix across a menu that changes seasonally/daily — recurring, error-prone manual work.
- **WHS (kitchen safety).** PCBU must eliminate/minimise risks from heat, hazardous manual tasks, slips, cuts, fatigue, applying the standard hierarchy of controls; documentation burden includes risk assessments, incident logs, induction records — rarely digitised in small venues.
- **Trade waste / grease trap.** Councils/water utilities require Trade Waste Approval and correctly sized grease traps (~1000L for a small coffee shop, up to 2400L minimum in some jurisdictions for new fit-outs); service logs must be available on request; penalties up to $44,000 per offence.

### 4.2 Existing vertical AI/automation competitors

| Tool | What it automates | AI meaningfully used? | Gap |
|---|---|---|---|
| **Deputy** | Rostering, time & attendance; auto-calculates penalty rates/overtime against Modern Awards | Yes — award-rate calc engine, demand-based roster suggestions | Rostering/payroll only — no food safety, allergen, or trade-waste/licence calendars |
| **Tanda** | Rostering + payroll, HIGA/Restaurant Award templates, real-time penalty-rate flags | Partial — templated logic, vendor warns operators must verify award settings themselves | Same single-domain limitation as Deputy |
| **Ento (→ HumanForce)** | Was rostering/award interpretation for hospitality; being sunset | Legacy, non-AI-first | Market consolidation signal — point-solution rostering tools being absorbed/retired |
| **RosterElf** | Rostering + payroll, tracks RSA/food-safety/first-aid certification expiries | Some — award interpretation, expiry alerting | Certification *tracking* only, not compliance *content* generation/audit |
| **me&u** | Guest-facing smart menu, QR ordering, CRM, AI personalisation | Yes, genuinely AI-personalised at scale | Entirely front-of-house/revenue focused; zero compliance/rostering coverage |
| **H&L POS** | Core POS, workforce/marketing/loyalty/reservations | Limited — mostly integration/transaction backbone | Broad but shallow; compliance features (if any) are add-ons |
| **FoodDocs / IONI / FoodReady AI** | Digital HACCP/food safety plans, AI-generated CCPs, digital logs | Yes — AI parses menus/ingredients to auto-build HACCP plans | Global/generic (FSMA/SQF/BRCGS-oriented); not mapped to AU state schemes (NSW FSS, VIC FoodTrader classes, QLD council licensing); no link to rostering/award data |
| **WISK.ai / MarketMan / Restoke / Nory** | AI inventory, food-cost forecasting, waste detection, purchasing optimisation | Yes — predictive/theoretical-vs-actual analytics | Cost/inventory only; no compliance, no rostering, no allergen management |

**Gap**: rostering/award tools don't touch food safety; food-safety tools aren't localised to the fragmented AU state map and don't talk to payroll/roster data; inventory/cost tools ignore compliance entirely; POS/guest tools are revenue-side only. Nobody cross-references a roster against award rules **and** flags an expiring FSS certificate **and** tracks the next grease-trap service **and** keeps the allergen matrix current — exactly the cross-domain orchestration an agent team is suited to.

### 4.3 Recommended agent roles

- **Compliance Calendar Agent** — tracks every recurring regulatory date specific to the venue's state/council (FSS renewal, food licence renewal, liquor licence window, grease trap service schedule); the biggest gap, since no competitor unifies these disparate deadlines.
- **Roster & Award Agent** — builds/checks rosters against the correct award, flags penalty-rate/casual-loading exposure, cross-checks against FWO's active enforcement priority; existing tools (Deputy, Tanda) do this standalone, not integrated with other venue obligations.
- **Menu & Allergen Agent** — maintains the allergen matrix against FSANZ Standard 1.2.3/PEAL rules and re-validates on every menu change, closing the manual gap generic HACCP tools don't localise to AU labelling law.
- **Payroll & Super Agent** — reconciles STP submissions and Super Guarantee (moving to same-day Payday Super from July 2026) against actual hours worked, catching underpayment before the ATO's real-time data match does.
- **Food Safety & WHS Agent** — runs the digital food safety program/checklist (state-scheme-specific) plus WHS incident/manual-handling logging — an AI-generated HACCP-style plan mapped to actual Australian state schemes rather than a generic global framework.

---

## Summary table: proposed agent fleets by industry

| Industry | Proposed agent roles |
|---|---|
| Auto repair | Compliance Agent, Quote & Estimate Agent, Job Card / Register Agent, Diagnostic Assist Agent, Workshop Safety Agent |
| Law firm | Trust & Compliance Agent, Deadline Agent, Costs & Engagement Agent, Conflict & Intake Agent, Records Agent |
| Accounting firm | Deadline & Lodgment Agent, Document & Reconciliation Agent, Practice Compliance Agent, AML/CTF Readiness Agent, Client Query & Engagement Agent |
| Cafe / restaurant | Compliance Calendar Agent, Roster & Award Agent, Menu & Allergen Agent, Payroll & Super Agent, Food Safety & WHS Agent |

A recurring naming pattern across verticals: every industry wants (a) a **deadline/calendar agent** for its regulator-driven due dates, (b) a **domain-specific record/documentation agent**, and (c) a **compliance-risk agent** watching the industry's single highest-enforcement-risk area (wage theft for hospitality, trust accounting for law, AML/CTF for both law and accounting, licensing/roadworthy for auto). This suggests the install-time "industry parameter" could compose from a smaller set of reusable agent *templates* (Deadline, Records, Risk/Compliance, Client-facing) rather than needing fully bespoke agents built from scratch per vertical — worth validating as an architecture decision before scaling past these first four industries.

---

*Research conducted July 2026. Sources cited inline per section; verify currency of cited deadlines/thresholds before using in customer-facing material, as several (AML/CTF Tranche 2, Payday Super) are live regulatory changes with rolling implementation dates.*
