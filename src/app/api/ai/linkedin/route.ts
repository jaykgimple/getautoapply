import { NextRequest, NextResponse } from 'next/server'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

async function callOpenRouter(messages: Array<{role: string; content: string}>, maxTokens = 4000): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openrouter/owl-alpha',
      messages,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── LinkedIn Profile Analysis ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { profileText } = body

    if (!profileText || profileText.trim().length < 50) {
      return NextResponse.json({ error: 'Please provide your LinkedIn profile content (headline, about, experience, skills)' }, { status: 400 })
    }

    const systemPrompt = `You are aLinkedIn profile optimization expert and recruitment consultant. Analyze this LinkedIn profile and provide a comprehensive recruiter-friendly assessment.

Rate the profile on a rubric of 1-100 across these categories:
1. Headline Quality (is it keyword-rich and specific?)
2. About/Summary (compelling narrative? value proposition?)
3. Experience Descriptions (achievements vs duties? quantified results?)
4. Skills & Endorsements (relevant skills listed?)
5. Overall Completeness (all sections filled?)

Also provide:
- An overall Recruiter Attractiveness Score (1-100)
- Top 5 specific improvement suggestions
- 3 headline rewrite suggestions
- Key missing keywords for their industry

Respond in JSON:
{
  "scores": {
    "headline": 0-100,
    "about": 0-100,
    "experience": 0-100,
    "skills": 0-100,
    "completeness": 0-100,
    "overall": 0-100
  },
  "grade": "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F",
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["suggestion1", "suggestion2", "suggestion3", "suggestion4", "suggestion5"],
  "headlineSuggestions": ["headline1", "headline2", "headline3"],
  "missingKeywords": ["keyword1", "keyword2", "keyword3"],
  "summary": "2-3 sentence overall assessment"
}`

    const result = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `LinkedIn Profile Content:\n\n${profileText}` },
    ], 4000)

    const analysis = JSON.parse(result)
    return NextResponse.json({ analysis })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
