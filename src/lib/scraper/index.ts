import { createClient as createServerClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sabexijntgtwflthkzdh.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Free job board APIs and scraping sources
const JOB_SOURCES = {
  // Remote job boards with free APIs
  remoteok: {
    name: 'RemoteOK',
    url: 'https://remoteok.com/api',
    parser: (data: any[]) => data.map((j: any) => ({
      title: j.position || j.title,
      company: j.company,
      location: 'Remote',
      job_url: j.url || j.apply_url,
      description: j.description,
      source: 'remoteok',
      remote_type: 'remote',
      job_type: 'full_time',
      posted_date: j.date ? new Date(j.date).toISOString().split('T')[0] : null,
      tags: j.tags || [],
    })),
  },
  we_work_remotely: {
    name: 'We Work Remotely',
    url: 'https://weworkremotely.com/remote-jobs.rss',
    type: 'rss',
  },
  // GitHub Jobs (deprecated but some mirrors exist)
  // StackOverflow Jobs (deprecated)
  // AngelList/Wellfound
  wellfound: {
    name: 'Wellfound (AngelList)',
    url: 'https://wellfound.com/api/v1/jobs',
    type: 'api',
  },
}

// Fortune 500 companies with known career page patterns
const FORTUNE_500_CAREER_PAGES = [
  { name: 'Apple', domain: 'apple.com', careersPath: '/careers/us/' },
  { name: 'Microsoft', domain: 'microsoft.com', careersPath: '/en-us/careers/' },
  { name: 'Amazon', domain: 'amazon.jobs', careersPath: '/en/' },
  { name: 'Google', domain: 'careers.google.com', careersPath: '/' },
  { name: 'Meta', domain: 'metacareers.com', careersPath: '/' },
  { name: 'Netflix', domain: 'jobs.netflix.com', careersPath: '/' },
  { name: 'Tesla', domain: 'tesla.com', careersPath: '/careers' },
  { name: 'Nvidia', domain: 'nvidia.com', careersPath: '/about-nvidia/careers/' },
  { name: 'Salesforce', domain: 'salesforce.com', careersPath: '/company/careers/' },
  { name: 'Adobe', domain: 'adobe.com', careersPath: '/careers.html' },
  { name: 'Oracle', domain: 'oracle.com', careersPath: '/corporate/careers/' },
  { name: 'IBM', domain: 'ibm.com', careersPath: '/careers/' },
  { name: 'Intel', domain: 'intel.com', careersPath: '/content/www/us/en/jobs/jobs-at-intel.html' },
  { name: 'Cisco', domain: 'cisco.com', careersPath: '/careers/' },
  { name: 'Walmart', domain: 'careers.walmart.com', careersPath: '/' },
  { name: 'JPMorgan', domain: 'careers.jpmorgan.com', careersPath: '/us/en/home' },
  { name: 'Bank of America', domain: 'careers.bankofamerica.com', careersPath: '/en-us' },
  { name: 'Goldman Sachs', domain: 'goldmansachs.com', careersPath: '/careers/' },
  { name: 'Morgan Stanley', domain: 'morganstanley.com', careersPath: '/careers' },
  { name: 'Berkshire Hathaway', domain: 'berkshirehathaway.com', careersPath: '/jobs/' },
]

export async function scrapeRemoteOK(): Promise<any[]> {
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': 'GetAutoApply/1.0' },
    })
    if (!res.ok) return []
    const data = await res.json()
    // First item is usually metadata
    const jobs = Array.isArray(data) ? data.slice(1) : []
    return jobs.map((j: any) => ({
      title: j.position || j.title || 'Unknown',
      company: j.company || 'Unknown',
      location: 'Remote',
      job_url: j.url || j.apply_url || '',
      description: j.description || '',
      raw_description: j.description || '',
      source: 'remoteok',
      remote_type: 'remote',
      job_type: inferJobType(j.tags || []),
      posted_date: j.date ? new Date(j.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      company_url: j.company_logo ? `https://${j.domain || ''}` : null,
      is_active: true,
    }))
  } catch (e) {
    console.error('RemoteOK scrape failed:', e)
    return []
  }
}

