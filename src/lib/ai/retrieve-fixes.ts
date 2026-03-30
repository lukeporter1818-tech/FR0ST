import { prisma } from '@/lib/db'

// Tokenise a string into lowercase words (3+ chars), stripping punctuation.
function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  )
}

// Count tokens from `query` that appear in `target`.
function overlapScore(queryTokens: Set<string>, target: string): number {
  const targetTokens = tokenise(target)
  let hits = 0
  for (const t of queryTokens) {
    if (targetTokens.has(t)) hits++
  }
  return hits
}

/**
 * Retrieve up to `limit` approved company fixes relevant to `query`.
 * Returns a compact context block to append to the system prompt,
 * or an empty string when no relevant matches are found.
 */
export async function retrieveApprovedFixes(query: string, limit = 3): Promise<string> {
  if (!query.trim()) return ''

  // Fetch all approved fixes with required fields — intentionally no pagination;
  // the approved set is expected to remain small (< ~500 records in practice).
  const fixes = await prisma.aIInteraction.findMany({
    where: {
      approved: true,
      actualFix: { not: null },
      issueSummary: { not: null },
    },
    select: {
      issueSummary: true,
      actualFix: true,
      systemType: true,
    },
    orderBy: { createdAt: 'desc' },
    // 50 most-recent approved fixes is enough for keyword scoring — returns
    // top 3 matches anyway. Reduces per-request DB payload by ~75%.
    take: 50,
  })

  if (fixes.length === 0) return ''

  const queryTokens = tokenise(query)

  // Score each fix by keyword overlap against issueSummary (+ systemType bonus).
  const scored = fixes
    .map((fix) => {
      const base = overlapScore(queryTokens, fix.issueSummary ?? '')
      const bonus = fix.systemType ? overlapScore(queryTokens, fix.systemType) : 0
      return { fix, score: base + bonus * 0.5 }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  if (scored.length === 0) return ''

  const lines = scored.map(({ fix }) => {
    const type = fix.systemType ? ` [${fix.systemType}]` : ''
    return `- Issue${type}: ${fix.issueSummary}\n  Fix: ${fix.actualFix}`
  })

  return `\n\n---\nRELEVANT COMPANY FIXES (verified by your team):\n${lines.join('\n')}\n---`
}
