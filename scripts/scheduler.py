#!/usr/bin/env python3
"""
Scheduler: picks the next search term to scrape.
Priority:
  1. User-saved active search terms that haven't been scraped in 2+ hours
  2. Default curated terms, least recently scraped first
  3. Round-robin fallback
"""
import subprocess, json, sys

# Comprehensive role list — covers all major job categories
# Format: "title" — JobSpy will search LinkedIn + Indeed for each
DEFAULT_TERMS = [
    # ── SOFTWARE ENGINEERING ──
    "software engineer",
    "senior software engineer",
    "staff software engineer",
    "principal software engineer",
    "lead software engineer",
    "full stack developer",
    "full stack engineer",
    "backend engineer",
    "backend developer",
    "frontend developer",
    "frontend engineer",
    "web developer",
    "application developer",
    "software developer",
    "software development engineer",
    "junior software developer",
    "entry level software engineer",

    # ── MOBILE ──
    "mobile developer",
    "iOS developer",
    "Android developer",
    "mobile engineer",
    "iOS engineer",
    "Android engineer",
    "react native developer",
    "flutter developer",

    # ── INFRA / DEVOPS / SRE / CLOUD ──
    "devops engineer",
    "site reliability engineer",
    "SRE",
    "infrastructure engineer",
    "cloud engineer",
    "cloud architect",
    "AWS engineer",
    "Azure engineer",
    "GCP engineer",
    "platform engineer",
    "release engineer",
    "build engineer",
    "systems engineer",
    "network engineer",
    "network administrator",
    "database administrator",
    "DBA",
    "storage engineer",

    # ── SECURITY ──
    "security engineer",
    "cybersecurity engineer",
    "information security analyst",
    "security analyst",
    "application security engineer",
    "security architect",
    "penetration tester",
    "ethical hacker",
    "SOC analyst",
    "incident response analyst",
    "GRC analyst",
    "compliance analyst",

    # ── DATA ENGINEERING ──
    "data engineer",
    "senior data engineer",
    "staff data engineer",
    "data pipeline engineer",
    "ETL developer",
    "data warehouse engineer",
    "big data engineer",
    "analytics engineer",
    "data infrastructure engineer",
    "data platform engineer",
    "data architect",
    "data modeler",
    "database engineer",
    "BI engineer",
    "business intelligence engineer",
    "BI developer",
    "data governance analyst",
    "data quality engineer",

    # ── DATA SCIENCE ──
    "data scientist",
    "senior data scientist",
    "staff data scientist",
    "principal data scientist",
    "applied scientist",
    "research scientist",
    "decision scientist",
    "quantitative analyst",
    "quant analyst",
    "data science manager",
    "data science lead",

    # ── MACHINE LEARNING / AI ──
    "machine learning engineer",
    "ML engineer",
    "senior ML engineer",
    "staff ML engineer",
    "machine learning scientist",
    "deep learning engineer",
    "AI engineer",
    "artificial intelligence engineer",
    "NLP engineer",
    "natural language processing engineer",
    "computer vision engineer",
    "speech recognition engineer",
    "robotics engineer",
    "MLOps engineer",
    "AI researcher",
    "ML researcher",
    "gen AI engineer",
    "generative AI engineer",
    "prompt engineer",
    "AI architect",
    "conversational AI engineer",
    "AI product manager",
    "autonomous systems engineer",
    "reinforcement learning engineer",

    # ── PRODUCT MANAGEMENT ──
    "product manager",
    "senior product manager",
    "director of product",
    "product owner",
    "technical product manager",
    "product lead",
    "product director",
    "platform product manager",
    "growth product manager",
    "AI product manager",
    "data product manager",
    "associate product manager",
    "APM",
    "group product manager",
    "VP product",

    # ── PROJECT / PROGRAM MANAGEMENT ──
    "project manager",
    "program manager",
    "technical program manager",
    "TPM",
    "scrum master",
    "agile coach",
    "delivery manager",
    "release manager",
    "engineering program manager",

    # ── DESIGN / UX ──
    "UX designer",
    "UI designer",
    "UX researcher",
    "UI UX designer",
    "product designer",
    "interaction designer",
    "visual designer",
    "design lead",
    "design manager",
    "creative director",
    "graphic designer",
    "motion designer",
    "industrial designer",
    "UX engineer",
    "design engineer",

    # ── ENGINEERING MANAGEMENT ──
    "engineering manager",
    "senior engineering manager",
    "director of engineering",
    "VP engineering",
    "CTO",
    "chief technology officer",
    "head of engineering",
    "tech lead",
    "team lead",
    "principal engineer",
    "distinguished engineer",
    "fellow engineer",

    # ── C-SUITE / EXECUTIVE DATA & AI ──
    "chief data officer",
    "CDO",
    "chief data and analytics officer",
    "chief analytics officer",
    "chief AI officer",
    "chief information officer",
    "CIO",
    "chief digital officer",
    "chief digital and AI officer",

    # ── VP / SVP / EVP DATA & ANALYTICS ──
    "VP data science",
    "VP analytics",
    "VP data engineering",
    "VP machine learning",
    "VP artificial intelligence",
    "VP data",
    "SVP data science",
    "SVP analytics",
    "SVP data engineering",
    "SVP artificial intelligence",
    "SVP machine learning",
    "SVP data",
    "EVP data",
    "EVP analytics",
    "EVP data science",
    "EVP artificial intelligence",

    # ── DIRECTOR DATA & ANALYTICS ──
    "director data science",
    "director analytics",
    "director data engineering",
    "director machine learning",
    "director artificial intelligence",
    "director data",
    "director BI",
    "director business intelligence",
    "director data governance",
    "director decision science",

    # ── HEAD OF (MID-SENIOR LEADERSHIP) ──
    "head of data",
    "head of analytics",
    "head of AI",
    "head of data science",
    "head of machine learning",
    "head of engineering",
    "head of product",
    "head of data engineering",
    "head of data platform",

    # ── QA / TESTING ──
    "QA engineer",
    "quality assurance engineer",
    "test engineer",
    "automation engineer",
    "SDET",
    "software development engineer in test",
    "QA lead",
    "QA manager",
    "performance test engineer",
    "security test engineer",

    # ── TECHNICAL WRITING / CONTENT ──
    "technical writer",
    "developer advocate",
    "developer relations",
    "solutions architect",
    "solutions engineer",
    "pre sales engineer",
    "sales engineer",
    "technical account manager",

    # ── DEVELOPMENT OPS / TOOLS ──
    "developer experience engineer",
    "DevEx engineer",
    "internal tools engineer",
    "tooling engineer",
    "build and release engineer",

    # ── RESEARCH ──
    "research engineer",
    "research scientist",
    "applied research scientist",
    "research associate",
    "postdoctoral researcher",
    "technical fellow",
]

