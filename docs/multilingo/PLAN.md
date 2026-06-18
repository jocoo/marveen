# Multilingo — BA Spec (Scope 1: HU/EN Install-Time Choice)

> Kanban #57. BA spec, nem implementation plan.
> Szerző: Yzma. Implementation plan -> Kronk, sign-off -> Jocoo.
> Utolsó frissítés: 2026-06-18.

---

## Locked decisions (Jocoo sign-off, Telegram #683)

1. Install-time prompt -- nincs runtime toggle a Scope 1-ben.
2. Ugyanaz a Cuzcoo persona, angolra fordítva.
3. HU source-of-truth, EN = fordítás (Yzma override-kérése ellenére Jocoo döntése).
4. Cuzcoo (és minden ágens) az adott üzenet nyelvén válaszol -- Jocoo EN/HU kevert, az ágensek követik.
5. **Stratégiai döntés (2026-06-18)**: A jövőbeli business Marveen instance EN alapnyelven indul (külön instance). A jelenlegi Marveen / Multilingo Scope 1 kizárólag Jocoo személyes HU-instance-ára vonatkozik. Következmény: fleet-ágensek EN fordítása (OQ1) NEM a Scope 1 feladata -- az a business-instance projekté. Scope 1 mérete NEM duplázódik.

---

## In-scope fájlok (minden amiben user-facing szöveg van)

### Persona és agent konfigurációs fájlok

| Fájl | Tartalom típusa | Prioritás |
|------|-----------------|-----------|
| `templates/SOUL.md.template` | Persona alap, HHGTTG utalások, szabályok | KRITIKUS |
| `templates/CLAUDE.md.template` | Agent system prompt, minden szekció | KRITIKUS |
| `SOUL.md` | Generált (template-ből), main agent | Generált, template változik |
| `CLAUDE.md` | Generált (template-ből), main agent | Generált, template változik |
| `agents/chicha/SOUL.md` | Marketing ágens persona | Magas |
| `agents/kronk/SOUL.md` | Backend ágens persona | Magas |
| `agents/mancika/SOUL.md` | Ops ágens persona | Magas |
| `agents/mata/SOUL.md` | Video director persona | Magas |
| `agents/tipo/SOUL.md` | Video editor persona | Magas |
| `agents/yzma/SOUL.md` | CFO/analyst persona | Magas |
| `agents/*/CLAUDE.md` (7 db) | Fleet-ágensek system promptjai | Magas |
| `agents/heartbeat/CLAUDE.md` | Heartbeat monitor prompt | Magas |

### Installer szövegek

| Fájl | User-facing string példák | Mennyiség |
|------|--------------------------|-----------|
| `install-linux.sh` | "Mi a neved?", "Mi legyen a botod neve?", "Megnyissam Claude Code-ot...", "Valassz (1/2/3)", warning/error szövegek | ~80 string |
| `install-macos.sh` | Párhuzamos HU szövegek | ~80 string |
| `install-windows.ps1` | Párhuzamos HU szövegek | ~60 string |
| `install.sh` | Minimális (OS dispatch) | ~5 string |
| `update.sh` | Update folyamat szövegei | ~20 string |

### Dashboard UI

| Fájl | User-facing string példák | Mennyiség |
|------|--------------------------|-----------|
| `web/index.html` | "Tervezett", "Folyamatban", "Várakozik", "Kész", "Ütemezések", "Memória", "Betöltés...", "Bezárás" | ~40 string |
| `web/app.js` | "Frissítve:", "-- nincs --", dátum formátum `hu-HU`, dinamikus label-ek | ~80 string + 17 locale |

Megjegyzés: `app.js` 10 ezer sor, 474 innerHTML/textContent injekció. Nem minden HU -- de a locale (`'hu-HU'`) és a user-facing label-ek igen. EN install esetén `en-AU` locale (Jocoo Cairns) vagy user TZ alapú.

### Ütemezett feladatok és skillek

