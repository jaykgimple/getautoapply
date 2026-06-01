#!/bin/bash
# Daily job scraper - runs all sources via JobSpy + free APIs
cd /root/projects/getautoapply
echo "=== Job Scraper $(date) ===" >> scripts/scrape.log
python3 scripts/scrape_all.py >> scripts/scrape.log 2>&1
echo "=== Done $(date) ===" >> scripts/scrape.log
