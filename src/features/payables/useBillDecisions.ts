import { billsApi } from '@/api/mockApi'
import { queryKeys, useServerMutation } from '@/api/queries'
import { useToast } from '@/components/Toast'

// Approve one bill or many. Each approval is its own request, so one refused bill
// doesn't block the rest; the toast says how many went through.
export function useApproveBills() {
  const toast = useToast()
  const mutation = useServerMutation(
    (billIds: string[]) =>
      Promise.allSettled(billIds.map((billId) => billsApi.decide({ billId, approve: true }))),
    [queryKeys.bills],
  )

  return {
    approve: (billIds: string[], onDone?: () => void) =>
      mutation.mutate(billIds, {
        onSuccess: (results) => {
          const failed = results.filter((r) => r.status === 'rejected')
          const done = results.length - failed.length
          if (done) toast.show(done === 1 ? 'Bill approved' : `${done} bills approved`)
          if (failed.length) {
            const reason = (failed[0] as PromiseRejectedResult).reason as Error
            toast.show(`Couldn’t approve ${failed.length}: ${reason.message}`, { tone: 'error' })
          }
          onDone?.()
        },
      }),
    isPending: mutation.isPending,
  }
}

export function useRejectBill() {
  return useServerMutation(
    ({ billId, reason }: { billId: string; reason: string }) =>
      billsApi.decide({ billId, approve: false, reason }),
    [queryKeys.bills],
  )
}
