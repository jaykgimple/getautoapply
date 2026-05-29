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
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── Resume Tailoring ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { resumeText, jobTitle, jobDescription, company } = body

    if (!resumeText || !jobTitle) {
      return NextResponse.json({ error: 'Missing resumeText or jobTitle' }, { status: 400 })
    }

    const systemPrompt = `You are an expert resume writer and ATS optimization specialist. Given a resume and a job description, rewrite the resume to be optimized for that specific job. Rules:
1. Mirror keywords from the job description naturally — don't keyword-stuff
2. Highlight the most relevant experience first
3. Adjust the headline/summary to align with the role
4. Keep all content truthful — only reorder and reframe, don't invent experience
5. Return ONLY the rewritten resume text, no commentary`

    const userPrompt = `RESUME:
${resumeText}

TARGET JOB:
Title: ${jobTitle}
${company ? `Company: ${company}` : ''}
Description: ${jobDescription || '(no description provided)'}

Rewrite this resume to be ATS-optimized for this specific job.`

    const tailoredResume = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 4000)

    return NextResponse.json({ tailoredResume })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
