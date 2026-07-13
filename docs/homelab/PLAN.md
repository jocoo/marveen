# HomeLab Control Plane -- Plan (kanban #193)

Status: PLAN ONLY. Nothing in this doc is deployed. Build starts only after
Jocoo signs off and explicitly says to go.

Revision 2 (2026-07-14): synthesizes Yzma's data-source review (credit/
subscription monitoring feasibility) and Chicha's UX review (daily-use
layout) into the original stack decision. Superseded per-reviewer sections
have been folded in below rather than kept as separate addenda.

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

## Services & Credits (feasibility-checked, per Yzma + Chicha)

Both reviews independently checked whether a live credit gauge is buildable
against each provider's actual API surface before designing anything, and
landed on the same conclusion: **no provider exposes a real-time balance
API today.** Design for graceful degradation, not a faked live number.

**Anthropic (Claude API console spend)**
- Admin `usage_report` / `cost_report` endpoints exist (~5 min lag on spend
  data), but there is **no credit-balance endpoint** -- an org-level Admin
  API key can show *month-to-date spend*, not remaining credit.
- This only covers **API-console usage**. The **Claude Max/Pro
  subscription** has no billing API at all.
- Buildable now: a `customapi` widget on the cost-report endpoint, labelled
  clearly as *API spend*, not *credit remaining* and not *subscription
  state*.
- Requires generating and storing an org-level Admin API key -- treat it as
  a secret exactly like `store/.dashboard-token` (env var / secrets file),
  never plain YAML in the Homepage config.

**Replicate**
- No public balance or spend-limit endpoint. Balance is only visible on
  `replicate.com/account/billing` after login. Session-scraping a logged-in
  cookie was considered and rejected -- fragile and a ToS risk for a
  homelab convenience feature.
- Realistic tile: **link-out to the billing page**, no live number. If
  Jocoo wants a number anyway, a manually-updated field ("last known
  balance: $X on DATE") is the only honest option until Replicate ships an
  API.

**Layout placement**: a compact **Services & Credits** strip in the top
info bar (favicon + one line each), separate from the project tiles below
it -- financial/subscription data reads differently from service-up-or-down
status, so it gets its own row rather than being mixed into project tiles.
Anthropic gets the near-live spend widget; Replicate (and Claude
Max/Pro subscription state, if tracked at all) gets a bookmark tile plus
optional manual field.

**Other providers, only if it becomes relevant later**: GitHub Actions
minutes has a real billing API (`/repos/{owner}/{repo}/actions/billing`) if
ever a bottleneck. Tailscale/domains are flat-fee -- no balance to track,
a renewal-date tile is enough if wanted at all.

## Proposed stack (sketch, not deployed)

```yaml
# docker-compose.yml -- homelab control plane
services:
  homepage:
    image: ghcr.io/gethomepage/homepage:latest
    container_name: homepage
    ports:
      - "127.0.0.1:3000:3000"   # Tailscale-only, see Access below
    volumes:
      - ./homepage-config:/app/config
      - ./homepage-icons:/app/public/icons
    restart: unless-stopped

  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    ports:
      - "127.0.0.1:9000:9000"   # Tailscale-only, see Access below
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer-data:/data
    restart: unless-stopped

volumes:
  portainer-data:
```

## Homepage config sketch (`homepage-config/services.yaml`)

```yaml
- Attention / active dev:
    - CrochetTool:
        href: http://<tailscale-ip>:8420
        description: AI pattern-designer tool (dev)
        docs: /docs/crochet-pattern-tool
        widget:
          type: docker
          container: crochettool   # status dot
        # + deep link to this stack's Portainer view and its logs view

- Running services:
    - Marveen Dashboard:
        href: http://<tailscale-ip>:3420
        description: Agent fleet, kanban, memory
        widget:
          type: customapi
          url: http://<tailscale-ip>:3420/api/health

    - Offsider:
        href: http://<tailscale-ip>:<port>
        description: SMB fleet product
        docs: /docs/smb-offsider

- Occasional / hardware:
    - Hame Remote:
        href: http://<tailscale-ip>:<port>
        description: Speaker/amp remote control unit
        # no docs link yet -- stub not written, see Next steps

- Control & billing:
    - Portainer:
        href: http://<tailscale-ip>:9000
        description: Full container/stack control
    - Anthropic Console:
        href: https://console.anthropic.com/settings/billing
        description: MTD API spend (see Services & Credits widget above)
    - Replicate Billing:
        href: https://replicate.com/account/billing
        description: Balance -- no live number available, link-out only
```

Each project tile carries a status dot, its docs link (where one exists),
and a deep link into its own Portainer stack + logs -- not one generic
"Portainer" bookmark you then navigate inside.

## Access / security

- Both services bind to `127.0.0.1` only in the compose file above; the
  only external path in is Tailscale, same pattern already used for other
  homelab-style services (see [[reference-tailscale-same-host-hairpin]]).
  No port gets exposed on `0.0.0.0`.
- Portainer gets its own login (set on first run) -- separate from any
  Marveen dashboard token.
- `docker.sock` mount is the one real risk in this design: whoever can
  reach Portainer can control every container on the host, including
  Marveen's own. Mitigate by keeping Portainer reachable only over
  Tailscale and behind its own auth, never on a LAN-wide or public bind.
- The Anthropic Admin API key (if Jocoo opts into the spend widget) is a
  second secret to manage with the same care -- never inline in the
  Homepage YAML, same handling as `store/.dashboard-token`.

## Open questions for Jocoo

1. Which host runs this? (Same box as Marveen, or a separate machine?)
2. Confirm the project list (Marveen, CrochetTool, Offsider, Hame) --
   anything missing, or anything that shouldn't be listed yet?
3. OK with Portainer holding `docker.sock` given the mitigation above, or
   do you want it scoped further (e.g. a docker-socket-proxy in front of
   it, read-only where possible)?
4. Credit tracking, which number do you actually want on screen: the
   month-to-date **API-console spend** (buildable now via the Anthropic
   cost API, near-live), or the **Claude Max/Pro subscription** state (no
   API exists -- would be a manual "last known" field plus a link out)?
   Replicate is link-out plus optional manual field either way.
5. If you want the Anthropic spend widget: are you willing to generate an
   org-level Admin API key for it, understanding it will be stored as a
   secret (like `store/.dashboard-token`), not in plain YAML?

## Next steps (after go-ahead only)

1. Stand up the compose stack on the chosen host.
2. Write `homepage-config/services.yaml` for real, with real ports/URLs
   and per-project Portainer deep links.
3. Point Homepage docs links at this repo's `docs/<project>/` folders.
4. Write a minimal Hame docs stub before launch so its tile isn't a dead
   link (or leave the docs field off entirely, per the sketch above).
5. If Q4/Q5 above land on "yes, build the Anthropic spend widget":
   generate the Admin API key, store it as a secret, wire the
   `customapi` widget to the cost-report endpoint.
6. Smoke test: start/stop one container (e.g. CrochetTool) via Portainer,
   confirm Homepage's status dot reflects it.
7. Screenshot + Telegram sign-off before calling it done.
