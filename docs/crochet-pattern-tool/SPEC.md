# CrochetTool — Specification v1 (draft, pending Jocoo sign-off)

**Synthesized by:** Cuzcoo, 2026-07-07 ~01:00 AEST, from `notation-research.md` (Yzma, #137) and `ux-vision.md` (Chicha, #138).
**Status:** decisions locked (§7, 2026-07-07) except one follow-up (listing site #2 name, still needed). Two new architecture questions from Jocoo await Kronk's technical read (§7a). Everything else below is either directly sourced from the two research docs or a low-risk synthesis call Cuzcoo made to keep the spec coherent (marked where relevant).

---

## 1. What this is

An **internal-only** tool (not customer-facing, not Lil'Crochet) that takes an idea prompt and carries it to a sellable product:

**idea prompt → validated crochet pattern → human physically crochets + films it → online listing.**

It also runs in reverse: an existing crochet photo/video → reconstructed pattern description.

Because a human always crochets the pattern before anything is sold, the tool sidesteps the "unhookable AI pattern" fraud problem that hit the Etsy crochet niche in 2023–2024 (documented in detail in `notation-research.md` §4.1) — but it doesn't rely on that human step as the *only* safeguard. The core differentiator, per both research docs, is that **gauge and stitch-count math are enforced as structural invariants, not decorative metadata** — which is exactly where every surveyed competitor tool fails (2 of 7 tools compute real stitch counts; none handle tension drift — Alibaba product-insights, cited in both docs).

## 2. Why this is the right bet (evidence, not vibes)

- The Etsy AI-pattern backlash was real, national-news-covered, and specifically about physically impossible patterns sold as real ones (NBC News, Medium/Alex Chapman, `notation-research.md` §4.1).
- A formal academic benchmark (CrochetBench, arXiv:2511.09483) now names the exact three failure classes we're designing against: stitch-count inconsistencies, US/UK terminology errors, and shaping inconsistency.
- The two approaches that demonstrably work in prior art either generate from a grounded geometric input (AmiGo, SIGGRAPH Asia 2022) or force output through a formal, checkable grammar with a deterministic simulator (CrochetPARADE) — never raw LLM arithmetic as ground truth. Our architecture (§4) matches the second pattern.
- Nobody in the current market closes the loop from pattern → actual make → listing. That loop closure (design principle #5) is a differentiator with no direct competitor.

## 3. Design principles (from `ux-vision.md` §2, adopted as-is)

1. **Makeable-before-beautiful** — a pattern whose stitch math doesn't close is a failure state, not a draft.
2. **Hands are busy** — Maker Mode is voice-first by design, not as an accessibility afterthought.
3. **AI proposes, human ratifies** — generation and recognition are always drafts with visible confidence; never a silent rubber-stamp.
4. **One canonical pattern object** — every view (written text, chart, 3D preview, maker checklist, listing) is a projection of one structured object (§6). No divergent copies.
5. **Loop closure** — done means the finished-object video is tied back to the pattern and a listing is drafted. Idea in, listing out.

## 4. Architecture — four agents + one shared object

```
Idea Studio ──▶ Pattern Editor ──▶ Maker Mode ──▶ Listing Studio
    │                 ▲                 │              ▲
    ▼                 │                 ▼              │
Pattern Idea    Notation Compiler   (human crochets  Listing Agent
  Agent          Agent (validator)   + films)
                       ▲
                 Recognition Agent  ◀── reverse path: image/video → pattern
```

| Agent | Role | Never does |
|---|---|---|
| **Pattern Idea Agent** | idea prompt → parametric shape decomposition (spheres/cones/cylinders/panels) + concept preview + rough project stats | Does not emit final stitch counts — that's the Compiler's job alone |
| **Notation Compiler** | parametric structure → validated pattern object; the sole correctness authority; renders written (US/UK) + symbol chart | **Never marks a pattern "makeable" if its stitch math doesn't close** — hard rule, no exceptions |
| **Recognition Agent** | image/video → reconstructed pattern + per-round confidence map | Never presents a reconstruction as ground truth — always "verify by making" |
| **Listing Agent** | proven pattern + finished media → marketplace listing draft | Never auto-publishes — outbound publish is a Jocoo sign-off gate (existing safety-brake pattern, same as every other outward-facing action in this fleet) |

Each agent gets its own skill file at initialization (contracts detailed in `ux-vision.md` §10). This mirrors Offsider's agent-runtime pattern (`packages/runtime`, ModelPort seam) — worth Kronk cross-referencing when he does the architecture read, though CrochetTool is a separate, smaller codebase, not a fleet-of-fleets extension of Offsider.

## 5. The validation engine (the actual product)

Everything else is scaffolding around this. Runs continuously and silently on every edit, target sub-100ms (pure function of the pattern object, client-side feasible per `ux-vision.md` §12):

1. **Stitch-count closure** — every round's increase/decrease ops must sum to the declared next-round total. The flat-circle case is linear (slope = base count for the stitch height: 6/sc, 8/hdc, 12/dc, 16/tr); the amigurumi-sphere case must mirror its increase schedule exactly in reverse as decreases (`notation-research.md` §3.1–3.2). This single check is the one that would have caught essentially every documented AI-pattern failure in §4.
2. **Shaping sanity** — increase/decrease rate vs. target geometry; too fast = pucker, too slow = ruffle/hole. Surfaced as inline hints, not just a pass/fail.
3. **Gauge coupling** — gauge + yarn weight + hook size fixed *before* any shaping math runs; finished size is a direct function of stitch count × stitch width at gauge. This is the single most common competitor failure (5 of 7 tools).
4. **Tension-drift advisory** — soft, not a hard block, triggered past ~50 rounds; not an established industry rule (Yzma flags this as her own inference, not a cited convention), kept anyway because it's directionally correct and costs nothing to surface.
5. **Terminology integrity** — US/UK is an immutable field on the object, applied only at render time; internal math never mixes systems (`notation-research.md` §2.1).

A pattern cannot advance to *Ready to Make* while validation is red. This is a hard UX rule, not a suggestion.

## 6. The canonical pattern object

One structured JSON object is the single source of truth for every view. Full shape in `ux-vision.md` §9 — reproduced here as the spec's data-model anchor:

```jsonc
{
  "id": "pat_...",
  "meta": {
    "title": "Grumpy Cactus", "craft": "crochet", "terminology": "US",
    "yarn_weight": "DK", "hook_mm": 3.5,
    "gauge": { "sts": 20, "rows": 22, "unit": "10cm" },
    "finished_size": { "h_cm": 11, "w_cm": 7 },
    "yardage_m": 92, "est_time_min": 240, "actual_time_min": null,
    "difficulty": 2
  },
  "parts": [ /* named parts, each with round-by-round ops + running totals + validity */ ],
  "assembly": ["sew arms to body at Rnd 8, 4 sts apart"],
  "provenance": "generated",   // generated | recognized | manual
  "confidence": null,          // per-round map when provenance = recognized
  "validation": { "status": "makeable", "warnings": [] },
  "media": { "preview": "…", "finished": [], "timelapse": null }
}
```

Every stitch op carries a count so the validator can prove closure. Nothing else — written text, chart, 3D preview, maker checklist, listing — is independently authored; they're all projections of this object.

## 7. Decisions locked (2026-07-07, Jocoo via Telegram)

1. **Craft scope:** crochet-only. Knitting is explicitly out — do not generalize the data model for it speculatively.
2. **Primary object type for v1:** amigurumi-first, confirmed.
3. **Who crochets:** a family member (not Jocoo). Maker Mode defaults (skill level, handedness, voice language) should be tuned for that maker once known — ask when Kronk gets to Maker Mode, not blocking now.
4. **Listing destination:** Etsy + one more specialized site (**name still pending — re-asked Jocoo, "site" was answered as hosting infra instead, see below**). YouTube confirmed as a proven sales driver (traffic/marketing channel, not itself a listing target) — Listing Agent should draft video-description/tags alongside the marketplace listing.
5. **3D preview ambition for v1:** silhouette only, **multi-angle** (several fixed viewpoints of the proportional silhouette), not a full rotatable stitch-mesh. This resolves the spec's single biggest scope lever — Kronk should scope Phase-whatever around multi-angle silhouette rendering, not stitch-level 3D geometry.
6. **Hosting/infra (new, 2026-07-07):** self-hosted on Jocoo's internal network only, starting on this WSL host. No domain name needed (no public exposure at all — reinforces that this tool never touches the internet). Must be **relocatable** — Kronk should avoid baking in hostnames/paths tied to this specific machine, keep config portable (env-driven, containerizable) so it can move to different hardware later without a rebuild.

## 7a. Two new questions raised by Jocoo (2026-07-07) — both answered after a follow-up round

1. **Build a proprietary model from patterns/images/video scraped off the web, continuously retrained?** Cuzcoo flagged the legal exposure (scraping copyrighted patterns/photos for training data). **Jocoo's call: proceed anyway** — the tool is strictly internal-use, self-hosted, and will never be released to the internet or sold; the entire point of the scraped corpus is to make this internal tool as good as possible, not to redistribute or resell the training data or its outputs' provenance. This materially changes the risk profile Cuzcoo flagged (public distribution was the core of the Etsy backlash risk) — noted as accepted, not re-litigated. Kronk's architecture pass should design the scraping/corpus pipeline with this internal-only constraint as a hard boundary (e.g., no path by which scraped source material or a model trained on it could leak into a customer-facing artifact — irrelevant today since nothing is customer-facing, but keep the seam clean in case that ever changes).
2. **Continuous self-improvement from feedback:** confirmed, v1 in scope. Jocoo explicitly wants to **avoid the black-box effect** — his instruction: "legyen massziv dokumentáció" (build this with extensive/massive documentation). Kronk's architecture pass should treat documentation of the feedback-ingestion mechanism (what changes, why, when, reviewable by a human) as a first-class deliverable alongside the mechanism itself, not an afterthought — keeps the Notation Compiler's "sole correctness authority" auditable per §4.

## 8. Explicitly out of scope for v1 (carried over from the research, not re-litigated)

- Auto-publish without sign-off — the Listing Agent drafts, Jocoo approves, same brake as everywhere else in this fleet.
- Complex lace/textured stitchwork recognition — v1 recognition targets amigurumi + simple colorwork only; harder stitch types are a later milestone (`ux-vision.md` §12).
- Any customer-facing / Etsy-storefront-facing automation for Lil'Crochet — unrelated project, do not conflate (see `[[project-crochet-video-marketing]]`).

## 9. Next steps

1. Jocoo answers §7.
2. Kronk reads both research docs + this spec once free from Offsider Phase 3 (#136), does the technical-architecture pass Chicha flagged in `ux-vision.md` §12 (3D-preview-from-stitch-data feasibility is the highest-effort item and worth scoping first).
3. New kanban cards get cut per Kronk's phased plan, mirroring the Offsider Phase 0→N pattern (spec locked → core data model + validator → agent fleet → UI → loop closure).

---

*Cuzcoo — synthesis complete, both source docs are strong and consistent with each other. Nothing in either doc needs a rewrite; this file exists so there's one place that says what's decided vs. what's still Jocoo's call.*
