import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import { Button } from './Button'
import styles from './Dialog.module.css'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  variant?: 'modal' | 'drawer'
  footer?: ReactNode
  children: ReactNode
}

// Radix handles focus trapping, Esc, scroll lock and aria wiring. This only adds layout.
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  variant = 'modal',
  footer,
  children,
}: DialogProps) {
  const noDescription = description ? {} : { 'aria-describedby': undefined }

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content className={cx(styles.content, styles[variant])} {...noDescription}>
          <div className={styles.header}>
            <div className={styles.titles}>
              <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className={styles.description}>
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Close">
                ✕
              </Button>
            </RadixDialog.Close>
          </div>
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
