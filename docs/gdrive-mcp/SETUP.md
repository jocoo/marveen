# Google Drive MCP — fleet-wide read-only binding (kanban #216)

Goal: every fleet agent (not just Cuzcoo) can list and read files from Jocoo's
Google Drive. Read-only. Triggered by #215 (ITSM/ITIL file lookup blocked on no
Drive access).

## What was already there

The `google-drive` MCP server is **already registered** in the global
`~/.claude.json` (`mcpServers.google-drive`), package
`@piotr-agier/google-drive-mcp` (stdio, `npx -y`). All interactive fleet agents
read this file — that is where gmail / google-calendar / github / filesystem MCP
servers come from too, so the binding is inherently fleet-wide. It simply never
connected because it had **no OAuth credentials**, so its tools never registered
(that is why no agent has `mcp__google-drive__*` today).

So this task is **not** "install a server" — it is "give the already-registered
server credentials + a one-time login + a restart".

## Package facts (v2.5.0)

- OAuth client type: **Desktop application** (recommended; loopback redirect,
  client_id only, secret optional).
- Credential resolution priority: `GOOGLE_DRIVE_OAUTH_CREDENTIALS` env →
  `~/.config/google-drive-mcp/gcp-oauth.keys.json` (XDG) → project root.
- Token store: `~/.config/google-drive-mcp/tokens.json` (0600, atomic writes,
  auto-refresh).
- Scope override: `GOOGLE_DRIVE_MCP_SCOPES` (aliases: `drive.readonly`,
  `drive.file`, `documents`, `spreadsheets`, `presentations`, ...).
- Auth command: `npx @piotr-agier/google-drive-mcp auth` (opens browser, does
  the loopback flow, writes tokens.json). Also happens automatically on first
  MCP client run.
- **7-day gotcha:** an OAuth *consent screen* left in **Testing** status issues
  refresh tokens that Google expires after 7 days. For an always-on fleet
  integration the consent screen MUST be **Published / In production**, or Drive
  access silently dies weekly.

## Done already (reversible, decision-independent)

- `~/.config/google-drive-mcp/` created (0700).
- `mcpServers.google-drive.env.GOOGLE_DRIVE_MCP_SCOPES = "drive.readonly"` set in
  `~/.claude.json` (backup: `~/.claude.json.bak-gdrive-<ts>`). Enforces
  read-only no matter which GCP project is chosen. Takes effect on next agent
  restart.

## Blocked on Jocoo — two items

### 1. Which GCP project / OAuth client (decision) — CONFIRMED 2026-07-23

**DECIDED (Jocoo):** reuse the existing `cuzcoo-gmail` Desktop OAuth client — the
one gmail + calendar already authenticate with
(`/home/jocoo/.gcal-mcp/gcp-oauth.keys.json`, type `installed`).

Done: keys copied to `~/.config/google-drive-mcp/gcp-oauth.keys.json` (0600).
gcloud is NOT installed on the host, so the two Console steps below are Jocoo's.

Why:
- It is a Desktop client — exactly the type this package recommends.
- gmail/calendar run continuously without a weekly re-login, so that consent
  screen is already **Published** → the 7-day trap is already avoided for free.
- One Google app for all of Jocoo's Google automation; one consent to manage.

Only new steps on that project: enable **Google Drive API**, add the
`drive.readonly` scope to the consent screen. (Alternatives: reuse
`financials-processor-499212`, or a fresh dedicated project — both cost more
setup and a fresh project starts in Testing = 7-day trap unless published.)

### 2. Console + browser login (interactive — Jocoo, in order)

Keys file is already in place. Remaining steps, all on project `cuzcoo-gmail`:

1. **Enable the Google Drive API:**
   https://console.cloud.google.com/apis/library/drive.googleapis.com?project=cuzcoo-gmail
   → Enable.
2. **Add the `drive.readonly` scope** to the OAuth consent screen:
   APIs & Services → OAuth consent screen → Edit app → Scopes → add
   `.../auth/drive.readonly`. (gmail's restricted scopes already live on this
   app, so this is the same class — no new verification expected.)
3. **Browser login** in the terminal:
   ```
   npx -y @piotr-agier/google-drive-mcp auth
   ```
   Browser opens → pick Jocoo's Google account → grant read-only Drive →
   `~/.config/google-drive-mcp/tokens.json` written. This is an auth grant on
   Jocoo's personal Google account, so it stays his to click (safety brake).

## Finish (after #1 + #2)

1. Confirm `~/.config/google-drive-mcp/tokens.json` exists (0600).
2. Restart the fleet agents so the now-working server registers its tools
   (`POST /api/agents/<name>/restart` per agent, or fleet restart).
3. Verify: an agent has `mcp__google-drive__*` tools; do a read-only list of the
   #215 folder + read one file. No write tools should succeed (scope is
   readonly).
4. Report to Cuzcoo; #215 unblocks.

## Gotcha: login callback 404 (port 3000 occupied)

The auth CLI advertises redirect `http://127.0.0.1:3000/oauth2callback` by
default. On this host something already listens on `127.0.0.1:3000` (and the
Tailscale IP), so after granting consent the browser hit that other service and
got a **404** — `tokens.json` was never written. Fix: pin a free port for the
login only:

```
GOOGLE_DRIVE_MCP_SCOPES=drive.readonly GOOGLE_DRIVE_MCP_AUTH_PORT=3100 \
  npx -y @piotr-agier/google-drive-mcp auth
```

(3100-3104 were free.) The auth port matters only during login; runtime uses the
stored token. Also note: run the `auth` command WITH `GOOGLE_DRIVE_MCP_SCOPES=drive.readonly`
in the shell env, otherwise the CLI consents to the broad default scope set
rather than read-only.

## Result — VERIFIED 2026-07-23

Direct MCP stdio test (cached binary, token loaded):
- 116 tools register (search, listFolder, readTextFile, downloadFile, ...).
- READ works: `search q=trashed=false` returned 5 real Drive files.
- WRITE blocked: `createFolder` → "lacks required scope drive.file/drive" →
  read-only is enforced by the token scope.

Remaining: running agents pick up the `mcp__google-drive__*` tools on their next
session restart (the config is fleet-wide; a fresh session loads it
automatically).

## Rollback

Restore `~/.claude.json` from `~/.claude.json.bak-gdrive-<ts>`, or delete the
`google-drive` entry's `env`. Remove `~/.config/google-drive-mcp/` to drop the
token. Revoke access at https://myaccount.google.com/permissions.
