import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ATS-Tailored CV Generator
// POST /api/cv/generate — generates an ATS-friendly CV tailored to a specific job
// Returns JSON with HTML content for rendering/printing

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { job_id, resume_json } = body;

    if (!job_id) return NextResponse.json({ error: 'job_id required' }, { status: 400 });

    // Get job details
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Get user profile/resume data
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const resumeData = resume_json || profile || {};

    // Build ATS-friendly HTML CV
    const html = generateATSCV(job, resumeData);

    return NextResponse.json({
      html,
      title: `CV - ${(job as any).company_name || 'Company'} - ${(job as any).title || 'Position'}`,
      generated_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('CV generation error:', message);
    return NextResponse.json({ error: 'Generation failed', message }, { status: 500 });
  }
}

function normalizeJob(job: any) {
  return {
    title: job?.title || job?.position || 'Position',
    company: job?.company || job?.company_name || 'Company',
    location: job?.location || 'Remote',
    description: job?.description || '',
  };
}

function generateATSCV(job: any, resume: any) {
  const j = normalizeJob(job);

  // Extract name
  const name = resume?.name || resume?.full_name || 'Your Name';
  const email = resume?.email || '';
  const phone = resume?.phone || '';
  const location = resume?.location || j.location || '';
  const linkedin = resume?.linkedin || '';
  const website = resume?.website || '';
  const summary = resume?.summary || '';

  // Skills
  const skills = resume?.skills || resume?.skills_required || [];
  const skillsList = Array.isArray(skills)
    ? skills
    : typeof skills === 'string'
      ? skills.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean)
      : [];

  // Experience
  const experiences = resume?.experience || resume?.experiences || [];
  const expList = Array.isArray(experiences) ? experiences : [];

  // Education
  const education = resume?.education || [];
  const eduList = Array.isArray(education) ? education : [];

  // Build keyword-targeted summary from job description
  const jobKeywords = extractKeywords(j.description);
  const targetedSummary = summary || `Experienced professional with expertise in ${jobKeywords.slice(0, 5).join(', ')} seeking ${j.title} role at ${j.company}.`;

  const skillsHtml = skillsList.length > 0
    ? `<div class="section"><h2>SKILLS</h2><p>${skillsList.join(' · ')}</p></div>`
    : '';

  const expHtml = expList.length > 0
    ? `<div class="section"><h2>EXPERIENCE</h2>${expList.map((e: any) => `
      <div class="entry">
        <div class="entry-header">
          <span class="role">${e.title || e.role || ''}</span>
          <span class="dates">${e.start_date || ''} – ${e.end_date || 'Present'}</span>
        </div>
        <div class="company">${e.company || ''}${e.location ? ` — ${e.location}` : ''}</div>
        <ul>${(e.bullets || e.description || '').split('\n').filter(Boolean).map((b: string) => `<li>${b.trim()}</li>`).join('')}</ul>
      </div>`).join('')}</div>`
    : '';

  const eduHtml = eduList.length > 0
    ? `<div class="section"><h2>EDUCATION</h2>${eduList.map((e: any) => `
      <div class="entry">
        <div class="entry-header">
          <span class="degree">${e.degree || ''}</span>
          <span class="dates">${e.year || ''}</span>
        </div>
        <div class="school">${e.school || e.institution || ''}</div>
      </div>`).join('')}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${name} — CV for ${j.title} at ${j.company}</title>
  <style>
    @page { margin: 0.5in; size: letter; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.4; color: #1a1a1a; }
    .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 12px; }
    .name { font-size: 20pt; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
    .contact { font-size: 10pt; margin-top: 4px; color: #444; }
    .contact span { margin: 0 8px; }
    .section { margin-top: 14px; }
    .section h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #999; padding-bottom: 3px; margin-bottom: 8px; letter-spacing: 1px; }
    .entry { margin-bottom: 10px; }
    .entry-header { display: flex; justify-content: space-between; font-weight: bold; }
    .role { font-size: 11pt; }
    .company { font-style: italic; font-size: 10pt; margin-bottom: 3px; }
    .dates { font-size: 10pt; color: #555; font-weight: normal; }
    .degree { font-size: 11pt; }
    .school { font-style: italic; font-size: 10pt; }
    ul { margin-left: 18px; margin-top: 3px; }
    li { margin-bottom: 2px; font-size: 10.5pt; }
    p { font-size: 10.5pt; }
  </style>
</head>
<body>
  <div class="header">
    <div class="name">${name}</div>
    <div class="contact">
      ${email ? `<span>${email}</span>` : ''}
      ${phone ? `<span>${phone}</span>` : ''}
      ${location ? `<span>${location}</span>` : ''}
      ${linkedin ? `<span>${linkedin}</span>` : ''}
      ${website ? `<span>${website}</span>` : ''}
    </div>
  </div>

  <div class="section">
    <h2>PROFESSIONAL SUMMARY</h2>
    <p>${targetedSummary}</p>
  </div>

  ${skillsHtml}
  ${expHtml}
  ${eduHtml}
</body>
</html>`;
}

function extractKeywords(description: string): string[] {
  if (!description) return [];
  const techKeywords = [
    'javascript', 'typescript', 'react', 'node', 'python', 'java', 'go', 'rust',
    'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'sql', 'nosql',
    'mongodb', 'postgresql', 'redis', 'graphql', 'rest', 'api', 'microservices',
    'ci/cd', 'agile', 'scrum', 'machine learning', 'ai', 'data', 'analytics',
    'leadership', 'management', 'communication', 'collaboration',
  ];
  const desc = description.toLowerCase();
  return techKeywords.filter((kw) => desc.includes(kw));
}