def db_query(sql):
    """Run a SQL query via supabase CLI and return output."""
    with open("/tmp/_sched_query.sql", "w") as f:
        f.write(sql)
    r = subprocess.run(
        ["supabase", "db", "query", "--linked", "-f", "/tmp/_sched_query.sql"],
        capture_output=True, text=True, cwd="/root/projects/getautoapply", timeout=30
    )
    if r.returncode != 0:
        return None
    return r.stdout.strip()


def parse_table_output(output):
    """Parse supabase CLI table output to extract the first data row's first column."""
    if not output:
        return None
    lines = output.strip().split("\n")
    data_lines = []
    seen_separator = False
    for line in lines:
        if any(c in line for c in ['┌', '┐', '└', '┘']):
            continue
        if '├' in line and '┤' in line:
            seen_separator = True
            continue
        if '─' in line:
            continue
        if '│' in line:
            if not seen_separator:
                continue
            parts = [p.strip() for p in line.split('│')]
            parts = [p for p in parts if p]
            if parts:
                data_lines.append(parts[0])
    if data_lines:
        return data_lines[0]
    return None

def get_next_term():
    # 1. Check user-saved active search terms not scraped in 2+ hours
    user_terms = db_query("""
        SELECT search_term FROM public.user_search_terms
        WHERE is_active = true
          AND (last_scraped_at IS NULL OR last_scraped_at < NOW() - INTERVAL '2 hours')
        ORDER BY last_scraped_at NULLS FIRST
        LIMIT 1;
    """)
    result = parse_table_output(user_terms)
    if result:
        return result
    
    # 2. Default terms — pick least recently scraped
    state = db_query("""
        SELECT search_term FROM public.scraper_state
        WHERE site = 'linkedin'
        ORDER BY last_run_at NULLS FIRST
        LIMIT 1;
    """)
    result = parse_table_output(state)
    if result:
        return result
    
    # 3. Round-robin: pick based on current minute
    idx = 0
    try:
        idx = int(__import__('datetime').datetime.now().minute) % len(DEFAULT_TERMS)
    except:
        pass
    return DEFAULT_TERMS[idx]

if __name__ == "__main__":
    term = get_next_term()
    if term:
        print(term)
    else:
        print(DEFAULT_TERMS[0])
