import type { IconName } from '@/components/Icon'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** What the item does, shown in the command palette. */
  description: string
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Workspace',
    items: [
      { to: '/', label: 'Overview', icon: 'overview', description: 'What needs attention today' },
    ],
  },
  {
    title: 'Money',
    items: [
      {
        to: '/reconciliation',
        label: 'Bank reconciliation',
        icon: 'bank',
        description: 'Match the statement to the books',
      },
      {
        to: '/receivables',
        label: 'Receivables',
        icon: 'receivables',
        description: 'Customer invoices and receipts',
      },
      {
        to: '/payables',
        label: 'Payables',
        icon: 'payables',
        description: 'Vendor bills, approvals and payments',
      },
      {
        to: '/parties',
        label: 'Customers & vendors',
        icon: 'parties',
        description: 'Balances and statements of account',
      },
    ],
  },
  {
    title: 'Insights',
    items: [
      { to: '/reports', label: 'Reports', icon: 'reports', description: 'BRS and aging reports' },
      {
        to: '/activity',
        label: 'Activity log',
        icon: 'activity',
        description: 'Who did what, and when',
      },
    ],
  },
]

export const SETTINGS_ITEM: NavItem = {
  to: '/settings',
  label: 'Settings',
  icon: 'settings',
  description: 'Matching tolerance, exclusion rules, appearance',
}

export const ALL_NAV_ITEMS = [...NAV_SECTIONS.flatMap((s) => s.items), SETTINGS_ITEM]
