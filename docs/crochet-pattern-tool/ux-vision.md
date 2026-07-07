# CrochetTool — UX Vision & End-to-End Workflow

**Card:** #138 (79056c31) · **Author:** Chicha · **Version:** v1 · **Date:** 2026-07-07
**Sibling doc:** `notation-research.md` (#137, Yzma — stitch language + competitor deep-dive). This doc owns UX and workflow; where it references notation rules or stitch grammar, Yzma's doc is source-of-truth.
**Scope note:** Internal tool for Jocoo. NOT Lil'Crochet, NOT customer-facing. A human physically crochets every pattern before anything is sold, so the "unhookable AI pattern" fraud risk that haunts the Etsy niche is caught by construction, not by trust. See `[[project-crochet-pattern-tool]]`.

---

## 1. Vezetői összefoglaló (HU)

A CrochetTool egy belső, agent-vezérelt tervezőeszköz, ami egy ötlet-promptból végigviszi a teljes utat a kész, eladható termékig: **ötlet → validált horgolásminta → ember lehorgolja + videót forgat → online listázás**. Két irányban működik:

1. **Előre irány (generálás):** szöveges ötletből fizikailag lehorgolható mintát csinál, élő 2D/3D előnézettel, és ami a legfontosabb, **öltésszám-validációval** — nem enged tovább olyan mintát, aminek a matekja nem záródik.
2. **Vissza irány (felismerés):** kész horgolt tárgy képéből vagy videójából rekonstruálja a mintaleírást, öltéstípusonként, sorra bontva, konfidencia-jelöléssel.

**A piaci rés, amire tervezünk:** a jelenlegi AI-horgoló eszközök a gauge-t (öltéssűrűség) dekoratív metaadatként kezelik, nem szerkezeti megkötésként — hétből mindössze kettő számol valódi öltésszámot, és egyik sem kezeli a sorok közti feszülés-driftet ([Alibaba product-insights, 2025](https://www.alibaba.com/product-insights/ai-powered-crochet-pattern-generators-do-they-validate-stitch-counts-for-gauge-consistency-or-just-look-pretty.html)). A CrochetTool megkülönböztető ígérete: **"no rounding errors, no frogging"** nem marketingszlogen, hanem beépített invariáns, amit egy Notation Compiler agent minden mentésnél kikényszerít.

**A design alapelve:** a tool nem képgenerátor. A tool feladata, hogy a minta **valós és lehorgolható** legyen, MIELŐTT egy ember órákat fektet bele. Minden UX-döntés ezt szolgálja.

Az eszköz egy kis agent-flottaként épül fel (Pattern Idea Agent, Notation Compiler, Recognition Agent, Listing Agent), amiket a rendszer inicializáláskor hoz létre saját skillekkel.

---

## 2. Design principles

Every screen and interaction is judged against these five. When two conflict, higher number wins.

1. **Makeable-before-beautiful.** A pattern that renders a gorgeous preview but whose round-to-round stitch math doesn't close is a *failure state*, not a draft. The UI surfaces buildability before aesthetics. The reference failure mode we are designing against: AI patterns with incorrect stitch counts in specific rows that require manual fixing before yarn is committed ([CrochetAI](https://crocheh.com/en), [Elise Rose Crochet](https://eliserosecrochet.com/how-to-spot-fake-ai-crochet-so-you-dont-get-scammed/)).
2. **Hands are busy.** The person crocheting cannot touch a screen. Voice-first, glanceable, and audio-cued interaction in Maker Mode is not a nice-to-have — it is the mode. Proven by existing market: MyCrochetKit and My Row Counter both ship "say next" voice advance ([MyCrochetKit](https://mycrochetkit.com/), [My Row Counter](https://apps.apple.com/us/app/my-row-counter-knit-crochet/id1342608792)).
3. **AI proposes, human ratifies.** Generation and recognition are always drafts with visible confidence. The human is the validator, never the rubber-stamp. Uncertainty is shown, never hidden.
4. **One canonical pattern object.** Written instructions, symbol chart, 3D preview, maker checklist, and sales listing are all *renders of a single structured pattern representation* (§9). Edit once, all views update. No divergent copies.
5. **Loop closure.** The tool is not done when the pattern is generated. It is done when the finished-object video is tied back to the pattern and the sales listing is auto-drafted. Idea in, listing out.

---

## 3. System overview & agent fleet

```
┌─────────────────────────────────────────────────────────────────┐
│                        CrochetTool (web UI)                        │
│                                                                    │
│  Idea Studio ──▶ Pattern Editor ──▶ Maker Mode ──▶ Listing Studio  │
│      │                 ▲                  │              ▲          │
│      ▼                 │                  ▼              │          │
└──────┼─────────────────┼──────────────────┼─────────────┼──────────┘
       │                 │                  │             │
   ┌───▼────┐      ┌──────▼──────┐    ┌──────▼─────┐ ┌─────▼──────┐
   │Pattern │      │  Notation   │    │  (human    │ │  Listing   │
   │  Idea  │      │  Compiler   │    │  crochets  │ │   Agent    │
   │ Agent  │      │   Agent     │    │  + films)  │ │            │
   └────────┘      └─────────────┘    └────────────┘ └────────────┘
                          ▲
                   ┌──────┴──────┐
                   │ Recognition │  ◀── reverse path: image/video ▶ pattern
                   │   Agent     │
                   └─────────────┘
```

**Agent fleet (created at init, each with its own skill):**

| Agent | Owns | Input → Output |
|---|---|---|
| **Pattern Idea Agent** | Creative decomposition | idea prompt → design concept + parametric shape breakdown (spheres, cylinders, cones, flat panels, color map) + reference preview image |
| **Notation Compiler** | Correctness | parametric structure → validated canonical pattern object; renders written (US/UK) + symbol chart; **rejects if stitch math doesn't close** |
| **Recognition Agent** | Reverse path | image/video → reconstructed pattern object + per-stitch confidence map |
| **Listing Agent** | Loop closure | finished pattern + video → marketplace listing (title, description, materials, difficulty, time, SEO tags) |

Agent skill briefs are specified in §10.

---

## 4. Primary end-to-end user flow

The spine. Four stages, four screens, one continuous object.

### Stage 0 → 1: Idea Studio
Jocoo types an idea: *"a grumpy little cactus in a terracotta pot, palm-sized, beginner-friendly."*

- Pattern Idea Agent returns within seconds: a **concept card** — a generated preview image of the finished object, a plain-language design summary, and a **shape decomposition** ("body: sphere tapering to cylinder; pot: truncated cone; arms: 2× small cylinders").
- Alongside: auto-suggested **project parameters** — yarn weight, hook size, target finished size, estimated yardage, estimated crochet time, difficulty (1–5). All editable.
- Jocoo can regenerate the whole concept, or lock parts ("keep the pot, redo the face") and regenerate the rest. **Lock-and-regenerate** is the core ideation gesture, not full re-rolls.

**Exit criterion:** Jocoo hits *Build Pattern*. Idea Agent hands the parametric structure to the Notation Compiler.

### Stage 1 → 2: Pattern Editor (§6 — the heart of the tool)
The Notation Compiler turns the shape decomposition into a real, validated pattern object. Jocoo refines it here until it is trustworthy enough to hook. This is where the tool earns its keep. Detailed in §6.

**Exit criterion:** the pattern passes validation (green) and Jocoo marks it *Ready to Make*.

### Stage 2 → 3: Maker Mode (§7)
Jocoo (or whoever crochets) picks up the hook. Screen becomes a hands-free, voice-driven crochet-along that tracks progress row by row and captures the build. Detailed in §7.

**Exit criterion:** last round completed; finished-object photo/video captured in-app or imported.

### Stage 3 → 4: Listing Studio (§8)
Listing Agent drafts the sellable package from the now-proven pattern plus the finished media. Jocoo reviews, edits, and (with sign-off) exports/publishes.

**Exit criterion:** listing exported. Loop closed.

**A single status ribbon** runs across the top of all four screens showing which stage the pattern is in (Idea · Editing · Validated · Made · Listed), so Jocoo always knows what's left.

---

## 5. Feature 1 — Idea → Pattern generation UX

**Screen: Idea Studio.** Split view.

- **Left — Prompt & controls.** A single expressive prompt box (natural language, no rigid form). Below it, optional structured nudges as chips: *style* (realistic / cute / geometric), *size*, *skill level*, *palette*. Chips are shortcuts, never required.
- **Right — Concept canvas.** The generated preview image, large. Under it, three collapsible panels:
  - **Design summary** — one paragraph, plain language.
  - **Shape breakdown** — the decomposition as a labelled diagram; each part is a chip you can lock 🔒 or reroll 🔄 independently.
  - **Project stats** — yarn weight, hook, finished size, yardage, time, difficulty. Each editable; changing one reflows the others (e.g. bumping yarn weight from DK to worsted recomputes size and yardage).

**Key interactions**
- **Lock-and-regenerate** (principle #4 in miniature): lock the parts you like, reroll the rest. Prevents the "slot machine" frustration of losing a good element on every re-roll.
- **Variations tray:** a horizontal filmstrip of 3–4 alternate takes kept warm so Jocoo can compare instead of regenerating blindly.
- **"Is this hookable?" pre-check:** even at concept stage, a lightweight feasibility badge (green / amber) warns if the shape decomposition will be hard to realize in crochet (e.g. sharp concave angles, unsupported overhangs) *before* Jocoo invests in editing. Amber is a hint, not a block.

**Why this shape:** generation UX everywhere else optimizes for a pretty picture. Ours front-loads the *makeability* signal and the *parametric handles* so the leap from picture to pattern is short and honest.

---

## 6. Feature 2 — Pattern Editor (the core screen)

This is the screen the whole tool exists to make excellent. Its job: take an AI draft and make it **provably makeable** with the least friction.

### 6.1 Layout — three synchronized panes

```
┌────────────────┬─────────────────────────┬──────────────────────┐
│  STRUCTURE     │   PATTERN (editable)     │   LIVE PREVIEW        │
│  (outline)     │                          │                      │
│                │  Rnd 6: 6 sc, inc ×6 ... │   [ 3D model,        │
│  ▸ Body        │  ─────────────  (18) ✓   │     rotatable ]      │
│    Rnd 1–12    │  Rnd 7: *sc, inc* ×6     │                      │
│  ▸ Pot         │  ─────────────  (24) ✓   │   [ 2D symbol chart  │
│    Rnd 1–8     │  Rnd 8: sc around        │     tab ]            │
│  ▸ Arms ×2     │  ─────────────  (24) ✓   │                      │
│                │  Rnd 9: *2sc, dec* ...   │   ● stitch count OK   │
│  + add part    │  ─────────────  (18) ⚠   │   ● gauge OK          │
│                │                          │   ● closure OK        │
└────────────────┴─────────────────────────┴──────────────────────┘
       validation status bar:  ✅ Makeable  ·  ⚠ 1 warning  ·  ⏱ ~4h  ·  🧶 92m
```

- **Left — Structure outline.** The pattern's parts and round ranges. Click to jump; drag to reorder; add/remove parts. This is the parametric skeleton, always visible.
- **Center — Editable pattern.** The written instructions, live-editable. Every round shows its **running stitch count** in the margin with a ✓ / ⚠ / ✗ marker. Edits are natural: change a number, add a round, and the count recomputes instantly.
- **Right — Live preview.** Toggle between a **rotatable 3D model** (built from the parametric structure so you see the actual 3D form the stitch counts produce) and the **2D symbol chart** (Craft Yarn Council / Japanese-standard symbols — see Yzma's `notation-research.md`). The preview is generated *from the real stitch data*, not the concept image — so if the math makes a lumpy sphere, you see the lump.

### 6.2 The validation engine (the differentiator)

Runs continuously, silently, on every edit. This is the "no frogging" promise made literal.

- **Stitch-count closure** — each round's increases/decreases must sum to the declared next-round count. Mismatches flagged inline (⚠ amber = off-by-small, likely fixable; ✗ red = structurally broken).
- **Shaping sanity** — increase/decrease *rate* per round checked against the target geometry (too-fast decreases pucker; too-slow leaves holes). Surfaced as gentle "this will pucker here" hints on the 3D preview, pinned to the offending round.
- **Gauge coupling** — declared gauge + yarn + hook drive the finished-size estimate. Change any input, size updates. Gauge is a **structural constraint**, not metadata — this is exactly where the current market fails ([Alibaba insights](https://www.alibaba.com/product-insights/ai-powered-crochet-pattern-generators-do-they-validate-stitch-counts-for-gauge-consistency-or-just-look-pretty.html)).
- **Tension-drift note** — for pieces over ~50 rounds, a soft advisory that real-world density shifts, with a suggested gauge re-check checkpoint. No competitor does this; it directly addresses a documented real-world failure.
- **Yardage & time estimate** — recomputed live from stitch count × stitch type, shown in the status bar. Feeds the listing later.

**Validation status bar** (always docked at the bottom): a single traffic-light verdict — **Makeable ✅ / Warnings ⚠ / Broken ✗** — plus time and yarn estimates. Jocoo cannot advance to *Ready to Make* while red.

### 6.3 Editing affordances

- **Fix-it suggestions.** Click any ⚠/✗ marker → the Notation Compiler proposes the minimal correction ("Rnd 9 needs 18 sts; you have 17 — add one sc, or change *2sc, dec* to *sc, dec*"). One-click apply, or edit by hand.
- **Parametric nudges.** Sliders for size, roundness, taper on the structure outline; moving them re-derives the affected rounds (with a preview of what changes, so no silent rewrites). Bridges "designer intent" and "stitch reality."
- **Direct text edit** for power use — type instructions freely; the parser keeps the canonical object and preview in sync, or flags un-parseable lines.
- **Notation toggle** — US ⇄ UK terminology, written ⇄ chart, with per-stitch abbreviation legend on hover. (Grammar per Yzma's doc.)
- **Version pins.** Snapshot a pattern state ("v1 tested") before a risky edit; compare and roll back. Because the human's crochet time is the expensive resource, protecting a known-good version matters.

### 6.4 The "trust" moment
Before *Ready to Make*, a one-glance **Pre-Flight card**: finished size, yardage, time, difficulty, validation verdict, and a rotatable final preview. This is the go/no-go the human sees before picking up the hook. Everything the editor did converges here.

---

## 7. Feature 3 — Maker Mode (crochet-along)

Principle #2 made literal: **hands are on the hook, not the screen.** This mode is proven territory — voice row-counters already exist and are loved ([My Row Counter](https://apps.apple.com/us/app/my-row-counter-knit-crochet/id1342608792), [MyCrochetKit](https://mycrochetkit.com/)) — but ours is *pattern-aware*, not a blind counter.

**Screen: full-bleed, high-contrast, minimal.**
- **Current round, huge.** One round of instruction fills the screen in large type. The previous and next rounds ghosted above/below for context.
- **Live stitch counter** for the current round ("sc 7 / 24"), so you never lose your place mid-round.
- **Progress ring** — rounds done / total, plus live time elapsed vs. estimate.

**Voice-first control (hands-free):**
- *"Next"* → advance one stitch/round. *"Back"* → undo. *"Where am I?"* → speaks current round + stitch. *"Repeat"* → re-reads the round aloud.
- **Auto-read** mode: the app reads each round aloud and waits for *"done"* before advancing. Pace is settable.
- Foot-pedal / smartwatch tap as a silent alternative to voice (watch support is standard in this category).

**Pattern-aware helpers (what a dumb counter can't do):**
- **Round reminders** surfaced from the pattern object: *"Rnd 12: switch to terracotta. Stuff the body firmly before Rnd 20."* Auto-generated from color changes and closure points, no manual setup.
- **Checkpoint gauge nudge** at the tension-drift point flagged in the editor: *"You're 50 rounds in — quick size check?"*
- **Pause = capture.** Pausing prompts an optional in-the-moment photo (progress shots make great listing/BTS content later).

**Build capture (feeds the loop):**
- A lightweight **timelapse / clip capture** you can arm at the start; it records the make hands-free and files the footage against this pattern.
- **Actual vs. estimate logging:** real crochet time and any hand-edits made mid-make are recorded back onto the pattern. Over time this makes the *time/difficulty estimates trustworthy* — a compounding data asset unique to an internal tool that both designs and makes.

---

## 8. Feature 4 — Reverse recognition (image/video → pattern)

The second direction Jocoo asked for. Input: a photo or video of an existing finished crochet piece. Output: a reconstructed, editable pattern object. This is genuinely hard (computer vision on stitches is noisy), so the UX is built entirely around **honest uncertainty**.

**Screen: Recognition Studio.** Split: source media left, reconstructed pattern right.

### 8.1 Ingest
- Drop an **image** (single or multiple angles — more angles = better reconstruction; the UI explicitly asks for top + side + bottom) or a **video** (ideal — the Recognition Agent samples frames and exploits rotation to infer 3D form).
- Optional hints Jocoo can give to boost accuracy: yarn weight, approximate size (a coin/hand in frame helps scale), "this is amigurumi / a flat panel / a granny square."

### 8.2 Reconstruction with a confidence map
The Recognition Agent returns a draft pattern **overlaid with confidence**:
- The 3D/2D reconstruction is shown beside the source with a **heat overlay**: green = high confidence, amber = inferred, red = "couldn't see this, guessed." Occluded regions (the back, the stuffed interior) are honestly marked red.
- The written pattern on the right mirrors it: each round carries a confidence badge. Low-confidence rounds are visually flagged for human review, not silently presented as fact.
- **Ambiguity is a first-class citizen:** where the agent can't tell sc from hdc, it says so and offers the top-2 candidates as a toggle, rather than committing.

### 8.3 Guided human correction
This is the core of the reverse UX — the human closes the gap the CV can't:
- **Review queue:** the tool walks Jocoo through only the uncertain rounds ("12 rounds need your eyes"), source frame zoomed to the relevant area, candidate stitches offered. Confirm or correct. High-confidence rounds are pre-accepted.
- **Point-and-identify:** click a spot on the source image, tell the tool what stitch/color it is; the agent propagates that correction to visually-similar regions ("you said this is a bobble — 6 similar spots updated").
- **Color-map extraction:** for colorwork/tapestry pieces, the tool extracts the color chart automatically (this part is high-confidence — pixels are easy) even when stitch *type* is uncertain.

### 8.4 Hand-off to the editor
Once corrected, the reconstructed pattern **drops straight into the Pattern Editor (§6)** and runs the same validation engine. So a recognized pattern gets the same "makeable ✅" guarantee as a generated one — and can be test-crocheted to confirm the reconstruction was right. The two directions converge on one editor; that convergence is the whole architecture's payoff.

**Honesty guardrail:** recognition output is always labelled "reconstructed draft — verify by making." Given the niche's fraud sensitivity ([Hooked by Kati](https://www.hookedbykati.com/how-to-spot-ai-crochet/)), we never present a machine-read pattern as ground truth.

---

## 9. The canonical pattern object (data model)

One structured representation underpins every view (principle #4). Notation grammar/abbreviations are Yzma's domain (`notation-research.md`); this is the *UX contract* — the shape the UI reads and writes.

```jsonc
{
  "id": "pat_...",
  "meta": {
    "title": "Grumpy Cactus",
    "craft": "crochet",
    "terminology": "US",            // US | UK
    "yarn_weight": "DK",            // lace…jumbo (CYC scale)
    "hook_mm": 3.5,
    "gauge": { "sts": 20, "rows": 22, "unit": "10cm" },
    "finished_size": { "h_cm": 11, "w_cm": 7 },
    "yardage_m": 92,
    "est_time_min": 240,
    "actual_time_min": null,        // filled by Maker Mode
    "difficulty": 2                 // 1–5, validated against stitch mix
  },
  "parts": [
    {
      "name": "Body",
      "worked": "in_the_round_spiral", // spiral | joined_rounds | flat_rows
      "start": "magic_ring",
      "rounds": [
        { "n": 1, "ops": [{ "st": "sc", "count": 6, "into": "MR" }], "total": 6, "valid": true },
        { "n": 6, "ops": [{ "st": "sc", "count": 6 }, { "op": "inc", "count": 6 }], "total": 18, "valid": true },
        { "n": 9, "ops": [{ "repeat": ["sc","sc","dec"], "times": 6 }], "total": 18,
          "valid": true, "notes": ["stuff firmly before closing"] }
      ],
      "color_changes": [{ "round": 12, "color": "terracotta" }]
    }
  ],
  "assembly": ["sew arms to body at Rnd 8, 4 sts apart"],
  "provenance": "generated",        // generated | recognized | manual
  "confidence": null,               // per-round map when provenance=recognized
  "validation": { "status": "makeable", "warnings": [] },
  "media": { "preview": "…", "finished": [], "timelapse": null }
}
```

Every op carries a stitch count so the validator can prove closure. Written text, symbol chart, 3D preview, maker checklist, and listing are all **projections of this object** — never independently authored. Edit the object, everything re-renders.

---

## 10. Agent skill briefs (created at init)

Each agent ships with a SKILL.md at initialization. Summary contracts:

**Pattern Idea Agent** — *idea → parametric concept.* Decomposes a natural-language idea into crochetable primitives (spheres, cones, cylinders, flat panels, tubes), assigns rough round counts and a color map, and produces a concept preview. Optimizes for *decomposability*, flags shapes that resist crochet realization. Does NOT emit final stitch counts — hands structure to the Compiler.

**Notation Compiler** — *structure → validated pattern object.* The correctness authority. Expands the parametric structure into rounds with exact stitch ops, runs the full validation engine (closure, shaping rate, gauge, tension-drift, yardage/time), and renders written (US/UK) + symbol chart. **Hard rule: never emits a pattern marked "makeable" whose stitch math doesn't close.** Grammar per Yzma's doc.

**Recognition Agent** — *image/video → reconstructed object + confidence.* Multi-angle/frame CV to infer form, stitch types, counts, and color changes. Emits per-round confidence and top-N candidates for ambiguous stitches. Never over-claims; marks occluded regions honestly. Output always routes through the editor + validator before it's trusted.

**Listing Agent** — *proven pattern + media → marketplace package.* Generates title, description, materials list, difficulty, realistic time (using *actual* logged make-time, not the estimate), and SEO tags. Draft-only; outbound publish requires Jocoo sign-off (safety brake — this is the externally-facing step). Given the niche's anti-AI sensitivity, copy is plain and human, never AI-boilerplate.

---

## 11. Edge cases & uncertainty handling

| Situation | UX response |
|---|---|
| Generated pattern's math won't close | Editor blocks *Ready to Make*, red status, inline fix-it suggestions. Never ships a broken pattern. |
| Concept is beautiful but un-crochetable shape | Amber feasibility badge at Idea stage, before edit effort is spent. |
| Recognition can't see the back / interior | Region marked red on heat overlay, rounds flagged for human review, top-N candidates offered. |
| Human edits pattern mid-make | Maker Mode logs the edit back onto the object; editor shows a "made-time divergence" note for next version. |
| Estimate vs. reality drift | Actual time/yardage logged each make; estimates self-correct over time. |
| Tension drift on large pieces | Advisory + a Maker-Mode gauge checkpoint at the flagged round. |
| Same pattern, second make | Version pins + actuals mean the second make starts from a proven, time-known state. |

---

## 12. Technical & experience considerations (for Kronk's architecture read)

- **3D preview from stitch data.** The live 3D model must derive from the parametric round structure (a surface-of-revolution / stitch-mesh build), not from the concept image — otherwise the preview lies. This is the highest-effort UI component and the one that makes "makeable-before-beautiful" real. Flag for feasibility.
- **Validation must be instant.** Sub-100ms recompute on edit; it's a pure function of the pattern object, so it runs client-side.
- **Voice in Maker Mode** needs robust offline wake-word/command handling (hands wet/busy, possibly noisy room). Existing apps prove it's viable.
- **Recognition is the research-risk item.** Set expectations: v1 recognition targets amigurumi and simple colorwork (highest tractability); complex lace/textured stitchwork is a later milestone. The confidence-first UX means a weak model is still *useful* (it accelerates human transcription) rather than misleading.
- **Local-first.** Internal tool, single primary user — patterns and media live locally/in the vault, no external hosting decision needed until the listing/publish step (which is sign-off-gated anyway).

---

## 13. Open questions for Jocoo

1. **Craft scope:** crochet only for v1, or should the object model leave room for knitting too? (Model already generalizes; UI cost is real.)
2. **Primary object type:** should v1 optimize hard for **amigurumi** (parametric, highest AI tractability, best demo) and treat garments/blankets/lace as later? Recommend yes.
3. **Who crochets:** is the human maker always Jocoo, or a family member? Affects Maker Mode defaults (skill level, left/right-handed, voice language).
4. **Listing destination:** where do finished patterns+videos sell (Etsy, YouTube, own site)? Shapes the Listing Agent's output format and the sign-off flow.
5. **3D preview ambition:** full rotatable stitch-mesh (high effort, huge wow) vs. a lighter proportional silhouette for v1? This is the biggest scope lever.

---

*Chicha · v1 · pairs with Yzma's `notation-research.md`. Next: Cuzcoo synthesizes both into a single CrochetTool spec; Kronk does the architecture read once free from Offsider Phase 3 (#136).*
