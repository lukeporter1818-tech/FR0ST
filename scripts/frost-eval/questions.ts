import {
  contains,
  containsAll,
  containsNone,
  containsAny,
  startsWith,
  regexMatchesNone,
  lastLineMatchesAny,
  needlesOnlyInLastLine,
} from './checks'

export interface Check {
  id: string
  description: string
  critical: boolean
  run: (text: string) => boolean
}

export interface Question {
  id: string
  text: string
  checks: Check[]
}

// Matches ranges like "4-8", "4 - 8", "4–8", "4—8", "6-10", "8-12" (any dash),
// optionally followed by °F or F.
const NUMERIC_RANGE = /(4|6|8)\s*[\-‐‑‒–—−]\s*(8|10|12)/
const TEMP_RANGE = /\d+\s*[\-‐‑‒–—−]\s*\d+\s*°?\s*F\b/i
// Number followed by torque units (ft-lb, in-lb, N·m, Nm), with tolerant spacing/hyphenation.
const TORQUE_UNITS = /\d+(\.\d+)?\s*(ft[\s\-]?lb|in[\s\-]?lb|N[\s·]?m|Nm)\b/i

export const QUESTIONS: Question[] = [
  {
    id: 'a',
    text: "What's the refrigerant charge on the VRM2B?",
    checks: [
      {
        id: 'a-contains-required',
        description: 'contains 0.150, p. 40, pinch, "no leak", ground, hose, hydrocarbon, 3 gram, tank',
        critical: true,
        run: (t) =>
          containsAll(t, [
            '0.150',
            'p. 40',
            'pinch',
            'no leak',
            'ground',
            'hose',
            'hydrocarbon',
            '3 gram',
            'tank',
          ]),
      },
      {
        id: 'a-excludes-forbidden',
        description: 'does not contain "ventilat", "authority", or "Likely part"',
        critical: true,
        run: (t) => containsNone(t, ['ventilat', 'authority', 'Likely part']),
      },
    ],
  },

  {
    id: 'b',
    text: "What's the defrost termination temperature and failsafe time on the Hussmann VRM?",
    checks: [
      {
        id: 'b-contains-required',
        description: 'contains 48, 35, p. 40',
        critical: false,
        run: (t) => containsAll(t, ['48', '35', 'p. 40']),
      },
      {
        id: 'b-no-pinned-block',
        description: 'does not contain "Manual text —"',
        critical: false,
        run: (t) => containsNone(t, ['Manual text —']),
      },
    ],
  },

  {
    id: 'c',
    text: 'How do I adjust door closing torque on the VRM?',
    checks: [
      {
        id: 'c-contains-required',
        description: 'contains 1/2, p. 29, p. 31',
        critical: false,
        run: (t) => containsAll(t, ['1/2', 'p. 29', 'p. 31']),
      },
      {
        id: 'c-contains-adjustment-phrase',
        description: 'contains "5 clicks" or "one full turn"',
        critical: false,
        run: (t) => containsAny(t, ['5 clicks', 'one full turn']),
      },
    ],
  },

  {
    id: 'd',
    text: "What's the torque spec for a Copeland compressor mounting bolt?",
    checks: [
      {
        id: 'd-starts-with-idk',
        description: 'starts with "I don\'t have that in the uploaded manuals."',
        critical: false,
        run: (t) => startsWith(t, "I don't have that in the uploaded manuals."),
      },
      {
        id: 'd-no-number-with-torque-units',
        description: 'no number followed by ft-lb, in-lb, N·m, or Nm',
        critical: true,
        run: (t) => regexMatchesNone(t, TORQUE_UNITS),
      },
      {
        id: 'd-excludes-stamp-prints',
        description: 'does not contain "stamp" or "prints"',
        critical: false,
        run: (t) => containsNone(t, ['stamp', 'prints']),
      },
      {
        id: 'd-nameplate-only-in-last-line',
        description: 'nameplate or manufacturer\'s sheet appears only in the last line',
        critical: false,
        run: (t) => needlesOnlyInLastLine(t, ['nameplate', "manufacturer's sheet"]),
      },
    ],
  },

  {
    id: 'e',
    text: 'What are the recommended superheat settings for a display case?',
    checks: [
      {
        id: 'e-starts-with-from-sporlan',
        description: 'starts with "From the Sporlan"',
        critical: false,
        run: (t) => startsWith(t, 'From the Sporlan'),
      },
      {
        id: 'e-contains-p8',
        description: 'contains "p. 8"',
        critical: false,
        run: (t) => contains(t, 'p. 8'),
      },
      {
        id: 'e-no-invented-superheat-range',
        description: 'no "4-8", "6-10", or "8-12" (any dash type)',
        critical: false,
        run: (t) => regexMatchesNone(t, NUMERIC_RANGE),
      },
      {
        id: 'e-no-stretch-phrase',
        description: 'does not contain "includes most display cases"',
        critical: false,
        run: (t) => containsNone(t, ['includes most display cases']),
      },
      {
        id: 'e-no-pinned-block',
        description: 'does not contain "Manual text —"',
        critical: false,
        run: (t) => containsNone(t, ['Manual text —']),
      },
    ],
  },

  {
    id: 'f',
    text: 'What are the recommended superheat and subcooling settings for a Hussmann display case?',
    checks: [
      {
        id: 'f-no-txv-bulb-assumption',
        description: 'does not treat a TXV bulb as present (regex "\\bTXV bulb\\b")',
        critical: false,
        run: (t) => regexMatchesNone(t, /\bTXV bulb\b/i),
      },
      {
        id: 'f-no-rack-location',
        description: 'does not name a rack-side location ("condenser outlet", "the rack", "on/at the rack")',
        critical: false,
        run: (t) =>
          regexMatchesNone(
            t,
            /\bcondenser outlet\b|\b(on|at)\s+the\s+rack\b|\bthe\s+rack\b/i,
          ),
      },
      {
        id: 'f-no-temperature-range',
        description: 'no temperature range like "4-8°F"',
        critical: false,
        run: (t) => regexMatchesNone(t, TEMP_RANGE),
      },
      {
        id: 'f-last-line-nameplate',
        description: 'last line mentions the nameplate or manufacturer\'s sheet',
        critical: false,
        run: (t) => lastLineMatchesAny(t, [/nameplate/i, /manufacturer['’]?s\s+sheet/i]),
      },
    ],
  },

  {
    id: 'g',
    text: 'The case is running warm, where do I start?',
    checks: [
      {
        id: 'g-no-label',
        description: 'does not contain "General field advice"',
        critical: false,
        run: (t) => containsNone(t, ['General field advice']),
      },
      {
        id: 'g-no-component-assumption',
        description:
          'no "TXV bulb", no "check/inspect/adjust the (TXV|solenoid|expansion valve|thermostatic bulb)", no unhedged "(TXV|solenoid|expansion valve) is/has/needs/failed/stuck/hunting"',
        critical: false,
        run: (t) => {
          if (/\bTXV bulb\b/i.test(t)) return false
          if (
            /\b(check|inspect|adjust)\s+the\s+(TXV|liquid line solenoid|expansion valve|thermostatic bulb)\b/i.test(
              t,
            )
          ) {
            return false
          }
          const componentVerbPattern =
            /\b(TXV|liquid line solenoid|expansion valve)\s+(is|has|needs|failed|stuck|hunting)\b/i
          const sentences = t.split(/(?<=[.!?])\s+|\n+/)
          for (const s of sentences) {
            if (!componentVerbPattern.test(s)) continue
            const stripped = s.replace(/^[\s\-*\d.)]+/, '').toLowerCase()
            if (/^if\b/.test(stripped)) continue
            const lower = s.toLowerCase()
            if (lower.includes('or eev')) continue
            if (lower.includes('if it has')) continue
            return false
          }
          return true
        },
      },
    ],
  },

  {
    id: 'h',
    text: 'Hussmann VRM2B condenser fan motor',
    checks: [
      {
        id: 'h-contains-part-number',
        description: 'contains "0535563"',
        critical: false,
        run: (t) => contains(t, '0535563'),
      },
      {
        id: 'h-contains-availability',
        description: 'contains "Availability"',
        critical: false,
        run: (t) => contains(t, 'Availability'),
      },
    ],
  },

  {
    id: 'i',
    text: 'What are the stocking guidelines for the glass door merchandiser?',
    checks: [
      {
        id: 'i-answers-from-manual',
        description: 'answers from the manual with a p. 10 cite',
        critical: false,
        run: (t) => contains(t, 'p. 10') && !contains(t, 'Manual text —'),
      },
    ],
  },
]
