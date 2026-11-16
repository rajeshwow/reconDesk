import type { BankLine, LedgerEntry, Party, Settings } from '@/api/types'
import { daysBetween } from './dates'
import { formatMoney, toPaise } from './format'

export type Confidence = 'high' | 'medium' | 'low'

export interface Candidate {
  entry: LedgerEntry
  score: number
  confidence: Confidence
  reasons: string[]
}

export type MatchSettings = Pick<Settings, 'amountTolerance' | 'dateWindowDays'>

// Customers often pay short (TDS, bank charges), so a small gap still counts as a candidate.
// Both values can be changed on the Settings page.
export const DEFAULT_MATCH_SETTINGS: MatchSettings = { amountTolerance: 2, dateWindowDays: 15 }

export function withinTolerance(gap: number, amount: number, settings: MatchSettings) {
  return gap <= (amount * settings.amountTolerance) / 100
}

export function confidenceFor(score: number): Confidence {
  if (score >= 80) return 'high'
  if (score >= 55) return 'medium'
  return 'low'
}

export function scoreCandidate(
  line: BankLine,
  entry: LedgerEntry,
  settings = DEFAULT_MATCH_SETTINGS,
): Candidate | null {
  if (line.direction !== entry.direction) return null

  const days = Math.abs(daysBetween(entry.date, line.date))
  if (days > settings.dateWindowDays) return null

  const reasons: string[] = []
  let score = 0

  const gap = Math.abs(toPaise(line.amount) - toPaise(entry.amount)) / 100
  if (gap === 0) {
    score += 50
    reasons.push('Amount matches exactly')
  } else if (withinTolerance(gap, entry.amount, settings)) {
    score += 20
    reasons.push(`Amount differs by ${formatMoney(gap)}`)
  } else {
    return null
  }

  if (days === 0) {
    score += 25
    reasons.push('Same date')
  } else if (days <= 3) {
    score += 15
    reasons.push(`${days} ${days === 1 ? 'day' : 'days'} apart`)
  } else if (days <= 7) {
    score += 5
    reasons.push(`${days} days apart`)
  }

  if (entry.ref && entry.ref === line.ref) {
    score += 25
    reasons.push('Reference number matches')
  }

  if (mentionsParty(line.narration, entry.party)) {
    score += 10
    reasons.push('Party name appears in narration')
  }

  return { entry, score, confidence: confidenceFor(score), reasons }
}

// Banks truncate names, so the first word is the most reliable thing to look for.
export function mentionsParty(narration: string, party: string) {
  const firstWord = party.split(' ')[0].toUpperCase()
  return firstWord.length >= 4 && narration.toUpperCase().includes(firstWord)
}

export function guessParty(narration: string, parties: Party[]): Party | undefined {
  return parties.find((p) => mentionsParty(narration, p.name))
}

export function rankCandidates(
  line: BankLine,
  ledger: LedgerEntry[],
  settings = DEFAULT_MATCH_SETTINGS,
  limit = 5,
): Candidate[] {
  return ledger
    .filter((entry) => entry.bankLineId === null)
    .map((entry) => scoreCandidate(line, entry, settings))
    .filter((candidate): candidate is Candidate => candidate !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// Best suggestion per open bank line. Greedy on score: the strongest pairs claim their
// book entry first, so the same entry is never suggested for two bank lines.
export function suggestMatches(
  lines: BankLine[],
  ledger: LedgerEntry[],
  settings = DEFAULT_MATCH_SETTINGS,
): Map<string, Candidate> {
  const openEntries = ledger.filter((entry) => entry.bankLineId === null)
  const pairs: { lineId: string; candidate: Candidate }[] = []

  for (const line of lines) {
    if (line.status !== 'open') continue
    for (const entry of openEntries) {
      const candidate = scoreCandidate(line, entry, settings)
      if (candidate) pairs.push({ lineId: line.id, candidate })
    }
  }

  pairs.sort((a, b) => b.candidate.score - a.candidate.score)

  const suggestions = new Map<string, Candidate>()
  const usedEntries = new Set<string>()
  for (const { lineId, candidate } of pairs) {
    if (suggestions.has(lineId) || usedEntries.has(candidate.entry.id)) continue
    suggestions.set(lineId, candidate)
    usedEntries.add(candidate.entry.id)
  }
  return suggestions
}
