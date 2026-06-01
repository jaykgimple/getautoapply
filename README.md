# GetAutoApply

**Stop disappearing into the black hole. Track, tailor, and take control of your job search.**

GetAutoApply is an AI-powered job search operations platform that handles the entire pipeline — from discovering jobs across 10+ boards to tailoring your CV, tracking every application through a visual Kanban pipeline, and making sure you never forget to follow up.

**Live:** [https://jobbox-os.vercel.app](https://jobbox-os.vercel.app)

---

## The Problem

You apply to 50 jobs and hear back from 2. You forget which companies you applied to when. You send the same generic resume to every posting. Requests go into "we'll keep your resume on file" and you never follow up. Weeks slip by and you have no idea where anything stands.

This is the **black hole** — and it's not your fault. There's no free tool that connects job discovery → tailored applications → pipeline tracking → follow-up cadence into one workflow.

## How GetAutoApply Fixes It

### 1. Discover from Everywhere
Jobs aggregated from **10 boards** into one searchable feed — LinkedIn, Indeed, RemoteOK, Remotive, WeWorkRemotely, Jobicy, Arbeitnow, Greenhouse (45 tech companies), Lever (35 tech companies), and Python.org. No more tab-switching. No missed postings.

### 2. Know Before You Apply
Each job gets an **AI evaluation**: fit score, experience level match, red flags, CV customization plan, interview prep questions, and legitimacy check. Stop wasting 30 minutes applying to jobs you're overqualified for.

### 3. Tailor or Die
The **Ghostwriter** generates cover letters, LinkedIn outreach messages, salary negotiation scripts, interview prep, and tailored resume bullets — all contextualized to the specific job + your profile. Generated. Ready to copy-paste. Done.

### 4. Track Everything
A **visual Kanban pipeline** shows every application's status at a glance: Saved → Applied → Screening → Interview → Offer. No more "did I apply to that?" No more spreadsheet chaos.

### 5. Never Forget to Follow Up
The **follow-up cadence tracker** flags overdue follow-ups with red badges. 3 days after applying, 7 days after first follow-up, 14 days after second — it tells you when to nudge. Most "rejections" are just silence from a busy recruiter who forgot. This fixes that.

### 6. Close the Loop
Analytics dashboard with your **conversion funnel** (saved→applied→interview→accept), response rates by source, and pipeline velocity. See what's working. Double down on the boards that actually call back.

---

## Job Sources

| Source | Type | What You Get |
|--------|------|-------------|
| **LinkedIn** | JobSpy scraper | Thousands of US remote/hybrid roles |
| **Indeed** | JobSpy scraper | Broad US job market coverage |
| **RemoteOK** | Free JSON API | Startup & tech remote jobs |
| **Remotive** | Free JSON + RSS | Curated remote jobs (tech, marketing, support) |
| **WeWorkRemotely** | RSS feed | Programming, Design, DevOps |
| **Jobicy** | Free JSON API | Global remote (US + EU regions) |
| **Arbeitnow** | Free JSON API | EU-focused remote jobs |
| **Greenhouse** | JSON API (45 companies) | Stripe, Airbnb, Notion, Fencer, Vercel, Supabase, Anthropic, OpenAI, Datadog, Shopify, Uber, Spotify, Snap + 33 more |
| **Lever** | JSON API (35 companies) | Netlify, Render, Railway, Prisma, Neon, Cohere, Sentry, Cloudflare + 28 more |
| **Python.org** | RSS feed | Python-specific roles |
| **Manual** | User-added | Any job you paste in yourself |

> **LinkedIn + Indeed alone account for ~7,600+ jobs** via the JobSpy incremental scraper, which runs a different search term every 10 minutes from a rotating list of 300+ software engineering roles.

---

## Features

### AI Job Evaluation
`POST /api/jobs/evaluate` — Six-block analysis per job:
1. **Match** — Fit score, strengths, gaps, red flags
2. **Level** — Over-qualified / under-qualified / just right
3. **Compensation** — Salary signals, equity mentions
4. **CV Plan** — Tailored headline, summary bullets, ATS keywords
5. **Interview Prep** — Likely format, technical/behavioral questions, questions to ask, study topics
6. **Legitimacy** — Scam risk score, green flags, red flags

### AI Ghostwriter
Eight writing modes, all contextualized to a specific job + your profile:

| Mode | Use Case |
|------|----------|
| `cover_letter` | Personalized cover letter |
| `outreach` | LinkedIn cold outreach message |
| `interview_prep` | Q&A prep based on the job description |
| `followup` | Post-interview follow-up email |
| `negotiate` | Salary negotiation script |
| `resume_bullets` | ATS-optimized resume bullets |
| `thank_you` | Post-interview thank you note |
| `company_research` | Quick company research brief |

### Visa Sponsorship Detector
Checks every job against a database of **200+ known sponsor companies** and scans descriptions for sponsorship keywords ("H1B", "TN visa", "visa sponsorship", "relocation"). Returns a score (0–1) with reasoning. Not the headline feature — but it's there when you need it.

### ATS-Tailored CV Generation
`POST /api/cv/generate` — Takes your profile data + a specific job description. Extracts keywords from the posting and generates a clean, ATS-friendly HTML CV that mirrors the language hiring managers and resume robots are scanning for.

### Application Pipeline (Kanban)
- Statuses: Saved → Applied → Screening → Interview → Offer → Accepted / Rejected / Ghosted / Withdrawn
- AI score badge on each card
- One-click cover letter / tailored CV access
- Interview scheduling with round tracking (phone, technical, behavioral, on-site, final)

### Follow-Up Cadence Tracker
- Auto-scheduled follow-ups based on stage: 3 days post-apply, 7 days post-first-follow-up, 14 days post-second
- Red overdue badges on Kanban cards and dashboard summary
- Contact logging (who, when, what was discussed)

### Analytics Dashboard
- Pipeline funnel with conversion rates between stages
- Response rate by source (which boards actually call back)
- Pipeline velocity (avg days per stage)
- Weekly application count

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, TypeScript |
| **Styling** | Tailwind CSS + CSS custom properties (dark theme) |
| **Database** | Supabase (PostgreSQL) with Row-Level Security |
| **Auth** | Supabase Auth (email + LinkedIn OAuth) |
| **AI** | OpenRouter API (Claude, GPT-4, etc. via single endpoint) |
| **Scraping** | Python 3: JobSpy (LinkedIn/Indeed) + requests/bs4 (free APIs) |
| **Validation** | Zod |
| **Deployment** | Vercel |
| **Icons** | Lucide React |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+ with `requests`, `beautifulsoup4`, `jobspy`
- Supabase project (free tier works)
- OpenRouter API key

### 1. Clone and install
```bash
git clone https://github.com/jaykgimple/getautoapply.git
cd getautoapply
npm install
pip install requests beautifulsoup4 jobspy
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Fill in the required values (see below)
```

### 3. Set up the database
Run migrations in your Supabase project SQL editor (in order):
1. `supabase/migrations/20260601000000_platform_overhaul.sql` — Roles, profiles, core tables
2. `supabase/migrations/002_job_ops_pipeline.sql` — Application tracking, interview rounds
3. `supabase/migrations/003_followup_tracking.sql` — Follow-up cadence columns + indexes

```bash
supabase db query --linked -f supabase/migrations/20260601000000_platform_overhaul.sql
supabase db query --linked -f supabase/migrations/002_job_ops_pipeline.sql
supabase db query --linked -f supabase/migrations/003_followup_tracking.sql
```

### 4. Populate initial jobs
```bash
# Full scrape of all free API sources
python3 scripts/scrape_all_sources.py --max-per-source 100

# Incremental JobSpy scrape (LinkedIn + Indeed, rotates search terms)
python3 scripts/scrape_one.py "software engineer" both
```

### 5. Set up the cron
```bash
chmod +x scripts/scrape_cron.sh
crontab -e
# Add these two lines:
*/10 * * * * /path/to/getautoapply/scripts/scrape_cron.sh
0  * * * * cd /path/to/getautoapply && python3 scripts/cleanup_stale.py >> scripts/cleanup.log 2>&1
```

### 6. Run locally
```bash
npm run dev
# Open http://localhost:3000
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
| location | TEXT | Location |
| job_url | TEXT | Original posting URL |
| description | TEXT | Full HTML description (preserved from source) |
| source | TEXT | `jobspy_linkedin`, `jobspy_indeed`, `remoteok`, `remotive`, `weworkremotely`, `jobicy`, `arbeitnow`, `greenhouse`, `lever`, `python_jobs`, `manual` |
| salary_min / salary_max | NUMERIC | Salary range |
| job_type | TEXT | `full_time`, `part_time`, `contract`, etc. |
| remote_type | TEXT | `remote`, `onsite`, `hybrid` |
| match_score_ai | REAL | AI match score (0–100) |
| ai_summary | TEXT | AI-generated summary |
| visa_sponsor_score | REAL | 0–1 sponsorship likelihood |
| is_active | BOOLEAN | Still available |
| status | TEXT | `discovered`, `processing`, `ready`, `expired` |
| created_at | TIMESTAMPTZ | Insertion time |

**`tracked_applications`** — Application pipeline per user
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID → auth.users | Owner |
| job_id | UUID → jobs | Associated job |
| status | TEXT | `saved`, `applied`, `screening`, `interview`, `offer`, `rejected`, `ghosted`, `withdrawn` |
| cover_letter | TEXT | Generated/stored cover letter |
| tailored_resume_path | TEXT | Path to generated PDF |
| followup_count | INTEGER | Number of follow-ups sent |
| next_followup_at | TIMESTAMPTZ | When to follow up next |
| last_contact_at | TIMESTAMPTZ | Last contact timestamp |
| rating | INTEGER | User interest (1–5) |

**`interview_rounds`** — Interview scheduling
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| application_id | UUID → tracked_applications | Parent application |
| round_number | INTEGER | 1st, 2nd, 3rd... |
| interview_type | TEXT | `phone`, `technical`, `behavioral`, `onsite`, `final` |
| scheduled_at | TIMESTAMPTZ | Date/time |
| interviewer_name | TEXT | Interviewer |
| notes | TEXT | Prep notes |
| outcome | TEXT | `pending`, `passed`, `failed`, `no_show` |

Additional tables: `profiles`, `candidate_profiles`, `resumes`, `user_job_profiles`, `user_roles`, `outreach_messages`, `contacts`, `connections`, `work_history_items`, `education_history_items`, `portfolio_projects`, `followup_templates`, `job_alerts`, `application_stage_log`.

---

## API Reference

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs/search?q=python&source=remoteok&page=1` | Search with optional source filter. Source groups: `jobspy` matches LinkedIn+Indeed, `greenhouse` matches all greenhouse_*, `remotive` matches all remotive_* |
| POST | `/api/jobs/save` | Save job (`{job_id}`) |
| DELETE | `/api/jobs/save` | Unsave job |
| POST | `/api/jobs/enrich` | AI enrichment (`{job_id}`) → score, summary, tailored CV |
| POST | `/api/jobs/evaluate` | 6-block AI evaluation (`{job_id}`) |
| POST | `/api/jobs/visa-check` | Visa sponsor check (`{description, companyName}` or `{job_id}`) |
| POST | `/api/jobs/ghostwriter` | AI writing (`{job_id, mode, context?}`) |

### Tracking & Follow-up
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics?type=funnel\|sources\|velocity\|overview` | Dashboard statistics |
| GET | `/api/followup` | List user's follow-ups |
| POST | `/api/followup` | Log contact (`{application_id, contact_type, note?}`) |
| PUT | `/api/followup` | Update follow-up (`{id, done/reschedule}`) |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cv/generate` | Generate ATS-tailored CV (`{job_id}`) |
| POST | `/api/resumes/upload` | Upload resume file (.docx/.pdf) |

---

## Scraper Architecture

Two scraper systems fill the database:

### 1. Free API Scraper (`scripts/scrape_all_sources.py`)
Runs every 10 minutes via cron, rotating through 6 pairs:

| Rotation | Sources |
|----------|---------|
| 0 | RemoteOK + Remotive API |
| 1 | WeWorkRemotely RSS + Jobicy |
| 2 | Arbeitnow + Greenhouse (25 companies) |
| 3 | Lever (25 companies) + Python.org |
| 4 | Remotive RSS + Remotive batch 2 |
| 5 | Greenhouse batch 20 companies) |

