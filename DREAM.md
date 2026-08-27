# 💭 Dream Engine — 2026-08-28 02:07

## 💡 Skill-javaslatok
Ma élőben 5 skill lett patchelve/létrehozva a heartbeat-ciklusokban: `stuck-multiline-input-recovery`, `financials-watchdog-alert-triage`, `gmail-oauth-reauth` (ez utóbbiba került bele a gongrzhe-npm-prefix 4. előfordulásának teljes diagnózisa és a tartós fix útja is), `tmux-mass-restart-oom-triage`, és `creative-ideation-fanout` (a szülinapi projekt koordinációs tanulságaival: fájl-útvonal stabilitás, mobil-viewport teszt, pacing-kommunikáció). Ezeken felül egy éjszakai javaslat:

- **Új skill: video/kép-produkciós receptek (agent: Chaca, megosztva Tipo/Mata felé)** — a szülinapi film alatt Chaca 6 külön memóriában rögzített technikai buktatót (recraft-crisp-upscale WebP-t ad `.png` kiterjesztéssel — magic byte audit kell; Ken Burns zoom-plafon pontos képlete Z_max=W/(W-2x); multi-reference avatar-konzisztencia prompt-recept nano-banana-hoz; checksum-alapú asset-verziózás dátum helyett). Ezek jelenleg csak memóriában szórtan élnek, nincs egy skill ami összefogná őket, pedig a #206-os crochet-short projekt (in_progress, Mata) hamarosan ugyanezt a pipeline-t fogja használni.

## 🧹 Memória-egészség
1287 / 1287 vektorizált (1 hiányzó backfill-elve), 20 antikvált hot memória (>7 napos, mind lezárt téma: régi skip-skill bejegyzések, #362 SQLCipher incidens, Surface-leállás) cold-tier-be mozgatva. 2 pontos duplikátum (`Szeretem a kavét`, `Mai megbeszeles eredmenye`, egyenként 4x) — ezek már eleve cold-tier teszt-adatok, nem mozgattam tovább.

## 🎯 Top-3 holnapi javaslat
1. Marveen_Env: #384 (stuck multi-row input) — reggel MANUÁLISAN vond vissza a `web/index.html`-ben az uncommitted szülinapi easter egget (`git checkout -- web/index.html`), utána futtasd újra a 34 tesztet a c9c2f50 commit-on, és ha zöld, kérj restart-confirmet Jocootól — ez az egyetlen blokkoló, aktív tétel, minden más rajta várakozik (git-műveletek az easter egg miatt jelenleg veszélyesek).
2. Financials: #276 (Published P&L nem FY26-ra szűrt, Looker forrás) — high priority, `waiting` állapotban ragadt, 3+ napja nincs rajta mozgás, pénzügyi pontossági kockázat.
3. HomeLab: #347 (Surface home-server + TV, WiFi átállás + DisplayPort→HDMI lánc) — `in_progress` 2+ napja mozdulatlan Kronknál, érdemes megkérdezni státuszt mielőtt tovább stagnál.

## 🌐 External opportunity
[oguzhnatly/fleet](https://github.com/oguzhnatly/fleet) — multi-agent fleet management CLI kifejezetten Claude Code-hoz: monitorozás, megbízhatóság-értékelés, intelligens routing runtime-ok között. Relevancia: ez pontosan a saját flotta-menedzsment problémánk (Cuzcoo mint karmester több sub-agent felett), érdemes megnézni fed-e le olyat amit most kézzel csinálunk (pl. session health, restart-triázs). Csillagszám és aktivitás WebSearch-ből NEM ellenőrizhető megbízhatóan — mielőtt bármit is bevezetnétek belőle, nézzétek meg a repót közvetlenül.

## 🛠 Skill-flotta health
Nincs megbízható használat-log a nem-pinned skillekhez (101 db) — a fájl-módosítási idő NEM azonos a használattal, ezért heurisztikus "antikvált" riasztást szándékosan nem adok ki, mert hamis pozitív lenne. Ha ez fontos, egy tényleges use-log (pl. Skill-hívás naplózása a dashboardon) kellene előbb.

*Marveen, 02:41 — most már alszom én is.*
