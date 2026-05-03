# Becoming —  Rebrand + Affirmation Module Design

- **Date**: 2026-05-03
- **Author**: ZhongJiaqi
- **Status**: Approved (brainstorm phase complete, ready for implementation plan)
- **Brainstorm session**: `~/.gstack/brainstorm/57175-1777781785/` (logs preserved)
- **Implementation plan**: TBD（next: invoke `superpowers:writing-plans` skill）

---

## 1. Background

### What we have today

`Micro Habits` is a single-page React 19 PWA backed by Firebase, deployed on Vercel. The user has been using it for personal daily practice — both real habits (e.g. "30-min walk") **and** positive affirmations ("I am enough.") logged as habits. One-time tasks were also part of the model but are essentially unused.

### Pain points the user reported

1. **混乱感**: affirmations and habits are rendered in the same flat task list with identical styling — visually a single category, mentally two different things ("doing" vs "saying").
2. **One-time tasks 几乎没有使用**: the entire one-time task code path (creation UI, priority field, type field) is dead weight.
3. **产品定位模糊**: the user wants to keep using the app personally **and** wants to polish it for eventual public release. Current name `Micro Habits` over-anchors on "habits" and excludes affirmations.

### What this spec covers

- Rebrand the product to **Becoming**.
- Introduce **affirmations** as a first-class content type (sibling to habits), not a content variant smuggled into habits.
- Restructure Today / Practice / History to render affirmations and habits as visually distinct sections.
- Remove one-time tasks (code + data).
- Lazy-migrate existing data with zero user disruption.

### Out of scope

- Push notifications / `dailyTaskReminder` Cloud Function — independent module, untouched.
- Firestore collection rename (`microHabits` / `tasks` / `habitPool`) — kept as-is to avoid full migration; future "Becoming v2" can rename if desired.
- New growth features (sharing, social, multi-device sync) — pure refactor + rebrand.

---

## 2. Product Positioning (Becoming)

### Core idea

Behavior science: **Thought → Action → Destiny**. Backed by:
- Cialdini's commitment-and-consistency principle.
- William James / Aristotle on habit-as-identity.
- James Clear's *Atomic Habits* identity-based habits.
- Pygmalion / Rosenthal's self-fulfilling prophecy research.

The app is a **daily practice surface** that uses the same打卡 mechanic for two complementary content types:

- **Affirmations** — the "thought" repetition layer (what you tell yourself每天念一遍).
- **Habits** — the "action" repetition layer (what you do).

Together they form an integrated "I become what I think and do, repeated daily" loop.

### Why "Becoming"

- Comes directly from James Clear: *"Every action you take is a vote for the type of person you wish to **become**."*
- "-ing" tense conveys process over endpoint — central to growth psychology.
- One word, logo-friendly, distinctive in the habits-app space (Streaks / Habitica / Productive / etc. are all noun- or activity-anchored; "Becoming" is identity-anchored).
- Bilingual usability: in Chinese context "成为" is also clean; can leave English untranslated for brand purity.

### Tagline

> *Every action you take is a vote for the type of person you wish to become.*
> — James Clear, *Atomic Habits*

Used on:
- Login page subtitle (replaces *"Build better habits, one day at a time."*)
- Practice tab introduction (replaces *"Small, effortless actions. They will appear automatically..."*)

### What we are NOT

- Not a generic to-do app (no one-time tasks).
- Not a meditation app (no audio, no timers — the "moment" is just the act of acknowledging the affirmation).
- Not a social habit tracker (no leaderboards, no public sharing).

---

## 3. Information Architecture

### Bottom tab bar

```
[ Today ]   [ Practice ]   [ History ]
```

| Tab | Old name | New name | What it does |
|---|---|---|---|
| Today | Today | Today | Daily check-in — both affirmations and habits, in two visually distinct sections |
| Practice | Habits | **Practice** | Manage (CRUD) affirmations and habits in two grouped sections |
| History | History | History | Calendar heatmap, streaks, Hall of Fame — with a filter for All / Habits / Affirmations |

