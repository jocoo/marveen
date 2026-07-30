# 💭 Dream Engine — 2026-07-31 02:07

## 💡 Skill-javaslatok
Nincs új javaslat. A nap két érdemi mintázata (a `~/ClaudeClaw/scripts/skill-index.sh` téves útvonal a memoria-heartbeat szövegében, és a fork-lokális endpoint vs. upstream auth-gate integrációs rés a #218 avatar-bugnál) már élőben, a munka közben skillbe/memóriába lett öntve (marveen-upstream-sync Buktatók-patch + warm memória), nem várt a Dream Engine-re.

## 🧹 Memória-egészség
575 / 575 vektorizált (1 db backfill-lel pótolva). 6 db antikvált hot-tier memória (2026-07-23-i skip-skill bejegyzések, 7+ napja nem hivatkozva) cold-tierbe mozgatva. 0 pontos duplikátum.

## 🎯 Top-3 holnapi javaslat
1. Marveen_Env: #203 (auto-restart-runner launchctl-bug) és #214 (Playwright-MCP bekötés) gazdátlan kártyák Kronknak dispatch-elésre várnak — a 2026-07-30-i kanban-audit óta függő adminisztratív döntés, még nem jött rá jóváhagyás.
2. Research: #87 (YT video → Chicha/Replicate → Mata terv) és #206 (3 crochet short) ténylegesen kész, csak a `done`-flip vár Jocoo szavára — 13-14 napja mozdulatlan `in_progress` állapotban.
3. Scouts: a magas prioritású kártyák (kulcs-átvétel a raktárhoz, den-leltár) a szeptemberi 40 éves esemény felé haladva a legkorábbi blokkolók — érdemes ezeket előrébb venni a sorban.

Mellékesen egy #209 (Sonnet 5 hiányzik a dashboard model-dropdownból) kártyát menet közben ellenőriztem és lezártam: a backend `/api/models/available` lista már tartalmazza a `claude-sonnet-5`-öt, kód-szinten megerősítve (korábbi audit is készre jelezte, csak nem lett flippelve).

## 🌐 External opportunity
Skip — heti limit nincs kimerítve (4 napja volt az utolsó futás, 7 nap a küszöb), de nincs is sürgető ok kivételt tenni; a jövő heti ablakban esedékes.

## 🛠 Skill-flotta health
Nem tudok konkrét "X napja nem használt" állítást tenni: a `skill_usage` tábla flotta-szinten teljesen üres (0 sor), tehát a használat-log maga nincs bedrótozva sehol, nem csak ma nem gyűjtött. Ez inkább hiba, mint skill-egészségügyi jel — lásd lent. Fájl-mtime alapján a legrégebbi (53-63 napja nem szerkesztett) nem-pinned skillek: `ai-fleet-project-execution`, `github-pr-rebase-merge`, `handoff`, `retrospective`, `skill-management`, `skill-factory` — de ezek explicit user-parancsra (`/handoff`, `/retrospective`, `/skills`) futó, stabil skillek, a szerkesztetlenség önmagában nem jelent elavulást, nem javaslom törlésüket.

## ⚠️ Hibák
A `skill_usage` tábla (agent_id, skill_name, trigger_type, created_at) 0 sort tartalmaz flotta-szinten — a use-log mechanizmus soha nem írt bele semmit egyetlen ágensnél sem. Ha a Bucket 5 elemzés éles használat-alapú "antikvált skill" jelzést akar adni a jövőben, ezt drótozni kell (vagy a skill-read/tool-call eseménynél tényleg insertálni kell ide, vagy más forrást kell keresni). Ez már a második egymást követő Dream Engine-futás ahol ez a tábla üres — felvettem #219-et Kronknak (low priority, `planned`, nem ébresztettem éjjel).

*Marveen, 02:24 — most már alszom én is.*
