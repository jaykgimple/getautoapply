#!/usr/bin/env python3
"""
Lightweight single-term job scraper.
Run via cron every 10 minutes with a different search term each time.
Uses Supabase REST API for inserts (no SQL escaping issues).
"""
import sys, json, requests
from datetime import datetime

SUPABASE_URL = "https://sabexijntgtwflthkzdh.supabase.co"
SUPABASE_KEY = "sb_publishable_dhVsmCMWy9UjS8JRas06yQ_odtBP7_Q"
JOBS_API = f"{SUPABASE_URL}/rest/v1/jobs"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

SEARCH_TERM = sys.argv[1] if len(sys.argv) > 1 else "software engineer"
SITE = sys.argv[2] if len(sys.argv) > 2 else "both"

def scrape_one(term, sites):
    from jobspy import scrape_jobs
    site_list = ["linkedin", "indeed"] if sites == "both" else [sites]
    df = scrape_jobs(
        site_name=site_list, search_term=term, results_wanted=25,
        hours_old=72, country_indeed="USA", linkedin_fetch_description=False,
    )
    if df is None or len(df) == 0:
        return []
    results = []
    for _, row in df.iterrows():
        site = str(row.get("site", "")).lower()
        smin, smax = row.get("min_amount"), row.get("max_amount")
        try:
            smin = int(float(str(smin).replace(",", ""))) if smin is not None and str(smin).strip().lower() != "nan" else None
        except:
            smin = None
        try:
            smax = int(float(str(smax).replace(",", ""))) if smax is not None and str(smax).strip().lower() != "nan" else None
        except:
            smax = None
        loc = str(row.get("location","") or "Unknown")
        jt_raw = row.get("job_type", "full_time")
        if jt_raw is None or str(jt_raw).strip().lower() in ("nan", "none", ""):
            jt = "full_time"
        else:
            jt = str(jt_raw).strip().lower()
            # Normalize to match constraint: full_time, part_time, contract, internship, temporary, freelance
            jt = jt.replace(" ", "_")              # "full time" -> "full_time"
            jt = jt.replace("fulltime", "full_time")  # "fulltime" -> "full_time"
            jt = jt.replace("parttime", "part_time")  # "parttime" -> "part_time"
            # Handle comma-separated like "fulltime, contract" -> pick first
            if "," in jt:
                jt = jt.split(",")[0].strip()
            # Fallback if not in allowed list
            allowed = {"full_time", "part_time", "contract", "internship", "temporary", "freelance"}
            if jt not in allowed:
                jt = "full_time"
        job_url = str(row.get("job_url","") or row.get("job_url_direct","") or "").strip()
        desc_raw = row.get("description","")
        if desc_raw is None or str(desc_raw).strip().lower() in ("nan","none",""):
            desc_text = ""
        else:
            desc_text = str(desc_raw).strip()
        results.append(dict(
            title=str(row.get("title","")), company=str(row.get("company","Unknown")),
            location=loc, job_url=job_url,
            description=desc_text,
            source=f"jobspy_{site}", job_type=jt,
            remote_type="remote" if ("remote" in loc.lower() or "remote" in jt) else "onsite",
            salary_min=smin, salary_max=smax,
        ))
    return results

def upsert_jobs(jobs):
    if not jobs:
        return 0
    payload = []
    for j in jobs:
        payload.append({
            "title": j["title"][:200],
            "company": j["company"][:200],
            "location": j["location"][:200],
            "job_url": j["job_url"][:500],
            "description": j["description"][:2000],
            "source": j["source"],
            "job_type": j.get("job_type", "full_time"),
            "remote_type": j.get("remote_type", "onsite"),
            "skills_required": {},
            "salary_min": j.get("salary_min"),
            "salary_max": j.get("salary_max"),
            "status": "active",
            "is_active": True,
        })

    # Insert in batches of 25 to stay under API limits
    total = 0
    for i in range(0, len(payload), 25):
        batch = payload[i:i+25]
        r = requests.post(JOBS_API, json=batch, headers=HEADERS, timeout=30)
        if r.status_code in (200, 201):
            total += len(batch)
        else:
            print(f"  API error (batch {i}): {r.status_code} {r.text[:200]}")
    return total

def update_state(term, site, found, inserted):
    payload = {
        "search_term": term,
        "site": site,
        "last_run_at": datetime.utcnow().isoformat(),
        "jobs_found": found,
        "jobs_inserted": inserted,
    }
    requests.post(
        f"{SUPABASE_URL}/rest/v1/scraper_state",
        json=payload,
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
        timeout=30,
    )

def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Scraping '{SEARCH_TERM}' on {SITE}...")
    jobs = scrape_one(SEARCH_TERM, SITE)
    print(f"  Found: {len(jobs)}")
    n = upsert_jobs(jobs)
    print(f"  Inserted: {n}")
    for s in (["linkedin","indeed"] if SITE=="both" else [SITE]):
        update_state(SEARCH_TERM, s, len(jobs), n)

if __name__ == "__main__":
    main()