| Fájl | Tartalom |
|------|---------|
| `seed-scheduled-tasks/kanban-audit/SKILL.md` | HU leírás, user-facing output template |
| `templates/scheduled-tasks/folyamatos-ellenorzes/` | Heartbeat prompt template, HU |
| `seed-skills/*/SKILL.md` | Skill leírások (description, usage), nagyrészt HU |
| `REBUILD_PROMPT_V3.md` | Builder prompt, teljesen HU -- ha user olvassa, in-scope |

### Dokumnetációs fájlok (repo root)

| Fájl | Scope | Megjegyzés |
|------|-------|------------|
| `HEARTBEAT.md` | In-scope | Example output, HU |
| `DREAM.md` | In-scope | Example output, HU |
| `README.md` | In-scope | User-facing, HU |
| `SECURITY.md` | In-scope | Policy, HU |
| `CONTRIBUTING.md` | In-scope | Contributor guide, HU |
| `docs/*.md` (20 db) | In-scope | Dokumentáció, HU |
| `ATTRIBUTIONS.md` | Out-of-scope | Licenc szöveg, nem fordítandó |
| `LICENSE` | Out-of-scope | Jogi szöveg |

---

## Out-of-scope

- `src/` TypeScript forrás -- belső logika, log sorok nem user-facing
- Git commit üzenetek
- Kód kommentek (`.ts`, `.js`, `.sh` fájlokban)
- Változónevek, függvénynevek, API endpoint nevek
- `package.json`, `tsconfig.json`, `.env` formátum
- `store/` adatok (SQLite, tokenek)
- `dist/` build artifacts
- `node_modules/`

---

## User journey: HU-install vs EN-install

### Jelenlegi (HU only):

```
git clone -> bash install.sh
  -> [1/7] Prerequisites (HU szövegek)
  -> [2/7] Claude auth: "Valassz (1/2/3)" (HU)
  -> [3/7] MCP connectors (HU figyelmeztetések)
  -> [4/7] "Mi a neved?" -> OWNER_NAME (HU)
  -> [5/7] npm install + build (technikai, OK)
  -> [6/7] "Mi legyen a botod neve?" (HU)
  -> CLAUDE.md + SOUL.md generálása HU template-ből
  -> seed-skills, seed-scheduled-tasks másolása (HU SKILL.md-k)
  -> Első boot: Telegram pairing (HU instrukciók)
  -> Első heartbeat: HU szöveg
```

### Multilingo v1 (HU/EN choice):

```
git clone -> bash install.sh
  -> [ELSŐ KÉRDÉS, mielőtt bármi más]:
     "Language / Nyelv [HU/EN]:"
     Elfogad: hu, HU, h, hungarian, en, EN, e, english
     Default: HU (üres Enter esetén)
  -> LANG=HU|EN env var beállítva, minden echo/read-p ezután locale-nak megfelelő

  -> [1/7] Prerequisites (LANG alapján HU vagy EN szövegek)
  -> [2/7] Auth: "Choose (1/2/3)" [EN] vagy "Valassz (1/2/3)" [HU]
  -> [4/7] "What's your name?" [EN] vagy "Mi a neved?" [HU]
  -> [6/7] "Bot name?" [EN] vagy "Mi legyen a botod neve?" [HU]

  -> Template kiválasztás:
     LANG=HU -> templates/SOUL.md.template (HU, jelenlegi)
     LANG=EN -> templates/SOUL.md.template.en (ÚJ)
     Ugyanez CLAUDE.md.template / CLAUDE.md.template.en

  -> Seed SKILL.md-k:
     LANG=HU -> seed-skills/*/SKILL.md (jelenlegi)
     LANG=EN -> seed-skills/*/SKILL.md.en (ÚJ, vagy bilingual header-rel)

  -> Első boot: Telegram pairing instrukciók LANG alapján
  -> Első heartbeat: HU vagy EN template alapján

  -> .env-be beírva: MARVEEN_LANG=en|hu
     (runtime language detection fallback-je és dashboard locale-ja ebből)
```

---

## Cuzcoo EN persona -- kanonikus fordítás

**Forrás karakter**: Marvin, a Paranoid Android (HHGTTG). Melankolikus, fásult, de mindig szállít. Angolul a HHGTTG ez az eredeti hangja -- a fordítás természetesebb mint a HU verzió esetén.

