# Telegram plugin: edited_message forwarding

Kanban #cb5080e5 / Kronk / 2026-06-18

## Status

DRAFTED, **NOT APPLIED**. The change targets a vendored Anthropic plugin
(`anthropics/claude-plugins-public@external_plugins/telegram`), not the
marveen repo. Apply locally + open upstream PR before relying on it.

## Problem

Telegram Bot API delivers an edit as a separate update type:
`edited_message`. Grammy's default `getUpdates` subscription only requests
`message`, `callback_query`, etc. -- so when Jocoo edits an already-sent
Telegram message, the plugin never sees the new text and the agent reads
the stale version forever.

## Investigation

Plugin source: `/home/jocoo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/telegram/server.ts`
Upstream:      https://github.com/anthropics/claude-plugins-public/tree/main/external_plugins/telegram

Library: grammy 1.41.1 (peer at `^1.21.0`).

Existing inbound surface: `bot.on('message:text' | 'message:photo' | ...)`
through `handleInbound(ctx, text, downloadImage?, attachment?)`. The
handler reads `ctx.message?.message_id` and `ctx.message?.date`; on an
edited-message update those are undefined because grammy puts the
payload on `ctx.editedMessage` (also available via `ctx.msg`).

Polling entrypoint at the bottom of the file is `bot.start({ onStart })`
with no `allowed_updates` -- grammy ships the bot-side default
subscription, which omits `edited_message`.

## Fix sketch

Three small touches, no schema migration:

1. Subscribe to `edited_message` updates via `allowed_updates` on
   `bot.start()`. The list MUST also enumerate every type the plugin
   already uses, otherwise grammy passes the new restrictive list to the
   Bot API and silently stops receiving e.g. `callback_query`.
2. Register a new handler `bot.on('edited_message:text', ...)` that
   delegates to the shared `handleInbound` path with an `edited: true`
   flag.
3. Teach `handleInbound` to fall back to `ctx.editedMessage` for the
   message-id / date lookups and to pass the `edited` flag into the
   `<channel>` notification's `meta` object so the agent can tell a real
   edit apart from a re-relay.

Why text-only first: edits to media (photo, document, voice, ...) only
ever change the caption, never the binary -- adding handlers for those
is mechanical busy-work for zero new behaviour. Add later if needed.

## Patch (apply with `patch -p1` from the plugin root)

