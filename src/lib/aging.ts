// Two sets of buckets: how long a bank line has been sitting unreconciled, and how far
// past its due date an invoice or bill is.

export const AGE_BUCKETS = [
  { key: '0-7', label: '0–7 days', maxDays: 7 },
  { key: '8-15', label: '8–15 days', maxDays: 15 },
  { key: '16-30', label: '16–30 days', maxDays: 30 },
  { key: '30+', label: 'Over 30 days', maxDays: Infinity },
] as const

export type AgeBucketKey = (typeof AGE_BUCKETS)[number]['key']

export function bucketFor(ageInDays: number): AgeBucketKey {
  const bucket = AGE_BUCKETS.find((b) => ageInDays <= b.maxDays)
  return bucket ? bucket.key : '30+'
}

export function bucketLabel(key: AgeBucketKey): string {
  return AGE_BUCKETS.find((b) => b.key === key)?.label ?? key
}

export const DUE_BUCKETS = [
  { key: 'current', label: 'Not yet due', maxDays: 0 },
  { key: '1-30', label: '1–30 days', maxDays: 30 },
  { key: '31-60', label: '31–60 days', maxDays: 60 },
  { key: '61-90', label: '61–90 days', maxDays: 90 },
  { key: '90+', label: 'Over 90 days', maxDays: Infinity },
] as const

export type DueBucketKey = (typeof DUE_BUCKETS)[number]['key']

export function dueBucketFor(daysOverdue: number): DueBucketKey {
  const bucket = DUE_BUCKETS.find((b) => daysOverdue <= b.maxDays)
  return bucket ? bucket.key : '90+'
}
