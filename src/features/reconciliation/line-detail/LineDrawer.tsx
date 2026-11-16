import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { usePartyLookup, useReconciliation, useSettings } from '@/api/queries'
import type { BankLine, Reconciliation } from '@/api/types'
import { Amount } from '@/components/Amount'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { EmptyState } from '@/components/States'
import { formatDate } from '@/lib/format'
import { rankCandidates } from '@/lib/matching'
import { PayBillDialog } from '@/features/payables/PayBillDialog'
import { RecordReceiptDialog } from '@/features/receivables/RecordReceiptDialog'
import { StatusBadge } from '../badges'
import { useReconActions } from '../ReconActionsProvider'
import { AuditTrail } from '@/components/AuditTrail'
import { CandidateList } from './CandidateList'
import { ExcludeDialog } from './ExcludeDialog'
import { MatchedEntries } from './MatchedEntries'
import styles from './LineDrawer.module.css'

export function LineDrawer() {
  const { lineId } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const { data } = useReconciliation()

  const line = data?.bankLines.find((l) => l.id === lineId)
  const close = () => navigate({ pathname: '/reconciliation', search })

  return (
    <Dialog
      variant="drawer"
      open
      onOpenChange={(open) => !open && close()}
      title={line ? line.narration : 'Bank line not found'}
      description={line ? `${formatDate(line.date, true)} · Ref ${line.ref || 'none'}` : undefined}
    >
      {line && data ? (
        <LineDetail line={line} data={data} />
      ) : (
        <EmptyState
          title="We couldn’t find that bank line"
          action={<Button onClick={close}>Back to workbench</Button>}
        >
          The link may be old, or the line was removed from the statement.
        </EmptyState>
      )}
    </Dialog>
  )
}

function LineDetail({ line, data }: { line: BankLine; data: Reconciliation }) {
  const actions = useReconActions()
  const { data: settings } = useSettings()
  const parties = usePartyLookup()
  const [excluding, setExcluding] = useState(false)
  const [posting, setPosting] = useState(false)

  const matchedEntries = data.ledger.filter((e) => line.ledgerIds.includes(e.id))

  return (
    <div className={styles.detail}>
      <div className={styles.summary}>
        <Amount value={line.amount} direction={line.direction} large />
        <StatusBadge status={line.status} />
        <p className={styles.direction}>{line.direction === 'in' ? 'Money in' : 'Money out'}</p>
      </div>

      {line.status === 'open' && (
        <section className={styles.section} aria-labelledby="candidates-heading">
          <h3 id="candidates-heading" className={styles.heading}>
            Likely matches in the books
          </h3>
          <CandidateList
            candidates={rankCandidates(line, data.ledger, settings)}
            onMatch={(entryId) => actions.match([{ lineId: line.id, ledgerIds: [entryId] }])}
          />
        </section>
      )}

      {line.status === 'open' && (
        <section className={styles.section} aria-labelledby="post-heading">
          <h3 id="post-heading" className={styles.heading}>
            Not in the books yet?
          </h3>
          <p className={styles.help}>
            {line.direction === 'in'
              ? 'If a customer paid and nobody recorded it, post the receipt from here. It’s matched to this line straight away.'
              : 'If a vendor was paid from net banking without a voucher, record the bill payment from here.'}
          </p>
          <div className={styles.actions}>
            <Button variant="primary" onClick={() => setPosting(true)}>
              {line.direction === 'in' ? 'Record customer receipt' : 'Record bill payment'}
            </Button>
            <Button variant="danger" onClick={() => setExcluding(true)}>
              Exclude
            </Button>
          </div>
        </section>
      )}

      {line.status === 'matched' && (
        <section className={styles.section} aria-labelledby="matched-heading">
          <h3 id="matched-heading" className={styles.heading}>
            Matched to
          </h3>
          <MatchedEntries entries={matchedEntries} parties={parties} />
          <div className={styles.actions}>
            <Button variant="danger" onClick={() => actions.reopen([line.id])}>
              Unmatch
            </Button>
          </div>
        </section>
      )}

      {line.status === 'excluded' && (
        <section className={styles.section} aria-labelledby="excluded-heading">
          <h3 id="excluded-heading" className={styles.heading}>
            Excluded from reconciliation
          </h3>
          <p className={styles.reason}>{line.excludeReason}</p>
          <div className={styles.actions}>
            <Button onClick={() => actions.reopen([line.id])}>Reopen</Button>
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="history-heading">
        <h3 id="history-heading" className={styles.heading}>
          History
        </h3>
        <AuditTrail events={line.history} />
      </section>

      <ExcludeDialog
        open={excluding}
        onOpenChange={setExcluding}
        onConfirm={(reason) => {
          actions.exclude([{ lineId: line.id, reason }])
          setExcluding(false)
        }}
      />

      {line.direction === 'in' ? (
        <RecordReceiptDialog open={posting} onOpenChange={setPosting} bankLine={line} />
      ) : (
        <PayBillDialog open={posting} onOpenChange={setPosting} bankLine={line} />
      )}
    </div>
  )
}
