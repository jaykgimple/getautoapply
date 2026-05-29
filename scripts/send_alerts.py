#!/usr/bin/env python3
"""
GetAutoApply — Job Alert Email Worker
Runs daily (or via cron) to send job alert emails to users.

Usage:
  python3 send_alerts.py --dry-run    # Test without sending
  python3 send_alerts.py             # Send real emails

Set env vars:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
  APP_URL=https://getautoapply.vercel.app
"""

import os
import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
APP_URL = os.environ.get("APP_URL", "https://getautoapply.vercel.app")

# SMTP config
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASSWORD", "")

dry_run = "--dry-run" in sys.argv


def supabase_request(method, path, data=None, params=None):
    """Make a request to Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)

    req = urllib.request.Request(url, method=method)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=representation")

    if data:
        req.data = json.dumps(data).encode()

    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def get_active_alerts():
    """Fetch all active job alerts."""
    try:
        return supabase_request("GET", "job_alerts", params={
            "is_active": "eq.true",
            "select": "*, profiles(id,email,full_name)",
            "order": "created_at.asc",
        })
    except Exception as e:
        print(f"Error fetching alerts: {e}")
        return []


def search_jobs_for_alert(alert):
    """Search jobs using the free Indeed RSS API (no key needed)."""
    query = urllib.parse.quote(alert["query"])
    location = urllib.parse.quote(alert.get("location") or "")

    # Indeed RSS
    rss_url = f"https://rss.indeed.com/rss?q={query}&l={location}"
    try:
        req = urllib.request.Request(rss_url, headers={"User-Agent": "GetAutoApply/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read().decode("utf-8", errors="replace")
            # Simple XML parsing
            import re
            items = re.findall(r"<item>(.*?)</item>", data, re.DOTALL)
            jobs = []
            for item in items[:10]:
                title = re.search(r"<title>(.*?)</title>", item)
                link = re.search(r"<link>(.*?)</link>", item)
                desc = re.search(r"<description>(.*?)</description>", item)
                pub_date = re.search(r"<pubDate>(.*?)</pubDate>", item)
                company = re.search(r"<source>(.*?)</source>", item)
                jobs.append({
                    "title": title.group(1).strip() if title else "Unknown",
                    "url": link.group(1).strip() if link else "",
                    "description": desc.group(1).strip()[:300] if desc else "",
                    "company": company.group(1).strip() if company else "",
                    "published": pub_date.group(1).strip() if pub_date else "",
                })
            return jobs
    except Exception as e:
        print(f"Indeed RSS error: {e}")
        return []


def send_email(to_email, subject, html_body, text_body):
    """Send email via SMTP."""
    if dry_run:
        print(f"  [DRY RUN] Would send to {to_email}: {subject}")
        return True

    if not SMTP_USER or not SMTP_PASS:
        print(f"  [SKIP] No SMTP credentials configured")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"GetAutoApply <{SMTP_USER}>"
        msg["To"] = to_email
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        print(f"  ✓ Sent to {to_email}")
        return True
    except Exception as e:
        print(f"  ✗ Failed to send to {to_email}: {e}")
        return False


def build_alert_email(alert, jobs):
    """Build HTML email for a job alert."""
    query = alert["query"]
    location = alert.get("location") or "Any location"
    user_name = alert.get("profiles", {}).get("full_name", "there")

    jobs_html = ""
    for job in jobs[:8]:
        jobs_html += f"""
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
            <a href="{job['url']}" style="color:#5e6ad2;text-decoration:none;font-weight:600;font-size:15px;">
              {job['title']}
            </a>
            <div style="color:#6b7280;font-size:13px;margin-top:2px;">
              {job.get('company', '')}
            </div>
            <div style="color:#9ca3af;font-size:12px;margin-top:4px;line-height:1.4;">
              {job.get('description', '')[:200]}
            </div>
          </td>
        </tr>"""

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
      <div style="background:linear-gradient(135deg,#5e6ad2,#4f46e5);padding:24px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:20px;">New Job Matches</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">
          For "{query}" in {location}
        </p>
      </div>
      <div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <table style="width:100%;border-collapse:collapse;">
          {jobs_html}
        </table>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
          <a href="{APP_URL}/search?q={urllib.parse.quote(query)}&location={urllib.parse.quote(location)}"
             style="display:inline-block;background:#5e6ad2;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            View All Matches →
          </a>
        </div>
      </div>
      <div style="padding:12px 20px;text-align:center;color:#9ca3af;font-size:11px;">
        <a href="{APP_URL}/dashboard" style="color:#6b7280;">Manage alerts</a> ·
        <a href="{APP_URL}/dashboard" style="color:#6b7280;">Unsubscribe</a>
      </div>
    </div>
    """

    text = f"New Job Matches for '{query}' in {location}\n\n"
    for job in jobs[:8]:
        text += f"• {job['title']} — {job.get('company', '')}\n  {job['url']}\n\n"
    text += f"\nView all: {APP_URL}/search?q={query}\n"

    return html, text


def update_alert_last_sent(alert_id):
    """Update the last_sent_at timestamp for an alert."""
    try:
        supabase_request("PATCH", f"job_alerts?id=eq.{alert_id}", {
            "last_sent_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        print(f"Error updating alert {alert_id}: {e}")


def main():
    print(f"{'[DRY RUN] ' if dry_run else ''}GetAutoApply Job Alert Worker")
    print(f"Time: {datetime.now(timezone.utc).isoformat()}")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    print("\nFetching active alerts...")
    alerts = get_active_alerts()
    print(f"Found {len(alerts)} active alerts")

    sent_count = 0
    error_count = 0

    for alert in alerts:
        user = alert.get("profiles", {})
        email = user.get("email")
        if not email:
            continue

        # Check frequency
        freq = alert.get("frequency", "daily")
        last_sent = alert.get("last_sent_at")
        if last_sent:
            last = datetime.fromisoformat(last_sent.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            if freq == "daily" and (now - last) < timedelta(hours=20):
                continue
            if freq == "weekly" and (now - last) < timedelta(days=6):
                continue

        print(f"\nAlert: '{alert['query']}' for {email}")

        # Search jobs
        jobs = search_jobs_for_alert(alert)
        print(f"  Found {len(jobs)} jobs")

        if not jobs:
            continue

        # Build and send email
        html, text = build_alert_email(alert, jobs)
        subject = f"🔍 {len(jobs)} new job match{'es' if len(jobs) > 1 else ''} for \"{alert['query']}\""

        if send_email(email, subject, html, text):
            update_alert_last_sent(alert["id"])
            sent_count += 1
        else:
            error_count += 1

    print(f"\n{'='*40}")
    print(f"Sent: {sent_count} | Errors: {error_count} | Total alerts: {len(alerts)}")


if __name__ == "__main__":
    main()
