// FR0ST evaluation harness — local only, read-only, no DB writes.
//
// Usage:
//   npx tsx scripts/frost-eval/run.ts                  # all questions, 5 runs each
//   npx tsx scripts/frost-eval/run.ts --runs 3         # all questions, 3 runs each
//   npx tsx scripts/frost-eval/run.ts --only a,d       # only questions a and d
//   npx tsx scripts/frost-eval/run.ts --only e --runs 2

import fs from 'node:fs'
import path from 'node:path'

// ─── Load env from .env.local and .env BEFORE any @/lib import ───────────────
// This must run before dynamic imports below, because the Prisma client is
// instantiated at module import time and reads DATABASE_URL from process.env.

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return
  const content = fs.readFileSync(file, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

const projectRoot = process.cwd()
loadEnv(path.join(projectRoot, '.env.local'))
loadEnv(path.join(projectRoot, '.env'))

// ─── CLI args ────────────────────────────────────────────────────────────────

interface Args {
  runs: number
  only: Set<string> | null
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  let runs = 5
  let only: Set<string> | null = null

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--runs' && argv[i + 1]) {
      const n = Number(argv[i + 1])
      if (Number.isFinite(n) && n > 0) runs = Math.floor(n)
      i++
    } else if (a === '--only' && argv[i + 1]) {
      only = new Set(
        argv[i + 1]
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      )
      i++
    } else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: npx tsx scripts/frost-eval/run.ts [--runs N] [--only a,b,c]',
      )
      process.exit(0)
    }
  }
  return { runs, only }
}

// ─── Table + summary rendering ───────────────────────────────────────────────

interface CheckResult {
  pass: number
  total: number
  description: string
  critical: boolean
}

function pad(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w)
  return s + ' '.repeat(w - s.length)
}

function padLeft(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w)
  return ' '.repeat(w - s.length) + s
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { runs, only } = parseArgs()

  const [{ runQuestion, printMtimeWarning, shutdown }, { QUESTIONS }] =
    await Promise.all([import('./pipeline'), import('./questions')])

  printMtimeWarning(projectRoot)

  const selected = only
    ? QUESTIONS.filter((q) => only.has(q.id))
    : QUESTIONS

  if (selected.length === 0) {
    console.error(
      `No questions matched --only=${only ? Array.from(only).join(',') : ''}`,
    )
    await shutdown()
    process.exit(1)
  }

  const outputDir = path.join(projectRoot, 'scripts/frost-eval/output')
  fs.mkdirSync(outputDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const answersPath = path.join(outputDir, `answers-${timestamp}.txt`)
  const resultsPath = path.join(outputDir, `results-${timestamp}.txt`)
  const answersStream = fs.createWriteStream(answersPath, { flags: 'a' })

  const totalCalls = selected.length * runs
  console.log(
    `\nFR0ST eval harness — ${selected.length} question(s), ${runs} run(s) each = ${totalCalls} model calls\n`,
  )

  const results: Record<string, Record<string, CheckResult>> = {}
  const totalStart = Date.now()

  for (const q of selected) {
    results[q.id] = {}
    for (const c of q.checks) {
      results[q.id][c.id] = {
        pass: 0,
        total: 0,
        description: c.description,
        critical: c.critical,
      }
    }

    for (let run = 1; run <= runs; run++) {
      process.stdout.write(`(${q.id}) run ${run}/${runs}... `)
      const start = Date.now()
      let answerText = ''
      let errored = false
      try {
        const out = await runQuestion(q.text)
        answerText = out.answer
      } catch (err) {
        errored = true
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`ERROR: ${msg}`)
        answersStream.write(
          `\n===== Q(${q.id}) run ${run}/${runs} =====\nQ: ${q.text}\nERROR: ${msg}\n\n`,
        )
        // Count this run as a failure across every check for this question.
        for (const c of q.checks) results[q.id][c.id].total++
      }

      if (!errored) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1)
        console.log(`${elapsed}s`)
        answersStream.write(
          `\n===== Q(${q.id}) run ${run}/${runs} =====\nQ: ${q.text}\n\n${answerText}\n`,
        )
        for (const c of q.checks) {
          results[q.id][c.id].total++
          let passed = false
          try {
            passed = c.run(answerText)
          } catch {
            passed = false
          }
          if (passed) results[q.id][c.id].pass++
        }
      }
    }
  }

  answersStream.end()
  await new Promise<void>((resolve) => answersStream.on('close', () => resolve()))

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1)

  // ─── Build table ──────────────────────────────────────────────────────────
  const qCol = 3
  const chkCol = 40
  const descCol = 70
  const rateCol = 7

  const lines: string[] = []
  lines.push('')
  lines.push('=== RESULTS TABLE ===')
  lines.push('')
  lines.push(
    `${pad('Q', qCol)}  ${pad('Check', chkCol)}  ${pad('Description', descCol)}  ${padLeft('Rate', rateCol)}`,
  )
  lines.push('-'.repeat(qCol + 2 + chkCol + 2 + descCol + 2 + rateCol))

  for (const q of selected) {
    for (const c of q.checks) {
      const r = results[q.id][c.id]
      const rate = `${r.pass}/${r.total}`
      const chkId = c.critical ? `${c.id} *` : c.id
      lines.push(
        `${pad(q.id, qCol)}  ${pad(chkId, chkCol)}  ${pad(c.description, descCol)}  ${padLeft(rate, rateCol)}`,
      )
    }
  }

  lines.push('')
  lines.push('* = CRITICAL check')

  // ─── Build summary ────────────────────────────────────────────────────────
  const criticalFails: string[] = []
  const normalFails: string[] = []
  for (const q of selected) {
    for (const c of q.checks) {
      const r = results[q.id][c.id]
      if (r.pass < r.total) {
        const msg = `(${q.id}) ${c.id} — ${r.description} — ${r.pass}/${r.total}`
        if (c.critical) criticalFails.push(msg)
        else normalFails.push(msg)
      }
    }
  }

  lines.push('')
  lines.push('=== SUMMARY ===')
  if (criticalFails.length > 0) {
    lines.push('')
    lines.push('CRITICAL FAILURES:')
    for (const f of criticalFails) lines.push('  ! ' + f)
  } else {
    lines.push('')
    lines.push('CRITICAL FAILURES: none')
  }
  if (normalFails.length > 0) {
    lines.push('')
    lines.push('Other failures:')
    for (const f of normalFails) lines.push('  - ' + f)
  }
  if (criticalFails.length === 0 && normalFails.length === 0) {
    lines.push('')
    lines.push('All checks passed.')
  }
  lines.push('')
  lines.push(`Total wall time: ${totalElapsed}s across ${totalCalls} model calls`)
  lines.push(`Raw answers saved to: ${answersPath}`)
  lines.push(`Results saved to:     ${resultsPath}`)

  const output = lines.join('\n')
  console.log(output)
  fs.writeFileSync(resultsPath, output + '\n')

  await shutdown()
  process.exit(criticalFails.length > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  try {
    const { shutdown } = await import('./pipeline')
    await shutdown()
  } catch {
    // Non-fatal.
  }
  process.exit(1)
})
