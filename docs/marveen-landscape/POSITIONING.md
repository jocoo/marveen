# Marveen -- Positioning

> Source-of-truth: Hungarian section. The English section is a mirror translation. Built on the landscape matrix in [COMPARISON.md](./COMPARISON.md) (June 2026).

---

## HU

### Egymondatos pozíció

Marveen nem egy keretrendszer amivel ágenst *építesz* -- egy kész, helyben futó AI-csapat ami a gépeden *él*: nevesített specialistákkal, tartós memóriával, saját Kanban-táblával és proaktív ütemezéssel.

### A kategória problémája

A nyílt forrású AI-ágens világ 2026-ban négy táborra esik szét, és egyik sem ad teljes személyes asszisztens-élményt:

- **Autonóm loop-ágensek** (AutoGPT, BabyAGI): egyetlen ágens cél-dekompozícióval. Nincs nevesített csapat, a memória sekély (RAG), a BabyAGI gyakorlatilag kutatási sandbox.
- **Fejlesztő-csapat szimulátorok** (MetaGPT, ChatDev, OpenHands): kód-generálásra hangolva. A "szoftvercég" metafora kívül a kódoláson nem hordoz át, nincs cross-session memória.
- **Könyvtárak és keretrendszerek** (LangGraph, CrewAI, AutoGen, SmolAgents): erős építőkockák, de neked kell összerakni a memóriát, az ütemezőt, a chat-interfészt és a feladatkezelést. Hetekig tartó mérnöki munka mire személyes asszisztens lesz belőle.
- **Chat-frontend-ek** (Open WebUI, Khoj): kiváló RAG és kereshető tudásbázis, de nincs nevesített specialista-flotta, nincs natív Kanban, nincs ágensek közötti üzenetváltás.

Aki *ma, telepítés után* akar egy tartós, proaktív, többdoménes személyi csapatot, annak nincs egyetlen out-of-the-box nyílt forrású megfelelője.

### Marveen helye

Marveen privát, helyben futó (local-first) személyi AI-orkesztráció Claude Code-ra építve. Egy nevesített orchestrator (Cuzcoo) koordinál szerep-specifikus specialistákat (Kronk = backend, Chicha = marketing, Yzma = pénzügy, Mata/Tipo = videó), REST-alapú ágens-közi üzenetbuszon, háromszintű SQLite memóriával, natív Kanban-táblával, cron-alapú heartbeat ütemezővel, ágensenkénti Telegram-botokkal és helyi admin dashboarddal.

A különbség nem egyetlen feature, hanem a kombináció: ennek a hat dolognak együtt nincs nyílt forrású megfelelője.

### Hat pillér

1. **Rétegzett, ember-olvasható memória.** Hot/Warm/Cold SQLite tier-ek kulcsszavas kereséssel. A legközelebbi rokon a Letta (Core/Recall/Archival), de az LLM-kontextus + vektor fekete-doboz. Marveennél a memória explicit, kategorizált, kézzel olvasható és szerkeszthető sorok -- nem egy embedding-felhő amiben reménykedsz hogy a releváns darab előjön.

2. **Nevesített specialista-flotta saját identitással.** Minden ágensnek külön szerepe, perszonája és saját Telegram-botja van, ami session-ökön át megmarad. A CrewAI és a MetaGPT is ad szerep-alapú ágenseket, de egyik sem szállít tartós per-ágens chat-identitást -- náluk a szerep egy futás idejű konfiguráció, nem egy állandó "kolléga".

3. **Natív Kanban + automatikus ágens-dispatch.** Kártyát rendelsz egy ágenshez, és a hozzárendelés automatikusan felébreszti és átadja neki a feladatot. Erre nincs nyílt forrású megfelelő -- egyetlen keretrendszer sem köti össze a natív Kanbant az assignee-alapú automatikus ágens-indítással.

4. **Proaktív heartbeat, nem reaktív prompt.** Cron-alapú háttérellenőrzés ami magától ír Telegramon ha valami fontos (naptár, email, lejáró feladat). A Khoj-nak van ütemezése, az AutoGPT-nek automatizációja, de egyiknek sincs per-ágens Telegram-botja proaktív push-sal. Marveen nem várja meg hogy kérdezz.

5. **Önfejlesztő skill-generálás.** Komplex feladat után az ágens automatikusan SKILL.md fájlt ír a megtanult workflow-ból, ami újrafelhasználható. A SmolAgents tud tool-t megosztani a HuggingFace Hubon, de egyetlen keretrendszer sem generál újrahasznosítható skill-fájlt befejezett session-ökből.

6. **Local-first, nulla felhő-függés.** Egytenants, helyben futó, privát. A Khoj és az Open WebUI is self-hostolható, de mindkettő úgy van tervezve hogy felhőben is fusson. Marveen természeténél fogva egyfelhasználós és helyi -- az adat nem hagyja el a gépet.

