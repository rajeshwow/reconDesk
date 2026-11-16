import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { resetMockDb, settingsApi } from '@/api/mockApi'
import { queryKeys, useReconciliation, useServerMutation, useSettings } from '@/api/queries'
import type { BankLine, ExclusionRule, Settings } from '@/api/types'
import { Button } from '@/components/Button'
import { FormError, TextField, fieldStyles } from '@/components/Field'
import { Loader } from '@/components/Loader'
import { Page, PageHeader } from '@/components/Page'
import { Panel } from '@/components/Panel'
import { useToast } from '@/components/Toast'
import { ruleMatches } from '@/lib/rules'
import { nextNumber } from '@/lib/workspace'
import { useTheme, type Theme } from '@/app/theme'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  const settings = useSettings()
  const recon = useReconciliation()

  return (
    <Loader queries={[settings, recon]} what="settings">
      {/* Keyed by the saved version, so the draft resets after a save or a reset. */}
      {() => (
        <SettingsForm
          key={JSON.stringify(settings.data)}
          saved={settings.data!}
          lines={recon.data!.bankLines}
        />
      )}
    </Loader>
  )
}

function SettingsForm({ saved, lines }: { saved: Settings; lines: BankLine[] }) {
  const toast = useToast()
  const mutation = useServerMutation(settingsApi.update, [queryKeys.settings])
  const [draft, setDraft] = useState(saved)

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const openLines = lines.filter((l) => l.status === 'open')

  const setRule = (id: string, patch: Partial<ExclusionRule>) =>
    setDraft((d) => ({ ...d, rules: d.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))

  const addRule = () =>
    setDraft((d) => ({
      ...d,
      rules: [
        ...d.rules,
        {
          id: nextNumber(
            d.rules.map((r) => r.id),
            'R-',
          ),
          contains: '',
          reason: '',
          enabled: true,
        },
      ],
    }))

  const removeRule = (id: string) =>
    setDraft((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== id) }))

  function save() {
    mutation.mutate(draft, { onSuccess: () => toast.show('Settings saved. Suggestions updated.') })
  }

  return (
    <Page>
      <PageHeader
        title="Settings"
        subtitle="How matching works for your company"
        actions={
          <>
            <Button disabled={!dirty || mutation.isPending} onClick={() => setDraft(saved)}>
              Discard changes
            </Button>
            <Button variant="primary" disabled={!dirty || mutation.isPending} onClick={save}>
              {mutation.isPending ? 'Saving…' : 'Save settings'}
            </Button>
          </>
        }
      />

      {mutation.error && <FormError>{mutation.error.message}</FormError>}

      <Panel title="Matching">
        <div className={fieldStyles.row}>
          <TextField
            label="Amount tolerance (%)"
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={String(draft.amountTolerance)}
            onChange={(v) => setDraft({ ...draft, amountTolerance: Number(v) })}
            hint="A single book entry can differ from the bank by this much, e.g. 1–2% TDS."
          />
          <TextField
            label="Date window (days)"
            type="number"
            min={1}
            max={60}
            value={String(draft.dateWindowDays)}
            onChange={(v) => setDraft({ ...draft, dateWindowDays: Number(v) })}
            hint="Book entries further apart than this are never suggested."
          />
        </div>
      </Panel>

      <Panel
        title="Exclusion rules"
        actions={
          <Button size="sm" onClick={addRule}>
            Add rule
          </Button>
        }
      >
        <p className={styles.help}>
          Bank lines whose narration contains the text are excluded with the reason, when you press{' '}
          <strong>Apply rules</strong> on the reconciliation page. The first matching rule wins.
        </p>
        <ul className={styles.rules}>
          {draft.rules.map((rule, index) => {
            const hits = openLines.filter((l) => ruleMatches({ ...rule, enabled: true }, l)).length
            return (
              <li key={rule.id} className={styles.rule}>
                <TextField
                  label={`Rule ${index + 1}: narration contains`}
                  value={rule.contains}
                  onChange={(contains) => setRule(rule.id, { contains })}
                  hint={`${hits} open line${hits === 1 ? '' : 's'} match right now`}
                />
                <TextField
                  label="Reason"
                  value={rule.reason}
                  onChange={(reason) => setRule(rule.id, { reason })}
                />
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => setRule(rule.id, { enabled: e.target.checked })}
                  />
                  On
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove rule ${index + 1}`}
                  onClick={() => removeRule(rule.id)}
                >
                  Remove
                </Button>
              </li>
            )
          })}
        </ul>
      </Panel>

      <AppearancePanel />
      <DemoDataPanel />
    </Page>
  )
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Match my device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function AppearancePanel() {
  const { theme, setTheme } = useTheme()
  return (
    <Panel title="Appearance">
      <fieldset className={styles.themes}>
        <legend className="sr-only">Theme</legend>
        {THEMES.map((option) => (
          <label key={option.value} className={styles.theme}>
            <input
              type="radio"
              name="theme"
              checked={theme === option.value}
              onChange={() => setTheme(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    </Panel>
  )
}

// Handy while demoing: puts every module back to the seeded month.
function DemoDataPanel() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return (
    <Panel title="Demo data">
      <div className={styles.demo}>
        <p className={styles.help}>
          Start over with the original invoices, bills and bank statement.
        </p>
        <Button
          variant="danger"
          onClick={() => {
            resetMockDb()
            queryClient.invalidateQueries()
            toast.show('Demo data reset')
          }}
        >
          Reset demo data
        </Button>
      </div>
    </Panel>
  )
}
