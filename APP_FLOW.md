
# App Flow — How the Letter Logic Works

This describes the actual application logic: the people involved, how a letter moves from creation to close, and every rule that governs each step. No server/code details — just the behavior.

The app is the **Letter Management System** for the Southern Province Planning Secretariat, and is fully bilingual (English/Sinhala) — every label below has a Sinhala equivalent, but the logic is identical in both languages.

## 1. The people involved

1. **DCS staff** — logs in with a username/password. Registers incoming letters, assigns officers, and has full oversight of every letter in the system. **Note on naming:** internally and in the API this role is called `dcs`, but the UI itself labels this person **"Admin"** wherever it addresses the reader directly (e.g. "Send to Admin for Review," "Awaiting Admin's review," a DCS-created letter shows "Added By: Admin (DCS)"). DCS staff and "Admin" are the same role.
2. **Subject Officer** — a single designated person at any given time (DCS decides who this is). Acts as the middle-man between DCS and the Relevant Officer. Can also log in to their own dashboard to originate letters directly.
3. **Relevant Officer** — the person who actually does the work described in the letter and records what action was taken. There can be many Relevant Officers (one per letter, chosen per-division). In the Subject Officer's roster screen these are labeled generically as "Members"/"Officers" and their job title is captured as **"Position."**

**Key idea:** the Subject Officer and Relevant Officer never need to "log in" to act on a letter. Each one gets a unique link emailed to them for that specific letter, and opening that link lets them act on just that one letter — nothing else. Only DCS and the Subject Officer's own dashboard use a real login.

## 2. Every possible letter status

A letter always has exactly one of these statuses, and it only ever moves forward (never backward), except when reassignment resets part of the relevant-officer stage:

| Status | Meaning |
|---|---|
| `pending_review` | Subject Officer created it but doesn't know who should get it — waiting for DCS to pick a Relevant Officer. |
| `created` | Just created by DCS, about to be emailed out (a passing/internal state). |
| `sent_to_subject` | Both officers have been emailed their links; waiting on the Subject Officer to mark it received. |
| `with_subject_officer` | Subject Officer has confirmed receipt; waiting on them to forward it. |
| `sent_to_relevant` | Subject Officer has forwarded it (or it was sent directly); waiting on the Relevant Officer to mark it received. |
| `with_relevant_officer` | Relevant Officer has confirmed receipt; waiting on them to record what action they took. |
| `action_taken` | Relevant Officer has recorded their action notes. This is the end of the normal lifecycle. |
| `closed` | Reserved for a fully wrapped-up letter — not currently reachable by any button in the app today. |

## 3. Flow 1 — DCS creates the letter

1. DCS opens "New Letter," picks a **division**. There are exactly three divisions in the system: `01` Development Division, `02` Administration Division, `03` Account Division. As soon as a division is picked, a reference number is generated for it in the form **`DCSP/<division-code>/<00001–99999>`** (e.g. `DCSP/01/00042`) — this number is reserved immediately, before the form is even submitted. Numbers count up per division and wrap back to `00001` after `99999`.
2. DCS fills in subject, the sender (labeled **"From Whom"** in the UI), received date.
3. DCS picks a **Relevant Officer** from that division's list.
4. The **Subject Officer is not chosen here** — it's always whoever DCS has currently designated as "the" Subject Officer (a single global setting). If no Subject Officer has been set yet, DCS cannot submit the letter — they're told to configure one first.
5. On submit:
   - The letter is created.
   - An email with a unique link goes out to **both** the Subject Officer and the Relevant Officer.
   - Status becomes `sent_to_subject`.
6. From here, the letter's progress depends entirely on the two officers clicking their links (see §5).

## 4. Flow 2 — Subject Officer creates the letter themselves

The Subject Officer logs into their own dashboard and can originate a letter without DCS starting it. When creating one, they must choose a routing option:

