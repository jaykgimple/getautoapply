#!/usr/bin/env python3
"""
Multi-source job scraper for GetAutoApply.
Scrapes jobs from 10 free sources and inserts into Supabase via REST API.

Usage:
    python3 scrape_all_sources.py                    # Scrape all sources
    python3 scrape_all_sources.py --source remoteok   # Scrape single source
    python3 scrape_all_sources.py --max-per-source 50  # Limit per source

Sources (no API key needed):
    - remoteok         RemoteOK API (JSON)
    - remotive         Remotive API (JSON)
    - weworkremotely   WeWorkRemotely RSS (XML)
    - jobicy           Jobicy API (JSON)
    - arbeitnow        Arbeitnow API (JSON) - EU jobs
    - greenhouse       Greenhouse boards (batch 1: companies 0-25)
    - lever            Lever boards (companies 0-25)
    - remotive_rss     Remotive RSS feed
    - python_jobs      Python.org RSS feed
    - greenhouse2      Greenhouse boards (batch 2: companies 25-45)
"""

import sys
import json
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional

# ── Supabase config ──────────────────────────────────────────────────────────
SUPABASE_URL = "https://sabexijntgtwflthkzdh.supabase.co"
SUPABASE_KEY = "sb_publishable_dhVsmCMWy9UjS8JRas06yQ_odtBP7_Q"
JOBS_API = f"{SUPABASE_URL}/rest/v1/jobs"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# ── Session with retries ─────────────────────────────────────────────────────
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "GetAutoApply-Bot/1.0 (+https://jobbox-os.vercel.app)"})
adapter = requests.adapters.HTTPAdapter(max_retries=3)
SESSION.mount("https://", adapter)
SESSION.mount("http://", adapter)

# ── Dedup cache ───────────────────────────────────────────────────────────────
seen_urls: set = set()
inserted = 0
skipped = 0
errors = 0


def normalize_job_type(raw) -> str:
    allowed = {"full_time", "part_time", "contract", "internship", "temporary", "freelance"}
    if raw is None:
        return "full_time"
    if isinstance(raw, (list, tuple)):
        raw = raw[0] if raw else ""
    s = str(raw).strip().lower().replace(" ", "_").replace("-", "_")
    s = s.replace("fulltime", "full_time").replace("parttime", "part_time")
    if "," in s:
        s = s.split(",")[0].strip()
    return s if s in allowed else "full_time"


def clean_text(text: Optional[str], maxlen: int = 2000) -> str:
    if not text:
        return ""
    text = str(text).strip()
    if text.lower() in ("nan", "none", "null", ""):
        return ""
    return text[:maxlen]


