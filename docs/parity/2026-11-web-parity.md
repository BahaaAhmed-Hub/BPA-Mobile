# Web → mobile parity, November 2026

What the web added since 31 October (about 80 changes, from `BPA@c54edac`), what belongs on a phone, and how it is built
so any piece can be rolled back on its own.

## 1. What the web added

| Area | What | Size |
|---|---|---|
| **Time on tasks** | Sessions (a row per sitting), timers (several at once), calendar slots that log time when ticked, backfill for finished tasks, overlap rules (four "loads": away, focus, present, light), the assistants can time a task | Large |
| **Insights** (new module) | Time worked vs task-hours, where it went, running together, when, plan vs actual, "can you trust these numbers" | Large |
| **Plan week** | A weekly planner that proposes blocks and writes nothing until "Add"; overlap and buffers allowed with warnings; a list of what was left out | Large |
| **Calendar memory** | Period notes, day marks (highlights, flags, achievements), "Worth marking?" suggestions, a plan ledger, planning-accuracy engine and card | Large |
| **Projects** | Project Map rebuilt (pan/zoom world), timeline in day/week/month columns, a right-hand panel, move tasks between projects, `estimate` column | Large |
| **Finance** | A lender holds a debt *and* an unspent pot; spending the pot is not borrowing; an account says how much of its balance is borrowed and from whom; balance after each entry | Medium |
| **Library** | A book's Videos (favourites, ordering by views/likes) and Summary | Medium |
| **Today** | Morning Brief hero with morning pictures; the brief's own card merged into the hero | Small |
| **Calendar accounts** | iCloud accounts (calendar) alongside Google | Medium, server-led |
| **Settings** | One shell, drag to reorder companies and accounts, Finance in five tabs | Small |
| **Correctness** | Habits: a logged day no longer reverts; shared prefs: a push says only what this device changed and merges maps | Small, matters for the phone's own writes |

## 2. What belongs on a phone, and why

| Feature | Verdict | Why |
|---|---|---|
| Time: timers, sessions, manual time | **Bring, first** | A timer is the most phone-shaped thing the web has: it starts with one thumb, survives the app closing (the start time is stored, never a counter), and the phone is what is in hand when work starts and stops. |
| Time: two numbers on Today | **Bring** | "Time worked" and "task-hours" are a glance, not a report. |
| Insights | **Adapt**: a short read (the headline, where it went, plan vs actual) | The full module is a desktop analysis surface; the phone gets the answers, not the controls. |
| Plan week | **Adapt**: review and Add | Dragging blocks around a week grid is a desktop gesture. Reviewing what was proposed, seeing warnings and tapping Add is a phone gesture. |
| Marks, period notes, accuracy | **Adapt**: read on the day, one-tap keep on "Worth marking?" | Memory of the day is most useful when you are in the day. Authoring stays on the web. |
| Finance lender pot | **Bring** | Small, and it fixes a wrong answer the phone gives today: a lender's balance is treated as all debt. |
| Projects timeline | **Adapt**: a read-only timeline | The map's pan/zoom world is a desktop surface. |
| Library videos/summary | **Skip for now** | Someone already has uncommitted work on exactly this in the working tree (`BookSummaryScreen`, `BookVideosScreen`). It is not touched here. |
| iCloud accounts | **Defer** | Connecting is a Settings task on the web; the phone shows events the server already returns. Revisit once the server returns iCloud events in `calendar_events`. |
| Settings reorder, Finance tabs | **Skip** | Configuration, done once, on the web. |

## 3. Design concepts for the time feature

All three keep the web's rule that **a timer is a start time, never a counter** and that **two numbers are never one**.

**A. Pocket stopwatch (recommended base).** A slim bar sits above the tab bar whenever a timer runs, like a now-playing bar:
task name, a live clock, Stop. Tap it to open a sheet with every running timer, today's two numbers and "add time". Any task
gets a Start button. Familiar, one thumb, nothing to learn.

**B. The day as a ledger.** Today becomes a vertical timeline: meetings, sessions worked, planned slots and a "now" line, with
plan vs actual drawn as a ghost beside the real block. Start a timer by long-pressing a task into the line. The most
ambitious: it turns plan vs actual into something you see rather than read.

**C. Focus room.** Start opens a calm full-screen view: a big clock, one task, pause/stop, and the load rule ("focus shares with
nothing") shown as a quiet warning if something overlaps. Best for deep work; needs a development build for lock-screen Live
Activities, which Expo Go cannot show.

**Recommendation:** A now, B as the evolution of Today once A is in use, C only if you want lock-screen timers.

## 4. Architecture

```
web: supabase/functions/_shared/{taskTime,slots,overlapRules}.ts      (one pure file shared by app + bots)
            │  copied verbatim, headed with the web commit it came from
            ▼
mobile: src/lib/time/*            pure rules + maths        ← tests in scripts/, run under TZ=UTC
        src/lib/time/sessionsDb   the only code that talks to task_sessions
        src/store/taskSessionStore  optimistic start/stop/add/delete, rolled back with a message
        screens (later)           read the store, never the table
```

- The phone never stores a total: every figure is derived from sessions, so deleting a wrong one corrects every device.
- A stop only lands on a timer the server still has running (first stop wins across devices).
- A failed read keeps what is drawn; a missing table (`42P01`) switches the feature off rather than showing zeros.
- The web copy is the source of truth. Change it there and re-copy; the header names the commit.

## 5. Branches and rollback

`main` is tagged `checkpoint/2026-11-06-before-parity` before any of this. Each piece is a branch, a pull request and a
merge commit, so undoing one is `git revert -m 1 <merge>` and touches nothing else.

| Order | Branch | Contents | Needs |
|---|---|---|---|
| 1 | `feat/time-foundation` | Rules, db layer, store, tests. **No screens.** | – |
| 2 | `feat/time-timers` | Concept A: the bar, the sheet, Start/Stop on a task | 1 |
| 3 | `feat/time-today` | The two numbers on Today | 2 |
| 4 | `feat/finance-lender-pot` | Lender holds debt + an unspent pot | – |
| 5 | `feat/plan-week-review` | Review and Add | 1 |
| 6 | `feat/day-marks` | Marks and notes on a day; "Worth marking?" | – |
| 7 | `feat/insights-lite` | Headline, where it went, plan vs actual | 1, 3 |

Rules for every branch: typecheck clean; tests for the pure logic with a control; simulator screenshot; no personal figures
in commit or PR text; write paths roll back with a message; PR opened, merged only on a yes.

## 6. Unknowns

- Whether the web's `task_sessions`, `task_slots` and `task_load` migrations are run on this project (the store checks and
  switches off if not).
- Whether a PWA-style Live Activity is wanted (concept C) before committing to a development build.
- The Library files in the working tree belong to someone else's in-progress work.
