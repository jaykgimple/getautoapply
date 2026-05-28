# JobBoxOS — Reference Architecture & Patterns

## Reference Repos Scraped (May 2026)

### 1. career-ops (santifer/career-ops) ⭐ 47.5k
**AI-powered job search system built on Claude Code**

Key patterns:
- **14 skill modes**: job_search, resume_tailor, cover_letter, application_fill, follow_up, networking, interview_prep, salary_negotiation, company_research, batch_apply, analytics, settings, help, export
- **A-F scoring across 10 dimensions**: skills_match, experience_fit, culture_fit, salary_range, growth_potential, commute, company_stability, tech_stack, role_clarity, application_difficulty
- **ATS-optimized CVs per listing**: Extract JD keywords → map to resume bullet points → rewrite bullets to mirror JD language → ensure keyword density 8-12%
- **Batch processing pipeline**: Queue companies → score each → filter threshold → generate tailored docs → fill forms → track status
- **PDF generation**: Go-based dashboard generates PDF resumes with embedded fonts
- **Data model**: Companies → Applications → Documents → Communications (relational)
- **13-factor scoring rubric** for resume tailoring:
  1. Keyword overlap density
  2. Title alignment
  3. Years of experience match
  4. Technical skill coverage
  5. Soft skill evidence
  6. Achievement quantification
  7. Action verb strength
  8. Formatting ATS compatibility
  9. Education relevance
  10. Certification match
  11. Industry terminology
  12. Cultural fit signals
  13. Red flag absence

### 2. ApplyPilot (Pickle-Pixel/ApplyPilot)
**AI agent that applies to jobs on any site**

Key patterns:
- **Chrome DevTools Protocol**: Launches headless Chrome, navigates to each application page
- **Form type detection**: Identifies form structure (multi-step, single-page, ATS-specific)
- **Field mapping**: Maps personal info fields to standardized schema
- **Screening question AI**: Uses context from resume + JD to generate answers
- **Upload automation**: Handles file input fields for resume/cover letter
- **Submission verification**: Confirms successful submission via page state

### 3. ApplyEase (sainikhil1605/ApplyEase) ⭐ Best for Chrome extension
**Privacy-first Chrome extension with local LLMs**

Key patterns:
- **Manifest V3 extension**: background.js + contentscript.js + popup architecture
- **Content script injection**: Detects job application pages, injects UI
- **Form field detection**: DOM selectors for common field names (firstName, lastName, email, phone, etc.)
- **Resume ↔ JD match scoring**: Keyword extraction + overlap calculation
- **Tech-term highlights**: Visual indicators for matching/missing keywords
- **Local LLM integration**: Ollama/LM Studio for privacy (no API calls)
- **Backend (FastAPI)**: Resume parsing, JD analysis, match scoring endpoints

### 4. AutoApply AI (Rayyan9477/AutoApply-AI-Agentic)
**Agentic browser automation for job search**

Key patterns:
- **Multi-platform scraping**: LinkedIn, Indeed, Glassdoor, company career pages
- **Personalized resume generation**: Per-application customization
- **Cover letter automation**: Generated from JD + resume intersection
- **Application tracking**: Status monitoring and follow-up scheduling

### 5. Resumify (Afif718/Resumify) ⭐ Best for resume builder
**Privacy-first resume builder**

Key patterns:
- **6 ATS-friendly templates**: Clean, parseable layouts
- **JSON import/export**: Structured resume data format
- **Full customization**: Colors, sections, ordering
- **No sign-up required**: Runs entirely in browser
- **React + TypeScript + Vite**: Modern frontend stack

---

## JobBoxOS Integration Plan

### Phase 1 Enhancements (from research)
1. **Chrome extension**: Borrow ApplyEase's form detection + content script patterns
2. **Resume scoring**: Borrow career-ops' 13-factor scoring rubric
3. **Tailoring engine**: Borrow Resumify's JSON resume format + career-ops' keyword density approach
4. **Batch processing**: Borrow career-ops' batch pipeline pattern
5. **Dashboard**: Build new (Go-based from career-ops has issues; stick with Next.js)

### Architecture Decisions
- Use **OpenAI API** for resume tailoring (not local LLM — user has OpenAI credits)
- Use **Supabase** for data (already set up)
- Use **Next.js** dashboard (already deployed)
- Use **Chrome extension** for form filling (ApplyEase pattern)
- Use **cron jobs** for batch processing (not GitHub Actions per user instruction)