export async function scrapeWellfound(keywords: string = 'software'): Promise<any[]> {
  try {
    const res = await fetch(`https://wellfound.com/api/v1/jobs?query=${encodeURIComponent(keywords)}&per_page=50`, {
      headers: { 'User-Agent': 'GetAutoApply/1.0' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.jobs || []).map((j: any) => ({
      title: j.title || 'Unknown',
      company: j.startup?.name || j.company || 'Unknown',
      location: j.location_names?.join(', ') || 'Remote',
      job_url: j.wellfound_url || '',
      description: j.description || '',
      raw_description: j.description || '',
      source: 'wellfound',
      remote_type: j.remote ? 'remote' : 'onsite',
      job_type: inferJobType([j.role_type].filter(Boolean)),
      posted_date: j.created_at ? new Date(j.created_at).toISOString().split('T')[0] : null,
      company_url: j.startup?.wellfound_url || null,
      is_active: true,
    }))
  } catch (e) {
    console.error('Wellfound scrape failed:', e)
    return []
  }
}

// Firecrawl-powered scraper for any company career page
export async function scrapeWithFirecrawl(url: string, companyName: string): Promise<any[]> {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
  if (!FIRECRAWL_API_KEY) {
    console.warn('FIRECRAWL_API_KEY not set, skipping Firecrawl scrape')
    return []
  }

  try {
    // Use Firecrawl to extract structured job listings from a career page
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['extract'],
        extract: {
          schema: {
            type: 'object',
            properties: {
              jobs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    location: { type: 'string' },
                    url: { type: 'string' },
                    description: { type: 'string' },
                    department: { type: 'string' },
                    type: { type: 'string' },
                  },
                },
              },
            },
          },
          prompt: `Extract all job listings from this career page. For each job, get: title, location, URL (link to the job posting), description/summary, department, and job type (full-time, part-time, contract, internship).`,
        },
      }),
    })

    if (!res.ok) {
      console.error(`Firecrawl failed for ${companyName}: ${res.status}`)
      return []
    }

    const data = await res.json()
    const jobs = data.data?.extract?.jobs || []
    return jobs.map((j: any) => ({
      title: j.title || 'Unknown',
      company: companyName,
      location: j.location || '—',
      job_url: j.url || url,
      description: j.description || '',
      raw_description: j.description || '',
      source: 'firecrawl',
      remote_type: j.location?.toLowerCase().includes('remote') ? 'remote' : 'onsite',
      job_type: inferJobType([j.type].filter(Boolean)),
      posted_date: new Date().toISOString().split('T')[0],
      company_url: url,
      is_active: true,
    }))
  } catch (e) {
    console.error(`Firecrawl scrape failed for ${companyName}:`, e)
    return []
  }
}

// Save jobs to Supabase with deduplication
export async function saveJobsToSupabase(jobs: any[]): Promise<{ inserted: number; skipped: number }> {
  if (!SERVICE_KEY) return { inserted: 0, skipped: 0 }

  const supabase = createServerClient(SUPABASE_URL, SERVICE_KEY)
  let inserted = 0
  let skipped = 0

  for (const job of jobs) {
    if (!job.title || !job.company) continue

    // Check for duplicate by URL or title+company
    const { data: existing } = await supabase
      .from('jobs')
      .select('id')
      .or(`job_url.eq.${job.job_url},and(title.eq.${job.title},company.eq.${job.company})`)
      .limit(1)

    if (existing && existing.length > 0) {
      skipped++
      continue
    }

    const { error } = await supabase.from('jobs').insert({
      title: job.title,
      company: job.company,
      location: job.location,
      job_url: job.job_url,
      description: job.description,
      raw_description: job.raw_description,
      source: job.source,
      remote_type: job.remote_type,
      job_type: job.job_type,
      posted_date: job.posted_date,
      company_url: job.company_url,
      is_active: true,
      // user_id is null for scraped jobs (system-wide)
    })

    if (!error) inserted++
  }

  return { inserted, skipped }
}

// Run full scrape cycle
export async function runFullScrape(): Promise<{ total: number; inserted: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  let allJobs: any[] = []

  // Scrape RemoteOK
  try {
    const remoteokJobs = await scrapeRemoteOK()
    allJobs = allJobs.concat(remoteokJobs)
  } catch (e: any) {
    errors.push(`RemoteOK: ${e.message}`)
  }

  // Scrape Wellfound
  try {
    const wellfoundJobs = await scrapeWellfound('software engineer')
    allJobs = allJobs.concat(wellfoundJobs)
  } catch (e: any) {
    errors.push(`Wellfound: ${e.message}`)
  }

  // Save to Supabase
  const { inserted, skipped } = await saveJobsToSupabase(allJobs)

  return {
    total: allJobs.length,
    inserted,
    skipped,
    errors,
  }
}

function inferJobType(tags: string[]): string {
  const t = tags.map(x => x.toLowerCase()).join(' ')
  if (t.includes('contract') || t.includes('freelance')) return 'contract'
  if (t.includes('part-time') || t.includes('part time')) return 'part_time'
  if (t.includes('intern')) return 'internship'
  if (t.includes('temporary') || t.includes('temp')) return 'temporary'
  return 'full_time'
}

export { FORTUNE_500_CAREER_PAGES }
