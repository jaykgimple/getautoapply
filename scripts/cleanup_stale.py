#!/usr/bin/env python3
"""
Stale job cleanup.
Run hourly: deactivates jobs not seen in 30+ days.
Also removes very old inactive jobs (90+ days).
"""
import subprocess
from datetime import datetime

def run_sql(sql, timeout=60):
    with open("/tmp/_cleanup.sql", "w") as f:
        f.write(sql)
    r = subprocess.run(
        ["supabase", "db", "query", "--linked", "-f", "/tmp/_cleanup.sql"],
        capture_output=True, text=True, cwd="/root/projects/getautoapply", timeout=timeout
    )
    return r.returncode == 0, r.stdout.strip(), r.stderr.strip()

def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Starting stale job cleanup...")
    
    # Step 1: Count jobs about to be deactivated
    ok, out, err = run_sql("""
        SELECT COUNT(*) as stale_count FROM public.jobs 
        WHERE is_active = true 
          AND last_seen_at < NOW() - INTERVAL '30 days'
          AND source LIKE 'jobspy%';
    """)
    if ok:
        lines = out.strip().split("\n")
        if len(lines) >= 3:
            print(f"  Stale jobs (30+ days, jobspy): {lines[2].strip()}")
    
    # Step 2: Deactivate stale scraped jobs (keep manual/user-saved jobs)
    ok, out, err = run_sql("""
        UPDATE public.jobs 
        SET is_active = false 
        WHERE is_active = true 
          AND last_seen_at < NOW() - INTERVAL '30 days'
          AND source LIKE 'jobspy%';
    """, timeout=120)
    if ok:
        print(f"  Deactivated stale jobspy jobs")
    else:
        print(f"  Error deactivating: {err[:80]}")
    
    # Step 3: Hard-delete very old inactive jobs (90+ days)
    ok, out, err = run_sql("""
        DELETE FROM public.jobs 
        WHERE is_active = false 
          AND last_seen_at < NOW() - INTERVAL '90 days';
    """, timeout=120)
    if ok:
        print(f"  Deleted 90+ day old inactive jobs")
    
    # Step 4: Show current stats
    ok, out, err = run_sql("""
        SELECT 
            COUNT(*) FILTER (WHERE is_active) as active,
            COUNT(*) FILTER (WHERE NOT is_active) as inactive,
            COUNT(*) as total
        FROM public.jobs;
    """)
    if ok:
        print(f"  Stats: {out.strip()}")

if __name__ == "__main__":
    main()
