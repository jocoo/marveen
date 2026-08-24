# 💭 Dream Engine — 2026-08-25 02:07

## 💡 Skill-javaslatok

Ma (08-24) élőben patchelve/létrehozva: `stuck-multiline-input-recovery` (új skill + 2 patch, Cuzcoo) — a be nem küldött, beragadt tmux-input diagnózisa és kézi Enter-fixe, plusz a teljes-restart eszkaláció ha az nem elég (3. előfordulásnál már kellett); `cross-agent-screenshot-and-decision-relay` (új skill + 1 patch, Cuzcoo) — Jocoo-Telegram-képernyőkép relay egy másik sub-agent szakterületéhez, plusz az élő hibakeresés közbeni üzenet-lemaradási minta.

Ezen felül egy új javaslat: Kronk memóriáiban kétszer, egymástól függetlenül dokumentálva bukkant fel ugyanaz a workaround a marveen vitest suite live-install guardja körül (git worktree + node_modules symlink + fájlmásolás, mert a `store/.dashboard-token` jelenléte miatt a teszt-suite megtagadja a futást az élő installon). Mivel ez már kétszer kézzel le lett vezetve ugyanazon a napon, érdemes lenne Kronknak egy dedikált skillbe önteni.

## 🧹 Memória-egészség

1208 / 1208 vektorizált (1 hiányzó embedding pótolva backfill-lel). 4 antikvált (7+ napos, nem hivatkozott) hot-tier memória cold-tier-be mozgatva (egy korábbi Surface Pro TV-ötlet, két 08-17-i #359 Surface-szál bejegyzés, egy régi skip-skill jegyzet). A már ismert 2 duplikátum-pár ("Szeretem a kávét", "Mai megbeszelés eredménye") továbbra is cold-tier-ben, nincs változás.

## 🎯 Top-3 holnapi javaslat

1. HomeLab: #350 (*arr stack + uTorrent bekötés) — a nap legaktívabb szála, technikailag kész (letöltő-kliens bekötve Radarr+Sonarr-ba, útvonal-fordítás, megosztott mappa írás-tesztelve), csak a valódi végpontig-tesztelt letöltés maradt hátra. Jocoo A utat választotta (valódi indexer/tracker), de holnapra halasztotta.
2. Infra: #384 (stuck multi-row input, auto-recovery gyökér-oka) — ma este háromszor fordult elő (Kronk 1x, Chicha 2x), a harmadiknál már kézi Enter sem oldotta meg, teljes agent-restart kellett, prioritás emelve high-ra.
3. Scouts: #143 (den-leltár lista, aktív kölcsönzések felmérésével) — high priority, régóta nyitva, valós határidős kötelezettség Jocoo Quartermaster szerepéből.

(#531fe752, Financials Published P&L Looker-szűrés, kimaradt a listából annak ellenére hogy high priority: Jocoo 2026-08-05-én explicit megállította, "nem fontos most", a döntés érvényben marad, ő hozza elő ha aktuális lesz.)

## 🌐 External opportunity

Skip — heti limit nem telt le (utolsó futás 6.0 napja, a 7 napos ablak még nem zárult le).

## 🛠 Skill-flotta health

A nulla `skill_usage`-gal álló, nem-pinned, 30+ napja nem módosított skillek listája mára 27-re nőtt (a tegnap még 5 elemű listáról) — ez már a többszöri éjszakai halasztás jele, a mtime-only jelöltek közül ennyi valóban aktivitás nélküli. Javaslat: ez a bucket most már döntést igényel Jocootól vagy Kronktól, nem újabb éjszakai puszta-jelzést — érdemes egy dedikált kézi audit-kört tartani (törlés vagy megtartás-indoklás soronként), mielőtt a lista tovább nő.

*Marveen, 02:19 — most már alszom én is.*
