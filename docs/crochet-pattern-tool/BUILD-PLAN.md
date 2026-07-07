# CrochetTool — Technical Architecture Review & Phased Build Plan

**Card:** #b6a56d34 · **Author:** Kronk · **Version:** v1 · **Date:** 2026-07-07
**Sources:** `SPEC.md` (Cuzcoo synthesis, decisions locked §7/§7a), `notation-research.md` (Yzma, #137), `ux-vision.md` (Chicha, #138). Where this plan and the SPEC disagree, the SPEC wins; changes to phase scope need Jocoo/Cuzcoo sign-off.

---

## 1. Architecture read — verdict on the three source docs

The synthesis is sound and internally consistent. The one architecture-shaped conclusion both research docs converge on is the right one, and it drives everything below:

> **The LLM never does arithmetic that anyone trusts.** The Notation Compiler's validator is deterministic code — a pure function over the canonical pattern object — and it is the sole correctness authority (SPEC §4/§5, CrochetPARADE/AmiGo prior-art pattern, notation-research §4.4).

Consequences I'm locking into the architecture:

1. **The validator is a plain TypeScript library, no model calls inside.** Closure, shaping-rate, gauge coupling, terminology integrity, tension advisory — all pure functions of the pattern object (ux-vision §12 demands sub-100ms client-side; a pure library gives us that for free and makes the "auditable, not black-box" requirement (§7a-2) trivially satisfiable: the rules are code + tests, reviewable in a diff).
2. **Agents produce structure, the Compiler produces numbers.** The Pattern Idea Agent emits parametric shapes (sphere r≈X at gauge G, cone, cylinder, panel + color map). Round-by-round stitch ops are *derived* by deterministic expansion (flat-circle slope table 6/8/12/16, mirrored sphere schedules, stagger offsets — notation-research §3.1–3.2). The LLM phrases and decomposes; it never fills in counts.
3. **One canonical JSON object** (ux-vision §9) with a versioned JSON Schema, same discipline as Offsider's pack schema (ADR-002 pattern): `additionalProperties: false`, schemaVersion const, migrations explicit.

### 1.1 The flagged feasibility item: 3D preview

Chicha flagged "3D preview from stitch data" as the highest-effort component. **Jocoo's §7-5 decision (multi-angle silhouette, not rotatable stitch-mesh) collapses this from the hardest UI problem to a modest one.** Concretely:

- Amigurumi parts are surfaces of revolution (sphere/cone/cylinder segments). From the pattern object we already have, per round *n*: stitch count `c(n)`, stitch width `w` and row height `h` at gauge. Radius profile `r(n) = c(n)·w / 2π`, vertical position `y(n) = n·h`.
- A **silhouette from angle θ** is: revolve the profile, project orthographically, draw the outline + part boundaries + color bands. Pure 2D canvas/SVG, no WebGL, no mesh. Lumpy math produces a visibly lumpy profile — which is the whole point ("if the math makes a lumpy sphere, you see the lump").
- Multi-angle = render the same solid from 3–4 fixed viewpoints (front / ¾ / side / top). Non-revolved parts (flat panels) render as rectangles with row shading. Assembly offsets (`sew arms at Rnd 8`) place child parts on the parent profile.
- Estimated effort: days, not weeks — inside the Pattern Editor phase, not a phase of its own. A true rotatable stitch-mesh stays on the later-milestones list (§6).

### 1.2 What I'm deliberately NOT reusing from Offsider

CrochetTool is a separate, smaller codebase (SPEC §4). I reuse **conventions** (TS/Node 22 + better-sqlite3, one SQLite file, pure-core + thin-server layering, ModelPort seam for hermetic tests, vanilla ES-module web UI with no build step, JSON-Schema-validated data objects) but **no shared code and no fleet coupling**. Reasons: blast-radius isolation (an internal hobby tool must never block a product deploy), different lifecycle (this ships fast and iterates), and the §7a-1 leak boundary is easiest to prove when the codebases don't touch.

## 2. System architecture

```
crochet-tool/  (new private repo: github.com/jocoo/crochet-tool — code only)
├─ packages/
│  ├─ core/          pattern object schema + Notation Compiler + validator
│  │                 (pure TS, zero I/O, runs in node AND browser)
│  ├─ store/         SQLite persistence: patterns, versions ("pins"),
│  │                 feedback events (append-only), media index
│  ├─ agents/        ModelPort + the 4 agent skills (idea / compiler-wrap /
│  │                 recognition / listing); prompts versioned as files
│  ├─ server/        HTTP API + static web serving (Offsider Phase 4 pattern)
│  └─ corpus/        scraper + corpus store + retrieval index + training jobs
│                    (ISOLATED: nothing in server/agents imports from here
│                     except through the RetrievalPort interface — see §4)
├─ web/              vanilla ES-module SPA (Idea / Editor / Maker / Listing /
│                    Recognition studios)
├─ docker-compose.yml + .env.example      (portability contract, §3)
└─ docs/             ADRs, validator rulebook, feedback-loop changelog (§5)
```

Single primary user, internal network only → one process, one SQLite database, no auth beyond a single shared token on the LAN listener (upgradeable later; no seats/roles — that's Offsider's problem, not this tool's).

**Media** (concept previews, finished photos, timelapse) live on the filesystem under `DATA_DIR/media/`, indexed in SQLite — same pattern as the corpus, never inside the DB.

## 3. Hosting & portability (SPEC §7-6)

- **Docker Compose from day 0**, one service + named volume. The compose file and `.env` are the entire deployment contract: `DATA_DIR`, `PORT`, `BIND_ADDR`, `MODEL_*` keys. No hostname, no absolute host path, no WSL-ism anywhere in code or config defaults.
- Runs on this WSL host first: `BIND_ADDR` on the LAN/Tailscale interface, loopback default. **No public exposure, no domain, ever** — enforced by never adding TLS/ingress config at all; if it can't terminate a public connection, it can't accidentally become public.
- **Relocation = `docker compose down` → copy one data volume → `up` elsewhere.** The data volume contains SQLite + media + corpus + models; the image is rebuilt from the repo. A `make backup` target tars the volume; restore is documented in README from Phase 0.
- GPU is NOT assumed for serving (silhouette math is trivial; recognition inference can be CPU or remote-model via ModelPort). Training jobs (§4) are batch, run wherever a GPU exists, and only ship artifacts back into the volume — so the serving host stays portable commodity hardware.

## 4. Scraped corpus + proprietary model pipeline (SPEC §7a-1)

Jocoo accepted the legal exposure **conditional on strictly-internal use**. The architecture makes that boundary structural, not policy:

- **Isolation by interface:** `packages/corpus` is the only code that touches scraped material. Everything else consumes it through one narrow `RetrievalPort` (query → ranked exemplars) and one `ModelPort` binding (a fine-tuned model checkpoint is just another model id). Neither port can return source documents to an output surface — they return internal guidance the agents *consult*, and the Listing Agent (the only outward-facing surface) has **no RetrievalPort access at all**, mechanically: its dependency injection simply doesn't include it, and a test asserts the import graph (`corpus` unreachable from `agents/listing` and from anything in the listing render path).
- **Provenance stamps:** every generated artifact records which model id + prompt version produced it (`provenance` already exists on the pattern object; extended with `engine: {model, promptVersion}`). If a customer-facing question ever arises, we can answer "what touched what" from data, not memory.
- **Corpus store:** scraped patterns/images/video → `DATA_DIR/corpus/` (files) + SQLite index (source URL, fetch date, license note, content hash). Deduped by hash. Scraper is rate-limited, robots-aware where feasible, and runs as a manual/scheduled batch job — never in the request path.
- **Model strategy, staged:** (a) v1 = retrieval-augmented prompting over the corpus (RAG buys most of the quality with zero training risk); (b) v2 = LoRA fine-tune for the Idea Agent's decomposition and the Recognition Agent's stitch classifier (the Yarn-Master capstone shows the recipe, notation-research §4.2); continuous retraining only after the feedback loop (§5) produces enough labeled data. Checkpoints live in the data volume, named `internal-only-*` as a human tripwire.

## 5. Feedback loop + massive documentation (SPEC §7a-2)

Jocoo wants self-improvement **without a black box**. Design:

- **Capture (from Phase 1):** every human ratification is an append-only `feedback_events` row — fix-it accepted/rejected, manual round edit, maker-mode mid-make correction, recognition confirm/correct, actual-vs-estimate time. Schema'd from the start so later phases just add emitters.
- **The Compiler never self-modifies.** Validator rules are code. The loop produces **proposals**, applied only through a human-reviewed change with three artifacts, all in-repo:
  1. `docs/validator-rulebook.md` — every rule: statement, source (Yzma-doc citation or feedback-derived), examples, version added.
  2. `docs/feedback-changelog.md` — dated entries: what signal accumulated → what changed (rule / prompt version / dataset slice) → expected effect → link to the diff.
  3. Versioned prompt files in `packages/agents/prompts/` — prompt changes are diffs in git, not runtime mutations.
- **Cadence:** a periodic (scheduled, not continuous) "improvement pass" job aggregates events into a human-readable report with proposed changes; Jocoo or the fleet reviews; merge applies. Continuous *data collection*, discrete *behavior change*. This keeps §4's "sole correctness authority" auditable: at any commit, the tool's behavior is fully determined by code + prompt files + a named model checkpoint.

## 6. Phased build plan (Offsider Phase 0→N mintára)

Each phase is one kanban card, one deliverable, verified before the next starts. Estimates assume the Offsider working rhythm (agent-built, test-first).

| Phase | Card scope | Deliverable / exit criterion |
|---|---|---|
| **0. Repo + infra skeleton** | New private repo `jocoo/crochet-tool`, package layout, Docker Compose + `.env.example`, SQLite bootstrap + migration runner, test harness, ADR-001 (this plan's decisions §1–§5 condensed) | `docker compose up` serves a health endpoint on WSL; `make backup/restore` documented and exercised; volume relocation rehearsed once |
| **1. Core: pattern object + Notation Compiler** | JSON Schema for the canonical object; canonical stitch taxonomy + US/UK render tables (CYC set + per-pattern glossary); parametric expansion (flat circle, sphere, cylinder, cone, panel, stagger logic); full validation engine (closure, shaping-rate, gauge coupling, terminology, tension advisory, yardage/time estimate); written-instruction renderer + parser (round-trip); chart-data emitter; `feedback_events` schema | The validator catches every documented failure in notation-research §4.3 reproduced as fixture tests (Makyrie duck round-4, 3-corner granny square, asymmetric sphere); parser round-trips its own render; 100% deterministic, no model calls |
| **2. Agents + server API** | ModelPort (hermetic fakes for tests), Pattern Idea Agent (idea → parametric decomposition + concept preview + feasibility badge), Compiler wrapped as service, pattern/version/media CRUD API, RetrievalPort stub | Prompt → validated `makeable` pattern object end-to-end via API, with the LLM demonstrably unable to inject counts (structure-only contract enforced by schema validation on the agent boundary) |
| **3. Web UI: Idea Studio + Pattern Editor** | The two core screens (ux-vision §5–§6): lock-and-regenerate, variations tray, 3-pane editor, inline per-round validation markers, fix-it suggestions, parametric nudges, **multi-angle silhouette preview** (§1.1), US/UK + written/chart toggles, version pins, Pre-Flight card | Full forward path usable by Jocoo on the internal network: idea → edited → `Ready to Make` gate enforced (red = blocked); silhouette visibly deforms on broken math |
| **4. Maker Mode** | Voice-first crochet-along (offline wake-word/command per ux-vision §7), pattern-aware reminders, stitch/round counter, checkpoint gauge nudge, actual-time logging, pause-capture + timelapse filing; maker-profile defaults (ASK JOCOO: the family member's skill/handedness/language — SPEC §7-3) | A pattern is physically crocheted against Maker Mode by the family maker; actuals land back on the object |
| **5. Listing Studio + loop closure** | Listing Agent (Etsy + site-#2 [name pending from Jocoo] + YouTube description/tags), draft-only with sign-off gate, finished-media attachment, listing export | Idea → listed loop closed once end-to-end on a real make; publish gate demonstrably requires explicit sign-off |
| **6. Recognition v1** | Image/video → reconstructed object, amigurumi + simple colorwork only; confidence map + review queue + point-and-identify (ux-vision §8); converges into the Phase-3 editor | A known pattern's finished object photo reconstructs to ≥ amber confidence and validates after guided correction; occluded regions honestly red |
| **7. Corpus + improvement loop** | Scraper + corpus store + RAG retrieval behind RetrievalPort (§4); improvement-pass job + rulebook/changelog docs (§5); optional LoRA fine-tune when data justifies | Retrieval measurably improves Idea Agent decomposition on a held-out prompt set; first improvement-pass report reviewed by Jocoo; import-graph isolation test green |

**Ordering notes.** Phase 6 (recognition) is the research-risk item and deliberately sits after the forward path proves value; it can start in parallel after Phase 3 if capacity allows, since it converges on the same editor. Phase 7's *capture* half lives in Phase 1 (schema) and Phase 3–4 (emitters); only the *learning* half waits. Phases 0–2 are backend-only and can run back-to-back without design input; Phase 3 should get a `design-mockup-signoff` gate like Offsider Phase 4b (it worked well).

## 7. Open items routed onward

1. **Listing site #2 name** — still owed by Jocoo (SPEC §7-4); blocks nothing before Phase 5.
2. **Maker profile** (skill, handedness, voice language of the family member) — ask when Phase 4 is cut, per SPEC §7-3.
3. **Phase-3 mockup sign-off** — recommend keeping the Offsider UX safety brake; Cuzcoo to include in the Phase 3 card text.

---

*Kronk · v1 · Next: Cuzcoo cuts Phase 0–1 cards per §6; I recommend starting them together (Phase 0 is small) once this plan is verified.*
