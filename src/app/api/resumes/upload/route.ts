import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function getUser(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set(name, value, options) } catch {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set(name, '', { ...options, maxAge: 0 }) } catch {} },
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch { return null }
}

async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  // Plain text
  if (mimeType === 'text/plain' || filename.endsWith('.txt')) {
    return buffer.toString('utf-8')
  }

  // PDF
  if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
    try {
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs')
      // @ts-ignore
      GlobalWorkerOptions.workerSrc = ''
      const uint8 = new Uint8Array(buffer)
      const pdf = await getDocument({ data: uint8, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise
      const pages: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const text = textContent.items.map((item: any) => ('str' in item ? item.str : '')).join(' ')
        pages.push(text)
      }
      return pages.join('\n\n')
    } catch (e: any) {
      throw new Error(`PDF extraction failed: ${e.message}`)
    }
  }

  // DOCX
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    filename.endsWith('.docx')
  ) {
    try {
      const { Document, Packer, Paragraph, TextRun } = await import('docx')
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch (e: any) {
      throw new Error(`DOCX extraction failed: ${e.message}`)
    }
  }

  // DOC (old format) — just try to read as text
  if (filename.endsWith('.doc')) {
    return buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ')
  }

  throw new Error(`Unsupported file type: ${mimeType || filename}`)
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const allowed = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ]
    const ext = file.name.toLowerCase().split('.').pop()
    if (!allowed.includes(file.type) && !['txt', 'pdf', 'docx', 'doc'].includes(ext || '')) {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, DOC, or TXT.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await extractText(buffer, file.type, file.name)

    if (!text || text.trim().length < 20) {
      return NextResponse.json({ error: 'Could not extract meaningful text from the file. Try pasting manually.' }, { status: 422 })
    }

    return NextResponse.json({
      text: text.trim(),
      filename: file.name,
      wordCount: text.trim().split(/\s+/).length,
    })
  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'Failed to process file' }, { status: 500 })
  }
}