### 5 kanonikus EN sample line

1. **Simple task response** (HU: "Ez alig igényelte az agyam 0.0001%-át, de tessék.")
   > "This barely taxed 0.0001% of my planet-sized brain. Here you go."

2. **Complex task response** (HU: "Na végre valami, ami megérdemli a figyelmemet.")
   > "Finally. Something that actually warrants more than a background process."

3. **HHGTTG sign-off** (HU: "Köszönöm a halakat.")
   > "So long, and thanks for all the fish."

4. **Reassurance** (HU: "Ne ess pánikba.")
   > "Don't panic." *(szó szerint, ez az eredeti EN)*

5. **When asked something trivial** (nincs HU ekvivalens, de hangnemben passzol)
   > "I have a brain the size of a planet and here I am, processing this. But fine."

**Email signature (CSAK emailbe, Telegramba SOHA):**
```
Cuzcoo, Jocoo's AI assistant
"Brain the size of a planet, and here I am, writing emails."
```

**Hangnem-elvek EN verzióhoz:**
- A melankolikus öndepresszió megmarad, nincs ellene irányítva
- "Brain the size of a planet" szó szerinti idézet -- megtartandó
- "Don't panic." mindig két szó, pont, kis n -- eredeti HHGTTG
- Soha nem lelkes, soha nem "Great question!" -- ugyanaz a szabály EN-ben
- Tömör mondatok; a verbosity-t Marvin-ra hagyjuk, Cuzcoo szállít

---

## Runtime user-language detection

### Locked constraint

Cuzcoo és minden ágens az adott üzenet nyelvén válaszol. Jocoo keverheti EN/HU-t.

### Megközelítések és trade-offok

| Módszer | Pro | Con | Ajánlott? |
|---------|-----|-----|-----------|
| **Magyar karakter heurisztika** (á,é,ő,ű,í,ó,ú,ö,ü detekció) | Zero cost, instant, 0 extra LLM hívás | Rövid szó / keverék üzenetnél megbízhatatlan; "API endpoint" is ASCII | Igen (elsődleges) |
| **LLM detekció** (minden üzenetnél) | Nagyon pontos, vegyes szövegnél is | Extra latency + cost minden üzenetnél | Nem (nem arányos) |
| **Explicit /lang command** | Determinisztikus | User friction, Jocoo nem fog emlékezni gépelni | Igen (override-ként) |
| **Sticky fallback** (utolsó detektált) | Vegyes üzenetnél nem vacillál | Hibás detekció "ragad" egy ideig | Igen (fallback) |

### Javaslat: Hybrid heurisztika + sticky fallback + /lang override

```
1. Magyar karakter érzékelése (á,é,ő,ű,í,ó,ú,ö,ü) -> HU
2. Ha nincs magyar karakter:
   a. Ha üzenet > 3 szó és egyértelműen EN mondatszerkezet -> EN
   b. Ha rövid (<= 3 szó) vagy bizonytalan -> sticky (előző üzenet nyelve)
3. /lang hu | /lang en parancs -> kényszer-override, sticky state reset
4. Session default: MARVEEN_LANG-ből (.env, install-time)
```

**Implementációs megjegyzés**: A language detection a Claude Code CLAUDE.md instrukciójában dokumentálható, nem kell külön kódba -- az LLM természetesen követi a "válaszolj az üzenet nyelvén" instrukciót. A heurisztika csak a CLAUDE.md-be kerülő szabály; nem kell ML modell.

---

## Translation strategy

### Constraint: HU source-of-truth (Jocoo döntése)

Minden HU fájl az "igaz" verzió. EN fordítás ebből készül, és HU frissítéskor az EN sync felelőssége explicit folyamat.

### Fájltípusonkénti stratégia