def insert_job(job: dict) -> bool:
    global inserted, skipped, errors
    url = job.get("job_url", "")
    if url and url in seen_urls:
        skipped += 1
        return False
    if url:
        seen_urls.add(url)
    payload = {
        "title": clean_text(job.get("title", ""), 300),
        "company": clean_text(job.get("company", "Unknown"), 200),
        "location": clean_text(job.get("location", "Remote"), 200),
        "job_url": url,
        "description": clean_text(job.get("description", ""), 2000),
        "source": clean_text(job.get("source", "unknown"), 100),
        "job_type": job.get("job_type", "full_time"),
        "remote_type": "remote" if job.get("remote_type") else "onsite",
        "status": "active",
        "is_active": True,
        "salary_min": job.get("salary_min"),
        "salary_max": job.get("salary_max"),
        "skills_required": json.dumps(job.get("skills", [])) if job.get("skills") else None,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    try:
        resp = SESSION.post(JOBS_API, json=payload, headers=HEADERS, timeout=15)
        if resp.status_code in (200, 201):
            inserted += 1
            return True
        elif resp.status_code == 409:
            skipped += 1
            return False
        else:
            errors += 1
            print(f"  ⚠ Insert failed ({resp.status_code}): {resp.text[:100]}")
            return False
    except Exception as e:
        errors += 1
        print(f"  ⚠ Insert error: {e}")
        return False


def insert_batch(jobs: list) -> int:
    count = 0
    for job in jobs:
        if insert_job(job):
            count += 1
    return count


# ═══════════════════════════════════════════════════════════════════════════════
# SOURCES — 10 sources, all free, no API keys needed
# ═══════════════════════════════════════════════════════════════════════════════

def scrape_remoteok(max_results: int = 100) -> list:
    print("📡 Scraping RemoteOK...")
    jobs = []
    try:
        resp = SESSION.get("https://remoteok.com/api", timeout=20)
        if resp.status_code != 200:
            print(f"  ✗ RemoteOK returned {resp.status_code}")
            return jobs
        data = resp.json()
        for item in data[:max_results + 1]:
            if not isinstance(item, dict) or "id" not in item:
                continue
            tags = item.get("tags", [])
            desc = item.get("description", "") or item.get("contents", "")
            jobs.append({
                "title": item.get("position", ""),
                "company": item.get("company", "Unknown"),
                "location": item.get("location", "Remote") or "Remote",
                "job_url": item.get("url", "") or item.get("apply_url", ""),
                "description": desc,
                "source": "remoteok",
                "remote_type": "remote",
                "job_type": "full_time",
                "skills": tags,
                "salary_min": item.get("salary_min"),
                "salary_max": item.get("salary_max"),
            })
        print(f"  ✓ RemoteOK: {len(jobs)} jobs")
    except Exception as e:
        print(f"  ✗ RemoteOK error: {e}")
    return jobs


def scrape_remotive(max_results: int = 100) -> list:
    print("📡 Scraping Remotive...")
    jobs = []
    try:
        resp = SESSION.get(
            "https://remotive.com/api/remote-jobs",
            params={"limit": min(max_results, 100)},
            timeout=20,
        )
        if resp.status_code != 200:
            print(f"  ✗ Remotive returned {resp.status_code}")
            return jobs
        data = resp.json()
        for item in data.get("jobs", [])[:max_results]:
            jobs.append({
                "title": item.get("title", ""),
                "company": item.get("company_name", "Unknown"),
                "location": item.get("candidate_required_location", "Remote") or "Remote",
                "job_url": item.get("url", "") or item.get("apply_url", ""),
                "description": item.get("description", ""),
                "source": "remotive",
                "remote_type": "remote",
                "job_type": normalize_job_type(item.get("job_type")),
                "skills": item.get("tags", []) or [],
            })
        print(f"  ✓ Remotive: {len(jobs)} jobs")
    except Exception as e:
        print(f"  ✗ Remotive error: {e}")
    return jobs


def scrape_weworkremotely_rss(max_results: int = 50) -> list:
    print("📡 Scraping WeWorkRemotely (RSS)...")
    jobs = []
    categories = ["remote-programming-jobs", "remote-design-jobs", "remote-devops-sysadmin-jobs"]
    seen = set()
    for cat in categories:
        try:
            resp = SESSION.get(f"https://weworkremotely.com/categories/{cat}.rss", timeout=15)
            if resp.status_code != 200:
                continue
            root = ET.fromstring(resp.content)
            channel = root.find("channel")
            if channel is None:
                continue
            for item in channel.findall("item"):
                if len(seen) >= max_results:
                    break
                link_el = item.find("link")
                url = link_el.text.strip() if link_el is not None and link_el.text else ""
                if url in seen:
                    continue
                seen.add(url)
                title_el = item.find("title")
                title = title_el.text if title_el is not None and title_el.text else ""
                company = "Unknown"
                if ":" in title:
                    parts = title.split(":", 1)
                    company = parts[-1].strip()
                    title = parts[0].strip()
                desc_el = item.find("description")
                desc = desc_el.text if desc_el is not None and desc_el.text else ""
                jobs.append({
                    "title": title, "company": company, "location": "Remote",
                    "job_url": url, "description": desc, "source": "weworkremotely",
                    "remote_type": "remote",
                })
        except Exception as e:
            print(f"  ✗ WWR RSS error ({cat}): {e}")
    print(f"  ✓ WeWorkRemotely: {len(jobs)} jobs")
    return jobs


def scrape_jobicy(max_results: int = 100) -> list:
    print("📡 Scraping Jobicy...")
    jobs = []
    regions = ["", "?location=usa", "?location=europe"]
    seen = set()
    for region in regions:
        try:
            resp = SESSION.get(f"https://jobicy.com/api/v2/remote-jobs{region}", timeout=20)
            if resp.status_code != 200:
                continue
            data = resp.json()
            for item in data.get("jobs", []):
                if len(seen) >= max_results:
                    break
                url = item.get("url", "")
                if url in seen:
                    continue
                seen.add(url)
                jobs.append({
                    "title": item.get("jobTitle", ""),
                    "company": item.get("companyName", "Unknown"),
                    "location": item.get("jobGeo", "Remote") or "Remote",
                    "job_url": url,
                    "description": item.get("jobExcerpt", ""),
                    "source": "jobicy",
                    "remote_type": "remote",
                    "job_type": normalize_job_type(item.get("jobType")),
                    "skills": item.get("jobIndustry", []) or [],
                })
        except Exception as e:
            print(f"  ✗ Jobicy error: {e}")
    print(f"  ✓ Jobicy: {len(jobs)} jobs")
    return jobs


def scrape_arbeitnow(max_results: int = 100) -> list:
    print("📡 Scraping Arbeitnow (EU remote)...")
    jobs = []
    try:
        resp = SESSION.get(
            "https://arbeitnow.com/api/job-board-api",
            params={"limit": min(max_results, 100)},
            timeout=20,
        )
        if resp.status_code != 200:
            print(f"  ✗ Arbeitnow returned {resp.status_code}")
            return jobs
        data = resp.json()
        for item in data.get("data", [])[:max_results]:
            jobs.append({
                "title": item.get("title", ""),
                "company": item.get("company", "Unknown"),
                "location": item.get("location", "Remote") or "Remote",
                "job_url": item.get("url", "") or item.get("apply_url", ""),
                "description": item.get("description", "") or item.get("body", ""),
                "source": "arbeitnow",
                "remote_type": "remote",
                "job_type": normalize_job_type(item.get("job_type")),
                "skills": item.get("tags", []) or [],
            })
        print(f"  ✓ Arbeitnow: {len(jobs)} jobs")
    except Exception as e:
        print(f"  ✗ Arbeitnow error: {e}")
    return jobs


ALL_GREENHOUSE = [
    "gitlab", "stripe", "airbnb", "slack", "notion", "figma", "vercel",
    "supabase", "linear", "raycast", "resend", "planetscale",
    "anthropic", "openai", "scaleai", "mistral", "cohere",
    "datadog", "sentry", "mongodb", "cloudflare", "netlify",
    "shopify", "twilio", "atlassian", "zoom", "pinterest",
    "snap", "spotify", "square", "uber", "lyft",
    "nuro", "waymo", "cruise", "samsara", "gong",
    "deel", "rippling", "gusto", "plaid", "ramp",
    "brex", "chime", "mercury", "carta",
]


def scrape_greenhouse(max_results: int = 100) -> list:
    print("📡 Scraping Greenhouse boards (batch 1)...")
    jobs = []
    for company in ALL_GREENHOUSE[:25]:
        try:
            resp = SESSION.get(
                f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs",
                timeout=10,
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            for item in data.get("jobs", [])[:5]:
                jobs.append({
                    "title": item.get("title", ""),
                    "company": company,
                    "location": item.get("location", {}).get("name", "Remote") if isinstance(item.get("location"), dict) else "Remote",
                    "job_url": item.get("absolute_url", ""),
                    "description": item.get("content", ""),
                    "source": "greenhouse",
                    "remote_type": "remote",
                })
        except Exception:
            continue
    print(f"  ✓ Greenhouse batch 1: {len(jobs)} jobs")
    return jobs


def scrape_greenhouse2(max_results: int = 100) -> list:
    print("📡 Scraping Greenhouse boards (batch 2)...")
    jobs = []
    for company in ALL_GREENHOUSE[25:]:
        try:
            resp = SESSION.get(
                f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs",
                timeout=10,
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            for item in data.get("jobs", [])[:5]:
                jobs.append({
                    "title": item.get("title", ""),
                    "company": company,
                    "location": item.get("location", {}).get("name", "Remote") if isinstance(item.get("location"), dict) else "Remote",
                    "job_url": item.get("absolute_url", ""),
                    "description": item.get("content", ""),
                    "source": "greenhouse",
                    "remote_type": "remote",
                })
        except Exception:
            continue
    print(f"  ✓ Greenhouse batch 2: {len(jobs)} jobs")
    return jobs


ALL_LEVER = [
    "netlify", "render", "railway", "prisma", "hasura",
    "vercel", "supabase", "planetscale", "resend", "neon",
    "anthropic", "openai", "scaleai", "cohere",
    "datadog", "sentry", "mongodb", "cloudflare",
    "shopify", "twilio", "atlassian", "zoom",
    "airbnb", "spotify", "uber", "lyft",
    "nuro", "waymo", "samsara", "gong",
    "deel", "rippling", "gusto", "plaid", "ramp",
]


def scrape_lever(max_results: int = 50) -> list:
    print("📡 Scraping Lever boards...")
    jobs = []
    for company in ALL_LEVER[:25]:
        try:
            resp = SESSION.get(
                f"https://api.lever.co/v0/postings/{company}?mode=json",
                timeout=10,
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            for item in (data if isinstance(data, list) else data.get("data", []))[:5]:
                text = item.get("description", "") or item.get("descriptionPlain", "") or ""
                jobs.append({
                    "title": item.get("text", ""),
                    "company": company,
                    "location": item.get("categories", {}).get("location", "Remote") if isinstance(item.get("categories"), dict) else "Remote",
                    "job_url": item.get("hostedUrl", ""),
                    "description": text,
                    "source": "lever",
                    "remote_type": "remote" if "remote" in text.lower() else "onsite",
                })
        except Exception:
            continue
    print(f"  ✓ Lever: {len(jobs)} jobs")
    return jobs


def scrape_remotive_rss(max_results: int = 50) -> list:
    print("📡 Scraping Remotive RSS...")
    jobs = []
    try:
        resp = SESSION.get("https://remotive.com/remote-jobs/feed", timeout=15)
        if resp.status_code != 200:
            print(f"  ✗ Remotive RSS returned {resp.status_code}")
            return jobs
        root = ET.fromstring(resp.content)
        channel = root.find("channel")
        if channel is None:
            return jobs
        for item in channel.findall("item")[:max_results]:
            link_el = item.find("link")
            url = link_el.text.strip() if link_el is not None and link_el.text else ""
            title_el = item.find("title")
            title = title_el.text if title_el is not None and title_el.text else ""
            desc_el = item.find("description")
            desc = desc_el.text if desc_el is not None and desc_el.text else ""
            company_el = item.find("company")
            company = company_el.text if company_el is not None and company_el.text else "Unknown"
            loc_el = item.find("location")
            location = loc_el.text if loc_el is not None and loc_el.text else "Remote"
            jobs.append({
                "title": title, "company": company, "location": location,
                "job_url": url, "description": desc, "source": "remotive_rss",
                "remote_type": "remote",
            })
        print(f"  ✓ Remotive RSS: {len(jobs)} jobs")
    except Exception as e:
        print(f"  ✗ Remotive RSS error: {e}")
    return jobs


def scrape_python_jobs(max_results: int = 50) -> list:
    print("📡 Scraping Python.org jobs (RSS)...")
    jobs = []
    try:
        resp = SESSION.get("https://www.python.org/jobs/feed/rss/", timeout=15)
        if resp.status_code != 200:
            print(f"  ✗ Python.org returned {resp.status_code}")
            return jobs
        root = ET.fromstring(resp.content)
        channel = root.find("channel")
        if channel is None:
            return jobs
        for item in channel.findall("item")[:max_results]:
            link_el = item.find("link")
            url = link_el.text.strip() if link_el is not None and link_el.text else ""
            title_el = item.find("title")
            title = title_el.text if title_el is not None and title_el.text else ""
            desc_el = item.find("description")
            desc = desc_el.text if desc_el is not None and desc_el.text else ""
            company = "Unknown"
            if desc:
                first_line = desc.split("\n")[0].strip()
                if first_line:
                    company = first_line
            jobs.append({
                "title": title, "company": company, "location": "Remote",
                "job_url": url, "description": desc, "source": "python_jobs",
                "remote_type": "remote",
            })
        print(f"  ✓ Python.org: {len(jobs)} jobs")
    except Exception as e:
        print(f"  ✗ Python.org error: {e}")
    return jobs


# ═══════════════════════════════════════════════════════════════════════════════
# MASTER LIST — 10 sources, all free, no API keys needed
# ═══════════════════════════════════════════════════════════════════════════════

ALL_SOURCES = {
    "remoteok": scrape_remoteok,
    "remotive": scrape_remotive,
    "weworkremotely": scrape_weworkremotely_rss,
    "jobicy": scrape_jobicy,
    "arbeitnow": scrape_arbeitnow,
    "greenhouse": scrape_greenhouse,
    "lever": scrape_lever,
    "remotive_rss": scrape_remotive_rss,
    "python_jobs": scrape_python_jobs,
    "greenhouse2": scrape_greenhouse2,
}


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Multi-source job scraper")
    parser.add_argument("--source", help="Scrape a single source by name")
    parser.add_argument("--max-per-source", type=int, default=50, help="Max jobs per source")
    parser.add_argument("--list-sources", action="store_true", help="List available sources")
    args = parser.parse_args()

    if args.list_sources:
        print("Available sources:")
        for name in ALL_SOURCES:
            print(f"  - {name}")
        return

    global inserted, skipped, errors, seen_urls
    inserted = 0
    skipped = 0
    errors = 0
    seen_urls = set()

    if args.source:
        source_name = args.source.lower().strip()
        func = ALL_SOURCES.get(source_name)
        if not func:
            print(f"Unknown source: {source_name}")
            print(f"Available: {', '.join(ALL_SOURCES.keys())}")
            return
        print(f"\n🔍 Scraping single source: {source_name}\n")
        jobs = func(max_results=args.max_per_source)
        insert_batch(jobs)
    else:
        print("\n🔍 Scraping ALL sources...\n")
        for name, func in ALL_SOURCES.items():
            try:
                jobs = func(max_results=args.max_per_source)
                insert_batch(jobs)
            except Exception as e:
                print(f"  ✗ Source {name} crashed: {e}")

    print(f"\n{'='*55}")
    print(f"📊 Results: {inserted} inserted, {skipped} skipped (dupes), {errors} errors")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    main()
