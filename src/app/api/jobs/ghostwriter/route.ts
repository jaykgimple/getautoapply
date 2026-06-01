import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Ghostwriter: AI-powered job application assistant
// Modes: cover_letter, outreach, interview_prep, followup, negotiation, resume_bullet, linkedin_summary, thankyou, rejection_response, recruiter_screen_answer, salary_negotiation, application_check, company_research, custom

const MODE_DESCRIPTIONS: Record<string, string> = {
  cover_letter: 'Generate a tailored cover letter for this specific job',
  outreach: 'Write a LinkedIn outreach message to a recruiter or hiring manager at this company',
  interview_prep: 'Provide key talking points and likely questions for this specific interview',
  followup: 'Write a follow-up email after an interview or application',
  negotiation: 'Draft a salary/offer negotiation response',
  resume_bullet: 'Rewrite 3-5 resume bullet points tailored to this job description',
  linkedin_summary: 'Write a LinkedIn "About" summary optimized for this role type',
  thankyou: 'Write a post-interview thank you note',
  rejection_response: 'Draft a professional response to a rejection (request feedback)',
  recruiter_screen_answer: 'Prepare answers for common recruiter screening questions for this role',
  salary_negotiation: 'Generate a script for salary negotiation conversations',
  application_check: 'Review and critique a draft application (provide the draft in the context)',
  company_research: 'Summarize key things to know about this company before an interview',
  custom: 'Custom instruction — specify exactly what you need in the context',
};

async function callLlm(prompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No LLM API key');
  const model = process.env.LLM_MODEL || 'anthropic/claude-sonnet-4';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://jobbox-os.vercel.app',
      'X-Title': 'GetAutoApply Ghostwriter',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobId = body.jobId as string;
    const mode = (body.mode as string) || 'cover_letter';
    const context = (body.context as string) || '';
    const previousMessages = (body.messages as Array<{ role: string; content: string }>) || [];

    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Fetch user profile for personalization
    const { data: profile } = await supabase
      .from('user_job_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const jobDesc = (job.description || '').substring(0, 4000);
    const resumeSummary = profile
      ? 'Name: ' + (profile.full_name || 'Candidate') + '\n'
        + 'Headline: ' + (profile.professional_headline || '') + '\n'
        + 'Skills: ' + (profile.core_skills || []).join(', ') + '\n'
        + 'Summary: ' + (profile.about_me || '') + '\n'
        + 'Years experience: ' + (profile.years_experience || 'N/A') + '\n'
        + 'Resume: ' + (profile.resume_plaintext || profile.resume_markdown || '').substring(0, 2000)
      : 'No profile on file. Ask the user for their background for better results.';

    const modeDesc = MODE_DESCRIPTIONS[mode] || MODE_DESCRIPTIONS['custom'];

    const systemPrompt = 'You are the Ghostwriter — an expert career communications AI for GetAutoApply. '
      + 'You write compelling, professional, and tailored job application materials. '
      + 'Current mode: ' + mode + ' — ' + modeDesc + '.\n\n'
      + '=== JOB ===\nTitle: ' + (job.title || '') + '\nCompany: ' + (job.company || '') + '\nLocation: ' + (job.location || '') + '\nDescription: ' + jobDesc + '\n\n'
      + '=== CANDIDATE PROFILE ===\n' + resumeSummary + '\n\n'
      + (context ? '=== ADDITIONAL CONTEXT FROM USER ===\n' + context + '\n\n' : '')
      + 'Write the best possible output for this mode. Be specific, professional, and actionable. '
      + 'Use the candidate\'s actual experience and skills from the profile. '
      + 'Reference the specific company and role where relevant.';

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...previousMessages,
    ];

    // If there is no user message yet, add one requesting the output
    if (previousMessages.length === 0 || previousMessages[previousMessages.length - 1].role !== 'user') {
      messages.push({ role: 'user', content: modeDesc + '. Make it specific, professional, and ready to use.' });
    }

    const llmRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY}`,
        'HTTP-Referer': 'https://jobbox-os.vercel.app',
        'X-Title': 'GetAutoApply Ghostwriter',
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'anthropic/claude-sonnet-4',
        messages,
        temperature: 0.4,
        max_tokens: 2000,
      }),
    });
    const llmData = await llmRes.json();
    const content = llmData.choices?.[0]?.message?.content || 'Error generating response';

    // Save to application notes for history
    try {
      await supabase.from('application_notes').insert({
        user_id: user.id,
        job_id: jobId,
        note_title: 'Ghostwriter: ' + mode,
        note_body: content,
      });
    } catch {
      // Non-critical — don't fail if note can't be saved
    }

    return NextResponse.json({
      content,
      mode,
      modeDescription: modeDesc,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ghostwriter error:', message);
    return NextResponse.json({ error: 'Ghostwriter failed', message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Return available modes
  return NextResponse.json({ modes: MODE_DESCRIPTIONS });
}
