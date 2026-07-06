# Offsider — Business Positioning & Two-Layer UI

> Working document. Product concept per kanban #125/#126/#127: a from-scratch,
> from-scratch system for small and medium businesses, built on the architecture
> lessons of our internal Marveen fleet (source/analogy only — not a fork). Install-time the owner
> picks their trade (auto repair / law office / accounting firm / cafe-restaurant,
> AU market, first cohort) and a preconfigured agent team is provisioned around how
> that industry actually runs.
>
> Scope of this doc (card #126): (1) audit the current Marveen dashboard through a
> business-buyer lens, (2) propose a two-layer Business / Admin UI, (3) draft the
> positioning copy for the SMB owner. Author: Chicha. Status: v1, awaiting Jocoo sign-off.
> Naming, branding, pricing and final feature scope are Jocoo's calls — flagged inline, not decided here.

> **Decisions locked (post team-sync, Jocoo sign-off):**
> - **Beachhead vertical: auto repair first** (a concrete shop is available to pilot), cafe/restaurant second. Positioning examples below still list hospitality where written; treat auto-repair as the launch persona.
> - **Market name: "Offsider"** (AU slang for a tradie's right hand). Repo/internal codename: "fleet". No "Marveen" or dev branding is ever visible to the buyer.
> - **Billing: flat monthly fee per pack**, internal spend-cap as unit-economics guard. Owner does not see raw token/cost.
> - **Delivery: managed VPS, AU/Sydney region.** Positioning pivots from "local-first" to "fully managed, AU-hosted" (see §5/point-3 rationale below).
> - **Roles: Owner/Admin two-role UI**; approvals data model carries a future `approver` field so a Manager seat can be added without rework.
> - **Admin access: network isolation** (localhost + support tailnet), not a PIN.
> - **Files/Deliverables: engine in core, visibility configurable per industry pack.**
>
> Phase 0 (architecture/repo) not yet started — Jocoo has not given the explicit go.

---

## 1. The core reframe

Marveen today is a **cockpit for the person who built the fleet.** Every control
the operator could ever want is one click away in a flat 22-item sidebar: model
selection, MCP connectors, token spend, migration tooling, autonomy flags, raw
memory rows, background process state.

That is correct for Marveen's actual user — a technical single operator who *wants*
the knobs. It is exactly wrong for an SMB owner. A panel beater, a solicitor, a
bookkeeper or a cafe owner does not want to "configure an agent." They want to walk
in, see what their team handled overnight, approve the two things that need a human,
and get on with their day.

The product decision is not "hide the complexity." It is **split the audience.**
There are two distinct people:

- **The Owner / Operator** — runs the business, uses the system daily, is not technical.
  Wants outcomes and approvals, not internals.
- **The Administrator** — whoever installs and maintains it: the owner's IT person,
  a reseller/MSP, or us during onboarding. Wants the knobs Marveen already exposes.

Marveen collapses these into one screen. Offsider must separate them into two
**layers with separate navigation and role-gating**, defaulting every login to the
Business layer.

---

## 2. Dashboard audit — what an SMB owner sees today

Current sidebar (22 items) classified through a non-technical owner's eyes.
"Scare/confuse factor" = how likely this item makes a cafe owner feel they bought
developer software they can't operate.

| Current nav item | What it actually is | Business-owner reaction | Disposition in Offsider |
|---|---|---|---|
| Áttekintés (Overview) | Stats: user turns, schedule runs, memory count | Mixed — some useful, mostly ops metrics | **Rebuild** as business "Today" |
| Kanban | Task board with `planned/in_progress/waiting/done`, seq IDs | "What's a kanban? What's a seq?" — jargon | **Rebuild** as "Work" (plain task list) |
| Archivált (Archived) | Archived cards | Neutral, low value daily | Admin (or folded into Work history) |
| Ügynökök (Agents) | Agent config: **model selection, restart, scaffolding, desired-state** | High scare — model names, restart buttons, process control | **Admin only** |
| Aktivitás (Activity) | Technical activity graph | "Is something broken?" anxiety | **Admin only** |
| Csapat (Team) | Agent roster / personas | Useful and reassuring — humanizes it | **Keep**, promote to Business |
| Üzenetek (Messages) | Inter-agent message bus | Confusing — internal plumbing exposed | **Reframe**: only owner↔team threads in Business; raw bus is Admin |
| Ütemezések (Schedules) | Cron jobs: `0 8 * * *`, heartbeat/task types | High scare — cron syntax is developer-only | **Rebuild** as "Routines" (plain-language) |
| Memória (Memories) | Raw hot/warm/cold memory rows, keyword search | Confusing — "why am I reading a database?" | **Reframe**: "What the team knows" (read-mostly); raw rows Admin |
| Napló (Daily log) | Append-only daily summary | Useful — reads like a work diary | **Keep**, promote to Business |
| Háttér (Background) | Background task/process state | High scare — process internals | **Admin only** |
| Skillek (Skills) | Auto-generated SKILL.md files | Confusing — "what's a skill file?" | **Admin only** (surface *capabilities* in Business instead) |
| MCP (Connectors) | MCP server config, OAuth, tokens | Very high scare — protocol-level config | **Admin only** (Business gets a friendly "Connected apps") |
| Költöztetés (Migrate) | Migration tooling | Irrelevant/scary to owner | **Admin only** |
| Dokumentáció (Docs) | Internal docs | Neutral | **Admin only** (Business gets a simple Help) |
| Státusz (Status) | System health | "Red = I broke it?" anxiety | **Admin only** (Business gets one green/amber pill) |
| Autonómia (Autonomy) | Autonomy level flags | Confusing but *conceptually* owner-relevant | **Reframe**: one plain "How much can the team do on its own" control in Business |
| Beállítások (Settings) | System settings | Mixed | Split: business prefs in Business, system in Admin |
| Vault | Research/artifact vault | Depends on vertical | Business as "Files / Deliverables" if relevant, else Admin |
| Token használat (Token usage) | LLM token spend | Developer/cost metric | **Admin only** (Business gets a simple "usage / plan" meter if billing matters) |
| Ötletek (Ideas) | Idea box | Could be owner-facing | **Reframe** as "Suggestions from your team" in Business |
| Frissítések (Updates) | Upstream sync / version lag | Developer-only ("behind N commits") | **Admin only** |

**Verdict:** of 22 items, ~5 are safe for an owner as-is, ~6 need rebuilding into
plain-language business pages, and ~11 are pure admin/technical that would actively
undermine trust if shown to a non-technical buyer. The current dashboard is an
80/20 admin tool. Offsider needs to invert that ratio for the default view.

---

## 3. Two-layer UI concept

### 3.1 Model

- **Two layers, not two apps.** Same backend, same data. A `role` on the account
  decides which navigation and which pages render. A single toggle (visible only to
  Administrators) flips between "Business view" and "Admin view."
- **Default is Business.** Owner logs in → Business layer, always. They may never
  see Admin and never need to.
- **Admin is gated.** Reached only by an Administrator role (installer / MSP / us).
  On a fresh install it can even be a separate URL/PIN so the owner literally cannot
  wander into it by accident.
- **No orphan features.** Every current Marveen capability still exists — it just
  lives under Admin unless it earned a Business-language equivalent.

```
Account roles
├── Owner / Operator   → Business layer only (default)
├── Manager (optional) → Business layer, may approve on owner's behalf
└── Administrator       → Admin layer + can view Business layer
```

### 3.2 Business layer — navigation (6 items, not 22)

Designed so the whole thing reads like "my back-office team," not "a server console."

| Business nav | Answers the question | Built from (current internals) |
|---|---|---|
| **Today** | "What happened, what needs me?" | overview + daily-log + waiting-cards, recomposed |
| **Approvals** | "What is my team waiting on me to say yes/no to?" | `waiting` kanban cards + outbound-action safety-brake queue |
| **Work** | "What is my team doing, and what did they finish?" | kanban (plain list, no seq/status jargon), naplo history |
| **Team** | "Who's on my team and what does each one do?" | team/agents personas (read-only, no model/restart) |
| **Conversations** | "Let me talk to my team / read what they told me" | owner↔agent message threads (channel + inter-agent, filtered) |
| **Routines** | "What runs automatically for me?" | schedules, in plain language (no cron) |

Plus a persistent, non-scary **status pill** (green "All good" / amber "Needs
attention") in the header — the entire Status/health surface compressed to one dot.

#### Page-by-page business spec

**Today** (landing)
- Hero line: "Your team handled *N* things while you were out."
- Three cards: *Waiting on you* (count → Approvals), *Handled today* (from daily log),
  *Coming up* (next routines / calendar).
- Zero metrics like "user turns" or "token count." Outcomes only.

**Approvals** (the trust centerpiece)
- This is where the outbound-action safety brake becomes a *feature*, not a hidden rule.
- Each item: what the agent wants to do, why, and one-tap **Approve / Decline / Ask**.
- Examples per vertical: "Send this quote to the customer," "Publish this Google
  review reply," "Book this supplier order," "Email this client the invoice."
- Maps to `waiting` cards + any externally-facing step. An owner who lives in this
  screen understands exactly what the AI is and isn't allowed to do — that *is* the sell.

**Work**
- Plain vertical list grouped by *In progress* / *Done today* / *Earlier*.
- No `seq`, no `planned/waiting`, no UUIDs. A task = a title, which teammate owns it,
  and a status word a human uses ("Working on it," "Waiting for you," "Done").
- Tap a task → readable timeline of what the agent did (the naplo/comment trail, cleaned).

**Team**
- Cards with avatar, name, one-line role in the owner's language
  ("Front desk — answers customers and books jobs," "Bookkeeper — chases invoices").
- Read-only. No model dropdown, no restart, no scaffolding. If an agent is down, the
  owner sees "taking a break, back shortly," not a red process error.

**Conversations**
- One thread per teammate (and one group thread). Feels like messaging staff.
- Under the hood it's the existing channel + inter-agent bus, filtered to
  owner-relevant messages only. Internal agent-to-agent chatter stays in Admin.

**Routines**
- "Every morning at 8, your marketer posts the daily special." Toggle on/off, edit
  time with a clock picker. Never expose `0 8 * * *`.

### 3.3 Admin layer — navigation

Essentially today's Marveen dashboard, kept intact for the technical operator:
Agents (model/restart/scaffold/desired-state), MCP connectors, Skills, Autonomy,
Token usage, Background tasks, Activity, Status, Migrate, Updates, Docs, raw
Memory rows, raw Message bus, Settings, Vault. Plus **one new Admin-only control:
"Industry profile"** — the vertical preset chosen at install that seeded the team.

The design rule: **Admin can be as dense as it is now.** Its user asked for the knobs.
Business must never inherit that density.

### 3.4 Why role-gating, not just "simpler default"

Hiding items behind an "advanced" accordion still tells the owner "there's scary
stuff here you're not smart enough for." Role-gating tells a cleaner story: *this
software has an owner seat and an admin seat, like your accounting software has a
staff login and a bookkeeper login.* That framing is familiar to every SMB and
removes the "I bought developer software" anxiety entirely.

---

## 4. Positioning copy draft (SMB-buyer angle)

Built on `docs/marveen-landscape/POSITIONING.md`, but rewritten from the buyer's
seat. Marveen's positioning targets a technical builder ("a ready-to-run AI team
that lives on your machine"). The SMB buyer does not care that it's local-first or
that no framework combines native Kanban with dispatch. They care about one thing:
**do I get more done without hiring, and can I trust it.**

### 4.1 One-line position

> **Offsider gives your business a full back-office team on day one — you pick your
> trade, and a crew of AI specialists shows up already set up for how your industry runs.
> You approve; they do the work.**

### 4.2 Who it's for

Owner-operators and small teams (roughly 1–20 people) in service and trade
businesses that drown in admin but can't justify a full back-office hire. First
cohort (AU market): **auto repair shops, law offices, accounting firms, cafes/restaurants.**
The buyer is the owner or office manager, not an IT department.

### 4.3 The problem it solves

Small businesses lose hours a day to admin that is too small for a hire and too
constant to ignore: customer follow-ups, quotes and invoices, bookings, review
replies, supplier chasing, the daily social post. Generic AI chatbots don't help —
they're a blank box that needs prompting and knows nothing about how a panel shop or
a law office actually operates. Hiring a VA is slow and pricey. So the admin just
piles up on the owner.

### 4.4 How it's different from Marveen (internal positioning)

| | Marveen | Offsider |
|---|---|---|
| **Buyer** | Technical single operator | Non-technical business owner |
| **Setup** | You build/name your own fleet | Pick your trade → team auto-provisions |
| **Defaults** | Blank-slate personas | Industry-opinionated (knows auto-shop / legal / accounting / hospitality admin) |
| **UI** | One dense admin cockpit | Two layers: Business (default) + Admin (gated) |
| **Mental model** | "My AI team on my machine" | "My back-office staff I approve" |
| **Safety brake** | A rule in the config | A visible Approvals inbox — the core feature |
| **Codebase** | Fork of Szotasz/marveen | From-scratch, fully detached (per #127) |

### 4.5 How it's different from the alternatives (buyer-facing)

- **vs a chatbot (ChatGPT et al.):** a chatbot waits for you to ask and knows nothing
  about your trade. Offsider is a standing team that acts on its own and already
  knows your industry's admin. You approve outcomes, you don't write prompts.
- **vs a virtual assistant / agency:** no hiring, no onboarding, no hourly rate. Live
  the day you install, and it never forgets what it learned about your business.
- **vs generic "AI automation" tools (Zapier-style):** those make *you* the builder.
  Here the build already happened for your trade — you just say yes or no.

### 4.6 Value proposition (three beats)

1. **Set up for your trade, not a blank box.** Pick "auto repair" and your team already
   knows quotes, bookings, parts follow-ups and review replies. No configuration.
2. **You stay in control.** Nothing goes out — no email, no post, no order — without
   your one-tap approval. The Approvals screen is your whole relationship with the AI.
3. **It runs while you work the floor.** Proactive routines and overnight handling mean
   you walk in to "here's what I did and here's what needs you," not an empty prompt.

### 4.7 Tagline candidates (for Jocoo to pick — not deciding)

- "Your back-office team. Set up for your trade. On day one."
- "Pick your trade. Meet your team."
- "The admin runs itself. You just say yes."
- "AI staff that already knows your business."

### 4.8 Naming (resolved)

Market name is **Offsider** — AU slang for a tradie's right hand, which lands
naturally for the auto-repair beachhead and the wider trade/hospitality market.
Repo/internal codename is "fleet". No "Marveen" or developer branding appears
anywhere the SMB buyer can see.

---

## 5. Open questions for Jocoo

1. **Role model depth** — is a two-role (Owner / Admin) split enough for cohort one,
   or do we need a Manager seat that can approve on the owner's behalf from the start?
2. **Admin access on fresh install** — separate URL/PIN for Admin, or just role-gated
   in the same UI? (Affects how "un-scary" the owner's first run feels.)
3. **Billing surface** — does the owner ever see usage/cost (a plan meter in Business),
   or is that entirely the Administrator/reseller's concern?
4. ~~Market name~~ — **resolved: Offsider** (see §4.8); no dev branding buyer-visible.
5. **Vault relevance per vertical** — do all four first-cohort trades need a
   "Files / Deliverables" business page, or only some?

---

*v1 — Chicha, for Offsider concept (#126). Sources: current dashboard `src/web/`
+ `web/index.html` nav, `docs/marveen-landscape/POSITIONING.md`, concept cards #125/#127.
HU exec summary delivered to Jocoo via Cuzcoo; this doc is the English source of record.*
