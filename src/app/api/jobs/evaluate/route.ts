import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
      'X-Title': 'GetAutoApply',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: maxTokens,
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
      try { return JSON.parse(match[0]); } catch { /* fall */ }
    }
    return null;
  }
}

function buildFallbackResult(resumeData: any, jobTitle: string, jobSkills: string) {
  const resumeSkills = (resumeData?.skills || []).map((s: string) => s.toLowerCase());
  const jobSkillsList: string[] = jobSkills ? JSON.parse(jobSkills) : [];
  const overlap = jobSkillsList.filter((s: string) =>
    resumeSkills.some((rs: string) => rs.includes(s.toLowerCase()) || s.toLowerCase().includes(rs))
  );
  const score = jobSkillsList.length > 0
    ? Math.round((overlap.length / Math.max(jobSkillsList.length, 1)) * 100)
    : 50;
  const gapItems = jobSkillsList.filter((s: string) => !overlap.includes(s)).slice(0, 3).map((s: string) => 'Missing: ' + s);
  const strengthItems = overlap.length > 0
    ? ['Skill overlap: ' + overlap.slice(0, 3).join(', ')]
    : ['Review JD for fit'];

  return {
    matchScore: score,
    matchReasoning: 'Found ' + overlap.length + '/' + Math.max(jobSkillsList.length, 1) + ' skill matches.',
    keyStrengths: strengthItems,
    gaps: gapItems,
    levelAssessment: 'mid',
    levelReasoning: 'Unable to determine, using default.',
    riskOfOverqualification: false,
    riskOfUnderqualification: false,
    estimatedSalaryRange: 'Not specified',
    compensationNotes: 'No salary data in description.',
    cvCustomization: {
      tailoredHeadline: resumeData?.headline || jobTitle,
      tailoredSummary: resumeData?.summary || '',
      highlightFirst: [] as string[],
      skillsToEmphasize: overlap.slice(0, 5),
      keywordsToInclude: jobSkillsList.slice(0, 5),
    },
    likelyInterviewFormat: 'Phone screen then Technical then Onsite',
    topTechnicalQuestions: ['Review the job description for technical requirements'],
    topBehavioralQuestions: ['Tell me about yourself', 'Why this company?'],
    questionsToAskThem: ['What does success look like in this role?'],
    prepPriorityTopics: jobSkillsList.slice(0, 3),
    legitimacyScore: 75,
    redFlags: [] as string[],
    greenFlags: ['Job posted on a known board'],
    notes: 'Basic scoring, LLM unavailable for deeper analysis.',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobId = body.jobId as string;
    const resumeData = body.resumeData as any;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const jobDesc = (job.description || '').substring(0, 5000);
    const jobTitle = job.title || '';
    const jobCompany = job.company || '';
    const jobSkills = job.skills_required || '';

    const expLines = (resumeData?.experience || []).slice(0, 5).map((exp: any, i: number) => {
      return (i + 1) + '. ' + exp.title + ' at ' + exp.company + ' (' + (exp.startDate || '') + ' - ' + (exp.endDate || 'present') + ')\n   ' + (exp.description || '').substring(0, 200) + '\n   Achievements: ' + (exp.achievements || []).slice(0, 3).join('; ');
    }).join('\n');

    const prompt = 'You are an expert career coach AND job market analyst. Produce a comprehensive evaluation of this job for this candidate.\n\n'
      + '=== JOB ===\n'
      + 'Title: ' + jobTitle + '\n'
      + 'Company: ' + jobCompany + '\n'
      + 'Description: ' + jobDesc + '\n'
      + 'Skills required: ' + jobSkills + '\n\n'
      + '=== CANDIDATE ===\n'
      + 'Name: ' + (resumeData?.fullName || 'Candidate') + '\n'
      + 'Headline: ' + (resumeData?.headline || 'N/A') + '\n'
      + 'Summary: ' + (resumeData?.summary || 'N/A') + '\n'
      + 'Skills: ' + (resumeData?.skills || []).join(', ') + '\n'
      + 'Experience:\n' + (expLines || 'No experience listed') + '\n\n'
      + '=== OUTPUT ===\n'
      + 'Return ONLY valid JSON (no markdown, no code fences) with this structure:\n'
      + '{\n'
      + '  "matchScore": number 0-100,\n'
      + '  "matchReasoning": "2-3 sentence explanation",\n'
      + '  "keyStrengths": ["3-5 bullets"],\n'
      + '  "gaps": ["2-4 bullets"],\n'
      + '  "levelAssessment": "entry|mid|senior|staff|executive",\n'
      + '  "levelReasoning": "1-2 sentences",\n'
      + '  "riskOfOverqualification": true|false,\n'
      + '  "riskOfUnderqualification": true|false,\n'
      + '  "estimatedSalaryRange": "e.g. 120k-160k USD or Not specified",\n'
      + '  "compensationNotes": "notes",\n'
      + '  "cvCustomization": {\n'
      + '    "tailoredHeadline": "string",\n'
      + '    "tailoredSummary": "string",\n'
      + '    "highlightFirst": ["string"],\n'
      + '    "skillsToEmphasize": ["string"],\n'
      + '    "keywordsToInclude": ["string"]\n'
      + '  },\n'
      + '  "likelyInterviewFormat": "string",\n'
      + '  "topTechnicalQuestions": ["3-5 questions"],\n'
      + '  "topBehavioralQuestions": ["3-5 questions"],\n'
      + '  "questionsToAskThem": ["3-5 questions"],\n'
      + '  "prepPriorityTopics": ["topics"],\n'
      + '  "legitimacyScore": number 0-100,\n'
      + '  "redFlags": ["string"],\n'
      + '  "greenFlags": ["string"],\n'
      + '  "notes": "string"\n'
      + '}';

    let result: Record<string, unknown>;
    try {
      const llmResponse = await callLlm(prompt, 2500);
      const parsed = safeJsonParse(llmResponse);
      if (parsed && typeof parsed.matchScore === 'number') {
        result = parsed;
      } else {
        throw new Error('Invalid JSON from LLM');
      }
    } catch {
      result = buildFallbackResult(resumeData, jobTitle, jobSkills);
    }

    const matchScore = Math.round(Number(result.matchScore) || 0);
    const cvCustom = (result.cvCustomization as any) || {};
    await supabase.from('jobs').update({
      match_score_ai: matchScore,
      match_reasoning: String(result.matchReasoning || ''),
      tailored_summary: String(cvCustom.tailoredSummary || ''),
      tailored_headline: String(cvCustom.tailoredHeadline || ''),
      ai_summary: String(result.matchReasoning || '').substring(0, 500),
      experience_level: String(result.levelAssessment || ''),
      enriched_at: new Date().toISOString(),
    }).eq('id', jobId);

    return NextResponse.json({
      matchScore,
      matchReasoning: String(result.matchReasoning || ''),
      keyStrengths: Array.isArray(result.keyStrengths) ? result.keyStrengths.map(String) : [],
      gaps: Array.isArray(result.gaps) ? result.gaps.map(String) : [],
      levelAssessment: String(result.levelAssessment || ''),
      levelReasoning: String(result.levelReasoning || ''),
      riskOfOverqualification: Boolean(result.riskOfOverqualification),
      riskOfUnderqualification: Boolean(result.riskOfUnderqualification),
      estimatedSalaryRange: String(result.estimatedSalaryRange || ''),
      compensationNotes: String(result.compensationNotes || ''),
      cvCustomization: {
        tailoredHeadline: String(cvCustom.tailoredHeadline || ''),
        tailoredSummary: String(cvCustom.tailoredSummary || ''),
        highlightFirst: Array.isArray(cvCustom.highlightFirst) ? cvCustom.highlightFirst.map(String) : [],
        skillsToEmphasize: Array.isArray(cvCustom.skillsToEmphasize) ? cvCustom.skillsToEmphasize.map(String) : [],
        keywordsToInclude: Array.isArray(cvCustom.keywordsToInclude) ? cvCustom.keywordsToInclude.map(String) : [],
      },
      likelyInterviewFormat: String(result.likelyInterviewFormat || ''),
      topTechnicalQuestions: Array.isArray(result.topTechnicalQuestions) ? result.topTechnicalQuestions.map(String) : [],
      topBehavioralQuestions: Array.isArray(result.topBehavioralQuestions) ? result.topBehavioralQuestions.map(String) : [],
      questionsToAskThem: Array.isArray(result.questionsToAskThem) ? result.questionsToAskThem.map(String) : [],
      prepPriorityTopics: Array.isArray(result.prepPriorityTopics) ? result.prepPriorityTopics.map(String) : [],
      legitimacyScore: Number(result.legitimacyScore) || 0,
      redFlags: Array.isArray(result.redFlags) ? result.redFlags.map(String) : [],
      greenFlags: Array.isArray(result.greenFlags) ? result.greenFlags.map(String) : [],
      legitimacyNotes: String(result.notes || ''),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Eval error:', message);
    return NextResponse.json({ error: 'Evaluation failed', message }, { status: 500 });
  }
}
