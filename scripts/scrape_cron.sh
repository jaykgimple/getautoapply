#!/bin/bash
# Multi-source job scraper cron runner
# Run every 10 minutes via cron
# Rotates through 6 pairs per full cycle (60 min):
#   Pair 1: remoteok + remotive
#   Pair 2: weworkremotely + jobicy
#   Pair 3: arbeitnow + greenhouse (free API boards)
#   Pair 4: lever + python_jobs
#   Pair 5: JobSpy — LinkedIn + Indeed (2 search terms)
#   Pair 6: Remotive RSS + cleanup
# Full cycle = all sources refreshed every ~60 minutes

DATE=$(date +%Y%m%d-%H%M%S)
LOGDIR="/root/projects/getautoapply/logs"
mkdir -p "$LOGDIR"
LOG="$LOGDIR/scrape-$DATE.log"

STATE="/tmp/scrape_rotation"
if [ -f "$STATE" ]; then
  ROTATION=$(cat "$STATE" 2>/dev/null || echo "0")
else
  ROTATION=0
fi

IDX=$((ROTATION % 6))
cd /root/projects/getautoapply

echo "[$DATE] Rotation $IDX" >> "$LOG"

case $IDX in
  0)
    echo "  → RemoteOK + Remotive" >> "$LOG"
    python3 scripts/scrape_all_sources.py --source remoteok --max-per-source 100 >> "$LOG" 2>&1
    python3 scripts/scrape_all_sources.py --source remotive --max-per-source 100 >> "$LOG" 2>&1
    ;;
  1)
    echo "  → WeWorkRemotely + Jobicy" >> "$LOG"
    python3 scripts/scrape_all_sources.py --source weworkremotely --max-per-source 100 >> "$LOG" 2>&1
    python3 scripts/scrape_all_sources.py --source jobicy --max-per-source 100 >> "$LOG" 2>&1
    ;;
  2)
    echo "  → Arbeitnow + Greenhouse" >> "$LOG"
    python3 scripts/scrape_all_sources.py --source arbeitnow --max-per-source 100 >> "$LOG" 2>&1
    python3 scripts/scrape_all_sources.py --source greenhouse --max-per-source 100 >> "$LOG" 2>&1
    ;;
  3)
    echo "  → Lever + Python Jobs" >> "$LOG"
    python3 scripts/scrape_all_sources.py --source lever --max-per-source 100 >> "$LOG" 2>&1
    python3 scripts/scrape_all_sources.py --source python_jobs --max-per-source 100 >> "$LOG" 2>&1
    ;;
  4)
    echo "  → JobSpy: LinkedIn + Indeed (2 terms)" >> "$LOG"
    TERM1=$(python3 scripts/scheduler.py 2>/dev/null || echo "software engineer")
    TERM2=$(python3 scripts/scheduler.py 2>/dev/null || echo "backend engineer")
    python3 scripts/scrape_one.py "$TERM1" both >> "$LOG" 2>&1
    python3 scripts/scrape_one.py "$TERM2" both >> "$LOG" 2>&1
    ;;
  5)
    echo "  → Remotive RSS + Greenhouse batch 2" >> "$LOG"
    python3 scripts/scrape_all_sources.py --source remotive_rss --max-per-source 100 >> "$LOG" 2>&1
    python3 scripts/scrape_all_sources.py --source greenhouse2 --max-per-source 100 >> "$LOG" 2>&1
    ;;
esac

NEXT=$((ROTATION + 1))
echo "$NEXT" > "$STATE"

# Cleanup old logs (keep 3 days)
find "$LOGDIR" -mtime +3 -delete 2>/dev/null