### Kinek való

- Akinek tartós, többdoménes (kód + pénzügy + marketing + ütemezés) személyi asszisztens kell, nem egy egyszer-használatos autonóm loop.
- Akinek számít az adat-szuverenitás: minden helyben marad, nincs felhő-tenant.
- Akinek elég egy kész rendszer, nem akar heteket egy keretrendszer összeszerelésével tölteni.

### Kinek nem

- Aki több-tenants, felhős SaaS ágens-platformot akar (-> AutoGPT Platform, LangGraph Platform).
- Akinek csak kód-generálás kell egy sandboxban (-> OpenHands, MetaGPT).
- Aki egy könyvtárat akar amire saját egyedi topológiát épít (-> LangGraph, CrewAI).

---

## EN

### One-line position

Marveen is not a framework you *build* an agent with -- it is a ready-to-run AI team that *lives* on your machine: named specialists, durable memory, its own Kanban board, and proactive scheduling.

### The category gap

In 2026 the open-source AI agent space splits into four camps, none of which delivers a complete personal-assistant experience:

- **Autonomous loop agents** (AutoGPT, BabyAGI): a single agent doing goal decomposition. No named team, shallow memory (RAG), and BabyAGI is effectively a research sandbox.
- **Dev-team simulators** (MetaGPT, ChatDev, OpenHands): tuned for code generation. The "software company" metaphor does not carry beyond coding, and there is no cross-session memory.
- **Libraries and frameworks** (LangGraph, CrewAI, AutoGen, SmolAgents): strong building blocks, but you assemble the memory, scheduler, chat interface, and task tracking yourself. Weeks of engineering before it becomes a personal assistant.
- **Chat front-ends** (Open WebUI, Khoj): excellent RAG and searchable knowledge, but no named specialist fleet, no native Kanban, no inter-agent messaging.

Anyone who wants a durable, proactive, multi-domain personal team *today, right after install* has no single out-of-the-box open-source equivalent.

### Where Marveen sits

Marveen is a private, local-first personal AI orchestration system built on Claude Code. A named orchestrator (Cuzcoo) coordinates role-specific specialists (Kronk = backend, Chicha = marketing, Yzma = finance, Mata/Tipo = video) over a REST-based inter-agent message bus, with a three-tier SQLite memory, a native Kanban board, a cron-based heartbeat scheduler, per-agent Telegram bots, and a local admin dashboard.

The differentiator is not any single feature -- it is the combination. No open-source project ships all six together.

### Six pillars

1. **Tiered, human-readable memory.** Hot/Warm/Cold SQLite tiers with keyword search. The closest relative is Letta (Core/Recall/Archival), but that is LLM context plus a vector black box. Marveen's memory is explicit, categorized, human-readable and editable rows -- not an embedding cloud you hope surfaces the right chunk.

2. **Named specialist fleet with persistent identity.** Each agent has a distinct role, persona, and its own Telegram bot that persists across sessions. CrewAI and MetaGPT also offer role-based agents, but neither ships a durable per-agent chat identity -- there the role is a runtime config, not a standing "colleague."

3. **Native Kanban + automatic agent dispatch.** Assign a card to an agent and the assignment automatically wakes it and hands over the task. No open-source equivalent exists -- no framework combines a native Kanban with assignee-driven automatic agent dispatch.

4. **Proactive heartbeat, not reactive prompting.** A cron-based background check that messages you on Telegram on its own when something matters (calendar, email, an expiring task). Khoj has scheduling and AutoGPT has automations, but neither has per-agent Telegram bots with proactive push. Marveen does not wait for you to ask.

5. **Self-improving skill generation.** After a complex task the agent automatically writes a reusable SKILL.md from the workflow it just learned. SmolAgents can share a tool to the HuggingFace Hub, but no framework auto-generates reusable skill files from completed sessions.

6. **Local-first, zero cloud dependency.** Single-tenant, locally hosted, private. Khoj and Open WebUI can also self-host, but both are designed to run in the cloud too. Marveen is inherently single-user and local -- the data never leaves the machine.

### Who it is for

- Anyone who needs a durable, multi-domain (code + finance + marketing + scheduling) personal assistant, not a one-shot autonomous loop.
- Anyone who cares about data sovereignty: everything stays local, no cloud tenant.
- Anyone who wants a finished system rather than weeks spent assembling a framework.

### Who it is not for

- Teams wanting a multi-tenant cloud SaaS agent platform (-> AutoGPT Platform, LangGraph Platform).
- Users who only need sandboxed code generation (-> OpenHands, MetaGPT).
- Builders who want a library to construct a bespoke topology on (-> LangGraph, CrewAI).

---

*Built on COMPARISON.md (data collected June 2026). HU is the source of truth; EN is a mirror translation.*
