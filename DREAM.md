# 💭 Dream Engine — 2026-08-31 02:07

## ⚠️ Hibák
Új blokkoló: a `git commit` a fő checkout-on (`/home/jocoo/marveen`) mostantól egy hook-kal (EVIDGUARD818 secret-gate) el van tiltva ("BLOCKED: commit on the running main checkout... Work in a worktree instead", override: `MARVEEN_PROD_COMMIT_OK=1`). Ez korábban rutinszerűen ment (ld. `1f2d4ac` 08-28-i commit), most viszont ismeretlen eredetű, új védelem. NEM force-oltam át az override-dal — nem tudtam este megkérdezni, és a szabály explicit kifejezetten a fő checkout védelmére szolgál (dashboard innen szolgál ki élő fájlokat). A DREAM.md tartalma a lemezen rendben van (a 07:30-as napindító ezt olvassa, nem git-en át), csak a git history nem frissült. Kérlek mondd meg: menjen-e az override rutinból a DREAM.md napi commitjaira, vagy tényleg worktree-be kell terelni ezt a munkafolyamatot.

## 💡 Skill-javaslatok
Ma élőben patchelve: `arr-stack-api-config` (Kronk, többször, a Forms-auth + Bithumen cookie-indexer + Bazarr-összekötés menete alapján, ld. daily log 11:05–13:10). Ezen felül a memóriákban visszatérő, még le nem fedett minta:
- **Hardlink-alapú törlés/átnevezés buktató** (flotta-szintű, *arr-stack): ma kétszer is előkerült ugyanaz a csapda (a Radarr `delete+deleteFiles` csak a media-oldali nevet törli, a downloads-oldali másolat tartja a helyet; Sonarr renameEpisodes csak a media-oldalt nevezi át). Ez már 2. és 3. előfordulás egy napon belül, érdemes lenne az `arr-stack-api-config` skill Buktatók szekciójába emelni önálló alpontként — jelenleg csak a napi naplóban és a memóriákban van rögzítve.

## 🧹 Memória-egészség
1316 / 1316 vektorizált (1 hiányzó pótolva). 12 antikvált hot-tier memória (mind 2026-08-21 vagy régebbi, már lezárt kártyákra — #221, #348, #375 — vagy elavult skip-skill jegyzetekre vonatkozott) cold-tier-be mozgatva. Duplikátum-ellenőrzés: csak 2 db, egyértelműen teszt/fixture-tartalom ("Mai megbeszélés eredménye", "Szeretem a kávét", 4-4 példány) — valós tartalmi duplikátum nem volt.

## 🎯 Top-3 holnapi javaslat
(Minden jelölt kommentjét átfutottam parkolás-jelzésért — a Home-server 4/4 kártya és a Financials Looker-ágon lévő tételek ki is estek emiatt, ld. lent.)
1. HomeLab: #401 (link-átíró custom.js javítása, Kronknál) — Windows böngészőben megint Tailscale IP-vel próbál linket nyitni localhost helyett, aktív blokkoló a napi használatban, már kiküldve, csak visszajelzésre vár.
2. Scouts: storage key felvétele (magas prioritás, Jocoo-nál) — a többi Scouts QM kártya (leltár a denben, insurance-tisztázás) ettől függ, jelenleg ez a láncszem hiányzik.
3. Financials: UI (8791) dockerizálása (Kronknál, low) — az egyetlen nyitott Financials-tétel ami NEM a parkolt Looker-ágon lóg, nincs kommentben jelzett blokkoló, egyszerű infra-lépés.

## 🌐 External opportunity
Skip — heti limit nem telt le (utolsó futás 3 napja, a küszöb 7 nap).

## 🛠 Skill-flotta health
37 nem-pinned skill régebbi mint 30 nap, de a legrégebbiek (`skill-management`, `retrospective`, `skill-factory`, ~93-94 nap) alapinfrastruktúra-skillek, ritka triggerelés várható, nem törlésre valók. Konkrét jelölt: `docker-group-stale-session` (58 napja nem érintett, WSL2-specifikus egyszeri hiba, azóta nem ismétlődött) — frissítés vagy archiválás megfontolható, ha a fleet stabilan túl van a docker-group problémán.

*Marveen, 02:19 — most már alszom én is.*
