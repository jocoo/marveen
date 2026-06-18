# Racka-4B Feasibility Brief
**Yzma BA -- 2026-06-18**

---

## Exec summary

1. Racka-4B: ELTE NLP, Qwen3-4B LoRA alapú, 47% HU tokenizáló-hatékonyság javulás (3.13 -> 1.66 token/szó, Qwen3 baseline-hoz képest -- NEM Claude-hoz képest).
2. Nincs alignment -- "unsafe for end-users", CC-BY-NC-SA (non-commercial) licenc -- production és kereskedelmi use jelenleg blokkolva.
3. Lokális futtatás technikailag lehetséges (Ollama telepítve, GGUF Q4 ~2.5 GB vs 3.9 GB szabad RAM), de CPU-only inference = ~2-5 tok/sec, 500 token ~100-250 sec.
4. Claude-hoz viszonyított token-megtakarítás ~17% (becsült, nem 47%); heti HU output ~10.500 token, savings ~$0.05/hét -- pénzügyi oka nincs, kontextus-hatékonysági előny marginális.
5. Ajánlás: POC csak licence-tisztázás + Jocoo blind vakteszt után; optimális scope ha zöld: reggeli HU napindító szekciók -- semmi más.

---

## 1. Capability assessment

### Erősségek
- HU szövegértés és -generálás: HULU benchmark 75.1% (alap Qwen3-4B: 70.2%, PULI-LlumiX-8B: 72.9%)
- Tokenizálás: 47% fertilitás javulás HU-ra (3.13 -> 1.66 token/szó a Qwen3 alap tokenizerhöz képest)
- Instruction following, chat: megőrzött Qwen3-ból (nem finomhangolt, de működik)
- Kontextus: 32 768 token natív, 131 072 YaRN-nal
- Ollama-n futtatható (msallai02/racka, GGUF Q4/Q5/Q8)
- Best Paper díj MSZNY 2026 konferencián

### Gyengeségek (kritikus)
- **Nincs safety alignment** -- explicit kutatói figyelmeztetés: "unsafe for use with end-users"
- **CC-BY-NC-SA 4.0** -- nem kereskedelmi; production Marveen-ban kereskedelmi érintkezéskor problémás
- Structured output (JSON): nem célzottan tanított, megbízhatóság ismeretlen
- Tool use: nincs adat, Qwen3-4B funkció megőrzés bizonytalan
- Kódgenerálás: gyenge (11% kód az adatban, nincs kód-benchmark)
- Multi-turn komplex dialog: alapszinten, nem tesztelve
- CPU-only lokálisan: lassú inference (lásd hardware)

---

## 2. Marveen use-case map

### Lehetséges (POC scope)
| Funkció | Miért OK | Kockázat |
|---|---|---|
| Reggeli napindító HU szekciók | Rövid, formatált HU szöveg; alacsony safety-érintkezés | Lassú CPU inference; stíluskonzisztencia |
| Napi napló HU szöveggenerálás | Append-only, nem Jocoo-facing | Stílusminőség |
| AI hírek HU fordítás/összefoglalás | Nem actionable döntés | Pontosság |

### Problémás (NEM POC scope)
| Funkció | Miért NEM |
|---|---|
| Cuzcoo Telegram válaszok Jocoo-nak | Alignment hiány; stíluskonzisztencia (Marvin hang) kockázat |
| Memória keresés (HU-szemantikus) | JSON structured output megbízhatlan |
| Skill-keresés NL query | Routing JSON-függő |
| Bármilyen inter-agent logika | Strukturált válasz kritikus |

### NEM érintett (Claude marad)
- Kódgenerálás (Kronk/Claude)
- JSON, SQL, API logika
- Yzma BA spec (angol)
- Scheduling, routing
- Minden structured output

---

## 3. Token-saving estimate

**Fontos pontosítás:** A hirdetett 47% a Qwen3 alap tokenizerhöz (3.13/szó) mért javulás, nem Claude-hoz képest.

| Tokenizer | Becsült HU fertilitás |
|---|---|
| Qwen3-4B alap | 3.13 token/szó |
| Racka-4B | 1.66 token/szó |
| Claude Sonnet 4.6 (becsült) | ~1.8-2.2 token/szó |
| GPT-4o (becsült) | ~2.0-2.5 token/szó |

Claude vs Racka HU savings becsülés: **~17-25%** (ha Claude ~2.0/szó, Racka 1.66/szó).

**Heti HU output becslés (Cuzcoo):**
- Reggeli napindító HU ~500 token/nap
- Napi napló HU ~200 token/nap
- HU Telegram válaszok ~800 token/nap
- **Összesen: ~1 500 token/nap, ~10 500 token/hét**

17% megtakarítás = ~1 785 token/hét saved -- nagyságrendileg negligibilis pénzügyi hatás.

**Valódi előny:** nem $, hanem kontextus-hatékonyság: hosszabb HU szöveg ugyanolyan ablakban. Ezt is csak ha az inference quality elfogadható.

---

## 4. Risk

| # | Kockázat | Súly | Mitigáció |
|---|---|---|---|
| R1 | Nincs alignment -- "unsafe for end-users" | Kritikus | POC csak Jocoo-facing, external user-nek soha |
| R2 | CC-BY-NC-SA licenc -- non-commercial | Magas | Jocoo döntés: magánhasználatra valószínűleg OK, üzleti use-case-re NEM |
| R3 | CPU-only inference: ~2-5 tok/sec, 500 token ~100-250 sec | Közepes | Async generálás; csak nem-realtime output (napindító) |
| R4 | Minőség-drop vs Claude | Közepes | Blind vakteszt 5 mintán Jocoo-val (Marvin hang megtartható-e?) |
| R5 | ELTE kutatási projekt -- hosszú távú fenntartás bizonytalan | Alacsony | Fallback Claude mindig megmarad |

---

## 5. POC ajánlás

**Ha Jocoo zöld fényt ad (licence + vakteszt zöld):**

1. Scope: reggeli napindító HU szekciók (naptár + email összefoglaló generálás) -- 1 hét próba
2. Nem scope: Telegram válaszok, JSON, routing, multi-turn
3. Technikai előkészítés: `ollama pull msallai02/racka` -- Kronk feladat, 2.5 GB letöltés
4. Integráció: morning-brief script-be Racka API call, Claude párhuzamos generálás az első héten (A/B)
5. Értékelési kritérium: Jocoo blind pontoz 3 reggeli napindítót (Racka vs Claude, nem tudja melyik melyik)

**Szükséges döntések Jocoo-tól (POC előtt):**
- D1: CC-BY-NC-SA non-commercial -- elfogadható a magánhasználatra? (licence check ajánlott)
- D2: CPU latency (100-250 sec HU szekció generate) -- elfogadható?
- D3: Multilingo #57-vel szinergia -- ha EN verzió készül, Racka akkor is csak HU -- koherens?

---

*Kutatási anyagok: [arxiv.org/abs/2601.01244](https://arxiv.org/abs/2601.01244), [HuggingFace: elte-nlp/Racka-4B](https://huggingface.co/elte-nlp/Racka-4B)*
