import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { reconApi } from '@/api/mockApi'
import { useOptimisticMutation } from '@/api/queries'
import type { Exclusion, MatchPair } from '@/api/types'
import { useToast } from '@/components/Toast'
import { applyExclude, applyMatch, applyReopen } from '@/lib/reconcile'

interface ReconActions {
  match: (pairs: MatchPair[]) => void
  reopen: (lineIds: string[]) => void
  exclude: (exclusions: Exclusion[]) => void
}

const ReconActionsContext = createContext<ReconActions | null>(null)

const currentUser = () => ({ by: 'You', at: new Date().toISOString() })

const plural = (count: number, one: string, many: string) =>
  count === 1 ? one : `${count} ${many}`

// Every reconciliation write goes through here. It sits above the router so it never
// unmounts, which means an Undo clicked after the drawer has closed still works.
export function ReconActionsProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const showError = (error: Error) =>
    toast.show(`Couldn’t save: ${error.message}`, { tone: 'error' })

  const { mutate: reopen } = useOptimisticMutation({
    mutationFn: reconApi.reopen,
    applyLocally: (data, lineIds: string[]) => applyReopen(data, lineIds, currentUser()),
    onSuccess: (lineIds) => toast.show(plural(lineIds.length, 'Line reopened', 'lines reopened')),
    onError: showError,
  })

  const undo = (lineIds: string[]) => ({ label: 'Undo', onClick: () => reopen(lineIds) })

  const { mutate: match } = useOptimisticMutation({
    mutationFn: reconApi.match,
    applyLocally: (data, pairs: MatchPair[]) => applyMatch(data, pairs, currentUser()),
    onSuccess: (pairs) =>
      toast.show(plural(pairs.length, 'Matched', 'lines matched'), {
        action: undo(pairs.map((p) => p.lineId)),
      }),
    onError: showError,
  })

  const { mutate: exclude } = useOptimisticMutation({
    mutationFn: reconApi.exclude,
    applyLocally: (data, exclusions: Exclusion[]) => applyExclude(data, exclusions, currentUser()),
    onSuccess: (exclusions) =>
      toast.show(plural(exclusions.length, 'Line excluded', 'lines excluded'), {
        action: undo(exclusions.map((e) => e.lineId)),
      }),
    onError: showError,
  })

  // mutate() is stable between renders, so this object is too. The memoised rows rely on it.
  const actions = useMemo<ReconActions>(
    () => ({
      match: (pairs) => match(pairs),
      reopen: (lineIds) => reopen(lineIds),
      exclude: (exclusions) => exclude(exclusions),
    }),
    [match, reopen, exclude],
  )

  return <ReconActionsContext.Provider value={actions}>{children}</ReconActionsContext.Provider>
}

export function useReconActions() {
  const context = useContext(ReconActionsContext)
  if (!context) throw new Error('useReconActions must be used inside <ReconActionsProvider>')
  return context
}