App name (top-left header) and login page brand text become **Becoming**.

### Section ordering inside Today and Practice

**Affirmations first, Habits second.** Mirrors the natural morning ritual: read your affirmations to set intention, then do the actions. Reverses the original recommendation that put habits first.

### Hall of Fame placement

Stays at the bottom of History tab. **One unified hall**, no separation between affirmation 21-day achievements and habit 21-day achievements (consistent with the "merged streak" mental model — see §5.2).

---

## 4. Data Model

### `MicroHabit`

```ts
export interface MicroHabit {
  id: string;
  title: string;
  createdAt: string;
  active: boolean;
  userId: string;
  category: 'habit' | 'affirmation';   // NEW — defaults to 'habit' for legacy data
}
```

- `category` is the single source of truth for which section a microHabit belongs to. **Set at creation, immutable in v1** — the UI does not expose a "move between categories" action; the user can delete and re-add if needed. Future v2 may allow re-categorization if real demand emerges.

### `Task`

```ts
export interface Task {
  id: string;
  title: string;
  date: string;            // YYYY-MM-DD
  completed: boolean;
  habitId: string;         // NOW REQUIRED (was optional)
  userId: string;
  // REMOVED: type: 'habit' | 'one-time'
  // REMOVED: priority?: 'low' | 'medium' | 'high'
}
```

- All tasks now derive from a parent microHabit (one-time tasks are gone, see §5.4).
- A task's category is **derived** at read time via `microHabits.find(h => h.id === task.habitId)?.category`. **Not duplicated** on the task document — single source of truth.

### `HabitPoolItem` (Hall of Fame)

Unchanged. Triggered when a microHabit (regardless of category) hits 21 consecutive days.

---

## 5. Behavior

### 5.1 Affirmation lifecycle

- Same as habit: written once via Practice page, appears daily on Today, completed by tapping the checkbox, resets next morning.
- Daily reset effect in `useStore.ts` creates a new task for each active affirmation each day, deterministic ID `{habitId}_{date}` (existing pattern, no change).

### 5.2 Streak / "perfect day" semantics

- A "perfect day" = **all** tasks for that day completed (both affirmations and habits, merged). Existing behavior, untouched.
- This is the user's chosen mental model: missing one affirmation breaks the streak the same way missing one habit does. Up to the user to keep affirmation count manageable.
- History page filter (§5.6) is a **view lens** that re-projects streak / heatmap / weekly progress, but does NOT alter the canonical streak number written to `habitPool` (Hall of Fame still triggers on the per-microHabit 21-day rule).

### 5.3 Hall of Fame trigger

- When a task is marked completed, walk back 21 days for that `habitId`. If 21 consecutive completions exist and `habitPool` does not yet contain this `habitId`, write a new `HabitPoolItem`.
- **Code change**: `useStore.ts:280` currently filters `task.type === 'habit'`. Remove that filter — all tasks are now habit-derived, and affirmations 21-day streaks are intentionally celebrated equally.

### 5.4 One-time tasks: hard delete

- All existing `task.type === 'one-time'` documents are **deleted from Firestore** during the next migration pass.
- Rationale: user reports near-zero usage; soft-delete carries forward dead state forever.
- Safety net: log the count to console before deletion; Firebase PITR provides 7-day rollback if a user discovers post-hoc data loss (acceptable risk for personal app).
- Code: remove all UI and store functions relating to one-time creation, priority field, and per-task editing.

### 5.5 Lazy migration on read

- On `useStore` mount, after data is loaded, scan `data.microHabits`. For any habit without a `category` field, write `setDoc(doc, { category: 'habit' }, { merge: true })` to backfill.
- Same migration effect runs the one-time task cleanup pass (single migration cycle).
- All read paths use `habit.category ?? 'habit'` as a defensive fallback during the rollout window.

### 5.6 History filter

