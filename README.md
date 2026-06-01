# GetAutoApply

**AI-powered job search, application tracking, and career operations platform.**

Automate your entire job search: discover visa-sponsoring remote jobs from 10+ sources, get AI-tailored resumes and cover letters, track every application through a visual pipeline pipeline, and never let a follow-up slip through the cracks.

**Live:** [https://jobbox-os.vercel.app](https://jobbox-os.vercel.app)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-Stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Job Scraper](#job-scraper)
- [AI Services](#ai-services)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

---

## Features

### Job Discovery
- **10 free job sources** — RemoteOK, Remotive (API + RSS), WeWorkRemotely (RSS), Jobicy, Arbeitnow (EU remote), Greenhouse (45 companies), Lever (35 companies), Remotive RSS (backup), Python.org Jobs RSS, Greenhouse batch 2
- **Real-time search** with source filtering, keyword search, and save-to-list
- **HTML descriptions preserved** — rich formatting with links, bullets, headings rendered natively in job cards
- **Source filter dropdown** — filter by specific job board or view all sources simultaneously
- **~~7~~ 500+ companies** via Greenhouse and Lever board APIs alone

### Visa Sponsorship Checker
- **200+ known sponsor companies** matched by company name
- **Keyword detection** — scans descriptions for terms like "visa sponsorship", "H1B", "TN visa", "relocation"
- **Match scoring** — returns `score` (0–1), `likelihood` (low/medium/high), matched keywords, and reasoning
- Integrated into job detail views — see sponsorship likelihood at a glance

### AI Job Evaluation
Enhanced endpoint at `POST /api/jobs/evaluate` returning a comprehensive 6-block analysis:

1. **Match Assessment** — Fit score, strengths, gaps, red flags
2. **Level Check** — Over-qualified / under-qualified / just right
3. **Compensation Signals** — Salary range detection, equity mentions
4. **CV Customization Plan** — Tailored headline, professional summary, bullet points, ATS keywords
5. **Interview Prep** — Likely interview format, technical questions, behavioral questions, questions to ask the interviewer, study topics
6. **Legitimacy Check** — Red flags, green flags, scam risk score

### AI Ghostwriter
8 writing modes powered by OpenRouter:

| Mode | Use Case |
|------|----------|
| `cover_letter` | Personalized cover letter for a specific job |
| `outreach` | LinkedIn connection request or cold outreach message |
| `interview_prep` | Q&A prep based on the job description |
| `followup` | Post-interview follow-up email |
| `negotiate` | Salary negotiation email/script |
| `resume_bullets` | ATS-optimized resume bullet points |
| `thank_you` | Post-interview thank you note |
| `company_research` | Quick company research summary |

Per-job chat context — selects a tracked job as context, pick a mode, add optional context, get AI-generated text ready to copy.

### Application Pipeline (Kanban)
Visual Kanban board tracking applications through stages:

```
Saved → Applied → Screening → Interview → Offer → Accepted
                                      │
                                   Rejected / Ghosted / Withdrawn
```

- **Drag-and-drop status updates** (via dropdown on each card)
- **AI score badge** on each card showing match quality
- **Cover letter / tailored CV** quick-access buttons per application
- **Interview scheduling** with date, type, interviewer, and notes fields

### Follow-Up Cadence Tracker
- **Automatic cadence suggestions** — 3 days after apply, 7 days after first follow-up, 14 days after second
- **Overdue indicators** — red badges on Kanban cards where follow-up is past due
- **Contact logging** — record who you contacted, when, and what was discussed
- **Dashboard summary** — see how many applications need follow-up today

### Analytics Dashboard
- **Pipeline funnel** — conversion rates between each stage
- **Response rate by source** — which job boards lead to interviews
- **Pipeline velocity** — average days between stages
- **Weekly application count** tracking

### ATS-Tailored CV Generation
- `POST /api/cv/generate` — generates clean, ATS-friendly HTML tailored to a specific job
- Keyword extraction from job description → injects matching terms into summary and skills
- Professional formatting: contact info, headline, summary, skills, experience, education
- Uses your Profile data (work history, education, skills) as the base

### Multi-Source Job Scraper
The scraper (`scripts/scrape_all_sources.py`) runs via cron every 10 minutes:

| Source | Type | Coverage |
|--------|------|----------|
| RemoteOK | JSON API | Global remote jobs |
| Remotive | JSON API | Global remote jobs |
| Remotive RSS | RSS Feed | Backup/additional listings |
| WeWorkRemotely | RSS Feed | Programming, Design, DevOps |
| Jobicy | JSON API | Global remote (US + EU) |
| Arbeitnow | JSON API | EU remote jobs |
| Greenhouse | JSON API (45 companies) | Stripe, Airbnb, Notion, Figma, Vercel, Supabase, Anthropic, OpenAI, Datadog, Shopify, Uber, Spotify, Snap, etc. |
| Lever | JSON API (35 companies) | Netlify, Render, Railway, Prisma, Vercel, Neon, Cohere, Sentry, Cloudflare, Shopify, etc. |
| Python.org | RSS Feed | Python-specific jobs |
| Greenhouse Batch 2 | JSON API (20 more) | Gong, Deel, Rippling, Gusto, Plaid, Ramp, Brex, Chime, Mercury, Carta |

**134+ jobs per full scrape run** with deduplication (URL-based), job type normalization, and HTML preservation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                     │
│  Dark theme · CSS variables · Mobile-first responsive        │
│                                                               │
│  /dashboard    Analytics funnel + stats + overdue followups  │
│  /search       Job discovery with HTML card rendering        │
│  /jobs         Saved jobs list                               │
│  /applications Kanban pipeline with AI scoring               │
│  /ghostwriter  AI chat: cover letters, outreach, prep        │
│  /profile      CV/Resume builder (5 tabs)                    │
│  /outreach     Email outreach management                     │
│  /calendar     Application/interview calendar                 │
│  /settings     Account settings                              │
└─────────────────────-┬───────────────────────────────────────┘
                      │ Server Components + Client Components
┌─────────────────────▼───────────────────────────────────────┐
│                    API Routes (Next.js)                        │
│                                                               │
│  /api/jobs/search        Full-text job search + source filter│
│  /api/jobs/save          Save/unsave jobs                    │
│  /api/jobs/enrich        AI enrichment (score, summary, CV)  │
│  /api/jobs/evaluate      6-block AI job evaluation           │
│  /api/jobs/visa-check    Visa sponsorship scoring            │
│  /api/jobs/ghostwriter   AI writing assistant (8 modes)      │
│  /api/analytics          Funnel, sources, velocity stats     │
│  /api/followup           Follow-up cadence tracking          │
│  /api/cv/generate        ATS-tailored CV generation          │
│  /api/ai/resume          AI resume parsing/generation        │
│  /api/ai/outreach        AI outreach message generation      │
│  /api/ai/linkedin        LinkedIn OAuth integration          │
│  /api/scrape             Trigger manual scrape               │
│  /api/calendar/events    Interview/event scheduling          │
│  /api/resumes/upload     Resume file upload + parsing        │
│  /api/notifications/prefs Notification settings              │
│  /api/account/delete     Account deletion                    │
└─────────────────────-┬───────────────────────────────────────┘
                      │ Supabase-js (REST + Auth)
┌─────────────────────▼───────────────────────────────────────┐
│                    Supabase (PostgreSQL)                       │
│                                                               │
│  jobs                  All scraped jobs (HTML descriptions)   │
│  saved_jobs            User's saved/bookmarked jobs           │
│  tracked_applications  Application pipeline per user per job  │
│  application_stage_log Status change history                  │
│  interview_rounds      Scheduled interviews                  │
│  user_job_profiles     User preferences (roles, salary, etc.) │
│  profiles              User profile data                      │
│  candidate_profiles    Extended candidate CV data             │
│  resumes               Uploaded/generated resume files        │
│  user_roles            Role-based access (admin/candidate/recruiter) │
│  outreach_messages     Sent outreach tracking                 │
│  contacts              Professional network contacts           │
│  connections           LinkedIn connections                   │
│  education_history_items Education entries                    │
│  work_history_items    Work experience entries                │
│  portfolio_projects    Portfolio items                        │
│  followup_templates    Follow-up email templates              │
│  job_alerts / v2      Saved search alerts                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Python Scraper (runs via cron)                   │
│                                                               │
│  scripts/scrape_all_sources.py   Main multi-source scraper   │
│  scripts/scrape_cron.sh          Cron runner (rotating pairs)│
│  scripts/cleanup_stale.py        Hourly stale job cleanup     │
│                                                               │
│  Schedule: scrape_cron.sh every 10 min (5 source pairs/rotation) │
│            cleanup_stale.py every 60 min                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (React 18, TypeScript) |
| **Styling** | Tailwind CSS + CSS custom properties (dark theme) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (email, LinkedIn OAuth) |
| **AI** | OpenRouter API (access to Claude, GPT-4, etc.) |
| **Scraping** | Python 3 (requests, BeautifulSoup, ElementTree) |
| **Validation** | Zod |
| **Deployment** | Vercel |
| **Icons** | Lucide React |
| **Date handling** | date-fns |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- Supabase account + project
- OpenRouter API key (for AI features)

### 1. Clone and install
```bash
git clone https://github.com/jaykgimple/getautoapply.git
cd getautoapply
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local with your values (see below)
```

### 3. Set up the database
Run the SQL migrations in your Supabase project (in order):
```bash
supabase db query --linked -f supabase/migrations/20260601000000_platform_overhaul.sql
supabase db query --linked -f supabase/migrations/002_job_ops_pipeline.sql
supabase db query --linked -f supabase/migrations/003_followup_tracking.sql
```

### 4. Run locally
```bash
npm run dev
# Open http://localhost:3000
```

### 5. Set up the job scraper
```bash
pip install requests beautifulsoup4
python3 scripts/scrape_all_sources.py --max-per-source 50   # One-time full scrape

# Or set up the cron:
crontab -e
# Add: */10 * * * * /path/to/getautoapply/scripts/scrape_cron.sh
```

---

## Environment Variables

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter (required for AI features)
OPENROUTER_API_KEY=your-openrouter-key

# Vercel (for deploy scripts)
VERCEL_TOKEN=your-vercel-token
VERCEL_TEAM_ID=your-team-id
```

---

## Database Schema

### Core Tables

**`jobs`** — All discovered job listings
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | TEXT | Job title |
| company | TEXT | Company name |
| location | TEXT | Location (e.g., "Remote") |
| job_url | TEXT | Original job posting URL |
| description | TEXT | Full HTML description (preserved from source) |
| source | TEXT | Source board (remoteok, remotive, greenhouse, etc.) |
| salary_min | NUMERIC | Minimum salary |
| salary_max | NUMERIC | Maximum salary |
| job_type | TEXT | full_time, part_time, contract, etc. |
| remote_type | TEXT | remote / onsite / hybrid |
| match_score_ai | REAL | AI-calculated match score (0–100) |
| ai_summary | TEXT | AI-generated 1-paragraph summary |
| visa_sponsor_score | REAL | Visa sponsorship likelihood (0–1) |
| is_active | BOOLEAN | Job is still available |
| status | TEXT | discovered / processing / ready / expired |

**`tracked_applications`** — User's application pipeline
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID → auth.users | Owner |
| job_id | UUID → jobs | Associated job |
| status | TEXT | saved/applied/screening/interview/offer/rejected/ghosted/withdrawn |
| cover_letter TEXT | Generated/stored cover letter |
| tailored_resume_path | TEXT | Path to generated PDF |
| followup_count | INTEGER | Number of follow-ups sent |
| next_followup_at | TIMESTAMPTZ | When to follow up next |
| last_contact_at | TIMESTAMPTZ | Last contact timestamp |
| rating | INTEGER | User's interest rating (1–5) |

**`interview_rounds`** — Interview scheduling
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| application_id | UUID → tracked_applications | Associated application |
| round_number | INTEGER | First, second, third... |
| interview_type | TEXT | phone/technical/behavioral/onsite/final |
| scheduled_at | TIMESTAMPTZ | Interview date/time |
| interviewer_name | TEXT | Interviewer's name |
| notes | TEXT | Prep notes |
| outcome | TEXT | pending/passed/failed/no_show |

---

## API Endpoints

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs/search?q=python&source=remoteok` | Search jobs with optional source filter |
| POST | `/api/jobs/save` | Save a job to user's list (body: `{job_id}`) |
| DELETE | `/api/jobs/save` | Unsave a job |
| POST | `/api/jobs/enrich` | AI enrichment: match score, summary, tailored CV (body: `{job_id}`) |
| POST | `/api/jobs/evaluate` | Full 6-block AI evaluation (body: `{job_id}`) |
| POST | `/api/jobs/visa-check` | Visa sponsorship check (body: `{description, companyName}` or `{job_id}`) |
| POST | `/api/jobs/ghostwriter` | AI writing assistant (body: `{job_id, mode, context?}`) |

### Analytics & Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics?type=funnel\|sources\|velocity\|overview` | Dashboard statistics |
| GET | `/api/followup` | List follow-ups for current user |
| POST | `/api/followup` | Log contact + schedule next follow-up |
| PUT | `/api/followup` | Update follow-up (mark done, reschedule) |

### CV & Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cv/generate` | Generate ATS-tailored CV (body: `{job_id}`) |
| POST | `/api/resumes/upload` | Upload existing resume file (.docx, .pdf) |

---

## Job Scraper

### Run all sources
```bash
python3 scripts/scrape_all_sources.py --max-per-source 100
```

### Run single source
```bash
python3 scripts/scrape_all_sources.py --source greenhouse --max-per-source 50
python3 scripts/scrape_all_sources.py --source remoteok
```

### List available sources
```bash
python3 scripts/scrape_all_sources.py --list-sources
```

### Cron schedule
The `scrape_cron.sh` script rotates through 5 source pairs on each 10-minute run:

| Minute | Sources Scraped |
|--------|----------------|
| 0, 10, 20... | remoteok + remotive |
| 30, 40, 50... | weworkremotely + jobicy |
| 60=0, 70=10 | arbeitnow + greenhouse |
| 90=0, 100=10 | lever + remotive_rss |
| 120=0, 130=10 | python_jobs + greenhouse2 |

Each pair scrapes `--max-per-source 50` by default. The script prevents overwhelming the Supabase REST API by deduplicating on URL.

### Data handling
- Job descriptions stored as **raw HTML** (not stripped) — rendered with sanitized `dangerouslySetInnerHTML` in the frontend
- Deduplication by `job_url` — same job from different sources won't be inserted twice
- `normalize_job_type()` normalizes diverse API formats (arrays, hyphens, spaces) to DB-allowed values
- Stale job cleanup runs hourly via `cleanup_stale.py`

---

## AI Services

All AI features use the [OpenRouter API](https://openrouter.ai), giving access to Claude, GPT-4, and other models through a single endpoint.

### AI Client Setup (`src/lib/ai/resume.ts`)
```typescript
import { getClient } from '@/lib/ai/resume'

const client = getClient() // OpenRouter client
```

### Available AI Operations
1. **Job Enrichment** (`/api/jobs/enrich`) — match score, AI summary, tailored resume JSON, cover letter
2. **Job Evaluation** (`/api/jobs/evaluate`) — 6-block analysis (match, leveling, comp, CV plan, interview prep, legitimacy)
3. **Ghostwriter** (`/api/jobs/ghostwriter`) — 8 writing modes with per-job context
4. **CV Generation** (`/api/cv/generate`) — ATS-friendly HTML CV tailored to specific job keywords
5. **Resume Upload Parsing** (`/api/resumes/upload`) — extract structured data from .docx/.pdf files

---

## Deployment

### Vercel
```bash
# Set env vars
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OPENROUTER_API_KEY

# Deploy
vercel deploy --prod
```

### Environment variables required on Vercel
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`

---

## Project Structure

```
getautoapply/
├── scripts/                         # Python scraper suite
│   ├── scrape_all_sources.py        # Main multi-source scraper (10 sources)
│   ├── scrape_cron.sh              # Cron runner (rotating pairs)
│   ├── cleanup_stale.py            # Hourly stale job cleanup
│   ├── scrape_one.py               # Single-job scraper
│   └── scheduler.py                # Legacy scheduler
│
├── src/
│   ├── app/
│   │   ├── (auth)/                 # Auth routes
│   │   │   ├── login/page.tsx      # Login page
│   │   │   ├── signup/page.tsx     # Signup page
│   │   │   └── auth/callback/      # OAuth callback
│   │   │
│   │   ├── (dashboard)/            # Protected dashboard routes
│   │   │   ├── layout.tsx          # Dashboard layout + sidebar nav
│   │   │   ├── dashboard/page.tsx  # Analytics overview
│   │   │   ├── search/page.tsx     # Job discovery + HTML card rendering
│   │   │   ├── jobs/page.tsx       # Saved jobs
│   │   │   ├── applications/page.tsx  # Kanban pipeline
│   │   │   ├── ghostwriter/page.tsx   # AI writing assistant
│   │   │   ├── profile/page.tsx    # CV/Resume builder (5 tabs)
│   │   │   ├── outreach/page.tsx   # Outreach management
│   │   │   ├── calendar/page.tsx   # Interview/event calendar
│   │   │   ├── settings/page.tsx   # Settings
│   │   │   └── admin/page.tsx      # Admin panel (admin role)
│   │   │
│   │   └── api/                    # API routes
│   │       ├── jobs/
│   │       │   ├── search/route.ts    # GET search + POST save
│   │       │   ├── enrich/route.ts    # AI enrichment
│   │       │   ├── evaluate/route.ts  # 6-block AI evaluation
│   │       │   ├── visa-check/route.ts  # Visa sponsorship scoring
│   │       │   └── ghostwriter/route.ts # AI writing assistant
│   │       ├── analytics/route.ts     # Dashboard statistics
│   │       ├── followup/route.ts      # Follow-up cadence tracking
│   │       ├── cv/generate/route.ts   # ATS-tailored CV generation
│   │       ├── ai/resume.ts           # AI resume client + helpers
│   │       ├── ai/outreach/route.ts   # AI outreach generation
│   │       ├── ai/linkedin/route.ts   # LinkedIn OAuth
│   │       ├── calendar/events/       # Calendar event CRUD
│   │       ├── resumes/upload/        # Resume file upload
│   │       └── scrape/route.ts        # Manual scrape trigger
│   │
│   ├── lib/
│   │   ├── ai/resume.ts           # OpenRouter AI client
│   │   ├── scraper/index.ts       # Scraper TypeScript interface
│   │   └── supabase/              # Supabase client config
│   │       ├── client.ts          # Browser client
│   │       ├── server.ts          # Server client (with cookies)
│   │       ├── admin.ts           # Service role client
│   │       ├── auth.ts            # Auth helpers
│   │       └── types.ts           # TypeScript types
│   │
│   ├── types/database.ts          # Database type definitions
│   ├── middleware.ts              # Auth middleware
│   └── globals.css               # Global styles + dark theme CSS vars
│
├── supabase/migrations/           # Database migrations (run in order)
│   ├── 20260601000000_platform_overhaul.sql  # Roles, profiles, tables
│   ├── 002_job_ops_pipeline.sql              # Application tracking tables
│   └── 003_followup_tracking.sql             # Follow-up columns + indexes
│
├── .env.example                   # Environment variable template
├── .env.local                     # Local environment (gitignored)
├── next.config.js                 # Next.js config
├── tailwind.config.ts             # Tailwind config
├── tsconfig.json                  # TypeScript config
└── package.json
```

---

## Design System

The app uses a dark theme with CSS custom properties defined in `globals.css`:

```css
:root {
  --bg-base: #0a0a0a;
  --bg-elevated: #141414;
  --bg-card: #1a1a1a;
  --text-primary: #e5e5e5;
  --text-secondary: #a3a3a3;
  --border: #262626;
  --brand: #60a5fa;        /* Blue accent */
  --brand-dark: #3b82f6;
  --success: #22c55e;
  --warning: #eab308;
  --danger: #ef4444;
}
```

Job description HTML is rendered using the `.description-html` CSS class which styles headings, links, lists, and other HTML elements within cards.

---

## License

Private project by Jay Gimple.
