import { Link } from 'react-router-dom'
import { buttonClass } from '@/components/Button'
import { EmptyState } from '@/components/States'

export function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      action={
        <Link to="/" className={buttonClass('primary')}>
          Go to the overview
        </Link>
      }
    >
      There’s nothing at this address.
    </EmptyState>
  )
}
