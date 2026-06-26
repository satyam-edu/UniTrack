<div align="center">

# UniTrack

**A production-grade attendance tracking PWA for university students**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)

**[Live Demo →](https://unitrack.dev)**

</div>

---

## Overview

UniTrack is a full-stack Progressive Web App that solves a real pain point for university students: tracking attendance accurately across multiple subjects, batches, and session types. It handles the complexity of split batches, per-hour vs per-class counting modes, and overlapping class slots — while staying fast and installable as a native-feeling mobile app.

The standout feature is AI-powered timetable import: a student photographs their printed timetable and Gemini extracts all subjects, timings, faculty names, and batch assignments in seconds — with a two-pass self-verification step to catch errors.

---

## Features

### AI Timetable Import
- Upload a timetable image (PNG, JPEG) or PDF
- Google Gemini extracts subjects, codes, timings, rooms, faculty, and group labels
- A second Gemini pass verifies and self-corrects the first output
- Parallel batch classes (A, B, C) are automatically detected and separated

### Attendance Tracking
- Mark each class as **Present**, **Absent**, or **Cancelled** with one tap
- **Optimistic UI** — the state updates instantly; a database error silently rolls it back
- Cancelled classes are excluded from the attendance percentage
- Supports two counting modes per subject type: **Per Class** or **Per Hour**

### Smart Overlap Detection
- Detects parallel batch slots that would double-count attendance
- Attendance marking is locked for ambiguous overlapping slots until the student sets their group
- Guides the user to Profile → Group to resolve the conflict

### Dashboard & Analytics
- Animated SVG progress ring for overall attendance percentage
- Subject-wise breakdown with present / absent / cancelled counts
- Color-coded health indicators relative to the student's target (default 75%)
- Two-week scrollable calendar with attendance dot indicators

### Batch / Group Support
- Each timetable slot carries an optional `group_designation` (e.g., A, B, 1, T1)
- A primary group preference filters the Home view to show only the student's classes
- The Timetable explorer retains an "ALL" view to inspect every parallel class

### Progressive Web App
- Installable on iOS and Android home screens via Web App Manifest
- Service Worker for offline capability
- Responsive design optimised for mobile with a max-width desktop layout

### Authentication & Security
- Email/password sign-up and login via Supabase Auth
- Forgot password and update password flows
- Row Level Security (RLS) on all tables — a user can only ever read or modify their own data
- Server-side Supabase client used for sensitive operations

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router, Server Actions) |
| UI Library | React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Animations | Motion (Framer Motion) v12 |
| AI | Google Gemini (`gemini-3.1-flash-lite-preview`) |
| Backend / Auth | Supabase (PostgreSQL + RLS + Auth) |
| Date Utilities | date-fns v4 |
| Icons | Lucide React |
| Deployment | Vercel |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Home — calendar + daily schedule + attendance marking
│   ├── dashboard/            # Subject-wise attendance breakdown
│   ├── subjects/             # Subject list / grid with stats detail
│   ├── timetable/            # Timetable manager — add, edit, delete, import
│   ├── profile/              # Profile, attendance settings, group preference
│   ├── login / signup /      # Authentication pages
│   │   forgot-password /
│   │   update-password
│   └── actions/
│       ├── extractTimetable.ts   # Gemini AI extraction (Server Action)
│       ├── saveTimetable.ts      # Timetable upsert with conflict resolution
│       └── auth.ts               # Account deletion server action
├── components/
│   ├── BottomNav.tsx         # Mobile navigation bar
│   ├── ProgressRing.tsx      # Animated SVG attendance ring
│   ├── OnboardingModal.tsx   # First-run setup
│   ├── UploadTimetableModal  # File upload → AI parse → import preview
│   ├── AddClassModal / EditClassModal / ScheduleClassModal
│   ├── AddSubjectModal / EditSubjectModal
│   └── SubjectStatsDetail.tsx
└── lib/
    ├── supabase.ts           # Browser client
    └── supabase/server.ts    # Server client (SSR-safe)

supabase/migrations/
├── create_attendance_table.sql
└── add_attendance_settings.sql
```

---

## Database Schema (PostgreSQL via Supabase)

```
users            — profile, enrollment, attendance settings, primary_group
subjects         — subject_name, subject_code, faculty_name, type (Theory/Lab)
timetable        — day_of_week, start_time, end_time, group_designation, is_elective
attendance       — date, status (Present/Absent/Cancelled), FK → timetable + user
```

All tables are protected by Row Level Security. Users can only access rows where `user_id = auth.uid()`.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project
- A [Google AI Studio](https://aistudio.google.com/) API key (for timetable image import)

### Installation

```bash
# Clone the repository
git clone https://github.com/satyam-edu/UniTrack.git
cd UniTrack

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_google_gemini_api_key
```

```bash
# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database Setup

Run the SQL migrations in your Supabase SQL editor:

1. `supabase/migrations/create_attendance_table.sql`
2. `supabase/migrations/add_attendance_settings.sql`

---

## Key Engineering Decisions

**Two-pass AI extraction** — A single Gemini call makes systematic errors on complex timetables (split cells, faculty abbreviations, visual time spans). The second pass sends the first output back to the model alongside the original image, asking it to self-correct specific failure modes. This significantly improves accuracy on real university timetables.

**Optimistic updates** — Attendance marking in the UI is instant. The database write happens in the background. On failure, the state is rolled back to the previous value. This makes the app feel native-fast even on a slow network.

**Overlap detection without a server** — The app computes overlapping slots entirely in the browser using a pairwise time comparison on the filtered day's slots. No server round-trip required.

**Group isolation** — The primary group preference is persisted to the database and cached in `localStorage`. The Home page always renders from this preference, preventing group-selection state from leaking across sessions.

---

## Authors

**Satyam** — [LinkedIn](linkedin.com/in/satyam-in)