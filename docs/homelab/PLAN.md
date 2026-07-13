# HomeLab Control Plane -- Plan (kanban #1491e6ad)

Status: PLAN ONLY. Nothing in this doc is deployed. Build starts only after
Jocoo signs off and explicitly says to go.

## Context

Jocoo wants one place, independent of Marveen, from which he can see and
control his self-hosted projects (CrochetTool, Offsider, Hame, and whatever
comes next): what's running, docs for each, and start/stop without SSH-ing
in and remembering which `docker-compose.yml` lives where.

## Decision (ADR)

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

**Choice**: Homepage + Portainer. Jocoo confirmed 2026-07-13.

**Consequence**: two containers to run instead of one, but the
docker-socket-holding component (Portainer) is a dedicated, well-audited
tool instead of a general dashboard doing double duty. Homepage links out
to Portainer for anything that needs to touch a container.

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
- HomeLab:
    - Marveen Dashboard:
        href: http://<tailscale-ip>:3420
        description: Agent fleet, kanban, memory
        widget:
          type: customapi
          url: http://<tailscale-ip>:3420/api/health

    - CrochetTool:
        href: http://<tailscale-ip>:8420
        description: AI pattern-designer tool (dev)
        docs: /docs/crochet-pattern-tool

    - Offsider:
        href: http://<tailscale-ip>:<port>
        description: SMB fleet product
        docs: /docs/smb-offsider

    - Hame Remote:
        href: http://<tailscale-ip>:<port>
        description: Speaker/amp remote control unit
        docs: /docs/hame-remote  # not yet written, placeholder

- Control:
    - Portainer:
        href: http://<tailscale-ip>:9000
        description: Start/stop/logs for every stack above
```

Each project tile is a bookmark + optional status widget; the "start this
container" action lives one click away in Portainer, not duplicated in
Homepage.

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

## Open questions for Jocoo

1. Which host runs this? (Same box as Marveen, or a separate machine?)
2. Confirm the initial project list above (Marveen, CrochetTool, Offsider,
   Hame) -- anything missing or that shouldn't be listed yet?
3. OK with Portainer holding `docker.sock` given the mitigation above, or
   do you want it scoped further (e.g. a docker-socket-proxy in front of
   it, read-only where possible)?

## Next steps (after go-ahead only)

1. Stand up the compose stack on the chosen host.
2. Write `homepage-config/services.yaml` for real, with real ports/URLs.
3. Point Homepage docs links at this repo's `docs/<project>/` folders.
4. Smoke test: start/stop one container (e.g. CrochetTool) via Portainer,
   confirm Homepage's status widget reflects it.
5. Screenshot + Telegram sign-off before calling it done.
