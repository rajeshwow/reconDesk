import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cx } from '@/lib/cx'
import styles from './Toast.module.css'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  tone?: 'info' | 'error'
  action?: ToastAction
}

interface ToastItem extends Required<Pick<ToastOptions, 'tone'>> {
  id: number
  message: string
  action?: ToastAction
}

interface ToastApi {
  show: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const MAX_VISIBLE = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, { tone = 'info', action }: ToastOptions = {}) => {
      const id = ++nextId.current
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, message, tone, action }])
      // Toasts with an Undo stay a little longer so people have time to reach the button.
      window.setTimeout(() => dismiss(id), action ? 6000 : 4000)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={cx(styles.toast, toast.tone === 'error' && styles.error)}>
            <span className={styles.message}>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  toast.action?.onClick()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className={styles.close}
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}
