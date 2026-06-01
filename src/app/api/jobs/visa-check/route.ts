import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Curated list of known visa-sponsoring companies
const KNOWN_SPONSORS = new Set([
  // Big Tech
  'google', 'alphabet', 'amazon', 'aws', 'microsoft', 'meta', 'apple',
  'netflix', 'adobe', 'salesforce', 'oracle', 'ibm', 'intel', 'nvidia',
  'amd', 'qualcomm', 'cisco', 'vmware', 'sap', 'workday', 'servicenow',
  'snowflake', 'databricks', 'palantir', 'stripe', 'square', 'block',
  'twitter', 'x corp', 'uber', 'lyft', 'airbnb', 'doordash', 'instacart',
  'pinterest', 'snap', 'snapchat', 'tiktok', 'byte dance', 'bytedance',
  'spotify', 'slack', 'atlassian', 'zoom', 'twilio', 'shopify',
  'pcloud', 'dropbox', 'box', 'cloudflare', 'cloud flare', 'akamai',
  'mongodb', 'elastic', 'grafana labs', 'hashicorp', 'gitlab', 'github',
  'red hat', 'canonical', 'docker', 'puppet', 'chef', 'new relic',
  'splunk', 'dynatrace', 'datadog', 'sentry', 'vercel', 'netlify',
  'heroku', 'digitalocean', 'linode', 'fastly', 'cloudflare',

  // AI / ML
  'openai', 'anthropic', 'cohere', 'mistral', 'midjourney', 'stability ai',
  'hugging face', 'huggingface', 'together ai', 'anyscale', 'modal',
  'langchain', 'pinecone', 'weights and biases', 'wandb', 'replicate',
  'runway', 'fireflies', 'grammarly', 'jasper', 'typeface',
  'nuro', 'waymo', 'cruise', 'aurora', 'motive', 'samsara',
  'gong', 'chime', 'brex', 'ramp', 'plaid', 'deel', 'rippling',
  'gusto', 'carta', 'mercury', 'brex', 'ramp',
  'retool', 'airtable', 'temporal', 'elevenlabs', 'deepgram',

  // Finance / FinTech
  'goldman sachs', 'morgan stanley', 'jp morgan', 'jpmorgan',
  'morgan stanley', 'blackrock', 'citadel', 'two sigma', 'renaissance',
  'jump trading', 'citadel securities', 'point72', 'd.e. shaw',
  'ackman', 'elliott', 'kkr', 'carlyle', 'apollo', 'blackstone',
  'fidelity', 'charles schwab', 'vanguard', 't. rowe price',
  'paypal', 'venwise', 'affirm', 'klarna', 'robinhood', 'coinbase',
  'kraken', 'circle', 'ftx', 'genesis',

  // Consulting / Professional Services
  'mckinsey', 'bcg', 'bain', 'deloitte', 'pwc', 'pricewaterhousecoopers',
  'ey', 'ernst and young', 'kpmg', 'accenture', 'capgemini', 'cognizant',
  'infosys', 'tcs', 'tata consultancy', 'wipro', 'tech mahindra',

  // Biotech / Pharma
  'pfizer', 'moderna', 'biontech', 'johnson and johnson', 'novartis',
  'roche', 'merck', 'abbvie', 'bristol myers', 'eli lilly', 'amgen',
  'gilead', 'regeneron', 'vertex', 'biogen', 'illumina',

  // UK-specific
  'wise', 'revolut', 'monzo', 'starling bank', 'natwest', 'lloyds',
  'santander uk', 'barclays uk', 'hsbc uk', 'standard chartered',
  'arm holdings', 'deepmind', 'grafana',
]);

// Keywords that indicate visa sponsorship in job descriptions
const SPONSORSHIP_KEYWORDS = [
  'visa sponsorship', 'visa sponsor', 'sponsorship available',
  'will sponsor', 'sponsorship provided', 'h1b', 'h-1b', 'h1-b',
  'tier 2', 'tier2', 'skilled worker', 'global talent visa',
  'right to work sponsorship', 'work authorization sponsorship',
  'relocation assistance', 'international candidates welcome',
  'worldwide applicants', 'all backgrounds welcome',
  'employment sponsorship', 'immigration sponsorship',
  'eb-1', 'eb-2', 'eb-3', 'greencard sponsorship', 'green card sponsorship',
  'opt', 'cpt', 'stem opt', 'tn visa',
  'intra-company transfer', 'ict visa',
  'blue card', 'eu blue card',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, description, companyName } = body;

    let text = description || '';
    let company = companyName || '';

    // If jobId provided, fetch from DB
    if (jobId && !text) {
      const supabase = await createClient();
      const { data: job } = await supabase
        .from('jobs')
        .select('description, company_name')
        .eq('id', jobId)
        .single();
      if (job) {
        text = job.description || '';
        company = job.company_name || '';
      }
    }

    if (!text && !company) {
      return NextResponse.json(
        { error: 'Provide jobId or description + companyName' },
        { status: 400 }
      );
    }

    const textLower = (text + ' ' + company).toLowerCase();

    // Check 1: Known sponsor company match
    const matchedCompanies: string[] = [];
    for (const sponsor of KNOWN_SPONSORS) {
      if (textLower.includes(sponsor)) {
        matchedCompanies.push(sponsor);
      }
    }

    // Check 2: Keyword matches
    const matchedKeywords: string[] = [];
    for (const kw of SPONSORSHIP_KEYWORDS) {
      if (textLower.includes(kw)) {
        matchedKeywords.push(kw);
      }
    }

    // Score calculation
    let score = 0;
    const reasoning: string[] = [];

    if (matchedCompanies.length > 0) {
      score += 0.5;
      reasoning.push(`Known sponsor company matched: ${matchedCompanies.slice(0, 5).join(', ')}`);
    }

    if (matchedKeywords.length > 0) {
      score += 0.3;
      reasoning.push(`Sponsorship keywords found: ${matchedKeywords.slice(0, 5).join(', ')}`);
    }

    // Bonus: strong explicit signal
    if (textLower.includes('visa sponsorship') || textLower.includes('will sponsor')) {
      score += 0.2;
      reasoning.push('Explicit sponsorship language detected');
    }

    score = Math.min(score, 1.0);

    return NextResponse.json({
      score: Math.round(score * 100) / 100,
      likelihood: score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low',
      matched_companies: matchedCompanies,
      matched_keywords: matchedKeywords,
      reasoning,
      summary:
        score >= 0.7
          ? 'Strong indicators of visa sponsorship'
          : score >= 0.4
          ? 'Some sponsorship signals detected'
          : 'No clear sponsorship indicators found',
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Visa check failed', details: String(err) },
      {status:500}
    );
  }
}
