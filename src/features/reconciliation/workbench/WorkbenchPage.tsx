import { Suspense, useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useReconciliation, useSettings } from '@/api/queries'
import type { Reconciliation, Settings } from '@/api/types'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { Page, PageHeader } from '@/components/Page'
import { EmptyState } from '@/components/States'
import { todayISO } from '@/lib/dates'
import { buildRows, filterRows, type BankRow } from '@/lib/filters'
import { formatDate } from '@/lib/format'
import { summarize } from '@/lib/summary'
import { useReconActions } from '../ReconActionsProvider'
import { AgingBars } from './AgingBars'
import { ApplyRulesButton } from './ApplyRulesButton'
import { BankLinePane } from './BankLinePane'
import { BulkAcceptButton } from './BulkAcceptButton'
import { FilterBar } from './FilterBar'
import { LedgerPane } from './LedgerPane'
import { MatchBar } from './MatchBar'
import { SummaryCards } from './SummaryCards'
import { useFilters } from './useFilters'
import { WorkbenchSkeleton } from './WorkbenchSkeleton'
import styles from './WorkbenchPage.module.css'

export function WorkbenchPage() {
  const recon = useReconciliation()
  const settings = useSettings()

  return (
    <Loader queries={[recon, settings]} what="the reconciliation" skeleton={<WorkbenchSkeleton />}>
      {() => <Workbench data={recon.data!} settings={settings.data!} />}
    </Loader>
  )
}

function Workbench({ data, settings }: { data: Reconciliation; settings: Settings }) {
  const { filters, update, reset, activeCount } = useFilters()
  const actions = useReconActions()
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<string[]>([])

  const today = todayISO()
  const rows = useMemo(() => buildRows(data, today, settings), [data, today, settings])
  const visibleRows = useMemo(() => filterRows(rows, filters), [rows, filters])
  const summary = useMemo(() => summarize(data), [data])
  const openEntries = useMemo(() => data.ledger.filter((e) => e.bankLineId === null), [data.ledger])

  const highConfidence = rows.filter(
    (r) => r.status === 'suggested' && r.suggestion?.confidence === 'high',
  )

  // If the selected line gets reconciled some other way (drawer, bulk accept), drop it.
  const selectedLine =
    data.bankLines.find((l) => l.id === selectedLineId && l.status === 'open') ?? null
  const checkedEntries = openEntries.filter((e) => checkedIds.includes(e.id))

  const selectLine = useCallback((lineId: string) => {
    setSelectedLineId((current) => (current === lineId ? null : lineId))
    setCheckedIds([])
  }, [])

  const toggleEntry = useCallback((entryId: string) => {
    setCheckedIds((ids) =>
      ids.includes(entryId) ? ids.filter((id) => id !== entryId) : [...ids, entryId],
    )
  }, [])

  const acceptSuggestion = useCallback(
    (row: BankRow) => {
      if (row.suggestion)
        actions.match([{ lineId: row.line.id, ledgerIds: [row.suggestion.entry.id] }])
    },
    [actions],
  )

  function clearSelection() {
    setSelectedLineId(null)
    setCheckedIds([])
  }

  function matchSelected() {
    if (!selectedLine) return
    actions.match([{ lineId: selectedLine.id, ledgerIds: checkedIds }])
    clearSelection()
  }

  const nothingLeft = summary.openLines === 0 && activeCount === 0
  const emptyList = nothingLeft ? (
    <EmptyState title="Everything is reconciled 🎉">
      Every line on this statement is matched or excluded. You’re ready to close the period.
    </EmptyState>
  ) : (
    <EmptyState
      title="No bank lines match these filters"
      action={<Button onClick={reset}>Show all lines</Button>}
    >
      Try a different search, or clear the filters to see everything that needs attention.
    </EmptyState>
  )

  return (
    <Page wide>
      <PageHeader
        title="Bank reconciliation"
        subtitle={`${data.account.bank} · ${data.account.name} ${data.account.number} · ${formatDate(data.period.from)} – ${formatDate(data.period.to, true)}`}
        actions={
          <>
            <ApplyRulesButton lines={data.bankLines} rules={settings.rules} />
            <BulkAcceptButton rows={highConfidence} />
          </>
        }
      />

      <div className={styles.overview}>
        <SummaryCards summary={summary} suggestions={highConfidence.length} />
        <AgingBars
          rows={rows}
          active={filters.age}
          onSelect={(age) => update({ age, status: 'unresolved' })}
        />
      </div>

      <FilterBar filters={filters} onChange={update} onReset={reset} activeCount={activeCount} />

      <div className={styles.panes}>
        <BankLinePane
          rows={visibleRows}
          totalCount={rows.length}
          selectedId={selectedLine?.id}
          onSelect={selectLine}
          onAccept={acceptSuggestion}
          empty={emptyList}
        />
        <LedgerPane
          entries={openEntries}
          selectedLine={selectedLine}
          checkedIds={checkedIds}
          onToggle={toggleEntry}
        />
      </div>

      {selectedLine && (
        <MatchBar
          line={selectedLine}
          entries={checkedEntries}
          onMatch={matchSelected}
          onCancel={clearSelection}
        />
      )}

      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </Page>
  )
}
