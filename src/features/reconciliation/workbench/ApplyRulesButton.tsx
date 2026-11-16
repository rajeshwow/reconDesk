import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { BankLine, ExclusionRule } from '@/api/types'
import { Amount } from '@/components/Amount'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { exclusionsFromRules } from '@/lib/rules'
import { useReconActions } from '../ReconActionsProvider'
import styles from './ApplyRulesButton.module.css'

// Rules live on the Settings page. This shows what they'd do right now and runs them.
export function ApplyRulesButton({ lines, rules }: { lines: BankLine[]; rules: ExclusionRule[] }) {
  const [open, setOpen] = useState(false)
  const actions = useReconActions()

  const exclusions = exclusionsFromRules(lines, rules)
  const byId = new Map(lines.map((l) => [l.id, l]))

  function confirm() {
    actions.exclude(exclusions)
    setOpen(false)
  }

  return (
    <>
      <Button disabled={exclusions.length === 0} onClick={() => setOpen(true)}>
        Apply rules ({exclusions.length})
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Exclude ${exclusions.length} lines by rule?`}
        description={
          <>
            Based on your <Link to="/settings">exclusion rules</Link>. You can undo straight after.
          </>
        }
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={confirm}>
              Exclude {exclusions.length} lines
            </Button>
          </>
        }
      >
        <ul className={styles.list}>
          {exclusions.map(({ lineId, reason }) => {
            const line = byId.get(lineId)!
            return (
              <li key={lineId} className={styles.item}>
                <span className={styles.text}>
                  <span className={styles.narration}>{line.narration}</span>
                  <span className={styles.reason}>{reason}</span>
                </span>
                <Amount value={line.amount} direction={line.direction} />
              </li>
            )
          })}
        </ul>
      </Dialog>
    </>
  )
}
