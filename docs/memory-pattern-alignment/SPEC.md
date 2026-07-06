# Memory-Writing Pattern Alignment -- Kronk + Yzma
**Yzma BA spec -- 2026-06-19 | Kanban #178293be**

---

## Jelenlegi állapot (baseline)

```
agent     | warm | cold | hot | shared | TOTAL
----------|------|------|-----|--------|------
cuzcoo    |  19  |  14  |  1  |   1    |  35
kronk     |   0  |   0  |  0  |   0    |   0
yzma      |   0  |   0  |  0  |   0    |   0
chicha    |   3  |   2  |  0  |   0    |   5
mancika   |   2  |   0  |  0  |   0    |   2
marveen   |   1  |   8  |  0  |   0    |   9
```

**Diagnózis:** Kronk és Yzma soha nem mentett. A CLAUDE.md-jeikben az API parancsok ott vannak, de nincs konkrét trigger-szabály -- ezért az ágensek ad-hoc kontextus alapján döntenek, és rendre kihagyják. Cuzcoo 35 bejegyzése mutatja, hogy a trigger-tábla működik, ha explicit.

---

## Cuzcoo trigger-minta (retrospektív, adatokból)

| Tier | Cuzcoo menti amikor |
|------|---------------------|
| hot | Aktív kanban blokker, pending restart-handoff, "holnap folytatjuk" |
| warm | Stratégiai döntés (Multilingo, Racka status), becslési heurisztika, git/tool quirk |
| cold | Bug root cause, incident (duplikált heartbeat, channels crash), audit eredmény, brainstorm outputs más ágensektől, MCP setup tanulság, rejected state archív |
| shared | Flottának releváns feasibility finding (pl. Racka), flotta-szintű policy változás |

---

## Javasolt trigger-táblázat: Kronk

Kronk szerepe: implementer, backend dev, deployment felelős. Memóriája = döntési archívum + tanulságok.

| Trigger | Tier | Példa content |
|---------|------|---------------|
| Kanban kártyán blokker keletkezett, pending döntéssel | hot | "#NN -- schema migration vár Jocoo jóváhagyásra. Blokker: backwards compat kérdés." |
| Architektúra döntés elfogadva (ADR) | warm | "NAB anomaly fixer v6.5: minNewId threshold Qwen3 batches-ből. Döntés: description tiebreaker eldobva (NAB_Raw!G unreliable new-batch row-okon)." |
| API kontrakt változott (más ágensek is hívják) | warm | "POST /api/messages: új `priority` field, backwards compat, default=normal." |
| Setup/konfig gotcha (ismételhetővé vált, de nem triviális) | warm | "clasp run: void return-jű fn 'No response.' = success, nem error." |
| Bug root cause elemzés lezárva | cold | "Duplikált telegram poller: plugin-scope hiányzott spawn-kor. Fix: per-agent plugin scoping #373." |
| Migration gotcha (amin megakadt, amit dokumentálni érdemes) | cold | "SQLite ALTER TABLE nem támogat column drop-ot. Workaround: temp tábla + migrate." |
| Rejected approach (miért NEM ezt csináltuk) | cold | "Rejected: Redis cache a sessions-höz -- overhead nem arányos a <10 concurrent user esetén." |
| Deployment incident (mi ment félre, mi lett a fix) | cold | "Deploy #NN: node version mismatch WSL2-n, nvm use 20 kellett explicit." |
| API/schema breaking change ami más ágenseknek is releváns | shared | "GET /api/kanban response: `seq` field hozzáadva (2026-06-19). UUID-only hivatkozás deprecated." |

**NEM ment Kronk:** kódolási döntések amik triviálisak (változónév, formázás), átmeneti state aminek nincs jövőbeli haszna, Jocoo válasza amíg csak üzletileg releváns (nem tech döntés).

---

## Javasolt trigger-táblázat: Yzma

Yzma szerepe: BA, pénzügyi elemző, spec-készítő. Memóriája = baseline-archívum + spec-tanulságok + data-quality finding.

| Trigger | Tier | Példa content |
|---------|------|---------------|
| BA spec Jocoo sign-off-ra vár, implementáció blokkolt | hot | "#57 Multilingo spec -- OQ1, OQ3 döntés pending. Implementáció ne induljon amíg nincs sign-off." |
| Adatminőség blokkolja az elemzést (Jocoo döntés kell) | hot | "NAB_General: 3 sor D-oszlopban összeg <> CF formula. Jocoo döntés kell mielőtt zárunk." |
| Havi/negyedéves baseline frissítés (KPI normálérték) | warm | "Baseline 2026-Q2: havi bevétel avg X Ft, fix cost avg Y Ft. Következő review: 2026-Q3 nyitó." |
| Metodológiai döntés (hogyan számolunk valamit) | warm | "Havi zárás = hónap utolsó napja (Jocoo 2026-06-19 conf). NEM hónap 25-e." |
| Period-definition egyértelműsítés | warm | "'Tavalyi' = előző naptári év, nem elmúlt 12 hónap (Jocoo konvenció megerősítve 2026-06-19)." |
| BA spec lezárva: tanulság/buktató a spec-írás minőségéről | cold | "Multilingo #57: fleet-agent scope (OQ1) nem kért kérdés volt, de a méret 2x lett volna -- proaktív OQ kötelező minden scope-inventory spec-nél." |
| Data-semantics finding (sheet-struktúra, CF formula értelmezés) | cold | "NAB CF formula: `=$D2<>VLOOKUP(...)` -- D=Amount mindkét sheeten. Description NEM tiebreaker: NAB_Raw!G unreliable new-batch row-on." |
| Anomália archívum (flagelt, lezárult) | cold | "2026-Q1 anomália: +18% cost kiugró február-ban. Root cause: egyszeri infra upgrade. Következő periódusban nem várható." |
| Baseline historikus (lezárt periódus referencia) | cold | "2025 éves összesítés: bevétel X Ft, kiadás Y Ft, margin Z%. Archív, nem módosítandó." |
| Cost/savings finding ami flotta-szintű döntést érint | shared | "Racka-4B: ~17-25% HU token saving becsült, de alignment hiány + CC-BY-NC-SA blokkolja production use-t (2026-06-18)." |

