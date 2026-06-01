#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Job scheduler — runs every 10 minutes via cron
# Picks the least-recently-scraped term from:
#   1. Default curated terms
#   2. Active user-saved search terms
# Then fires scrape_one.py with that term
# ═══════════════════════════════════════════════════════════════

cd /root/projects/getautoapply

# Get the next term to scrape (least recently run)
TERM=$(python3 scripts/scheduler.py 2>/dev/null)

if [ -z "$TERM" ]; then
  # Fallback: use a default term
  TERM="software engineer"
fi

echo "[$(date '+%H:%M:%S')] Running: $TERM" >> scripts/scrape.log
python3 scripts/scrape_one.py "$TERM" both >> scripts/scrape.log 2>&1

# Every 10th run (roughly hourly), also update last_seen_at for active jobs
# and deactivate stale ones
RUN_COUNT=$(cat scripts/run_count 2>/dev/null || echo 0)
RUN_COUNT=$((RUN_COUNT + 1))
echo $RUN_COUNT > scripts/run_count

# Delete the bulk scraper cron — we don't need it anymore
# (The daily scrape_all.py is replaced by this incremental approach)
