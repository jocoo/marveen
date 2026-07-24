# Scouts Equipment Inventory — AI Vision Check-out/Check-in: Solution Design

**Prepared by:** Cuzcoo | **Date:** 2026-07-12
**Context:** Northern Beaches Scout Group, Smithfield Cairns — den storage room
**Supersedes-in-part:** [`equipment-inventory-system.md`](./equipment-inventory-system.md) (Yzma, 2026-07-02)
**Origin:** Jocoo, after watching a Jeff Geerling video on the Raspberry Pi AI Kit (Hailo-8L NPU)

---

## 1. Why this exists

The Google Forms + Sheets "Checkout Station" design (previous doc) scored highest of the
software-only options, but it depends on **QR codes attached to each item**. Jocoo's objection:
Scout gear (ropes, tents, cooking equipment) takes heavy abuse — mud, wear, repeated washing —
and a QR label glued or laminated onto it won't reliably survive. There is no comfortable way to
mark hundreds of items that stays scannable.

The alternative Jocoo proposed: don't mark the *items* at all. Mark a **place**. Put the gear in a
fixed, painted staging frame, photograph it, and let a vision model identify what's there. No
labels to apply, no labels to replace when they fall off.

This document is the hardware + software solution design and parts list for that system. It is
designed to **feed the same Sheets-based logging structure** from the earlier doc (Checkout log /
Return log / Active loans / Inventory master), not replace it — only the "which item is this"
step changes, from QR scan to camera recognition.

---

## 2. Requirements (as specified by Jocoo)

- Fixed staging zone: a **painted yellow frame** on a shelf/table, camera mounted above it looking
  straight down.
- Items being checked out or returned are placed inside the frame.
- Capture is **triggered on demand from a phone** — a single exposure, not continuous video
  monitoring. Privacy-friendly (youth storage room) and avoids streaming/storage overhead.
