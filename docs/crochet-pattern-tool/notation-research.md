# CrochetTool — Notation, Math & Competitor Research

**Card:** #137 (9290da6b) · **Author:** Yzma · **Version:** v1 · **Date:** 2026-07-07
**Sibling doc:** `ux-vision.md` (#138, Chicha — UX and end-to-end workflow). This doc owns notation grammar, stitch math, and the competitive/failure-mode landscape; Chicha's doc is UX/workflow source-of-truth and already references this one as the grammar authority.
**Scope note:** Internal tool for Jocoo — idea prompt → generated pattern → human physically crochets + films → sold online. See `[[project-crochet-pattern-tool]]`. Distinct from `[[project-crochet-video-marketing]]` (Lil'Crochet, the family Etsy shop) — that project is where the anti-AI fraud backlash researched below actually happened; this tool avoids the same failure mode by construction (human-crochet validation before anything ships), but the notation and validation rules below exist precisely so that validation step isn't the *only* thing standing between a bad pattern and a wasted afternoon of yarn.

---

## 1. Executive summary

Everything a "hookability" validator needs to check reduces to four fixed inputs plus one invariant:

1. **Terminology system (US/UK)** must be an explicit, immutable field — never inferred, applied only at render time. Chain and slip stitch are identical across systems; every taller stitch name maps to a *different physical stitch* one rung up the UK ladder, so a system-mixup silently changes real row height and breaks every downstream count.
2. **Gauge + yarn weight** must be fixed *before* any stitch-count math runs. Finished size is a direct product of stitch count × stitch width at gauge, and round/row count × row height at gauge — a pattern generator that emits counts without first fixing these can't make any size claim at all.
3. **Stitch-count closure** — every round's declared total must be the deterministic output of its increase/decrease operations, and for flat/radial shapes (circles, amigurumi) that total must track a known linear (flat) or symmetric-curve (sphere) function of round number. This is the single highest-value automated check: it is exactly the class of error that broke Etsy's AI-pattern sellers (§4) and that academic benchmarks (CrochetBench, §4) now name explicitly as "stitch count inconsistencies."
4. **Community trust signals** (§5) — stitch count self-checks in the text, declared terminology up front, defined special stitches, testing/tech-edit provenance — are the human-facing surface of the same four invariants. A tool that gets 1-3 right by construction can honestly claim these for free.

The research below is source-backed for all four sections plus a fifth on prior art. **Bottom line for the spec:** nobody has made an LLM alone reliable at this (§4) — the two approaches that work either generate from a grounded geometric input (not free text) or force output through a formal, checkable grammar with a deterministic simulator. Chicha's Notation Compiler agent (ux-vision.md §6.2, §10) is architecturally the right shape for this — it just needs the grammar and the round-by-round simulator to be real, not decorative.

---

## 2. Notation: terminology, abbreviations, charts, gauge

### 2.1 US vs UK terminology

Both systems name stitches by height, but the naming ladder is offset by one rung — UK is always one step "ahead" of US for the same physical stitch:

| US Term | US Abbr | UK Term | UK Abbr | Physical stitch |
|---|---|---|---|---|
| Slip stitch | sl st | Slip stitch | ss | Identical |
| Chain | ch | Chain | ch | Identical |
| Single crochet | sc | Double crochet | dc | Same stitch, different name |
| Half double crochet | hdc | Half treble | htr | Same stitch |
| Double crochet | dc | Treble | tr | Same stitch |
| Treble | tr | Double treble | dtr | Same stitch |
| Double treble | dtr | Triple treble | ttr | Same stitch |

Vocabulary divergence beyond stitch names: gauge (US) = tension (UK); skip (US) = miss (UK); yarn over/yo (US) = yarn over hook/yoh (UK).

**Why this is structural, not cosmetic:** chain and slip stitch are identical in both systems, but every other stitch name maps to a different-height stitch. Executing a pattern in the wrong system doesn't just misname a step — it changes real row height and fabric density, silently invalidating every row-count-for-shaping and stitch-count-for-repeat computation downstream. Tell: "single crochet"/"sc" anywhere in a pattern means US; UK patterns never use that term and start their ladder at "double crochet."

**Spec implication:** terminology is a required, immutable field on the pattern object (already reflected as `meta.terminology` in Chicha's data model, ux-vision.md §9). All internal math runs against one canonical stitch taxonomy; US/UK labels are applied only at final text render, never mixed mid-computation.

Sources: [Shelley Husband — UK/US conversion chart](https://shelleyhusbandcrochet.com/uk-and-us-crochet-terms-conversion-help-and-chart/), [Peaceful Crochet — US vs UK terms](https://peacefulcrochet.com/us-vs-uk-terms/), [KnitPro — UK vs US terminology](https://www.knitpro.eu/en/blog/uk-vs-us-crochet-terminology), [Craft Yarn Council — Crochet Abbreviations](https://www.craftyarncouncil.com/standards/crochet-abbreviations), [The Crochet Project — UK vs US](https://thecrochetproject.com/blogs/blog-the-crochet-project/uk-vs-us-crochet-terms).

### 2.2 Standard abbreviations

The **Craft Yarn Council (CYC)** — the US industry standards body whose members include major yarn/pattern publishers — maintains the canonical list: [craftyarncouncil.com/standards/crochet-abbreviations](https://www.craftyarncouncil.com/standards/crochet-abbreviations) (60+ entries; full PDF at [CYC_YarnStandards](https://media.craftyarncouncil.com/sites/default/files/images/standards/CYC_YarnStandards-2018-11-06.pdf)).

Core set relevant to a generator:

| Abbr | Meaning | Abbr | Meaning |
|---|---|---|---|
| ch | chain | rnd(s) | round(s) |
| sl st | slip stitch | rep | repeat |
| sc | single crochet | sk | skip |
| hdc | half double crochet | sp(s) | space(s) |
| dc | double crochet | yo | yarn over |
| tr | treble crochet | inc | increase |
| dtr | double treble crochet | dec | decrease |
| FLO / BLO | front/back loop only | tog | together |
| FPdc / BPdc | front/back post dc | sc2tog | sc 2 together (decrease) |
| beg | beginning | st(s) | stitch(es) |

CYC explicitly notes designers may use custom abbreviations beyond the standard list, defined per-pattern in a key. **Spec implication:** treat the abbreviation vocabulary as CYC-standard core + an extensible per-pattern glossary, not a fixed closed enum — custom stitches (popcorn, bobble, shell, cluster) are routinely defined locally and the Notation Compiler must support a "define once, use by name" mechanism.

Sources: [CYC — Abbreviations](https://www.craftyarncouncil.com/standards/crochet-abbreviations), [CYC — Standards PDF](https://media.craftyarncouncil.com/sites/default/files/images/standards/CYC_YarnStandards-2018-11-06.pdf), [CYC — How to Read a Crochet Pattern](https://www.craftyarncouncil.com/standards/how-to-read-crochet-pattern).

### 2.3 Stitch chart symbolism

CYC's standardized visual set: [crochet-chart-symbols](https://www.craftyarncouncil.com/standards/crochet-chart-symbols), downloadable graphics at [downloadable-symbols](https://www.craftyarncouncil.com/standards/downloadable-symbols). Design principle: "each symbol represents a stitch as it looks on the right side of the work" — symbols are pictographic, not arbitrary.

| Stitch | Symbol |
|---|---|
| Chain | Oval/elongated loop |
| Slip stitch | Small solid dot |
| Single crochet | X or + |
| Half double crochet | "T", no cross-bar |
| Double crochet | "T", one cross-bar |
| Treble | "T", two cross-bars |
| Double treble | "T", three cross-bars |
| FLO/BLO | Base symbol + underline/arc |
| Decreases | 2+ stitch symbols converging to one base |
| Clusters/popcorn/shell/bobble | Fan/grouped shapes, shared base |

**Rounds vs rows, direction, repeats:** charts mark reading order with numbers/arrows at row/round start; rows worked back-and-forth alternate direction each row; rounds are concentric rings read outward with a slip-stitch symbol at the join. Symmetric motifs are drawn as one repeat wedge understood to repeat N times. Written repeats use `*...*`/`rep from *` or `[...]  N times`; per Craft Yarn Council-derived style guides, nesting order for multiply-nested repeats is parentheses → brackets → braces.

**Validation angle:** a chart and its written-instruction twin must resolve to the identical stitch total per round — a cheap, high-value cross-check (compute the total two ways, assert equality) if the tool ever emits both representations, which per Chicha's editor design (ux-vision.md §6.1, §6.3) it does.

Sources: [CYC — Chart Symbols](https://www.craftyarncouncil.com/standards/crochet-chart-symbols), [CYC — Downloadable Symbols](https://www.craftyarncouncil.com/standards/downloadable-symbols), [Yarnspirations — Chart Symbols](https://www.yarnspirations.com/blogs/how-to/how-to-read-crochet-chart-symbols), [CrochetKim — Symbols & Charts](https://crochetkim.com/crochet-symbols-charts/), [Easy Crochet — Chart Symbols](https://easycrochet.com/learning-crochet-symbols/), [MadameStitch — Reading Repeats](https://www.madamestitch.com/how-to-read-repeats/), [CyCrochet — Parentheses and Brackets](https://cycrochet.com/article/how-to-read-crochet-patterns-parentheses-and-brackets), [Edie Eckman — Repeats](https://www.edieeckman.com/2019/06/17/repeats-most-misunderstood-thing-about-knitting-crochet-patterns/).

### 2.4 Gauge and hook-size logic

CYC's **Standard Yarn Weight System** (0-7) ties yarn thickness to a crochet gauge range and recommended hook:

| CYC # | Category | Gauge (per 4in/10cm) | US hook |
|---|---|---|---|
| 0 | Lace | 32-42 dc | Steel 6-8 / B-1 |
| 1 | Super Fine | 21-32 sts | B-1 to E-4 |
| 2 | Fine | 16-20 sts | E-4 to 7 |
| 3 | Light | 12-17 sts | 7 to I-9 |
| 4 | Medium (worsted) | 11-14 sts | I-9 to K-10½ |
| 5 | Bulky | 8-11 sts | K-10½ to M-13 |
| 6 | Super Bulky | 7-9 sts | M-13 to Q |
| 7 | Jumbo | ≤6 sts | Q+ |

These are guidelines, not hard rules — CYC: "always follow the gauge stated in your pattern," since tension varies per crafter/hook/fiber even within one weight class.

**Mechanics:** gauge = stitches/rows across a 4in/10cm swatch at a *specific stitch+yarn+hook combination* — not a property of yarn alone. Larger hook → looser stitches → fewer stitches per 4in → larger finished piece for the same count; smaller hook → reverse. Gauge correction moves the hook size in the opposite direction of the error.

**Spec implication:** finished dimensions = stitch count × stitch width at gauge, and round/row count × row height at gauge. Gauge and yarn weight are load-bearing inputs the generator must fix *before* computing any shaping math — this matches Chicha's design (ux-vision.md §6.2: "gauge is a structural constraint, not metadata"), and is explicitly where competitor tools currently fail (§4).

Sources: [CYC — Yarn Weight System](https://www.craftyarncouncil.com/standards/yarn-weight-system), [The Neon Tea Party — Gauge/Yarn/Hook](https://theneonteaparty.com/online-craft-studio/crochet/understanding-gauge-yarn-hook-sizes/), [MJ's off the Hook — Gauge Explained](https://www.mjsoffthehookdesigns.com/a-beginners-guide-to-crochet-gauge/), [Jo to the World — Gauge Step-by-Step](https://jototheworld.com/crochet-gauge).

---

## 3. The math that guarantees "hookability"

### 3.1 Flat circles — the core rule

Every source converges on one principle: **the number of stitches added per round equals the round-1 count**, and that base count scales with stitch height (taller stitch = wider footprint relative to height = needs a wider base circumference to stay flat).

| Stitch | Round-1 count (≈ per-round increase) |
|---|---|
| sc | 6 (6-8 range cited) |
| hdc | 8 (8-10 range) |
| dc | 12 (10-12 range) |
| tr | 16 (12 also cited, sometimes insufficient) |

Canonical sc progression: Rnd 1 = 6 (magic ring). Rnd 2 = 12 (inc every stitch). Rnd 3 = 18 (inc every 2nd st). Rnd 4 = 24 (inc every 3rd st). Rnd n = 6n, increases staggered/offset ~1 stitch each round vs. the prior round (stacking increases produces visible hexagonal corners; offsetting produces a smooth edge).

**What breaks, mathematically:**
- **Ruffling** = too many stitches for the round's radius — actual arc length exceeds the flat-plane circumference needed, fabric buckles outward. Fix: skip increases until geometry re-syncs.
- **Cupping/coning** = too few stitches — arc length falls short, piece pulls into a bowl/cone. Fix: repeat a prior increase round.

Both are the deterministic consequence of increase-count-per-round deviating from the fixed 6×/8×/12×/16× linear relationship. **Validator rule:** for a claimed flat circle, assert total-stitches(round n) is linear in n with slope = base-count-for-stitch-height, and assert increase positions are evenly spaced (not clustered) within each round.

### 3.2 Amigurumi sphere shaping (the most common AI failure mode)

1. Magic ring, same base count as the flat-circle rule (commonly 6 for sc).
2. Expansion: increase by base count each round (6, 12, 18, 24...) to the equator, staggered from round 4 onward.
3. Middle: straight rounds at max count — count should be roughly symmetric with the increase-round count for a round (not lumpy/potato) body.
4. Closing: **mirror the increase schedule exactly in reverse as decreases**, same stagger logic, to close the sphere.

**Validator rule (highest-value single check):** circumference-implied stitch count at each "latitude" round should trace a smooth curve — rise from the pole, plateau near the equator, fall symmetrically to the opposite pole. Asymmetric, non-monotonic, or abruptly-jumping inc/dec schedules produce lumpy/non-spherical/"potato" shapes. This exact failure — plausible-sounding but numerically asymmetric inc/dec sequences that don't close the sphere — is what real hands-on tests of LLM-generated patterns reproduced (§4.3).

Sources: [Sarah Maker — Flat Circle](https://sarahmaker.com/crochet-flat-circle/), [Shelley Husband — Secret Circle Formula](https://shelleyhusbandcrochet.com/the-secret-crochet-circle-formula-and-how-to-tweak-it/), [Shelley Husband — Circle Case Study](https://shelleyhusbandcrochet.com/crochet-circle-case-study/), [B.Hooked — Flat Circle + Increase Chart](https://bhookedcrochet.com/2017/01/10/how-to-crochet-a-circle/), [FiberTools — Flat Circle Guide](https://fibertools.app/guides/flat-circle-crochet-guide), [FiberTools — Circle Calculator](https://fibertools.app/circle-calculator), [Dora Does — Flat Circle Any Stitch](https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/), [Supergurumi — Balls and Spheres](https://www.supergurumi.com/crochet-shapes-crochet-balls-and-spheres), [Crocheo — Math Behind Perfect Spheres](https://crocheo.net/blog/crochet-spheres), [Raffamusa — Perfect Amigurumi Ball](https://raffamusadesigns.com/crochet-perfect-amigurumi-ball-sphere/), [Craftsy — Ball of Any Size](https://www.craftsy.com/post/how-to-crochet-a-ball), [Knotorious Loops — Ball Any Size](https://knotoriousloops.com/how-to-crochet/crochet-ball/).

---

## 4. Competitor landscape and known failure modes

### 4.1 The Etsy AI-pattern backlash (2023-2024) — what actually happened

Earliest documented case: data scientist **Alex Chapman**'s Medium post (Dec 2023) examining a Jigglypuff amigurumi pattern sold via craftsideasdesign.com — circular ears where the image showed triangular ones, three eye colors in the image vs. two in the text, missing arm/hair instructions, a "Ribbon" section in text with nothing matching in the photo. Chapman also documented "impossibly large" items in physically impossible poses and yarn "doing things yarn just doesn't do." ([Medium](https://medium.com/@alex.chapman93/ai-grifters-are-coming-for-crochet-pinterest-24978d72018a))

**NBC News** (April 2024, national coverage): the flagged storefront was taken down pre-publication, but NBC found a *new* store selling a pattern using the same highland cow image — the problem was systemic, not one-off. Quoted buyer: *"The pattern looks nothing like the picture that advertised the pattern... I will never purchase from this seller again."* Etsy's response leaned on its existing Purchase Protection refund program rather than a crochet-specific fix. NBC also found "more than a dozen Reddit posts with hundreds of comments since May 2023" on the same topic. ([NBC News](https://www.nbcnews.com/tech/tech-news/etsy-crochet-buyers-suspect-ai-made-images-used-sell-patterns-rcna145878))

**Supply chain behind it:** the "Deluge of AI Crochet" piece documents Upwork postings paying ~$35 to write patterns matching AI-generated images that "defy the laws of physics," plus a $6.70 zero-review Etsy listing as a template red flag; r/CraftedByAI became a gathering point for fake-spotting. ([Medium — The Deluge of AI Crochet](https://thequiettype.medium.com/the-deluge-of-ai-crochet-e1d419b82af5))

**Who's hurt most:** new/inexperienced crafters who blame their own skill rather than the broken pattern — a population skewing older/less AI-literate. ([NBC News](https://www.nbcnews.com/tech/tech-news/etsy-crochet-buyers-suspect-ai-made-images-used-sell-patterns-rcna145878), [Plagiarism Today](https://www.plagiarismtoday.com/2025/11/24/the-ai-invasion-of-knitting-and-crochet/))

**Platform/community response:** Etsy's July 2024 creativity-standards policy requires AI-use disclosure via a 4-category classification, bans "Handmade" labeling for AI-made items, bans AI-prompt-bundle sales outright ([Etsy Creativity Standards](https://www.etsy.com/legal/creativity/)). r/crochet requires disclosure rather than banning outright. Ravelry has no formal policy but informally removes obvious AI patterns. Community mitigation folklore: look for real finished-object photos with people in them, read early reviews, check seller account age, buy from trusted human designers. ([Plagiarism Today](https://www.plagiarismtoday.com/2025/11/24/the-ai-invasion-of-knitting-and-crochet/))

**Visual tells** the community uses to spot fakes: indistinct "blob" stitch texture instead of proper V/X definition, excessive symmetry, implausible color combos, distorted hands where people appear. ([Elise Rose Crochet](https://eliserosecrochet.com/how-to-spot-fake-ai-crochet-so-you-dont-get-scammed/), [Hooked by Kati](https://www.hookedbykati.com/how-to-spot-ai-crochet/))

### 4.2 Existing AI/algorithmic tools — two distinct categories

**A. Image-stylization tools** (majority of what ranks in search) — produce a pretty "crochet-look" picture, not a usable pattern: Pixelcut, Atomm, LightX, Vheer, ElevenLabs text-to-image, OpenArt, Pokecut, Vidnoz. None output a validated executable pattern. ([Pixelcut](https://www.pixelcut.ai/create/crochet-pattern-generator), [Atomm](https://www.atomm.com/creativetools/crochet-pattern-generator), [Vheer](https://vheer.com/ai-crochet-pattern-maker), [LightX](https://www.lightxeditor.com/photo-editing/ai-crochet-pattern-generator/))

**B. Instruction-generation tools** (attempt actual written patterns):
- **Yarn Master / Bachelor / PhD** — academic capstone (Institute for Applied Computational Science, Kathy Wu et al.): scraped 3,490 image+description+instruction triples; SwinV2 image embeddings + Vertex AI text embeddings; LLaMA 3.2 Vision (11B) fine-tuned via LoRA on 2×H100, plus Gemini and Gemini+RAG variants. Most technically detailed public writeup of an actual photo/prompt → instructions pipeline. ([Medium — Kathy Wu](https://medium.com/institute-for-applied-computational-science/ai-powered-crochet-knit-pattern-instruction-generator-7111786413b4))
- **KnottyPatterns** — markets itself as a "Crochet Pattern Builder"; thin public detail on validation. ([knottypatterns.com](https://knottypatterns.com/))
- Custom GPTs (yeschat.ai): "Crochet Pattern Maker," "Crochet Companion," even a "Crochet Pattern Validator" GPT whose own page returned dead/empty content when checked — indicative of the low-substance tier of this category.
- **Alibaba product-insights analysis** (cited independently in Chicha's ux-vision.md §1): of 7 surveyed AI crochet generators, only 2 compute real stitch counts, and none handle row-to-row tension drift — gauge is treated as decorative metadata rather than a structural constraint almost everywhere in the current market. ([Alibaba product-insights](https://www.alibaba.com/product-insights/ai-powered-crochet-pattern-generators-do-they-validate-stitch-counts-for-gauge-consistency-or-just-look-pretty.html))
- Plain ChatGPT (no specialized tool) is what most Etsy sellers in the backlash actually used.

Direct user quote on the accuracy gap: *"AI tools like ChatGPT still can't write an actual crochet pattern... there's not a way within them to take a photo and end up with a workable crochet pattern."* ([Toolify.ai](https://www.toolify.ai/ai-news/unmasking-fake-ai-crochet-patterns-spot-the-fakes-2303713)) A practitioner on the OpenAI community forum, after careful prompt engineering: *"I have zero crochet knowledge, and the following may generate accurate results, or not, I have no way of knowing."* ([OpenAI Community](https://community.openai.com/t/using-ai-to-generate-crochet-patterns/611835))

### 4.3 Documented, reproduced technical failures

- **crochetconcupiscence.com** tested ChatGPT twice: an owl amigurumi where wings were omitted entirely, then regenerated "ridiculously oversized" with unclear attachment; a granny square specified only 3 corners in row 1 (needs 4) — "granny squares literally go pear-shaped" — producing a kite shape with a raised ball at center. ([crochetconcupiscence.com](https://www.crochetconcupiscence.com/chatgpt-crochet-pattern/))
- **Makyrie.com** tested ChatGPT-5 on an amigurumi duck: round 4's decrease sequence (5+2+6+2+5) mathematically requires 20 stitches carried into round 5, but only 18 remained — a plain arithmetic impossibility. Diagnosis: the model "mimics the pattern structure of increase/decrease sequences but totally guesses at the fill-in-the-blank numbers" because it's "fundamentally a language prediction model lacking true mathematical capability." Beak instructions degenerated into vague filler once learned structure ran out: *"Start with a chain. Work in rows to form a triangular shape."* ([Makyrie](https://makyrie.com/crocheting-an-ai-generated-amigurumi/))
- **CrochetBench** (arXiv 2511.09483, Nov 2025) — a formal benchmark testing whether vision-language models can move from *describing* to *doing* in the crochet domain. Names three failure categories matching this research exactly: **stitch count inconsistencies** across rows (mathematically impossible results), **terminology errors** (US/UK mixing), and **shaping inconsistency** (inc/dec doesn't track intended geometry, causing distortion). Evaluates with adapted BLEU/ROUGE/ChrF against expert patterns. ([arXiv:2511.09483](https://arxiv.org/pdf/2511.09483))
- **Root cause** (Plagiarism Today): AI relies on probabilistic token prediction, not spatial/geometric reasoning, and critically **cannot test the pattern after generating it** — a step every human designer/tester performs before publishing. This "no testing loop" gap is the structural reason AI patterns end up physically impossible. ([Plagiarism Today](https://www.plagiarismtoday.com/2025/11/24/the-ai-invasion-of-knitting-and-crochet/))
- **Daily Beast** viral cases: Alexandra Woolner's narwhal "Gerald," Lily Lanario's snowman pattern that instructed an infinite, never-terminating number of snowballs. ([Daily Beast](https://www.thedailybeast.com/how-crochet-tiktokers-uncovered-chatgpts-kryptonite/))
- **Kate Davies** (prominent designer) essay applying Frankfurt's "bullshit" (indifference to truth, not lying) to AI fiber-arts content — content mills inventing fictional "expert designers," "syrupy word salad" parasitizing decades of real community knowledge. ([katedaviesdesigns.com](https://katedaviesdesigns.com/2026/04/29/knitting-bullshit/))

### 4.4 Existing validation/QA prior art — directly reusable ideas

- **CrochetPARADE** (Crochet PAttern Renderer, Analyzer, and DEbugger, Svetlin Tassev, GPLv3): [crochetparade.org](https://www.crochetparade.org/) / [GitHub](https://github.com/crochetparade/CrochetPARADE). Defines a custom formal grammar for stitches/pattern structure to eliminate plain-English ambiguity, parses into a virtual model, renders 3D so a crocheter can "debug" loose/tight stitches before ever picking up a hook. Enforces real structural rules (errors on non-adjacent stitch groups, on attaching to not-yet-worked stitches). Exports charts, SVGs, Blender files. Docs explicitly speculate the grammar+renderer could let AI "learn to write correct crochet instructions" — future work, not existing capability. This is the closest prior art to Chicha's Notation Compiler concept.
- **"Translation of User Crochet Patterns to CrochetPARADE"** (AAAI Spring Symposium) — addresses exactly the NLP-to-formal-grammar translation step a generator needs for automatic validation. ([AAAI paper](https://ojs.aaai.org/index.php/AAAI-SS/article/download/36054/38209/40142))
- **AmiGo: Computational Design of Amigurumi Crochet Patterns** (SIGGRAPH Asia 2022, arXiv 2211.01178) — generates instructions *from a 3D mesh input*, sidestepping hallucination by construction. Representation: a "Crochet Graph" (vertices = stitch tops/bases per row; row-edges within a row; column-edges = stems between rows). Correctness enforced via formal constraints (valid stitch-operation coupling between consecutive rows; uniform stitch width covering the target surface). Validated only empirically (12 physically-crocheted examples vs. source mesh) — no automated formal-correctness proof exists even here. ([arXiv](https://arxiv.org/abs/2211.01178))
- **"Computing Stitches and Crocheting Geometry"** — parametric model for arbitrary NURBS surfaces, physical 10×10 swatch as gauge calibration input, output as g-code-like text instructions. ([ResearchGate](https://www.researchgate.net/publication/318175297_Computing_Stitches_and_Crocheting_Geometry))
- **"Algorithmic Form Generation for Crochet Technique"** (eCAADe 2013) — crochet-as-fabrication-technique for architecture; relevant as prior art for decoding crochet's geometric rules computationally. ([PDF](https://papers.cumincad.org/data/works/att/ecaade2013_026.content.pdf))

**Architectural conclusion:** the two approaches that actually work generate from a grounded geometric input (AmiGo) or force output through a formal, parseable grammar with a deterministic checker (CrochetPARADE) — never trust raw LLM stitch-count arithmetic as source of truth. This directly validates Chicha's design: Notation Compiler as correctness authority, LLM (Pattern Idea Agent) as a drafting/phrasing layer only, with a deterministic round-by-round stitch-count simulator sitting between draft and anything shown to Jocoo (ux-vision.md §6.2, §10).

---

## 5. Community trust signals (Ravelry, blogs, YouTube, Reddit)

### 5.1 Ravelry

Patterns are tagged with granular technique/attribute labels rather than a single skill-level category — searchable for or against a technique. [Analysis of 100 popular patterns](https://www.kaylinpavlik.com/pattern-attributes-difficulty/) found `phototutorial`/`textured`/`post-stitch`/`ribbed` tags correlate with *higher* rated difficulty (designers add photo walkthroughs *because* something is hard), while `preemie`/`top-down` correlate lower.

Difficulty is a **crowd-sourced 1-10 average of user ratings after making the item** — not designer-asserted. The community reportedly dislikes generic beginner/intermediate/advanced labels as "open to interpretation" and prefers explicit **skills-used** transparency for self-assessment. ([Dora Does](https://doradoes.co.uk/2022/03/24/crochet-pattern-skill-level-and-difficulty-ratings-explored/))

**Errata culture:** a visible warning triangle marks pages with crowd-flagged errata; a dedicated "Pattern Errata" forum category organizes corrections by publisher/designer. Digital patterns get corrected in place with buyer notification. ([Ravelry help](https://www.ravelry.com/help/search?query=errata))

**Testing culture:** Ravelry's Testing Pool forum connects designers with volunteer test-crocheters pre-publication — largely unpaid labor (testers supply own yarn), a recurring friction point. Separately, a **tech editor** (often paid) checks mathematical/grammatical consistency — distinct from testers, who validate the *result*. No testers/no tech editor credited is treated as a quality red flag. ([The Fairythorn](https://thefairythorn.ie/2024/11/18/how-to-use-ravelry-to-run-pattern-tests/), [American Crochet Association checklist](https://www.americancrochetassociation.com/p/checklist-before-you-publish-crochet-patterns), [crochetpreneur.com](https://crochetpreneur.com/crochet-pattern-tech-editor/))

### 5.2 Blog conventions (TL Yarn Crafts, Sarah Maker, CYC, American Crochet Association)

| Symbol | Meaning | Example |
|---|---|---|
| `( )` | Group worked into one stitch/space, or final stitch-count confirmation | `(2 dc, ch 3, 2 dc) in next st`; `(18 sc)` |
| `*...*` / `rep from *` | Repeat block, usually to end of row/round | `*ch 1, sk next st, dc in next st; rep from * across` |
| `[ ]` + count | Repeat block with explicit count, may not run to end | `[sk next dc, shell in next dc] 4 times` |

**Stitch-count self-check:** near-universal convention — a count stated at end of row/round in one of several equivalent notations (`(14 sc)`, `: 14 sc.`, `—14 sc.`) lets the crocheter catch a miscount before it compounds; only re-stated when it changes. Other standing conventions: US/UK declared up front (repeatedly flagged as a common omission in free web patterns); special stitches defined in a Notes section; turning-chain "counts as a stitch or not" stated explicitly (stitch-height dependent, common source of drift if omitted); gauge treated as mandatory for sizing.

### 5.3 YouTube

Video is the demonstration layer; the written pattern (with all §5.2 conventions) lives in the description or linked post — video never replaces the text. Popular channels (Bella Coco, TL Yarn Crafts) publish separate left/right-handed versions rather than mirroring on the fly. "Count your stitches" is explicitly taught as a behavior, paired with a physical technique (tilt work toward you to see stitch tops) — the video-tutorial analogue of the written stitch-count checkpoint. Beginner content is sequenced linearly (foundational stitch → repeat → shaping), mirroring how a written pattern front-loads special-stitch definitions.

### 5.4 Reddit / broader community discourse

Direct thread access was blocked in this session (reddit.com returns 403 to fetch tools); this section is built from journalism that read the subreddit directly, flagged rather than papered over. NBC counted 12+ Reddit posts with hundreds of comments since May 2023 on AI-image-vs-pattern mismatches specifically. Community-identified red flags: emoji-stuffed listing titles, bundle-only sellers (real independent designers rarely sell only in bulk), fake reviews burying real negative ones (check earliest reviews), blob-textured "stitches" in preview images.

Recurring **non-AI** complaint themes corroborated across sources: missing/inconsistent stitch counts, undeclared US/UK terminology, undefined special stitches, patterns published with no test-crochet or tech-edit pass. The throughline: **trustworthiness = visible testing** (named testers, tech-editor credit, errata history) and **self-checkability = stitch counts at every checkpoint** — precisely the two things AI-generated patterns structurally lack (no tester ever made the object; no internal arithmetic check).

Sources: [kaylinpavlik.com](https://www.kaylinpavlik.com/pattern-attributes-difficulty/), [doradoes.co.uk](https://doradoes.co.uk/2022/03/24/crochet-pattern-skill-level-and-difficulty-ratings-explored/), [ravelry.com/help](https://www.ravelry.com/help/search?query=errata), [thefairythorn.ie](https://thefairythorn.ie/2024/11/18/how-to-use-ravelry-to-run-pattern-tests/), [lillabjorncrochet.com](https://www.lillabjorncrochet.com/2014/07/to-test-or-not-to-test-pattern.html), [americancrochetassociation.com](https://www.americancrochetassociation.com/p/checklist-before-you-publish-crochet-patterns), [crochetpreneur.com](https://crochetpreneur.com/crochet-pattern-tech-editor/), [TL Yarn Crafts](https://tlycblog.com/how-to-read-crochet-patterns-like-a-pro-10-essential-tips/), [Sarah Maker](https://sarahmaker.com/read-crochet-pattern/), [CYC](https://www.craftyarncouncil.com/standards/how-to-read-crochet-pattern), [Bella Coco](https://blog.bellacococrochet.com/how-to-crochet/), [NBC News](https://www.nbcnews.com/tech/tech-news/etsy-crochet-buyers-suspect-ai-made-images-used-sell-patterns-rcna145878), [Daily Beast](https://www.thedailybeast.com/how-crochet-tiktokers-uncovered-chatgpts-kryptonite/).

---

## 6. Direct answers to the four validator rules Chicha's editor needs (ux-vision.md §6.2)

For Cuzcoo's synthesis and Kronk's eventual architecture read, mapping this research straight onto the editor's four validation checks:

1. **Stitch-count closure** → §3.1/§3.2's linear (flat circle) and mirrored-symmetric (sphere) formulas are the exact ground truth to simulate against. Deviation = the CrochetBench-named "stitch count inconsistency" failure.
2. **Shaping sanity** → ruffle (too many) vs. cup/cone (too few) in §3.1 are the two failure directions to detect and name in-UI.
3. **Gauge coupling** → §2.4's CYC weight/gauge/hook table is the reference lookup; §4.2's Alibaba analysis confirms this is precisely where the current market (5 of 7 surveyed tools) fails, making it a real differentiator, not a nice-to-have.
4. **Tension-drift note** → not directly sourced as a named industry convention (flag as Yzma's inference, not a cited claim), but consistent with gauge mechanics in §2.4 and worth keeping as a soft advisory rather than a hard block.

---

*Yzma · v1 · pairs with Chicha's `ux-vision.md`. Handing back to Cuzcoo for synthesis into a single CrochetTool spec.*
