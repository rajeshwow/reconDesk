import type { BankLine, Exclusion, ExclusionRule } from '@/api/types'

export function ruleMatches(rule: ExclusionRule, line: BankLine) {
  const needle = rule.contains.trim().toLowerCase()
  return rule.enabled && needle.length > 0 && line.narration.toLowerCase().includes(needle)
}

// Open lines that an enabled rule would exclude. The first matching rule wins, in the
// order they're listed on the Settings page.
export function exclusionsFromRules(lines: BankLine[], rules: ExclusionRule[]): Exclusion[] {
  return lines.flatMap((line) => {
    if (line.status !== 'open') return []
    const rule = rules.find((r) => ruleMatches(r, line))
    return rule ? [{ lineId: line.id, reason: `${rule.reason} (rule: “${rule.contains}”)` }] : []
  })
}
