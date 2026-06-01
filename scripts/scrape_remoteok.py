#!/usr/bin/env python3
"""Multi-source job scraper. Inserts into Supabase via supabase db query CLI."""
import urllib.request, json, subprocess, re, sys

def remoteok():
    try:
        req = urllib.request.Request("https://remoteok.com/api",
            headers={"User-Agent": "GetAutoApply/1.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        jobs = []
        for j in data[:40]:
            if not j.get("position"): continue
            tags = j.get("tags", [])
            smin = smax = None
            s = str(j.get("salary", ""))
            if s:
                nums = re.findall(r'[\d,]+', s)
                if len(nums) >= 2: smin, smax = int(nums[0].replace(',','')), int(nums[1].replace(',',''))
            jt = "full_time"
            if any(t in [x.lower() for x in tags] for t in ["contract","freelance"]): jt = "contract"
            jobs.append((j["position"][:200], j.get("company","Unknown")[:200], "Remote",
                (j.get("url") or j.get("apply_url",""))[:500], (j.get("description",""))[:500],
                "remoteok", jt, "remote", json.dumps(tags), smin, smax))
        print(f"RemoteOK: {len(jobs)} jobs")
        return jobs
    except Exception as e:
        print(f"RemoteOK error: {e}")
        return []

def wework():
    import xml.etree.ElementTree as ET
    try:
        req = urllib.request.Request("https://weworkremotely.com/remote-jobs.rss",
            headers={"User-Agent": "GetAutoApply/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            root = ET.fromstring(r.read())
        jobs = []
        for item in root.findall(".//item")[:25]:
            title = item.findtext("title","").strip()
            link = item.findtext("link","").strip()
            desc = item.findtext("description","")[:500]
            company, job_title = "Unknown", title
            if " at " in title:
                p = title.rsplit(" at ", 1); job_title, company = p[0].strip(), p[1].strip()
            elif ": " in title:
                p = title.split(": ", 1); company, job_title = p[0].strip(), p[1].strip()
            jobs.append((job_title[:200], company[:200], "Remote", link[:500], desc,
                "weworkremotely", "full_time", "remote", "[]", None, None))
        print(f"WeWorkRemotely: {len(jobs)} jobs")
        return jobs
    except Exception as e:
        print(f"WeWorkRemotely error: {e}")
        return []

def insert_batch(jobs):
    if not jobs: return 0
    vals = []
    for (title, company, loc, url, desc, src, jt, rt, skills, smin, smax) in jobs:
        t = title.replace("'","''"); c = company.replace("'","''")
        u = url.replace("'","''"); d = desc.replace("'","''").replace("\\","\\\\")
        s = skills.replace("'","''")
        mi = str(smin) if smin else "NULL"; ma = str(smax) if smax else "NULL"
        vals.append(f"('{t}','{c}','{loc}','{u}','{d}','{src}','{jt}','{rt}','{s}'::jsonb,{mi},{ma},'active',true)")
    
    total = 0
    for i in range(0, len(vals), 10):
        batch = vals[i:i+10]
        sql = f"INSERT INTO public.jobs (title,company,location,job_url,description,source,job_type,remote_type,skills_required,salary_min,salary_max,status,is_active) VALUES {','.join(batch)} ON CONFLICT DO NOTHING;"
        with open("/tmp/_scrape_insert.sql","w") as f: f.write(sql)
        r = subprocess.run(["supabase","db","query","--linked","-f","/tmp/_scrape_insert.sql"],
            capture_output=True, text=True, cwd="/root/projects/getautoapply", timeout=30)
        if r.returncode == 0:
            total += len(batch)
        else:
            print(f"  Batch error: {r.stderr[:80]}")
    return total

# Run all scrapers
all_jobs = []
all_jobs.extend(remoteok())
all_jobs.extend(wework())

print(f"\nTotal scraped: {len(all_jobs)}")
inserted = insert_batch(all_jobs)
print(f"Inserted: {inserted}")