- Top of History page: a 3-segment toggle `[ All | Habits | Affirmations ]`, styled to match existing uppercase letterspaced tabs.
- Filter state is **NOT persisted** — defaults to `All` every time the user enters History (avoids the "I switched to Habits last week and now my streak looks wrong" confusion).
- All History panels (calendar dots, Best Streak, Active Practices, Weekly Progress bars) reflect the active filter.
- The "Active Habits" stat is renamed **"Active Practices"** under All; under filtered views, it counts only that category.

---

## 6. UI Design

### 6.1 Today page

```
[Header]    Becoming                              May 03 ▾
                                                  Sign Out

   ─── AFFIRMATIONS ──────────────────
   ◯  "I am enough."
   ◯  "Today, I choose calm."
   ◯  "I trust the process."

   ─── HABITS ────────────────────────
   ◯  每天散步 30 分钟
   ◯  读书 20 页
   ◯  冥想 10 分钟

[Bottom nav]   Today  ·  Practice  ·  History
```

#### Visual rules

- **Section labels**: existing `text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em]`. Same style as elsewhere — no new heading hierarchy.
- **Affirmation rendering**: `font-style: italic`, with `"..."` ASCII double quotes added via CSS `::before` / `::after` pseudo-elements. Quotes are display-only, never persisted in `title`.
- **Habit rendering**: existing `font-serif` upright. The visual contrast with affirmations is the whole point.
- **Completion state**: round checkbox fills `#8A9A86` (existing color), text gets `line-through` + lighter color. Same for both categories.
- **Empty section handling**: if a category has zero active microHabits, **do not render the section label** — avoids stranded labels with nothing under them.
- **Order**: Affirmations always above Habits. Hard-coded, not user-configurable for v1.

### 6.2 Practice page (renamed from Habits)

```
Practice
Every action you take is a vote for the type of person
you wish to become.   — James Clear

   ─── AFFIRMATIONS ──────────────────
   01  "I am enough."
   02  "Today, I choose calm."
       + Add Affirmation

   ─── HABITS ────────────────────────
   01  每天散步 30 分钟
   02  读书 20 页
       + Add Habit
```

- Numeric markers (`01`, `02`) preserved per existing `HabitsView.tsx` style — these are positional indicators, not stable IDs.
- Two **separate** + buttons (`+ Add Affirmation`, `+ Add Habit`) — explicit category at creation time, no toggle, no select. Tapping the button opens the same inline-input form, just with `category` pre-set.
- Empty state copy:
  - Habits empty: existing *"The beginning of a new chapter."*
  - Affirmations empty: NEW *"Words you live by, repeated."*
- Edit / delete via existing `SwipeActions` component, unchanged.
- Tagline (James Clear quote) replaces existing *"Small, effortless actions..."* prose. Smaller text, lighter color, `text-[#8C8C8C]` consistent with existing intro style.

### 6.3 History page

```
HISTORY                  [All | Habits | Affirmations]   ‹ May 2026 ›

[ calendar grid — green dots on perfect days, scoped by filter ]

      [Best Streak]      [Active Practices]
          21                    6

  ─── This Week's Progress ───
   ▂  ▅  █  ▃  ▆  ▂  _
   Su Mo Tu We Th Fr Sa

  ─── THE 21-DAY HALL ───
  • 每天散步 30 分钟        ACHIEVED 2026-04-15
    47 DAYS COMPLETED

  • "I am enough."         ACHIEVED 2026-05-01
    23 DAYS COMPLETED
```

- Filter toggle styled like existing labels.
- Hall of Fame: unified list, affirmations rendered with italic + quotes (consistent with Today / Practice).
- Empty Hall: existing *"Consistency builds character."*

### 6.4 Login page

- Brand text `Micro Habits` → **`Becoming`**.
- Subtitle `Build better habits, one day at a time.` → **`Every action you take is a vote for the type of person you wish to become.`**.
- Sign-in button (`Continue with Google`) unchanged.

### 6.5 Header

- App title in header `Micro Habits` → `Becoming`.
- All other header layout / behavior unchanged (date, sign out).

---

## 7. File Change Plan

