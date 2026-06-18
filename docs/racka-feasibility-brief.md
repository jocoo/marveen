# Racka-4B Tech Feasibility Brief

Kanban #29ca4267 / Kronk / 2026-06-18

## TL;DR

PROCEED, but narrow. Recommend a single POC call site (memory categorization
OR HU heartbeat content), routed behind a config-registry toggle, with a hard
Claude fallback on timeout. Reject inline interactive use (CPU latency) and
defer commercial-touching use (license).

- POC size: ~120 LOC (one new module + one hook + one test file).
- Disk: 2.5GB (`msallai02/racka:4b-4qkm`); Ollama already running.
- Top risk: CC-BY-NC-SA-4.0 license + publisher-flagged alignment gap.

## 1. Local Ollama infrastructure

Already provisioned:

| Component | State |
| --- | --- |
| Ollama daemon | running, port 11434, systemd as `ollama` user |
| Model store | `/usr/share/ollama/.ollama/models` |
| Existing models | `nomic-embed-text` (137M, used by `src/db.ts:1541`), `qwen3.5:9b` (6.5GB) |
| Disk free (`/`) | 936GB |

Hardware constraints:

| Resource | Value | Implication for Racka-4B Q4_K_M |
| --- | --- | --- |
| RAM | 7.6GB total, 3.4GB free | Fits one 4B Q4 (~3GB resident); contention if qwen3.5:9b is also loaded |
| GPU | none (WSL2, no CUDA) | CPU-only inference |
| CPU | i7-1265U, 12 logical cores | Est. 5-10 tok/s for 4B Q4; 200-token answer ~20-50s |

`ollama pull msallai02/racka:4b-4qkm` is the only install step. No new
systemd unit, no port allocation. Tag spec from `ollama.com/msallai02/racka`:
2.5GB, 40k context window (Q4_K_M), temp 0.6 / top-p 0.8 / rep-pen 1.1,
thinking mode on by default (Qwen3-style reasoning tokens leak into output
unless `enable_thinking=False` is set in the request payload).

Concurrent request scaling: Ollama serializes per model on CPU. Multiple
sub-agents hitting Racka in parallel queue up. For a fleet-wide HU-output
feature, this is the bottleneck before disk/RAM.

## 2. Marveen integration architecture

Existing LLM call sites and what they do today:

| Site | Today | Racka fit |
| --- | --- | --- |
| `src/web/llm-breakdown.ts` (kanban subtask decomp) | Claude via `runAgent` (interactive worker) | NO -- output is structured JSON; Claude's structured-output discipline matters more than HU quality |
| `src/web/routes/memories.ts:120` (migration: auto-categorize chunks into tiers) | Ollama `/api/generate`, picks first non-embed model (e.g. qwen3.5:9b) | YES -- already on Ollama, narrow JSON output, HU input common |
| `src/db.ts:1541` (memory embeddings) | Ollama nomic-embed-text | NO (different task class) |
| Heartbeat HU sections (morning brief, calendar summary) | Currently composed by the agent itself in-prompt | YES -- a pre-translation pass through Racka could give better HU phrasing |
| Persona-translation (Multilingo Scope 2+) | not yet built | LATER -- depends on Scope 2 spec |

### Routing pattern recommendation

Single registry-backed router function:

```ts
// src/web/llm-router.ts (sketch -- NOT to be implemented in this card)
async function callLLM(task: 'breakdown' | 'categorize-memory' | 'hu-narration', prompt: string): Promise<string>
```

`task` carries the decision criterion. The router consults the
config-registry (`KANBAN_LABEL_COLORS`-style entry, e.g.
`RACKA_ENABLED_TASKS: string[]`) and picks Racka or Claude per task. This
keeps the existing `runAgent` / `ANTHROPIC_BASE_URL=OLLAMA_URL` paths in
`agent-process.ts:307` untouched -- those are agent-lifecycle wiring, not
content generation, and conflating them is what the prior Ollama
agent-routing experiment got tangled on.

### Three architecture options, weighted

A) **Direct call site (lowest blast radius)**. Add `racka-client.ts` with a
single `generateHuContent(prompt)` function. Wire it into ONE site
(memory categorization). Hard-coded toggle via `RACKA_ENABLED` env.
- LOC: ~80
- Reversibility: trivial (delete one module, one hook)
- Tests: 4-6 unit tests (timeout, fallback, response parse, thinking-mode strip)
- Risk: low

B) **Registry-backed router**. The above plus the per-task router function
and a `/api/settings`-exposed toggle that the v1.10.0 dashboard can flip.
Generalises if a second use case lands.
- LOC: ~160
- Reversibility: medium (router survives even if Racka is removed)
- Tests: 8-10
- Risk: low-medium (more surface, but no logic that wasn't already needed)

C) **Skip Racka, use qwen3.5:9b** for HU NL. The 9B is already pulled and
loaded. Hungarian quality is "general Qwen Hungarian" not "fine-tuned
Hungarian" -- weaker than Racka per HULU benchmarks, but no extra disk /
RAM cost and no license worry.
- LOC: ~50 (just plumb the existing OLLAMA_URL through a new helper)
- Risk: lowest, but ceiling lower too

