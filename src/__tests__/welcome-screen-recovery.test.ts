import { describe, it, expect } from 'vitest'
import {
  detectPaneState,
  stuckInputSignature,
  parkedInputRowCount,
  parkedInputText,
  decideStuckInputAction,
} from '../pane-state.js'

// End-to-end regression guard for the REAL production wedge (2026-06-26):
// a delivered multi-row inter-agent message parked in a Claude Code v2.1.170
// fresh-session WELCOME screen (logo + model + cwd, box between two rule lines,
// no idle footer). Before the P1 fix, liveInputBox anchored on the idle footer,
// so detectPaneState returned 'unknown' and the whole recovery stack was blind
// -> the agent stayed wedged until a manual restart. This fixture is the actual
// captured qwen pane. Live validation confirmed a single Enter submits it once
// detected; the ladder uses the more robust reinject-plain for a sub-agent.
const QWEN_WELCOME_WEDGE = `
 ▐▛███▜▌   Claude Code v2.1.170
▝▜█████▛▘  qwen3.6:27b-192k with high effort · API Usage Billing
  ▘▘ ▝▝    ~/ClaudeClaw/agents/qwen










────────────────────────────────────────────────────────────────────────────────
❯ kepet: /Users/marvin/ClaudeClaw/workspace/mbh-issue/aahe486-screenshot.png
  Olvasd be a Read tool-lal a kepfajlt, majd mondd meg: (1) mi ez az
  alkalmazas/oldal, (2) a tablazat konkret ertekei -- rendszam, tipus,
  letrehozas+modositas datumok, hany sor. Roviden a vegeredmenyt (ne
  gondolkodj sokat). Ez egy kepesseg-teszt rolad (qwen3.6 lokal modell),
  szoval csak old meg ahogy tudod, es a valaszod visszajelzem Szabinak.
  </trusted-peer>
────────────────────────────────────────────────────────────────────────────────

`

describe('welcome-screen wedge: detection -> recovery decision (real fixture)', () => {
  it('P1 detection sees the footer-less welcome-screen parked input', () => {
    expect(detectPaneState(QWEN_WELCOME_WEDGE)).toBe('typing')
    expect(stuckInputSignature(QWEN_WELCOME_WEDGE)).not.toBeNull()
    expect(parkedInputText(QWEN_WELCOME_WEDGE)).not.toBeNull()
    expect(parkedInputRowCount(QWEN_WELCOME_WEDGE)).toBeGreaterThan(1)
  })

  it('STUCKENTER384: the wedge now gets a VERIFIED Enter, and still no lossy rescue', () => {
    // POLICY CHANGE 2026-08-05 (kept): this fixture's parked text begins
    // mid-sentence ("kepet: /Users/marvin/...") -- the head rows were already
    // dropped by the TUI, and no machine marker survives in the visible box.
    // Re-injecting it (reinject-plain) is exactly the lossy rescue that
    // delivered byte-identical truncated prompts at 15:06/16:00: the scrape IS
    // a fragment. Clearing is no better -- origin is uncertain here, and a
    // human's text has no re-delivery. Both stay forbidden.
    //
    // REFINEMENT 2026-08-27 (card #384): 'hold' meant EVERY such wedge needed a
    // human to press Enter (6 spells across two agents on 2026-08-24 alone).
    // A bare Enter is the one remedy that is NOT lossy here: it submits the
    // real buffer, head rows included -- the TUI truncated the DISPLAY, not the
    // buffer. Measured to submit on a 9-row placeholder-free park (#384 probe),
    // and the caller verifies it landed rather than assuming.
    const wedgeFacts = {
      escalate: true,
      rowCount: parkedInputRowCount(QWEN_WELCOME_WEDGE),
      blockComplete: false,
      blockTruncated: false,
      truncatedPreamble: false,
      allowPlainReinject: true,
      hasPlainText: parkedInputText(QWEN_WELCOME_WEDGE) != null,
      scheduledTaskBlock: false,
      machineOrigin: false, // computed: no prefix, no truncated marker survives
      pastePlaceholder: false,
    }
    expect(decideStuckInputAction(wedgeFacts)).toBe('enter-verified')
    // The unsafe half of the discriminator is unchanged: a parked paste stub
    // does NOT submit on Enter (it expands), so it still holds.
    expect(decideStuckInputAction({ ...wedgeFacts, pastePlaceholder: true })).toBe('hold')
  })
})
