# Marveen vs Open-Source AI Agent Landscape (June 2026)

Marveen is a private, local-first personal AI orchestration system built on Claude Code (Anthropic API). It runs a named orchestrator agent ("Cuzcoo") alongside role-specific specialist workers (Kronk=backend, Chicha=marketing, Yzma=finance, Mata/Tipo=video), connected via a REST-based inter-agent message bus, a three-tier SQLite memory system, a native Kanban board, cron-based heartbeat scheduler, per-agent Telegram bots, and a local admin dashboard. This comparison maps Marveen against the major open-source personal AI assistant and multi-agent frameworks to identify where it is differentiated, where it converges with the field, and which projects represent the closest functional overlap.

---

## Comparison Matrix

| Project | Memory model | Multi-agent topology | Persistence layer | Interface | Hosting model | License | Maturity | Extensibility | Cron/schedule | Kanban / task tracking |
|---|---|---|---|---|---|---|---|---|---|---|
| **Marveen** (baseline) | Hot/Warm/Cold SQLite tiers; keyword search; daily log | Orchestrator (Cuzcoo) + named specialists (Kronk, Chicha, Yzma, Mata, Tipo) | SQLite (memory + kanban + messages) | Telegram (per-agent bots) + web dashboard (localhost:3420) | Local-first, single-user | Private | Internal project | SKILL.md auto-generation; MCP; REST inter-agent API | Yes (native, cron-based heartbeat) | Yes (native, SQLite) |
| **Letta (MemGPT)** | Tiered: Core (in-context), Recall (searchable history), Archival (vector); agent self-edits memory via tool calls | Multi-agent supported; orchestrator + sub-agents via Letta network | PostgreSQL / SQLite + vector DB (pgvector, Chroma) | Python SDK, REST API, Letta ADE web UI, TypeScript SDK | Local or Letta Cloud | Apache-2.0 | ~23k stars; actively maintained | Tool plugins; MCP support; custom memory blocks | No native scheduling | No |
| **AutoGen 0.4 / Microsoft Agent Framework** | Per-session chat history; no native long-term memory | Orchestrator + workers; peer-to-peer conversation graphs | In-memory; pluggable (Redis, file) | Python/.NET API; AutoGen Studio web UI | Local or cloud | MIT | 50.4k stars (AutoGen); evolved into MS Agent Framework 1.0 (Apr 2026) | MCP; tool plugins; Semantic Kernel integration | No native | No |
| **AG2 (AutoGen fork)** | Per-session; limited cross-session | Orchestrator + workers; peer-to-peer | In-memory; pluggable | Python API | Local or cloud | MIT | ~4.7k stars; active (v0.12, Mar 2026) | Tool use; MCP; async-first (Beta API) | No native | No |
| **CrewAI** | Short-term (in-context) + long-term via embeddings + optional vector DB | Role-based Crews (sequential, hierarchical, parallel); Flows for event-driven | SQLite; vector DB (Chroma, Qdrant); file | Python API; CrewAI Studio web UI | Local or CrewAI Cloud | MIT | 54.2k stars; actively maintained | Custom tools; CrewAI Flows; integrations marketplace | Partial (via Flows, no native cron) | No |
| **LangGraph** | Short-term state per run + long-term via memory store (cross-session) | Single, hierarchical, supervisor, peer-to-peer (fully configurable as graph) | Checkpointers: SQLite, PostgreSQL, Redis; memory store | Python/JS library; LangGraph Studio; LangGraph Platform (cloud) | Local or LangGraph Platform (cloud) | MIT | ~36k stars; actively maintained | LangChain tools; MCP; custom graph nodes; human-in-the-loop | Yes (LangGraph Platform cron triggers) | No |
| **MetaGPT** | Per-agent + shared message pool; no cross-session persistence | Role-based SOP-driven (CEO, CTO, Engineer, QA, PdM); hierarchical | File system; SQLite | CLI; Python API | Local | MIT | ~68.5k stars; actively maintained | Custom roles; tool plugins; AFlow workflow | No native | No |
| **ChatDev (OpenBMB)** | Session-based shared message history | Simulated software company (CEO, CTO, Dev, QA, Designer) | File system | CLI; web visual canvas (v2.0, Jan 2026) | Local | Apache-2.0 | ~33.6k stars; v2.0 released Jan 2026 | Visual canvas (no-code); custom agent roles | No | No |
| **OpenHands (OpenDevin)** | Per-session trajectory; limited cross-session | Single coding agent (can spawn sub-agents for specific tasks) | Docker filesystem; local file system | Web UI; CLI | Local (Docker) or All-Hands Cloud | MIT | ~78k stars; actively maintained | GitHub/GitLab/CI integrations; runtime sandboxes; LLM-agnostic | No native | No |
| **SmolAgents (HuggingFace)** | No native persistent memory; per-run only | Basic: ManagedAgent delegation; no structured topology | In-memory; sandboxed code execution | Python library | Local or sandboxed cloud (E2B, Modal, Docker) | Apache-2.0 | ~26k stars; active (March 2026 commits) | HuggingFace Hub tool sharing; E2B/Modal sandboxes; multimodal | No | No |
| **AutoGPT** | RAG + vector DB (Pinecone, Chroma, Redis); file system; cross-run persistence | Single primary agent; task decomposition to sub-steps | Vector DB; file system | Web (visual Agent Builder); CLI; API | Local or AutoGPT Platform (cloud) | MIT | ~182k stars; platform-beta v0.6.53 (Mar 2026) | 50+ official plugins; workflow import (n8n, Make, Zapier); LLM-agnostic | Yes (scheduled agents, automations) | No |
| **BabyAGI** | Task queue (priority list); vector DB for result storage | Single agent; task creation + prioritization loop | In-memory; vector DB (optional) | CLI | Local | MIT | ~21k stars; archived Sept 2024; relaunched as research sandbox (Jan 2026 commits) | Minimal; experimental "self-building" | No | Task queue only (not kanban) |
| **Khoj** | Semantic search over docs + conversation history; PostgreSQL + pgvector | Single primary agent; user-built custom agents | PostgreSQL + pgvector; local file indexing | Web; Obsidian; Emacs; mobile; WhatsApp | Local (self-hosted) or khoj.dev cloud | AGPL-3.0 | ~34k stars; actively maintained (YC W24) | Obsidian/Emacs plugins; custom agent personas; SearxNG web search | Yes (automation scheduling) | No |
| **SuperAGI** | Vector DB (RAG); per-agent memory | Multiple agents with tool marketplace selection | PostgreSQL; vector DB | Web UI (full GUI); CLI (Docker) | Local (Docker) or cloud | MIT | ~17.3k stars; STALLED since late 2024 (company pivoted to commercial SaaS) | Tool marketplace | Yes (scheduled agents) | No |
| **AgentGPT** | No persistent memory; session only | Single agent; goal decomposition into sub-tasks | None (session-only) | Browser (no install) | Cloud-hosted (no self-host) | MIT | ~35.7k stars; ARCHIVED Jan 2026; read-only | Minimal | No | No |
| **Open WebUI** | Conversation history; RAG over docs (9 vector DB backends); per-user memory | Not truly multi-agent; multiple model instances; no specialized roles | Multiple vector DBs (Chroma, Qdrant, pgvector, etc.); SQLite for sessions | Web browser; OpenAI-compatible API | Local (Docker) or cloud | MIT | ~136k stars; actively maintained | Python pipelines; MCP servers; community extensions; RBAC | Automations (basic) | No |
| **Continue.dev** | Per-session context + `.continue/rules/` team config; no cross-session persistent memory | Single coding assistant; no multi-agent | File-based config; no memory DB | VS Code + JetBrains IDE extensions | Local (IDE plugin) | Apache-2.0 | ~26k stars; acquired by Cursor (active development) | MCP tools; custom tool definitions | No | No |
| **E2B** | None (sandbox execution context only) | Not an agent framework; infrastructure layer | Stateful Firecracker microVM sandbox (up to 24h) | Python/JS SDK; REST API | Cloud (AWS/GCP/Azure deployable) | Apache-2.0 | ~9k stars; actively maintained | Any Linux process; code interpreter SDK | No | No |