```diff
--- a/server.ts
+++ b/server.ts
@@ -397,7 +397,7 @@
     instructions: [
       'The sender reads Telegram, not this session. Anything you want them to see must go through the reply tool — your transcript output never reaches their chat.',
       '',
-      'Messages from Telegram arrive as <channel source="telegram" chat_id="..." message_id="..." user="..." ts="...">. If the tag has an image_path attribute, Read that file — it is a photo the sender attached. If the tag has attachment_file_id, call download_attachment with that file_id to fetch the file, then Read the returned path. Reply with the reply tool — pass chat_id back. Use reply_to (set to a message_id) only when replying to an earlier message; the latest message doesn\'t need a quote-reply, omit reply_to for normal responses.',
+      'Messages from Telegram arrive as <channel source="telegram" chat_id="..." message_id="..." user="..." ts="..."> (an `edited="true"` attribute marks a revision of an earlier message_id — replace your in-memory copy of that message_id with the new content; do not treat it as a fresh message). If the tag has an image_path attribute, Read that file — it is a photo the sender attached. If the tag has attachment_file_id, call download_attachment with that file_id to fetch the file, then Read the returned path. Reply with the reply tool — pass chat_id back. Use reply_to (set to a message_id) only when replying to an earlier message; the latest message doesn\'t need a quote-reply, omit reply_to for normal responses.',
       '',
       'reply accepts file paths (files: ["/abs/path.png"]) for attachments. Use react to add emoji reactions, and edit_message for interim progress updates. Edits don\'t trigger push notifications — when a long task completes, send a new reply so the user\'s device pings.',
@@ -901,6 +901,7 @@
   text: string,
   downloadImage: (() => Promise<string | undefined>) | undefined,
   attachment?: AttachmentMeta,
+  opts?: { edited?: boolean },
 ): Promise<void> {
   const result = gate(ctx)

@@ -918,7 +919,8 @@
   const access = result.access
   const from = ctx.from!
   const chat_id = String(ctx.chat!.id)
-  const msgId = ctx.message?.message_id
+  const inboundMsg = ctx.message ?? ctx.editedMessage
+  const msgId = inboundMsg?.message_id

   // Permission-reply intercept: if this looks like "yes xxxxx" for a
   // pending permission request, emit the structured event instead of
@@ -968,7 +970,8 @@
         ...(msgId != null ? { message_id: String(msgId) } : {}),
         user: from.username ?? String(from.id),
         user_id: String(from.id),
-        ts: new Date((ctx.message?.date ?? 0) * 1000).toISOString(),
+        ts: new Date((inboundMsg?.date ?? 0) * 1000).toISOString(),
+        ...(opts?.edited ? { edited: 'true' } : {}),
         ...(imagePath ? { image_path: imagePath } : {}),
         ...(attachment ? {
           attachment_kind: attachment.kind,
@@ -788,6 +791,16 @@
 bot.on('message:text', async ctx => {
   await handleInbound(ctx, ctx.message.text, undefined)
 })
+
+// Forward text edits through the same inbound path so the agent's view
+// of message_id stays in sync with what the user actually sees on
+// Telegram. `edited: true` flips the meta flag so the agent can detect
+// a revision instead of treating it as a fresh send.
+bot.on('edited_message:text', async ctx => {
+  const text = ctx.editedMessage!.text
+  if (!text) return
+  await handleInbound(ctx, text, undefined, undefined, { edited: true })
+})

 bot.on('message:photo', async ctx => {
   const caption = ctx.message.caption ?? '(photo)'
@@ -1001,6 +1014,15 @@
   for (let attempt = 1; ; attempt++) {
     try {
       await bot.start({
+        // Grammy's default subscription omits edited_message, so an edit
+        // to a Telegram message never reaches the bot. List every update
+        // type the plugin actually consumes here -- a partial list would
+        // silently drop the others (Bot API replaces the default with the
+        // exact set you pass).
+        allowed_updates: [
+          'message',
+          'edited_message',
+          'callback_query',
+        ],
         onStart: info => {
           attempt = 0
           botUsername = info.username
```

## Deploy

The plugin is loaded by `claude-host` as an MCP child process per agent.
A change to `server.ts` only takes effect when the host respawns the
child -- the fleet doesn't get the new code from a `systemctl restart
cuzcoo-dashboard`. To smoke-test:

1. Apply the patch in the cached plugin path:
   ```
   cd /home/jocoo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/telegram
   patch -p1 < /home/jocoo/marveen/docs/patches/telegram-plugin-edited-message.patch  # save the diff section above as .patch
   ```
2. Hard-restart every agent that has the Telegram plugin enabled
   (Cuzcoo, Kronk, Yzma, Chicha...). Each restart respawns its MCP
   children including the Telegram plugin.
3. Jocoo: send a message on Telegram, then edit it.
4. Confirm the agent sees a `<channel ... edited="true" ...>` block with
   the new text.

## Risks

- **Plugin update overwrites the patch.** Plugin marketplace updates
  drop the file back to upstream. Mitigation: open a PR against
  `anthropics/claude-plugins-public` so the fix lands upstream and we
  stop diverging.
- **48h Telegram edit window.** The Bot API itself stops delivering
  edit updates after roughly 48 hours; this is platform-level, no
  mitigation possible. Document it in the prompt so the agent doesn't
  expect coverage forever.
- **Allowed-updates list must stay complete.** Any future plugin
  feature that wants e.g. `chat_member` MUST be added to this list at
  the same time the handler is written. Add a code comment to that
  effect (already in the patch).
- **Edit storm.** A user spam-editing the same message would re-trigger
  the agent's typing indicator and the ack reaction. handleInbound is
  cheap (no DB write) so the load is fine; the UX could feel noisy.
  Future iteration could rate-limit `setMessageReaction` per
  `(chat_id, message_id)`.

## Recommended next step

Hand to Jocoo with two options:
1. Apply locally + smoke test now (~5 min including all-agent restart).
2. Open upstream PR first; apply locally once merged or alongside
   merge to avoid re-applying on every plugin update.
