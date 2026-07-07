# OffsiderGeneral — Migration Feasibility (Marveen → fleet schema)

**Status:** research deliverable, no build yet (kanban #9b7cf1ab)
**Author:** Kronk, 2026-07-08
**Sibling doc:** Yzma's General pack scope + fleet gap analysis (product/scope side, forthcoming in
`docs/offsider-general/`). This document is the technical/data side; read them together.
**Related:** `docs/MIGRATION.md` (Marveen machine-move runbook — its inventory list is the
authoritative "what data exists" checklist and is reused below).

Goal: Jocoo wants to move his *personal* assistant setup off Marveen onto a new
Offsider instance running a (not-yet-existing) "General" pack. This doc maps both
data models, matches fields, flags what has no home on the other side, and lays out
migration approach options. It decides nothing — open decisions are collected at the end.

---

## 1. Source: Marveen data model

### 1.1 SQLite (`store/claudeclaw.db`)

Four migration-relevant tables (there are ~30 total; the rest are runtime/ops artefacts:
token_usage, tool_call_log, sessions, vault_*, transcribe_jobs, etc.).

**`kanban_cards`** — TEXT uuid `id` (8-char shown), `title`, `description`,
`status` CHECK `planned|in_progress|waiting|done`, `assignee`, `priority` CHECK
`low|normal|high|urgent`, `project`, `due_date` (unixepoch), `sort_order` REAL,
`created_at`/`updated_at`/`archived_at` (unixepoch), `parent_id` self-FK,
`dispatched_at`. Human-facing `#seq` is **computed by the API**, not stored.
Sidecar tables: `kanban_comments` (autoincrement id, card_id, author, content),
`labels` + `kanban_card_labels` (m:n), `kanban_card_events` (history).
Volume: 140 cards, 316 comments.

**`memories`** — autoincrement `id`, `chat_id`, `topic_key`, `content`,
`sector` CHECK `semantic|episodic`, `salience` REAL, `agent_id`,
`category` CHECK `hot|warm|cold|shared`, `auto_generated`, `keywords` (comma text),
`embedding`. FTS5 mirror `memories_fts` (content+keywords) kept in sync by triggers.
Volume: 232 rows (cuzcoo 143, kronk 69, chicha 11, yzma 3, chaca 2, marveen 4).

**`agent_messages`** — autoincrement `id`, `from_agent`, `to_agent`, `content`,
`status` CHECK `pending|delivered|done|failed`, `result`, `created_at`/`delivered_at`/
`completed_at`. Volume: 723 rows (almost all historical).

**`daily_logs`** — autoincrement `id`, `agent_id`, `date` TEXT, `content`. 56 rows.

Timestamps are **unixepoch INTEGER** throughout (Offsider uses ISO-8601 TEXT — every
importer must convert).

### 1.2 File-based stores

**Skills** — `~/.claude/skills/*/SKILL.md`: 27 skills, 372 KB, YAML frontmatter
(name, description) + markdown body, some with `references/` subdirs. Shared by all
Marveen agents (per-agent `.claude/skills/` dirs exist but are empty in practice).

**Auto-memory (file-based)** — one shared corpus, NOT per-agent: every agent's
`agents/<name>/.claude-config/projects/-home-jocoo-marveen/memory/` is a **symlink**
to `/home/jocoo/.claude/projects/-home-jocoo-marveen/memory/`. 56 markdown files +
`MEMORY.md` index. Each file: YAML frontmatter (name, description, metadata.type =
user|feedback|project|reference) + body with `[[wiki-links]]`.

**Scheduled tasks** — `~/.claude/scheduled-tasks/<name>/` = `SKILL.md` (the prompt)
+ `task-config.json` (`schedule` cron, `agent`, `enabled`, `type` task|heartbeat).
5 active (reggeli-napindito, memoria-heartbeat, kanban-audit, dream-engine,
bumblebee-hygiene-scan). The SQLite `scheduled_tasks` table is legacy, ignore it.

