import { embedQuery, rerankDocuments } from './voyage'
import { prisma } from '@/lib/db'

const CANDIDATE_COUNT = 20
const MAX_CHUNKS = 5
const MIN_RERANK_SCORE = 0.58
const MIN_RERANK_SCORE_SAFETY = 0.45
const RERANK_MODEL = 'rerank-3'
const RERANK_TIMEOUT_MS = 4000

const EXCLUDED_PAGES: number[] = [1]
const MAX_PINNED_PROCEDURES = 1

// Fallback path (used when the reranker is unreachable or times out).
const MIN_SIMILARITY = 0.50
const MIN_SIMILARITY_SAFETY = 0.40
const FALLBACK_MAX_CHUNKS = 3

// Markers that indicate a chunk is a safety or refrigerant-handling procedure.
// Matched case-insensitively as substrings.
const SAFETY_MARKERS: string[] = [
  'pinch-off',
  'pinch off',
  'brazing',
  'hydrocarbon leak detector',
  'schrader',
  'calibrated scale',
  'leak check',
]

// The pinned procedure block and its terse per-request instruction are only
// added when the tech's question is actually about a safety / refrigerant-
// handling topic. The simplest reliable signal is a keyword match on the
// question text itself. Chosen over "top-ranked chunk is a safety chunk"
// because the VRM2B charge case ranks p. 40 (spec) #1 and p. 15 (procedure)
// only #3 — top-ranked-check would wrongly skip pinning there. Chosen over
// a same-page rule because those two chunks are on different pages.
const PIN_RELEVANCE_KEYWORDS: string[] = [
  'charge',
  'charging',
  'brazing',
  'leak',
  'refrigerant',
  'service port',
]

function isPinRelevant(query: string): boolean {
  const lower = query.toLowerCase()
  return PIN_RELEVANCE_KEYWORDS.some((k) => lower.includes(k))
}

// Boilerplate patterns stripped from pinned procedure text so the "Manual text"
// block shows the procedure itself, not page headers or footers. Conservative
// on purpose: if a line is not clearly boilerplate, it stays in.
const BOILERPLATE_PATTERNS: RegExp[] = [
  // "P/N 3034041_B" or "P/N 3034041_B 15" (page number stamped after)
  /\bP\/N\s+\d+_\w+\s*\d{0,3}\b/g,
  // Hussmann corporate address header/footer
  /HUSSMANN\s+CORPORATION\s*[•·]\s*BRIDGETON,\s*MO\s*\d{5}-\d{4}\s*U\.S\.A\./gi,
  // Toll-free contact / website footer line
  /U\.S\.\s*&\s*Canada\s+1-800-\d{3}-\d{4}\s*[•·]\s*Mexico\s+1-800-\d{3}-\d{4}(?:\s*[•·]\s*www\.[a-z0-9-]+\.com)?/gi,
  // Bare Hussmann website (in case it appears alone)
  /\bwww\.hussmann\.com\b/gi,
]

export interface KnowledgeMatch {
  text: string
  page: number | null
  title: string
  similarity: number
  isSafetyProcedure: boolean
}

interface Candidate {
  text: string
  page: number | null
  title: string
  similarity: number
  isSafetyProcedure: boolean
}

function isSafetyProcedure(text: string): boolean {
  const lower = text.toLowerCase()
  return SAFETY_MARKERS.some((m) => lower.includes(m))
}

function stripBoilerplate(text: string): string {
  let out = text
  for (const p of BOILERPLATE_PATTERNS) out = out.replace(p, '')
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return out
}

/**
 * Build the "Manual text (p. N):" block that is appended verbatim to FR0ST's
 * reply for safety / refrigerant-handling procedures. Exported so the assistant
 * route and the eval harness both build the same block from the same rules.
 * Returns an empty string when there is nothing to pin OR when the question
 * itself is not about a safety / refrigerant-handling topic (see
 * PIN_RELEVANCE_KEYWORDS). The pinned block and the terse per-request
 * instruction always fire together or not at all.
 */
