import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { extractText } from 'unpdf'
import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/db'
import { requireApiRole, requireApiSession, unauthorized, forbidden, badRequest } from '@/lib/auth-guard'
import { auditLog } from '@/lib/audit'
import { embedDocuments } from '@/lib/ai/voyage'

export const maxDuration = 300

const BUCKET = 'knowledge'
const MAX_BYTES = 15 * 1024 * 1024
const CHUNK_TARGET_CHARS = 2800
const CHUNK_OVERLAP_CHARS = 400
const EMBED_BATCH_SIZE = 16
const INSERT_BATCH_SIZE = 500

interface Chunk {
  ordinal: number
  page: number
  text: string
}

export async function POST(req: NextRequest) {
  const admin = await requireApiRole('ADMIN')
  if (!admin) {
    const anySession = await requireApiSession()
    return anySession ? forbidden() : unauthorized()
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return badRequest('Invalid multipart body')
  }

  const file = form.get('file')
  if (!(file instanceof File)) return badRequest('Missing "file" field')
  if (file.type !== 'application/pdf') return badRequest('Only PDF uploads are supported')
  if (file.size === 0) return badRequest('Empty file')
  if (file.size > MAX_BYTES) return badRequest(`File exceeds ${MAX_BYTES / 1024 / 1024}MB limit`)

  const rawTitle = form.get('title')
  const title = (typeof rawTitle === 'string' && rawTitle.trim()) || file.name

  const buffer = Buffer.from(await file.arrayBuffer())
  const sha256 = createHash('sha256').update(buffer).digest('hex')

  const existing = await prisma.knowledgeDoc.findUnique({
    where: { sha256 },
    select: { id: true, title: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'This document is already indexed', docId: existing.id, title: existing.title },
      { status: 409 },
    )
  }

  let pages: string[]
  let totalPages: number
  try {
    const parsed = await extractText(new Uint8Array(buffer), { mergePages: false })
    pages = Array.isArray(parsed.text) ? parsed.text : [parsed.text]
    totalPages = parsed.totalPages
  } catch (err) {
    console.error('[knowledge/upload] pdf parse failed:', err)
    return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 422 })
  }

  const chunks: Chunk[] = []
  let ordinal = 0
  for (let i = 0; i < pages.length; i++) {
    const pageText = normalizeWhitespace(pages[i] ?? '')
    if (!pageText) continue
    for (const text of chunkText(pageText, CHUNK_TARGET_CHARS, CHUNK_OVERLAP_CHARS)) {
      chunks.push({ ordinal: ordinal++, page: i + 1, text })
    }
  }

  if (chunks.length === 0) {
    return NextResponse.json({ error: 'No extractable text in PDF' }, { status: 422 })
  }

  let embeddings: number[][]
  let totalTokens = 0
  try {
    const result = await embedInBatches(chunks.map((c) => c.text), EMBED_BATCH_SIZE)
    embeddings = result.embeddings
    totalTokens = result.totalTokens
  } catch (err) {
    console.error('[knowledge/upload] voyage embed failed:', err)
    return NextResponse.json({ error: 'Failed to compute embeddings' }, { status: 502 })
  }

  if (embeddings.length !== chunks.length) {
    return NextResponse.json({ error: 'Embedding count mismatch' }, { status: 500 })
  }

  const storagePath = `${sha256}.pdf`
  const supabase = createSupabaseServer()
  const upload = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (upload.error && !/exists|duplicate/i.test(upload.error.message)) {
    console.error('[knowledge/upload] storage upload failed:', upload.error)
    return NextResponse.json({ error: 'Failed to store document' }, { status: 500 })
  }

  let docId: string
  try {
    const doc = await prisma.knowledgeDoc.create({
      data: {
        title,
        storagePath,
        mimeType: 'application/pdf',
        byteSize: file.size,
        sha256,
        pageCount: totalPages,
        uploadedById: admin.user.id,
      },
      select: { id: true },
    })
    docId = doc.id

    const values = chunks.map((c, idx) => {
      const embLiteral = `[${embeddings[idx].join(',')}]`
      const approxTokens = Math.max(1, Math.round(c.text.length / 4))
      return Prisma.sql`(${randomUUID()}, ${docId}, ${c.ordinal}, ${c.page}, ${c.text}, ${approxTokens}, ${embLiteral}::vector)`
    })

    for (let i = 0; i < values.length; i += INSERT_BATCH_SIZE) {
      const slice = values.slice(i, i + INSERT_BATCH_SIZE)
      await prisma.$executeRaw`
        INSERT INTO "KnowledgeChunk" ("id","docId","ordinal","page","text","tokenCount","embedding")
        VALUES ${Prisma.join(slice)}
      `
    }
  } catch (err) {
    console.error('[knowledge/upload] db insert failed:', err)
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})
    return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
  }

  auditLog({
    action: 'upload.received',
    userId: admin.user.id,
    userRole: admin.user.role,
    targetId: docId,
    targetType: 'KnowledgeDoc',
    meta: { title, pageCount: totalPages, chunkCount: chunks.length, byteSize: file.size, sha256, tokensEmbedded: totalTokens },
  })

  return NextResponse.json({
    docId,
    title,
    pageCount: totalPages,
    chunkCount: chunks.length,
    tokensEmbedded: totalTokens,
  })
}

function createSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim()
}

function chunkText(text: string, targetChars: number, overlapChars: number): string[] {
  if (text.length <= targetChars) return [text]
  const out: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + targetChars, text.length)
    if (end < text.length) {
      const window = text.slice(start, end)
      const paraBreak = window.lastIndexOf('\n\n')
      if (paraBreak > targetChars * 0.5) {
        end = start + paraBreak
      } else {
        const sentenceMatch = window.match(/[.!?]\s+[^.!?]*$/)
        if (sentenceMatch && (sentenceMatch.index ?? 0) > targetChars * 0.5) {
          end = start + (sentenceMatch.index ?? 0) + 1
        }
      }
    }
    const piece = text.slice(start, end).trim()
    if (piece) out.push(piece)
    if (end >= text.length) break
    start = Math.max(end - overlapChars, start + 1)
  }
  return out
}

async function embedInBatches(texts: string[], batchSize: number) {
  const all: number[][] = []
  let totalTokens = 0
  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize)
    const { embeddings, tokens } = await embedDocuments(slice)
    all.push(...embeddings)
    totalTokens += tokens
  }
  return { embeddings: all, totalTokens }
}
