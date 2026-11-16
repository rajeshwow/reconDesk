import * as RadixDialog from '@radix-ui/react-dialog'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBills, useInvoices, useParties, useReconciliation } from '@/api/queries'
import { Icon } from '@/components/Icon'
import { searchEverything } from '@/lib/search'
import { ALL_NAV_ITEMS } from './nav'
import styles from './CommandPalette.module.css'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content className={styles.content} aria-describedby={undefined}>
          <RadixDialog.Title className="sr-only">Search everything</RadixDialog.Title>
          <Palette onDone={() => onOpenChange(false)} />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

// Mounted only while open, so the query and highlight reset every time.
function Palette({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const { data: parties = [] } = useParties()
  const { data: invoices = [] } = useInvoices()
  const { data: bills = [] } = useBills()
  const { data: recon } = useReconciliation()

  const results = useMemo(
    () =>
      searchEverything(query, {
        pages: ALL_NAV_ITEMS,
        parties,
        invoices,
        bills,
        bankLines: recon?.bankLines ?? [],
      }),
    [query, parties, invoices, bills, recon],
  )

  function go(index: number) {
    const result = results[index]
    if (!result) return
    navigate(result.to)
    onDone()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (i + step + results.length) % Math.max(results.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      go(active)
    }
  }

  const optionId = (index: number) => `palette-option-${index}`

  return (
    <>
      <div className={styles.inputRow}>
        <Icon name="search" />
        <input
          className={styles.input}
          autoFocus
          role="combobox"
          aria-label="Search"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={results.length ? optionId(active) : undefined}
          placeholder="Search parties, invoices, bills, bank lines…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
        <kbd className={styles.kbd}>Esc</kbd>
      </div>

      <ul id="palette-results" role="listbox" aria-label="Results" className={styles.results}>
        {results.length === 0 && <li className={styles.empty}>Nothing found for “{query}”</li>}
        {results.map((result, index) => (
          <li
            key={result.key}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            className={styles.option}
            onMouseEnter={() => setActive(index)}
            onClick={() => go(index)}
          >
            {(index === 0 || results[index - 1].group !== result.group) && (
              <span className={styles.group}>{result.group}</span>
            )}
            <span className={styles.title}>{result.title}</span>
            <span className={styles.detail}>{result.detail}</span>
          </li>
        ))}
      </ul>

      <p className={styles.footer}>
        <kbd className={styles.kbd}>↑</kbd> <kbd className={styles.kbd}>↓</kbd> to move ·{' '}
        <kbd className={styles.kbd}>Enter</kbd> to open
      </p>
    </>
  )
}
