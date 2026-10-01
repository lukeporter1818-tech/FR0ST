// Small pure helpers used by questions.ts.
// Contains-family helpers normalize whitespace on both sides before comparing:
// lowercase, collapse every run of whitespace (spaces, tabs, newlines,
// non-breaking spaces) to a single space, and trim. This makes them tolerant
// of PDF extraction artifacts like "no\nleak" or "3 gram".
// Regex-based helpers are left as-is (regexMatchesNone, regexMatchesAny,
// lastLineMatchesAny) because their patterns are written against raw text.

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s ]+/g, ' ').trim()
}

export function contains(text: string, needle: string): boolean {
  return normalize(text).includes(normalize(needle))
}

export function containsAll(text: string, needles: string[]): boolean {
  const norm = normalize(text)
  return needles.every((n) => norm.includes(normalize(n)))
}

export function containsNone(text: string, needles: string[]): boolean {
  const norm = normalize(text)
  return needles.every((n) => !norm.includes(normalize(n)))
}

export function containsAny(text: string, needles: string[]): boolean {
  const norm = normalize(text)
  return needles.some((n) => norm.includes(normalize(n)))
}

export function startsWith(text: string, prefix: string): boolean {
  return normalize(text).startsWith(normalize(prefix))
}

export function regexMatchesNone(text: string, regex: RegExp): boolean {
  return !regex.test(text)
}

export function regexMatchesAny(text: string, regexes: RegExp[]): boolean {
  return regexes.some((r) => r.test(text))
}

function nonBlankLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
}

export function lastNonBlankLine(text: string): string {
  const lines = nonBlankLines(text)
  return lines.length > 0 ? lines[lines.length - 1] : ''
}

// Last-line contains: normalize the last non-blank line and the needle
// individually. Lines are NOT merged with earlier ones, so the "last line"
// meaning is preserved; only whitespace within that line is collapsed.
export function lastLineContains(text: string, needle: string): boolean {
  return normalize(lastNonBlankLine(text)).includes(normalize(needle))
}

export function lastLineMatchesAny(text: string, regexes: RegExp[]): boolean {
  const line = lastNonBlankLine(text)
  return regexes.some((r) => r.test(line))
}

// "Only in the last non-blank line" — no earlier line contains any needle,
// and the last non-blank line contains at least one needle. Each line is
// normalized independently so line boundaries are preserved.
export function needlesOnlyInLastLine(text: string, needles: string[]): boolean {
  const lines = text.split('\n').map((l) => l.trim())
  let lastIdx = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].length > 0) {
      lastIdx = i
      break
    }
  }
  if (lastIdx < 0) return false

  const ns = needles.map(normalize)

  for (let i = 0; i < lastIdx; i++) {
    const l = normalize(lines[i])
    if (ns.some((n) => l.includes(n))) return false
  }
  const last = normalize(lines[lastIdx])
  return ns.some((n) => last.includes(n))
}
