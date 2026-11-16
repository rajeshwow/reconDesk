import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Skeleton, ErrorState } from './States'
import styles from './Loader.module.css'

interface LoaderProps {
  queries: UseQueryResult<unknown>[]
  /** Used in the error and screen reader messages: "Couldn’t load receivables". */
  what: string
  skeleton?: ReactNode
  children: () => ReactNode
}

// Every page needs the same three states. Children is a function so it only runs once
// all the data is there, and the page body can use query.data! without guarding.
export function Loader({ queries, what, skeleton, children }: LoaderProps) {
  const failed = queries.filter((q) => q.isError)

  if (failed.length > 0) {
    return (
      <ErrorState
        title={`Couldn’t load ${what}`}
        message={failed[0].error!.message}
        onRetry={() => failed.forEach((q) => q.refetch())}
        retrying={failed.some((q) => q.isFetching)}
      />
    )
  }

  if (queries.some((q) => q.isPending)) {
    return (
      <div aria-busy="true">
        <p className="sr-only">Loading {what}…</p>
        {skeleton ?? <PageSkeleton />}
      </div>
    )
  }

  return <>{children()}</>
}

export function PageSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <Skeleton width="min(240px, 60%)" height={26} />
      <div className={styles.cards}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={92} />
        ))}
      </div>
      <Skeleton height={44} />
      <div className={styles.rows}>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} height={36} />
        ))}
      </div>
    </div>
  )
}
