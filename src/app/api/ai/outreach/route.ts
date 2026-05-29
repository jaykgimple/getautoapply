import { NextRequest, NextResponse } from 'next/server'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

async function callOpenRouter(messages: Array<{role: string; content: string}>, maxTokens = 2000): Promise<string> {
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

// ── Outreach Message Generation ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contactName, company, userBackground, tone = 'professional' } = body

    if (!contactName) {
      return NextResponse.json({ error: 'Missing contactName' }, { status: 400 })
    }

    const toneMap: Record<string, string> = {
      professional: 'professional and warm',
      casual: 'friendly and conversational',
      formal: 'formal and respectful',
      direct: 'direct and to-the-point',
    }

    const systemPrompt = `You write short, personalized outreach messages to recruiters and professional contacts. Rules:
- Keep it under 150 words
- Reference the recipient's company or role naturally
- Sound human — no generic templates or robotic language
- Include a clear but low-pressure call to action
- Match the specified tone
- Return ONLY the message text, no commentary`

    const userPrompt = `Write an outreach message.

Recipient: ${contactName}${company ? ` at ${company}` : ''}
${userBackground ? `About me: ${userBackground}` : 'I am a professional looking for new opportunities.'}
Tone: ${toneMap[tone] || tone}

Write a concise, personalized outreach message.`

    const message = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 1000)

    return NextResponse.json({ message })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