export function buildPinnedProcedureText(
  query: string,
  matches: KnowledgeMatch[],
  options?: { maxProcedures?: number },
): string {
  if (!isPinRelevant(query)) return ''
  const max = options?.maxProcedures ?? MAX_PINNED_PROCEDURES
  const procedures = matches
    .filter((m) => m.isSafetyProcedure)
    .slice(0, max)
  if (procedures.length === 0) return ''

  const blocks = procedures.map((m) => {
    const cleaned = stripBoilerplate(m.text)
    const pageLabel = m.page != null ? `p. ${m.page}` : 'page unknown'
    return `Manual text — ${m.title}, ${pageLabel}:\n\n${cleaned}`
  })
  return '\n\n---\n\n' + blocks.join('\n\n---\n\n')
}

/**
 * Build the terse per-request instruction that tells FR0ST the pinned block
 * will follow, so the model's own answer stays to one to three short lines.
 * Uses the exact same relevance gate as buildPinnedProcedureText — the two
 * always appear together or not at all. Returns an empty string when the
 * gate rejects the request.
 */
export function buildPinnedProcedureInstruction(
  query: string,
  matches: KnowledgeMatch[],
): string {
  if (!isPinRelevant(query)) return ''
  const hasSafetyChunk = matches.some((m) => m.isSafetyProcedure)
  if (!hasSafetyChunk) return ''

  return `

---
PER-REQUEST INSTRUCTION (this reply only):
A block titled "Manual text — [document], p. [N]:" containing the manual's own verbatim text for the relevant safety or refrigerant-handling procedure will be appended automatically below your answer and shown to the tech in full.

Therefore in this reply:
- Answer only the exact question asked, in one to three short lines.
- State the value and its page cite (e.g. "0.150 kg (5.3 oz) per system (p. 40)").
- Do not restate, summarize, or comment on the pinned procedure's steps, warnings, or notes, including anything about the serial plate.

This instruction applies only to this reply.
---`
}

export async function retrieveKnowledge(query: string): Promise<KnowledgeMatch[]> {
  if (query.trim().length < 5) return []

  const { embedding } = await embedQuery(query)
  const embStr = `[${embedding.join(',')}]`

  const pageWhere =
    EXCLUDED_PAGES.length > 0
      ? `WHERE (kc.page IS NULL OR kc.page NOT IN (${EXCLUDED_PAGES.join(',')}))`
      : ''

  const rows = await prisma.$queryRawUnsafe<Array<{
    text: string
    page: number | null
    title: string
    similarity: unknown
  }>>(
    `SELECT kc.text, kc.page, kd.title,
      1 - (kc.embedding <=> $1::vector) AS similarity
    FROM "KnowledgeChunk" kc
    JOIN "KnowledgeDoc" kd ON kc."docId" = kd.id
    ${pageWhere}
    ORDER BY kc.embedding <=> $1::vector
    LIMIT ${CANDIDATE_COUNT}`,
    embStr,
  )

  if (rows.length === 0) return []

  const candidates: Candidate[] = rows.map((r) => ({
    text: r.text,
    page: r.page,
    title: r.title,
    similarity: Number(r.similarity),
    isSafetyProcedure: isSafetyProcedure(r.text),
  }))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RERANK_TIMEOUT_MS)

  try {
    const hits = await rerankDocuments(
      query,
      candidates.map((c) => c.text),
      RERANK_MODEL,
      controller.signal,
    )
    clearTimeout(timer)

    return hits
      .map((h) => ({ hit: h, src: candidates[h.index] }))
      .filter(({ hit, src }) => {
        const threshold = src.isSafetyProcedure ? MIN_RERANK_SCORE_SAFETY : MIN_RERANK_SCORE
        return hit.relevanceScore >= threshold
      })
      .sort((a, b) => b.hit.relevanceScore - a.hit.relevanceScore)
      .slice(0, MAX_CHUNKS)
      .map(({ hit, src }) => ({
        text: src.text,
        page: src.page,
        title: src.title,
        similarity: hit.relevanceScore,
        isSafetyProcedure: src.isSafetyProcedure,
      }))
  } catch (err) {
    clearTimeout(timer)
    console.error('[retrieve-knowledge] rerank failed, falling back to vector similarity:', err)

    return candidates
      .filter((c) => {
        const threshold = c.isSafetyProcedure ? MIN_SIMILARITY_SAFETY : MIN_SIMILARITY
        return c.similarity >= threshold
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, FALLBACK_MAX_CHUNKS)
      .map((c) => ({
        text: c.text,
        page: c.page,
        title: c.title,
        similarity: c.similarity,
        isSafetyProcedure: c.isSafetyProcedure,
      }))
  }
}
