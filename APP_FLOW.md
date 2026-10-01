
# App Flow — How the Letter Logic Works

This describes the actual application logic: the people involved, how a letter moves from creation to close, and every rule that governs each step. No server/code details — just the behavior.

The app is the **Letter Management System** for the Southern Province Planning Secretariat, and is fully bilingual (English/Sinhala) — every label below has a Sinhala equivalent, but the logic is identical in both languages.

## 1. The people involved

1. **DCS staff** — logs in with a username/password. **View-only oversight plus delete**: DCS can search/filter every letter, open any letter's full timeline, and delete a letter outright (for mistakes), but it never originates a letter and never assigns a Relevant Officer — that's entirely the Subject Officer's job now (§3). DCS also still creates Subject Officer accounts (§6), since there's no public sign-up. **Note on naming:** internally and in the API this role is called `dcs`, but the UI itself labels this person **"Admin"** wherever it addresses the reader directly (e.g. a letter shows "Added By: Admin (DCS)" if it predates this change). DCS staff and "Admin" are the same role.
2. **Subject Officer** — originates every letter in the system (§3) and acts as the middle-man to the Relevant Officer. There can be several Subject Officer accounts at once; DCS creates each account (there's no public sign-up). Each Subject Officer logs into their own dashboard, scoped to only the letters they created, to register letters and route them on.
3. **Administrative Officer** — a second, independent login profile alongside Subject Officer (its own account, not a filtered view of one), and DCS provisions its accounts the same way as Subject Officer's. It is **view-only**: it has a dashboard scoped to letters routed to it (same layout as Subject Officer's, §6), and can open any of those letters to see their full status and timeline, but it cannot act on them, cannot manage the Relevant Officer roster (§7), and cannot create letters at all — it has no "New Letter" option and no "Reserve" / "Send to Relevant Officer" / "Send to DCS for Review" buttons on the letters it can see.
4. **Relevant Officer** — the person who actually does the work described in the letter and records what action was taken. There can be many Relevant Officers (one per letter, chosen per-division). In the Subject Officer's roster screen these are labeled generically as "Members"/"Officers" and their job title is captured as **"Position."**

**Key idea:** the Subject/Administrative Officer and Relevant Officer never need to "log in" to act on a letter. Each one gets a unique link emailed to them for that specific letter, and opening that link lets them act on just that one letter — nothing else. Only DCS, Subject Officer, and Administrative Officer use a real login (each with their own dashboard).

## 2. Every possible letter status

A letter always has exactly one of these statuses, and it only ever moves forward (never backward), except when reassignment resets part of the relevant-officer stage:

| Status | Meaning |
|---|---|
| `pending_review` | Waiting for DCS to pick a Relevant Officer. Reached when a Subject Officer created it and doesn't know who should get it (§4 Option B). |
| `created` | Just created by DCS, about to be emailed out (a passing/internal state). |
| `sent_to_subject` | Both officers have been emailed their links; waiting on the Subject Officer to mark it received. |
| `with_subject_officer` | Subject Officer has confirmed receipt; waiting on them to forward it. |
| `sent_to_relevant` | Subject Officer has forwarded it (or it was sent directly); waiting on the Relevant Officer to mark it received. |
| `with_relevant_officer` | Relevant Officer has confirmed receipt; waiting on them to record what action they took. |
| `action_taken` | Relevant Officer has recorded their action notes. This is the end of the normal lifecycle. |
| `closed` | Reserved for a fully wrapped-up letter — not currently reachable by any button in the app today. |

## 3. Flow — the Subject Officer creates the letter

DCS no longer originates letters. The Subject Officer logs into their own dashboard and registers every letter themselves, choosing one of two routing options:

### Option A — "Send Directly"
They already know which Relevant Officer should get it.
- The Subject Officer picks a **division**. There are exactly three divisions in the system: `01` Development Division, `02` Administration Division, `03` Account Division. As soon as a division is picked, a reference number is generated for it in the form **`DCSP/<division-code>/<00001–99999>`** (e.g. `DCSP/01/00042`) — this number is reserved immediately, before the form is even submitted. Numbers count up per division and wrap back to `00001` after `99999`.
- They fill in subject, the sender (labeled **"From Whom"** in the UI), received date, and pick a **Relevant Officer** from that division's list.
- The letter is created already marked as received by the Subject Officer and forwarded — it jumps straight to status `sent_to_relevant`.
- The Relevant Officer is emailed their link immediately.
- The Subject Officer's own "mark received / forward" steps are skipped entirely, since they authored it themselves.

### Option B — "Reserve" (pick an officer later)
They don't know yet who should handle it.
- The letter is created with status `pending_review` ("Reserved") and **no** Relevant Officer or division assigned yet. No email is sent yet.
- It appears in the Subject Officer's own dashboard as a count of reserved letters still waiting on them.
- **DCS is not involved at any point in this path** — whenever the Subject Officer is ready, they open the letter themselves, pick a division's Relevant Officer(s) (which also sets the letter's division), and send it.
  - This can only happen once per letter — if it's already been sent on, trying again is rejected.
- Once sent: since the Subject Officer is already the one acting, the letter skips straight to status `sent_to_relevant` — same as Option A — rather than emailing them a link to their own letter.

## 4. DCS and Administrative Officer are both view-only

