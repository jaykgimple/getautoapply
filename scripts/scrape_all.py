#!/usr/bin/env python3
"""
Full JobSpy-powered multi-source scraper for GetAutoApply.
Sources:
  - JobSpy: LinkedIn + Indeed (multiple search terms, paginated)
  - Free APIs: RemoteOK, Remotive, Jobicy, WeWorkRemotely
Inserts into Supabase via supabase db query CLI.
"""
import urllib.request, json, subprocess, re, os, sys
from datetime import datetime

# ─── Configuration ─────────────────────────────────────────────────

JOBSPY_SEARCH_TERMS = [
    "software engineer",
    "senior software engineer",
    "full stack developer",
    "backend engineer",
    "frontend developer",
    "devops engineer",
    "data engineer",
]

JOBSPY_SITES = ["linkedin", "indeed"]
JOBSPY_RESULTS_PER_TERM = 25
JOBSPY_HOURS_OLD = 168  # 7 days

# ─── Free JSON API Sources ─────────────────────────────────────────

def remoteok():
    try:
        req = urllib.request.Request("https://remoteok.com/api",
            headers={"User-Agent": "GetAutoApply/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        jobs = []
        for j in data[:50]:
            if not j.get("position"): continue
            tags = j.get("tags", [])
            smin = smax = None
            s = str(j.get("salary", ""))
            if s:
                nums = re.findall(r'[\d,]+', s)
                if len(nums) >= 2:
                    smin, smax = int(nums[0].replace(',','')), int(nums[1].replace(',',''))
            jt = "full_time"
            if any(t.lower() in ["contract","freelance"] for t in tags): jt = "contract"
            jobs.append(dict(
                title=j["position"][:200], company=j.get("company","Unknown")[:200],
                location="Remote",
                job_url=(j.get("url") or j.get("apply_url",""))[:500],
                description=(j.get("description","") or "")[:500],
                source="remoteok", job_type=jt, remote_type="remote",
                skills=json.dumps(tags), salary_min=smin, salary_max=smax,
                status="active", is_active=True))
        print(f"  RemoteOK: {len(jobs)}")
        return jobs
    except Exception as e:
        print(f"  RemoteOK error: {e}")
        return []

def remotive():
    try:
        req = urllib.request.Request(
            "https://remotive.com/api/remote-jobs?category=software-dev&limit=50",
            headers={"User-Agent": "GetAutoApply/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        jobs = []
        for j in (data.get("jobs") or [])[:50]:
            tags = j.get("tags", [])
            salary = j.get("salary", "") or ""
            smin = smax = None
            nums = re.findall(r'[\d,]+', str(salary))
            if len(nums) >= 2:
                smin, smax = int(nums[0].replace(',','')), int(nums[1].replace(',',''))
            jt = "full_time"
            if any(t in str(j.get("job_type","")).lower() for t in ["contract","freelance"]): jt = "contract"
            jobs.append(dict(
                title=j.get("title","")[:200], company=j.get("company_name","Unknown")[:200],
                location="Remote", job_url=j.get("url","")[:500],
                description=(j.get("description","") or "")[:500],
                source="remotive", job_type=jt, remote_type="remote",
                skills=json.dumps(tags), salary_min=smin, salary_max=smax,
                status="active", is_active=True))
        print(f"  Remotive: {len(jobs)}")
        return jobs
    except Exception as e:
        print(f"  Remotive error: {e}")
        return []

def jobicy():
    try:
        req = urllib.request.Request(
            "https://jobicy.com/api/v2/remote-jobs?count=50&industry=engineering",
            headers={"User-Agent": "GetAutoApply/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        jobs = []
        for j in (data.get("jobs") or [])[:50]:
            tags = j.get("jobIndustry", []) + j.get("jobType", [])
            jt = "full_time"
            if "contract" in str(j.get("jobType","")).lower(): jt = "contract"
            jobs.append(dict(
                title=j.get("jobTitle","")[:200], company=j.get("companyName","Unknown")[:200],
                location="Remote", job_url=j.get("url","")[:500],
                description=(j.get("jobDescription","") or "")[:500],
                source="jobicy", job_type=jt, remote_type="remote",
                skills=json.dumps(tags), salary_min=None, salary_max=None,
                status="active", is_active=True))
        print(f"  Jobicy: {len(jobs)}")
        return jobs
    except Exception as e:
        print(f"  Jobicy error: {e}")
        return []

def weworkremotely():
    try:
        import xml.etree.ElementTree as ET
        req = urllib.request.Request("https://weworkremotely.com/remote-jobs.rss",
            headers={"User-Agent": "GetAutoApply/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            root = ET.fromstring(r.read())
        jobs = []
        for item in root.findall(".//item")[:30]:
            title = item.findtext("title","").strip()
            link = item.findtext("link","").strip()
            desc = (item.findtext("description","") or "")[:500]
            company, job_title = "Unknown", title
            if " at " in title:
                idx = title.rfind(" at ")
                job_title, company = title[:idx].strip(), title[idx+4:].strip()
            elif ": " in title:
                idx = title.find(": ")
                company, job_title = title[:idx].strip(), title[idx+2:].strip()
            jobs.append(dict(
                title=job_title[:200], company=company[:200], location="Remote",
                job_url=link[:500], description=desc, source="weworkremotely",
                job_type="full_time", remote_type="remote", skills="[]",
                salary_min=None, salary_max=None, status="active", is_active=True))
        print(f"  WeWorkRemotely: {len(jobs)}")
        return jobs
    except Exception as e:
        print(f"  WeWorkRemotely error: {e}")
        return []

# ─── JobSpy (LinkedIn, Indeed) ────────────────────────────────────

def jobspy_scrape():
    """Scrape LinkedIn + Indeed using JobSpy with multiple search terms."""
    try:
        from jobspy import scrape_jobs
        import pandas as pd
        
        all_dfs = []
        seen_urls = set()
        
        for term in JOBSPY_SEARCH_TERMS:
            try:
                df = scrape_jobs(
                    site_name=JOBSPY_SITES,
                    search_term=term,
                    results_wanted=JOBSPY_RESULTS_PER_TERM,
                    hours_old=JOBSPY_HOURS_OLD,
                    country_indeed="USA",
                    linkedin_fetch_description=False,
                )
                if df is not None and len(df) > 0:
                    df = df.drop_duplicates(subset=["job_url"])
                    df = df[df["job_url"].apply(lambda u: u not in seen_urls and pd.notna(u) and u != "")]
                    if len(df) > 0:
                        seen_urls.update(df["job_url"].tolist())
                        all_dfs.append(df)
                        print(f"  JobSpy '{term}': {len(df)}")
                else:
                    print(f"  JobSpy '{term}': 0")
            except Exception as e:
                print(f"  JobSpy '{term}': error - {str(e)[:60]}")
        
        if not all_dfs:
            return []
        
        combined = pd.concat(all_dfs, ignore_index=True)
        print(f"  JobSpy total (deduped): {len(combined)}")
        
        # Convert to our format
        result = []
        for _, row in combined.iterrows():
            site = str(row.get("site","")).lower()
            loc = str(row.get("location","") or "Unknown")
            is_remote = "remote" in loc.lower() or "remote" in str(row.get("job_type","")).lower()
            jt = "full_time"
            jt_raw = str(row.get("job_type","")).lower()
            if "contract" in jt_raw: jt = "contract"
            elif "part" in jt_raw: jt = "part_time"
            elif "intern" in jt_raw: jt = "internship"
            
            smin = row.get("min_amount", None)
            smax = row.get("max_amount", None)
            if smin is not None:
                try: smin = int(float(str(smin).replace(",","")))
                except: smin = None
            if smax is not None:
                try: smax = int(float(str(smax).replace(",","")))
                except: smax = None
            
            result.append(dict(
                title=str(row.get("title",""))[:200],
                company=str(row.get("company","Unknown"))[:200],
                location=loc[:200],
                job_url=str(row.get("job_url","") or row.get("job_url_direct","") or "")[:500],
                description=str(row.get("description","") or "")[:500],
                source=f"jobspy_{site}",
                job_type=jt,
                remote_type="remote" if is_remote else "onsite",
                skills="[]",
                salary_min=smin, salary_max=smax,
                status="active", is_active=True,
            ))
        
        return result
    except ImportError:
        print("  JobSpy: not installed (pip install python-jobspy)")
        return []
    except Exception as e:
        print(f"  JobSpy error: {e}")
        return []

# ─── Database Insert ────────────────────────────────────────────────

def insert_batch(all_jobs):
    if not all_jobs:
        return 0
    
    # Final dedup by URL within this batch
    seen = set()
    unique = []
    for j in all_jobs:
        url = j.get("job_url","").strip()
        if url and url not in seen:
            seen.add(url)
            unique.append(j)
        elif not url:
            unique.append(j)
    
    total = 0
    for i in range(0, len(unique), 10):
        batch = unique[i:i+10]
        vals = []
        for j in batch:
            t = j["title"].replace("'","''")
            c = j["company"].replace("'","''")
            u = (j.get("job_url") or "").replace("'","''")
            d = (j.get("description") or "").replace("'","''").replace("\\","\\\\")
            s = (j.get("skills") or "[]").replace("'","''")
            loc = (j.get("location") or "Unknown").replace("'","''")
            jt = j.get("job_type","full_time")
            rt = j.get("remote_type","onsite")
            src = j.get("source","unknown")
            mi = str(j["salary_min"]) if j.get("salary_min") else "NULL"
            ma = str(j["salary_max"]) if j.get("salary_max") else "NULL"
            vals.append(f"('{t}','{c}','{loc}','{u}','{d}','{src}','{jt}','{rt}','{s}'::jsonb,{mi},{ma},'active',true)")
        
        sql = f"INSERT INTO public.jobs (title,company,location,job_url,description,source,job_type,remote_type,skills_required,salary_min,salary_max,status,is_active) VALUES {','.join(vals)};"
        with open("/tmp/_scrape_insert.sql","w") as f:
            f.write(sql)
        r = subprocess.run(
            ["supabase","db","query","--linked","-f","/tmp/_scrape_insert.sql"],
            capture_output=True, text=True, cwd="/root/projects/getautoapply", timeout=120)
        if r.returncode == 0:
            total += len(batch)
        else:
            print(f"    DB error: {r.stderr[:80]}")
    return total

# ─── Main ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"=== Job Scraper {datetime.now().strftime('%Y-%m-%d %H:%M')} ===\n")
    
    all_jobs = []
    
    # Phase 1: Free APIs (fast)
    print("Phase 1: Free APIs")
    all_jobs.extend(remoteok())
    all_jobs.extend(remotive())
    all_jobs.extend(jobicy())
    all_jobs.extend(weworkremotely())
    
    # Phase 2: JobSpy (LinkedIn + Indeed, multiple terms)
    print("\nPhase 2: JobSpy (LinkedIn + Indeed)")
    all_jobs.extend(jobspy_scrape())
    
    print(f"\nTotal scraped: {len(all_jobs)}")
    inserted = insert_batch(all_jobs)
    print(f"Inserted: {inserted}")
    
    # Show totals by source
    r = subprocess.run(
        ["supabase","db","query","--linked","-f","-"],
        input="SELECT source, COUNT(*) as n FROM public.jobs WHERE is_active GROUP BY source ORDER BY n DESC;",
        capture_output=True, text=True, cwd="/root/projects/getautoapply", timeout=30)
    if r.returncode == 0:
        print(f"\n{r.stdout.strip()}")