### Option A — "Send Directly"
They already know which Relevant Officer should get it.
- The letter is created already marked as received by the Subject Officer and forwarded — it jumps straight to status `sent_to_relevant`.
- The Relevant Officer is emailed their link immediately.
- The Subject Officer's own "mark received / forward" steps are skipped entirely, since they authored it themselves.

### Option B — "Send via DCS"
They don't know who should handle it, or want DCS to decide.
- The letter is created with status `pending_review` and **no** Relevant Officer assigned yet. No email is sent yet.
- It now appears on **DCS's dashboard** in a "pending review" queue (DCS's dashboard shows a count of how many are waiting).
- DCS opens it, picks a Relevant Officer, and submits the review.
  - This can only happen once per letter — if it's already been reviewed, trying again is rejected.
- Once reviewed: the letter is emailed to both the Subject Officer and Relevant Officer, and status becomes `sent_to_subject` — from here it behaves exactly like Flow 1.

## 5. The link-driven handoff — what each officer can actually do

Both officers reach the same kind of page — the only difference is which actions are shown, based on which role their link belongs to.

### Subject Officer's link
- **Mark Received** — available any time before it's already been done. Records the receipt time and moves status to `with_subject_officer`.
- **Send to Relevant Officer** — only enabled once "Mark Received" has been done. Moves status to `sent_to_relevant`. After this, the Subject Officer's link is spent — it can't be used again for further actions on this letter.

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

DCS's dashboard is pure oversight over every letter, not a separate workflow:

- **Search & filter** — by letter number/subject/sender text, by division, by status.
- **Pending Review count** — a running count of officer-originated letters waiting for DCS to assign a Relevant Officer.
- **View details** — every letter can be opened to see its full timeline: when it was received by each officer, when it was forwarded, when action was taken, the action notes themselves, and the complete reassignment history if it was ever handed off.
- **Review** button — only shown for letters awaiting review (Flow 2, Option B); lets DCS assign the Relevant Officer and push it forward.
- **Set Subject Officer** — DCS can change who "the" Subject Officer is at any time. This only affects letters created *after* the change — letters already sent keep going to whoever was the Subject Officer when they were created.
- **Print Numbers** — a utility page listing every letter number issued *today*, grouped for printing onto a physical log sheet (16 rows per page), showing letter number, division, and Relevant Officer.

## 7. Where "Relevant Officers" come from (the officer roster)

Every dropdown that lets DCS or the Subject Officer pick a "Relevant Officer" is pulling from a shared roster of officers, filtered by division. That roster is managed entirely from the **Subject Officer's dashboard**, not by DCS:

- **Add an officer** — the Subject Officer fills in name, email, position/designation, and division. The officer immediately becomes selectable in every "Relevant Officer" dropdown for that division (DCS's New Letter form, the Subject Officer's own New Letter form, and the Relevant Officer's own "reassign to" list).
- **Remove an officer** — the Subject Officer can remove an officer from the roster (with a confirmation prompt). This doesn't delete their history — any letters already assigned to them keep showing their name — it just makes them unselectable for *new* assignments going forward.
- DCS has no page for adding/removing officers directly; DCS only ever *selects* from the roster the Subject Officer maintains, and separately sets who the Subject Officer themselves is (§6).

## 8. Summary of the full happy-path lifecycle

```
DCS creates letter (picks division + relevant officer)
        │
        ▼
   [sent_to_subject]  ──► both officers emailed their links
        │
        ▼  (Subject Officer clicks "Mark Received")
[with_subject_officer]
        │
        ▼  (Subject Officer clicks "Send to Relevant")
  [sent_to_relevant]
        │
        ▼  (Relevant Officer clicks "Mark Received")
[with_relevant_officer]
        │
        ├──► (Relevant Officer reassigns) ──► back to [sent_to_relevant], new officer emailed
        │
        ▼  (Relevant Officer records action notes)
   [action_taken]  ── end of normal lifecycle
```

The Subject-Officer-originated variant (Flow 2) either starts mid-way (Option A skips straight to `sent_to_relevant`) or adds one extra step at the front (Option B: `pending_review` → DCS reviews → same path as above).
