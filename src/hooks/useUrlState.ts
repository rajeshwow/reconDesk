import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

type Allowed<T> = { [K in keyof T]?: readonly T[K][] }

const ANYTHING = {}

// List state (search, status tab, sort) kept in the URL, so a view can be bookmarked,
// shared, and survives a refresh. Values not in `allowed` fall back to the default.
// Pass module-level constants for both arguments; they're used as memo dependencies.
export function useUrlState<T extends { [K in keyof T]: string }>(
  defaults: T,
  allowed: Allowed<T> = ANYTHING,
) {
  const [params, setParams] = useSearchParams()

  const state = useMemo(() => {
    const result = { ...defaults }
    for (const key of Object.keys(defaults) as (keyof T & string)[]) {
      const value = params.get(key)
      const options = allowed[key] as readonly string[] | undefined
      if (value !== null && (!options || options.includes(value)))
        result[key] = value as T[typeof key]
    }
    return result
  }, [params, defaults, allowed])

  const update = useCallback(
    (patch: Partial<T>) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(patch) as [
            keyof T & string,
            string | undefined,
          ][]) {
            if (!value || value === defaults[key]) next.delete(key)
            else next.set(key, value)
          }
          return next
        },
        { replace: true },
      ),
    [setParams, defaults],
  )

  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams])

  const isFiltered = (Object.keys(defaults) as (keyof T)[]).some(
    (key) => key !== 'sort' && state[key] !== defaults[key],
  )

  return { state, update, reset, isFiltered }
}
