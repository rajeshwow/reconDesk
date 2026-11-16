import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { countActiveFilters, parseFilters, toSearchParams, type Filters } from '@/lib/filters'

// The URL is the single source of truth for filters: views can be bookmarked or
// shared, and a refresh doesn't lose what the user was looking at.
export function useFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])

  const update = useCallback(
    (patch: Partial<Filters>) =>
      setParams((current) => toSearchParams({ ...parseFilters(current), ...patch }), {
        replace: true,
      }),
    [setParams],
  )

  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams])

  return { filters, update, reset, activeCount: countActiveFilters(filters) }
}
