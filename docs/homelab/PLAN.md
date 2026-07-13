# HomeLab Control Plane -- Plan (kanban #193)

Status: BUILD IN PROGRESS. Jocoo answered all 5 open questions and gave the
explicit go-ahead (2026-07-13 evening, relayed via Cuzcoo 2026-07-14). See
Revision 3 below for the answers and how they changed the design.

Revision 2 (2026-07-14): synthesizes Yzma's data-source review (credit/
subscription monitoring feasibility) and Chicha's UX review (daily-use
layout) into the original stack decision. Superseded per-reviewer sections
have been folded in below rather than kept as separate addenda.

## Revision 3 (2026-07-14): Jocoo's answers, build starts

Jocoo answered all 5 open questions from Revision 2:

1. **Host**: runs on the Marveen machine, but must be designed portable --
   no host-bound config baked into committed files. All host-specific
   values (Tailscale IP/hostname, ports) live in a gitignored `.env`; the
   committed compose file and Homepage config reference them via variables,
   never hardcoded. Moving to a new host is: copy the repo, write a new
   `.env`, `docker compose up`.
2. **Project list**: confirmed, plus add **Scouts** (a separate
   inventory-management solution is being built for it, see
   [[project-scouts]] -- comes later, but the tile slot exists now so
   nothing needs re-wiring when it lands).
3. **docker-socket-proxy**: yes, goes in front of Portainer. Portainer
   never touches `/var/run/docker.sock` directly -- only the proxy
   container does (read-only mount), and it exposes a filtered subset of
   the Docker API (containers, images, networks, volumes; POST enabled for
   start/stop/restart) over an internal-only Docker network. Homepage's
   status-dot widget also routes through the same proxy instead of getting
   its own docker.sock mount -- one socket-holding container instead of
   two.
4. **Credit/subscription monitoring -- re-scoped**: Jocoo's real concern
   isn't org-level month-to-date spend or Claude Max/Pro subscription
   state. It's **prepaid/topup-style accounts that can run out and block
   work**: Replicate's account balance, and the Claude/Anthropic API key
   that's built into CrochetTool specifically (a separate pay-as-you-go
   key, not part of the Max/Pro subscription). Those are the ones that can
   actually stop him mid-task if they run dry, so those get the visibility
   budget, not the org-wide number.

   Follow-up research done: **the Admin Usage API
   (`/v1/organizations/usage_report/messages`) supports `api_key_ids[]` as
   a filter/group-by dimension** -- so CrochetTool's specific Anthropic key
   can be isolated from the rest of the org's spend, using the same
   org-level Admin API key filtered down to that one `api_key_id`. This
   changes the buildable widget from "org MTD spend" to "CrochetTool key's
   own MTD spend" -- more relevant to the actual question, but it is
   **still spend, not remaining balance** -- there is no balance/credit-
   endpoint for any key, scoped or not. A rising spend number tells you
   *how fast* the key is burning, not *how much runway is left*, unless
   Jocoo also tells the widget how much was loaded onto that key. Given
   that, the honest deliverable is: CrochetTool-key spend (near-live, via
   Admin API filtered by its `api_key_id`) **plus** a manual "loaded: $X on
   DATE" field next to it, so the two together approximate runway. Same
   graceful-degradation shape as Replicate (which still has zero balance
   API of any kind -- link-out + manual field, unchanged from Revision 2).
5. **Admin API key**: yes, Jocoo will generate one when needed and wants
   instructions at that point. Not required to start the build -- the
   compose stack, Homepage, Portainer, and docker-socket-proxy don't depend
   on it. It only gates the CrochetTool-key spend widget in Services &
   Credits, which can ship after the base stack is up.

## Context

Jocoo wants one place, independent of Marveen, from which he can see and
control his self-hosted projects (CrochetTool, Offsider, Hame, and whatever
comes next): what's running, docs for each, start/stop without SSH-ing in,
plus (expanded scope, 2026-07-13 evening) the current state of his AI
service subscriptions/credits (Claude, Replicate, ...).

## Decision (ADR): Homepage + Portainer

**Context**: need a dashboard + actual container control, not just links.

**Options considered**:
- **Homepage** (gethomepage.dev) alone -- config-as-code YAML dashboard,
  service tiles, live status widgets. No native start/stop of containers;
  it only displays.
- **Homarr** -- single-tool alternative, does have native start/stop built
  in, but that means Homarr itself needs direct `docker.sock` access baked
  into the one UI users click around in. Larger attack surface for a tool
  that's also your public-facing tile board.
- **Homepage + Portainer** -- Homepage stays a pure display/bookmark layer,
  Portainer (mature, widely used, dedicated to this one job) owns the
  actual container/stack lifecycle (start, stop, logs, redeploy).

**Choice**: Homepage + Portainer. Jocoo confirmed 2026-07-13. Chicha's UX
review (below) does not relitigate this -- the gaps found are in layout and
the credit requirement, not the stack choice.

**Consequence**: two containers to run instead of one, but the
docker-socket-holding component (Portainer) is a dedicated, well-audited
tool instead of a general dashboard doing double duty. Homepage links out
to Portainer for anything that needs to touch a container.

