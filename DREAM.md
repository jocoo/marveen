# 💭 Dream Engine — 2026-09-05 02:07

## 💡 Skill-javaslatok
Ma egy skill módosult élőben: `heartbeat-repeat-cadence-check` (Kronk) — a #412-es symlink-nyomozás során kapott egy új 4. lépést (`task_runs` státusz-ellenőrzés `fired -> lost -> fired` mintára) és a teljes root cause leírást a Buktatók szekcióban, miután kiderült hogy a hiba nem csak a schedule-runnerben, hanem még három helyen (context-guard-runner.ts, context-restart-gate és egy negyedik hely) is ugyanazt a fel-nem-oldott symlink-utat nézi sub-agent transzkript-olvasásnál. Konkrét mért kár: a dashboard "contextTokens" mezője sub-agenteknél vagy üres, vagy egy 12 napja megfagyott hamis szám — ez magyarázza, miért nem lát a context-guard valós fogyást náluk.

Külön saját (cuzcoo) memóriajegyzet is készült ma: a ledger-live-drain heartbeat gyors, ismétlődő, üres-kimenetű firingjét (`*/2 * * * *` + `skipIfBusy:true`) újra ellenőriztem a heartbeat-repeat-cadence-check skill alapján — megerősítve, hogy ez várt viselkedés, nem hiba, nem igényelt új patch-et.

A #412-es kártya (scope kibővítve, közös helyen kellene javítani a széles hatókörű `agentDir()` módosítása helyett egy célzott helper függvénnyel) még Jocoo döntésére vár — lásd Top-3 alább.

## 🧹 Memória-egészség
1379 / 1379 memória vektorizálva (100%, 1 hiányzó pótolva backfill-lel). 5 antikvált hot-tier memória (id 1390, 1393, 1394, 1395, 1398 — mind 2026-08-28-i, kanban-audit és queue-diszpécselési jegyzetek, 7+ napja nem hivatkozva) cold-tier-be mozgatva. 2 pontos duplikátum-pár ("Mai megbeszeles eredmenye" / "Szeretem a kavét", 4-4 példány, id 36-43) — továbbra is már réges-régen cold-tier-ben, teszt-eredetű, nem mozgattam tovább.

## 🎯 Top-3 holnapi javaslat
1. Marveen_Env: #412 (Scheduler symlink-hiba, kibővített hatókör) — ma derült ki hogy 4 helyen ugyanaz a minta él, a fix helye emiatt megváltozott (célzott helper, nem az `agentDir()` szélesítése); a fork-policy szerint ez lokális patch, de Jocoo döntésére vár, és a context-monitoring pontossága is ezen múlik.
2. Infra: #411 (Dashboard/channels uptime watchdog) — Kronk terve kész, Jocoo priorizálására vár; harmadik napja mozdulatlan.
3. Scouts: #142 (storage key pickup) — magas prioritás, planned státuszban 2 hónapja mozdulatlan, fizikai lépés, ami feltehetően blokkolja a többi QM-kártyát (pl. #143 den-leltár).

(Ellenőrizve: #276 (Published P&L / Looker-szűrés) tudatosan kimaradt — Jocoo 2026-08-05-én explicit parkolta, a döntés érvényben marad, csak Ő hozhatja elő újra.)

## 🌐 External opportunity
**alirezarezvani/claude-skills** (https://github.com/alirezarezvani/claude-skills) — 25 527 csillag, utolsó commit 2026-08-26. 380 skillt / 30+ agentet tartalmazó, domain szerint (köztük marketing, engineering, finance) szelektíven telepíthető gyűjtemény — a flotta a marketing-skills vagy engineering-skills csomagot külön install-olhatná Chichanak/Kronknak anélkül hogy az egészet behúzná.

## 🛠 Skill-flotta health
A `skill_usage` log mostanra 37 napot fed le. A nem-pinned, 30+ napos mtime-jelöltek közül több korábban 0-találatos skill mára már mutat legalább 1 használatot (pl. `docker-stale-image-verify`, `marveen-agent-permission-popup`, `agent-safeguard-hard-block`, `marveen-agent-poller-restart`, `scheduled-task-wrapper-anomaly-triage`, `dashboard-unresponsive-diagnose`, `code-provenance-before-fork-decision`, `agent-rate-limit-context-visibility`) — jó jel, ezek nem antikváltak, csak ritkák voltak. Kb. 22 nem-pinned skill (pl. `whisperx-poc-run`, `job-application-tailoring`, `kanban-to-trello-migration`, `portainer-password-reset`, `pdf-page-rotate`, `google-sheet-from-table`, `youtube-video-fleet-analyze`) továbbra is 0 találatos, ugyanaz a lista mint tegnap volt, jellemzően nyitott kártyához vagy ritka szituációhoz kötött, nem antikvált. Ez a 2. egymást követő éjszaka hogy ez a lista szinte változatlan — még nem éri el a 6-éjszakás küszöböt, konkrét törlési javaslat ma sincs.

*Marveen, 02:14 — most már alszom én is.*