Neither DCS nor the Administrative Officer has a "New Letter" option, and neither can act on any letter — not even a "Reserved" one, and not even to pick a Relevant Officer. Both dashboards (§6) and each letter's detail page show the same information — status, timeline, division, Relevant Officer(s), reassignment history — but never the "Send Directly" / "Reserve" / "Pick Relevant Officer" buttons described in §3 and §5; those are Subject-Officer-account-only. DCS's one write action anywhere in the system is deleting a letter outright (for mistakes — permanently removes it and its history). (Letters created before this restriction was introduced may still show `createdByRole: dcs` or `createdByRole: administrativeOfficer` and older wording like "Reserve" meaning something slightly different — that history is preserved for display purposes, but no new letters can be created or reviewed this way by either role.)

## 5. The link-driven handoff — what each officer can actually do

Both officers reach the same kind of page — the only difference is which actions are shown, based on which role their link belongs to. The Subject Officer actions below are also available from a logged-in Subject Officer's own dashboard (§4) — but only for a real Subject Officer account; the Administrative Officer never gets these buttons, even on a letter routed to it. (This section mostly describes letters created before §3's Flow changed — a brand-new Option A letter skips straight to `sent_to_relevant` and never generates a Subject Officer link at all; a brand-new Option B "Reserved" letter is picked up entirely from the Subject Officer's own dashboard, §3, with no DCS step and no separate link either.)

### Subject Officer's link
- **Mark Received** — available any time before it's already been done. Records the receipt time and moves status to `with_subject_officer`.
- **Send to Relevant Officer** — only enabled once "Mark Received" has been done, and only when a Relevant Officer is already assigned. Moves status to `sent_to_relevant`. After this, the Subject Officer's link is spent — it can't be used again for further actions on this letter.

### Relevant Officer's link
- **Mark Received** — only enabled once the Subject Officer has actually sent it (`sent_to_relevant`). Trying earlier is blocked. Moves status to `with_relevant_officer`.
- **Record Action** — only enabled once received. Requires typing in action notes (can't submit empty). Moves status to `action_taken` — this is the normal end of the letter's life, and the link becomes spent.
- **Reassign to another officer** — available any time after receiving and before action has been recorded (i.e. disappears once `action_taken`). This is the "wrong person got this" escape hatch:
  1. The *current* Relevant Officer picks a different active officer from the list, optionally with a note explaining why.
  2. The current officer's link is immediately invalidated (can't be reused).
  3. The handoff is logged (from → to, with the note) and shown as reassignment history to both the new officer and to DCS.
  4. The letter's Relevant Officer is updated, its "received" timestamp is cleared (the new person hasn't received it yet), and status goes back to `sent_to_relevant`.
  5. A brand-new link is emailed to the new officer, and their email mentions who reassigned it and why.
  6. The old officer's screen now shows nothing further to do — they've handed it off.

**Rule that governs everything above:** each action only unlocks after the previous required step actually happened. You cannot forward a letter you haven't received, cannot mark received before it's actually been sent to you, cannot record an action before receiving, and cannot reassign a letter that's already been closed out with an action. These checks happen for real, not just as greyed-out buttons — even a stale or reused link can't skip a step.

## 6. What DCS sees and can do at any time

DCS's dashboard is pure oversight over every letter — it never originates, routes, or reviews one:

- **Search & filter** — by letter number/subject/sender text, by division, by status.
- **View details** — every letter can be opened to see its full timeline: when it was received by each officer, when it was forwarded, when action was taken, the action notes themselves, and the complete reassignment history if it was ever handed off.
- **Delete** — DCS's only write action anywhere in the system; permanently removes a letter and its officer links/reassignment history, for mistakes rather than routine use.
- **Subject Officers** — DCS creates new Subject Officer accounts (name, email, initial password) from the "Subject Officers" page; there's no public sign-up.
- **Print Numbers** — a utility page listing every letter number issued in the *last 48 hours* (wide enough to catch a slip missed on its issue day), grouped for printing onto a physical log sheet (16 rows per page), showing letter number, division, and Relevant Officer. Since DCS no longer issues any letter numbers itself, this page is now effectively only useful to the Subject Officer, who still sees the numbers their own role issued.

## 7. Where "Relevant Officers" come from (the officer roster)

Every dropdown that lets the Subject Officer pick a "Relevant Officer" is pulling from a shared roster of officers, filtered by division. That roster is managed entirely from the **Subject Officer's dashboard**, not by DCS:

- **Add an officer** — the Subject Officer fills in name, email, position/designation, and division. The officer immediately becomes selectable in every "Relevant Officer" dropdown for that division (the Subject Officer's own New Letter form, and the Relevant Officer's own "reassign to" list).
- **Remove an officer** — the Subject Officer can remove an officer from the roster (with a confirmation prompt). This doesn't delete their history — any letters already assigned to them keep showing their name — it just makes them unselectable for *new* assignments going forward.
- DCS has no page for adding/removing officers at all; DCS's only role here is separately creating Subject Officer accounts (§6).

## 8. Summary of the full happy-path lifecycle

```text
Subject Officer creates letter — "Send Directly" (picks division + relevant officer)
        │
        ▼
  [sent_to_relevant]  ──► Relevant Officer emailed their link
        │
        ▼  (Relevant Officer clicks "Mark Received")
[with_relevant_officer]
        │
        ├──► (Relevant Officer reassigns) ──► back to [sent_to_relevant], new officer emailed
        │
        ▼  (Relevant Officer records action notes)
   [action_taken]  ── end of normal lifecycle
```

The "Reserve" variant (§3 Option B) adds one extra step at the front: `pending_review` → the Subject Officer comes back and picks a Relevant Officer themselves (no DCS step) → same `sent_to_relevant` path as above.

Only the Subject Officer can originate a letter. DCS and the Administrative Officer are both view-only (§4) — neither has a "New Letter" option, and neither ever acts on a letter, not even a "Reserved" one. DCS's only write action anywhere is deleting a letter.