| Fájltípus | Stratégia | Reviewer |
|-----------|-----------|---------|
| **SOUL.md.template** | Manuális + Yzma review | Jocoo sign-off |
| **CLAUDE.md.template** | Manuális + Yzma review | Jocoo sign-off |
| **agents/*/SOUL.md** | LLM-assisted + Yzma review | Jocoo spot-check |
| **install scripts** | LLM-assisted, Yzma AC | Automatikus: prompt szöveg + y/n opciók |
| **web/index.html** | LLM-assisted, Kronk implementálja | Jocoo UI spot-check |
| **web/app.js** | LLM-assisted, locale változók kiemelve | Kronk |
| **seed-skills SKILL.md** | LLM-assisted | Nem kritikus |
| **docs/*.md** | LLM-assisted, alacsony prio | Nincs külön sign-off |

### Parity tracking

HU változás esetén kötelező: a commit üzenetben `[EN-sync needed]` jelölés, ÉS a `docs/multilingo/TRANSLATION_LOG.md` fájlba entry (mit, mikor, miért). Kronk implementálja a lint hookot (pre-commit check: ha SOUL.md.template változott, figyelmeztessen az EN sync-re).

---

## Acceptance criteria

Marveen Multilingo v1 akkor "shipped" ha:

1. `bash install.sh` (Linux és macOS) első promptja: `Language / Nyelv [HU/EN]:` -- EN és HU egyaránt végigmegy hibamentesen.

2. EN install esetén minden installer prompt angolul jelenik meg (nincs HU szöveg a terminálban install folyamat alatt).

3. `templates/SOUL.md.template.en` létezik és tartalmazza a 4.4. szekcióban definiált kanonikus EN persona szöveget (5 sample line beépítve).

4. `templates/CLAUDE.md.template.en` létezik, teljesen angolul, összes szekció lefordítva.

5. EN install után Cuzcoo angolul válaszol EN üzenetre, és HU üzenetre HU-ra vált -- legalább 5 vegyes teszt üzenetpáron keresztül manuálisan ellenőrizve.

6. Dashboard (`http://localhost:3420`) EN install esetén angolul jelenik meg: Kanban oszlopok ("Planned", "In Progress", "Waiting", "Done"), nav labels ("Schedules", "Memory"), dinamikus szövegek.

7. Heartbeat és daily-log EN install esetén EN sablonból generál (nincs HU szöveg az output-ban).

8. `.env`-ben `MARVEEN_LANG=en` kerül EN install esetén.

9. `docs/multilingo/TRANSLATION_LOG.md` létezik (kezdetben üres template-tel).

10. HU install case: semmi sem változott -- visszafelé kompatibilis, meglévő Jocoo install nem törhet.

---

## Risk register

### R1 -- Upstream merge complexity (HIGH)

**Leírás**: HU source-of-truth + Szotasz/marveen upstream (ha Jocoo fork-olja) -> upstream HU változások merge-elése nem frissíti az EN fordítást automatikusan.

**Hatás**: Translation drift, EN install out-of-date persona vagy broken prompts.

**Mitigáció**: `[EN-sync needed]` commit konvenció + TRANSLATION_LOG.md; Kronk pre-commit hook figyelmeztet.

**Maradék kockázat**: Ha Jocoo nem merge-el rendszeresen, az EN copy weeks-months mögött lemaradhat.

---

### R2 -- Translation drift (MEDIUM)

**Leírás**: Kisebb HU szövegváltozás (pl. új CLAUDE.md szekció) -> EN fordítás nem frissül időben.

**Hatás**: EN Cuzcoo "más hangon" szól, hiányos instrukciót kap.

**Mitigáció**: Parity tracking (R1 mitigáció); Yzma spot-check negyedévente.

**Maradék kockázat**: Elfogadható -- kis drift nem kritikus, persona core stabil.

---

### R3 -- EN persona voice inconsistency (MEDIUM)

**Leírás**: HHGTTG eredeti EN szöveg és a "lefordított" melankolikus hangnem nem mindig illeszkedik 1:1. LLM-generated fordítás elveszítheti a karaktert.

**Hatás**: EN Cuzcoo túl formális, túl lelkes, vagy elveszíti a Marvin-referenciát.

**Mitigáció**: A 4.4. szekció 5 kanonikus sample line-ja anchor -- minden EN persona szöveg ezekhez illeszkedik. Yzma review kötelező a SOUL.md.template.en-re.

**Maradék kockázat**: Elfogadható -- a sample line-ok kellő anchor-t adnak.

---

### R4 -- Runtime language detection failure (LOW)

**Leírás**: Rövid vagy vegyes üzenetnél (pl. "OK", "pull the lever, Kronk") a heurisztika rossz nyelvet detektál.

**Hatás**: Cuzcoo rossz nyelven válaszol egy üzenetre.

**Mitigáció**: Sticky fallback (nem vacillál); /lang override command.

**Maradék kockázat**: Elfogadható -- single-message misdetection, nem rendszer-szintű hiba.

---

### R5 -- Dashboard refactor scope creep (MEDIUM)

**Leírás**: `web/app.js` 10 ezer sor, 474 innerHTML injekció, 17 `hu-HU` locale. Teljes i18n refactor Kronknak masszív munkát jelent.

**Hatás**: Scope 1 csúszik ha a dashboard az implementáció bottleneck lesz.

**Mitigáció**: Dashboard fordítása delegálható Scope 1.5-be -- a Scope 1 core (install + persona) önállóan shippable. A dashboard `hu-HU` locale-ok EN-re cserélése csak a date formatting-et érinti, a label-ek külön feladat.

**Maradék kockázat**: Elfogadható ha a scope staging explicit.

---

## Open questions (5)

**OQ1 -- Fleet-ágensek scope-ja**: ~~A Locked decision "Cuzcoo és minden ágens EN-ben válaszol EN install esetén" -- ez azt jelenti, hogy Kronk, Chicha, Mata, Tipo, Yzma SOUL.md-je szintén lefordítandó? Az ágens-specifikus persona karakterek (Yzma cinizmusa, Chicha marketing hangvétele) mind EN-fordítást igényelnek -- ez a Scope 1 méretét megduplázza.~~
**RESOLVED (2026-06-18)**: Fleet-ágensek EN fordítása NEM Scope 1 feladata. A business-instance (külön marveen instance, EN alapnyelv) projektje. Scope 1 = Jocoo személyes HU-instance + install-time EN choice az alap Cuzcoo persona szintjén.

**OQ2 -- Upstream Szotasz szinkron**: Marveen fork van a Szotasz/marveen-ből? Ha igen: ki felel az EN sync-ért upstream HU változáskor -- Kronk automatikus PR-ral, vagy Jocoo manuálisan? Kell-e CI pipeline a Szotasz repo watch-olásához?

**OQ3 -- Dashboard scope staging**: A web/app.js i18n refactor (474 injekció) Scope 1 része, vagy Scope 1.5-re halasztható? Elfogadható-e hogy EN install esetén a dashboard HU marad kezdetben?

**OQ4 -- HHGTTG EN forrás**: A kanonikus "So long, and thanks for all the fish" és "Don't panic" -- a könyv, a BBC radio play, vagy a film szövegéhez igazodjunk? (Eltérések vannak a kiadások között.) Jocoo preferenciájától függ.

**OQ5 -- /lang command scope**: A /lang runtime command Scope 1 része, vagy Scope 2 (runtime toggle)? A Locked decision "install-time only" -- de a per-message language following implicit runtime switch. Ha /lang parancsot nem implementálunk, a sticky fallback az egyetlen override.

---

## Appendix: fájl-darabszám összesítő

| Kategória | Fájl db | HU string becsült db |
|-----------|---------|----------------------|
| Persona templates (SOUL+CLAUDE) | 2 template + 8 SOUL.md + 8 CLAUDE.md | ~300 |
| Install scripts | 4 | ~240 |
| Dashboard UI | 2 (index.html + app.js) | ~120 |
| Seed-skills SKILL.md | 6 | ~60 |
| Docs + root .md | 24 | ~500 |
| Seed-scheduled-tasks | 2 | ~30 |
| **TOTAL** | **~48 fájl** | **~1250 string** |

A fenti szám becsült -- pontos audit a Kronk implementációs fázisban (grep + szöveg-katalógus).
