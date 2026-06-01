import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const ENRICH_SCHEMA = z.object({
  jobId: z.string().min(1),
  resumeData: z.object({
    fullName: z.string().min(1),
    headline: z.string().optional().default(''),
    summary: z.string().optional().default(''),
    skills: z.array(z.string()).default([]),
    experience: z.array(z.object({
      title: z.string(),
      company: z.string(),
      description: z.string().optional().default(''),
      achievements: z.array(z.string()).default([]),
      skills: z.array(z.string()).default([]),
      startDate: z.string().optional().default(''),
      endDate: z.string().nullable().optional(),
    })).default([]),
    education: z.array(z.object({
      institution: z.string(),
      degree: z.string().optional().default(''),
      field: z.string().optional().default(''),
    })).default([]),
  }),
});

async function callLlm(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No LLM API key');

  const model = process.env.LLM_MODEL || 'anthropic/claude-sonnet-4';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://jobbox-os.vercel.app',
      'X-Title': 'GetAutoApply',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function safeJsonParse(input: string): Record<string, unknown> | null {
  try {
    const cleaned = input.trim().replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '');
    return JSON.parse(cleaned);
  } catch {
    const match = input.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

function computeBasicMatch(resume: any, jobTitle: string, jobDescription: string, jobSkillsRaw: string) {
  const descLower = ((jobTitle || '') + ' ' + (jobDescription || '')).toLowerCase();
  const jobSkills: string[] = jobSkillsRaw ? JSON.parse(jobSkillsRaw) : [];
  const resumeSkills = (resume.skills || []).map((s: string) => s.toLowerCase());
  const overlap = jobSkills.filter((s: string) =>
    resumeSkills.some((rs: string) => rs.includes(s.toLowerCase()) || s.toLowerCase().includes(rs))
  );
  const skillScore = jobSkills.length > 0 ? Math.round((overlap.length / Math.max(jobSkills.length, 1)) * 70) : 35;
  const relevantExps = (resume.experience || []).filter((exp: any) =>
    descLower.includes((exp.title || '').toLowerCase().split(' ')[0]) ||
    (exp.skills || []).some((s: string) => descLower.includes(s.toLowerCase()))
  );
  const expScore = Math.min(30, relevantExps.length * 10);
  const matchScore = Math.min(100, skillScore + expScore);

  return {
    matchScore,
    matchReasoning: `Found ${overlap.length}/${Math.max(jobSkills.length, 1)} skill matches and ${relevantExps.length} relevant experience entries.`,
    tailoredSummary: `${resume.fullName} — ${resume.headline || 'Experienced professional'} with ${(resume.experience || []).length}+ years. Skills: ${(resume.skills || []).slice(0, 6).join(', ')}.`,
    tailoredHeadline: `${resume.headline || 'Professional'} | ${(overlap.slice(0, 3)).join(' · ') || (resume.skills || []).slice(0, 3).join(' · ')}`,
    tailoredSkills: [...new Set([...overlap, ...(resume.skills || []).slice(0, 4)])].slice(0, 8),
    keyStrengths: overlap.length > 0
      ? [`Strong skill match: ${overlap.slice(0, 3).join(', ')}`]
      : ['Has relevant work experience'],
    gaps: (jobSkills.length > 0 ? jobSkills.filter(s => !overlap.includes(s)).slice(0, 3) : []).map(s => `Missing or limited: ${s}`),
    coverLetterBullets: (relevantExps.slice(0, 3) as any[]).map(exp =>
      `${exp.title} at ${exp.company}: ${(exp.achievements && exp.achievements[0]) || (exp.description || '').substring(0, 80)}`
    ),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ENRICH_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }
    const { jobId, resumeData } = parsed.data;

    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the job
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if this job is already saved/tracked by user
    const { data: existingApp } = await supabase
      .from('tracked_applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('job_id', jobId)
      .single();

    // Auto-save if not tracked yet
    if (!existingApp) {
      await supabase.from('tracked_applications').insert({
        user_id: user.id,
        job_id: jobId,
        pipeline_stage: 'saved',
      });
    }

    // Build the LLM prompt
    const jobDesc = (job.description || '').substring(0, 4000);
    const skillsRequired = job.skills_required ? JSON.stringify(job.skills_required) : '';
    const expBlock = (resumeData.experience || []).slice(0, 5).map((exp: any, i: number) => {
      return `${i + 1}. ${exp.title} at ${exp.company} (${exp.startDate || ''} - ${exp.endDate || 'present'})
   ${(exp.description || '').substring(0, 200)}
   Achievements: ${(exp.achievements || []).slice(0, 3).join('; ')}
   Skills: ${(exp.skills || []).join(', ')}`;
    }).join('\n');

    const prompt = `You are an expert career coach and CV tailoring specialist. Analyze the candidate's resume against the job description and produce a tailored CV and fit analysis.

=== JOB ===
Title: ${job.title || ''}
Company: ${job.company || ''}
Description: ${jobDesc}
Required skills: ${skillsRequired || 'not specified'}

=== CANDIDATE RESUME ===
Name: ${resumeData.fullName}
Headline: ${resumeData.headline || 'N/A'}
Summary: ${resumeData.summary || 'N/A'}
Core skills: ${(resumeData.skills || []).join(', ')}

Experience:
${expBlock || 'No experience listed'}

=== YOUR TASK ===
Return ONLY valid JSON (no markdown, no code fences) with this structure:
{
  "matchScore": (number 0-100),
  "matchReasoning": (2-3 sentences explaining the score),
  "tailoredSummary": (1-paragraph first-person professional summary for THIS role),
  "tailoredHeadline": (1-line headline optimized for this role),
  "tailoredSkills": (array of 6-10 most relevant skill strings),
  "keyStrengths": (array of 3-5 bullets where candidate matches well),
  "gaps": (array of 2-4 bullets where candidate is weaker),
  "coverLetterBullets": (array of 3-5 cover letter points referencing specific experience)
}`;

    let result: Record<string, unknown>;
    try {
      const llmResponse = await callLlm(prompt);
      const llmResult = safeJsonParse(llmResponse);
      if (llmResult && typeof llmResult.matchScore === 'number') {
        result = llmResult as Record<string, unknown>;
      } else {
        throw new Error('LLM returned invalid JSON');
      }
    } catch {
      result = computeBasicMatch(resumeData, job.title || '', job.description || '', skillsRequired);
    }

    const matchScore = Math.round(Number(result.matchScore) || 0);
    const tailoredSummary = String(result.tailoredSummary || '');
    const tailoredHeadline = String(result.tailoredHeadline || '');
    const tailoredSkills = Array.isArray(result.tailoredSkills) ? result.tailoredSkills.map(String) : [];
    const keyStrengths = Array.isArray(result.keyStrengths) ? result.keyStrengths.map(String) : [];
    const gaps = Array.isArray(result.gaps) ? result.gaps.map(String) : [];
    const coverLetterBullets = Array.isArray(result.coverLetterBullets) ? result.coverLetterBullets.map(String) : [];

    // Save enrichment results back to job
    await supabase.from('jobs').update({
      match_score_ai: matchScore,
      match_reasoning: String(result.matchReasoning || ''),
      tailored_summary: tailoredSummary,
      tailored_headline: tailoredHeadline,
      tailored_skills: tailoredSkills.length ? JSON.stringify(tailoredSkills) : null,
      ai_summary: tailoredSummary.substring(0, 500),
      enriched_at: new Date().toISOString(),
    }).eq('id', jobId);

    // Update application record with match score
    await supabase.from('tracked_applications').update({
      user_notes: `AI Match Score: ${matchScore}/100. ${keyStrengths.slice(0, 2).join('. ')}`,
    }).eq('user_id', user.id).eq('job_id', jobId);

    return NextResponse.json({
      matchScore,
      matchReasoning: String(result.matchReasoning || ''),
      tailoredSummary,
      tailoredHeadline,
      tailoredSkills,
      keyStrengths,
      gaps,
      coverLetterBullets,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Enrichment error:', message);
    return NextResponse.json({ error: 'Enrichment failed', message }, { status: 500 });
  }
}
