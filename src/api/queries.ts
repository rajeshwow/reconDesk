import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useMemo } from 'react'
import { activityApi, billsApi, invoicesApi, partiesApi, reconApi, settingsApi } from './mockApi'
import type { Party, Reconciliation } from './types'

export const queryKeys = {
  reconciliation: ['reconciliation'],
  parties: ['parties'],
  invoices: ['invoices'],
  bills: ['bills'],
  activity: ['activity'],
  settings: ['settings'],
} as const

// ── Reads ──────────────────────────────────────────────────────────────────

export const useReconciliation = () =>
  useQuery({ queryKey: queryKeys.reconciliation, queryFn: reconApi.get })
export const useParties = () => useQuery({ queryKey: queryKeys.parties, queryFn: partiesApi.list })
export const useInvoices = () =>
  useQuery({ queryKey: queryKeys.invoices, queryFn: invoicesApi.list })
export const useBills = () => useQuery({ queryKey: queryKeys.bills, queryFn: billsApi.list })
export const useActivity = () =>
  useQuery({ queryKey: queryKeys.activity, queryFn: activityApi.list })
export const useSettings = () =>
  useQuery({ queryKey: queryKeys.settings, queryFn: settingsApi.get })

// Most screens show a party's name next to an id. One shared map instead of a find() per row.
export function usePartyLookup() {
  const { data } = useParties()
  return useMemo(() => new Map<string, Party>(data?.map((p) => [p.id, p])), [data])
}

// ── Writes ─────────────────────────────────────────────────────────────────

interface OptimisticOptions<TVars> {
  mutationFn: (vars: TVars) => Promise<Reconciliation>
  applyLocally: (data: Reconciliation, vars: TVars) => Reconciliation
  onSuccess?: (vars: TVars) => void
  onError?: (error: Error) => void
}

// Reconciliation writes are optimistic: people clear dozens of lines in a row and shouldn't
// wait on each one. Apply locally, keep a copy, roll back if the server says no.
// Callbacks live here rather than on mutate() because v5 only fires mutate() callbacks
// for the latest call, and two quick clicks would lose the first toast.
export function useOptimisticMutation<TVars>({
  mutationFn,
  applyLocally,
  onSuccess,
  onError,
}: OptimisticOptions<TVars>) {
  const queryClient = useQueryClient()
  const key = queryKeys.reconciliation

  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Reconciliation>(key)
      if (previous) queryClient.setQueryData(key, applyLocally(previous, vars))
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      onError?.(error)
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(key, data)
      onSuccess?.(vars)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.activity }),
  })
}

// Everything else waits for the server: these writes create records with server-side
// numbers (RCT/152, INV-1043) and usually touch more than one module, so guessing the
// result locally isn't worth it. On success, refresh every list the write affected.
export function useServerMutation<TVars, TResult>(
  mutationFn: (vars: TVars) => Promise<TResult>,
  affects: QueryKey[],
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all(
        [...affects, queryKeys.activity].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}