| File | Action |
|---|---|
| `src/types.ts` | Add `category` to `MicroHabit`. Remove `type` and `priority` from `Task`, change `habitId` to required. |
| `src/firebase.ts` | (No change for this spec.) |
| `src/useStore.ts` | (1) Add lazy migration effect: backfill `category='habit'`, delete all `type==='one-time'` tasks. (2) Remove `t.type === 'habit'` filter from streak / Hall of Fame trigger. (3) Remove any `addOneTimeTask` / one-time-related store functions. (4) Update `addMicroHabit` signature to accept `category`. |
| `src/App.tsx` | (1) Replace `Micro Habits` brand text with `Becoming` (login page header + main header). (2) Replace login subtitle with James Clear tagline. (3) Rename `HabitsView` import to `PracticeView`. (4) Update bottom-nav label `Habits` → `Practice`. |
| `src/components/HabitsView.tsx` → `src/components/PracticeView.tsx` | Rename file. Refactor to two grouped sections (Affirmations, Habits) with separate `+ Add` buttons. Replace intro prose with James Clear tagline. Add affirmation empty-state copy. |
| `src/components/TodayView.tsx` | (1) Remove all one-time UI (edit input, priority chip). (2) Group tasks into two sections by `microHabits.find(h => h.id === t.habitId)?.category`. (3) Add italic + quote styling for affirmations. (4) Hide section labels when empty. |
| `src/components/HistoryView.tsx` | (1) Remove `t.type === 'habit'` filter (line ~189). (2) Add filter toggle UI (All / Habits / Affirmations). (3) Apply filter to calendar dots, Best Streak, Active Practices, Weekly Progress. (4) Rename "Active Habits" stat label to "Active Practices". (5) Hall of Fame: render affirmations with italic + quotes. |
| `src/components/SwipeActions.tsx` | (No change.) |
| `tests/useStore.test.ts` | Update mock data to remove `type`, add `category`. Add test for lazy migration: legacy habit without `category` gets backfilled. Add test for one-time deletion path. Update Hall of Fame tests to assert affirmation 21-day triggers entry. |
| `firestore.rules` | Optional: add `category` field validation in `isValidMicroHabit()`. Defer to implementation phase if safe to skip. |
| `index.html` | Update `<title>` from `MicroHabits` to `Becoming`. |
| `vite.config.ts` (PWA manifest) | Update `name` and `short_name` from `MicroHabits` to `Becoming`. |
| `public/manifest.webmanifest` | (Generated by vite-plugin-pwa from config above; no manual edit.) |
| `package.json` | Update `"name"` field (lowercase, kebab — keep `micro-habits` to avoid breaking deploy slug, OR rename to `becoming`. **Decision: keep `micro-habits` to avoid Vercel project re-link**.) |
| `README.md` | Update headline to "Becoming — daily practice for affirmations and habits". |

### Files NOT changed
- Firestore collection paths (`microHabits` / `tasks` / `habitPool`) — kept as-is.
- Cloud Function `dailyTaskReminder` and `functions/` — independent module.
- `firebase-applet-config.json` — no schema change needed.
- Push notification subsystem (`messaging.ts`, `firebase-messaging-sw.js`, etc.).

---

## 8. Migration Strategy

### Order of operations on next user load

1. App boots, `useStore.ts` mounts.
2. After Firestore data subscription loads, run migration effect once per session:
   - For each `microHabit` without `category`: write `{ category: 'habit' }` with `merge: true`.
   - For each `task` with `type === 'one-time'`: delete document.
   - Log: `[migration] backfilled N microHabits, deleted M one-time tasks`.
3. Migration is idempotent — safe to run multiple times.
4. After migration, all read paths still use `habit.category ?? 'habit'` defensively for the next 30 days, then can be cleaned up in a follow-up commit.

### Rollback plan

- Code: standard `git revert` on the implementation commit.
- Data: Firestore PITR (Point-in-Time Recovery) covers 7 days. If one-time deletion is regretted, restore from PITR via `gcloud firestore import`.
- Hall of Fame: no destructive changes — existing entries preserved across the refactor.

