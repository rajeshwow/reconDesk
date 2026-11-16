import { useMemo } from 'react'
import { useActivity } from '@/api/queries'
import type { ActivityEvent, Module } from '@/api/types'
import { Button } from '@/components/Button'
import { SearchInput } from '@/components/Field'
import { Loader } from '@/components/Loader'
import { Page, PageHeader } from '@/components/Page'
import { Panel } from '@/components/Panel'
import { Segmented } from '@/components/Segmented'
import { EmptyState } from '@/components/States'
import { Toolbar } from '@/components/Toolbar'
import { useUrlState } from '@/hooks/useUrlState'
import { toISODate } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { ActivityFeed, MODULE_LABELS } from './ActivityFeed'

const MODULES = ['all', 'reconciliation', 'receivables', 'payables', 'settings'] as const
const DEFAULTS = { q: '', module: 'all' as (typeof MODULES)[number] }
const ALLOWED = { module: MODULES }

export function ActivityPage() {
  const activity = useActivity()
  return (
    <Loader queries={[activity]} what="the activity log">
      {() => <Activity events={activity.data!} />}
    </Loader>
  )
}

function Activity({ events }: { events: ActivityEvent[] }) {
  const { state, update, reset, isFiltered } = useUrlState(DEFAULTS, ALLOWED)

  const visible = useMemo(() => {
    const q = state.q.trim().toLowerCase()
    return events
      .filter((e) => state.module === 'all' || e.module === state.module)
      .filter((e) => !q || e.text.toLowerCase().includes(q) || e.by.toLowerCase().includes(q))
  }, [events, state])

  // Grouped by day, newest first. The events already arrive newest first.
  const days = useMemo(() => {
    const groups = new Map<string, ActivityEvent[]>()
    for (const event of visible) {
      const day = toISODate(new Date(event.at))
      groups.set(day, [...(groups.get(day) ?? []), event])
    }
    return [...groups]
  }, [visible])

  return (
    <Page>
      <PageHeader title="Activity log" subtitle="Every change, who made it and when" />

      <Segmented
        label="Module"
        value={state.module}
        options={MODULES.map((value) => ({
          value,
          label: value === 'all' ? 'Everything' : MODULE_LABELS[value as Module],
          count: value === 'all' ? events.length : events.filter((e) => e.module === value).length,
        }))}
        onChange={(module) => update({ module })}
      />

      <Toolbar label="Filter activity">
        <SearchInput
          label="Search activity"
          placeholder="Party, voucher, person…"
          value={state.q}
          onChange={(q) => update({ q })}
        />
      </Toolbar>

      {days.length === 0 ? (
        <EmptyState
          title="No activity matches"
          action={isFiltered && <Button onClick={reset}>Clear filters</Button>}
        />
      ) : (
        days.map(([day, dayEvents]) => (
          <Panel key={day} title={formatDate(day, true)}>
            <ActivityFeed events={dayEvents} showModule={state.module === 'all'} />
          </Panel>
        ))
      )}
    </Page>
  )
}
