# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on http://0.0.0.0:3000 (Vite HMR)
npm run build        # Production build → dist/
npm run lint         # Type check (tsc --noEmit)
npm run test         # Unit tests (Vitest, single run)
npm run test:watch   # Unit tests (watch mode)
npm run test:e2e     # E2E tests (Playwright, auto-builds + serves on :4173)
npm run test:all     # Unit + E2E combined
```

## Architecture

Single-page React 19 PWA with Firebase backend, deployed on Vercel.

### Data Flow

- **Auth**: Firebase Auth (Google Sign-in) → `App.tsx` passes `user.uid` to `useStore()`
- **State**: `useStore.ts` is a custom hook that manages all data via Firestore `onSnapshot` real-time listeners — no Redux/Zustand
- **Three Firestore collections** per user (all under `users/{userId}/`):
  - `microHabits` — habit definitions (active/inactive)
  - `tasks` — daily task instances (both habit-derived and one-time)
  - `habitPool` — "Hall of Fame" entries for habits with 21-day streaks

### Critical: Task Creation Logic

Task creation for habits is centralized in a single `useEffect` in `useStore.ts` (the "daily reset effect"). This was a deliberate fix for a duplicate task bug:

1. `addMicroHabit()` only writes the habit doc — it does NOT create tasks
2. The daily reset effect is the **sole owner** of task creation
3. Deduplication uses two mechanisms:
   - `createdTaskIdsRef` (in-memory Set) prevents redundant Firestore writes
   - Deterministic task IDs (`{habitId}_{date}`) + `setDoc` ensures idempotency
4. The effect also cleans up duplicate tasks on each run

### UI Structure

`App.tsx` has three tabs (Today / Habits / History) with `AnimatePresence` transitions. Mobile-first layout capped at `max-w-md`. Components:

- `TodayView` — daily task list with completion toggles
- `HabitsView` — CRUD for habit definitions
- `HistoryView` — calendar heatmap, streak analytics, hall of fame
- `SwipeActions` — mobile swipe-to-reveal for edit/delete

### Design Tokens (hardcoded, no theme file)

- Background: `#F9F8F6`, Text: `#2C2C2C` / `#1A1A1A`, Muted: `#8C8C8C`
- Font: system sans-serif + serif for headings
- Selection highlight: `#E2DFD8`

### PWA

Configured via `vite-plugin-pwa` in `vite.config.ts`. Service worker auto-updates. Manifest, icons (192/512), and workbox runtime caching for Google Fonts.

### Firestore Security

`firestore.rules` enforces owner-only access with field validation. `userId` is immutable after creation.

### Testing

- Unit tests in `tests/useStore.test.ts` — tests extracted task creation logic with mocked Firestore to verify dedup behavior
- E2E tests in `tests/e2e/habits.spec.ts` — Playwright against preview build on :4173
- Vitest config is in `vite.config.ts` (excludes `tests/e2e/**`)
- 每次修改完代码都要测试（增量功能测试和回归测试），不要等用户问，给用户体验前都要全量测试，测试验收没问题才给用户体验

### Firebase Config

`firebase-applet-config.json` contains project credentials (committed). `.env.local` has Vercel + API keys (gitignored). See `.env.example` for required vars.