**Agent identity** — per agent under `agents/<name>/`:
- `CLAUDE.md` — persona/system instructions (Cuzcoo's is the repo-root CLAUDE.md)
- `SOUL.md` — personality layer (all 6 sub-agents + root)
- `agent-config.json` — `model`, `channelProvider`, `securityProfile`,
  `voice` (responseMode, voiceModel), `team` (role, reportsTo, delegatesTo,
  autoDelegation, trustFrom)
- `.mcp.json`, channel tokens (`.claude/channels/*/.env`, `access.json`)

---

## 2. Target: Offsider (fleet) data model

Full DDL survey with file references was done against `/home/jocoo/fleet` @
`packages/core/src/db/schema.ts` (single migrations file, 8 forward-only migrations).
Summary of what matters for this migration:

- **One SQLite DB = one instance = one business.** Single-tenant by spec
  (`docs/SPEC.md:208`). Timestamps ISO-8601 UTC TEXT.
- **`tasks`** — int `seq` autoincrement + TEXT uuid `id` (dual key), title,
  description, status `planned|in_progress|waiting|done`, priority
  `low|normal|high|urgent`, `assignee` free-text, `project` free-text.
  **No** labels, due_date, parent_id, sort_order, archived_at.
  `task_comments` FK→tasks(id) CASCADE with author+content — same shape as Marveen.
- **`memories`** — int id, `agent_id`, `tier` `hot|warm|cold|shared` (shared is
  OR-ed into every agent's queries), `content`, `keywords` comma-string.
  **Search is `LIKE '%q%'` only — no FTS5**, no salience/sector/embedding.
- **`messages`** — from/to/content, status `queued|delivered|acked|failed`,
  `attempts` (max 3), `group_id`/`post_id` for broadcast fan-out. Same rows serve
  as both dispatch queue AND conversation log; a 1s-poll dispatcher delivers
  `queued` rows to registered agents.
- **`schedules`** — uuid id, agent_id, name, description, 5-field `cron`,
  type `task|heartbeat`, `prompt`, enabled. Near-exact match for Marveen's
  file-based scheduled-tasks.
- **`approvals`, `audit_log`, `users`, `sessions`, `settings`, `languages`,
  `calendar_obligations`, `transcribe_jobs`** — Offsider-native concepts with no
  Marveen counterpart (approvals/audit) or already ported from Marveen patterns
  (languages, transcribe).
- **`provisioning`** — idempotency ledger `(kind: agent|schedule|memory|calendar,
  ref_id, pack_id, pack_version)`, `INSERT OR IGNORE`. The natural hook for a
  re-runnable importer.
- **Agents are NOT persisted** — in-memory Supervisor registry, re-provisioned from
  **industry packs** (`packages/packs/<pack>/pack.yaml`) on boot. Persona =
  pack `prompt`/`promptFile` markdown → SDK `systemPrompt`. Only `auto-repair`
  pack exists; **no "General" pack** (that is exactly Yzma's sibling research).
- **No skills concept.** Product agents get a fixed 5-tool MCP surface
  (`send_message, create_task, save_memory, request_approval, check_approval`),
  no shell, no filesystem (`packages/runtime/src/model/sdk.ts`). Skill
  auto-generation explicitly out of v1 scope (`docs/SPEC.md:206`).
- **No import/export/backup API of any kind.** Backup posture = whole-file SQLite
  snapshot. An importer writes through the `packages/core` store functions (or raw
  INSERTs), there is nothing to call.

---

## 3. Field mapping

### 3.1 Maps ~1:1 (mechanical)

| Marveen | Offsider | Transform |
|---|---|---|
| `kanban_cards.id/title/description/status/priority/assignee/project` | `tasks.*` | statuses and priorities are **identical enums**; unixepoch→ISO; keep uuid as `tasks.id` |
| `kanban_comments` | `task_comments` | 1:1 (author, content); FK re-pointing to task uuid |
| `memories.agent_id/category/content/keywords` | `memories.agent_id/tier/content/keywords` | `category`→`tier` (same 4 values); keywords already comma-text |
| `agent_messages` | `messages` | status map: `pending→queued`, `delivered→delivered`, `done→acked`, `failed→failed`; see 3.4 gotcha |
| `~/.claude/scheduled-tasks/*` | `schedules` | `task-config.json.schedule`→cron, `type`→type, SKILL.md body→`prompt`; agent remap needed |
| `CLAUDE.md` + `SOUL.md` per agent | pack agent `promptFile` markdown | concat CLAUDE.md+SOUL.md into one prompt file per agent in the General pack |

### 3.2 Exists on one side only — data loss or workaround needed

| Marveen source | Offsider gap | Options |
|---|---|---|
| `kanban_cards.due_date` | tasks have no due date (deadlines = `calendar_obligations`, a pack-seeded compliance model) | (a) drop, (b) prefix into description, (c) synthesize calendar_obligations — awkward, they're pack-namespaced |
| `labels` + card-labels m:n | no labels at all | fold into description text or drop |
| `parent_id`, `sort_order`, `archived_at`, `dispatched_at`, card events | none | drop (archived cards: skip or import as done) |
| `#seq` numbering | Offsider `seq` is its own autoincrement | **original card numbers are NOT preservable** unless cards are inserted in seq order into a fresh DB, and even then interleaving with Offsider-native tasks breaks it later. Accept renumbering. |
| `memories.salience/sector/embedding/topic_key/auto_generated/chat_id` | none | drop (embedding/salience are Marveen-runtime concepts) |
| `memories_fts` (FTS5 search) | LIKE-only search | quality regression, no workaround inside current schema — flag to Yzma's scope doc as a candidate General-pack requirement |
| file-based auto-memory (56 md files) | no file store; nearest fit = `memories` rows | one row per file: `tier` from metadata.type (feedback/user→`shared` or `warm`, project→`warm`, reference→`cold` — mapping TBD), frontmatter description→keywords, body→content. `[[wiki-links]]` degrade to plain text. |
| `daily_logs` | none | import as `cold` memories, or export to flat markdown archive, or drop |
| **skills (27 × SKILL.md)** | **no skills concept, agents have no filesystem** | see 3.3 — the single biggest structural gap |
| `agent-config.json` (model, voice, team trust, securityProfile) | no equivalents: model is per-instance env, no voice, no trust matrix | drop or park in `settings` KV; General pack scope question |
| channel tokens / Telegram pairing | Offsider v1 has no Telegram channel per agent (owner UI is the dashboard) | out of data-migration scope; product question → Yzma |
| Marveen `approvals`? | Offsider approvals/audit are native and start empty | nothing to migrate INTO them, they just start fresh |

### 3.3 The skills problem (structural, not mechanical)

Marveen skills assume a Claude Code harness: shell, filesystem, progressive
disclosure loading. Offsider product agents deliberately have none of that — 5 fixed
tools, no shell — because the approvals gate is load-bearing. Three routes, in
increasing invasiveness:

1. **Prompt-fold:** distill each portable skill into the General pack agent's
   promptFile (persona markdown). Works for procedural knowledge; loses
   trigger-based loading, references/, and self-patching. ~12 of the 27 skills are
   Marveen-ops-specific (marveen-*, kronk-deliverable-deploy-cycle,
   agent-safeguard-hard-block, poller/dispatch/dashboard skills) and are
   **meaningless on Offsider — intentionally not migrated**.
2. **Memory-seed:** import skill bodies as `warm`/`cold` memories (agents can
   `save_memory`/search). Cheap, searchable via LIKE, but skills become passive
   reference text, not loadable procedures.
3. **Runtime extension:** add a skills concept to the Offsider runtime (a 6th tool
   or promptFile includes). This is a General-pack scope decision, not a migration
   script feature → Yzma's doc.

A migration tool can implement 1+2 today; 3 is a product change.

### 3.4 Semantics traps (things that LOOK 1:1 but aren't)

- **Message import must set `status='acked'`** (or at minimum not `queued`): the
  Offsider dispatcher polls every second and would happily "deliver" 723 historical
  Marveen messages to live agents on first boot. Only genuinely-pending items (if
  any at cutover) should land as `queued`, and only if the recipient agent id exists
  in the new instance.
- **Schedule double-fire:** if both systems run in parallel with the same schedules
  imported, reggeli-napindito etc. fire twice. Import schedules `enabled=0` until
  cutover, or only enable on one side.
- **Agent id remap:** Marveen ids (cuzcoo, kronk, chicha, yzma, chaca, mata, tipo,
  heartbeat) vs whatever the General pack names its agents. The importer needs an
  explicit `oldId→newId` map; unmapped agents' memories should probably go to a
  designated default agent or `shared` (decision for Jocoo/Yzma).
- **`shared` memory visibility:** in Marveen, file-based memory is one symlinked
  corpus every agent sees; in Offsider only `tier='shared'` is cross-agent. If the
  56 md files import as per-agent `warm`, other agents lose sight of them. Leaning
  `shared` for the file corpus, per-agent for the SQLite memories — but flagged
  as a mapping decision.
- **Timestamps:** unixepoch INT → ISO-8601 UTC TEXT everywhere.

### 3.5 Kanban scope filter ("Marveen-specific" exclusion) — OPEN QUESTION

Current `project` values and a *proposed default* (Jocoo has NOT confirmed this
split — it goes to him as a question):

| project | cards | proposed |
|---|---|---|
| Marveen, Marveen_Env | 15 | exclude (dev/ops of the old system) |
| Offsider, OffsiderGeneral | 15 | exclude as *tasks* (they're dev cards), though ironically they document the new system — maybe archive-export instead |
| CrochetTool | 7 | ambiguous: internal tool dev — exclude? |
| Hame Remote Control | 11 | ambiguous: household hardware, but implementation cards are Marveen-fleet work |
| Scouts | 10 | include (personal/volunteer) |
| Personal_Env | 1 | include |
| (none) | 6 | manual triage |

Also open: do `done` cards migrate at all, or only `planned|in_progress|waiting`
(~11 cards)? Migrating history inflates a fresh instance; not migrating loses the
delivery log. Comments follow their card either way.

---

## 4. Migration approach options (NOT deciding — Jocoo's call)

### Option A — one-time export/import script (cutover)

A standalone Node/TS CLI (lives in the Marveen repo, e.g. `scripts/export-to-offsider/`)
that reads `claudeclaw.db` + the file stores, applies the mapping above, and writes
into the Offsider instance **through `packages/core` store functions**, recording
each artefact in the `provisioning` ledger (pack_id e.g. `marveen-import`) so re-runs
are idempotent no-ops. Run order: agents (pack) → memories → tasks+comments →
messages (acked) → schedules (disabled) → enable at cutover.

- **Pro:** simple, testable, idempotent by construction, one moment of truth,
  matches Offsider's whole-file backup posture, no ongoing moving parts.
- **Pro:** ledger makes it safely re-runnable while iterating on the mapping.
- **Con:** hard cutover — everything created on Marveen after the export is lost
  unless re-run; requires a freeze window (short: data volume is tiny, well under
  a minute of runtime).
- **Con:** mapping decisions must all be made up front.

### Option B — continuous sync (parallel run)

A sync daemon that watches Marveen's SQLite (it already has a store-watcher pattern)
and mirrors deltas into Offsider, with an id-mapping table.

- **Pro:** enables a long parallel-run/evaluation period; no freeze; Jocoo can
  fall back to Marveen anytime.
- **Con:** substantially more machinery (change detection, id map persistence,
  conflict policy when BOTH sides edit — Offsider has no updated-at-wins hooks).
- **Con:** the nastiest parts are live semantics, not data: schedules firing twice,
  messages dispatched on both sides, two Telegram pollers (ONE BOT = ONE POLLER,
  see docs/MIGRATION.md) — parallel run means parallel *behavior*, which mostly
  defeats the point of a clean General instance.
- **Con:** one-directional sync (Marveen→Offsider only) is safer but then Offsider
  is read-only shadow — fine for evaluation, useless for actually living in it.

### Hybrid (worth naming)

Option A's script, run repeatedly: import once, evaluate Offsider read-only while
Marveen stays primary, re-run the importer (idempotent, upsert-on-changed) right
before final cutover. Gets most of B's evaluation benefit with A's simplicity.
The provisioning-ledger design makes this nearly free.

## 5. Shutdown vs parallel-run consequences (both sketched, no recommendation)

**Marveen fully stops at the end:**
- Simplest data story: single freeze+export+import, no id-map drift.
- Everything not migrated (dev kanban cards, daily_logs, FTS index, tool_call_log,
  token_usage history) should be archived first — `scripts/backup.sh` tarball +
  keep `claudeclaw.db` as cold archive.
- Telegram/bot tokens move cleanly (single poller).
- Risk: any gap in the General pack's capabilities vs Marveen (skills! channels!)
  is discovered *after* the old system is off. Mitigation: keep the Marveen host
  dormant-but-bootable for a grace period.

**Parallel run for a while:**
- Requires the hybrid/Option B mechanics above, plus discipline about which system
  is authoritative per domain (suggested: Marveen stays authoritative for
  everything until cutover day; Offsider is a shadow — never edit tasks/memories
  there during evaluation).
- Schedules and channel pollers must stay single-sided (imported disabled).
- Cost: the id-map and re-import tooling; benefit: real-world validation of the
  General pack with escape hatch.

---

## 6. Open questions for Jocoo (collect, don't decide)

1. **Kanban scope:** confirm the include/exclude split in §3.5 (esp. CrochetTool,
   Hame, and whether `done` history migrates).
2. **Shutdown vs parallel run** (§5) — this choice picks Option A vs Hybrid/B.
3. **Skills:** is prompt-fold + memory-seed (§3.3, routes 1+2) acceptable for v1,
   or does the General pack need a real skills mechanism first (→ Yzma scope)?
4. **Agent mapping:** which Marveen agents map to which General-pack agents
   (or does per-agent memory collapse into one "General" agent)?
5. **Due dates + labels:** acceptable to lose, or fold into description text?

## 7. Verdict

Technically feasible with modest effort. The data volume is trivial (140 cards,
232+56 memories, 723 messages, 5 schedules); the enums for tasks/memories/messages
align suspiciously well (Offsider inherited Marveen's shapes). The real work is not
the script — it's (a) the General pack existing at all (Yzma), (b) the skills-gap
decision, and (c) the scope filter Jocoo hasn't been asked about yet. Recommended
next step after Jocoo's answers: build Option A's importer with the provisioning
ledger, which keeps the Hybrid path open for free.
