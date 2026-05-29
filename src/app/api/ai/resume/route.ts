import { NextRequest, NextResponse } from 'next/server'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

async function callOpenRouter(messages: Array<{role: string; content: string}>, maxTokens = 3000): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured')

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'openrouter/owl-alpha', messages, max_tokens: maxTokens }),
  })
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ─── ATS Resume Scoring ───
// Analyzes resume against job description, returns score + actionable feedback
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { resumeText, jobTitle, jobDescription, company } = body

    if (!resumeText) {
      return NextResponse.json({ error: 'Missing resumeText' }, { status: 400 })
    }

    const systemPrompt = `You are an expert ATS (Applicant Tracking System) analyst and resume reviewer. Analyze the given resume against the job description and return a detailed assessment.

Return your analysis as a JSON object with this exact structure:
{
  "overallScore": <number 0-100>,
  "breakdown": {
    "keywordMatch": <number 0-100>,
    "skillsAlignment": <number 0-100>,
    "experienceRelevance": <number 0-100>,
    "formatCompliance": <number 0-100>,
    "impactQuantification": <number 0-100>
  },
  "matchedSkills": [<list of skills from resume that match the job>],
  "missingSkills": [<list of skills mentioned in job description but missing from resume>],
  "suggestions": [<list of 5-8 specific, actionable suggestions to improve ATS score>],
  "summary": "<2-3 sentence overall assessment>"
}

Scoring criteria:
- keywordMatch: How well resume keywords align with job description keywords
- skillsAlignment: Overlap between required skills and resume skills
- experienceRelevance: How relevant the work experience is to the role
- formatCompliance: Standard resume format, clear sections, no problematic elements
- impactQuantification: Use of numbers, percentages, and measurable achievements

Be precise and honest. Return ONLY valid JSON, no markdown, no commentary.`

    const userPrompt = `RESUME:
${resumeText.substring(0, 8000)}

${jobTitle ? `TARGET JOB TITLE: ${jobTitle}` : ''}
${company ? `COMPANY: ${company}` : ''}
${jobDescription ? `JOB DESCRIPTION:\n${jobDescription.substring(0, 4000)}` : 'No job description provided — analyze resume quality in general.'}

Analyze this resume and return the ATS assessment JSON.`

    const raw = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 3000)

    // Parse JSON from response
    let analysis: any = {}
    try {
      // Try to extract JSON from the response (may have markdown wrapping)
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        analysis = JSON.parse(raw)
      }
    } catch {
      // Fallback: return raw text
      return NextResponse.json({
        overallScore: 0,
        breakdown: {},
        matchedSkills: [],
        missingSkills: [],
        suggestions: ['AI analysis could not be parsed. Please try again.'],
        summary: raw.substring(0, 500),
        parseError: true,
      })
    }

    return NextResponse.json(analysis)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── Quick ATS keyword extraction (no AI, fast) ───
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const resumeText = searchParams.get('resume') || ''
    const jobText = searchParams.get('job') || ''

    if (!resumeText || !jobText) {
      return NextResponse.json({ error: 'Provide resume and job query params' }, { status: 400 })
    }

    // Extract keywords from job description
    const jobWords = extractKeywords(jobText)
    const resumeWords = new Set(extractKeywords(resumeText))

    const matched = jobWords.filter(w => resumeWords.has(w))
    const missing = jobWords.filter(w => !resumeWords.has(w))
    const score = jobWords.length > 0 ? Math.round((matched.length / jobWords.length) * 100) : 0

    return NextResponse.json({
      score,
      matched,
      missing,
      total: jobWords.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Simple keyword extraction
function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase()
  // Remove common stop words
  const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','shall','can','need','dare','ought','used','this','that','these','those','it','its','i','me','my','we','our','you','your','he','she','they','them','their','what','which','who','whom','how','when','where','why','not','no','nor','as','if','then','than','too','very','just','about','above','after','again','all','also','am','any','because','before','between','both','each','few','further','get','got','here','into','more','most','other','out','over','own','same','so','some','such','through','under','until','up','very','while'])

  const words = normalized
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))

  // Return unique keywords
  return [...new Set(words)].slice(0, 80)
}
