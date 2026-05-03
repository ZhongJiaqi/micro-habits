# Becoming

> *Every action you take is a vote for the type of person you wish to become.*
> — James Clear

肯定语和习惯的每日实践。每个行动，都是投给你想成为之人的一票。

A daily-practice PWA that pairs **affirmations** (what you tell yourself) with **habits** (what you do), built on the behavior-science chain *thought → action → destiny*.

## Features

- **Practice** - Manage two kinds of daily practice: affirmations (italic, quoted) and habits (serif, upright)
- **Today** - One ritual flow per day: read your affirmations, then check off your habits
- **21-Day Hall of Fame** - Practices reaching 21 consecutive days enter the Hall — affirmations and habits alike
- **History** - Calendar heatmap, streak counter, weekly chart, with All / Habits / Affirmations filter
- **PWA** - Installable on mobile, works offline-first
- **Swipe Actions** - Left-swipe to edit/delete on mobile

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Motion (animations)
- **Backend**: Firebase Authentication (Google Sign-in) + Firestore (real-time database)
- **Hosting**: Vercel
- **PWA**: vite-plugin-pwa (service worker + manifest)
- **Testing**: Vitest (unit) + Playwright (e2e)

## Getting Started

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Run tests
npm run test:all

# Build for production
npm run build
```

## Deployment

Deployed on Vercel at https://micro-habits-zeta.vercel.app

```bash
# Deploy to production
vercel --prod
```

After deployment, add the Vercel domain to Firebase Console > Authentication > Authorized domains.

## Project Structure

```
src/
├── App.tsx              # Main app: auth + tab navigation
├── useStore.ts          # State management: Firestore CRUD + daily task creation
├── firebase.ts          # Firebase initialization
├── types.ts             # TypeScript interfaces
├── components/
│   ├── TodayView.tsx    # Daily tasks with completion tracking
│   ├── HabitsView.tsx   # Habit CRUD with swipe actions
│   ├── HistoryView.tsx  # Analytics: calendar, streaks, hall of fame
│   └── SwipeActions.tsx # Mobile swipe-to-reveal component
tests/
├── useStore.test.ts     # Unit tests for task creation logic
└── e2e/
    └── habits.spec.ts   # E2E tests for UI and PWA
```

## Install as App

**iPhone**: Safari > Share > Add to Home Screen

**Android**: Chrome > Menu > Install App