## Layout (daily-use hierarchy, per Chicha's review)

A board you open every morning needs a top-to-bottom read: is anything
down / what needs me today, first; project links, second; billing, third.
A flat one-group bookmark board doesn't give that, so tiles are grouped by
*state / attention*, not lumped into one bucket:

```
[ top info bar ]  date | host CPU/RAM/disk | Services & Credits (compact row)

Attention / active dev
  CrochetTool   [status dot] open | docs | Portainer stack | logs

Running services
  Marveen       [status dot] open | docs | Portainer stack | logs
  Offsider      [status dot] open | docs | Portainer stack | logs

Occasional / hardware
  Hame          [status dot] open | Portainer stack   (docs link: see note)

Control & billing
  Portainer (full)  |  Anthropic console  |  Replicate billing
```

Design points behind this:
- **Status dot per tile**, not a numeric "3/4 up" aggregate -- at 4-5 tiles
  a red dot is instantly scannable, an aggregate number isn't faster to read.
- **Deep link to each project's specific Portainer stack + its logs**,
  instead of one generic "Portainer" bookmark you then navigate inside.
  That was the whole point of the Context above (stop re-remembering which
  stack is which).
- **Host resources widget** (CPU/RAM/disk, Homepage built-in) in the top bar
  answers "is the box itself OK" before you even look at a tile.
- **Hame docs**: no doc exists yet (`docs/hame-remote` was a placeholder
  with nothing behind it). Per "no dead links on launch," the docs link is
  dropped from Hame's tile until a stub is written -- see Next steps.

## Services & Credits (re-scoped per Jocoo's answer 4, Revision 3)

Original feasibility check (Yzma + Chicha, Revision 2) still stands: **no
provider exposes a real-time balance API today.** What changed is *which*
number matters. Jocoo's actual concern is prepaid/topup accounts running
dry mid-task, not org MTD spend or Max/Pro state -- so the widget budget
goes to Replicate and CrochetTool's own Anthropic key, not the org-wide
number.

**CrochetTool's Anthropic API key (its own pay-as-you-go key, separate from
Jocoo's Max/Pro subscription)**
- Confirmed buildable: the Admin Usage API
  (`/v1/organizations/usage_report/messages`) accepts `api_key_ids[]` as a
  filter -- so CrochetTool's key's spend can be isolated from the rest of
  the org, using the org-level Admin API key filtered to that one
  `api_key_id`. (Retrieve the ID once via the List API Keys endpoint.)
- Still **spend, not balance** -- there is no credit-remaining endpoint for
  any key, org-wide or scoped. Spend rising tells you burn rate, not
  runway.
- Buildable widget: CrochetTool-key MTD spend (near-live, ~5 min lag) +
  a manual "loaded: $X on DATE" field next to it, so the two together
  approximate remaining runway. Label clearly as *spend*, not *balance*.
- Requires the org-level Admin API key (Jocoo's answer 5: generate when
  needed). Store as a secret exactly like `store/.dashboard-token` --
  never inline in the Homepage YAML.

**Replicate** -- unchanged from Revision 2: no public balance or
spend-limit endpoint at all. Link-out to `replicate.com/account/billing`
plus an optional manual "last known balance: $X on DATE" field.

**Claude Max/Pro subscription state** -- dropped from the widget scope per
Jocoo's answer 4 (not what he's worried about; no billing API exists for
it anyway). Anthropic Console stays as a link-out tile if wanted, no
number attached.

**Layout placement**: unchanged -- a compact **Services & Credits** strip
in the top info bar, separate from project tiles (financial data reads
differently from service-up/down status).

## Portable stack (deployed at `homelab/` in this repo)

Design goal from Jocoo's answer 1: runs on the Marveen machine today, but
nothing in the committed files is host-bound. Host-specific values
(Tailscale IP/hostname, port overrides) live in a gitignored `.env`; the
compose file and Homepage config read them via variables. Moving host =
copy the repo + write a new `.env` + `docker compose up`.

```yaml
# homelab/docker-compose.yml
services:
  docker-socket-proxy:
    image: tecnativa/docker-socket-proxy:latest
    container_name: homelab-docker-socket-proxy
    environment:
      CONTAINERS: 1
      IMAGES: 1
      NETWORKS: 1
      VOLUMES: 1
      INFO: 1
      PING: 1
      VERSION: 1
      POST: 1   # required for Portainer start/stop/restart
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks: [homelab-internal]
    restart: unless-stopped

  portainer:
    image: portainer/portainer-ce:latest
    container_name: homelab-portainer
    command: ["-H", "tcp://docker-socket-proxy:2375"]
    ports:
      - "127.0.0.1:${PORTAINER_PORT:-9000}:9000"
    volumes: [portainer-data:/data]
    networks: [homelab-internal]
    depends_on: [docker-socket-proxy]
    restart: unless-stopped

  homepage:
    image: ghcr.io/gethomepage/homepage:latest
    container_name: homelab-homepage
    ports:
      - "127.0.0.1:${HOMEPAGE_PORT:-3000}:3000"
    volumes:
      - ./homepage-config:/app/config
      - ./homepage-icons:/app/public/icons
    networks: [homelab-internal]
    depends_on: [docker-socket-proxy]
    restart: unless-stopped

networks:
  homelab-internal:
    driver: bridge

volumes:
  portainer-data:
```

