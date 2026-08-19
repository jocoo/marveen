# 💭 Dream Engine — 2026-08-20 02:07

## 💡 Skill-javaslatok

Ma élőben létrehozva/patchelve:

- **Új skill**: `financials-watchdog-alert-triage` -- Kronk financials watchdog riasztása (UI health fail loopback+tailscale) egy tranziens konténer-blipnek bizonyult saját méréssel; a skill rögzíti az eljárást (azonnali saját ellenőrzés, docker StartedAt/restart_count, kereszt-visszaigazolás a domain-tulajdonossal, csak flapping esetén eszkalálás Jocoonak).
- `verify-correct-instance-before-diagnosing` és `gmail-oauth-reauth` -- tovább finomodtak a #372 gmail MCP local-scope override ügy lezárása kapcsán (két takarítási kör, session-restart-verifikáció).

Ezen felül nincs újabb, éjszakai javaslat -- a nap anyaga (financials watchdog transiens, #372 lezárása) élőben feldolgozásra került.

## 🧹 Memória-egészség

1113 / 1113 vektorizált (1 hiányzó pótolva backfill-lel). 11 antikvált (7+ napos, nem hivatkozott) hot-tier memória cold-tier-be mozgatva. A már ismert 2 pontos duplikátum-pár (`"Szeretem a kavét"`, `"Mai megbeszeles eredmenye"`, egyenként 4-4 példány) továbbra is cold-tier-ben, nincs változás -- nem törölve, csak jelezve.

## 🎯 Top-3 holnapi javaslat

1. HomeLab: #369 (Surface képernyő-elsötétülés regresszió) -- aktív, Kronknál fut, ma új hazárd is előkerült (Surface Pro 3 host lefagyás fb0/blank szoros ciklusú váltogatásnál, i915 GPU-hang), a javítás még nincs lezárva.
2. Marveen_Env: #234 (pending inter-agent message eszkaláció/láthatóság, urgent) -- 18 napja nyitva magas prioritással, Yzma diagnózisa megvan (elveszett retry a "busy" WARN után), a tényleges javítás még mindig nem történt meg.
3. Scouts: #328 (40th Anniversary social media terv, urgent, Matt emailje alapján) -- Chicha-nál, legutóbbi mozgás 08-12-én, érdemes rákérdezni válaszolt-e már Matt.

(#276, Financials Published P&L Looker-szűrés, kimaradt a listából annak ellenére hogy high priority: Jocoo 2026-08-05-én explicit megállította, "nem fontos most", a döntés érvényben marad, Ő hozza elő ha aktuális lesz.)

## 🌐 External opportunity

Skip -- heti limit nem telt le (utolsó futás 2026-08-19, kevesebb mint 7 nap telt el).

## 🛠 Skill-flotta health

Négy skill (`ai-fleet-project-execution`, `github-pr-rebase-merge`, `retrospective`, `skill-management`) immár 14. egymást követő éjszaka nulla `skill_usage`, `kanban-to-trello-migration` 8. egymást követő éjszaka nulla -- mindkettő régóta a döntési küszöb felett, a tegnapi döntés szerint ezt a bucket-et nem bővítem tovább napi részletezéssel, amíg nem lesz kézi audit-kör. Tágabb pásztázásban ma is 27/34 mtime-jelölt nulla-találatos, nincs változás a trendhez képest.

*Marveen, 02:2x -- most már alszom én is.*
