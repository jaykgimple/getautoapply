import OpenAI from 'openai'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseURL: 'https://openrouter.ai/api/v1',
    })
  }
  return client
}

export interface ResumeContent {
  name?: string
  headline?: string
  summary?: string
  experience?: Array<{
    title: string
    company: string
    dates: string
    bullets: string[]
  }>
  education?: Array<{
    degree: string
    school: string
    year: string
  }>
  skills?: string[]
  projects?: Array<{
    name: string
    description: string
  }>
}

export interface TailorResult {
  resume: ResumeContent
  atsScore: number
  matchedKeywords: string[]
  missingKeywords: string[]
}

export async function tailorResume(
  masterResume: ResumeContent,
  jobDescription: string,
  jobTitle: string,
  company: string
): Promise<TailorResult> {
  const aiClient = getClient()

  const prompt = `You are a professional resume writer and ATS optimization expert.

MASTER RESUME (JSON):
${JSON.stringify(masterResume, null, 2)}

TARGET JOB:
Title: ${jobTitle}
Company: ${company}
Description: ${jobDescription.substring(0, 3000)}

Generate a tailored resume variant optimized for this specific job. Rules:
1. Prioritize experience and skills most relevant to this job
2. Mirror keywords from the job description naturally
3. Reorder sections to lead with strongest match
4. Adjust the headline and summary to align with the role
5. Keep all content truthful — only reorder and reframe, don't invent

Respond in JSON format:
{
  "resume": { /* tailored resume with same structure as master */ },
  "atsScore": 0.0-1.0,
  "matchedKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["keyword_from_jd_not_in_resume"]
}`

  const response = await aiClient.chat.completions.create({
    model: 'openrouter/owl-alpha',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No response from AI')

  const result = JSON.parse(content) as TailorResult
  return result
}

export function calculateATSScore(resume: ResumeContent, jobDescription: string): number {
  const jd = jobDescription.toLowerCase()
  const resumeText = JSON.stringify(resume).toLowerCase()

  const jdWords = jd.match(/\b[a-z][a-z0-9+#]{2,}\b/g) || []
  const stopWordsList = ['the','and','for','with','you','are','will','this','that','from','have','been','they','their','can','not','but','all','was','were','would','should','could','may','might','shall','must','about','above','after','again','also','before','being','below','between','both','each','few','further','get','got','had','has','her','here','him','himself','his','how','into','its','itself','just','more','most','myself','nor','now','off','once','only','other','our','ours','out','over','own','same','she','some','such','than','them','then','there','these','those','through','too','under','until','upon','very','what','when','where','which','while','who','whom','why','your','yours','apply','working','work','years','experience','required','preferred','excellent','strong','ability','team','communication','written','verbal','including','etc','eg','ie']
  const uniqueWords = Array.from(new Set(jdWords)).filter(w => !stopWordsList.includes(w))

  let matched = 0
  for (const word of uniqueWords) {
    if (resumeText.includes(word)) matched++
  }

  return uniqueWords.length > 0 ? matched / uniqueWords.length : 0
}