Recommendation: **A first, evolve to B if a second HU site lands within 2
weeks of A shipping.** C is the fast-path fallback if A's POC fails the
quality bar.

## 3. POC sizing (Option A)

Single use case: HU memory categorization (currently uses qwen3.5:9b via
`src/web/routes/memories.ts:149`). Replace ONLY that one `fetch` call with
a call into `racka-client.ts`.

Files:

| File | Status | Approx LOC |
| --- | --- | --- |
| `src/web/racka-client.ts` | NEW | 70 |
| `src/web/routes/memories.ts` | EDIT 1 hook | -10 / +6 |
| `src/__tests__/racka-client.test.ts` | NEW | 80 |
| `.env.example` doc note | EDIT | +5 |

Total: ~160 LOC delta. The new module owns: prompt assembly with
`enable_thinking=false`, AbortSignal timeout (recommend 15s for categorize,
60s for narration), Claude-fallback wrapper, and a thin response parser
that strips the `<think>...</think>` block if the API returns one anyway.

Kronk run time estimate (NOT human hours): one session including test
writing + smoke against a pulled model = ~45 min on the laptop. Add ~5 min
for the `ollama pull` itself (2.5GB on home broadband).

Verify path:

1. `ollama pull msallai02/racka:4b-4qkm`
2. Curl smoke: `curl http://localhost:11434/api/generate -d '{"model":"msallai02/racka:4b-4qkm","prompt":"Kategorizald: ...","stream":false,"options":{"temperature":0.6}}'`
3. Run the new unit suite.
4. Re-run an existing memory migration on a dummy chunk; compare tier
   classifications against the qwen3.5:9b baseline.

## 4. Top-3 risks

### R1: License (CC-BY-NC-SA-4.0)

Non-commercial only, share-alike. Personal use by Jocoo is fine. The
moment the same Cuzcoo instance answers a paid customer (Etsy shop chat,
NFP donor mail, financials-processor that touches client invoices) the
licence is at minimum ambiguous and arguably violated. Mitigation: gate
Racka behind `task` so customer-facing paths NEVER reach it; document this
in the racka-client module header so a future contributor doesn't widen
the routing.

### R2: Alignment gap (publisher's own warning)

> "the model has not been aligned and is unsafe for use with end-users"

Output could contain unsafe content, off-prompt drift, or bypass of the
Cuzcoo persona's rules (em-dash ban, AI-cliche ban). Mitigation: keep
Racka downstream of an agent prompt, never as the user-facing surface --
i.e. Racka categorises / drafts, agent reviews and ships. The POC site
(memory categorization) only emits a tier string and keyword list, which
is structurally safe.

### R3: CPU-only latency

5-10 tok/s on this CPU means 20-50s for a 200-token answer. Inline blocks
of the router thread will time out the 5s message-router tick if naively
awaited. Mitigation: all Racka calls go through `fetch` with
`AbortSignal.timeout`, results land in DB or back into the agent message
queue asynchronously, never on the synchronous request path. Same pattern
the embedding generator in `src/db.ts:702` already uses
("fire-and-forget: generate embedding asynchronously").

Secondary risks worth flagging but not in top-3:

- Token counting: Racka's tokenizer is Qwen3's, so existing token-usage
  accounting (`src/__tests__/token-usage.test.ts`) is wrong for Racka
  traffic. Either skip the accounting for Racka traffic (acceptable
  initially) or add a per-provider tokenizer plug.
- Concurrent sub-agent contention: Ollama on CPU serialises one model.
  Two sub-agents hitting Racka at once = second waits.

## Open questions back to Jocoo

1. Is the non-commercial licence acceptable, given Cuzcoo handles emails
   for Jocoo's NFP volunteer role + family video shop?
2. Quality bar for HU narration -- is qwen3.5:9b's current Hungarian
   acceptable, or is the Racka-vs-Qwen delta load-bearing? (Determines
   whether we even need Option A vs C.)
3. Is the 20-50s latency budget OK for memory categorization? (For the
   morning brief, it's invisible -- the heartbeat runs at 07:00 and Cuzcoo
   has plenty of margin before 08:00 delivery.)

## Appendix: command reference

```bash
# Pull
ollama pull msallai02/racka:4b-4qkm     # ~2.5GB

# Smoke (thinking off, low-temp HU categorization)
curl -s http://localhost:11434/api/generate -d '{
  "model": "msallai02/racka:4b-4qkm",
  "prompt": "Kategorizald ezt: \"Jocoo holnap kanban-t rendez\". Tier: hot/warm/cold/shared. JSON valasz.",
  "stream": false,
  "options": { "temperature": 0.3, "num_predict": 100 },
  "system": "/no_think"
}' | jq -r .response

# Disk reclaim if we abandon
ollama rm msallai02/racka:4b-4qkm
```