**Docker-socket-proxy in front of Portainer (Jocoo's answer 3)**: neither
Portainer nor Homepage mounts `/var/run/docker.sock` directly -- only the
proxy container does, read-only, and it exposes a filtered Docker API
(containers/images/networks/volumes, `POST` enabled for start/stop/restart)
over an internal-only Docker network with no host port published.
Homepage's status-dot widget also points at the proxy (`homelab-docker-
socket-proxy:2375`) instead of getting its own socket mount -- one
socket-holding container in the whole stack, not two or three.

Host-specific values go in `homelab/.env` (gitignored; `.env.example`
checked in as the template): `TAILSCALE_HOST`, `HOMEPAGE_PORT`,
`PORTAINER_PORT`. `services.yaml` references them via Homepage's
`{{HOMEPAGE_VAR_*}}` substitution, never as literal IPs.

## Homepage config (`homelab/homepage-config/services.yaml`)

```yaml
- Attention / active dev:
    - CrochetTool:
        href: http://{{HOMEPAGE_VAR_TAILSCALE_HOST}}:8420
        description: AI pattern-designer tool (dev)
        docs: /docs/crochet-pattern-tool
        widget: {type: docker, server: homelab-proxy, container: crochet-tool-crochet-tool-1}
        # + deep link to this stack's Portainer view and its logs view

- Running services:
    - Marveen Dashboard:
        href: http://{{HOMEPAGE_VAR_TAILSCALE_HOST}}:3420
        description: Agent fleet, kanban, memory
        widget: {type: customapi, url: "http://{{HOMEPAGE_VAR_TAILSCALE_HOST}}:3420/api/health"}

    - Offsider:
        href: http://{{HOMEPAGE_VAR_TAILSCALE_HOST}}:<port>
        description: SMB fleet product
        docs: /docs/smb-offsider
        # not yet dockerized -- no status-dot widget or Portainer link until it is

    - Scouts:
        href: "#"
        description: Northern Beaches Cairns QLD -- inventory-management solution in progress
        docs: /docs/scouts
        # placeholder tile only; nothing running yet, see [[project-scouts]]

- Occasional / hardware:
    - Hame Remote:
        href: http://{{HOMEPAGE_VAR_TAILSCALE_HOST}}:<port>
        description: Speaker/amp remote control unit
        # no docs link yet -- stub not written, see Next steps

- Control & billing:
    - Portainer:
        href: http://{{HOMEPAGE_VAR_TAILSCALE_HOST}}:{{HOMEPAGE_VAR_PORTAINER_PORT}}
        description: Full container/stack control
    - CrochetTool Anthropic key spend:
        widget: {type: customapi, url: "https://api.anthropic.com/v1/organizations/usage_report/messages?api_key_ids[]=<key-id>&bucket_width=1d"}
        description: "MTD spend for CrochetTool's own key (not balance -- see Services & Credits)"
    - Replicate Billing:
        href: https://replicate.com/account/billing
        description: Balance -- no live number available, link-out only
```

Each project tile carries a status dot (where dockerized), its docs link
(where one exists), and a deep link into its own Portainer stack + logs --
not one generic "Portainer" bookmark you then navigate inside.

## Access / security

- Homepage and Portainer bind to `127.0.0.1` only; the only external path
  in is Tailscale, same pattern already used for other homelab-style
  services (see [[reference-tailscale-same-host-hairpin]]). No port gets
  exposed on `0.0.0.0`.
- Portainer gets its own login (set on first run) -- separate from any
  Marveen dashboard token.
- `docker.sock` is mounted read-only into exactly one container
  (docker-socket-proxy); Portainer and Homepage reach it only through the
  proxy's filtered API on the internal Docker network. Whoever reaches
  Portainer can still start/stop containers (including Marveen's own) --
  that's the point of Portainer -- but they can't do anything the proxy's
  env-var allowlist doesn't expose (no EXEC by default, no swarm/service
  endpoints).
- The Anthropic Admin API key (once generated per answer 5) is a secret
  managed with the same care as `store/.dashboard-token` -- env var /
  secrets file, never inline in the Homepage YAML.

## Next steps

1. ~~Stand up the compose stack on the chosen host.~~ -- done, see below.
2. ~~Write `homepage-config/services.yaml` for real~~ -- done with
   placeholders for ports not yet confirmed (Offsider, Hame).
3. Point Homepage docs links at this repo's `docs/<project>/` folders --
   done for the projects with existing docs.
4. Write a minimal Hame docs stub before launch so its tile isn't a dead
   link (or leave the docs field off entirely) -- still open.
5. Generate the Anthropic Admin API key when Jocoo is ready (answer 5) --
   not blocking; the base stack doesn't need it.
6. Smoke test: start/stop CrochetTool via Portainer, confirm Homepage's
   status dot reflects it.
7. Screenshot + Telegram sign-off before calling it done.