---

## 9. Testing

### Unit (vitest, `tests/useStore.test.ts`)

- ✅ Daily reset still creates one task per active microHabit (existing).
- 🆕 Legacy `microHabit` without `category` → migration writes `category: 'habit'`.
- 🆕 Daily reset includes both `category: 'habit'` and `category: 'affirmation'` microHabits.
- 🆕 Hall of Fame triggers when an affirmation hits 21 consecutive days.
- 🆕 One-time task deletion runs once and is idempotent.
- ❌ Remove tests asserting `Task.type === 'one-time'` behavior.
- 🎯 Coverage target: ≥ 80% on `useStore.ts` (per CLAUDE.md global rule).

### E2E (Playwright, `tests/e2e/`)

- 🆕 New flow: create an affirmation in Practice, verify it appears in Today's Affirmations section, complete it, verify line-through + lighter color.
- 🆕 New flow: switch History filter All → Habits → Affirmations, verify calendar / streak / weekly all update.
- ✅ Existing habit creation / completion flows still pass.
- 🆕 Verify login page shows `Becoming` and James Clear tagline.

### Visual regression

- Take baseline screenshots of Today / Practice / History on mobile viewport (375x812) — re-take after implementation, eyeball compare.

### Manual smoke test before claiming done (CLAUDE.md global)

- Run `npm run dev`, login with real Google account, complete one full ritual (read affirmations → check off → do habits → check off), verify Today, Practice, History, Hall of Fame all coherent.

---

## 10. Open Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Lazy migration fails partway (network drop, Firestore quota) | Low | Medium | Idempotent migration; runs again next session. Logged. |
| User had data in one-time tasks they actually wanted | Low | High (perceived) | PITR rollback within 7 days. User explicitly approved hard delete. |
| Vercel deploy slug `micro-habits-zeta.vercel.app` becomes confusing under new brand | Low | Low | Decide later — either keep slug for backward compat or add a `becoming.app` custom domain in a follow-up. |
| Affirmation streak feels different mentally — user adds 30 affirmations, every day "perfect" becomes impossible | Medium | Medium | UX nudge in v2: small caption near `+ Add Affirmation` like "Keep it few. The point is to mean it." Deferred. |
| iOS Safari PWA users still on old SW (we just shipped 5 layers of fix yesterday) | Resolved | — | Already addressed in `c08d49f`. |

---

## 11. Decisions Trail (for posterity)

User-confirmed choices during brainstorm session:

| Decision | Choice | Rationale |
|---|---|---|
| Affirmation打卡 semantics | Daily reset (option A) | Same mechanic as habits |
| Streak / heatmap | Merged (option A) | Simplicity, "today is one whole day" |
| IA | Two sections in same page (option B), Practice tab | No tab proliferation |
| Section order | Affirmations above Habits | Morning ritual: read first, then act |
| Tab name | Habits → Practice (B1) | Matches dual-content surface |
| App name | Micro Habits → **Becoming** | Identity-anchored, James Clear lineage |
| Tagline | James Clear: *"Every action you take is a vote..."* | Direct attribution, modern psychology |
| Visual style | Italic + `"..."` for affirmations | Literary contrast vs serif habits |
| Hall of Fame split | One unified Hall | Consistent with merged streak |
| Active stat label | "Active Practices" | Generalizes both content types |
| One-time task | Hard delete | Near-zero usage, dead weight |
| Filter persistence | Not persisted | Avoid stale-streak confusion |

---

## 12. Next Steps

1. ✅ This spec written and committed.
2. 🟡 User reviews spec (this gate is required).
3. ⏳ Invoke `superpowers:writing-plans` skill to produce a detailed implementation plan (file-by-file, test-first per TDD rule).
4. ⏳ Implementation in a feature branch, PR review, merge.
5. ⏳ Manual smoke test + visual regression.
6. ⏳ `vercel --prod` deploy.