- The captured image is sent to a Raspberry Pi for on-device inference.
- **Multiple items per photo** (Jocoo's explicit preference: "Több tárgy jobb lenne") — this rules
  out a simple single-item classifier and requires a real object-detection model: bounding box +
  class + confidence per detected instance, so several different items dropped in the frame at
  once are each counted and identified.
- Custom-trained detection model — Jocoo has confirmed he's fine collecting and labelling training
  photos of the actual gear. There's no standard "Scout gear" object-detection dataset, so this is
  required regardless.

---

## 3. Architecture overview

```
                    ┌─────────────────────────┐
   Scout / QM       │   Phone (any browser)   │
   at the shelf      │   or Telegram bot        │
                    └────────────┬────────────┘
                                 │ HTTPS over Tailscale
                                 │ "capture + checkout, name=X"
                                 ▼
                    ┌─────────────────────────┐
                    │  Raspberry Pi 5          │
                    │  + AI Kit (Hailo-8L NPU) │
                    │                          │
                    │  1. rpicam-still capture │
                    │  2. YOLO-style detection │
                    │     (Hailo-accelerated)  │
                    │  3. bbox+class+count out │
                    └────────────┬────────────┘
                                 │ Google Sheets API
                                 ▼
                    ┌─────────────────────────┐
                    │ Existing Sheets system  │
                    │ (Checkout/Return log,    │
                    │  Active loans)           │
                    └─────────────────────────┘
```

Camera mounted overhead, pointed straight down at a **painted yellow rectangle** on the shelf.
Fixed framing + fixed distance + fixed lighting is what makes a lightweight edge model practical —
this is a controlled scene, not open-world detection.

---

## 4. Hardware

### 4.1 Core compute + vision

| Component | Purpose | Price (AUD, indicative) | Source |
|---|---|---|---|
| Raspberry Pi 5, 8GB | Host compute | ~$130 USD official (~AUD 200) | [raspberrypi.com/products/raspberry-pi-5](https://www.raspberrypi.com/products/raspberry-pi-5/) |
| Raspberry Pi AI Kit (Hailo-8L, M.2 HAT+) | 13 TOPS NPU for on-device detection inference | $70 USD launch price, but Pi board/RAM prices spiked in early-mid 2026 (see §6) — check live price | [raspberrypi.com/products/ai-kit](https://www.raspberrypi.com/products/ai-kit/) |
| Camera Module 3 (standard, 12MP, autofocus) | Overhead capture | $25 USD | [raspberrypi.com/products/camera-module-3](https://www.raspberrypi.com/products/camera-module-3/) |
| CSI camera cable, extended length (~50-100cm) | Reach from Pi to overhead mount point | ~$8 USD | Any Pi camera cable reseller (Pi Hut, PiShop, Adafruit) |
| microSD card, 32GB, A2/U3 rated | OS + model storage | ~$10-15 USD | Any reputable brand (SanDisk/Samsung) |
| Raspberry Pi 27W USB-C power supply (official) | Stable power under NPU load | ~$12-15 USD | [raspberrypi.com](https://www.raspberrypi.com/products/) |
| Active Cooler (official, clip-on) | Sustained inference load = heat; Pi 5 throttles without active cooling | ~$8-10 USD | [raspberrypi.com/products/active-cooler](https://www.raspberrypi.com/products/active-cooler/) |

**Note on the case:** the official $10 Pi 5 case is designed for the bare board and does not
accommodate the AI Kit's M.2 HAT+ stacked on top. Either mount the assembled board+HAT open-frame
inside a project box (see §4.2), or use a HAT-compatible open-frame stand (Argon40 and similar
third parties sell Pi5+HAT mounting frames).

### 4.2 Mounting, staging zone, lighting

| Component | Purpose | Notes |
|---|---|---|
| Overhead boom/bracket arm | Holds camera pointed straight down over the frame | A repurposed photography copy-stand arm, or a wall/shelf-mounted articulating bracket (~$25-40, hardware store or Bunnings). Needs to hold position rigidly — no re-aiming per photo. |
| Yellow paint / tape | Marks the staging rectangle | Whatever's on hand; high-contrast against the shelf surface matters more than the exact colour. |
| LED ring light or 2x small work lights | Even, shadow-free illumination | Consistent lighting matters more for a lightweight edge model than camera resolution does — uneven shadows are the most common cause of missed detections. ~$20-30. |
| Small project box / enclosure | Dust protection for the Pi in a storage room | ~$15-25, any electronics enclosure with cable glands or grommets. |
| Ethernet cable (if WiFi is unreliable in the den) | Network reliability | Optional; WiFi is fine if signal is solid. |

### 4.3 Indicative total

| Tier | Components | Estimate (AUD) |
|---|---|---|
| Compute + vision core | Pi 5, AI Kit, camera, cable, SD, PSU, cooler | ~AUD 380-450 (volatile, see §6) |
| Mounting + staging | Bracket, lighting, paint, enclosure | ~AUD 80-120 |
| **Total** | | **~AUD 460-570** |

This is a rough order-of-magnitude estimate built from currently-listed official prices — confirm
live pricing before ordering (see §6 on the 2026 DRAM shortage affecting Pi board prices
specifically).

---

## 5. Software

### 5.1 Mobile trigger

Two options, not mutually exclusive:

1. **Tiny mobile web page hosted on the Pi** — two big buttons ("Kiviszem" / "Visszahozom"), a
   name field (dropdown or free text), reachable over Tailscale from any phone without needing
   local WiFi. Simplest for non-technical Scout leaders; no app install.
2. **Telegram bot trigger** — reuses the Claude Code Channels infrastructure already running for
   this project (Cuzcoo). A Scout leader sends `/checkout Zsolt` or similar to a bot, which calls
   the Pi's capture endpoint. Lower build cost since the messaging plumbing already exists, but
   ties the flow to whoever has Telegram access — the web-page option is more accessible for
   Scout leaders in general. **Recommendation: build the simple web page first**, it's the more
   robust default; a Telegram shortcut can be layered on later if useful.

### 5.2 Capture + inference pipeline (on the Pi)

- Small HTTP service (FastAPI or Flask) listens for the trigger request (`POST /capture` with
  `mode=checkout|return` and `name`).
- `picamera2`/`rpicam-still` takes a single high-res still — no video stream, no continuous
  capture, matching Jocoo's on-demand-only requirement.
- Image is run through a YOLO-family object-detection model compiled for the Hailo-8L (`.hef`
  format via the Hailo Dataflow Compiler / Hailo Model Zoo tooling), returning bounding box +
  class + confidence for every detected instance in the frame.
- Result is summarized ("2x tent pole, 1x rope 30m, 1x billy can") and:
  - appended as a new row to the existing **Checkout log** or **Return log** Sheet tab (reusing
    the structure from the earlier doc, via the Google Sheets API — no manual form-filling), and
  - sent back to the phone/Telegram as confirmation, so the person at the shelf can catch an
    obviously wrong read (e.g. a missed item) before walking away.

### 5.3 Training workflow (off-device — the Pi only ever runs inference)

Training does **not** happen on the Pi — Pi-based training would take days for a task that takes
minutes to hours on a normal GPU. The Pi's NPU is an inference accelerator only.

1. Photograph each piece of gear multiple times inside the frame — varied orientation, varied
   combinations with other items, and (importantly) varied condition: muddy, wet, worn, since
   that's the real-world state the camera will see.
2. Label bounding boxes with a free tool (Roboflow or CVAT are the common choices; Roboflow also
   handles the train/val split and export formatting).
3. Train a lightweight YOLOv8n/YOLOv5n model. **No GPU purchase needed** — Google Colab's free
   tier hands out a T4 GPU per session, plenty for a small custom dataset (a YOLOv8n fine-tune on
   a few hundred images typically finishes in well under an hour). This is a $0 line item, not
   part of the parts list.
4. Export/compile to Hailo `.hef` via the Hailo Model Zoo tooling, copy onto the Pi.
5. Iterate: as new gear types are added to inventory or misdetections show up in practice, add
   more labelled photos and retrain. This is the ongoing maintenance cost of the system — budget
   for it, it's not a one-time setup step.

#### 5.3.1 Accessing Google Colab (no purchase, no install)

1. Go to [colab.research.google.com](https://colab.research.google.com/) and sign in with any
   Google account (the same account used for the Sheets logging works fine — no separate signup).
2. **New notebook** → in the menu bar: `Runtime` → `Change runtime type` → set **Hardware
   accelerator** to `T4 GPU` → `Save`. This is the free-tier GPU; no billing is triggered unless
   you later choose a paid tier (not needed here).
3. Upload the labelled dataset (from Roboflow/CVAT export — a zip of images + label files) either
   by dragging it into the notebook's file pane, or by mounting Google Drive (`from google.colab
   import drive; drive.mount('/content/drive')`) if the dataset lives there.
4. Install the training library in the first cell: `!pip install ultralytics` (this is the
   YOLOv8 toolkit), then run training, e.g. `!yolo train data=data.yaml model=yolov8n.pt
   epochs=100 imgsz=640` — Roboflow's export includes a ready-made `data.yaml` pointing at the
   uploaded set.
5. Free-tier sessions disconnect after a period of inactivity or after ~12 hours connected — long
   enough for a YOLOv8n fine-tune on a few hundred images, which typically finishes in well under
   an hour. If it disconnects mid-run, just reconnect and rerun; nothing is lost from the Pi's
   side since this all happens off-device.
6. Download the trained weights (`best.pt`) from the Colab file pane once training finishes, then
   run the Hailo Model Zoo export/compile step (locally or in the same notebook) to produce the
   `.hef` file for the Pi.

No account beyond a free Google login, no software install on any of Jocoo's own machines, no
cost — the entire training step lives in the browser.

### 5.4 Relationship to the existing Sheets system

Keep the Sheets structure from the earlier doc (Checkout log / Return log / Active loans /
Inventory master) as the system of record — it already covers reporting, condition tracking, and
replacement-value tracking. This solution design only replaces the **identification** step: no QR
scan, no manual dropdown pick of which item — the camera + model does that part, then writes into
the same log structure via the Sheets API instead of a human filling out a Form.

---

## 6. Risks / things to flag before buying

- **2026 Pi board pricing is volatile.** Global DRAM/LPDDR4 shortages pushed Raspberry Pi 5 board
  prices up twice in 2026 (8GB model rose to ~$130 USD in a Feb 2026 hike, up ~$30). Confirm live
  price at order time rather than trusting the numbers above verbatim.
- **Model accuracy is the real project risk, not the hardware.** A custom-trained detector on a
  small, self-collected dataset can be brittle to lighting changes, unusual item stacking, or gear
  conditions not represented in training photos. Budget time for an initial "shakedown" period
  where a human double-checks the AI's read before fully trusting it unattended.
- **Lighting consistency matters more than camera resolution.** Uneven shadows from the overhead
  mount are the most likely source of missed/misclassified items — worth getting the lighting
  right before investing more in the model.
- **Item overlap/occlusion** — if two items are stacked on top of each other in the frame, the
  detector may miss the hidden one. Worth a house rule: spread items out, don't pile them.
- This is a from-scratch build with no off-the-shelf equivalent — realistic timeline is measured
  in weeks (mounting + wiring + initial dataset collection + first training pass + iteration), not
  a weekend project. Given the den inventory task itself is due next weekend, this vision system
  is **not** a fit for that deadline — it's a follow-on improvement project, not a replacement for
  doing the inventory manually.

---

## 7. Suggested next steps

1. Confirm the yellow-frame location and overhead mount point physically in the den (cable run,
   power outlet, WiFi/Tailscale reach).
2. Order the parts list in §4 (confirm live pricing first).
3. Start photographing gear for the training set opportunistically — this can begin before any
   hardware arrives, using a phone camera in a mocked-up frame, since the deep dependency is
   labelled data, not the Pi itself.
4. Once hardware arrives: base OS setup, camera test, AI Kit driver setup, then the capture
   HTTP service.
5. First model training pass once ~30-50 labelled photos per item class exist as a starting point.

Formalize as a kanban card (assignee: Kronk for the build once Jocoo confirms scope) once Jocoo
has reviewed this design.