Handles: HTTP APIs, RSS/XML parsing, HTML description preservation, URL deduplication, job type normalization.

### 2. JobSpy Incremental Scraper (`scripts/scrape_one.py` + `scripts/scheduler.py`)
Runs on rotation step 4 (every ~60 min). Picks the least-recently-scraped search term from a 300+ term list covering software engineering, data, DevOps, mobile, and management roles. Scrapes both LinkedIn and Indeed per term. Results stored with `jobspy_linkedin` / `jobspy_indeed` source labels.

### 3. Stale Job Cleanup (`scripts/cleanup_stale.py`)
Hourly. Marks old inactive jobs as expired to keep the search feed fresh.

---

## Deployment

### Vercel (recommended)
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OPENROUTER_API_KEY

vercel deploy --prod
```

Required env vars on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`

---

## Project Structure

```
getautoapply/
├── scripts/                          # Python scraper suite
│   ├── scrape_all_sources.py         # Free API multi-source scraper (10 sources)
│   ├── scrape_one.py                 # JobSpy single-term scraper (LinkedIn + Indeed)
│   ├── scheduler.py                  # 300+ search term rotation engine
│   ├── scrape_cron.sh                # Cron runner (6-step rotation)
│   ├── cleanup_stale.py              # Hourly stale job cleanup
│   ├── scrape_all.py                 # Legacy full scraper
│   └── daily_scrape.sh              # Legacy daily run script
│
├── src/app/
│   ├── (auth)/login|signup/         # Authentication
│   ├── (dashboard)/
│   │   ├── layout.tsx               # Sidebar nav + role-based access
│   │   ├── dashboard/page.tsx       # Analytics funnel + stats + follow-ups
│   │   ├── search/page.tsx          # Job discovery + source filter + HTML cards
│   │   ├── jobs/page.tsx            # Saved jobs
│   │   ├── applications/page.tsx    # Kanban pipeline
│   │   ├── ghostwriter/page.tsx     # AI writing assistant
│   │   ├── profile/page.tsx         # CV/Resume builder (5 tabs)
│   │   ├── outreach/page.tsx        # Outreach management
│   │   ├── calendar/page.tsx        # Interview/event calendar
│   │   ├── settings/page.tsx        # Account settings
│   │   └── admin/page.tsx           # Admin panel
│   │
│   └── api/
│       ├── jobs/
│       │   ├── search/route.ts      # Job search + source filtering
│       │   ├── save/route.ts        # Save/unsave
│       │   ├── enrich/route.ts      # AI enrichment
│       │   ├── evaluate/route.ts    # 6-block evaluation
│       │   ├── visa-check/route.ts  # Visa sponsorship scoring
│       │   └── ghostwriter/route.ts # AI writing (8 modes)
│       ├── analytics/route.ts        # Dashboard stats
│       ├── followup/route.ts         # Follow-up tracking
│       ├── cv/generate/route.ts      # ATS-tailored CV
│       ├── ai/resume.ts              # OpenRouter AI client
│       ├── ai/outreach/route.ts      # AI outreach generation
│       ├── ai/linkedin/route.ts      # LinkedIn OAuth
│       ├── calendar/events/         # Calendar CRUD
│       ├── resumes/upload/           # Resume file upload
│       └── scrape/route.ts           # Manual scrape trigger
│
├── src/lib/
│   ├── ai/resume.ts                  # OpenRouter client setup
│   ├── scraper/index.ts             # TS scraper interface
│   └── supabase/
│       ├── client.ts                # Browser Supabase client
│       ├── server.ts                # Server client (cookie auth)
│       ├── admin.ts                 # Service role client
│       ├── auth.ts                  # Auth helpers
│       └── types.ts                 # TypeScript types
│
├── supabase/migrations/
│   ├── 20260601000000_platform_overhaul.sql  # Roles, profiles, core tables
│   ├── 002_job_ops_pipeline.sql              # Application tracking tables
│   └── 003_followup_tracking.sql             # Follow-up columns + indexes
│
├── .env.example                     # Env var template
├── next.config.js                   # Next.js config
├── tailwind.config.ts               # Tailwind config (dark theme)
└── package.json
```

---

## Design System

Dark theme driven by CSS custom properties (`globals.css`):

```css
:root {
  --bg-base: #0a0a0a;
  --bg-elevated: #141414;
  --bg-card: #1a1a1a;
  --text-primary: #e5e5e5;
  --text-secondary: #a3a3a3;
  --border: #262626;
  --brand: #60a5fa;
  --success: #22c55e;
  --warning: #eab308;
  --danger: #ef4444;
}
```

Job descriptions render as sanitized HTML (`.description-html` class) — preserving the original formatting, links, and structure from the source board.

---

## License

Private project by Jay Gimple.