---

## Per-Project Notes

**Letta (MemGPT)** -- [github.com/letta-ai/letta](https://github.com/letta-ai/letta)
Best fit: building stateful agents where long-term memory is the core feature (customer service bots, research assistants that learn over time). Not a good fit: pre-packaged personal assistant with UI and scheduling out of the box; requires significant integration work for end-to-end personal automation.

**AutoGen 0.4 / Microsoft Agent Framework** -- [github.com/microsoft/autogen](https://github.com/microsoft/autogen)
Best fit: enterprise multi-agent pipelines with .NET or Python, conversation-driven task decomposition with human-in-the-loop checkpoints. Not a good fit: personal daily assistant use cases; it entered maintenance mode (AutoGen 0.4) and has been superseded by the broader Microsoft Agent Framework, creating API churn.

**AG2 (AutoGen fork)** -- [github.com/ag2ai/ag2](https://github.com/ag2ai/ag2)
Best fit: teams that depended on AutoGen 0.2 patterns and want continuity with the original creators; async-first agent workflows. Not a good fit: large community support (low star count relative to the original); no native personal assistant features.

**CrewAI** -- [github.com/crewAIInc/crewAI](https://github.com/crewAIInc/crewAI)
Best fit: structured multi-agent workflows with defined roles (research crew, content crew, sales crew); strong community and growing tool ecosystem. Not a good fit: persistent personal memory across weeks/months; no native cron or kanban; requires cloud or external vector DB for memory.

**LangGraph** -- [github.com/langchain-ai/langgraph](https://github.com/langchain-ai/langgraph)
Best fit: precise, graph-driven control flows where agent topology must be deterministic; production agent services needing durable execution and human-in-the-loop. Not a good fit: quick prototyping or personal daily assistant without significant engineering investment; no built-in Telegram interface, scheduler, or kanban.

**MetaGPT** -- [github.com/FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT)
Best fit: AI-driven software development pipelines where a team of specialized roles (PM, architect, dev, QA) collaborates through standard operating procedures. Not a good fit: personal daily assistant, non-software tasks, persistent long-term memory.

**ChatDev** -- [github.com/OpenBMB/ChatDev](https://github.com/OpenBMB/ChatDev)
Best fit: research and rapid prototyping of simulated software team workflows; v2.0's no-code canvas makes it accessible for non-developers to experiment. Not a good fit: production use, persistent memory, personal assistant features; the software-company metaphor limits applicability outside code generation.

**OpenHands (OpenDevin)** -- [github.com/OpenHands/OpenHands](https://github.com/OpenHands/OpenHands)
Best fit: autonomous code generation, bug fixing, and GitHub issue resolution in sandboxed Docker environments; strong CI/CD integration. Not a good fit: multi-domain personal assistant (finance, scheduling, marketing); no cross-session memory; single-agent architecture.

**SmolAgents (HuggingFace)** -- [github.com/huggingface/smolagents](https://github.com/huggingface/smolagents)
Best fit: lightweight code-first agent experiments; research prototypes that need to run on local or Hub-hosted models with minimal boilerplate; tool sharing via HuggingFace Hub. Not a good fit: production personal assistant with persistent memory, scheduling, or multi-agent specialization; no persistence layer at all.

**AutoGPT** -- [github.com/Significant-Gravitas/AutoGPT](https://github.com/Significant-Gravitas/AutoGPT)
Best fit: goal-driven autonomous agents with a visual builder and extensive plugin marketplace; scheduled automations; broad LLM support. Not a good fit: structured multi-agent teams with specialized roles; memory architecture is shallow (RAG, no tiered hot/warm/cold); single-agent by default despite the platform name.

**BabyAGI** -- [github.com/yoheinakajima/babyagi](https://github.com/yoheinakajima/babyagi)
Best fit: research sandbox for studying task-loop agent behavior; conceptual baseline for understanding early autonomous agent patterns. Not a good fit: any production or personal assistant use; officially described as a research tool; effectively unmaintained for practical applications.

**Khoj** -- [github.com/khoj-ai/khoj](https://github.com/khoj-ai/khoj)
Best fit: personal second-brain with semantic search over your own documents, notes, and web; strong Obsidian integration; basic automation scheduling. Not a good fit: multi-domain specialist agents (no named specialist workers); no native kanban; inter-agent messaging absent.

**SuperAGI** -- [github.com/TransformerOptimus/SuperAGI](https://github.com/TransformerOptimus/SuperAGI)
Best fit: historically one of the richer open-source agent platforms with a GUI and tool marketplace. Not a good fit: any new project in 2026; the OSS repo has been effectively abandoned since the company pivoted to a commercial sales tool SaaS; security vulnerabilities are unpatched.

**AgentGPT** -- [github.com/reworkd/AgentGPT](https://github.com/reworkd/AgentGPT)
Best fit: a quick demo to show stakeholders what an autonomous agent feels like in a browser without setup. Not a good fit: anything production; repo archived January 2026, no updates since November 2023, no persistent memory, cloud-only.

**Open WebUI** -- [github.com/open-webui/open-webui](https://github.com/open-webui/open-webui)
Best fit: ChatGPT-style self-hosted front-end for local or cloud LLMs (Ollama, OpenAI, Anthropic) with excellent RAG, RBAC, and community extensions; nearest thing to a polished self-hosted chat platform. Not a good fit: structured specialist multi-agent workflows, inter-agent messaging, native kanban, or cron-driven proactive behavior.

**Continue.dev** -- [github.com/continuedev/continue](https://github.com/continuedev/continue)
Best fit: AI pair-programming assistant embedded in VS Code or JetBrains; MCP tool integration; local model support; team-shared coding rules. Not a good fit: personal assistant outside the IDE; no persistent memory, no agents beyond code context, no scheduling.

**E2B** -- [github.com/e2b-dev/E2B](https://github.com/e2b-dev/E2B)
Best fit: secure sandboxed execution infrastructure for AI-generated code; a dependency of SmolAgents, OpenHands, and similar frameworks rather than a standalone assistant. Not a good fit: direct comparison with Marveen; E2B is infrastructure, not an agent framework or personal assistant.

---

## Key Differentiation Summary

Marveen's combination of features has no single open-source equivalent:

| Feature cluster | Closest OSS match | Gap |
|---|---|---|
| Tiered memory (hot/warm/cold) with keyword search | Letta (Core/Recall/Archival) | Letta's tiers are LLM context + vector search; Marveen uses SQLite keyword search with explicit human-readable categories |
| Named specialist worker fleet | CrewAI, MetaGPT | Neither ships with a persistent per-agent Telegram bot; no "identity" per agent across sessions |
| Native Kanban + inter-agent task dispatch | None | No OSS framework combines native kanban with automated agent dispatch on card assignment |
| Cron heartbeat with chat-platform proactivity | Khoj (partial), AutoGPT (partial) | Khoj has scheduling; AutoGPT has automations; neither has per-agent Telegram bots with proactive push |
| Skill auto-generation (SKILL.md) | SmolAgents Hub sharing (partial) | SmolAgents can share tools to HuggingFace Hub; no framework auto-generates reusable skill files from completed sessions |
| Local-first, zero cloud dependency | Khoj, Open WebUI | Both can self-host but are designed to also run cloud; Marveen is inherently single-tenant local |

---

*Data collected June 2026. Star counts are approximate at time of research. All links point to primary GitHub repositories unless otherwise noted.*
