type Cell = string | number

const escape = (cell: Cell) => {
  const text = String(cell)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((row) => row.map(escape).join(',')).join('\n')
}

export function downloadCsv(filename: string, rows: Cell[][]) {
  // The BOM makes Excel open the file as UTF-8, so ₹ and “quotes” survive.
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
