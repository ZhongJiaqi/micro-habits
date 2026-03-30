# MicroHabits

Build better habits, one day at a time.

A habit tracking PWA that helps users build habits through small, daily actions with positive reinforcement.

## Features

- **Habit Management** - Create, edit, delete daily micro-habits
- **Daily Tasks** - Habits automatically generate today's tasks; supports one-time tasks with priority
- **21-Day Streak** - Habits reaching 21 consecutive days enter the Hall of Fame
- **Analytics** - Calendar heatmap, streak counter, weekly completion chart
- **PWA** - Installable on mobile, works like a native app (no app store needed)
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
