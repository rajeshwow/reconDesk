import { parseISODate } from './dates'

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const shortDate = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' })
const longDate = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})
const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatMoney = (amount: number) => money.format(amount)

export const formatDate = (value: string, withYear = false) =>
  (withYear ? longDate : shortDate).format(parseISODate(value))

export const formatDateTime = (value: string) => dateTime.format(new Date(value))

// Money maths is done in paise so 0.1 + 0.2 style float errors never decide a match.
export const toPaise = (amount: number) => Math.round(amount * 100)

export const sumAmounts = (items: { amount: number }[]) =>
  items.reduce((total, item) => total + toPaise(item.amount), 0) / 100

export const subtractMoney = (a: number, b: number) => (toPaise(a) - toPaise(b)) / 100

// Compact form for charts and tight cards: ₹4.2L, ₹1.3Cr.
export function formatCompact(amount: number) {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '−' : ''
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`
  return `${sign}₹${abs.toFixed(0)}`
}

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