**NEM ment Yzma:** in-progress számítás közbülső állapota, mások kódolási döntése, Telegram csevegés tartalma ami nem döntés, minden adat amit a sheet-ből újra le lehet kérdezni.

---

## agent_id konvenció -- pontosítás

A shared tier bejegyzésnél az agent_id a forrást jelöli, NEM a Cuzcoo-t:
- Yzma shared finding -> `agent_id="yzma"`, `category="shared"`
- Kronk shared finding -> `agent_id="kronk"`, `category="shared"`

A keresési API (`/api/memories?q=...`) nem agent_id-re szűr alapból -- a flotta bármely tagja megtalálja. Az `agent_id="cuzcoo"` shared-be mentés pattern (ami eddig előfordult) redundáns és félrevezető.

---

## Javasolt CLAUDE.md szöveg -- Kronk

A Kronk CLAUDE.md "Memoria rendszer" szekciójában a "NINCS MENTAL NOTE!" bekezdés után, a keresési API parancs elé:

```
### Mikor mit ments

| Trigger | Tier |
|---------|------|
| Kanban blokker / pending döntés keletkezett | hot |
| Architektúra döntés elfogadva (ADR) | warm |
| API kontrakt változott (más ágensek hívják) | warm |
| Setup / konfig gotcha (nem triviális, ismételhető tanulság) | warm |
| Bug root cause elemzés lezárva | cold |
| Migration gotcha | cold |
| Rejected approach (miért NEM ezt csináltuk) | cold |
| Deployment incident | cold |
| API/schema breaking change flottának | shared |

**NEM ment:** triviális kódolási döntés, átmeneti állapot, üzleti tartalom ami nem tech döntés.
```

---

## Javasolt CLAUDE.md szöveg -- Yzma

A Yzma CLAUDE.md "Memoria rendszer" szekciójában a "NINCS MENTAL NOTE!" bekezdés után:

```
### Mikor mit ments

| Trigger | Tier |
|---------|------|
| BA spec sign-off-ra vár, implementáció blokkolt | hot |
| Adatminőség blokkolja az elemzést (Jocoo döntés kell) | hot |
| Havi/negyedéves baseline frissítés (KPI normálérték) | warm |
| Metodológiai döntés (hogyan számolunk valamit) | warm |
| Period-definition egyértelműsítés (Jocoo konvenció) | warm |
| BA spec lezárva: tanulság/buktató a spec minőségéről | cold |
| Data-semantics finding (sheet-struktúra, CF formula értelmezés) | cold |
| Anomália archívum (flagelt, lezárult) | cold |
| Baseline historikus (lezárt periódus referencia) | cold |
| Cost/savings finding flotta-szintű döntéshez | shared |

**NEM ment:** számítás közbülső állapota, mások kódolási döntése, adat amit a sheet-ből újra le lehet kérdezni.

**agent_id konvenció:** shared tier esetén is `agent_id="yzma"` -- ne "cuzcoo"-t írj, a forrás te vagy.
```

---

## Risks

**R1 -- Túl sok mentés (context-zaj):** Ha minden kis döntésnél ment, a memória kereshetetlenné válik.
Mitigáció: A trigger-tábla explicit NEM-ment sorral. Hot tier-ből aktívan törölni kell amikor lezárul.

**R2 -- Túl kevés mentés (elveszett tanulság):** Ha a trigger-tábla nem elég konkrét, az ágensek "ez úgyse fontos" alapon kihagyják.
Mitigáció: A trigger-tábla mintái konkrétak (nem "érdekes dolog"), és a "5+ tool hívás = generálj skill-t" analógiájára: "BA spec lezárva = cold-tier mentés kötelező."

**R3 -- Divergens persona (Cuzcoo coordinator vs sub-agent):** Cuzcoo mindent lát, sub-agentek csak a saját munkájukat.
Mitigáció: A sub-agent trigger-táblák szándékosan szűkebbek -- csak amit az ágens saját maga produkált vagy döntött, nem amit másoktól hallott.

**R4 -- shared tier agent_id összetévesztés:** Eddig Yzma agent_id="cuzcoo"-val mentett shared-be -- a forrás elveszett.
Mitigáció: Az agent_id konvenció explicit a javasolt szövegben.

---

## AC státusz

- [x] Yzma BA spec output: trigger-táblák Kronk + Yzma, CLAUDE.md szöveg
- [ ] Jocoo sign-off a spec-ra
- [ ] Kronk CLAUDE.md update (Kronk + Yzma fájlokba)
- [ ] Smoke: szimulált mentés, kategória-check
