#!/usr/bin/env python3
"""Scrape jobs from free APIs and insert directly into Supabase."""
import urllib.request, json, psycopg2, os

DB_PASSWORD = "LWmmcT5KSlnqQqTx"
DB_HOST = "db.sabexijntgtwflthkzdh.supabase.co"
DB_PORT = 5432  # Direct connection

def scrape_remoteok():
    """Scrape from RemoteOK free API."""
    try:
        req = urllib.request.Request("https://remoteok.com/api", headers={
            "User-Agent": "GetAutoApply/1.0",
            "Accept": "application/json"
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            jobs = []
            for j in data:
                if not j.get("position"):
                    continue
                jobs.append({
                    "title": j.get("position", ""),
                    "company_name": j.get("company", "Unknown"),
                    "location": "Remote",
                    "url": j.get("url") or j.get("apply_url", ""),
                    "description": (j.get("description") or "")[:500],
                    "job_type": "full_time",
                    "remote_type": "remote",
                    "source": "remoteok",
                    "tags": json.dumps(j.get("tags", [])),
                    "salary_min": None,
                    "salary_max": None,
                })
            print(f"RemoteOK: {len(jobs)} jobs")
            return jobs
    except Exception as e:
        print(f"RemoteOK error: {e}")
        return []

def scrape_weworkremotely():
    """Scrape from We Work Remotely RSS."""
    import xml.etree.ElementTree as ET
    try:
        req = urllib.request.Request("https://weworkremotely.com/remote-jobs.rss", headers={
            "User-Agent": "GetAutoApply/1.0"
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            root = ET.fromstring(resp.read())
            jobs = []
            for item in root.findall(".//item")[:30]:
                title = item.findtext("title", "").strip()
                link = item.findtext("link", "").strip()
                desc = item.findtext("description", "")[:500]
                # Parse company from title (usually "Company: Job Title" or "Job Title at Company")
                company = "Unknown"
                job_title = title
                if " at " in title:
                    parts = title.rsplit(" at ", 1)
                    job_title = parts[0].strip()
                    company = parts[1].strip()
                if ": " in job_title:
                    parts = job_title.split(": ", 1)
                    company = parts[0].strip()
                    job_title = parts[1].strip()
                
                jobs.append({
                    "title": job_title,
                    "company_name": company,
                    "location": "Remote",
                    "url": link,
                    "description": desc,
                    "job_type": "full_time",
                    "remote_type": "remote",
                    "source": "weworkremotely",
                    "tags": "[]",
                    "salary_min": None,
                    "salary_max": None,
                })
            print(f"WeWorkRemotely: {len(jobs)} jobs")
            return jobs
    except Exception as e:
        print(f"WeWorkRemotely error: {e}")
        return []

def insert_jobs(jobs):
    """Insert jobs into Supabase via direct postgres connection."""
    if not jobs:
        print("No jobs to insert")
        return 0, 0
    
    conn = None
    try:
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT, dbname="postgres",
            user="postgres", password=DB_PASSWORD,
            connect_timeout=15, sslmode="require"
        )
        conn.autocommit = False
        cur = conn.cursor()
        
        inserted = 0
        skipped = 0
        
        for job in jobs:
            # Check if job already exists (by url)
            cur.execute("SELECT id FROM public.jobs WHERE url = %s LIMIT 1", (job["url"],))
            if cur.fetchone():
                skipped += 1
                continue
            
            cur.execute("""
                INSERT INTO public.jobs (title, company_name, location, url, description, job_type, remote_type, source, tags, salary_min, salary_max, status, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, 'active', true)
            """, (
                job["title"], job["company_name"], job["location"], job["url"],
                job["description"], job["job_type"], job["remote_type"], job["source"],
                job["tags"], job["salary_min"], job["salary_max"]
            ))
            inserted += 1
        
        conn.commit()
        cur.close()
        return inserted, skipped
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Insert error: {e}")
        return 0, 0
    finally:
        if conn:
            conn.close()

# Run scrapers
print("=== Starting job scrapers ===")

all_jobs = []
all_jobs.extend(scrape_remoteok())
all_jobs.extend(scrape_weworkremotely())

print(f"\nTotal jobs scraped: {len(all_jobs)}")
inserted, skipped = insert_jobs(all_jobs)
print(f"Inserted: {inserted}, Skipped (duplicates): {skipped}")
print("=== Done ===")
