#!/usr/bin/env python3
"""
Scheduler: picks the next search term to scrape.
Priority:
  1. User-saved active search terms that haven't been scraped in 2+ hours
  2. Default curated terms, least recently scraped first
  3. Round-robin fallback
"""
import subprocess, json, sys

DEFAULT_TERMS = [
    "software engineer",
    "senior software engineer",
    "full stack developer",
    "backend engineer",
    "frontend developer",
    "devops engineer",
    "data engineer",
    "machine learning engineer",
    "product manager",
    "data scientist",
    "mobile developer",
    "site reliability engineer",
    "cloud architect",
    "security engineer",
    "QA engineer",
    "engineering manager",
    "staff engineer",
    "principal engineer",
    "tech lead",
    "iOS developer",
    "Android developer",
    "react developer",
    "python developer",
    "java developer",
    "golang developer",
    "rust developer",
    "blockchain developer",
    "AI engineer",
    "NLP engineer",
    "computer vision engineer",
    # C-suite & executive data/AI roles
    "chief data officer",
    "chief data and analytics officer",
    "chief AI officer",
    "chief analytics officer",
    "chief information officer",
    "chief technology officer",
    "chief digital officer",
    "SVP data science",
    "SVP analytics",
    "SVP data engineering",
    "SVP artificial intelligence",
    "SVP machine learning",
    "EVP data",
    "EVP analytics",
    "EVP data science",
    "EVP artificial intelligence",
    "VP data science",
    "VP analytics",
    "VP data engineering",
    "VP machine learning",
    "director data science",
    "director analytics",
    "director data engineering",
    "director machine learning",
    "head of data",
    "head of analytics",
    "head of AI",
    "head of data science",
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
    """Parse supabase CLI table output to extract the first data row's first column.
    
    Output format:
    ┌───────────────────┐
    │    search_term    │  <-- header (skip)
    ├───────────────────┤
    │ software engineer │  <-- data (return this)
    └───────────────────┘
    """
    if not output:
        return None
    lines = output.strip().split("\n")
    # Find lines that contain │ and are not box-drawing chars
    data_lines = []
    seen_separator = False
    for line in lines:
        # Skip box-drawing border lines
        if any(c in line for c in ['┌', '┐', '└', '┘']):
            continue
        if '├' in line and '┤' in line:
            seen_separator = True
            continue
        if '─' in line:
            continue
        if '│' in line:
            # First │ line after ┌ is the header - skip it
            # Second │ line after ├ is the data
            if not seen_separator:
                continue  # This is the header row
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
